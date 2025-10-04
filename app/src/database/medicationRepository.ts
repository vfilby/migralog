import { getDatabase, generateId } from './db';
import { Medication, MedicationDose, MedicationSchedule } from '../models/types';

export const medicationRepository = {
  async create(medication: Omit<Medication, 'id' | 'createdAt' | 'updatedAt'>): Promise<Medication> {
    const db = await getDatabase();
    const now = Date.now();
    const id = generateId();

    const newMedication: Medication = {
      ...medication,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await db.runAsync(
      `INSERT INTO medications (
        id, name, type, dosage_amount, dosage_unit, default_dosage, frequency,
        photo_uri, start_date, end_date, active, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newMedication.id,
        newMedication.name,
        newMedication.type,
        newMedication.dosageAmount,
        newMedication.dosageUnit,
        newMedication.defaultDosage || null,
        newMedication.frequency || null,
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

  async update(id: string, updates: Partial<Medication>): Promise<void> {
    const db = await getDatabase();
    const now = Date.now();

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name) {
      fields.push('name = ?');
      values.push(updates.name);
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
    if (updates.frequency !== undefined) {
      fields.push('frequency = ?');
      values.push(updates.frequency);
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
    if (updates.endDate !== undefined) {
      fields.push('end_date = ?');
      values.push(updates.endDate);
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    await db.runAsync(
      `UPDATE medications SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  },

  async getById(id: string): Promise<Medication | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<any>(
      'SELECT * FROM medications WHERE id = ?',
      [id]
    );

    if (!result) return null;

    return this.mapRowToMedication(result);
  },

  async getAll(): Promise<Medication[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync<any>(
      'SELECT * FROM medications ORDER BY name ASC'
    );

    return results.map(this.mapRowToMedication);
  },

  async getActive(): Promise<Medication[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync<any>(
      'SELECT * FROM medications WHERE active = 1 ORDER BY name ASC'
    );

    return results.map(this.mapRowToMedication);
  },

  async getByType(type: 'preventative' | 'rescue'): Promise<Medication[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync<any>(
      'SELECT * FROM medications WHERE type = ? AND active = 1 ORDER BY name ASC',
      [type]
    );

    return results.map(this.mapRowToMedication);
  },

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM medications WHERE id = ?', [id]);
  },

  mapRowToMedication(row: any): Medication {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      dosageAmount: row.dosage_amount,
      dosageUnit: row.dosage_unit,
      defaultDosage: row.default_dosage,
      frequency: row.frequency,
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
  async create(dose: Omit<MedicationDose, 'id' | 'createdAt'>): Promise<MedicationDose> {
    const db = await getDatabase();
    const now = Date.now();
    const id = generateId();

    const newDose: MedicationDose = {
      ...dose,
      id,
      createdAt: now,
    };

    await db.runAsync(
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

  async update(id: string, updates: Partial<MedicationDose>): Promise<void> {
    const db = await getDatabase();

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

    await db.runAsync(
      `UPDATE medication_doses SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  },

  async getByMedicationId(medicationId: string, limit = 50): Promise<MedicationDose[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync<any>(
      'SELECT * FROM medication_doses WHERE medication_id = ? ORDER BY timestamp DESC LIMIT ?',
      [medicationId, limit]
    );

    return results.map(this.mapRowToDose);
  },

  async getByEpisodeId(episodeId: string): Promise<MedicationDose[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync<any>(
      'SELECT * FROM medication_doses WHERE episode_id = ? ORDER BY timestamp ASC',
      [episodeId]
    );

    return results.map(this.mapRowToDose);
  },

  async getByDateRange(startDate: number, endDate: number): Promise<MedicationDose[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync<any>(
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
};

export const medicationScheduleRepository = {
  async create(schedule: Omit<MedicationSchedule, 'id'>): Promise<MedicationSchedule> {
    const db = await getDatabase();
    const id = generateId();

    const newSchedule: MedicationSchedule = {
      ...schedule,
      id,
    };

    await db.runAsync(
      'INSERT INTO medication_schedules (id, medication_id, time, enabled) VALUES (?, ?, ?, ?)',
      [newSchedule.id, newSchedule.medicationId, newSchedule.time, newSchedule.enabled ? 1 : 0]
    );

    return newSchedule;
  },

  async update(id: string, enabled: boolean): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE medication_schedules SET enabled = ? WHERE id = ?',
      [enabled ? 1 : 0, id]
    );
  },

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM medication_schedules WHERE id = ?', [id]);
  },

  async getByMedicationId(medicationId: string): Promise<MedicationSchedule[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync<any>(
      'SELECT * FROM medication_schedules WHERE medication_id = ? ORDER BY time ASC',
      [medicationId]
    );

    return results.map(row => ({
      id: row.id,
      medicationId: row.medication_id,
      time: row.time,
      enabled: row.enabled === 1,
    }));
  },
};
