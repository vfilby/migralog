import { getDatabase, generateId } from './db';
import { Medication, MedicationDose, MedicationSchedule } from '../models/types';
import * as SQLite from 'expo-sqlite';
import {
  MedicationRow,
  MedicationDoseRow,
  MedicationScheduleRow,
  safeJSONParse,
  isStringArray,
} from './types';
import {
  MedicationSchema,
  MedicationDoseSchema,
  MedicationScheduleSchema,
} from '../schemas';
import { logger } from '../utils/logger';

export const medicationRepository = {
  async create(medication: Omit<Medication, 'id' | 'createdAt' | 'updatedAt'>, db?: SQLite.SQLiteDatabase): Promise<Medication> {
    const database = db || await getDatabase();
    const now = Date.now();
    const id = generateId();

    const newMedication: Medication = {
      ...medication,
      id,
      createdAt: now,
      updatedAt: now,
    };

    // Validate medication data
    const validationResult = MedicationSchema.safeParse(newMedication);
    if (!validationResult.success) {
      const errorMessage = `Invalid medication data: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
      logger.error('[MedicationRepository] Validation failed:', errorMessage);
      throw new Error(errorMessage);
    }

    await database.runAsync(
      `INSERT INTO medications (
        id, name, type, dosage_amount, dosage_unit, default_quantity, schedule_frequency,
        photo_uri, active, notes, category, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newMedication.id,
        newMedication.name,
        newMedication.type,
        newMedication.dosageAmount,
        newMedication.dosageUnit,
        newMedication.defaultQuantity || null,
        newMedication.scheduleFrequency || null,
        newMedication.photoUri || null,
        newMedication.active ? 1 : 0,
        newMedication.notes || null,
        newMedication.category || null,
        newMedication.createdAt,
        newMedication.updatedAt,
      ]
    );

    return newMedication;
  },

  async update(id: string, updates: Partial<Medication>, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    const now = Date.now();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.name) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.type) {
      fields.push('type = ?');
      values.push(updates.type);
    }
    if (updates.dosageAmount !== undefined) {
      fields.push('dosage_amount = ?');
      values.push(updates.dosageAmount);
    }
    if (updates.dosageUnit) {
      fields.push('dosage_unit = ?');
      values.push(updates.dosageUnit);
    }
    if (updates.defaultQuantity !== undefined) {
      fields.push('default_quantity = ?');
      values.push(updates.defaultQuantity);
    }
    if (updates.scheduleFrequency !== undefined) {
      fields.push('schedule_frequency = ?');
      values.push(updates.scheduleFrequency);
    }
    if (updates.photoUri !== undefined) {
      fields.push('photo_uri = ?');
      values.push(updates.photoUri);
    }
    if (updates.active !== undefined) {
      fields.push('active = ?');
      values.push(updates.active ? 1 : 0);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }
    if (updates.category !== undefined) {
      fields.push('category = ?');
      values.push(updates.category);
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    await database.runAsync(
      `UPDATE medications SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  },

  async getById(id: string, db?: SQLite.SQLiteDatabase): Promise<Medication | null> {
    const database = db || await getDatabase();
    const result = await database.getFirstAsync<MedicationRow>(
      'SELECT * FROM medications WHERE id = ?',
      [id]
    );

    if (!result) return null;

    return this.mapRowToMedication(result);
  },

  async getAll(db?: SQLite.SQLiteDatabase): Promise<Medication[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<MedicationRow>(
      'SELECT * FROM medications ORDER BY name ASC'
    );

    return results.map(this.mapRowToMedication);
  },

  async getActive(db?: SQLite.SQLiteDatabase): Promise<Medication[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<MedicationRow>(
      'SELECT * FROM medications WHERE active = 1 ORDER BY name ASC'
    );

    return results.map(this.mapRowToMedication);
  },

  async getByType(type: 'preventative' | 'rescue', db?: SQLite.SQLiteDatabase): Promise<Medication[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<MedicationRow>(
      'SELECT * FROM medications WHERE type = ? AND active = 1 ORDER BY name ASC',
      [type]
    );

    return results.map(this.mapRowToMedication);
  },

  async getArchived(db?: SQLite.SQLiteDatabase): Promise<Medication[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<MedicationRow>(
      'SELECT * FROM medications WHERE active = 0 ORDER BY name ASC'
    );

    return results.map(this.mapRowToMedication);
  },

  async delete(id: string, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    await database.runAsync('DELETE FROM medications WHERE id = ?', [id]);
  },

  async deleteAll(db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    await database.runAsync('DELETE FROM medications');
  },

  mapRowToMedication(row: MedicationRow): Medication {
    return {
      id: row.id,
      name: row.name,
      type: row.type as import('../models/types').MedicationType, // Type assertion for union type
      dosageAmount: row.dosage_amount,
      dosageUnit: row.dosage_unit,
      defaultQuantity: row.default_quantity || undefined,
      scheduleFrequency: (row.schedule_frequency as import('../models/types').ScheduleFrequency) || undefined, // Type assertion for union type
      photoUri: row.photo_uri || undefined,
      schedule: [], // Will be loaded separately
      active: row.active === 1,
      notes: row.notes || undefined,
      category: (row.category as import('../models/types').MedicationCategory) || undefined, // Type assertion for union type
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
};

/**
 * Cache for Intl.DateTimeFormat instances to improve performance within the iterative
 * UTC conversion algorithm. Each timestamp calculation may call formatToParts() up to
 * 3 times to handle DST transitions, making formatter reuse beneficial.
 *
 * While single-user mobile apps typically use 1-2 timezones, we limit cache size to
 * prevent unbounded growth in edge cases (e.g., frequent international travel).
 * Size limit of 10 accommodates reasonable travel scenarios without memory concerns.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>();
const MAX_CACHE_SIZE = 10;

/**
 * Clear the formatter cache. This is exposed for testing purposes only.
 * In tests, formatters created before Date mocking may have stale internal state.
 * @internal
 */
export function clearFormatterCache(): void {
  formatterCache.clear();
}

/**
 * Get a cached or create a new Intl.DateTimeFormat for the given timezone.
 * Implements simple cache eviction when limit is exceeded (removes oldest entry).
 * @param timezone IANA timezone identifier
 * @returns Cached DateTimeFormat instance
 */
function getFormatter(timezone: string): Intl.DateTimeFormat {
  if (!formatterCache.has(timezone)) {
    // Simple cache eviction: remove first (oldest) entry if at capacity
    // Map iteration order is insertion order, so first entry is oldest
    if (formatterCache.size >= MAX_CACHE_SIZE) {
      const firstKey = formatterCache.keys().next().value;
      if (firstKey !== undefined) {
        formatterCache.delete(firstKey);
      }
    }

    formatterCache.set(timezone, new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }));
  }
  return formatterCache.get(timezone)!;
}

/**
 * Helper function to convert a local time in a specific timezone to a UTC timestamp.
 * This is necessary because JavaScript's Date constructor interprets date strings
 * in the device's local timezone, not the target timezone.
 *
 * Implementation uses iterative approach with Intl.DateTimeFormat rather than date-fns-tz
 * to avoid additional dependency. While date-fns-tz's zonedTimeToUtc() could handle this,
 * our zero-dependency approach uses only built-in APIs and is well-tested for DST edge cases.
 *
 * @param year Full year (e.g., 2024)
 * @param month Month (0-11, JavaScript convention)
 * @param day Day of month (1-31)
 * @param hour Hour (0-23)
 * @param minute Minute (0-59)
 * @param timezone IANA timezone identifier (e.g., 'America/Los_Angeles')
 * @returns UTC timestamp in milliseconds
 */
function getUTCTimestampInTimezone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string
): number {
  // Get cached formatter for the target timezone
  const formatter = getFormatter(timezone);

  // Helper to extract date components from a UTC timestamp as viewed in the target timezone
  const getLocalComponents = (utcTimestamp: number) => {
    const parts = formatter.formatToParts(new Date(utcTimestamp));
    return {
      year: parseInt(parts.find(p => p.type === 'year')!.value),
      month: parseInt(parts.find(p => p.type === 'month')!.value) - 1, // Intl returns 1-12, Date expects 0-11
      day: parseInt(parts.find(p => p.type === 'day')!.value),
      hour: parseInt(parts.find(p => p.type === 'hour')!.value),
      minute: parseInt(parts.find(p => p.type === 'minute')!.value)
    };
  };

  // Start with an approximation: treat the local time as if it were UTC
  let utcTimestamp = Date.UTC(year, month, day, hour, minute, 0);

  // Iterate to find the correct UTC timestamp (usually converges in 1-2 iterations)
  // This handles timezone offsets and DST transitions
  for (let i = 0; i < 3; i++) {
    const local = getLocalComponents(utcTimestamp);

    // Check if we've found the correct timestamp
    if (local.year === year && local.month === month && local.day === day &&
        local.hour === hour && local.minute === minute) {
      return utcTimestamp;
    }

    // Calculate the difference and adjust
    const targetUTC = Date.UTC(year, month, day, hour, minute, 0);
    const actualUTC = Date.UTC(local.year, local.month, local.day, local.hour, local.minute, 0);
    const diff = targetUTC - actualUTC;

    utcTimestamp += diff;
  }

  // If we didn't converge after 3 iterations, log warning and return best approximation
  // This can happen during DST transitions for non-existent times (e.g., 2:30 AM during spring forward)
  // Rather than crash the app, we return the closest valid time
  logger.warn(
    `getUTCTimestampInTimezone did not fully converge after 3 iterations for ${year}-${month+1}-${day} ${hour}:${minute} in ${timezone}. ` +
    `Using approximation. This may occur during DST transitions.`
  );
  return utcTimestamp;
}

export const medicationDoseRepository = {
  async create(dose: Omit<MedicationDose, 'id' | 'createdAt'>, db?: SQLite.SQLiteDatabase): Promise<MedicationDose> {
    const database = db || await getDatabase();
    const now = Date.now();
    const id = generateId();

    const newDose: MedicationDose = {
      ...dose,
      id,
      status: dose.status || 'taken', // Default to 'taken' if not provided
      createdAt: now,
      updatedAt: dose.updatedAt || now, // Ensure updatedAt is always set
    };

    // Validate medication dose data
    const validationResult = MedicationDoseSchema.safeParse(newDose);
    if (!validationResult.success) {
      const errorMessage = `Invalid medication dose: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
      logger.error('[MedicationDoseRepository] Validation failed:', errorMessage);
      throw new Error(errorMessage);
    }

    await database.runAsync(
      `INSERT INTO medication_doses (
        id, medication_id, timestamp, quantity, dosage_amount, dosage_unit, status, episode_id, effectiveness_rating,
        time_to_relief, side_effects, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newDose.id,
        newDose.medicationId,
        newDose.timestamp,
        newDose.quantity,
        newDose.dosageAmount || null,
        newDose.dosageUnit || null,
        newDose.status || 'taken', // Ensure it's never undefined
        newDose.episodeId || null,
        newDose.effectivenessRating || null,
        newDose.timeToRelief || null,
        newDose.sideEffects ? JSON.stringify(newDose.sideEffects) : null,
        newDose.notes || null,
        newDose.createdAt,
        newDose.updatedAt,
      ]
    );

    return newDose;
  },

  async update(id: string, updates: Partial<MedicationDose>, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    const now = Date.now();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.quantity !== undefined) {
      fields.push('quantity = ?');
      values.push(updates.quantity);
    }
    if (updates.timestamp !== undefined) {
      fields.push('timestamp = ?');
      values.push(updates.timestamp);
    }
    if (updates.effectivenessRating !== undefined) {
      fields.push('effectiveness_rating = ?');
      values.push(updates.effectivenessRating);
    }
    if (updates.timeToRelief !== undefined) {
      fields.push('time_to_relief = ?');
      values.push(updates.timeToRelief);
    }
    if (updates.sideEffects !== undefined) {
      fields.push('side_effects = ?');
      values.push(JSON.stringify(updates.sideEffects));
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }

    if (fields.length === 0) return;

    // Always set updated_at
    fields.push('updated_at = ?');
    values.push(now);

    values.push(id);

    await database.runAsync(
      `UPDATE medication_doses SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  },

  async getAll(limit = 100, db?: SQLite.SQLiteDatabase): Promise<MedicationDose[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<MedicationDoseRow>(
      'SELECT * FROM medication_doses ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );

    return results.map(this.mapRowToDose);
  },

  async getByMedicationId(medicationId: string, limit = 50, db?: SQLite.SQLiteDatabase): Promise<MedicationDose[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<MedicationDoseRow>(
      'SELECT * FROM medication_doses WHERE medication_id = ? ORDER BY timestamp DESC LIMIT ?',
      [medicationId, limit]
    );

    return results.map(this.mapRowToDose);
  },

  async getByEpisodeId(episodeId: string, db?: SQLite.SQLiteDatabase): Promise<MedicationDose[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<MedicationDoseRow>(
      'SELECT * FROM medication_doses WHERE episode_id = ? ORDER BY timestamp ASC',
      [episodeId]
    );

    return results.map(this.mapRowToDose);
  },

  async getByDateRange(startDate: number, endDate: number, db?: SQLite.SQLiteDatabase): Promise<MedicationDose[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<MedicationDoseRow>(
      'SELECT * FROM medication_doses WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC',
      [startDate, endDate]
    );

    return results.map(this.mapRowToDose);
  },

  /**
   * Batch query to get recent doses for multiple medications
   * 
   * This method prevents N+1 query patterns by fetching doses for multiple
   * medications in a single database query using an IN clause.
   * 
   * @param medicationIds Array of medication IDs to fetch doses for
   * @param limit Maximum total number of doses to return across all medications (default: 50)
   * @param db Optional database instance
   * @returns Array of medication doses for all specified medications, ordered by timestamp descending
   */
  async getAllByMedicationIds(medicationIds: string[], limit = 50, db?: SQLite.SQLiteDatabase): Promise<MedicationDose[]> {
    if (medicationIds.length === 0) {
      return [];
    }

    const database = db || await getDatabase();

    // Build placeholders for IN clause
    const placeholders = medicationIds.map(() => '?').join(', ');
    const results = await database.getAllAsync<MedicationDoseRow>(
      `SELECT * FROM medication_doses WHERE medication_id IN (${placeholders}) ORDER BY timestamp DESC LIMIT ?`,
      [...medicationIds, limit]
    );

    return results.map(this.mapRowToDose);
  },

  async getById(id: string, db?: SQLite.SQLiteDatabase): Promise<MedicationDose | null> {
    const database = db || await getDatabase();
    const result = await database.getFirstAsync<MedicationDoseRow>(
      'SELECT * FROM medication_doses WHERE id = ?',
      [id]
    );

    if (!result) return null;

    return this.mapRowToDose(result);
  },

  mapRowToDose(row: MedicationDoseRow): MedicationDose {
    return {
      id: row.id,
      medicationId: row.medication_id,
      timestamp: row.timestamp,
      quantity: row.quantity,
      dosageAmount: row.dosage_amount || undefined,
      dosageUnit: row.dosage_unit || undefined,
      status: (row.status as import('../models/types').DoseStatus) || 'taken', // Type assertion with default
      episodeId: row.episode_id || undefined,
      effectivenessRating: row.effectiveness_rating || undefined,
      timeToRelief: row.time_to_relief || undefined,
      sideEffects: safeJSONParse(row.side_effects, undefined, isStringArray),
      notes: row.notes || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  async delete(id: string, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    await database.runAsync('DELETE FROM medication_doses WHERE id = ?', [id]);
  },

  async deleteAll(db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    await database.runAsync('DELETE FROM medication_doses');
  },

  /**
   * Get usage counts for all medications
   *
   * Returns a map of medication IDs to their usage count (number of doses logged).
   * This is used to sort medications by frequency of use.
   * Only counts doses from the past 3 months to keep the query efficient.
   *
   * @returns Map of medication ID to usage count
   */
  async getMedicationUsageCounts(db?: SQLite.SQLiteDatabase): Promise<Map<string, number>> {
    const database = db || await getDatabase();

    // Calculate timestamp for 3 months ago
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const cutoffTimestamp = threeMonthsAgo.getTime();

    const results = await database.getAllAsync<{ medication_id: string; count: number }>(
      `SELECT medication_id, COUNT(*) as count
       FROM medication_doses
       WHERE status = 'taken' AND timestamp >= ?
       GROUP BY medication_id`,
      [cutoffTimestamp]
    );

    const usageCounts = new Map<string, number>();
    for (const row of results) {
      usageCounts.set(row.medication_id, row.count);
    }

    return usageCounts;
  },

  /**
   * Check if a medication was logged for a specific scheduled time today
   *
   * Uses timezone-aware date calculations to determine "today" in the
   * schedule's original timezone, not the user's current timezone.
   * This ensures schedules work correctly when traveling across timezones.
   *
   * DST Handling:
   * - Spring forward: Non-existent times (e.g., 2:30 AM) auto-adjust to next valid time
   * - Fall back: Ambiguous times (times that occur twice) use the first occurrence
   *
   * @param medicationId The medication ID to check
   * @param scheduleId The schedule ID to check
   * @param scheduledTime The scheduled time in HH:mm format (24-hour)
   * @param scheduleTimezone IANA timezone identifier (e.g., 'America/Los_Angeles')
   * @returns true if medication was logged between midnight and scheduled time today
   */
  async wasLoggedForScheduleToday(
    medicationId: string,
    scheduleId: string,
    scheduledTime: string,
    scheduleTimezone: string,
    db?: SQLite.SQLiteDatabase
  ): Promise<boolean> {
    const database = db || await getDatabase();

    // Validate timezone at runtime and fallback to device timezone if invalid
    // Empty strings, null, undefined, and malformed timezone IDs all throw errors from Intl.DateTimeFormat
    let validatedTimezone = scheduleTimezone;
    try {
      Intl.DateTimeFormat(undefined, { timeZone: scheduleTimezone });
    } catch (error) {
      logger.error(`Invalid timezone: ${scheduleTimezone}, falling back to device timezone`, error);
      validatedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    // Parse scheduled time
    const [hours, minutes] = scheduledTime.split(':').map(Number);

    // Get the current date components in the schedule's timezone
    // We use formatToParts to extract the year, month, day without timezone conversion bugs
    // Note: We create a lightweight formatter here since it's only used once per call
    // The heavy caching is done in getUTCTimestampInTimezone which may iterate multiple times
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: validatedTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour12: false
    });

    const parts = dateFormatter.formatToParts(new Date());
    const year = parseInt(parts.find(p => p.type === 'year')!.value);
    const month = parseInt(parts.find(p => p.type === 'month')!.value) - 1; // JS months are 0-indexed
    const day = parseInt(parts.find(p => p.type === 'day')!.value);

    // Get UTC timestamps for midnight and scheduled time in the schedule's timezone
    // This correctly handles timezone offsets and DST transitions
    const todayStartUTC = getUTCTimestampInTimezone(year, month, day, 0, 0, validatedTimezone);
    const scheduledDateTimeUTC = getUTCTimestampInTimezone(year, month, day, hours, minutes, validatedTimezone);

    // Query for doses of this medication logged today (in schedule's timezone) before the scheduled time
    // We check if the dose was logged any time from midnight to the scheduled time in the schedule's timezone
    const results = await database.getAllAsync<MedicationDoseRow>(
      `SELECT id FROM medication_doses
       WHERE medication_id = ?
       AND timestamp >= ?
       AND timestamp <= ?
       AND status = 'taken'
       LIMIT 1`,
      [medicationId, todayStartUTC, scheduledDateTimeUTC]
    );

    return results.length > 0;
  },
};

export const medicationScheduleRepository = {
  async create(schedule: Omit<MedicationSchedule, 'id'>, db?: SQLite.SQLiteDatabase): Promise<MedicationSchedule> {
    const database = db || await getDatabase();
    const id = generateId();

    const newSchedule: MedicationSchedule = {
      ...schedule,
      id,
    };

    // Validate medication schedule data
    const validationResult = MedicationScheduleSchema.safeParse(newSchedule);
    if (!validationResult.success) {
      const errorMessage = `Invalid medication schedule: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
      logger.error('[MedicationScheduleRepository] Validation failed:', errorMessage);
      throw new Error(errorMessage);
    }

    await database.runAsync(
      'INSERT INTO medication_schedules (id, medication_id, time, timezone, dosage, enabled, notification_id, reminder_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        newSchedule.id,
        newSchedule.medicationId,
        newSchedule.time,
        newSchedule.timezone,
        newSchedule.dosage,
        newSchedule.enabled ? 1 : 0,
        newSchedule.notificationId || null,
        newSchedule.reminderEnabled !== undefined ? (newSchedule.reminderEnabled ? 1 : 0) : 1,
      ]
    );

    return newSchedule;
  },

  async update(id: string, updates: Partial<MedicationSchedule>, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.time !== undefined) {
      fields.push('time = ?');
      values.push(updates.time);
    }
    if (updates.timezone !== undefined) {
      fields.push('timezone = ?');
      values.push(updates.timezone);
    }
    if (updates.dosage !== undefined) {
      fields.push('dosage = ?');
      values.push(updates.dosage);
    }
    if (updates.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(updates.enabled ? 1 : 0);
    }
    if (updates.notificationId !== undefined) {
      fields.push('notification_id = ?');
      values.push(updates.notificationId);
    }
    if (updates.reminderEnabled !== undefined) {
      fields.push('reminder_enabled = ?');
      values.push(updates.reminderEnabled ? 1 : 0);
    }

    if (fields.length === 0) return;

    values.push(id);
    await database.runAsync(
      `UPDATE medication_schedules SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  },

  async delete(id: string, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    await database.runAsync('DELETE FROM medication_schedules WHERE id = ?', [id]);
  },

  async deleteAll(db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    await database.runAsync('DELETE FROM medication_schedules');
  },

  async getByMedicationId(medicationId: string, db?: SQLite.SQLiteDatabase): Promise<MedicationSchedule[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<MedicationScheduleRow>(
      'SELECT * FROM medication_schedules WHERE medication_id = ? ORDER BY time ASC',
      [medicationId]
    );

    return results.map(row => ({
      id: row.id,
      medicationId: row.medication_id,
      time: row.time,
      timezone: row.timezone,
      dosage: row.dosage,
      enabled: row.enabled === 1,
      notificationId: row.notification_id || undefined,
      reminderEnabled: row.reminder_enabled === 1,
    }));
  },

  /**
   * Batch query to get schedules for multiple medications
   * 
   * This method prevents N+1 query patterns by fetching schedules for multiple
   * medications in a single database query using an IN clause.
   * 
   * @param medicationIds Array of medication IDs to fetch schedules for
   * @param db Optional database instance
   * @returns Array of medication schedules for all specified medications
   */
  async getByMedicationIds(medicationIds: string[], db?: SQLite.SQLiteDatabase): Promise<MedicationSchedule[]> {
    if (medicationIds.length === 0) {
      return [];
    }

    const database = db || await getDatabase();

    // Build placeholders for IN clause
    const placeholders = medicationIds.map(() => '?').join(', ');
    const results = await database.getAllAsync<MedicationScheduleRow>(
      `SELECT * FROM medication_schedules WHERE medication_id IN (${placeholders}) ORDER BY time ASC`,
      medicationIds
    );

    return results.map(row => ({
      id: row.id,
      medicationId: row.medication_id,
      time: row.time,
      timezone: row.timezone,
      dosage: row.dosage,
      enabled: row.enabled === 1,
      notificationId: row.notification_id || undefined,
      reminderEnabled: row.reminder_enabled === 1,
    }));
  },
};
