import {
  medicationRepository,
  medicationDoseRepository,
  medicationScheduleRepository,
} from '../medicationRepository';
import { Medication, MedicationDose, MedicationSchedule } from '../../models/types';
import * as db from '../db';
import { notificationService } from '../../services/notificationService';

// Mock dependencies
jest.mock('../db');
jest.mock('../../services/notificationService');

describe('medicationRepository', () => {
  let mockDatabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDatabase = {
      runAsync: jest.fn().mockResolvedValue(undefined),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      getAllAsync: jest.fn().mockResolvedValue([]),
    };

    (db.getDatabase as jest.Mock).mockResolvedValue(mockDatabase);
    (db.generateId as jest.Mock).mockReturnValue('test-med-123');
  });

  describe('create', () => {
    it('should create a new medication with all fields', async () => {
      const newMedication = {
        name: 'Ibuprofen',
        type: 'rescue' as const,
        dosageAmount: 200,
        dosageUnit: 'mg',
        defaultDosage: 2,
        scheduleFrequency: undefined,
        photoUri: undefined,
        schedule: [],
        startDate: Date.now(),
        endDate: undefined,
        active: true,
        notes: 'Take with food',
      };

      const result = await medicationRepository.create(newMedication);

      expect(result.id).toBe('test-med-123');
      expect(result.name).toBe('Ibuprofen');
      expect(result.type).toBe('rescue');
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO medications'),
        expect.arrayContaining(['test-med-123', 'Ibuprofen', 'rescue', 200, 'mg'])
      );
    });

    it('should handle minimal medication data', async () => {
      const minimalMedication = {
        name: 'Aspirin',
        type: 'rescue' as const,
        dosageAmount: 325,
        dosageUnit: 'mg',
        defaultDosage: undefined,
        scheduleFrequency: undefined,
        photoUri: undefined,
        schedule: [],
        startDate: undefined,
        endDate: undefined,
        active: true,
        notes: undefined,
      };

      const result = await medicationRepository.create(minimalMedication);

      expect(result.id).toBe('test-med-123');
      expect(result.defaultDosage).toBeUndefined();
      expect(result.notes).toBeUndefined();
    });

    it('should create preventative medication', async () => {
      const preventative = {
        name: 'Daily Vitamin',
        type: 'preventative' as const,
        dosageAmount: 500,
        dosageUnit: 'mg',
        defaultDosage: 1,
        scheduleFrequency: 'daily' as const,
        photoUri: undefined,
        schedule: [],
        startDate: Date.now(),
        endDate: undefined,
        active: true,
        notes: undefined,
      };

      const result = await medicationRepository.create(preventative);

      expect(result.type).toBe('preventative');
      expect(result.scheduleFrequency).toBe('daily');
    });
  });

  describe('update', () => {
    it('should update medication name', async () => {
      await medicationRepository.update('med-123', { name: 'Updated Name' });

      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE medications SET'),
        expect.arrayContaining(['Updated Name', 'med-123'])
      );
    });

    it('should update multiple fields', async () => {
      const updates = {
        name: 'New Name',
        dosageAmount: 400,
        notes: 'New notes',
      };

      await medicationRepository.update('med-123', updates);

      const call = mockDatabase.runAsync.mock.calls[0];
      expect(call[0]).toContain('name = ?');
      expect(call[0]).toContain('dosage_amount = ?');
      expect(call[0]).toContain('notes = ?');
      expect(call[1]).toContain('New Name');
      expect(call[1]).toContain(400);
      expect(call[1]).toContain('New notes');
    });

    it('should cancel notifications when archiving medication', async () => {
      (notificationService.cancelMedicationNotifications as jest.Mock).mockResolvedValue(undefined);

      await medicationRepository.update('med-123', { active: false });

      expect(notificationService.cancelMedicationNotifications).toHaveBeenCalledWith('med-123');
    });

    it('should reschedule notifications when unarchiving preventative medication', async () => {
      const mockMedication: Medication = {
        id: 'med-123',
        name: 'Daily Med',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultDosage: 1,
        scheduleFrequency: 'daily',
        photoUri: undefined,
        schedule: [],
        startDate: Date.now(),
        endDate: undefined,
        active: false,
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const mockSchedule: MedicationSchedule = {
        id: 'sched-1',
        medicationId: 'med-123',
        time: '09:00',
        dosage: 1,
        enabled: true,
        notificationId: undefined,
      };

      mockDatabase.getFirstAsync.mockResolvedValue({
        id: 'med-123',
        name: 'Daily Med',
        type: 'preventative',
        dosage_amount: 100,
        dosage_unit: 'mg',
        default_dosage: 1,
        schedule_frequency: 'daily',
        photo_uri: undefined,
        start_date: Date.now(),
        end_date: undefined,
        active: 0,
        notes: undefined,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      mockDatabase.getAllAsync.mockResolvedValue([
        {
          id: 'sched-1',
          medication_id: 'med-123',
          time: '09:00',
          dosage: 1,
          enabled: 1,
          notification_id: undefined,
          created_at: Date.now(),
        },
      ]);

      (notificationService.getPermissions as jest.Mock).mockResolvedValue({ granted: true });
      (notificationService.scheduleNotification as jest.Mock).mockResolvedValue('notif-123');

      await medicationRepository.update('med-123', { active: true });

      expect(notificationService.getPermissions).toHaveBeenCalled();
      expect(notificationService.scheduleNotification).toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('should return medication when found', async () => {
      const mockRow = {
        id: 'med-123',
        name: 'Ibuprofen',
        type: 'rescue',
        dosage_amount: 200,
        dosage_unit: 'mg',
        default_dosage: 2,
        schedule_frequency: undefined,
        photo_uri: undefined,
        start_date: undefined,
        end_date: undefined,
        active: 1,
        notes: 'Take with food',
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDatabase.getFirstAsync.mockResolvedValue(mockRow);

      const result = await medicationRepository.getById('med-123');

      expect(result).not.toBeUndefined();
      expect(result?.id).toBe('med-123');
      expect(result?.name).toBe('Ibuprofen');
      expect(result?.active).toBe(true);
      expect(mockDatabase.getFirstAsync).toHaveBeenCalledWith(
        'SELECT * FROM medications WHERE id = ?',
        ['med-123']
      );
    });

    it('should return null when medication not found', async () => {
      mockDatabase.getFirstAsync.mockResolvedValue(null);

      const result = await medicationRepository.getById('nonexistent');

      expect(result).toBe(null);
    });
  });

  describe('getAll', () => {
    it('should return all medications sorted by name', async () => {
      const mockRows = [
        {
          id: 'med-1',
          name: 'Aspirin',
          type: 'rescue',
          dosage_amount: 325,
          dosage_unit: 'mg',
          default_dosage: undefined,
          schedule_frequency: undefined,
          photo_uri: undefined,
          start_date: undefined,
          end_date: undefined,
          active: 1,
          notes: undefined,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
        {
          id: 'med-2',
          name: 'Ibuprofen',
          type: 'rescue',
          dosage_amount: 200,
          dosage_unit: 'mg',
          default_dosage: undefined,
          schedule_frequency: undefined,
          photo_uri: undefined,
          start_date: undefined,
          end_date: undefined,
          active: 1,
          notes: undefined,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ];

      mockDatabase.getAllAsync.mockResolvedValue(mockRows);

      const result = await medicationRepository.getAll();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Aspirin');
      expect(result[1].name).toBe('Ibuprofen');
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM medications ORDER BY name ASC'
      );
    });

    it('should return empty array when no medications', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([]);

      const result = await medicationRepository.getAll();

      expect(result).toEqual([]);
    });
  });

  describe('getActive', () => {
    it('should return only active medications', async () => {
      const mockRows = [
        {
          id: 'med-1',
          name: 'Active Med',
          type: 'rescue',
          dosage_amount: 100,
          dosage_unit: 'mg',
          default_dosage: undefined,
          schedule_frequency: undefined,
          photo_uri: undefined,
          start_date: undefined,
          end_date: undefined,
          active: 1,
          notes: undefined,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ];

      mockDatabase.getAllAsync.mockResolvedValue(mockRows);

      const result = await medicationRepository.getActive();

      expect(result).toHaveLength(1);
      expect(result[0].active).toBe(true);
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM medications WHERE active = 1 ORDER BY name ASC'
      );
    });
  });

  describe('getByType', () => {
    it('should return only rescue medications', async () => {
      const mockRows = [
        {
          id: 'med-1',
          name: 'Rescue Med',
          type: 'rescue',
          dosage_amount: 100,
          dosage_unit: 'mg',
          default_dosage: undefined,
          schedule_frequency: undefined,
          photo_uri: undefined,
          start_date: undefined,
          end_date: undefined,
          active: 1,
          notes: undefined,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ];

      mockDatabase.getAllAsync.mockResolvedValue(mockRows);

      const result = await medicationRepository.getByType('rescue');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('rescue');
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM medications WHERE type = ? AND active = 1 ORDER BY name ASC',
        ['rescue']
      );
    });

    it('should return only preventative medications', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([]);

      await medicationRepository.getByType('preventative');

      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.any(String),
        ['preventative']
      );
    });
  });

  describe('getArchived', () => {
    it('should return only archived medications', async () => {
      const mockRows = [
        {
          id: 'med-1',
          name: 'Archived Med',
          type: 'rescue',
          dosage_amount: 100,
          dosage_unit: 'mg',
          default_dosage: undefined,
          schedule_frequency: undefined,
          photo_uri: undefined,
          start_date: undefined,
          end_date: undefined,
          active: 0,
          notes: undefined,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ];

      mockDatabase.getAllAsync.mockResolvedValue(mockRows);

      const result = await medicationRepository.getArchived();

      expect(result).toHaveLength(1);
      expect(result[0].active).toBe(false);
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM medications WHERE active = 0 ORDER BY name ASC'
      );
    });
  });

  describe('delete', () => {
    it('should delete medication by id', async () => {
      await medicationRepository.delete('med-123');

      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'DELETE FROM medications WHERE id = ?',
        ['med-123']
      );
    });
  });

  describe('deleteAll', () => {
    it('should delete all medications', async () => {
      await medicationRepository.deleteAll();

      expect(mockDatabase.runAsync).toHaveBeenCalledWith('DELETE FROM medications');
    });
  });

  describe('mapRowToMedication', () => {
    it('should correctly map database row to Medication object', () => {
      const row = {
        id: 'med-123',
        name: 'Test Med',
        type: 'rescue',
        dosage_amount: 100,
        dosage_unit: 'mg',
        default_dosage: 2,
        schedule_frequency: 'daily',
        photo_uri: 'file://test.jpg',
        start_date: 1000,
        end_date: 2000,
        active: 1,
        notes: 'Test notes',
        created_at: 900,
        updated_at: 1100,
      };

      const medication = medicationRepository.mapRowToMedication(row);

      expect(medication.id).toBe('med-123');
      expect(medication.name).toBe('Test Med');
      expect(medication.type).toBe('rescue');
      expect(medication.dosageAmount).toBe(100);
      expect(medication.dosageUnit).toBe('mg');
      expect(medication.defaultDosage).toBe(2);
      expect(medication.scheduleFrequency).toBe('daily');
      expect(medication.photoUri).toBe('file://test.jpg');
      expect(medication.startDate).toBe(1000);
      expect(medication.endDate).toBe(2000);
      expect(medication.active).toBe(true);
      expect(medication.notes).toBe('Test notes');
      expect(medication.schedule).toEqual([]);
      expect(medication.createdAt).toBe(900);
      expect(medication.updatedAt).toBe(1100);
    });

    it('should handle inactive medication', () => {
      const row = {
        id: 'med-123',
        name: 'Inactive',
        type: 'rescue',
        dosage_amount: 100,
        dosage_unit: 'mg',
        default_dosage: undefined,
        schedule_frequency: undefined,
        photo_uri: undefined,
        start_date: undefined,
        end_date: undefined,
        active: 0,
        notes: undefined,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      const medication = medicationRepository.mapRowToMedication(row);

      expect(medication.active).toBe(false);
    });
  });
});

describe('medicationDoseRepository', () => {
  let mockDatabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDatabase = {
      runAsync: jest.fn().mockResolvedValue(undefined),
      getAllAsync: jest.fn().mockResolvedValue([]),
    };

    (db.getDatabase as jest.Mock).mockResolvedValue(mockDatabase);
    (db.generateId as jest.Mock).mockReturnValue('dose-123');
  });

  describe('create', () => {
    it('should create a new medication dose', async () => {
      const newDose = {
        medicationId: 'med-123',
        timestamp: Date.now(),
        amount: 2,
        episodeId: 'ep-123',
        effectivenessRating: 8,
        timeToRelief: 30,
        sideEffects: ['Drowsiness'],
        notes: 'Took with food',
      };

      const result = await medicationDoseRepository.create(newDose);

      expect(result.id).toBe('dose-123');
      expect(result.amount).toBe(2);
      expect(result.createdAt).toBeDefined();
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO medication_doses'),
        expect.arrayContaining(['dose-123', 'med-123', newDose.timestamp, 2, 'ep-123'])
      );
    });

    it('should handle minimal dose data', async () => {
      const minimal = {
        medicationId: 'med-123',
        timestamp: Date.now(),
        amount: 1,
        episodeId: undefined,
        effectivenessRating: undefined,
        timeToRelief: undefined,
        sideEffects: undefined,
        notes: undefined,
      };

      const result = await medicationDoseRepository.create(minimal);

      expect(result.id).toBe('dose-123');
      expect(result.effectivenessRating).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update dose effectiveness', async () => {
      await medicationDoseRepository.update('dose-123', { effectivenessRating: 9 });

      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'UPDATE medication_doses SET effectiveness_rating = ? WHERE id = ?',
        [9, 'dose-123']
      );
    });

    it('should update multiple fields', async () => {
      const updates = {
        effectivenessRating: 7,
        timeToRelief: 45,
        notes: 'Updated notes',
      };

      await medicationDoseRepository.update('dose-123', updates);

      const call = mockDatabase.runAsync.mock.calls[0];
      expect(call[0]).toContain('effectiveness_rating = ?');
      expect(call[0]).toContain('time_to_relief = ?');
      expect(call[0]).toContain('notes = ?');
    });

    it('should not update if no fields provided', async () => {
      await medicationDoseRepository.update('dose-123', {});

      expect(mockDatabase.runAsync).not.toHaveBeenCalled();
    });
  });

  describe('getAll', () => {
    it('should return all doses with default limit', async () => {
      const mockRows = [
        {
          id: 'dose-1',
          medication_id: 'med-123',
          timestamp: Date.now(),
          amount: 1,
          episode_id: undefined,
          effectiveness_rating: undefined,
          time_to_relief: undefined,
          side_effects: undefined,
          notes: undefined,
          created_at: Date.now(),
        },
      ];

      mockDatabase.getAllAsync.mockResolvedValue(mockRows);

      const result = await medicationDoseRepository.getAll();

      expect(result).toHaveLength(1);
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM medication_doses ORDER BY timestamp DESC LIMIT ?',
        [100]
      );
    });

    it('should support custom limit', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([]);

      await medicationDoseRepository.getAll(50);

      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.any(String),
        [50]
      );
    });
  });

  describe('getByMedicationId', () => {
    it('should return doses for specific medication', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([]);

      await medicationDoseRepository.getByMedicationId('med-123');

      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE medication_id = ?'),
        ['med-123', 50]
      );
    });
  });

  describe('delete', () => {
    it('should delete dose by id', async () => {
      await medicationDoseRepository.delete('dose-123');

      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'DELETE FROM medication_doses WHERE id = ?',
        ['dose-123']
      );
    });
  });
});
