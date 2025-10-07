import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Medication, MedicationSchedule } from '../models/types';
import { medicationRepository, medicationDoseRepository } from '../database/medicationRepository';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Notification categories for action buttons
const MEDICATION_REMINDER_CATEGORY = 'MEDICATION_REMINDER';

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
  }

  /**
   * Set up handlers for notification interactions
   */
  private setupNotificationHandlers(): void {
    // Handle notification response (tap or action button)
    Notifications.addNotificationResponseReceivedListener(async (response) => {
      const { actionIdentifier, notification } = response;
      const { medicationId, scheduleId } = notification.request.content.data as {
        medicationId: string;
        scheduleId: string;
      };

      console.log('[Notification] Response received:', {
        actionIdentifier,
        medicationId,
        scheduleId,
      });

      switch (actionIdentifier) {
        case 'TAKE_NOW':
          await this.handleTakeNow(medicationId, scheduleId);
          break;
        case 'SNOOZE_10':
          await this.handleSnooze(medicationId, scheduleId, 10);
          break;
        default:
          // User tapped notification - let app navigation handle it
          console.log('[Notification] Notification tapped, opening app');
          break;
      }
    });

    // Handle notifications received while app is in foreground
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('[Notification] Received in foreground:', notification);
    });
  }

  /**
   * Handle "Take Now" action - log medication immediately
   */
  private async handleTakeNow(medicationId: string, scheduleId: string): Promise<void> {
    try {
      const medication = await medicationRepository.getById(medicationId);
      if (!medication) {
        console.error('[Notification] Medication not found:', medicationId);
        return;
      }

      // Find the schedule to get the dosage
      const schedule = medication.schedule?.find(s => s.id === scheduleId);
      const dosage = schedule?.dosage ?? medication.defaultDosage ?? 1;

      // Log the dose
      await medicationDoseRepository.create({
        medicationId,
        timestamp: Date.now(),
        amount: dosage,
        notes: 'Logged from notification',
      });

      // Show success notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Medication Logged',
          body: `${medication.name} - ${dosage} dose(s)`,
        },
        trigger: null, // Show immediately
      });

      console.log('[Notification] Medication logged:', {
        medicationId,
        dosage,
      });
    } catch (error) {
      console.error('[Notification] Error logging medication:', error);
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

      // Schedule a new notification in X minutes
      const snoozeTime = new Date(Date.now() + minutes * 60 * 1000);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Reminder: ${medication.name}`,
          body: `Time to take your medication (snoozed)`,
          data: { medicationId, scheduleId },
          categoryIdentifier: MEDICATION_REMINDER_CATEGORY,
        },
        trigger: snoozeTime as any, // Type assertion for Date trigger
      });

      console.log('[Notification] Snoozed for', minutes, 'minutes');
    } catch (error) {
      console.error('[Notification] Error snoozing notification:', error);
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
   * Schedule a notification for a medication schedule
   */
  async scheduleNotification(
    medication: Medication,
    schedule: MedicationSchedule
  ): Promise<string | null> {
    try {
      if (!schedule.enabled) {
        console.log('[Notification] Schedule disabled, skipping:', schedule.id);
        return null;
      }

      // Parse the time (HH:mm format)
      const [hours, minutes] = schedule.time.split(':').map(Number);

      console.log('[Notification] Scheduling daily notification for', hours, ':', minutes);

      // Calculate the next occurrence of this time
      const now = new Date();
      const scheduledDate = new Date();
      scheduledDate.setHours(hours, minutes, 0, 0);

      // If the time has already passed today, schedule for tomorrow
      if (scheduledDate <= now) {
        scheduledDate.setDate(scheduledDate.getDate() + 1);
      }

      console.log('[Notification] First notification will fire at:', scheduledDate.toLocaleString());

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
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hours,
          minute: minutes,
        },
      });

      console.log('[Notification] Scheduled for', medication.name, 'at', schedule.time);
      return notificationId;
    } catch (error) {
      console.error('[Notification] Error scheduling notification:', error);
      return null;
    }
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('[Notification] Cancelled:', notificationId);
    } catch (error) {
      console.error('[Notification] Error cancelling notification:', error);
    }
  }

  /**
   * Cancel all notifications for a medication
   */
  async cancelMedicationNotifications(medicationId: string): Promise<void> {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const medicationNotifs = scheduled.filter(
        (n) => (n.content.data as any)?.medicationId === medicationId
      );

      for (const notif of medicationNotifs) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }

      console.log('[Notification] Cancelled', medicationNotifs.length, 'notifications for medication');
    } catch (error) {
      console.error('[Notification] Error cancelling medication notifications:', error);
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
    console.log('[Notification] Cancelled all notifications');
  }
}

export const notificationService = new NotificationService();
