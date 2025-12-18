import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';
import { Medication, MedicationSchedule } from '../../models/types';
import { useNotificationSettingsStore } from '../../store/notificationSettingsStore';
import {
  scheduleNotification,
  scheduleNotificationAtomic,
} from './notificationScheduler';
import {
  toLocalDateString,
  toLocalDateStringOffset,
  localDateTimeFromStrings,
} from '../../utils/dateFormatting';
import { scheduledNotificationRepository } from '../../database/scheduledNotificationRepository';
import { ScheduledNotificationMappingInput } from '../../types/notifications';
import { MEDICATION_REMINDER_CATEGORY, MULTIPLE_MEDICATION_REMINDER_CATEGORY } from './notificationCategories';

/**
 * Schedule a follow-up reminder for a scheduled notification (daily trigger)
 * This schedules follow-up reminders that fire every day after the main notification
 */
async function scheduleFollowUpForScheduledNotification(
  medication: Medication,
  schedule: MedicationSchedule,
  delayMinutes: number,
  useCriticalAlerts: boolean,
  useTimeSensitive: boolean = false
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
      useTimeSensitive,
    });

    // Determine interruption level: critical > timeSensitive > default
    const interruptionLevel = useCriticalAlerts ? 'critical' : (useTimeSensitive ? 'timeSensitive' : undefined);

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
        // Set interruption level for iOS (critical > timeSensitive)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(interruptionLevel && { interruptionLevel } as any),
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
  useCriticalAlerts: boolean,
  useTimeSensitive: boolean = false
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
      useTimeSensitive,
    });

    // Determine interruption level: critical > timeSensitive > default
    const interruptionLevel = useCriticalAlerts ? 'critical' : (useTimeSensitive ? 'timeSensitive' : undefined);

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
        // Set interruption level for iOS (critical > timeSensitive)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(interruptionLevel && { interruptionLevel } as any),
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
        effectiveSettings.criticalAlertsEnabled,
        effectiveSettings.timeSensitiveEnabled
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
        anyCritical,
        anyTimeSensitive
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
 * Schedule notifications for N days for a single medication schedule
 *
 * @param medication - The medication
 * @param schedule - The schedule
 * @param days - Number of days to schedule
 * @param startDate - Optional start date (defaults to today)
 */
export async function scheduleNotificationsForDays(
  medication: Medication,
  schedule: MedicationSchedule,
  days: number,
  startDate?: string
): Promise<void> {
  const effectiveSettings = useNotificationSettingsStore.getState().getEffectiveSettings(medication.id);
  const today = startDate || toLocalDateString();

  logger.log('[Notification] Scheduling notifications for days:', {
    medicationId: medication.id,
    scheduleId: schedule.id,
    days,
    startDate: today,
  });

  for (let i = 0; i < days; i++) {
    const dateString = toLocalDateStringOffset(i);

    const triggerDate = localDateTimeFromStrings(dateString, schedule.time);

    // Skip if trigger time has already passed
    if (triggerDate <= new Date()) {
      continue;
    }

    // Check if already scheduled for this date
    const existingMapping = await scheduledNotificationRepository.getMapping(
      medication.id,
      schedule.id,
      dateString,
      'reminder'
    );

    if (existingMapping) {
      logger.log('[Notification] Already scheduled for date:', dateString);
      continue;
    }

    // Schedule the reminder
    const mapping: ScheduledNotificationMappingInput = {
      medicationId: medication.id,
      scheduleId: schedule.id,
      date: dateString,
      notificationType: 'reminder',
      isGrouped: false,
    };

    await scheduleNotificationAtomic(
      {
        title: `Time for ${medication.name}`,
        body: `${schedule.dosage} dose(s) - ${medication.dosageAmount}${medication.dosageUnit} each`,
        data: {
          medicationId: medication.id,
          scheduleId: schedule.id,
          scheduledAt: Date.now(), // DIAGNOSTIC: Track when notification was scheduled for age calculation
        },
        categoryIdentifier: MEDICATION_REMINDER_CATEGORY,
        sound: true,
        ...(effectiveSettings.timeSensitiveEnabled && { interruptionLevel: 'timeSensitive' } as unknown as Record<string, unknown>),
      },
      triggerDate,
      mapping
    );

    // Schedule follow-up if enabled
    if (effectiveSettings.followUpDelay !== 'off') {
      const followUpDate = new Date(triggerDate.getTime() + effectiveSettings.followUpDelay * 60 * 1000);

      if (followUpDate > new Date()) {
        const followUpMapping: ScheduledNotificationMappingInput = {
          medicationId: medication.id,
          scheduleId: schedule.id,
          date: dateString,
          notificationType: 'follow_up',
          isGrouped: false,
        };

        await scheduleNotificationAtomic(
          {
            title: `Reminder: ${medication.name}`,
            body: 'Did you take your medication?',
            data: {
              medicationId: medication.id,
              scheduleId: schedule.id,
              isFollowUp: true,
              scheduledAt: Date.now(), // DIAGNOSTIC: Track when notification was scheduled for age calculation
            },
            categoryIdentifier: MEDICATION_REMINDER_CATEGORY,
            sound: true,
            ...(effectiveSettings.criticalAlertsEnabled && { critical: true } as unknown as Record<string, unknown>),
            ...(effectiveSettings.criticalAlertsEnabled && { interruptionLevel: 'critical' } as unknown as Record<string, unknown>),
          },
          followUpDate,
          followUpMapping
        );
      }
    }
  }

  logger.log('[Notification] Finished scheduling notifications for days:', {
    medicationId: medication.id,
    scheduleId: schedule.id,
  });
}
