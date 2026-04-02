import {
  NotificationIntegrityService,
  notificationIntegrityService,
  verifyNotificationIntegrity,
  checkNotificationHealth,
} from '../NotificationIntegrityService';
import { scheduledNotificationRepository } from '../../../database/scheduledNotificationRepository';
import * as Notifications from 'expo-notifications';

// Mock dependencies
jest.mock('../../../database/scheduledNotificationRepository');
jest.mock('../../../utils/logger');

// Mock expo-notifications with a factory function
jest.mock('expo-notifications', () => ({
  getAllScheduledNotificationsAsync: jest.fn(),
}));

const mockScheduledNotificationRepository = scheduledNotificationRepository as jest.Mocked<typeof scheduledNotificationRepository>;
const mockGetAllScheduledNotificationsAsync = Notifications.getAllScheduledNotificationsAsync as jest.Mock;

describe('NotificationIntegrityService', () => {
  let service: NotificationIntegrityService;

  beforeEach(() => {
    service = new NotificationIntegrityService();
    jest.clearAllMocks();
  });

  describe('verifyIntegrity', () => {
    it('should return consistent when table does not exist', async () => {
      // Arrange
      mockScheduledNotificationRepository.tableExists.mockResolvedValue(false);

      // Act
      const result = await service.verifyIntegrity();

      // Assert
      expect(result.isConsistent).toBe(true);
      expect(result.deviations).toHaveLength(0);
      expect(result.summary.totalDbMappings).toBe(0);
      expect(result.summary.totalOsNotifications).toBe(0);
    });

    it('should return consistent when DB and OS are in sync', async () => {
      // Arrange
      mockScheduledNotificationRepository.tableExists.mockResolvedValue(true);
      mockScheduledNotificationRepository.getAllMappings.mockResolvedValue([
        {
          id: 'mapping-1',
          medicationId: 'med-1',
          scheduleId: 'sched-1',
          date: '2024-01-15',
          notificationId: 'notif-1',
          notificationType: 'reminder',
          isGrouped: false,
          sourceType: 'medication',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'mapping-2',
          medicationId: 'med-2',
          scheduleId: 'sched-2',
          date: '2024-01-15',
          notificationId: 'notif-2',
          notificationType: 'reminder',
          isGrouped: false,
          sourceType: 'medication',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ]);

      mockGetAllScheduledNotificationsAsync.mockResolvedValue([
        {
          identifier: 'notif-1',
          content: {
            title: 'Time for Med 1',
            body: 'Take your medication',
            data: { medicationId: 'med-1', scheduleId: 'sched-1' },
            categoryIdentifier: 'MEDICATION_REMINDER',
          },
        },
        {
          identifier: 'notif-2',
          content: {
            title: 'Time for Med 2',
            body: 'Take your medication',
            data: { medicationId: 'med-2', scheduleId: 'sched-2' },
            categoryIdentifier: 'MEDICATION_REMINDER',
          },
        },
      ]);

      // Act
      const result = await service.verifyIntegrity();

      // Assert
      expect(result.isConsistent).toBe(true);
      expect(result.deviations).toHaveLength(0);
      expect(result.summary.totalDbMappings).toBe(2);
      expect(result.summary.totalOsNotifications).toBe(2);
      expect(result.summary.medicationOsNotifications).toBe(2);
    });

    it('should detect notifications missing in OS (DB has mapping, OS does not)', async () => {
      // Arrange
      mockScheduledNotificationRepository.tableExists.mockResolvedValue(true);
      mockScheduledNotificationRepository.getAllMappings.mockResolvedValue([
        {
          id: 'mapping-1',
          medicationId: 'med-1',
          scheduleId: 'sched-1',
          date: '2024-01-15',
          notificationId: 'notif-1',
          notificationType: 'reminder',
          isGrouped: false,
          sourceType: 'medication',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'mapping-2',
          medicationId: 'med-2',
          scheduleId: 'sched-2',
          date: '2024-01-15',
          notificationId: 'notif-missing',
          notificationType: 'reminder',
          isGrouped: false,
          sourceType: 'medication',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ]);

      mockGetAllScheduledNotificationsAsync.mockResolvedValue([
        {
          identifier: 'notif-1',
          content: {
            title: 'Time for Med 1',
            body: 'Take your medication',
            data: { medicationId: 'med-1', scheduleId: 'sched-1' },
            categoryIdentifier: 'MEDICATION_REMINDER',
          },
        },
      ]);

      // Act
      const result = await service.verifyIntegrity();

      // Assert
      expect(result.isConsistent).toBe(false);
      expect(result.deviations).toHaveLength(1);
      expect(result.deviations[0].type).toBe('missing_in_os');
      expect(result.deviations[0].notificationId).toBe('notif-missing');
      expect(result.deviations[0].mappingId).toBe('mapping-2');
      expect(result.summary.missingInOsCount).toBe(1);
    });

    it('should detect notifications missing in DB (OS has notification, DB does not)', async () => {
      // Arrange
      mockScheduledNotificationRepository.tableExists.mockResolvedValue(true);
      mockScheduledNotificationRepository.getAllMappings.mockResolvedValue([
        {
          id: 'mapping-1',
          medicationId: 'med-1',
          scheduleId: 'sched-1',
          date: '2024-01-15',
          notificationId: 'notif-1',
          notificationType: 'reminder',
          isGrouped: false,
          sourceType: 'medication',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ]);

      mockGetAllScheduledNotificationsAsync.mockResolvedValue([
        {
          identifier: 'notif-1',
          content: {
            title: 'Time for Med 1',
            body: 'Take your medication',
            data: { medicationId: 'med-1', scheduleId: 'sched-1' },
            categoryIdentifier: 'MEDICATION_REMINDER',
          },
        },
        {
          identifier: 'orphan-os-notif',
          content: {
            title: 'Time for Med 2',
            body: 'Take your medication',
            data: { medicationId: 'med-2', scheduleId: 'sched-2' },
            categoryIdentifier: 'MEDICATION_REMINDER',
          },
        },
      ]);

      // Act
      const result = await service.verifyIntegrity();

      // Assert
      expect(result.isConsistent).toBe(false);
      expect(result.deviations).toHaveLength(1);
      expect(result.deviations[0].type).toBe('missing_in_db');
      expect(result.deviations[0].notificationId).toBe('orphan-os-notif');
      expect(result.summary.missingInDbCount).toBe(1);
    });

    it('should NOT flag daily check-in notifications as missing in DB', async () => {
      // Arrange
      mockScheduledNotificationRepository.tableExists.mockResolvedValue(true);
      mockScheduledNotificationRepository.getAllMappings.mockResolvedValue([
        {
          id: 'mapping-1',
          medicationId: 'med-1',
          scheduleId: 'sched-1',
          date: '2024-01-15',
          notificationId: 'notif-1',
          notificationType: 'reminder',
          isGrouped: false,
          sourceType: 'medication',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ]);

      mockGetAllScheduledNotificationsAsync.mockResolvedValue([
        {
          identifier: 'notif-1',
          content: {
            title: 'Time for Med 1',
            body: 'Take your medication',
            data: { medicationId: 'med-1', scheduleId: 'sched-1' },
            categoryIdentifier: 'MEDICATION_REMINDER',
          },
        },
        {
          identifier: 'daily-checkin-notif',
          content: {
            title: 'How was your day?',
            body: 'Log your daily status',
            data: { type: 'daily_checkin', date: '2024-01-15' },
            categoryIdentifier: 'DAILY_CHECKIN',
          },
        },
      ]);

      // Act
      const result = await service.verifyIntegrity();

      // Assert
      expect(result.isConsistent).toBe(true);
      expect(result.deviations).toHaveLength(0);
      expect(result.summary.dailyCheckinOsNotifications).toBe(1);
      expect(result.summary.medicationOsNotifications).toBe(1);
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockScheduledNotificationRepository.tableExists.mockResolvedValue(true);
      mockScheduledNotificationRepository.getAllMappings.mockRejectedValue(
        new Error('Database error')
      );

      // Act
      const result = await service.verifyIntegrity();

      // Assert
      expect(result.isConsistent).toBe(false);
      expect(result.deviations).toHaveLength(1);
      expect(result.deviations[0].type).toBe('error');
      expect(result.deviations[0].description).toContain('Database error');
      expect(result.summary.errorCount).toBe(1);
    });

    it('should include context for grouped notifications missing in OS', async () => {
      // Arrange
      mockScheduledNotificationRepository.tableExists.mockResolvedValue(true);
      mockScheduledNotificationRepository.getAllMappings.mockResolvedValue([
        {
          id: 'mapping-1',
          medicationId: 'med-1',
          scheduleId: 'sched-1',
          date: '2024-01-15',
          notificationId: 'grouped-notif',
          notificationType: 'reminder',
          isGrouped: true,
          groupKey: '09:00',
          sourceType: 'medication',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ]);

      mockGetAllScheduledNotificationsAsync.mockResolvedValue([]);

      // Act
      const result = await service.verifyIntegrity();

      // Assert
      expect(result.isConsistent).toBe(false);
      expect(result.deviations).toHaveLength(1);
      expect(result.deviations[0].type).toBe('missing_in_os');
      expect(result.deviations[0].context).toEqual({
        notificationType: 'reminder',
        isGrouped: true,
        groupKey: '09:00',
      });
    });
  });

  describe('quickHealthCheck', () => {
    it('should return true when table does not exist', async () => {
      // Arrange
      mockScheduledNotificationRepository.tableExists.mockResolvedValue(false);

      // Act
      const result = await service.quickHealthCheck();

      // Assert
      expect(result).toBe(true);
    });

    it('should return true when DB and OS are in sync', async () => {
      // Arrange
      mockScheduledNotificationRepository.tableExists.mockResolvedValue(true);
      mockScheduledNotificationRepository.getAllMappings.mockResolvedValue([
        {
          id: 'mapping-1',
          medicationId: 'med-1',
          scheduleId: 'sched-1',
          date: '2024-01-15',
          notificationId: 'notif-1',
          notificationType: 'reminder',
          isGrouped: false,
          sourceType: 'medication',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ]);

      mockGetAllScheduledNotificationsAsync.mockResolvedValue([
        {
          identifier: 'notif-1',
          content: {
            title: 'Time for Med 1',
            body: 'Take your medication',
            data: { medicationId: 'med-1', scheduleId: 'sched-1' },
            categoryIdentifier: 'MEDICATION_REMINDER',
          },
        },
      ]);

      // Act
      const result = await service.quickHealthCheck();

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when DB mapping is missing in OS', async () => {
      // Arrange
      mockScheduledNotificationRepository.tableExists.mockResolvedValue(true);
      mockScheduledNotificationRepository.getAllMappings.mockResolvedValue([
        {
          id: 'mapping-1',
          medicationId: 'med-1',
          scheduleId: 'sched-1',
          date: '2024-01-15',
          notificationId: 'notif-missing',
          notificationType: 'reminder',
          isGrouped: false,
          sourceType: 'medication',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ]);

      mockGetAllScheduledNotificationsAsync.mockResolvedValue([]);

      // Act
      const result = await service.quickHealthCheck();

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when OS medication notification is missing in DB', async () => {
      // Arrange
      mockScheduledNotificationRepository.tableExists.mockResolvedValue(true);
      mockScheduledNotificationRepository.getAllMappings.mockResolvedValue([]);

      mockGetAllScheduledNotificationsAsync.mockResolvedValue([
        {
          identifier: 'orphan-notif',
          content: {
            title: 'Time for Med 1',
            body: 'Take your medication',
            data: { medicationId: 'med-1', scheduleId: 'sched-1' },
            categoryIdentifier: 'MEDICATION_REMINDER',
          },
        },
      ]);

      // Act
      const result = await service.quickHealthCheck();

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when error occurs', async () => {
      // Arrange
      mockScheduledNotificationRepository.tableExists.mockResolvedValue(true);
      mockScheduledNotificationRepository.getAllMappings.mockRejectedValue(
        new Error('Database error')
      );

      // Act
      const result = await service.quickHealthCheck();

      // Assert
      expect(result).toBe(false);
    });

    it('should ignore daily check-in notifications not in DB', async () => {
      // Arrange
      mockScheduledNotificationRepository.tableExists.mockResolvedValue(true);
      mockScheduledNotificationRepository.getAllMappings.mockResolvedValue([]);

      mockGetAllScheduledNotificationsAsync.mockResolvedValue([
        {
          identifier: 'daily-checkin',
          content: {
            title: 'How was your day?',
            body: 'Log your daily status',
            data: { type: 'daily_checkin' },
            categoryIdentifier: 'DAILY_CHECKIN',
          },
        },
      ]);

      // Act
      const result = await service.quickHealthCheck();

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('getMappingDetails', () => {
    it('should return empty arrays when table does not exist', async () => {
      // Arrange
      mockScheduledNotificationRepository.tableExists.mockResolvedValue(false);

      // Act
      const result = await service.getMappingDetails();

      // Assert
      expect(result.dbMappings).toEqual([]);
      expect(result.osNotifications).toEqual([]);
    });

    it('should return DB mappings and OS notifications', async () => {
      // Arrange
      mockScheduledNotificationRepository.tableExists.mockResolvedValue(true);
      mockScheduledNotificationRepository.getAllMappings.mockResolvedValue([
        {
          id: 'mapping-1',
          medicationId: 'med-1',
          scheduleId: 'sched-1',
          date: '2024-01-15',
          notificationId: 'notif-1',
          notificationType: 'reminder',
          isGrouped: false,
          sourceType: 'medication',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ]);

      mockGetAllScheduledNotificationsAsync.mockResolvedValue([
        {
          identifier: 'notif-1',
          content: {
            title: 'Time for Med 1',
            body: 'Take your medication',
            data: { medicationId: 'med-1' },
            categoryIdentifier: 'MEDICATION_REMINDER',
          },
        },
      ]);

      // Act
      const result = await service.getMappingDetails();

      // Assert
      expect(result.dbMappings).toHaveLength(1);
      expect(result.dbMappings[0].id).toBe('mapping-1');
      expect(result.osNotifications).toHaveLength(1);
      expect(result.osNotifications[0].identifier).toBe('notif-1');
      expect(result.osNotifications[0].title).toBe('Time for Med 1');
      expect(result.osNotifications[0].data).toEqual({ medicationId: 'med-1' });
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockScheduledNotificationRepository.tableExists.mockResolvedValue(true);
      mockScheduledNotificationRepository.getAllMappings.mockRejectedValue(
        new Error('Database error')
      );

      // Act
      const result = await service.getMappingDetails();

      // Assert
      expect(result.dbMappings).toEqual([]);
      expect(result.osNotifications).toEqual([]);
    });
  });

  describe('convenience functions', () => {
    it('verifyNotificationIntegrity should use singleton', async () => {
      // Arrange
      mockScheduledNotificationRepository.tableExists.mockResolvedValue(false);

      // Act
      const result = await verifyNotificationIntegrity();

      // Assert
      expect(result.isConsistent).toBe(true);
      expect(mockScheduledNotificationRepository.tableExists).toHaveBeenCalled();
    });

    it('checkNotificationHealth should use singleton', async () => {
      // Arrange
      mockScheduledNotificationRepository.tableExists.mockResolvedValue(false);

      // Act
      const result = await checkNotificationHealth();

      // Assert
      expect(result).toBe(true);
      expect(mockScheduledNotificationRepository.tableExists).toHaveBeenCalled();
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(notificationIntegrityService).toBeInstanceOf(NotificationIntegrityService);
    });
  });
});
