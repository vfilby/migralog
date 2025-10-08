import { notificationService, NotificationPermissions } from '../notificationService';
import * as Notifications from 'expo-notifications';
import {
  medicationRepository,
  medicationDoseRepository,
} from '../../database/medicationRepository';
import { Medication, MedicationSchedule } from '../../models/types';

// Mock dependencies
jest.mock('expo-notifications');
jest.mock('../../database/medicationRepository');
jest.mock('../../services/errorLogger');

describe('notificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initialize', () => {
    it('should initialize notification service', async () => {
      (Notifications.setNotificationCategoryAsync as jest.Mock).mockResolvedValue(undefined);
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({
        remove: jest.fn(),
      });
      (Notifications.addNotificationReceivedListener as jest.Mock).mockReturnValue({
        remove: jest.fn(),
      });

      await notificationService.initialize();

      // Verify initialization completes without error
      expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalled();
    });
  });

  describe('requestPermissions', () => {
    it('should request notification permissions', async () => {
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
        canAskAgain: true,
        ios: {
          allowsAlert: true,
          allowsSound: true,
          allowsBadge: true,
          allowsCriticalAlerts: false,
        },
      });

      const permissions = await notificationService.requestPermissions();

      expect(permissions.granted).toBe(true);
      expect(permissions.canAskAgain).toBe(true);
      expect(permissions.ios?.allowsAlert).toBe(true);
    });

    it('should handle denied permissions', async () => {
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
        canAskAgain: false,
        ios: undefined,
      });

      const permissions = await notificationService.requestPermissions();

      expect(permissions.granted).toBe(false);
      expect(permissions.canAskAgain).toBe(false);
    });
  });

  describe('getPermissions', () => {
    it('should get current permissions', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
        canAskAgain: true,
        ios: {
          allowsAlert: true,
          allowsSound: true,
          allowsBadge: true,
          allowsCriticalAlerts: false,
        },
      });

      const permissions = await notificationService.getPermissions();

      expect(permissions.granted).toBe(true);
      expect(Notifications.getPermissionsAsync).toHaveBeenCalled();
    });
  });

  describe('scheduleNotification', () => {
    const mockMedication: Medication = {
      id: 'med-123',
      name: 'Test Med',
      type: 'preventative',
      dosageAmount: 100,
      dosageUnit: 'mg',
      defaultDosage: 1,
      scheduleFrequency: 'daily',
      photoUri: null,
      schedule: [],
      startDate: null,
      endDate: null,
      active: true,
      notes: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mockSchedule: MedicationSchedule = {
      id: 'sched-123',
      medicationId: 'med-123',
      time: '09:00',
      dosage: 2,
      enabled: true,
      notificationId: null,
      createdAt: Date.now(),
    };

    it('should schedule a notification for enabled schedule', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-123');

      const notifId = await notificationService.scheduleNotification(
        mockMedication,
        mockSchedule
      );

      expect(notifId).toBe('notif-123');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: `Time for ${mockMedication.name}`,
            data: {
              medicationId: mockMedication.id,
              scheduleId: mockSchedule.id,
            },
          }),
          trigger: expect.objectContaining({
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: 9,
            minute: 0,
          }),
        })
      );
    });

    it('should not schedule notification for disabled schedule', async () => {
      const disabledSchedule: MedicationSchedule = {
        ...mockSchedule,
        enabled: false,
      };

      const notifId = await notificationService.scheduleNotification(
        mockMedication,
        disabledSchedule
      );

      expect(notifId).toBeNull();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('should handle scheduling errors', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(
        new Error('Scheduling failed')
      );

      const notifId = await notificationService.scheduleNotification(
        mockMedication,
        mockSchedule
      );

      expect(notifId).toBeNull();
    });

    it('should schedule for tomorrow if time has passed today', async () => {
      const pastSchedule: MedicationSchedule = {
        ...mockSchedule,
        time: '00:00', // Midnight, already passed
      };

      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-456');

      await notificationService.scheduleNotification(mockMedication, pastSchedule);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: expect.objectContaining({
            hour: 0,
            minute: 0,
          }),
        })
      );
    });
  });

  describe('cancelNotification', () => {
    it('should cancel a scheduled notification', async () => {
      (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockResolvedValue(undefined);

      await notificationService.cancelNotification('notif-123');

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-123');
    });

    it('should handle cancellation errors', async () => {
      (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockRejectedValue(
        new Error('Cancel failed')
      );

      await expect(
        notificationService.cancelNotification('notif-123')
      ).resolves.not.toThrow();
    });
  });

  describe('cancelMedicationNotifications', () => {
    it('should cancel all notifications for a medication', async () => {
      const mockScheduledNotifs = [
        {
          identifier: 'notif-1',
          content: { data: { medicationId: 'med-123' } },
        },
        {
          identifier: 'notif-2',
          content: { data: { medicationId: 'med-123' } },
        },
        {
          identifier: 'notif-3',
          content: { data: { medicationId: 'med-456' } },
        },
      ];

      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue(
        mockScheduledNotifs
      );
      (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockResolvedValue(undefined);

      await notificationService.cancelMedicationNotifications('med-123');

      // Should only cancel notifications for med-123
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-1');
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-2');
    });

    it('should handle errors when cancelling medication notifications', async () => {
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockRejectedValue(
        new Error('Failed to get notifications')
      );

      await expect(
        notificationService.cancelMedicationNotifications('med-123')
      ).resolves.not.toThrow();
    });
  });

  describe('getAllScheduledNotifications', () => {
    it('should return all scheduled notifications', async () => {
      const mockNotifs = [
        { identifier: 'notif-1' },
        { identifier: 'notif-2' },
      ];

      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue(
        mockNotifs
      );

      const result = await notificationService.getAllScheduledNotifications();

      expect(result).toEqual(mockNotifs);
      expect(Notifications.getAllScheduledNotificationsAsync).toHaveBeenCalled();
    });
  });

  describe('cancelAllNotifications', () => {
    it('should cancel all scheduled notifications', async () => {
      (Notifications.cancelAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue(
        undefined
      );

      await notificationService.cancelAllNotifications();

      expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    });
  });

});
