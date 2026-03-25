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
jest.mock('../../database/scheduledNotificationRepository');
jest.mock('../notifications/NotificationDismissalService');

// Import after mocks
import { dismissMedicationNotification } from '../notifications/medicationNotifications';
import { logger } from '../../utils/logger';
import { medicationRepository, medicationDoseRepository } from '../../database/medicationRepository';
import { notificationDismissalService } from '../notifications/NotificationDismissalService';

// Setup Notifications mock methods
const mockGetPresentedNotificationsAsync = jest.fn();
const mockDismissNotificationAsync = jest.fn();

(Notifications as any).getPresentedNotificationsAsync = mockGetPresentedNotificationsAsync;
(Notifications as any).dismissNotificationAsync = mockDismissNotificationAsync;

// Mock the NotificationDismissalService
const mockNotificationDismissalService = notificationDismissalService as jest.Mocked<typeof notificationDismissalService>;

describe('Notification Dismiss Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPresentedNotificationsAsync.mockClear();
    mockDismissNotificationAsync.mockClear();
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

      mockGetPresentedNotificationsAsync.mockResolvedValue(presentedNotifs);
      mockDismissNotificationAsync.mockResolvedValue(undefined);

      // Mock the cross-reference service to return shouldDismiss: true for notif-1
      mockNotificationDismissalService.shouldDismissNotification.mockImplementation(
        async (notificationId, medicationId, scheduleId) => {
          if (notificationId === 'notif-1' && medicationId === 'med-1' && scheduleId === 'sched-1') {
            return {
              shouldDismiss: true,
              strategy: 'database_id_lookup',
              confidence: 100,
              context: 'Test match',
            };
          }
          return {
            shouldDismiss: false,
            strategy: 'none',
            confidence: 0,
            context: 'No match',
          };
        }
      );

      // Act
      await dismissMedicationNotification('med-1', 'sched-1');

      // Assert
      expect(mockDismissNotificationAsync).toHaveBeenCalledTimes(1);
      expect(mockDismissNotificationAsync).toHaveBeenCalledWith('notif-1');
    });

    it('DIS-2: should not error when notification NOT in tray', async () => {
      // Arrange
      mockGetPresentedNotificationsAsync.mockResolvedValue([]);
      mockDismissNotificationAsync.mockResolvedValue(undefined);

      // Act & Assert - should not throw
      await expect(dismissMedicationNotification('med-999', 'sched-1')).resolves.not.toThrow();
      expect(mockDismissNotificationAsync).not.toHaveBeenCalled();
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

      mockGetPresentedNotificationsAsync.mockResolvedValue(presentedNotifs);
      mockDismissNotificationAsync.mockResolvedValue(undefined);

      // Mock the cross-reference service to return shouldDismiss: true only for exact match
      mockNotificationDismissalService.shouldDismissNotification.mockImplementation(
        async (notificationId, medicationId, scheduleId) => {
          if (notificationId === 'notif-1' && medicationId === 'med-1' && scheduleId === 'sched-A') {
            return {
              shouldDismiss: true,
              strategy: 'database_id_lookup',
              confidence: 100,
              context: 'Exact schedule match',
            };
          }
          return {
            shouldDismiss: false,
            strategy: 'none',
            confidence: 0,
            context: 'Schedule mismatch',
          };
        }
      );

      // Act - BREAKING CHANGE (DIS-106b): scheduleId is now required
      // Dismiss only sched-A
      await dismissMedicationNotification('med-1', 'sched-A');

      // Assert - Should dismiss ONLY sched-A, not sched-B
      // This removes the "dismiss all" bug vector
      expect(mockDismissNotificationAsync).toHaveBeenCalledTimes(1);
      expect(mockDismissNotificationAsync).toHaveBeenCalledWith('notif-1');
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

      mockGetPresentedNotificationsAsync.mockResolvedValue(presentedNotifs);
      mockDismissNotificationAsync.mockResolvedValue(undefined);

      // Mock the cross-reference service to handle grouped notification safety logic
      mockNotificationDismissalService.shouldDismissNotification.mockImplementation(
        async (notificationId, medicationId, scheduleId) => {
          if (notificationId === 'grouped-notif-1' && medicationId === 'med-A' && scheduleId === 'sched-1') {
            return {
              shouldDismiss: true,
              strategy: 'database_id_lookup',
              confidence: 100,
              context: 'All medications in group are logged',
            };
          }
          return {
            shouldDismiss: false,
            strategy: 'none',
            confidence: 0,
            context: 'Not all medications logged',
          };
        }
      );

      // Act - med-A with correct schedule (last medication to be logged)
      await dismissMedicationNotification('med-A', 'sched-1');

      // Assert - Should dismiss because ALL medications are now logged
      expect(mockDismissNotificationAsync).toHaveBeenCalledTimes(1);
      expect(mockDismissNotificationAsync).toHaveBeenCalledWith('grouped-notif-1');
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

      mockGetPresentedNotificationsAsync.mockResolvedValue(presentedNotifs);
      mockDismissNotificationAsync.mockRejectedValue(new Error('Dismiss failed'));

      // Mock the cross-reference service to indicate this notification should be dismissed
      mockNotificationDismissalService.shouldDismissNotification.mockResolvedValue({
        shouldDismiss: true,
        strategy: 'database_id_lookup',
        confidence: 100,
        context: 'Test match',
      });

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

      mockGetPresentedNotificationsAsync.mockResolvedValue(presentedNotifs);
      mockDismissNotificationAsync.mockResolvedValue(undefined);

      // Mock the cross-reference service to indicate notification should NOT be dismissed (missing data)
      mockNotificationDismissalService.shouldDismissNotification.mockResolvedValue({
        shouldDismiss: false,
        strategy: 'none',
        confidence: 0,
        context: 'Missing notification data',
      });

      // Act
      await dismissMedicationNotification('med-1', 'sched-1');

      // Assert - Should not crash, should not dismiss
      expect(mockDismissNotificationAsync).not.toHaveBeenCalled();
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

      mockGetPresentedNotificationsAsync.mockResolvedValue(presentedNotifs);
      mockDismissNotificationAsync.mockResolvedValue(undefined);

      // Mock the cross-reference service to indicate both notifications should be dismissed
      mockNotificationDismissalService.shouldDismissNotification.mockResolvedValue({
        shouldDismiss: true,
        strategy: 'database_id_lookup',
        confidence: 100,
        context: 'Multiple matches',
      });

      // Act
      await dismissMedicationNotification('med-1', 'sched-1');

      // Assert - Should dismiss both
      expect(mockDismissNotificationAsync).toHaveBeenCalledTimes(2);
      expect(mockDismissNotificationAsync).toHaveBeenNthCalledWith(1, 'notif-1');
      expect(mockDismissNotificationAsync).toHaveBeenNthCalledWith(2, 'notif-2');
    });
  });
});
