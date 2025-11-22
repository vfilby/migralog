import * as Notifications from 'expo-notifications';

// Mock dependencies BEFORE importing the service
jest.mock('expo-notifications');
jest.mock('../notificationService');
jest.mock('../../store/dailyCheckinSettingsStore');
jest.mock('../../store/dailyStatusStore');
jest.mock('../../store/episodeStore');
jest.mock('../../services/errorLogger');

// Add required enum values and methods to mocked Notifications
(Notifications as jest.Mocked<typeof Notifications>).AndroidNotificationPriority = {
  MIN: -2,
  LOW: -1,
  DEFAULT: 0,
  HIGH: 1,
  MAX: 2,
} as any;

(Notifications as any).SchedulableTriggerInputTypes = {
  DAILY: 'daily',
  DATE: 'date',
  CALENDAR: 'calendar',
};

(Notifications.setNotificationCategoryAsync as jest.Mock) = jest.fn();
(Notifications.addNotificationResponseReceivedListener as jest.Mock) = jest.fn();
(Notifications.scheduleNotificationAsync as jest.Mock) = jest.fn();
(Notifications.cancelScheduledNotificationAsync as jest.Mock) = jest.fn();
(Notifications.getAllScheduledNotificationsAsync as jest.Mock) = jest.fn();

// Import service and mocked stores AFTER mocks are set up
import { dailyCheckinService, handleDailyCheckinNotification } from '../dailyCheckinService';
import { notificationService } from '../notificationService';
import { useDailyCheckinSettingsStore } from '../../store/dailyCheckinSettingsStore';
import { useDailyStatusStore } from '../../store/dailyStatusStore';
import { useEpisodeStore } from '../../store/episodeStore';

describe('dailyCheckinService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Reset service initialization state
    (dailyCheckinService as any).initialized = false;
    (dailyCheckinService as any).scheduledNotificationId = null;

    // Default mock implementations
    (Notifications.setNotificationCategoryAsync as jest.Mock).mockResolvedValue(undefined);
    (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({
      remove: jest.fn(),
    });
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('test-notification-id');
    (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockResolvedValue(undefined);
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
    (notificationService.areNotificationsGloballyEnabled as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleDailyCheckinNotification', () => {
    it('should return null for non-daily-checkin notifications', async () => {
      const notification = {
        request: {
          content: {
            data: { type: 'medication_reminder' },
          },
        },
      } as unknown as Notifications.Notification;

      const result = await handleDailyCheckinNotification(notification);
      expect(result).toBeNull();
    });

    it('should suppress notification when user has active episode', async () => {
      (useEpisodeStore.getState as jest.Mock).mockReturnValue({
        currentEpisode: { id: 'test-episode' },
      });

      (useDailyStatusStore.getState as jest.Mock).mockReturnValue({
        getDayStatus: jest.fn().mockResolvedValue(null),
      });

      const notification = {
        request: {
          content: {
            data: { type: 'daily_checkin', date: '2024-01-15' },
          },
        },
      } as unknown as Notifications.Notification;

      const result = await handleDailyCheckinNotification(notification);

      expect(result).toEqual({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      });
    });

    it('should suppress notification when day already has status', async () => {
      (useEpisodeStore.getState as jest.Mock).mockReturnValue({
        currentEpisode: null,
      });

      (useDailyStatusStore.getState as jest.Mock).mockReturnValue({
        getDayStatus: jest.fn().mockResolvedValue({ status: 'green' }),
      });

      const notification = {
        request: {
          content: {
            data: { type: 'daily_checkin', date: '2024-01-15' },
          },
        },
      } as unknown as Notifications.Notification;

      const result = await handleDailyCheckinNotification(notification);

      expect(result).toEqual({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      });
    });

    it('should show notification when no episode and no status logged', async () => {
      (useEpisodeStore.getState as jest.Mock).mockReturnValue({
        currentEpisode: null,
      });

      (useDailyStatusStore.getState as jest.Mock).mockReturnValue({
        getDayStatus: jest.fn().mockResolvedValue(null),
      });

      const notification = {
        request: {
          content: {
            data: { type: 'daily_checkin', date: '2024-01-15' },
          },
        },
      } as unknown as Notifications.Notification;

      const result = await handleDailyCheckinNotification(notification);

      expect(result).toEqual({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      });
    });
  });

  describe('initialize', () => {
    it('should register notification category with Clear/Not Clear actions', async () => {
      await dailyCheckinService.initialize();

      expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith(
        'DAILY_CHECKIN',
        expect.arrayContaining([
          expect.objectContaining({
            identifier: 'CLEAR_DAY',
            buttonTitle: '✓ Clear Day',
          }),
          expect.objectContaining({
            identifier: 'NOT_CLEAR',
            buttonTitle: 'Not Clear',
          }),
        ])
      );
    });

    it('should set up notification response listener', async () => {
      await dailyCheckinService.initialize();

      expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled();
    });

    it('should only initialize once', async () => {
      await dailyCheckinService.initialize();
      await dailyCheckinService.initialize();

      expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('scheduleNotification', () => {
    beforeEach(() => {
      (useDailyCheckinSettingsStore.getState as jest.Mock).mockReturnValue({
        isLoaded: true,
        settings: {
          enabled: true,
          checkInTime: '21:00',
        },
        loadSettings: jest.fn(),
        getCheckInTimeComponents: jest.fn().mockReturnValue({ hours: 21, minutes: 0 }),
      });
    });

    it('should schedule notification at configured time', async () => {
      await dailyCheckinService.scheduleNotification();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'How was your day?',
            body: "Tap to log how you're feeling today",
            categoryIdentifier: 'DAILY_CHECKIN',
            data: expect.objectContaining({
              type: 'daily_checkin',
            }),
          }),
          trigger: expect.objectContaining({
            type: 'daily',
            hour: 21,
            minute: 0,
          }),
        })
      );
    });

    it('should not schedule when daily checkin is disabled', async () => {
      (useDailyCheckinSettingsStore.getState as jest.Mock).mockReturnValue({
        isLoaded: true,
        settings: {
          enabled: false,
          checkInTime: '21:00',
        },
        loadSettings: jest.fn(),
        getCheckInTimeComponents: jest.fn().mockReturnValue({ hours: 21, minutes: 0 }),
      });

      await dailyCheckinService.scheduleNotification();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('should not schedule when notifications are globally disabled', async () => {
      (notificationService.areNotificationsGloballyEnabled as jest.Mock).mockResolvedValue(false);

      await dailyCheckinService.scheduleNotification();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('should cancel existing notification before scheduling new one', async () => {
      // First schedule
      await dailyCheckinService.scheduleNotification();
      const firstNotificationId = (dailyCheckinService as any).scheduledNotificationId;

      // Schedule again
      await dailyCheckinService.scheduleNotification();

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(firstNotificationId);
    });
  });

  describe('cancelNotification', () => {
    it('should cancel scheduled notification', async () => {
      (dailyCheckinService as any).scheduledNotificationId = 'test-id-123';

      await dailyCheckinService.cancelNotification();

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('test-id-123');
    });

    it('should clean up orphaned notifications', async () => {
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        {
          identifier: 'orphan-1',
          content: { data: { type: 'daily_checkin' } },
        },
        {
          identifier: 'other-notification',
          content: { data: { type: 'medication_reminder' } },
        },
      ]);

      await dailyCheckinService.cancelNotification();

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('orphan-1');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('other-notification');
    });
  });

  describe('isNotificationScheduled', () => {
    it('should return true when daily checkin notification is scheduled', async () => {
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        {
          identifier: 'test-id',
          content: { data: { type: 'daily_checkin' } },
        },
      ]);

      const result = await dailyCheckinService.isNotificationScheduled();

      expect(result).toBe(true);
    });

    it('should return false when no daily checkin notification is scheduled', async () => {
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        {
          identifier: 'test-id',
          content: { data: { type: 'medication_reminder' } },
        },
      ]);

      const result = await dailyCheckinService.isNotificationScheduled();

      expect(result).toBe(false);
    });

    it('should return false when no notifications are scheduled', async () => {
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);

      const result = await dailyCheckinService.isNotificationScheduled();

      expect(result).toBe(false);
    });
  });
});
