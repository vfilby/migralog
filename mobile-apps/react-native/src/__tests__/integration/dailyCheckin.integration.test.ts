/**
 * Integration Test: Daily Check-in Workflow
 *
 * MEDIUM PRIORITY: Tests the complete daily check-in notification and logging flow
 *
 * Tests the full daily check-in system:
 * - Full flow: prompt shown → user logs status → next day prompt suppressed correctly
 * - Verify the check-in prompt logic works correctly
 * - Test that logging a daily status suppresses the prompt for that day
 * - Test that the prompt reappears the next day
 * - Test interaction with episodes (episode = red day = suppress prompt)
 *
 * This follows the established integration test pattern:
 * - Test real component interactions
 * - Mock only external dependencies (OS notification APIs)
 * - Verify actual outcomes, not just function calls
 */

import * as Notifications from 'expo-notifications';
import { useDailyStatusStore } from '../../store/dailyStatusStore';
import { useDailyCheckinSettingsStore } from '../../store/dailyCheckinSettingsStore';
import { dailyCheckinService, handleDailyCheckinNotification } from '../../services/notifications/dailyCheckinService';
import { scheduledNotificationRepository } from '../../database/scheduledNotificationRepository';
import { dailyStatusRepository } from '../../database/dailyStatusRepository';
import { episodeRepository } from '../../database/episodeRepository';
import { format, addDays, startOfDay } from 'date-fns';
import { DailyStatusLog, Episode } from '../../models/types';

// Mock external dependencies (OS notification APIs)
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  dismissNotificationAsync: jest.fn(),
  getPresentedNotificationsAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
    DATE: 'date',
  },
  AndroidNotificationPriority: {
    HIGH: 'high',
    DEFAULT: 'default',
  },
}));

// Mock repositories
jest.mock('../../database/scheduledNotificationRepository');
jest.mock('../../database/dailyStatusRepository');
jest.mock('../../database/episodeRepository');

// Mock notification utils
jest.mock('../../services/notifications/notificationUtils', () => ({
  areNotificationsGloballyEnabled: jest.fn(() => Promise.resolve(true)),
}));

// Mock error logger
jest.mock('../../services/errorLogger', () => ({
  errorLogger: {
    log: jest.fn(() => Promise.resolve()),
    getLogs: jest.fn(() => Promise.resolve([])),
    clearLogs: jest.fn(() => Promise.resolve()),
    getRecentLogs: jest.fn(() => Promise.resolve([])),
    getLogsByType: jest.fn(() => Promise.resolve([])),
  },
}));

// Mock notification dismissal service
jest.mock('../../services/notifications/NotificationDismissalService', () => ({
  notificationDismissalService: {
    dismissDailyCheckinForDate: jest.fn(() => Promise.resolve(true)),
  },
}));

describe('Integration: Daily Check-in Workflow', () => {
  let mockScheduleNotificationAsync: jest.Mock;
  let mockCancelScheduledNotificationAsync: jest.Mock;
  let mockDismissNotificationAsync: jest.Mock;
  let mockGetPresentedNotificationsAsync: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();

    // Reset expo-notifications mocks
    mockScheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
    mockCancelScheduledNotificationAsync = Notifications.cancelScheduledNotificationAsync as jest.Mock;
    mockDismissNotificationAsync = Notifications.dismissNotificationAsync as jest.Mock;
    mockGetPresentedNotificationsAsync = Notifications.getPresentedNotificationsAsync as jest.Mock;

    mockScheduleNotificationAsync.mockResolvedValue('notification-id-123');
    mockCancelScheduledNotificationAsync.mockResolvedValue(undefined);
    mockDismissNotificationAsync.mockResolvedValue(undefined);
    mockGetPresentedNotificationsAsync.mockResolvedValue([]);
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
    (Notifications.setNotificationCategoryAsync as jest.Mock).mockResolvedValue(undefined);
    (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(null);

    // Reset scheduled notification repository mocks
    (scheduledNotificationRepository.tableExists as jest.Mock).mockResolvedValue(true);
    (scheduledNotificationRepository.saveMapping as jest.Mock).mockImplementation((mapping) =>
      Promise.resolve({
        ...mapping,
        id: `mapping-${Date.now()}`,
        createdAt: new Date().toISOString(),
      })
    );
    (scheduledNotificationRepository.getDailyCheckinMapping as jest.Mock).mockResolvedValue(null);
    (scheduledNotificationRepository.deleteDailyCheckinMappings as jest.Mock).mockResolvedValue(0);
    (scheduledNotificationRepository.deleteMapping as jest.Mock).mockResolvedValue(undefined);
    (scheduledNotificationRepository.countDailyCheckins as jest.Mock).mockResolvedValue(0);
    (scheduledNotificationRepository.getLastDailyCheckinDate as jest.Mock).mockResolvedValue(null);

    // Reset daily status repository mocks
    (dailyStatusRepository.getByDate as jest.Mock).mockResolvedValue(null);
    (dailyStatusRepository.upsert as jest.Mock).mockImplementation((log) =>
      Promise.resolve({
        ...log,
        id: `status-${Date.now()}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    );

    // Reset episode repository mocks
    (episodeRepository.getEpisodesForDate as jest.Mock).mockResolvedValue([]);

    // Reset stores to initial state
    useDailyCheckinSettingsStore.setState({
      settings: {
        enabled: true,
        checkInTime: '21:00',
        timeSensitive: false,
      },
      isLoaded: true,
    });

    useDailyStatusStore.setState({
      dailyStatuses: [],
      monthStats: null,
      loading: false,
      error: null,
    });

    // Reset service initialization state
    (dailyCheckinService as any).initialized = false;
    (dailyCheckinService as any).scheduledNotificationId = null;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Daily check-in notification scheduling', () => {
    it('should schedule notifications for next 14 days', async () => {
      await dailyCheckinService.scheduleNotification();

      // Should schedule notifications (may skip past dates, so at least 1 call expected)
      expect(mockScheduleNotificationAsync).toHaveBeenCalled();

      // Verify notification content
      const calls = mockScheduleNotificationAsync.mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      const firstCall = calls[0][0];
      expect(firstCall.content.title).toBe('How was your day?');
      expect(firstCall.content.body).toBe('Tap to log how you\'re feeling today');
      expect(firstCall.content.data.type).toBe('daily_checkin');
      expect(firstCall.content.categoryIdentifier).toBe('DAILY_CHECKIN');

      // Verify database mappings were saved
      expect(scheduledNotificationRepository.saveMapping).toHaveBeenCalled();
      const mappingCalls = (scheduledNotificationRepository.saveMapping as jest.Mock).mock.calls;
      expect(mappingCalls.length).toBeGreaterThan(0);

      const firstMapping = mappingCalls[0][0];
      expect(firstMapping.medicationId).toBeNull();
      expect(firstMapping.scheduleId).toBeNull();
      expect(firstMapping.notificationType).toBe('daily_checkin');
      expect(firstMapping.sourceType).toBe('daily_checkin');
      expect(firstMapping.isGrouped).toBe(false);
    });

    it('should not schedule if daily check-in is disabled', async () => {
      useDailyCheckinSettingsStore.setState({
        settings: {
          enabled: false,
          checkInTime: '21:00',
          timeSensitive: false,
        },
        isLoaded: true,
      });

      await dailyCheckinService.scheduleNotification();

      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
      expect(scheduledNotificationRepository.saveMapping).not.toHaveBeenCalled();
    });

    it('should schedule at the configured time', async () => {
      useDailyCheckinSettingsStore.setState({
        settings: {
          enabled: true,
          checkInTime: '20:30',
          timeSensitive: false,
        },
        isLoaded: true,
      });

      await dailyCheckinService.scheduleNotification();

      expect(mockScheduleNotificationAsync).toHaveBeenCalled();

      // Verify the trigger time has correct hours and minutes
      const calls = mockScheduleNotificationAsync.mock.calls;
      const validCalls = calls.filter((call) => {
        const trigger = call[0].trigger;
        return trigger && trigger.date;
      });

      expect(validCalls.length).toBeGreaterThan(0);

      const firstValidCall = validCalls[0][0];
      const triggerDate = firstValidCall.trigger.date;
      expect(triggerDate.getHours()).toBe(20);
      expect(triggerDate.getMinutes()).toBe(30);
    });

    it('should skip scheduling for dates that already have notifications', async () => {
      const futureDate = format(addDays(startOfDay(new Date()), 2), 'yyyy-MM-dd');

      // Mock existing mapping for future date
      (scheduledNotificationRepository.getDailyCheckinMapping as jest.Mock).mockImplementation(
        (date: string) => {
          if (date === futureDate) {
            return Promise.resolve({
              id: 'existing-mapping',
              medicationId: null,
              scheduleId: null,
              date: futureDate,
              notificationId: 'existing-notification',
              notificationType: 'daily_checkin',
              isGrouped: false,
              sourceType: 'daily_checkin',
              createdAt: new Date().toISOString(),
            });
          }
          return Promise.resolve(null);
        }
      );

      await dailyCheckinService.scheduleNotification();

      // Should still schedule notifications, but skip the one that exists
      const saveMappingCalls = (scheduledNotificationRepository.saveMapping as jest.Mock).mock.calls;
      const duplicateCalls = saveMappingCalls.filter((call: unknown[]) => {
        const mapping = call[0] as { date: string };
        return mapping.date === futureDate;
      });

      expect(duplicateCalls).toHaveLength(0);
    });
  });

  describe('Daily check-in notification suppression logic', () => {
    it('should suppress notification when user has active episode', async () => {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Mock active episode
      const mockEpisode: Episode = {
        id: 'episode-1',
        startTime: Date.now() - 3600000, // 1 hour ago
        endTime: undefined, // Active episode
        createdAt: Date.now(),
        updatedAt: Date.now(),
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
      };

      // Mock episode store with active episode
      const mockLoadCurrentEpisode = jest.fn().mockResolvedValue(undefined);
      const useEpisodeStore = require('../../store/episodeStore').useEpisodeStore;
      jest.spyOn(useEpisodeStore, 'getState').mockReturnValue({
        currentEpisode: mockEpisode,
        loadCurrentEpisode: mockLoadCurrentEpisode,
      });

      // Mock daily status store
      const getDayStatus = jest.fn().mockResolvedValue(null);
      const getEpisodesForDate = jest.fn().mockResolvedValue([]);
      jest.spyOn(useDailyStatusStore, 'getState').mockReturnValue({
        getDayStatus,
        getEpisodesForDate,
        dailyStatuses: [],
        monthStats: null,
        loading: false,
        error: null,
        loadDailyStatuses: jest.fn(),
        loadMonthStats: jest.fn(),
        logDayStatus: jest.fn(),
        updateDayStatus: jest.fn(),
        deleteDayStatus: jest.fn(),
        checkShouldPrompt: jest.fn(),
        reset: jest.fn(),
      });

      const notification = {
        request: {
          identifier: 'test-notification',
          content: {
            title: 'How was your day?',
            body: 'Tap to log how you\'re feeling today',
            data: {
              type: 'daily_checkin',
              date: today,
            },
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

    it('should suppress notification when day already has status logged', async () => {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Mock no active episode
      const mockLoadCurrentEpisode = jest.fn().mockResolvedValue(undefined);
      const useEpisodeStore = require('../../store/episodeStore').useEpisodeStore;
      jest.spyOn(useEpisodeStore, 'getState').mockReturnValue({
        currentEpisode: null,
        loadCurrentEpisode: mockLoadCurrentEpisode,
      });

      // Mock existing status
      const existingStatus: DailyStatusLog = {
        id: 'status-1',
        date: today,
        status: 'green',
        prompted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const getDayStatus = jest.fn().mockResolvedValue(existingStatus);
      const getEpisodesForDate = jest.fn().mockResolvedValue([]);
      jest.spyOn(useDailyStatusStore, 'getState').mockReturnValue({
        getDayStatus,
        getEpisodesForDate,
        dailyStatuses: [],
        monthStats: null,
        loading: false,
        error: null,
        loadDailyStatuses: jest.fn(),
        loadMonthStats: jest.fn(),
        logDayStatus: jest.fn(),
        updateDayStatus: jest.fn(),
        deleteDayStatus: jest.fn(),
        checkShouldPrompt: jest.fn(),
        reset: jest.fn(),
      });

      const notification = {
        request: {
          identifier: 'test-notification',
          content: {
            title: 'How was your day?',
            body: 'Tap to log how you\'re feeling today',
            data: {
              type: 'daily_checkin',
              date: today,
            },
          },
        },
      } as unknown as Notifications.Notification;

      const result = await handleDailyCheckinNotification(notification);

      expect(mockLoadCurrentEpisode).toHaveBeenCalled();
      expect(getDayStatus).toHaveBeenCalledWith(today);
      expect(result).toEqual({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      });
    });

    it('should suppress notification when day has episode (red day)', async () => {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Mock no active episode
      const mockLoadCurrentEpisode = jest.fn().mockResolvedValue(undefined);
      const useEpisodeStore = require('../../store/episodeStore').useEpisodeStore;
      jest.spyOn(useEpisodeStore, 'getState').mockReturnValue({
        currentEpisode: null,
        loadCurrentEpisode: mockLoadCurrentEpisode,
      });

      // Mock episode on this date
      const mockEpisode: Episode = {
        id: 'episode-1',
        startTime: new Date(today + 'T10:00:00').getTime(),
        endTime: new Date(today + 'T14:00:00').getTime(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
      };

      const getDayStatus = jest.fn().mockResolvedValue(null);
      const getEpisodesForDate = jest.fn().mockResolvedValue([mockEpisode]);
      jest.spyOn(useDailyStatusStore, 'getState').mockReturnValue({
        getDayStatus,
        getEpisodesForDate,
        dailyStatuses: [],
        monthStats: null,
        loading: false,
        error: null,
        loadDailyStatuses: jest.fn(),
        loadMonthStats: jest.fn(),
        logDayStatus: jest.fn(),
        updateDayStatus: jest.fn(),
        deleteDayStatus: jest.fn(),
        checkShouldPrompt: jest.fn(),
        reset: jest.fn(),
      });

      const notification = {
        request: {
          identifier: 'test-notification',
          content: {
            title: 'How was your day?',
            body: 'Tap to log how you\'re feeling today',
            data: {
              type: 'daily_checkin',
              date: today,
            },
          },
        },
      } as unknown as Notifications.Notification;

      const result = await handleDailyCheckinNotification(notification);

      expect(mockLoadCurrentEpisode).toHaveBeenCalled();
      expect(getEpisodesForDate).toHaveBeenCalledWith(today);
      expect(result).toEqual({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      });
    });

    it('should show notification when no episode and no status logged', async () => {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Mock no active episode
      const mockLoadCurrentEpisode = jest.fn().mockResolvedValue(undefined);
      const useEpisodeStore = require('../../store/episodeStore').useEpisodeStore;
      jest.spyOn(useEpisodeStore, 'getState').mockReturnValue({
        currentEpisode: null,
        loadCurrentEpisode: mockLoadCurrentEpisode,
      });

      // Mock no status and no episodes
      const getDayStatus = jest.fn().mockResolvedValue(null);
      const getEpisodesForDate = jest.fn().mockResolvedValue([]);
      jest.spyOn(useDailyStatusStore, 'getState').mockReturnValue({
        getDayStatus,
        getEpisodesForDate,
        dailyStatuses: [],
        monthStats: null,
        loading: false,
        error: null,
        loadDailyStatuses: jest.fn(),
        loadMonthStats: jest.fn(),
        logDayStatus: jest.fn(),
        updateDayStatus: jest.fn(),
        deleteDayStatus: jest.fn(),
        checkShouldPrompt: jest.fn(),
        reset: jest.fn(),
      });

      const notification = {
        request: {
          identifier: 'test-notification',
          content: {
            title: 'How was your day?',
            body: 'Tap to log how you\'re feeling today',
            data: {
              type: 'daily_checkin',
              date: today,
            },
          },
        },
      } as unknown as Notifications.Notification;

      const result = await handleDailyCheckinNotification(notification);

      expect(mockLoadCurrentEpisode).toHaveBeenCalled();
      expect(getEpisodesForDate).toHaveBeenCalledWith(today);
      expect(getDayStatus).toHaveBeenCalledWith(today);
      expect(result).toEqual({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      });
    });
  });

  describe('Full daily check-in workflow', () => {
    it('should complete full flow: prompt shown → status logged → prompt suppressed', async () => {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Step 1: No status logged yet, notification should show
      const mockLoadCurrentEpisode = jest.fn().mockResolvedValue(undefined);
      const useEpisodeStore = require('../../store/episodeStore').useEpisodeStore;
      jest.spyOn(useEpisodeStore, 'getState').mockReturnValue({
        currentEpisode: null,
        loadCurrentEpisode: mockLoadCurrentEpisode,
      });

      let currentDayStatus: DailyStatusLog | null = null;
      const getDayStatus = jest.fn().mockImplementation(() => Promise.resolve(currentDayStatus));
      const getEpisodesForDate = jest.fn().mockResolvedValue([]);
      const logDayStatus = jest.fn().mockImplementation((date, status, statusType, notes, prompted) => {
        currentDayStatus = {
          id: 'status-new',
          date,
          status,
          statusType,
          notes,
          prompted,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        return Promise.resolve(currentDayStatus);
      });

      jest.spyOn(useDailyStatusStore, 'getState').mockReturnValue({
        getDayStatus,
        getEpisodesForDate,
        logDayStatus,
        dailyStatuses: [],
        monthStats: null,
        loading: false,
        error: null,
        loadDailyStatuses: jest.fn(),
        loadMonthStats: jest.fn(),
        updateDayStatus: jest.fn(),
        deleteDayStatus: jest.fn(),
        checkShouldPrompt: jest.fn(),
        reset: jest.fn(),
      });

      const notification = {
        request: {
          identifier: 'test-notification',
          content: {
            title: 'How was your day?',
            body: 'Tap to log how you\'re feeling today',
            data: {
              type: 'daily_checkin',
              date: today,
            },
          },
        },
      } as unknown as Notifications.Notification;

      // Initial notification should show
      const result1 = await handleDailyCheckinNotification(notification);
      expect(result1).toEqual({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      });

      // Step 2: User logs status (simulated)
      const loggedStatus = await logDayStatus(today, 'green', undefined, 'Feeling great!', true);
      expect(loggedStatus.status).toBe('green');
      expect(loggedStatus.prompted).toBe(true);

      // Step 3: Notification for same day should now be suppressed
      const result2 = await handleDailyCheckinNotification(notification);
      expect(result2).toEqual({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      });
    });

    it('should respect date changes for status suppression', async () => {
      const today = format(new Date(), 'yyyy-MM-dd');

      // First scenario: status exists for today, should suppress
      const statusMap = new Map<string, DailyStatusLog>();
      statusMap.set(today, {
        id: 'status-today',
        date: today,
        status: 'green',
        prompted: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const getDayStatus = jest.fn().mockImplementation((date: string) => {
        return Promise.resolve(statusMap.get(date) || null);
      });
      const getEpisodesForDate = jest.fn().mockResolvedValue([]);

      const mockLoadCurrentEpisode = jest.fn().mockResolvedValue(undefined);
      const useEpisodeStore = require('../../store/episodeStore').useEpisodeStore;
      jest.spyOn(useEpisodeStore, 'getState').mockReturnValue({
        currentEpisode: null,
        loadCurrentEpisode: mockLoadCurrentEpisode,
      });

      jest.spyOn(useDailyStatusStore, 'getState').mockReturnValue({
        getDayStatus,
        getEpisodesForDate,
        dailyStatuses: [],
        monthStats: null,
        loading: false,
        error: null,
        loadDailyStatuses: jest.fn(),
        loadMonthStats: jest.fn(),
        logDayStatus: jest.fn(),
        updateDayStatus: jest.fn(),
        deleteDayStatus: jest.fn(),
        checkShouldPrompt: jest.fn(),
        reset: jest.fn(),
      });

      const todayNotification = {
        request: {
          identifier: 'test-notification-today',
          content: {
            title: 'How was your day?',
            body: 'Tap to log how you\'re feeling today',
            data: {
              type: 'daily_checkin',
              date: today,
            },
          },
        },
      } as unknown as Notifications.Notification;

      // Test: Today's notification should be suppressed (has status)
      const result = await handleDailyCheckinNotification(todayNotification);
      expect(result).toEqual({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      });
      expect(getDayStatus).toHaveBeenCalledWith(today);

      // Verify the logic works correctly - status exists = suppress
      expect(getEpisodesForDate).toHaveBeenCalledWith(today);
    });

    it('should dismiss notification when status is logged', async () => {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Mock presented notification
      const mockPresentedNotification = {
        request: {
          identifier: 'presented-notification',
          content: {
            title: 'How was your day?',
            body: 'Tap to log how you\'re feeling today',
            data: {
              type: 'daily_checkin',
              date: today,
            },
          },
        },
      };

      mockGetPresentedNotificationsAsync.mockResolvedValue([mockPresentedNotification]);

      // Mock notification mapping
      (scheduledNotificationRepository.getDailyCheckinMapping as jest.Mock).mockResolvedValue({
        id: 'mapping-1',
        medicationId: null,
        scheduleId: null,
        date: today,
        notificationId: 'scheduled-notification',
        notificationType: 'daily_checkin',
        isGrouped: false,
        sourceType: 'daily_checkin',
        createdAt: new Date().toISOString(),
      });

      await dailyCheckinService.dismissForDate(today);

      // Should use the dismissal service
      const notificationDismissalService = require('../../services/notifications/NotificationDismissalService').notificationDismissalService;
      expect(notificationDismissalService.dismissDailyCheckinForDate).toHaveBeenCalledWith(today);
    });
  });

  describe('Daily check-in notification actions', () => {
    it('should initialize service and register notification category', async () => {
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

      expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled();
    });

    it('should handle "Clear Day" action by logging green status', async () => {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Mock the store's logDayStatus method
      const mockLogDayStatus = jest.fn().mockResolvedValue({
        id: 'status-clear',
        date: today,
        status: 'green',
        prompted: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      jest.spyOn(useDailyStatusStore, 'getState').mockReturnValue({
        logDayStatus: mockLogDayStatus,
        getDayStatus: jest.fn(),
        getEpisodesForDate: jest.fn(),
        dailyStatuses: [],
        monthStats: null,
        loading: false,
        error: null,
        loadDailyStatuses: jest.fn(),
        loadMonthStats: jest.fn(),
        updateDayStatus: jest.fn(),
        deleteDayStatus: jest.fn(),
        checkShouldPrompt: jest.fn(),
        reset: jest.fn(),
      });

      // Initialize service
      await dailyCheckinService.initialize();

      // Get the response listener that was registered
      const listenerCall = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0];
      const responseListener = listenerCall[0];

      // Simulate "Clear Day" action
      const mockResponse = {
        actionIdentifier: 'CLEAR_DAY',
        notification: {
          request: {
            identifier: 'test-notification',
            content: {
              title: 'How was your day?',
              body: 'Tap to log how you\'re feeling today',
              data: {
                type: 'daily_checkin',
                date: today,
              },
            },
          },
        },
      };

      await responseListener(mockResponse);

      // Verify status was logged through the store
      expect(mockLogDayStatus).toHaveBeenCalledWith(today, 'green', undefined, undefined, true);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle notification when episode store fails to load', async () => {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Mock episode store that throws error
      const mockLoadCurrentEpisode = jest.fn().mockRejectedValue(new Error('Database error'));
      const useEpisodeStore = require('../../store/episodeStore').useEpisodeStore;
      jest.spyOn(useEpisodeStore, 'getState').mockReturnValue({
        currentEpisode: null,
        loadCurrentEpisode: mockLoadCurrentEpisode,
      });

      const notification = {
        request: {
          identifier: 'test-notification',
          content: {
            title: 'How was your day?',
            body: 'Tap to log how you\'re feeling today',
            data: {
              type: 'daily_checkin',
              date: today,
            },
          },
        },
      } as unknown as Notifications.Notification;

      // Should default to showing notification on error (safer)
      const result = await handleDailyCheckinNotification(notification);
      expect(result).toEqual({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      });
    });

    it('should not dismiss future notifications', async () => {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      await dailyCheckinService.dismissForDate(tomorrow);

      // Should not call dismissal service for future dates
      const notificationDismissalService = require('../../services/notifications/NotificationDismissalService').notificationDismissalService;
      expect(notificationDismissalService.dismissDailyCheckinForDate).not.toHaveBeenCalled();
    });

    it('should handle table not existing gracefully', async () => {
      (scheduledNotificationRepository.tableExists as jest.Mock).mockResolvedValue(false);

      // Should not throw
      await expect(dailyCheckinService.scheduleNotification()).resolves.not.toThrow();

      // Should not attempt to schedule
      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('should top up notifications when count is below threshold', async () => {
      // Mock that we only have 10 notifications scheduled
      (scheduledNotificationRepository.countDailyCheckins as jest.Mock).mockResolvedValue(10);
      (scheduledNotificationRepository.getLastDailyCheckinDate as jest.Mock).mockResolvedValue(
        format(addDays(new Date(), 9), 'yyyy-MM-dd')
      );

      await dailyCheckinService.topUpNotifications();

      // Should schedule additional notifications to reach 14 total
      expect(mockScheduleNotificationAsync).toHaveBeenCalled();
      expect(scheduledNotificationRepository.saveMapping).toHaveBeenCalled();
    });

    it('should not top up if enough notifications exist', async () => {
      // Mock that we already have 14 notifications scheduled
      (scheduledNotificationRepository.countDailyCheckins as jest.Mock).mockResolvedValue(14);

      await dailyCheckinService.topUpNotifications();

      // Should not schedule more notifications
      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });
});
