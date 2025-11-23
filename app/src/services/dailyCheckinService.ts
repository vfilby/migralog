import * as Notifications from 'expo-notifications';
import { logger } from '../utils/logger';
import { useDailyCheckinSettingsStore } from '../store/dailyCheckinSettingsStore';
import { useDailyStatusStore } from '../store/dailyStatusStore';
import { useEpisodeStore } from '../store/episodeStore';
import { format } from 'date-fns';
import { areNotificationsGloballyEnabled } from './notificationUtils';

// Notification category for daily check-in
const DAILY_CHECKIN_CATEGORY = 'DAILY_CHECKIN';

/**
 * Handle incoming daily check-in notifications
 * Determines whether to show the notification based on current day status
 */
export async function handleDailyCheckinNotification(
  notification: Notifications.Notification
): Promise<Notifications.NotificationBehavior | null> {
  const data = notification.request.content.data as {
    type?: string;
    date?: string;
  };

  // Only handle daily check-in notifications
  if (data.type !== 'daily_checkin') {
    return null; // Not handled by this service
  }

  try {
    // Check if we should show the notification
    const today = format(new Date(), 'yyyy-MM-dd');
    const dailyStatusStore = useDailyStatusStore.getState();
    const episodeStore = useEpisodeStore.getState();

    // Don't show if user is currently in an active episode
    if (episodeStore.currentEpisode) {
      logger.log('[DailyCheckin] User has active episode, suppressing notification');
      return {
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    // Check if today already has a status logged or an episode
    const todayStatus = await dailyStatusStore.getDayStatus(today);
    if (todayStatus) {
      logger.log('[DailyCheckin] Day already has status logged, suppressing notification:', todayStatus.status);
      return {
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    // Show the notification
    logger.log('[DailyCheckin] Showing daily check-in notification');
    return {
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  } catch (error) {
    logger.error('[DailyCheckin] Error checking if notification should be shown:', error);
    // Default to showing the notification on error
    return {
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  }
}

class DailyCheckinService {
  private initialized = false;
  private scheduledNotificationId: string | null = null;
  private responseSubscription: Notifications.Subscription | null = null;

  /**
   * Initialize the daily check-in service
   * Registers notification category and sets up handlers
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Register notification category with action buttons
    await this.registerCategory();

    // Set up notification response listener
    this.setupResponseHandler();

    // Handle any pending notification response that arrived before app initialized
    // This is critical for notification actions (like "Clear Day") that are tapped
    // while the app is in the background or killed
    await this.processPendingResponse();

    this.initialized = true;
    logger.log('[DailyCheckin] Service initialized');
  }

  /**
   * Process any pending notification response from before app initialization
   * This handles the case where user tapped a notification action while the app was killed/backgrounded
   */
  private async processPendingResponse(): Promise<void> {
    try {
      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (!lastResponse) return;

      const data = lastResponse.notification.request.content.data as {
        type?: string;
        date?: string;
      };

      // Only handle daily check-in notifications
      if (data.type !== 'daily_checkin') return;

      const { actionIdentifier } = lastResponse;
      const date = data.date || format(new Date(), 'yyyy-MM-dd');

      logger.log('[DailyCheckin] Processing pending response from before app init:', {
        actionIdentifier,
        date,
      });

      switch (actionIdentifier) {
        case 'CLEAR_DAY':
          await this.handleClearDay(date);
          break;
        case 'NOT_CLEAR':
          logger.log('[DailyCheckin] Pending "Not clear" action - app is now open');
          break;
        default:
          logger.log('[DailyCheckin] Pending notification tap - app is now open');
          break;
      }
    } catch (error) {
      logger.error('[DailyCheckin] Error processing pending notification response:', error);
    }
  }

  /**
   * Register the notification category with Clear/Not Clear actions
   */
  private async registerCategory(): Promise<void> {
    await Notifications.setNotificationCategoryAsync(DAILY_CHECKIN_CATEGORY, [
      {
        identifier: 'CLEAR_DAY',
        buttonTitle: '✓ Clear Day',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'NOT_CLEAR',
        buttonTitle: 'Not Clear',
        options: {
          opensAppToForeground: true, // Open app to log episode or details
        },
      },
    ]);

    logger.log('[DailyCheckin] Registered notification category');
  }

  /**
   * Set up handler for notification responses
   */
  private setupResponseHandler(): void {
    // Remove existing subscription if any (prevents duplicates on re-init)
    if (this.responseSubscription) {
      this.responseSubscription.remove();
      this.responseSubscription = null;
    }

    this.responseSubscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const { actionIdentifier, notification } = response;
      const data = notification.request.content.data as {
        type?: string;
        date?: string;
      };

      // Only handle daily check-in notifications
      if (data.type !== 'daily_checkin') {
        return;
      }

      const date = data.date || format(new Date(), 'yyyy-MM-dd');

      logger.log('[DailyCheckin] Response received:', {
        actionIdentifier,
        date,
      });

      try {
        switch (actionIdentifier) {
          case 'CLEAR_DAY':
            await this.handleClearDay(date);
            break;
          case 'NOT_CLEAR':
            // App will be opened - user can log episode or details
            logger.log('[DailyCheckin] Not clear tapped, opening app');
            break;
          default:
            // User tapped the notification itself
            logger.log('[DailyCheckin] Notification tapped, opening app');
            break;
        }
      } catch (error) {
        logger.error('[DailyCheckin] Error handling notification response:', error);
      }
    });
  }

  /**
   * Handle the "Clear Day" action - log today as a green day
   */
  private async handleClearDay(date: string): Promise<void> {
    try {
      const dailyStatusStore = useDailyStatusStore.getState();

      await dailyStatusStore.logDayStatus(date, 'green', undefined, undefined, true);

      logger.log('[DailyCheckin] Logged clear day for:', date);
    } catch (error) {
      logger.error('[DailyCheckin] Failed to log clear day:', error);
      throw error;
    }
  }

  /**
   * Schedule the daily check-in notification
   * Should be called when settings are updated or on app start
   */
  async scheduleNotification(): Promise<void> {
    try {
      // Cancel any existing scheduled notification
      await this.cancelNotification();

      // Check if notifications are globally enabled
      const globallyEnabled = await areNotificationsGloballyEnabled();
      if (!globallyEnabled) {
        logger.log('[DailyCheckin] Notifications globally disabled, skipping schedule');
        return;
      }

      // Load settings
      const settingsStore = useDailyCheckinSettingsStore.getState();
      if (!settingsStore.isLoaded) {
        await settingsStore.loadSettings();
      }

      const { settings } = settingsStore;

      if (!settings.enabled) {
        logger.log('[DailyCheckin] Daily check-in disabled, skipping schedule');
        return;
      }

      // Parse the check-in time
      const { hours, minutes } = settingsStore.getCheckInTimeComponents();

      logger.log('[DailyCheckin] Scheduling notification for', hours, ':', minutes);

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'How was your day?',
          body: 'Tap to log how you\'re feeling today',
          data: {
            type: 'daily_checkin',
            date: format(new Date(), 'yyyy-MM-dd'),
          },
          categoryIdentifier: DAILY_CHECKIN_CATEGORY,
          sound: true,
          // Time-sensitive notification settings
          ...(Notifications.AndroidNotificationPriority && {
            priority: Notifications.AndroidNotificationPriority.DEFAULT,
          }),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hours,
          minute: minutes,
        },
      });

      this.scheduledNotificationId = notificationId;
      logger.log('[DailyCheckin] Scheduled notification:', notificationId);
    } catch (error) {
      logger.error('[DailyCheckin] Error scheduling notification:', error);
    }
  }

  /**
   * Cancel the scheduled daily check-in notification
   */
  async cancelNotification(): Promise<void> {
    try {
      // Cancel by our tracked ID if we have one
      if (this.scheduledNotificationId) {
        await Notifications.cancelScheduledNotificationAsync(this.scheduledNotificationId);
        logger.log('[DailyCheckin] Cancelled notification:', this.scheduledNotificationId);
        this.scheduledNotificationId = null;
      }

      // Also cancel any notifications with our identifier pattern
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const notif of scheduled) {
        const data = notif.content.data as { type?: string };
        if (data.type === 'daily_checkin') {
          await Notifications.cancelScheduledNotificationAsync(notif.identifier);
          logger.log('[DailyCheckin] Cancelled orphaned notification:', notif.identifier);
        }
      }
    } catch (error) {
      logger.error('[DailyCheckin] Error cancelling notification:', error);
    }
  }

  /**
   * Reschedule notification after settings change
   */
  async rescheduleNotification(): Promise<void> {
    await this.scheduleNotification();
  }

  /**
   * Check if a daily check-in notification is currently scheduled
   */
  async isNotificationScheduled(): Promise<boolean> {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      return scheduled.some((notif) => {
        const data = notif.content.data as { type?: string };
        return data.type === 'daily_checkin';
      });
    } catch (error) {
      logger.error('[DailyCheckin] Error checking scheduled notifications:', error);
      return false;
    }
  }

  /**
   * Cancel scheduled notification and dismiss any presented notifications for daily check-in
   * Called when a day status is logged to prevent the notification from showing
   * after the user has already logged their day
   */
  async cancelAndDismissForDate(date: string): Promise<void> {
    const today = format(new Date(), 'yyyy-MM-dd');

    // Only cancel if logging today's status
    if (date !== today) {
      logger.log('[DailyCheckin] Not cancelling notification - logged date is not today:', date);
      return;
    }

    try {
      // Cancel the scheduled notification
      await this.cancelNotification();
      logger.log('[DailyCheckin] Cancelled scheduled notification for today');

      // Dismiss any presented notifications
      const presentedNotifications = await Notifications.getPresentedNotificationsAsync();
      for (const notification of presentedNotifications) {
        const data = notification.request.content.data as { type?: string };
        if (data.type === 'daily_checkin') {
          await Notifications.dismissNotificationAsync(notification.request.identifier);
          logger.log('[DailyCheckin] Dismissed presented notification:', notification.request.identifier);
        }
      }
    } catch (error) {
      logger.error('[DailyCheckin] Error cancelling/dismissing notifications:', error);
    }
  }
}

export const dailyCheckinService = new DailyCheckinService();
