/**
 * Notification Action Handler Tests
 * 
 * Tests for notification action handlers - the functions that execute when users
 * tap notification action buttons like "Take Now", "Snooze", "Clear Day", etc.
 * 
 * These handlers:
 * - Update database (log dose, log status)
 * - Do NOT cancel scheduled notifications (suppression handles that)
 * - May schedule new one-time notifications (snooze)
 */

import * as Notifications from 'expo-notifications';
import {
  medicationRepository,
} from '../../database/medicationRepository';
import { Medication } from '../../models/types';

// Mock dependencies
jest.mock('expo-notifications');
jest.mock('../../database/medicationRepository');
jest.mock('../../services/errorLogger');
jest.mock('../../store/medicationStore');
jest.mock('../../store/dailyStatusStore');
jest.mock('../../store/notificationSettingsStore');
jest.mock('@sentry/react-native');
jest.mock('../notifications/errorNotificationHelper');

// Import after mocks
import * as Sentry from '@sentry/react-native';
import {
  handleTakeNow,
  handleSnooze,
  handleTakeAllNow,
  handleRemindLater,
} from '../notifications/medicationNotifications';
import { dailyCheckinService } from '../notifications/dailyCheckinService';
import { useMedicationStore } from '../../store/medicationStore';
import { useDailyStatusStore } from '../../store/dailyStatusStore';
import { useNotificationSettingsStore } from '../../store/notificationSettingsStore';
import { notifyUserOfError } from '../notifications/errorNotificationHelper';
import { expectSentryError } from '../../utils/testUtils/sentryTestUtils';

// Setup Notifications mock
(Notifications as any).AndroidNotificationPriority = {
  MIN: -2,
  LOW: -1,
  DEFAULT: 0,
  HIGH: 1,
  MAX: 2,
};

describe('Notification Action Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    (Sentry.captureException as jest.Mock).mockClear();
    // Mock notifyUserOfError to resolve immediately without calling scheduleNotificationAsync
    (notifyUserOfError as jest.Mock).mockResolvedValue(undefined);
    // Set up scheduleNotificationAsync mock
    jest.spyOn(Notifications, 'scheduleNotificationAsync').mockResolvedValue('notification-id-123' as any);
  });

  describe('Take Now Actions', () => {
    const mockMedication: Medication = {
      id: 'med-1',
      name: 'Test Medication',
      type: 'preventative',
      dosageAmount: 50,
      dosageUnit: 'mg',
      scheduleFrequency: 'daily',
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      defaultQuantity: 1,
      schedule: [
        {
          id: 'sched-1',
          medicationId: 'med-1',
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 2, // Different from default
          enabled: true,
        },
      ],
    };

    let mockMedicationStore: any;

    beforeEach(() => {
      mockMedicationStore = {
        logDose: jest.fn().mockResolvedValue(undefined),
      };

      (useMedicationStore.getState as jest.Mock) = jest.fn(() => mockMedicationStore);
    });

    it('ACT-T1: should log dose with correct data when "Take Now" tapped', async () => {
      // Arrange
      (medicationRepository.getById as jest.Mock).mockResolvedValue(mockMedication);

      // Act
      const result = await handleTakeNow('med-1', 'sched-1');

      // Assert
      expect(result).toBe(true);
      expect(medicationRepository.getById).toHaveBeenCalledWith('med-1');
      expect(mockMedicationStore.logDose).toHaveBeenCalledWith(
        expect.objectContaining({
          medicationId: 'med-1',
          scheduleId: 'sched-1',
          quantity: 2, // From schedule dosage
          dosageAmount: 50,
          dosageUnit: 'mg',
          notes: 'Logged from notification',
        })
      );
      expect(notifyUserOfError).not.toHaveBeenCalled();
    });

    it('ACT-T2: should use default quantity when schedule not found', async () => {
      // Arrange
      const medWithoutSchedule = { ...mockMedication, schedule: [] };
      (medicationRepository.getById as jest.Mock).mockResolvedValue(medWithoutSchedule);

      // Act
      const result = await handleTakeNow('med-1', 'sched-999');

      // Assert
      expect(result).toBe(true);
      expect(mockMedicationStore.logDose).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 1, // Falls back to defaultQuantity
        })
      );
    });

    it('ACT-T3: should not log dose when medication not found and notify user (HAND-138, SUP-145)', async () => {
      // Arrange
      (medicationRepository.getById as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await handleTakeNow('med-999', 'sched-1');

      // Assert
      expect(result).toBe(false);
      expect(mockMedicationStore.logDose).not.toHaveBeenCalled();
      expect(notifyUserOfError).toHaveBeenCalledWith(
        'data',
        expect.stringContaining('problem with your medication'),
        expect.any(Error),
        expect.objectContaining({ medicationId: 'med-999', scheduleId: 'sched-1' })
      );
    });

    it('ACT-T4: should return false and notify user when medication has invalid configuration (HAND-138, HAND-238)', async () => {
      // Arrange
      const invalidMed = { ...mockMedication, dosageAmount: undefined };
      (medicationRepository.getById as jest.Mock).mockResolvedValue(invalidMed);

      // Act
      const result = await handleTakeNow('med-1', 'sched-1');

      // Assert
      expect(result).toBe(false);
      expect(mockMedicationStore.logDose).not.toHaveBeenCalled();
      expect(notifyUserOfError).toHaveBeenCalledWith(
        'data',
        expect.stringContaining('problem with your medication data'),
        expect.any(Error),
        expect.objectContaining({ medicationId: 'med-1', scheduleId: 'sched-1' })
      );
    });
  });

  describe('Take All Actions', () => {
    const mockMedA: Medication = {
      id: 'med-A',
      name: 'Medication A',
      type: 'preventative',
      dosageAmount: 50,
      dosageUnit: 'mg',
      scheduleFrequency: 'daily',
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      schedule: [
        {
          id: 'sched-A',
          medicationId: 'med-A',
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
        },
      ],
    };

    const mockMedB: Medication = {
      id: 'med-B',
      name: 'Medication B',
      type: 'preventative',
      dosageAmount: 100,
      dosageUnit: 'mg',
      scheduleFrequency: 'daily',
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      schedule: [
        {
          id: 'sched-B',
          medicationId: 'med-B',
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 2,
          enabled: true,
        },
      ],
    };

    let mockMedicationStore: any;

    beforeEach(() => {
      mockMedicationStore = {
        logDose: jest.fn().mockResolvedValue(undefined),
      };

      (useMedicationStore.getState as jest.Mock) = jest.fn(() => mockMedicationStore);
    });

    it('ACT-TA1: should log dose for EACH medication when "Take All" tapped', async () => {
      // Arrange
      (medicationRepository.getById as jest.Mock)
        .mockResolvedValueOnce(mockMedA)
        .mockResolvedValueOnce(mockMedB);

      // Act
      const result = await handleTakeAllNow(['med-A', 'med-B'], ['sched-A', 'sched-B']);

      // Assert
      expect(result).toEqual({ success: 2, total: 2 });
      expect(mockMedicationStore.logDose).toHaveBeenCalledTimes(2);
      expect(mockMedicationStore.logDose).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          medicationId: 'med-A',
          scheduleId: 'sched-A',
          quantity: 1,
        })
      );
      expect(mockMedicationStore.logDose).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          medicationId: 'med-B',
          scheduleId: 'sched-B',
          quantity: 2,
        })
      );
      expect(notifyUserOfError).not.toHaveBeenCalled();
    });

    it('ACT-TA2: should continue logging even if one medication fails (resilient) and notify user', async () => {
      // Arrange
      (medicationRepository.getById as jest.Mock)
        .mockResolvedValueOnce(null) // Med A not found
        .mockResolvedValueOnce(mockMedB); // Med B found

      // Act
      const result = await handleTakeAllNow(['med-A', 'med-B'], ['sched-A', 'sched-B']);

      // Assert
      expect(result).toEqual({ success: 1, total: 2 });
      expect(mockMedicationStore.logDose).toHaveBeenCalledTimes(1); // Only Med B logged
      expect(mockMedicationStore.logDose).toHaveBeenCalledWith(
        expect.objectContaining({
          medicationId: 'med-B',
        })
      );
      // Verify error notification for failed medication (HAND-238)
      expect(notifyUserOfError).toHaveBeenCalledWith(
        'data',
        expect.stringContaining('could not be logged'),
        expect.any(Error),
        expect.objectContaining({ medicationId: 'med-A' })
      );
    });

    it('ACT-TA3: should handle empty medication arrays and log to Sentry (HAND-254)', async () => {
      // Act
      const result = await handleTakeAllNow([], []);

      // Assert
      expect(result).toEqual({ success: 0, total: 0 });
      expect(mockMedicationStore.logDose).not.toHaveBeenCalled();
      // Verify Sentry logging for unexpected empty list
      expectSentryError(Sentry.captureException as jest.Mock, 'empty medication list');
    });
  });

  describe('Snooze Actions', () => {
    const mockMedication: Medication = {
      id: 'med-1',
      name: 'Test Medication',
      type: 'preventative',
      dosageAmount: 50,
      dosageUnit: 'mg',
      scheduleFrequency: 'daily',
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      schedule: [],
    };

    let mockNotificationSettingsStore: any;

    beforeEach(() => {
      mockNotificationSettingsStore = {
        getEffectiveSettings: jest.fn().mockReturnValue({
          timeSensitiveEnabled: true,
          followUpDelay: 30,
          criticalAlertsEnabled: false,
        }),
      };

      (useNotificationSettingsStore.getState as jest.Mock) = jest.fn(
        () => mockNotificationSettingsStore
      );
    });

    it('ACT-SN1: should schedule ONE-TIME notification when "Snooze" tapped', async () => {
      // Arrange
      (medicationRepository.getById as jest.Mock).mockResolvedValue(mockMedication);
      const beforeSnooze = Date.now();

      // Act
      const result = await handleSnooze('med-1', 'sched-1', 10); // Snooze for 10 minutes

      // Assert
      expect(result).toBe(true);
      expect(notifyUserOfError).not.toHaveBeenCalled(); // Should not have errored
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      
      const scheduleCall = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      expect(scheduleCall.content.title).toContain('Test Medication');
      expect(scheduleCall.content.body).toContain('snoozed');
      expect(scheduleCall.content.data).toEqual({
        medicationId: 'med-1',
        scheduleId: 'sched-1',
      });
      
      // Verify trigger is a Date (one-time), not DAILY
      const triggerTime = scheduleCall.trigger.getTime();
      const expectedTime = beforeSnooze + 10 * 60 * 1000;
      expect(triggerTime).toBeGreaterThanOrEqual(expectedTime - 1000); // Allow 1s tolerance
      expect(triggerTime).toBeLessThanOrEqual(expectedTime + 1000);
      expect(notifyUserOfError).not.toHaveBeenCalled();
    });

    it('ACT-SN2: should use timeSensitive setting when scheduling snooze', async () => {
      // Arrange
      (medicationRepository.getById as jest.Mock).mockResolvedValue(mockMedication);
      mockNotificationSettingsStore.getEffectiveSettings.mockReturnValue({
        timeSensitiveEnabled: true,
      });

      // Act
      await handleSnooze('med-1', 'sched-1', 10);

      // Assert
      const scheduleCall = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      expect(scheduleCall.content.interruptionLevel).toBe('timeSensitive');
    });

    it('ACT-SN3: should not schedule if medication not found and notify user (HAND-138, HAND-238)', async () => {
      // Arrange
      (medicationRepository.getById as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await handleSnooze('med-999', 'sched-1', 10);

      // Assert
      expect(result).toBe(false);
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(notifyUserOfError).toHaveBeenCalledWith(
        'data',
        expect.stringContaining('Could not snooze'),
        expect.any(Error),
        expect.objectContaining({ medicationId: 'med-999', scheduleId: 'sched-1' })
      );
    });
  });

  describe('Remind Later Actions', () => {
    const mockMedA: Medication = {
      id: 'med-A',
      name: 'Medication A',
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
      name: 'Medication B',
      type: 'preventative',
      dosageAmount: 100,
      dosageUnit: 'mg',
      scheduleFrequency: 'daily',
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      schedule: [],
    };

    let mockNotificationSettingsStore: any;

    beforeEach(() => {
      mockNotificationSettingsStore = {
        getEffectiveSettings: jest.fn().mockReturnValue({
          timeSensitiveEnabled: false,
        }),
      };

      (useNotificationSettingsStore.getState as jest.Mock) = jest.fn(
        () => mockNotificationSettingsStore
      );
      
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('remind-later-123');
    });

    it('ACT-RL1: should schedule ONE-TIME grouped notification when "Remind Later" tapped', async () => {
      // Arrange
      (medicationRepository.getById as jest.Mock)
        .mockResolvedValueOnce(mockMedA)
        .mockResolvedValueOnce(mockMedB);
      
      const beforeRemind = Date.now();

      // Act
      await handleRemindLater(['med-A', 'med-B'], ['sched-A', 'sched-B'], '08:00', 10);

      // Assert
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      
      const scheduleCall = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      expect(scheduleCall.content.body).toContain('Medication A');
      expect(scheduleCall.content.body).toContain('Medication B');
      expect(scheduleCall.content.data.medicationIds).toEqual(['med-A', 'med-B']);
      expect(scheduleCall.content.data.scheduleIds).toEqual(['sched-A', 'sched-B']);
      expect(scheduleCall.content.data.time).toBe('08:00');
      
      // Verify one-time trigger
      const triggerTime = scheduleCall.trigger.getTime();
      const expectedTime = beforeRemind + 10 * 60 * 1000;
      expect(triggerTime).toBeGreaterThanOrEqual(expectedTime - 1000);
      expect(triggerTime).toBeLessThanOrEqual(expectedTime + 1000);
    });

    it('ACT-RL2: should use timeSensitive if ANY medication has it enabled', async () => {
      // Arrange
      (medicationRepository.getById as jest.Mock)
        .mockResolvedValueOnce(mockMedA)
        .mockResolvedValueOnce(mockMedB);
      
      // First med: no time-sensitive, second med: time-sensitive
      mockNotificationSettingsStore.getEffectiveSettings
        .mockReturnValueOnce({ timeSensitiveEnabled: false })
        .mockReturnValueOnce({ timeSensitiveEnabled: true });

      // Act
      await handleRemindLater(['med-A', 'med-B'], ['sched-A', 'sched-B'], '08:00', 10);

      // Assert
      const scheduleCall = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      expect(scheduleCall.content.interruptionLevel).toBe('timeSensitive');
    });
  });

  describe('Daily Check-in Actions', () => {
    let mockDailyStatusStore: any;

    beforeEach(() => {
      mockDailyStatusStore = {
        logDayStatus: jest.fn().mockResolvedValue(undefined),
      };

      (useDailyStatusStore.getState as jest.Mock) = jest.fn(() => mockDailyStatusStore);
    });

    it('ACT-DC1: should log green status when "Clear Day" tapped', async () => {
      // Arrange
      const testDate = '2025-12-05';

      // Act
      await (dailyCheckinService as any).handleClearDay(testDate);

      // Assert
      expect(mockDailyStatusStore.logDayStatus).toHaveBeenCalledWith(
        testDate,
        'green',
        undefined,
        undefined,
        true // prompted flag
      );
    });

    it('ACT-DC2: should throw error when logging fails', async () => {
      // Arrange
      mockDailyStatusStore.logDayStatus.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect((dailyCheckinService as any).handleClearDay('2025-12-05')).rejects.toThrow(
        'DB error'
      );
    });
  });
});
