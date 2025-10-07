import { getDatabase, generateId } from './db';
import { Medication, MedicationDose, MedicationSchedule } from '../models/types';
import * as SQLite from 'expo-sqlite';
import { notificationService } from '../services/notificationService';

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

    await database.runAsync(
      `INSERT INTO medications (
        id, name, type, dosage_amount, dosage_unit, default_dosage, schedule_frequency,
        photo_uri, start_date, end_date, active, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newMedication.id,
        newMedication.name,
        newMedication.type,
        newMedication.dosageAmount,
        newMedication.dosageUnit,
        newMedication.defaultDosage || null,
        newMedication.scheduleFrequency || null,
        newMedication.photoUri || null,
        newMedication.startDate || null,
        newMedication.endDate || null,
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
    const values: any[] = [];

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
    if (updates.defaultDosage !== undefined) {
      fields.push('default_dosage = ?');
      values.push(updates.defaultDosage);
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

      // Cancel all notifications when archiving a medication
      if (updates.active === false) {
        await notificationService.cancelMedicationNotifications(id);
        console.log('[Repository] Cancelled notifications for archived medication:', id);
      }
      // Re-enable notifications when restoring an archived medication
      else if (updates.active === true) {
        const medication = await this.getById(id, database);
        if (medication && medication.type === 'preventative') {
          const schedules = await medicationScheduleRepository.getByMedicationId(id, database);
          const permissions = await notificationService.getPermissions();

          if (permissions.granted) {
            for (const schedule of schedules) {
              if (schedule.enabled && medication.scheduleFrequency === 'daily') {
                try {
                  const notificationId = await notificationService.scheduleNotification(
                    medication,
                    schedule
                  );

                  if (notificationId) {
                    await medicationScheduleRepository.update(schedule.id, {
                      notificationId,
                    }, database);
                    console.log('[Repository] Notification rescheduled for restored medication:', notificationId);
                  }
                } catch (error) {
                  console.error('[Repository] Failed to schedule notification for restored medication:', error);
                }
              }
            }
          }
        }
      }
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }
    if (updates.endDate !== undefined) {
      fields.push('end_date = ?');
      values.push(updates.endDate);
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
    const result = await database.getFirstAsync<any>(
      'SELECT * FROM medications WHERE id = ?',
      [id]
    );

    if (!result) return null;

    return this.mapRowToMedication(result);
  },

  async getAll(db?: SQLite.SQLiteDatabase): Promise<Medication[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<any>(
      'SELECT * FROM medications ORDER BY name ASC'
    );

    return results.map(this.mapRowToMedication);
  },

  async getActive(db?: SQLite.SQLiteDatabase): Promise<Medication[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<any>(
      'SELECT * FROM medications WHERE active = 1 ORDER BY name ASC'
    );

    return results.map(this.mapRowToMedication);
  },

  async getByType(type: 'preventative' | 'rescue', db?: SQLite.SQLiteDatabase): Promise<Medication[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<any>(
      'SELECT * FROM medications WHERE type = ? AND active = 1 ORDER BY name ASC',
      [type]
    );

    return results.map(this.mapRowToMedication);
  },

  async getArchived(db?: SQLite.SQLiteDatabase): Promise<Medication[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<any>(
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

  mapRowToMedication(row: any): Medication {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      dosageAmount: row.dosage_amount,
      dosageUnit: row.dosage_unit,
      defaultDosage: row.default_dosage,
      scheduleFrequency: row.schedule_frequency,
      photoUri: row.photo_uri,
      schedule: [], // Will be loaded separately
      startDate: row.start_date,
      endDate: row.end_date,
      active: row.active === 1,
      notes: row.notes,
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
      createdAt: now,
    };

    await database.runAsync(
      `INSERT INTO medication_doses (
        id, medication_id, timestamp, amount, episode_id, effectiveness_rating,
        time_to_relief, side_effects, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newDose.id,
        newDose.medicationId,
        newDose.timestamp,
        newDose.amount,
        newDose.episodeId || null,
        newDose.effectivenessRating || null,
        newDose.timeToRelief || null,
        newDose.sideEffects ? JSON.stringify(newDose.sideEffects) : null,
        newDose.notes || null,
        newDose.createdAt,
      ]
    );

    return newDose;
  },

  async update(id: string, updates: Partial<MedicationDose>, db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();

    const fields: string[] = [];
    const values: any[] = [];

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

    values.push(id);

    await database.runAsync(
      `UPDATE medication_doses SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  },

  async getAll(limit = 100, db?: SQLite.SQLiteDatabase): Promise<MedicationDose[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<any>(
      'SELECT * FROM medication_doses ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );

    return results.map(this.mapRowToDose);
  },

  async getByMedicationId(medicationId: string, limit = 50, db?: SQLite.SQLiteDatabase): Promise<MedicationDose[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<any>(
      'SELECT * FROM medication_doses WHERE medication_id = ? ORDER BY timestamp DESC LIMIT ?',
      [medicationId, limit]
    );

    return results.map(this.mapRowToDose);
  },

  async getByEpisodeId(episodeId: string, db?: SQLite.SQLiteDatabase): Promise<MedicationDose[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<any>(
      'SELECT * FROM medication_doses WHERE episode_id = ? ORDER BY timestamp ASC',
      [episodeId]
    );

    return results.map(this.mapRowToDose);
  },

  async getByDateRange(startDate: number, endDate: number, db?: SQLite.SQLiteDatabase): Promise<MedicationDose[]> {
    const database = db || await getDatabase();
    const results = await database.getAllAsync<any>(
      'SELECT * FROM medication_doses WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC',
      [startDate, endDate]
    );

    return results.map(this.mapRowToDose);
  },

  mapRowToDose(row: any): MedicationDose {
    return {
      id: row.id,
      medicationId: row.medication_id,
      timestamp: row.timestamp,
      amount: row.amount,
      episodeId: row.episode_id,
      effectivenessRating: row.effectiveness_rating,
      timeToRelief: row.time_to_relief,
      sideEffects: row.side_effects ? JSON.parse(row.side_effects) : undefined,
      notes: row.notes,
      createdAt: row.created_at,
    };
  },

  async deleteAll(db?: SQLite.SQLiteDatabase): Promise<void> {
    const database = db || await getDatabase();
    await database.runAsync('DELETE FROM medication_doses');
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
    const values: any[] = [];

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
    const results = await database.getAllAsync<any>(
      'SELECT * FROM medication_schedules WHERE medication_id = ? ORDER BY time ASC',
      [medicationId]
    );

    return results.map(row => ({
      id: row.id,
      medicationId: row.medication_id,
      time: row.time,
      dosage: row.dosage,
      enabled: row.enabled === 1,
      notificationId: row.notification_id,
      reminderEnabled: row.reminder_enabled === 1,
    }));
  },
};
