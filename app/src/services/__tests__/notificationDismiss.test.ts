/**
 * Notification Dismiss Logic Tests
 * 
 * Tests for dismissing presented notifications from the notification tray.
 * 
 * Key Principle: With suppression-based approach
 * - Dismiss REMOVES notification from tray (user-facing)
 * - But does NOT cancel scheduled notification (suppression handles that)
 * - This is simpler than old approach that cancelled schedules
 */

import * as Notifications from 'expo-notifications';

// Mock dependencies
jest.mock('expo-notifications');
jest.mock('../../services/errorLogger');
jest.mock('../../utils/logger');
jest.mock('../../database/medicationRepository');

// Import after mocks
import { dismissMedicationNotification } from '../notifications/medicationNotifications';
import { logger } from '../../utils/logger';
import { medicationRepository, medicationDoseRepository } from '../../database/medicationRepository';

// Setup Notifications mock methods
(Notifications as any).getPresentedNotificationsAsync = jest.fn();
(Notifications as any).dismissNotificationAsync = jest.fn();

describe('Notification Dismiss Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  // Helper to create mock presented notification
  function createPresentedNotification(
    identifier: string,
    data: Record<string, any>
  ): Notifications.Notification {
    return {
      request: {
        identifier,
        content: {
          title: 'Test',
          body: 'Test',
          data,
        },
        trigger: { type: 'daily' } as any,
      },
      date: Date.now(),
    } as any;
  }

  describe('Single Medication Notifications', () => {
    it('DIS-1: should dismiss notification for medication when in tray', async () => {
      // Arrange
      const presentedNotifs = [
        createPresentedNotification('notif-1', {
          medicationId: 'med-1',
          scheduleId: 'sched-1',
        }),
        createPresentedNotification('notif-2', {
          medicationId: 'med-2',
          scheduleId: 'sched-2',
        }),
      ];

      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue(
        presentedNotifs
      );
      (Notifications.dismissNotificationAsync as jest.Mock).mockResolvedValue(undefined);

      // Act
      await dismissMedicationNotification('med-1', 'sched-1');

      // Assert
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledTimes(1);
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('notif-1');
    });

    it('DIS-2: should not error when notification NOT in tray', async () => {
      // Arrange
      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue([]);
      (Notifications.dismissNotificationAsync as jest.Mock).mockResolvedValue(undefined);

      // Act & Assert - should not throw
      await expect(dismissMedicationNotification('med-999', 'sched-1')).resolves.not.toThrow();
      expect(Notifications.dismissNotificationAsync).not.toHaveBeenCalled();
    });

    it('DIS-3: should only match exact scheduleId (BREAKING CHANGE: scheduleId required)', async () => {
      // Arrange
      const presentedNotifs = [
        createPresentedNotification('notif-1', {
          medicationId: 'med-1',
          scheduleId: 'sched-A',
        }),
        createPresentedNotification('notif-2', {
          medicationId: 'med-1',
          scheduleId: 'sched-B',
        }),
      ];

      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue(
        presentedNotifs
      );

      // Act - BREAKING CHANGE (DIS-106b): scheduleId is now required
      // Dismiss only sched-A
      await dismissMedicationNotification('med-1', 'sched-A');

      // Assert - Should dismiss ONLY sched-A, not sched-B
      // This removes the "dismiss all" bug vector
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledTimes(1);
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('notif-1');
    });
  });

  describe('Grouped Medication Notifications', () => {
    it('DIS-4: should only dismiss grouped notification when ALL medications are logged (SAFETY)', async () => {
      // Arrange
      const presentedNotifs = [
        createPresentedNotification('grouped-notif-1', {
          medicationIds: ['med-A', 'med-B', 'med-C'],
          scheduleIds: ['sched-A', 'sched-B', 'sched-C'],
          time: '08:00',
        }),
      ];

      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue(
        presentedNotifs
      );

      // Mock medications with schedules
      medicationRepository.getById = jest.fn().mockImplementation((id: string) => {
        return Promise.resolve({
          id,
          name: `Med ${id}`,
          schedule: [{
            id: `sched-${id.split('-')[1]}`,
            time: '08:00',
            timezone: 'America/Los_Angeles',
          }],
        });
      });

      // SAFETY FIX: Mock that only med-B is logged, med-A and med-C are not logged
      medicationDoseRepository.wasLoggedForScheduleToday = jest.fn().mockImplementation(
        (medId: string) => {
          return Promise.resolve(medId === 'med-B'); // Only med-B is logged
        }
      );

      // Act - Logging med-B (middle of group)
      await dismissMedicationNotification('med-B', 'sched-B');

      // Assert - Should NOT dismiss because not all medications are logged yet
      expect(Notifications.dismissNotificationAsync).not.toHaveBeenCalled();
    });

    it('DIS-5: should match scheduleId index when dismissing from group', async () => {
      // Arrange
      const presentedNotifs = [
        createPresentedNotification('grouped-notif-1', {
          medicationIds: ['med-A', 'med-B'],
          scheduleIds: ['sched-1', 'sched-2'],
        }),
      ];

      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue(
        presentedNotifs
      );

      // Act - med-A with WRONG schedule
      await dismissMedicationNotification('med-A', 'sched-999');

      // Assert - Should NOT dismiss (schedule doesn't match index)
      expect(Notifications.dismissNotificationAsync).not.toHaveBeenCalled();
    });

    it('DIS-6: should dismiss grouped notification when ALL medications logged (SAFETY)', async () => {
      // Arrange
      const presentedNotifs = [
        createPresentedNotification('grouped-notif-1', {
          medicationIds: ['med-A', 'med-B'],
          scheduleIds: ['sched-1', 'sched-2'],
          time: '08:00',
        }),
      ];

      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue(
        presentedNotifs
      );

      // Mock medications with schedules
      medicationRepository.getById = jest.fn().mockImplementation((id: string) => {
        const scheduleId = id === 'med-A' ? 'sched-1' : 'sched-2';
        return Promise.resolve({
          id,
          name: `Med ${id}`,
          schedule: [{
            id: scheduleId,
            time: '08:00',
            timezone: 'America/Los_Angeles',
          }],
        });
      });

      // SAFETY FIX: Mock that ALL medications are logged (med-A and med-B)
      medicationDoseRepository.wasLoggedForScheduleToday = jest.fn().mockResolvedValue(true);

      // Act - med-A with correct schedule (last medication to be logged)
      await dismissMedicationNotification('med-A', 'sched-1');

      // Assert - Should dismiss because ALL medications are now logged
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledTimes(1);
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('grouped-notif-1');
    });
  });

  describe('Error Handling', () => {
    it('DIS-ERR1: should handle getPresentedNotificationsAsync error gracefully', async () => {
      // Arrange
      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockRejectedValue(
        new Error('Platform error')
      );

      // Act & Assert - should not throw
      await expect(dismissMedicationNotification('med-1', 'sched-1')).resolves.not.toThrow();
      expect(Notifications.dismissNotificationAsync).not.toHaveBeenCalled();
      
      // DIS-187: Verify error is logged with context
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Platform error') }),
        expect.objectContaining({
          medicationId: 'med-1',
          scheduleId: 'sched-1',
        })
      );
    });

    it('DIS-ERR2: should handle dismissNotificationAsync error gracefully', async () => {
      // Arrange
      const presentedNotifs = [
        createPresentedNotification('notif-1', {
          medicationId: 'med-1',
          scheduleId: 'sched-1',
        }),
      ];

      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue(
        presentedNotifs
      );
      (Notifications.dismissNotificationAsync as jest.Mock).mockRejectedValue(
        new Error('Dismiss failed')
      );

      // Act & Assert - should not throw
      await expect(dismissMedicationNotification('med-1', 'sched-1')).resolves.not.toThrow();
      
      // DIS-208: Verify error is logged with context
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Dismiss failed') }),
        expect.objectContaining({
          notificationId: 'notif-1',
          medicationId: 'med-1',
          scheduleId: 'sched-1',
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('DIS-EDGE1: should handle notification with missing data fields', async () => {
      // Arrange
      const presentedNotifs = [
        createPresentedNotification('notif-1', {}), // No medication data
      ];

      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue(
        presentedNotifs
      );

      // Act
      await dismissMedicationNotification('med-1', 'sched-1');

      // Assert - Should not crash, should not dismiss
      expect(Notifications.dismissNotificationAsync).not.toHaveBeenCalled();
    });

    it('DIS-EDGE2: should handle empty presented notifications array', async () => {
      // Arrange
      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue([]);

      // Act & Assert
      await expect(dismissMedicationNotification('med-1', 'sched-1')).resolves.not.toThrow();
      expect(Notifications.dismissNotificationAsync).not.toHaveBeenCalled();
    });

    it('DIS-EDGE3: should dismiss multiple matching notifications', async () => {
      // Arrange - Multiple notifications for same medication (shouldn't happen, but handle it)
      const presentedNotifs = [
        createPresentedNotification('notif-1', {
          medicationId: 'med-1',
          scheduleId: 'sched-1',
        }),
        createPresentedNotification('notif-2', {
          medicationId: 'med-1',
          scheduleId: 'sched-1',
        }),
      ];

      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue(
        presentedNotifs
      );
      (Notifications.dismissNotificationAsync as jest.Mock).mockResolvedValue(undefined);

      // Act
      await dismissMedicationNotification('med-1', 'sched-1');

      // Assert - Should dismiss both
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledTimes(2);
      expect(Notifications.dismissNotificationAsync).toHaveBeenNthCalledWith(1, 'notif-1');
      expect(Notifications.dismissNotificationAsync).toHaveBeenNthCalledWith(2, 'notif-2');
    });
  });
});
