import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import { logger } from '../../utils/logger';
import { useDailyCheckinSettingsStore } from '../../store/dailyCheckinSettingsStore';
import { format, addDays, startOfDay } from 'date-fns';
import { areNotificationsGloballyEnabled } from './notificationUtils';
import { Episode } from '../../models/types';
import { scheduledNotificationRepository } from '../../database/scheduledNotificationRepository';
import { extractMedicationName, calculateTriggerTime } from './notificationScheduler';
import { notificationDismissalService } from './NotificationDismissalService';

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

  const timestamp = new Date().toISOString();
  const today = format(new Date(), 'yyyy-MM-dd');

  // Log notification received
  logger.info('[DailyCheckin] Notification handler called', {
    timestamp,
    date: data.date || today,
    notificationId: notification.request.identifier,
  });

  Sentry.addBreadcrumb({
    category: 'notification',
    message: 'Daily check-in notification received',
    level: 'info',
    data: {
      date: data.date || today,
      timestamp,
      notificationId: notification.request.identifier,
    },
  });

  try {
    const dailyStatusStore = getDailyStatusStore().getState();
    const episodeStore = getEpisodeStore().getState();

    logger.debug('[DailyCheckin] Evaluating notification for date:', today);

    // Log before loading current episode
    logger.debug('[DailyCheckin] Loading current episode from store');

    Sentry.addBreadcrumb({
      category: 'notification',
      message: 'Loading current episode',
      level: 'debug',
      data: { date: today },
    });

    // Load current episode if not already loaded
    // This will use cache if available (5 second TTL) or query database
    await episodeStore.loadCurrentEpisode();

    // Log the result of loadCurrentEpisode
    if (episodeStore.currentEpisode) {
      const episode = episodeStore.currentEpisode;
      logger.info('[DailyCheckin] Current episode found', {
        episodeId: episode.id,
        startTime: new Date(episode.startTime).toISOString(),
        endTime: episode.endTime ? new Date(episode.endTime).toISOString() : null,
        isActive: !episode.endTime,
      });

      Sentry.addBreadcrumb({
        category: 'notification',
        message: 'Current episode exists - suppressing notification',
        level: 'info',
        data: {
          episodeId: episode.id,
          startTime: new Date(episode.startTime).toISOString(),
          endTime: episode.endTime ? new Date(episode.endTime).toISOString() : null,
          decision: 'suppress',
        },
      });

      logger.info('[DailyCheckin] User has active episode, suppressing notification', {
        episodeId: episode.id,
        startTime: new Date(episode.startTime).toISOString(),
      });

      return {
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    // Log when no current episode found
    logger.info('[DailyCheckin] No current episode found');

    Sentry.addBreadcrumb({
      category: 'notification',
      message: 'No current episode - checking episodes for today',
      level: 'info',
      data: { date: today },
    });

    // SAFETY FIX (SUP-454): Business rule - ANY episode on the day = red day = suppress notification
    // Check if ANY episode exists for today (active or ended)
    logger.debug('[DailyCheckin] Checking for any episodes today');
    const episodesToday = await dailyStatusStore.getEpisodesForDate(today);

    logger.info('[DailyCheckin] Episodes for today query result', {
      date: today,
      episodeCount: episodesToday.length,
      episodeIds: episodesToday.map((ep: Episode) => ep.id),
    });

    if (episodesToday.length > 0) {
      const episodeDetails = episodesToday.map((ep: Episode) => ({
        id: ep.id,
        startTime: new Date(ep.startTime).toISOString(),
        endTime: ep.endTime ? new Date(ep.endTime).toISOString() : 'ongoing',
      }));

      logger.info('[DailyCheckin] Episode exists for today, suppressing notification (red day)', {
        date: today,
        episodeCount: episodesToday.length,
        episodes: episodeDetails,
      });

      Sentry.addBreadcrumb({
        category: 'notification',
        message: 'Episodes found for today - suppressing notification',
        level: 'info',
        data: {
          date: today,
          episodeCount: episodesToday.length,
          episodes: episodeDetails,
          decision: 'suppress',
        },
      });

      return {
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    logger.info('[DailyCheckin] No episodes found for today');

    Sentry.addBreadcrumb({
      category: 'notification',
      message: 'No episodes for today - checking day status',
      level: 'info',
      data: { date: today },
    });

    // Check if today already has a status logged
    logger.debug('[DailyCheckin] Checking if day status already logged');
    const todayStatus = await dailyStatusStore.getDayStatus(today);

    if (todayStatus) {
      logger.info('[DailyCheckin] Day already has status logged, suppressing notification', {
        status: todayStatus.status,
        date: today,
      });

      Sentry.addBreadcrumb({
        category: 'notification',
        message: 'Day status already logged - suppressing notification',
        level: 'info',
        data: {
          date: today,
          status: todayStatus.status,
          decision: 'suppress',
        },
      });

      return {
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    logger.info('[DailyCheckin] No day status logged');

    // Show the notification
    logger.info('[DailyCheckin] All checks passed - showing notification', {
      date: today,
      timestamp: new Date().toISOString(),
    });

    Sentry.addBreadcrumb({
      category: 'notification',
      message: 'All checks passed - showing daily check-in notification',
      level: 'info',
      data: {
        date: today,
        decision: 'show',
      },
    });

    return {
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  } catch (error) {
    logger.error('[DailyCheckin] Error checking if notification should be shown:', error);

    Sentry.addBreadcrumb({
      category: 'notification',
      message: 'Error in notification handler - defaulting to show',
      level: 'error',
      data: {
        error: error instanceof Error ? error.message : String(error),
        decision: 'show',
      },
    });

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

        // Prepare notification content
        const notificationContent = {
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
        };

        // Schedule the notification
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: notificationContent,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
          },
        });

        // Extract comprehensive metadata from notification content and trigger
        const metadata = {
          medicationName: extractMedicationName(notificationContent.title),
          scheduledTriggerTime: calculateTriggerTime(triggerDate),
          notificationTitle: notificationContent.title,
          notificationBody: notificationContent.body,
          categoryIdentifier: notificationContent.categoryIdentifier,
        };

        logger.log('[DailyCheckin] Extracted metadata for daily check-in:', {
          date: dateString,
          notificationId,
          medicationName: metadata.medicationName,
          triggerTime: metadata.scheduledTriggerTime?.toISOString(),
          categoryIdentifier: metadata.categoryIdentifier,
        });

        // Save the mapping with metadata to database
        await scheduledNotificationRepository.saveMapping({
          medicationId: null,
          scheduleId: null,
          date: dateString,
          notificationId,
          notificationType: 'daily_checkin',
          isGrouped: false,
          sourceType: 'daily_checkin',
          // Include extracted metadata (convert null to undefined for optional fields)
          medicationName: metadata.medicationName || undefined,
          scheduledTriggerTime: metadata.scheduledTriggerTime || undefined,
          notificationTitle: metadata.notificationTitle || undefined,
          notificationBody: metadata.notificationBody || undefined,
          categoryIdentifier: metadata.categoryIdentifier || undefined,
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
   * Dismiss and cancel the daily check-in notification for a specific date using cross-reference logic
   *
   * NEW IMPLEMENTATION: Uses NotificationDismissalService for consistent dismissal logic
   * - Database cross-reference for exact matching
   * - Fallback strategies for robust dismissal
   * - Comprehensive logging and error handling
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

    try {
      logger.info('[DailyCheckin] Dismissing notifications for date using cross-reference service', {
        date,
        component: 'DailyCheckinDismissal',
      });

      // Use the cross-reference service for consistent dismissal logic
      const success = await notificationDismissalService.dismissDailyCheckinForDate(date);

      if (success) {
        logger.info('[DailyCheckin] Successfully dismissed daily check-in via cross-reference service', {
          date,
          component: 'DailyCheckinDismissal',
        });
      } else {
        logger.warn('[DailyCheckin] Cross-reference service could not dismiss daily check-in', {
          date,
          component: 'DailyCheckinDismissal',
        });
      }

      // Top up notifications to maintain coverage
      await this.topUpNotifications();
    } catch (error) {
      logger.error('[DailyCheckin] Error dismissing notifications via cross-reference service:', error);
      
      // Fallback to original logic if cross-reference service fails
      logger.info('[DailyCheckin] Attempting fallback dismissal logic', {
        date,
        component: 'DailyCheckinDismissal',
      });

      try {
        // Check if the table exists (handles case where migrations haven't run yet)
        const tableReady = await scheduledNotificationRepository.tableExists();
        if (!tableReady) {
          logger.log('[DailyCheckin] Table not ready, skipping fallback dismiss');
          return;
        }

        // Dismiss any already-presented notifications in the notification center
        const presentedNotifications = await Notifications.getPresentedNotificationsAsync();
        for (const notification of presentedNotifications) {
          const data = notification.request.content.data as { type?: string; date?: string };
          if (data.type === 'daily_checkin' && (!data.date || data.date === date)) {
            await Notifications.dismissNotificationAsync(notification.request.identifier);
            logger.log('[DailyCheckin] Dismissed presented notification (fallback):', notification.request.identifier);
          }
        }

        // Cancel the scheduled notification for this date if it exists
        const mapping = await scheduledNotificationRepository.getDailyCheckinMapping(date);
        if (mapping) {
          await Notifications.cancelScheduledNotificationAsync(mapping.notificationId);
          await scheduledNotificationRepository.deleteMapping(mapping.id);
          logger.log('[DailyCheckin] Cancelled and removed notification for date (fallback):', date);
        }

        logger.info('[DailyCheckin] Fallback dismissal completed successfully', {
          date,
          component: 'DailyCheckinDismissal',
        });
      } catch (fallbackError) {
        logger.error('[DailyCheckin] Fallback dismissal also failed:', fallbackError);
      }
    }
  }
}

export const dailyCheckinService = new DailyCheckinService();
