import { create } from 'zustand';
import { Episode, IntensityReading, SymptomLog } from '../models/types';
import { episodeRepository, intensityRepository, symptomLogRepository } from '../database/episodeRepository';

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
      set({
        currentEpisode: newEpisode,
        episodes: [newEpisode, ...get().episodes],
        loading: false
      });
      return newEpisode;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  endEpisode: async (episodeId, endTime) => {
    set({ loading: true, error: null });
    try {
      await episodeRepository.update(episodeId, { endTime });

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
