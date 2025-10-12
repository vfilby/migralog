import { useEpisodeStore } from '../episodeStore';
import { episodeRepository, intensityRepository, symptomLogRepository } from '../../database/episodeRepository';
import { Episode } from '../../models/types';

// Mock dependencies
jest.mock('../../database/episodeRepository');
jest.mock('../../services/errorLogger');

describe('episodeStore', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset the store state
    useEpisodeStore.setState({
      currentEpisode: undefined,
      episodes: [],
      loading: false,
      error: undefined,
    });
  });

  describe('loadEpisodes', () => {
    it('should load episodes successfully', async () => {
      const mockEpisodes: Episode[] = [
        {
          id: 'ep-1',
          startTime: Date.now() - 10000,
          endTime: Date.now(),
          locations: ['Head'],
          qualities: ['Throbbing'],
          symptoms: [],
          triggers: [],
          notes: undefined,
          peakIntensity: 7,
          averageIntensity: 5,
          createdAt: Date.now() - 10000,
          updatedAt: Date.now(),
        },
      ];

      (episodeRepository.getAll as jest.Mock).mockResolvedValue(mockEpisodes);

      await useEpisodeStore.getState().loadEpisodes();

      const state = useEpisodeStore.getState();
      expect(state.episodes).toEqual(mockEpisodes);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle errors when loading episodes', async () => {
      const error = new Error('Database error');
      (episodeRepository.getAll as jest.Mock).mockRejectedValue(error);

      await useEpisodeStore.getState().loadEpisodes();

      const state = useEpisodeStore.getState();
      expect(state.episodes).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Database error');
    });

    it('should set loading state during load', async () => {
      (episodeRepository.getAll as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      );

      const loadPromise = useEpisodeStore.getState().loadEpisodes();

      // Check loading state is true
      expect(useEpisodeStore.getState().loading).toBe(true);

      await loadPromise;

      // Check loading state is false after completion
      expect(useEpisodeStore.getState().loading).toBe(false);
    });
  });

  describe('loadCurrentEpisode', () => {
    it('should load current episode successfully', async () => {
      const mockEpisode: Episode = {
        id: 'current-ep',
        startTime: Date.now(),
        endTime: undefined,
        locations: ['Head'],
        qualities: [],
        symptoms: [],
        triggers: [],
        notes: undefined,
        peakIntensity: undefined,
        averageIntensity: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (episodeRepository.getCurrentEpisode as jest.Mock).mockResolvedValue(mockEpisode);

      await useEpisodeStore.getState().loadCurrentEpisode();

      const state = useEpisodeStore.getState();
      expect(state.currentEpisode).toEqual(mockEpisode);
      expect(state.error).toBeNull();
    });

    it('should handle null current episode', async () => {
      (episodeRepository.getCurrentEpisode as jest.Mock).mockResolvedValue(null);

      await useEpisodeStore.getState().loadCurrentEpisode();

      const state = useEpisodeStore.getState();
      expect(state.currentEpisode).toBeNull();
    });

    it('should handle errors when loading current episode', async () => {
      const error = new Error('Database error');
      (episodeRepository.getCurrentEpisode as jest.Mock).mockRejectedValue(error);

      await useEpisodeStore.getState().loadCurrentEpisode();

      const state = useEpisodeStore.getState();
      expect(state.error).toBe('Database error');
    });
  });

  describe('startEpisode', () => {
    it('should start a new episode successfully', async () => {
      const newEpisodeData = {
        startTime: Date.now(),
        endTime: undefined,
        locations: ['Head'],
        qualities: ['Throbbing'],
        symptoms: [],
        triggers: [],
        notes: undefined,
        peakIntensity: undefined,
        averageIntensity: undefined,
      };

      const createdEpisode: Episode = {
        ...newEpisodeData,
        id: 'new-ep-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (episodeRepository.create as jest.Mock).mockResolvedValue(createdEpisode);

      const result = await useEpisodeStore.getState().startEpisode(newEpisodeData);

      expect(result).toEqual(createdEpisode);
      const state = useEpisodeStore.getState();
      expect(state.currentEpisode).toEqual(createdEpisode);
      expect(state.episodes[0]).toEqual(createdEpisode);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should add new episode to front of episodes list', async () => {
      const existingEpisode: Episode = {
        id: 'old-ep',
        startTime: Date.now() - 20000,
        endTime: Date.now() - 10000,
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        notes: undefined,
        peakIntensity: undefined,
        averageIntensity: undefined,
        createdAt: Date.now() - 20000,
        updatedAt: Date.now() - 10000,
      };

      useEpisodeStore.setState({ episodes: [existingEpisode] });

      const newEpisodeData = {
        startTime: Date.now(),
        endTime: undefined,
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        notes: undefined,
        peakIntensity: undefined,
        averageIntensity: undefined,
      };

      const createdEpisode: Episode = {
        ...newEpisodeData,
        id: 'new-ep',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (episodeRepository.create as jest.Mock).mockResolvedValue(createdEpisode);

      await useEpisodeStore.getState().startEpisode(newEpisodeData);

      const state = useEpisodeStore.getState();
      expect(state.episodes).toHaveLength(2);
      expect(state.episodes[0]).toEqual(createdEpisode);
      expect(state.episodes[1]).toEqual(existingEpisode);
    });

    it('should handle errors when starting episode', async () => {
      const error = new Error('Failed to create episode');
      (episodeRepository.create as jest.Mock).mockRejectedValue(error);

      const newEpisodeData = {
        startTime: Date.now(),
        endTime: undefined,
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        notes: undefined,
        peakIntensity: undefined,
        averageIntensity: undefined,
      };

      await expect(
        useEpisodeStore.getState().startEpisode(newEpisodeData)
      ).rejects.toThrow('Failed to create episode');

      const state = useEpisodeStore.getState();
      expect(state.error).toBe('Failed to create episode');
      expect(state.loading).toBe(false);
      expect(state.currentEpisode).toBeNull();
    });
  });

  describe('endEpisode', () => {
    it('should end episode successfully', async () => {
      const ongoingEpisode: Episode = {
        id: 'ep-123',
        startTime: Date.now() - 10000,
        endTime: undefined,
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        notes: undefined,
        peakIntensity: 6,
        averageIntensity: 5,
        createdAt: Date.now() - 10000,
        updatedAt: Date.now() - 10000,
      };

      useEpisodeStore.setState({
        currentEpisode: ongoingEpisode,
        episodes: [ongoingEpisode],
      });

      (episodeRepository.update as jest.Mock).mockResolvedValue(undefined);

      const endTime = Date.now();
      await useEpisodeStore.getState().endEpisode('ep-123', endTime);

      const state = useEpisodeStore.getState();
      expect(state.currentEpisode).toBeNull();
      expect(state.episodes[0].endTime).toBe(endTime);
      expect(state.loading).toBe(false);
      expect(episodeRepository.update).toHaveBeenCalledWith('ep-123', { endTime });
    });

    it('should handle errors when ending episode', async () => {
      const error = new Error('Failed to update episode');
      (episodeRepository.update as jest.Mock).mockRejectedValue(error);

      await expect(
        useEpisodeStore.getState().endEpisode('ep-123', Date.now())
      ).rejects.toThrow('Failed to update episode');

      const state = useEpisodeStore.getState();
      expect(state.error).toBe('Failed to update episode');
      expect(state.loading).toBe(false);
    });
  });

  describe('updateEpisode', () => {
    it('should update episode in both episodes list and current episode', async () => {
      const episode: Episode = {
        id: 'ep-123',
        startTime: Date.now(),
        endTime: undefined,
        locations: ['Head'],
        qualities: [],
        symptoms: [],
        triggers: [],
        notes: undefined,
        peakIntensity: 5,
        averageIntensity: 4,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useEpisodeStore.setState({
        currentEpisode: episode,
        episodes: [episode],
      });

      (episodeRepository.update as jest.Mock).mockResolvedValue(undefined);

      const updates = { peakIntensity: 8, averageIntensity: 6 };
      await useEpisodeStore.getState().updateEpisode('ep-123', updates);

      const state = useEpisodeStore.getState();
      expect(state.currentEpisode?.peakIntensity).toBe(8);
      expect(state.currentEpisode?.averageIntensity).toBe(6);
      expect(state.episodes[0].peakIntensity).toBe(8);
      expect(episodeRepository.update).toHaveBeenCalledWith('ep-123', updates);
    });

    it('should update only episodes list if not current episode', async () => {
      const currentEpisode: Episode = {
        id: 'current-ep',
        startTime: Date.now(),
        endTime: undefined,
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        notes: undefined,
        peakIntensity: undefined,
        averageIntensity: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const otherEpisode: Episode = {
        id: 'other-ep',
        startTime: Date.now() - 20000,
        endTime: Date.now() - 10000,
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        notes: undefined,
        peakIntensity: 5,
        averageIntensity: 4,
        createdAt: Date.now() - 20000,
        updatedAt: Date.now() - 10000,
      };

      useEpisodeStore.setState({
        currentEpisode,
        episodes: [currentEpisode, otherEpisode],
      });

      (episodeRepository.update as jest.Mock).mockResolvedValue(undefined);

      await useEpisodeStore.getState().updateEpisode('other-ep', { peakIntensity: 7 });

      const state = useEpisodeStore.getState();
      expect(state.episodes[1].peakIntensity).toBe(7);
      expect(state.currentEpisode).toEqual(currentEpisode); // Unchanged
    });

    it('should handle errors when updating episode', async () => {
      const error = new Error('Update failed');
      (episodeRepository.update as jest.Mock).mockRejectedValue(error);

      await expect(
        useEpisodeStore.getState().updateEpisode('ep-123', { notes: 'test' })
      ).rejects.toThrow('Update failed');

      expect(useEpisodeStore.getState().error).toBe('Update failed');
    });
  });

  describe('addIntensityReading', () => {
    it('should add intensity reading and update peak/average', async () => {
      (intensityRepository.create as jest.Mock).mockResolvedValue({ id: 'reading-1' });
      (intensityRepository.getByEpisodeId as jest.Mock).mockResolvedValue([
        { intensity: 5 },
        { intensity: 7 },
        { intensity: 6 },
      ]);
      (episodeRepository.update as jest.Mock).mockResolvedValue(undefined);

      const episode: Episode = {
        id: 'ep-123',
        startTime: Date.now(),
        endTime: undefined,
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        notes: undefined,
        peakIntensity: undefined,
        averageIntensity: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useEpisodeStore.setState({
        currentEpisode: episode,
        episodes: [episode],
      });

      await useEpisodeStore.getState().addIntensityReading('ep-123', 7);

      expect(intensityRepository.create).toHaveBeenCalled();
      expect(intensityRepository.getByEpisodeId).toHaveBeenCalledWith('ep-123');
      expect(episodeRepository.update).toHaveBeenCalledWith('ep-123', {
        peakIntensity: 7,
        averageIntensity: 6,
      });

      const state = useEpisodeStore.getState();
      expect(state.currentEpisode?.peakIntensity).toBe(7);
      expect(state.currentEpisode?.averageIntensity).toBe(6);
    });

    it('should handle errors when adding intensity reading', async () => {
      const error = new Error('Failed to add reading');
      (intensityRepository.create as jest.Mock).mockRejectedValue(error);

      await expect(
        useEpisodeStore.getState().addIntensityReading('ep-123', 7)
      ).rejects.toThrow('Failed to add reading');

      expect(useEpisodeStore.getState().error).toBe('Failed to add reading');
    });
  });

  describe('addSymptomLog', () => {
    it('should add symptom log successfully', async () => {
      (symptomLogRepository.create as jest.Mock).mockResolvedValue({ id: 'symptom-1' });

      const symptomLog = {
        episodeId: 'ep-123',
        symptom: 'Nausea',
        onsetTime: Date.now(),
        resolutionTime: undefined,
        severity: 7,
      };

      await useEpisodeStore.getState().addSymptomLog(symptomLog);

      expect(symptomLogRepository.create).toHaveBeenCalledWith(symptomLog);
      expect(useEpisodeStore.getState().error).toBeNull();
    });

    it('should handle errors when adding symptom log', async () => {
      const error = new Error('Failed to add symptom');
      (symptomLogRepository.create as jest.Mock).mockRejectedValue(error);

      const symptomLog = {
        episodeId: 'ep-123',
        symptom: 'Nausea',
        onsetTime: Date.now(),
        resolutionTime: undefined,
        severity: 7,
      };

      await expect(
        useEpisodeStore.getState().addSymptomLog(symptomLog)
      ).rejects.toThrow('Failed to add symptom');

      expect(useEpisodeStore.getState().error).toBe('Failed to add symptom');
    });
  });

  describe('deleteEpisode', () => {
    it('should delete episode from episodes list', async () => {
      const ep1: Episode = {
        id: 'ep-1',
        startTime: Date.now(),
        endTime: undefined,
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        notes: undefined,
        peakIntensity: undefined,
        averageIntensity: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const ep2: Episode = {
        id: 'ep-2',
        startTime: Date.now() - 10000,
        endTime: Date.now(),
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        notes: undefined,
        peakIntensity: undefined,
        averageIntensity: undefined,
        createdAt: Date.now() - 10000,
        updatedAt: Date.now(),
      };

      useEpisodeStore.setState({ episodes: [ep1, ep2] });

      (episodeRepository.delete as jest.Mock).mockResolvedValue(undefined);

      await useEpisodeStore.getState().deleteEpisode('ep-1');

      const state = useEpisodeStore.getState();
      expect(state.episodes).toHaveLength(1);
      expect(state.episodes[0].id).toBe('ep-2');
      expect(state.loading).toBe(false);
      expect(episodeRepository.delete).toHaveBeenCalledWith('ep-1');
    });

    it('should clear current episode if deleting current episode', async () => {
      const currentEp: Episode = {
        id: 'current',
        startTime: Date.now(),
        endTime: undefined,
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        notes: undefined,
        peakIntensity: undefined,
        averageIntensity: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useEpisodeStore.setState({
        currentEpisode: currentEp,
        episodes: [currentEp],
      });

      (episodeRepository.delete as jest.Mock).mockResolvedValue(undefined);

      await useEpisodeStore.getState().deleteEpisode('current');

      const state = useEpisodeStore.getState();
      expect(state.currentEpisode).toBeNull();
      expect(state.episodes).toHaveLength(0);
    });

    it('should handle errors when deleting episode', async () => {
      const error = new Error('Delete failed');
      (episodeRepository.delete as jest.Mock).mockRejectedValue(error);

      await expect(
        useEpisodeStore.getState().deleteEpisode('ep-123')
      ).rejects.toThrow('Delete failed');

      const state = useEpisodeStore.getState();
      expect(state.error).toBe('Delete failed');
      expect(state.loading).toBe(false);
    });
  });

  describe('state management', () => {
    it('should have correct initial state', () => {
      const state = useEpisodeStore.getState();

      expect(state.currentEpisode).toBeNull();
      expect(state.episodes).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should maintain state across multiple operations', async () => {
      // Load episodes
      (episodeRepository.getAll as jest.Mock).mockResolvedValue([]);
      await useEpisodeStore.getState().loadEpisodes();
      expect(useEpisodeStore.getState().loading).toBe(false);

      // Start episode
      const newEpisode: Episode = {
        id: 'new',
        startTime: Date.now(),
        endTime: undefined,
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        notes: undefined,
        peakIntensity: undefined,
        averageIntensity: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (episodeRepository.create as jest.Mock).mockResolvedValue(newEpisode);
      await useEpisodeStore.getState().startEpisode(newEpisode);

      const state = useEpisodeStore.getState();
      expect(state.currentEpisode).toEqual(newEpisode);
      expect(state.episodes).toHaveLength(1);
      expect(state.error).toBeNull();
    });
  });
});
