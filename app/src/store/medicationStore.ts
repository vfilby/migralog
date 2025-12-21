import { create } from 'zustand';
import * as Sentry from '@sentry/react-native';
import { logger } from '../utils/logger';
import { Medication, MedicationDose, MedicationSchedule } from '../models/types';
import { medicationRepository, medicationDoseRepository, medicationScheduleRepository } from '../database/medicationRepository';
import { episodeRepository } from '../database/episodeRepository';
import { errorLogger } from '../services/errorLogger';
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
  archivedMedications: Medication[]; // Archived medications
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
  
  // New methods for screen refactoring
  getArchivedMedications: () => Promise<void>;
  getMedicationById: (id: string) => Medication | null;
  getDoseById: (id: string) => MedicationDose | null;
  getDosesByMedicationId: (medicationId: string, limit?: number) => Promise<MedicationDose[]>;
  loadMedicationWithDetails: (medicationId: string) => Promise<{ medication: Medication; schedules: MedicationSchedule[]; doses: MedicationDose[] } | null>;
  loadMedicationDosesWithDetails: (episodeId: string) => Promise<Array<MedicationDose & { medication?: Medication }>>;
  addSchedule: (schedule: Omit<MedicationSchedule, 'id'>) => Promise<MedicationSchedule>;
  updateSchedule: (id: string, updates: Partial<MedicationSchedule>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  getSchedulesByMedicationId: (medicationId: string) => MedicationSchedule[];
}

export const useMedicationStore = create<MedicationState>((set, get) => ({
  medications: [],
  preventativeMedications: [],
  rescueMedications: [],
  otherMedications: [],
  archivedMedications: [],
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

      // CONSISTENCY FIX: Reschedule all notifications to update grouped notifications
      // This ensures that grouped notifications no longer include the deleted medication
      // Matches the behavior of archiveMedication for consistency
      // Dynamic import to avoid circular dependency
      const { notificationService } = await import('../services/notifications/notificationService');
      await notificationService.rescheduleAllMedicationNotifications();
      logger.log('[Store] Rescheduled all notifications after deleting medication:', id);

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

      // Dynamic import to avoid circular dependency
      const { notificationService } = await import('../services/notifications/notificationService');

      // Dismiss any presented notifications for this medication
      // This removes the notification from the notification tray when logging from the app
      if (dose.scheduleId) {
        await notificationService.dismissMedicationNotification(dose.medicationId, dose.scheduleId);
        logger.log('[Store] Dismissed presented notification for logged medication');

        // Cancel today's scheduled reminder and follow-up (one-time notification system)
        // This ensures the notification won't fire if app is killed
        const { cancelNotificationForDate, topUpNotifications } = await import('../services/notifications/medicationNotifications');
        const { toLocalDateString } = await import('../utils/dateFormatting');
        const today = toLocalDateString(); // Use local timezone, not UTC
        await cancelNotificationForDate(dose.medicationId, dose.scheduleId, today, 'reminder');
        await cancelNotificationForDate(dose.medicationId, dose.scheduleId, today, 'follow_up');

        // Top up notifications to maintain the scheduled count
        await topUpNotifications();
        logger.log('[Store] Cancelled scheduled notifications and topped up for logged medication');
      } else {
        // ERROR: Missing scheduleId for preventative medication
        const medication = await medicationRepository.getById(dose.medicationId);
        if (medication && medication.type === 'preventative') {
          logger.error('[Store] CRITICAL BUG: Missing scheduleId for preventative medication dose', {
            medicationId: dose.medicationId,
            doseId: newDose.id,
            medicationName: medication.name,
            medicationType: medication.type,
            scheduleCount: medication.schedule?.length || 0,
            enabledSchedules: medication.schedule?.filter(s => s.enabled).length || 0,
            bugLocation: 'Dose logging UI screens not passing scheduleId',
            impact: 'Notifications will NOT be cancelled - user may receive unwanted notifications'
          });
          
          // For now, still do fallback cancellation to prevent user annoyance,
          // but this should be treated as a bug to fix, not normal operation
          await notificationService.cancelScheduledMedicationReminder(dose.medicationId);
          
          logger.warn('[Store] EMERGENCY FALLBACK: Cancelled ALL notifications to prevent user annoyance', {
            medicationId: dose.medicationId,
            action: 'Fix the root cause in UI code'
          });
        }
      }

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
    set({ loading: true, error: null });
    try {
      logger.log('[Store] Updating dose:', id, updates);
      await medicationDoseRepository.update(id, updates);

      // Update doses in state
      const doses = get().doses.map(d =>
        d.id === id ? { ...d, ...updates } : d
      );
      set({ doses, loading: false });

      logger.log('[Store] Dose updated:', id);
    } catch (error) {
      await errorLogger.log('database', 'Failed to update dose', error as Error, {
        operation: 'updateDose',
        doseId: id
      });
      set({ error: (error as Error).message, loading: false });
      toastService.error('Failed to update dose');
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
        
        // Enhanced logging for debugging the missing scheduleId issue
        logger.debug('[Store] Loaded schedules for medication:', {
          medicationId,
          scheduleCount: schedules.length,
          enabledSchedules: schedules.filter(s => s.enabled).length,
          scheduleIds: schedules.map(s => s.id)
        });
      } else {
        // Load all schedules for active medications using batch query
        const medicationIds = get().medications.map(m => m.id);
        schedules = await medicationScheduleRepository.getByMedicationIds(medicationIds);
        
        logger.debug('[Store] Loaded all schedules for active medications:', {
          medicationCount: medicationIds.length,
          totalSchedules: schedules.length,
          enabledSchedules: schedules.filter(s => s.enabled).length
        });
      }

      // Update state - merge with existing schedules for other medications
      if (medicationId) {
        // Update schedules for specific medication only
        const currentSchedules = get().schedules;
        const updatedSchedules = [
          ...currentSchedules.filter(s => s.medicationId !== medicationId),
          ...schedules
        ];
        set({ schedules: updatedSchedules });
      } else {
        // Replace all schedules
        set({ schedules });
      }
    } catch (error) {
      await errorLogger.log('database', 'Failed to load schedules', error as Error, {
        operation: 'loadSchedules',
        medicationId
      });
      
      logger.error('[Store] Failed to load medication schedules:', {
        medicationId,
        error: error instanceof Error ? error.message : String(error),
        operation: medicationId ? 'single-medication' : 'all-medications'
      });
      
      set({ error: (error as Error).message });
      throw error; // Re-throw to let callers handle the error
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

      // Dynamic import to avoid circular dependency
      const { notificationService } = await import('../services/notifications/notificationService');

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

      // Reschedule all medication notifications (handles restored medication)
      // Dynamic import to avoid circular dependency
      const { notificationService } = await import('../services/notifications/notificationService');
      await notificationService.rescheduleAllMedicationNotifications();
      logger.log('[Store] Notifications rescheduled after restoring medication');

      // Reload to get the medication back in the active lists
      await get().loadMedications();
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  // New methods for screen refactoring

  /**
   * Load archived medications from the repository
   * Updates the archivedMedications state with the results.
   */
  getArchivedMedications: async () => {
    set({ loading: true, error: null });
    try {
      const archivedMedications = await medicationRepository.getArchived();
      
      set({ archivedMedications, loading: false });
    } catch (error) {
      await errorLogger.log('database', 'Failed to load archived medications', error as Error, {
        operation: 'getArchivedMedications'
      });
      set({ error: (error as Error).message, loading: false });
      toastService.error('Failed to load archived medications');
      throw error;
    }
  },

  /**
   * Get a medication by ID from state
   * Searches in both active and archived medications in state.
   * If not found in state and archived medications haven't been loaded,
   * falls back to loading from repository.
   * 
   * @param id - Medication id
   * @returns Medication object or null if not found
   */
  getMedicationById: (id: string) => {
    // Check active medications first
    const medication = get().medications.find(m => m.id === id);
    if (medication) {
      return medication;
    }

    // Check archived medications
    const archivedMedication = get().archivedMedications.find(m => m.id === id);
    if (archivedMedication) {
      return archivedMedication;
    }

    // If archived medications array is empty, the medication might be archived
    // but not yet loaded into state. This is a synchronous method, so we can't
    // load it here. Callers should use loadMedicationWithDetails for a complete
    // async approach that will load from repository if needed.
    return null;
  },

  /**
   * Get a dose by ID from state
   * Only searches in doses currently loaded in state (recent doses).
   * 
   * @param id - Dose id
   * @returns Dose object or null if not found in state
   */
  getDoseById: (id: string) => {
    const dose = get().doses.find(d => d.id === id);
    return dose || null;
  },

  /**
   * Load doses for a specific medication from the repository
   * Does not update state - returns the doses directly.
   * 
   * @param medicationId - Medication id
   * @param limit - Maximum number of doses to load (default: 50)
   * @returns Array of medication doses
   */
  getDosesByMedicationId: async (medicationId: string, limit = 50) => {
    set({ loading: true, error: null });
    try {
      const doses = await medicationDoseRepository.getByMedicationId(medicationId, limit);
      
      set({ loading: false });
      return doses;
    } catch (error) {
      await errorLogger.log('database', 'Failed to load doses for medication', error as Error, {
        operation: 'getDosesByMedicationId',
        medicationId
      });
      set({ error: (error as Error).message, loading: false });
      toastService.error('Failed to load medication doses');
      throw error;
    }
  },

  /**
   * Load a medication with all its associated data from the repository
   * Loads medication, schedules, and recent doses in parallel.
   * This is useful for medication detail screens.
   * 
   * @param medicationId - Medication id
   * @returns Object containing medication, schedules, and doses, or null if medication not found
   */
  loadMedicationWithDetails: async (medicationId: string) => {
    set({ loading: true, error: null });
    try {
      // Load medication, schedules, and recent doses in parallel
      const [medication, schedules, doses] = await Promise.all([
        medicationRepository.getById(medicationId),
        medicationScheduleRepository.getByMedicationId(medicationId),
        medicationDoseRepository.getByMedicationId(medicationId, 50)
      ]);

      if (!medication) {
        set({ loading: false });
        return null;
      }

      set({ loading: false });
      return { medication, schedules, doses };
    } catch (error) {
      await errorLogger.log('database', 'Failed to load medication details', error as Error, {
        operation: 'loadMedicationWithDetails',
        medicationId
      });
      set({ error: (error as Error).message, loading: false });
      toastService.error('Failed to load medication details');
      throw error;
    }
  },

  /**
   * Add a new medication schedule
   * @param schedule - Schedule data (without id)
   * @returns The created schedule with generated id
   */
  addSchedule: async (schedule) => {
    set({ loading: true, error: null });
    try {
      logger.log('[Store] Adding schedule:', schedule);
      const newSchedule = await medicationScheduleRepository.create(schedule);

      // Invalidate medication cache as schedules affect medication data
      cacheManager.invalidate('medications');

      // Update schedules in state
      const schedules = [...get().schedules, newSchedule];
      set({ schedules, loading: false });

      logger.log('[Store] Schedule added:', newSchedule.id);

      // DIAGNOSTIC: Add Sentry breadcrumb for schedule creation
      // This helps trace schedule lifecycle when debugging "Schedule not found" errors
      Sentry.addBreadcrumb({
        category: 'schedule',
        message: 'Schedule created',
        data: { scheduleId: newSchedule.id, medicationId: schedule.medicationId, time: schedule.time },
        level: 'info',
      });

      return newSchedule;
    } catch (error) {
      await errorLogger.log('database', 'Failed to add schedule', error as Error, {
        operation: 'addSchedule',
        medicationId: schedule.medicationId
      });
      set({ error: (error as Error).message, loading: false });
      toastService.error('Failed to add schedule');
      throw error;
    }
  },

  /**
   * Update an existing medication schedule
   * @param id - Schedule id
   * @param updates - Partial schedule data to update
   */
  updateSchedule: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      logger.log('[Store] Updating schedule:', id, updates);
      await medicationScheduleRepository.update(id, updates);

      // Invalidate medication cache as schedules affect medication data
      cacheManager.invalidate('medications');

      // Update schedules in state
      const schedules = get().schedules.map(s =>
        s.id === id ? { ...s, ...updates } : s
      );
      set({ schedules, loading: false });

      logger.log('[Store] Schedule updated:', id);

      // DIAGNOSTIC: Add Sentry breadcrumb for schedule update
      // This helps trace schedule lifecycle when debugging "Schedule not found" errors
      Sentry.addBreadcrumb({
        category: 'schedule',
        message: 'Schedule updated',
        data: { scheduleId: id, updates: Object.keys(updates) },
        level: 'info',
      });
    } catch (error) {
      await errorLogger.log('database', 'Failed to update schedule', error as Error, {
        operation: 'updateSchedule',
        scheduleId: id
      });
      set({ error: (error as Error).message, loading: false });
      toastService.error('Failed to update schedule');
      throw error;
    }
  },

  /**
   * Delete a medication schedule
   * @param id - Schedule id to delete
   */
  deleteSchedule: async (id) => {
    set({ loading: true, error: null });
    try {
      logger.log('[Store] Deleting schedule:', id);
      await medicationScheduleRepository.delete(id);

      // Invalidate medication cache as schedules affect medication data
      cacheManager.invalidate('medications');

      // Update schedules in state
      const schedules = get().schedules.filter(s => s.id !== id);
      set({ schedules, loading: false });

      logger.log('[Store] Schedule deleted:', id);

      // DIAGNOSTIC: Add Sentry breadcrumb for schedule deletion
      // This helps trace schedule lifecycle when debugging "Schedule not found" errors
      Sentry.addBreadcrumb({
        category: 'schedule',
        message: 'Schedule deleted',
        data: { scheduleId: id },
        level: 'info',
      });
    } catch (error) {
      await errorLogger.log('database', 'Failed to delete schedule', error as Error, {
        operation: 'deleteSchedule',
        scheduleId: id
      });
      set({ error: (error as Error).message, loading: false });
      toastService.error('Failed to delete schedule');
      throw error;
    }
  },

  /**
   * Get schedules for a specific medication from state
   * Only returns schedules that are currently loaded in state.
   * Use loadSchedules() first to ensure schedules are loaded.
   * 
   * @param medicationId - Medication id
   * @returns Array of schedules for the medication
   */
  getSchedulesByMedicationId: (medicationId: string) => {
    const schedules = get().schedules.filter(s => s.medicationId === medicationId);
    return schedules;
  },

  /**
   * Load medication doses for an episode with full medication details
   * This replaces direct repository access in EpisodeDetailScreen.
   * Loads doses and joins with medication data.
   * 
   * @param episodeId - Episode id
   * @returns Array of medication doses with joined medication details
   */
  loadMedicationDosesWithDetails: async (episodeId: string) => {
    set({ loading: true, error: null });
    try {
      // Load medication doses for this episode
      const doses = await medicationDoseRepository.getByEpisodeId(episodeId);
      
      // Load medication details for each dose
      const dosesWithDetails = await Promise.all(
        doses.map(async (dose) => {
          const medication = await medicationRepository.getById(dose.medicationId);
          return { ...dose, medication: medication || undefined };
        })
      );

      set({ loading: false });
      return dosesWithDetails;
    } catch (error) {
      await errorLogger.log('database', 'Failed to load medication doses with details', error as Error, {
        operation: 'loadMedicationDosesWithDetails',
        episodeId
      });
      set({ error: (error as Error).message, loading: false });
      toastService.error('Failed to load medication doses');
      throw error;
    }
  },

}));
