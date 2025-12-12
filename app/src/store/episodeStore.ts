import { create } from 'zustand';
import { Episode, SymptomLog, IntensityReading, EpisodeNote, PainLocationLog } from '../models/types';
import { 
  episodeRepository, 
  intensityRepository, 
  symptomLogRepository,
  episodeNoteRepository,
  painLocationLogRepository
} from '../database/episodeRepository';
import { errorLogger } from '../services/errorLogger';
import { toastService } from '../services/toastService';
import { cacheManager } from '../utils/cacheManager';
import { logger } from '../utils/logger';

/**
 * Episode with all related data loaded
 */
export interface EpisodeWithDetails extends Episode {
  intensityReadings?: IntensityReading[];
  symptomLogs?: SymptomLog[];
  painLocationLogs?: PainLocationLog[];
  episodeNotes?: EpisodeNote[];
}

interface EpisodeState {
  currentEpisode: Episode | null;
  episodes: Episode[];
  loading: boolean;
  error: string | null;

  // Data Loading
  loadEpisodes: () => Promise<void>;
  loadCurrentEpisode: () => Promise<void>;
  loadEpisodeWithDetails: (episodeId: string) => Promise<EpisodeWithDetails | null>;

  // Episode CRUD
  getEpisodeById: (id: string) => Episode | null;
  startEpisode: (episode: Omit<Episode, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Episode>;
  endEpisode: (episodeId: string, endTime: number) => Promise<void>;
  reopenEpisode: (episodeId: string) => Promise<void>;
  updateEpisode: (episodeId: string, updates: Partial<Episode>) => Promise<void>;
  updateEpisodeTimestamps: (episodeId: string, originalStartTime: number, newStartTime: number, updates: Partial<Episode>) => Promise<void>;
  deleteEpisode: (episodeId: string) => Promise<void>;

  // Intensity Reading CRUD
  addIntensityReading: (episodeId: string, intensity: number) => Promise<void>;
  addIntensityReadingWithTimestamp: (episodeId: string, intensity: number, timestamp: number) => Promise<void>;
  getIntensityReadingById: (id: string) => IntensityReading | null;
  updateIntensityReading: (id: string, updates: Partial<IntensityReading>) => Promise<void>;
  deleteIntensityReading: (id: string) => Promise<void>;

  // Symptom Log CRUD
  addSymptomLog: (log: Omit<SymptomLog, 'id' | 'createdAt'>) => Promise<void>;
  getSymptomLogById: (id: string) => SymptomLog | null;
  updateSymptomLog: (id: string, updates: Partial<SymptomLog>) => Promise<void>;
  deleteSymptomLog: (id: string) => Promise<void>;

  // Episode Note CRUD
  addEpisodeNote: (note: Omit<EpisodeNote, 'id' | 'createdAt'>) => Promise<void>;
  getEpisodeNoteById: (id: string) => EpisodeNote | null;
  updateEpisodeNote: (id: string, updates: Partial<EpisodeNote>) => Promise<void>;
  deleteEpisodeNote: (id: string) => Promise<void>;

  // Pain Location CRUD
  addPainLocationLog: (log: Omit<PainLocationLog, 'id' | 'createdAt'>) => Promise<void>;
  getPainLocationLogById: (id: string) => PainLocationLog | null;
  updatePainLocationLog: (id: string, updates: Partial<PainLocationLog>) => Promise<void>;
  deletePainLocationLog: (id: string) => Promise<void>;

  // Internal state for related data
  intensityReadings: IntensityReading[];
  symptomLogs: SymptomLog[];
  episodeNotes: EpisodeNote[];
  painLocationLogs: PainLocationLog[];
}

export const useEpisodeStore = create<EpisodeState>((set, get) => ({
  currentEpisode: null,
  episodes: [],
  loading: false,
  error: null,
  intensityReadings: [],
  symptomLogs: [],
  episodeNotes: [],
  painLocationLogs: [],

  loadEpisodes: async () => {
    // Check cache first (5 second TTL)
    const cached = cacheManager.get<Episode[]>('episodes');
    if (cached) {
      set({ episodes: cached, loading: false });
      // Even if episodes are cached, we should load intensity readings
      // to ensure EpisodeCard can display sparklines
      const episodeIds = cached.map(ep => ep.id);
      if (episodeIds.length > 0) {
        try {
          const intensityReadings = await intensityRepository.getByEpisodeIds(episodeIds);
          set({ intensityReadings });
        } catch (error) {
          logger.error('Failed to load intensity readings for cached episodes:', error);
        }
      }
      return;
    }

    set({ loading: true, error: null });
    try {
      const episodes = await episodeRepository.getAll();
      
      // Load intensity readings for all episodes so EpisodeCard can display sparklines
      let intensityReadings: IntensityReading[] = [];
      try {
        const episodeIds = episodes.map(ep => ep.id);
        if (episodeIds.length > 0) {
          intensityReadings = await intensityRepository.getByEpisodeIds(episodeIds);
        }
      } catch (intensityError) {
        // If intensity readings fail to load, just log it and continue
        // This ensures the main episode loading still works
        logger.error('Failed to load intensity readings for episodes:', intensityError);
      }
      
      cacheManager.set('episodes', episodes);
      set({ episodes, intensityReadings, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadCurrentEpisode: async () => {
    // Check cache first (5 second TTL)
    const cached = cacheManager.get<Episode | null>('currentEpisode');
    if (cached !== undefined) {
      set({ currentEpisode: cached });
      // Even if current episode is cached, load its intensity readings
      // so EpisodeCard can display sparkline on dashboard
      if (cached) {
        try {
          const intensityReadings = await intensityRepository.getByEpisodeId(cached.id);
          // Merge with existing readings to avoid overwriting data for other episodes
          const currentState = get();
          const mergedReadings = new Map<string, IntensityReading>();
          const existingReadings = currentState.intensityReadings || [];
          existingReadings.forEach(r => mergedReadings.set(r.id, r));
          intensityReadings.forEach(r => mergedReadings.set(r.id, r));
          set({ intensityReadings: Array.from(mergedReadings.values()) });
        } catch (error) {
          logger.error('Failed to load intensity readings for current episode:', error);
        }
      }
      return;
    }

    try {
      const currentEpisode = await episodeRepository.getCurrentEpisode();
      
      // Load intensity readings for current episode so EpisodeCard can display sparkline
      if (currentEpisode) {
        try {
          const intensityReadings = await intensityRepository.getByEpisodeId(currentEpisode.id);
          // Merge with existing readings
          const currentState = get();
          const mergedReadings = new Map<string, IntensityReading>();
          const existingReadings = currentState.intensityReadings || [];
          existingReadings.forEach(r => mergedReadings.set(r.id, r));
          intensityReadings.forEach(r => mergedReadings.set(r.id, r));
          
          cacheManager.set('currentEpisode', currentEpisode);
          set({ currentEpisode, intensityReadings: Array.from(mergedReadings.values()) });
        } catch (intensityError) {
          // If intensity readings fail to load, just set the episode without them
          logger.error('Failed to load intensity readings for current episode:', intensityError);
          cacheManager.set('currentEpisode', currentEpisode);
          set({ currentEpisode });
        }
      } else {
        cacheManager.set('currentEpisode', null);
        set({ currentEpisode: null });
      }
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

  reopenEpisode: async (episodeId) => {
    set({ loading: true, error: null });
    try {
      // Validate input
      if (!episodeId) {
        throw new Error('Episode ID is required');
      }

      // Set endTime to undefined to reopen the episode
      await episodeRepository.update(episodeId, { endTime: undefined });

      // Invalidate cache when reopening episode
      cacheManager.invalidate('episodes');
      cacheManager.invalidate('currentEpisode');

      // Update local state - reopened episode becomes current episode
      const updatedEpisodes = get().episodes.map(ep =>
        ep.id === episodeId ? { ...ep, endTime: undefined } : ep
      );

      // Find the reopened episode and set it as current
      const reopenedEpisode = updatedEpisodes.find(ep => ep.id === episodeId) || null;

      set({
        episodes: updatedEpisodes,
        currentEpisode: reopenedEpisode,
        loading: false,
      });
    } catch (error) {
      await errorLogger.log('database', 'Failed to reopen episode', error as Error, {
        operation: 'reopenEpisode',
        episodeId,
      });
      set({ error: (error as Error).message, loading: false });
      
      // Show error toast
      toastService.error('Failed to reopen episode');
      
      throw error;
    }
  },

  updateEpisode: async (episodeId, updates) => {
    set({ loading: true, error: null });
    try {
      // Validate input
      if (!episodeId) {
        throw new Error('Episode ID is required');
      }
      if (!updates || Object.keys(updates).length === 0) {
        throw new Error('Updates are required');
      }

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
        currentEpisode: updatedCurrentEpisode,
        loading: false
      });
    } catch (error) {
      await errorLogger.log('database', 'Failed to update episode', error as Error, {
        operation: 'updateEpisode',
        episodeId,
        updates,
      });
      set({ error: (error as Error).message, loading: false });
      toastService.error('Failed to update episode');
      throw error;
    }
  },

  /**
   * Update episode with timestamp cascade updates
   * When the episode start time changes, this method updates all related timeline entries
   * that match the original start time to use the new start time.
   * 
   * @param episodeId - Episode ID
   * @param originalStartTime - Original episode start timestamp
   * @param newStartTime - New episode start timestamp
   * @param updates - Episode updates to apply
   */
  updateEpisodeTimestamps: async (episodeId: string, originalStartTime: number, newStartTime: number, updates: Partial<Episode>) => {
    set({ loading: true, error: null });
    try {
      // Validate input
      if (!episodeId) {
        throw new Error('Episode ID is required');
      }
      if (!updates || Object.keys(updates).length === 0) {
        throw new Error('Updates are required');
      }

      logger.log('[EpisodeStore] Updating episode with timestamp cascade:', {
        episodeId,
        originalStartTime,
        newStartTime,
        updates
      });

      // Update episode
      await episodeRepository.update(episodeId, updates);

      // If start time changed, update all timeline entries with matching timestamp
      if (originalStartTime !== newStartTime) {
        logger.log('[EpisodeStore] Start time changed, updating timeline entries');
        
        // Update intensity readings
        const intensityChanges = await intensityRepository.updateTimestampsForEpisode(
          episodeId,
          originalStartTime,
          newStartTime
        );
        logger.log(`[EpisodeStore] Updated ${intensityChanges} intensity reading(s)`);

        // Update episode notes
        const notesChanges = await episodeNoteRepository.updateTimestampsForEpisode(
          episodeId,
          originalStartTime,
          newStartTime
        );
        logger.log(`[EpisodeStore] Updated ${notesChanges} episode note(s)`);
      }

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
        currentEpisode: updatedCurrentEpisode,
        loading: false
      });

      logger.log('[EpisodeStore] Episode timestamps updated successfully');
    } catch (error) {
      await errorLogger.log('database', 'Failed to update episode timestamps', error as Error, {
        operation: 'updateEpisodeTimestamps',
        episodeId,
        originalStartTime,
        newStartTime,
        updates,
      });
      set({ error: (error as Error).message, loading: false });
      toastService.error('Failed to update episode');
      throw error;
    }
  },

  addIntensityReading: async (episodeId, intensity) => {
    set({ loading: true, error: null });
    try {
      // Validate input
      if (!episodeId) {
        throw new Error('Episode ID is required');
      }
      if (intensity === undefined || intensity === null) {
        throw new Error('Intensity is required');
      }

      const timestamp = Date.now();
      const reading = await intensityRepository.create({
        episodeId,
        timestamp,
        intensity,
      });

      // Invalidate cache for episode details
      cacheManager.invalidate('episodes');
      cacheManager.invalidate('currentEpisode');

      // Update state with new reading
      const currentReadings = get().intensityReadings || [];
      set({ 
        intensityReadings: [...currentReadings, reading],
        loading: false 
      });
    } catch (error) {
      await errorLogger.log('database', 'Failed to add intensity reading', error as Error, {
        operation: 'addIntensityReading',
        episodeId,
        intensity,
      });
      set({ error: (error as Error).message, loading: false });
      toastService.error('Failed to add intensity reading');
      throw error;
    }
  },

  /**
   * Add intensity reading with a specific timestamp
   * This is useful for initial readings that should match the episode start time
   * 
   * @param episodeId - Episode ID
   * @param intensity - Pain intensity (0-10)
   * @param timestamp - Specific timestamp for the reading
   */
  addIntensityReadingWithTimestamp: async (episodeId: string, intensity: number, timestamp: number) => {
    set({ loading: true, error: null });
    try {
      // Validate input
      if (!episodeId) {
        throw new Error('Episode ID is required');
      }
      if (intensity === undefined || intensity === null) {
        throw new Error('Intensity is required');
      }
      if (!timestamp) {
        throw new Error('Timestamp is required');
      }

      logger.log('[EpisodeStore] Adding intensity reading with custom timestamp:', {
        episodeId,
        intensity,
        timestamp
      });

      const reading = await intensityRepository.create({
        episodeId,
        timestamp,
        intensity,
      });

      // Invalidate cache for episode details
      cacheManager.invalidate('episodes');
      cacheManager.invalidate('currentEpisode');

      // Update state with new reading
      const currentReadings = get().intensityReadings || [];
      set({ 
        intensityReadings: [...currentReadings, reading],
        loading: false 
      });

      logger.log('[EpisodeStore] Intensity reading added with timestamp:', reading.id);
    } catch (error) {
      await errorLogger.log('database', 'Failed to add intensity reading with timestamp', error as Error, {
        operation: 'addIntensityReadingWithTimestamp',
        episodeId,
        intensity,
        timestamp
      });
      set({ error: (error as Error).message, loading: false });
      toastService.error('Failed to add intensity reading');
      throw error;
    }
  },

  addSymptomLog: async (log) => {
    set({ loading: true, error: null });
    try {
      // Validate input
      if (!log.episodeId) {
        throw new Error('Episode ID is required');
      }
      if (!log.symptom) {
        throw new Error('Symptom is required');
      }

      const newLog = await symptomLogRepository.create(log);

      // Invalidate cache for episode details
      cacheManager.invalidate('episodes');
      cacheManager.invalidate('currentEpisode');

      // Update state with new log
      const currentLogs = get().symptomLogs || [];
      set({ 
        symptomLogs: [...currentLogs, newLog],
        loading: false 
      });
    } catch (error) {
      await errorLogger.log('database', 'Failed to add symptom log', error as Error, {
        operation: 'addSymptomLog',
        episodeId: log.episodeId,
      });
      set({ error: (error as Error).message, loading: false });
      toastService.error('Failed to add symptom log');
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

  /**
   * Load episode with all related data (intensity readings, symptom logs, pain locations, medications, notes)
   * Uses Promise.all for parallel loading
   * 
   * @param episodeId - ID of the episode to load
   * @returns Episode with all related data, or null if not found
   */
  loadEpisodeWithDetails: async (episodeId: string) => {
    set({ loading: true, error: null });
    try {
      // Load all data in parallel for better performance
      const [episode, intensityReadings, symptomLogs, episodeNotes, painLocationLogs] = await Promise.all([
        episodeRepository.getById(episodeId),
        intensityRepository.getByEpisodeId(episodeId),
        symptomLogRepository.getByEpisodeId(episodeId),
        episodeNoteRepository.getByEpisodeId(episodeId),
        painLocationLogRepository.getByEpisodeId(episodeId),
      ]);

      if (!episode) {
        logger.warn('[EpisodeStore] Episode not found:', episodeId);
        set({ loading: false });
        return null;
      }

      const episodeWithDetails: EpisodeWithDetails = {
        ...episode,
        intensityReadings,
        symptomLogs,
        episodeNotes,
        painLocationLogs,
      };

      // Merge related data instead of replacing to prevent race conditions
      // when loading multiple episodes simultaneously
      const currentState = get();
      
      // Create maps for efficient merging by ID
      const mergedIntensityReadings = new Map<string, IntensityReading>();
      const mergedSymptomLogs = new Map<string, SymptomLog>();
      const mergedEpisodeNotes = new Map<string, EpisodeNote>();
      const mergedPainLocationLogs = new Map<string, PainLocationLog>();

      // Add existing data
      currentState.intensityReadings.forEach(r => mergedIntensityReadings.set(r.id, r));
      currentState.symptomLogs.forEach(l => mergedSymptomLogs.set(l.id, l));
      currentState.episodeNotes.forEach(n => mergedEpisodeNotes.set(n.id, n));
      currentState.painLocationLogs.forEach(l => mergedPainLocationLogs.set(l.id, l));

      // Add/update with new data
      intensityReadings.forEach(r => mergedIntensityReadings.set(r.id, r));
      symptomLogs.forEach(l => mergedSymptomLogs.set(l.id, l));
      episodeNotes.forEach(n => mergedEpisodeNotes.set(n.id, n));
      painLocationLogs.forEach(l => mergedPainLocationLogs.set(l.id, l));

      // Update state with merged data
      set({
        intensityReadings: Array.from(mergedIntensityReadings.values()),
        symptomLogs: Array.from(mergedSymptomLogs.values()),
        episodeNotes: Array.from(mergedEpisodeNotes.values()),
        painLocationLogs: Array.from(mergedPainLocationLogs.values()),
        loading: false,
      });

      return episodeWithDetails;
    } catch (error) {
      await errorLogger.log('database', 'Failed to load episode with details', error as Error, {
        operation: 'loadEpisodeWithDetails',
        episodeId,
      });
      toastService.error('Failed to load episode details');
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  /**
   * Get episode by ID from state
   * 
   * @param id - Episode ID
   * @returns Episode if found, null otherwise
   */
  getEpisodeById: (id: string) => {
    const episode = get().episodes.find(ep => ep.id === id);
    return episode || null;
  },

  /**
   * Get intensity reading by ID from state
   * 
   * @param id - Intensity reading ID
   * @returns Intensity reading if found, null otherwise
   */
  getIntensityReadingById: (id: string) => {
    const readings = get().intensityReadings || [];
    const reading = readings.find(r => r.id === id);
    return reading || null;
  },

  /**
   * Update intensity reading
   * 
   * @param id - Intensity reading ID
   * @param updates - Partial intensity reading updates
   */
  updateIntensityReading: async (id: string, updates: Partial<IntensityReading>) => {
    set({ loading: true, error: null });
    try {
      // Validate input
      if (!id) {
        throw new Error('Intensity reading ID is required');
      }
      if (!updates || Object.keys(updates).length === 0) {
        throw new Error('Updates are required');
      }

      logger.log('[EpisodeStore] Updating intensity reading:', { id, updates });

      await intensityRepository.update(id, updates);

      // Invalidate cache for episode details
      cacheManager.invalidate('episodes');
      cacheManager.invalidate('currentEpisode');

      // Update state
      const currentReadings = get().intensityReadings || [];
      const updatedReadings = currentReadings.map(r =>
        r.id === id ? { ...r, ...updates } : r
      );

      set({ intensityReadings: updatedReadings, loading: false });

      logger.log('[EpisodeStore] Intensity reading updated:', id);
    } catch (error) {
      await errorLogger.log('database', 'Failed to update intensity reading', error as Error, {
        operation: 'updateIntensityReading',
        id,
        updates,
      });
      toastService.error('Failed to update intensity reading');
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  /**
   * Delete intensity reading
   * 
   * @param id - Intensity reading ID
   */
  deleteIntensityReading: async (id: string) => {
    set({ loading: true, error: null });
    try {
      // Validate input
      if (!id) {
        throw new Error('Intensity reading ID is required');
      }

      logger.log('[EpisodeStore] Deleting intensity reading:', id);

      await intensityRepository.delete(id);

      // Invalidate cache for episode details
      cacheManager.invalidate('episodes');
      cacheManager.invalidate('currentEpisode');

      // Update state
      const currentReadings = get().intensityReadings || [];
      const updatedReadings = currentReadings.filter(r => r.id !== id);
      set({ intensityReadings: updatedReadings, loading: false });

      logger.log('[EpisodeStore] Intensity reading deleted:', id);
    } catch (error) {
      await errorLogger.log('database', 'Failed to delete intensity reading', error as Error, {
        operation: 'deleteIntensityReading',
        id,
      });
      toastService.error('Failed to delete intensity reading');
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  /**
   * Get symptom log by ID from state
   *
   * @param id - Symptom log ID
   * @returns Symptom log if found, null otherwise
   */
  getSymptomLogById: (id: string) => {
    const logs = get().symptomLogs || [];
    const log = logs.find(l => l.id === id);
    return log || null;
  },

  /**
   * Update symptom log
   *
   * @param id - Symptom log ID
   * @param updates - Partial symptom log updates
   */
  updateSymptomLog: async (id: string, updates: Partial<SymptomLog>) => {
    set({ loading: true, error: null });
    try {
      // Validate input
      if (!id) {
        throw new Error('Symptom log ID is required');
      }
      if (!updates || Object.keys(updates).length === 0) {
        throw new Error('Updates are required');
      }

      logger.log('[EpisodeStore] Updating symptom log:', { id, updates });

      await symptomLogRepository.update(id, updates);

      // Invalidate cache for episode details
      cacheManager.invalidate('episodes');
      cacheManager.invalidate('currentEpisode');

      // Update state
      const currentLogs = get().symptomLogs || [];
      const updatedLogs = currentLogs.map(log =>
        log.id === id ? { ...log, ...updates } : log
      );

      set({ symptomLogs: updatedLogs, loading: false });

      logger.log('[EpisodeStore] Symptom log updated:', id);
    } catch (error) {
      await errorLogger.log('database', 'Failed to update symptom log', error as Error, {
        operation: 'updateSymptomLog',
        id,
        updates,
      });
      toastService.error('Failed to update symptom log');
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  /**
   * Delete symptom log
   * 
   * @param id - Symptom log ID
   */
  deleteSymptomLog: async (id: string) => {
    set({ loading: true, error: null });
    try {
      // Validate input
      if (!id) {
        throw new Error('Symptom log ID is required');
      }

      logger.log('[EpisodeStore] Deleting symptom log:', id);

      await symptomLogRepository.delete(id);

      // Invalidate cache for episode details
      cacheManager.invalidate('episodes');
      cacheManager.invalidate('currentEpisode');

      // Update state
      const currentLogs = get().symptomLogs || [];
      const updatedLogs = currentLogs.filter(log => log.id !== id);
      set({ symptomLogs: updatedLogs, loading: false });

      logger.log('[EpisodeStore] Symptom log deleted:', id);
    } catch (error) {
      await errorLogger.log('database', 'Failed to delete symptom log', error as Error, {
        operation: 'deleteSymptomLog',
        id,
      });
      toastService.error('Failed to delete symptom log');
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  /**
   * Add episode note
   * 
   * @param note - Episode note data (without id and createdAt)
   */
  addEpisodeNote: async (note: Omit<EpisodeNote, 'id' | 'createdAt'>) => {
    set({ loading: true, error: null });
    try {
      // Validate input
      if (!note.episodeId) {
        throw new Error('Episode ID is required');
      }
      if (!note.note || note.note.trim() === '') {
        throw new Error('Note text is required');
      }

      logger.log('[EpisodeStore] Adding episode note:', note);

      const newNote = await episodeNoteRepository.create(note);

      // Invalidate cache for episode details
      cacheManager.invalidate('episodes');
      cacheManager.invalidate('currentEpisode');

      // Update state
      const currentNotes = get().episodeNotes || [];
      const updatedNotes = [...currentNotes, newNote];
      set({ episodeNotes: updatedNotes, loading: false });

      logger.log('[EpisodeStore] Episode note added:', newNote.id);
    } catch (error) {
      await errorLogger.log('database', 'Failed to add episode note', error as Error, {
        operation: 'addEpisodeNote',
        episodeId: note.episodeId,
      });
      toastService.error('Failed to add episode note');
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  /**
   * Get episode note by ID from state
   * 
   * @param id - Episode note ID
   * @returns Episode note if found, null otherwise
   */
  getEpisodeNoteById: (id: string) => {
    const notes = get().episodeNotes || [];
    const note = notes.find(n => n.id === id);
    return note || null;
  },

  /**
   * Update episode note
   * 
   * @param id - Episode note ID
   * @param updates - Partial episode note updates
   */
  updateEpisodeNote: async (id: string, updates: Partial<EpisodeNote>) => {
    set({ loading: true, error: null });
    try {
      // Validate input
      if (!id) {
        throw new Error('Episode note ID is required');
      }
      if (!updates || Object.keys(updates).length === 0) {
        throw new Error('Updates are required');
      }

      logger.log('[EpisodeStore] Updating episode note:', { id, updates });

      await episodeNoteRepository.update(id, updates);

      // Invalidate cache for episode details
      cacheManager.invalidate('episodes');
      cacheManager.invalidate('currentEpisode');

      // Update state
      const currentNotes = get().episodeNotes || [];
      const updatedNotes = currentNotes.map(note =>
        note.id === id ? { ...note, ...updates } : note
      );

      set({ episodeNotes: updatedNotes, loading: false });

      logger.log('[EpisodeStore] Episode note updated:', id);
    } catch (error) {
      await errorLogger.log('database', 'Failed to update episode note', error as Error, {
        operation: 'updateEpisodeNote',
        id,
        updates,
      });
      toastService.error('Failed to update episode note');
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  /**
   * Delete episode note
   * 
   * @param id - Episode note ID
   */
  deleteEpisodeNote: async (id: string) => {
    set({ loading: true, error: null });
    try {
      // Validate input
      if (!id) {
        throw new Error('Episode note ID is required');
      }

      logger.log('[EpisodeStore] Deleting episode note:', id);

      await episodeNoteRepository.delete(id);

      // Invalidate cache for episode details
      cacheManager.invalidate('episodes');
      cacheManager.invalidate('currentEpisode');

      // Update state
      const currentNotes = get().episodeNotes || [];
      const updatedNotes = currentNotes.filter(note => note.id !== id);
      set({ episodeNotes: updatedNotes, loading: false });

      logger.log('[EpisodeStore] Episode note deleted:', id);
    } catch (error) {
      await errorLogger.log('database', 'Failed to delete episode note', error as Error, {
        operation: 'deleteEpisodeNote',
        id,
      });
      toastService.error('Failed to delete episode note');
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  /**
   * Add pain location log
   * 
   * @param log - Pain location log data (without id and createdAt)
   */
  addPainLocationLog: async (log: Omit<PainLocationLog, 'id' | 'createdAt'>) => {
    set({ loading: true, error: null });
    try {
      // Validate input
      if (!log.episodeId) {
        throw new Error('Episode ID is required');
      }
      if (!log.painLocations || log.painLocations.length === 0) {
        throw new Error('Pain locations are required');
      }

      logger.log('[EpisodeStore] Adding pain location log:', log);

      const newLog = await painLocationLogRepository.create(log);

      // Invalidate cache for episode details
      cacheManager.invalidate('episodes');
      cacheManager.invalidate('currentEpisode');

      // Update state
      const currentLogs = get().painLocationLogs || [];
      const updatedLogs = [...currentLogs, newLog];
      set({ painLocationLogs: updatedLogs, loading: false });

      logger.log('[EpisodeStore] Pain location log added:', newLog.id);
    } catch (error) {
      await errorLogger.log('database', 'Failed to add pain location log', error as Error, {
        operation: 'addPainLocationLog',
        episodeId: log.episodeId,
      });
      toastService.error('Failed to add pain location log');
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  /**
   * Get pain location log by ID from state
   *
   * @param id - Pain location log ID
   * @returns Pain location log if found, null otherwise
   */
  getPainLocationLogById: (id: string) => {
    const logs = get().painLocationLogs || [];
    const log = logs.find(l => l.id === id);
    return log || null;
  },

  /**
   * Update pain location log
   *
   * @param id - Pain location log ID
   * @param updates - Partial pain location log updates
   */
  updatePainLocationLog: async (id: string, updates: Partial<PainLocationLog>) => {
    set({ loading: true, error: null });
    try {
      // Validate input
      if (!id) {
        throw new Error('Pain location log ID is required');
      }
      if (!updates || Object.keys(updates).length === 0) {
        throw new Error('Updates are required');
      }

      logger.log('[EpisodeStore] Updating pain location log:', { id, updates });

      await painLocationLogRepository.update(id, updates);

      // Invalidate cache for episode details
      cacheManager.invalidate('episodes');
      cacheManager.invalidate('currentEpisode');

      // Update state
      const currentLogs = get().painLocationLogs || [];
      const updatedLogs = currentLogs.map(log =>
        log.id === id ? { ...log, ...updates } : log
      );

      set({ painLocationLogs: updatedLogs, loading: false });

      logger.log('[EpisodeStore] Pain location log updated:', id);
    } catch (error) {
      await errorLogger.log('database', 'Failed to update pain location log', error as Error, {
        operation: 'updatePainLocationLog',
        id,
        updates,
      });
      toastService.error('Failed to update pain location log');
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  /**
   * Delete pain location log
   * 
   * @param id - Pain location log ID
   */
  deletePainLocationLog: async (id: string) => {
    set({ loading: true, error: null });
    try {
      // Validate input
      if (!id) {
        throw new Error('Pain location log ID is required');
      }

      logger.log('[EpisodeStore] Deleting pain location log:', id);

      await painLocationLogRepository.delete(id);

      // Invalidate cache for episode details
      cacheManager.invalidate('episodes');
      cacheManager.invalidate('currentEpisode');

      // Update state
      const currentLogs = get().painLocationLogs || [];
      const updatedLogs = currentLogs.filter(log => log.id !== id);
      set({ painLocationLogs: updatedLogs, loading: false });

      logger.log('[EpisodeStore] Pain location log deleted:', id);
    } catch (error) {
      await errorLogger.log('database', 'Failed to delete pain location log', error as Error, {
        operation: 'deletePainLocationLog',
        id,
      });
      toastService.error('Failed to delete pain location log');
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },
}));
