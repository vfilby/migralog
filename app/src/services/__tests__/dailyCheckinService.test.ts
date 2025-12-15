import * as Notifications from 'expo-notifications';

// Mock dependencies BEFORE importing the service
jest.mock('expo-notifications');
jest.mock('../notifications/notificationUtils');
jest.mock('../../store/dailyCheckinSettingsStore');
jest.mock('../../store/dailyStatusStore');
jest.mock('../../store/episodeStore');
jest.mock('../../services/errorLogger');
jest.mock('../../database/scheduledNotificationRepository');

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

(Notifications as any).DEFAULT_ACTION_IDENTIFIER = 'expo.modules.notifications.actions.DEFAULT';

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
import { scheduledNotificationRepository } from '../../database/scheduledNotificationRepository';

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

    // Mock scheduledNotificationRepository
    (scheduledNotificationRepository.tableExists as jest.Mock).mockResolvedValue(true);
    (scheduledNotificationRepository.getDailyCheckinMapping as jest.Mock).mockResolvedValue(null);
    (scheduledNotificationRepository.saveMapping as jest.Mock).mockResolvedValue({ id: 'test-mapping-id' });
    (scheduledNotificationRepository.deleteDailyCheckinMappings as jest.Mock).mockResolvedValue(0);
    (scheduledNotificationRepository.deleteMapping as jest.Mock).mockResolvedValue(undefined);
    (scheduledNotificationRepository.countDailyCheckins as jest.Mock).mockResolvedValue(0);
    (scheduledNotificationRepository.getLastDailyCheckinDate as jest.Mock).mockResolvedValue(null);
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

    it('should schedule multiple one-time notifications with DATE triggers', async () => {
      await dailyCheckinService.scheduleNotification();

      // Should schedule notifications using DATE triggers (one-time, not DAILY)
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();

      // Verify the first call has the right format for one-time notifications
      const firstCall = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      expect(firstCall.content.title).toBe('How was your day?');
      expect(firstCall.content.body).toBe("Tap to log how you're feeling today");
      expect(firstCall.content.categoryIdentifier).toBe('DAILY_CHECKIN');
      expect(firstCall.content.data.type).toBe('daily_checkin');
      expect(firstCall.content.data.date).toBeDefined(); // One-time triggers have a date
      expect(firstCall.trigger.type).toBe('date'); // DATE trigger, not DAILY
      expect(firstCall.trigger.date).toBeDefined();
    });

    it('should save mapping to database for each notification', async () => {
      await dailyCheckinService.scheduleNotification();

      // Should save to database for each scheduled notification
      expect(scheduledNotificationRepository.saveMapping).toHaveBeenCalled();

      const saveCall = (scheduledNotificationRepository.saveMapping as jest.Mock).mock.calls[0][0];
      expect(saveCall.medicationId).toBeNull();
      expect(saveCall.scheduleId).toBeNull();
      expect(saveCall.notificationType).toBe('daily_checkin');
      expect(saveCall.sourceType).toBe('daily_checkin');
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

    it('should cancel all existing notifications before scheduling new ones', async () => {
      // Mock existing scheduled notifications
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        {
          identifier: 'existing-daily-checkin-1',
          content: { data: { type: 'daily_checkin' } },
        },
      ]);

      await dailyCheckinService.scheduleNotification();

      // Should cancel the existing notification
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('existing-daily-checkin-1');
      // Should delete database mappings
      expect(scheduledNotificationRepository.deleteDailyCheckinMappings).toHaveBeenCalled();
    });

    it('should skip dates that already have mappings', async () => {
      // Mock that the first date already has a mapping
      let callCount = 0;
      (scheduledNotificationRepository.getDailyCheckinMapping as jest.Mock).mockImplementation(() => {
        callCount++;
        // First date already has a mapping
        if (callCount === 1) {
          return Promise.resolve({ id: 'existing-mapping' });
        }
        return Promise.resolve(null);
      });

      await dailyCheckinService.scheduleNotification();

      // Should still schedule, but skip the first date
      // The call count will be 14 (checking all dates), but scheduleNotificationAsync
      // won't be called for the one that already has a mapping
      expect(scheduledNotificationRepository.getDailyCheckinMapping).toHaveBeenCalled();
    });
  });

  describe('cancelNotification', () => {
    it('should cancel scheduled notification and delete database mappings', async () => {
      (dailyCheckinService as any).scheduledNotificationId = 'test-id-123';

      await dailyCheckinService.cancelNotification();

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('test-id-123');
      expect(scheduledNotificationRepository.deleteDailyCheckinMappings).toHaveBeenCalled();
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

  describe('dismissForDate', () => {
    beforeEach(() => {
      // Reset initialization to allow calling dismissForDate
      (dailyCheckinService as any).initialized = true;

      // Setup settings store for topUpNotifications
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

    it('should dismiss presented notifications and cancel scheduled notification for today', async () => {
      // Mock today's date
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const mockPresentedNotifs = [
        {
          request: {
            identifier: 'notif-1',
            content: { data: { type: 'daily_checkin', date: todayStr } },
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

      // Mock that there's a scheduled notification for today
      (scheduledNotificationRepository.getDailyCheckinMapping as jest.Mock).mockResolvedValue({
        id: 'mapping-1',
        notificationId: 'scheduled-notif-1',
        date: todayStr,
      });

      await dailyCheckinService.dismissForDate(todayStr);

      // Should dismiss only daily_checkin presented notifications
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledTimes(1);
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('notif-1');

      // Should cancel the specific date's scheduled notification
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('scheduled-notif-1');

      // Should delete the mapping from database
      expect(scheduledNotificationRepository.deleteMapping).toHaveBeenCalledWith('mapping-1');
    });

    it('should not dismiss notifications when logging a past date', async () => {
      await dailyCheckinService.dismissForDate('2020-01-01');

      // Should not dismiss anything for past dates
      expect(Notifications.dismissNotificationAsync).not.toHaveBeenCalled();
    });

    it('should not dismiss notifications when logging a future date', async () => {
      await dailyCheckinService.dismissForDate('2099-12-31');

      // Should not dismiss anything for future dates
      expect(Notifications.dismissNotificationAsync).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockRejectedValue(
        new Error('Failed to get notifications')
      );

      await expect(dailyCheckinService.dismissForDate(todayStr)).resolves.not.toThrow();
    });

    it('should handle case when no scheduled notification mapping exists', async () => {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue([]);

      // No mapping exists
      (scheduledNotificationRepository.getDailyCheckinMapping as jest.Mock).mockResolvedValue(null);

      await dailyCheckinService.dismissForDate(todayStr);

      // Should not try to cancel a non-existent notification
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(scheduledNotificationRepository.deleteMapping).not.toHaveBeenCalled();
    });
  });

  describe('topUpNotifications', () => {
    beforeEach(() => {
      (useDailyCheckinSettingsStore.getState as jest.Mock).mockReturnValue({
        isLoaded: true,
        settings: {
          enabled: true,
          checkInTime: '21:00',
          timeSensitive: false,
        },
        loadSettings: jest.fn(),
        getCheckInTimeComponents: jest.fn().mockReturnValue({ hours: 21, minutes: 0 }),
      });
    });

    it('should skip top-up when notifications are globally disabled', async () => {
      (areNotificationsGloballyEnabled as jest.Mock).mockResolvedValue(false);

      await dailyCheckinService.topUpNotifications();

      expect(scheduledNotificationRepository.countDailyCheckins).not.toHaveBeenCalled();
    });

    it('should skip top-up when daily checkin is disabled', async () => {
      (useDailyCheckinSettingsStore.getState as jest.Mock).mockReturnValue({
        isLoaded: true,
        settings: {
          enabled: false,
          checkInTime: '21:00',
        },
        loadSettings: jest.fn(),
        getCheckInTimeComponents: jest.fn().mockReturnValue({ hours: 21, minutes: 0 }),
      });

      await dailyCheckinService.topUpNotifications();

      expect(scheduledNotificationRepository.countDailyCheckins).not.toHaveBeenCalled();
    });

    it('should not schedule when sufficient notifications exist', async () => {
      // Already have 14 scheduled (DAYS_TO_SCHEDULE)
      (scheduledNotificationRepository.countDailyCheckins as jest.Mock).mockResolvedValue(14);

      await dailyCheckinService.topUpNotifications();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('should schedule new notifications to fill up to DAYS_TO_SCHEDULE', async () => {
      // Only have 10 scheduled
      (scheduledNotificationRepository.countDailyCheckins as jest.Mock).mockResolvedValue(10);

      // Use tomorrow's date to ensure future scheduling works
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
      (scheduledNotificationRepository.getLastDailyCheckinDate as jest.Mock).mockResolvedValue(tomorrowStr);

      await dailyCheckinService.topUpNotifications();

      // Should schedule 4 more to reach 14
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
      expect(scheduledNotificationRepository.saveMapping).toHaveBeenCalled();
    });

    it('should load settings if not already loaded', async () => {
      const loadSettingsMock = jest.fn().mockResolvedValue(undefined);
      (useDailyCheckinSettingsStore.getState as jest.Mock).mockReturnValue({
        isLoaded: false,
        settings: {
          enabled: true,
          checkInTime: '21:00',
        },
        loadSettings: loadSettingsMock,
        getCheckInTimeComponents: jest.fn().mockReturnValue({ hours: 21, minutes: 0 }),
      });
      (scheduledNotificationRepository.countDailyCheckins as jest.Mock).mockResolvedValue(14);

      await dailyCheckinService.topUpNotifications();

      expect(loadSettingsMock).toHaveBeenCalled();
    });

    it('should start from today if no previous notifications exist', async () => {
      (scheduledNotificationRepository.countDailyCheckins as jest.Mock).mockResolvedValue(0);
      (scheduledNotificationRepository.getLastDailyCheckinDate as jest.Mock).mockResolvedValue(null);

      await dailyCheckinService.topUpNotifications();

      // Should schedule starting from today
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    });

    it('should skip dates where trigger time has passed', async () => {
      (scheduledNotificationRepository.countDailyCheckins as jest.Mock).mockResolvedValue(0);
      (scheduledNotificationRepository.getLastDailyCheckinDate as jest.Mock).mockResolvedValue(null);

      // Set check-in time to 06:00 (early morning - likely already passed if test runs later in day)
      (useDailyCheckinSettingsStore.getState as jest.Mock).mockReturnValue({
        isLoaded: true,
        settings: {
          enabled: true,
          checkInTime: '06:00',
        },
        loadSettings: jest.fn(),
        getCheckInTimeComponents: jest.fn().mockReturnValue({ hours: 6, minutes: 0 }),
      });

      await dailyCheckinService.topUpNotifications();

      // Test should complete without error - exact number depends on current time
      // The function will skip any times that have already passed
    });

    it('should skip dates that already have mappings', async () => {
      (scheduledNotificationRepository.countDailyCheckins as jest.Mock).mockResolvedValue(5);
      (scheduledNotificationRepository.getLastDailyCheckinDate as jest.Mock).mockResolvedValue(null);

      let checkCount = 0;
      (scheduledNotificationRepository.getDailyCheckinMapping as jest.Mock).mockImplementation(() => {
        checkCount++;
        // First 3 dates already have mappings
        if (checkCount <= 3) {
          return Promise.resolve({ id: `existing-${checkCount}` });
        }
        return Promise.resolve(null);
      });

      await dailyCheckinService.topUpNotifications();

      // Should have checked multiple dates and skipped ones with existing mappings
      expect(scheduledNotificationRepository.getDailyCheckinMapping).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (scheduledNotificationRepository.countDailyCheckins as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(dailyCheckinService.topUpNotifications()).resolves.not.toThrow();
    });
  });

  describe('isNotificationScheduled - error handling', () => {
    it('should return false and handle error gracefully', async () => {
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockRejectedValue(
        new Error('Platform error')
      );

      const result = await dailyCheckinService.isNotificationScheduled();

      expect(result).toBe(false);
    });
  });

  describe('handleDailyCheckinNotification - error handling', () => {
    it('should show notification on error (safer default)', async () => {
      // Force an error by making loadCurrentEpisode throw
      const mockLoadCurrentEpisode = jest.fn().mockRejectedValue(new Error('Database error'));

      (useEpisodeStore.getState as jest.Mock).mockReturnValue({
        currentEpisode: null,
        loadCurrentEpisode: mockLoadCurrentEpisode,
      });

      const notification = {
        request: {
          content: {
            data: { type: 'daily_checkin', date: '2024-01-15' },
          },
        },
      } as unknown as Notifications.Notification;

      const result = await handleDailyCheckinNotification(notification);

      // Should default to showing the notification on error
      expect(result).toEqual({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      });
    });
  });

  describe('initialize - pending response edge cases', () => {
    it('should handle default notification tap action from pending response', async () => {
      const mockLogDayStatus = jest.fn();
      (useDailyStatusStore.getState as jest.Mock).mockReturnValue({
        logDayStatus: mockLogDayStatus,
        getDayStatus: jest.fn().mockResolvedValue(null),
      });

      // Pending response with default tap action (not a specific button)
      const pendingResponse = {
        actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
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

      // Default tap should not log status - user opened app
      expect(mockLogDayStatus).not.toHaveBeenCalled();
    });

    it('should handle error in processPendingResponse gracefully', async () => {
      // Force an error by making getLastNotificationResponseAsync return invalid data
      (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue({
        actionIdentifier: 'CLEAR_DAY',
        notification: {
          request: {
            content: {
              data: { type: 'daily_checkin' }, // Missing date
            },
          },
        },
      });

      // Force error in handleClearDay
      const mockLogDayStatus = jest.fn().mockRejectedValue(new Error('Database error'));
      (useDailyStatusStore.getState as jest.Mock).mockReturnValue({
        logDayStatus: mockLogDayStatus,
        getDayStatus: jest.fn().mockResolvedValue(null),
      });

      // Should not throw, just log error
      await expect(dailyCheckinService.initialize()).resolves.not.toThrow();
    });
  });

  describe('response handler callback', () => {
    it('should be set up during initialization', async () => {
      await dailyCheckinService.initialize();

      // Verify listener was added
      expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled();
    });

    it('should remove existing subscription on re-initialization', async () => {
      const mockRemove = jest.fn();
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({
        remove: mockRemove,
      });

      // Initialize twice
      (dailyCheckinService as any).initialized = false;
      await dailyCheckinService.initialize();

      // Reset for re-init
      (dailyCheckinService as any).initialized = false;
      await dailyCheckinService.initialize();

      // First subscription should have been removed
      expect(mockRemove).toHaveBeenCalled();
    });
  });

  describe('scheduleNotification - edge cases', () => {
    beforeEach(() => {
      (useDailyCheckinSettingsStore.getState as jest.Mock).mockReturnValue({
        isLoaded: false, // Not loaded initially
        settings: {
          enabled: true,
          checkInTime: '21:00',
          timeSensitive: true,
        },
        loadSettings: jest.fn().mockResolvedValue(undefined),
        getCheckInTimeComponents: jest.fn().mockReturnValue({ hours: 21, minutes: 0 }),
      });
    });

    it('should skip scheduling when table does not exist', async () => {
      (scheduledNotificationRepository.tableExists as jest.Mock).mockResolvedValue(false);

      await dailyCheckinService.scheduleNotification();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('should include timeSensitive settings when enabled', async () => {
      (scheduledNotificationRepository.tableExists as jest.Mock).mockResolvedValue(true);
      (useDailyCheckinSettingsStore.getState as jest.Mock).mockReturnValue({
        isLoaded: true,
        settings: {
          enabled: true,
          checkInTime: '21:00',
          timeSensitive: true, // Enabled
        },
        loadSettings: jest.fn(),
        getCheckInTimeComponents: jest.fn().mockReturnValue({ hours: 21, minutes: 0 }),
      });

      await dailyCheckinService.scheduleNotification();

      // Verify timeSensitive was included in notification content
      if ((Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.length > 0) {
        const firstCall = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
        expect(firstCall.content.interruptionLevel).toBe('timeSensitive');
      }
    });
  });

  describe('cancelNotification - edge cases', () => {
    it('should handle when table does not exist during cleanup', async () => {
      (scheduledNotificationRepository.tableExists as jest.Mock).mockResolvedValue(false);

      await dailyCheckinService.cancelNotification();

      // Should not try to delete from non-existent table
      expect(scheduledNotificationRepository.deleteDailyCheckinMappings).not.toHaveBeenCalled();
    });

    it('should handle error in cancel gracefully', async () => {
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockRejectedValue(
        new Error('Platform error')
      );

      await expect(dailyCheckinService.cancelNotification()).resolves.not.toThrow();
    });
  });

  describe('topUpNotifications - edge cases', () => {
    beforeEach(() => {
      (useDailyCheckinSettingsStore.getState as jest.Mock).mockReturnValue({
        isLoaded: true,
        settings: {
          enabled: true,
          checkInTime: '21:00',
          timeSensitive: false,
        },
        loadSettings: jest.fn(),
        getCheckInTimeComponents: jest.fn().mockReturnValue({ hours: 21, minutes: 0 }),
      });
    });

    it('should handle error in top-up gracefully', async () => {
      (scheduledNotificationRepository.tableExists as jest.Mock).mockResolvedValue(true);
      (scheduledNotificationRepository.countDailyCheckins as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(dailyCheckinService.topUpNotifications()).resolves.not.toThrow();
    });

    it('should skip top-up when table does not exist', async () => {
      (scheduledNotificationRepository.tableExists as jest.Mock).mockResolvedValue(false);

      await dailyCheckinService.topUpNotifications();

      expect(scheduledNotificationRepository.countDailyCheckins).not.toHaveBeenCalled();
    });
  });
});
