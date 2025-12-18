import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';
import { medicationRepository, medicationDoseRepository } from '../../database/medicationRepository';
import { scheduledNotificationRepository } from '../../database/scheduledNotificationRepository';

/**
 * Result of a notification dismissal check
 */
export interface DismissalResult {
  /** Whether the notification should be dismissed */
  shouldDismiss: boolean;
  /** Strategy that determined the dismissal decision */
  strategy: 'database_id_lookup' | 'none';
  /** Confidence score for the dismissal decision (0-100) */
  confidence: number;
  /** Additional context about the decision */
  context?: string;
}

/**
 * NotificationDismissalService - Database ID Lookup Dismissal Logic
 *
 * This service implements notification dismissal logic using database
 * cross-reference as the ONLY strategy for determining whether to dismiss a notification.
 *
 * Key Features:
 * - Database ID lookup for exact matching (ONLY strategy)
 * - Support for all notification types: single, grouped, daily check-in, follow-up
 * - Safety mechanisms for grouped notifications
 * - Fail-safe behavior: if database lookup fails, notification is NOT dismissed
 * - Comprehensive logging for diagnostics
 */
export class NotificationDismissalService {

  /**
   * Determine whether a notification should be dismissed based on database ID lookup
   *
   * @param notificationId - OS notification identifier
   * @param targetMedicationId - Medication ID that was logged/acted upon
   * @param targetScheduleId - Schedule ID that was logged/acted upon
   * @param loggedTime - Time when the dose was logged (unused, kept for API compatibility)
   * @returns Promise<DismissalResult> - Decision and reasoning
   */
  async shouldDismissNotification(
    notificationId: string,
    targetMedicationId: string,
    targetScheduleId: string,
    loggedTime: Date = new Date()
  ): Promise<DismissalResult> {
    try {
      logger.debug('[NotificationDismissal] Evaluating notification for dismissal', {
        notificationId,
        targetMedicationId,
        targetScheduleId,
        loggedTime: loggedTime.toISOString(),
        component: 'NotificationDismissalService',
      });

      // Database ID Lookup (ONLY strategy)
      const result = await this.checkDatabaseIdLookup(
        notificationId,
        targetMedicationId,
        targetScheduleId
      );

      if (result.shouldDismiss) {
        logger.info('[NotificationDismissal] Database lookup succeeded - dismissing notification', {
          notificationId,
          strategy: result.strategy,
          confidence: result.confidence,
          component: 'NotificationDismissalService',
        });
        return result;
      }

      // If database lookup found a match but decided not to dismiss (e.g., grouped notification safety),
      // return that result with clear context
      if (result.strategy === 'database_id_lookup' && result.confidence === 100) {
        logger.info('[NotificationDismissal] Database lookup found match but not dismissing', {
          notificationId,
          strategy: result.strategy,
          confidence: result.confidence,
          context: result.context,
          component: 'NotificationDismissalService',
        });
        return result;
      }

      // Database lookup failed - log warning for diagnostics
      logger.warn('[NotificationDismissal] Database lookup failed - notification will NOT be dismissed', {
        notificationId,
        targetMedicationId,
        targetScheduleId,
        confidence: result.confidence,
        context: result.context,
        component: 'NotificationDismissalService',
      });

      return {
        shouldDismiss: false,
        strategy: 'none',
        confidence: 0,
        context: result.context || 'Database lookup failed',
      };
    } catch (error) {
      logger.error('[NotificationDismissal] Error evaluating dismissal', error instanceof Error ? error : new Error(String(error)), {
        notificationId,
        targetMedicationId,
        targetScheduleId,
        component: 'NotificationDismissalService',
      });

      return {
        shouldDismiss: false,
        strategy: 'none',
        confidence: 0,
        context: 'Error occurred during evaluation',
      };
    }
  }

  /**
   * Database ID Lookup
   *
   * Uses the scheduled notification repository to find exact matches based on
   * notification ID and cross-reference with medication/schedule IDs.
   */
  private async checkDatabaseIdLookup(
    notificationId: string,
    targetMedicationId: string,
    targetScheduleId: string
  ): Promise<DismissalResult> {
    try {
      // Look up notification mappings by notification ID
      const mappings = await scheduledNotificationRepository.getMappingsByNotificationId(notificationId);

      logger.debug('[NotificationDismissal] Database lookup found mappings', {
        notificationId,
        mappingCount: mappings.length,
        mappings: mappings.map(m => ({
          medicationId: m.medicationId,
          scheduleId: m.scheduleId,
          notificationType: m.notificationType,
          isGrouped: m.isGrouped,
        })),
        component: 'NotificationDismissalService',
      });

      for (const mapping of mappings) {
        if (mapping.medicationId === targetMedicationId && mapping.scheduleId === targetScheduleId) {
          // Handle grouped notifications with safety check
          if (mapping.isGrouped && mappings.length > 1) {
            const shouldDismissGroup = await this.checkGroupedNotificationSafety(
              mappings,
              targetMedicationId,
              targetScheduleId,
              mapping.date
            );

            if (!shouldDismissGroup) {
              return {
                shouldDismiss: false,
                strategy: 'database_id_lookup',
                confidence: 100,
                context: 'Grouped notification - not all medications logged',
              };
            }
          }

          return {
            shouldDismiss: true,
            strategy: 'database_id_lookup',
            confidence: 100,
            context: 'Exact database match found',
          };
        }
      }

      return {
        shouldDismiss: false,
        strategy: 'database_id_lookup',
        confidence: 0,
        context: 'No matching mapping found in database',
      };
    } catch (error) {
      logger.error('[NotificationDismissal] Database lookup failed', error instanceof Error ? error : new Error(String(error)), {
        notificationId,
        targetMedicationId,
        targetScheduleId,
        component: 'NotificationDismissalService',
      });

      return {
        shouldDismiss: false,
        strategy: 'database_id_lookup',
        confidence: 0,
        context: 'Database lookup error',
      };
    }
  }

  /**
   * Safety check for grouped notifications
   *
   * Ensures that grouped notifications are only dismissed when ALL medications
   * in the group have been logged for the target date.
   */
  private async checkGroupedNotificationSafety(
    mappings: Array<{ medicationId: string | null; scheduleId: string | null; date: string }>,
    targetMedicationId: string,
    targetScheduleId: string,
    date: string
  ): Promise<boolean> {
    try {
      logger.debug('[NotificationDismissal] Checking grouped notification safety', {
        targetMedicationId,
        targetScheduleId,
        date,
        mappingCount: mappings.length,
        component: 'NotificationDismissalService',
      });

      // Check each medication in the group
      for (const mapping of mappings) {
        if (!mapping.medicationId || !mapping.scheduleId) {
          continue; // Skip non-medication mappings
        }

        // Get medication and schedule info
        const medication = await medicationRepository.getById(mapping.medicationId);
        if (!medication) continue;

        const schedule = medication.schedule?.find(s => s.id === mapping.scheduleId);
        if (!schedule) continue;

        // Check if this medication was logged for this schedule today
        const wasLogged = await medicationDoseRepository.wasLoggedForScheduleToday(
          mapping.medicationId,
          mapping.scheduleId,
          schedule.time,
          schedule.timezone
        );

        logger.debug('[NotificationDismissal] Grouped medication status', {
          medicationId: mapping.medicationId,
          scheduleId: mapping.scheduleId,
          medicationName: medication.name,
          wasLogged,
          component: 'NotificationDismissalService',
        });

        if (!wasLogged) {
          logger.info('[NotificationDismissal] Grouped notification: not all medications logged', {
            targetMedicationId,
            notLoggedMedicationId: mapping.medicationId,
            notLoggedMedicationName: medication.name,
            date,
            component: 'NotificationDismissalService',
          });
          return false; // Don't dismiss - other medications still need to be logged
        }
      }

      logger.info('[NotificationDismissal] Grouped notification: all medications logged, safe to dismiss', {
        targetMedicationId,
        date,
        totalInGroup: mappings.length,
        component: 'NotificationDismissalService',
      });

      return true; // All medications are logged, safe to dismiss
    } catch (error) {
      logger.error('[NotificationDismissal] Error checking grouped notification safety', error instanceof Error ? error : new Error(String(error)), {
        targetMedicationId,
        targetScheduleId,
        date,
        component: 'NotificationDismissalService',
      });

      return false; // Err on the side of caution
    }
  }

  /**
   * Dismiss notifications for a daily check-in date
   *
   * Handles daily check-in notification dismissal using database cross-reference.
   * Uses date-based lookup for exact matching.
   */
  async dismissDailyCheckinForDate(date: string): Promise<boolean> {
    try {
      logger.info('[NotificationDismissal] Dismissing daily check-in for date', {
        date,
        component: 'NotificationDismissalService',
      });

      // Check if table exists
      const tableReady = await scheduledNotificationRepository.tableExists();
      if (!tableReady) {
        logger.warn('[NotificationDismissal] Table not ready for daily check-in dismissal', {
          date,
          component: 'NotificationDismissalService',
        });
        return false;
      }

      // Find the daily check-in mapping for this date
      const mapping = await scheduledNotificationRepository.getDailyCheckinMapping(date);
      if (!mapping) {
        logger.info('[NotificationDismissal] No daily check-in mapping found for date', {
          date,
          component: 'NotificationDismissalService',
        });
        return false;
      }

      // Dismiss presented notification
      const presentedNotifications = await Notifications.getPresentedNotificationsAsync();
      for (const notification of presentedNotifications) {
        const data = notification.request.content.data as { type?: string; date?: string };
        if (data.type === 'daily_checkin' && (!data.date || data.date === date)) {
          await Notifications.dismissNotificationAsync(notification.request.identifier);
          logger.info('[NotificationDismissal] Dismissed presented daily check-in notification', {
            notificationId: notification.request.identifier,
            date,
            component: 'NotificationDismissalService',
          });
        }
      }

      // Cancel scheduled notification
      await Notifications.cancelScheduledNotificationAsync(mapping.notificationId);
      await scheduledNotificationRepository.deleteMapping(mapping.id);

      logger.info('[NotificationDismissal] Successfully dismissed daily check-in', {
        date,
        mappingId: mapping.id,
        notificationId: mapping.notificationId,
        component: 'NotificationDismissalService',
      });

      return true;
    } catch (error) {
      logger.error('[NotificationDismissal] Error dismissing daily check-in', error instanceof Error ? error : new Error(String(error)), {
        date,
        component: 'NotificationDismissalService',
      });
      return false;
    }
  }

  /**
   * Get diagnostic information about a notification
   *
   * Provides detailed information about a notification for debugging and analysis.
   * Useful for understanding why a notification was or wasn't dismissed.
   */
  async getDiagnosticInfo(
    notificationId: string,
    targetMedicationId?: string,
    targetScheduleId?: string
  ): Promise<{
    mappings: Array<Record<string, unknown>>;
    presentedNotification: Record<string, unknown> | null;
    strategies: {
      database: DismissalResult;
    };
  }> {
    try {
      // Get database mappings
      const mappings = await scheduledNotificationRepository.getMappingsByNotificationId(notificationId);

      // Get presented notification
      const presentedNotifications = await Notifications.getPresentedNotificationsAsync();
      const presentedNotification = presentedNotifications.find(
        n => n.request.identifier === notificationId
      );

      // Run diagnostic check for database strategy
      let databaseResult: DismissalResult;
      if (targetMedicationId && targetScheduleId) {
        databaseResult = await this.checkDatabaseIdLookup(
          notificationId,
          targetMedicationId,
          targetScheduleId
        );
      } else {
        databaseResult = {
          shouldDismiss: false,
          strategy: 'database_id_lookup',
          confidence: 0,
          context: 'Missing target medication or schedule ID',
        };
      }

      return {
        mappings: mappings.map(m => ({ ...m }) as Record<string, unknown>),
        presentedNotification: presentedNotification ? ({ ...presentedNotification }) as Record<string, unknown> : null,
        strategies: {
          database: databaseResult,
        },
      };
    } catch (error) {
      logger.error('[NotificationDismissal] Error getting diagnostic info', error instanceof Error ? error : new Error(String(error)), {
        notificationId,
        targetMedicationId,
        targetScheduleId,
        component: 'NotificationDismissalService',
      });

      return {
        mappings: [],
        presentedNotification: null,
        strategies: {
          database: {
            shouldDismiss: false,
            strategy: 'database_id_lookup' as const,
            confidence: 0,
            context: 'Error during diagnostic',
          },
        },
      };
    }
  }
}

// Export singleton instance
export const notificationDismissalService = new NotificationDismissalService();