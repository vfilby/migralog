import { episodeRepository, intensityRepository, symptomLogRepository, episodeNoteRepository } from '../episodeRepository';
import { Episode, IntensityReading, SymptomLog, EpisodeNote } from '../../models/types';
import * as db from '../db';

// Mock the database module
jest.mock('../db');

describe('episodeRepository', () => {
  let mockDatabase: any;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Create a mock database instance
    mockDatabase = {
      runAsync: jest.fn().mockResolvedValue(undefined),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      getAllAsync: jest.fn().mockResolvedValue([]),
    };

    // Mock getDatabase to return our mock database
    (db.getDatabase as jest.Mock).mockResolvedValue(mockDatabase);

    // Mock generateId to return predictable IDs
    (db.generateId as jest.Mock).mockReturnValue('test-id-123');
  });

  describe('create', () => {
    it('should create a new episode with all fields', async () => {
      const newEpisode: Omit<Episode, 'id' | 'createdAt' | 'updatedAt'> = {
        startTime: Date.now(),
        endTime: undefined,
        locations: ['left_head', 'right_temple'],
        qualities: ['throbbing'],
        symptoms: ['nausea'],
        triggers: ['stress'],
        notes: 'Test episode',
        peakIntensity: 8,
        averageIntensity: 6,
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          timestamp: Date.now(),
        },
      };

      const result = await episodeRepository.create(newEpisode);

      expect(result.id).toBe('test-id-123');
      expect(result.startTime).toBe(newEpisode.startTime);
      expect(result.locations).toEqual(newEpisode.locations);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(mockDatabase.runAsync).toHaveBeenCalledTimes(1);
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO episodes'),
        expect.arrayContaining([
          'test-id-123',
          newEpisode.startTime,
          null,
          JSON.stringify(newEpisode.locations),
          JSON.stringify(newEpisode.qualities),
          JSON.stringify(newEpisode.symptoms),
          JSON.stringify(newEpisode.triggers),
          newEpisode.notes,
          newEpisode.peakIntensity,
          newEpisode.averageIntensity,
          newEpisode.location?.latitude,
          newEpisode.location?.longitude,
          newEpisode.location?.accuracy,
          newEpisode.location?.timestamp,
        ])
      );
    });

    it('should handle minimal episode data', async () => {
      const minimalEpisode: Omit<Episode, 'id' | 'createdAt' | 'updatedAt'> = {
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

      const result = await episodeRepository.create(minimalEpisode);

      expect(result.id).toBe('test-id-123');
      expect(result.locations).toEqual([]);
      expect(result.notes).toBeUndefined();
      expect(mockDatabase.runAsync).toHaveBeenCalledTimes(1);
    });

    it('should accept custom database instance', async () => {
      const customDb = { runAsync: jest.fn().mockResolvedValue(undefined) };
      const episode: Omit<Episode, 'id' | 'createdAt' | 'updatedAt'> = {
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

      await episodeRepository.create(episode, customDb as any);

      expect(customDb.runAsync).toHaveBeenCalledTimes(1);
      expect(mockDatabase.runAsync).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update episode end_time', async () => {
      const endTime = Date.now();

      await episodeRepository.update('episode-123', { endTime });

      expect(mockDatabase.runAsync).toHaveBeenCalledTimes(1);
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE episodes SET'),
        expect.arrayContaining([endTime, 'episode-123'])
      );
    });

    it('should update multiple fields', async () => {
      const updates = {
        endTime: Date.now(),
        notes: 'Updated notes',
        peakIntensity: 9,
        averageIntensity: 7,
        locations: ['left_head', 'left_neck'],
        qualities: ['throbbing', 'sharp'],
        symptoms: ['nausea', 'light_sensitivity'],
        triggers: ['lack_of_sleep'],
      } as any;

      await episodeRepository.update('episode-123', updates);

      expect(mockDatabase.runAsync).toHaveBeenCalledTimes(1);
      const call = mockDatabase.runAsync.mock.calls[0];
      expect(call[0]).toContain('UPDATE episodes SET');
      expect(call[0]).toContain('end_time = ?');
      expect(call[0]).toContain('notes = ?');
      expect(call[0]).toContain('peak_intensity = ?');
      expect(call[0]).toContain('average_intensity = ?');
      expect(call[0]).toContain('updated_at = ?');
      expect(call[1]).toContain('episode-123');
    });

    it('should only update specified fields', async () => {
      await episodeRepository.update('episode-123', { notes: 'Only notes' });

      const call = mockDatabase.runAsync.mock.calls[0];
      expect(call[0]).toContain('notes = ?');
      expect(call[0]).toContain('updated_at = ?');
      expect(call[0]).not.toContain('end_time = ?');
    });
  });

  describe('getById', () => {
    it('should return episode when found', async () => {
      const mockRow = {
        id: 'episode-123',
        start_time: Date.now(),
        end_time: undefined,
        locations: JSON.stringify(['left_head']),
        qualities: JSON.stringify(['throbbing']),
        symptoms: JSON.stringify(['nausea']),
        triggers: JSON.stringify(['stress']),
        notes: 'Test notes',
        peak_intensity: 8,
        average_intensity: 6,
        latitude: 37.7749,
        longitude: -122.4194,
        location_accuracy: 5,
        location_timestamp: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDatabase.getFirstAsync.mockResolvedValueOnce(mockRow);

      const result = await episodeRepository.getById('episode-123');

      expect(result).not.toBeUndefined();
      expect(result?.id).toBe('episode-123');
      expect(result?.locations).toEqual(['left_head']);
      expect(result?.location).toBeDefined();
      expect(result?.location?.latitude).toBe(37.7749);
      expect(mockDatabase.getFirstAsync).toHaveBeenCalledWith(
        'SELECT * FROM episodes WHERE id = ?',
        ['episode-123']
      );
    });

    it('should return null when episode not found', async () => {
      mockDatabase.getFirstAsync.mockResolvedValueOnce(null);

      const result = await episodeRepository.getById('nonexistent');

      expect(result).toBe(null);
    });

    it('should handle episode without GPS location', async () => {
      const mockRow = {
        id: 'episode-123',
        start_time: Date.now(),
        end_time: undefined,
        locations: JSON.stringify([]),
        qualities: JSON.stringify([]),
        symptoms: JSON.stringify([]),
        triggers: JSON.stringify([]),
        notes: undefined,
        peak_intensity: undefined,
        average_intensity: undefined,
        latitude: undefined,
        longitude: undefined,
        location_accuracy: undefined,
        location_timestamp: undefined,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDatabase.getFirstAsync.mockResolvedValueOnce(mockRow);

      const result = await episodeRepository.getById('episode-123');

      expect(result?.location).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all episodes with default pagination', async () => {
      const mockRows = [
        {
          id: 'episode-1',
          start_time: Date.now(),
          end_time: undefined,
          locations: JSON.stringify([]),
          qualities: JSON.stringify([]),
          symptoms: JSON.stringify([]),
          triggers: JSON.stringify([]),
          notes: undefined,
          peak_intensity: undefined,
          average_intensity: undefined,
          latitude: undefined,
          longitude: undefined,
          location_accuracy: undefined,
          location_timestamp: undefined,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ];

      mockDatabase.getAllAsync.mockResolvedValueOnce(mockRows);

      const result = await episodeRepository.getAll();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('episode-1');
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM episodes ORDER BY start_time DESC LIMIT ? OFFSET ?',
        [50, 0]
      );
    });

    it('should support custom pagination', async () => {
      mockDatabase.getAllAsync.mockResolvedValueOnce([]);

      await episodeRepository.getAll(10, 20);

      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.any(String),
        [10, 20]
      );
    });

    it('should return empty array when no episodes', async () => {
      mockDatabase.getAllAsync.mockResolvedValueOnce([]);

      const result = await episodeRepository.getAll();

      expect(result).toEqual([]);
    });
  });

  describe('getByDateRange', () => {
    it('should return episodes within date range', async () => {
      const startDate = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago
      const endDate = Date.now();

      mockDatabase.getAllAsync.mockResolvedValueOnce([]);

      await episodeRepository.getByDateRange(startDate, endDate);

      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM episodes WHERE start_time >= ? AND start_time <= ? ORDER BY start_time DESC',
        [startDate, endDate]
      );
    });
  });

  describe('getCurrentEpisode', () => {
    it('should return ongoing episode', async () => {
      const mockRow = {
        id: 'current-episode',
        start_time: Date.now(),
        end_time: undefined,
        locations: JSON.stringify([]),
        qualities: JSON.stringify([]),
        symptoms: JSON.stringify([]),
        triggers: JSON.stringify([]),
        notes: undefined,
        peak_intensity: undefined,
        average_intensity: undefined,
        latitude: undefined,
        longitude: undefined,
        location_accuracy: undefined,
        location_timestamp: undefined,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDatabase.getFirstAsync.mockResolvedValueOnce(mockRow);

      const result = await episodeRepository.getCurrentEpisode();

      expect(result).not.toBeUndefined();
      expect(result?.id).toBe('current-episode');
      expect(result?.endTime).toBeUndefined();
      expect(mockDatabase.getFirstAsync).toHaveBeenCalledWith(
        'SELECT * FROM episodes WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1'
      );
    });

    it('should return null when no ongoing episode', async () => {
      mockDatabase.getFirstAsync.mockResolvedValueOnce(null);

      const result = await episodeRepository.getCurrentEpisode();

      expect(result).toBe(null);
    });
  });

  describe('delete', () => {
    it('should delete episode by id', async () => {
      await episodeRepository.delete('episode-123');

      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'DELETE FROM episodes WHERE id = ?',
        ['episode-123']
      );
    });
  });

  describe('deleteAll', () => {
    it('should delete all episodes and related data', async () => {
      await episodeRepository.deleteAll();

      expect(mockDatabase.runAsync).toHaveBeenCalledTimes(3);
      expect(mockDatabase.runAsync).toHaveBeenCalledWith('DELETE FROM episodes');
      expect(mockDatabase.runAsync).toHaveBeenCalledWith('DELETE FROM intensity_readings');
      expect(mockDatabase.runAsync).toHaveBeenCalledWith('DELETE FROM symptom_logs');
    });
  });

  describe('mapRowToEpisode', () => {
    it('should correctly map database row to Episode object', () => {
      const row = {
        id: 'episode-123',
        start_time: 1000,
        end_time: 2000,
        locations: JSON.stringify(['left_head']),
        qualities: JSON.stringify(['throbbing']),
        symptoms: JSON.stringify(['nausea']),
        triggers: JSON.stringify(['stress']),
        notes: 'Test',
        peak_intensity: 8,
        average_intensity: 6,
        latitude: 37.7749,
        longitude: -122.4194,
        location_accuracy: 5,
        location_timestamp: 1500,
        created_at: 900,
        updated_at: 1100,
      };

      const episode = episodeRepository.mapRowToEpisode(row);

      expect(episode.id).toBe('episode-123');
      expect(episode.startTime).toBe(1000);
      expect(episode.endTime).toBe(2000);
      expect(episode.locations).toEqual(['left_head']);
      expect(episode.qualities).toEqual(['throbbing']);
      expect(episode.symptoms).toEqual(['nausea']);
      expect(episode.triggers).toEqual(['stress']);
      expect(episode.notes).toBe('Test');
      expect(episode.peakIntensity).toBe(8);
      expect(episode.averageIntensity).toBe(6);
      expect(episode.location).toEqual({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        timestamp: 1500,
      });
      expect(episode.createdAt).toBe(900);
      expect(episode.updatedAt).toBe(1100);
    });

    it('should handle null location correctly', () => {
      const row = {
        id: 'episode-123',
        start_time: 1000,
        end_time: undefined,
        locations: JSON.stringify([]),
        qualities: JSON.stringify([]),
        symptoms: JSON.stringify([]),
        triggers: JSON.stringify([]),
        notes: undefined,
        peak_intensity: undefined,
        average_intensity: undefined,
        latitude: undefined,
        longitude: undefined,
        location_accuracy: undefined,
        location_timestamp: undefined,
        created_at: 900,
        updated_at: 900,
      };

      const episode = episodeRepository.mapRowToEpisode(row);

      expect(episode.location).toBeUndefined();
    });
  });
});

describe('intensityRepository', () => {
  let mockDatabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDatabase = {
      runAsync: jest.fn().mockResolvedValue(undefined),
      getAllAsync: jest.fn().mockResolvedValue([]),
    };

    (db.getDatabase as jest.Mock).mockResolvedValue(mockDatabase);
    (db.generateId as jest.Mock).mockReturnValue('reading-id-123');
  });

  describe('create', () => {
    it('should create a new intensity reading', async () => {
      const reading: Omit<IntensityReading, 'id' | 'createdAt'> = {
        episodeId: 'episode-123',
        timestamp: Date.now(),
        intensity: 7,
      };

      const result = await intensityRepository.create(reading);

      expect(result.id).toBe('reading-id-123');
      expect(result.intensity).toBe(7);
      expect(result.createdAt).toBeDefined();
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at) VALUES (?, ?, ?, ?, ?)',
        expect.arrayContaining([
          'reading-id-123',
          'episode-123',
          reading.timestamp,
          7,
        ])
      );
    });
  });

  describe('update', () => {
    it('should update intensity value', async () => {
      await intensityRepository.update('reading-123', 8);

      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'UPDATE intensity_readings SET intensity = ? WHERE id = ?',
        [8, 'reading-123']
      );
    });
  });

  describe('getByEpisodeId', () => {
    it('should return intensity readings for episode', async () => {
      const mockRows = [
        {
          id: 'reading-1',
          episode_id: 'episode-123',
          timestamp: 1000,
          intensity: 5,
          created_at: 900,
        },
        {
          id: 'reading-2',
          episode_id: 'episode-123',
          timestamp: 2000,
          intensity: 7,
          created_at: 1900,
        },
      ];

      mockDatabase.getAllAsync.mockResolvedValueOnce(mockRows);

      const result = await intensityRepository.getByEpisodeId('episode-123');

      expect(result).toHaveLength(2);
      expect(result[0].intensity).toBe(5);
      expect(result[1].intensity).toBe(7);
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM intensity_readings WHERE episode_id = ? ORDER BY timestamp ASC',
        ['episode-123']
      );
    });

    it('should return empty array when no readings', async () => {
      mockDatabase.getAllAsync.mockResolvedValueOnce([]);

      const result = await intensityRepository.getByEpisodeId('episode-123');

      expect(result).toEqual([]);
    });
  });
});

describe('symptomLogRepository', () => {
  let mockDatabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDatabase = {
      runAsync: jest.fn().mockResolvedValue(undefined),
      getAllAsync: jest.fn().mockResolvedValue([]),
    };

    (db.getDatabase as jest.Mock).mockResolvedValue(mockDatabase);
    (db.generateId as jest.Mock).mockReturnValue('symptom-id-123');
  });

  describe('create', () => {
    it('should create a new symptom log', async () => {
      const log: Omit<SymptomLog, 'id' | 'createdAt'> = {
        episodeId: 'episode-123',
        symptom: 'nausea',
        onsetTime: Date.now(),
        resolutionTime: undefined,
        severity: 7,
      };

      const result = await symptomLogRepository.create(log);

      expect(result.id).toBe('symptom-id-123');
      expect(result.symptom).toBe('nausea');
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'INSERT INTO symptom_logs (id, episode_id, symptom, onset_time, resolution_time, severity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        expect.arrayContaining(['symptom-id-123', 'episode-123', 'nausea'])
      );
    });
  });

  describe('update', () => {
    it('should update resolution time', async () => {
      const resolutionTime = Date.now();

      await symptomLogRepository.update('symptom-123', { resolutionTime });

      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'UPDATE symptom_logs SET resolution_time = ? WHERE id = ?',
        [resolutionTime, 'symptom-123']
      );
    });

    it('should update severity', async () => {
      await symptomLogRepository.update('symptom-123', { severity: 8 });

      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'UPDATE symptom_logs SET severity = ? WHERE id = ?',
        [8, 'symptom-123']
      );
    });

    it('should handle multiple updates', async () => {
      await symptomLogRepository.update('symptom-123', {
        resolutionTime: Date.now(),
        severity: 9,
      });

      expect(mockDatabase.runAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('getByEpisodeId', () => {
    it('should return symptom logs for episode', async () => {
      const mockRows = [
        {
          id: 'symptom-1',
          episode_id: 'episode-123',
          symptom: 'nausea',
          onset_time: 1000,
          resolution_time: 2000,
          severity: 7,
          created_at: 900,
        },
      ];

      mockDatabase.getAllAsync.mockResolvedValueOnce(mockRows);

      const result = await symptomLogRepository.getByEpisodeId('episode-123');

      expect(result).toHaveLength(1);
      expect(result[0].symptom).toBe('nausea');
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM symptom_logs WHERE episode_id = ? ORDER BY onset_time ASC',
        ['episode-123']
      );
    });
  });
});

describe('episodeNoteRepository', () => {
  let mockDatabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDatabase = {
      runAsync: jest.fn().mockResolvedValue(undefined),
      getAllAsync: jest.fn().mockResolvedValue([]),
    };

    (db.getDatabase as jest.Mock).mockResolvedValue(mockDatabase);
    (db.generateId as jest.Mock).mockReturnValue('note-id-123');
  });

  describe('create', () => {
    it('should create a new episode note', async () => {
      const note: Omit<EpisodeNote, 'id' | 'createdAt'> = {
        episodeId: 'episode-123',
        timestamp: Date.now(),
        note: 'Feeling better after medication',
      };

      const result = await episodeNoteRepository.create(note);

      expect(result.id).toBe('note-id-123');
      expect(result.note).toBe('Feeling better after medication');
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'INSERT INTO episode_notes (id, episode_id, timestamp, note, created_at) VALUES (?, ?, ?, ?, ?)',
        expect.arrayContaining(['note-id-123', 'episode-123', note.note])
      );
    });
  });

  describe('delete', () => {
    it('should delete a note by id', async () => {
      await episodeNoteRepository.delete('note-123');

      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'DELETE FROM episode_notes WHERE id = ?',
        ['note-123']
      );
    });
  });

  describe('deleteAll', () => {
    it('should delete all notes', async () => {
      await episodeNoteRepository.deleteAll();

      expect(mockDatabase.runAsync).toHaveBeenCalledWith('DELETE FROM episode_notes');
    });
  });

  describe('getByEpisodeId', () => {
    it('should return notes for episode', async () => {
      const mockRows = [
        {
          id: 'note-1',
          episode_id: 'episode-123',
          timestamp: 1000,
          note: 'Test note',
          created_at: 900,
        },
      ];

      mockDatabase.getAllAsync.mockResolvedValueOnce(mockRows);

      const result = await episodeNoteRepository.getByEpisodeId('episode-123');

      expect(result).toHaveLength(1);
      expect(result[0].note).toBe('Test note');
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM episode_notes WHERE episode_id = ? ORDER BY timestamp ASC',
        ['episode-123']
      );
    });

    it('should return empty array when no notes', async () => {
      mockDatabase.getAllAsync.mockResolvedValueOnce([]);

      const result = await episodeNoteRepository.getByEpisodeId('episode-123');

      expect(result).toEqual([]);
    });
  });
});
