import { useDailyStatusStore } from '../dailyStatusStore';
import { dailyStatusRepository } from '../../database/dailyStatusRepository';
import { DailyStatusLog } from '../../models/types';

// Mock dependencies
jest.mock('../../database/dailyStatusRepository');
jest.mock('../../services/errorLogger');

// Mock date-fns functions
jest.mock('date-fns', () => ({
  format: jest.fn((date: Date, formatStr: string) => {
    if (formatStr === 'yyyy-MM-dd') {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return date.toString();
  }),
  subDays: jest.fn((date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  }),
}));

describe('dailyStatusStore', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset the store state
    useDailyStatusStore.setState({
      dailyStatuses: [],
      monthStats: undefined,
      loading: false,
      error: undefined,
    });
  });

  describe('loadDailyStatuses', () => {
    it('should load daily statuses successfully', async () => {
      const mockStatuses: DailyStatusLog[] = [
        {
          id: 'log-1',
          date: '2025-10-08',
          status: 'green',
          prompted: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'log-2',
          date: '2025-10-09',
          status: 'yellow',
          statusType: 'prodrome',
          notes: 'Warning signs',
          prompted: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      (dailyStatusRepository.getDateRange as jest.Mock).mockResolvedValue(mockStatuses);

      await useDailyStatusStore.getState().loadDailyStatuses('2025-10-08', '2025-10-09');

      const state = useDailyStatusStore.getState();
      expect(state.dailyStatuses).toEqual(mockStatuses);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(dailyStatusRepository.getDateRange).toHaveBeenCalledWith('2025-10-08', '2025-10-09');
    });

    it('should handle errors when loading daily statuses', async () => {
      const error = new Error('Database error');
      (dailyStatusRepository.getDateRange as jest.Mock).mockRejectedValue(error);

      await useDailyStatusStore.getState().loadDailyStatuses('2025-10-01', '2025-10-31');

      const state = useDailyStatusStore.getState();
      expect(state.dailyStatuses).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Database error');
    });

    it('should set loading state during load', async () => {
      (dailyStatusRepository.getDateRange as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      );

      const loadPromise = useDailyStatusStore.getState().loadDailyStatuses('2025-10-01', '2025-10-31');

      // Check loading state is true
      expect(useDailyStatusStore.getState().loading).toBe(true);

      await loadPromise;

      // Check loading state is false after completion
      expect(useDailyStatusStore.getState().loading).toBe(false);
    });
  });

  describe('loadMonthStats', () => {
    it('should load month stats successfully', async () => {
      const mockStats = { green: 18, yellow: 7, red: 5 };

      (dailyStatusRepository.getMonthStats as jest.Mock).mockResolvedValue(mockStats);

      await useDailyStatusStore.getState().loadMonthStats(2025, 10);

      const state = useDailyStatusStore.getState();
      expect(state.monthStats).toEqual(mockStats);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(dailyStatusRepository.getMonthStats).toHaveBeenCalledWith(2025, 10);
    });

    it('should handle errors when loading month stats', async () => {
      const error = new Error('Database error');
      (dailyStatusRepository.getMonthStats as jest.Mock).mockRejectedValue(error);

      await useDailyStatusStore.getState().loadMonthStats(2025, 10);

      const state = useDailyStatusStore.getState();
      expect(state.monthStats).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Database error');
    });
  });

  describe('logDayStatus', () => {
    it('should log green day successfully', async () => {
      const newLog: DailyStatusLog = {
        id: 'log-123',
        date: '2025-10-10',
        status: 'green',
        prompted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (dailyStatusRepository.upsert as jest.Mock).mockResolvedValue(newLog);

      const result = await useDailyStatusStore.getState().logDayStatus('2025-10-10', 'green');

      expect(result).toEqual(newLog);
      const state = useDailyStatusStore.getState();
      expect(state.dailyStatuses).toContainEqual(newLog);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(dailyStatusRepository.upsert).toHaveBeenCalledWith({
        date: '2025-10-10',
        status: 'green',
        statusType: undefined,
        notes: undefined,
        prompted: false,
      });
    });

    it('should log yellow day with type and notes', async () => {
      const newLog: DailyStatusLog = {
        id: 'log-456',
        date: '2025-10-10',
        status: 'yellow',
        statusType: 'prodrome',
        notes: 'Feeling warning signs',
        prompted: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (dailyStatusRepository.upsert as jest.Mock).mockResolvedValue(newLog);

      const result = await useDailyStatusStore.getState().logDayStatus(
        '2025-10-10',
        'yellow',
        'prodrome',
        'Feeling warning signs',
        true
      );

      expect(result).toEqual(newLog);
      expect(dailyStatusRepository.upsert).toHaveBeenCalledWith({
        date: '2025-10-10',
        status: 'yellow',
        statusType: 'prodrome',
        notes: 'Feeling warning signs',
        prompted: true,
      });
    });

    it('should replace existing log when upserting', async () => {
      const existingLog: DailyStatusLog = {
        id: 'log-1',
        date: '2025-10-10',
        status: 'yellow',
        statusType: 'prodrome',
        prompted: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useDailyStatusStore.setState({ dailyStatuses: [existingLog] });

      const updatedLog: DailyStatusLog = {
        ...existingLog,
        status: 'green',
        statusType: undefined,
        updatedAt: Date.now(),
      };

      (dailyStatusRepository.upsert as jest.Mock).mockResolvedValue(updatedLog);

      await useDailyStatusStore.getState().logDayStatus('2025-10-10', 'green');

      const state = useDailyStatusStore.getState();
      expect(state.dailyStatuses).toHaveLength(1);
      expect(state.dailyStatuses[0].status).toBe('green');
    });

    it('should handle errors when logging day status', async () => {
      const error = new Error('Failed to log status');
      (dailyStatusRepository.upsert as jest.Mock).mockRejectedValue(error);

      await expect(
        useDailyStatusStore.getState().logDayStatus('2025-10-10', 'green')
      ).rejects.toThrow('Failed to log status');

      const state = useDailyStatusStore.getState();
      expect(state.error).toBe('Failed to log status');
      expect(state.loading).toBe(false);
    });
  });

  describe('updateDayStatus', () => {
    it('should update day status successfully', async () => {
      const existingLog: DailyStatusLog = {
        id: 'log-123',
        date: '2025-10-10',
        status: 'yellow',
        statusType: 'prodrome',
        prompted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useDailyStatusStore.setState({ dailyStatuses: [existingLog] });

      (dailyStatusRepository.update as jest.Mock).mockResolvedValue(undefined);

      await useDailyStatusStore.getState().updateDayStatus('log-123', {
        status: 'green',
        statusType: undefined,
      });

      const state = useDailyStatusStore.getState();
      expect(state.dailyStatuses[0].status).toBe('green');
      expect(state.dailyStatuses[0].statusType).toBeUndefined();
      expect(dailyStatusRepository.update).toHaveBeenCalledWith('log-123', {
        status: 'green',
        statusType: undefined,
      });
    });

    it('should handle errors when updating day status', async () => {
      const error = new Error('Update failed');
      (dailyStatusRepository.update as jest.Mock).mockRejectedValue(error);

      await expect(
        useDailyStatusStore.getState().updateDayStatus('log-123', { status: 'green' })
      ).rejects.toThrow('Update failed');

      expect(useDailyStatusStore.getState().error).toBe('Update failed');
    });
  });

  describe('deleteDayStatus', () => {
    it('should delete day status successfully', async () => {
      const log1: DailyStatusLog = {
        id: 'log-1',
        date: '2025-10-08',
        status: 'green',
        prompted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const log2: DailyStatusLog = {
        id: 'log-2',
        date: '2025-10-09',
        status: 'yellow',
        statusType: 'prodrome',
        prompted: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useDailyStatusStore.setState({ dailyStatuses: [log1, log2] });

      (dailyStatusRepository.delete as jest.Mock).mockResolvedValue(undefined);

      await useDailyStatusStore.getState().deleteDayStatus('log-1');

      const state = useDailyStatusStore.getState();
      expect(state.dailyStatuses).toHaveLength(1);
      expect(state.dailyStatuses[0].id).toBe('log-2');
      expect(state.loading).toBe(false);
      expect(dailyStatusRepository.delete).toHaveBeenCalledWith('log-1');
    });

    it('should handle errors when deleting day status', async () => {
      const error = new Error('Delete failed');
      (dailyStatusRepository.delete as jest.Mock).mockRejectedValue(error);

      await expect(
        useDailyStatusStore.getState().deleteDayStatus('log-123')
      ).rejects.toThrow('Delete failed');

      const state = useDailyStatusStore.getState();
      expect(state.error).toBe('Delete failed');
      expect(state.loading).toBe(false);
    });
  });

  describe('getDayStatus', () => {
    it('should get day status successfully', async () => {
      const mockLog: DailyStatusLog = {
        id: 'log-123',
        date: '2025-10-10',
        status: 'green',
        prompted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (dailyStatusRepository.getByDate as jest.Mock).mockResolvedValue(mockLog);

      const result = await useDailyStatusStore.getState().getDayStatus('2025-10-10');

      expect(result).toEqual(mockLog);
      expect(dailyStatusRepository.getByDate).toHaveBeenCalledWith('2025-10-10');
    });

    it('should return null when day status not found', async () => {
      (dailyStatusRepository.getByDate as jest.Mock).mockResolvedValue(null);

      const result = await useDailyStatusStore.getState().getDayStatus('2025-10-10');

      expect(result).toBeNull();
    });

    it('should handle errors when getting day status', async () => {
      const error = new Error('Get failed');
      (dailyStatusRepository.getByDate as jest.Mock).mockRejectedValue(error);

      const result = await useDailyStatusStore.getState().getDayStatus('2025-10-10');

      expect(result).toBeNull();
      expect(useDailyStatusStore.getState().error).toBe('Get failed');
    });
  });

  describe('checkShouldPrompt', () => {
    it('should return false if yesterday has a log', async () => {
      const mockLog: DailyStatusLog = {
        id: 'log-yesterday',
        date: '2025-10-09',
        status: 'green',
        prompted: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (dailyStatusRepository.getByDate as jest.Mock).mockResolvedValue(mockLog);

      const result = await useDailyStatusStore.getState().checkShouldPrompt();

      expect(result).toBe(false);
    });

    it('should return true if yesterday has no log', async () => {
      (dailyStatusRepository.getByDate as jest.Mock).mockResolvedValue(null);

      const result = await useDailyStatusStore.getState().checkShouldPrompt();

      expect(result).toBe(true);
    });

    it('should handle errors and return false', async () => {
      const error = new Error('Check failed');
      (dailyStatusRepository.getByDate as jest.Mock).mockRejectedValue(error);

      const result = await useDailyStatusStore.getState().checkShouldPrompt();

      expect(result).toBe(false);
    });
  });

  describe('state management', () => {
    it('should have correct initial state', () => {
      const state = useDailyStatusStore.getState();

      expect(state.dailyStatuses).toEqual([]);
      expect(state.monthStats).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should maintain state across multiple operations', async () => {
      // Load statuses
      (dailyStatusRepository.getDateRange as jest.Mock).mockResolvedValue([]);
      await useDailyStatusStore.getState().loadDailyStatuses('2025-10-01', '2025-10-31');
      expect(useDailyStatusStore.getState().loading).toBe(false);

      // Log new status
      const newLog: DailyStatusLog = {
        id: 'new-log',
        date: '2025-10-10',
        status: 'green',
        prompted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (dailyStatusRepository.upsert as jest.Mock).mockResolvedValue(newLog);
      await useDailyStatusStore.getState().logDayStatus('2025-10-10', 'green');

      const state = useDailyStatusStore.getState();
      expect(state.dailyStatuses).toHaveLength(1);
      expect(state.error).toBeNull();
    });
  });
});
