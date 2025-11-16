import { create } from 'zustand';
import { Episode, SymptomLog } from '../models/types';
import { episodeRepository, intensityRepository, symptomLogRepository } from '../database/episodeRepository';
import { errorLogger } from '../services/errorLogger';
import { toastService } from '../services/toastService';
import { cacheManager } from '../utils/cacheManager';

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
    // Check cache first (5 second TTL)
    const cached = cacheManager.get<Episode[]>('episodes');
    if (cached) {
      set({ episodes: cached, loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const episodes = await episodeRepository.getAll();
      cacheManager.set('episodes', episodes);
      set({ episodes, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadCurrentEpisode: async () => {
    // Check cache first (5 second TTL)
    const cached = cacheManager.get<Episode | null>('currentEpisode');
    if (cached !== undefined) {
      set({ currentEpisode: cached });
      return;
    }

    try {
      const currentEpisode = await episodeRepository.getCurrentEpisode();
      cacheManager.set('currentEpisode', currentEpisode);
      set({ currentEpisode });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  startEpisode: async (episode) => {
    set({ loading: true, error: null });
    try {
      const newEpisode = await episodeRepository.create(episode);

      // Invalidate cache when creating new episode
      cacheManager.invalidate('episodes');
      cacheManager.invalidate('currentEpisode');

      set({
        currentEpisode: newEpisode,
        episodes: [newEpisode, ...get().episodes],
        loading: false
      });

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

      // Invalidate cache when ending episode
      cacheManager.invalidate('episodes');
      cacheManager.invalidate('currentEpisode');

      // Update local state
      const updatedEpisodes = get().episodes.map(ep =>
        ep.id === episodeId ? { ...ep, endTime } : ep
      );

      set({
        currentEpisode: null,
        episodes: updatedEpisodes,
        loading: false
      });
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

      // Invalidate cache when updating episode
      cacheManager.invalidate('episodes');
      cacheManager.invalidate('currentEpisode');

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
      const timestamp = Date.now();
      await intensityRepository.create({
        episodeId,
        timestamp,
        intensity,
      });
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

      // Invalidate cache when deleting episode
      cacheManager.invalidate('episodes');
      cacheManager.invalidate('currentEpisode');

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
