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
        photo_uri, active, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
};

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
   * Check if a medication was logged for a specific scheduled time today
   * @param medicationId The medication ID to check
   * @param scheduleId The schedule ID to check
   * @param scheduledTime The scheduled time in HH:mm format
   * @returns true if medication was logged within the time window, false otherwise
   */
  async wasLoggedForScheduleToday(
    medicationId: string,
    scheduleId: string,
    scheduledTime: string,
    db?: SQLite.SQLiteDatabase
  ): Promise<boolean> {
    const database = db || await getDatabase();

    // Parse scheduled time
    const [hours, minutes] = scheduledTime.split(':').map(Number);

    // Get start of today and the scheduled time for today
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const scheduledDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

    // Query for doses of this medication logged today before the scheduled time
    // We check if the dose was logged any time before the notification fires
    const results = await database.getAllAsync<MedicationDoseRow>(
      `SELECT id FROM medication_doses
       WHERE medication_id = ?
       AND timestamp >= ?
       AND timestamp <= ?
       AND status = 'taken'
       LIMIT 1`,
      [medicationId, todayStart.getTime(), scheduledDateTime.getTime()]
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
      'INSERT INTO medication_schedules (id, medication_id, time, dosage, enabled, notification_id, reminder_enabled) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        newSchedule.id,
        newSchedule.medicationId,
        newSchedule.time,
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
      dosage: row.dosage,
      enabled: row.enabled === 1,
      notificationId: row.notification_id || undefined,
      reminderEnabled: row.reminder_enabled === 1,
    }));
  },
};
