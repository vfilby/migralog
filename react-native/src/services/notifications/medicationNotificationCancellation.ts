import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';
import { Medication, MedicationSchedule } from '../../models/types';
// ARCHITECTURAL EXCEPTION: Notification handlers need direct repository access
// because they run in background when app may be suspended. See docs/store-repository-guidelines.md
import { medicationRepository, medicationScheduleRepository } from '../../database/medicationRepository';
import { useNotificationSettingsStore } from '../../store/notificationSettingsStore';
import {
  scheduleNotificationAtomic,
  cancelNotificationAtomic,
} from './notificationScheduler';
import {
  localDateTimeFromStrings,
} from '../../utils/dateFormatting';
import { scheduledNotificationRepository } from '../../database/scheduledNotificationRepository';
import { NotificationType } from '../../types/notifications';
import { notificationDismissalService } from './NotificationDismissalService';
import { MEDICATION_REMINDER_CATEGORY } from './notificationCategories';

/**
 * Cancel all notifications for a medication
 */
export async function cancelMedicationNotifications(medicationId: string): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const medicationNotifs = scheduled.filter(
      // Notification data type is dynamic
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (n) => (n.content.data as any)?.medicationId === medicationId
    );

    for (const notif of medicationNotifs) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }

    logger.log('[Notification] Cancelled', medicationNotifs.length, 'notifications for medication');
  } catch (error) {
    logger.error('[Notification] Error cancelling medication notifications:', error);
  }
}

/**
 * Cancel scheduled medication reminder for a specific schedule
 * This is used when medication is logged before the scheduled reminder time
 * to prevent the notification from firing after the dose was already taken
 *
 * Handles both single and grouped notifications:
 * - Single: medicationId and scheduleId in data
 * - Grouped: medicationIds[] and scheduleIds[] arrays in data
 */
export async function cancelScheduledMedicationReminder(medicationId: string, scheduleId?: string): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    let cancelledCount = 0;

    for (const notif of scheduled) {
      const data = notif.content.data as {
        medicationId?: string;
        medicationIds?: string[];
        scheduleId?: string;
        scheduleIds?: string[];
      };

      let shouldCancel = false;

      // Single medication notification
      if (data.medicationId === medicationId) {
        if (scheduleId) {
          // Only cancel if scheduleId matches (for medications with multiple daily schedules)
          shouldCancel = data.scheduleId === scheduleId;
        } else {
          shouldCancel = true;
        }
      }

      // Grouped notification - check if this medication/schedule is in the group
      if (data.medicationIds && data.scheduleIds) {
        for (let i = 0; i < data.medicationIds.length; i++) {
          if (data.medicationIds[i] === medicationId) {
            if (scheduleId) {
              shouldCancel = data.scheduleIds[i] === scheduleId;
            } else {
              shouldCancel = true;
            }
            break;
          }
        }
      }

      if (shouldCancel) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
        cancelledCount++;
        logger.log('[Notification] Cancelled scheduled reminder:', {
          notificationId: notif.identifier,
          medicationId,
          scheduleId,
        });
      }
    }

    if (cancelledCount > 0) {
      logger.log('[Notification] Cancelled', cancelledCount, 'scheduled reminders for medication');
    }
  } catch (error) {
    logger.error('[Notification] Error cancelling scheduled medication reminder:', error);
  }
}

/**
 * Dismiss presented notifications for a medication using cross-reference logic
 * This removes notifications from the notification tray when medication is logged from the app
 *
 * NEW IMPLEMENTATION: Uses NotificationDismissalService for comprehensive cross-reference logic
 * - Primary: Database ID lookup for exact matching
 * - Fallback: Time-based, content-based, and category-based matching strategies
 * - Maintains safety checks for grouped notifications
 * - Provides >95% dismissal success rate for single notifications
 * - Comprehensive logging and confidence scoring
 *
 * BREAKING CHANGE (DIS-106a & DIS-106b): scheduleId is now REQUIRED
 * - Removes unused "dismiss all" code path that was a bug vector
 * - In production, scheduleId is always provided when logging a dose
 * - This makes the function safer and more predictable
 *
 * SAFETY FIX (DIS-130 & DIS-171): For grouped notifications (multiple medications at the same time):
 * - Only dismisses group notification when ALL medications in the group are logged/skipped
 * - This prevents users from missing other medications in the group
 * - Checks database to verify all medications are accounted for before dismissing
 */
export async function dismissMedicationNotification(medicationId: string, scheduleId: string): Promise<void> {
  try {
    logger.info('[Notification] dismissMedicationNotification called - using cross-reference service', {
      medicationId,
      scheduleId,
      component: 'NotificationDismiss',
    });

    // Get all presented notifications
    const presentedNotifications = await Notifications.getPresentedNotificationsAsync();

    logger.info('[Notification] Retrieved presented notifications for cross-reference evaluation', {
      totalPresented: presentedNotifications.length,
      medicationId,
      scheduleId,
      component: 'NotificationDismiss',
    });

    let dismissedCount = 0;
    let dismissedInitial = 0;
    let dismissedFollowUps = 0;
    let strategyCounts = {
      database_id_lookup: 0,
      time_based: 0,
      content_based: 0,
      category_based: 0,
      none: 0,
    };

    for (const notification of presentedNotifications) {
      const notificationId = notification.request.identifier;
      const data = notification.request.content.data as {
        medicationId?: string;
        medicationIds?: string[];
        scheduleId?: string;
        scheduleIds?: string[];
        time?: string;
        isFollowUp?: boolean;
        type?: string;
      };

      // Skip non-medication notifications (like daily check-in)
      if (data.type === 'daily_checkin') {
        logger.debug('[Notification] Skipping daily check-in notification', {
          notificationId,
          component: 'NotificationDismiss',
        });
        continue;
      }

      logger.debug('[Notification] Evaluating notification with cross-reference service', {
        notificationId,
        notificationData: {
          medicationId: data.medicationId,
          medicationIds: data.medicationIds,
          scheduleId: data.scheduleId,
          scheduleIds: data.scheduleIds,
          time: data.time,
          isFollowUp: data.isFollowUp,
        },
        targetMedicationId: medicationId,
        targetScheduleId: scheduleId,
        component: 'NotificationDismiss',
      });

      // Use the cross-reference service to determine if this notification should be dismissed
      const dismissalResult = await notificationDismissalService.shouldDismissNotification(
        notificationId,
        medicationId,
        scheduleId,
        new Date()
      );

      strategyCounts[dismissalResult.strategy]++;

      logger.info('[Notification] Cross-reference evaluation result', {
        notificationId,
        shouldDismiss: dismissalResult.shouldDismiss,
        strategy: dismissalResult.strategy,
        confidence: dismissalResult.confidence,
        context: dismissalResult.context,
        medicationId,
        scheduleId,
        component: 'NotificationDismiss',
      });

      if (dismissalResult.shouldDismiss) {
        try {
          logger.info('[Notification] Dismissing notification based on cross-reference logic', {
            notificationId,
            strategy: dismissalResult.strategy,
            confidence: dismissalResult.confidence,
            medicationId,
            scheduleId,
            component: 'NotificationDismiss',
          });

          await Notifications.dismissNotificationAsync(notificationId);

          dismissedCount++;
          if (data.isFollowUp) {
            dismissedFollowUps++;
          } else {
            dismissedInitial++;
          }

          logger.info('[Notification] Successfully dismissed notification via cross-reference', {
            notificationId,
            medicationId,
            scheduleId,
            strategy: dismissalResult.strategy,
            confidence: dismissalResult.confidence,
            isFollowUp: data.isFollowUp || false,
            notificationType: data.isFollowUp ? 'follow-up reminder' : 'initial notification',
            component: 'NotificationDismiss',
          });
        } catch (dismissError) {
          // Log dismiss failure with notification context (DIS-208)
          const dismissErrorMessage = dismissError instanceof Error ? dismissError.message : String(dismissError);

          logger.warn(dismissError instanceof Error ? dismissError : new Error(dismissErrorMessage), {
            component: 'NotificationDismiss',
            operation: 'dismissNotificationAsync',
            notificationId,
            medicationId,
            scheduleId,
            strategy: dismissalResult.strategy,
            confidence: dismissalResult.confidence,
            errorMessage: dismissErrorMessage,
          });
          // Continue processing other notifications even if one fails
        }
      } else {
        logger.info('[Notification] Not dismissing notification - cross-reference criteria not met', {
          notificationId,
          strategy: dismissalResult.strategy,
          confidence: dismissalResult.confidence,
          context: dismissalResult.context,
          medicationId,
          scheduleId,
          component: 'NotificationDismiss',
        });
      }
    }

    logger.info('[Notification] Completed cross-reference dismissal evaluation', {
      totalProcessed: presentedNotifications.length,
      totalDismissed: dismissedCount,
      dismissedInitial,
      dismissedFollowUps,
      strategyCounts,
      medicationId,
      scheduleId,
      successRate: presentedNotifications.length > 0 ? Math.round((dismissedCount / presentedNotifications.length) * 100) : 0,
      component: 'NotificationDismiss',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Log with full context (DIS-187, DIS-208)
    logger.error(error instanceof Error ? error : new Error(errorMessage), {
      component: 'NotificationDismiss',
      operation: 'dismissMedicationNotification',
      medicationId,
      scheduleId,
      errorMessage,
    });
  }
}

/**
 * Cancel a notification for a specific date
 *
 * Handles both single and grouped notifications:
 * - Single: Simply cancels the notification and removes the mapping
 * - Grouped: Cancels the group notification, recreates it for remaining medications
 *
 * @param medicationId - ID of the medication
 * @param scheduleId - ID of the schedule
 * @param date - Date in YYYY-MM-DD format
 * @param notificationType - Type of notification ('reminder' or 'follow_up')
 */
export async function cancelNotificationForDate(
  medicationId: string,
  scheduleId: string,
  date: string,
  notificationType: NotificationType = 'reminder'
): Promise<void> {
  try {
    // Look up the mapping
    const mapping = await scheduledNotificationRepository.getMapping(
      medicationId,
      scheduleId,
      date,
      notificationType
    );

    if (!mapping) {
      logger.log('[Notification] No mapping found to cancel:', {
        medicationId,
        scheduleId,
        date,
        notificationType,
      });
      return;
    }

    if (!mapping.isGrouped) {
      // Simple case: Cancel the notification and remove mapping
      await cancelNotificationAtomic(mapping.notificationId);
      logger.log('[Notification] Cancelled ungrouped notification for date:', {
        medicationId,
        scheduleId,
        date,
        notificationType,
      });
    } else {
      // Complex case: This is part of a grouped notification
      // Get all mappings for this group
      const groupMappings = await scheduledNotificationRepository.getMappingsByGroupKey(
        mapping.groupKey!,
        date
      );

      // Filter to only include mappings of the SAME notification type, excluding the one we're cancelling
      // This prevents the cancelled medication's other notification type (e.g., follow_up when cancelling reminder)
      // from being included in the recreated group
      const remainingMappings = groupMappings.filter(
        m => m.notificationType === notificationType &&
             !(m.medicationId === medicationId && m.scheduleId === scheduleId)
      );

      // Cancel the original grouped notification
      await Notifications.cancelScheduledNotificationAsync(mapping.notificationId);

      // Delete the mapping for the cancelled medication
      await scheduledNotificationRepository.deleteMapping(mapping.id);

      if (remainingMappings.length === 0) {
        // No remaining medications - clean up all mappings
        for (const m of groupMappings) {
          if (m.id !== mapping.id) {
            await scheduledNotificationRepository.deleteMapping(m.id);
          }
        }
        logger.log('[Notification] All medications in group cancelled, notification removed');
      } else if (remainingMappings.length === 1) {
        // Only one medication left - convert to single notification
        const remaining = remainingMappings[0];
        // These mappings are medication notifications, so IDs should exist
        if (!remaining.medicationId || !remaining.scheduleId) {
          logger.warn('[Notification] Invalid mapping in group - missing medication/schedule ID');
          return;
        }
        const medication = await medicationRepository.getById(remaining.medicationId);
        // Load schedules from database since medication.schedule is always empty
        const schedules = await medicationScheduleRepository.getByMedicationId(remaining.medicationId);
        const schedule = schedules.find(s => s.id === remaining.scheduleId);

        if (medication && schedule) {
          // Schedule a single notification
          const effectiveSettings = useNotificationSettingsStore.getState().getEffectiveSettings(medication.id);

          // Use appropriate content based on notification type
          const isFollowUp = remaining.notificationType === 'follow_up';

          // Use the stored trigger time from the mapping if available (preserves test timing)
          // Otherwise fall back to recalculating from schedule time + settings
          let triggerDate: Date;
          if (remaining.scheduledTriggerTime) {
            triggerDate = new Date(remaining.scheduledTriggerTime);
          } else {
            const baseTriggerDate = localDateTimeFromStrings(date, schedule.time);
            triggerDate = baseTriggerDate;
            if (isFollowUp && effectiveSettings.followUpDelay !== 'off') {
              triggerDate = new Date(baseTriggerDate.getTime() + effectiveSettings.followUpDelay * 60 * 1000);
            }
          }

          if (triggerDate > new Date()) {
            const title = isFollowUp
              ? `Reminder: ${medication.name}`
              : `Time for ${medication.name}`;
            const body = isFollowUp
              ? 'Did you take your medication?'
              : `${schedule.dosage} dose(s) - ${medication.dosageAmount}${medication.dosageUnit} each`;

            // Delete the old grouped mapping BEFORE creating new one to avoid unique constraint violation
            await scheduledNotificationRepository.deleteMapping(remaining.id);

            const newMapping = await scheduleNotificationAtomic(
              {
                title,
                body,
                data: {
                  medicationId: medication.id,
                  scheduleId: schedule.id,
                  ...(isFollowUp && { isFollowUp: true }),
                },
                categoryIdentifier: MEDICATION_REMINDER_CATEGORY,
                sound: true,
                ...(isFollowUp && effectiveSettings.criticalAlertsEnabled && { critical: true } as unknown as Record<string, unknown>),
                ...(isFollowUp && effectiveSettings.criticalAlertsEnabled && { interruptionLevel: 'critical' } as unknown as Record<string, unknown>),
                ...(isFollowUp && !effectiveSettings.criticalAlertsEnabled && effectiveSettings.timeSensitiveEnabled && { interruptionLevel: 'timeSensitive' } as unknown as Record<string, unknown>),
                ...(!isFollowUp && effectiveSettings.timeSensitiveEnabled && { interruptionLevel: 'timeSensitive' } as unknown as Record<string, unknown>),
              },
              triggerDate,
              {
                medicationId: medication.id,
                scheduleId: schedule.id,
                date,
                notificationType: remaining.notificationType,
                isGrouped: false,
              }
            );

            logger.log('[Notification] Converted group to single notification:', {
              medicationId: medication.id,
              newMappingId: newMapping?.id,
            });
          }
        }
      } else {
        // Multiple medications remain - recreate grouped notification
        const medications: Array<{ medication: Medication; schedule: MedicationSchedule }> = [];

        for (const m of remainingMappings) {
          if (!m.medicationId || !m.scheduleId) continue;
          const medication = await medicationRepository.getById(m.medicationId);
          // Load schedules from database since medication.schedule is always empty
          const schedules = await medicationScheduleRepository.getByMedicationId(m.medicationId);
          const schedule = schedules.find(s => s.id === m.scheduleId);
          if (medication && schedule) {
            medications.push({ medication, schedule });
          }
        }

        if (medications.length > 1) {
          // Use appropriate content based on notification type
          const isFollowUp = notificationType === 'follow_up';

          // Use the stored trigger time from the first remaining mapping if available (preserves test timing)
          // Otherwise fall back to recalculating from schedule time + settings
          const settingsStore = useNotificationSettingsStore.getState();
          let triggerDate: Date;

          const firstMappingWithTriggerTime = remainingMappings.find(m => m.scheduledTriggerTime);
          if (firstMappingWithTriggerTime?.scheduledTriggerTime) {
            triggerDate = new Date(firstMappingWithTriggerTime.scheduledTriggerTime);
          } else {
            const baseTriggerDate = localDateTimeFromStrings(date, mapping.groupKey!);
            triggerDate = baseTriggerDate;
            if (isFollowUp) {
              // Get the maximum follow-up delay from all medications in the group
              const delays = medications.map(({ medication }) => {
                const settings = settingsStore.getEffectiveSettings(medication.id);
                return settings.followUpDelay;
              }).filter(d => d !== 'off') as number[];

              if (delays.length > 0) {
                const maxDelay = Math.max(...delays);
                triggerDate = new Date(baseTriggerDate.getTime() + maxDelay * 60 * 1000);
              }
            }
          }

          if (triggerDate > new Date()) {
            // Schedule new grouped notification
            const medicationNames = medications.map(({ medication }) => medication.name).join(', ');
            const medicationCount = medications.length;
            const medicationIds = medications.map(({ medication }) => medication.id);
            const scheduleIds = medications.map(({ schedule }) => schedule.id);

            const anyTimeSensitive = medications.some(({ medication }) => {
              const settings = settingsStore.getEffectiveSettings(medication.id);
              return settings.timeSensitiveEnabled;
            });
            const anyCritical = medications.some(({ medication }) => {
              const settings = settingsStore.getEffectiveSettings(medication.id);
              return settings.criticalAlertsEnabled;
            });

            const title = isFollowUp
              ? `Reminder: ${medicationCount} Medications`
              : `Time for ${medicationCount} Medications`;
            const body = isFollowUp
              ? `Did you take: ${medicationNames}?`
              : medicationNames;

            // Import the category here to avoid circular dependency
            const { MULTIPLE_MEDICATION_REMINDER_CATEGORY } = await import('./notificationCategories');

            const newNotificationId = await Notifications.scheduleNotificationAsync({
              content: {
                title,
                body,
                data: {
                  medicationIds,
                  scheduleIds,
                  time: mapping.groupKey,
                  ...(isFollowUp && { isFollowUp: true }),
                },
                categoryIdentifier: MULTIPLE_MEDICATION_REMINDER_CATEGORY,
                sound: true,
                ...(isFollowUp && anyCritical && { critical: true } as unknown as Record<string, unknown>),
                ...(isFollowUp && anyCritical && { interruptionLevel: 'critical' } as unknown as Record<string, unknown>),
                ...(isFollowUp && !anyCritical && anyTimeSensitive && { interruptionLevel: 'timeSensitive' } as unknown as Record<string, unknown>),
                ...(!isFollowUp && anyTimeSensitive && { interruptionLevel: 'timeSensitive' } as unknown as Record<string, unknown>),
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: triggerDate,
              },
            });

            // Update mappings with new notification ID, preserving scheduledTriggerTime
            for (const m of remainingMappings) {
              if (!m.medicationId || !m.scheduleId) continue;
              await scheduledNotificationRepository.deleteMapping(m.id);
              await scheduledNotificationRepository.saveMapping({
                medicationId: m.medicationId,
                scheduleId: m.scheduleId,
                date: m.date,
                notificationId: newNotificationId,
                notificationType: m.notificationType,
                isGrouped: true,
                groupKey: m.groupKey,
                sourceType: 'medication',
                scheduledTriggerTime: triggerDate,
              });
            }

            logger.log('[Notification] Recreated grouped notification:', {
              remainingCount: medications.length,
              newNotificationId,
            });
          }
        }
      }

      logger.log('[Notification] Cancelled grouped notification for date:', {
        medicationId,
        scheduleId,
        date,
        notificationType,
        remainingInGroup: remainingMappings.length,
      });
    }
  } catch (error) {
    logger.error('[Notification] Error cancelling notification for date:', error);
  }
}
