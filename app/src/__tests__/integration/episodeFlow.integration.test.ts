/**
 * Integration Test: Episode Workflow
 * 
 * Tests complete episode workflows across store operations:
 * - Start episode -> Add intensity -> Add symptoms -> End episode
 * - Multiple episodes -> Load list -> Filter by date
 * - Reopen closed episode -> Verify current episode updated
 */

import { useEpisodeStore } from '../../store/episodeStore';
import { episodeRepository, intensityRepository, symptomLogRepository } from '../../database/episodeRepository';
import { PainLocation, PainQuality, Symptom, Trigger, Episode, SymptomLog } from '../../models/types';

// Mock repositories
jest.mock('../../database/episodeRepository');

describe('Integration: Episode Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear cache to prevent data bleed between tests
    const { cacheManager } = require('../../utils/cacheManager');
    cacheManager.clear();
    
    // Reset store to initial state
    useEpisodeStore.setState({
      currentEpisode: null,
      episodes: [],
      loading: false,
      error: null,
    });
  });

  afterEach(() => {
    // Additional cleanup if needed
  });

  it('should complete start -> update -> end workflow', async () => {
    const store = useEpisodeStore.getState();
    const startTime = Date.now() - 3600000; // 1 hour ago
    const endTime = Date.now();

    const mockEpisode: Episode = {
      id: 'episode-1',
      startTime,
      endTime: undefined,
      locations: ['left_temple'] as PainLocation[],
      qualities: ['throbbing'] as PainQuality[],
      symptoms: ['nausea'] as Symptom[],
      triggers: ['stress'] as Trigger[],
      notes: 'Initial notes',
      createdAt: startTime,
      updatedAt: startTime,
    };

    const endedEpisode: Episode = {
      ...mockEpisode,
      endTime,
      updatedAt: endTime,
    };

    // Mock repository responses
    (episodeRepository.create as jest.Mock).mockResolvedValue(mockEpisode);
    
    // getCurrentEpisode should return episode, then null after ending
    let currentEpisode: Episode | null = mockEpisode;
    (episodeRepository.getCurrentEpisode as jest.Mock).mockImplementation(
      async (_db?: any) => currentEpisode
    );
    
    (episodeRepository.update as jest.Mock).mockImplementation(
      async (_id: string, updates: any, _db?: any) => {
        // When ending episode, update our mock state
        if (updates.endTime !== undefined) {
          currentEpisode = null;
        }
        return undefined;
      }
    );
    
    (episodeRepository.getAll as jest.Mock).mockImplementation(
      async (_db?: any) => [endedEpisode]
    );

    // Step 1: Start episode
    const created = await store.startEpisode({
      startTime,
      locations: ['left_temple'] as PainLocation[],
      qualities: ['throbbing'] as PainQuality[],
      symptoms: ['nausea'] as Symptom[],
      triggers: ['stress'] as Trigger[],
      notes: 'Initial notes',
    });

    expect(created.id).toBe('episode-1');
    expect(created.endTime).toBeUndefined();

    // Step 2: Load current episode
    await store.loadCurrentEpisode();

    let state = useEpisodeStore.getState();
    expect(state.currentEpisode).toBeDefined();
    expect(state.currentEpisode?.id).toBe('episode-1');

    // Step 3: Update episode
    await store.updateEpisode('episode-1', {
      notes: 'Updated notes',
    });

    // Step 4: End episode
    await store.endEpisode('episode-1', endTime);

    // Step 5: Verify current episode is cleared
    await store.loadCurrentEpisode();

    state = useEpisodeStore.getState();
    expect(state.currentEpisode).toBeNull();

    // Step 6: Load all episodes
    await store.loadEpisodes();

    state = useEpisodeStore.getState();
    expect(state.episodes).toHaveLength(1);
    expect(state.episodes[0].endTime).toBe(endTime);
  });

  it('should handle multiple episodes correctly', async () => {
    const store = useEpisodeStore.getState();

    const episode1: Episode = {
      id: 'episode-multi-1',
      startTime: Date.now() - 86400000, // 1 day ago
      endTime: Date.now() - 82800000, // ended 1 hour later
      locations: ['left_temple'] as PainLocation[],
      qualities: ['sharp'] as PainQuality[],
      symptoms: [] as Symptom[],
      triggers: [] as Trigger[],
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 82800000,
    };

    const episode2: Episode = {
      id: 'episode-multi-2',
      startTime: Date.now() - 7200000, // 2 hours ago
      endTime: undefined, // Current episode
      locations: ['right_temple'] as PainLocation[],
      qualities: ['throbbing'] as PainQuality[],
      symptoms: ['light_sensitivity'] as Symptom[],
      triggers: ['bright_lights'] as Trigger[],
      createdAt: Date.now() - 7200000,
      updatedAt: Date.now() - 7200000,
    };

    // Clear any previous mocks
    jest.clearAllMocks();
    
    (episodeRepository.getAll as jest.Mock).mockResolvedValue([episode2, episode1]);
    (episodeRepository.getCurrentEpisode as jest.Mock).mockResolvedValue(episode2);

    // Load episodes
    await store.loadEpisodes();

    let state = useEpisodeStore.getState();
    expect(state.episodes).toHaveLength(2);

    // Load current episode
    await store.loadCurrentEpisode();

    state = useEpisodeStore.getState();
    expect(state.currentEpisode).toBeDefined();
    expect(state.currentEpisode?.id).toBe('episode-multi-2');
    expect(state.currentEpisode?.endTime).toBeUndefined();
  });

  it('should handle reopen workflow', async () => {
    const store = useEpisodeStore.getState();

    const closedEpisode: Episode = {
      id: 'episode-closed',
      startTime: Date.now() - 7200000,
      endTime: Date.now() - 3600000,
      locations: ['left_eye'] as PainLocation[],
      qualities: ['pressure'] as PainQuality[],
      symptoms: [] as Symptom[],
      triggers: [] as Trigger[],
      createdAt: Date.now() - 7200000,
      updatedAt: Date.now() - 3600000,
    };

    const reopenedEpisode: Episode = {
      ...closedEpisode,
      endTime: undefined,
      updatedAt: Date.now(),
    };

    let episodes = [closedEpisode];
    let current: Episode | null = null;
    
    (episodeRepository.getAll as jest.Mock).mockImplementation(
      async (_db?: any) => episodes
    );
    
    (episodeRepository.getCurrentEpisode as jest.Mock).mockImplementation(
      async (_db?: any) => current
    );
    
    (episodeRepository.update as jest.Mock).mockImplementation(
      async (_id: string, updates: any, _db?: any) => {
        // When reopening, update episode and set as current
        if (updates.endTime === null || updates.endTime === undefined) {
          episodes = [reopenedEpisode];
          current = reopenedEpisode;
        }
        return undefined;
      }
    );

    // Load episodes - should have one closed episode
    await store.loadEpisodes();
    expect(useEpisodeStore.getState().episodes[0].endTime).toBeDefined();

    // No current episode
    await store.loadCurrentEpisode();
    expect(useEpisodeStore.getState().currentEpisode).toBeNull();

    // Reopen the episode
    await store.reopenEpisode('episode-closed');

    // Should now be current episode
    await store.loadCurrentEpisode();

    const state = useEpisodeStore.getState();
    expect(state.currentEpisode).toBeDefined();
    expect(state.currentEpisode?.id).toBe('episode-closed');
    expect(state.currentEpisode?.endTime).toBeUndefined();
  });

  it('should handle intensity tracking workflow', async () => {
    const store = useEpisodeStore.getState();

    const episode: Episode = {
      id: 'episode-intensity',
      startTime: Date.now() - 3600000,
      endTime: undefined,
      locations: ['left_temple'] as PainLocation[],
      qualities: ['throbbing'] as PainQuality[],
      symptoms: [] as Symptom[],
      triggers: [] as Trigger[],
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 3600000,
    };

    (episodeRepository.create as jest.Mock).mockResolvedValue(episode);
    (intensityRepository.create as jest.Mock).mockResolvedValue({
      id: 'intensity-1',
      episodeId: episode.id,
      timestamp: Date.now(),
      intensity: 7,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Start episode
    const created = await store.startEpisode({
      startTime: Date.now() - 3600000,
      locations: ['left_temple'] as PainLocation[],
      qualities: ['throbbing'] as PainQuality[],
      symptoms: [] as Symptom[],
      triggers: [] as Trigger[],
    });

    // Add intensity reading
    await store.addIntensityReading(created.id, 7);

    // Verify intensity repository was called
    expect(intensityRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        episodeId: created.id,
        intensity: 7,
      })
    );
  });

  it('should handle symptom logging workflow', async () => {
    const store = useEpisodeStore.getState();

    const episode: Episode = {
      id: 'episode-symptoms',
      startTime: Date.now() - 3600000,
      endTime: undefined,
      locations: ['right_temple'] as PainLocation[],
      qualities: ['sharp'] as PainQuality[],
      symptoms: [] as Symptom[],
      triggers: [] as Trigger[],
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 3600000,
    };

    const symptomLog: SymptomLog = {
      id: 'symptom-1',
      episodeId: episode.id,
      symptom: 'aura' as Symptom,
      onsetTime: Date.now(),
      severity: 8,
      createdAt: Date.now(),
    };

    (episodeRepository.create as jest.Mock).mockResolvedValue(episode);
    (symptomLogRepository.create as jest.Mock).mockResolvedValue(symptomLog);

    // Start episode
    const created = await store.startEpisode({
      startTime: Date.now() - 3600000,
      locations: ['right_temple'] as PainLocation[],
      qualities: ['sharp'] as PainQuality[],
      symptoms: [] as Symptom[],
      triggers: [] as Trigger[],
    });

    // Add symptom log
    await store.addSymptomLog({
      episodeId: created.id,
      symptom: 'aura' as Symptom,
      onsetTime: Date.now(),
      severity: 8,
    });

    // Verify symptom log repository was called
    expect(symptomLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        episodeId: created.id,
        symptom: 'aura',
        severity: 8,
      })
    );
  });

  it('should handle delete workflow', async () => {
    const store = useEpisodeStore.getState();

    const episode1: Episode = {
      id: 'episode-1',
      startTime: Date.now() - 86400000,
      endTime: Date.now() - 82800000,
      locations: ['left_temple'] as PainLocation[],
      qualities: ['throbbing'] as PainQuality[],
      symptoms: [] as Symptom[],
      triggers: [] as Trigger[],
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 82800000,
    };

    const episode2: Episode = {
      id: 'episode-2',
      startTime: Date.now() - 43200000,
      endTime: Date.now() - 39600000,
      locations: ['right_temple'] as PainLocation[],
      qualities: ['sharp'] as PainQuality[],
      symptoms: [] as Symptom[],
      triggers: [] as Trigger[],
      createdAt: Date.now() - 43200000,
      updatedAt: Date.now() - 39600000,
    };

    // Track episodes in state
    let episodeList = [episode2, episode1];
    
    (episodeRepository.getAll as jest.Mock).mockImplementation(
      async (_db?: any) => episodeList
    );
    
    (episodeRepository.delete as jest.Mock).mockImplementation(
      async (id: string, _db?: any) => {
        episodeList = episodeList.filter(e => e.id !== id);
        return undefined;
      }
    );

    // Load episodes
    await store.loadEpisodes();
    expect(useEpisodeStore.getState().episodes).toHaveLength(2);

    // Delete first episode
    await store.deleteEpisode('episode-1');

    // Reload
    await store.loadEpisodes();

    const state = useEpisodeStore.getState();
    expect(state.episodes).toHaveLength(1);
    expect(state.episodes[0].id).toBe('episode-2');
  });
});
