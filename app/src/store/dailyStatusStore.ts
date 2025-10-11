import { create } from 'zustand';
import { DailyStatusLog, DayStatus, YellowDayType } from '../models/types';
import { dailyStatusRepository } from '../database/dailyStatusRepository';
import { errorLogger } from '../services/errorLogger';
import { format, subDays } from 'date-fns';

interface DailyStatusState {
  dailyStatuses: DailyStatusLog[];
  monthStats: { green: number; yellow: number; red: number } | null;
  loading: boolean;
  error: string | null;

  // Actions
  loadDailyStatuses: (startDate: string, endDate: string) => Promise<void>;
  loadMonthStats: (year: number, month: number) => Promise<void>;
  logDayStatus: (date: string, status: DayStatus, statusType?: YellowDayType, notes?: string, prompted?: boolean) => Promise<DailyStatusLog>;
  updateDayStatus: (id: string, updates: Partial<DailyStatusLog>) => Promise<void>;
  deleteDayStatus: (id: string) => Promise<void>;
  getDayStatus: (date: string) => Promise<DailyStatusLog | null>;
  checkShouldPrompt: () => Promise<boolean>;
}

export const useDailyStatusStore = create<DailyStatusState>((set, get) => ({
  dailyStatuses: [],
  monthStats: null,
  loading: false,
  error: null,

  loadDailyStatuses: async (startDate, endDate) => {
    set({ loading: true, error: null });
    try {
      const dailyStatuses = await dailyStatusRepository.getDateRange(startDate, endDate);
      set({ dailyStatuses, loading: false });
    } catch (error) {
      await errorLogger.log('database', 'Failed to load daily statuses', error as Error, {
        operation: 'loadDailyStatuses',
        startDate,
        endDate
      });
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadMonthStats: async (year, month) => {
    set({ loading: true, error: null });
    try {
      const monthStats = await dailyStatusRepository.getMonthStats(year, month);
      set({ monthStats, loading: false });
    } catch (error) {
      await errorLogger.log('database', 'Failed to load month stats', error as Error, {
        operation: 'loadMonthStats',
        year,
        month
      });
      set({ error: (error as Error).message, loading: false });
    }
  },

  logDayStatus: async (date, status, statusType, notes, prompted = false) => {
    set({ loading: true, error: null });
    try {
      const newLog = await dailyStatusRepository.upsert({
        date,
        status,
        statusType,
        notes,
        prompted,
      });

      // Update local state - replace or add
      const existingIndex = get().dailyStatuses.findIndex(log => log.date === date);
      const updatedStatuses = existingIndex >= 0
        ? get().dailyStatuses.map((log, idx) => idx === existingIndex ? newLog : log)
        : [...get().dailyStatuses, newLog].sort((a, b) => a.date.localeCompare(b.date));

      set({ dailyStatuses: updatedStatuses, loading: false });
      return newLog;
    } catch (error) {
      await errorLogger.log('database', 'Failed to log day status', error as Error, {
        operation: 'logDayStatus',
        date,
        status
      });
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  updateDayStatus: async (id, updates) => {
    try {
      await dailyStatusRepository.update(id, updates);

      // Update local state
      const updatedStatuses = get().dailyStatuses.map(log =>
        log.id === id ? { ...log, ...updates, updatedAt: Date.now() } : log
      );

      set({ dailyStatuses: updatedStatuses });
    } catch (error) {
      await errorLogger.log('database', 'Failed to update day status', error as Error, {
        operation: 'updateDayStatus',
        id
      });
      set({ error: (error as Error).message });
      throw error;
    }
  },

  deleteDayStatus: async (id) => {
    set({ loading: true, error: null });
    try {
      await dailyStatusRepository.delete(id);

      const updatedStatuses = get().dailyStatuses.filter(log => log.id !== id);
      set({ dailyStatuses: updatedStatuses, loading: false });
    } catch (error) {
      await errorLogger.log('database', 'Failed to delete day status', error as Error, {
        operation: 'deleteDayStatus',
        id
      });
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  getDayStatus: async (date) => {
    try {
      const log = await dailyStatusRepository.getByDate(date);
      return log;
    } catch (error) {
      await errorLogger.log('database', 'Failed to get day status', error as Error, {
        operation: 'getDayStatus',
        date
      });
      set({ error: (error as Error).message });
      return null;
    }
  },

  checkShouldPrompt: async () => {
    try {
      // Check if we should show the daily prompt for yesterday
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      const yesterdayLog = await dailyStatusRepository.getByDate(yesterday);

      // Don't prompt if user already logged status for yesterday
      if (yesterdayLog) {
        return false;
      }

      // TODO: Also check if there was an episode on yesterday (would auto-create red day)
      // This will be implemented when we integrate with episodeStore

      return true;
    } catch (error) {
      await errorLogger.log('app', 'Failed to check should prompt', error as Error, {
        operation: 'checkShouldPrompt'
      });
      return false;
    }
  },
}));
