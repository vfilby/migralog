import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';
import { Medication } from '../../models/types';
// ARCHITECTURAL EXCEPTION: Notification handlers need direct repository access
// because they run in background when app may be suspended. See docs/store-repository-guidelines.md
import { medicationRepository } from '../../database/medicationRepository';
import { useNotificationSettingsStore } from '../../store/notificationSettingsStore';
import { toLocalDateString } from '../../utils/dateFormatting';
import { notifyUserOfError } from './errorNotificationHelper';
import { MEDICATION_REMINDER_CATEGORY, MULTIPLE_MEDICATION_REMINDER_CATEGORY } from './notificationCategories';
import { dismissMedicationNotification } from './medicationNotificationCancellation';

/**
 * Handle "Take Now" action - log medication immediately
 *
 * Now returns error state instead of throwing
 * - Uses notifyUserOfError() for user feedback
 * - Logs to Sentry with full context
 * - Returns boolean to indicate success/failure
 */
export async function handleTakeNow(medicationId: string, scheduleId: string): Promise<boolean> {
  try {
    // Use store to load medication and schedules together
    const { useMedicationStore } = await import('../../store/medicationStore');
    const result = await useMedicationStore.getState().loadMedicationWithDetails(medicationId);

    if (!result || !result.medication) {
      logger.error('[Notification] Medication not found:', { medicationId, scheduleId });

      // User-friendly error notification
      await notifyUserOfError(
        'data',
        'There was a problem with your medication reminder. Please check your medications.',
        new Error(`Medication not found: ${medicationId}`),
        { medicationId, scheduleId, operation: 'handleTakeNow' }
      );

      return false;
    }

    const { medication, schedules } = result;

    // Find the schedule to get the dosage
    const schedule = schedules.find(s => s.id === scheduleId);

    // NOTIFICATION SCHEDULE CONSISTENCY FIX: Validate that schedule exists
    if (!schedule) {
      const scheduleError = new Error(`Schedule not found in medication: scheduleId=${scheduleId}, medicationId=${medicationId}`);
      logger.error(scheduleError, {
        medicationId,
        scheduleId,
        medicationName: medication.name,
        availableScheduleIds: schedules.map(s => s.id),
        scheduleCount: schedules.length,
        medicationActive: medication.active,
        operation: 'handleTakeNow',
        component: 'NotificationConsistency',
      });

      // Notify user of the inconsistency
      await notifyUserOfError(
        'data',
        'Your medication schedule has changed. Please check your medication settings or recreate notification schedules.',
        scheduleError,
        { medicationId, scheduleId, operation: 'handleTakeNow' }
      );

      return false;
    }

    const dosage = schedule.dosage ?? medication.defaultQuantity ?? 1;

    // Use store's logDose to update both database and state
    const timestamp = Date.now();

    // Validate dose object before passing to store
    if (!medication.dosageAmount || !medication.dosageUnit) {
      const validationError = new Error(
        `Invalid medication configuration: dosageAmount=${medication.dosageAmount}, dosageUnit=${medication.dosageUnit}`
      );

      logger.error('[Notification] Invalid medication configuration:', {
        medicationId,
        scheduleId,
        dosageAmount: medication.dosageAmount,
        dosageUnit: medication.dosageUnit,
      });

      // User notification for validation errors
      await notifyUserOfError(
        'data',
        'There was a problem with your medication data. Please update your medication settings.',
        validationError,
        { medicationId, scheduleId, operation: 'handleTakeNow' }
      );

      return false;
    }

    await useMedicationStore.getState().logDose({
      medicationId,
      scheduleId,
      timestamp,
      quantity: dosage,
      dosageAmount: medication.dosageAmount,
      dosageUnit: medication.dosageUnit,
      notes: 'Logged from notification',
      updatedAt: timestamp,
    });

    logger.log('[Notification] Medication logged successfully:', {
      medicationId,
      medicationName: medication.name,
      scheduleId,
      dosage,
    });

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[Notification] Failed to log medication from notification:', {
      medicationId,
      scheduleId,
      error: errorMessage,
    });

    // No silent failures
    await notifyUserOfError(
      'system',
      'Failed to log your medication. Please try again.',
      error instanceof Error ? error : new Error(errorMessage),
      { medicationId, scheduleId, operation: 'handleTakeNow' }
    );

    // Return error state instead of throwing
    return false;
  }
}

/**
 * Unified snooze handler for both single and grouped medications.
 *
 * Snooze is only triggered from a notification action, so the notification has
 * already been displayed and dismissed by the OS when the user taps it.
 * We only need to schedule the new snoozed notification.
 *
 * Note: Follow-up notifications are NOT cancelled - they serve as the "last chance"
 * reminder and should still fire even if the user snoozed the initial reminder.
 *
 * Safety: Schedule the new notification FIRST, then dismiss any lingering notifications.
 * This ensures we never end up in a notification-less state if there's an error.
 */
async function handleSnoozeNotifications(
  medicationIds: string[],
  scheduleIds: string[],
  medications: Medication[],
  minutes: number,
  categoryIdentifier: string,
  originalTime?: string
): Promise<boolean> {
  const isSingle = medications.length === 1;
  const medication = medications[0];

  // Get effective notification settings
  const settingsStore = useNotificationSettingsStore.getState();
  const anyTimeSensitive = medications.some((med) => {
    const settings = settingsStore.getEffectiveSettings(med.id);
    return settings.timeSensitiveEnabled;
  });

  // Schedule a new notification in X minutes
  const snoozeTime = new Date(Date.now() + minutes * 60 * 1000);

  // Build notification content based on single vs grouped
  const content = isSingle
    ? {
        title: `Reminder: ${medication.name}`,
        body: 'Time to take your medication (snoozed)',
        data: { medicationId: medicationIds[0], scheduleId: scheduleIds[0] },
      }
    : {
        title: `Reminder: ${medications.length} Medications`,
        body: `Time to take: ${medications.map(m => m.name).join(', ')}`,
        data: {
          medicationIds,
          scheduleIds,
          time: originalTime,
        },
      };

  // Schedule the snoozed notification FIRST (safety: don't lose notifications on error)
  await Notifications.scheduleNotificationAsync({
    content: {
      ...content,
      categoryIdentifier,
      sound: true,
      // Time-sensitive notification settings for Android and iOS
      ...(Notifications.AndroidNotificationPriority && {
        priority: Notifications.AndroidNotificationPriority.HIGH,
      }),
      // Only set time-sensitive interruption level if enabled in settings
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(anyTimeSensitive && { interruptionLevel: 'timeSensitive' } as any),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: snoozeTime },
  });

  // Now dismiss any lingering notifications (snooze is from notification, so this is just cleanup)
  for (let i = 0; i < medicationIds.length; i++) {
    await dismissMedicationNotification(medicationIds[i], scheduleIds[i]);
  }

  logger.log('[Notification] Snoozed for', minutes, 'minutes', {
    medicationCount: medications.length,
    isSingle,
  });

  return true;
}

/**
 * Handle "Snooze" action - reschedule notification for a single medication.
 * Delegates to unified handleSnoozeNotifications.
 *
 * Now returns error state and notifies user
 */
export async function handleSnooze(
  medicationId: string,
  scheduleId: string,
  minutes: number
): Promise<boolean> {
  try {
    const medication = await medicationRepository.getById(medicationId);
    if (!medication) {
      logger.error('[Notification] Medication not found for snooze:', { medicationId, scheduleId });

      // User notification
      await notifyUserOfError(
        'data',
        'Could not snooze medication reminder. Please check your medications.',
        new Error(`Medication not found: ${medicationId}`),
        { medicationId, scheduleId, operation: 'handleSnooze' }
      );

      return false;
    }

    // Delegate to unified snooze handler for single medication
    return handleSnoozeNotifications(
      [medicationId],
      [scheduleId],
      [medication],
      minutes,
      MEDICATION_REMINDER_CATEGORY
    );
  } catch (error) {
    logger.error('[Notification] Error snoozing notification:', error);

    // No silent failures
    await notifyUserOfError(
      'system',
      'Failed to snooze your medication reminder. Please try again.',
      error instanceof Error ? error : new Error(String(error)),
      { medicationId, scheduleId, minutes, operation: 'handleSnooze' }
    );

    return false;
  }
}

/**
 * Handle "Take All Now" action - log all medications immediately
 *
 * This action requires explicit user tap on the "Take All" button.
 * It is NOT automatic - the user must consciously choose to take all medications.
 * The button is a convenience feature for users who want to log multiple medications at once,
 * but it defers to the user for the final decision.
 *
 * Now returns error state and handles empty lists
 * - Returns object with success count and total count
 * - Uses notifyUserOfError() for failures
 * - Logs each error to Sentry
 */
export async function handleTakeAllNow(
  medicationIds: string[],
  scheduleIds: string[]
): Promise<{ success: number; total: number }> {
  try {
    // Empty medication list edge case
    if (medicationIds.length === 0 || scheduleIds.length === 0) {
      // Log as this indicates a bug in notification scheduling
      logger.error(new Error('handleTakeAllNow called with empty medication list'), {
        component: 'MedicationNotifications',
        operation: 'handleTakeAllNow',
        medicationIdsLength: medicationIds.length,
        scheduleIdsLength: scheduleIds.length,
      });

      return { success: 0, total: 0 };
    }

    const results: string[] = [];
    let successCount = 0;

    // Dynamic import to avoid circular dependency
    const { useMedicationStore } = await import('../../store/medicationStore');

    for (let i = 0; i < medicationIds.length; i++) {
      const medicationId = medicationIds[i];
      const scheduleId = scheduleIds[i];

      try {
        // Use store to load medication and schedules together
        const result = await useMedicationStore.getState().loadMedicationWithDetails(medicationId);

        if (!result || !result.medication) {
          logger.error('[Notification] Medication not found in group:', { medicationId, scheduleId });

          // Log each failure
          await notifyUserOfError(
            'data',
            'One of your medications could not be logged. Please check your medications.',
            new Error(`Medication not found: ${medicationId}`),
            { medicationId, scheduleId, operation: 'handleTakeAllNow', index: i }
          );

          continue;
        }

        const { medication, schedules } = result;

        // Find the schedule to get the dosage
        const schedule = schedules.find(s => s.id === scheduleId);

        // NOTIFICATION SCHEDULE CONSISTENCY FIX: Validate that schedule exists
        if (!schedule) {
          const scheduleError = new Error(`Schedule not found in medication: scheduleId=${scheduleId}, medicationId=${medicationId}`);
          logger.error(scheduleError, {
            medicationId,
            scheduleId,
            medicationName: medication.name,
            availableScheduleIds: schedules.map(s => s.id),
            scheduleCount: schedules.length,
            medicationActive: medication.active,
            operation: 'handleTakeAllNow',
            index: i,
            component: 'NotificationConsistency',
          });

          // User notification for each failure
          await notifyUserOfError(
            'data',
            `Schedule mismatch for ${medication.name}. Please recreate notification schedules.`,
            scheduleError,
            { medicationId, scheduleId, operation: 'handleTakeAllNow', index: i }
          );

          continue;
        }

        const dosage = schedule.dosage ?? medication.defaultQuantity ?? 1;

        // Validate dose object before passing to store
        if (!medication.dosageAmount || !medication.dosageUnit) {
          const validationError = new Error(
            `Invalid medication configuration for ${medication.name}: dosageAmount=${medication.dosageAmount}, dosageUnit=${medication.dosageUnit}`
          );

          logger.error('[Notification] Invalid medication configuration in group:', {
            medicationId,
            scheduleId,
            medicationName: medication.name,
          });

          // User notification for each failure
          await notifyUserOfError(
            'data',
            `Problem with ${medication.name} settings. Please update your medication.`,
            validationError,
            { medicationId, scheduleId, operation: 'handleTakeAllNow', index: i }
          );

          continue;
        }

        // Use store's logDose to update both database and state
        const timestamp = Date.now();
        await useMedicationStore.getState().logDose({
          medicationId,
          scheduleId,
          timestamp,
          quantity: dosage,
          dosageAmount: medication.dosageAmount,
          dosageUnit: medication.dosageUnit,
          notes: 'Logged from notification',
          updatedAt: timestamp,
        });

        results.push(`${medication.name} - ${dosage} dose(s)`);
        successCount++;

        logger.log('[Notification] Medication logged successfully:', {
          medicationId,
          medicationName: medication.name,
          scheduleId,
          dosage,
        });
      } catch (itemError) {
        const errorMessage = itemError instanceof Error ? itemError.message : String(itemError);
        logger.error('[Notification] Failed to log medication from notification:', {
          medicationId: medicationIds[i],
          scheduleId: scheduleIds[i],
          error: errorMessage,
        });

        // Log individual failures
        await notifyUserOfError(
          'system',
          'Failed to log one of your medications. Please check the app.',
          itemError instanceof Error ? itemError : new Error(errorMessage),
          { medicationId: medicationIds[i], scheduleId: scheduleIds[i], operation: 'handleTakeAllNow', index: i }
        );

        // Continue trying other medications even if one fails
        continue;
      }
    }

    if (results.length > 0) {
      logger.log('[Notification] Medications logged successfully:', {
        successCount: results.length,
        totalCount: medicationIds.length,
        results,
      });
    } else {
      logger.error('[Notification] Failed to log any medications', {
        totalCount: medicationIds.length,
      });

      // Notify user if ALL failed
      await notifyUserOfError(
        'system',
        'Failed to log your medications. Please open the app and try again.',
        new Error('All medications failed to log'),
        { medicationCount: medicationIds.length, operation: 'handleTakeAllNow' }
      );
    }

    return { success: successCount, total: medicationIds.length };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[Notification] Error processing multiple medication logging:', {
      medicationCount: medicationIds.length,
      error: errorMessage,
    });

    // No silent failures
    await notifyUserOfError(
      'system',
      'An error occurred while logging your medications. Please try again.',
      error instanceof Error ? error : new Error(errorMessage),
      { medicationCount: medicationIds.length, operation: 'handleTakeAllNow' }
    );

    // Return error state instead of throwing
    return { success: 0, total: medicationIds.length };
  }
}

/**
 * Handle "Remind Later" action - reschedule grouped notification.
 * Delegates to unified handleSnoozeNotifications.
 *
 * Now returns error state and notifies user
 */
export async function handleRemindLater(
  medicationIds: string[],
  scheduleIds: string[],
  originalTime: string,
  minutes: number
): Promise<boolean> {
  try {
    // Empty medication list edge case
    if (medicationIds.length === 0 || scheduleIds.length === 0) {
      // Log as this indicates a bug
      logger.error(new Error('handleRemindLater called with empty medication list'), {
        component: 'MedicationNotifications',
        operation: 'handleRemindLater',
        medicationIdsLength: medicationIds.length,
        scheduleIdsLength: scheduleIds.length,
        originalTime,
      });

      return false;
    }

    const medications = await Promise.all(
      medicationIds.map(id => medicationRepository.getById(id))
    );

    const validMedications = medications.filter(m => m !== null) as Medication[];
    if (validMedications.length === 0) {
      logger.error('[Notification] No valid medications found for remind later:', {
        medicationIds,
        originalTime,
      });

      // User notification
      await notifyUserOfError(
        'data',
        'Could not find medications for reminder. Please check your medications.',
        new Error('No valid medications found'),
        { medicationIds, scheduleIds, originalTime, operation: 'handleRemindLater' }
      );

      return false;
    }

    // Delegate to unified snooze handler
    return handleSnoozeNotifications(
      medicationIds,
      scheduleIds,
      validMedications,
      minutes,
      MULTIPLE_MEDICATION_REMINDER_CATEGORY,
      originalTime
    );
  } catch (error) {
    logger.error('[Notification] Error snoozing reminder:', error);

    // No silent failures
    await notifyUserOfError(
      'system',
      'Failed to snooze your medication reminder. Please try again.',
      error instanceof Error ? error : new Error(String(error)),
      { medicationIds, scheduleIds, originalTime, minutes, operation: 'handleRemindLater' }
    );

    return false;
  }
}

/**
 * Unified skip handler for both single and grouped medications.
 * Records skipped doses for each medication in the list.
 *
 * Similar pattern to handleSnoozeNotifications - consolidates logic for
 * single (handleSkip) and multi (handleSkipAll) operations.
 */
async function handleSkipNotifications(
  medicationIds: string[],
  scheduleIds: string[]
): Promise<{ success: number; total: number }> {
  const { useMedicationStore } = await import('../../store/medicationStore');
  let successCount = 0;

  for (let i = 0; i < medicationIds.length; i++) {
    const medicationId = medicationIds[i];
    const scheduleId = scheduleIds[i];

    try {
      const result = await useMedicationStore.getState().loadMedicationWithDetails(medicationId);

      if (!result || !result.medication) {
        logger.error('[Notification] Medication not found for skip:', { medicationId, scheduleId });
        continue;
      }

      const { medication } = result;

      // Record the skipped dose in the database
      const timestamp = Date.now();
      await useMedicationStore.getState().logDose({
        medicationId,
        scheduleId,
        timestamp,
        quantity: 0, // Skipped doses have quantity 0
        dosageAmount: medication.dosageAmount,
        dosageUnit: medication.dosageUnit,
        status: 'skipped',
        notes: 'Skipped from notification',
        updatedAt: timestamp,
      });

      successCount++;
    } catch (itemError) {
      logger.error('[Notification] Failed to skip medication:', {
        medicationId,
        scheduleId,
        error: itemError instanceof Error ? itemError.message : String(itemError),
      });
      // Continue with other medications
    }
  }

  logger.log('[Notification] Skip action completed:', {
    successCount,
    totalCount: medicationIds.length,
    date: toLocalDateString(),
  });

  return { success: successCount, total: medicationIds.length };
}

/**
 * Handle skip action for a single medication.
 * Delegates to handleSkipNotifications.
 */
export async function handleSkip(
  medicationId: string,
  scheduleId: string
): Promise<boolean> {
  try {
    const result = await handleSkipNotifications([medicationId], [scheduleId]);

    if (result.success === 0) {
      await notifyUserOfError(
        'data',
        'Could not skip medication. Please check your medications.',
        new Error(`Failed to skip medication: ${medicationId}`),
        { medicationId, scheduleId, operation: 'handleSkip' }
      );
      return false;
    }

    return true;
  } catch (error) {
    logger.error('[Notification] Error in handleSkip:', error);

    await notifyUserOfError(
      'system',
      'Failed to skip medication. Please try again.',
      error instanceof Error ? error : new Error(String(error)),
      { medicationId, scheduleId, operation: 'handleSkip' }
    );

    return false;
  }
}

/**
 * Handle skip all action for grouped notifications.
 * Delegates to handleSkipNotifications.
 */
export async function handleSkipAll(
  data: {
    medicationIds?: string[];
    scheduleIds?: string[];
    time?: string;
  }
): Promise<{ success: number; total: number }> {
  try {
    if (!data.medicationIds || !data.scheduleIds) {
      logger.error('[Notification] handleSkipAll called without medication data');
      return { success: 0, total: 0 };
    }

    const result = await handleSkipNotifications(data.medicationIds, data.scheduleIds);

    if (result.success === 0 && result.total > 0) {
      await notifyUserOfError(
        'system',
        'Failed to skip medications. Please try again.',
        new Error('All medications failed to skip'),
        { medicationCount: result.total, operation: 'handleSkipAll' }
      );
    }

    return result;
  } catch (error) {
    logger.error('[Notification] Error in handleSkipAll:', error);

    await notifyUserOfError(
      'system',
      'Failed to skip medications. Please try again.',
      error instanceof Error ? error : new Error(String(error)),
      { medicationCount: data.medicationIds?.length, operation: 'handleSkipAll' }
    );

    return { success: 0, total: data.medicationIds?.length ?? 0 };
  }
}
