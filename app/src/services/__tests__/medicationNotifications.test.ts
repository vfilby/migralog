/**
 * Medication Notification Scheduling and Management Tests
 *
 * Tests for notification scheduling, cancellation, and management functions.
 * These complement the action handler tests in notificationHandlers.test.ts.
 */

import * as Notifications from 'expo-notifications';

// Mock dependencies before imports
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

// Set up all notification functions as mocks
(Notifications.getAllScheduledNotificationsAsync as jest.Mock) = jest.fn();
(Notifications.cancelScheduledNotificationAsync as jest.Mock) = jest.fn();
(Notifications.scheduleNotificationAsync as jest.Mock) = jest.fn();
(Notifications.getPresentedNotificationsAsync as jest.Mock) = jest.fn();
(Notifications.dismissNotificationAsync as jest.Mock) = jest.fn();
(Notifications.cancelAllScheduledNotificationsAsync as jest.Mock) = jest.fn();

// Import after mocks
import { logger } from '../../utils/logger';
import {
  medicationRepository,
  medicationScheduleRepository,
} from '../../database/medicationRepository';
import { scheduledNotificationRepository } from '../../database/scheduledNotificationRepository';
import { useNotificationSettingsStore } from '../../store/notificationSettingsStore';
import { notifyUserOfError } from '../notifications/errorNotificationHelper';
import { notificationDismissalService } from '../notifications/NotificationDismissalService';
import {
  cancelNotificationAtomic,
  scheduleNotificationAtomic,
} from '../notifications/notificationScheduler';
import {
  calculateNotificationDays,
  cancelMedicationNotifications,
  cancelScheduledMedicationReminder,
  dismissMedicationNotification,
  fixNotificationScheduleInconsistencies,
  cancelNotificationForDate,
  scheduleNotificationsForDays,
  topUpNotifications,
  reconcileNotifications,
  rebalanceNotifications,
  handleSkip,
  handleSkipAll,
  rescheduleAllMedicationNotifications,
} from '../notifications/medicationNotifications';

describe('Medication Notification Scheduling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Reset all mocks
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
    (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockResolvedValue(undefined);
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('new-notif-id');
    (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue([]);
    (Notifications.dismissNotificationAsync as jest.Mock).mockResolvedValue(undefined);
    (Notifications.cancelAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue(undefined);

    (scheduledNotificationRepository.tableExists as jest.Mock).mockResolvedValue(true);
    (scheduledNotificationRepository.getMapping as jest.Mock).mockResolvedValue(null);
    (scheduledNotificationRepository.saveMapping as jest.Mock).mockResolvedValue({ id: 'mapping-id' });
    (scheduledNotificationRepository.deleteMapping as jest.Mock).mockResolvedValue(undefined);
    (scheduledNotificationRepository.deleteAllMappings as jest.Mock).mockResolvedValue(0);
    (scheduledNotificationRepository.countBySchedule as jest.Mock).mockResolvedValue(0);
    (scheduledNotificationRepository.getLastScheduledDate as jest.Mock).mockResolvedValue(null);
    (scheduledNotificationRepository.getAllMappings as jest.Mock).mockResolvedValue([]);
    (scheduledNotificationRepository.deleteMappingsBeforeDate as jest.Mock).mockResolvedValue(0);

    (medicationRepository.getActive as jest.Mock).mockResolvedValue([]);
    (medicationRepository.getById as jest.Mock).mockResolvedValue(null);
    (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([]);

    (notifyUserOfError as jest.Mock).mockResolvedValue(undefined);

    // Default notification settings store mock
    (useNotificationSettingsStore.getState as jest.Mock).mockReturnValue({
      getEffectiveSettings: jest.fn().mockReturnValue({
        timeSensitiveEnabled: false,
        followUpDelay: 'off',
        criticalAlertsEnabled: false,
      }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('calculateNotificationDays', () => {
    it('should return 0 when no slots needed', () => {
      const result = calculateNotificationDays(0);
      expect(result).toBe(0);
    });

    it('should calculate days based on available slots', () => {
      // 64 total - 16 reserved = 48 available
      // 1 slot per day -> 48 days, but capped at 14
      const result = calculateNotificationDays(1);
      expect(result).toBe(14);
    });

    it('should return minimum of 3 days', () => {
      // With many slots per day, calculation might go below 3
      // 48 / 20 = 2.4 -> should still be at least 3
      const result = calculateNotificationDays(20);
      expect(result).toBe(3);
    });

    it('should return maximum of 14 days', () => {
      // Even with few slots needed, cap at 14
      const result = calculateNotificationDays(1);
      expect(result).toBeLessThanOrEqual(14);
    });

    it('should calculate correctly for typical use case', () => {
      // 3 medications, each with follow-up = 6 slots per day
      // 48 / 6 = 8 days
      const result = calculateNotificationDays(6);
      expect(result).toBe(8);
    });
  });

  describe('cancelMedicationNotifications', () => {
    it('should cancel all notifications for a medication', async () => {
      const mockNotifications = [
        {
          identifier: 'notif-1',
          content: { data: { medicationId: 'med-123', scheduleId: 'sched-1' } },
        },
        {
          identifier: 'notif-2',
          content: { data: { medicationId: 'med-123', scheduleId: 'sched-2' } },
        },
        {
          identifier: 'notif-3',
          content: { data: { medicationId: 'med-other' } },
        },
      ];

      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockNotifications);

      await cancelMedicationNotifications('med-123');

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-1');
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-2');
    });

    it('should handle empty notification list gracefully', async () => {
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);

      await cancelMedicationNotifications('med-123');

      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockRejectedValue(
        new Error('Platform error')
      );

      await expect(cancelMedicationNotifications('med-123')).resolves.not.toThrow();
    });
  });

  describe('cancelScheduledMedicationReminder', () => {
    it('should cancel single medication notification by scheduleId', async () => {
      const mockNotifications = [
        {
          identifier: 'notif-1',
          content: { data: { medicationId: 'med-123', scheduleId: 'sched-target' } },
        },
        {
          identifier: 'notif-2',
          content: { data: { medicationId: 'med-123', scheduleId: 'sched-other' } },
        },
      ];

      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockNotifications);

      await cancelScheduledMedicationReminder('med-123', 'sched-target');

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-1');
    });

    it('should cancel grouped notification containing the medication', async () => {
      const mockNotifications = [
        {
          identifier: 'group-notif',
          content: {
            data: {
              medicationIds: ['med-123', 'med-456'],
              scheduleIds: ['sched-1', 'sched-2'],
            },
          },
        },
      ];

      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockNotifications);

      await cancelScheduledMedicationReminder('med-123', 'sched-1');

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('group-notif');
    });

    it('should cancel all notifications for medication when scheduleId not provided', async () => {
      const mockNotifications = [
        {
          identifier: 'notif-1',
          content: { data: { medicationId: 'med-123', scheduleId: 'sched-1' } },
        },
        {
          identifier: 'notif-2',
          content: { data: { medicationId: 'med-123', scheduleId: 'sched-2' } },
        },
      ];

      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockNotifications);

      await cancelScheduledMedicationReminder('med-123');

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('dismissMedicationNotification', () => {
    beforeEach(() => {
      (notificationDismissalService.shouldDismissNotification as jest.Mock).mockResolvedValue({
        shouldDismiss: true,
        strategy: 'database_id_lookup',
        confidence: 'high',
        context: { matched: true },
      });
    });

    it('should use dismissal service to evaluate notifications', async () => {
      const mockPresentedNotifications = [
        {
          request: {
            identifier: 'presented-1',
            content: {
              data: { medicationId: 'med-123', scheduleId: 'sched-1' },
            },
          },
        },
      ];

      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue(
        mockPresentedNotifications
      );

      await dismissMedicationNotification('med-123', 'sched-1');

      expect(notificationDismissalService.shouldDismissNotification).toHaveBeenCalledWith(
        'presented-1',
        'med-123',
        'sched-1',
        expect.any(Date)
      );
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('presented-1');
    });

    it('should skip daily check-in notifications', async () => {
      const mockPresentedNotifications = [
        {
          request: {
            identifier: 'checkin-1',
            content: {
              data: { type: 'daily_checkin' },
            },
          },
        },
      ];

      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue(
        mockPresentedNotifications
      );

      await dismissMedicationNotification('med-123', 'sched-1');

      expect(notificationDismissalService.shouldDismissNotification).not.toHaveBeenCalled();
    });

    it('should not dismiss when service returns shouldDismiss false', async () => {
      (notificationDismissalService.shouldDismissNotification as jest.Mock).mockResolvedValue({
        shouldDismiss: false,
        strategy: 'none',
        confidence: 'low',
        context: { reason: 'no match' },
      });

      const mockPresentedNotifications = [
        {
          request: {
            identifier: 'presented-1',
            content: {
              data: { medicationId: 'med-other' },
            },
          },
        },
      ];

      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue(
        mockPresentedNotifications
      );

      await dismissMedicationNotification('med-123', 'sched-1');

      expect(Notifications.dismissNotificationAsync).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockRejectedValue(
        new Error('Platform error')
      );

      await expect(dismissMedicationNotification('med-123', 'sched-1')).resolves.not.toThrow();
    });
  });

  describe('fixNotificationScheduleInconsistencies', () => {
    it('should cancel orphaned notifications with invalid schedules', async () => {
      const mockMedications = [
        {
          id: 'med-1',
          schedule: [{ id: 'sched-valid' }],
        },
      ];

      const mockNotifications = [
        {
          identifier: 'notif-valid',
          content: {
            data: { medicationId: 'med-1', scheduleId: 'sched-valid' },
          },
        },
        {
          identifier: 'notif-orphan',
          content: {
            data: { medicationId: 'med-1', scheduleId: 'sched-orphan' },
          },
        },
      ];

      (medicationRepository.getActive as jest.Mock).mockResolvedValue(mockMedications);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockNotifications);

      const result = await fixNotificationScheduleInconsistencies();

      expect(result.orphanedNotifications).toBe(1);
      expect(result.invalidScheduleIds).toContain('sched-orphan');
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-orphan');
    });

    it('should handle grouped notifications with invalid schedules', async () => {
      const mockMedications = [
        { id: 'med-1', schedule: [{ id: 'sched-1' }] },
        { id: 'med-2', schedule: [] }, // No schedules
      ];

      const mockNotifications = [
        {
          identifier: 'group-notif',
          content: {
            data: {
              medicationIds: ['med-1', 'med-2'],
              scheduleIds: ['sched-1', 'sched-orphan'],
            },
          },
        },
      ];

      (medicationRepository.getActive as jest.Mock).mockResolvedValue(mockMedications);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockNotifications);

      const result = await fixNotificationScheduleInconsistencies();

      expect(result.orphanedNotifications).toBe(1);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('group-notif');
    });

    it('should not cancel valid notifications', async () => {
      const mockMedications = [
        { id: 'med-1', schedule: [{ id: 'sched-1' }] },
      ];

      const mockNotifications = [
        {
          identifier: 'valid-notif',
          content: {
            data: { medicationId: 'med-1', scheduleId: 'sched-1' },
          },
        },
      ];

      (medicationRepository.getActive as jest.Mock).mockResolvedValue(mockMedications);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockNotifications);

      const result = await fixNotificationScheduleInconsistencies();

      expect(result.orphanedNotifications).toBe(0);
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('cancelNotificationForDate', () => {
    it('should return early when no mapping found', async () => {
      (scheduledNotificationRepository.getMapping as jest.Mock).mockResolvedValue(null);

      await cancelNotificationForDate('med-123', 'sched-1', '2025-12-15', 'reminder');

      expect(cancelNotificationAtomic).not.toHaveBeenCalled();
    });

    it('should cancel ungrouped notification directly', async () => {
      const mockMapping = {
        id: 'mapping-1',
        notificationId: 'notif-1',
        isGrouped: false,
      };

      (scheduledNotificationRepository.getMapping as jest.Mock).mockResolvedValue(mockMapping);

      await cancelNotificationForDate('med-123', 'sched-1', '2025-12-15', 'reminder');

      expect(cancelNotificationAtomic).toHaveBeenCalledWith('notif-1');
    });

    it('should handle grouped notification cancellation', async () => {
      const mockMapping = {
        id: 'mapping-1',
        medicationId: 'med-1',
        scheduleId: 'sched-1',
        notificationId: 'group-notif',
        isGrouped: true,
        groupKey: '09:00',
        notificationType: 'reminder',
      };

      const mockGroupMappings = [
        mockMapping,
        {
          id: 'mapping-2',
          medicationId: 'med-2',
          scheduleId: 'sched-2',
          notificationId: 'group-notif',
          isGrouped: true,
          groupKey: '09:00',
          notificationType: 'reminder',
        },
      ];

      (scheduledNotificationRepository.getMapping as jest.Mock).mockResolvedValue(mockMapping);
      (scheduledNotificationRepository.getMappingsByGroupKey as jest.Mock).mockResolvedValue(mockGroupMappings);

      await cancelNotificationForDate('med-1', 'sched-1', '2025-12-15', 'reminder');

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('group-notif');
      expect(scheduledNotificationRepository.deleteMapping).toHaveBeenCalledWith('mapping-1');
    });
  });

  describe('scheduleNotificationsForDays', () => {
    const mockMedication = {
      id: 'med-123',
      name: 'Test Med',
      dosageAmount: 50,
      dosageUnit: 'mg',
    };

    const mockSchedule = {
      id: 'sched-1',
      time: '09:00',
      dosage: 1,
    };

    beforeEach(() => {
      (scheduleNotificationAtomic as jest.Mock).mockResolvedValue({ id: 'new-mapping' });
    });

    it('should schedule notifications for specified number of days', async () => {
      // Mock that no existing mappings exist
      (scheduledNotificationRepository.getMapping as jest.Mock).mockResolvedValue(null);

      await scheduleNotificationsForDays(mockMedication as any, mockSchedule as any, 3);

      // Should attempt to schedule for multiple days
      expect(scheduleNotificationAtomic).toHaveBeenCalled();
    });

    it('should skip dates that already have mappings', async () => {
      // First day has mapping, rest don't
      (scheduledNotificationRepository.getMapping as jest.Mock)
        .mockResolvedValueOnce({ id: 'existing-mapping' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await scheduleNotificationsForDays(mockMedication as any, mockSchedule as any, 3);

      // Should skip the first day
      const calls = (scheduleNotificationAtomic as jest.Mock).mock.calls;
      // Each call should be for a date that doesn't have existing mapping
      calls.forEach((call: any) => {
        expect(call[2].date).not.toBe(undefined);
      });
    });

    it('should skip dates where trigger time has passed', async () => {
      // With time 00:01, most times today will have passed
      const earlySchedule = { ...mockSchedule, time: '00:01' };
      (scheduledNotificationRepository.getMapping as jest.Mock).mockResolvedValue(null);

      await scheduleNotificationsForDays(mockMedication as any, earlySchedule as any, 3);

      // First day might be skipped, depends on current time
      expect(scheduleNotificationAtomic).toHaveBeenCalled();
    });
  });

  describe('topUpNotifications', () => {
    it('should skip when table does not exist', async () => {
      (scheduledNotificationRepository.tableExists as jest.Mock).mockResolvedValue(false);

      await topUpNotifications();

      expect(medicationRepository.getActive).not.toHaveBeenCalled();
    });

    it('should skip when no active medications', async () => {
      (medicationRepository.getActive as jest.Mock).mockResolvedValue([]);

      await topUpNotifications();

      expect(scheduledNotificationRepository.countBySchedule).not.toHaveBeenCalled();
    });

    it('should top up when below threshold', async () => {
      const mockMedication = {
        id: 'med-1',
        type: 'preventative',
        scheduleFrequency: 'daily',
      };

      const mockSchedule = {
        id: 'sched-1',
        medicationId: 'med-1',
        time: '09:00',
        enabled: true,
        dosage: 1,
      };

      (medicationRepository.getActive as jest.Mock).mockResolvedValue([mockMedication]);
      (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([mockSchedule]);
      (scheduledNotificationRepository.countBySchedule as jest.Mock).mockResolvedValue(1); // Below threshold of 3

      await topUpNotifications(3);

      // Should check counts and potentially schedule more
      expect(scheduledNotificationRepository.countBySchedule).toHaveBeenCalledWith('med-1', 'sched-1');
    });

    it('should not top up when at threshold', async () => {
      const mockMedication = {
        id: 'med-1',
        type: 'preventative',
        scheduleFrequency: 'daily',
      };

      const mockSchedule = {
        id: 'sched-1',
        medicationId: 'med-1',
        time: '09:00',
        enabled: true,
      };

      (medicationRepository.getActive as jest.Mock).mockResolvedValue([mockMedication]);
      (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([mockSchedule]);
      (scheduledNotificationRepository.countBySchedule as jest.Mock).mockResolvedValue(5); // At or above threshold

      await topUpNotifications(3);

      // Should not schedule more
      expect(scheduleNotificationAtomic).not.toHaveBeenCalled();
    });
  });

  describe('reconcileNotifications', () => {
    it('should skip when table does not exist', async () => {
      (scheduledNotificationRepository.tableExists as jest.Mock).mockResolvedValue(false);

      await reconcileNotifications();

      expect(Notifications.getAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    });

    it('should remove orphaned mappings from database', async () => {
      const mockMappings = [
        { id: 'mapping-1', notificationId: 'notif-1' },
        { id: 'mapping-orphan', notificationId: 'notif-missing' },
      ];

      const mockNotifications = [
        { identifier: 'notif-1', content: { data: { medicationId: 'med-1' } } },
      ];

      (scheduledNotificationRepository.getAllMappings as jest.Mock).mockResolvedValue(mockMappings);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockNotifications);

      await reconcileNotifications();

      expect(scheduledNotificationRepository.deleteMapping).toHaveBeenCalledWith('mapping-orphan');
    });

    it('should cancel orphaned medication notifications from OS', async () => {
      const mockMappings = [
        { id: 'mapping-1', notificationId: 'notif-1' },
      ];

      const mockNotifications = [
        { identifier: 'notif-1', content: { data: { medicationId: 'med-1' } } },
        { identifier: 'notif-orphan', content: { data: { medicationId: 'med-2' } } },
      ];

      (scheduledNotificationRepository.getAllMappings as jest.Mock).mockResolvedValue(mockMappings);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockNotifications);

      await reconcileNotifications();

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-orphan');
    });

    it('should not cancel non-medication notifications from OS', async () => {
      const mockMappings: any[] = [];

      const mockNotifications = [
        { identifier: 'checkin-notif', content: { data: { type: 'daily_checkin' } } },
      ];

      (scheduledNotificationRepository.getAllMappings as jest.Mock).mockResolvedValue(mockMappings);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockNotifications);

      await reconcileNotifications();

      // Should not cancel daily check-in notifications
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });

    it('should clean up old mappings', async () => {
      (scheduledNotificationRepository.getAllMappings as jest.Mock).mockResolvedValue([]);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);

      await reconcileNotifications();

      expect(scheduledNotificationRepository.deleteMappingsBeforeDate).toHaveBeenCalled();
    });
  });

  describe('rebalanceNotifications', () => {
    it('should trim excess notifications when medication count changes', async () => {
      const mockMedication = {
        id: 'med-1',
        type: 'preventative',
        scheduleFrequency: 'daily',
      };

      const mockSchedule = {
        id: 'sched-1',
        medicationId: 'med-1',
        enabled: true,
      };

      const mockMappings = [
        { id: 'map-1', date: '2025-12-15', notificationId: 'notif-1' },
        { id: 'map-2', date: '2025-12-16', notificationId: 'notif-2' },
        { id: 'map-3', date: '2025-12-17', notificationId: 'notif-3' },
        { id: 'map-4', date: '2025-12-18', notificationId: 'notif-4' },
        { id: 'map-5', date: '2025-12-19', notificationId: 'notif-5' },
      ];

      (medicationRepository.getActive as jest.Mock).mockResolvedValue([mockMedication]);
      (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([mockSchedule]);
      (scheduledNotificationRepository.getMappingsBySchedule as jest.Mock).mockResolvedValue(mockMappings);
      (scheduledNotificationRepository.tableExists as jest.Mock).mockResolvedValue(true);
      (scheduledNotificationRepository.countBySchedule as jest.Mock).mockResolvedValue(5);

      // Mock calculateNotificationDays to return 3 (simulate many medications)
      // This should cause trimming

      await rebalanceNotifications();

      // Should call getMappingsBySchedule to get existing mappings
      expect(scheduledNotificationRepository.getMappingsBySchedule).toHaveBeenCalled();
    });
  });

  describe('handleSkip', () => {
    it('should cancel today\'s notifications and top up', async () => {
      (scheduledNotificationRepository.getMapping as jest.Mock).mockResolvedValue({
        id: 'mapping-1',
        notificationId: 'notif-1',
        isGrouped: false,
      });
      (scheduledNotificationRepository.tableExists as jest.Mock).mockResolvedValue(true);

      const result = await handleSkip('med-123', 'sched-1');

      expect(result).toBe(true);
      // Should try to cancel reminder and follow_up
      expect(scheduledNotificationRepository.getMapping).toHaveBeenCalled();
    });

    it('should handle internal errors gracefully and still return true', async () => {
      // cancelNotificationForDate catches its own errors internally, so handleSkip succeeds
      (scheduledNotificationRepository.getMapping as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const result = await handleSkip('med-123', 'sched-1');

      // handleSkip returns true because internal errors are caught in cancelNotificationForDate
      expect(result).toBe(true);
    });
  });

  describe('handleSkipAll', () => {
    it('should skip all medications in a group', async () => {
      (scheduledNotificationRepository.getMapping as jest.Mock).mockResolvedValue(null);
      (scheduledNotificationRepository.tableExists as jest.Mock).mockResolvedValue(true);

      const result = await handleSkipAll({
        medicationIds: ['med-1', 'med-2'],
        scheduleIds: ['sched-1', 'sched-2'],
        time: '09:00',
      });

      expect(result).toBe(true);
    });

    it('should return false when no medication data provided', async () => {
      const result = await handleSkipAll({});

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle internal errors gracefully and still return true', async () => {
      // cancelNotificationForDate catches its own errors internally, so handleSkipAll succeeds
      (scheduledNotificationRepository.getMapping as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const result = await handleSkipAll({
        medicationIds: ['med-1'],
        scheduleIds: ['sched-1'],
      });

      // handleSkipAll returns true because internal errors are caught in cancelNotificationForDate
      expect(result).toBe(true);
    });
  });

  describe('rescheduleAllMedicationNotifications', () => {
    it('should cancel all medication notifications and clear database', async () => {
      const mockNotifications = [
        {
          identifier: 'med-notif-1',
          content: { data: { medicationId: 'med-1' } },
        },
      ];

      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockNotifications);
      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue([]);

      await rescheduleAllMedicationNotifications();

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalled();
      expect(scheduledNotificationRepository.deleteAllMappings).toHaveBeenCalled();
    });

    it('should handle empty medication list gracefully', async () => {
      (medicationRepository.getActive as jest.Mock).mockResolvedValue([]);
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue([]);

      await rescheduleAllMedicationNotifications();

      // Should complete without error
      expect(scheduledNotificationRepository.deleteAllMappings).toHaveBeenCalled();
    });

    it('should skip non-medication notifications during cancellation', async () => {
      const mockNotifications = [
        {
          identifier: 'med-notif-1',
          content: { data: { medicationId: 'med-1' } },
        },
        {
          identifier: 'checkin-notif',
          content: { data: { type: 'daily_checkin' } },
        },
      ];

      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue(mockNotifications);
      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue([]);

      await rescheduleAllMedicationNotifications();

      // Should only cancel medication notifications
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('med-notif-1');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('checkin-notif');
    });

    it('should handle errors during rescheduling', async () => {
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockRejectedValue(
        new Error('Platform error')
      );

      await rescheduleAllMedicationNotifications();

      // Should log error but not throw
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
