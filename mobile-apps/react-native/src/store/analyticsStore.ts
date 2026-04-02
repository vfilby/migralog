/**
 * Analytics Store
 *
 * Provides centralized state management for analytics data with:
 * - Date range management for analytics queries
 * - Cached episode and intensity reading data
 * - Proper Components → Stores → Repositories pattern adherence
 *
 * This store solves several problems from issue #193:
 * 1. Pattern inconsistency - Analytics components now use this store instead of direct repository calls
 * 2. Duplicate date range calculations - Date range is calculated once and shared
 * 3. Caching - Data is cached and only refetched when date range changes or cache expires
 * 4. Performance - Uses targeted queries for episodes and intensity readings
 */

import { create } from 'zustand';
import { Episode, IntensityReading, TimeRangeDays } from '../models/types';
import { episodeRepository, intensityRepository } from '../database/episodeRepository';
import { getDateRangeForDays } from '../utils/analyticsUtils';
import { cacheManager } from '../utils/cacheManager';

// Cache key prefix for analytics data
const ANALYTICS_CACHE_PREFIX = 'analytics';
const ANALYTICS_CACHE_TTL = 30000; // 30 seconds - longer TTL for analytics data

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface AnalyticsState {
  // State
  selectedDays: TimeRangeDays;
  dateRange: DateRange;
  episodes: Episode[];
  intensityReadings: IntensityReading[];
  isLoading: boolean;
  lastFetched: number | null;
  error: string | null;

  // Actions
  setDateRange: (days: TimeRangeDays) => Promise<void>;
  fetchAnalyticsData: () => Promise<void>;
  refreshData: () => Promise<void>;
  invalidateCache: () => void;
}

/**
 * Creates a cache key for analytics data based on selected days
 */
function getAnalyticsCacheKey(days: TimeRangeDays): string {
  return `${ANALYTICS_CACHE_PREFIX}_${days}`;
}

/**
 * Analytics store for managing date-range-based analytics data
 */
export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  // Initial state - default to 30 days
  selectedDays: 30,
  dateRange: getDateRangeForDays(30),
  episodes: [],
  intensityReadings: [],
  isLoading: false,
  lastFetched: null,
  error: null,

  /**
   * Set the date range and fetch data for the new range
   * This is the primary way to change the analytics time period
   */
  setDateRange: async (days: TimeRangeDays) => {
    const currentDays = get().selectedDays;

    // If days haven't changed, check if we have valid cached data
    if (days === currentDays) {
      const cacheKey = getAnalyticsCacheKey(days);
      const cachedData = cacheManager.get<{
        episodes: Episode[];
        intensityReadings: IntensityReading[];
      }>(cacheKey, ANALYTICS_CACHE_TTL);

      if (cachedData) {
        // Use cached data
        set({
          episodes: cachedData.episodes,
          intensityReadings: cachedData.intensityReadings,
          isLoading: false,
        });
        return;
      }
    }

    // Calculate new date range
    const dateRange = getDateRangeForDays(days);

    // Update state with new days and range, then fetch
    set({ selectedDays: days, dateRange, isLoading: true, error: null });

    // Fetch data for the new range
    await get().fetchAnalyticsData();
  },

  /**
   * Fetch analytics data for the current date range
   * Uses caching to avoid redundant database queries
   */
  fetchAnalyticsData: async () => {
    const { selectedDays, dateRange } = get();
    const cacheKey = getAnalyticsCacheKey(selectedDays);

    // Check cache first
    const cachedData = cacheManager.get<{
      episodes: Episode[];
      intensityReadings: IntensityReading[];
    }>(cacheKey, ANALYTICS_CACHE_TTL);

    if (cachedData) {
      set({
        episodes: cachedData.episodes,
        intensityReadings: cachedData.intensityReadings,
        isLoading: false,
        lastFetched: Date.now(),
      });
      return;
    }

    // Fetch from database
    set({ isLoading: true, error: null });

    try {
      const startTime = dateRange.startDate.getTime();
      const endTime = dateRange.endDate.getTime();

      // Fetch episodes for the date range
      const episodes = await episodeRepository.getByDateRange(startTime, endTime);

      // Get episode IDs for targeted intensity reading fetch
      const episodeIds = episodes.map(ep => ep.id);

      // Fetch intensity readings for these episodes
      let intensityReadings: IntensityReading[] = [];
      if (episodeIds.length > 0) {
        intensityReadings = await intensityRepository.getByEpisodeIds(episodeIds);
      }

      // Cache the results
      cacheManager.set(cacheKey, { episodes, intensityReadings });

      set({
        episodes,
        intensityReadings,
        isLoading: false,
        lastFetched: Date.now(),
        error: null,
      });
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
      });
    }
  },

  /**
   * Force refresh data, bypassing cache
   * Use this when you know the underlying data has changed
   */
  refreshData: async () => {
    // Invalidate cache for current selection
    const { selectedDays } = get();
    const cacheKey = getAnalyticsCacheKey(selectedDays);
    cacheManager.invalidate(cacheKey);

    // Re-fetch
    await get().fetchAnalyticsData();
  },

  /**
   * Invalidate all analytics cache entries
   * Should be called when episodes or intensity readings are modified
   */
  invalidateCache: () => {
    cacheManager.invalidatePattern(new RegExp(`^${ANALYTICS_CACHE_PREFIX}`));
    set({ lastFetched: null });
  },
}));
