import { NotificationDismissalService } from '../NotificationDismissalService';
import { scheduledNotificationRepository } from '../../../database/scheduledNotificationRepository';
import { medicationRepository, medicationDoseRepository } from '../../../database/medicationRepository';
import * as Notifications from 'expo-notifications';

// Mock dependencies
jest.mock('../../../database/scheduledNotificationRepository');
jest.mock('../../../database/medicationRepository');
jest.mock('expo-notifications');
jest.mock('../../../utils/logger');

const mockScheduledNotificationRepository = scheduledNotificationRepository as jest.Mocked<typeof scheduledNotificationRepository>;
const mockMedicationRepository = medicationRepository as jest.Mocked<typeof medicationRepository>;
const mockMedicationDoseRepository = medicationDoseRepository as jest.Mocked<typeof medicationDoseRepository>;

// Mock Notifications properly
const mockGetPresentedNotificationsAsync = jest.fn();
const mockDismissNotificationAsync = jest.fn();
const mockCancelScheduledNotificationAsync = jest.fn();

(Notifications.getPresentedNotificationsAsync as jest.Mock) = mockGetPresentedNotificationsAsync;
(Notifications.dismissNotificationAsync as jest.Mock) = mockDismissNotificationAsync;
(Notifications.cancelScheduledNotificationAsync as jest.Mock) = mockCancelScheduledNotificationAsync;

describe('NotificationDismissalService', () => {
  let service: NotificationDismissalService;

  beforeEach(() => {
    service = new NotificationDismissalService();
    jest.clearAllMocks();
    
    // Reset mock implementations
    mockGetPresentedNotificationsAsync.mockClear();
    mockDismissNotificationAsync.mockClear();
    mockCancelScheduledNotificationAsync.mockClear();
  });

  describe('shouldDismissNotification', () => {
    it('should return true with high confidence when database ID lookup succeeds', async () => {
      // Arrange
      const notificationId = 'test-notification-id';
      const medicationId = 'test-medication-id';
      const scheduleId = 'test-schedule-id';

      // Mock database mapping exists
      mockScheduledNotificationRepository.getMappingsByNotificationId.mockResolvedValue([
        {
          id: 'mapping-1',
          medicationId,
          scheduleId,
          date: '2024-01-01',
          notificationId,
          notificationType: 'reminder',
          isGrouped: false,
          sourceType: 'medication',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ]);

      // Act
      const result = await service.shouldDismissNotification(
        notificationId,
        medicationId,
        scheduleId
      );

      // Assert
      expect(result.shouldDismiss).toBe(true);
      expect(result.strategy).toBe('database_id_lookup');
      expect(result.confidence).toBe(100);
    });

    it('should return false when no database mapping found', async () => {
      // Arrange
      const notificationId = 'test-notification-id';
      const medicationId = 'test-medication-id';
      const scheduleId = 'test-schedule-id';

      // Mock no database mapping found
      mockScheduledNotificationRepository.getMappingsByNotificationId.mockResolvedValue([]);
      
      // Mock other strategies also fail
      mockScheduledNotificationRepository.findByTimeWindow.mockResolvedValue([]);
      mockMedicationRepository.getById.mockResolvedValue(null);
      mockGetPresentedNotificationsAsync.mockResolvedValue([]);
      mockScheduledNotificationRepository.findByMedicationName.mockResolvedValue([]);
      mockScheduledNotificationRepository.findByCategoryAndTime.mockResolvedValue([]);

      // Act
      const result = await service.shouldDismissNotification(
        notificationId,
        medicationId,
        scheduleId
      );

      // Assert
      expect(result.shouldDismiss).toBe(false);
      expect(result.strategy).toBe('none');
      expect(result.confidence).toBe(0);
    });

    it('should handle grouped notifications with safety check', async () => {
      // Arrange
      const notificationId = 'test-notification-id';
      const medicationId = 'test-medication-id';
      const scheduleId = 'test-schedule-id';

      // Mock grouped notification mapping
      mockScheduledNotificationRepository.getMappingsByNotificationId.mockResolvedValue([
        {
          id: 'mapping-1',
          medicationId: medicationId,
          scheduleId: scheduleId,
          date: '2024-01-01',
          notificationId,
          notificationType: 'reminder',
          isGrouped: true,
          groupKey: '09:00',
          sourceType: 'medication',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'mapping-2',
          medicationId: 'other-medication-id',
          scheduleId: 'other-schedule-id',
          date: '2024-01-01',
          notificationId,
          notificationType: 'reminder',
          isGrouped: true,
          groupKey: '09:00',
          sourceType: 'medication',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ]);

      // Mock medications exist
      mockMedicationRepository.getById.mockImplementation(async (id) => {
        if (id === medicationId) {
          return {
            id: medicationId,
            name: 'Test Med 1',
            schedule: [{ id: scheduleId, time: '09:00', timezone: 'America/New_York' }],
          } as any;
        }
        if (id === 'other-medication-id') {
          return {
            id: 'other-medication-id',
            name: 'Test Med 2',
            schedule: [{ id: 'other-schedule-id', time: '09:00', timezone: 'America/New_York' }],
          } as any;
        }
        return null;
      });

      // Mock one medication is logged, other is not
      mockMedicationDoseRepository.wasLoggedForScheduleToday.mockImplementation(async (medId) => {
        return medId === medicationId; // Only our target medication is logged
      });

      // Mock fallback strategies to ensure they don't interfere
      mockScheduledNotificationRepository.findByTimeWindow.mockResolvedValue([]);
      mockScheduledNotificationRepository.findByMedicationName.mockResolvedValue([]);
      mockScheduledNotificationRepository.findByCategoryAndTime.mockResolvedValue([]);
      mockGetPresentedNotificationsAsync.mockResolvedValue([]);

      // Act
      const result = await service.shouldDismissNotification(
        notificationId,
        medicationId,
        scheduleId
      );

      // Assert - Should not dismiss because not all medications in group are logged
      expect(result.shouldDismiss).toBe(false);
      expect(result.strategy).toBe('database_id_lookup');
      expect(result.confidence).toBe(100);
      expect(result.context).toContain('not all medications logged');
    });
  });

  describe('dismissDailyCheckinForDate', () => {
    it('should return false when table is not ready', async () => {
      // Arrange
      mockScheduledNotificationRepository.tableExists.mockResolvedValue(false);

      // Act
      const result = await service.dismissDailyCheckinForDate('2024-01-01');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when no mapping found', async () => {
      // Arrange
      mockScheduledNotificationRepository.tableExists.mockResolvedValue(true);
      mockScheduledNotificationRepository.getDailyCheckinMapping.mockResolvedValue(null);

      // Act
      const result = await service.dismissDailyCheckinForDate('2024-01-01');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getDiagnosticInfo', () => {
    it('should return diagnostic information with strategies', async () => {
      // Arrange
      const notificationId = 'test-notification-id';

      mockScheduledNotificationRepository.getMappingsByNotificationId.mockResolvedValue([]);
      mockGetPresentedNotificationsAsync.mockResolvedValue([]);

      // Act
      const result = await service.getDiagnosticInfo(notificationId);

      // Assert
      expect(result.strategies.database).toBeDefined();
      expect(result.strategies.database.strategy).toBe('database_id_lookup');
    });
  });
});