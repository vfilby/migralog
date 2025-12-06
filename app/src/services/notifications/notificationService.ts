import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';
import { Medication, MedicationSchedule } from '../../models/types';
import { medicationRepository, medicationDoseRepository } from '../../database/medicationRepository';
import { useNotificationSettingsStore } from '../../store/notificationSettingsStore';
import { handleDailyCheckinNotification } from './dailyCheckinNotifications';
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
import {
  MEDICATION_REMINDER_CATEGORY,
  MULTIPLE_MEDICATION_REMINDER_CATEGORY,
  handleTakeNow,
  handleSnooze,
  handleTakeAllNow,
  handleRemindLater,
  scheduleSingleNotification,
  scheduleMultipleNotification,
  cancelMedicationNotifications,
  cancelScheduledMedicationReminder,
  dismissMedicationNotification,
  rescheduleAllMedicationNotifications,
  rescheduleAllNotifications,
} from './medicationNotifications';

// Re-export types and functions for backwards compatibility
export type { NotificationPermissions };

/**
 * Handle incoming notifications and decide whether to show them
 * Exported for testing purposes
 */
export async function handleIncomingNotification(notification: Notifications.Notification): Promise<Notifications.NotificationBehavior> {
  try {
    // Check if this is a daily check-in notification
    const dailyCheckinResult = await handleDailyCheckinNotification(notification);
    if (dailyCheckinResult !== null) {
      return dailyCheckinResult;
    }

    // Check if this is a medication reminder
    const data = notification.request.content.data as {
      medicationId?: string;
      medicationIds?: string[];
      scheduleId?: string;
      scheduleIds?: string[];
      time?: string;
    };

    // For single medication reminders, check if already logged
    if (data.medicationId && data.scheduleId) {
      try {
        // Get the medication to find the schedule time and timezone
        const medication = await medicationRepository.getById(data.medicationId);
        if (medication) {
          const schedule = medication.schedule?.find(s => s.id === data.scheduleId);
          if (schedule) {
            const wasLogged = await medicationDoseRepository.wasLoggedForScheduleToday(
              data.medicationId,
              data.scheduleId,
              schedule.time,
              schedule.timezone
            );

            if (wasLogged) {
              logger.log('[Notification] Medication already logged for schedule, suppressing notification:', {
                medicationId: data.medicationId,
                scheduleId: data.scheduleId,
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
        }
      } catch (error) {
        logger.error('[Notification] Error checking if medication logged, showing notification (fail-safe):', error);
        // Fall through to show notification
      }
    }

    // For multiple medication reminders, filter out already-logged medications
    if (data.medicationIds && data.scheduleIds && data.time) {
    try {
      const notLoggedMedications: string[] = [];
      const notLoggedSchedules: string[] = [];

      for (let i = 0; i < data.medicationIds.length; i++) {
        const medicationId = data.medicationIds[i];
        const scheduleId = data.scheduleIds[i];

        try {
          // Get medication and schedule to find timezone
          const medication = await medicationRepository.getById(medicationId);
          const schedule = medication?.schedule?.find(s => s.id === scheduleId);

          if (!schedule) {
            // If schedule not found, skip this medication
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
          }
        } catch (error) {
          logger.error('[Notification] Error checking medication in group, including it (fail-safe):', {
            medicationId,
            error,
          });
          // Include medication in notification on error (fail-safe)
          notLoggedMedications.push(medicationId);
          notLoggedSchedules.push(scheduleId);
        }
      }

      // If all medications were logged, don't show notification
      if (notLoggedMedications.length === 0) {
        logger.log('[Notification] All medications already logged, suppressing notification');
        return {
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: false,
        };
      }

      // If some were logged, we still show the notification but ideally would update the content
      // For now, we show the notification as-is (future enhancement: update content to show only unlogged meds)
      if (notLoggedMedications.length < data.medicationIds.length) {
        logger.log('[Notification] Some medications already logged, showing reminder for remaining:', {
          total: data.medicationIds.length,
          remaining: notLoggedMedications.length,
        });
      }
    } catch (error) {
      logger.error('[Notification] Error checking grouped medications, showing notification (fail-safe):', error);
      // Fall through to show notification
    }
  }

    // Default behavior: show the notification
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
  // Map to track follow-up notification IDs: key = "medicationId:scheduleId" or "multi:time"
  private followUpNotifications = new Map<string, string>();

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
      ]
    );
  }

  /**
   * Handle a notification response (shared logic for listener and pending responses)
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

      switch (actionIdentifier) {
        case 'TAKE_NOW':
          if (data.medicationId && data.scheduleId) {
            await handleTakeNow(data.medicationId, data.scheduleId);
            await this.cancelFollowUpReminder(`${data.medicationId}:${data.scheduleId}`);
          }
          break;
        case 'SNOOZE_10':
          if (data.medicationId && data.scheduleId) {
            // Cancel follow-up reminder since user snoozed
            await this.cancelFollowUpReminder(`${data.medicationId}:${data.scheduleId}`);
            await handleSnooze(data.medicationId, data.scheduleId, 10);
          }
          break;
        case 'TAKE_ALL_NOW':
          if (data.medicationIds && data.scheduleIds) {
            await handleTakeAllNow(data.medicationIds, data.scheduleIds);
            if (data.time) {
              await this.cancelFollowUpReminder(`multi:${data.time}`);
            }
          }
          break;
        case 'REMIND_LATER':
          if (data.medicationIds && data.scheduleIds && data.time) {
            // Cancel follow-up reminder since user chose to snooze
            await this.cancelFollowUpReminder(`multi:${data.time}`);
            await handleRemindLater(data.medicationIds, data.scheduleIds, data.time, 10);
          }
          break;
        case 'VIEW_DETAILS':
          // This will be handled by navigation in the app
          logger.log('[Notification] View details tapped, opening app');
          break;
        default:
          // User tapped notification - cancel follow-up reminder
          if (data.medicationId && data.scheduleId) {
            await this.cancelFollowUpReminder(`${data.medicationId}:${data.scheduleId}`);
          } else if (data.medicationIds && data.time) {
            await this.cancelFollowUpReminder(`multi:${data.time}`);
          }
          logger.log('[Notification] Notification tapped, opening app');
          break;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[Notification] Error handling notification response:', {
        error: errorMessage,
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

    // Handle notifications received while app is in foreground
    Notifications.addNotificationReceivedListener(async (notification) => {
      logger.log('[Notification] Received in foreground:', notification);

      // Schedule follow-up reminder if this is not already a follow-up
      const data = notification.request.content.data as {
        medicationId?: string;
        medicationIds?: string[];
        scheduleId?: string;
        scheduleIds?: string[];
        time?: string;
        isFollowUp?: boolean;
      };

      // Don't schedule follow-up for follow-up notifications
      if (data.isFollowUp) {
        return;
      }

      // Schedule follow-up for single medication
      if (data.medicationId && data.scheduleId) {
        const medication = await medicationRepository.getById(data.medicationId);
        if (medication) {
          await this.scheduleFollowUpReminder(
            data.medicationId,
            data.scheduleId,
            medication.name
          );
        }
      }

      // Schedule follow-up for multiple medications
      if (data.medicationIds && data.scheduleIds && data.time) {
        const medications = await Promise.all(
          data.medicationIds.map(id => medicationRepository.getById(id))
        );
        const validMedications = medications.filter(m => m !== null) as Medication[];
        if (validMedications.length > 0) {
          const medicationNames = validMedications.map(m => m.name).join(', ');
          await this.scheduleFollowUpReminder(
            data.medicationIds,
            data.scheduleIds,
            medicationNames,
            data.time
          );
        }
      }
    });
  }

  /**
   * Schedule a follow-up reminder after the initial notification (immediate, not recurring)
   * This is used when a notification is received while the app is in the foreground
   * 
   * Note: Critical alerts require special entitlement from Apple
   * Request at: https://developer.apple.com/contact/request/notifications-critical-alerts-entitlement/
   * 
   * @deprecated This method is only used for foreground notifications. Scheduled notifications
   * should use scheduleFollowUpForScheduledNotification instead.
   */
  private async scheduleFollowUpReminder(
    medicationId: string | string[],
    scheduleId: string | string[],
    medicationName: string,
    time?: string
  ): Promise<void> {
    try {
      const isSingle = typeof medicationId === 'string';
      
      // Get settings to determine delay and critical alert preference
      const settingsStore = useNotificationSettingsStore.getState();
      let delayMinutes: number;
      let useCriticalAlerts: boolean;

      if (isSingle) {
        const settings = settingsStore.getEffectiveSettings(medicationId as string);
        if (settings.followUpDelay === 'off') {
          logger.log('[Notification] Follow-up disabled for medication, skipping');
          return;
        }
        delayMinutes = settings.followUpDelay;
        useCriticalAlerts = settings.criticalAlertsEnabled;
      } else {
        // For multiple medications, use maximum delay and enable critical if any has it
        const medicationIds = medicationId as string[];
        const delays = medicationIds.map(id => {
          const settings = settingsStore.getEffectiveSettings(id);
          return settings.followUpDelay;
        }).filter(d => d !== 'off') as number[];

        if (delays.length === 0) {
          logger.log('[Notification] Follow-up disabled for all medications, skipping');
          return;
        }

        delayMinutes = Math.max(...delays);
        useCriticalAlerts = medicationIds.some(id => {
          const settings = settingsStore.getEffectiveSettings(id);
          return settings.criticalAlertsEnabled;
        });
      }

      // Schedule follow-up notification
      const followUpTime = new Date(Date.now() + delayMinutes * 60 * 1000);

      const key = isSingle
        ? `${medicationId}:${scheduleId}`
        : `multi:${time}`;

      const title = isSingle
        ? `Reminder: ${medicationName}`
        : `Reminder: ${medicationName} (${Array.isArray(medicationId) ? medicationId.length : 1} medications)`;

      logger.log('[Notification] Scheduling immediate follow-up for', medicationName, {
        delayMinutes,
        useCriticalAlerts,
        at: followUpTime.toLocaleTimeString(),
      });

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: 'Did you take your medication?',
          data: isSingle
            ? { medicationId, scheduleId, isFollowUp: true }
            : { medicationIds: medicationId, scheduleIds: scheduleId, time, isFollowUp: true },
          categoryIdentifier: isSingle
            ? MEDICATION_REMINDER_CATEGORY
            : MULTIPLE_MEDICATION_REMINDER_CATEGORY,
          sound: true,
          // Critical alert properties (only if enabled and entitlement is granted)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(useCriticalAlerts && { critical: true } as any),
          // Time-sensitive notification settings
          ...(Notifications.AndroidNotificationPriority && {
            priority: useCriticalAlerts 
              ? Notifications.AndroidNotificationPriority.MAX
              : Notifications.AndroidNotificationPriority.HIGH,
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(useCriticalAlerts && { interruptionLevel: 'critical' } as any),
        },
        // Date trigger type is not exported by expo-notifications
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        trigger: followUpTime as any,
      });

      // Store the follow-up notification ID for later cancellation
      this.followUpNotifications.set(key, notificationId);

      logger.log('[Notification] Scheduled immediate follow-up reminder for', medicationName, 'at', followUpTime.toLocaleTimeString());
    } catch (error) {
      logger.error('[Notification] Error scheduling immediate follow-up reminder:', error);
    }
  }

  /**
   * Cancel a follow-up reminder if it exists
   */
  private async cancelFollowUpReminder(key: string): Promise<void> {
    const followUpId = this.followUpNotifications.get(key);
    if (followUpId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(followUpId);
        this.followUpNotifications.delete(key);
        logger.log('[Notification] Cancelled follow-up reminder:', key);
      } catch (error) {
        logger.error('[Notification] Error cancelling follow-up reminder:', error);
      }
    }
  }

  // Public API methods - delegate to specialized modules
  
  async requestPermissions(): Promise<NotificationPermissions> {
    return requestPermissions();
  }

  async getPermissions(): Promise<NotificationPermissions> {
    return getPermissions();
  }

  async scheduleGroupedNotifications(
    medications: Array<{ medication: Medication; schedule: MedicationSchedule }>
  ): Promise<Map<string, string>> {
    const notificationIds = new Map<string, string>();

    try {
      // Check if notifications are globally enabled
      const globallyEnabled = await this.areNotificationsGloballyEnabled();
      if (!globallyEnabled) {
        logger.log('[Notification] Notifications globally disabled, skipping scheduling');
        return notificationIds;
      }

      // Group by time
      const grouped = new Map<string, Array<{ medication: Medication; schedule: MedicationSchedule }>>();

      for (const item of medications) {
        if (!item.schedule.enabled) {
          logger.log('[Notification] Schedule disabled, skipping:', item.schedule.id);
          continue;
        }

        const time = item.schedule.time;
        if (!grouped.has(time)) {
          grouped.set(time, []);
        }
        grouped.get(time)!.push(item);
      }

      // Schedule notifications for each time group
      for (const [time, items] of grouped.entries()) {
        if (items.length === 1) {
          // Single medication - use single notification
          const { medication, schedule } = items[0];
          const notificationId = await scheduleSingleNotification(medication, schedule);
          if (notificationId) {
            notificationIds.set(schedule.id, notificationId);
          }
        } else {
          // Multiple medications - use grouped notification
          const notificationId = await scheduleMultipleNotification(items, time);
          if (notificationId) {
            // Store the same notification ID for all schedules in this group
            for (const { schedule } of items) {
              notificationIds.set(schedule.id, notificationId);
            }
          }
        }
      }

      return notificationIds;
    } catch (error) {
      logger.error('[Notification] Error scheduling grouped notifications:', error);
      return notificationIds;
    }
  }

  /**
   * Schedule a notification for a medication schedule (legacy method, now uses grouped scheduling)
   * @deprecated Use scheduleGroupedNotifications instead for better grouping support
   */
  async scheduleNotification(
    medication: Medication,
    schedule: MedicationSchedule
  ): Promise<string | null> {
    if (!schedule.enabled) {
      logger.log('[Notification] Schedule disabled, skipping:', schedule.id);
      return null;
    }
    return scheduleSingleNotification(medication, schedule);
  }

  async cancelNotification(notificationId: string): Promise<void> {
    return cancelNotification(notificationId);
  }

  async cancelMedicationNotifications(medicationId: string): Promise<void> {
    return cancelMedicationNotifications(medicationId);
  }

  async cancelScheduledMedicationReminder(medicationId: string, scheduleId?: string): Promise<void> {
    return cancelScheduledMedicationReminder(medicationId, scheduleId);
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
        await rescheduleAllNotifications();
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
    return dismissMedicationNotification(medicationId, scheduleId);
  }

  async rescheduleAllMedicationNotifications(): Promise<void> {
    return rescheduleAllMedicationNotifications();
  }

  async rescheduleAllNotifications(): Promise<void> {
    return rescheduleAllNotifications();
  }
}

export const notificationService = new NotificationService();
