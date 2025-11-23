import { create } from 'zustand';
import { DailyStatusLog, DayStatus, YellowDayType, Episode } from '../models/types';
import { dailyStatusRepository } from '../database/dailyStatusRepository';
import { episodeRepository } from '../database/episodeRepository';
import { errorLogger } from '../services/errorLogger';
import { toastService } from '../services/toastService';
import { format, subDays } from 'date-fns';

// Lazy import to avoid require cycle with dailyCheckinService
const getDailyCheckinService = () =>
  require('../services/dailyCheckinService').dailyCheckinService;

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
  getEpisodesForDate: (date: string) => Promise<Episode[]>;
  checkShouldPrompt: () => Promise<boolean>;
  reset: () => void;
}

export const useDailyStatusStore = create<DailyStatusState>((set, get) => ({
  dailyStatuses: [],
  monthStats: null,
  loading: false,
  error: null,

  loadDailyStatuses: async (startDate, endDate) => {
    set({ loading: true, error: null });
    try {
      // Load manually logged statuses
      const manualStatuses = await dailyStatusRepository.getDateRange(startDate, endDate);

      // Load episodes in this date range and calculate red days
      const startTimestamp = new Date(startDate + 'T00:00:00').getTime();
      const endTimestamp = new Date(endDate + 'T23:59:59.999').getTime();
      const episodes = await episodeRepository.getByDateRange(startTimestamp, endTimestamp);

      // Build a map of dates that have manual statuses
      const manualStatusMap = new Map<string, DailyStatusLog>();
      manualStatuses.forEach(status => {
        manualStatusMap.set(status.date, status);
      });

      // Build a map of dates that have episodes (calculated red days)
      const episodeDateMap = new Map<string, Episode[]>();
      episodes.forEach(episode => {
        // Get all dates this episode spans
        const episodeStart = new Date(episode.startTime);
        const episodeEnd = episode.endTime ? new Date(episode.endTime) : new Date();

        let currentDate = new Date(episodeStart);
        currentDate.setHours(0, 0, 0, 0);

        const endDate = new Date(episodeEnd);
        endDate.setHours(0, 0, 0, 0);

        while (currentDate <= endDate) {
          const dateStr = format(currentDate, 'yyyy-MM-dd');
          if (!episodeDateMap.has(dateStr)) {
            episodeDateMap.set(dateStr, []);
          }
          episodeDateMap.get(dateStr)!.push(episode);
          currentDate.setDate(currentDate.getDate() + 1);
        }
      });

      // Merge: episode-based red days take precedence over manual statuses
      const mergedStatuses: DailyStatusLog[] = [];

      // Add all episode-based red days, preserving any saved notes
      episodeDateMap.forEach((episodes, dateStr) => {
        const savedStatus = manualStatusMap.get(dateStr);
        mergedStatuses.push({
          id: savedStatus?.id || `calculated-${dateStr}`,
          date: dateStr,
          status: 'red' as DayStatus,
          notes: savedStatus?.notes || undefined,
          prompted: savedStatus?.prompted || false,
          createdAt: savedStatus?.createdAt || Date.now(),
          updatedAt: savedStatus?.updatedAt || Date.now(),
        });
      });

      // Add manual statuses for dates without episodes
      manualStatuses.forEach(status => {
        if (!episodeDateMap.has(status.date)) {
          mergedStatuses.push(status);
        }
      });

      // Sort by date
      mergedStatuses.sort((a, b) => a.date.localeCompare(b.date));

      set({ dailyStatuses: mergedStatuses, loading: false });
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

      // Cancel any scheduled daily check-in notification for today
      // This prevents the notification from showing after the user has logged their day
      await getDailyCheckinService().cancelAndDismissForDate(date);

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

      // Show error toast
      toastService.error('Failed to log daily status');

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
      // First check if there's an episode on this date (auto red day)
      const episodes = await episodeRepository.getEpisodesForDate(date);
      if (episodes.length > 0) {
        // Check if there's a saved status with notes for this red day
        const savedLog = await dailyStatusRepository.getByDate(date);

        // Return a calculated red day status, preserving any saved notes
        return {
          id: savedLog?.id || `calculated-${date}`,
          date,
          status: 'red' as DayStatus,
          notes: savedLog?.notes || undefined,
          prompted: savedLog?.prompted || false,
          createdAt: savedLog?.createdAt || Date.now(),
          updatedAt: savedLog?.updatedAt || Date.now(),
        };
      }

      // Otherwise, get manually logged status
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

  getEpisodesForDate: async (date) => {
    try {
      const episodes = await episodeRepository.getEpisodesForDate(date);
      return episodes;
    } catch (error) {
      await errorLogger.log('database', 'Failed to get episodes for date', error as Error, {
        operation: 'getEpisodesForDate',
        date
      });
      return [];
    }
  },

  checkShouldPrompt: async () => {
    try {
      // Check if we should show the daily prompt for yesterday
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

      // Don't prompt if there was an episode on yesterday (auto red day)
      const episodes = await episodeRepository.getEpisodesForDate(yesterday);
      if (episodes.length > 0) {
        return false;
      }

      // Don't prompt if user already logged status for yesterday
      const yesterdayLog = await dailyStatusRepository.getByDate(yesterday);
      if (yesterdayLog) {
        return false;
      }

      return true;
    } catch (error) {
      await errorLogger.log('database', 'Failed to check should prompt', error as Error, {
        operation: 'checkShouldPrompt'
      });
      return false;
    }
  },

  reset: () => {
    set({
      dailyStatuses: [],
      monthStats: null,
      loading: false,
      error: null,
    });
  },
}));
