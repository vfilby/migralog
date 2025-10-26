import * as Notifications from 'expo-notifications';
import { logger } from '../utils/logger';
import { Medication, MedicationSchedule } from '../models/types';
import { medicationRepository, medicationDoseRepository, medicationScheduleRepository } from '../database/medicationRepository';
import { useNotificationSettingsStore } from '../store/notificationSettingsStore';

/**
 * Handle incoming notifications and decide whether to show them
 * Exported for testing purposes
 */
export async function handleIncomingNotification(notification: Notifications.Notification): Promise<Notifications.NotificationBehavior> {
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
    // Get the medication to find the schedule time
    const medication = await medicationRepository.getById(data.medicationId);
    if (medication) {
      const schedule = medication.schedule?.find(s => s.id === data.scheduleId);
      if (schedule) {
        const wasLogged = await medicationDoseRepository.wasLoggedForScheduleToday(
          data.medicationId,
          data.scheduleId,
          schedule.time
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
  }

  // For multiple medication reminders, filter out already-logged medications
  if (data.medicationIds && data.scheduleIds && data.time) {
    const notLoggedMedications: string[] = [];
    const notLoggedSchedules: string[] = [];

    for (let i = 0; i < data.medicationIds.length; i++) {
      const medicationId = data.medicationIds[i];
      const scheduleId = data.scheduleIds[i];

      const wasLogged = await medicationDoseRepository.wasLoggedForScheduleToday(
        medicationId,
        scheduleId,
        data.time
      );

      if (!wasLogged) {
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
  }

  // Default behavior: show the notification
  return {
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  };
}

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: handleIncomingNotification,
});

// Notification categories for action buttons
const MEDICATION_REMINDER_CATEGORY = 'MEDICATION_REMINDER';
const MULTIPLE_MEDICATION_REMINDER_CATEGORY = 'MULTIPLE_MEDICATION_REMINDER';

export interface NotificationPermissions {
  granted: boolean;
  canAskAgain: boolean;
  ios?: {
    allowsAlert: boolean;
    allowsSound: boolean;
    allowsBadge: boolean;
    allowsCriticalAlerts: boolean;
  };
}

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
   * Set up handlers for notification interactions
   */
  private setupNotificationHandlers(): void {
    // Handle notification response (tap or action button)
    Notifications.addNotificationResponseReceivedListener(async (response) => {
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
            await this.handleTakeNow(data.medicationId, data.scheduleId);
          }
          break;
        case 'SNOOZE_10':
          if (data.medicationId && data.scheduleId) {
            // Cancel follow-up reminder since user snoozed
            await this.cancelFollowUpReminder(`${data.medicationId}:${data.scheduleId}`);
            await this.handleSnooze(data.medicationId, data.scheduleId, 10);
          }
          break;
        case 'TAKE_ALL_NOW':
          if (data.medicationIds && data.scheduleIds) {
            await this.handleTakeAllNow(data.medicationIds, data.scheduleIds, data.time);
          }
          break;
        case 'REMIND_LATER':
          if (data.medicationIds && data.scheduleIds && data.time) {
            // Cancel follow-up reminder since user chose to snooze
            await this.cancelFollowUpReminder(`multi:${data.time}`);
            await this.handleRemindLater(data.medicationIds, data.scheduleIds, data.time, 10);
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
   * Handle "Take Now" action - log medication immediately
   */
  private async handleTakeNow(medicationId: string, scheduleId: string): Promise<void> {
    try {
      const medication = await medicationRepository.getById(medicationId);
      if (!medication) {
        logger.error('[Notification] Medication not found:', medicationId);
        return;
      }

      // Cancel follow-up reminder since user took action
      await this.cancelFollowUpReminder(`${medicationId}:${scheduleId}`);

      // Find the schedule to get the dosage
      const schedule = medication.schedule?.find(s => s.id === scheduleId);
      const dosage = schedule?.dosage ?? medication.defaultQuantity ?? 1;

      // Use store's logDose to update both database and state
      // Dynamic import to avoid circular dependency
      const { useMedicationStore } = await import('../store/medicationStore');
      const timestamp = Date.now();
      await useMedicationStore.getState().logDose({
        medicationId,
        timestamp,
        quantity: dosage,
        dosageAmount: medication.dosageAmount,
        dosageUnit: medication.dosageUnit,
        notes: 'Logged from notification',
        updatedAt: timestamp,
      });

      logger.log('[Notification] Medication logged:', {
        medicationId,
        dosage,
      });
    } catch (error) {
      logger.error('[Notification] Error logging medication:', error);
    }
  }

  /**
   * Handle "Snooze" action - reschedule notification
   */
  private async handleSnooze(
    medicationId: string,
    scheduleId: string,
    minutes: number
  ): Promise<void> {
    try {
      const medication = await medicationRepository.getById(medicationId);
      if (!medication) return;

      // Get effective notification settings for this medication
      const effectiveSettings = useNotificationSettingsStore.getState().getEffectiveSettings(medicationId);

      // Schedule a new notification in X minutes
      const snoozeTime = new Date(Date.now() + minutes * 60 * 1000);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Reminder: ${medication.name}`,
          body: `Time to take your medication (snoozed)`,
          data: { medicationId, scheduleId },
          categoryIdentifier: MEDICATION_REMINDER_CATEGORY,
          sound: true,
          // Time-sensitive notification settings for Android and iOS
          ...(Notifications.AndroidNotificationPriority && {
            priority: Notifications.AndroidNotificationPriority.HIGH,
          }),
          // Only set time-sensitive interruption level if enabled in settings
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(effectiveSettings.timeSensitiveEnabled && { interruptionLevel: 'timeSensitive' } as any),
        },
        // Date trigger type is not exported by expo-notifications
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        trigger: snoozeTime as any,
      });

      logger.log('[Notification] Snoozed for', minutes, 'minutes');
    } catch (error) {
      logger.error('[Notification] Error snoozing notification:', error);
    }
  }

  /**
   * Handle "Take All Now" action - log all medications immediately
   */
  private async handleTakeAllNow(
    medicationIds: string[],
    scheduleIds: string[],
    time?: string
  ): Promise<void> {
    try {
      // Cancel follow-up reminder since user took action
      if (time) {
        await this.cancelFollowUpReminder(`multi:${time}`);
      }

      const results: string[] = [];

      // Dynamic import to avoid circular dependency
      const { useMedicationStore } = await import('../store/medicationStore');

      for (let i = 0; i < medicationIds.length; i++) {
        const medicationId = medicationIds[i];
        const scheduleId = scheduleIds[i];

        const medication = await medicationRepository.getById(medicationId);
        if (!medication) {
          logger.error('[Notification] Medication not found:', medicationId);
          continue;
        }

        // Find the schedule to get the dosage
        const schedule = medication.schedule?.find(s => s.id === scheduleId);
        const dosage = schedule?.dosage ?? medication.defaultQuantity ?? 1;

        // Use store's logDose to update both database and state
        const timestamp = Date.now();
        await useMedicationStore.getState().logDose({
          medicationId,
          timestamp,
          quantity: dosage,
          dosageAmount: medication.dosageAmount,
          dosageUnit: medication.dosageUnit,
          notes: 'Logged from notification',
          updatedAt: timestamp,
        });

        results.push(`${medication.name} - ${dosage} dose(s)`);
        logger.log('[Notification] Medication logged:', {
          medicationId,
          dosage,
        });
      }

      logger.log('[Notification] All medications logged:', results);
    } catch (error) {
      logger.error('[Notification] Error logging medications:', error);
    }
  }

  /**
   * Handle "Remind Later" action - reschedule grouped notification
   */
  private async handleRemindLater(
    medicationIds: string[],
    scheduleIds: string[],
    originalTime: string,
    minutes: number
  ): Promise<void> {
    try {
      const medications = await Promise.all(
        medicationIds.map(id => medicationRepository.getById(id))
      );

      const validMedications = medications.filter(m => m !== null) as Medication[];
      if (validMedications.length === 0) return;

      // Get effective notification settings
      // For grouped notifications, use time-sensitive if ANY medication has it enabled
      const settingsStore = useNotificationSettingsStore.getState();
      const anyTimeSensitive = validMedications.some((medication) => {
        const settings = settingsStore.getEffectiveSettings(medication.id);
        return settings.timeSensitiveEnabled;
      });

      // Schedule a new notification in X minutes
      const snoozeTime = new Date(Date.now() + minutes * 60 * 1000);

      const medicationNames = validMedications.map(m => m.name).join(', ');
      const medicationCount = validMedications.length;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Reminder: ${medicationCount} Medications`,
          body: `Time to take: ${medicationNames}`,
          data: {
            medicationIds,
            scheduleIds,
            time: originalTime,
          },
          categoryIdentifier: MULTIPLE_MEDICATION_REMINDER_CATEGORY,
          sound: true,
          // Time-sensitive notification settings for Android and iOS
          ...(Notifications.AndroidNotificationPriority && {
            priority: Notifications.AndroidNotificationPriority.HIGH,
          }),
          // Only set time-sensitive interruption level if enabled for any medication in the group
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(anyTimeSensitive && { interruptionLevel: 'timeSensitive' } as any),
        },
        // Date trigger type is not exported by expo-notifications
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        trigger: snoozeTime as any,
      });

      logger.log('[Notification] Reminder snoozed for', minutes, 'minutes');
    } catch (error) {
      logger.error('[Notification] Error snoozing reminder:', error);
    }
  }

  /**
   * Request notification permissions from the user
   */
  async requestPermissions(): Promise<NotificationPermissions> {
    const { status, canAskAgain, ios } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowSound: true,
        allowBadge: true,
        allowCriticalAlerts: false, // Will request separately when implementing critical alerts
      },
    });

    return {
      granted: status === 'granted',
      canAskAgain,
      ios: ios
        ? {
            allowsAlert: ios.allowsAlert ?? false,
            allowsSound: ios.allowsSound ?? false,
            allowsBadge: ios.allowsBadge ?? false,
            allowsCriticalAlerts: ios.allowsCriticalAlerts ?? false,
          }
        : undefined,
    };
  }

  /**
   * Get current notification permissions
   */
  async getPermissions(): Promise<NotificationPermissions> {
    const { status, canAskAgain, ios } = await Notifications.getPermissionsAsync();

    return {
      granted: status === 'granted',
      canAskAgain,
      ios: ios
        ? {
            allowsAlert: ios.allowsAlert ?? false,
            allowsSound: ios.allowsSound ?? false,
            allowsBadge: ios.allowsBadge ?? false,
            allowsCriticalAlerts: ios.allowsCriticalAlerts ?? false,
          }
        : undefined,
    };
  }

  /**
   * Schedule grouped notifications for all medications
   * Groups medications by their schedule time and creates a single notification per time slot
   */
  async scheduleGroupedNotifications(
    medications: Array<{ medication: Medication; schedule: MedicationSchedule }>
  ): Promise<Map<string, string>> {
    // Map of schedule time -> notification ID
    const notificationIds = new Map<string, string>();

    try {
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
          const notificationId = await this.scheduleSingleNotification(medication, schedule);
          if (notificationId) {
            notificationIds.set(schedule.id, notificationId);
          }
        } else {
          // Multiple medications - use grouped notification
          const notificationId = await this.scheduleMultipleNotification(items, time);
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
   * Schedule a notification for a single medication schedule
   */
  private async scheduleSingleNotification(
    medication: Medication,
    schedule: MedicationSchedule
  ): Promise<string | null> {
    try {
      // Parse the time (HH:mm format)
      const [hours, minutes] = schedule.time.split(':').map(Number);

      // Get effective notification settings for this medication
      const effectiveSettings = useNotificationSettingsStore.getState().getEffectiveSettings(medication.id);

      logger.log('[Notification] Scheduling single medication for', hours, ':', minutes, {
        timeSensitive: effectiveSettings.timeSensitiveEnabled,
      });

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Time for ${medication.name}`,
          body: `${schedule.dosage} dose(s) - ${medication.dosageAmount}${medication.dosageUnit} each`,
          data: {
            medicationId: medication.id,
            scheduleId: schedule.id,
          },
          categoryIdentifier: MEDICATION_REMINDER_CATEGORY,
          sound: true,
          // Time-sensitive notification settings for Android and iOS
          ...(Notifications.AndroidNotificationPriority && {
            priority: Notifications.AndroidNotificationPriority.HIGH,
          }),
          // Only set time-sensitive interruption level if enabled in settings
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(effectiveSettings.timeSensitiveEnabled && { interruptionLevel: 'timeSensitive' } as any), // iOS: breaks through Focus modes
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hours,
          minute: minutes,
        },
      });

      logger.log('[Notification] Scheduled for', medication.name, 'at', schedule.time);
      return notificationId;
    } catch (error) {
      logger.error('[Notification] Error scheduling single notification:', error);
      return null;
    }
  }

  /**
   * Schedule a grouped notification for multiple medications at the same time
   */
  private async scheduleMultipleNotification(
    items: Array<{ medication: Medication; schedule: MedicationSchedule }>,
    time: string
  ): Promise<string | null> {
    try {
      // Parse the time (HH:mm format)
      const [hours, minutes] = time.split(':').map(Number);

      const medicationNames = items.map(({ medication }) => medication.name).join(', ');
      const medicationCount = items.length;
      const medicationIds = items.map(({ medication }) => medication.id);
      const scheduleIds = items.map(({ schedule }) => schedule.id);

      // Get effective notification settings
      // For grouped notifications, use time-sensitive if ANY medication has it enabled
      const settingsStore = useNotificationSettingsStore.getState();
      const anyTimeSensitive = items.some(({ medication }) => {
        const settings = settingsStore.getEffectiveSettings(medication.id);
        return settings.timeSensitiveEnabled;
      });

      logger.log('[Notification] Scheduling combined notification for', medicationCount, 'medications at', time, {
        timeSensitive: anyTimeSensitive,
      });

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Time for ${medicationCount} Medications`,
          body: medicationNames,
          data: {
            medicationIds,
            scheduleIds,
            time,
          },
          categoryIdentifier: MULTIPLE_MEDICATION_REMINDER_CATEGORY,
          sound: true,
          // Time-sensitive notification settings for Android and iOS
          ...(Notifications.AndroidNotificationPriority && {
            priority: Notifications.AndroidNotificationPriority.HIGH,
          }),
          // Only set time-sensitive interruption level if enabled for any medication in the group
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(anyTimeSensitive && { interruptionLevel: 'timeSensitive' } as any), // iOS: breaks through Focus modes
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hours,
          minute: minutes,
        },
      });

      logger.log('[Notification] Scheduled combined notification for', medicationCount, 'medications at', time);
      return notificationId;
    } catch (error) {
      logger.error('[Notification] Error scheduling combined notification:', error);
      return null;
    }
  }

  /**
   * Schedule a follow-up reminder 30 minutes after the initial notification
   * Uses critical alert to ensure it plays even when phone is silenced
   *
   * Note: Critical alerts require special entitlement from Apple
   * Request at: https://developer.apple.com/contact/request/notifications-critical-alerts-entitlement/
   */
  private async scheduleFollowUpReminder(
    medicationId: string | string[],
    scheduleId: string | string[],
    medicationName: string,
    time?: string
  ): Promise<void> {
    try {
      // Schedule follow-up notification 30 minutes from now
      const followUpTime = new Date(Date.now() + 30 * 60 * 1000);

      const isSingle = typeof medicationId === 'string';
      const key = isSingle
        ? `${medicationId}:${scheduleId}`
        : `multi:${time}`;

      const title = isSingle
        ? `Reminder: ${medicationName}`
        : `Reminder: ${medicationName} (${Array.isArray(medicationId) ? medicationId.length : 1} medications)`;

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
          // Critical alert properties (requires entitlement)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...({ critical: true } as any), // iOS: plays even when phone is silenced
          // Time-sensitive notification settings
          ...(Notifications.AndroidNotificationPriority && {
            priority: Notifications.AndroidNotificationPriority.MAX,
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...({ interruptionLevel: 'critical' } as any), // iOS: critical interruption level
        },
        // Date trigger type is not exported by expo-notifications
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        trigger: followUpTime as any,
      });

      // Store the follow-up notification ID for later cancellation
      this.followUpNotifications.set(key, notificationId);

      logger.log('[Notification] Scheduled follow-up reminder for', medicationName, 'at', followUpTime.toLocaleTimeString());
    } catch (error) {
      logger.error('[Notification] Error scheduling follow-up reminder:', error);
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
    return this.scheduleSingleNotification(medication, schedule);
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      logger.log('[Notification] Cancelled:', notificationId);
    } catch (error) {
      logger.error('[Notification] Error cancelling notification:', error);
    }
  }

  /**
   * Cancel all notifications for a medication
   */
  async cancelMedicationNotifications(medicationId: string): Promise<void> {
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
   * Get all scheduled notifications
   */
  async getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    logger.log('[Notification] Cancelled all notifications');
  }

  /**
   * Reschedule all medication notifications with grouping
   * This should be called after any medication schedule changes
   */
  async rescheduleAllMedicationNotifications(): Promise<void> {
    try {
      // Cancel all existing medication notifications
      await this.cancelAllNotifications();

      // Get all active medications with schedules
      const medications = await medicationRepository.getActive();
      const items: Array<{ medication: Medication; schedule: MedicationSchedule }> = [];

      for (const medication of medications) {
        if (medication.type === 'preventative' && medication.scheduleFrequency === 'daily') {
          const schedules = await medicationScheduleRepository.getByMedicationId(medication.id);
          for (const schedule of schedules) {
            if (schedule.enabled) {
              items.push({ medication, schedule });
            }
          }
        }
      }

      // Schedule grouped notifications
      const notificationIds = await this.scheduleGroupedNotifications(items);

      // Update schedules with notification IDs
      for (const [scheduleId, notificationId] of notificationIds.entries()) {
        await medicationScheduleRepository.update(scheduleId, {
          notificationId,
        });
      }

      logger.log('[Notification] Rescheduled all medication notifications with grouping:', notificationIds.size);
    } catch (error) {
      logger.error('[Notification] Error rescheduling all notifications:', error);
    }
  }
}

export const notificationService = new NotificationService();
