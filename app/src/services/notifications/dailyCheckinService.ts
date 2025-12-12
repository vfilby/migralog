import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';
import { useDailyCheckinSettingsStore } from '../../store/dailyCheckinSettingsStore';
import { format, addDays, startOfDay } from 'date-fns';
import { areNotificationsGloballyEnabled } from './notificationUtils';
import { Episode } from '../../models/types';
import { scheduledNotificationRepository } from '../../database/scheduledNotificationRepository';

// Lazy imports to avoid require cycles
const getDailyStatusStore = () =>
  require('../../store/dailyStatusStore').useDailyStatusStore;
const getEpisodeStore = () =>
  require('../../store/episodeStore').useEpisodeStore;

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
    const dailyStatusStore = getDailyStatusStore().getState();
    const episodeStore = getEpisodeStore().getState();

    logger.log('[DailyCheckin] Evaluating notification for date:', today);

    // Load current episode if not already loaded
    // This will use cache if available (5 second TTL) or query database
    await episodeStore.loadCurrentEpisode();

    // Don't show if user is currently in an active episode
    if (episodeStore.currentEpisode) {
      logger.log('[DailyCheckin] User has active episode, suppressing notification', {
        episodeId: episodeStore.currentEpisode.id,
        startTime: new Date(episodeStore.currentEpisode.startTime).toISOString(),
      });
      return {
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    // SAFETY FIX (SUP-454): Business rule - ANY episode on the day = red day = suppress notification
    // Check if ANY episode exists for today (active or ended)
    const episodesToday = await dailyStatusStore.getEpisodesForDate(today);
    if (episodesToday.length > 0) {
      logger.log('[DailyCheckin] Episode exists for today, suppressing notification (red day)', {
        date: today,
        episodeCount: episodesToday.length,
        episodes: episodesToday.map((ep: Episode) => ({
          id: ep.id,
          startTime: new Date(ep.startTime).toISOString(),
          endTime: ep.endTime ? new Date(ep.endTime).toISOString() : 'ongoing',
        })),
      });
      return {
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    // Check if today already has a status logged
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
    logger.log('[DailyCheckin] Showing daily check-in notification for date:', today);
    return {
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  } catch (error) {
    logger.error('[DailyCheckin] Error checking if notification should be shown:', error);
    // Default to SHOWING the notification on error (safer)
    // Better to show the notification than risk missing a daily check-in
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
      const dailyStatusStore = getDailyStatusStore().getState();

      await dailyStatusStore.logDayStatus(date, 'green', undefined, undefined, true);

      logger.log('[DailyCheckin] Logged clear day for:', date);
    } catch (error) {
      logger.error('[DailyCheckin] Failed to log clear day:', error);
      throw error;
    }
  }

  /**
   * Number of days to schedule daily check-in notifications ahead
   */
  private static readonly DAYS_TO_SCHEDULE = 14;

  /**
   * Schedule the daily check-in notifications using one-time triggers
   * Should be called when settings are updated or on app start
   */
  async scheduleNotification(): Promise<void> {
    try {
      // Check if the table exists (handles case where migrations haven't run yet)
      const tableReady = await scheduledNotificationRepository.tableExists();
      if (!tableReady) {
        logger.log('[DailyCheckin] Table not ready, skipping schedule');
        return;
      }

      // Cancel any existing scheduled notifications
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

      logger.log('[DailyCheckin] Scheduling one-time notifications for', hours, ':', minutes);

      // Schedule notifications for the next N days
      const today = startOfDay(new Date());

      for (let i = 0; i < DailyCheckinService.DAYS_TO_SCHEDULE; i++) {
        const targetDate = addDays(today, i);
        const dateString = format(targetDate, 'yyyy-MM-dd');

        // Create the trigger date with the configured time
        const triggerDate = new Date(targetDate);
        triggerDate.setHours(hours, minutes, 0, 0);

        // Skip if the trigger time has already passed
        if (triggerDate <= new Date()) {
          continue;
        }

        // Check if already scheduled for this date
        const existingMapping = await scheduledNotificationRepository.getDailyCheckinMapping(dateString);
        if (existingMapping) {
          continue;
        }

        // Schedule the notification
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'How was your day?',
            body: 'Tap to log how you\'re feeling today',
            data: {
              type: 'daily_checkin',
              date: dateString,
            },
            categoryIdentifier: DAILY_CHECKIN_CATEGORY,
            sound: true,
            // Time-sensitive notification settings
            ...(settings.timeSensitive && {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              interruptionLevel: 'timeSensitive' as any,
            }),
            ...(Notifications.AndroidNotificationPriority && {
              priority: settings.timeSensitive
                ? Notifications.AndroidNotificationPriority.HIGH
                : Notifications.AndroidNotificationPriority.DEFAULT,
            }),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
          },
        });

        // Save the mapping to database
        await scheduledNotificationRepository.saveMapping({
          medicationId: null,
          scheduleId: null,
          date: dateString,
          notificationId,
          notificationType: 'daily_checkin',
          isGrouped: false,
          sourceType: 'daily_checkin',
        });

        logger.log('[DailyCheckin] Scheduled notification for date:', dateString);
      }

      logger.log('[DailyCheckin] Finished scheduling one-time notifications');
    } catch (error) {
      logger.error('[DailyCheckin] Error scheduling notification:', error);
    }
  }

  /**
   * Top up daily check-in notifications to ensure N days are always scheduled
   * Called on app startup and after a check-in is logged
   */
  async topUpNotifications(): Promise<void> {
    try {
      // Check if the table exists (handles case where migrations haven't run yet)
      const tableReady = await scheduledNotificationRepository.tableExists();
      if (!tableReady) {
        logger.log('[DailyCheckin] Table not ready, skipping top-up');
        return;
      }

      // Check if notifications are globally enabled
      const globallyEnabled = await areNotificationsGloballyEnabled();
      if (!globallyEnabled) {
        return;
      }

      // Load settings
      const settingsStore = useDailyCheckinSettingsStore.getState();
      if (!settingsStore.isLoaded) {
        await settingsStore.loadSettings();
      }

      const { settings } = settingsStore;
      if (!settings.enabled) {
        return;
      }

      // Count existing future notifications
      const count = await scheduledNotificationRepository.countDailyCheckins();

      if (count >= DailyCheckinService.DAYS_TO_SCHEDULE) {
        logger.log('[DailyCheckin] Sufficient notifications scheduled:', count);
        return;
      }

      // Get the last scheduled date
      const lastDate = await scheduledNotificationRepository.getLastDailyCheckinDate();
      const { hours, minutes } = settingsStore.getCheckInTimeComponents();

      // Calculate start date (day after last scheduled, or today if none)
      let startDate: Date;
      if (lastDate) {
        startDate = addDays(new Date(lastDate), 1);
      } else {
        startDate = startOfDay(new Date());
      }

      const daysToAdd = DailyCheckinService.DAYS_TO_SCHEDULE - count;

      logger.log('[DailyCheckin] Topping up notifications:', {
        currentCount: count,
        daysToAdd,
        startDate: format(startDate, 'yyyy-MM-dd'),
      });

      for (let i = 0; i < daysToAdd; i++) {
        const targetDate = addDays(startDate, i);
        const dateString = format(targetDate, 'yyyy-MM-dd');

        // Create the trigger date with the configured time
        const triggerDate = new Date(targetDate);
        triggerDate.setHours(hours, minutes, 0, 0);

        // Skip if the trigger time has already passed
        if (triggerDate <= new Date()) {
          continue;
        }

        // Check if already scheduled for this date
        const existingMapping = await scheduledNotificationRepository.getDailyCheckinMapping(dateString);
        if (existingMapping) {
          continue;
        }

        // Schedule the notification
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'How was your day?',
            body: 'Tap to log how you\'re feeling today',
            data: {
              type: 'daily_checkin',
              date: dateString,
            },
            categoryIdentifier: DAILY_CHECKIN_CATEGORY,
            sound: true,
            ...(settings.timeSensitive && {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              interruptionLevel: 'timeSensitive' as any,
            }),
            ...(Notifications.AndroidNotificationPriority && {
              priority: settings.timeSensitive
                ? Notifications.AndroidNotificationPriority.HIGH
                : Notifications.AndroidNotificationPriority.DEFAULT,
            }),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
          },
        });

        // Save the mapping to database
        await scheduledNotificationRepository.saveMapping({
          medicationId: null,
          scheduleId: null,
          date: dateString,
          notificationId,
          notificationType: 'daily_checkin',
          isGrouped: false,
          sourceType: 'daily_checkin',
        });
      }

      logger.log('[DailyCheckin] Top-up complete');
    } catch (error) {
      logger.error('[DailyCheckin] Error topping up notifications:', error);
    }
  }

  /**
   * Cancel all scheduled daily check-in notifications
   */
  async cancelNotification(): Promise<void> {
    try {
      // Cancel by our tracked ID if we have one (legacy)
      if (this.scheduledNotificationId) {
        await Notifications.cancelScheduledNotificationAsync(this.scheduledNotificationId);
        logger.log('[DailyCheckin] Cancelled legacy notification:', this.scheduledNotificationId);
        this.scheduledNotificationId = null;
      }

      // Cancel all daily check-in notifications from OS
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const notif of scheduled) {
        const data = notif.content.data as { type?: string };
        if (data.type === 'daily_checkin') {
          await Notifications.cancelScheduledNotificationAsync(notif.identifier);
          logger.log('[DailyCheckin] Cancelled notification:', notif.identifier);
        }
      }

      // Delete all daily check-in mappings from database (only if table exists)
      const tableReady = await scheduledNotificationRepository.tableExists();
      if (tableReady) {
        await scheduledNotificationRepository.deleteDailyCheckinMappings();
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
   * Dismiss and cancel the daily check-in notification for a specific date
   *
   * Called when a day status is logged to:
   * 1. Dismiss any already-presented notification in the notification center
   * 2. Cancel the scheduled notification for that date
   * 3. Remove the database mapping
   * 4. Top up notifications to maintain coverage
   */
  async dismissForDate(date: string): Promise<void> {
    const today = format(new Date(), 'yyyy-MM-dd');

    // Only dismiss if for today or past (not future)
    if (date > today) {
      logger.log('[DailyCheckin] Not dismissing notification - date is in the future:', date);
      return;
    }

    // Check if the table exists (handles case where migrations haven't run yet)
    const tableReady = await scheduledNotificationRepository.tableExists();
    if (!tableReady) {
      logger.log('[DailyCheckin] Table not ready, skipping dismiss');
      return;
    }

    try {
      // Dismiss any already-presented notifications in the notification center
      const presentedNotifications = await Notifications.getPresentedNotificationsAsync();
      for (const notification of presentedNotifications) {
        const data = notification.request.content.data as { type?: string; date?: string };
        if (data.type === 'daily_checkin' && (!data.date || data.date === date)) {
          await Notifications.dismissNotificationAsync(notification.request.identifier);
          logger.log('[DailyCheckin] Dismissed presented notification:', notification.request.identifier);
        }
      }

      // Cancel the scheduled notification for this date if it exists
      const mapping = await scheduledNotificationRepository.getDailyCheckinMapping(date);
      if (mapping) {
        await Notifications.cancelScheduledNotificationAsync(mapping.notificationId);
        await scheduledNotificationRepository.deleteMapping(mapping.id);
        logger.log('[DailyCheckin] Cancelled and removed notification for date:', date);
      }

      // Top up notifications to maintain coverage
      await this.topUpNotifications();
    } catch (error) {
      logger.error('[DailyCheckin] Error dismissing notifications:', error);
    }
  }
}

export const dailyCheckinService = new DailyCheckinService();
