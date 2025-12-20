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
  handleTakeNow,
  handleTakeAllNow,
  handleSnooze,
  handleRemindLater,
  cancelNotificationForDate,
  dismissMedicationNotification,
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

  // ============================================================================
  // SINGLE MEDICATION NOTIFICATION TESTS
  // ============================================================================

  describe('Single Medication: Log/Take Action', () => {
    it('should record taken dose with correct quantity and status', async () => {
      // Setup: A medication exists with schedule
      const medication = {
        id: 'med-123',
        name: 'Aspirin',
        dosageAmount: 500,
        dosageUnit: 'mg',
        defaultQuantity: 1,
      };

      mockMedicationStore.loadMedicationWithDetails.mockResolvedValue({
        medication,
        schedules: [{ id: 'sched-1', time: '09:00', dosage: 2 }],
      });

      // Action: User taps "Take Now" on notification
      const result = await handleTakeNow('med-123', 'sched-1');

      // Verify: Take was successful
      expect(result).toBe(true);

      // Verify: Dose was recorded with taken status and correct quantity
      expect(loggedDoses).toHaveLength(1);
      expect(loggedDoses[0]).toMatchObject({
        medicationId: 'med-123',
        scheduleId: 'sched-1',
        quantity: 2, // From schedule.dosage
        dosageAmount: 500,
        dosageUnit: 'mg',
        notes: 'Logged from notification',
      });
      // Status should NOT be 'skipped' (default is taken/undefined)
      expect(loggedDoses[0].status).toBeUndefined();
    });

    it('should use defaultQuantity when schedule dosage is not set', async () => {
      const medication = {
        id: 'med-123',
        name: 'Aspirin',
        dosageAmount: 500,
        dosageUnit: 'mg',
        defaultQuantity: 3,
      };

      mockMedicationStore.loadMedicationWithDetails.mockResolvedValue({
        medication,
        schedules: [{ id: 'sched-1', time: '09:00' }], // No dosage set
      });

      const result = await handleTakeNow('med-123', 'sched-1');

      expect(result).toBe(true);
      expect(loggedDoses[0].quantity).toBe(3); // From defaultQuantity
    });

    it('should return false when medication not found', async () => {
      mockMedicationStore.loadMedicationWithDetails.mockResolvedValue(null);

      const result = await handleTakeNow('med-123', 'sched-1');

      expect(result).toBe(false);
      expect(loggedDoses).toHaveLength(0);
    });

    it('should return false when schedule not found', async () => {
      const medication = {
        id: 'med-123',
        name: 'Aspirin',
        dosageAmount: 500,
        dosageUnit: 'mg',
      };

      mockMedicationStore.loadMedicationWithDetails.mockResolvedValue({
        medication,
        schedules: [{ id: 'different-sched', time: '09:00', dosage: 1 }],
      });

      const result = await handleTakeNow('med-123', 'sched-1');

      expect(result).toBe(false);
      expect(loggedDoses).toHaveLength(0);
    });
  });

  describe('Single Medication: Snooze Action', () => {
    it('should schedule new notification for snooze delay', async () => {
      const medication = {
        id: 'med-123',
        name: 'Aspirin',
        dosageAmount: 500,
        dosageUnit: 'mg',
      };

      (medicationRepository.getById as jest.Mock).mockResolvedValue(medication);
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('new-notif-id');

      // Action: User taps "Snooze" (10 minutes)
      const result = await handleSnooze('med-123', 'sched-1', 10);

      // Verify: Snooze was successful
      expect(result).toBe(true);

      // Verify: New notification was scheduled
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      const scheduleCall = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      expect(scheduleCall.content.title).toContain('Aspirin');
      expect(scheduleCall.content.body).toContain('snoozed');

      // Verify: NO dose was logged (snooze doesn't record a dose)
      expect(loggedDoses).toHaveLength(0);
    });

    it('should return false when medication not found', async () => {
      (medicationRepository.getById as jest.Mock).mockResolvedValue(null);

      const result = await handleSnooze('med-123', 'sched-1', 10);

      expect(result).toBe(false);
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('Single Medication: Pre-notification Logging (via app)', () => {
    it('should dismiss presented notification when dose logged via app', async () => {
      // Setup: A notification is currently displayed
      const presentedNotifications = [
        {
          request: {
            identifier: 'notif-123',
            content: {
              data: { medicationId: 'med-123', scheduleId: 'sched-1' },
            },
          },
        },
      ];

      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue(presentedNotifications);
      (notificationDismissalService.shouldDismissNotification as jest.Mock).mockResolvedValue({
        shouldDismiss: true,
        strategy: 'database_id_lookup',
        confidence: 'high',
        context: { matched: true },
      });

      // Action: User logs dose via app (triggers dismiss)
      await dismissMedicationNotification('med-123', 'sched-1');

      // Verify: Notification was dismissed
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('notif-123');
    });

    it('should not dismiss notification for different medication', async () => {
      const presentedNotifications = [
        {
          request: {
            identifier: 'notif-456',
            content: {
              data: { medicationId: 'med-456', scheduleId: 'sched-2' },
            },
          },
        },
      ];

      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue(presentedNotifications);
      (notificationDismissalService.shouldDismissNotification as jest.Mock).mockResolvedValue({
        shouldDismiss: false,
        strategy: 'none',
        confidence: 'low',
        context: { reason: 'no match' },
      });

      // Action: User logs different medication
      await dismissMedicationNotification('med-123', 'sched-1');

      // Verify: Other notification was NOT dismissed
      expect(Notifications.dismissNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('Single Medication: Skip Action', () => {
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

  // ============================================================================
  // MULTI-MEDICATION (GROUPED) NOTIFICATION TESTS
  // ============================================================================

  describe('Multi-Medication: Log All Action', () => {
    it('should record taken doses for all medications', async () => {
      const med1 = {
        id: 'med-1',
        name: 'Aspirin',
        dosageAmount: 500,
        dosageUnit: 'mg',
        defaultQuantity: 1,
      };
      const med2 = {
        id: 'med-2',
        name: 'Ibuprofen',
        dosageAmount: 400,
        dosageUnit: 'mg',
        defaultQuantity: 1,
      };

      mockMedicationStore.loadMedicationWithDetails
        .mockResolvedValueOnce({
          medication: med1,
          schedules: [{ id: 'sched-1', time: '09:00', dosage: 1 }],
        })
        .mockResolvedValueOnce({
          medication: med2,
          schedules: [{ id: 'sched-2', time: '09:00', dosage: 2 }],
        });

      // Action: User taps "Take All" on grouped notification
      const result = await handleTakeAllNow(['med-1', 'med-2'], ['sched-1', 'sched-2']);

      // Verify: All medications logged
      expect(result).toEqual({ success: 2, total: 2 });
      expect(loggedDoses).toHaveLength(2);

      // Verify: Each dose has correct data
      expect(loggedDoses[0]).toMatchObject({
        medicationId: 'med-1',
        quantity: 1,
        dosageAmount: 500,
        notes: 'Logged from notification',
      });
      expect(loggedDoses[1]).toMatchObject({
        medicationId: 'med-2',
        quantity: 2,
        dosageAmount: 400,
      });
    });

    it('should continue logging remaining medications when one fails', async () => {
      const med2 = {
        id: 'med-2',
        name: 'Ibuprofen',
        dosageAmount: 400,
        dosageUnit: 'mg',
      };

      mockMedicationStore.loadMedicationWithDetails
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({
          medication: med2,
          schedules: [{ id: 'sched-2', time: '09:00', dosage: 1 }],
        });

      const result = await handleTakeAllNow(['med-1', 'med-2'], ['sched-1', 'sched-2']);

      // Verify: Partial success
      expect(result).toEqual({ success: 1, total: 2 });
      expect(loggedDoses).toHaveLength(1);
      expect(loggedDoses[0].medicationId).toBe('med-2');
    });

    it('should return empty result for empty medication list', async () => {
      const result = await handleTakeAllNow([], []);

      expect(result).toEqual({ success: 0, total: 0 });
      expect(loggedDoses).toHaveLength(0);
    });
  });

  describe('Multi-Medication: Snooze All Action', () => {
    it('should schedule new grouped notification for snooze delay', async () => {
      const med1 = { id: 'med-1', name: 'Aspirin', dosageAmount: 500, dosageUnit: 'mg' };
      const med2 = { id: 'med-2', name: 'Ibuprofen', dosageAmount: 400, dosageUnit: 'mg' };

      (medicationRepository.getById as jest.Mock)
        .mockResolvedValueOnce(med1)
        .mockResolvedValueOnce(med2);
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('new-group-notif');

      // Action: User taps "Remind Later" (15 minutes)
      const result = await handleRemindLater(
        ['med-1', 'med-2'],
        ['sched-1', 'sched-2'],
        '09:00',
        15
      );

      // Verify: Snooze was successful
      expect(result).toBe(true);

      // Verify: New grouped notification was scheduled
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      const scheduleCall = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      expect(scheduleCall.content.title).toContain('2 Medications');
      expect(scheduleCall.content.data.medicationIds).toEqual(['med-1', 'med-2']);

      // Verify: NO doses were logged (snooze doesn't record doses)
      expect(loggedDoses).toHaveLength(0);
    });

    it('should return false when no valid medications found', async () => {
      (medicationRepository.getById as jest.Mock).mockResolvedValue(null);

      const result = await handleRemindLater(
        ['med-1', 'med-2'],
        ['sched-1', 'sched-2'],
        '09:00',
        15
      );

      expect(result).toBe(false);
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('should return false for empty medication list', async () => {
      const result = await handleRemindLater([], [], '09:00', 15);

      expect(result).toBe(false);
    });
  });

  describe('Multi-Medication: Partial Skip (one from group)', () => {
    it('should skip only selected medication and leave others pending', async () => {
      // Setup: Two medications, only skip the first
      const med1 = { id: 'med-1', name: 'Aspirin', dosageAmount: 500, dosageUnit: 'mg' };

      mockMedicationStore.loadMedicationWithDetails.mockResolvedValue({
        medication: med1,
        schedules: [{ id: 'sched-1', time: '09:00', dosage: 1 }],
      });

      // Action: User skips just med-1 (not skipAll)
      const result = await handleSkip('med-1', 'sched-1');

      // Verify: Only one medication was skipped
      expect(result).toBe(true);
      expect(loggedDoses).toHaveLength(1);
      expect(loggedDoses[0]).toMatchObject({
        medicationId: 'med-1',
        status: 'skipped',
        quantity: 0,
      });

      // med-2 was NOT affected (no log for it)
    });
  });

  describe('Multi-Medication: Partial Log (one from group)', () => {
    it('should log only selected medication from group', async () => {
      const med1 = {
        id: 'med-1',
        name: 'Aspirin',
        dosageAmount: 500,
        dosageUnit: 'mg',
      };

      mockMedicationStore.loadMedicationWithDetails.mockResolvedValue({
        medication: med1,
        schedules: [{ id: 'sched-1', time: '09:00', dosage: 1 }],
      });

      // Action: User taps "Take" on just med-1 from the group
      const result = await handleTakeNow('med-1', 'sched-1');

      // Verify: Only one medication was logged
      expect(result).toBe(true);
      expect(loggedDoses).toHaveLength(1);
      expect(loggedDoses[0]).toMatchObject({
        medicationId: 'med-1',
        quantity: 1,
      });
      expect(loggedDoses[0].status).toBeUndefined(); // Not skipped
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
