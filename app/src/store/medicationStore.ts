import { create } from 'zustand';
import { logger } from '../utils/logger';
import { Medication, MedicationDose, MedicationSchedule } from '../models/types';
import { medicationRepository, medicationDoseRepository, medicationScheduleRepository } from '../database/medicationRepository';
import { episodeRepository } from '../database/episodeRepository';
import { errorLogger } from '../services/errorLogger';
import { notificationService } from '../services/notificationService';

interface MedicationState {
  medications: Medication[];
  preventativeMedications: Medication[];
  rescueMedications: Medication[];
  schedules: MedicationSchedule[]; // All schedules for active medications
  doses: MedicationDose[]; // Recent doses (last 7 days)
  loading: boolean;
  error: string | null;

  // Actions
  loadMedications: () => Promise<void>;
  loadSchedules: (medicationId?: string) => Promise<void>;
  loadRecentDoses: (days?: number) => Promise<void>;
  addMedication: (medication: Omit<Medication, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Medication>;
  updateMedication: (id: string, updates: Partial<Medication>) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;
  archiveMedication: (id: string) => Promise<void>;
  unarchiveMedication: (id: string) => Promise<void>;
  logDose: (dose: Omit<MedicationDose, 'id' | 'createdAt'>) => Promise<MedicationDose>;
  updateDose: (id: string, updates: Partial<MedicationDose>) => Promise<void>;
  deleteDose: (id: string) => Promise<void>;
}

export const useMedicationStore = create<MedicationState>((set, get) => ({
  medications: [],
  preventativeMedications: [],
  rescueMedications: [],
  schedules: [],
  doses: [],
  loading: false,
  error: null,

  loadMedications: async () => {
    set({ loading: true, error: null });
    try {
      const medications = await medicationRepository.getActive();
      const preventativeMedications = medications.filter(m => m.type === 'preventative');
      const rescueMedications = medications.filter(m => m.type === 'rescue');

      set({
        medications,
        preventativeMedications,
        rescueMedications,
        loading: false
      });
    } catch (error) {
      await errorLogger.log('database', 'Failed to load medications', error as Error, {
        operation: 'loadMedications'
      });
      set({ error: (error as Error).message, loading: false });
    }
  },

  addMedication: async (medication) => {
    set({ loading: true, error: null });
    try {
      const newMedication = await medicationRepository.create(medication);

      const medications = [...get().medications, newMedication];
      const preventativeMedications = medication.type === 'preventative'
        ? [...get().preventativeMedications, newMedication]
        : get().preventativeMedications;
      const rescueMedications = medication.type === 'rescue'
        ? [...get().rescueMedications, newMedication]
        : get().rescueMedications;

      set({
        medications,
        preventativeMedications,
        rescueMedications,
        loading: false
      });

      return newMedication;
    } catch (error) {
      await errorLogger.log('database', 'Failed to add medication', error as Error, {
        operation: 'addMedication',
        medicationName: medication.name,
        medicationType: medication.type
      });
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  updateMedication: async (id, updates) => {
    try {
      await medicationRepository.update(id, updates);

      // Reload medications to ensure proper categorization, especially if type changed
      await get().loadMedications();
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  deleteMedication: async (id) => {
    set({ loading: true, error: null });
    try {
      await medicationRepository.delete(id);

      const medications = get().medications.filter(m => m.id !== id);
      const preventativeMedications = get().preventativeMedications.filter(m => m.id !== id);
      const rescueMedications = get().rescueMedications.filter(m => m.id !== id);

      set({
        medications,
        preventativeMedications,
        rescueMedications,
        loading: false
      });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  logDose: async (dose) => {
    set({ loading: true, error: null });
    try {
      // Find episode that contains this timestamp (if any)
      const episode = await episodeRepository.findEpisodeByTimestamp(dose.timestamp);

      // Use the found episode ID, or undefined if no episode contains this timestamp
      const episodeId = episode ? episode.id : undefined;

      // Ensure status field is present (default to 'taken' if not specified)
      const doseWithStatus = {
        ...dose,
        episodeId, // Override with timestamp-based episode association
        status: dose.status || 'taken',
      };

      const newDose = await medicationDoseRepository.create(doseWithStatus);

      // Add to doses in state
      const doses = [newDose, ...get().doses];
      set({ doses, loading: false });

      return newDose;
    } catch (error) {
      await errorLogger.log('database', 'Failed to log medication dose', error as Error, {
        operation: 'logDose',
        medicationId: dose.medicationId,
        episodeId: dose.episodeId
      });
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  updateDose: async (id, updates) => {
    try {
      await medicationDoseRepository.update(id, updates);
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  deleteDose: async (id) => {
    try {
      await medicationDoseRepository.delete(id);

      // Update doses in state
      const doses = get().doses.filter(d => d.id !== id);
      set({ doses });
    } catch (error) {
      await errorLogger.log('database', 'Failed to delete medication dose', error as Error, {
        operation: 'deleteDose',
        doseId: id
      });
      set({ error: (error as Error).message });
      throw error;
    }
  },

  loadSchedules: async (medicationId?: string) => {
    try {
      let schedules: MedicationSchedule[];

      if (medicationId) {
        // Load schedules for specific medication
        schedules = await medicationScheduleRepository.getByMedicationId(medicationId);
      } else {
        // Load all schedules for active medications
        const allSchedules: MedicationSchedule[] = [];
        for (const med of get().medications) {
          const medSchedules = await medicationScheduleRepository.getByMedicationId(med.id);
          allSchedules.push(...medSchedules);
        }
        schedules = allSchedules;
      }

      set({ schedules });
    } catch (error) {
      await errorLogger.log('database', 'Failed to load schedules', error as Error, {
        operation: 'loadSchedules',
        medicationId
      });
      set({ error: (error as Error).message });
      throw error;
    }
  },

  loadRecentDoses: async (days = 7) => {
    try {
      // Get all doses for each medication
      const allDoses: MedicationDose[] = [];

      // Calculate cutoff as start of N days ago (midnight), not trailing N * 24 hours
      const now = new Date();
      const cutoffDate = new Date(now);
      cutoffDate.setDate(cutoffDate.getDate() - days);
      cutoffDate.setHours(0, 0, 0, 0); // Start of that day
      const cutoffTimestamp = cutoffDate.getTime();

      const medications = get().medications;

      for (const med of medications) {
        const medDoses = await medicationDoseRepository.getByMedicationId(med.id);
        // Filter to recent doses (since start of N days ago)
        const recentDoses = medDoses.filter(dose => dose.timestamp >= cutoffTimestamp);
        allDoses.push(...recentDoses);
      }

      // Sort by timestamp descending
      allDoses.sort((a, b) => b.timestamp - a.timestamp);

      set({ doses: allDoses });
    } catch (error) {
      await errorLogger.log('database', 'Failed to load recent doses', error as Error, {
        operation: 'loadRecentDoses',
        days
      });
      set({ error: (error as Error).message });
      throw error;
    }
  },

  archiveMedication: async (id) => {
    try {
      // Cancel notifications before archiving
      await notificationService.cancelMedicationNotifications(id);
      logger.log('[Store] Cancelled notifications for archived medication:', id);

      await medicationRepository.update(id, { active: false });

      const medications = get().medications.map(m =>
        m.id === id ? { ...m, active: false } : m
      );
      const preventativeMedications = get().preventativeMedications.filter(m => m.id !== id);
      const rescueMedications = get().rescueMedications.filter(m => m.id !== id);

      set({
        medications,
        preventativeMedications,
        rescueMedications
      });
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  unarchiveMedication: async (id) => {
    try {
      await medicationRepository.update(id, { active: true });

      // Re-enable notifications for preventative medications
      const medication = await medicationRepository.getById(id);
      if (medication && medication.type === 'preventative') {
        const schedules = await medicationScheduleRepository.getByMedicationId(id);
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
                  });
                  logger.log('[Store] Notification rescheduled for restored medication:', notificationId);
                }
              } catch (error) {
                logger.error('[Store] Failed to schedule notification for restored medication:', error);
              }
            }
          }
        }
      }

      const medications = get().medications.map(m =>
        m.id === id ? { ...m, active: true } : m
      );

      // Reload to get the medication back in the active lists
      await get().loadMedications();
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },
}));
