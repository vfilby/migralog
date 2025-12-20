/**
 * Notification Actions Integration Tests
 *
 * These tests verify the end-to-end flow of notification actions,
 * testing the interaction between handlers and cancellation logic.
 *
 * Unlike unit tests that mock internal dependencies, these tests
 * only mock external dependencies (OS notifications, database)
 * and verify that the full action flow works correctly.
 */

import * as Notifications from 'expo-notifications';

// Mock external dependencies only
jest.mock('expo-notifications');
jest.mock('../../database/medicationRepository');
jest.mock('../../database/scheduledNotificationRepository');
jest.mock('../../services/errorLogger');
jest.mock('../../store/medicationStore');
jest.mock('../../store/notificationSettingsStore');
jest.mock('../../utils/logger');
jest.mock('../notifications/errorNotificationHelper');
jest.mock('../notifications/notificationScheduler');
jest.mock('../notifications/NotificationDismissalService');

// Setup Notifications mock before imports
(Notifications as any).AndroidNotificationPriority = {
  MIN: -2,
  LOW: -1,
  DEFAULT: 0,
  HIGH: 1,
  MAX: 2,
};

(Notifications as any).SchedulableTriggerInputTypes = {
  DAILY: 'daily',
  DATE: 'date',
  CALENDAR: 'calendar',
};

(Notifications.getAllScheduledNotificationsAsync as jest.Mock) = jest.fn();
(Notifications.cancelScheduledNotificationAsync as jest.Mock) = jest.fn();
(Notifications.scheduleNotificationAsync as jest.Mock) = jest.fn();
(Notifications.getPresentedNotificationsAsync as jest.Mock) = jest.fn();
(Notifications.dismissNotificationAsync as jest.Mock) = jest.fn();

import { useMedicationStore } from '../../store/medicationStore';
import { scheduledNotificationRepository } from '../../database/scheduledNotificationRepository';
import { medicationRepository } from '../../database/medicationRepository';
import { useNotificationSettingsStore } from '../../store/notificationSettingsStore';
import { scheduleNotificationAtomic } from '../notifications/notificationScheduler';
import { notificationDismissalService } from '../notifications/NotificationDismissalService';
import {
  handleSkip,
  handleSkipAll,
  cancelNotificationForDate,
} from '../notifications/medicationNotifications';

describe('Notification Actions Integration', () => {
  let mockMedicationStore: any;
  let loggedDoses: any[];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    loggedDoses = [];

    // Set up a realistic medication store that tracks logged doses
    mockMedicationStore = {
      loadMedicationWithDetails: jest.fn(),
      logDose: jest.fn().mockImplementation((dose) => {
        loggedDoses.push(dose);
        return Promise.resolve({ id: `dose-${Date.now()}` });
      }),
    };
    (useMedicationStore.getState as jest.Mock) = jest.fn(() => mockMedicationStore);

    // Default notification settings
    (useNotificationSettingsStore.getState as jest.Mock).mockReturnValue({
      getEffectiveSettings: jest.fn().mockReturnValue({
        timeSensitiveEnabled: false,
        followUpDelay: 'off',
        criticalAlertsEnabled: false,
      }),
    });

    // Default repository behavior
    (scheduledNotificationRepository.tableExists as jest.Mock).mockResolvedValue(true);
    (scheduledNotificationRepository.getMapping as jest.Mock).mockResolvedValue(null);
    (scheduledNotificationRepository.saveMapping as jest.Mock).mockResolvedValue({ id: 'mapping-id' });
    (scheduledNotificationRepository.deleteMapping as jest.Mock).mockResolvedValue(undefined);
    (scheduledNotificationRepository.getAllMappings as jest.Mock).mockResolvedValue([]);
    (scheduledNotificationRepository.getMappingsByGroupKey as jest.Mock).mockResolvedValue([]);

    (medicationRepository.getById as jest.Mock).mockResolvedValue(null);

    // Default notification behavior
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
    (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockResolvedValue(undefined);
    (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue([]);
    (Notifications.dismissNotificationAsync as jest.Mock).mockResolvedValue(undefined);

    (notificationDismissalService.shouldDismissNotification as jest.Mock).mockResolvedValue({
      shouldDismiss: false,
      strategy: 'none',
      confidence: 'low',
      context: {},
    });

    (scheduleNotificationAtomic as jest.Mock).mockResolvedValue({ id: 'new-mapping' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Skip Action Flow', () => {
    it('should record skipped dose with correct status and quantity', async () => {
      // Setup: A medication exists
      const medication = {
        id: 'med-123',
        name: 'Aspirin',
        dosageAmount: 500,
        dosageUnit: 'mg',
      };

      mockMedicationStore.loadMedicationWithDetails.mockResolvedValue({
        medication,
        schedules: [{ id: 'sched-1', time: '09:00', dosage: 1 }],
      });

      // Action: User skips the medication from notification
      const result = await handleSkip('med-123', 'sched-1');

      // Verify: Skip was successful
      expect(result).toBe(true);

      // Verify: Dose was recorded with skipped status
      expect(loggedDoses).toHaveLength(1);
      expect(loggedDoses[0]).toMatchObject({
        medicationId: 'med-123',
        scheduleId: 'sched-1',
        status: 'skipped',
        quantity: 0,
        dosageAmount: 500,
        dosageUnit: 'mg',
        notes: 'Skipped from notification',
      });
    });

    it('should skip multiple medications in a grouped notification', async () => {
      // Setup: Two medications in a grouped notification
      const med1 = { id: 'med-1', name: 'Aspirin', dosageAmount: 500, dosageUnit: 'mg' };
      const med2 = { id: 'med-2', name: 'Ibuprofen', dosageAmount: 400, dosageUnit: 'mg' };

      mockMedicationStore.loadMedicationWithDetails
        .mockResolvedValueOnce({
          medication: med1,
          schedules: [{ id: 'sched-1', time: '09:00', dosage: 1 }],
        })
        .mockResolvedValueOnce({
          medication: med2,
          schedules: [{ id: 'sched-2', time: '09:00', dosage: 2 }],
        });

      // Action: User skips all medications
      const result = await handleSkipAll({
        medicationIds: ['med-1', 'med-2'],
        scheduleIds: ['sched-1', 'sched-2'],
        time: '09:00',
      });

      // Verify: Both medications were skipped
      expect(result).toEqual({ success: 2, total: 2 });
      expect(loggedDoses).toHaveLength(2);

      // Verify: Each dose has correct skipped status
      expect(loggedDoses[0]).toMatchObject({
        medicationId: 'med-1',
        status: 'skipped',
        quantity: 0,
      });
      expect(loggedDoses[1]).toMatchObject({
        medicationId: 'med-2',
        status: 'skipped',
        quantity: 0,
      });
    });

    it('should continue skipping remaining medications when one fails', async () => {
      // Setup: First medication fails, second succeeds
      const med2 = { id: 'med-2', name: 'Ibuprofen', dosageAmount: 400, dosageUnit: 'mg' };

      mockMedicationStore.loadMedicationWithDetails
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({
          medication: med2,
          schedules: [{ id: 'sched-2', time: '09:00', dosage: 1 }],
        });

      // Action: User skips all medications
      const result = await handleSkipAll({
        medicationIds: ['med-1', 'med-2'],
        scheduleIds: ['sched-1', 'sched-2'],
        time: '09:00',
      });

      // Verify: Partial success
      expect(result).toEqual({ success: 1, total: 2 });
      expect(loggedDoses).toHaveLength(1);
      expect(loggedDoses[0].medicationId).toBe('med-2');
    });
  });

  describe('Grouped Notification Cancellation Flow', () => {
    it('should preserve other notification types when cancelling one type', async () => {
      // This test verifies the fix for the bug where cancelling a reminder
      // would incorrectly affect follow_up notifications for the same medication

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      // Setup: Grouped notification with mixed types
      // - med-1 has both reminder AND follow_up scheduled
      // - med-2 has only reminder scheduled
      const groupMappings = [
        {
          id: 'mapping-1',
          medicationId: 'med-1',
          scheduleId: 'sched-1',
          notificationId: 'group-notif',
          isGrouped: true,
          groupKey: '09:00',
          notificationType: 'reminder',
          date: futureDateStr,
        },
        {
          id: 'mapping-2',
          medicationId: 'med-1',
          scheduleId: 'sched-1',
          notificationId: 'group-notif',
          isGrouped: true,
          groupKey: '09:00',
          notificationType: 'follow_up', // Different type - should NOT be affected
          date: futureDateStr,
        },
        {
          id: 'mapping-3',
          medicationId: 'med-2',
          scheduleId: 'sched-2',
          notificationId: 'group-notif',
          isGrouped: true,
          groupKey: '09:00',
          notificationType: 'reminder', // Same type - should remain
          date: futureDateStr,
        },
      ];

      const med2 = {
        id: 'med-2',
        name: 'Ibuprofen',
        dosageAmount: 400,
        dosageUnit: 'mg',
        schedule: [{ id: 'sched-2', time: '09:00', dosage: 1 }],
      };

      // First getMapping returns the reminder being cancelled
      (scheduledNotificationRepository.getMapping as jest.Mock).mockResolvedValue(groupMappings[0]);
      (scheduledNotificationRepository.getMappingsByGroupKey as jest.Mock).mockResolvedValue(groupMappings);
      (medicationRepository.getById as jest.Mock).mockImplementation((id) => {
        if (id === 'med-2') return Promise.resolve(med2);
        return Promise.resolve(null);
      });

      // Action: Cancel the reminder for med-1
      await cancelNotificationForDate('med-1', 'sched-1', futureDateStr, 'reminder');

      // Verify: Original group notification was cancelled
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('group-notif');

      // Verify: Only the reminder mapping was deleted (not the follow_up)
      expect(scheduledNotificationRepository.deleteMapping).toHaveBeenCalledWith('mapping-1');

      // Verify: A new notification was scheduled for med-2 (the remaining reminder)
      expect(scheduleNotificationAtomic).toHaveBeenCalled();

      // Verify: Only med-2 was looked up (med-1's follow_up should not be processed)
      expect(medicationRepository.getById).toHaveBeenCalledWith('med-2');
      expect(medicationRepository.getById).toHaveBeenCalledTimes(1);
    });

    it('should recreate grouped notification with remaining medications of same type', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      // Setup: Three medications with same type, one being cancelled
      const groupMappings = [
        {
          id: 'mapping-1',
          medicationId: 'med-1',
          scheduleId: 'sched-1',
          notificationId: 'group-notif',
          isGrouped: true,
          groupKey: '09:00',
          notificationType: 'reminder',
          date: futureDateStr,
        },
        {
          id: 'mapping-2',
          medicationId: 'med-2',
          scheduleId: 'sched-2',
          notificationId: 'group-notif',
          isGrouped: true,
          groupKey: '09:00',
          notificationType: 'reminder',
          date: futureDateStr,
        },
        {
          id: 'mapping-3',
          medicationId: 'med-3',
          scheduleId: 'sched-3',
          notificationId: 'group-notif',
          isGrouped: true,
          groupKey: '09:00',
          notificationType: 'reminder',
          date: futureDateStr,
        },
      ];

      const med2 = {
        id: 'med-2',
        name: 'Ibuprofen',
        dosageAmount: 400,
        dosageUnit: 'mg',
        schedule: [{ id: 'sched-2', time: '09:00', dosage: 1 }],
      };

      const med3 = {
        id: 'med-3',
        name: 'Acetaminophen',
        dosageAmount: 500,
        dosageUnit: 'mg',
        schedule: [{ id: 'sched-3', time: '09:00', dosage: 1 }],
      };

      (scheduledNotificationRepository.getMapping as jest.Mock).mockResolvedValue(groupMappings[0]);
      (scheduledNotificationRepository.getMappingsByGroupKey as jest.Mock).mockResolvedValue(groupMappings);
      (medicationRepository.getById as jest.Mock).mockImplementation((id) => {
        if (id === 'med-2') return Promise.resolve(med2);
        if (id === 'med-3') return Promise.resolve(med3);
        return Promise.resolve(null);
      });

      // Action: Cancel med-1's reminder
      await cancelNotificationForDate('med-1', 'sched-1', futureDateStr, 'reminder');

      // Verify: Original was cancelled
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('group-notif');

      // Verify: Remaining medications were looked up
      expect(medicationRepository.getById).toHaveBeenCalledWith('med-2');
      expect(medicationRepository.getById).toHaveBeenCalledWith('med-3');

      // Verify: A new grouped notification was scheduled
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    });
  });
});
