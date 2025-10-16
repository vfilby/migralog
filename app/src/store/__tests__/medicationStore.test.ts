import { useMedicationStore } from '../medicationStore';
import {
  medicationRepository,
  medicationDoseRepository,
} from '../../database/medicationRepository';
import { episodeRepository } from '../../database/episodeRepository';
import { Medication } from '../../models/types';

// Mock dependencies
jest.mock('../../database/medicationRepository');
jest.mock('../../database/episodeRepository');
jest.mock('../../services/errorLogger');

describe('medicationStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();

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
          defaultDosage: 1,
          scheduleFrequency: 'daily',
          photoUri: undefined,
          schedule: [],
          startDate: undefined,
          endDate: undefined,
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
          defaultDosage: 2,
          scheduleFrequency: undefined,
          photoUri: undefined,
          schedule: [],
          startDate: undefined,
          endDate: undefined,
          active: true,
          notes: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      (medicationRepository.getActive as jest.Mock).mockResolvedValue(mockMedications);

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

    it('should handle errors when loading medications', async () => {
      const error = new Error('Database error');
      (medicationRepository.getActive as jest.Mock).mockRejectedValue(error);

      await useMedicationStore.getState().loadMedications();

      const state = useMedicationStore.getState();
      expect(state.error).toBe('Database error');
      expect(state.loading).toBe(false);
    });

    it('should set loading state during load', async () => {
      (medicationRepository.getActive as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      );

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
        defaultDosage: 1,
        scheduleFrequency: undefined,
        photoUri: undefined,
        schedule: [],
        startDate: undefined,
        endDate: undefined,
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
        defaultDosage: 1,
        scheduleFrequency: 'daily' as const,
        photoUri: undefined,
        schedule: [],
        startDate: undefined,
        endDate: undefined,
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
        defaultDosage: 2,
        scheduleFrequency: undefined,
        photoUri: undefined,
        schedule: [],
        startDate: undefined,
        endDate: undefined,
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
        defaultDosage: undefined,
        scheduleFrequency: undefined,
        photoUri: undefined,
        schedule: [],
        startDate: undefined,
        endDate: undefined,
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
        defaultDosage: undefined,
        scheduleFrequency: undefined,
        photoUri: undefined,
        schedule: [],
        startDate: undefined,
        endDate: undefined,
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
        defaultDosage: undefined,
        scheduleFrequency: undefined,
        photoUri: undefined,
        schedule: [],
        startDate: undefined,
        endDate: undefined,
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
        defaultDosage: 1,
        scheduleFrequency: 'daily',
        photoUri: undefined,
        schedule: [],
        startDate: undefined,
        endDate: undefined,
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

      await useMedicationStore.getState().archiveMedication('med-1');

      const state = useMedicationStore.getState();
      expect(state.medications[0].active).toBe(false);
      expect(state.preventativeMedications).toHaveLength(0);
      expect(medicationRepository.update).toHaveBeenCalledWith('med-1', { active: false });
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
        defaultDosage: undefined,
        scheduleFrequency: undefined,
        photoUri: undefined,
        schedule: [],
        startDate: undefined,
        endDate: undefined,
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
        amount: 2,
        episodeId: 'ep-123', // This will be overridden by findEpisodeByTimestamp
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
        amount: 1,
        episodeId: undefined,
      };

      // Mock findEpisodeByTimestamp to return null (no episode found)
      (episodeRepository.findEpisodeByTimestamp as jest.Mock).mockResolvedValue(null);

      const createdDose = {
        ...dose,
        episodeId: undefined, // No episode found
        id: 'dose-124',
        createdAt: Date.now(),
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
        amount: 1.5,
        episodeId: 'ep-999', // This stale/invalid episodeId should be ignored
      };

      // Mock findEpisodeByTimestamp to return null (no episode found for this timestamp)
      (episodeRepository.findEpisodeByTimestamp as jest.Mock).mockResolvedValue(null);

      const createdDose = {
        ...dose,
        episodeId: undefined, // Should override passed episodeId with undefined
        id: 'dose-125',
        createdAt: Date.now(),
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
        amount: 1,
        episodeId: undefined,
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
          defaultDosage: undefined,
          scheduleFrequency: undefined,
          photoUri: undefined,
          schedule: [],
          startDate: undefined,
          endDate: undefined,
          active: true,
          notes: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      (medicationRepository.getActive as jest.Mock).mockResolvedValue(mockMeds);
      await useMedicationStore.getState().loadMedications();

      expect(useMedicationStore.getState().medications).toHaveLength(1);
      expect(useMedicationStore.getState().error).toBe(null);
    });
  });
});
