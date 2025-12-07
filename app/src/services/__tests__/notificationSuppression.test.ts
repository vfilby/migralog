/**
 * Notification Suppression Logic Tests
 * 
 * Tests for handleIncomingNotification() - the core function that decides
 * whether to show or suppress a notification based on current database state.
 * 
 * Testing Strategy: Suppression over Cancellation
 * - Notifications use DAILY triggers and fire every day
 * - handleIncomingNotification() checks database state at fire time
 * - Returns shouldShowBanner: false to suppress, true to show
 * - This preserves the DAILY schedule and avoids complex cancellation logic
 */

import * as Notifications from 'expo-notifications';
import {
  medicationRepository,
  medicationDoseRepository,
} from '../../database/medicationRepository';
import { episodeRepository } from '../../database/episodeRepository';
import { Medication } from '../../models/types';

// Mock dependencies
jest.mock('expo-notifications');
jest.mock('../../database/medicationRepository');
jest.mock('../../database/episodeRepository');
jest.mock('../../services/errorLogger');
jest.mock('../../store/dailyStatusStore');
jest.mock('../../store/episodeStore');

// Import after mocks
import { handleIncomingNotification } from '../notifications/notificationService';
import { handleDailyCheckinNotification } from '../notifications/dailyCheckinService';
import { useDailyStatusStore } from '../../store/dailyStatusStore';
import { useEpisodeStore } from '../../store/episodeStore';

describe('Notification Suppression Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create mock notification
  function createMockNotification(data: Record<string, any>): Notifications.Notification {
    return {
      request: {
        identifier: `notif-${Date.now()}`,
        content: {
          title: 'Test Notification',
          body: 'Test body',
          data,
        },
        trigger: { type: 'daily', hour: 8, minute: 0 } as any,
      },
      date: Date.now(),
    } as any;
  }

  // Helper to verify suppressed result
  function expectSuppressed(result: Notifications.NotificationBehavior) {
    expect(result).toEqual({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: false,
      shouldShowList: false,
    });
  }

  // Helper to verify shown result
  function expectShown(result: Notifications.NotificationBehavior) {
    expect(result).toEqual({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    });
  }

  describe('Single Medication Notifications', () => {
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
      schedule: [
        {
          id: 'sched-1',
          medicationId: 'med-1',
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
        },
      ],
    };

    it('SUP-S1: should SHOW notification when dose NOT logged for schedule today', async () => {
      // Arrange
      (medicationRepository.getById as jest.Mock).mockResolvedValue(mockMedication);
      (medicationDoseRepository.wasLoggedForScheduleToday as jest.Mock).mockResolvedValue(false);

      const notification = createMockNotification({
        medicationId: 'med-1',
        scheduleId: 'sched-1',
      });

      // Act
      const result = await handleIncomingNotification(notification);

      // Assert
      expectShown(result);
      expect(medicationRepository.getById).toHaveBeenCalledWith('med-1');
      expect(medicationDoseRepository.wasLoggedForScheduleToday).toHaveBeenCalledWith(
        'med-1',
        'sched-1',
        '08:00',
        'America/Los_Angeles'
      );
    });

    it('SUP-S2: should SUPPRESS notification when dose LOGGED for schedule today', async () => {
      // Arrange
      (medicationRepository.getById as jest.Mock).mockResolvedValue(mockMedication);
      (medicationDoseRepository.wasLoggedForScheduleToday as jest.Mock).mockResolvedValue(true);

      const notification = createMockNotification({
        medicationId: 'med-1',
        scheduleId: 'sched-1',
      });

      // Act
      const result = await handleIncomingNotification(notification);

      // Assert
      expectSuppressed(result);
      expect(medicationDoseRepository.wasLoggedForScheduleToday).toHaveBeenCalledWith(
        'med-1',
        'sched-1',
        '08:00',
        'America/Los_Angeles'
      );
    });

    it('SUP-S3: should SHOW notification when medication not found in database (fail-safe)', async () => {
      // Arrange
      (medicationRepository.getById as jest.Mock).mockResolvedValue(null);

      const notification = createMockNotification({
        medicationId: 'med-999',
        scheduleId: 'sched-1',
      });

      // Act
      const result = await handleIncomingNotification(notification);

      // Assert
      expectShown(result);
      expect(medicationRepository.getById).toHaveBeenCalledWith('med-999');
    });

    it('SUP-S4: should SHOW notification when schedule not found on medication (fail-safe)', async () => {
      // Arrange
      const medWithoutSchedule: Medication = {
        ...mockMedication,
        schedule: [], // No schedules
      };
      (medicationRepository.getById as jest.Mock).mockResolvedValue(medWithoutSchedule);

      const notification = createMockNotification({
        medicationId: 'med-1',
        scheduleId: 'sched-999',
      });

      // Act
      const result = await handleIncomingNotification(notification);

      // Assert
      expectShown(result);
    });

    it('SUP-S5: should SHOW notification when database error occurs (fail-safe)', async () => {
      // Arrange
      (medicationRepository.getById as jest.Mock).mockRejectedValue(new Error('Database error'));

      const notification = createMockNotification({
        medicationId: 'med-1',
        scheduleId: 'sched-1',
      });

      // Act
      const result = await handleIncomingNotification(notification);

      // Assert
      expectShown(result);
    });
  });

  describe('Grouped Medication Notifications', () => {
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

    const mockMedC: Medication = {
      id: 'med-C',
      name: 'Medication C',
      type: 'preventative',
      dosageAmount: 25,
      dosageUnit: 'mg',
      scheduleFrequency: 'daily',
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      schedule: [
        {
          id: 'sched-C',
          medicationId: 'med-C',
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
        },
      ],
    };

    it('SUP-G1: should SHOW notification when NONE of the medications logged', async () => {
      // Arrange
      (medicationRepository.getById as jest.Mock)
        .mockResolvedValueOnce(mockMedA)
        .mockResolvedValueOnce(mockMedB)
        .mockResolvedValueOnce(mockMedC);
      
      (medicationDoseRepository.wasLoggedForScheduleToday as jest.Mock)
        .mockResolvedValue(false); // None logged

      const notification = createMockNotification({
        medicationIds: ['med-A', 'med-B', 'med-C'],
        scheduleIds: ['sched-A', 'sched-B', 'sched-C'],
        time: '08:00',
      });

      // Act
      const result = await handleIncomingNotification(notification);

      // Assert
      expectShown(result);
      expect(medicationDoseRepository.wasLoggedForScheduleToday).toHaveBeenCalledTimes(3);
    });

    it('SUP-G2: should SUPPRESS notification when ALL medications logged', async () => {
      // Arrange
      (medicationRepository.getById as jest.Mock)
        .mockResolvedValueOnce(mockMedA)
        .mockResolvedValueOnce(mockMedB)
        .mockResolvedValueOnce(mockMedC);
      
      (medicationDoseRepository.wasLoggedForScheduleToday as jest.Mock)
        .mockResolvedValue(true); // All logged

      const notification = createMockNotification({
        medicationIds: ['med-A', 'med-B', 'med-C'],
        scheduleIds: ['sched-A', 'sched-B', 'sched-C'],
        time: '08:00',
      });

      // Act
      const result = await handleIncomingNotification(notification);

      // Assert
      expectSuppressed(result);
    });

    it('SUP-G3: should SHOW notification when SOME medications logged (partial)', async () => {
      // Arrange
      (medicationRepository.getById as jest.Mock)
        .mockResolvedValueOnce(mockMedA)
        .mockResolvedValueOnce(mockMedB)
        .mockResolvedValueOnce(mockMedC);
      
      (medicationDoseRepository.wasLoggedForScheduleToday as jest.Mock)
        .mockResolvedValueOnce(true)  // Med A logged
        .mockResolvedValueOnce(false) // Med B NOT logged
        .mockResolvedValueOnce(false); // Med C NOT logged

      const notification = createMockNotification({
        medicationIds: ['med-A', 'med-B', 'med-C'],
        scheduleIds: ['sched-A', 'sched-B', 'sched-C'],
        time: '08:00',
      });

      // Act
      const result = await handleIncomingNotification(notification);

      // Assert
      expectShown(result);
      // Note: Ideally notification content would be updated to only show Med B and C
      // but current implementation shows all. This is marked as TODO in the spec.
    });

    it('SUP-G4: should SHOW notification when one medication not found (fail-safe)', async () => {
      // Arrange
      (medicationRepository.getById as jest.Mock)
        .mockResolvedValueOnce(mockMedA)
        .mockResolvedValueOnce(null) // Med B not found
        .mockResolvedValueOnce(mockMedC);
      
      (medicationDoseRepository.wasLoggedForScheduleToday as jest.Mock)
        .mockResolvedValueOnce(false) // Med A not logged
        .mockResolvedValueOnce(false); // Med C not logged

      const notification = createMockNotification({
        medicationIds: ['med-A', 'med-B', 'med-C'],
        scheduleIds: ['sched-A', 'sched-B', 'sched-C'],
        time: '08:00',
      });

      // Act
      const result = await handleIncomingNotification(notification);

      // Assert
      expectShown(result);
    });
  });

  describe('Daily Check-in Notifications', () => {
    let mockEpisodeStore: any;
    let mockDailyStatusStore: any;

    beforeEach(() => {
      // Create mock store instances
      mockEpisodeStore = {
        currentEpisode: null,
        loadCurrentEpisode: jest.fn().mockResolvedValue(undefined),
      };

      mockDailyStatusStore = {
        getDayStatus: jest.fn().mockResolvedValue(null),
      };

      // Mock the store getState methods
      (useEpisodeStore.getState as jest.Mock) = jest.fn(() => mockEpisodeStore);
      (useDailyStatusStore.getState as jest.Mock) = jest.fn(() => mockDailyStatusStore);
      
      // Mock episodeRepository.getEpisodesForDate to return empty array by default
      (episodeRepository.getEpisodesForDate as jest.Mock).mockResolvedValue([]);
    });

    it('SUP-D1: should SHOW notification when no status logged and no active episode', async () => {
      // Arrange
      const notification = createMockNotification({
        type: 'daily_checkin',
        date: '2025-12-05',
      });

      // Mock: No active episode
      mockEpisodeStore.currentEpisode = null;
      
      // Mock: No status for today
      mockDailyStatusStore.getDayStatus.mockResolvedValue(null);

      // Act
      const result = await handleDailyCheckinNotification(notification);

      // Assert
      expectShown(result!);
      expect(mockEpisodeStore.loadCurrentEpisode).toHaveBeenCalled();
      expect(mockDailyStatusStore.getDayStatus).toHaveBeenCalled();
    });

    it('SUP-D2: should SUPPRESS notification when status already logged for today', async () => {
      // Arrange
      const notification = createMockNotification({
        type: 'daily_checkin',
        date: '2025-12-05',
      });

      // Mock: No active episode
      mockEpisodeStore.currentEpisode = null;
      
      // Mock: Status exists for today
      mockDailyStatusStore.getDayStatus.mockResolvedValue({
        date: '2025-12-05',
        status: 'green',
        createdAt: Date.now(),
      });

      // Act
      const result = await handleDailyCheckinNotification(notification);

      // Assert
      expectSuppressed(result!);
    });

    it('SUP-D3: should SUPPRESS notification when active migraine episode exists', async () => {
      // Arrange
      const notification = createMockNotification({
        type: 'daily_checkin',
        date: '2025-12-05',
      });

      // Mock: Active episode exists
      mockEpisodeStore.currentEpisode = {
        id: 'episode-1',
        startTime: Date.now() - 3600000, // 1 hour ago
        active: true,
        createdAt: Date.now() - 3600000,
        updatedAt: Date.now(),
      };

      // Act
      const result = await handleDailyCheckinNotification(notification);

      // Assert
      expectSuppressed(result!);
    });

    it('SUP-D4: should SUPPRESS notification when episode ended but exists for today (red day)', async () => {
      // Arrange
      const notification = createMockNotification({
        type: 'daily_checkin',
        date: '2025-12-05',
      });

      // Mock: No active episode (episode was ended)
      mockEpisodeStore.currentEpisode = null;
      
      // Mock: No status for today
      mockDailyStatusStore.getDayStatus.mockResolvedValue(null);

      // BUSINESS RULE: ANY episode on the day = red day = suppress notification
      // Mock episodeRepository to return an ended episode for today
      const mockEpisode = {
        id: 'episode-1',
        startTime: Date.now() - 7200000, // 2 hours ago
        endTime: Date.now() - 3600000, // 1 hour ago (ended)
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: Date.now() - 7200000,
        updatedAt: Date.now() - 3600000,
      };
      
      (episodeRepository.getEpisodesForDate as jest.Mock).mockResolvedValue([mockEpisode]);

      // Act
      const result = await handleDailyCheckinNotification(notification);

      // Assert
      expectSuppressed(result!);
    });

    it('SUP-D-EDGE1: should return null for non-daily-checkin notification (not handled)', async () => {
      // Arrange
      const notification = createMockNotification({
        type: 'some_other_type',
      });

      // Act
      const result = await handleDailyCheckinNotification(notification);

      // Assert
      expect(result).toBeNull();
    });

    it('SUP-D-EDGE2: should SUPPRESS notification on error (fail-safe)', async () => {
      // Arrange
      const notification = createMockNotification({
        type: 'daily_checkin',
        date: '2025-12-05',
      });

      // Mock: Database error during load
      mockEpisodeStore.loadCurrentEpisode.mockRejectedValue(new Error('DB error'));

      // Act
      const result = await handleDailyCheckinNotification(notification);

      // Assert
      // Changed behavior: suppress on error to prevent spurious notifications
      // Rationale: Better to miss one daily check-in prompt than to show a notification
      // to a user who already had an episode (more disruptive)
      expectSuppressed(result!);
    });
  });

  describe('Follow-up Notifications', () => {
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
      schedule: [
        {
          id: 'sched-1',
          medicationId: 'med-1',
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
        },
      ],
    };

    it('SUP-F1: should SUPPRESS follow-up when medication was logged (any time, not just after primary)', async () => {
      // Arrange
      (medicationRepository.getById as jest.Mock).mockResolvedValue(mockMedication);
      (medicationDoseRepository.wasLoggedForScheduleToday as jest.Mock).mockResolvedValue(true);

      const notification = createMockNotification({
        medicationId: 'med-1',
        scheduleId: 'sched-1',
        isFollowUp: true, // Follow-up marker
      });

      // Act
      const result = await handleIncomingNotification(notification);

      // Assert
      expectSuppressed(result);
      // LOGIC FIX (SUP-528): Follow-ups check logged status only (not timing)
      // Scheduled notifications use DAILY triggers and check if dose was logged for schedule today
      // No time-based conditions - suppression is based solely on whether dose is logged
    });

    it('SUP-F2: should SHOW follow-up when medication was NOT logged', async () => {
      // Arrange
      (medicationRepository.getById as jest.Mock).mockResolvedValue(mockMedication);
      (medicationDoseRepository.wasLoggedForScheduleToday as jest.Mock).mockResolvedValue(false);

      const notification = createMockNotification({
        medicationId: 'med-1',
        scheduleId: 'sched-1',
        isFollowUp: true,
      });

      // Act
      const result = await handleIncomingNotification(notification);

      // Assert
      expectShown(result);
    });
  });
});
