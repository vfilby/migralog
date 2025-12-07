import * as Notifications from 'expo-notifications';

// Mock dependencies BEFORE importing the service
jest.mock('expo-notifications');
jest.mock('../notifications/notificationUtils');
jest.mock('../../store/dailyCheckinSettingsStore');
jest.mock('../../store/dailyStatusStore');
jest.mock('../../store/episodeStore');
jest.mock('../../services/errorLogger');

// Mock date-fns format function to control "today" in tests
jest.mock('date-fns', () => ({
  ...jest.requireActual('date-fns'),
  format: jest.fn((date, formatStr) => {
    // Use actual format for most cases, but allow tests to control it
    const actual = jest.requireActual('date-fns');
    return actual.format(date, formatStr);
  }),
}));

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
(Notifications as any).getLastNotificationResponseAsync = jest.fn();
(Notifications as any).getPresentedNotificationsAsync = jest.fn();
(Notifications as any).dismissNotificationAsync = jest.fn();

// Import service and mocked stores AFTER mocks are set up
import { dailyCheckinService, handleDailyCheckinNotification } from '../notifications/dailyCheckinService';
import { areNotificationsGloballyEnabled } from '../notifications/notificationUtils';
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
    (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(null);
    (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue([]);
    (Notifications.dismissNotificationAsync as jest.Mock).mockResolvedValue(undefined);
    (areNotificationsGloballyEnabled as jest.Mock).mockResolvedValue(true);
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
      const mockLoadCurrentEpisode = jest.fn().mockResolvedValue(undefined);
      
      (useEpisodeStore.getState as jest.Mock).mockReturnValue({
        currentEpisode: { id: 'test-episode', startTime: Date.now(), endTime: undefined },
        loadCurrentEpisode: mockLoadCurrentEpisode,
      });

      (useDailyStatusStore.getState as jest.Mock).mockReturnValue({
        getDayStatus: jest.fn().mockResolvedValue(null),
        getEpisodesForDate: jest.fn().mockResolvedValue([]),
      });

      const notification = {
        request: {
          content: {
            data: { type: 'daily_checkin', date: '2024-01-15' },
          },
        },
      } as unknown as Notifications.Notification;

      const result = await handleDailyCheckinNotification(notification);

      expect(mockLoadCurrentEpisode).toHaveBeenCalled();
      expect(result).toEqual({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      });
    });

    it('should suppress notification when day already has status', async () => {
      const mockLoadCurrentEpisode = jest.fn().mockResolvedValue(undefined);
      
      (useEpisodeStore.getState as jest.Mock).mockReturnValue({
        currentEpisode: null,
        loadCurrentEpisode: mockLoadCurrentEpisode,
      });

      (useDailyStatusStore.getState as jest.Mock).mockReturnValue({
        getDayStatus: jest.fn().mockResolvedValue({ status: 'green' }),
        getEpisodesForDate: jest.fn().mockResolvedValue([]),
      });

      const notification = {
        request: {
          content: {
            data: { type: 'daily_checkin', date: '2024-01-15' },
          },
        },
      } as unknown as Notifications.Notification;

      const result = await handleDailyCheckinNotification(notification);

      expect(mockLoadCurrentEpisode).toHaveBeenCalled();
      expect(result).toEqual({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      });
    });

    it('should show notification when no episode and no status logged', async () => {
      const mockLoadCurrentEpisode = jest.fn().mockResolvedValue(undefined);
      
      (useEpisodeStore.getState as jest.Mock).mockReturnValue({
        currentEpisode: null,
        loadCurrentEpisode: mockLoadCurrentEpisode,
      });

      (useDailyStatusStore.getState as jest.Mock).mockReturnValue({
        getDayStatus: jest.fn().mockResolvedValue(null),
        getEpisodesForDate: jest.fn().mockResolvedValue([]),
      });

      const notification = {
        request: {
          content: {
            data: { type: 'daily_checkin', date: '2024-01-15' },
          },
        },
      } as unknown as Notifications.Notification;

      const result = await handleDailyCheckinNotification(notification);

      expect(mockLoadCurrentEpisode).toHaveBeenCalled();
      expect(result).toEqual({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      });
    });

    it('should suppress notification when an episode ended earlier that day', async () => {
      const mockLoadCurrentEpisode = jest.fn().mockResolvedValue(undefined);

      // Episode that ended at 7:20 PM on the same day
      const endedEpisode = {
        id: 'test-episode',
        startTime: new Date('2025-12-07T18:00:00').getTime(), // Started at 6:00 PM
        endTime: new Date('2025-12-07T19:20:00').getTime(),   // Ended at 7:20 PM
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (useEpisodeStore.getState as jest.Mock).mockReturnValue({
        currentEpisode: null, // Episode is no longer active
        loadCurrentEpisode: mockLoadCurrentEpisode,
      });

      (useDailyStatusStore.getState as jest.Mock).mockReturnValue({
        getDayStatus: jest.fn().mockResolvedValue(null),
        getEpisodesForDate: jest.fn().mockResolvedValue([endedEpisode]),
      });

      const notification = {
        request: {
          content: {
            data: { type: 'daily_checkin', date: '2025-12-07' },
          },
        },
      } as unknown as Notifications.Notification;

      const result = await handleDailyCheckinNotification(notification);

      // Should suppress notification because an episode occurred that day (red day)
      expect(result).toEqual({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
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
            data: {
              type: 'daily_checkin',
              // Note: 'date' field is not included because this is a DAILY trigger
            },
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
      (areNotificationsGloballyEnabled as jest.Mock).mockResolvedValue(false);

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

  describe('initialize - processPendingResponse', () => {
    it('should process pending CLEAR_DAY response when app starts', async () => {
      const mockLogDayStatus = jest.fn().mockResolvedValue({});
      (useDailyStatusStore.getState as jest.Mock).mockReturnValue({
        logDayStatus: mockLogDayStatus,
        getDayStatus: jest.fn().mockResolvedValue(null),
      });

      const pendingResponse = {
        actionIdentifier: 'CLEAR_DAY',
        notification: {
          request: {
            content: {
              data: { type: 'daily_checkin', date: '2024-01-15' },
            },
          },
        },
      };

      (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(pendingResponse);

      await dailyCheckinService.initialize();

      // Verify logDayStatus was called with the correct date and 'green' status
      expect(mockLogDayStatus).toHaveBeenCalledWith('2024-01-15', 'green', undefined, undefined, true);
    });

    it('should not process pending response if not daily_checkin type', async () => {
      const mockLogDayStatus = jest.fn();
      (useDailyStatusStore.getState as jest.Mock).mockReturnValue({
        logDayStatus: mockLogDayStatus,
        getDayStatus: jest.fn().mockResolvedValue(null),
      });

      const pendingResponse = {
        actionIdentifier: 'TAKE_NOW',
        notification: {
          request: {
            content: {
              data: { type: 'medication_reminder' },
            },
          },
        },
      };

      (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(pendingResponse);

      await dailyCheckinService.initialize();

      // Should not call logDayStatus for non-daily-checkin notifications
      expect(mockLogDayStatus).not.toHaveBeenCalled();
    });

    it('should handle NOT_CLEAR action without logging status', async () => {
      const mockLogDayStatus = jest.fn();
      (useDailyStatusStore.getState as jest.Mock).mockReturnValue({
        logDayStatus: mockLogDayStatus,
        getDayStatus: jest.fn().mockResolvedValue(null),
      });

      const pendingResponse = {
        actionIdentifier: 'NOT_CLEAR',
        notification: {
          request: {
            content: {
              data: { type: 'daily_checkin', date: '2024-01-15' },
            },
          },
        },
      };

      (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(pendingResponse);

      await dailyCheckinService.initialize();

      // NOT_CLEAR should not log status - user will log manually in app
      expect(mockLogDayStatus).not.toHaveBeenCalled();
    });

    it('should handle no pending response gracefully', async () => {
      (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(null);

      await expect(dailyCheckinService.initialize()).resolves.not.toThrow();
    });
  });

  describe('cancelAndDismissForDate', () => {
    beforeEach(() => {
      // Reset initialization to allow calling cancelAndDismissForDate
      (dailyCheckinService as any).initialized = true;
    });

    it('should dismiss presented notifications when logging today (but not cancel recurring schedule)', async () => {
      // Mock today's date
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const mockPresentedNotifs = [
        {
          request: {
            identifier: 'notif-1',
            content: { data: { type: 'daily_checkin' } },
          },
        },
        {
          request: {
            identifier: 'notif-2',
            content: { data: { type: 'medication_reminder' } },
          },
        },
      ];

      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue(mockPresentedNotifs);

      await dailyCheckinService.cancelAndDismissForDate(todayStr);

      // Should NOT cancel the recurring DAILY notification (it needs to fire tomorrow)
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();

      // Should dismiss only daily_checkin presented notifications
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledTimes(1);
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('notif-1');
    });

    it('should not dismiss notifications when logging a past date', async () => {
      await dailyCheckinService.cancelAndDismissForDate('2020-01-01');

      // Should not dismiss anything for past dates
      expect(Notifications.dismissNotificationAsync).not.toHaveBeenCalled();
    });

    it('should not dismiss notifications when logging a future date', async () => {
      await dailyCheckinService.cancelAndDismissForDate('2099-12-31');

      // Should not dismiss anything for future dates
      expect(Notifications.dismissNotificationAsync).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockRejectedValue(
        new Error('Failed to get notifications')
      );

      await expect(dailyCheckinService.cancelAndDismissForDate(todayStr)).resolves.not.toThrow();
    });
  });
});
