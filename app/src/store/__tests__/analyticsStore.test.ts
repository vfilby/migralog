import { useAnalyticsStore } from '../analyticsStore';
import { episodeRepository, intensityRepository } from '../../database/episodeRepository';
import { Episode, IntensityReading } from '../../models/types';
import { cacheManager } from '../../utils/cacheManager';

// Mock dependencies
jest.mock('../../database/episodeRepository');

describe('analyticsStore', () => {
  const mockEpisodes: Episode[] = [
    {
      id: 'ep-1',
      startTime: Date.now() - 86400000, // 1 day ago
      endTime: Date.now() - 82800000,
      locations: ['left_head'],
      qualities: ['throbbing'],
      symptoms: [],
      triggers: [],
      notes: undefined,
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 82800000,
    },
    {
      id: 'ep-2',
      startTime: Date.now() - 172800000, // 2 days ago
      endTime: Date.now() - 169200000,
      locations: ['right_head'],
      qualities: ['pressure'],
      symptoms: [],
      triggers: [],
      notes: undefined,
      createdAt: Date.now() - 172800000,
      updatedAt: Date.now() - 169200000,
    },
  ];

  const mockIntensityReadings: IntensityReading[] = [
    {
      id: 'ir-1',
      episodeId: 'ep-1',
      timestamp: Date.now() - 86400000,
      intensity: 7,
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 86400000,
    },
    {
      id: 'ir-2',
      episodeId: 'ep-2',
      timestamp: Date.now() - 172800000,
      intensity: 5,
      createdAt: Date.now() - 172800000,
      updatedAt: Date.now() - 172800000,
    },
  ];

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Clear cache before each test
    cacheManager.clear();

    // Reset the store state
    useAnalyticsStore.setState({
      selectedDays: 30,
      dateRange: {
        startDate: new Date(),
        endDate: new Date(),
      },
      episodes: [],
      intensityReadings: [],
      isLoading: false,
      lastFetched: null,
      error: null,
    });
  });

  describe('setDateRange', () => {
    it('should update selectedDays and dateRange when setting a new range', async () => {
      (episodeRepository.getByDateRange as jest.Mock).mockResolvedValue([]);
      (intensityRepository.getByEpisodeIds as jest.Mock).mockResolvedValue([]);

      await useAnalyticsStore.getState().setDateRange(7);

      const state = useAnalyticsStore.getState();
      expect(state.selectedDays).toBe(7);
      expect(state.dateRange.startDate).toBeInstanceOf(Date);
      expect(state.dateRange.endDate).toBeInstanceOf(Date);
      expect(state.isLoading).toBe(false);
    });

    it('should fetch episodes for the new date range', async () => {
      (episodeRepository.getByDateRange as jest.Mock).mockResolvedValue(mockEpisodes);
      (intensityRepository.getByEpisodeIds as jest.Mock).mockResolvedValue(mockIntensityReadings);

      await useAnalyticsStore.getState().setDateRange(30);

      expect(episodeRepository.getByDateRange).toHaveBeenCalled();
      expect(intensityRepository.getByEpisodeIds).toHaveBeenCalledWith(['ep-1', 'ep-2']);

      const state = useAnalyticsStore.getState();
      expect(state.episodes).toEqual(mockEpisodes);
      expect(state.intensityReadings).toEqual(mockIntensityReadings);
    });

    it('should use cached data when same date range is requested', async () => {
      (episodeRepository.getByDateRange as jest.Mock).mockResolvedValue(mockEpisodes);
      (intensityRepository.getByEpisodeIds as jest.Mock).mockResolvedValue(mockIntensityReadings);

      // First call - fetches from repository
      await useAnalyticsStore.getState().setDateRange(30);
      expect(episodeRepository.getByDateRange).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await useAnalyticsStore.getState().setDateRange(30);
      // Repository should still only have been called once
      expect(episodeRepository.getByDateRange).toHaveBeenCalledTimes(1);
    });

    it('should fetch new data when date range changes', async () => {
      (episodeRepository.getByDateRange as jest.Mock).mockResolvedValue(mockEpisodes);
      (intensityRepository.getByEpisodeIds as jest.Mock).mockResolvedValue(mockIntensityReadings);

      // First call with 30 days
      await useAnalyticsStore.getState().setDateRange(30);
      expect(episodeRepository.getByDateRange).toHaveBeenCalledTimes(1);

      // Second call with 7 days - should fetch new data
      await useAnalyticsStore.getState().setDateRange(7);
      expect(episodeRepository.getByDateRange).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetchAnalyticsData', () => {
    it('should set isLoading true during fetch', async () => {
      (episodeRepository.getByDateRange as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      );
      (intensityRepository.getByEpisodeIds as jest.Mock).mockResolvedValue([]);

      // Clear cache to force a fetch
      cacheManager.clear();

      const fetchPromise = useAnalyticsStore.getState().fetchAnalyticsData();

      // Check loading state is true
      expect(useAnalyticsStore.getState().isLoading).toBe(true);

      await fetchPromise;

      // Check loading state is false after completion
      expect(useAnalyticsStore.getState().isLoading).toBe(false);
    });

    it('should handle empty episode list', async () => {
      (episodeRepository.getByDateRange as jest.Mock).mockResolvedValue([]);
      (intensityRepository.getByEpisodeIds as jest.Mock).mockResolvedValue([]);

      // Clear cache to force a fetch
      cacheManager.clear();

      await useAnalyticsStore.getState().fetchAnalyticsData();

      const state = useAnalyticsStore.getState();
      expect(state.episodes).toEqual([]);
      expect(state.intensityReadings).toEqual([]);
      expect(state.error).toBe(null);
      // Should not call getByEpisodeIds with empty array
      expect(intensityRepository.getByEpisodeIds).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const error = new Error('Database connection failed');
      (episodeRepository.getByDateRange as jest.Mock).mockRejectedValue(error);

      // Clear cache to force a fetch
      cacheManager.clear();

      await useAnalyticsStore.getState().fetchAnalyticsData();

      const state = useAnalyticsStore.getState();
      expect(state.error).toBe('Database connection failed');
      expect(state.isLoading).toBe(false);
    });

    it('should set lastFetched timestamp after successful fetch', async () => {
      (episodeRepository.getByDateRange as jest.Mock).mockResolvedValue(mockEpisodes);
      (intensityRepository.getByEpisodeIds as jest.Mock).mockResolvedValue(mockIntensityReadings);

      // Clear cache to force a fetch
      cacheManager.clear();

      const beforeFetch = Date.now();
      await useAnalyticsStore.getState().fetchAnalyticsData();
      const afterFetch = Date.now();

      const state = useAnalyticsStore.getState();
      expect(state.lastFetched).not.toBe(null);
      expect(state.lastFetched).toBeGreaterThanOrEqual(beforeFetch);
      expect(state.lastFetched).toBeLessThanOrEqual(afterFetch);
    });
  });

  describe('refreshData', () => {
    it('should invalidate cache and refetch data', async () => {
      (episodeRepository.getByDateRange as jest.Mock).mockResolvedValue(mockEpisodes);
      (intensityRepository.getByEpisodeIds as jest.Mock).mockResolvedValue(mockIntensityReadings);

      // First fetch
      await useAnalyticsStore.getState().setDateRange(30);
      expect(episodeRepository.getByDateRange).toHaveBeenCalledTimes(1);

      // Force refresh
      await useAnalyticsStore.getState().refreshData();
      expect(episodeRepository.getByDateRange).toHaveBeenCalledTimes(2);
    });

    it('should update lastFetched timestamp after refresh', async () => {
      (episodeRepository.getByDateRange as jest.Mock).mockResolvedValue(mockEpisodes);
      (intensityRepository.getByEpisodeIds as jest.Mock).mockResolvedValue(mockIntensityReadings);

      // Initial fetch
      await useAnalyticsStore.getState().setDateRange(30);
      const firstFetch = useAnalyticsStore.getState().lastFetched;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      // Refresh
      await useAnalyticsStore.getState().refreshData();
      const secondFetch = useAnalyticsStore.getState().lastFetched;

      expect(secondFetch).toBeGreaterThan(firstFetch!);
    });
  });

  describe('invalidateCache', () => {
    it('should clear all analytics cache entries', async () => {
      (episodeRepository.getByDateRange as jest.Mock).mockResolvedValue(mockEpisodes);
      (intensityRepository.getByEpisodeIds as jest.Mock).mockResolvedValue(mockIntensityReadings);

      // Populate cache with multiple date ranges
      await useAnalyticsStore.getState().setDateRange(7);
      await useAnalyticsStore.getState().setDateRange(30);

      // Invalidate all cache
      useAnalyticsStore.getState().invalidateCache();

      expect(useAnalyticsStore.getState().lastFetched).toBe(null);
    });

    it('should reset lastFetched to null', () => {
      useAnalyticsStore.setState({ lastFetched: Date.now() });

      useAnalyticsStore.getState().invalidateCache();

      expect(useAnalyticsStore.getState().lastFetched).toBe(null);
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      // Reset to initial state
      useAnalyticsStore.setState({
        selectedDays: 30,
        dateRange: {
          startDate: new Date(),
          endDate: new Date(),
        },
        episodes: [],
        intensityReadings: [],
        isLoading: false,
        lastFetched: null,
        error: null,
      });

      const state = useAnalyticsStore.getState();
      expect(state.selectedDays).toBe(30);
      expect(state.episodes).toEqual([]);
      expect(state.intensityReadings).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.lastFetched).toBe(null);
      expect(state.error).toBe(null);
    });
  });

  describe('integration scenarios', () => {
    it('should correctly fetch episodes with intensity readings', async () => {
      (episodeRepository.getByDateRange as jest.Mock).mockResolvedValue(mockEpisodes);
      (intensityRepository.getByEpisodeIds as jest.Mock).mockResolvedValue(mockIntensityReadings);

      await useAnalyticsStore.getState().setDateRange(30);

      const state = useAnalyticsStore.getState();
      expect(state.episodes).toHaveLength(2);
      expect(state.intensityReadings).toHaveLength(2);

      // Verify intensity readings match episodes
      const episodeIds = state.episodes.map(ep => ep.id);
      state.intensityReadings.forEach(reading => {
        expect(episodeIds).toContain(reading.episodeId);
      });
    });

    it('should handle episodes without intensity readings', async () => {
      (episodeRepository.getByDateRange as jest.Mock).mockResolvedValue(mockEpisodes);
      (intensityRepository.getByEpisodeIds as jest.Mock).mockResolvedValue([]);

      await useAnalyticsStore.getState().setDateRange(30);

      const state = useAnalyticsStore.getState();
      expect(state.episodes).toHaveLength(2);
      expect(state.intensityReadings).toHaveLength(0);
      expect(state.error).toBe(null);
    });

    it('should update state correctly when switching date ranges', async () => {
      const weekEpisodes = [mockEpisodes[0]]; // Only 1 episode in last 7 days
      const monthEpisodes = mockEpisodes; // 2 episodes in last 30 days

      (episodeRepository.getByDateRange as jest.Mock)
        .mockResolvedValueOnce(weekEpisodes)
        .mockResolvedValueOnce(monthEpisodes);
      (intensityRepository.getByEpisodeIds as jest.Mock)
        .mockResolvedValueOnce([mockIntensityReadings[0]])
        .mockResolvedValueOnce(mockIntensityReadings);

      // First, get 7 days
      await useAnalyticsStore.getState().setDateRange(7);
      expect(useAnalyticsStore.getState().episodes).toHaveLength(1);

      // Then switch to 30 days
      await useAnalyticsStore.getState().setDateRange(30);
      expect(useAnalyticsStore.getState().episodes).toHaveLength(2);
    });
  });
});
