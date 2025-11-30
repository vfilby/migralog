import { create } from 'zustand';
import { logger } from '../utils/logger';
import { Medication, MedicationDose, MedicationSchedule } from '../models/types';
import { medicationRepository, medicationDoseRepository, medicationScheduleRepository } from '../database/medicationRepository';
import { episodeRepository } from '../database/episodeRepository';
import { errorLogger } from '../services/errorLogger';
import { notificationService } from '../services/notifications/notificationService';
import { toastService } from '../services/toastService';
import { cacheManager } from '../utils/cacheManager';

/**
 * Categorizes medications by type and applies appropriate sorting.
 *
 * Rescue medications are sorted by usage frequency (most used first),
 * with alphabetical name sorting as a tiebreaker. This helps users
 * quickly access their most commonly used rescue medications.
 *
 * @param medications - Array of medications to categorize
 * @param usageCounts - Map of medication ID to usage count for sorting
 * @returns Object containing medications grouped by type
 */
function categorizeMedications(
  medications: Medication[],
  usageCounts: Map<string, number>
): {
  preventative: Medication[];
  rescue: Medication[];
  other: Medication[];
} {
  const preventative = medications.filter(m => m.type === 'preventative');
  const rescue = medications
    .filter(m => m.type === 'rescue')
    .sort((a, b) => {
      const usageA = usageCounts.get(a.id) || 0;
      const usageB = usageCounts.get(b.id) || 0;

      // Primary sort: by usage count (descending - most used first)
      if (usageB !== usageA) {
        return usageB - usageA;
      }

      // Secondary sort: alphabetically by name
      return a.name.localeCompare(b.name);
    });
  const other = medications.filter(m => m.type === 'other');

  return { preventative, rescue, other };
}

export interface TodaysMedication {
  medication: Medication;
  schedule: MedicationSchedule;
  doseTime: Date;
  taken: boolean;
  takenAt?: Date;
  skipped: boolean;
  doseId?: string; // ID of the dose record if it was logged
}

interface MedicationState {
  medications: Medication[];
  preventativeMedications: Medication[];
  rescueMedications: Medication[];
  otherMedications: Medication[];
  schedules: MedicationSchedule[]; // All schedules for active medications
  doses: MedicationDose[]; // Recent doses (last 90 days for analytics)
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
  otherMedications: [],
  schedules: [],
  doses: [],
  loading: false,
  error: null,

  loadMedications: async () => {
    // Check cache first (5 second TTL)
    const cached = cacheManager.get<Medication[]>('medications');
    if (cached) {
      // Get usage counts for sorting
      const usageCounts = await medicationDoseRepository.getMedicationUsageCounts();

      const categorized = categorizeMedications(cached, usageCounts);
      set({
        medications: cached,
        preventativeMedications: categorized.preventative,
        rescueMedications: categorized.rescue,
        otherMedications: categorized.other,
        loading: false
      });
      return;
    }

    set({ loading: true, error: null });
    try {
      const medications = await medicationRepository.getActive();

      // Get usage counts for sorting
      const usageCounts = await medicationDoseRepository.getMedicationUsageCounts();

      const categorized = categorizeMedications(medications, usageCounts);

      cacheManager.set('medications', medications);

      set({
        medications,
        preventativeMedications: categorized.preventative,
        rescueMedications: categorized.rescue,
        otherMedications: categorized.other,
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
      // Invalidate medication cache
      cacheManager.invalidate("medications");
    try {
      const newMedication = await medicationRepository.create(medication);

      const medications = [...get().medications, newMedication];
      const preventativeMedications = medication.type === 'preventative'
        ? [...get().preventativeMedications, newMedication]
        : get().preventativeMedications;
      const rescueMedications = medication.type === 'rescue'
        ? [...get().rescueMedications, newMedication]
        : get().rescueMedications;
      const otherMedications = medication.type === 'other'
        ? [...get().otherMedications, newMedication]
        : get().otherMedications;

      set({
        medications,
        preventativeMedications,
        rescueMedications,
        otherMedications,
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

      // Show error toast
      toastService.error('Failed to add medication');

      throw error;
    }
  },

  updateMedication: async (id, updates) => {
    try {
      await medicationRepository.update(id, updates);
      // Invalidate medication cache
      cacheManager.invalidate("medications");

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
      // Invalidate medication cache
      cacheManager.invalidate("medications");
      await medicationRepository.delete(id);

      const medications = get().medications.filter(m => m.id !== id);
      const preventativeMedications = get().preventativeMedications.filter(m => m.id !== id);
      const rescueMedications = get().rescueMedications.filter(m => m.id !== id);
      const otherMedications = get().otherMedications.filter(m => m.id !== id);

      set({
        medications,
        preventativeMedications,
        rescueMedications,
        otherMedications,
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

      // Cancel any scheduled notifications for this medication/schedule
      // This prevents the notification from firing if medication is logged before the scheduled time
      await notificationService.cancelScheduledMedicationReminder(dose.medicationId, dose.scheduleId);

      // Dismiss any presented notifications for this medication
      // This removes the notification from the notification tray when logging from the app
      // Pass scheduleId to ensure only the correct notification is dismissed for medications with multiple schedules
      await notificationService.dismissMedicationNotification(dose.medicationId, dose.scheduleId);
      logger.log('[Store] Cancelled/dismissed notifications for logged medication');

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

      // Show error toast
      toastService.error('Failed to log medication');

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

      // Show error toast
      toastService.error('Failed to delete dose');

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
        // Load all schedules for active medications using batch query
        const medicationIds = get().medications.map(m => m.id);
        schedules = await medicationScheduleRepository.getByMedicationIds(medicationIds);
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

  loadRecentDoses: async (days = 90) => {
    try {
      // Calculate cutoff as start of N days ago (midnight), not trailing N * 24 hours
      const now = new Date();
      const cutoffDate = new Date(now);
      cutoffDate.setDate(cutoffDate.getDate() - days);
      cutoffDate.setHours(0, 0, 0, 0); // Start of that day
      const cutoffTimestamp = cutoffDate.getTime();

      // Use batch query to get all doses in date range in a single query
      const allDoses = await medicationDoseRepository.getByDateRange(cutoffTimestamp, Date.now());

      // Sort by timestamp descending (getByDateRange should already sort DESC)
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
      await medicationRepository.update(id, { active: false });

      // Reschedule all notifications to update grouped notifications
      // This ensures that grouped notifications no longer include the archived medication
      await notificationService.rescheduleAllMedicationNotifications();
      logger.log('[Store] Rescheduled all notifications after archiving medication:', id);

      const medications = get().medications.map(m =>
        m.id === id ? { ...m, active: false } : m
      );
      const preventativeMedications = get().preventativeMedications.filter(m => m.id !== id);
      const rescueMedications = get().rescueMedications.filter(m => m.id !== id);
      const otherMedications = get().otherMedications.filter(m => m.id !== id);

      set({
        medications,
        preventativeMedications,
        rescueMedications,
        otherMedications
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

      // Reload to get the medication back in the active lists
      await get().loadMedications();
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

}));
