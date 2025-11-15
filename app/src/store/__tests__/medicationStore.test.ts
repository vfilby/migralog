import { useMedicationStore } from '../medicationStore';
import {
  medicationRepository,
  medicationDoseRepository,
} from '../../database/medicationRepository';
import { episodeRepository } from '../../database/episodeRepository';
import { notificationService } from '../../services/notificationService';
import { Medication } from '../../models/types';
import { cacheManager } from '../../utils/cacheManager';

// Mock dependencies
jest.mock('../../database/medicationRepository');
jest.mock('../../database/episodeRepository');
jest.mock('../../services/errorLogger');
jest.mock('../../services/notificationService');

describe('medicationStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Clear cache before each test
    cacheManager.clear();

    // Reset store state
    useMedicationStore.setState({
      medications: [],
      preventativeMedications: [],
      rescueMedications: [],
      loading: false,
      error: null,
    });
  });

  describe('loadMedications', () => {
    it('should load and categorize medications', async () => {
      const mockMedications: Medication[] = [
        {
          id: 'prev-1',
          name: 'Preventative Med',
          type: 'preventative',
          dosageAmount: 100,
          dosageUnit: 'mg',
          defaultQuantity: 1,
          scheduleFrequency: 'daily',
          photoUri: undefined,
          schedule: [],
          active: true,
          notes: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'rescue-1',
          name: 'Rescue Med',
          type: 'rescue',
          dosageAmount: 200,
          dosageUnit: 'mg',
          defaultQuantity: 2,
          scheduleFrequency: undefined,
          photoUri: undefined,
          schedule: [],
          active: true,
          notes: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      (medicationRepository.getActive as jest.Mock).mockResolvedValue(mockMedications);
      (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(new Map());

      await useMedicationStore.getState().loadMedications();

      const state = useMedicationStore.getState();
      expect(state.medications).toHaveLength(2);
      expect(state.preventativeMedications).toHaveLength(1);
      expect(state.rescueMedications).toHaveLength(1);
      expect(state.preventativeMedications[0].id).toBe('prev-1');
      expect(state.rescueMedications[0].id).toBe('rescue-1');
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
    });

    it('should sort rescue medications by usage frequency', async () => {
      const mockMedications: Medication[] = [
        {
          id: 'rescue-1',
          name: 'Aspirin',
          type: 'rescue',
          dosageAmount: 100,
          dosageUnit: 'mg',
          defaultQuantity: 1,
          scheduleFrequency: undefined,
          photoUri: undefined,
          schedule: [],
          active: true,
          notes: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'rescue-2',
          name: 'Ibuprofen',
          type: 'rescue',
          dosageAmount: 200,
          dosageUnit: 'mg',
          defaultQuantity: 1,
          scheduleFrequency: undefined,
          photoUri: undefined,
          schedule: [],
          active: true,
          notes: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'rescue-3',
          name: 'Triptan',
          type: 'rescue',
          dosageAmount: 50,
          dosageUnit: 'mg',
          defaultQuantity: 1,
          scheduleFrequency: undefined,
          photoUri: undefined,
          schedule: [],
          active: true,
          notes: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const usageCounts = new Map([
        ['rescue-1', 3], // Aspirin - 3 uses
        ['rescue-2', 10], // Ibuprofen - 10 uses (most used)
        ['rescue-3', 5], // Triptan - 5 uses
      ]);

      (medicationRepository.getActive as jest.Mock).mockResolvedValue(mockMedications);
      (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(usageCounts);

      await useMedicationStore.getState().loadMedications();

      const state = useMedicationStore.getState();
      expect(state.rescueMedications).toHaveLength(3);
      // Should be sorted by usage count descending
      expect(state.rescueMedications[0].id).toBe('rescue-2'); // Ibuprofen (10 uses)
      expect(state.rescueMedications[1].id).toBe('rescue-3'); // Triptan (5 uses)
      expect(state.rescueMedications[2].id).toBe('rescue-1'); // Aspirin (3 uses)
    });

    it('should sort rescue medications alphabetically when usage counts are equal', async () => {
      const mockMedications: Medication[] = [
        {
          id: 'rescue-1',
          name: 'Zomig',
          type: 'rescue',
          dosageAmount: 100,
          dosageUnit: 'mg',
          defaultQuantity: 1,
          scheduleFrequency: undefined,
          photoUri: undefined,
          schedule: [],
          active: true,
          notes: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'rescue-2',
          name: 'Aspirin',
          type: 'rescue',
          dosageAmount: 200,
          dosageUnit: 'mg',
          defaultQuantity: 1,
          scheduleFrequency: undefined,
          photoUri: undefined,
          schedule: [],
          active: true,
          notes: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'rescue-3',
          name: 'Ibuprofen',
          type: 'rescue',
          dosageAmount: 50,
          dosageUnit: 'mg',
          defaultQuantity: 1,
          scheduleFrequency: undefined,
          photoUri: undefined,
          schedule: [],
          active: true,
          notes: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      // All have the same usage count (5)
      const usageCounts = new Map([
        ['rescue-1', 5], // Zomig
        ['rescue-2', 5], // Aspirin
        ['rescue-3', 5], // Ibuprofen
      ]);

      (medicationRepository.getActive as jest.Mock).mockResolvedValue(mockMedications);
      (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(usageCounts);

      await useMedicationStore.getState().loadMedications();

      const state = useMedicationStore.getState();
      expect(state.rescueMedications).toHaveLength(3);
      // Should be sorted alphabetically when usage counts are equal
      expect(state.rescueMedications[0].name).toBe('Aspirin');
      expect(state.rescueMedications[1].name).toBe('Ibuprofen');
      expect(state.rescueMedications[2].name).toBe('Zomig');
    });

    it('should handle errors when loading medications', async () => {
      const error = new Error('Database error');
      (medicationRepository.getActive as jest.Mock).mockRejectedValue(error);
      (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(new Map());

      await useMedicationStore.getState().loadMedications();

      const state = useMedicationStore.getState();
      expect(state.error).toBe('Database error');
      expect(state.loading).toBe(false);
    });

    it('should set loading state during load', async () => {
      (medicationRepository.getActive as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      );
      (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(new Map());

      const loadPromise = useMedicationStore.getState().loadMedications();

      expect(useMedicationStore.getState().loading).toBe(true);

      await loadPromise;

      expect(useMedicationStore.getState().loading).toBe(false);
    });
  });

  describe('addMedication', () => {
    it('should add a new medication', async () => {
      const newMed = {
        name: 'New Med',
        type: 'rescue' as const,
        dosageAmount: 500,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        scheduleFrequency: undefined,
        photoUri: undefined,
        schedule: [],
        active: true,
        notes: undefined,
      };

      const createdMed: Medication = {
        ...newMed,
        id: 'new-med-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (medicationRepository.create as jest.Mock).mockResolvedValue(createdMed);

      const result = await useMedicationStore.getState().addMedication(newMed);

      expect(result).toEqual(createdMed);
      const state = useMedicationStore.getState();
      expect(state.medications).toContainEqual(createdMed);
      expect(state.loading).toBe(false);
    });

    it('should add preventative medication to correct list', async () => {
      const preventative = {
        name: 'Preventative',
        type: 'preventative' as const,
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        scheduleFrequency: 'daily' as const,
        photoUri: undefined,
        schedule: [],
        active: true,
        notes: undefined,
      };

      const created: Medication = {
        ...preventative,
        id: 'prev-med',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (medicationRepository.create as jest.Mock).mockResolvedValue(created);

      await useMedicationStore.getState().addMedication(preventative);

      const state = useMedicationStore.getState();
      expect(state.preventativeMedications).toHaveLength(1);
      expect(state.rescueMedications).toHaveLength(0);
    });

    it('should add rescue medication to correct list', async () => {
      const rescue = {
        name: 'Rescue',
        type: 'rescue' as const,
        dosageAmount: 200,
        dosageUnit: 'mg',
        defaultQuantity: 2,
        scheduleFrequency: undefined,
        photoUri: undefined,
        schedule: [],
        active: true,
        notes: undefined,
      };

      const created: Medication = {
        ...rescue,
        id: 'rescue-med',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (medicationRepository.create as jest.Mock).mockResolvedValue(created);

      await useMedicationStore.getState().addMedication(rescue);

      const state = useMedicationStore.getState();
      expect(state.rescueMedications).toHaveLength(1);
      expect(state.preventativeMedications).toHaveLength(0);
    });

    it('should handle errors when adding medication', async () => {
      const error = new Error('Failed to add');
      (medicationRepository.create as jest.Mock).mockRejectedValue(error);

      const newMed = {
        name: 'Test',
        type: 'rescue' as const,
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: undefined,
        scheduleFrequency: undefined,
        photoUri: undefined,
        schedule: [],
        active: true,
        notes: undefined,
      };

      await expect(
        useMedicationStore.getState().addMedication(newMed)
      ).rejects.toThrow('Failed to add');

      const state = useMedicationStore.getState();
      expect(state.error).toBe('Failed to add');
      expect(state.loading).toBe(false);
    });
  });

  describe('updateMedication', () => {
    it('should update medication and reload', async () => {
      (medicationRepository.update as jest.Mock).mockResolvedValue(undefined);
      (medicationRepository.getActive as jest.Mock).mockResolvedValue([]);
      (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(new Map());

      await useMedicationStore.getState().updateMedication('med-123', { name: 'Updated' });

      expect(medicationRepository.update).toHaveBeenCalledWith('med-123', { name: 'Updated' });
      expect(medicationRepository.getActive).toHaveBeenCalled();
    });

    it('should handle errors when updating', async () => {
      const error = new Error('Update failed');
      (medicationRepository.update as jest.Mock).mockRejectedValue(error);

      await expect(
        useMedicationStore.getState().updateMedication('med-123', { name: 'Test' })
      ).rejects.toThrow('Update failed');

      expect(useMedicationStore.getState().error).toBe('Update failed');
    });
  });

  describe('deleteMedication', () => {
    it('should delete medication from all lists', async () => {
      const med1: Medication = {
        id: 'med-1',
        name: 'Med 1',
        type: 'rescue',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: undefined,
        scheduleFrequency: undefined,
        photoUri: undefined,
        schedule: [],
        active: true,
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const med2: Medication = {
        id: 'med-2',
        name: 'Med 2',
        type: 'rescue',
        dosageAmount: 200,
        dosageUnit: 'mg',
        defaultQuantity: undefined,
        scheduleFrequency: undefined,
        photoUri: undefined,
        schedule: [],
        active: true,
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useMedicationStore.setState({
        medications: [med1, med2],
        rescueMedications: [med1, med2],
        preventativeMedications: [],
      });

      (medicationRepository.delete as jest.Mock).mockResolvedValue(undefined);

      await useMedicationStore.getState().deleteMedication('med-1');

      const state = useMedicationStore.getState();
      expect(state.medications).toHaveLength(1);
      expect(state.medications[0].id).toBe('med-2');
      expect(state.rescueMedications).toHaveLength(1);
      expect(state.loading).toBe(false);
    });

    it('should handle errors when deleting', async () => {
      const error = new Error('Delete failed');
      (medicationRepository.delete as jest.Mock).mockRejectedValue(error);

      await expect(
        useMedicationStore.getState().deleteMedication('med-123')
      ).rejects.toThrow('Delete failed');

      expect(useMedicationStore.getState().error).toBe('Delete failed');
      expect(useMedicationStore.getState().loading).toBe(false);
    });
  });

  describe('archiveMedication', () => {
    it('should archive medication', async () => {
      const med: Medication = {
        id: 'med-1',
        name: 'Med 1',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        scheduleFrequency: 'daily',
        photoUri: undefined,
        schedule: [],
        active: true,
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useMedicationStore.setState({
        medications: [med],
        preventativeMedications: [med],
        rescueMedications: [],
      });

      (medicationRepository.update as jest.Mock).mockResolvedValue(undefined);
      (notificationService.rescheduleAllMedicationNotifications as jest.Mock).mockResolvedValue(undefined);

      await useMedicationStore.getState().archiveMedication('med-1');

      const state = useMedicationStore.getState();
      expect(state.medications[0].active).toBe(false);
      expect(state.preventativeMedications).toHaveLength(0);
      expect(medicationRepository.update).toHaveBeenCalledWith('med-1', { active: false });
      expect(notificationService.rescheduleAllMedicationNotifications).toHaveBeenCalled();
    });

    it('should handle errors when archiving', async () => {
      const error = new Error('Archive failed');
      (medicationRepository.update as jest.Mock).mockRejectedValue(error);

      await expect(
        useMedicationStore.getState().archiveMedication('med-123')
      ).rejects.toThrow('Archive failed');

      expect(useMedicationStore.getState().error).toBe('Archive failed');
    });
  });

  describe('unarchiveMedication', () => {
    it('should unarchive medication and reload', async () => {
      const med: Medication = {
        id: 'med-1',
        name: 'Med 1',
        type: 'rescue',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: undefined,
        scheduleFrequency: undefined,
        photoUri: undefined,
        schedule: [],
        active: false,
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useMedicationStore.setState({
        medications: [med],
        rescueMedications: [],
        preventativeMedications: [],
      });

      (medicationRepository.update as jest.Mock).mockResolvedValue(undefined);
      (medicationRepository.getActive as jest.Mock).mockResolvedValue([{ ...med, active: true }]);
      (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(new Map());

      await useMedicationStore.getState().unarchiveMedication('med-1');

      expect(medicationRepository.update).toHaveBeenCalledWith('med-1', { active: true });
      expect(medicationRepository.getActive).toHaveBeenCalled();
    });

    it('should handle errors when unarchiving', async () => {
      const error = new Error('Unarchive failed');
      (medicationRepository.update as jest.Mock).mockRejectedValue(error);

      await expect(
        useMedicationStore.getState().unarchiveMedication('med-123')
      ).rejects.toThrow('Unarchive failed');

      expect(useMedicationStore.getState().error).toBe('Unarchive failed');
    });
  });

  describe('logDose', () => {
    it('should log a medication dose with timestamp-based episode association', async () => {
      const dose = {
        medicationId: 'med-123',
        timestamp: Date.now(),
        quantity: 2,
        episodeId: 'ep-123', // This will be overridden by findEpisodeByTimestamp
        updatedAt: Date.now(),
      };

      // Mock findEpisodeByTimestamp to return an episode
      const mockEpisode = {
        id: 'ep-456',
        startTime: dose.timestamp - 1000,
        endTime: dose.timestamp + 1000,
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      (episodeRepository.findEpisodeByTimestamp as jest.Mock).mockResolvedValue(mockEpisode);

      const createdDose = {
        ...dose,
        episodeId: 'ep-456', // Should use the timestamp-based episode
        id: 'dose-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        effectivenessRating: undefined,
        timeToRelief: undefined,
        sideEffects: undefined,
        notes: undefined,
      };

      (medicationDoseRepository.create as jest.Mock).mockResolvedValue(createdDose);

      const result = await useMedicationStore.getState().logDose(dose);

      expect(result).toEqual(createdDose);
      expect(useMedicationStore.getState().loading).toBe(false);
      expect(episodeRepository.findEpisodeByTimestamp).toHaveBeenCalledWith(dose.timestamp);
      expect(medicationDoseRepository.create).toHaveBeenCalledWith({
        ...dose,
        episodeId: 'ep-456', // Should override with timestamp-based episode
        status: 'taken', // Store adds default status
      });
    });

    it('should log medication without episode when timestamp is outside episode window', async () => {
      const dose = {
        medicationId: 'med-123',
        timestamp: Date.now(),
        quantity: 1,
        episodeId: undefined,
        updatedAt: Date.now(),
      };

      // Mock findEpisodeByTimestamp to return null (no episode found)
      (episodeRepository.findEpisodeByTimestamp as jest.Mock).mockResolvedValue(null);

      const createdDose = {
        ...dose,
        episodeId: undefined, // No episode found
        id: 'dose-124',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        effectivenessRating: undefined,
        timeToRelief: undefined,
        sideEffects: undefined,
        notes: undefined,
      };

      (medicationDoseRepository.create as jest.Mock).mockResolvedValue(createdDose);

      const result = await useMedicationStore.getState().logDose(dose);

      expect(result).toEqual(createdDose);
      expect(episodeRepository.findEpisodeByTimestamp).toHaveBeenCalledWith(dose.timestamp);
      expect(medicationDoseRepository.create).toHaveBeenCalledWith({
        ...dose,
        episodeId: undefined,
        status: 'taken',
      });
    });

    it('should ignore passed episodeId when no episode found for timestamp', async () => {
      const dose = {
        medicationId: 'med-123',
        timestamp: Date.now(),
        quantity: 1.5,
        episodeId: 'ep-999', // This stale/invalid episodeId should be ignored
        updatedAt: Date.now(),
      };

      // Mock findEpisodeByTimestamp to return null (no episode found for this timestamp)
      (episodeRepository.findEpisodeByTimestamp as jest.Mock).mockResolvedValue(null);

      const createdDose = {
        ...dose,
        episodeId: undefined, // Should override passed episodeId with undefined
        id: 'dose-125',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        effectivenessRating: undefined,
        timeToRelief: undefined,
        sideEffects: undefined,
        notes: undefined,
      };

      (medicationDoseRepository.create as jest.Mock).mockResolvedValue(createdDose);

      const result = await useMedicationStore.getState().logDose(dose);

      expect(result).toEqual(createdDose);
      expect(episodeRepository.findEpisodeByTimestamp).toHaveBeenCalledWith(dose.timestamp);
      expect(medicationDoseRepository.create).toHaveBeenCalledWith({
        ...dose,
        episodeId: undefined, // Passed 'ep-999' should be completely ignored
        status: 'taken',
      });
    });

    it('should handle errors when logging dose', async () => {
      const error = new Error('Failed to log dose');
      (episodeRepository.findEpisodeByTimestamp as jest.Mock).mockResolvedValue(null);
      (medicationDoseRepository.create as jest.Mock).mockRejectedValue(error);

      const dose = {
        medicationId: 'med-123',
        timestamp: Date.now(),
        quantity: 1,
        episodeId: undefined,
        updatedAt: Date.now(),
      };

      await expect(
        useMedicationStore.getState().logDose(dose)
      ).rejects.toThrow('Failed to log dose');

      expect(useMedicationStore.getState().error).toBe('Failed to log dose');
      expect(useMedicationStore.getState().loading).toBe(false);
    });
  });

  describe('updateDose', () => {
    it('should update dose', async () => {
      (medicationDoseRepository.update as jest.Mock).mockResolvedValue(undefined);

      await useMedicationStore.getState().updateDose('dose-123', { effectivenessRating: 8 });

      expect(medicationDoseRepository.update).toHaveBeenCalledWith('dose-123', {
        effectivenessRating: 8,
      });
    });

    it('should handle errors when updating dose', async () => {
      const error = new Error('Update failed');
      (medicationDoseRepository.update as jest.Mock).mockRejectedValue(error);

      await expect(
        useMedicationStore.getState().updateDose('dose-123', { effectivenessRating: 7 })
      ).rejects.toThrow('Update failed');

      expect(useMedicationStore.getState().error).toBe('Update failed');
    });
  });

  describe('deleteDose', () => {
    it('should delete dose', async () => {
      (medicationDoseRepository.delete as jest.Mock).mockResolvedValue(undefined);

      await useMedicationStore.getState().deleteDose('dose-123');

      expect(medicationDoseRepository.delete).toHaveBeenCalledWith('dose-123');
    });

    it('should handle errors when deleting dose', async () => {
      const error = new Error('Delete failed');
      (medicationDoseRepository.delete as jest.Mock).mockRejectedValue(error);

      await expect(
        useMedicationStore.getState().deleteDose('dose-123')
      ).rejects.toThrow('Delete failed');

      expect(useMedicationStore.getState().error).toBe('Delete failed');
    });
  });

  describe('loadSchedules', () => {
    beforeEach(() => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      mockScheduleRepository.getByMedicationId = jest.fn();
    });

    it('should load schedules for specific medication', async () => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      const mockSchedules = [
        {
          id: 'schedule-1',
          medicationId: 'med-1',
          time: '09:00',
          enabled: true,
          timezone: 'America/Los_Angeles',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      mockScheduleRepository.getByMedicationId.mockResolvedValue(mockSchedules);

      await useMedicationStore.getState().loadSchedules('med-1');

      expect(mockScheduleRepository.getByMedicationId).toHaveBeenCalledWith('med-1');
      expect(useMedicationStore.getState().schedules).toEqual(mockSchedules);
    });

    it('should load all schedules when no medication ID provided', async () => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      const mockMeds: Medication[] = [
        {
          id: 'med-1',
          name: 'Med 1',
          type: 'preventative',
          dosageAmount: 100,
          dosageUnit: 'mg',
          defaultQuantity: 1,
          scheduleFrequency: 'daily',
          photoUri: undefined,
          schedule: [],
          active: true,
          notes: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'med-2',
          name: 'Med 2',
          type: 'preventative',
          dosageAmount: 200,
          dosageUnit: 'mg',
          defaultQuantity: 1,
          scheduleFrequency: 'daily',
          photoUri: undefined,
          schedule: [],
          active: true,
          notes: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const mockSchedules1 = [
        {
          id: 'schedule-1',
          medicationId: 'med-1',
          time: '09:00',
          enabled: true,
          timezone: 'America/Los_Angeles',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const mockSchedules2 = [
        {
          id: 'schedule-2',
          medicationId: 'med-2',
          time: '21:00',
          enabled: true,
          timezone: 'America/Los_Angeles',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      useMedicationStore.setState({ medications: mockMeds });
      mockScheduleRepository.getByMedicationId
        .mockResolvedValueOnce(mockSchedules1)
        .mockResolvedValueOnce(mockSchedules2);

      await useMedicationStore.getState().loadSchedules();

      expect(mockScheduleRepository.getByMedicationId).toHaveBeenCalledTimes(2);
      expect(useMedicationStore.getState().schedules).toHaveLength(2);
    });

    it('should handle errors when loading schedules', async () => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      const error = new Error('Failed to load schedules');
      mockScheduleRepository.getByMedicationId.mockRejectedValue(error);

      await expect(
        useMedicationStore.getState().loadSchedules('med-1')
      ).rejects.toThrow('Failed to load schedules');

      expect(useMedicationStore.getState().error).toBe('Failed to load schedules');
    });
  });

  describe('loadRecentDoses', () => {
    it('should load doses from past 7 days by default', async () => {
      const now = Date.now();
      const mockMeds: Medication[] = [
        {
          id: 'med-1',
          name: 'Med 1',
          type: 'rescue',
          dosageAmount: 100,
          dosageUnit: 'mg',
          defaultQuantity: 1,
          scheduleFrequency: undefined,
          photoUri: undefined,
          schedule: [],
          active: true,
          notes: undefined,
          createdAt: now,
          updatedAt: now,
        },
      ];

      const mockDoses = [
        {
          id: 'dose-1',
          medicationId: 'med-1',
          timestamp: now - 2 * 24 * 60 * 60 * 1000, // 2 days ago
          quantity: 1,
          status: 'taken' as const,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'dose-2',
          medicationId: 'med-1',
          timestamp: now - 5 * 24 * 60 * 60 * 1000, // 5 days ago
          quantity: 1,
          status: 'taken' as const,
          createdAt: now,
          updatedAt: now,
        },
      ];

      useMedicationStore.setState({ medications: mockMeds });
      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue(mockDoses);

      await useMedicationStore.getState().loadRecentDoses();

      expect(medicationDoseRepository.getByMedicationId).toHaveBeenCalledWith('med-1');
      expect(useMedicationStore.getState().doses).toHaveLength(2);
      expect(useMedicationStore.getState().doses[0].id).toBe('dose-1'); // Most recent first
      expect(useMedicationStore.getState().doses[1].id).toBe('dose-2');
    });

    it('should load doses from custom number of days', async () => {
      const now = Date.now();
      const mockMeds: Medication[] = [
        {
          id: 'med-1',
          name: 'Med 1',
          type: 'rescue',
          dosageAmount: 100,
          dosageUnit: 'mg',
          defaultQuantity: 1,
          scheduleFrequency: undefined,
          photoUri: undefined,
          schedule: [],
          active: true,
          notes: undefined,
          createdAt: now,
          updatedAt: now,
        },
      ];

      const mockDoses = [
        {
          id: 'dose-1',
          medicationId: 'med-1',
          timestamp: now - 15 * 24 * 60 * 60 * 1000, // 15 days ago (should be filtered)
          quantity: 1,
          status: 'taken' as const,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'dose-2',
          medicationId: 'med-1',
          timestamp: now - 20 * 24 * 60 * 60 * 1000, // 20 days ago
          quantity: 1,
          status: 'taken' as const,
          createdAt: now,
          updatedAt: now,
        },
      ];

      useMedicationStore.setState({ medications: mockMeds });
      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue(mockDoses);

      await useMedicationStore.getState().loadRecentDoses(30);

      expect(useMedicationStore.getState().doses).toHaveLength(2);
    });

    it('should handle errors when loading doses', async () => {
      const error = new Error('Failed to load doses');
      useMedicationStore.setState({
        medications: [
          {
            id: 'med-1',
            name: 'Med 1',
            type: 'rescue',
            dosageAmount: 100,
            dosageUnit: 'mg',
            defaultQuantity: 1,
            scheduleFrequency: undefined,
            photoUri: undefined,
            schedule: [],
            active: true,
            notes: undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      });
      (medicationDoseRepository.getByMedicationId as jest.Mock).mockRejectedValue(error);

      await expect(
        useMedicationStore.getState().loadRecentDoses()
      ).rejects.toThrow('Failed to load doses');

      expect(useMedicationStore.getState().error).toBe('Failed to load doses');
    });
  });

  describe('loadMedications with cache', () => {
    it('should use cached medications when available', async () => {
      const mockMedications: Medication[] = [
        {
          id: 'rescue-1',
          name: 'Rescue Med',
          type: 'rescue',
          dosageAmount: 100,
          dosageUnit: 'mg',
          defaultQuantity: 1,
          scheduleFrequency: undefined,
          photoUri: undefined,
          schedule: [],
          active: true,
          notes: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      // Set cache
      cacheManager.set('medications', mockMedications);

      const usageCounts = new Map([['rescue-1', 5]]);
      (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(usageCounts);

      await useMedicationStore.getState().loadMedications();

      // Should not call repository when cache is available
      expect(medicationRepository.getActive).not.toHaveBeenCalled();
      expect(useMedicationStore.getState().medications).toEqual(mockMedications);
      expect(useMedicationStore.getState().loading).toBe(false);
    });

    it('should sort cached rescue medications by usage frequency', async () => {
      const mockMedications: Medication[] = [
        {
          id: 'rescue-1',
          name: 'Zomig',
          type: 'rescue',
          dosageAmount: 100,
          dosageUnit: 'mg',
          defaultQuantity: 1,
          scheduleFrequency: undefined,
          photoUri: undefined,
          schedule: [],
          active: true,
          notes: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'rescue-2',
          name: 'Aspirin',
          type: 'rescue',
          dosageAmount: 500,
          dosageUnit: 'mg',
          defaultQuantity: 2,
          scheduleFrequency: undefined,
          photoUri: undefined,
          schedule: [],
          active: true,
          notes: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      // Set cache
      cacheManager.set('medications', mockMedications);

      // Aspirin used more than Zomig
      const usageCounts = new Map([
        ['rescue-1', 2],
        ['rescue-2', 10],
      ]);
      (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(usageCounts);

      await useMedicationStore.getState().loadMedications();

      const state = useMedicationStore.getState();
      expect(state.rescueMedications).toHaveLength(2);
      expect(state.rescueMedications[0].name).toBe('Aspirin'); // Most used first
      expect(state.rescueMedications[1].name).toBe('Zomig');
    });

    it('should sort cached rescue medications alphabetically when usage counts are equal', async () => {
      const mockMedications: Medication[] = [
        {
          id: 'rescue-1',
          name: 'Zomig',
          type: 'rescue',
          dosageAmount: 100,
          dosageUnit: 'mg',
          defaultQuantity: 1,
          scheduleFrequency: undefined,
          photoUri: undefined,
          schedule: [],
          active: true,
          notes: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'rescue-2',
          name: 'Aspirin',
          type: 'rescue',
          dosageAmount: 500,
          dosageUnit: 'mg',
          defaultQuantity: 2,
          scheduleFrequency: undefined,
          photoUri: undefined,
          schedule: [],
          active: true,
          notes: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'rescue-3',
          name: 'Ibuprofen',
          type: 'rescue',
          dosageAmount: 400,
          dosageUnit: 'mg',
          defaultQuantity: 2,
          scheduleFrequency: undefined,
          photoUri: undefined,
          schedule: [],
          active: true,
          notes: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      // Set cache
      cacheManager.set('medications', mockMedications);

      // All have equal usage counts
      const usageCounts = new Map([
        ['rescue-1', 5],
        ['rescue-2', 5],
        ['rescue-3', 5],
      ]);
      (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(usageCounts);

      await useMedicationStore.getState().loadMedications();

      const state = useMedicationStore.getState();
      expect(state.rescueMedications).toHaveLength(3);
      // Should be sorted alphabetically when usage counts are equal
      expect(state.rescueMedications[0].name).toBe('Aspirin');
      expect(state.rescueMedications[1].name).toBe('Ibuprofen');
      expect(state.rescueMedications[2].name).toBe('Zomig');
    });
  });

  describe('unarchiveMedication - preventative with schedules', () => {
    beforeEach(() => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      mockScheduleRepository.getByMedicationId = jest.fn();
      mockScheduleRepository.update = jest.fn();
    });

    it('should reschedule notifications for preventative medication with schedules', async () => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      const preventativeMed: Medication = {
        id: 'med-1',
        name: 'Preventative Med',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        scheduleFrequency: 'daily',
        photoUri: undefined,
        schedule: [],
        active: false,
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const mockSchedules = [
        {
          id: 'schedule-1',
          medicationId: 'med-1',
          time: '09:00',
          enabled: true,
          timezone: 'America/Los_Angeles',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      (medicationRepository.update as jest.Mock).mockResolvedValue(undefined);
      (medicationRepository.getById as jest.Mock).mockResolvedValue({ ...preventativeMed, active: true });
      (medicationRepository.getActive as jest.Mock).mockResolvedValue([{ ...preventativeMed, active: true }]);
      mockScheduleRepository.getByMedicationId.mockResolvedValue(mockSchedules);
      (notificationService.getPermissions as jest.Mock).mockResolvedValue({ granted: true });
      (notificationService.scheduleNotification as jest.Mock).mockResolvedValue('notif-123');
      (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(new Map());

      await useMedicationStore.getState().unarchiveMedication('med-1');

      expect(notificationService.scheduleNotification).toHaveBeenCalledWith(
        { ...preventativeMed, active: true },
        mockSchedules[0]
      );
      expect(mockScheduleRepository.update).toHaveBeenCalledWith('schedule-1', {
        notificationId: 'notif-123',
      });
    });

    it('should not reschedule notifications when permissions not granted', async () => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      const preventativeMed: Medication = {
        id: 'med-1',
        name: 'Preventative Med',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        scheduleFrequency: 'daily',
        photoUri: undefined,
        schedule: [],
        active: false,
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const mockSchedules = [
        {
          id: 'schedule-1',
          medicationId: 'med-1',
          time: '09:00',
          enabled: true,
          timezone: 'America/Los_Angeles',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      (medicationRepository.update as jest.Mock).mockResolvedValue(undefined);
      (medicationRepository.getById as jest.Mock).mockResolvedValue({ ...preventativeMed, active: true });
      (medicationRepository.getActive as jest.Mock).mockResolvedValue([{ ...preventativeMed, active: true }]);
      mockScheduleRepository.getByMedicationId.mockResolvedValue(mockSchedules);
      (notificationService.getPermissions as jest.Mock).mockResolvedValue({ granted: false });
      (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(new Map());

      await useMedicationStore.getState().unarchiveMedication('med-1');

      expect(notificationService.scheduleNotification).not.toHaveBeenCalled();
    });

    it('should handle notification scheduling errors gracefully', async () => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      const preventativeMed: Medication = {
        id: 'med-1',
        name: 'Preventative Med',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        scheduleFrequency: 'daily',
        photoUri: undefined,
        schedule: [],
        active: false,
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const mockSchedules = [
        {
          id: 'schedule-1',
          medicationId: 'med-1',
          time: '09:00',
          enabled: true,
          timezone: 'America/Los_Angeles',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      (medicationRepository.update as jest.Mock).mockResolvedValue(undefined);
      (medicationRepository.getById as jest.Mock).mockResolvedValue({ ...preventativeMed, active: true });
      (medicationRepository.getActive as jest.Mock).mockResolvedValue([{ ...preventativeMed, active: true }]);
      mockScheduleRepository.getByMedicationId.mockResolvedValue(mockSchedules);
      (notificationService.getPermissions as jest.Mock).mockResolvedValue({ granted: true });
      (notificationService.scheduleNotification as jest.Mock).mockRejectedValue(new Error('Notification error'));
      (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(new Map());

      // Should not throw - error is caught and logged
      await expect(
        useMedicationStore.getState().unarchiveMedication('med-1')
      ).resolves.not.toThrow();
    });
  });

  describe('state management', () => {
    it('should have correct initial state', () => {
      const state = useMedicationStore.getState();

      expect(state.medications).toEqual([]);
      expect(state.preventativeMedications).toEqual([]);
      expect(state.rescueMedications).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
    });

    it('should maintain state across multiple operations', async () => {
      const mockMeds: Medication[] = [
        {
          id: 'med-1',
          name: 'Med 1',
          type: 'rescue',
          dosageAmount: 100,
          dosageUnit: 'mg',
          defaultQuantity: undefined,
          scheduleFrequency: undefined,
          photoUri: undefined,
          schedule: [],
          active: true,
          notes: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      (medicationRepository.getActive as jest.Mock).mockResolvedValue(mockMeds);
      (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(new Map());
      await useMedicationStore.getState().loadMedications();

      expect(useMedicationStore.getState().medications).toHaveLength(1);
      expect(useMedicationStore.getState().error).toBe(null);
    });
  });

});
