import { create } from 'zustand';
import { Medication, MedicationDose } from '../models/types';
import { medicationRepository, medicationDoseRepository, medicationScheduleRepository } from '../database/medicationRepository';
import { errorLogger } from '../services/errorLogger';
import { notificationService } from '../services/notificationService';

interface MedicationState {
  medications: Medication[];
  preventativeMedications: Medication[];
  rescueMedications: Medication[];
  loading: boolean;
  error: string | null;

  // Actions
  loadMedications: () => Promise<void>;
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
      const newDose = await medicationDoseRepository.create(dose);
      set({ loading: false });
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
    } catch (error) {
      await errorLogger.log('database', 'Failed to delete medication dose', error as Error, {
        operation: 'deleteDose',
        doseId: id
      });
      set({ error: (error as Error).message });
      throw error;
    }
  },

  archiveMedication: async (id) => {
    try {
      // Cancel notifications before archiving
      await notificationService.cancelMedicationNotifications(id);
      console.log('[Store] Cancelled notifications for archived medication:', id);

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
                  console.log('[Store] Notification rescheduled for restored medication:', notificationId);
                }
              } catch (error) {
                console.error('[Store] Failed to schedule notification for restored medication:', error);
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
