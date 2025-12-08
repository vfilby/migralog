import { useEpisodeStore } from '../episodeStore';
import { 
  episodeRepository, 
  intensityRepository, 
  symptomLogRepository,
  episodeNoteRepository,
  painLocationLogRepository
} from '../../database/episodeRepository';
import { Episode, IntensityReading, SymptomLog, EpisodeNote, PainLocationLog } from '../../models/types';
import { cacheManager } from '../../utils/cacheManager';
import { toastService } from '../../services/toastService';

// Mock dependencies
jest.mock('../../database/episodeRepository');
jest.mock('../../services/errorLogger');
jest.mock('../../services/toastService');

describe('episodeStore', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Clear cache before each test
    cacheManager.clear();

    // Reset the store state
    useEpisodeStore.setState({
      currentEpisode: null,
      episodes: [],
      loading: false,
      error: null,
      intensityReadings: [],
      symptomLogs: [],
      episodeNotes: [],
      painLocationLogs: [],
    });
  });

  describe('loadEpisodes', () => {
    it('should load episodes successfully', async () => {
      const mockEpisodes: Episode[] = [
        {
          id: 'ep-1',
          startTime: Date.now() - 10000,
          endTime: Date.now(),
          locations: ['left_head'],
          qualities: ['throbbing'],
          symptoms: [],
          triggers: [],
          notes: undefined,
          createdAt: Date.now() - 10000,
          updatedAt: Date.now(),
        },
      ];

      (episodeRepository.getAll as jest.Mock).mockResolvedValue(mockEpisodes);

      await useEpisodeStore.getState().loadEpisodes();

      const state = useEpisodeStore.getState();
      expect(state.episodes).toEqual(mockEpisodes);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
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
        locations: ['left_head'],
        qualities: [],
        symptoms: [],
        triggers: [],
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (episodeRepository.getCurrentEpisode as jest.Mock).mockResolvedValue(mockEpisode);

      await useEpisodeStore.getState().loadCurrentEpisode();

      const state = useEpisodeStore.getState();
      expect(state.currentEpisode).toEqual(mockEpisode);
      expect(state.error).toBe(null);
    });

    it('should handle null current episode', async () => {
      (episodeRepository.getCurrentEpisode as jest.Mock).mockResolvedValue(null);

      await useEpisodeStore.getState().loadCurrentEpisode();

      const state = useEpisodeStore.getState();
      expect(state.currentEpisode).toBe(null);
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
        locations: ['left_head'],
        qualities: ['throbbing'],
        symptoms: [],
        triggers: [],
        notes: undefined,
      };

      const createdEpisode: Episode = {
        ...newEpisodeData,
        id: 'new-ep-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as Episode;

      (episodeRepository.create as jest.Mock).mockResolvedValue(createdEpisode);

      const result = await useEpisodeStore.getState().startEpisode(newEpisodeData as any);

      expect(result).toEqual(createdEpisode);
      const state = useEpisodeStore.getState();
      expect(state.currentEpisode).toEqual(createdEpisode);
      expect(state.episodes[0]).toEqual(createdEpisode);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
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
      };

      await expect(
        useEpisodeStore.getState().startEpisode(newEpisodeData)
      ).rejects.toThrow('Failed to create episode');

      const state = useEpisodeStore.getState();
      expect(state.error).toBe('Failed to create episode');
      expect(state.loading).toBe(false);
      expect(state.currentEpisode).toBe(null);
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
      expect(state.currentEpisode).toBe(null);
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

  describe('reopenEpisode', () => {
    it('should reopen episode successfully', async () => {
      const endedEpisode: Episode = {
        id: 'ep-123',
        startTime: Date.now() - 10000,
        endTime: Date.now() - 5000,
        locations: ['left_head'],
        qualities: ['throbbing'],
        symptoms: [],
        triggers: [],
        notes: undefined,
        createdAt: Date.now() - 10000,
        updatedAt: Date.now() - 5000,
      };

      useEpisodeStore.setState({
        currentEpisode: null,
        episodes: [endedEpisode],
      });

      (episodeRepository.update as jest.Mock).mockResolvedValue(undefined);

      await useEpisodeStore.getState().reopenEpisode('ep-123');

      const state = useEpisodeStore.getState();
      expect(state.currentEpisode).toBeTruthy();
      expect(state.currentEpisode?.id).toBe('ep-123');
      expect(state.currentEpisode?.endTime).toBeUndefined();
      expect(state.episodes[0].endTime).toBeUndefined();
      expect(state.loading).toBe(false);
      expect(episodeRepository.update).toHaveBeenCalledWith('ep-123', { endTime: undefined });
    });

    it('should invalidate cache when reopening episode', async () => {
      const endedEpisode: Episode = {
        id: 'ep-123',
        startTime: Date.now() - 10000,
        endTime: Date.now() - 5000,
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        notes: undefined,
        createdAt: Date.now() - 10000,
        updatedAt: Date.now() - 5000,
      };

      useEpisodeStore.setState({ episodes: [endedEpisode] });

      (episodeRepository.update as jest.Mock).mockResolvedValue(undefined);

      const invalidateSpy = jest.spyOn(cacheManager, 'invalidate');

      await useEpisodeStore.getState().reopenEpisode('ep-123');

      expect(invalidateSpy).toHaveBeenCalledWith('episodes');
      expect(invalidateSpy).toHaveBeenCalledWith('currentEpisode');
    });

    it('should set reopened episode as current episode', async () => {
      const endedEpisode: Episode = {
        id: 'ep-123',
        startTime: Date.now() - 10000,
        endTime: Date.now() - 5000,
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        notes: undefined,
        createdAt: Date.now() - 10000,
        updatedAt: Date.now() - 5000,
      };

      useEpisodeStore.setState({
        currentEpisode: null,
        episodes: [endedEpisode],
      });

      (episodeRepository.update as jest.Mock).mockResolvedValue(undefined);

      await useEpisodeStore.getState().reopenEpisode('ep-123');

      const state = useEpisodeStore.getState();
      expect(state.currentEpisode).not.toBe(null);
      expect(state.currentEpisode?.id).toBe('ep-123');
      expect(state.currentEpisode?.endTime).toBeUndefined();
    });

    it('should handle errors when reopening episode', async () => {
      const error = new Error('Failed to reopen episode');
      (episodeRepository.update as jest.Mock).mockRejectedValue(error);

      await expect(
        useEpisodeStore.getState().reopenEpisode('ep-123')
      ).rejects.toThrow('Failed to reopen episode');

      const state = useEpisodeStore.getState();
      expect(state.error).toBe('Failed to reopen episode');
      expect(state.loading).toBe(false);
      expect(toastService.error).toHaveBeenCalledWith('Failed to reopen episode');
    });

    it('should validate episode ID is provided', async () => {
      await expect(
        useEpisodeStore.getState().reopenEpisode('')
      ).rejects.toThrow('Episode ID is required');

      expect(useEpisodeStore.getState().error).toBe('Episode ID is required');
    });

    it('should handle reopening episode that does not exist in local state', async () => {
      useEpisodeStore.setState({ episodes: [] });

      (episodeRepository.update as jest.Mock).mockResolvedValue(undefined);

      await useEpisodeStore.getState().reopenEpisode('nonexistent-ep');

      const state = useEpisodeStore.getState();
      expect(state.currentEpisode).toBe(null);
      expect(episodeRepository.update).toHaveBeenCalledWith('nonexistent-ep', { endTime: undefined });
    });
  });

  describe('updateEpisode', () => {
    it('should update episode in both episodes list and current episode', async () => {
      const episode: Episode = {
        id: 'ep-123',
        startTime: Date.now(),
        endTime: undefined,
        locations: ['left_head'],
        qualities: [],
        symptoms: [],
        triggers: [],
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useEpisodeStore.setState({
        currentEpisode: episode,
        episodes: [episode],
      });

      (episodeRepository.update as jest.Mock).mockResolvedValue(undefined);

      const updates = { notes: 'Updated notes' };
      await useEpisodeStore.getState().updateEpisode('ep-123', updates);

      const state = useEpisodeStore.getState();
      expect(state.currentEpisode?.notes).toBe('Updated notes');
      expect(state.episodes[0].notes).toBe('Updated notes');
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
        createdAt: Date.now() - 20000,
        updatedAt: Date.now() - 10000,
      };

      useEpisodeStore.setState({
        currentEpisode,
        episodes: [currentEpisode, otherEpisode],
      });

      (episodeRepository.update as jest.Mock).mockResolvedValue(undefined);

      await useEpisodeStore.getState().updateEpisode('other-ep', { notes: 'Updated' });

      const state = useEpisodeStore.getState();
      expect(state.episodes[1].notes).toBe('Updated');
      expect(state.currentEpisode).toEqual(currentEpisode); // Unchanged
    });

    it('should handle errors when updating episode', async () => {
      const error = new Error('Update failed');
      (episodeRepository.update as jest.Mock).mockRejectedValue(error);

      await expect(
        useEpisodeStore.getState().updateEpisode('ep-123', { notes: 'test' })
      ).rejects.toThrow('Update failed');

      expect(useEpisodeStore.getState().error).toBe('Update failed');
      expect(toastService.error).toHaveBeenCalledWith('Failed to update episode');
    });

    it('should validate episode ID is provided', async () => {
      await expect(
        useEpisodeStore.getState().updateEpisode('', { notes: 'test' })
      ).rejects.toThrow('Episode ID is required');
    });

    it('should validate updates are provided', async () => {
      await expect(
        useEpisodeStore.getState().updateEpisode('ep-123', {})
      ).rejects.toThrow('Updates are required');
    });
  });

  describe('addIntensityReading', () => {
    it('should add intensity reading successfully', async () => {
      const newReading: IntensityReading = {
        id: 'reading-1',
        episodeId: 'ep-123',
        timestamp: Date.now(),
        intensity: 7,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      (intensityRepository.create as jest.Mock).mockResolvedValue(newReading);

      const episode: Episode = {
        id: 'ep-123',
        startTime: Date.now(),
        endTime: undefined,
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useEpisodeStore.setState({
        currentEpisode: episode,
        episodes: [episode],
        intensityReadings: [],
      });

      await useEpisodeStore.getState().addIntensityReading('ep-123', 7);

      expect(intensityRepository.create).toHaveBeenCalled();
      expect(useEpisodeStore.getState().intensityReadings).toHaveLength(1);
    });

    it('should handle errors when adding intensity reading', async () => {
      const error = new Error('Failed to add reading');
      (intensityRepository.create as jest.Mock).mockRejectedValue(error);

      await expect(
        useEpisodeStore.getState().addIntensityReading('ep-123', 7)
      ).rejects.toThrow('Failed to add reading');

      expect(useEpisodeStore.getState().error).toBe('Failed to add reading');
      expect(toastService.error).toHaveBeenCalledWith('Failed to add intensity reading');
    });

    it('should validate episode ID is provided', async () => {
      await expect(
        useEpisodeStore.getState().addIntensityReading('', 7)
      ).rejects.toThrow('Episode ID is required');
    });

    it('should validate intensity is provided', async () => {
      await expect(
        useEpisodeStore.getState().addIntensityReading('ep-123', null as any)
      ).rejects.toThrow('Intensity is required');
    });
  });

  describe('addSymptomLog', () => {
    it('should add symptom log successfully', async () => {
      const newLog: SymptomLog = {
        id: 'symptom-1',
        episodeId: 'ep-123',
        symptom: 'nausea',
        onsetTime: Date.now(),
        resolutionTime: undefined,
        severity: 7,
        createdAt: Date.now(),
      };
      
      (symptomLogRepository.create as jest.Mock).mockResolvedValue(newLog);

      const symptomLog = {
        episodeId: 'ep-123',
        symptom: 'nausea',
        onsetTime: Date.now(),
        resolutionTime: undefined,
        severity: 7,
      } as any;

      useEpisodeStore.setState({ symptomLogs: [] });

      await useEpisodeStore.getState().addSymptomLog(symptomLog);

      expect(symptomLogRepository.create).toHaveBeenCalledWith(symptomLog);
      expect(useEpisodeStore.getState().error).toBe(null);
      expect(useEpisodeStore.getState().symptomLogs).toHaveLength(1);
    });

    it('should handle errors when adding symptom log', async () => {
      const error = new Error('Failed to add symptom');
      (symptomLogRepository.create as jest.Mock).mockRejectedValue(error);

      const symptomLog = {
        episodeId: 'ep-123',
        symptom: 'nausea',
        onsetTime: Date.now(),
        resolutionTime: undefined,
        severity: 7,
      } as any;

      await expect(
        useEpisodeStore.getState().addSymptomLog(symptomLog)
      ).rejects.toThrow('Failed to add symptom');

      expect(useEpisodeStore.getState().error).toBe('Failed to add symptom');
      expect(toastService.error).toHaveBeenCalledWith('Failed to add symptom log');
    });

    it('should validate episode ID is provided', async () => {
      const symptomLog = {
        episodeId: '',
        symptom: 'nausea',
        onsetTime: Date.now(),
      } as any;

      await expect(
        useEpisodeStore.getState().addSymptomLog(symptomLog)
      ).rejects.toThrow('Episode ID is required');
    });

    it('should validate symptom is provided', async () => {
      const symptomLog = {
        episodeId: 'ep-123',
        symptom: '',
        onsetTime: Date.now(),
      } as any;

      await expect(
        useEpisodeStore.getState().addSymptomLog(symptomLog)
      ).rejects.toThrow('Symptom is required');
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
      expect(state.currentEpisode).toBe(null);
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

      expect(state.currentEpisode).toBe(null);
      expect(state.episodes).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
      expect(state.intensityReadings).toEqual([]);
      expect(state.symptomLogs).toEqual([]);
      expect(state.episodeNotes).toEqual([]);
      expect(state.painLocationLogs).toEqual([]);
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
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (episodeRepository.create as jest.Mock).mockResolvedValue(newEpisode);
      await useEpisodeStore.getState().startEpisode(newEpisode);

      const state = useEpisodeStore.getState();
      expect(state.currentEpisode).toEqual(newEpisode);
      expect(state.episodes).toHaveLength(1);
      expect(state.error).toBe(null);
    });
  });

  describe('loadEpisodeWithDetails', () => {
    it('should load episode with all related data in parallel', async () => {
      const episode: Episode = {
        id: 'ep-123',
        startTime: Date.now(),
        endTime: undefined,
        locations: ['left_head'],
        qualities: ['throbbing'],
        symptoms: [],
        triggers: [],
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const intensityReadings: IntensityReading[] = [
        { id: 'ir-1', episodeId: 'ep-123', timestamp: Date.now(), intensity: 7, createdAt: Date.now(), updatedAt: Date.now() },
      ];

      const symptomLogs: SymptomLog[] = [
        { id: 'sl-1', episodeId: 'ep-123', symptom: 'nausea', onsetTime: Date.now(), createdAt: Date.now() },
      ];

      const episodeNotes: EpisodeNote[] = [
        { id: 'en-1', episodeId: 'ep-123', timestamp: Date.now(), note: 'Test note', createdAt: Date.now() },
      ];

      const painLocationLogs: PainLocationLog[] = [
        { id: 'pl-1', episodeId: 'ep-123', timestamp: Date.now(), painLocations: ['left_temple'], createdAt: Date.now(), updatedAt: Date.now() },
      ];

      (episodeRepository.getById as jest.Mock).mockResolvedValue(episode);
      (intensityRepository.getByEpisodeId as jest.Mock).mockResolvedValue(intensityReadings);
      (symptomLogRepository.getByEpisodeId as jest.Mock).mockResolvedValue(symptomLogs);
      (episodeNoteRepository.getByEpisodeId as jest.Mock).mockResolvedValue(episodeNotes);
      (painLocationLogRepository.getByEpisodeId as jest.Mock).mockResolvedValue(painLocationLogs);

      const result = await useEpisodeStore.getState().loadEpisodeWithDetails('ep-123');

      expect(result).toEqual({
        ...episode,
        intensityReadings,
        symptomLogs,
        episodeNotes,
        painLocationLogs,
      });

      const state = useEpisodeStore.getState();
      expect(state.intensityReadings).toEqual(intensityReadings);
      expect(state.symptomLogs).toEqual(symptomLogs);
      expect(state.episodeNotes).toEqual(episodeNotes);
      expect(state.painLocationLogs).toEqual(painLocationLogs);
      expect(state.loading).toBe(false);
    });

    it('should merge data instead of replacing to prevent race conditions', async () => {
      // Set up existing data from a previous episode
      const existingReading: IntensityReading = {
        id: 'ir-existing',
        episodeId: 'ep-999',
        timestamp: Date.now() - 5000,
        intensity: 5,
        createdAt: Date.now() - 5000,
        updatedAt: Date.now() - 5000,
      };

      const existingSymptom: SymptomLog = {
        id: 'sl-existing',
        episodeId: 'ep-999',
        symptom: 'aura',
        onsetTime: Date.now() - 5000,
        createdAt: Date.now() - 5000,
      };

      useEpisodeStore.setState({
        intensityReadings: [existingReading],
        symptomLogs: [existingSymptom],
        episodeNotes: [],
        painLocationLogs: [],
      });

      // Now load a different episode
      const episode: Episode = {
        id: 'ep-123',
        startTime: Date.now(),
        endTime: undefined,
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const newReading: IntensityReading = {
        id: 'ir-new',
        episodeId: 'ep-123',
        timestamp: Date.now(),
        intensity: 7,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const newSymptom: SymptomLog = {
        id: 'sl-new',
        episodeId: 'ep-123',
        symptom: 'nausea',
        onsetTime: Date.now(),
        createdAt: Date.now(),
      };

      (episodeRepository.getById as jest.Mock).mockResolvedValue(episode);
      (intensityRepository.getByEpisodeId as jest.Mock).mockResolvedValue([newReading]);
      (symptomLogRepository.getByEpisodeId as jest.Mock).mockResolvedValue([newSymptom]);
      (episodeNoteRepository.getByEpisodeId as jest.Mock).mockResolvedValue([]);
      (painLocationLogRepository.getByEpisodeId as jest.Mock).mockResolvedValue([]);

      await useEpisodeStore.getState().loadEpisodeWithDetails('ep-123');

      const state = useEpisodeStore.getState();
      
      // Should have both existing and new data merged
      expect(state.intensityReadings).toHaveLength(2);
      expect(state.intensityReadings.find(r => r.id === 'ir-existing')).toBeTruthy();
      expect(state.intensityReadings.find(r => r.id === 'ir-new')).toBeTruthy();
      
      expect(state.symptomLogs).toHaveLength(2);
      expect(state.symptomLogs.find(s => s.id === 'sl-existing')).toBeTruthy();
      expect(state.symptomLogs.find(s => s.id === 'sl-new')).toBeTruthy();
    });

    it('should update existing data when loading same episode again', async () => {
      const episode: Episode = {
        id: 'ep-123',
        startTime: Date.now(),
        endTime: undefined,
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const oldReading: IntensityReading = {
        id: 'ir-1',
        episodeId: 'ep-123',
        timestamp: Date.now(),
        intensity: 5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useEpisodeStore.setState({
        intensityReadings: [oldReading],
        symptomLogs: [],
        episodeNotes: [],
        painLocationLogs: [],
      });

      const updatedReading: IntensityReading = {
        ...oldReading,
        intensity: 8, // Updated intensity
      };

      (episodeRepository.getById as jest.Mock).mockResolvedValue(episode);
      (intensityRepository.getByEpisodeId as jest.Mock).mockResolvedValue([updatedReading]);
      (symptomLogRepository.getByEpisodeId as jest.Mock).mockResolvedValue([]);
      (episodeNoteRepository.getByEpisodeId as jest.Mock).mockResolvedValue([]);
      (painLocationLogRepository.getByEpisodeId as jest.Mock).mockResolvedValue([]);

      await useEpisodeStore.getState().loadEpisodeWithDetails('ep-123');

      const state = useEpisodeStore.getState();
      expect(state.intensityReadings).toHaveLength(1);
      expect(state.intensityReadings[0].intensity).toBe(8);
    });

    it('should return null if episode not found', async () => {
      (episodeRepository.getById as jest.Mock).mockResolvedValue(null);

      const result = await useEpisodeStore.getState().loadEpisodeWithDetails('nonexistent');

      expect(result).toBe(null);
      expect(useEpisodeStore.getState().loading).toBe(false);
    });

    it('should handle errors when loading episode details', async () => {
      const error = new Error('Failed to load details');
      (episodeRepository.getById as jest.Mock).mockRejectedValue(error);

      await expect(
        useEpisodeStore.getState().loadEpisodeWithDetails('ep-123')
      ).rejects.toThrow('Failed to load details');

      expect(useEpisodeStore.getState().error).toBe('Failed to load details');
      expect(toastService.error).toHaveBeenCalledWith('Failed to load episode details');
    });
  });

  describe('getEpisodeById', () => {
    it('should return episode from state by id', () => {
      const episode: Episode = {
        id: 'ep-123',
        startTime: Date.now(),
        endTime: undefined,
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useEpisodeStore.setState({ episodes: [episode] });

      const result = useEpisodeStore.getState().getEpisodeById('ep-123');
      expect(result).toEqual(episode);
    });

    it('should return null if episode not in state', () => {
      useEpisodeStore.setState({ episodes: [] });

      const result = useEpisodeStore.getState().getEpisodeById('nonexistent');
      expect(result).toBe(null);
    });
  });

  describe('Intensity Reading CRUD', () => {
    describe('getIntensityReadingById', () => {
      it('should return intensity reading from state by id', () => {
        const reading: IntensityReading = {
          id: 'ir-1',
          episodeId: 'ep-123',
          timestamp: Date.now(),
          intensity: 7,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        useEpisodeStore.setState({ intensityReadings: [reading] });

        const result = useEpisodeStore.getState().getIntensityReadingById('ir-1');
        expect(result).toEqual(reading);
      });

      it('should return null if reading not in state', () => {
        const result = useEpisodeStore.getState().getIntensityReadingById('nonexistent');
        expect(result).toBe(null);
      });
    });

    describe('updateIntensityReading', () => {
      it('should update intensity reading successfully', async () => {
        const reading: IntensityReading = {
          id: 'ir-1',
          episodeId: 'ep-123',
          timestamp: Date.now(),
          intensity: 7,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        useEpisodeStore.setState({ intensityReadings: [reading] });

        (intensityRepository.update as jest.Mock).mockResolvedValue(undefined);

        await useEpisodeStore.getState().updateIntensityReading('ir-1', { intensity: 8 });

        const state = useEpisodeStore.getState();
        expect(state.intensityReadings[0].intensity).toBe(8);
        expect(state.loading).toBe(false);
        expect(intensityRepository.update).toHaveBeenCalledWith('ir-1', { intensity: 8 });
      });

      it('should handle errors when updating intensity reading', async () => {
        const error = new Error('Update failed');
        (intensityRepository.update as jest.Mock).mockRejectedValue(error);

        await expect(
          useEpisodeStore.getState().updateIntensityReading('ir-1', { intensity: 8 })
        ).rejects.toThrow('Update failed');

        expect(useEpisodeStore.getState().error).toBe('Update failed');
        expect(toastService.error).toHaveBeenCalledWith('Failed to update intensity reading');
      });
    });

    describe('deleteIntensityReading', () => {
      it('should delete intensity reading successfully', async () => {
        const reading1: IntensityReading = {
          id: 'ir-1',
          episodeId: 'ep-123',
          timestamp: Date.now(),
          intensity: 7,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const reading2: IntensityReading = {
          id: 'ir-2',
          episodeId: 'ep-123',
          timestamp: Date.now() + 1000,
          intensity: 8,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        useEpisodeStore.setState({ intensityReadings: [reading1, reading2] });

        (intensityRepository.delete as jest.Mock).mockResolvedValue(undefined);

        await useEpisodeStore.getState().deleteIntensityReading('ir-1');

        const state = useEpisodeStore.getState();
        expect(state.intensityReadings).toHaveLength(1);
        expect(state.intensityReadings[0].id).toBe('ir-2');
        expect(intensityRepository.delete).toHaveBeenCalledWith('ir-1');
      });

      it('should handle errors when deleting intensity reading', async () => {
        const error = new Error('Delete failed');
        (intensityRepository.delete as jest.Mock).mockRejectedValue(error);

        await expect(
          useEpisodeStore.getState().deleteIntensityReading('ir-1')
        ).rejects.toThrow('Delete failed');

        expect(toastService.error).toHaveBeenCalledWith('Failed to delete intensity reading');
      });
    });
  });

  describe('Symptom Log CRUD', () => {
    describe('updateSymptomLog', () => {
      it('should update symptom log successfully', async () => {
        const log: SymptomLog = {
          id: 'sl-1',
          episodeId: 'ep-123',
          symptom: 'nausea',
          onsetTime: Date.now(),
          createdAt: Date.now(),
        };

        useEpisodeStore.setState({ symptomLogs: [log] });

        (symptomLogRepository.update as jest.Mock).mockResolvedValue(undefined);

        const resolutionTime = Date.now() + 1000;
        await useEpisodeStore.getState().updateSymptomLog('sl-1', { resolutionTime, severity: 5 });

        const state = useEpisodeStore.getState();
        expect(state.symptomLogs[0].resolutionTime).toBe(resolutionTime);
        expect(state.symptomLogs[0].severity).toBe(5);
        expect(symptomLogRepository.update).toHaveBeenCalledWith('sl-1', { resolutionTime, severity: 5 });
      });

      it('should handle errors when updating symptom log', async () => {
        const error = new Error('Update failed');
        (symptomLogRepository.update as jest.Mock).mockRejectedValue(error);

        await expect(
          useEpisodeStore.getState().updateSymptomLog('sl-1', { severity: 5 })
        ).rejects.toThrow('Update failed');

        expect(toastService.error).toHaveBeenCalledWith('Failed to update symptom log');
      });
    });

    describe('deleteSymptomLog', () => {
      it('should delete symptom log successfully', async () => {
        const log1: SymptomLog = {
          id: 'sl-1',
          episodeId: 'ep-123',
          symptom: 'nausea',
          onsetTime: Date.now(),
          createdAt: Date.now(),
        };

        const log2: SymptomLog = {
          id: 'sl-2',
          episodeId: 'ep-123',
          symptom: 'aura',
          onsetTime: Date.now(),
          createdAt: Date.now(),
        };

        useEpisodeStore.setState({ symptomLogs: [log1, log2] });

        (symptomLogRepository.delete as jest.Mock).mockResolvedValue(undefined);

        await useEpisodeStore.getState().deleteSymptomLog('sl-1');

        const state = useEpisodeStore.getState();
        expect(state.symptomLogs).toHaveLength(1);
        expect(state.symptomLogs[0].id).toBe('sl-2');
      });

      it('should handle errors when deleting symptom log', async () => {
        const error = new Error('Delete failed');
        (symptomLogRepository.delete as jest.Mock).mockRejectedValue(error);

        await expect(
          useEpisodeStore.getState().deleteSymptomLog('sl-1')
        ).rejects.toThrow('Delete failed');

        expect(toastService.error).toHaveBeenCalledWith('Failed to delete symptom log');
      });
    });
  });

  describe('Episode Note CRUD', () => {
    describe('addEpisodeNote', () => {
      it('should add episode note successfully', async () => {
        const newNote: EpisodeNote = {
          id: 'en-1',
          episodeId: 'ep-123',
          timestamp: Date.now(),
          note: 'Test note',
          createdAt: Date.now(),
        };

        (episodeNoteRepository.create as jest.Mock).mockResolvedValue(newNote);

        await useEpisodeStore.getState().addEpisodeNote({
          episodeId: 'ep-123',
          timestamp: newNote.timestamp,
          note: 'Test note',
        });

        const state = useEpisodeStore.getState();
        expect(state.episodeNotes).toHaveLength(1);
        expect(state.episodeNotes[0]).toEqual(newNote);
        expect(state.loading).toBe(false);
      });

      it('should handle errors when adding episode note', async () => {
        const error = new Error('Create failed');
        (episodeNoteRepository.create as jest.Mock).mockRejectedValue(error);

        await expect(
          useEpisodeStore.getState().addEpisodeNote({
            episodeId: 'ep-123',
            timestamp: Date.now(),
            note: 'Test',
          })
        ).rejects.toThrow('Create failed');

        expect(toastService.error).toHaveBeenCalledWith('Failed to add episode note');
      });
    });

    describe('getEpisodeNoteById', () => {
      it('should return episode note from state by id', () => {
        const note: EpisodeNote = {
          id: 'en-1',
          episodeId: 'ep-123',
          timestamp: Date.now(),
          note: 'Test note',
          createdAt: Date.now(),
        };

        useEpisodeStore.setState({ episodeNotes: [note] });

        const result = useEpisodeStore.getState().getEpisodeNoteById('en-1');
        expect(result).toEqual(note);
      });

      it('should return null if note not in state', () => {
        const result = useEpisodeStore.getState().getEpisodeNoteById('nonexistent');
        expect(result).toBe(null);
      });
    });

    describe('updateEpisodeNote', () => {
      it('should update episode note successfully', async () => {
        const note: EpisodeNote = {
          id: 'en-1',
          episodeId: 'ep-123',
          timestamp: Date.now(),
          note: 'Original note',
          createdAt: Date.now(),
        };

        useEpisodeStore.setState({ episodeNotes: [note] });

        (episodeNoteRepository.update as jest.Mock).mockResolvedValue(undefined);

        await useEpisodeStore.getState().updateEpisodeNote('en-1', { note: 'Updated note' });

        const state = useEpisodeStore.getState();
        expect(state.episodeNotes[0].note).toBe('Updated note');
        expect(episodeNoteRepository.update).toHaveBeenCalledWith('en-1', { note: 'Updated note' });
      });

      it('should handle errors when updating episode note', async () => {
        const error = new Error('Update failed');
        (episodeNoteRepository.update as jest.Mock).mockRejectedValue(error);

        await expect(
          useEpisodeStore.getState().updateEpisodeNote('en-1', { note: 'Updated' })
        ).rejects.toThrow('Update failed');

        expect(toastService.error).toHaveBeenCalledWith('Failed to update episode note');
      });
    });

    describe('deleteEpisodeNote', () => {
      it('should delete episode note successfully', async () => {
        const note1: EpisodeNote = {
          id: 'en-1',
          episodeId: 'ep-123',
          timestamp: Date.now(),
          note: 'Note 1',
          createdAt: Date.now(),
        };

        const note2: EpisodeNote = {
          id: 'en-2',
          episodeId: 'ep-123',
          timestamp: Date.now(),
          note: 'Note 2',
          createdAt: Date.now(),
        };

        useEpisodeStore.setState({ episodeNotes: [note1, note2] });

        (episodeNoteRepository.delete as jest.Mock).mockResolvedValue(undefined);

        await useEpisodeStore.getState().deleteEpisodeNote('en-1');

        const state = useEpisodeStore.getState();
        expect(state.episodeNotes).toHaveLength(1);
        expect(state.episodeNotes[0].id).toBe('en-2');
      });

      it('should handle errors when deleting episode note', async () => {
        const error = new Error('Delete failed');
        (episodeNoteRepository.delete as jest.Mock).mockRejectedValue(error);

        await expect(
          useEpisodeStore.getState().deleteEpisodeNote('en-1')
        ).rejects.toThrow('Delete failed');

        expect(toastService.error).toHaveBeenCalledWith('Failed to delete episode note');
      });
    });
  });

  describe('Pain Location CRUD', () => {
    describe('addPainLocationLog', () => {
      it('should add pain location log successfully', async () => {
        const newLog: PainLocationLog = {
          id: 'pl-1',
          episodeId: 'ep-123',
          timestamp: Date.now(),
          painLocations: ['left_temple', 'right_temple'],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        (painLocationLogRepository.create as jest.Mock).mockResolvedValue(newLog);

        await useEpisodeStore.getState().addPainLocationLog({
          episodeId: 'ep-123',
          timestamp: newLog.timestamp,
          painLocations: ['left_temple', 'right_temple'],
          updatedAt: Date.now(),
        });

        const state = useEpisodeStore.getState();
        expect(state.painLocationLogs).toHaveLength(1);
        expect(state.painLocationLogs[0]).toEqual(newLog);
      });

      it('should handle errors when adding pain location log', async () => {
        const error = new Error('Create failed');
        (painLocationLogRepository.create as jest.Mock).mockRejectedValue(error);

        await expect(
          useEpisodeStore.getState().addPainLocationLog({
            episodeId: 'ep-123',
            timestamp: Date.now(),
            painLocations: ['left_temple'],
            updatedAt: Date.now(),
          })
        ).rejects.toThrow('Create failed');

        expect(toastService.error).toHaveBeenCalledWith('Failed to add pain location log');
      });
    });

    describe('updatePainLocationLog', () => {
      it('should update pain location log successfully', async () => {
        const log: PainLocationLog = {
          id: 'pl-1',
          episodeId: 'ep-123',
          timestamp: Date.now(),
          painLocations: ['left_temple'],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        useEpisodeStore.setState({ painLocationLogs: [log] });

        (painLocationLogRepository.update as jest.Mock).mockResolvedValue(undefined);

        await useEpisodeStore.getState().updatePainLocationLog('pl-1', {
          painLocations: ['left_temple', 'right_temple'],
        });

        const state = useEpisodeStore.getState();
        expect(state.painLocationLogs[0].painLocations).toEqual(['left_temple', 'right_temple']);
        expect(painLocationLogRepository.update).toHaveBeenCalledWith('pl-1', {
          painLocations: ['left_temple', 'right_temple'],
        });
      });

      it('should handle errors when updating pain location log', async () => {
        const error = new Error('Update failed');
        (painLocationLogRepository.update as jest.Mock).mockRejectedValue(error);

        await expect(
          useEpisodeStore.getState().updatePainLocationLog('pl-1', { painLocations: [] })
        ).rejects.toThrow('Update failed');

        expect(toastService.error).toHaveBeenCalledWith('Failed to update pain location log');
      });
    });

    describe('deletePainLocationLog', () => {
      it('should delete pain location log successfully', async () => {
        const log1: PainLocationLog = {
          id: 'pl-1',
          episodeId: 'ep-123',
          timestamp: Date.now(),
          painLocations: ['left_temple'],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const log2: PainLocationLog = {
          id: 'pl-2',
          episodeId: 'ep-123',
          timestamp: Date.now(),
          painLocations: ['right_temple'],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        useEpisodeStore.setState({ painLocationLogs: [log1, log2] });

        (painLocationLogRepository.delete as jest.Mock).mockResolvedValue(undefined);

        await useEpisodeStore.getState().deletePainLocationLog('pl-1');

        const state = useEpisodeStore.getState();
        expect(state.painLocationLogs).toHaveLength(1);
        expect(state.painLocationLogs[0].id).toBe('pl-2');
      });

      it('should handle errors when deleting pain location log', async () => {
        const error = new Error('Delete failed');
        (painLocationLogRepository.delete as jest.Mock).mockRejectedValue(error);

        await expect(
          useEpisodeStore.getState().deletePainLocationLog('pl-1')
        ).rejects.toThrow('Delete failed');

        expect(toastService.error).toHaveBeenCalledWith('Failed to delete pain location log');
      });
    });
  });
});
