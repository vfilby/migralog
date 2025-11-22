import { getDatabase, generateId } from './db';
import { DailyStatusLog } from '../models/types';
import * as SQLite from 'expo-sqlite';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { DailyStatusLogRow, EpisodeRow } from './types';
import { DailyStatusLogSchema } from '../schemas';
import { logger } from '../utils/logger';

export const dailyStatusRepository = {
  async create(log: Omit<DailyStatusLog, 'id' | 'createdAt' | 'updatedAt'>, db?: SQLite.SQLiteDatabase): Promise<DailyStatusLog> {
    const database = db || await getDatabase();
    const now = Date.now();
    const id = generateId();

    const newLog: DailyStatusLog = {
      ...log,
      id,
      createdAt: now,
      updatedAt: now,
    };

    // Validate daily status log data
    const validationResult = DailyStatusLogSchema.safeParse(newLog);
    if (!validationResult.success) {
      const errorMessage = `Invalid daily status log: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
      logger.error('[DailyStatusRepository] Validation failed:', errorMessage);
      throw new Error(errorMessage);
    }

    await database.runAsync(
      `INSERT INTO daily_status_logs (
        id, date, status, status_type, notes, prompted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newLog.id,
        newLog.date,
        newLog.status,
        newLog.statusType || null,
        newLog.notes || null,
        newLog.prompted ? 1 : 0,
        newLog.createdAt,
        newLog.updatedAt,
      ]
    );

    return newLog;
  },

  async update(id: string, updates: Partial<DailyStatusLog>, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    const now = Date.now();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.status) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.statusType !== undefined) {
      fields.push('status_type = ?');
      values.push(updates.statusType || null);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes || null);
    }
    if (updates.prompted !== undefined) {
      fields.push('prompted = ?');
      values.push(updates.prompted ? 1 : 0);
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    await database.runAsync(
      `UPDATE daily_status_logs SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  },

  async upsert(log: Omit<DailyStatusLog, 'id' | 'createdAt' | 'updatedAt'>, db?: SQLite.SQLiteDatabase): Promise<DailyStatusLog> {
    const database = db || await getDatabase();
    const existing = await this.getByDate(log.date, database);

    if (existing) {
      await this.update(existing.id, log, database);
      return {
        ...existing,
        ...log,
        updatedAt: Date.now(),
      };
    } else {
      return await this.create(log, database);
    }
  },

  async getByDate(date: string, db?: SQLite.SQLiteDatabase): Promise<DailyStatusLog | null> {
    const database = db || await getDatabase();
    const result = await database.getFirstAsync<DailyStatusLogRow>(
      'SELECT * FROM daily_status_logs WHERE date = ?',
      [date]
    );

    if (!result) return null;

    return this.mapRowToLog(result);
  },

  async getDateRange(startDate: string, endDate: string, db?: SQLite.SQLiteDatabase): Promise<DailyStatusLog[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<DailyStatusLogRow>(
      'SELECT * FROM daily_status_logs WHERE date >= ? AND date <= ? ORDER BY date ASC',
      [startDate, endDate]
    );

    return results.map(this.mapRowToLog);
  },

  async getMonthStats(year: number, month: number, db?: SQLite.SQLiteDatabase): Promise<{ green: number; yellow: number; red: number }> {
    const database = db || await getDatabase();

    // Create date range for the month (month is 0-indexed in JavaScript Date)
    const monthDate = new Date(year, month - 1, 1);
    const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd');

    // Get manual statuses from daily_status_logs
    const manualStatuses = await database.getAllAsync<DailyStatusLogRow>(
      `SELECT * FROM daily_status_logs WHERE date >= ? AND date <= ?`,
      [startDate, endDate]
    );

    // Get episodes in this date range - episodes make a day red regardless of manual status
    const startTimestamp = new Date(startDate + 'T00:00:00').getTime();
    const endTimestamp = new Date(endDate + 'T23:59:59.999').getTime();

    const episodes = await database.getAllAsync<EpisodeRow>(
      `SELECT * FROM episodes WHERE start_time <= ? AND (end_time IS NULL OR end_time >= ?)`,
      [endTimestamp, startTimestamp]
    );

    // Build a set of dates that have episodes (these are red days regardless of manual status)
    const episodeDates = new Set<string>();
    episodes.forEach(episode => {
      // Get all dates this episode spans within our range
      const episodeStart = new Date(episode.start_time);
      const episodeEnd = episode.end_time ? new Date(episode.end_time) : new Date();

      let currentDate = new Date(episodeStart);
      currentDate.setHours(0, 0, 0, 0);

      const lastDate = new Date(episodeEnd);
      lastDate.setHours(0, 0, 0, 0);

      while (currentDate <= lastDate) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        // Only count if within our month range
        if (dateStr >= startDate && dateStr <= endDate) {
          episodeDates.add(dateStr);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    // Calculate stats: episodes take precedence over manual status
    const stats = { green: 0, yellow: 0, red: 0 };

    // Count episode dates as red
    stats.red = episodeDates.size;

    // Count manual statuses, excluding dates that have episodes
    manualStatuses.forEach(row => {
      if (!episodeDates.has(row.date)) {
        if (row.status === 'green') stats.green++;
        else if (row.status === 'yellow') stats.yellow++;
        else if (row.status === 'red') stats.red++;
      }
    });

    return stats;
  },

  async delete(id: string, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    await database.runAsync('DELETE FROM daily_status_logs WHERE id = ?', [id]);
  },

  async deleteByDate(date: string, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    await database.runAsync('DELETE FROM daily_status_logs WHERE date = ?', [date]);
  },

  async deleteAll(db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    await database.runAsync('DELETE FROM daily_status_logs');
  },

  mapRowToLog(row: DailyStatusLogRow): DailyStatusLog {
    return {
      id: row.id,
      date: row.date,
      status: row.status as import('../models/types').DayStatus, // Type assertion for union type
      statusType: (row.status_type as import('../models/types').YellowDayType) || undefined, // Type assertion for union type
      notes: row.notes || undefined,
      prompted: row.prompted === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
};
