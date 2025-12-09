import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';
import { Medication, MedicationSchedule } from '../../models/types';
// ARCHITECTURAL EXCEPTION: Notification handlers need direct repository access
// because they run in background when app may be suspended. See docs/store-repository-guidelines.md
import { medicationRepository, medicationScheduleRepository, medicationDoseRepository } from '../../database/medicationRepository';
import { useNotificationSettingsStore } from '../../store/notificationSettingsStore';
import { scheduleNotification } from './notificationScheduler';
import { notifyUserOfError } from './errorNotificationHelper';

// Notification categories for action buttons
export const MEDICATION_REMINDER_CATEGORY = 'MEDICATION_REMINDER';
export const MULTIPLE_MEDICATION_REMINDER_CATEGORY = 'MULTIPLE_MEDICATION_REMINDER';

/**
 * Handle "Take Now" action - log medication immediately
 * 
 * ISSUE FIX (HAND-138): Now returns error state instead of throwing
 * - Uses notifyUserOfError() for user feedback
 * - Logs to Sentry with full context
 * - Returns boolean to indicate success/failure
 */
export async function handleTakeNow(medicationId: string, scheduleId: string): Promise<boolean> {
  try {
    const medication = await medicationRepository.getById(medicationId);
    if (!medication) {
      logger.error('[Notification] Medication not found:', { medicationId, scheduleId });
      
      // Issue 2 (HAND-238) + Issue 5 (SUP-145): User-friendly error notification
      await notifyUserOfError(
        'data',
        'There was a problem with your medication reminder. Please check your medications.',
        new Error(`Medication not found: ${medicationId}`),
        { medicationId, scheduleId, operation: 'handleTakeNow' }
      );
      
      return false;
    }

    // Find the schedule to get the dosage
    const schedule = medication.schedule?.find(s => s.id === scheduleId);
    const dosage = schedule?.dosage ?? medication.defaultQuantity ?? 1;

    // Use store's logDose to update both database and state
    // Dynamic import to avoid circular dependency
    const { useMedicationStore } = await import('../../store/medicationStore');
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
      
      // Issue 2 (HAND-238): User notification for validation errors
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
    
    // Issue 2 (HAND-238) + Issue 3 (HAND-334): No silent failures
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
 * Handle "Snooze" action - reschedule notification
 * 
 * ISSUE FIX (HAND-138): Now returns error state and notifies user
 * 
 * NOTE (HAND-346): This is "snooze" for SINGLE medications (10 min fixed).
 * For MULTIPLE medications, use handleRemindLater() which allows custom delays.
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
      
      // Issue 2 (HAND-238): User notification
      await notifyUserOfError(
        'data',
        'Could not snooze medication reminder. Please check your medications.',
        new Error(`Medication not found: ${medicationId}`),
        { medicationId, scheduleId, operation: 'handleSnooze' }
      );
      
      return false;
    }

    // Get effective notification settings for this medication
    const effectiveSettings = useNotificationSettingsStore.getState().getEffectiveSettings(medicationId);

    // Schedule a new notification in X minutes
    const snoozeTime = new Date(Date.now() + minutes * 60 * 1000);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Reminder: ${medication.name}`,
        body: `Time to take your medication (snoozed)`,
        data: { medicationId, scheduleId },
        categoryIdentifier: MEDICATION_REMINDER_CATEGORY,
        sound: true,
        // Time-sensitive notification settings for Android and iOS
        ...(Notifications.AndroidNotificationPriority && {
          priority: Notifications.AndroidNotificationPriority.HIGH,
        }),
        // Only set time-sensitive interruption level if enabled in settings
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(effectiveSettings.timeSensitiveEnabled && { interruptionLevel: 'timeSensitive' } as any),
      },
      // Date trigger type is not exported by expo-notifications
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      trigger: snoozeTime as any,
    });

    logger.log('[Notification] Snoozed for', minutes, 'minutes');
    return true;
  } catch (error) {
    logger.error('[Notification] Error snoozing notification:', error);
    
    // Issue 2 (HAND-238) + Issue 3 (HAND-334): No silent failures
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
 * SAFETY NOTE (HAND-111): This action requires explicit user tap on the "Take All" button.
 * It is NOT automatic - the user must consciously choose to take all medications.
 * The button is a convenience feature for users who want to log multiple medications at once,
 * but it defers to the user for the final decision.
 * 
 * ISSUE FIX (HAND-138, HAND-254): Now returns error state and handles empty lists
 * - Returns object with success count and total count
 * - Uses notifyUserOfError() for failures
 * - Logs each error to Sentry
 */
export async function handleTakeAllNow(
  medicationIds: string[],
  scheduleIds: string[]
): Promise<{ success: number; total: number }> {
  try {
    // Issue 9 (HAND-254): Empty medication list edge case
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
        const medication = await medicationRepository.getById(medicationId);
        if (!medication) {
          logger.error('[Notification] Medication not found in group:', { medicationId, scheduleId });
          
          // Issue 2 (HAND-238) + Issue 3 (HAND-334): Log each failure
          await notifyUserOfError(
            'data',
            'One of your medications could not be logged. Please check your medications.',
            new Error(`Medication not found: ${medicationId}`),
            { medicationId, scheduleId, operation: 'handleTakeAllNow', index: i }
          );
          
          continue;
        }

        // Find the schedule to get the dosage
        const schedule = medication.schedule?.find(s => s.id === scheduleId);
        const dosage = schedule?.dosage ?? medication.defaultQuantity ?? 1;

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
          
          // Issue 2 (HAND-238): User notification for each failure
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
        
        // Issue 2 (HAND-238) + Issue 3 (HAND-334): Log individual failures
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
      
      // Issue 2 (HAND-238): Notify user if ALL failed
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
    
    // Issue 2 (HAND-238) + Issue 3 (HAND-334): No silent failures
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
 * Handle "Remind Later" action - reschedule grouped notification
 * 
 * ISSUE FIX (HAND-138): Now returns error state and notifies user
 * 
 * NOTE (HAND-346): This is "remind later" for MULTIPLE medications.
 * For SINGLE medication snooze, use handleSnooze() which is simpler.
 * Difference: remindLater handles groups, snooze handles single meds with fixed 10min delay.
 */
export async function handleRemindLater(
  medicationIds: string[],
  scheduleIds: string[],
  originalTime: string,
  minutes: number
): Promise<boolean> {
  try {
    // Issue 9 (HAND-254): Empty medication list edge case
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
      
      // Issue 2 (HAND-238): User notification
      await notifyUserOfError(
        'data',
        'Could not find medications for reminder. Please check your medications.',
        new Error('No valid medications found'),
        { medicationIds, scheduleIds, originalTime, operation: 'handleRemindLater' }
      );
      
      return false;
    }

    // Get effective notification settings
    // For grouped notifications, use time-sensitive if ANY medication has it enabled
    const settingsStore = useNotificationSettingsStore.getState();
    const anyTimeSensitive = validMedications.some((medication) => {
      const settings = settingsStore.getEffectiveSettings(medication.id);
      return settings.timeSensitiveEnabled;
    });

    // Schedule a new notification in X minutes
    const snoozeTime = new Date(Date.now() + minutes * 60 * 1000);

    const medicationNames = validMedications.map(m => m.name).join(', ');
    const medicationCount = validMedications.length;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Reminder: ${medicationCount} Medications`,
        body: `Time to take: ${medicationNames}`,
        data: {
          medicationIds,
          scheduleIds,
          time: originalTime,
        },
        categoryIdentifier: MULTIPLE_MEDICATION_REMINDER_CATEGORY,
        sound: true,
        // Time-sensitive notification settings for Android and iOS
        ...(Notifications.AndroidNotificationPriority && {
          priority: Notifications.AndroidNotificationPriority.HIGH,
        }),
        // Only set time-sensitive interruption level if enabled for any medication in the group
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(anyTimeSensitive && { interruptionLevel: 'timeSensitive' } as any),
      },
      // Date trigger type is not exported by expo-notifications
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      trigger: snoozeTime as any,
    });

    logger.log('[Notification] Reminder snoozed for', minutes, 'minutes', {
      medicationCount,
      validCount: validMedications.length,
    });
    
    return true;
  } catch (error) {
    logger.error('[Notification] Error snoozing reminder:', error);
    
    // Issue 2 (HAND-238) + Issue 3 (HAND-334): No silent failures
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
 * Schedule a follow-up reminder for a scheduled notification (daily trigger)
 * This schedules follow-up reminders that fire every day after the main notification
 */
async function scheduleFollowUpForScheduledNotification(
  medication: Medication,
  schedule: MedicationSchedule,
  delayMinutes: number,
  useCriticalAlerts: boolean
): Promise<void> {
  try {
    // Parse the scheduled time
    const [hours, minutes] = schedule.time.split(':').map(Number);
    
    // Calculate follow-up time (add delay to scheduled time)
    const followUpDate = new Date();
    followUpDate.setHours(hours, minutes + delayMinutes, 0, 0);
    
    // If follow-up crosses midnight, adjust accordingly
    const followUpHour = followUpDate.getHours();
    const followUpMinute = followUpDate.getMinutes();

    logger.log('[Notification] Scheduling daily follow-up for', medication.name, 'at', `${followUpHour}:${followUpMinute}`, {
      delayMinutes,
      useCriticalAlerts,
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Reminder: ${medication.name}`,
        body: 'Did you take your medication?',
        data: {
          medicationId: medication.id,
          scheduleId: schedule.id,
          isFollowUp: true,
        },
        categoryIdentifier: MEDICATION_REMINDER_CATEGORY,
        sound: true,
        // Critical alert properties (only if enabled and entitlement is granted)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(useCriticalAlerts && { critical: true } as any),
        // Time-sensitive notification settings
        ...(Notifications.AndroidNotificationPriority && {
          priority: useCriticalAlerts 
            ? Notifications.AndroidNotificationPriority.MAX
            : Notifications.AndroidNotificationPriority.HIGH,
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(useCriticalAlerts && { interruptionLevel: 'critical' } as any),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: followUpHour,
        minute: followUpMinute,
      },
    });

    logger.log('[Notification] Scheduled daily follow-up reminder for', medication.name, 'at', `${followUpHour}:${followUpMinute}`);
  } catch (error) {
    logger.error('[Notification] Error scheduling daily follow-up reminder:', error);
  }
}

/**
 * Schedule a follow-up reminder for a scheduled multiple medication notification
 */
async function scheduleFollowUpForScheduledMultipleNotification(
  items: Array<{ medication: Medication; schedule: MedicationSchedule }>,
  time: string,
  delayMinutes: number,
  useCriticalAlerts: boolean
): Promise<void> {
  try {
    // Parse the scheduled time
    const [hours, minutes] = time.split(':').map(Number);
    
    // Calculate follow-up time
    const followUpDate = new Date();
    followUpDate.setHours(hours, minutes + delayMinutes, 0, 0);
    
    const followUpHour = followUpDate.getHours();
    const followUpMinute = followUpDate.getMinutes();

    const medicationCount = items.length;
    const medicationNames = items.map(({ medication }) => medication.name).join(', ');
    const medicationIds = items.map(({ medication }) => medication.id);
    const scheduleIds = items.map(({ schedule }) => schedule.id);

    logger.log('[Notification] Scheduling daily follow-up for', medicationCount, 'medications at', `${followUpHour}:${followUpMinute}`, {
      delayMinutes,
      useCriticalAlerts,
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Reminder: ${medicationCount} Medications`,
        body: `Did you take: ${medicationNames}?`,
        data: {
          medicationIds,
          scheduleIds,
          time,
          isFollowUp: true,
        },
        categoryIdentifier: MULTIPLE_MEDICATION_REMINDER_CATEGORY,
        sound: true,
        // Critical alert properties (only if enabled and entitlement is granted)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(useCriticalAlerts && { critical: true } as any),
        // Time-sensitive notification settings
        ...(Notifications.AndroidNotificationPriority && {
          priority: useCriticalAlerts 
            ? Notifications.AndroidNotificationPriority.MAX
            : Notifications.AndroidNotificationPriority.HIGH,
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(useCriticalAlerts && { interruptionLevel: 'critical' } as any),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: followUpHour,
        minute: followUpMinute,
      },
    });

    logger.log('[Notification] Scheduled daily follow-up reminder for', medicationCount, 'medications at', `${followUpHour}:${followUpMinute}`);
  } catch (error) {
    logger.error('[Notification] Error scheduling daily follow-up reminder for multiple medications:', error);
  }
}

/**
 * Schedule a notification for a single medication schedule
 * 
 * ISSUE FIX (SCHED-324): Now logs scheduling errors to Sentry
 */
export async function scheduleSingleNotification(
  medication: Medication,
  schedule: MedicationSchedule
): Promise<string | null> {
  try {
    // Parse the time (HH:mm format)
    const [hours, minutes] = schedule.time.split(':').map(Number);

    // Get effective notification settings for this medication
    const effectiveSettings = useNotificationSettingsStore.getState().getEffectiveSettings(medication.id);

    logger.log('[Notification] Scheduling single medication for', hours, ':', minutes, {
      timeSensitive: effectiveSettings.timeSensitiveEnabled,
      followUpDelay: effectiveSettings.followUpDelay,
    });

    const notificationId = await scheduleNotification({
      title: `Time for ${medication.name}`,
      body: `${schedule.dosage} dose(s) - ${medication.dosageAmount}${medication.dosageUnit} each`,
      data: {
        medicationId: medication.id,
        scheduleId: schedule.id,
      },
      categoryIdentifier: MEDICATION_REMINDER_CATEGORY,
      sound: true,
      // Time-sensitive notification settings for Android and iOS
      ...(Notifications.AndroidNotificationPriority && {
        priority: Notifications.AndroidNotificationPriority.HIGH,
      }),
      // Only set time-sensitive interruption level if enabled in settings
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(effectiveSettings.timeSensitiveEnabled && { interruptionLevel: 'timeSensitive' } as any), // iOS: breaks through Focus modes
    }, {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: hours,
      minute: minutes,
    });

    logger.log('[Notification] Scheduled for', medication.name, 'at', schedule.time);

    // Schedule follow-up reminder if enabled
    if (effectiveSettings.followUpDelay !== 'off') {
      await scheduleFollowUpForScheduledNotification(
        medication,
        schedule,
        effectiveSettings.followUpDelay,
        effectiveSettings.criticalAlertsEnabled
      );
    }

    return notificationId;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Issue 4 (SCHED-324): Log scheduling errors
    logger.error(error instanceof Error ? error : new Error(errorMessage), {
      component: 'NotificationScheduler',
      operation: 'scheduleSingleNotification',
      medicationId: medication.id,
      medicationName: medication.name,
      scheduleId: schedule.id,
      scheduleTime: schedule.time,
      errorMessage,
    });
    
    return null;
  }
}

/**
 * Schedule a grouped notification for multiple medications at the same time
 */
export async function scheduleMultipleNotification(
  items: Array<{ medication: Medication; schedule: MedicationSchedule }>,
  time: string
): Promise<string | null> {
  try {
    // Parse the time (HH:mm format)
    const [hours, minutes] = time.split(':').map(Number);

    const medicationNames = items.map(({ medication }) => medication.name).join(', ');
    const medicationCount = items.length;
    const medicationIds = items.map(({ medication }) => medication.id);
    const scheduleIds = items.map(({ schedule }) => schedule.id);

    // Get effective notification settings
    // For grouped notifications, use time-sensitive if ANY medication has it enabled
    const settingsStore = useNotificationSettingsStore.getState();
    const anyTimeSensitive = items.some(({ medication }) => {
      const settings = settingsStore.getEffectiveSettings(medication.id);
      return settings.timeSensitiveEnabled;
    });

    logger.log('[Notification] Scheduling combined notification for', medicationCount, 'medications at', time, {
      timeSensitive: anyTimeSensitive,
    });

    const notificationId = await scheduleNotification({
      title: `Time for ${medicationCount} Medications`,
      body: medicationNames,
      data: {
        medicationIds,
        scheduleIds,
        time,
      },
      categoryIdentifier: MULTIPLE_MEDICATION_REMINDER_CATEGORY,
      sound: true,
      // Time-sensitive notification settings for Android and iOS
      ...(Notifications.AndroidNotificationPriority && {
        priority: Notifications.AndroidNotificationPriority.HIGH,
      }),
      // Only set time-sensitive interruption level if enabled for any medication in the group
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(anyTimeSensitive && { interruptionLevel: 'timeSensitive' } as any), // iOS: breaks through Focus modes
    }, {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: hours,
      minute: minutes,
    });

    logger.log('[Notification] Scheduled combined notification for', medicationCount, 'medications at', time);

    // Schedule follow-up reminder if enabled for any medication in the group
    // Use the most conservative setting (longest delay, enable critical if any has it)
    const delays = items.map(({ medication }) => {
      const settings = settingsStore.getEffectiveSettings(medication.id);
      return settings.followUpDelay;
    }).filter(d => d !== 'off') as number[];

    const anyCritical = items.some(({ medication }) => {
      const settings = settingsStore.getEffectiveSettings(medication.id);
      return settings.criticalAlertsEnabled;
    });

    if (delays.length > 0) {
      // Use the maximum delay from all medications in the group
      const maxDelay = Math.max(...delays);
      await scheduleFollowUpForScheduledMultipleNotification(
        items,
        time,
        maxDelay,
        anyCritical
      );
    }

    return notificationId;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Issue 4 (SCHED-324): Log scheduling errors
    logger.error(error instanceof Error ? error : new Error(errorMessage), {
      component: 'NotificationScheduler',
      operation: 'scheduleMultipleNotification',
      medicationCount: items.length,
      medicationIds: items.map(({ medication }) => medication.id),
      medicationNames: items.map(({ medication }) => medication.name),
      time,
      errorMessage,
    });
    
    return null;
  }
}

/**
 * Cancel all notifications for a medication
 */
export async function cancelMedicationNotifications(medicationId: string): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const medicationNotifs = scheduled.filter(
      // Notification data type is dynamic
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (n) => (n.content.data as any)?.medicationId === medicationId
    );

    for (const notif of medicationNotifs) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }

    logger.log('[Notification] Cancelled', medicationNotifs.length, 'notifications for medication');
  } catch (error) {
    logger.error('[Notification] Error cancelling medication notifications:', error);
  }
}

/**
 * Cancel scheduled medication reminder for a specific schedule
 * This is used when medication is logged before the scheduled reminder time
 * to prevent the notification from firing after the dose was already taken
 *
 * Handles both single and grouped notifications:
 * - Single: medicationId and scheduleId in data
 * - Grouped: medicationIds[] and scheduleIds[] arrays in data
 */
export async function cancelScheduledMedicationReminder(medicationId: string, scheduleId?: string): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    let cancelledCount = 0;

    for (const notif of scheduled) {
      const data = notif.content.data as {
        medicationId?: string;
        medicationIds?: string[];
        scheduleId?: string;
        scheduleIds?: string[];
      };

      let shouldCancel = false;

      // Single medication notification
      if (data.medicationId === medicationId) {
        if (scheduleId) {
          // Only cancel if scheduleId matches (for medications with multiple daily schedules)
          shouldCancel = data.scheduleId === scheduleId;
        } else {
          shouldCancel = true;
        }
      }

      // Grouped notification - check if this medication/schedule is in the group
      if (data.medicationIds && data.scheduleIds) {
        for (let i = 0; i < data.medicationIds.length; i++) {
          if (data.medicationIds[i] === medicationId) {
            if (scheduleId) {
              shouldCancel = data.scheduleIds[i] === scheduleId;
            } else {
              shouldCancel = true;
            }
            break;
          }
        }
      }

      if (shouldCancel) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
        cancelledCount++;
        logger.log('[Notification] Cancelled scheduled reminder:', {
          notificationId: notif.identifier,
          medicationId,
          scheduleId,
        });
      }
    }

    if (cancelledCount > 0) {
      logger.log('[Notification] Cancelled', cancelledCount, 'scheduled reminders for medication');
    }
  } catch (error) {
    logger.error('[Notification] Error cancelling scheduled medication reminder:', error);
  }
}

/**
 * Dismiss presented notifications for a medication
 * This removes notifications from the notification tray when medication is logged from the app
 *
 * BREAKING CHANGE (DIS-106a & DIS-106b): scheduleId is now REQUIRED
 * - Removes unused "dismiss all" code path that was a bug vector
 * - In production, scheduleId is always provided when logging a dose
 * - This makes the function safer and more predictable
 *
 * SAFETY FIX (DIS-130 & DIS-171): For grouped notifications (multiple medications at the same time):
 * - Only dismisses group notification when ALL medications in the group are logged/skipped
 * - This prevents users from missing other medications in the group
 * - Checks database to verify all medications are accounted for before dismissing
 * 
 * For single medication notifications:
 * - Only dismisses if BOTH medicationId AND scheduleId match
 * - This ensures medications with multiple daily schedules only dismiss the correct notification
 * - Example: Med A at 9am and 9pm should only dismiss the 9am notification when logging the 9am dose
 */
export async function dismissMedicationNotification(medicationId: string, scheduleId: string): Promise<void> {
  try {
    logger.info('[Notification] dismissMedicationNotification called', {
      medicationId,
      scheduleId,
      component: 'NotificationDismiss',
    });

    // Get all presented notifications
    const presentedNotifications = await Notifications.getPresentedNotificationsAsync();

    logger.info('[Notification] Retrieved presented notifications', {
      totalPresented: presentedNotifications.length,
      medicationId,
      scheduleId,
      component: 'NotificationDismiss',
    });

    for (const notification of presentedNotifications) {
      const data = notification.request.content.data as {
        medicationId?: string;
        medicationIds?: string[];
        scheduleId?: string;
        scheduleIds?: string[];
        time?: string;
      };

      logger.info('[Notification] Processing notification for dismissal check', {
        notificationId: notification.request.identifier,
        notificationData: {
          medicationId: data.medicationId,
          medicationIds: data.medicationIds,
          scheduleId: data.scheduleId,
          scheduleIds: data.scheduleIds,
          time: data.time,
        },
        targetMedicationId: medicationId,
        targetScheduleId: scheduleId,
        component: 'NotificationDismiss',
      });

      // Check if this notification is for the medication being logged
      let shouldDismiss = false;

      // Single medication notification
      // BREAKING CHANGE (DIS-106a): scheduleId is now required - removed "dismiss all" logic
      if (data.medicationId === medicationId) {
        // Only dismiss if scheduleId matches (required parameter)
        shouldDismiss = data.scheduleId === scheduleId;
        
        logger.info('[Notification] Single medication notification match check', {
          notificationId: notification.request.identifier,
          medicationIdMatch: true,
          scheduleIdMatch: shouldDismiss,
          notificationScheduleId: data.scheduleId,
          targetScheduleId: scheduleId,
          shouldDismiss,
          component: 'NotificationDismiss',
        });
      }
      // Multiple medication notification - SAFETY CHECK: only dismiss if ALL medications are logged
      else if (data.medicationIds?.includes(medicationId)) {
        // BREAKING CHANGE (DIS-106a): scheduleId is now required
        // Find the index of the medication and check if schedule matches
        const medIndex = data.medicationIds.indexOf(medicationId);
        const scheduleMatches = data.scheduleIds?.[medIndex] === scheduleId;
        
        logger.info('[Notification] Multiple medication notification match check', {
          notificationId: notification.request.identifier,
          medicationIdInGroup: true,
          medicationIndex: medIndex,
          scheduleMatches,
          notificationScheduleId: data.scheduleIds?.[medIndex],
          targetScheduleId: scheduleId,
          totalMedicationsInGroup: data.medicationIds.length,
          component: 'NotificationDismiss',
        });
        
        if (scheduleMatches && data.medicationIds.length > 1) {
            // SAFETY FIX: Check if ALL medications in the group are logged before dismissing
            // This prevents the notification from being dismissed when only one medication is logged,
            // which would cause the user to potentially miss the other medications
            logger.info('[Notification] Checking if all medications in group are logged', {
              notificationId: notification.request.identifier,
              totalInGroup: data.medicationIds.length,
              medicationIds: data.medicationIds,
              scheduleIds: data.scheduleIds,
              component: 'NotificationDismiss',
            });
            
            let allLogged = true;
            
            for (let i = 0; i < data.medicationIds.length; i++) {
              const checkMedicationId = data.medicationIds[i];
              const checkScheduleId = data.scheduleIds?.[i];
              
              if (!checkScheduleId) continue; // Skip if no schedule ID
              
              try {
                // Get the medication to find schedule time and timezone
                const medication = await medicationRepository.getById(checkMedicationId);
                const schedule = medication?.schedule?.find(s => s.id === checkScheduleId);
                
                logger.info('[Notification] Checking individual medication in group', {
                  notificationId: notification.request.identifier,
                  checkingMedicationId: checkMedicationId,
                  checkingScheduleId: checkScheduleId,
                  medicationFound: !!medication,
                  scheduleFound: !!schedule,
                  medicationIndex: i,
                  component: 'NotificationDismiss',
                });
                
                if (medication && schedule) {
                  // Check if this medication was logged for this schedule today
                  const wasLogged = await medicationDoseRepository.wasLoggedForScheduleToday(
                    checkMedicationId,
                    checkScheduleId,
                    schedule.time,
                    schedule.timezone
                  );
                  
                  logger.info('[Notification] Medication logged status check', {
                    notificationId: notification.request.identifier,
                    checkingMedicationId: checkMedicationId,
                    checkingScheduleId: checkScheduleId,
                    wasLogged,
                    scheduleTime: schedule.time,
                    scheduleTimezone: schedule.timezone,
                    component: 'NotificationDismiss',
                  });
                  
                  if (!wasLogged) {
                    allLogged = false;
                    logger.info('[Notification] Grouped notification: Not all medications logged yet, keeping notification', {
                      notificationId: notification.request.identifier,
                      notLoggedMed: checkMedicationId,
                      notLoggedSchedule: checkScheduleId,
                      totalInGroup: data.medicationIds.length,
                      checkedSoFar: i + 1,
                      component: 'NotificationDismiss',
                    });
                    break;
                  }
                }
              } catch (error) {
                // On error checking a medication, err on the side of caution and don't dismiss
                logger.error('[Notification] Error checking if medication logged, keeping notification', error instanceof Error ? error : new Error(String(error)), {
                  notificationId: notification.request.identifier,
                  checkingMedicationId: checkMedicationId,
                  checkingScheduleId: checkScheduleId,
                  component: 'NotificationDismiss',
                });
                allLogged = false;
                break;
              }
            }
            
            shouldDismiss = allLogged;
            
            logger.info('[Notification] All medications logged check complete', {
              notificationId: notification.request.identifier,
              allLogged,
              shouldDismiss,
              totalInGroup: data.medicationIds.length,
              component: 'NotificationDismiss',
            });
        } else {
          // Single medication in group or schedule doesn't match
          shouldDismiss = scheduleMatches && data.medicationIds.length === 1;
          
          logger.info('[Notification] Single medication in group or schedule mismatch', {
            notificationId: notification.request.identifier,
            scheduleMatches,
            groupSize: data.medicationIds.length,
            shouldDismiss,
            component: 'NotificationDismiss',
          });
        }
      }

      if (shouldDismiss) {
        try {
          logger.info('[Notification] Attempting to dismiss notification', {
            notificationId: notification.request.identifier,
            medicationId,
            scheduleId,
            component: 'NotificationDismiss',
          });
          
          await Notifications.dismissNotificationAsync(notification.request.identifier);
          
          logger.info('[Notification] Successfully dismissed notification', {
            notificationId: notification.request.identifier,
            medicationId,
            scheduleId,
            component: 'NotificationDismiss',
          });
        } catch (dismissError) {
          // Log dismiss failure with notification context (DIS-208)
          const dismissErrorMessage = dismissError instanceof Error ? dismissError.message : String(dismissError);
          
          logger.warn(dismissError instanceof Error ? dismissError : new Error(dismissErrorMessage), {
            component: 'NotificationDismiss',
            operation: 'dismissNotificationAsync',
            notificationId: notification.request.identifier,
            medicationId,
            scheduleId,
            errorMessage: dismissErrorMessage,
          });
          // Continue processing other notifications even if one fails
        }
      } else {
        logger.info('[Notification] Not dismissing notification - criteria not met', {
          notificationId: notification.request.identifier,
          shouldDismiss,
          notificationMedicationId: data.medicationId,
          notificationMedicationIds: data.medicationIds,
          notificationScheduleId: data.scheduleId,
          notificationScheduleIds: data.scheduleIds,
          targetMedicationId: medicationId,
          targetScheduleId: scheduleId,
          component: 'NotificationDismiss',
        });
      }
    }
    
    logger.info('[Notification] Finished processing all presented notifications', {
      totalProcessed: presentedNotifications.length,
      medicationId,
      scheduleId,
      component: 'NotificationDismiss',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Log with full context (DIS-187, DIS-208)
    logger.error(error instanceof Error ? error : new Error(errorMessage), {
      component: 'NotificationDismiss',
      operation: 'dismissMedicationNotification',
      medicationId,
      scheduleId,
      errorMessage,
    });
  }
}

/**
 * Reschedule all medication notifications with grouping
 * This should be called after any medication schedule changes
 */
export async function rescheduleAllMedicationNotifications(): Promise<void> {
  try {
    // Cancel only medication-specific notifications (not daily check-in or other notifications)
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const medicationNotifs = scheduled.filter((n) => {
      const data = n.content.data as Record<string, unknown> | null | undefined;
      if (!data) return false;
      
      const medicationId = data.medicationId as string | undefined;
      const medicationIds = data.medicationIds as string[] | undefined;
      const type = data.type as string | undefined;
      
      // Filter for medication reminders (have medicationId or medicationIds, but not type 'daily_checkin')
      return (medicationId || medicationIds) && type !== 'daily_checkin';
    });

    for (const notif of medicationNotifs) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }

    logger.log('[Notification] Cancelled', medicationNotifs.length, 'medication notifications');

    // Get all active medications with schedules
    const medications = await medicationRepository.getActive();
    const items: Array<{ medication: Medication; schedule: MedicationSchedule }> = [];

    for (const medication of medications) {
      if (medication.type === 'preventative' && medication.scheduleFrequency === 'daily') {
        const schedules = await medicationScheduleRepository.getByMedicationId(medication.id);
        for (const schedule of schedules) {
          if (schedule.enabled) {
            items.push({ medication, schedule });
          }
        }
      }
    }

    // Group by time
    const grouped = new Map<string, Array<{ medication: Medication; schedule: MedicationSchedule }>>();

    for (const item of items) {
      const time = item.schedule.time;
      if (!grouped.has(time)) {
        grouped.set(time, []);
      }
      grouped.get(time)!.push(item);
    }

    const notificationIds = new Map<string, string>();

    // Schedule notifications for each time group
    for (const [time, groupItems] of grouped.entries()) {
      if (groupItems.length === 1) {
        // Single medication - use single notification
        const { medication, schedule } = groupItems[0];
        const notificationId = await scheduleSingleNotification(medication, schedule);
        if (notificationId) {
          notificationIds.set(schedule.id, notificationId);
        }
      } else {
        // Multiple medications - use grouped notification
        const notificationId = await scheduleMultipleNotification(groupItems, time);
        if (notificationId) {
          // Store the same notification ID for all schedules in this group
          for (const { schedule } of groupItems) {
            notificationIds.set(schedule.id, notificationId);
          }
        }
      }
    }

    // Update schedules with notification IDs
    for (const [scheduleId, notificationId] of notificationIds.entries()) {
      await medicationScheduleRepository.update(scheduleId, {
        notificationId,
      });
    }

    logger.log('[Notification] Rescheduled all medication notifications with grouping:', notificationIds.size);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Issue 3 (HAND-334) + Issue 4 (SCHED-324): No silent failures
    logger.error(error instanceof Error ? error : new Error(errorMessage), {
      component: 'NotificationScheduler',
      operation: 'rescheduleAllMedicationNotifications',
      errorMessage,
    });
    
    // Optionally notify user if this is a critical failure
    // For now, just log - user will notice if notifications stop working
  }
}

/**
 * Reschedule ALL notifications (medications AND daily check-in)
 * This should be called on app startup and when global notifications are toggled
 */
export async function rescheduleAllNotifications(): Promise<void> {
  try {
    logger.log('[Notification] Rescheduling all notifications (medications and daily check-in)');

    // Cancel ALL scheduled notifications once
    await Notifications.cancelAllScheduledNotificationsAsync();
    logger.log('[Notification] Cancelled all scheduled notifications');

    // Get all active medications with schedules
    const medications = await medicationRepository.getActive();
    const items: Array<{ medication: Medication; schedule: MedicationSchedule }> = [];

    for (const medication of medications) {
      if (medication.type === 'preventative' && medication.scheduleFrequency === 'daily') {
        const schedules = await medicationScheduleRepository.getByMedicationId(medication.id);
        for (const schedule of schedules) {
          if (schedule.enabled) {
            items.push({ medication, schedule });
          }
        }
      }
    }

    // Group by time
    const grouped = new Map<string, Array<{ medication: Medication; schedule: MedicationSchedule }>>();

    for (const item of items) {
      const time = item.schedule.time;
      if (!grouped.has(time)) {
        grouped.set(time, []);
      }
      grouped.get(time)!.push(item);
    }

    const notificationIds = new Map<string, string>();

    // Schedule notifications for each time group
    for (const [time, groupItems] of grouped.entries()) {
      if (groupItems.length === 1) {
        // Single medication - use single notification
        const { medication, schedule } = groupItems[0];
        const notificationId = await scheduleSingleNotification(medication, schedule);
        if (notificationId) {
          notificationIds.set(schedule.id, notificationId);
        }
      } else {
        // Multiple medications - use grouped notification
        const notificationId = await scheduleMultipleNotification(groupItems, time);
        if (notificationId) {
          // Store the same notification ID for all schedules in this group
          for (const { schedule } of groupItems) {
            notificationIds.set(schedule.id, notificationId);
          }
        }
      }
    }

    // Update schedules with notification IDs
    for (const [scheduleId, notificationId] of notificationIds.entries()) {
      await medicationScheduleRepository.update(scheduleId, {
        notificationId,
      });
    }

    logger.log('[Notification] Rescheduled', notificationIds.size, 'medication notifications');

    // Reschedule daily check-in notification
    const { dailyCheckinService } = await import('./dailyCheckinService');
    await dailyCheckinService.scheduleNotification();

    logger.log('[Notification] All notifications rescheduled successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Issue 3 (HAND-334) + Issue 4 (SCHED-324): No silent failures
    logger.error(error instanceof Error ? error : new Error(errorMessage), {
      component: 'NotificationScheduler',
      operation: 'rescheduleAllNotifications',
      errorMessage,
    });
    
    throw error;
  }
}
