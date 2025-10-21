import { create } from 'zustand';
import { logger } from '../utils/logger';
import { Episode, SymptomLog } from '../models/types';
import { episodeRepository, intensityRepository, symptomLogRepository } from '../database/episodeRepository';
import { dailyStatusRepository } from '../database/dailyStatusRepository';
import { errorLogger } from '../services/errorLogger';
import { toastService } from '../services/toastService';
import { format, eachDayOfInterval } from 'date-fns';

interface EpisodeState {
  currentEpisode: Episode | null;
  episodes: Episode[];
  loading: boolean;
  error: string | null;

  // Actions
  loadEpisodes: () => Promise<void>;
  loadCurrentEpisode: () => Promise<void>;
  startEpisode: (episode: Omit<Episode, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Episode>;
  endEpisode: (episodeId: string, endTime: number) => Promise<void>;
  updateEpisode: (episodeId: string, updates: Partial<Episode>) => Promise<void>;
  addIntensityReading: (episodeId: string, intensity: number) => Promise<void>;
  addSymptomLog: (log: Omit<SymptomLog, 'id' | 'createdAt'>) => Promise<void>;
  deleteEpisode: (episodeId: string) => Promise<void>;
}

export const useEpisodeStore = create<EpisodeState>((set, get) => ({
  currentEpisode: null,
  episodes: [],
  loading: false,
  error: null,

  loadEpisodes: async () => {
    set({ loading: true, error: null });
    try {
      const episodes = await episodeRepository.getAll();
      set({ episodes, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadCurrentEpisode: async () => {
    try {
      const currentEpisode = await episodeRepository.getCurrentEpisode();
      set({ currentEpisode });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  startEpisode: async (episode) => {
    set({ loading: true, error: null });
    try {
      const newEpisode = await episodeRepository.create(episode);

      // Auto-create red day for episode start date
      try {
        const episodeDate = format(new Date(newEpisode.startTime), 'yyyy-MM-dd');
        await dailyStatusRepository.upsert({
          date: episodeDate,
          status: 'red',
          notes: 'Episode started',
          prompted: false,
        });
        logger.log('[EpisodeStore] Auto-created red day for episode:', episodeDate);
      } catch (error) {
        logger.error('[EpisodeStore] Failed to create red day for episode:', error);
        // Don't fail the episode creation if red day creation fails
      }

      set({
        currentEpisode: newEpisode,
        episodes: [newEpisode, ...get().episodes],
        loading: false
      });

      // Show success toast
      toastService.success('Episode started');

      return newEpisode;
    } catch (error) {
      await errorLogger.log('database', 'Failed to start episode', error as Error, {
        operation: 'startEpisode',
        startTime: episode.startTime
      });
      set({ error: (error as Error).message, loading: false });

      // Show error toast
      toastService.error('Failed to start episode');

      throw error;
    }
  },

  endEpisode: async (episodeId, endTime) => {
    set({ loading: true, error: null });
    try {
      await episodeRepository.update(episodeId, { endTime });

      // Get the episode to mark all days as red
      const episode = get().episodes.find(ep => ep.id === episodeId);
      if (episode) {
        try {
          const startDate = new Date(episode.startTime);
          const endDate = new Date(endTime);

          // Get all dates in the episode range
          const dates = eachDayOfInterval({ start: startDate, end: endDate });

          // Mark each day as red
          for (const date of dates) {
            const dateStr = format(date, 'yyyy-MM-dd');
            await dailyStatusRepository.upsert({
              date: dateStr,
              status: 'red',
              notes: dates.length > 1 ? `Episode (day ${dates.indexOf(date) + 1} of ${dates.length})` : 'Episode',
              prompted: false,
            });
          }
          logger.log('[EpisodeStore] Marked', dates.length, 'day(s) as red for episode');
        } catch (error) {
          logger.error('[EpisodeStore] Failed to mark episode days as red:', error);
          // Don't fail the episode end if red day creation fails
        }
      }

      // Update local state
      const updatedEpisodes = get().episodes.map(ep =>
        ep.id === episodeId ? { ...ep, endTime } : ep
      );

      set({
        currentEpisode: null,
        episodes: updatedEpisodes,
        loading: false
      });

      // Show success toast
      toastService.success('Episode ended');
    } catch (error) {
      set({ error: (error as Error).message, loading: false });

      // Show error toast
      toastService.error('Failed to end episode');

      throw error;
    }
  },

  updateEpisode: async (episodeId, updates) => {
    try {
      await episodeRepository.update(episodeId, updates);

      // Update local state
      const updatedEpisodes = get().episodes.map(ep =>
        ep.id === episodeId ? { ...ep, ...updates } : ep
      );

      const currentEpisode = get().currentEpisode;
      const updatedCurrentEpisode = currentEpisode?.id === episodeId
        ? { ...currentEpisode, ...updates }
        : currentEpisode;

      set({
        episodes: updatedEpisodes,
        currentEpisode: updatedCurrentEpisode
      });
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  addIntensityReading: async (episodeId, intensity) => {
    try {
      await intensityRepository.create({
        episodeId,
        timestamp: Date.now(),
        intensity,
      });

      // Update peak and average intensity
      const readings = await intensityRepository.getByEpisodeId(episodeId);
      const intensities = readings.map(r => r.intensity);
      const peakIntensity = Math.max(...intensities);
      const averageIntensity = intensities.reduce((a, b) => a + b, 0) / intensities.length;

      await episodeRepository.update(episodeId, { peakIntensity, averageIntensity });

      // Update local state
      get().updateEpisode(episodeId, { peakIntensity, averageIntensity });
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  addSymptomLog: async (log) => {
    try {
      await symptomLogRepository.create(log);
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  deleteEpisode: async (episodeId) => {
    set({ loading: true, error: null });
    try {
      await episodeRepository.delete(episodeId);

      const updatedEpisodes = get().episodes.filter(ep => ep.id !== episodeId);
      const currentEpisode = get().currentEpisode?.id === episodeId ? null : get().currentEpisode;

      set({
        episodes: updatedEpisodes,
        currentEpisode,
        loading: false
      });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },
}));
