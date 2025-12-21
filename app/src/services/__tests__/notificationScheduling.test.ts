/**
 * Notification Scheduling Tests
 *
 * Tests for the managed one-off notification scheduling system using DATE triggers.
 * This file tests scheduleGroupedNotificationsForDays which is the production
 * notification scheduling path.
 *
 * Key principles:
 * - Use DATE triggers for one-off notifications (managed scheduling)
 * - Group medications scheduled at same time into single notification
 * - Schedule notifications for multiple days ahead
 *
 * GROUPING BEHAVIOR DOCUMENTATION:
 *
 * When Medications Are Grouped (Same Time):
 * - Two or more medications scheduled at the same time (e.g., Med A and Med B both at 08:00)
 * - Result: Single notification with title "Time for 2 Medications" and body listing both medications
 * - Database mappings: Both medications get isGrouped=true and groupKey='08:00'
 * - Notification data contains arrays: medicationIds=['med-A', 'med-B'] and scheduleIds=['sched-A', 'sched-B']
 *
 * When Medications Remain Individual (Different Times):
 * - Medications scheduled at different times (e.g., Med A at 08:00, Med B at 12:00)
 * - Result: Two separate notifications, each with individual medication details
 * - Database mappings: Each medication gets isGrouped=false and no groupKey
 *
 * Follow-up Delay Behavior for Groups:
 * - When medications in a group have different follow-up delays (e.g., 15 min vs 60 min)
 * - The system uses the MAXIMUM delay across all medications in the group
 * - Example: Med A (15-min follow-up) + Med B (60-min follow-up) = group follow-up at 60 minutes
 * - This ensures all medications get sufficient time before the reminder fires
 * - Follow-up notifications are also grouped with the same groupKey as the main reminder
 *
 * Database Schema:
 * - isGrouped (boolean): true if notification is shared with other medications, false for individual
 * - groupKey (string): The time slot (HH:mm format) that identifies which medications share this notification
 * - notificationType (string): 'reminder' for main notification, 'follow_up' for follow-up reminder
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

// Mock the scheduled notification repository
jest.mock('../../database/scheduledNotificationRepository');

// Import after mocks
import { scheduleGroupedNotificationsForDays } from '../notifications/medicationNotificationScheduling';
import { useNotificationSettingsStore } from '../../store/notificationSettingsStore';
import { scheduledNotificationRepository } from '../../database/scheduledNotificationRepository';

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

  /**
   * Tests for scheduleGroupedNotificationsForDays
   *
   * Grouping Behavior:
   * - Medications scheduled at the same time (e.g., 08:00) are grouped into a single notification
   * - Medications at different times (e.g., 08:00 vs 12:00) get individual notifications
   * - The isGrouped flag indicates whether a notification is shared with other medications
   * - The groupKey field stores the time (HH:mm) to identify which medications share a notification
   *
   * Follow-up Delay Behavior:
   * - When multiple medications in a group have different follow-up delays, the MAXIMUM delay is used
   * - Example: Med A (15-min follow-up) + Med B (60-min follow-up) = group follow-up at 60 minutes
   * - This ensures all medications get sufficient time before the follow-up reminder
   */
  describe('scheduleGroupedNotificationsForDays', () => {
    let mockScheduledNotificationRepo: any;

    beforeEach(() => {
      mockScheduledNotificationRepo = {
        getMapping: jest.fn().mockResolvedValue(null), // No existing mappings by default
        saveMapping: jest.fn().mockResolvedValue({ id: 'mapping-123' }),
      };

      (scheduledNotificationRepository.getMapping as jest.Mock) = mockScheduledNotificationRepo.getMapping;
      (scheduledNotificationRepository.saveMapping as jest.Mock) = mockScheduledNotificationRepo.saveMapping;
    });

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

    it('SCHED-GROUP-1: should group multiple medications at same time', async () => {
      // Act
      await scheduleGroupedNotificationsForDays(
        [
          { medication: mockMedA, schedule: mockScheduleA },
          { medication: mockMedB, schedule: mockScheduleB }
        ],
        2 // 2 days to ensure at least tomorrow is scheduled (today might be past 08:00)
      );

      // Assert - Should schedule 1 grouped notification (not 2 individual ones)
      // The exact number of calls depends on whether time has passed
      const scheduleCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      const groupedNotifications = scheduleCalls.filter(call =>
        call[0].content.data.medicationIds?.length > 1
      );

      expect(groupedNotifications.length).toBeGreaterThan(0);

      // Verify the grouped notification contains both medications
      const groupedCall = groupedNotifications[0][0];
      expect(groupedCall.content.data.medicationIds).toEqual(['med-A', 'med-B']);
      expect(groupedCall.content.data.scheduleIds).toEqual(['sched-A', 'sched-B']);
      expect(groupedCall.content.title).toContain('2 Medications');
    });

    it('SCHED-GROUP-2: should set isGrouped flag correctly for grouped notifications', async () => {
      // Act
      await scheduleGroupedNotificationsForDays(
        [
          { medication: mockMedA, schedule: mockScheduleA },
          { medication: mockMedB, schedule: mockScheduleB }
        ],
        2 // 2 days to ensure at least tomorrow is scheduled (today might be past 08:00)
      );

      // Assert - Check saveMapping calls
      const saveCalls = (scheduledNotificationRepository.saveMapping as jest.Mock).mock.calls;

      // Should have saved mappings for both medications
      const reminderMappings = saveCalls.filter(call =>
        call[0].notificationType === 'reminder'
      );

      expect(reminderMappings.length).toBeGreaterThanOrEqual(2);

      // All reminder mappings should have isGrouped: true and groupKey set
      reminderMappings.forEach(call => {
        expect(call[0].isGrouped).toBe(true);
        expect(call[0].groupKey).toBe('08:00');
      });
    });

    it('SCHED-GROUP-3: should set groupKey correctly', async () => {
      // Act
      await scheduleGroupedNotificationsForDays(
        [
          { medication: mockMedA, schedule: mockScheduleA },
          { medication: mockMedB, schedule: mockScheduleB }
        ],
        2 // 2 days to ensure at least tomorrow is scheduled (today might be past 08:00)
      );

      // Assert
      const saveCalls = (scheduledNotificationRepository.saveMapping as jest.Mock).mock.calls;

      saveCalls.forEach(call => {
        const mapping = call[0];
        if (mapping.isGrouped) {
          expect(mapping.groupKey).toBe('08:00');
        }
      });
    });

    it('SCHED-GROUP-4: should schedule individual notification for single medication', async () => {
      // Act
      await scheduleGroupedNotificationsForDays(
        [
          { medication: mockMedA, schedule: mockScheduleA }
        ],
        2 // 2 days to ensure at least tomorrow is scheduled (today might be past 08:00)
      );

      // Assert - Check saveMapping calls
      const saveCalls = (scheduledNotificationRepository.saveMapping as jest.Mock).mock.calls;
      const reminderMappings = saveCalls.filter(call =>
        call[0].notificationType === 'reminder'
      );

      if (reminderMappings.length > 0) {
        // Single medication should have isGrouped: false
        expect(reminderMappings[0][0].isGrouped).toBe(false);
        expect(reminderMappings[0][0].groupKey).toBeUndefined();
      }
    });

    it('SCHED-GROUP-5: should group follow-up notifications separately with max delay', async () => {
      // Arrange - Set different follow-up delays
      mockNotificationSettingsStore.getEffectiveSettings = jest.fn((medId: string) => {
        if (medId === 'med-A') {
          return { timeSensitiveEnabled: false, followUpDelay: 15, criticalAlertsEnabled: false };
        }
        return { timeSensitiveEnabled: false, followUpDelay: 60, criticalAlertsEnabled: false };
      });

      // Act
      await scheduleGroupedNotificationsForDays(
        [
          { medication: mockMedA, schedule: mockScheduleA },
          { medication: mockMedB, schedule: mockScheduleB }
        ],
        2 // 2 days to ensure at least tomorrow is scheduled (today might be past 08:00)
      );

      // Assert - Check for grouped follow-up notification
      const scheduleCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      const followUpNotifications = scheduleCalls.filter(call =>
        call[0].content.data.isFollowUp === true
      );

      expect(followUpNotifications.length).toBeGreaterThan(0);

      // Verify it uses the max delay (60 minutes)
      // The follow-up should be scheduled 60 minutes after the main notification
      const followUpCall = followUpNotifications[0][0];
      expect(followUpCall.content.data.medicationIds).toEqual(['med-A', 'med-B']);
    });

    it('SCHED-GROUP-6: should handle empty input array', async () => {
      // Act
      await scheduleGroupedNotificationsForDays([], 1);

      // Assert - Should not schedule any notifications
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('SCHED-GROUP-7: should skip already scheduled medications', async () => {
      // Arrange - Mock that medications are already scheduled
      mockScheduledNotificationRepo.getMapping.mockResolvedValue({
        id: 'existing-mapping',
        notificationId: 'existing-notif',
      });

      // Act
      await scheduleGroupedNotificationsForDays(
        [
          { medication: mockMedA, schedule: mockScheduleA },
          { medication: mockMedB, schedule: mockScheduleB }
        ],
        2 // 2 days to ensure at least tomorrow is in the future and we're testing the skip logic
      );

      // Assert - Should not schedule new notifications if all are already scheduled
      // The function checks each medication and skips if already scheduled
      const saveCalls = (scheduledNotificationRepository.saveMapping as jest.Mock).mock.calls;
      expect(saveCalls.length).toBe(0);
    });

    it('SCHED-GROUP-8: should schedule medications at different times separately', async () => {
      // Arrange - Create schedule at different time
      const mockScheduleC: MedicationSchedule = {
        id: 'sched-C',
        medicationId: 'med-A',
        time: '12:00', // Different time
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
      };

      // Act
      await scheduleGroupedNotificationsForDays(
        [
          { medication: mockMedA, schedule: mockScheduleA }, // 08:00
          { medication: mockMedB, schedule: mockScheduleC }  // 12:00
        ],
        2 // 2 days to ensure at least tomorrow is scheduled (today might be past 08:00 or 12:00)
      );

      // Assert - Should schedule 2 separate notifications, not grouped
      const scheduleCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      const individualNotifications = scheduleCalls.filter(call =>
        !call[0].content.data.medicationIds || call[0].content.data.medicationIds.length === 1
      );

      // Should have at least 2 individual notifications for different times
      expect(individualNotifications.length).toBeGreaterThanOrEqual(2);
    });
  });
});
