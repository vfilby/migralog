/**
 * Notification Scheduling Tests
 * 
 * Tests for scheduling notification logic - creating DAILY triggers,
 * grouping medications at same time, handling follow-ups, etc.
 * 
 * Key principles:
 * - Use DAILY triggers for recurring notifications
 * - Group medications scheduled at same time into single notification
 * - Follow-ups are also DAILY triggers (not one-time)
 */

import * as Notifications from 'expo-notifications';
import { Medication, MedicationSchedule } from '../../models/types';

// Mock dependencies
jest.mock('expo-notifications');
jest.mock('../../database/medicationRepository');
jest.mock('../../services/errorLogger');
jest.mock('../../store/notificationSettingsStore');
// Don't mock notificationScheduler - let it call through to Notifications.scheduleNotificationAsync
// so we can verify the actual notification scheduling behavior

// Setup Notifications mock
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
};
(Notifications as any).scheduleNotificationAsync = jest.fn();
(Notifications as any).getAllScheduledNotificationsAsync = jest.fn();
(Notifications as any).cancelScheduledNotificationAsync = jest.fn();

// Import after mocks
import {
  scheduleSingleNotification,
  scheduleMultipleNotification,
} from '../notifications/medicationNotifications';
import { useNotificationSettingsStore } from '../../store/notificationSettingsStore';

describe('Notification Scheduling', () => {
  let mockNotificationSettingsStore: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    mockNotificationSettingsStore = {
      getEffectiveSettings: jest.fn().mockReturnValue({
        timeSensitiveEnabled: true,
        followUpDelay: 'off',
        criticalAlertsEnabled: false,
      }),
    };

    (useNotificationSettingsStore.getState as jest.Mock) = jest.fn(
      () => mockNotificationSettingsStore
    );

    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-123');
  });

  describe('Single Medication Scheduling', () => {
    const mockMedication: Medication = {
      id: 'med-1',
      name: 'Test Med',
      type: 'preventative',
      dosageAmount: 50,
      dosageUnit: 'mg',
      scheduleFrequency: 'daily',
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      schedule: [],
    };

    const mockSchedule: MedicationSchedule = {
      id: 'sched-1',
      medicationId: 'med-1',
      time: '08:00',
      timezone: 'America/Los_Angeles',
      dosage: 2,
      enabled: true,
    };

    it('SCHED-S1: should schedule notification with DAILY trigger', async () => {
      // Act
      const notifId = await scheduleSingleNotification(mockMedication, mockSchedule);

      // Assert
      expect(notifId).toBe('notif-123');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      
      // Verify trigger is DAILY
      expect(call.trigger.type).toBe('daily');
      expect(call.trigger.hour).toBe(8);
      expect(call.trigger.minute).toBe(0);
      
      // Verify content
      expect(call.content.title).toContain('Test Med');
      expect(call.content.data.medicationId).toBe('med-1');
      expect(call.content.data.scheduleId).toBe('sched-1');
    });

    it('SCHED-S2: should schedule follow-up when enabled', async () => {
      // Arrange
      mockNotificationSettingsStore.getEffectiveSettings.mockReturnValue({
        timeSensitiveEnabled: true,
        followUpDelay: 30, // 30 minutes
        criticalAlertsEnabled: false,
      });

      // Act
      await scheduleSingleNotification(mockMedication, mockSchedule);

      // Assert - Should schedule 2 notifications: primary + follow-up
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
      
      const primaryCall = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      const followUpCall = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[1][0];
      
      // Primary at 8:00
      expect(primaryCall.trigger.hour).toBe(8);
      expect(primaryCall.trigger.minute).toBe(0);
      expect(primaryCall.content.data.isFollowUp).toBeUndefined();
      
      // Follow-up at 8:30
      expect(followUpCall.trigger.hour).toBe(8);
      expect(followUpCall.trigger.minute).toBe(30);
      expect(followUpCall.content.data.isFollowUp).toBe(true);
    });

    it('SCHED-S3: schedules even when schedule disabled (current behavior, TODO: fix)', async () => {
      // Arrange
      const disabledSchedule = { ...mockSchedule, enabled: false };

      // Act
      const notifId = await scheduleSingleNotification(mockMedication, disabledSchedule);

      // Assert
      // FIX (SCHED-152): Test description now matches expectation
      // Current implementation doesn't check enabled flag in scheduleSingleNotification
      // The enabled flag is checked at a higher level (rescheduleAllMedicationNotifications)
      // This test verifies current behavior - the function schedules regardless of enabled flag
      expect(notifId).toBe('notif-123');
    });
  });

  describe('Grouped Medication Scheduling', () => {
    const mockMedA: Medication = {
      id: 'med-A',
      name: 'Med A',
      type: 'preventative',
      dosageAmount: 50,
      dosageUnit: 'mg',
      scheduleFrequency: 'daily',
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      schedule: [],
    };

    const mockMedB: Medication = {
      id: 'med-B',
      name: 'Med B',
      type: 'preventative',
      dosageAmount: 100,
      dosageUnit: 'mg',
      scheduleFrequency: 'daily',
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      schedule: [],
    };

    const mockScheduleA: MedicationSchedule = {
      id: 'sched-A',
      medicationId: 'med-A',
      time: '08:00',
      timezone: 'America/Los_Angeles',
      dosage: 1,
      enabled: true,
    };

    const mockScheduleB: MedicationSchedule = {
      id: 'sched-B',
      medicationId: 'med-B',
      time: '08:00',
      timezone: 'America/Los_Angeles',
      dosage: 2,
      enabled: true,
    };

    it('SCHED-G1: should create grouped notification for meds at same time', async () => {
      // Act
      const notifId = await scheduleMultipleNotification(
        [
          { medication: mockMedA, schedule: mockScheduleA },
          { medication: mockMedB, schedule: mockScheduleB }
        ],
        '08:00'
      );

      // Assert
      expect(notifId).toBe('notif-123');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      
      // Verify DAILY trigger
      expect(call.trigger.type).toBe('daily');
      expect(call.trigger.hour).toBe(8);
      expect(call.trigger.minute).toBe(0);
      
      // Verify grouped data
      expect(call.content.data.medicationIds).toEqual(['med-A', 'med-B']);
      expect(call.content.data.scheduleIds).toEqual(['sched-A', 'sched-B']);
      expect(call.content.body).toContain('Med A');
      expect(call.content.body).toContain('Med B');
    });

    it('SCHED-G2: should use timeSensitive if ANY med has it enabled', async () => {
      // Arrange - Mock returns different values based on medication ID
      mockNotificationSettingsStore.getEffectiveSettings = jest.fn((medId: string) => {
        if (medId === 'med-A') {
          return { timeSensitiveEnabled: false, followUpDelay: 'off' };
        }
        return { timeSensitiveEnabled: true, followUpDelay: 'off' };
      });

      // Act
      await scheduleMultipleNotification(
        [
          { medication: mockMedA, schedule: mockScheduleA },
          { medication: mockMedB, schedule: mockScheduleB }
        ],
        '08:00'
      );

      // Assert
      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      expect(call.content.interruptionLevel).toBe('timeSensitive');
    });

    it('SCHED-G3: should schedule follow-up if ANY med has it enabled', async () => {
      // Arrange - Mock returns different values based on medication ID
      mockNotificationSettingsStore.getEffectiveSettings = jest.fn((medId: string) => {
        if (medId === 'med-A') {
          return { timeSensitiveEnabled: false, followUpDelay: 'off', criticalAlertsEnabled: false };
        }
        return { timeSensitiveEnabled: false, followUpDelay: 30, criticalAlertsEnabled: false };
      });

      // Act
      await scheduleMultipleNotification(
        [
          { medication: mockMedA, schedule: mockScheduleA },
          { medication: mockMedB, schedule: mockScheduleB }
        ],
        '08:00'
      );

      // Assert - Should have primary + follow-up
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
      
      const followUpCall = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[1][0];
      expect(followUpCall.trigger.hour).toBe(8);
      expect(followUpCall.trigger.minute).toBe(30);
      expect(followUpCall.content.data.isFollowUp).toBe(true);
    });
  });

  describe('Time Parsing', () => {
    it('SCHED-TIME1: should correctly parse HH:mm format', async () => {
      const mockMed: Medication = {
        id: 'med-1',
        name: 'Test',
        type: 'preventative',
        dosageAmount: 50,
        dosageUnit: 'mg',
        scheduleFrequency: 'daily',
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        schedule: [],
      };

      const testCases = [
        { time: '00:00', expectedHour: 0, expectedMinute: 0 },
        { time: '08:30', expectedHour: 8, expectedMinute: 30 },
        { time: '23:59', expectedHour: 23, expectedMinute: 59 },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        
        const schedule: MedicationSchedule = {
          id: 'sched-1',
          medicationId: 'med-1',
          time: testCase.time,
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
        };

        await scheduleSingleNotification(mockMed, schedule);

        const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
        expect(call.trigger.hour).toBe(testCase.expectedHour);
        expect(call.trigger.minute).toBe(testCase.expectedMinute);
      }
    });
  });

  describe('Error Handling', () => {
    it('SCHED-ERR1: should return null on scheduling error', async () => {
      // Arrange - Mock scheduleNotificationAsync to throw error
      (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Platform error')
      );

      const mockMed: Medication = {
        id: 'med-1',
        name: 'Test',
        type: 'preventative',
        dosageAmount: 50,
        dosageUnit: 'mg',
        scheduleFrequency: 'daily',
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        schedule: [],
      };

      const schedule: MedicationSchedule = {
        id: 'sched-1',
        medicationId: 'med-1',
        time: '08:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
      };

      // Act
      const result = await scheduleSingleNotification(mockMed, schedule);

      // Assert
      expect(result).toBeNull();
    });
  });
});
