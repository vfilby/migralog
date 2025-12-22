/**
 * Integration Test: Notification Scheduling Workflow
 *
 * HIGH PRIORITY: Core app functionality - medication reminders are critical for user health
 *
 * Tests the complete notification scheduling flow:
 * - Full flow: add medication → schedule created → notification fires → action handled
 * - Verify notification scheduling actually creates scheduled notifications
 * - Test notification action handling (taken, skipped, snoozed)
 * - Test grouped notifications (multiple meds at same time)
 * - Test notification suppression (already logged medications)
 *
 * This follows the established integration test pattern:
 * - Test real component interactions
 * - Mock only external dependencies (OS notification APIs, expo-notifications)
 * - Verify actual outcomes, not just function calls
 * - Use TZ=UTC compatible testing (use days: 2+ for scheduling)
 */

import * as Notifications from 'expo-notifications';
import { useMedicationStore } from '../../store/medicationStore';
import { medicationRepository, medicationDoseRepository, medicationScheduleRepository } from '../../database/medicationRepository';
import { scheduledNotificationRepository } from '../../database/scheduledNotificationRepository';
import { Medication, MedicationSchedule, MedicationDose } from '../../models/types';
import { toLocalDateStringOffset } from '../../utils/dateFormatting';
import {
  scheduleNotificationsForDays,
  scheduleGroupedNotificationsForDays,
} from '../../services/notifications/medicationNotificationScheduling';
import { handleTakeNow, handleSkip, handleSnooze } from '../../services/notifications/medicationNotificationHandlers';
import { handleIncomingNotification } from '../../services/notifications/notificationService';

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
    MAX: 'max',
  },
}));

// Mock repositories
jest.mock('../../database/medicationRepository');
jest.mock('../../database/scheduledNotificationRepository');

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

// Mock notification settings store
jest.mock('../../store/notificationSettingsStore', () => ({
  useNotificationSettingsStore: {
    getState: () => ({
      getEffectiveSettings: jest.fn(() => ({
        timeSensitiveEnabled: false,
        criticalAlertsEnabled: false,
        followUpDelay: 'off' as const,
      })),
    }),
  },
}));

describe('Integration: Notification Scheduling Workflow', () => {
  let mockScheduleNotificationAsync: jest.Mock;
  let mockCancelScheduledNotificationAsync: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();

    // Reset expo-notifications mocks
    mockScheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
    mockCancelScheduledNotificationAsync = Notifications.cancelScheduledNotificationAsync as jest.Mock;

    mockScheduleNotificationAsync.mockResolvedValue('notification-id-123');
    mockCancelScheduledNotificationAsync.mockResolvedValue(undefined);
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);

    // Reset scheduled notification repository mocks
    (scheduledNotificationRepository.tableExists as jest.Mock).mockResolvedValue(true);
    (scheduledNotificationRepository.saveMapping as jest.Mock).mockImplementation((mapping) =>
      Promise.resolve({
        ...mapping,
        id: `mapping-${Date.now()}`,
        createdAt: new Date().toISOString(),
      })
    );
    (scheduledNotificationRepository.getMapping as jest.Mock).mockResolvedValue(null);
    (scheduledNotificationRepository.getMappingsBySchedule as jest.Mock).mockResolvedValue([]);

    // Reset medication repository mocks
    (medicationRepository.getById as jest.Mock).mockResolvedValue(null);
    (medicationRepository.getAll as jest.Mock).mockResolvedValue([]);
    (medicationRepository.getActive as jest.Mock).mockResolvedValue([]);
    (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([]);
    (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(new Map());
    (medicationDoseRepository.wasLoggedForScheduleToday as jest.Mock).mockResolvedValue(false);

    // Clear cache to prevent data bleed between tests
    const { cacheManager } = require('../../utils/cacheManager');
    cacheManager.clear();

    // Reset store to initial state
    useMedicationStore.setState({
      medications: [],
      preventativeMedications: [],
      rescueMedications: [],
      otherMedications: [],
      schedules: [],
      doses: [],
      loading: false,
      error: null,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Single medication scheduling workflow', () => {
    it('should schedule notification when medication with schedule is added', async () => {
      const medication: Medication = {
        id: 'med-schedule-1',
        name: 'Ibuprofen',
        type: 'rescue',
        dosageAmount: 200,
        dosageUnit: 'mg',
        defaultQuantity: 2,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedule: MedicationSchedule = {
        id: 'sched-1',
        medicationId: 'med-schedule-1',
        time: '08:00',
        dosage: 2,
        enabled: true,
        timezone: 'UTC',
      };

      // Mock repository responses
      (medicationRepository.getById as jest.Mock).mockResolvedValue(medication);
      (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([schedule]);

      // Schedule notifications for 3 days
      await scheduleNotificationsForDays(medication, schedule, 3);

      // Verify notification was scheduled (at least once, skipping past dates)
      expect(mockScheduleNotificationAsync).toHaveBeenCalled();

      // Verify the notification content
      const calls = mockScheduleNotificationAsync.mock.calls;
      const firstCall = calls[0][0];

      expect(firstCall.content.title).toContain('Ibuprofen');
      expect(firstCall.content.data.medicationId).toBe('med-schedule-1');
      expect(firstCall.content.data.scheduleId).toBe('sched-1');
      expect(firstCall.content.categoryIdentifier).toBe('MEDICATION_REMINDER');

      // Verify database mapping was saved
      expect(scheduledNotificationRepository.saveMapping).toHaveBeenCalled();
      const mappingCall = (scheduledNotificationRepository.saveMapping as jest.Mock).mock.calls[0][0];
      expect(mappingCall.medicationId).toBe('med-schedule-1');
      expect(mappingCall.scheduleId).toBe('sched-1');
      expect(mappingCall.notificationType).toBe('reminder');
      expect(mappingCall.isGrouped).toBe(false);
    });

    it('should not schedule duplicate notifications for same date', async () => {
      const medication: Medication = {
        id: 'med-no-dup',
        name: 'Aspirin',
        type: 'rescue',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedule: MedicationSchedule = {
        id: 'sched-no-dup',
        medicationId: 'med-no-dup',
        time: '09:00',
        dosage: 1,
        enabled: true,
        timezone: 'UTC',
      };

      const futureDate = toLocalDateStringOffset(2);

      // Mock existing mapping for the date
      (scheduledNotificationRepository.getMapping as jest.Mock).mockResolvedValue({
        id: 'existing-mapping',
        medicationId: 'med-no-dup',
        scheduleId: 'sched-no-dup',
        date: futureDate,
        notificationId: 'existing-notification',
        notificationType: 'reminder',
        isGrouped: false,
        sourceType: 'medication',
        createdAt: new Date().toISOString(),
      });

      // Schedule notifications
      await scheduleNotificationsForDays(medication, schedule, 3, futureDate);

      // Should skip scheduling for the date that already exists
      const saveMappingCalls = (scheduledNotificationRepository.saveMapping as jest.Mock).mock.calls;
      const duplicateCalls = saveMappingCalls.filter((call: unknown[]) => {
        const mapping = call[0] as { date: string };
        return mapping.date === futureDate;
      });

      expect(duplicateCalls).toHaveLength(0);
    });

    it('should skip scheduling for past dates', async () => {
      const medication: Medication = {
        id: 'med-past',
        name: 'Medication',
        type: 'rescue',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedule: MedicationSchedule = {
        id: 'sched-past',
        medicationId: 'med-past',
        time: '00:01', // Very early time to ensure it's in the past when combined with yesterday
        dosage: 1,
        enabled: true,
        timezone: 'UTC',
      };

      const yesterday = toLocalDateStringOffset(-1);

      await scheduleNotificationsForDays(medication, schedule, 1, yesterday);

      // Should not schedule notifications for past dates
      // Note: The function skips past dates by checking if trigger <= new Date()
      // Since yesterday at 00:01 is in the past, no notifications should be scheduled
      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
      expect(scheduledNotificationRepository.saveMapping).not.toHaveBeenCalled();
    });
  });

  describe('Grouped notification scheduling', () => {
    it('should group medications scheduled at same time', async () => {
      const med1: Medication = {
        id: 'med-group-1',
        name: 'Medication A',
        type: 'preventative',
        dosageAmount: 50,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const med2: Medication = {
        id: 'med-group-2',
        name: 'Medication B',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedule1: MedicationSchedule = {
        id: 'sched-group-1',
        medicationId: 'med-group-1',
        time: '08:00',
        dosage: 1,
        enabled: true,
        timezone: 'UTC',
      };

      const schedule2: MedicationSchedule = {
        id: 'sched-group-2',
        medicationId: 'med-group-2',
        time: '08:00', // Same time
        dosage: 1,
        enabled: true,
        timezone: 'UTC',
      };

      const items = [
        { medication: med1, schedule: schedule1 },
        { medication: med2, schedule: schedule2 },
      ];

      await scheduleGroupedNotificationsForDays(items, 3);

      // Should schedule grouped notifications
      expect(mockScheduleNotificationAsync).toHaveBeenCalled();

      // Verify grouped notification content
      const calls = mockScheduleNotificationAsync.mock.calls;
      const groupedCall = calls.find((call) => {
        const content = call[0].content;
        return content.title.includes('2 Medications');
      });

      expect(groupedCall).toBeDefined();
      expect(groupedCall![0].content.body).toContain('Medication A');
      expect(groupedCall![0].content.body).toContain('Medication B');
      expect(groupedCall![0].content.data.medicationIds).toEqual(['med-group-1', 'med-group-2']);
      expect(groupedCall![0].content.categoryIdentifier).toBe('MULTIPLE_MEDICATION_REMINDER');

      // Verify both medications have mappings with isGrouped=true
      const saveMappingCalls = (scheduledNotificationRepository.saveMapping as jest.Mock).mock.calls;
      const groupedMappings = saveMappingCalls.filter((call: unknown[]) => {
        const mapping = call[0] as { isGrouped: boolean };
        return mapping.isGrouped === true;
      });

      expect(groupedMappings.length).toBeGreaterThan(0);

      // Verify all grouped mappings have the same groupKey
      const groupKeys = groupedMappings.map((call: unknown[]) => {
        const mapping = call[0] as { groupKey: string };
        return mapping.groupKey;
      });
      expect(new Set(groupKeys).size).toBe(1); // All same group key
      expect(groupKeys[0]).toBe('08:00');
    });

    it('should create separate notifications for different times', async () => {
      const med1: Medication = {
        id: 'med-diff-1',
        name: 'Morning Med',
        type: 'preventative',
        dosageAmount: 50,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const med2: Medication = {
        id: 'med-diff-2',
        name: 'Evening Med',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedule1: MedicationSchedule = {
        id: 'sched-diff-1',
        medicationId: 'med-diff-1',
        time: '08:00',
        dosage: 1,
        enabled: true,
        timezone: 'UTC',
      };

      const schedule2: MedicationSchedule = {
        id: 'sched-diff-2',
        medicationId: 'med-diff-2',
        time: '20:00', // Different time
        dosage: 1,
        enabled: true,
        timezone: 'UTC',
      };

      const items = [
        { medication: med1, schedule: schedule1 },
        { medication: med2, schedule: schedule2 },
      ];

      await scheduleGroupedNotificationsForDays(items, 3);

      // Should schedule separate notifications for different times
      expect(mockScheduleNotificationAsync).toHaveBeenCalled();

      // Verify separate notifications were created
      const calls = mockScheduleNotificationAsync.mock.calls;
      const morningCalls = calls.filter((call) => {
        const content = call[0].content;
        return content.title.includes('Morning Med') || content.data.medicationId === 'med-diff-1';
      });

      const eveningCalls = calls.filter((call) => {
        const content = call[0].content;
        return content.title.includes('Evening Med') || content.data.medicationId === 'med-diff-2';
      });

      expect(morningCalls.length).toBeGreaterThan(0);
      expect(eveningCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Notification action handling', () => {
    it('should handle "Take Now" action and log dose', async () => {
      const medication: Medication = {
        id: 'med-take-now',
        name: 'Quick Med',
        type: 'rescue',
        dosageAmount: 200,
        dosageUnit: 'mg',
        defaultQuantity: 2,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedule: MedicationSchedule = {
        id: 'sched-take-now',
        medicationId: 'med-take-now',
        time: '10:00',
        dosage: 2,
        enabled: true,
        timezone: 'UTC',
      };

      const mockDose: MedicationDose = {
        id: 'dose-1',
        medicationId: 'med-take-now',
        timestamp: Date.now(),
        quantity: 2,
        dosageAmount: 200,
        dosageUnit: 'mg',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Mock repository responses
      (medicationRepository.getById as jest.Mock).mockResolvedValue(medication);
      (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([schedule]);
      (medicationDoseRepository.create as jest.Mock).mockResolvedValue(mockDose);

      // Handle the action
      const result = await handleTakeNow('med-take-now', 'sched-take-now');

      expect(result).toBe(true);

      // Verify dose was logged
      expect(medicationDoseRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          medicationId: 'med-take-now',
          quantity: 2,
          dosageAmount: 200,
          dosageUnit: 'mg',
        })
      );
    });

    it('should handle "Skip" action and log skipped dose', async () => {
      const medication: Medication = {
        id: 'med-skip',
        name: 'Skippable Med',
        type: 'rescue',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedule: MedicationSchedule = {
        id: 'sched-skip',
        medicationId: 'med-skip',
        time: '12:00',
        dosage: 1,
        enabled: true,
        timezone: 'UTC',
      };

      const mockSkippedDose: MedicationDose = {
        id: 'dose-skipped',
        medicationId: 'med-skip',
        scheduleId: 'sched-skip',
        timestamp: Date.now(),
        quantity: 0, // Skipped doses have quantity 0
        dosageAmount: 100,
        dosageUnit: 'mg',
        status: 'skipped',
        notes: 'Skipped from notification',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Mock repository responses
      (medicationRepository.getById as jest.Mock).mockResolvedValue(medication);
      (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([schedule]);
      (medicationDoseRepository.create as jest.Mock).mockResolvedValue(mockSkippedDose);

      // Handle the skip action
      const result = await handleSkip('med-skip', 'sched-skip');

      expect(result).toBe(true);

      // Verify skipped dose was logged
      expect(medicationDoseRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          medicationId: 'med-skip',
          scheduleId: 'sched-skip',
          quantity: 0,
          status: 'skipped',
          notes: 'Skipped from notification',
        })
      );
    });

    it('should handle "Snooze" action and reschedule notification', async () => {
      const medication: Medication = {
        id: 'med-snooze',
        name: 'Snoozeable Med',
        type: 'rescue',
        dosageAmount: 50,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Mock repository response
      (medicationRepository.getById as jest.Mock).mockResolvedValue(medication);

      // Handle the snooze action
      const result = await handleSnooze('med-snooze', 'sched-snooze', 10);

      expect(result).toBe(true);

      // Verify new notification was scheduled
      expect(mockScheduleNotificationAsync).toHaveBeenCalled();

      // Verify the snoozed notification has correct content
      const snoozeCall = mockScheduleNotificationAsync.mock.calls[0][0];
      expect(snoozeCall.content.title).toContain('Snoozeable Med');
      expect(snoozeCall.content.body).toContain('snoozed');
      expect(snoozeCall.content.data.medicationId).toBe('med-snooze');
      expect(snoozeCall.content.data.scheduleId).toBe('sched-snooze');

      // Verify trigger time is approximately 10 minutes from now
      // Trigger is { type: 'date', date: Date }
      expect(snoozeCall.trigger.type).toBe('date');
      const triggerDate = snoozeCall.trigger.date;
      const expectedTime = Date.now() + 10 * 60 * 1000;
      expect(triggerDate.getTime()).toBeGreaterThan(expectedTime - 5000); // 5 second tolerance
      expect(triggerDate.getTime()).toBeLessThan(expectedTime + 5000);
    });
  });

  describe('Notification suppression', () => {
    it('should suppress notification if medication already logged', async () => {
      const medication: Medication = {
        id: 'med-suppress',
        name: 'Already Taken',
        type: 'rescue',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedule: MedicationSchedule = {
        id: 'sched-suppress',
        medicationId: 'med-suppress',
        time: '08:00',
        dosage: 1,
        enabled: true,
        timezone: 'UTC',
      };

      // Mock that medication was already logged today
      (medicationRepository.getById as jest.Mock).mockResolvedValue(medication);
      (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([schedule]);
      (medicationDoseRepository.wasLoggedForScheduleToday as jest.Mock).mockResolvedValue(true);

      // Create a mock notification
      const mockNotification = {
        request: {
          identifier: 'test-notification-1',
          content: {
            title: 'Time for Already Taken',
            subtitle: null,
            body: '1 dose(s) - 100mg each',
            data: {
              medicationId: 'med-suppress',
              scheduleId: 'sched-suppress',
            },
            categoryIdentifier: null,
            sound: null,
          },
          trigger: {},
        },
        date: Date.now(),
      } as unknown as Notifications.Notification;

      // Test notification handler
      const result = await handleIncomingNotification(mockNotification);

      // Should suppress the notification (all flags false)
      expect(result.shouldShowBanner).toBe(false);
      expect(result.shouldPlaySound).toBe(false);
      expect(result.shouldSetBadge).toBe(false);
      expect(result.shouldShowList).toBe(false);
    });

    it('should show notification if medication not logged', async () => {
      const medication: Medication = {
        id: 'med-show',
        name: 'Not Taken Yet',
        type: 'rescue',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedule: MedicationSchedule = {
        id: 'sched-show',
        medicationId: 'med-show',
        time: '09:00',
        dosage: 1,
        enabled: true,
        timezone: 'UTC',
      };

      // Mock that medication was NOT logged today
      (medicationRepository.getById as jest.Mock).mockResolvedValue(medication);
      (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([schedule]);
      (medicationDoseRepository.wasLoggedForScheduleToday as jest.Mock).mockResolvedValue(false);

      // Create a mock notification
      const mockNotification = {
        request: {
          identifier: 'test-notification-2',
          content: {
            title: 'Time for Not Taken Yet',
            subtitle: null,
            body: '1 dose(s) - 100mg each',
            data: {
              medicationId: 'med-show',
              scheduleId: 'sched-show',
            },
            categoryIdentifier: null,
            sound: null,
          },
          trigger: {},
        },
        date: Date.now(),
      } as unknown as Notifications.Notification;

      // Test notification handler
      const result = await handleIncomingNotification(mockNotification);

      // Should show the notification (all flags true)
      expect(result.shouldShowBanner).toBe(true);
      expect(result.shouldPlaySound).toBe(true);
      expect(result.shouldSetBadge).toBe(true);
      expect(result.shouldShowList).toBe(true);
    });

    it('should suppress grouped notification if all medications logged', async () => {
      const med1: Medication = {
        id: 'med-group-suppress-1',
        name: 'Med A',
        type: 'preventative',
        dosageAmount: 50,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        schedule: [
          {
            id: 'sched-group-suppress-1',
            medicationId: 'med-group-suppress-1',
            time: '08:00',
            dosage: 1,
            enabled: true,
            timezone: 'UTC',
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const med2: Medication = {
        id: 'med-group-suppress-2',
        name: 'Med B',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        schedule: [
          {
            id: 'sched-group-suppress-2',
            medicationId: 'med-group-suppress-2',
            time: '08:00',
            dosage: 1,
            enabled: true,
            timezone: 'UTC',
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Mock that both medications were logged
      (medicationRepository.getById as jest.Mock)
        .mockResolvedValueOnce(med1)
        .mockResolvedValueOnce(med2);
      (medicationDoseRepository.wasLoggedForScheduleToday as jest.Mock).mockResolvedValue(true);

      // Create a mock grouped notification
      const mockNotification = {
        request: {
          identifier: 'test-grouped-suppress',
          content: {
            title: 'Time for 2 Medications',
            subtitle: null,
            body: 'Med A, Med B',
            data: {
              medicationIds: ['med-group-suppress-1', 'med-group-suppress-2'],
              scheduleIds: ['sched-group-suppress-1', 'sched-group-suppress-2'],
              time: '08:00',
            },
            categoryIdentifier: null,
            sound: null,
          },
          trigger: {},
        },
        date: Date.now(),
      } as unknown as Notifications.Notification;

      // Test notification handler
      const result = await handleIncomingNotification(mockNotification);

      // Should suppress since all medications logged
      expect(result.shouldShowBanner).toBe(false);
      expect(result.shouldPlaySound).toBe(false);
      expect(result.shouldSetBadge).toBe(false);
      expect(result.shouldShowList).toBe(false);
    });

    it('should show grouped notification if any medication not logged', async () => {
      const med1: Medication = {
        id: 'med-group-show-1',
        name: 'Med A',
        type: 'preventative',
        dosageAmount: 50,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        schedule: [], // Empty - schedules loaded from repository
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const med2: Medication = {
        id: 'med-group-show-2',
        name: 'Med B',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        schedule: [], // Empty - schedules loaded from repository
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Schedules are loaded separately
      const sched1: MedicationSchedule = {
        id: 'sched-group-show-1',
        medicationId: 'med-group-show-1',
        time: '09:00',
        dosage: 1,
        enabled: true,
        timezone: 'UTC',
      };

      const sched2: MedicationSchedule = {
        id: 'sched-group-show-2',
        medicationId: 'med-group-show-2',
        time: '09:00',
        dosage: 1,
        enabled: true,
        timezone: 'UTC',
      };

      // Mock: Med A logged, Med B not logged
      (medicationRepository.getById as jest.Mock)
        .mockResolvedValueOnce(med1)
        .mockResolvedValueOnce(med2);
      (medicationScheduleRepository.getByMedicationId as jest.Mock)
        .mockImplementation((id) => {
          if (id === 'med-group-show-1') return Promise.resolve([sched1]);
          if (id === 'med-group-show-2') return Promise.resolve([sched2]);
          return Promise.resolve([]);
        });
      (medicationDoseRepository.wasLoggedForScheduleToday as jest.Mock)
        .mockResolvedValueOnce(true)  // Med A logged
        .mockResolvedValueOnce(false); // Med B NOT logged

      // Create a mock grouped notification
      const mockNotification = {
        request: {
          identifier: 'test-grouped-show',
          content: {
            title: 'Time for 2 Medications',
            subtitle: null,
            body: 'Med A, Med B',
            data: {
              medicationIds: ['med-group-show-1', 'med-group-show-2'],
              scheduleIds: ['sched-group-show-1', 'sched-group-show-2'],
              time: '09:00',
            },
            categoryIdentifier: null,
            sound: null,
          },
          trigger: {},
        },
        date: Date.now(),
      } as unknown as Notifications.Notification;

      // Test notification handler
      const result = await handleIncomingNotification(mockNotification);

      // Should show since at least one medication not logged
      expect(result.shouldShowBanner).toBe(true);
      expect(result.shouldPlaySound).toBe(true);
      expect(result.shouldSetBadge).toBe(true);
      expect(result.shouldShowList).toBe(true);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle scheduling when medication not found', async () => {
      // Mock medication not found
      (medicationRepository.getById as jest.Mock).mockResolvedValue(null);

      const result = await handleTakeNow('non-existent-med', 'non-existent-schedule');

      // Should return false (failure)
      expect(result).toBe(false);

      // Should not log any dose
      expect(medicationDoseRepository.create).not.toHaveBeenCalled();
    });

    it('should handle scheduling when schedule not found', async () => {
      const medication: Medication = {
        id: 'med-no-sched',
        name: 'No Schedule Med',
        type: 'rescue',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Mock medication exists but schedule doesn't
      (medicationRepository.getById as jest.Mock).mockResolvedValue(medication);
      (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([]);

      const result = await handleTakeNow('med-no-sched', 'non-existent-schedule');

      // Should return false (failure)
      expect(result).toBe(false);

      // Should not log any dose
      expect(medicationDoseRepository.create).not.toHaveBeenCalled();
    });

    it('should handle notification scheduling failure gracefully', async () => {
      const medication: Medication = {
        id: 'med-fail',
        name: 'Failing Med',
        type: 'rescue',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedule: MedicationSchedule = {
        id: 'sched-fail',
        medicationId: 'med-fail',
        time: '10:00',
        dosage: 1,
        enabled: true,
        timezone: 'UTC',
      };

      // Mock scheduling failure - all calls should fail
      mockScheduleNotificationAsync.mockRejectedValue(new Error('Notification scheduling failed'));

      // Should not throw, but handle gracefully
      await expect(scheduleNotificationsForDays(medication, schedule, 3)).resolves.not.toThrow();

      // Should not save mapping if notification failed
      // The scheduleNotificationAtomic function returns null on error and doesn't save the mapping
      const saveMappingCalls = (scheduledNotificationRepository.saveMapping as jest.Mock).mock.calls;
      expect(saveMappingCalls).toHaveLength(0);
    });

    it('should handle empty medication list for grouped scheduling', async () => {
      const items: Array<{ medication: Medication; schedule: MedicationSchedule }> = [];

      // Should handle empty list gracefully
      await expect(scheduleGroupedNotificationsForDays(items, 3)).resolves.not.toThrow();

      // Should not schedule any notifications
      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });
});
