import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';
import { medicationRepository, medicationDoseRepository } from '../../database/medicationRepository';
import { scheduledNotificationRepository } from '../../database/scheduledNotificationRepository';
import { MEDICATION_REMINDER_CATEGORY, MULTIPLE_MEDICATION_REMINDER_CATEGORY } from './notificationCategories';

/**
 * Result of a notification dismissal check
 */
export interface DismissalResult {
  /** Whether the notification should be dismissed */
  shouldDismiss: boolean;
  /** Strategy that determined the dismissal decision */
  strategy: 'database_id_lookup' | 'time_based' | 'content_based' | 'category_based' | 'none';
  /** Confidence score for the dismissal decision (0-100) */
  confidence: number;
  /** Additional context about the decision */
  context?: string;
}



/**
 * Configuration for fallback strategies
 */
interface FallbackConfig {
  /** Time window in minutes for time-based matching */
  timeWindowMinutes: number;
  /** Minimum confidence threshold for dismissal */
  minConfidenceThreshold: number;
}

/**
 * NotificationDismissalService - Cross-Reference Dismissal Logic
 *
 * This service implements comprehensive notification dismissal logic using database
 * cross-reference as the primary strategy with multiple fallback approaches.
 *
 * Key Features:
 * - Primary: Database ID lookup for exact matching
 * - Fallback: Time-based matching within 30-minute window
 * - Fallback: Content-based matching using medication names
 * - Fallback: Category-based matching with time correlation
 * - Support for all notification types: single, grouped, daily check-in, follow-up
 * - Safety mechanisms for grouped notifications
 * - Comprehensive logging and confidence scoring
 */
export class NotificationDismissalService {
  private readonly config: FallbackConfig = {
    timeWindowMinutes: 30,
    minConfidenceThreshold: 80,
  };

  /**
   * Determine whether a notification should be dismissed based on cross-reference logic
   *
   * @param notificationId - OS notification identifier
   * @param targetMedicationId - Medication ID that was logged/acted upon
   * @param targetScheduleId - Schedule ID that was logged/acted upon
   * @param loggedTime - Time when the dose was logged
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

      // Strategy 1: Database ID Lookup (Primary)
      const primaryResult = await this.checkDatabaseIdLookup(
        notificationId,
        targetMedicationId,
        targetScheduleId
      );

      if (primaryResult.shouldDismiss) {
        logger.info('[NotificationDismissal] Primary strategy succeeded', {
          notificationId,
          strategy: primaryResult.strategy,
          confidence: primaryResult.confidence,
          component: 'NotificationDismissalService',
        });
        return primaryResult;
      }

      // If primary strategy found a match but decided not to dismiss (e.g., grouped notification safety),
      // return that result instead of trying fallback strategies
      if (primaryResult.strategy === 'database_id_lookup' && primaryResult.confidence === 100) {
        logger.info('[NotificationDismissal] Primary strategy found match but decided not to dismiss', {
          notificationId,
          strategy: primaryResult.strategy,
          confidence: primaryResult.confidence,
          context: primaryResult.context,
          component: 'NotificationDismissalService',
        });
        return primaryResult;
      }

      // Strategy 2: Time-based matching
      const timeBasedResult = await this.checkTimeBasedMatching(
        targetMedicationId,
        targetScheduleId,
        loggedTime
      );

      if (timeBasedResult.shouldDismiss && timeBasedResult.confidence >= this.config.minConfidenceThreshold) {
        logger.info('[NotificationDismissal] Time-based strategy succeeded', {
          notificationId,
          strategy: timeBasedResult.strategy,
          confidence: timeBasedResult.confidence,
          component: 'NotificationDismissalService',
        });
        return timeBasedResult;
      }

      // Strategy 3: Content-based matching
      const contentBasedResult = await this.checkContentBasedMatching(
        notificationId,
        targetMedicationId
      );

      if (contentBasedResult.shouldDismiss && contentBasedResult.confidence >= this.config.minConfidenceThreshold) {
        logger.info('[NotificationDismissal] Content-based strategy succeeded', {
          notificationId,
          strategy: contentBasedResult.strategy,
          confidence: contentBasedResult.confidence,
          component: 'NotificationDismissalService',
        });
        return contentBasedResult;
      }

      // Strategy 4: Category-based matching
      const categoryBasedResult = await this.checkCategoryBasedMatching(
        notificationId,
        targetMedicationId,
        loggedTime
      );

      if (categoryBasedResult.shouldDismiss && categoryBasedResult.confidence >= this.config.minConfidenceThreshold) {
        logger.info('[NotificationDismissal] Category-based strategy succeeded', {
          notificationId,
          strategy: categoryBasedResult.strategy,
          confidence: categoryBasedResult.confidence,
          component: 'NotificationDismissalService',
        });
        return categoryBasedResult;
      }

      // No strategy succeeded
      logger.debug('[NotificationDismissal] No strategy succeeded, not dismissing', {
        notificationId,
        targetMedicationId,
        targetScheduleId,
        strategies: {
          primary: primaryResult.confidence,
          timeBased: timeBasedResult.confidence,
          contentBased: contentBasedResult.confidence,
          categoryBased: categoryBasedResult.confidence,
        },
        component: 'NotificationDismissalService',
      });

      return {
        shouldDismiss: false,
        strategy: 'none',
        confidence: 0,
        context: 'All strategies failed to meet confidence threshold',
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
   * Strategy 1: Database ID Lookup
   *
   * Primary strategy that uses the scheduled notification repository to find
   * exact matches based on notification ID and cross-reference with medication/schedule IDs.
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
      logger.warn('[NotificationDismissal] Database lookup failed', error instanceof Error ? error : new Error(String(error)), {
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
   * Strategy 2: Time-based Matching
   *
   * Fallback strategy that matches notifications within a time window of the logged dose.
   * Uses notification metadata stored in the database for precise time matching.
   */
  private async checkTimeBasedMatching(
    targetMedicationId: string,
    targetScheduleId: string,
    loggedTime: Date
  ): Promise<DismissalResult> {
    try {
      // Find notifications within time window
      const windowMappings = await scheduledNotificationRepository.findByTimeWindow(
        loggedTime,
        this.config.timeWindowMinutes
      );

      logger.debug('[NotificationDismissal] Time-based search found mappings', {
        targetMedicationId,
        targetScheduleId,
        loggedTime: loggedTime.toISOString(),
        windowMinutes: this.config.timeWindowMinutes,
        mappingCount: windowMappings.length,
        component: 'NotificationDismissalService',
      });

      // Look for matches with our target medication/schedule
      for (const mapping of windowMappings) {
        if (mapping.medicationId === targetMedicationId && mapping.scheduleId === targetScheduleId) {
          // Calculate confidence based on time proximity
          const timeDiff = Math.abs(loggedTime.getTime() - (mapping.scheduledTriggerTime?.getTime() || 0));
          const maxDiff = this.config.timeWindowMinutes * 60 * 1000;
          const confidence = Math.max(60, Math.round(100 - (timeDiff / maxDiff) * 40));

          return {
            shouldDismiss: true,
            strategy: 'time_based',
            confidence,
            context: `Matched within ${Math.round(timeDiff / 60000)} minute window`,
          };
        }
      }

      return {
        shouldDismiss: false,
        strategy: 'time_based',
        confidence: 30,
        context: 'No time-based match found within window',
      };
    } catch (error) {
      logger.warn('[NotificationDismissal] Time-based matching failed', error instanceof Error ? error : new Error(String(error)), {
        targetMedicationId,
        targetScheduleId,
        component: 'NotificationDismissalService',
      });

      return {
        shouldDismiss: false,
        strategy: 'time_based',
        confidence: 0,
        context: 'Time-based matching error',
      };
    }
  }

  /**
   * Strategy 3: Content-based Matching
   *
   * Fallback strategy that matches notifications based on medication name in notification content.
   * Uses both database metadata and live notification inspection.
   */
  private async checkContentBasedMatching(
    notificationId: string,
    targetMedicationId: string
  ): Promise<DismissalResult> {
    try {
      // Get medication name for comparison
      const medication = await medicationRepository.getById(targetMedicationId);
      if (!medication) {
        return {
          shouldDismiss: false,
          strategy: 'content_based',
          confidence: 0,
          context: 'Medication not found',
        };
      }

      // First try: Check database metadata
      const today = new Date();
      const dateRange: [Date, Date] = [
        new Date(today.getTime() - 24 * 60 * 60 * 1000), // Yesterday
        new Date(today.getTime() + 24 * 60 * 60 * 1000), // Tomorrow
      ];

      const nameMatches = await scheduledNotificationRepository.findByMedicationName(
        medication.name,
        dateRange
      );

      logger.debug('[NotificationDismissal] Content-based search results', {
        medicationName: medication.name,
        targetMedicationId,
        nameMatches: nameMatches.length,
        component: 'NotificationDismissalService',
      });

      // Check if any matches correspond to our notification ID
      for (const mapping of nameMatches) {
        if (mapping.notificationId === notificationId) {
          return {
            shouldDismiss: true,
            strategy: 'content_based',
            confidence: 85,
            context: `Medication name matched: ${medication.name}`,
          };
        }
      }

      // Second try: Check live notification content
      const presentedNotifications = await Notifications.getPresentedNotificationsAsync();
      for (const notification of presentedNotifications) {
        if (notification.request.identifier === notificationId) {
          const { title, body } = notification.request.content;
          const titleLower = title?.toLowerCase() || '';
          const bodyLower = body?.toLowerCase() || '';
          const medNameLower = medication.name.toLowerCase();

          if (titleLower.includes(medNameLower) || bodyLower.includes(medNameLower)) {
            return {
              shouldDismiss: true,
              strategy: 'content_based',
              confidence: 75,
              context: `Medication name found in notification content: ${medication.name}`,
            };
          }
        }
      }

      return {
        shouldDismiss: false,
        strategy: 'content_based',
        confidence: 20,
        context: 'No content-based match found',
      };
    } catch (error) {
      logger.warn('[NotificationDismissal] Content-based matching failed', error instanceof Error ? error : new Error(String(error)), {
        notificationId,
        targetMedicationId,
        component: 'NotificationDismissalService',
      });

      return {
        shouldDismiss: false,
        strategy: 'content_based',
        confidence: 0,
        context: 'Content-based matching error',
      };
    }
  }

  /**
   * Strategy 4: Category-based Matching
   *
   * Fallback strategy that matches notifications based on category and time correlation.
   * Uses notification category identifiers with time window validation.
   */
  private async checkCategoryBasedMatching(
    notificationId: string,
    targetMedicationId: string,
    loggedTime: Date
  ): Promise<DismissalResult> {
    try {
      // Get the notification to check its category
      const presentedNotifications = await Notifications.getPresentedNotificationsAsync();
      let targetNotification = null;

      for (const notification of presentedNotifications) {
        if (notification.request.identifier === notificationId) {
          targetNotification = notification;
          break;
        }
      }

      if (!targetNotification) {
        return {
          shouldDismiss: false,
          strategy: 'category_based',
          confidence: 0,
          context: 'Notification not found in presented list',
        };
      }

      const category = targetNotification.request.content.categoryIdentifier;
      if (!category || ![MEDICATION_REMINDER_CATEGORY, MULTIPLE_MEDICATION_REMINDER_CATEGORY].includes(category)) {
        return {
          shouldDismiss: false,
          strategy: 'category_based',
          confidence: 0,
          context: 'Not a medication reminder category',
        };
      }

      // Find notifications by category within time window
      const timeWindow: [Date, Date] = [
        new Date(loggedTime.getTime() - this.config.timeWindowMinutes * 60 * 1000),
        new Date(loggedTime.getTime() + this.config.timeWindowMinutes * 60 * 1000),
      ];

      const categoryMatches = await scheduledNotificationRepository.findByCategoryAndTime(
        category,
        timeWindow
      );

      logger.debug('[NotificationDismissal] Category-based search results', {
        category,
        timeWindow: timeWindow.map(t => t.toISOString()),
        matches: categoryMatches.length,
        targetMedicationId,
        component: 'NotificationDismissalService',
      });

      // Check for medication match within category results
      for (const mapping of categoryMatches) {
        if (mapping.medicationId === targetMedicationId && mapping.notificationId === notificationId) {
          const confidence = category === MEDICATION_REMINDER_CATEGORY ? 70 : 60; // Single med higher confidence
          return {
            shouldDismiss: true,
            strategy: 'category_based',
            confidence,
            context: `Category and time match: ${category}`,
          };
        }
      }

      return {
        shouldDismiss: false,
        strategy: 'category_based',
        confidence: 25,
        context: 'No category-based match found',
      };
    } catch (error) {
      logger.warn('[NotificationDismissal] Category-based matching failed', error instanceof Error ? error : new Error(String(error)), {
        notificationId,
        targetMedicationId,
        component: 'NotificationDismissalService',
      });

      return {
        shouldDismiss: false,
        strategy: 'category_based',
        confidence: 0,
        context: 'Category-based matching error',
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
      timeBased?: DismissalResult;
      contentBased?: DismissalResult;
      categoryBased?: DismissalResult;
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

      // Run diagnostic checks
      const strategies: {
        database: DismissalResult;
        timeBased?: DismissalResult;
        contentBased?: DismissalResult;
        categoryBased?: DismissalResult;
      } = {
        database: {
          shouldDismiss: false,
          strategy: 'database_id_lookup',
          confidence: 0,
          context: 'Not initialized',
        },
      };

      // Database strategy
      if (targetMedicationId && targetScheduleId) {
        strategies.database = await this.checkDatabaseIdLookup(
          notificationId,
          targetMedicationId,
          targetScheduleId
        );

        strategies.timeBased = await this.checkTimeBasedMatching(
          targetMedicationId,
          targetScheduleId,
          new Date()
        );

        strategies.contentBased = await this.checkContentBasedMatching(
          notificationId,
          targetMedicationId
        );

        strategies.categoryBased = await this.checkCategoryBasedMatching(
          notificationId,
          targetMedicationId,
          new Date()
        );
      } else {
        strategies.database = {
          shouldDismiss: false,
          strategy: 'database_id_lookup',
          confidence: 0,
          context: 'Missing target medication or schedule ID',
        };
      }

      return {
        mappings: mappings.map(m => ({ ...m }) as Record<string, unknown>),
        presentedNotification: presentedNotification ? ({ ...presentedNotification }) as Record<string, unknown> : null,
        strategies,
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