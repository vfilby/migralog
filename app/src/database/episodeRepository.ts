import { getDatabase, generateId } from './db';
import { Episode, IntensityReading, SymptomLog, EpisodeNote } from '../models/types';
import * as SQLite from 'expo-sqlite';

export const episodeRepository = {
  async create(episode: Omit<Episode, 'id' | 'createdAt' | 'updatedAt'>, db?: SQLite.SQLiteDatabase): Promise<Episode> {
    const database = db || await getDatabase();
    const now = Date.now();
    const id = generateId();

    const newEpisode: Episode = {
      ...episode,
      id,
      createdAt: now,
      updatedAt: now,
    };

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

    const fields: string[] = [];
    const values: any[] = [];

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
    const result = await database.getFirstAsync<any>(
      'SELECT * FROM episodes WHERE id = ?',
      [id]
    );

    if (!result) return null;

    return this.mapRowToEpisode(result);
  },

  async getAll(limit = 50, offset = 0, db?: SQLite.SQLiteDatabase): Promise<Episode[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<any>(
      'SELECT * FROM episodes ORDER BY start_time DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    return results.map(this.mapRowToEpisode);
  },

  async getByDateRange(startDate: number, endDate: number, db?: SQLite.SQLiteDatabase): Promise<Episode[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<any>(
      'SELECT * FROM episodes WHERE start_time >= ? AND start_time <= ? ORDER BY start_time DESC',
      [startDate, endDate]
    );

    return results.map(this.mapRowToEpisode);
  },

  async getCurrentEpisode(db?: SQLite.SQLiteDatabase): Promise<Episode | null> {
    const database = db || await getDatabase();
    const result = await database.getFirstAsync<any>(
      'SELECT * FROM episodes WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1'
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

  mapRowToEpisode(row: any): Episode {
    // Build location object if GPS data exists
    let location = undefined;
    if (row.latitude !== null && row.longitude !== null) {
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
      endTime: row.end_time,
      locations: JSON.parse(row.locations),
      qualities: JSON.parse(row.qualities),
      symptoms: JSON.parse(row.symptoms),
      triggers: JSON.parse(row.triggers),
      notes: row.notes,
      peakIntensity: row.peak_intensity,
      averageIntensity: row.average_intensity,
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

    await database.runAsync(
      'INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at) VALUES (?, ?, ?, ?, ?)',
      [newReading.id, newReading.episodeId, newReading.timestamp, newReading.intensity, newReading.createdAt]
    );

    return newReading;
  },

  async update(id: string, intensity: number, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    await database.runAsync(
      'UPDATE intensity_readings SET intensity = ? WHERE id = ?',
      [intensity, id]
    );
  },

  async getByEpisodeId(episodeId: string, db?: SQLite.SQLiteDatabase): Promise<IntensityReading[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<any>(
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

    await database.runAsync(
      'INSERT INTO symptom_logs (id, episode_id, symptom, onset_time, resolution_time, severity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [newLog.id, newLog.episodeId, newLog.symptom, newLog.onsetTime, newLog.resolutionTime || null, newLog.severity || null, newLog.createdAt]
    );

    return newLog;
  },

  async update(id: string, updates: Partial<SymptomLog>, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();

    if (updates.resolutionTime !== undefined) {
      await database.runAsync(
        'UPDATE symptom_logs SET resolution_time = ? WHERE id = ?',
        [updates.resolutionTime, id]
      );
    }
    if (updates.severity !== undefined) {
      await database.runAsync(
        'UPDATE symptom_logs SET severity = ? WHERE id = ?',
        [updates.severity, id]
      );
    }
  },

  async getByEpisodeId(episodeId: string, db?: SQLite.SQLiteDatabase): Promise<SymptomLog[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<any>(
      'SELECT * FROM symptom_logs WHERE episode_id = ? ORDER BY onset_time ASC',
      [episodeId]
    );

    return results.map(row => ({
      id: row.id,
      episodeId: row.episode_id,
      symptom: row.symptom,
      onsetTime: row.onset_time,
      resolutionTime: row.resolution_time,
      severity: row.severity,
      createdAt: row.created_at,
    }));
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

    await database.runAsync(
      'INSERT INTO episode_notes (id, episode_id, timestamp, note, created_at) VALUES (?, ?, ?, ?, ?)',
      [newNote.id, newNote.episodeId, newNote.timestamp, newNote.note, newNote.createdAt]
    );

    return newNote;
  },

  async delete(id: string, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    await database.runAsync('DELETE FROM episode_notes WHERE id = ?', [id]);
  },

  async deleteAll(db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    await database.runAsync('DELETE FROM episode_notes');
  },

  async getByEpisodeId(episodeId: string, db?: SQLite.SQLiteDatabase): Promise<EpisodeNote[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<any>(
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
