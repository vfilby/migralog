/**
 * Migration from DAILY recurring notifications to one-time notifications
 *
 * This module handles the one-time migration from the old notification system
 * (using DAILY recurring triggers) to the new system (using one-time Date triggers
 * with database tracking).
 *
 * The migration:
 * 1. Cancels all existing DAILY notifications
 * 2. Schedules N one-time notifications for each active schedule
 * 3. Populates the scheduled_notifications table
 * 4. Marks migration as complete in AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';
import { medicationRepository, medicationScheduleRepository } from '../../database/medicationRepository';
import {
  calculateNotificationDays,
  scheduleNotificationsForDays,
} from './medicationNotifications';

const MIGRATION_KEY = 'notification_system_migrated_to_one_time_v1';

/**
 * Check if migration has already been completed
 */
export async function isMigrationComplete(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(MIGRATION_KEY);
    return value === 'true';
  } catch (error) {
    logger.error('[NotificationMigration] Error checking migration status:', error);
    return false;
  }
}

/**
 * Mark migration as complete
 */
async function markMigrationComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(MIGRATION_KEY, 'true');
    logger.log('[NotificationMigration] Migration marked as complete');
  } catch (error) {
    logger.error('[NotificationMigration] Error marking migration complete:', error);
  }
}

/**
 * Migrate from DAILY notifications to one-time notifications
 *
 * This is a one-time migration that runs on app update. It:
 * 1. Checks if already migrated (no-op if so)
 * 2. Cancels all existing medication notifications (DAILY triggers)
 * 3. Schedules new one-time notifications for each active schedule
 * 4. Records all mappings in the database
 * 5. Marks migration as complete
 */
export async function migrateToOneTimeNotifications(): Promise<void> {
  try {
    // Check if already migrated
    if (await isMigrationComplete()) {
      logger.log('[NotificationMigration] Already migrated, skipping');
      return;
    }

    logger.log('[NotificationMigration] Starting migration to one-time notifications...');

    // Get all scheduled notifications
    const existingNotifications = await Notifications.getAllScheduledNotificationsAsync();

    // Cancel only medication-related notifications (not daily check-in, etc.)
    const medicationNotifications = existingNotifications.filter((n) => {
      const data = n.content.data as Record<string, unknown> | null | undefined;
      if (!data) return false;

      const medicationId = data.medicationId as string | undefined;
      const medicationIds = data.medicationIds as string[] | undefined;
      const type = data.type as string | undefined;

      // Filter for medication reminders (have medicationId or medicationIds, but not type 'daily_checkin')
      return (medicationId || medicationIds) && type !== 'daily_checkin';
    });

    logger.log('[NotificationMigration] Found medication notifications to cancel:', {
      total: existingNotifications.length,
      medication: medicationNotifications.length,
    });

    // Cancel all medication notifications
    for (const notification of medicationNotifications) {
      try {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      } catch {
        logger.warn('[NotificationMigration] Failed to cancel notification:', notification.identifier);
      }
    }

    logger.log('[NotificationMigration] Cancelled existing medication notifications');

    // Get all active medications with schedules
    const medications = await medicationRepository.getActive();
    let scheduledCount = 0;

    // Count active schedules for notification day calculation
    let totalSchedules = 0;
    for (const medication of medications) {
      if (medication.type === 'preventative' && medication.scheduleFrequency === 'daily') {
        const schedules = await medicationScheduleRepository.getByMedicationId(medication.id);
        totalSchedules += schedules.filter(s => s.enabled).length;
      }
    }

    // Calculate how many days to schedule
    const daysToSchedule = calculateNotificationDays(totalSchedules);

    logger.log('[NotificationMigration] Scheduling new notifications:', {
      totalSchedules,
      daysToSchedule,
    });

    // Schedule new one-time notifications for each active schedule
    for (const medication of medications) {
      if (medication.type === 'preventative' && medication.scheduleFrequency === 'daily') {
        const schedules = await medicationScheduleRepository.getByMedicationId(medication.id);

        for (const schedule of schedules) {
          if (schedule.enabled) {
            await scheduleNotificationsForDays(medication, schedule, daysToSchedule);
            scheduledCount++;
          }
        }
      }
    }

    logger.log('[NotificationMigration] Scheduled new notifications:', {
      schedulesProcessed: scheduledCount,
      daysPerSchedule: daysToSchedule,
    });

    // Mark migration as complete
    await markMigrationComplete();

    logger.log('[NotificationMigration] Migration complete');
  } catch (error) {
    // Log error but don't throw - we don't want to block app startup
    logger.error('[NotificationMigration] Migration failed:', error);

    // Still mark as complete to avoid repeated failures
    // The reconcile/top-up logic will handle any missing notifications
    await markMigrationComplete();
  }
}

/**
 * Reset migration status (for testing or re-migration)
 */
export async function resetMigrationStatus(): Promise<void> {
  try {
    await AsyncStorage.removeItem(MIGRATION_KEY);
    logger.log('[NotificationMigration] Migration status reset');
  } catch (error) {
    logger.error('[NotificationMigration] Error resetting migration status:', error);
  }
}
