import { dailyStatusRepository } from '../dailyStatusRepository';
import { DailyStatusLog } from '../../models/types';
import * as db from '../db';

// Mock the database module
jest.mock('../db');

describe('dailyStatusRepository', () => {
  let mockDatabase: any;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Create a mock database instance
    mockDatabase = {
      runAsync: jest.fn().mockResolvedValue(undefined),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      getAllAsync: jest.fn().mockResolvedValue([]),
    };

    // Mock getDatabase to return our mock database
    (db.getDatabase as jest.Mock).mockResolvedValue(mockDatabase);

    // Mock generateId to return predictable IDs
    (db.generateId as jest.Mock).mockReturnValue('status-id-123');
  });

  describe('create', () => {
    it('should create a new daily status log with all fields', async () => {
      const newLog: Omit<DailyStatusLog, 'id' | 'createdAt' | 'updatedAt'> = {
        date: '2025-10-10',
        status: 'yellow',
        statusType: 'prodrome',
        notes: 'Feeling warning signs',
        prompted: true,
      };

      const result = await dailyStatusRepository.create(newLog);

      expect(result.id).toBe('status-id-123');
      expect(result.date).toBe('2025-10-10');
      expect(result.status).toBe('yellow');
      expect(result.statusType).toBe('prodrome');
      expect(result.notes).toBe('Feeling warning signs');
      expect(result.prompted).toBe(true);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(mockDatabase.runAsync).toHaveBeenCalledTimes(1);
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO daily_status_logs'),
        expect.arrayContaining([
          'status-id-123',
          '2025-10-10',
          'yellow',
          'prodrome',
          'Feeling warning signs',
          1, // prompted = true
        ])
      );
    });

    it('should handle green day without statusType and notes', async () => {
      const greenLog: Omit<DailyStatusLog, 'id' | 'createdAt' | 'updatedAt'> = {
        date: '2025-10-10',
        status: 'green',
        prompted: false,
      };

      const result = await dailyStatusRepository.create(greenLog);

      expect(result.status).toBe('green');
      expect(result.statusType).toBeUndefined();
      expect(result.notes).toBeUndefined();
      expect(result.prompted).toBe(false);
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          'status-id-123',
          '2025-10-10',
          'green',
          null, // statusType
          null, // notes
          0, // prompted = false
        ])
      );
    });

    it('should accept custom database instance', async () => {
      const customDb = { runAsync: jest.fn().mockResolvedValue(undefined) };
      const log: Omit<DailyStatusLog, 'id' | 'createdAt' | 'updatedAt'> = {
        date: '2025-10-10',
        status: 'green',
        prompted: false,
      };

      await dailyStatusRepository.create(log, customDb as any);

      expect(customDb.runAsync).toHaveBeenCalledTimes(1);
      expect(mockDatabase.runAsync).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update status', async () => {
      await dailyStatusRepository.update('status-123', { status: 'green' });

      expect(mockDatabase.runAsync).toHaveBeenCalledTimes(1);
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE daily_status_logs SET'),
        expect.arrayContaining(['green', 'status-123'])
      );
    });

    it('should update multiple fields', async () => {
      const updates = {
        status: 'yellow' as const,
        statusType: 'postdrome' as const,
        notes: 'Recovery period',
        prompted: true,
      };

      await dailyStatusRepository.update('status-123', updates);

      expect(mockDatabase.runAsync).toHaveBeenCalledTimes(1);
      const call = mockDatabase.runAsync.mock.calls[0];
      expect(call[0]).toContain('UPDATE daily_status_logs SET');
      expect(call[0]).toContain('status = ?');
      expect(call[0]).toContain('status_type = ?');
      expect(call[0]).toContain('notes = ?');
      expect(call[0]).toContain('prompted = ?');
      expect(call[0]).toContain('updated_at = ?');
      expect(call[1]).toContain('status-123');
    });

    it('should only update specified fields', async () => {
      await dailyStatusRepository.update('status-123', { notes: 'Only notes' });

      const call = mockDatabase.runAsync.mock.calls[0];
      expect(call[0]).toContain('notes = ?');
      expect(call[0]).toContain('updated_at = ?');
      expect(call[0]).not.toContain('status = ?');
    });
  });

  describe('upsert', () => {
    it('should create new log if date does not exist', async () => {
      mockDatabase.getFirstAsync.mockResolvedValueOnce(null);

      const log: Omit<DailyStatusLog, 'id' | 'createdAt' | 'updatedAt'> = {
        date: '2025-10-10',
        status: 'green',
        prompted: false,
      };

      const result = await dailyStatusRepository.upsert(log);

      expect(result.id).toBe('status-id-123');
      expect(mockDatabase.getFirstAsync).toHaveBeenCalledWith(
        'SELECT * FROM daily_status_logs WHERE date = ?',
        ['2025-10-10']
      );
      expect(mockDatabase.runAsync).toHaveBeenCalledTimes(1);
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        expect.any(Array)
      );
    });

    it('should update existing log if date exists', async () => {
      const existingLog = {
        id: 'existing-id',
        date: '2025-10-10',
        status: 'yellow',
        status_type: 'prodrome',
        notes: undefined,
        prompted: 1,
        created_at: Date.now() - 1000,
        updated_at: Date.now() - 1000,
      };

      mockDatabase.getFirstAsync.mockResolvedValueOnce(existingLog);

      const log: Omit<DailyStatusLog, 'id' | 'createdAt' | 'updatedAt'> = {
        date: '2025-10-10',
        status: 'red',
        prompted: false,
      };

      const result = await dailyStatusRepository.upsert(log);

      expect(result.status).toBe('red');
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.any(Array)
      );
    });
  });

  describe('getByDate', () => {
    it('should return log when found', async () => {
      const mockRow = {
        id: 'status-123',
        date: '2025-10-10',
        status: 'yellow',
        status_type: 'prodrome',
        notes: 'Test notes',
        prompted: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDatabase.getFirstAsync.mockResolvedValueOnce(mockRow);

      const result = await dailyStatusRepository.getByDate('2025-10-10');

      expect(result).not.toBeUndefined();
      expect(result?.id).toBe('status-123');
      expect(result?.date).toBe('2025-10-10');
      expect(result?.status).toBe('yellow');
      expect(result?.statusType).toBe('prodrome');
      expect(result?.prompted).toBe(true);
      expect(mockDatabase.getFirstAsync).toHaveBeenCalledWith(
        'SELECT * FROM daily_status_logs WHERE date = ?',
        ['2025-10-10']
      );
    });

    it('should return null when log not found', async () => {
      mockDatabase.getFirstAsync.mockResolvedValueOnce(null);

      const result = await dailyStatusRepository.getByDate('2025-10-10');

      expect(result).toBe(null);
    });

    it('should handle log without optional fields', async () => {
      const mockRow = {
        id: 'status-123',
        date: '2025-10-10',
        status: 'green',
        status_type: null,
        notes: null,
        prompted: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDatabase.getFirstAsync.mockResolvedValueOnce(mockRow);

      const result = await dailyStatusRepository.getByDate('2025-10-10');

      expect(result?.statusType).toBeUndefined();
      expect(result?.notes).toBeUndefined();
      expect(result?.prompted).toBe(false);
    });
  });

  describe('getDateRange', () => {
    it('should return logs within date range', async () => {
      const mockRows = [
        {
          id: 'status-1',
          date: '2025-10-08',
          status: 'green',
          status_type: null,
          notes: null,
          prompted: 1,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
        {
          id: 'status-2',
          date: '2025-10-09',
          status: 'yellow',
          status_type: 'prodrome',
          notes: 'Warning signs',
          prompted: 1,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
        {
          id: 'status-3',
          date: '2025-10-10',
          status: 'red',
          status_type: null,
          notes: 'Episode day',
          prompted: 0,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ];

      mockDatabase.getAllAsync.mockResolvedValueOnce(mockRows);

      const result = await dailyStatusRepository.getDateRange('2025-10-08', '2025-10-10');

      expect(result).toHaveLength(3);
      expect(result[0].status).toBe('green');
      expect(result[1].status).toBe('yellow');
      expect(result[2].status).toBe('red');
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM daily_status_logs WHERE date >= ? AND date <= ? ORDER BY date ASC',
        ['2025-10-08', '2025-10-10']
      );
    });

    it('should return empty array when no logs in range', async () => {
      mockDatabase.getAllAsync.mockResolvedValueOnce([]);

      const result = await dailyStatusRepository.getDateRange('2025-10-01', '2025-10-31');

      expect(result).toEqual([]);
    });
  });

  describe('getMonthStats', () => {
    it('should return stats for all statuses', async () => {
      // First call returns daily_status_logs
      const mockStatusRows = [
        { id: '1', date: '2025-10-01', status: 'green', status_type: null, notes: null, prompted: 1, created_at: Date.now(), updated_at: Date.now() },
        { id: '2', date: '2025-10-02', status: 'green', status_type: null, notes: null, prompted: 1, created_at: Date.now(), updated_at: Date.now() },
        { id: '3', date: '2025-10-03', status: 'yellow', status_type: 'prodrome', notes: null, prompted: 1, created_at: Date.now(), updated_at: Date.now() },
        { id: '4', date: '2025-10-04', status: 'red', status_type: null, notes: null, prompted: 1, created_at: Date.now(), updated_at: Date.now() },
      ];
      // Second call returns episodes (empty)
      mockDatabase.getAllAsync.mockResolvedValueOnce(mockStatusRows);
      mockDatabase.getAllAsync.mockResolvedValueOnce([]);

      const result = await dailyStatusRepository.getMonthStats(2025, 10);

      expect(result).toEqual({ green: 2, yellow: 1, red: 1 });
      expect(mockDatabase.getAllAsync).toHaveBeenCalledTimes(2);
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('daily_status_logs'),
        expect.arrayContaining(['2025-10-01', '2025-10-31'])
      );
    });

    it('should handle month with no logs and no episodes', async () => {
      // First call returns empty daily_status_logs
      mockDatabase.getAllAsync.mockResolvedValueOnce([]);
      // Second call returns empty episodes
      mockDatabase.getAllAsync.mockResolvedValueOnce([]);

      const result = await dailyStatusRepository.getMonthStats(2025, 10);

      expect(result).toEqual({ green: 0, yellow: 0, red: 0 });
    });

    it('should handle month with only some statuses', async () => {
      const mockStatusRows = [
        { id: '1', date: '2025-10-01', status: 'green', status_type: null, notes: null, prompted: 1, created_at: Date.now(), updated_at: Date.now() },
        { id: '2', date: '2025-10-02', status: 'red', status_type: null, notes: null, prompted: 1, created_at: Date.now(), updated_at: Date.now() },
      ];
      mockDatabase.getAllAsync.mockResolvedValueOnce(mockStatusRows);
      mockDatabase.getAllAsync.mockResolvedValueOnce([]);

      const result = await dailyStatusRepository.getMonthStats(2025, 10);

      expect(result).toEqual({ green: 1, yellow: 0, red: 1 });
    });

    it('should handle February correctly', async () => {
      mockDatabase.getAllAsync.mockResolvedValueOnce([]);
      mockDatabase.getAllAsync.mockResolvedValueOnce([]);

      await dailyStatusRepository.getMonthStats(2025, 2);

      const call = mockDatabase.getAllAsync.mock.calls[0];
      expect(call[1][0]).toBe('2025-02-01');
      expect(call[1][1]).toBe('2025-02-28'); // 2025 is not a leap year
    });

    it('should count day with episode as red even when manually marked green (Issue #189)', async () => {
      // Day marked as green manually
      const mockStatusRows = [
        { id: '1', date: '2025-10-15', status: 'green', status_type: null, notes: null, prompted: 1, created_at: Date.now(), updated_at: Date.now() },
      ];
      // But there's an episode on that day
      const mockEpisodes = [
        {
          id: 'ep-1',
          start_time: new Date('2025-10-15T10:00:00').getTime(),
          end_time: new Date('2025-10-15T14:00:00').getTime(),
          locations: '[]',
          qualities: '[]',
          symptoms: '[]',
          triggers: '[]',
          notes: null,
          latitude: null,
          longitude: null,
          location_accuracy: null,
          location_timestamp: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ];
      mockDatabase.getAllAsync.mockResolvedValueOnce(mockStatusRows);
      mockDatabase.getAllAsync.mockResolvedValueOnce(mockEpisodes);

      const result = await dailyStatusRepository.getMonthStats(2025, 10);

      // The green day should NOT be counted as green because it has an episode
      // Instead, it should be counted as red
      expect(result).toEqual({ green: 0, yellow: 0, red: 1 });
    });

    it('should count day with episode as red even when manually marked yellow (Issue #189)', async () => {
      // Day marked as yellow manually
      const mockStatusRows = [
        { id: '1', date: '2025-10-15', status: 'yellow', status_type: 'prodrome', notes: null, prompted: 1, created_at: Date.now(), updated_at: Date.now() },
      ];
      // But there's an episode on that day
      const mockEpisodes = [
        {
          id: 'ep-1',
          start_time: new Date('2025-10-15T10:00:00').getTime(),
          end_time: new Date('2025-10-15T14:00:00').getTime(),
          locations: '[]',
          qualities: '[]',
          symptoms: '[]',
          triggers: '[]',
          notes: null,
          latitude: null,
          longitude: null,
          location_accuracy: null,
          location_timestamp: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ];
      mockDatabase.getAllAsync.mockResolvedValueOnce(mockStatusRows);
      mockDatabase.getAllAsync.mockResolvedValueOnce(mockEpisodes);

      const result = await dailyStatusRepository.getMonthStats(2025, 10);

      // The yellow day should NOT be counted as yellow because it has an episode
      // Instead, it should be counted as red
      expect(result).toEqual({ green: 0, yellow: 0, red: 1 });
    });

    it('should count episodes as red days even without manual status log', async () => {
      // No manual status logs
      mockDatabase.getAllAsync.mockResolvedValueOnce([]);
      // But there's an episode
      const mockEpisodes = [
        {
          id: 'ep-1',
          start_time: new Date('2025-10-15T10:00:00').getTime(),
          end_time: new Date('2025-10-15T14:00:00').getTime(),
          locations: '[]',
          qualities: '[]',
          symptoms: '[]',
          triggers: '[]',
          notes: null,
          latitude: null,
          longitude: null,
          location_accuracy: null,
          location_timestamp: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ];
      mockDatabase.getAllAsync.mockResolvedValueOnce(mockEpisodes);

      const result = await dailyStatusRepository.getMonthStats(2025, 10);

      // Episode day should count as red
      expect(result).toEqual({ green: 0, yellow: 0, red: 1 });
    });

    it('should handle multi-day episode spanning across multiple dates', async () => {
      // Manual status logs on different days
      const mockStatusRows = [
        { id: '1', date: '2025-10-14', status: 'green', status_type: null, notes: null, prompted: 1, created_at: Date.now(), updated_at: Date.now() },
        { id: '2', date: '2025-10-15', status: 'green', status_type: null, notes: null, prompted: 1, created_at: Date.now(), updated_at: Date.now() },
        { id: '3', date: '2025-10-16', status: 'green', status_type: null, notes: null, prompted: 1, created_at: Date.now(), updated_at: Date.now() },
      ];
      // Episode spans Oct 15-16
      const mockEpisodes = [
        {
          id: 'ep-1',
          start_time: new Date('2025-10-15T22:00:00').getTime(),
          end_time: new Date('2025-10-16T10:00:00').getTime(),
          locations: '[]',
          qualities: '[]',
          symptoms: '[]',
          triggers: '[]',
          notes: null,
          latitude: null,
          longitude: null,
          location_accuracy: null,
          location_timestamp: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ];
      mockDatabase.getAllAsync.mockResolvedValueOnce(mockStatusRows);
      mockDatabase.getAllAsync.mockResolvedValueOnce(mockEpisodes);

      const result = await dailyStatusRepository.getMonthStats(2025, 10);

      // Oct 14 is green (no episode), Oct 15 and 16 are red (episode spans both)
      expect(result).toEqual({ green: 1, yellow: 0, red: 2 });
    });

    it('should combine manual red status with episode red days correctly', async () => {
      // Manual red status on Oct 10, green on Oct 15
      const mockStatusRows = [
        { id: '1', date: '2025-10-10', status: 'red', status_type: null, notes: null, prompted: 1, created_at: Date.now(), updated_at: Date.now() },
        { id: '2', date: '2025-10-15', status: 'green', status_type: null, notes: null, prompted: 1, created_at: Date.now(), updated_at: Date.now() },
      ];
      // Episode on Oct 15 (overrides green)
      const mockEpisodes = [
        {
          id: 'ep-1',
          start_time: new Date('2025-10-15T10:00:00').getTime(),
          end_time: new Date('2025-10-15T14:00:00').getTime(),
          locations: '[]',
          qualities: '[]',
          symptoms: '[]',
          triggers: '[]',
          notes: null,
          latitude: null,
          longitude: null,
          location_accuracy: null,
          location_timestamp: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ];
      mockDatabase.getAllAsync.mockResolvedValueOnce(mockStatusRows);
      mockDatabase.getAllAsync.mockResolvedValueOnce(mockEpisodes);

      const result = await dailyStatusRepository.getMonthStats(2025, 10);

      // Oct 10 is manual red, Oct 15 is episode red
      expect(result).toEqual({ green: 0, yellow: 0, red: 2 });
    });

    it('should handle ongoing episode (no end_time)', async () => {
      // Manual green status
      const mockStatusRows = [
        { id: '1', date: '2025-10-15', status: 'green', status_type: null, notes: null, prompted: 1, created_at: Date.now(), updated_at: Date.now() },
      ];
      // Ongoing episode (no end_time)
      const mockEpisodes = [
        {
          id: 'ep-1',
          start_time: new Date('2025-10-15T10:00:00').getTime(),
          end_time: null,
          locations: '[]',
          qualities: '[]',
          symptoms: '[]',
          triggers: '[]',
          notes: null,
          latitude: null,
          longitude: null,
          location_accuracy: null,
          location_timestamp: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ];
      mockDatabase.getAllAsync.mockResolvedValueOnce(mockStatusRows);
      mockDatabase.getAllAsync.mockResolvedValueOnce(mockEpisodes);

      const result = await dailyStatusRepository.getMonthStats(2025, 10);

      // Day with ongoing episode should be red
      expect(result.red).toBeGreaterThanOrEqual(1);
      expect(result.green).toBe(0);
    });
  });

  describe('delete', () => {
    it('should delete log by id', async () => {
      await dailyStatusRepository.delete('status-123');

      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'DELETE FROM daily_status_logs WHERE id = ?',
        ['status-123']
      );
    });
  });

  describe('deleteByDate', () => {
    it('should delete log by date', async () => {
      await dailyStatusRepository.deleteByDate('2025-10-10');

      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'DELETE FROM daily_status_logs WHERE date = ?',
        ['2025-10-10']
      );
    });
  });

  describe('deleteAll', () => {
    it('should delete all logs', async () => {
      await dailyStatusRepository.deleteAll();

      expect(mockDatabase.runAsync).toHaveBeenCalledWith('DELETE FROM daily_status_logs');
    });
  });

  describe('mapRowToLog', () => {
    it('should correctly map database row to DailyStatusLog object', () => {
      const row = {
        id: 'status-123',
        date: '2025-10-10',
        status: 'yellow',
        status_type: 'prodrome',
        notes: 'Test notes',
        prompted: 1,
        created_at: 1000,
        updated_at: 1100,
      };

      const log = dailyStatusRepository.mapRowToLog(row);

      expect(log.id).toBe('status-123');
      expect(log.date).toBe('2025-10-10');
      expect(log.status).toBe('yellow');
      expect(log.statusType).toBe('prodrome');
      expect(log.notes).toBe('Test notes');
      expect(log.prompted).toBe(true);
      expect(log.createdAt).toBe(1000);
      expect(log.updatedAt).toBe(1100);
    });

    it('should handle null optional fields correctly', () => {
      const row = {
        id: 'status-123',
        date: '2025-10-10',
        status: 'green',
        status_type: null,
        notes: null,
        prompted: 0,
        created_at: 1000,
        updated_at: 1000,
      };

      const log = dailyStatusRepository.mapRowToLog(row);

      expect(log.statusType).toBeUndefined();
      expect(log.notes).toBeUndefined();
      expect(log.prompted).toBe(false);
    });
  });

  describe('Validation Error Handling', () => {
    describe('dailyStatusRepository.create validation', () => {
      it('should throw error for non-yellow day with status type', async () => {
        const invalidLog: any = {
          date: '2025-01-15',
          status: 'green',
          statusType: 'prodrome',
          prompted: false,
        };

        await expect(dailyStatusRepository.create(invalidLog)).rejects.toThrow('Status type can only be set for yellow days');
      });

      it('should throw error for invalid date format', async () => {
        const invalidLog: any = {
          date: '01-15-2025',
          status: 'green',
          prompted: false,
        };

        await expect(dailyStatusRepository.create(invalidLog)).rejects.toThrow('Date must be in YYYY-MM-DD format');
      });

      it('should throw error for future date', async () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);
        const dateStr = futureDate.toISOString().split('T')[0];

        const invalidLog: any = {
          date: dateStr,
          status: 'green',
          prompted: false,
        };

        await expect(dailyStatusRepository.create(invalidLog)).rejects.toThrow('Date cannot be in the future');
      });

      it('should allow yellow day with status type', async () => {
        const validLog: any = {
          date: '2025-01-15',
          status: 'yellow',
          statusType: 'prodrome',
          prompted: false,
        };

        const result = await dailyStatusRepository.create(validLog);
        expect(result.status).toBe('yellow');
        expect(result.statusType).toBe('prodrome');
      });

      it('should throw error for notes > 5000 characters', async () => {
        const invalidLog: any = {
          date: '2025-01-15',
          status: 'green',
          notes: 'x'.repeat(5001),
          prompted: false,
        };

        await expect(dailyStatusRepository.create(invalidLog)).rejects.toThrow('Notes must be <= 5000 characters');
      });
    });
  });
});
