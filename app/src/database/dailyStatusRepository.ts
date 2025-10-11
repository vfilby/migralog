import { getDatabase, generateId } from './db';
import { DailyStatusLog } from '../models/types';
import * as SQLite from 'expo-sqlite';
import { format, startOfMonth, endOfMonth } from 'date-fns';

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
    const values: any[] = [];

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
    const result = await database.getFirstAsync<any>(
      'SELECT * FROM daily_status_logs WHERE date = ?',
      [date]
    );

    if (!result) return null;

    return this.mapRowToLog(result);
  },

  async getDateRange(startDate: string, endDate: string, db?: SQLite.SQLiteDatabase): Promise<DailyStatusLog[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<any>(
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

    const results = await database.getAllAsync<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count
       FROM daily_status_logs
       WHERE date >= ? AND date <= ?
       GROUP BY status`,
      [startDate, endDate]
    );

    const stats = { green: 0, yellow: 0, red: 0 };
    results.forEach(row => {
      if (row.status === 'green') stats.green = row.count;
      else if (row.status === 'yellow') stats.yellow = row.count;
      else if (row.status === 'red') stats.red = row.count;
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

  mapRowToLog(row: any): DailyStatusLog {
    return {
      id: row.id,
      date: row.date,
      status: row.status,
      statusType: row.status_type || undefined,
      notes: row.notes || undefined,
      prompted: row.prompted === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
};
