import { getDatabase, generateId } from './db';
import { CalendarOverlay } from '../models/types';
import * as SQLite from 'expo-sqlite';
import { CalendarOverlayRow } from './types';
import { CalendarOverlaySchema } from '../schemas';
import { logger } from '../utils/logger';

export const overlayRepository = {
  async create(overlay: Omit<CalendarOverlay, 'id' | 'createdAt' | 'updatedAt'>, db?: SQLite.SQLiteDatabase): Promise<CalendarOverlay> {
    const database = db || await getDatabase();
    const now = Date.now();
    const id = generateId();

    const newOverlay: CalendarOverlay = {
      ...overlay,
      id,
      createdAt: now,
      updatedAt: now,
    };

    // Validate calendar overlay data
    const validationResult = CalendarOverlaySchema.safeParse(newOverlay);
    if (!validationResult.success) {
      const errorMessage = `Invalid calendar overlay: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
      logger.error('[OverlayRepository] Validation failed:', errorMessage);
      throw new Error(errorMessage);
    }

    await database.runAsync(
      `INSERT INTO calendar_overlays (
        id, start_date, end_date, label, notes, exclude_from_stats, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newOverlay.id,
        newOverlay.startDate,
        newOverlay.endDate,
        newOverlay.label,
        newOverlay.notes || null,
        newOverlay.excludeFromStats ? 1 : 0,
        newOverlay.createdAt,
        newOverlay.updatedAt,
      ]
    );

    return newOverlay;
  },

  async update(id: string, updates: Partial<CalendarOverlay>, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    const now = Date.now();

    // Dynamic SQL construction is safe here because:
    // - Field names are controlled by code (hardcoded strings), not user input
    // - All user-provided values are passed as parameterized query values
    // - No risk of SQL injection since field names cannot be influenced by external input
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.startDate !== undefined) {
      fields.push('start_date = ?');
      values.push(updates.startDate);
    }
    if (updates.endDate !== undefined) {
      fields.push('end_date = ?');
      values.push(updates.endDate);
    }
    if (updates.label !== undefined) {
      fields.push('label = ?');
      values.push(updates.label);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes || null);
    }
    if (updates.excludeFromStats !== undefined) {
      fields.push('exclude_from_stats = ?');
      values.push(updates.excludeFromStats ? 1 : 0);
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    await database.runAsync(
      `UPDATE calendar_overlays SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  },

  async delete(id: string, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    await database.runAsync('DELETE FROM calendar_overlays WHERE id = ?', [id]);
  },

  async getById(id: string, db?: SQLite.SQLiteDatabase): Promise<CalendarOverlay | null> {
    const database = db || await getDatabase();
    const result = await database.getFirstAsync<CalendarOverlayRow>(
      'SELECT * FROM calendar_overlays WHERE id = ?',
      [id]
    );

    if (!result) return null;

    return this.mapRowToOverlay(result);
  },

  async getDateRange(startDate: string, endDate: string, db?: SQLite.SQLiteDatabase): Promise<CalendarOverlay[]> {
    const database = db || await getDatabase();
    // Find overlays that intersect with the date range
    // An overlay intersects if: overlay.start_date <= endDate AND overlay.end_date >= startDate
    const results = await database.getAllAsync<CalendarOverlayRow>(
      'SELECT * FROM calendar_overlays WHERE start_date <= ? AND end_date >= ? ORDER BY start_date ASC',
      [endDate, startDate]
    );

    return results.map(this.mapRowToOverlay);
  },

  async getByDate(date: string, db?: SQLite.SQLiteDatabase): Promise<CalendarOverlay[]> {
    const database = db || await getDatabase();
    // Find all overlays that contain this specific date
    const results = await database.getAllAsync<CalendarOverlayRow>(
      'SELECT * FROM calendar_overlays WHERE start_date <= ? AND end_date >= ? ORDER BY start_date ASC',
      [date, date]
    );

    return results.map(this.mapRowToOverlay);
  },

  /**
   * Get all overlays - use for backup/export only.
   * For app layer queries, use getDateRange or getByDate instead.
   */
  async getAll(db?: SQLite.SQLiteDatabase): Promise<CalendarOverlay[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<CalendarOverlayRow>(
      'SELECT * FROM calendar_overlays ORDER BY start_date DESC'
    );

    return results.map(this.mapRowToOverlay);
  },

  async deleteAll(db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    await database.runAsync('DELETE FROM calendar_overlays');
  },

  mapRowToOverlay(row: CalendarOverlayRow): CalendarOverlay {
    return {
      id: row.id,
      startDate: row.start_date,
      endDate: row.end_date,
      label: row.label,
      notes: row.notes || undefined,
      excludeFromStats: row.exclude_from_stats === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
};
