import { getDatabase, generateId } from './db';
import { Episode, IntensityReading, SymptomLog, EpisodeNote, PainLocationLog } from '../models/types';
import * as SQLite from 'expo-sqlite';
import {
  EpisodeRow,
  IntensityReadingRow,
  SymptomLogRow,
  PainLocationLogRow,
  EpisodeNoteRow,
  safeJSONParse,
  isPainLocationArray,
  isPainQualityArray,
  isSymptomArray,
  isTriggerArray,
} from './types';
import {
  EpisodeSchema,
  IntensityReadingSchema,
  IntensityValueSchema,
  SymptomLogSchema,
  EpisodeNoteSchema,
  PainLocationLogSchema,
} from '../schemas';
import { logger } from '../utils/logger';

export const episodeRepository = {
  async create(episode: Omit<Episode, 'id' | 'createdAt' | 'updatedAt'>, db?: SQLite.SQLiteDatabase): Promise<Episode> {
    const database = db || await getDatabase();
    const now = Date.now();
    const id = generateId();

    // Normalize timestamps to integers (iOS 26 beta compatibility)
    const normalizedLocation = episode.location ? {
      ...episode.location,
      timestamp: Math.floor(episode.location.timestamp),
    } : undefined;

    const newEpisode: Episode = {
      ...episode,
      location: normalizedLocation,
      id,
      createdAt: now,
      updatedAt: now,
    };

    // Validate episode data
    const validationResult = EpisodeSchema.safeParse(newEpisode);
    if (!validationResult.success) {
      const errorMessage = `Invalid episode data: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
      logger.error('[EpisodeRepository] Validation failed:', errorMessage);
      throw new Error(errorMessage);
    }

    await database.runAsync(
      `INSERT INTO episodes (
        id, start_time, end_time, locations, qualities, symptoms, triggers,
        notes, peak_intensity, average_intensity,
        latitude, longitude, location_accuracy, location_timestamp,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newEpisode.id,
        newEpisode.startTime,
        newEpisode.endTime || null,
        JSON.stringify(newEpisode.locations),
        JSON.stringify(newEpisode.qualities),
        JSON.stringify(newEpisode.symptoms),
        JSON.stringify(newEpisode.triggers),
        newEpisode.notes || null,
        newEpisode.peakIntensity || null,
        newEpisode.averageIntensity || null,
        newEpisode.location?.latitude || null,
        newEpisode.location?.longitude || null,
        newEpisode.location?.accuracy || null,
        newEpisode.location?.timestamp || null,
        newEpisode.createdAt,
        newEpisode.updatedAt,
      ]
    );

    return newEpisode;
  },

  async update(id: string, updates: Partial<Episode>, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    const now = Date.now();

    // Validate individual update fields
    if (updates.startTime !== undefined && updates.endTime !== undefined) {
      // Validate that endTime > startTime if both are being updated
      if (updates.endTime <= updates.startTime) {
        const errorMessage = 'End time must be after start time';
        logger.error('[EpisodeRepository] Validation failed:', errorMessage);
        throw new Error(errorMessage);
      }
    }

    if (updates.peakIntensity !== undefined) {
      const intensityResult = IntensityValueSchema.safeParse(updates.peakIntensity);
      if (!intensityResult.success) {
        const errorMessage = `Invalid peak intensity: ${intensityResult.error.errors.map(e => e.message).join(', ')}`;
        logger.error('[EpisodeRepository] Validation failed:', errorMessage);
        throw new Error(errorMessage);
      }
    }

    if (updates.averageIntensity !== undefined) {
      const intensityResult = IntensityValueSchema.safeParse(updates.averageIntensity);
      if (!intensityResult.success) {
        const errorMessage = `Invalid average intensity: ${intensityResult.error.errors.map(e => e.message).join(', ')}`;
        logger.error('[EpisodeRepository] Validation failed:', errorMessage);
        throw new Error(errorMessage);
      }
    }

    if (updates.notes !== undefined && updates.notes !== null && updates.notes.length > 5000) {
      const errorMessage = 'Notes must be <= 5000 characters';
      logger.error('[EpisodeRepository] Validation failed:', errorMessage);
      throw new Error(errorMessage);
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.startTime !== undefined) {
      fields.push('start_time = ?');
      values.push(updates.startTime);
    }
    if (updates.endTime !== undefined) {
      fields.push('end_time = ?');
      values.push(updates.endTime);
    }
    if (updates.locations) {
      fields.push('locations = ?');
      values.push(JSON.stringify(updates.locations));
    }
    if (updates.qualities) {
      fields.push('qualities = ?');
      values.push(JSON.stringify(updates.qualities));
    }
    if (updates.symptoms) {
      fields.push('symptoms = ?');
      values.push(JSON.stringify(updates.symptoms));
    }
    if (updates.triggers) {
      fields.push('triggers = ?');
      values.push(JSON.stringify(updates.triggers));
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }
    if (updates.peakIntensity !== undefined) {
      fields.push('peak_intensity = ?');
      values.push(updates.peakIntensity);
    }
    if (updates.averageIntensity !== undefined) {
      fields.push('average_intensity = ?');
      values.push(updates.averageIntensity);
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    await database.runAsync(
      `UPDATE episodes SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  },

  async getById(id: string, db?: SQLite.SQLiteDatabase): Promise<Episode | null> {
    const database = db || await getDatabase();
    const result = await database.getFirstAsync<EpisodeRow>(
      'SELECT * FROM episodes WHERE id = ?',
      [id]
    );

    if (!result) return null;

    return this.mapRowToEpisode(result);
  },

  async getAll(limit = 50, offset = 0, db?: SQLite.SQLiteDatabase): Promise<Episode[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<EpisodeRow>(
      'SELECT * FROM episodes ORDER BY start_time DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    return results.map(this.mapRowToEpisode);
  },

  async getByDateRange(startDate: number, endDate: number, db?: SQLite.SQLiteDatabase): Promise<Episode[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<EpisodeRow>(
      'SELECT * FROM episodes WHERE start_time >= ? AND start_time <= ? ORDER BY start_time DESC',
      [startDate, endDate]
    );

    return results.map(this.mapRowToEpisode);
  },

  async getCurrentEpisode(db?: SQLite.SQLiteDatabase): Promise<Episode | null> {
    const database = db || await getDatabase();
    const result = await database.getFirstAsync<EpisodeRow>(
      'SELECT * FROM episodes WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1'
    );

    if (!result) return null;

    return this.mapRowToEpisode(result);
  },

  async findEpisodeByTimestamp(timestamp: number, db?: SQLite.SQLiteDatabase): Promise<Episode | null> {
    const database = db || await getDatabase();
    // Find episode where timestamp falls between start_time and end_time
    // If end_time is NULL (ongoing episode), check if timestamp is after start_time
    const result = await database.getFirstAsync<EpisodeRow>(
      `SELECT * FROM episodes
       WHERE start_time <= ?
       AND (end_time IS NULL OR end_time >= ?)
       ORDER BY start_time DESC
       LIMIT 1`,
      [timestamp, timestamp]
    );

    if (!result) return null;

    return this.mapRowToEpisode(result);
  },

  async delete(id: string, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    await database.runAsync('DELETE FROM episodes WHERE id = ?', [id]);
  },

  async deleteAll(db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    await database.runAsync('DELETE FROM episodes');
    await database.runAsync('DELETE FROM intensity_readings');
    await database.runAsync('DELETE FROM symptom_logs');
  },

  mapRowToEpisode(row: EpisodeRow): Episode {
    // Build location object if GPS data exists
    let location = undefined;
    if (row.latitude != null && row.longitude != null && row.location_timestamp != null) {
      location = {
        latitude: row.latitude,
        longitude: row.longitude,
        accuracy: row.location_accuracy || undefined,
        timestamp: row.location_timestamp,
      };
    }

    return {
      id: row.id,
      startTime: row.start_time,
      endTime: row.end_time ?? undefined, // Convert null to undefined
      locations: safeJSONParse(row.locations, [], isPainLocationArray),
      qualities: safeJSONParse(row.qualities, [], isPainQualityArray),
      symptoms: safeJSONParse(row.symptoms, [], isSymptomArray),
      triggers: safeJSONParse(row.triggers, [], isTriggerArray),
      notes: row.notes || undefined,
      peakIntensity: row.peak_intensity || undefined,
      averageIntensity: row.average_intensity || undefined,
      location,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
};

export const intensityRepository = {
  async create(reading: Omit<IntensityReading, 'id' | 'createdAt'>, db?: SQLite.SQLiteDatabase): Promise<IntensityReading> {
    const database = db || await getDatabase();
    const now = Date.now();
    const id = generateId();

    const newReading: IntensityReading = {
      ...reading,
      id,
      createdAt: now,
    };

    // Validate intensity reading data
    const validationResult = IntensityReadingSchema.safeParse(newReading);
    if (!validationResult.success) {
      const errorMessage = `Invalid intensity reading: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
      logger.error('[IntensityRepository] Validation failed:', errorMessage);
      throw new Error(errorMessage);
    }

    await database.runAsync(
      'INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at) VALUES (?, ?, ?, ?, ?)',
      [newReading.id, newReading.episodeId, newReading.timestamp, newReading.intensity, newReading.createdAt]
    );

    return newReading;
  },

  async update(id: string, updates: Partial<Pick<IntensityReading, 'intensity' | 'timestamp'>>, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();

    const fields: string[] = [];
    const values: (number | string)[] = [];

    if (updates.intensity !== undefined) {
      // Validate intensity value
      const intensityResult = IntensityValueSchema.safeParse(updates.intensity);
      if (!intensityResult.success) {
        const errorMessage = `Invalid intensity: ${intensityResult.error.errors.map(e => e.message).join(', ')}`;
        logger.error('[IntensityRepository] Validation failed:', errorMessage);
        throw new Error(errorMessage);
      }
      fields.push('intensity = ?');
      values.push(updates.intensity);
    }
    if (updates.timestamp !== undefined) {
      fields.push('timestamp = ?');
      values.push(updates.timestamp);
    }

    if (fields.length === 0) return;

    values.push(id);

    await database.runAsync(
      `UPDATE intensity_readings SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  },

  async updateTimestamp(id: string, timestamp: number, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    await database.runAsync(
      'UPDATE intensity_readings SET timestamp = ? WHERE id = ?',
      [timestamp, id]
    );
  },

  async updateTimestampsForEpisode(episodeId: string, oldTimestamp: number, newTimestamp: number, db?: SQLite.SQLiteDatabase): Promise<number> {
    const database = db || await getDatabase();
    const result = await database.runAsync(
      'UPDATE intensity_readings SET timestamp = ? WHERE episode_id = ? AND timestamp = ?',
      [newTimestamp, episodeId, oldTimestamp]
    );
    return result.changes;
  },

  async getByEpisodeId(episodeId: string, db?: SQLite.SQLiteDatabase): Promise<IntensityReading[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<IntensityReadingRow>(
      'SELECT * FROM intensity_readings WHERE episode_id = ? ORDER BY timestamp ASC',
      [episodeId]
    );

    return results.map(row => ({
      id: row.id,
      episodeId: row.episode_id,
      timestamp: row.timestamp,
      intensity: row.intensity,
      createdAt: row.created_at,
    }));
  },
};

export const symptomLogRepository = {
  async create(log: Omit<SymptomLog, 'id' | 'createdAt'>, db?: SQLite.SQLiteDatabase): Promise<SymptomLog> {
    const database = db || await getDatabase();
    const now = Date.now();
    const id = generateId();

    const newLog: SymptomLog = {
      ...log,
      id,
      createdAt: now,
    };

    // Validate symptom log data
    const validationResult = SymptomLogSchema.safeParse(newLog);
    if (!validationResult.success) {
      const errorMessage = `Invalid symptom log: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
      logger.error('[SymptomLogRepository] Validation failed:', errorMessage);
      throw new Error(errorMessage);
    }

    await database.runAsync(
      'INSERT INTO symptom_logs (id, episode_id, symptom, onset_time, resolution_time, severity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [newLog.id, newLog.episodeId, newLog.symptom, newLog.onsetTime, newLog.resolutionTime || null, newLog.severity || null, newLog.createdAt]
    );

    return newLog;
  },

  async update(id: string, updates: Partial<Pick<SymptomLog, 'onsetTime' | 'resolutionTime' | 'severity'>>, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();

    const fields: string[] = [];
    const values: (number | string | null)[] = [];

    if (updates.onsetTime !== undefined) {
      fields.push('onset_time = ?');
      values.push(updates.onsetTime);
    }
    if (updates.resolutionTime !== undefined) {
      fields.push('resolution_time = ?');
      values.push(updates.resolutionTime);
    }
    if (updates.severity !== undefined) {
      fields.push('severity = ?');
      values.push(updates.severity);
    }

    if (fields.length === 0) return;

    values.push(id);

    await database.runAsync(
      `UPDATE symptom_logs SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  },

  async getByEpisodeId(episodeId: string, db?: SQLite.SQLiteDatabase): Promise<SymptomLog[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<SymptomLogRow>(
      'SELECT * FROM symptom_logs WHERE episode_id = ? ORDER BY onset_time ASC',
      [episodeId]
    );

    return results.map(row => ({
      id: row.id,
      episodeId: row.episode_id,
      symptom: row.symptom as import('../models/types').Symptom, // Type assertion for union type
      onsetTime: row.onset_time,
      resolutionTime: row.resolution_time || undefined,
      severity: row.severity || undefined,
      createdAt: row.created_at,
    }));
  },
};

export const painLocationLogRepository = {
  async create(log: Omit<PainLocationLog, 'id' | 'createdAt'>, db?: SQLite.SQLiteDatabase): Promise<PainLocationLog> {
    const database = db || await getDatabase();
    const now = Date.now();
    const id = generateId();

    const newLog: PainLocationLog = {
      ...log,
      id,
      createdAt: now,
    };

    // Validate pain location log data
    const validationResult = PainLocationLogSchema.safeParse(newLog);
    if (!validationResult.success) {
      const errorMessage = `Invalid pain location log: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
      logger.error('[PainLocationLogRepository] Validation failed:', errorMessage);
      throw new Error(errorMessage);
    }

    await database.runAsync(
      'INSERT INTO pain_location_logs (id, episode_id, timestamp, pain_locations, created_at) VALUES (?, ?, ?, ?, ?)',
      [newLog.id, newLog.episodeId, newLog.timestamp, JSON.stringify(newLog.painLocations), newLog.createdAt]
    );

    return newLog;
  },

  async update(id: string, updates: Partial<Pick<PainLocationLog, 'timestamp' | 'painLocations'>>, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();

    const fields: string[] = [];
    const values: (string | number)[] = [];

    if (updates.timestamp !== undefined) {
      fields.push('timestamp = ?');
      values.push(updates.timestamp);
    }
    if (updates.painLocations !== undefined) {
      fields.push('pain_locations = ?');
      values.push(JSON.stringify(updates.painLocations));
    }

    if (fields.length === 0) return;

    values.push(id);

    await database.runAsync(
      `UPDATE pain_location_logs SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  },

  async getByEpisodeId(episodeId: string, db?: SQLite.SQLiteDatabase): Promise<PainLocationLog[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<PainLocationLogRow>(
      'SELECT * FROM pain_location_logs WHERE episode_id = ? ORDER BY timestamp ASC',
      [episodeId]
    );

    return results.map(row => ({
      id: row.id,
      episodeId: row.episode_id,
      timestamp: row.timestamp,
      painLocations: safeJSONParse(row.pain_locations, [], isPainLocationArray),
      createdAt: row.created_at,
    }));
  },

  async delete(id: string, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    await database.runAsync('DELETE FROM pain_location_logs WHERE id = ?', [id]);
  },

  async deleteAll(db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    await database.runAsync('DELETE FROM pain_location_logs');
  },
};

export const episodeNoteRepository = {
  async create(note: Omit<EpisodeNote, 'id' | 'createdAt'>, db?: SQLite.SQLiteDatabase): Promise<EpisodeNote> {
    const database = db || await getDatabase();
    const now = Date.now();
    const id = generateId();

    const newNote: EpisodeNote = {
      ...note,
      id,
      createdAt: now,
    };

    // Validate episode note data
    const validationResult = EpisodeNoteSchema.safeParse(newNote);
    if (!validationResult.success) {
      const errorMessage = `Invalid episode note: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
      logger.error('[EpisodeNoteRepository] Validation failed:', errorMessage);
      throw new Error(errorMessage);
    }

    await database.runAsync(
      'INSERT INTO episode_notes (id, episode_id, timestamp, note, created_at) VALUES (?, ?, ?, ?, ?)',
      [newNote.id, newNote.episodeId, newNote.timestamp, newNote.note, newNote.createdAt]
    );

    return newNote;
  },

  async update(id: string, updates: Partial<Pick<EpisodeNote, 'timestamp' | 'note'>>, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();

    const fields: string[] = [];
    const values: (string | number)[] = [];

    if (updates.timestamp !== undefined) {
      fields.push('timestamp = ?');
      values.push(updates.timestamp);
    }
    if (updates.note !== undefined) {
      fields.push('note = ?');
      values.push(updates.note);
    }

    if (fields.length === 0) return;

    values.push(id);

    await database.runAsync(
      `UPDATE episode_notes SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  },

  async delete(id: string, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    await database.runAsync('DELETE FROM episode_notes WHERE id = ?', [id]);
  },

  async deleteAll(db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    await database.runAsync('DELETE FROM episode_notes');
  },

  async updateTimestampsForEpisode(episodeId: string, oldTimestamp: number, newTimestamp: number, db?: SQLite.SQLiteDatabase): Promise<number> {
    const database = db || await getDatabase();
    const result = await database.runAsync(
      'UPDATE episode_notes SET timestamp = ? WHERE episode_id = ? AND timestamp = ?',
      [newTimestamp, episodeId, oldTimestamp]
    );
    return result.changes;
  },

  async getByEpisodeId(episodeId: string, db?: SQLite.SQLiteDatabase): Promise<EpisodeNote[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<EpisodeNoteRow>(
      'SELECT * FROM episode_notes WHERE episode_id = ? ORDER BY timestamp ASC',
      [episodeId]
    );

    return results.map(row => ({
      id: row.id,
      episodeId: row.episode_id,
      timestamp: row.timestamp,
      note: row.note,
      createdAt: row.created_at,
    }));
  },
};
