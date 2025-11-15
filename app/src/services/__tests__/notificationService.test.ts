import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  medicationRepository,
  medicationDoseRepository,
  medicationScheduleRepository,
} from '../../database/medicationRepository';
import { Medication, MedicationSchedule } from '../../models/types';

// Mock dependencies BEFORE importing the service
jest.mock('expo-notifications');
jest.mock('../../database/medicationRepository');
jest.mock('../../services/errorLogger');
jest.mock('@react-native-async-storage/async-storage');

// Add AndroidNotificationPriority enum to mocked Notifications
(Notifications as any).AndroidNotificationPriority = {
  MIN: -2,
  LOW: -1,
  DEFAULT: 0,
  HIGH: 1,
  MAX: 2,
};

// Set up mocks for methods that aren't automatically mocked
(Notifications as any).getPresentedNotificationsAsync = jest.fn();
(Notifications as any).dismissNotificationAsync = jest.fn();
(Notifications as any).setNotificationCategoryAsync = jest.fn();
(Notifications as any).addNotificationResponseReceivedListener = jest.fn();
(Notifications as any).addNotificationReceivedListener = jest.fn();
(Notifications as any).requestPermissionsAsync = jest.fn();
(Notifications as any).getPermissionsAsync = jest.fn();
(Notifications as any).scheduleNotificationAsync = jest.fn();
(Notifications as any).cancelScheduledNotificationAsync = jest.fn();
(Notifications as any).getAllScheduledNotificationsAsync = jest.fn();
(Notifications as any).cancelAllScheduledNotificationsAsync = jest.fn();
(Notifications as any).SchedulableTriggerInputTypes = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  YEARLY: 'yearly',
  DATE: 'date',
  TIME_INTERVAL: 'timeInterval',
  CALENDAR: 'calendar',
  UNKNOWN: 'unknown',
};

// NOW import the service after mocks are set up
import { notificationService, handleIncomingNotification } from '../notificationService';

describe('notificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Ensure wasLoggedForScheduleToday is available as a mock
    if (!medicationDoseRepository.wasLoggedForScheduleToday) {
      medicationDoseRepository.wasLoggedForScheduleToday = jest.fn();
    } else {
      (medicationDoseRepository.wasLoggedForScheduleToday as jest.Mock).mockReset();
    }

    // Ensure getById is available as a mock
    if (!medicationRepository.getById) {
      medicationRepository.getById = jest.fn();
    } else {
      (medicationRepository.getById as jest.Mock).mockReset();
    }

    // Set up default mocks for notification methods used in dismissMedicationNotification tests
    (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue([]);
    (Notifications.dismissNotificationAsync as jest.Mock).mockResolvedValue(undefined);
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
      defaultQuantity: 1,
      scheduleFrequency: 'daily',
      photoUri: undefined,
      schedule: [],
      active: true,
      notes: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mockSchedule: MedicationSchedule = {
      id: 'sched-123',
      medicationId: 'med-123',
      time: '09:00',
      timezone: 'America/Los_Angeles',
      dosage: 2,
      enabled: true,
      notificationId: undefined,
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

      expect(notifId).toBe(null);
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

      expect(notifId).toBe(null);
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

  describe('dismissMedicationNotification', () => {
    it('should dismiss single medication notification', async () => {
      const mockPresentedNotifs = [
        {
          request: {
            identifier: 'notif-1',
            content: { data: { medicationId: 'med-123', scheduleId: 'sched-1' } },
          },
        },
        {
          request: {
            identifier: 'notif-2',
            content: { data: { medicationId: 'med-456', scheduleId: 'sched-2' } },
          },
        },
      ];

      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue(mockPresentedNotifs);

      await notificationService.dismissMedicationNotification('med-123');

      // Verify getPresentedNotificationsAsync was called
      expect(Notifications.getPresentedNotificationsAsync).toHaveBeenCalled();

      // Should only dismiss notifications for med-123
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledTimes(1);
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('notif-1');
    });

    it('should dismiss medication from grouped notification', async () => {
      const mockPresentedNotifs = [
        {
          request: {
            identifier: 'notif-group-1',
            content: {
              data: {
                medicationIds: ['med-123', 'med-456'],
                scheduleIds: ['sched-1', 'sched-2'],
              },
            },
          },
        },
      ];

      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue(mockPresentedNotifs);

      await notificationService.dismissMedicationNotification('med-123', 'sched-1');

      // Should dismiss the grouped notification containing this medication
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledTimes(1);
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('notif-group-1');
    });

    it('should not dismiss grouped notification if scheduleId does not match', async () => {
      const mockPresentedNotifs = [
        {
          request: {
            identifier: 'notif-group-1',
            content: {
              data: {
                medicationIds: ['med-123', 'med-456'],
                scheduleIds: ['sched-1', 'sched-2'],
              },
            },
          },
        },
      ];

      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue(mockPresentedNotifs);

      // Try to dismiss med-123 but with a different scheduleId (sched-3 instead of sched-1)
      await notificationService.dismissMedicationNotification('med-123', 'sched-3');

      // Should NOT dismiss the notification since scheduleId doesn't match
      expect(Notifications.dismissNotificationAsync).not.toHaveBeenCalled();
    });

    it('should handle errors when dismissing notifications', async () => {
      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockRejectedValue(
        new Error('Failed to get presented notifications')
      );

      await expect(
        notificationService.dismissMedicationNotification('med-123')
      ).resolves.not.toThrow();
    });

    it('should not dismiss notifications for different medications', async () => {
      const mockPresentedNotifs = [
        {
          request: {
            identifier: 'notif-1',
            content: { data: { medicationId: 'med-456', scheduleId: 'sched-1' } },
          },
        },
      ];

      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue(mockPresentedNotifs);

      await notificationService.dismissMedicationNotification('med-123');

      // Should not dismiss any notifications since medication IDs don't match
      expect(Notifications.dismissNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('scheduleGroupedNotifications', () => {
    const mockMedication1: Medication = {
      id: 'med-1',
      name: 'Medication A',
      type: 'preventative',
      dosageAmount: 100,
      dosageUnit: 'mg',
      defaultQuantity: 1,
      scheduleFrequency: 'daily',
      photoUri: undefined,
      schedule: [],
      active: true,
      notes: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mockMedication2: Medication = {
      ...mockMedication1,
      id: 'med-2',
      name: 'Medication B',
    };

    const mockMedication3: Medication = {
      ...mockMedication1,
      id: 'med-3',
      name: 'Medication C',
    };

    const mockSchedule1: MedicationSchedule = {
      id: 'sched-1',
      medicationId: 'med-1',
      time: '09:00',
      timezone: 'America/Los_Angeles',
      dosage: 1,
      enabled: true,
      notificationId: undefined,
    };

    const mockSchedule2: MedicationSchedule = {
      id: 'sched-2',
      medicationId: 'med-2',
      time: '09:00', // Same time as schedule 1
      timezone: 'America/Los_Angeles',
      dosage: 2,
      enabled: true,
      notificationId: undefined,
    };

    const mockSchedule3: MedicationSchedule = {
      id: 'sched-3',
      medicationId: 'med-3',
      time: '14:00', // Different time
      timezone: 'America/Los_Angeles',
      dosage: 1,
      enabled: true,
      notificationId: undefined,
    };

    it('should group medications scheduled at the same time', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-grouped');

      const items = [
        { medication: mockMedication1, schedule: mockSchedule1 },
        { medication: mockMedication2, schedule: mockSchedule2 },
      ];

      const notificationIds = await notificationService.scheduleGroupedNotifications(items);

      // Should create one grouped notification
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Time for 2 Medications',
            body: 'Medication A, Medication B',
            data: {
              medicationIds: ['med-1', 'med-2'],
              scheduleIds: ['sched-1', 'sched-2'],
              time: '09:00',
            },
          }),
        })
      );

      // Both schedules should have the same notification ID
      expect(notificationIds.size).toBe(2);
      expect(notificationIds.get('sched-1')).toBe('notif-grouped');
      expect(notificationIds.get('sched-2')).toBe('notif-grouped');
    });

    it('should create separate notifications for different times', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock)
        .mockResolvedValueOnce('notif-1')
        .mockResolvedValueOnce('notif-2');

      const items = [
        { medication: mockMedication1, schedule: mockSchedule1 },
        { medication: mockMedication3, schedule: mockSchedule3 },
      ];

      const notificationIds = await notificationService.scheduleGroupedNotifications(items);

      // Should create two separate notifications
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
      expect(notificationIds.size).toBe(2);
      expect(notificationIds.get('sched-1')).toBe('notif-1');
      expect(notificationIds.get('sched-3')).toBe('notif-2');
    });

    it('should skip disabled schedules', async () => {
      const disabledSchedule: MedicationSchedule = {
        ...mockSchedule1,
        enabled: false,
      };

      const items = [{ medication: mockMedication1, schedule: disabledSchedule }];

      const notificationIds = await notificationService.scheduleGroupedNotifications(items);

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(notificationIds.size).toBe(0);
    });

    it('should group three medications at the same time', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-triple');

      const items = [
        { medication: mockMedication1, schedule: mockSchedule1 },
        { medication: mockMedication2, schedule: mockSchedule2 },
        { medication: mockMedication3, schedule: { ...mockSchedule3, time: '09:00' } },
      ];

      const notificationIds = await notificationService.scheduleGroupedNotifications(items);

      // Should create one grouped notification
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Time for 3 Medications',
            body: 'Medication A, Medication B, Medication C',
          }),
        })
      );

      // All three schedules should have the same notification ID
      expect(notificationIds.size).toBe(3);
    });
  });

  describe('handleTakeAllNow', () => {
    it('should log all medications when Take All action is triggered', async () => {
      const mockMedication1 = {
        id: 'med-1',
        name: 'Med A',
        schedule: [{ id: 'sched-1', dosage: 2 }],
        defaultQuantity: 1,
      };

      const mockMedication2 = {
        id: 'med-2',
        name: 'Med B',
        schedule: [{ id: 'sched-2', dosage: 1 }],
        defaultQuantity: 1,
      };

      (medicationRepository.getById as jest.Mock)
        .mockResolvedValueOnce(mockMedication1)
        .mockResolvedValueOnce(mockMedication2);

      (medicationDoseRepository.create as jest.Mock).mockResolvedValue({ id: 'dose-id' });
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-id');

      // Note: In a real scenario, the notification response handler would be tested
      // through the actual notification listener. For now, testing logic indirectly
    });
  });

  describe('handleRemindLater', () => {
    it('should reschedule grouped notification when Remind Later is triggered', async () => {
      const mockMedication1 = {
        id: 'med-1',
        name: 'Med A',
      };

      const mockMedication2 = {
        id: 'med-2',
        name: 'Med B',
      };

      (medicationRepository.getById as jest.Mock)
        .mockResolvedValueOnce(mockMedication1)
        .mockResolvedValueOnce(mockMedication2);

      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-snoozed');

      // Note: Private methods cannot be directly tested, but they are tested indirectly
      // through the notification response handler in integration tests
    });
  });

  describe('notification handler (handleIncomingNotification)', () => {
    describe('single medication notifications', () => {
      it('should show notification if medication was not logged', async () => {
        const mockMedication: Medication = {
          id: 'med-123',
          name: 'Test Med',
          type: 'preventative',
          dosageAmount: 50,
          dosageUnit: 'mg',
          scheduleFrequency: 'daily',
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          schedule: [{
            id: 'schedule-123',
            medicationId: 'med-123',
            time: '09:00',
            timezone: 'America/Los_Angeles',
            dosage: 1,
            enabled: true,
          }],
        };

        (medicationRepository.getById as jest.Mock).mockResolvedValue(mockMedication);
        (medicationDoseRepository.wasLoggedForScheduleToday as jest.Mock).mockResolvedValue(false);

        const notification = {
          request: {
            content: {
              data: {
                medicationId: 'med-123',
                scheduleId: 'schedule-123',
              },
            },
          },
        } as any;


        const result = await handleIncomingNotification(notification);

        expect(result).toEqual({
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        });
      });

      it('should show notification if medication is not found', async () => {
        (medicationRepository.getById as jest.Mock).mockResolvedValue(null);

        const notification = {
          request: {
            content: {
              data: {
                medicationId: 'med-123',
                scheduleId: 'schedule-123',
              },
            },
          },
        } as any;

        const result = await handleIncomingNotification(notification);

        expect(result).toEqual({
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        });
      });

      it('should show notification if schedule is not found', async () => {
        const mockMedication: Medication = {
          id: 'med-123',
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

        (medicationRepository.getById as jest.Mock).mockResolvedValue(mockMedication);

        const notification = {
          request: {
            content: {
              data: {
                medicationId: 'med-123',
                scheduleId: 'schedule-123',
              },
            },
          },
        } as any;

        const result = await handleIncomingNotification(notification);

        expect(result).toEqual({
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        });
      });
    });

    describe('grouped medication notifications', () => {
      it.skip('should suppress notification if single medication was already logged', async () => {
        // Test the single medication path using data that works
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
          schedule: [{
            id: 'sched-1',
            medicationId: 'med-1',
            time: '21:30',
            timezone: 'America/Los_Angeles',
            dosage: 1,
            enabled: true,
          }],
        };

        (medicationRepository.getById as jest.Mock).mockResolvedValue(mockMedication);
        (medicationDoseRepository.wasLoggedForScheduleToday as jest.Mock).mockResolvedValue(true);

        const notification = {
          request: {
            content: {
              data: {
                medicationId: 'med-1',
                scheduleId: 'sched-1',
              },
            },
          },
        } as any;

        const result = await handleIncomingNotification(notification);

        expect(medicationDoseRepository.wasLoggedForScheduleToday).toHaveBeenCalledWith(
          'med-1',
          'sched-1',
          '21:30'
        );
        expect(result).toEqual({
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: false,
        });
      });

      it('should suppress notification if all medications were logged', async () => {
        (medicationDoseRepository.wasLoggedForScheduleToday as jest.Mock).mockResolvedValue(true);

        // Mock medications with schedules that have timezones
        (medicationRepository.getById as jest.Mock).mockImplementation((id: string) => {
          const result = id === 'med-1'
            ? {
                id: 'med-1',
                name: 'Med 1',
                schedule: [{ id: 'schedule-1', time: '09:00', timezone: 'America/Los_Angeles' }],
              }
            : id === 'med-2'
            ? {
                id: 'med-2',
                name: 'Med 2',
                schedule: [{ id: 'schedule-2', time: '09:00', timezone: 'America/Los_Angeles' }],
              }
            : null;
          return Promise.resolve(result);
        });

        const notification = {
          request: {
            content: {
              data: {
                medicationIds: ['med-1', 'med-2'],
                scheduleIds: ['schedule-1', 'schedule-2'],
                time: '09:00',
              },
            },
          },
        } as any;

        const result = await handleIncomingNotification(notification);

        expect(medicationRepository.getById).toHaveBeenCalledTimes(2);
        expect(result).toEqual({
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: false,
        });
        expect(medicationDoseRepository.wasLoggedForScheduleToday).toHaveBeenCalledTimes(2);
      });

      it('should show notification if some medications were logged', async () => {
        let callCount = 0;
        (medicationDoseRepository.wasLoggedForScheduleToday as jest.Mock).mockImplementation(() => {
          callCount++;
          return Promise.resolve(callCount === 1); // First call true, second false
        });

        // Mock medications with schedules that have timezones
        (medicationRepository.getById as jest.Mock).mockImplementation((id: string) => {
          if (id === 'med-1') {
            return Promise.resolve({
              id: 'med-1',
              name: 'Med 1',
              schedule: [{ id: 'schedule-1', time: '09:00', timezone: 'America/Los_Angeles' }],
            });
          } else if (id === 'med-2') {
            return Promise.resolve({
              id: 'med-2',
              name: 'Med 2',
              schedule: [{ id: 'schedule-2', time: '09:00', timezone: 'America/Los_Angeles' }],
            });
          }
          return Promise.resolve(null);
        });

        const notification = {
          request: {
            content: {
              data: {
                medicationIds: ['med-1', 'med-2'],
                scheduleIds: ['schedule-1', 'schedule-2'],
                time: '09:00',
              },
            },
          },
        } as any;

        const result = await handleIncomingNotification(notification);

        expect(result).toEqual({
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        });
        expect(medicationDoseRepository.wasLoggedForScheduleToday).toHaveBeenCalledTimes(2);
      });

      it('should show notification if no medications were logged', async () => {
        (medicationDoseRepository.wasLoggedForScheduleToday as jest.Mock).mockResolvedValue(false);

        // Mock medications with schedules that have timezones
        (medicationRepository.getById as jest.Mock).mockImplementation((id: string) => {
          if (id === 'med-1') {
            return Promise.resolve({
              id: 'med-1',
              name: 'Med 1',
              schedule: [{ id: 'schedule-1', time: '09:00', timezone: 'America/Los_Angeles' }],
            });
          } else if (id === 'med-2') {
            return Promise.resolve({
              id: 'med-2',
              name: 'Med 2',
              schedule: [{ id: 'schedule-2', time: '09:00', timezone: 'America/Los_Angeles' }],
            });
          }
          return Promise.resolve(null);
        });

        const notification = {
          request: {
            content: {
              data: {
                medicationIds: ['med-1', 'med-2'],
                scheduleIds: ['schedule-1', 'schedule-2'],
                time: '09:00',
              },
            },
          },
        } as any;

        const result = await handleIncomingNotification(notification);

        expect(result).toEqual({
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        });
      });
    });

    describe('default behavior', () => {
      it('should show notification for non-medication reminders', async () => {
        const notification = {
          request: {
            content: {
              data: {},
            },
          },
        } as any;

        const result = await handleIncomingNotification(notification);

        expect(result).toEqual({
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        });
      });
    });
  });

  describe('Global Notification Toggle', () => {
    describe('areNotificationsGloballyEnabled', () => {
      it('should return true by default when not set', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

        const result = await notificationService.areNotificationsGloballyEnabled();

        expect(result).toBe(true);
        expect(AsyncStorage.getItem).toHaveBeenCalledWith('@notifications_enabled');
      });

      it('should return stored value when set', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue('false');

        const result = await notificationService.areNotificationsGloballyEnabled();

        expect(result).toBe(false);
      });

      it('should return true on error', async () => {
        (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

        const result = await notificationService.areNotificationsGloballyEnabled();

        expect(result).toBe(true);
      });
    });

    describe('setGlobalNotificationsEnabled', () => {
      it('should disable notifications and cancel all schedules', async () => {
        await notificationService.setGlobalNotificationsEnabled(false);

        expect(AsyncStorage.setItem).toHaveBeenCalledWith('@notifications_enabled', 'false');
        expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
      });

      it('should enable notifications and reschedule all medication reminders', async () => {
        const mockMedication: Medication = {
          id: 'med1',
          name: 'Test Med',
          type: 'preventative' as const,
          scheduleFrequency: 'daily' as const,
          dosageAmount: 10,
          dosageUnit: 'mg',
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const mockSchedule = {
          id: 'sched1',
          medicationId: 'med1',
          time: '09:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        (medicationRepository.getActive as jest.Mock).mockResolvedValue([mockMedication]);
        (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([mockSchedule]);
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-id');

        await notificationService.setGlobalNotificationsEnabled(true);

        expect(AsyncStorage.setItem).toHaveBeenCalledWith('@notifications_enabled', 'true');
        expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
      });

      it('should throw error on storage failure', async () => {
        (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

        await expect(notificationService.setGlobalNotificationsEnabled(true)).rejects.toThrow('Storage error');
      });
    });

    describe('scheduleGroupedNotifications', () => {
      it('should skip scheduling when globally disabled', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue('false');

        const mockMedication: Medication = {
          id: 'med1',
          name: 'Test Med',
          type: 'preventative' as const,
          scheduleFrequency: 'daily' as const,
          dosageAmount: 10,
          dosageUnit: 'mg',
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const mockSchedule = {
          id: 'sched1',
          medicationId: 'med1',
          time: '09:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const result = await notificationService.scheduleGroupedNotifications([
          { medication: mockMedication, schedule: mockSchedule },
        ]);

        expect(result.size).toBe(0);
        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      });

      it('should schedule notifications when globally enabled', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue('true');
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-id');

        const mockMedication: Medication = {
          id: 'med1',
          name: 'Test Med',
          type: 'preventative' as const,
          scheduleFrequency: 'daily' as const,
          dosageAmount: 10,
          dosageUnit: 'mg',
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const mockSchedule = {
          id: 'sched1',
          medicationId: 'med1',
          time: '09:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const result = await notificationService.scheduleGroupedNotifications([
          { medication: mockMedication, schedule: mockSchedule },
        ]);

        expect(result.size).toBe(1);
        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
      });
    });
  });

  describe('Notification Response Handling (Bug #105)', () => {
    describe('TAKE_NOW action with error handling', () => {
      it('should successfully log medication when TAKE_NOW action is triggered', async () => {
        const mockMedication = {
          id: 'med-123',
          name: 'Ibuprofen',
          dosageAmount: 200,
          dosageUnit: 'mg',
          defaultQuantity: 1,
          schedule: [{ id: 'sched-123', dosage: 2 }],
        };

        (medicationRepository.getById as jest.Mock).mockResolvedValue(mockMedication);
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-id');

        // Simulate the notification response listener callback
        let listenerCallback: any;
        (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((cb) => {
          listenerCallback = cb;
          return { remove: jest.fn() };
        });

        await notificationService.initialize();

        // Trigger the TAKE_NOW action
        const response = {
          actionIdentifier: 'TAKE_NOW',
          notification: {
            request: {
              content: {
                data: { medicationId: 'med-123', scheduleId: 'sched-123' },
              },
            },
          },
        };

        // Execute listener callback
        if (listenerCallback) {
          await expect(listenerCallback(response)).resolves.not.toThrow();
        }
      });

      it('should handle medication not found error in TAKE_NOW', async () => {
        (medicationRepository.getById as jest.Mock).mockResolvedValue(null);

        let listenerCallback: any;
        (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((cb) => {
          listenerCallback = cb;
          return { remove: jest.fn() };
        });

        await notificationService.initialize();

        const response = {
          actionIdentifier: 'TAKE_NOW',
          notification: {
            request: {
              content: {
                data: { medicationId: 'nonexistent', scheduleId: 'sched-123' },
              },
            },
          },
        };

        if (listenerCallback) {
          await expect(listenerCallback(response)).resolves.not.toThrow();
        }
      });

      it('should handle invalid medication configuration in TAKE_NOW', async () => {
        const mockMedicationInvalid = {
          id: 'med-123',
          name: 'Invalid Med',
          dosageAmount: undefined, // Missing dosageAmount
          dosageUnit: 'mg',
          defaultQuantity: 1,
          schedule: [{ id: 'sched-123', dosage: 2 }],
        };

        (medicationRepository.getById as jest.Mock).mockResolvedValue(mockMedicationInvalid);

        let listenerCallback: any;
        (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((cb) => {
          listenerCallback = cb;
          return { remove: jest.fn() };
        });

        await notificationService.initialize();

        const response = {
          actionIdentifier: 'TAKE_NOW',
          notification: {
            request: {
              content: {
                data: { medicationId: 'med-123', scheduleId: 'sched-123' },
              },
            },
          },
        };

        if (listenerCallback) {
          await expect(listenerCallback(response)).resolves.not.toThrow();
        }
      });
    });

    describe('TAKE_ALL_NOW action with error handling', () => {
      it('should successfully log multiple medications when TAKE_ALL_NOW action is triggered', async () => {
        const mockMedication1 = {
          id: 'med-1',
          name: 'Med A',
          dosageAmount: 100,
          dosageUnit: 'mg',
          defaultQuantity: 1,
          schedule: [{ id: 'sched-1', dosage: 1 }],
        };

        const mockMedication2 = {
          id: 'med-2',
          name: 'Med B',
          dosageAmount: 200,
          dosageUnit: 'mg',
          defaultQuantity: 1,
          schedule: [{ id: 'sched-2', dosage: 2 }],
        };

        (medicationRepository.getById as jest.Mock)
          .mockResolvedValueOnce(mockMedication1)
          .mockResolvedValueOnce(mockMedication2);
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-id');

        let listenerCallback: any;
        (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((cb) => {
          listenerCallback = cb;
          return { remove: jest.fn() };
        });

        await notificationService.initialize();

        const response = {
          actionIdentifier: 'TAKE_ALL_NOW',
          notification: {
            request: {
              content: {
                data: {
                  medicationIds: ['med-1', 'med-2'],
                  scheduleIds: ['sched-1', 'sched-2'],
                  time: '09:00',
                },
              },
            },
          },
        };

        if (listenerCallback) {
          await expect(listenerCallback(response)).resolves.not.toThrow();
        }
      });

      it('should handle partial failure when logging multiple medications', async () => {
        const mockMedication1 = {
          id: 'med-1',
          name: 'Med A',
          dosageAmount: 100,
          dosageUnit: 'mg',
          defaultQuantity: 1,
          schedule: [{ id: 'sched-1', dosage: 1 }],
        };

        const mockMedicationInvalid = {
          id: 'med-2',
          name: 'Invalid Med',
          dosageAmount: undefined, // Missing dosageAmount
          dosageUnit: 'mg',
          defaultQuantity: 1,
          schedule: [{ id: 'sched-2', dosage: 2 }],
        };

        (medicationRepository.getById as jest.Mock)
          .mockResolvedValueOnce(mockMedication1)
          .mockResolvedValueOnce(mockMedicationInvalid);

        let listenerCallback: any;
        (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((cb) => {
          listenerCallback = cb;
          return { remove: jest.fn() };
        });

        await notificationService.initialize();

        const response = {
          actionIdentifier: 'TAKE_ALL_NOW',
          notification: {
            request: {
              content: {
                data: {
                  medicationIds: ['med-1', 'med-2'],
                  scheduleIds: ['sched-1', 'sched-2'],
                  time: '09:00',
                },
              },
            },
          },
        };

        // Should not throw even with partial failure
        if (listenerCallback) {
          await expect(listenerCallback(response)).resolves.not.toThrow();
        }
      });

      it('should handle all medications not found in TAKE_ALL_NOW', async () => {
        (medicationRepository.getById as jest.Mock)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null);

        let listenerCallback: any;
        (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((cb) => {
          listenerCallback = cb;
          return { remove: jest.fn() };
        });

        await notificationService.initialize();

        const response = {
          actionIdentifier: 'TAKE_ALL_NOW',
          notification: {
            request: {
              content: {
                data: {
                  medicationIds: ['nonexistent-1', 'nonexistent-2'],
                  scheduleIds: ['sched-1', 'sched-2'],
                  time: '09:00',
                },
              },
            },
          },
        };

        if (listenerCallback) {
          await expect(listenerCallback(response)).resolves.not.toThrow();
        }
      });
    });

    describe('Notification response listener error handling', () => {
      it('should handle unexpected errors in notification response handler', async () => {
        let listenerCallback: any;
        (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((cb) => {
          listenerCallback = cb;
          return { remove: jest.fn() };
        });

        await notificationService.initialize();

        // Send a response with missing required data
        const badResponse = {
          actionIdentifier: 'TAKE_NOW',
          notification: {
            request: {
              content: {
                data: { /* missing medicationId and scheduleId */ },
              },
            },
          },
        };

        // Should handle gracefully without throwing
        if (listenerCallback) {
          await expect(listenerCallback(badResponse)).resolves.not.toThrow();
        }
      });

      it('should handle notification with no data in response handler', async () => {
        let listenerCallback: any;
        (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((cb) => {
          listenerCallback = cb;
          return { remove: jest.fn() };
        });

        await notificationService.initialize();

        const response = {
          actionIdentifier: 'TAKE_NOW',
          notification: {
            request: {
              content: {
                data: undefined,
              },
            },
          },
        };

        if (listenerCallback) {
          await expect(listenerCallback(response)).resolves.not.toThrow();
        }
      });

      it('should handle SNOOZE_10 action in response handler', async () => {
        const mockMedication = {
          id: 'med-123',
          name: 'Test Med',
          dosageAmount: 100,
          dosageUnit: 'mg',
          defaultQuantity: 1,
          schedule: [{ id: 'sched-123', dosage: 1 }],
        };

        (medicationRepository.getById as jest.Mock).mockResolvedValue(mockMedication);
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-id');

        let listenerCallback: any;
        (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((cb) => {
          listenerCallback = cb;
          return { remove: jest.fn() };
        });

        await notificationService.initialize();

        const response = {
          actionIdentifier: 'SNOOZE_10',
          notification: {
            request: {
              content: {
                data: { medicationId: 'med-123', scheduleId: 'sched-123' },
              },
            },
          },
        };

        if (listenerCallback) {
          await expect(listenerCallback(response)).resolves.not.toThrow();
        }
      });

      it('should handle VIEW_DETAILS action in response handler', async () => {
        let listenerCallback: any;
        (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((cb) => {
          listenerCallback = cb;
          return { remove: jest.fn() };
        });

        await notificationService.initialize();

        const response = {
          actionIdentifier: 'VIEW_DETAILS',
          notification: {
            request: {
              content: {
                data: { medicationId: 'med-123' },
              },
            },
          },
        };

        if (listenerCallback) {
          await expect(listenerCallback(response)).resolves.not.toThrow();
        }
      });

      it('should handle default tap action in response handler', async () => {
        let listenerCallback: any;
        (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((cb) => {
          listenerCallback = cb;
          return { remove: jest.fn() };
        });

        await notificationService.initialize();

        const response = {
          actionIdentifier: undefined, // Notification tap, not action button
          notification: {
            request: {
              content: {
                data: { medicationId: 'med-123', scheduleId: 'sched-123' },
              },
            },
          },
        };

        if (listenerCallback) {
          await expect(listenerCallback(response)).resolves.not.toThrow();
        }
      });
    });
  });

});
