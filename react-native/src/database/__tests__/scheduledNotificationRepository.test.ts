import * as scheduledNotificationRepo from '../scheduledNotificationRepository';
import * as db from '../db';

// Mock dependencies
jest.mock('../db');
jest.mock('../../utils/logger');

describe('scheduledNotificationRepository', () => {
  let mockDatabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDatabase = {
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      getAllAsync: jest.fn().mockResolvedValue([]),
      withTransactionAsync: jest.fn().mockImplementation(async (callback) => {
        await callback();
      }),
    };

    (db.getDatabase as jest.Mock).mockResolvedValue(mockDatabase);
  });

  describe('tableExists', () => {
    it('should return true when table exists', async () => {
      mockDatabase.getFirstAsync.mockResolvedValue({ name: 'scheduled_notifications' });

      const result = await scheduledNotificationRepo.tableExists();

      expect(result).toBe(true);
      expect(mockDatabase.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining("SELECT name FROM sqlite_master")
      );
    });

    it('should return false when table does not exist', async () => {
      mockDatabase.getFirstAsync.mockResolvedValue(null);

      const result = await scheduledNotificationRepo.tableExists();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockDatabase.getFirstAsync.mockRejectedValue(new Error('Database error'));

      const result = await scheduledNotificationRepo.tableExists();

      expect(result).toBe(false);
    });
  });

  describe('saveMapping', () => {
    it('should save a medication notification mapping', async () => {
      const mapping = {
        medicationId: 'med-123',
        scheduleId: 'schedule-456',
        date: '2025-12-15',
        notificationId: 'notif-789',
        notificationType: 'reminder' as const,
        isGrouped: false,
      };

      const result = await scheduledNotificationRepo.saveMapping(mapping);

      expect(result.id).toMatch(/^sn_/);
      expect(result.medicationId).toBe('med-123');
      expect(result.scheduleId).toBe('schedule-456');
      expect(result.sourceType).toBe('medication');
      expect(result.createdAt).toBeDefined();
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO scheduled_notifications'),
        expect.arrayContaining(['med-123', 'schedule-456', '2025-12-15', 'notif-789'])
      );
    });

    it('should save a daily check-in notification mapping', async () => {
      const mapping = {
        medicationId: null,
        scheduleId: null,
        date: '2025-12-15',
        notificationId: 'notif-checkin',
        notificationType: 'daily_checkin' as const,
        isGrouped: false,
        sourceType: 'daily_checkin' as const,
      };

      const result = await scheduledNotificationRepo.saveMapping(mapping);

      expect(result.sourceType).toBe('daily_checkin');
      expect(result.medicationId).toBeNull();
    });

    it('should save a grouped notification mapping', async () => {
      const mapping = {
        medicationId: 'med-123',
        scheduleId: 'schedule-456',
        date: '2025-12-15',
        notificationId: 'notif-group',
        notificationType: 'reminder' as const,
        isGrouped: true,
        groupKey: '09:00',
      };

      const result = await scheduledNotificationRepo.saveMapping(mapping);

      expect(result.isGrouped).toBe(true);
      expect(result.groupKey).toBe('09:00');
    });

    it('should save mapping with optional metadata fields', async () => {
      const mapping = {
        medicationId: 'med-123',
        scheduleId: 'schedule-456',
        date: '2025-12-15',
        notificationId: 'notif-789',
        notificationType: 'reminder' as const,
        isGrouped: false,
        medicationName: 'Ibuprofen',
        scheduledTriggerTime: new Date('2025-12-15T09:00:00'),
        notificationTitle: 'Time for Ibuprofen',
        notificationBody: '1 dose - 200mg each',
        categoryIdentifier: 'MEDICATION_REMINDER',
      };

      const result = await scheduledNotificationRepo.saveMapping(mapping);

      expect(result.medicationName).toBe('Ibuprofen');
      expect(result.notificationTitle).toBe('Time for Ibuprofen');
      expect(mockDatabase.runAsync).toHaveBeenCalled();
    });
  });

  describe('saveMappingsBatch', () => {
    it('should return empty array for empty input', async () => {
      const result = await scheduledNotificationRepo.saveMappingsBatch([]);

      expect(result).toEqual([]);
      expect(mockDatabase.withTransactionAsync).not.toHaveBeenCalled();
    });

    it('should save multiple mappings in a transaction', async () => {
      const mappings = [
        {
          medicationId: 'med-1',
          scheduleId: 'schedule-1',
          date: '2025-12-15',
          notificationId: 'notif-1',
          notificationType: 'reminder' as const,
          isGrouped: false,
        },
        {
          medicationId: 'med-2',
          scheduleId: 'schedule-2',
          date: '2025-12-15',
          notificationId: 'notif-2',
          notificationType: 'reminder' as const,
          isGrouped: false,
        },
      ];

      const result = await scheduledNotificationRepo.saveMappingsBatch(mappings);

      expect(result).toHaveLength(2);
      expect(result[0].medicationId).toBe('med-1');
      expect(result[1].medicationId).toBe('med-2');
      expect(mockDatabase.withTransactionAsync).toHaveBeenCalled();
    });

    it('should propagate errors from transaction', async () => {
      mockDatabase.withTransactionAsync.mockRejectedValue(new Error('Transaction failed'));

      const mappings = [
        {
          medicationId: 'med-1',
          scheduleId: 'schedule-1',
          date: '2025-12-15',
          notificationId: 'notif-1',
          notificationType: 'reminder' as const,
          isGrouped: false,
        },
      ];

      await expect(scheduledNotificationRepo.saveMappingsBatch(mappings)).rejects.toThrow('Transaction failed');
    });
  });

  describe('getMapping', () => {
    it('should return mapping when found', async () => {
      const mockRow = {
        id: 'sn_123',
        medication_id: 'med-123',
        schedule_id: 'schedule-456',
        date: '2025-12-15',
        notification_id: 'notif-789',
        notification_type: 'reminder',
        is_grouped: 0,
        group_key: null,
        source_type: 'medication',
        medication_name: null,
        scheduled_trigger_time: null,
        notification_title: null,
        notification_body: null,
        category_identifier: null,
        created_at: Date.now(),
      };

      mockDatabase.getFirstAsync.mockResolvedValue(mockRow);

      const result = await scheduledNotificationRepo.getMapping(
        'med-123',
        'schedule-456',
        '2025-12-15',
        'reminder'
      );

      expect(result).not.toBeNull();
      expect(result?.medicationId).toBe('med-123');
      expect(result?.isGrouped).toBe(false);
    });

    it('should return null when not found', async () => {
      mockDatabase.getFirstAsync.mockResolvedValue(null);

      const result = await scheduledNotificationRepo.getMapping(
        'med-123',
        'schedule-456',
        '2025-12-15',
        'reminder'
      );

      expect(result).toBeNull();
    });
  });

  describe('getMappingsByNotificationId', () => {
    it('should return all mappings for a notification', async () => {
      const mockRows = [
        {
          id: 'sn_1',
          medication_id: 'med-1',
          schedule_id: 'schedule-1',
          date: '2025-12-15',
          notification_id: 'notif-shared',
          notification_type: 'reminder',
          is_grouped: 1,
          group_key: '09:00',
          source_type: 'medication',
          medication_name: null,
          scheduled_trigger_time: null,
          notification_title: null,
          notification_body: null,
          category_identifier: null,
          created_at: Date.now(),
        },
        {
          id: 'sn_2',
          medication_id: 'med-2',
          schedule_id: 'schedule-2',
          date: '2025-12-15',
          notification_id: 'notif-shared',
          notification_type: 'reminder',
          is_grouped: 1,
          group_key: '09:00',
          source_type: 'medication',
          medication_name: null,
          scheduled_trigger_time: null,
          notification_title: null,
          notification_body: null,
          category_identifier: null,
          created_at: Date.now(),
        },
      ];

      mockDatabase.getAllAsync.mockResolvedValue(mockRows);

      const result = await scheduledNotificationRepo.getMappingsByNotificationId('notif-shared');

      expect(result).toHaveLength(2);
      expect(result[0].isGrouped).toBe(true);
      expect(result[1].isGrouped).toBe(true);
    });
  });

  describe('getMappingsBySchedule', () => {
    it('should return all mappings for a schedule', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([]);

      await scheduledNotificationRepo.getMappingsBySchedule('med-123', 'schedule-456');

      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE medication_id = ? AND schedule_id = ?'),
        ['med-123', 'schedule-456']
      );
    });
  });

  describe('getMappingsByGroupKey', () => {
    it('should return all mappings for a group key and date', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([]);

      await scheduledNotificationRepo.getMappingsByGroupKey('09:00', '2025-12-15');

      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE group_key = ? AND date = ?'),
        ['09:00', '2025-12-15']
      );
    });
  });

  describe('deleteMapping', () => {
    it('should delete a mapping by id', async () => {
      await scheduledNotificationRepo.deleteMapping('sn_123');

      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'DELETE FROM scheduled_notifications WHERE id = ?',
        ['sn_123']
      );
    });
  });

  describe('deleteMappingsBySchedule', () => {
    it('should delete all mappings for a schedule and return count', async () => {
      mockDatabase.runAsync.mockResolvedValue({ changes: 5 });

      const result = await scheduledNotificationRepo.deleteMappingsBySchedule('med-123', 'schedule-456');

      expect(result).toBe(5);
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM scheduled_notifications'),
        ['med-123', 'schedule-456']
      );
    });
  });

  describe('deleteMappingsByNotificationId', () => {
    it('should delete all mappings for a notification id', async () => {
      mockDatabase.runAsync.mockResolvedValue({ changes: 2 });

      const result = await scheduledNotificationRepo.deleteMappingsByNotificationId('notif-123');

      expect(result).toBe(2);
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'DELETE FROM scheduled_notifications WHERE notification_id = ?',
        ['notif-123']
      );
    });
  });

  describe('countBySchedule', () => {
    it('should return count of mappings for a schedule', async () => {
      mockDatabase.getFirstAsync.mockResolvedValue({ count: 7 });

      const result = await scheduledNotificationRepo.countBySchedule('med-123', 'schedule-456');

      expect(result).toBe(7);
    });

    it('should return 0 when no result', async () => {
      mockDatabase.getFirstAsync.mockResolvedValue(null);

      const result = await scheduledNotificationRepo.countBySchedule('med-123', 'schedule-456');

      expect(result).toBe(0);
    });
  });

  describe('getLastScheduledDate', () => {
    it('should return the last scheduled date', async () => {
      mockDatabase.getFirstAsync.mockResolvedValue({ date: '2025-12-20' });

      const result = await scheduledNotificationRepo.getLastScheduledDate('med-123', 'schedule-456');

      expect(result).toBe('2025-12-20');
    });

    it('should return null when no mappings exist', async () => {
      mockDatabase.getFirstAsync.mockResolvedValue({ date: null });

      const result = await scheduledNotificationRepo.getLastScheduledDate('med-123', 'schedule-456');

      expect(result).toBeNull();
    });
  });

  describe('getAllMappings', () => {
    it('should return all mappings ordered by date', async () => {
      const mockRows = [
        {
          id: 'sn_1',
          medication_id: 'med-1',
          schedule_id: 'schedule-1',
          date: '2025-12-15',
          notification_id: 'notif-1',
          notification_type: 'reminder',
          is_grouped: 0,
          group_key: null,
          source_type: 'medication',
          medication_name: null,
          scheduled_trigger_time: null,
          notification_title: null,
          notification_body: null,
          category_identifier: null,
          created_at: Date.now(),
        },
      ];

      mockDatabase.getAllAsync.mockResolvedValue(mockRows);

      const result = await scheduledNotificationRepo.getAllMappings();

      expect(result).toHaveLength(1);
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY date ASC')
      );
    });
  });

  describe('getMappingsByDate', () => {
    it('should return mappings for a specific date', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([]);

      await scheduledNotificationRepo.getMappingsByDate('2025-12-15');

      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE date = ?'),
        ['2025-12-15']
      );
    });
  });

  describe('getFutureMappings', () => {
    it('should return mappings for today and future dates', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([]);

      await scheduledNotificationRepo.getFutureMappings();

      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE date >= ?'),
        expect.any(Array)
      );
    });
  });

  describe('deleteMappingsBeforeDate', () => {
    it('should delete old mappings and return count', async () => {
      mockDatabase.runAsync.mockResolvedValue({ changes: 10 });

      const result = await scheduledNotificationRepo.deleteMappingsBeforeDate('2025-12-15');

      expect(result).toBe(10);
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE date < ?'),
        ['2025-12-15']
      );
    });
  });

  describe('deleteAllMappings', () => {
    it('should delete all mappings and return count', async () => {
      mockDatabase.runAsync.mockResolvedValue({ changes: 50 });

      const result = await scheduledNotificationRepo.deleteAllMappings();

      expect(result).toBe(50);
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'DELETE FROM scheduled_notifications'
      );
    });
  });

  describe('getUniqueNotificationIdsForDate', () => {
    it('should return unique notification IDs for a date', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([
        { notification_id: 'notif-1' },
        { notification_id: 'notif-2' },
      ]);

      const result = await scheduledNotificationRepo.getUniqueNotificationIdsForDate('2025-12-15');

      expect(result).toEqual(['notif-1', 'notif-2']);
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('DISTINCT notification_id'),
        ['2025-12-15']
      );
    });
  });

  describe('Daily Check-in Functions', () => {
    describe('getDailyCheckinMapping', () => {
      it('should return daily check-in mapping for a date', async () => {
        const mockRow = {
          id: 'sn_checkin',
          medication_id: null,
          schedule_id: null,
          date: '2025-12-15',
          notification_id: 'checkin-notif',
          notification_type: 'daily_checkin',
          is_grouped: 0,
          group_key: null,
          source_type: 'daily_checkin',
          medication_name: null,
          scheduled_trigger_time: null,
          notification_title: null,
          notification_body: null,
          category_identifier: null,
          created_at: Date.now(),
        };

        mockDatabase.getFirstAsync.mockResolvedValue(mockRow);

        const result = await scheduledNotificationRepo.getDailyCheckinMapping('2025-12-15');

        expect(result).not.toBeNull();
        expect(result?.sourceType).toBe('daily_checkin');
        expect(mockDatabase.getFirstAsync).toHaveBeenCalledWith(
          expect.stringContaining("source_type = 'daily_checkin'"),
          ['2025-12-15']
        );
      });

      it('should return null when no daily check-in mapping exists', async () => {
        mockDatabase.getFirstAsync.mockResolvedValue(null);

        const result = await scheduledNotificationRepo.getDailyCheckinMapping('2025-12-15');

        expect(result).toBeNull();
      });
    });

    describe('getFutureDailyCheckinMappings', () => {
      it('should return future daily check-in mappings', async () => {
        mockDatabase.getAllAsync.mockResolvedValue([]);

        await scheduledNotificationRepo.getFutureDailyCheckinMappings();

        expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
          expect.stringContaining("source_type = 'daily_checkin'"),
          expect.any(Array)
        );
      });
    });

    describe('countDailyCheckins', () => {
      it('should return count of future daily check-in notifications', async () => {
        mockDatabase.getFirstAsync.mockResolvedValue({ count: 14 });

        const result = await scheduledNotificationRepo.countDailyCheckins();

        expect(result).toBe(14);
        expect(mockDatabase.getFirstAsync).toHaveBeenCalledWith(
          expect.stringContaining("source_type = 'daily_checkin'"),
          expect.any(Array)
        );
      });
    });

    describe('getLastDailyCheckinDate', () => {
      it('should return the last scheduled daily check-in date', async () => {
        mockDatabase.getFirstAsync.mockResolvedValue({ date: '2025-12-28' });

        const result = await scheduledNotificationRepo.getLastDailyCheckinDate();

        expect(result).toBe('2025-12-28');
      });

      it('should return null when no daily check-ins scheduled', async () => {
        mockDatabase.getFirstAsync.mockResolvedValue({ date: null });

        const result = await scheduledNotificationRepo.getLastDailyCheckinDate();

        expect(result).toBeNull();
      });
    });

    describe('deleteDailyCheckinMappings', () => {
      it('should delete all daily check-in mappings', async () => {
        mockDatabase.runAsync.mockResolvedValue({ changes: 14 });

        const result = await scheduledNotificationRepo.deleteDailyCheckinMappings();

        expect(result).toBe(14);
        expect(mockDatabase.runAsync).toHaveBeenCalledWith(
          expect.stringContaining("source_type = 'daily_checkin'")
        );
      });
    });
  });

  describe('getFutureMedicationMappings', () => {
    it('should return future medication mappings only', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([]);

      await scheduledNotificationRepo.getFutureMedicationMappings();

      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining("source_type = 'medication'"),
        expect.any(Array)
      );
    });
  });

  describe('Notification Metadata Query Methods', () => {
    describe('findByTimeWindow', () => {
      it('should find notifications within a time window', async () => {
        const targetTime = new Date('2025-12-15T09:00:00');
        mockDatabase.getAllAsync.mockResolvedValue([]);

        await scheduledNotificationRepo.findByTimeWindow(targetTime, 5);

        expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
          expect.stringContaining('scheduled_trigger_time BETWEEN ? AND ?'),
          expect.any(Array)
        );
      });

      it('should use default window of 5 minutes', async () => {
        const targetTime = new Date('2025-12-15T09:00:00');
        mockDatabase.getAllAsync.mockResolvedValue([]);

        await scheduledNotificationRepo.findByTimeWindow(targetTime);

        const call = mockDatabase.getAllAsync.mock.calls[0];
        const [startTime, endTime] = call[1];

        // Window should be 5 minutes on each side
        expect(new Date(endTime).getTime() - new Date(startTime).getTime()).toBe(10 * 60 * 1000);
      });
    });

    describe('findByMedicationName', () => {
      it('should find notifications by medication name within date range', async () => {
        const dateRange: [Date, Date] = [
          new Date('2025-12-15'),
          new Date('2025-12-20'),
        ];
        mockDatabase.getAllAsync.mockResolvedValue([]);

        await scheduledNotificationRepo.findByMedicationName('Ibuprofen', dateRange);

        expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
          expect.stringContaining('LOWER(medication_name) = LOWER(?)'),
          expect.arrayContaining(['Ibuprofen'])
        );
      });
    });

    describe('findByCategoryAndTime', () => {
      it('should find notifications by category and time window', async () => {
        const timeWindow: [Date, Date] = [
          new Date('2025-12-15T09:00:00'),
          new Date('2025-12-15T09:30:00'),
        ];
        mockDatabase.getAllAsync.mockResolvedValue([]);

        await scheduledNotificationRepo.findByCategoryAndTime('MEDICATION_REMINDER', timeWindow);

        expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
          expect.stringContaining('category_identifier = ?'),
          expect.arrayContaining(['MEDICATION_REMINDER'])
        );
      });
    });

    describe('findByNotificationContent', () => {
      it('should find notifications by title and body', async () => {
        mockDatabase.getAllAsync.mockResolvedValue([]);

        await scheduledNotificationRepo.findByNotificationContent(
          'Time for Ibuprofen',
          '1 dose - 200mg each'
        );

        expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
          expect.stringContaining('LOWER(notification_title) = LOWER(?)'),
          expect.arrayContaining(['Time for Ibuprofen', '1 dose - 200mg each'])
        );
      });
    });

    describe('getByNotificationId', () => {
      it('should return a single mapping by notification ID', async () => {
        const mockRow = {
          id: 'sn_123',
          medication_id: 'med-123',
          schedule_id: 'schedule-456',
          date: '2025-12-15',
          notification_id: 'notif-789',
          notification_type: 'reminder',
          is_grouped: 0,
          group_key: null,
          source_type: 'medication',
          medication_name: 'Ibuprofen',
          scheduled_trigger_time: '2025-12-15T09:00:00.000Z',
          notification_title: 'Time for Ibuprofen',
          notification_body: '1 dose - 200mg each',
          category_identifier: 'MEDICATION_REMINDER',
          created_at: Date.now(),
        };

        mockDatabase.getFirstAsync.mockResolvedValue(mockRow);

        const result = await scheduledNotificationRepo.getByNotificationId('notif-789');

        expect(result).not.toBeNull();
        expect(result?.medicationName).toBe('Ibuprofen');
        expect(result?.scheduledTriggerTime).toBeInstanceOf(Date);
        expect(mockDatabase.getFirstAsync).toHaveBeenCalledWith(
          'SELECT * FROM scheduled_notifications WHERE notification_id = ?',
          ['notif-789']
        );
      });

      it('should return null when notification not found', async () => {
        mockDatabase.getFirstAsync.mockResolvedValue(null);

        const result = await scheduledNotificationRepo.getByNotificationId('nonexistent');

        expect(result).toBeNull();
      });
    });
  });

  describe('rowToMapping conversion', () => {
    it('should correctly convert database row with all fields to domain model', async () => {
      const now = Date.now();
      const triggerTime = '2025-12-15T09:00:00.000Z';

      const mockRow = {
        id: 'sn_full',
        medication_id: 'med-full',
        schedule_id: 'schedule-full',
        date: '2025-12-15',
        notification_id: 'notif-full',
        notification_type: 'reminder',
        is_grouped: 1,
        group_key: '09:00',
        source_type: 'medication',
        medication_name: 'Full Test Med',
        scheduled_trigger_time: triggerTime,
        notification_title: 'Test Title',
        notification_body: 'Test Body',
        category_identifier: 'TEST_CATEGORY',
        created_at: now,
      };

      mockDatabase.getFirstAsync.mockResolvedValue(mockRow);

      const result = await scheduledNotificationRepo.getByNotificationId('notif-full');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('sn_full');
      expect(result?.medicationId).toBe('med-full');
      expect(result?.scheduleId).toBe('schedule-full');
      expect(result?.date).toBe('2025-12-15');
      expect(result?.notificationId).toBe('notif-full');
      expect(result?.notificationType).toBe('reminder');
      expect(result?.isGrouped).toBe(true);
      expect(result?.groupKey).toBe('09:00');
      expect(result?.sourceType).toBe('medication');
      expect(result?.medicationName).toBe('Full Test Med');
      expect(result?.scheduledTriggerTime).toEqual(new Date(triggerTime));
      expect(result?.notificationTitle).toBe('Test Title');
      expect(result?.notificationBody).toBe('Test Body');
      expect(result?.categoryIdentifier).toBe('TEST_CATEGORY');
      expect(result?.createdAt).toBe(new Date(now).toISOString());
    });

    it('should handle null optional fields correctly', async () => {
      const mockRow = {
        id: 'sn_minimal',
        medication_id: null,
        schedule_id: null,
        date: '2025-12-15',
        notification_id: 'notif-minimal',
        notification_type: 'daily_checkin',
        is_grouped: 0,
        group_key: null,
        source_type: 'daily_checkin',
        medication_name: null,
        scheduled_trigger_time: null,
        notification_title: null,
        notification_body: null,
        category_identifier: null,
        created_at: Date.now(),
      };

      mockDatabase.getFirstAsync.mockResolvedValue(mockRow);

      const result = await scheduledNotificationRepo.getByNotificationId('notif-minimal');

      expect(result).not.toBeNull();
      expect(result?.medicationId).toBeNull();
      expect(result?.scheduleId).toBeNull();
      expect(result?.groupKey).toBeUndefined();
      expect(result?.medicationName).toBeUndefined();
      expect(result?.scheduledTriggerTime).toBeUndefined();
      expect(result?.notificationTitle).toBeUndefined();
      expect(result?.notificationBody).toBeUndefined();
      expect(result?.categoryIdentifier).toBeUndefined();
    });

    it('should handle empty string source_type with fallback', async () => {
      const mockRow = {
        id: 'sn_empty',
        medication_id: 'med-123',
        schedule_id: 'schedule-456',
        date: '2025-12-15',
        notification_id: 'notif-empty',
        notification_type: 'reminder',
        is_grouped: 0,
        group_key: null,
        source_type: '', // Empty string
        medication_name: null,
        scheduled_trigger_time: null,
        notification_title: null,
        notification_body: null,
        category_identifier: null,
        created_at: Date.now(),
      };

      mockDatabase.getFirstAsync.mockResolvedValue(mockRow);

      const result = await scheduledNotificationRepo.getByNotificationId('notif-empty');

      // Empty string should fall back to 'medication'
      expect(result?.sourceType).toBe('medication');
    });
  });
});
