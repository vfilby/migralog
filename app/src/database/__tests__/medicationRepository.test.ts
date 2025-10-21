import {
  medicationRepository,
  medicationDoseRepository,
  medicationScheduleRepository,
} from '../medicationRepository';
import * as db from '../db';

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

    // Note: Notification handling for archiving/unarchiving belongs in medicationStore, not repository layer
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
          default_dosage: null,
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
          default_dosage: null,
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
          default_dosage: null,
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
          default_dosage: null,
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
          default_dosage: null,
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
        default_dosage: null,
        schedule_frequency: null,
        photo_uri: null,
        start_date: null,
        end_date: null,
        active: 0,
        notes: null,
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

  describe('Validation Error Handling', () => {
    describe('medicationRepository.create validation', () => {
      it('should throw error for preventative medication without schedule frequency', async () => {
        const invalidMed: any = {
          name: 'Test Med',
          type: 'preventative',
          dosageAmount: 50,
          dosageUnit: 'mg',
          active: true,
        };

        await expect(medicationRepository.create(invalidMed)).rejects.toThrow('Preventative medications must have a schedule frequency');
      });

      it('should throw error for medication with endDate before startDate', async () => {
        const invalidMed: any = {
          name: 'Test Med',
          type: 'rescue',
          dosageAmount: 50,
          dosageUnit: 'mg',
          active: true,
          startDate: 2000,
          endDate: 1000,
        };

        await expect(medicationRepository.create(invalidMed)).rejects.toThrow('End date must be after start date');
      });

      it('should throw error for negative dosage amount', async () => {
        const invalidMed: any = {
          name: 'Test Med',
          type: 'rescue',
          dosageAmount: -1,
          dosageUnit: 'mg',
          active: true,
        };

        await expect(medicationRepository.create(invalidMed)).rejects.toThrow('Dosage amount must be positive');
      });
    });

    describe('medicationDoseRepository.create validation', () => {
      it('should throw error for taken dose with amount 0', async () => {
        const invalidDose: any = {
          medicationId: 'med-123',
          timestamp: 1000,
          amount: 0,
          status: 'taken',
        };

        await expect(medicationDoseRepository.create(invalidDose)).rejects.toThrow('Amount must be positive for taken doses');
      });

      it('should allow skipped dose with amount 0', async () => {
        const validDose: any = {
          medicationId: 'med-123',
          timestamp: 1000,
          amount: 0,
          status: 'skipped',
        };

        const result = await medicationDoseRepository.create(validDose);
        expect(result.amount).toBe(0);
        expect(result.status).toBe('skipped');
      });

      it('should throw error for effectiveness rating > 10', async () => {
        const invalidDose: any = {
          medicationId: 'med-123',
          timestamp: 1000,
          amount: 50,
          effectivenessRating: 11,
        };

        await expect(medicationDoseRepository.create(invalidDose)).rejects.toThrow('Effectiveness rating must be <= 10');
      });

      it('should throw error for timeToRelief > 1440', async () => {
        const invalidDose: any = {
          medicationId: 'med-123',
          timestamp: 1000,
          amount: 50,
          timeToRelief: 1441,
        };

        await expect(medicationDoseRepository.create(invalidDose)).rejects.toThrow('Time to relief must be <= 1440 minutes');
      });
    });

    describe('medicationScheduleRepository.create validation', () => {
      it('should throw error for invalid time format', async () => {
        const invalidSchedule: any = {
          medicationId: 'med-123',
          time: '9:30', // Missing leading zero
          dosage: 1,
          enabled: true,
        };

        await expect(medicationScheduleRepository.create(invalidSchedule)).rejects.toThrow('Time must be in HH:mm format');
      });

      it('should throw error for negative dosage', async () => {
        const invalidSchedule: any = {
          medicationId: 'med-123',
          time: '09:30',
          dosage: -1,
          enabled: true,
        };

        await expect(medicationScheduleRepository.create(invalidSchedule)).rejects.toThrow('Dosage must be positive');
      });

      it('should throw error for zero dosage', async () => {
        const invalidSchedule: any = {
          medicationId: 'med-123',
          time: '09:30',
          dosage: 0,
          enabled: true,
        };

        await expect(medicationScheduleRepository.create(invalidSchedule)).rejects.toThrow('Dosage must be positive');
      });
    });
  });

  describe('wasLoggedForScheduleToday', () => {
    it('should return true if medication was logged before scheduled time today', async () => {
      // Set up: medication scheduled for 9:30 PM (21:30)
      const scheduledTime = '21:30';
      const medicationId = 'med-123';
      const scheduleId = 'schedule-123';

      // Create a dose logged at 9:00 PM (before scheduled time)
      const now = new Date();
      const ninepm = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0, 0);

      const mockRows = [
        {
          id: 'dose-1',
          medication_id: medicationId,
          timestamp: ninepm.getTime(),
          amount: 1,
          status: 'taken',
          created_at: ninepm.getTime(),
        },
      ];

      mockDatabase.getAllAsync.mockResolvedValue(mockRows);

      const result = await medicationDoseRepository.wasLoggedForScheduleToday(
        medicationId,
        scheduleId,
        scheduledTime
      );

      expect(result).toBe(true);
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE medication_id = ?'),
        expect.arrayContaining([medicationId])
      );
    });

    it('should return false if medication was not logged before scheduled time today', async () => {
      const scheduledTime = '21:30';
      const medicationId = 'med-123';
      const scheduleId = 'schedule-123';

      // No doses logged
      mockDatabase.getAllAsync.mockResolvedValue([]);

      const result = await medicationDoseRepository.wasLoggedForScheduleToday(
        medicationId,
        scheduleId,
        scheduledTime
      );

      expect(result).toBe(false);
    });

    it('should return false if medication was logged after scheduled time', async () => {
      // Set up: medication scheduled for 9:30 PM (21:30)
      const scheduledTime = '21:30';
      const medicationId = 'med-123';
      const scheduleId = 'schedule-123';

      // Create a dose logged at 10:00 PM (after scheduled time)
      // In a real scenario, the SQL query would filter this out
      // since it's after the scheduled time, so we mock an empty result
      mockDatabase.getAllAsync.mockResolvedValue([]);

      const result = await medicationDoseRepository.wasLoggedForScheduleToday(
        medicationId,
        scheduleId,
        scheduledTime
      );

      // Should return false because dose was logged after the scheduled time
      expect(result).toBe(false);
    });

    it('should only count doses with status "taken"', async () => {
      const scheduledTime = '21:30';
      const medicationId = 'med-123';
      const scheduleId = 'schedule-123';

      // Mock empty result - doses with status other than 'taken' are filtered by SQL query
      const mockRows: any[] = [];

      mockDatabase.getAllAsync.mockResolvedValue(mockRows);

      const result = await medicationDoseRepository.wasLoggedForScheduleToday(
        medicationId,
        scheduleId,
        scheduledTime
      );

      expect(result).toBe(false);
      // Verify the query includes status = 'taken' filter
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining("status = 'taken'"),
        expect.any(Array)
      );
    });

    it('should check within today\'s time boundaries', async () => {
      const scheduledTime = '09:30';
      const medicationId = 'med-123';
      const scheduleId = 'schedule-123';

      mockDatabase.getAllAsync.mockResolvedValue([]);

      await medicationDoseRepository.wasLoggedForScheduleToday(
        medicationId,
        scheduleId,
        scheduledTime
      );

      // Verify the query includes timestamp boundaries for today
      const call = mockDatabase.getAllAsync.mock.calls[0];
      expect(call[0]).toContain('timestamp >= ?');
      expect(call[0]).toContain('timestamp <= ?');

      // The parameters should include start of day and scheduled time
      const params = call[1];
      expect(params[0]).toBe(medicationId);
      expect(params[1]).toBeGreaterThan(0); // Start of today timestamp
      expect(params[2]).toBeGreaterThan(0); // Scheduled time timestamp
    });
  });
});
