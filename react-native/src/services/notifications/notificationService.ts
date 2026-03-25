import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';
// ARCHITECTURAL EXCEPTION: Notification handlers need direct repository access
// because they run in background when app may be suspended. See docs/store-repository-guidelines.md
import { medicationRepository, medicationDoseRepository, medicationScheduleRepository } from '../../database/medicationRepository';
import { handleDailyCheckinNotification } from './dailyCheckinNotifications';
import { notifyUserOfError } from './errorNotificationHelper';
import {
  areNotificationsGloballyEnabled as areNotificationsGloballyEnabledUtil,
  setNotificationsGloballyEnabled as setNotificationsGloballyEnabledUtil,
} from './notificationUtils';
import {
  requestPermissions,
  getPermissions,
  NotificationPermissions,
} from './permissionManager';
import {
  cancelAllNotifications,
  getAllScheduledNotifications,
  cancelNotification,
} from './notificationScheduler';

// Import notification categories from shared file
import { MEDICATION_REMINDER_CATEGORY, MULTIPLE_MEDICATION_REMINDER_CATEGORY } from './notificationCategories';

// Lazy import to avoid circular dependency with medicationStore
// medicationNotifications imports medicationStore, which imports notificationService
let medicationNotificationsModule: typeof import('./medicationNotifications') | null = null;
const getMedicationNotifications = async () => {
  if (!medicationNotificationsModule) {
    medicationNotificationsModule = await import('./medicationNotifications');
  }
  return medicationNotificationsModule;
};

// Re-export types and functions for backwards compatibility
export type { NotificationPermissions };

// Re-export constants for backwards compatibility
export { MEDICATION_REMINDER_CATEGORY, MULTIPLE_MEDICATION_REMINDER_CATEGORY };

/**
 * Handle incoming notifications and decide whether to show them
 * Exported for testing purposes
 */
export async function handleIncomingNotification(notification: Notifications.Notification): Promise<Notifications.NotificationBehavior> {
  try {
    logger.info('[Notification] handleIncomingNotification called', {
      notificationId: notification.request.identifier,
      title: notification.request.content.title,
      body: notification.request.content.body,
      component: 'NotificationHandler',
    });

    // DEBUG: Log the entire notification content structure to understand the issue
    logger.debug('[Notification] Full notification content structure:', {
      notificationId: notification.request.identifier,
      content: {
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: notification.request.content.data,
        sound: notification.request.content.sound,
        badge: notification.request.content.badge,
        categoryIdentifier: notification.request.content.categoryIdentifier,
      },
      trigger: notification.request.trigger,
      component: 'NotificationDebug',
    });

    // Check if this is a daily check-in notification
    const dailyCheckinResult = await handleDailyCheckinNotification(notification);
    if (dailyCheckinResult !== null) {
      logger.info('[Notification] Daily check-in notification handled', {
        notificationId: notification.request.identifier,
        shouldShow: dailyCheckinResult.shouldShowBanner,
        component: 'NotificationHandler',
      });
      return dailyCheckinResult;
    }

    // Check if this is a medication reminder
    // DEBUG: Log raw data extraction paths
    logger.debug('[Notification] Raw notification data extraction:', {
      notificationId: notification.request.identifier,
      'content.data': notification.request.content.data,
      'content.userInfo': (notification.request.content as { userInfo?: unknown }).userInfo,
      'content keys': Object.keys(notification.request.content),
      'entire content': JSON.stringify(notification.request.content),
      component: 'NotificationDataDebug',
    });
    
    const data = notification.request.content.data as {
      medicationId?: string;
      medicationIds?: string[];
      scheduleId?: string;
      scheduleIds?: string[];
      time?: string;
      isFollowUp?: boolean;
    };

    logger.info('[Notification] Processing medication reminder notification', {
      notificationId: notification.request.identifier,
      medicationId: data.medicationId,
      medicationIds: data.medicationIds,
      scheduleId: data.scheduleId,
      scheduleIds: data.scheduleIds,
      time: data.time,
      isFollowUp: data.isFollowUp,
      notificationType: data.isFollowUp ? 'follow-up reminder' : 'initial notification',
      component: 'NotificationHandler',
    });

    // For single medication reminders, check if already logged
    if (data.medicationId && data.scheduleId) {
      try {
        // Get the medication to find the schedule time and timezone
        const medication = await medicationRepository.getById(data.medicationId);
        
        // Clear error messaging when medication data is missing/corrupt
        if (!medication) {
          // Log error with diagnostic info - logger handles Sentry integration
          const missingMedicationError = new Error(`Notification fired but medication data is missing: ${data.medicationId}`);
          
          logger.error(missingMedicationError, {
            component: 'NotificationService',
            operation: 'handleIncomingNotification',
            errorType: 'missing_medication',
            medicationId: data.medicationId,
            scheduleId: data.scheduleId,
            notificationTitle: notification.request.content.title,
            notificationBody: notification.request.content.body,
          });
          
          // Show user-friendly message
          await notifyUserOfError(
            'data',
            "There's a problem with your medication reminder. Please check your medications.",
            missingMedicationError,
            { medicationId: data.medicationId, scheduleId: data.scheduleId }
          );
          
          // Still show notification (fail-safe behavior)
          return {
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          };
        }
        
        // Load schedules from repository since medication.schedule is not populated by getById
        const schedules = await medicationScheduleRepository.getByMedicationId(data.medicationId);
        const schedule = schedules.find(s => s.id === data.scheduleId);

        // Data inconsistency alert - schedule doesn't match
        if (!schedule) {
          const inconsistencyError = new Error(`Notification schedule doesn't match medication: scheduleId=${data.scheduleId}, medicationId=${data.medicationId}`);

          logger.error(inconsistencyError, {
            component: 'NotificationService',
            operation: 'handleIncomingNotification',
            errorType: 'data_inconsistency',
            medicationId: data.medicationId,
            scheduleId: data.scheduleId,
            medicationName: medication.name,
            availableScheduleIds: schedules.map(s => s.id),
          });

          // Notify user of inconsistency
          await notifyUserOfError(
            'data',
            "Your medication schedule has changed. Please open the app and go to Settings > Developer Tools > 'Recreate All Schedules' to fix this issue.",
            inconsistencyError,
            { medicationId: data.medicationId, scheduleId: data.scheduleId }
          );

          // Still show notification (fail-safe - take safest action)
          return {
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          };
        }

        if (schedule) {
          const wasLogged = await medicationDoseRepository.wasLoggedForScheduleToday(
            data.medicationId,
            data.scheduleId,
            schedule.time,
            schedule.timezone
          );

          if (wasLogged) {
            logger.info('[Notification] Medication already logged for schedule, SUPPRESSING notification', {
              notificationId: notification.request.identifier,
              medicationId: data.medicationId,
              scheduleId: data.scheduleId,
              scheduleTime: schedule.time,
              scheduleTimezone: schedule.timezone,
              isFollowUp: data.isFollowUp,
              notificationType: data.isFollowUp ? 'follow-up reminder' : 'initial notification',
              decision: 'SUPPRESS',
              component: 'NotificationHandler',
            });
            // Don't show the notification
            return {
              shouldPlaySound: false,
              shouldSetBadge: false,
              shouldShowBanner: false,
              shouldShowList: false,
            };
          }
        }
      } catch (error) {
        // No silent failures - log database errors
        // Categorize as 'transient' (database error)
        logger.error(error instanceof Error ? error : new Error(String(error)), {
          component: 'NotificationService',
          operation: 'handleIncomingNotification',
          errorType: 'transient', // Database/network errors are typically transient
          medicationId: data.medicationId,
          scheduleId: data.scheduleId,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        
        // Clear, actionable error message
        await notifyUserOfError(
          'system',
          'A temporary issue occurred checking your medication. Please try again.',
          error instanceof Error ? error : new Error(String(error)),
          { medicationId: data.medicationId, scheduleId: data.scheduleId }
        );
        
        // Fall through to show notification
      }
    }

    // For multiple medication reminders, filter out already-logged medications
    if (data.medicationIds && data.scheduleIds && data.time) {
    try {
      const notLoggedMedications: string[] = [];
      const notLoggedSchedules: string[] = [];
      const notLoggedMedicationNames: string[] = [];

      for (let i = 0; i < data.medicationIds.length; i++) {
        const medicationId = data.medicationIds[i];
        const scheduleId = data.scheduleIds[i];

        try {
          // Get medication and schedule to find timezone
          const medication = await medicationRepository.getById(medicationId);
          
          // Handle missing medication in group
          if (!medication) {
            logger.error(new Error(`Grouped notification: medication not found ${medicationId}`), {
              component: 'NotificationService',
              operation: 'handleIncomingNotification',
              errorType: 'missing_medication',
              notificationType: 'grouped',
              medicationId,
              scheduleId,
              groupTime: data.time,
              totalInGroup: data.medicationIds.length,
            });
            
            // Skip this medication (don't include in notification)
            continue;
          }
          
          // Load schedules from database since medication.schedule is always empty
          const schedules = await medicationScheduleRepository.getByMedicationId(medicationId);
          const schedule = schedules.find(s => s.id === scheduleId);

          // Data inconsistency in grouped notification
          if (!schedule) {
            logger.error(new Error(`Grouped notification: schedule mismatch ${scheduleId}`), {
              component: 'NotificationService',
              operation: 'handleIncomingNotification',
              errorType: 'data_inconsistency',
              notificationType: 'grouped',
              medicationId,
              scheduleId,
              medicationName: medication.name,
              availableScheduleIds: schedules.map(s => s.id),
            });
            
            // Skip this medication
            continue;
          }

          const wasLogged = await medicationDoseRepository.wasLoggedForScheduleToday(
            medicationId,
            scheduleId,
            data.time,
            schedule.timezone
          );

          if (!wasLogged) {
            notLoggedMedications.push(medicationId);
            notLoggedSchedules.push(scheduleId);
            notLoggedMedicationNames.push(medication.name);
          }
        } catch (error) {
          // Log transient errors
          logger.error(error instanceof Error ? error : new Error(String(error)), {
            component: 'NotificationService',
            operation: 'handleIncomingNotification',
            errorType: 'transient',
            notificationType: 'grouped',
            medicationId,
            scheduleId: data.scheduleIds[i],
            errorMessage: error instanceof Error ? error.message : String(error),
          });
          
          // Include medication in notification on error (fail-safe)
          notLoggedMedications.push(medicationId);
          notLoggedSchedules.push(scheduleId);
        }
      }

      // If all medications were logged, don't show notification
      if (notLoggedMedications.length === 0) {
        logger.info('[Notification] All medications in group already logged, SUPPRESSING notification', {
          notificationId: notification.request.identifier,
          totalMedications: data.medicationIds?.length || 0,
          medicationIds: data.medicationIds,
          scheduleIds: data.scheduleIds,
          groupTime: data.time,
          isFollowUp: data.isFollowUp,
          notificationType: data.isFollowUp ? 'follow-up reminder' : 'initial notification',
          decision: 'SUPPRESS',
          component: 'NotificationHandler',
        });
        return {
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: false,
        };
      }

      // Dynamic notification content
      // TODO: Update notification content to show only remaining medications
      // This requires re-scheduling or updating the notification content dynamically
      // For now, log the intent and show original notification
      if (notLoggedMedications.length < data.medicationIds.length) {
        const loggedCount = data.medicationIds.length - notLoggedMedications.length;
        
        logger.log('[Notification] Some medications already logged, showing reminder for remaining:', {
          total: data.medicationIds.length,
          logged: loggedCount,
          remaining: notLoggedMedications.length,
          remainingMeds: notLoggedMedicationNames.join(', '),
        });
        
        // Show which medications remain
        // Ideally we'd update the notification content here to show:
        // "Time to take: [Medication A, Medication B]" (only unlogged ones)
        // This would require updating the notification object which isn't currently possible
        // in the handleNotification callback. Marking as enhancement for future work.
        //
        // For now, the notification will show all medications in the group,
        // but the suppression logic ensures we don't suppress if ANY remain unlogged.
      }
    } catch (error) {
      // No silent failures
      logger.error(error instanceof Error ? error : new Error(String(error)), {
        component: 'NotificationService',
        operation: 'handleIncomingNotification',
        errorType: 'transient',
        notificationType: 'grouped',
        medicationCount: data.medicationIds?.length || 0,
        groupTime: data.time,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      
      // Clear error message
      await notifyUserOfError(
        'system',
        'A temporary issue occurred with your medication reminder. Please check the app.',
        error instanceof Error ? error : new Error(String(error)),
        { medicationCount: data.medicationIds?.length || 0, groupTime: data.time }
      );
      
      // Fall through to show notification
    }
  }

    // Default behavior: show the notification
    logger.info('[Notification] Showing notification (not logged yet or no suppression criteria met)', {
      notificationId: notification.request.identifier,
      medicationId: data.medicationId,
      medicationIds: data.medicationIds,
      scheduleId: data.scheduleId,
      scheduleIds: data.scheduleIds,
      isFollowUp: data.isFollowUp,
      notificationType: data.isFollowUp ? 'follow-up reminder' : 'initial notification',
      decision: 'SHOW',
      component: 'NotificationHandler',
    });
    return {
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  } catch (error) {
    logger.error('[Notification] Error in handleIncomingNotification, showing notification (fail-safe):', error);
    // Fail-safe: show the notification
    return {
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  }
}

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: handleIncomingNotification,
});

class NotificationService {
  private initialized = false;

  /**
   * Initialize the notification service and register categories
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Register notification categories with action buttons
    await this.registerCategories();

    // Set up notification response listeners
    this.setupNotificationHandlers();

    // NOTE: Permission request has been moved to WelcomeScreen onboarding flow
    // This prevents blocking iOS permission dialogs during E2E tests
    // and provides better UX by explaining permissions before requesting them

    // Handle any pending notification response that arrived before app initialized
    // This is critical for notification actions (like "Take All") that are tapped
    // while the app is in the background or not running
    const lastResponse = await Notifications.getLastNotificationResponseAsync();
    if (lastResponse) {
      logger.log('[Notification] Processing pending notification response from before app init:', {
        actionIdentifier: lastResponse.actionIdentifier,
      });
      await this.handleNotificationResponse(lastResponse);
    }

    this.initialized = true;
  }

  /**
   * Register notification categories with action buttons
   */
  private async registerCategories(): Promise<void> {
    // Single medication reminder
    await Notifications.setNotificationCategoryAsync(
      MEDICATION_REMINDER_CATEGORY,
      [
        {
          identifier: 'TAKE_NOW',
          buttonTitle: '✓ Take Now',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'SNOOZE_10',
          buttonTitle: 'Snooze 10min',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'SKIP',
          buttonTitle: 'Skip',
          options: {
            opensAppToForeground: false,
          },
        },
      ]
    );

    // Multiple medications reminder
    await Notifications.setNotificationCategoryAsync(
      MULTIPLE_MEDICATION_REMINDER_CATEGORY,
      [
        {
          identifier: 'TAKE_ALL_NOW',
          buttonTitle: '✓ Take All',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'REMIND_LATER',
          buttonTitle: 'Remind Later',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'VIEW_DETAILS',
          buttonTitle: 'View Details',
          options: {
            opensAppToForeground: true,
          },
        },
        {
          identifier: 'SKIP_ALL',
          buttonTitle: 'Skip All',
          options: {
            opensAppToForeground: false,
          },
        },
      ]
    );
  }

  /**
   * Handle a notification response (shared logic for listener and pending responses)
   *
   * Improved error handling with Sentry logging
   */
  private async handleNotificationResponse(response: Notifications.NotificationResponse): Promise<void> {
    try {
      const { actionIdentifier, notification } = response;
      const data = notification.request.content.data as {
        medicationId?: string;
        medicationIds?: string[];
        scheduleId?: string;
        scheduleIds?: string[];
        time?: string;
      };

      logger.log('[Notification] Response received:', {
        actionIdentifier,
        data,
      });

      const medNotifications = await getMedicationNotifications();
      
      switch (actionIdentifier) {
        case 'TAKE_NOW':
          if (data.medicationId && data.scheduleId) {
            await medNotifications.handleTakeNow(data.medicationId, data.scheduleId);
          }
          break;
        case 'SNOOZE_10':
          if (data.medicationId && data.scheduleId) {
            await medNotifications.handleSnooze(data.medicationId, data.scheduleId, 10);
            // Note: Success/failure already logged by handleSnooze
          }
          break;
        case 'TAKE_ALL_NOW':
          if (data.medicationIds && data.scheduleIds) {
            await medNotifications.handleTakeAllNow(data.medicationIds, data.scheduleIds);
          }
          break;
        case 'REMIND_LATER':
          if (data.medicationIds && data.scheduleIds && data.time) {
            await medNotifications.handleRemindLater(data.medicationIds, data.scheduleIds, data.time, 10);
            // Note: Success/failure already logged by handleRemindLater
          }
          break;
        case 'VIEW_DETAILS':
          // This will be handled by navigation in the app
          logger.log('[Notification] View details tapped, opening app');
          break;
        case 'SKIP':
          if (data.medicationId && data.scheduleId) {
            await medNotifications.handleSkip(data.medicationId, data.scheduleId);
          }
          break;
        case 'SKIP_ALL':
          await medNotifications.handleSkipAll({
            medicationIds: data.medicationIds,
            scheduleIds: data.scheduleIds,
            time: data.time,
          });
          break;
        default:
          logger.log('[Notification] Notification tapped, opening app');
          break;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // No silent failures - log error
      logger.error(error instanceof Error ? error : new Error(errorMessage), {
        component: 'NotificationService',
        operation: 'handleNotificationResponse',
        actionIdentifier: response.actionIdentifier,
        errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      
      // Log to error logger so we can track these failures
      const { errorLogger } = await import('../errorLogger');
      await errorLogger.log(
        'general',
        '[Notification] Unhandled error in notification response listener',
        error instanceof Error ? error : undefined,
        { context: 'notification_response_handling' }
      );
      
      // User-friendly notification
      await notifyUserOfError(
        'system',
        'An error occurred processing your action. Please try again from the app.',
        error instanceof Error ? error : new Error(errorMessage),
        { actionIdentifier: response.actionIdentifier }
      );
    }
  }

  /**
   * Set up handlers for notification interactions
   */
  private setupNotificationHandlers(): void {
    // Handle notification response (tap or action button)
    Notifications.addNotificationResponseReceivedListener(async (response) => {
      await this.handleNotificationResponse(response);
    });

    Notifications.addNotificationReceivedListener((notification) => {
      logger.log('[Notification] Received in foreground:', notification);
    });
  }

  // Public API methods - delegate to specialized modules
  
  async requestPermissions(): Promise<NotificationPermissions> {
    return requestPermissions();
  }

  async getPermissions(): Promise<NotificationPermissions> {
    return getPermissions();
  }

  async cancelNotification(notificationId: string): Promise<void> {
    await cancelNotification(notificationId);
  }

  async cancelMedicationNotifications(medicationId: string): Promise<void> {
    const medNotifications = await getMedicationNotifications();
    return medNotifications.cancelMedicationNotifications(medicationId);
  }

  async cancelScheduledMedicationReminder(medicationId: string, scheduleId?: string): Promise<void> {
    const medNotifications = await getMedicationNotifications();
    return medNotifications.cancelScheduledMedicationReminder(medicationId, scheduleId);
  }

  async getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return getAllScheduledNotifications();
  }

  async areNotificationsGloballyEnabled(): Promise<boolean> {
    return areNotificationsGloballyEnabledUtil();
  }

  async setGlobalNotificationsEnabled(enabled: boolean): Promise<void> {
    try {
      await setNotificationsGloballyEnabledUtil(enabled);

      if (!enabled) {
        // Disable: Cancel all notifications
        await cancelAllNotifications();
        logger.log('[Notification] All notifications cancelled (global toggle disabled)');
      } else {
        // Enable: Reschedule all notifications (medications and daily check-in)
        const medNotifications = await getMedicationNotifications();
        await medNotifications.rescheduleAllNotifications();
        logger.log('[Notification] All notifications rescheduled (global toggle enabled)');
      }
    } catch (error) {
      logger.error('[Notification] Error setting global toggle:', error);
      throw error;
    }
  }

  async cancelAllNotifications(): Promise<void> {
    return cancelAllNotifications();
  }

  async dismissMedicationNotification(medicationId: string, scheduleId: string): Promise<void> {
    const medNotifications = await getMedicationNotifications();
    return medNotifications.dismissMedicationNotification(medicationId, scheduleId);
  }

  async rescheduleAllMedicationNotifications(): Promise<void> {
    const medNotifications = await getMedicationNotifications();
    return medNotifications.rescheduleAllMedicationNotifications();
  }

  async rescheduleAllNotifications(): Promise<void> {
    const medNotifications = await getMedicationNotifications();
    return medNotifications.rescheduleAllNotifications();
  }
}

export const notificationService = new NotificationService();
