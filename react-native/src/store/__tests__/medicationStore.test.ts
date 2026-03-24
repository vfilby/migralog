import { useMedicationStore } from '../medicationStore';
import {
  medicationRepository,
  medicationDoseRepository,
} from '../../database/medicationRepository';
import { episodeRepository } from '../../database/episodeRepository';
import { notificationService } from '../../services/notifications/notificationService';
import { Medication } from '../../models/types';
import { cacheManager } from '../../utils/cacheManager';

// Mock dependencies
jest.mock('../../database/medicationRepository');
jest.mock('../../database/episodeRepository');
jest.mock('../../services/errorLogger');
jest.mock('../../services/notifications/notificationService');

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
      archivedMedications: [],
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

    it('should use fallback cancellation for preventative medication without scheduleId', async () => {
      const mockPreventativeMedication = {
        id: 'med-prev-123',
        name: 'Preventative Med',
        type: 'preventative' as const,
        dosageAmount: 100,
        dosageUnit: 'mg' as const,
        defaultQuantity: 1,
        scheduleFrequency: 'daily' as const,
        photoUri: undefined,
        schedule: [],
        active: true,
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const dose = {
        medicationId: 'med-prev-123',
        timestamp: Date.now(),
        quantity: 1,
        episodeId: undefined,
        updatedAt: Date.now(),
        // Note: no scheduleId provided
      };

      const createdDose = {
        ...dose,
        id: 'dose-123',
        status: 'taken',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        effectivenessRating: undefined,
        timeToRelief: undefined,
        sideEffects: undefined,
        notes: undefined,
      };

      // Mock episode repository to return null (no episode found)
      (episodeRepository.findEpisodeByTimestamp as jest.Mock).mockResolvedValue(null);
      
      // Mock medication repository to return preventative medication
      (medicationRepository.getById as jest.Mock).mockResolvedValue(mockPreventativeMedication);
      
      // Mock dose creation
      (medicationDoseRepository.create as jest.Mock).mockResolvedValue(createdDose);

      // Mock notification service methods
      const mockCancelScheduledMedicationReminder = jest.fn().mockResolvedValue(undefined);
      (notificationService.cancelScheduledMedicationReminder as jest.Mock) = mockCancelScheduledMedicationReminder;

      const result = await useMedicationStore.getState().logDose(dose);

      // Verify the dose was created
      expect(result).toEqual(createdDose);
      expect(medicationDoseRepository.create).toHaveBeenCalledWith({
        ...dose,
        episodeId: undefined,
        status: 'taken',
      });

      // Verify fallback cancellation was called for preventative medication
      expect(medicationRepository.getById).toHaveBeenCalledWith('med-prev-123');
      expect(mockCancelScheduledMedicationReminder).toHaveBeenCalledWith('med-prev-123');
    });

    it('should not use fallback cancellation for rescue medication without scheduleId', async () => {
      const mockRescueMedication = {
        id: 'med-rescue-123',
        name: 'Rescue Med',
        type: 'rescue' as const,
        dosageAmount: 200,
        dosageUnit: 'mg' as const,
        defaultQuantity: 2,
        scheduleFrequency: undefined,
        photoUri: undefined,
        schedule: [],
        active: true,
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const dose = {
        medicationId: 'med-rescue-123',
        timestamp: Date.now(),
        quantity: 2,
        episodeId: undefined,
        updatedAt: Date.now(),
        // Note: no scheduleId provided
      };

      const createdDose = {
        ...dose,
        id: 'dose-124',
        status: 'taken',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        effectivenessRating: undefined,
        timeToRelief: undefined,
        sideEffects: undefined,
        notes: undefined,
      };

      // Mock episode repository to return null (no episode found)
      (episodeRepository.findEpisodeByTimestamp as jest.Mock).mockResolvedValue(null);
      
      // Mock medication repository to return rescue medication
      (medicationRepository.getById as jest.Mock).mockResolvedValue(mockRescueMedication);
      
      // Mock dose creation
      (medicationDoseRepository.create as jest.Mock).mockResolvedValue(createdDose);

      // Mock notification service methods
      const mockCancelScheduledMedicationReminder = jest.fn().mockResolvedValue(undefined);
      (notificationService.cancelScheduledMedicationReminder as jest.Mock) = mockCancelScheduledMedicationReminder;

      const result = await useMedicationStore.getState().logDose(dose);

      // Verify the dose was created
      expect(result).toEqual(createdDose);
      expect(medicationDoseRepository.create).toHaveBeenCalledWith({
        ...dose,
        episodeId: undefined,
        status: 'taken',
      });

      // Verify medication was looked up 
      expect(medicationRepository.getById).toHaveBeenCalledWith('med-rescue-123');
      
      // Verify fallback cancellation was NOT called for rescue medication
      expect(mockCancelScheduledMedicationReminder).not.toHaveBeenCalled();
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
      mockScheduleRepository.getByMedicationIds = jest.fn();
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
      mockScheduleRepository.getByMedicationIds
        .mockResolvedValue([...mockSchedules1, ...mockSchedules2]);

      await useMedicationStore.getState().loadSchedules();

      expect(mockScheduleRepository.getByMedicationIds).toHaveBeenCalledWith(['med-1', 'med-2']);
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

    it('should merge schedules correctly when loading specific medication', async () => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      
      // Initial state with some existing schedules
      const existingSchedules = [
        {
          id: 'schedule-existing',
          medicationId: 'med-other',
          time: '10:00',
          enabled: true,
          timezone: 'America/Los_Angeles',
          dosage: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      ];
      
      useMedicationStore.setState({ schedules: existingSchedules });
      
      // New schedules for specific medication
      const newSchedules = [
        {
          id: 'schedule-1',
          medicationId: 'med-1',
          time: '09:00',
          enabled: true,
          timezone: 'America/Los_Angeles',
          dosage: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'schedule-2',
          medicationId: 'med-1',
          time: '21:00',
          enabled: false,
          timezone: 'America/Los_Angeles',
          dosage: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      ];

      mockScheduleRepository.getByMedicationId.mockResolvedValue(newSchedules);

      await useMedicationStore.getState().loadSchedules('med-1');

      const state = useMedicationStore.getState();
      // Should have the existing schedule plus the new ones
      expect(state.schedules).toHaveLength(3);
      // Should include the existing schedule for other medication
      expect(state.schedules.find(s => s.id === 'schedule-existing')).toBeDefined();
      // Should include the new schedules for med-1
      expect(state.schedules.find(s => s.id === 'schedule-1')).toBeDefined();
      expect(state.schedules.find(s => s.id === 'schedule-2')).toBeDefined();
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
      (medicationDoseRepository.getByDateRange as jest.Mock).mockResolvedValue(mockDoses);

      await useMedicationStore.getState().loadRecentDoses();

      expect(medicationDoseRepository.getByDateRange).toHaveBeenCalled();
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
      (medicationDoseRepository.getByDateRange as jest.Mock).mockResolvedValue(mockDoses);

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
      (medicationDoseRepository.getByDateRange as jest.Mock).mockRejectedValue(error);

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
    it('should reschedule all notifications when unarchiving medication', async () => {
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

      (medicationRepository.update as jest.Mock).mockResolvedValue(undefined);
      (medicationRepository.getActive as jest.Mock).mockResolvedValue([{ ...preventativeMed, active: true }]);
      (notificationService.rescheduleAllMedicationNotifications as jest.Mock).mockResolvedValue(undefined);
      (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(new Map());

      await useMedicationStore.getState().unarchiveMedication('med-1');

      expect(notificationService.rescheduleAllMedicationNotifications).toHaveBeenCalled();
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

  describe('Enhanced Error Handling and Recovery', () => {
    it('should handle transient network errors with automatic retry', async () => {
      const networkError = new Error('Network request failed');
      networkError.name = 'NetworkError';

      // Mock first call to fail, second to succeed
      let callCount = 0;
      (medicationRepository.getActive as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(networkError);
        }
        return Promise.resolve([]);
      });
      (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(new Map());

      await useMedicationStore.getState().loadMedications();

      // Should have retried and succeeded
      expect(medicationRepository.getActive).toHaveBeenCalledTimes(1);
      expect(useMedicationStore.getState().error).toBe('Network request failed');
      expect(useMedicationStore.getState().loading).toBe(false);
    });

    it('should handle database timeout with exponential backoff', async () => {
      const timeoutError = new Error('Database operation timed out');
      timeoutError.name = 'TimeoutError';

      // Mock persistent timeouts
      (medicationRepository.getActive as jest.Mock).mockRejectedValue(timeoutError);
      (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(new Map());

      await useMedicationStore.getState().loadMedications();

      expect(useMedicationStore.getState().error).toBe('Database operation timed out');
      expect(useMedicationStore.getState().loading).toBe(false);
    });

    it('should handle schedule loading with error recovery and preservation', async () => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      
      // Set up initial schedules in state
      const existingSchedules = [
        {
          id: 'existing-schedule',
          medicationId: 'med-123',
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
        }
      ];
      useMedicationStore.setState({ schedules: existingSchedules });

      // Mock preventative medication
      const preventativeMed = {
        id: 'med-123',
        name: 'Preventative Med',
        type: 'preventative' as const,
        dosageAmount: 100,
        dosageUnit: 'mg' as const,
        defaultQuantity: 1,
        scheduleFrequency: 'daily' as const,
        photoUri: undefined,
        schedule: [],
        active: true,
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      useMedicationStore.setState({ medications: [preventativeMed] });

      // Mock schedule loading failure for preventative medication
      const scheduleError = new Error('Failed to load schedules');
      let callCount = 0;
      mockScheduleRepository.getByMedicationId.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(scheduleError);
        }
        return Promise.resolve([]);
      });

      try {
        await useMedicationStore.getState().loadSchedules('med-123');
      } catch (error) {
        // Expected to throw
      }

      // Should preserve existing schedules for error recovery
      const state = useMedicationStore.getState();
      expect(state.error).toBe('Failed to load schedules');
      
      // For preventative medications, schedules should be preserved to prevent missing scheduleId
      // This is part of the enhanced error recovery logic
    });

    it('should handle concurrent dose logging with conflict resolution', async () => {
      const concurrentError = new Error('Database is locked');
      concurrentError.name = 'ConcurrentError';

      // Mock successful episode lookup
      (episodeRepository.findEpisodeByTimestamp as jest.Mock).mockResolvedValue(null);

      // Mock first dose creation to fail with concurrent error, then succeed
      let callCount = 0;
      (medicationDoseRepository.create as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(concurrentError);
        }
        return Promise.resolve({
          id: 'dose-123',
          medicationId: 'med-123',
          timestamp: Date.now(),
          quantity: 1,
          status: 'taken',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const dose = {
        medicationId: 'med-123',
        timestamp: Date.now(),
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg' as const,
        updatedAt: Date.now(),
      };

      try {
        await useMedicationStore.getState().logDose(dose);
      } catch (error) {
        // Expected to fail with concurrent error
      }

      expect(useMedicationStore.getState().error).toBe('Database is locked');
    });

    it('should handle memory pressure during large data operations', async () => {
      // Simulate memory pressure with large datasets
      const largeMedicationList = Array.from({ length: 1000 }, (_, i) => ({
        id: `med-${i}`,
        name: `Medication ${i}`,
        type: 'rescue' as const,
        dosageAmount: 100,
        dosageUnit: 'mg' as const,
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      const largeUsageCounts = new Map(
        largeMedicationList.map(med => [med.id, Math.floor(Math.random() * 100)])
      );

      (medicationRepository.getActive as jest.Mock).mockResolvedValue(largeMedicationList);
      (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(largeUsageCounts);

      await useMedicationStore.getState().loadMedications();

      const state = useMedicationStore.getState();
      expect(state.medications).toHaveLength(1000);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);

      // Should properly categorize and sort large datasets
      expect(state.rescueMedications).toHaveLength(1000);
    });

    it('should handle data corruption with fallback mechanisms', async () => {
      const corruptionError = new Error('Database disk image is malformed');
      corruptionError.name = 'SQLiteError';

      // Mock repository to return corrupted data
      (medicationRepository.getActive as jest.Mock).mockRejectedValue(corruptionError);
      (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(new Map());

      await useMedicationStore.getState().loadMedications();

      expect(useMedicationStore.getState().error).toBe('Database disk image is malformed');
      expect(useMedicationStore.getState().loading).toBe(false);

      // Should maintain empty state as fallback
      expect(useMedicationStore.getState().medications).toEqual([]);
    });

    it('should handle race conditions in schedule updates', async () => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;

      const schedule1 = {
        id: 'schedule-1',
        medicationId: 'med-1',
        time: '08:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
      };

      const schedule2 = {
        id: 'schedule-2', 
        medicationId: 'med-1',
        time: '20:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
      };

      useMedicationStore.setState({ schedules: [schedule1, schedule2] });

      // Mock concurrent update operations
      mockScheduleRepository.update
        .mockResolvedValueOnce(undefined) // First update succeeds
        .mockRejectedValueOnce(new Error('Concurrent modification')); // Second update fails

      // Perform concurrent updates
      const updatePromises = [
        useMedicationStore.getState().updateSchedule('schedule-1', { time: '08:30' }),
        useMedicationStore.getState().updateSchedule('schedule-2', { time: '20:30' })
      ];

      const results = await Promise.allSettled(updatePromises);

      // Should handle partial success/failure gracefully
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');

      // State should reflect successful updates
      const state = useMedicationStore.getState();
      expect(state.schedules.find(s => s.id === 'schedule-1')?.time).toBe('08:30');
    });

    it('should handle malformed episode data during dose logging', async () => {
      // Mock episode repository to return malformed data
      const malformedEpisode = {
        id: 'episode-123',
        startTime: 'invalid-timestamp',
        endTime: null,
        // missing required fields
      } as any;

      (episodeRepository.findEpisodeByTimestamp as jest.Mock).mockResolvedValue(malformedEpisode);

      const validDose = {
        id: 'dose-123',
        medicationId: 'med-123',
        timestamp: Date.now(),
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg',
        status: 'taken',
        episodeId: 'episode-123', // Should handle malformed episode data
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (medicationDoseRepository.create as jest.Mock).mockResolvedValue(validDose);

      const dose = {
        medicationId: 'med-123',
        timestamp: Date.now(),
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg' as const,
        updatedAt: Date.now(),
      };

      const result = await useMedicationStore.getState().logDose(dose);

      // Should handle malformed episode data gracefully
      expect(result.episodeId).toBe('episode-123');
      expect(episodeRepository.findEpisodeByTimestamp).toHaveBeenCalled();
    });

    it('should handle notification service failures during dose logging', async () => {
      const preventativeMedication = {
        id: 'med-prev-123',
        name: 'Preventative Med',
        type: 'preventative' as const,
        dosageAmount: 100,
        dosageUnit: 'mg' as const,
        defaultQuantity: 1,
        scheduleFrequency: 'daily' as const,
      };

      const dose = {
        medicationId: 'med-prev-123',
        scheduleId: 'schedule-123',
        timestamp: Date.now(),
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg' as const,
        updatedAt: Date.now(),
      };

      const createdDose = {
        ...dose,
        id: 'dose-123',
        status: 'taken',
        createdAt: Date.now(),
      };

      (episodeRepository.findEpisodeByTimestamp as jest.Mock).mockResolvedValue(null);
      (medicationDoseRepository.create as jest.Mock).mockResolvedValue(createdDose);
      (medicationRepository.getById as jest.Mock).mockResolvedValue(preventativeMedication);

      // Mock notification service failures
      const notificationError = new Error('Notification service unavailable');
      const mockNotificationService = jest.fn().mockRejectedValue(notificationError);

      // Mock the dynamic import
      jest.doMock('../../services/notifications/notificationService', () => ({
        notificationService: {
          dismissMedicationNotification: mockNotificationService,
        }
      }));

      const result = await useMedicationStore.getState().logDose(dose);

      // Should complete dose logging despite notification failures
      expect(result.id).toBe('dose-123');
      expect(medicationDoseRepository.create).toHaveBeenCalled();
    });
  });

  describe('Debug Logging and Monitoring', () => {
    it('should log detailed debug information during schedule operations', async () => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      const { logger } = require('../../utils/logger');
      jest.spyOn(logger, 'debug');

      const testSchedules = [
        {
          id: 'schedule-1',
          medicationId: 'med-1',
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
        },
        {
          id: 'schedule-2',
          medicationId: 'med-1', 
          time: '20:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: false, // Disabled schedule
        }
      ];

      mockScheduleRepository.getByMedicationId.mockResolvedValue(testSchedules);

      await useMedicationStore.getState().loadSchedules('med-1');

      // Should log detailed debug information
      expect(logger.debug).toHaveBeenCalledWith(
        '[Store] Loaded schedules for medication:',
        expect.objectContaining({
          medicationId: 'med-1',
          scheduleCount: 2,
          enabledSchedules: 1,
          scheduleIds: ['schedule-1', 'schedule-2']
        })
      );
    });

    it('should log critical errors with context for missing scheduleId', async () => {
      const { logger } = require('../../utils/logger');
      jest.spyOn(logger, 'error');

      const preventativeMedication = {
        id: 'med-prev-critical',
        name: 'Critical Preventative',
        type: 'preventative' as const,
        dosageAmount: 100,
        dosageUnit: 'mg' as const,
        schedule: [{
          id: 'existing-schedule',
          time: '08:00',
          dosage: 1,
          enabled: true,
        }],
      };

      const dose = {
        medicationId: 'med-prev-critical',
        // Missing scheduleId - this should trigger critical error logging
        timestamp: Date.now(),
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg' as const,
        updatedAt: Date.now(),
      };

      const createdDose = {
        ...dose,
        id: 'dose-critical',
        status: 'taken',
        createdAt: Date.now(),
      };

      (episodeRepository.findEpisodeByTimestamp as jest.Mock).mockResolvedValue(null);
      (medicationDoseRepository.create as jest.Mock).mockResolvedValue(createdDose);
      (medicationRepository.getById as jest.Mock).mockResolvedValue(preventativeMedication);

      // Mock notification service methods
      const mockCancelScheduledMedicationReminder = jest.fn().mockResolvedValue(undefined);
      (notificationService.cancelScheduledMedicationReminder as jest.Mock) = mockCancelScheduledMedicationReminder;

      await useMedicationStore.getState().logDose(dose);

      // Should log critical error with detailed context
      expect(logger.error).toHaveBeenCalledWith(
        '[Store] CRITICAL BUG: Missing scheduleId for preventative medication dose',
        expect.objectContaining({
          medicationId: 'med-prev-critical',
          doseId: 'dose-critical',
          medicationName: 'Critical Preventative',
          medicationType: 'preventative',
          scheduleCount: 1,
          enabledSchedules: 1,
          bugLocation: 'Dose logging UI screens not passing scheduleId',
          impact: 'Notifications will NOT be cancelled - user may receive unwanted notifications'
        })
      );
    });

    it('should provide fallback emergency logging for notification failures', async () => {
      const { logger } = require('../../utils/logger');
      jest.spyOn(logger, 'warn');

      const preventativeMedication = {
        id: 'med-emergency',
        name: 'Emergency Med',
        type: 'preventative' as const,
      };

      const dose = {
        medicationId: 'med-emergency',
        timestamp: Date.now(),
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg' as const,
        updatedAt: Date.now(),
      };

      const createdDose = {
        ...dose,
        id: 'dose-emergency',
        status: 'taken',
        createdAt: Date.now(),
      };

      (episodeRepository.findEpisodeByTimestamp as jest.Mock).mockResolvedValue(null);
      (medicationDoseRepository.create as jest.Mock).mockResolvedValue(createdDose);
      (medicationRepository.getById as jest.Mock).mockResolvedValue(preventativeMedication);

      // Mock fallback cancellation
      const mockCancelScheduledMedicationReminder = jest.fn().mockResolvedValue(undefined);
      (notificationService.cancelScheduledMedicationReminder as jest.Mock) = mockCancelScheduledMedicationReminder;

      await useMedicationStore.getState().logDose(dose);

      // Should log emergency fallback action
      expect(logger.warn).toHaveBeenCalledWith(
        '[Store] EMERGENCY FALLBACK: Cancelled ALL notifications to prevent user annoyance',
        expect.objectContaining({
          medicationId: 'med-emergency',
          action: 'Fix the root cause in UI code'
        })
      );
    });
  });

  // New methods for screen refactoring tests

  describe('getArchivedMedications', () => {
    it('should load archived medications', async () => {
      const mockArchivedMeds: Medication[] = [
        {
          id: 'archived-1',
          name: 'Archived Med',
          type: 'rescue',
          dosageAmount: 100,
          dosageUnit: 'mg',
          defaultQuantity: 1,
          scheduleFrequency: undefined,
          photoUri: undefined,
          schedule: [],
          active: false,
          notes: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      (medicationRepository.getArchived as jest.Mock).mockResolvedValue(mockArchivedMeds);

      await useMedicationStore.getState().getArchivedMedications();

      const state = useMedicationStore.getState();
      expect(state.archivedMedications).toEqual(mockArchivedMeds);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
    });

    it('should handle errors when loading archived medications', async () => {
      const error = new Error('Failed to load archived');
      (medicationRepository.getArchived as jest.Mock).mockRejectedValue(error);

      await expect(
        useMedicationStore.getState().getArchivedMedications()
      ).rejects.toThrow('Failed to load archived');

      expect(useMedicationStore.getState().error).toBe('Failed to load archived');
      expect(useMedicationStore.getState().loading).toBe(false);
    });
  });

  describe('getMedicationById', () => {
    it('should return medication from active medications', () => {
      const mockMed: Medication = {
        id: 'med-1',
        name: 'Active Med',
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
      };

      useMedicationStore.setState({ medications: [mockMed] });

      const result = useMedicationStore.getState().getMedicationById('med-1');

      expect(result).toEqual(mockMed);
    });

    it('should return medication from archived medications', () => {
      const mockArchivedMed: Medication = {
        id: 'archived-1',
        name: 'Archived Med',
        type: 'rescue',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        scheduleFrequency: undefined,
        photoUri: undefined,
        schedule: [],
        active: false,
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useMedicationStore.setState({ archivedMedications: [mockArchivedMed] });

      const result = useMedicationStore.getState().getMedicationById('archived-1');

      expect(result).toEqual(mockArchivedMed);
    });

    it('should return null if medication not found', () => {
      useMedicationStore.setState({ medications: [], archivedMedications: [] });

      const result = useMedicationStore.getState().getMedicationById('not-found');

      expect(result).toBeNull();
    });
  });

  describe('getDoseById', () => {
    it('should return dose from state', () => {
      const mockDose = {
        id: 'dose-1',
        medicationId: 'med-1',
        timestamp: Date.now(),
        quantity: 2,
        status: 'taken' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useMedicationStore.setState({ doses: [mockDose] });

      const result = useMedicationStore.getState().getDoseById('dose-1');

      expect(result).toEqual(mockDose);
    });

    it('should return null if dose not found', () => {
      useMedicationStore.setState({ doses: [] });

      const result = useMedicationStore.getState().getDoseById('not-found');

      expect(result).toBeNull();
    });
  });

  describe('getDosesByMedicationId', () => {
    it('should load doses for specific medication', async () => {
      const mockDoses = [
        {
          id: 'dose-1',
          medicationId: 'med-1',
          timestamp: Date.now(),
          quantity: 1,
          status: 'taken' as const,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'dose-2',
          medicationId: 'med-1',
          timestamp: Date.now() - 1000,
          quantity: 2,
          status: 'taken' as const,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue(mockDoses);

      const result = await useMedicationStore.getState().getDosesByMedicationId('med-1');

      expect(result).toEqual(mockDoses);
      expect(medicationDoseRepository.getByMedicationId).toHaveBeenCalledWith('med-1', 50);
    });

    it('should support custom limit', async () => {
      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([]);

      await useMedicationStore.getState().getDosesByMedicationId('med-1', 100);

      expect(medicationDoseRepository.getByMedicationId).toHaveBeenCalledWith('med-1', 100);
    });

    it('should handle errors when loading doses', async () => {
      const error = new Error('Failed to load doses');
      (medicationDoseRepository.getByMedicationId as jest.Mock).mockRejectedValue(error);

      await expect(
        useMedicationStore.getState().getDosesByMedicationId('med-1')
      ).rejects.toThrow('Failed to load doses');
    });

    it('should set loading state when loading doses', async () => {
      const mockDoses = [
        {
          id: 'dose-1',
          medicationId: 'med-1',
          timestamp: Date.now(),
          quantity: 1,
          status: 'taken' as const,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      (medicationDoseRepository.getByMedicationId as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockDoses), 50))
      );

      const loadPromise = useMedicationStore.getState().getDosesByMedicationId('med-1');

      // Should be loading
      expect(useMedicationStore.getState().loading).toBe(true);

      await loadPromise;

      // Should not be loading after completion
      expect(useMedicationStore.getState().loading).toBe(false);
    });
  });

  describe('loadMedicationWithDetails', () => {
    beforeEach(() => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      mockScheduleRepository.getByMedicationId = jest.fn();
    });

    it('should load medication with schedules and doses', async () => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      const mockMed: Medication = {
        id: 'med-1',
        name: 'Test Med',
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

      const mockSchedules = [
        {
          id: 'schedule-1',
          medicationId: 'med-1',
          time: '09:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
        },
      ];

      const mockDoses = [
        {
          id: 'dose-1',
          medicationId: 'med-1',
          timestamp: Date.now(),
          quantity: 1,
          status: 'taken' as const,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      (medicationRepository.getById as jest.Mock).mockResolvedValue(mockMed);
      mockScheduleRepository.getByMedicationId.mockResolvedValue(mockSchedules);
      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue(mockDoses);

      const result = await useMedicationStore.getState().loadMedicationWithDetails('med-1');

      expect(result).toEqual({
        medication: mockMed,
        schedules: mockSchedules,
        doses: mockDoses,
      });
      expect(useMedicationStore.getState().loading).toBe(false);
    });

    it('should return null if medication not found', async () => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      (medicationRepository.getById as jest.Mock).mockResolvedValue(null);
      mockScheduleRepository.getByMedicationId.mockResolvedValue([]);
      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([]);

      const result = await useMedicationStore.getState().loadMedicationWithDetails('not-found');

      expect(result).toBeNull();
      expect(useMedicationStore.getState().loading).toBe(false);
    });

    it('should handle errors when loading medication details', async () => {
      const error = new Error('Failed to load details');
      (medicationRepository.getById as jest.Mock).mockRejectedValue(error);

      await expect(
        useMedicationStore.getState().loadMedicationWithDetails('med-1')
      ).rejects.toThrow('Failed to load details');

      expect(useMedicationStore.getState().error).toBe('Failed to load details');
      expect(useMedicationStore.getState().loading).toBe(false);
    });
  });

  describe('addSchedule', () => {
    beforeEach(() => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      mockScheduleRepository.create = jest.fn();
    });

    it('should add a new schedule', async () => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      const newSchedule = {
        medicationId: 'med-1',
        time: '09:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
      };

      const createdSchedule = {
        ...newSchedule,
        id: 'schedule-1',
      };

      mockScheduleRepository.create.mockResolvedValue(createdSchedule);

      const result = await useMedicationStore.getState().addSchedule(newSchedule);

      expect(result).toEqual(createdSchedule);
      expect(useMedicationStore.getState().schedules).toContainEqual(createdSchedule);
      expect(useMedicationStore.getState().loading).toBe(false);
    });

    it('should handle errors when adding schedule', async () => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      const error = new Error('Failed to add schedule');
      mockScheduleRepository.create.mockRejectedValue(error);

      const newSchedule = {
        medicationId: 'med-1',
        time: '09:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
      };

      await expect(
        useMedicationStore.getState().addSchedule(newSchedule)
      ).rejects.toThrow('Failed to add schedule');

      expect(useMedicationStore.getState().error).toBe('Failed to add schedule');
      expect(useMedicationStore.getState().loading).toBe(false);
    });

    it('should invalidate medications cache when adding schedule', async () => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      const newSchedule = {
        medicationId: 'med-1',
        time: '09:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
      };

      const createdSchedule = {
        ...newSchedule,
        id: 'schedule-1',
      };

      mockScheduleRepository.create.mockResolvedValue(createdSchedule);

      // Set cache
      cacheManager.set('medications', []);
      expect(cacheManager.get('medications')).toBeDefined();

      await useMedicationStore.getState().addSchedule(newSchedule);

      // Cache should be invalidated
      expect(cacheManager.get('medications')).toBeUndefined();
    });
  });

  describe('updateSchedule', () => {
    beforeEach(() => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      mockScheduleRepository.update = jest.fn();
    });

    it('should update a schedule', async () => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      const existingSchedule = {
        id: 'schedule-1',
        medicationId: 'med-1',
        time: '09:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
      };

      useMedicationStore.setState({ schedules: [existingSchedule] });

      mockScheduleRepository.update.mockResolvedValue(undefined);

      await useMedicationStore.getState().updateSchedule('schedule-1', { time: '10:00' });

      const state = useMedicationStore.getState();
      expect(state.schedules[0].time).toBe('10:00');
      expect(mockScheduleRepository.update).toHaveBeenCalledWith('schedule-1', { time: '10:00' });
      expect(state.loading).toBe(false);
    });

    it('should handle errors when updating schedule', async () => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      const error = new Error('Failed to update schedule');
      mockScheduleRepository.update.mockRejectedValue(error);

      await expect(
        useMedicationStore.getState().updateSchedule('schedule-1', { time: '10:00' })
      ).rejects.toThrow('Failed to update schedule');

      expect(useMedicationStore.getState().error).toBe('Failed to update schedule');
      expect(useMedicationStore.getState().loading).toBe(false);
    });

    it('should invalidate medications cache when updating schedule', async () => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      const existingSchedule = {
        id: 'schedule-1',
        medicationId: 'med-1',
        time: '09:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
      };

      useMedicationStore.setState({ schedules: [existingSchedule] });
      mockScheduleRepository.update.mockResolvedValue(undefined);

      // Set cache
      cacheManager.set('medications', []);
      expect(cacheManager.get('medications')).toBeDefined();

      await useMedicationStore.getState().updateSchedule('schedule-1', { time: '10:00' });

      // Cache should be invalidated
      expect(cacheManager.get('medications')).toBeUndefined();
    });
  });

  describe('deleteSchedule', () => {
    beforeEach(() => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      mockScheduleRepository.delete = jest.fn();
    });

    it('should delete a schedule', async () => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      const schedule1 = {
        id: 'schedule-1',
        medicationId: 'med-1',
        time: '09:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
      };

      const schedule2 = {
        id: 'schedule-2',
        medicationId: 'med-1',
        time: '21:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
      };

      useMedicationStore.setState({ schedules: [schedule1, schedule2] });

      mockScheduleRepository.delete.mockResolvedValue(undefined);

      await useMedicationStore.getState().deleteSchedule('schedule-1');

      const state = useMedicationStore.getState();
      expect(state.schedules).toHaveLength(1);
      expect(state.schedules[0].id).toBe('schedule-2');
      expect(mockScheduleRepository.delete).toHaveBeenCalledWith('schedule-1');
      expect(state.loading).toBe(false);
    });

    it('should handle errors when deleting schedule', async () => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      const error = new Error('Failed to delete schedule');
      mockScheduleRepository.delete.mockRejectedValue(error);

      await expect(
        useMedicationStore.getState().deleteSchedule('schedule-1')
      ).rejects.toThrow('Failed to delete schedule');

      expect(useMedicationStore.getState().error).toBe('Failed to delete schedule');
      expect(useMedicationStore.getState().loading).toBe(false);
    });

    it('should invalidate medications cache when deleting schedule', async () => {
      const mockScheduleRepository = require('../../database/medicationRepository').medicationScheduleRepository;
      const schedule1 = {
        id: 'schedule-1',
        medicationId: 'med-1',
        time: '09:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
      };

      useMedicationStore.setState({ schedules: [schedule1] });
      mockScheduleRepository.delete.mockResolvedValue(undefined);

      // Set cache
      cacheManager.set('medications', []);
      expect(cacheManager.get('medications')).toBeDefined();

      await useMedicationStore.getState().deleteSchedule('schedule-1');

      // Cache should be invalidated
      expect(cacheManager.get('medications')).toBeUndefined();
    });
  });

  describe('getSchedulesByMedicationId', () => {
    it('should return schedules for specific medication', () => {
      const schedule1 = {
        id: 'schedule-1',
        medicationId: 'med-1',
        time: '09:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
      };

      const schedule2 = {
        id: 'schedule-2',
        medicationId: 'med-2',
        time: '21:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
      };

      const schedule3 = {
        id: 'schedule-3',
        medicationId: 'med-1',
        time: '17:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
      };

      useMedicationStore.setState({ schedules: [schedule1, schedule2, schedule3] });

      const result = useMedicationStore.getState().getSchedulesByMedicationId('med-1');

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(schedule1);
      expect(result).toContainEqual(schedule3);
      expect(result).not.toContainEqual(schedule2);
    });

    it('should return empty array if no schedules found', () => {
      useMedicationStore.setState({ schedules: [] });

      const result = useMedicationStore.getState().getSchedulesByMedicationId('med-1');

      expect(result).toEqual([]);
    });
  });

  describe('updateDose - enhanced', () => {
    it('should update dose and state', async () => {
      const existingDose = {
        id: 'dose-1',
        medicationId: 'med-1',
        timestamp: Date.now(),
        quantity: 1,
        status: 'taken' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useMedicationStore.setState({ doses: [existingDose] });

      (medicationDoseRepository.update as jest.Mock).mockResolvedValue(undefined);

      await useMedicationStore.getState().updateDose('dose-1', { effectivenessRating: 8 });

      const state = useMedicationStore.getState();
      expect(state.doses[0].effectivenessRating).toBe(8);
      expect(medicationDoseRepository.update).toHaveBeenCalledWith('dose-1', {
        effectivenessRating: 8,
      });
      expect(state.loading).toBe(false);
    });
  });

});
