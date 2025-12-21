import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';
import { Medication, MedicationSchedule } from '../../models/types';
import { useNotificationSettingsStore } from '../../store/notificationSettingsStore';
import { scheduleNotificationAtomic } from './notificationScheduler';
import {
  toLocalDateString,
  toLocalDateStringOffset,
  localDateTimeFromStrings,
} from '../../utils/dateFormatting';
import { scheduledNotificationRepository } from '../../database/scheduledNotificationRepository';
import { ScheduledNotificationMappingInput } from '../../types/notifications';
import { MEDICATION_REMINDER_CATEGORY, MULTIPLE_MEDICATION_REMINDER_CATEGORY } from './notificationCategories';

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

/**
 * Helper function to schedule a grouped notification for multiple medications at a specific time
 *
 * This function handles the common logic for scheduling grouped notifications:
 * - Schedules a single notification for multiple medications
 * - Creates database mappings with isGrouped=true and groupKey set
 * - Schedules follow-up notifications if any medication has follow-up enabled
 *
 * @param groupItems - Array of medication/schedule pairs scheduled at the same time
 * @param time - The scheduled time (HH:mm format)
 * @param triggerDate - The date/time when the notification should fire
 * @param dateString - The date string for database mapping (YYYY-MM-DD format)
 */
export async function scheduleGroupedNotificationForTime(
  groupItems: Array<{ medication: Medication; schedule: MedicationSchedule }>,
  time: string,
  triggerDate: Date,
  dateString: string
): Promise<void> {
  const medicationIds = groupItems.map(({ medication }) => medication.id);
  const scheduleIds = groupItems.map(({ schedule }) => schedule.id);
  const medicationNames = groupItems.map(({ medication }) => medication.name).join(', ');

  // Check if all medications in the group already have a mapping for this date
  let allScheduled = true;
  for (const { medication, schedule } of groupItems) {
    const existing = await scheduledNotificationRepository.getMapping(
      medication.id,
      schedule.id,
      dateString,
      'reminder'
    );
    if (!existing) {
      allScheduled = false;
      break;
    }
  }

  if (!allScheduled) {
    // Get effective settings for all medications
    const settingsStore = useNotificationSettingsStore.getState();
    const anyTimeSensitive = groupItems.some(({ medication }) => {
      const settings = settingsStore.getEffectiveSettings(medication.id);
      return settings.timeSensitiveEnabled;
    });

    // Schedule the grouped notification once
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Time for ${groupItems.length} Medications`,
        body: medicationNames,
        data: {
          medicationIds,
          scheduleIds,
          time,
          scheduledAt: Date.now(),
        },
        categoryIdentifier: MULTIPLE_MEDICATION_REMINDER_CATEGORY,
        sound: true,
        ...(anyTimeSensitive && { interruptionLevel: 'timeSensitive' } as unknown as Record<string, unknown>),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    if (!notificationId) {
      logger.error('[Notification] Failed to schedule grouped reminder notification', {
        component: 'NotificationScheduler',
        operation: 'scheduleGroupedNotificationForTime',
        medicationIds,
        medicationNames,
        time,
        date: dateString,
        triggerDate: triggerDate.toISOString(),
      });
    }

    // Create mappings for all medications in the group
    for (const { medication, schedule } of groupItems) {
      if (notificationId) {
        await scheduledNotificationRepository.saveMapping({
          notificationId,
          medicationId: medication.id,
          scheduleId: schedule.id,
          date: dateString,
          notificationType: 'reminder',
          isGrouped: true,
          groupKey: time,
        });
      }
    }
  }

  // Schedule grouped follow-up if any medication has it enabled
  const settingsStore = useNotificationSettingsStore.getState();
  const delays = groupItems.map(({ medication }) => {
    const settings = settingsStore.getEffectiveSettings(medication.id);
    return settings.followUpDelay;
  }).filter(d => d !== 'off') as number[];

  if (delays.length > 0) {
    // Use the maximum delay from all medications in the group
    const maxDelay = Math.max(...delays);
    const followUpDate = new Date(triggerDate.getTime() + maxDelay * 60 * 1000);

    if (followUpDate > new Date()) {
      // Check if all medications already have follow-up scheduled
      let allFollowUpsScheduled = true;
      for (const { medication, schedule } of groupItems) {
        const existing = await scheduledNotificationRepository.getMapping(
          medication.id,
          schedule.id,
          dateString,
          'follow_up'
        );
        if (!existing) {
          allFollowUpsScheduled = false;
          break;
        }
      }

      if (!allFollowUpsScheduled) {
        const anyCritical = groupItems.some(({ medication }) => {
          const settings = settingsStore.getEffectiveSettings(medication.id);
          return settings.criticalAlertsEnabled;
        });

        const anyTimeSensitive = groupItems.some(({ medication }) => {
          const settings = settingsStore.getEffectiveSettings(medication.id);
          return settings.timeSensitiveEnabled;
        });

        const followUpNotificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: `Reminder: ${groupItems.length} Medications`,
            body: `Did you take: ${medicationNames}?`,
            data: {
              medicationIds,
              scheduleIds,
              time,
              isFollowUp: true,
              scheduledAt: Date.now(),
            },
            categoryIdentifier: MULTIPLE_MEDICATION_REMINDER_CATEGORY,
            sound: true,
            ...(anyCritical && { critical: true } as unknown as Record<string, unknown>),
            ...(anyCritical && { interruptionLevel: 'critical' } as unknown as Record<string, unknown>),
            ...(!anyCritical && anyTimeSensitive && { interruptionLevel: 'timeSensitive' } as unknown as Record<string, unknown>),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: followUpDate,
          },
        });

        if (!followUpNotificationId) {
          logger.error('[Notification] Failed to schedule grouped follow-up notification', {
            component: 'NotificationScheduler',
            operation: 'scheduleGroupedNotificationForTime',
            medicationIds,
            medicationNames,
            time,
            date: dateString,
            followUpDate: followUpDate.toISOString(),
            maxDelay,
          });
        }

        // Create follow-up mappings for all medications in the group
        for (const { medication, schedule } of groupItems) {
          if (followUpNotificationId) {
            await scheduledNotificationRepository.saveMapping({
              notificationId: followUpNotificationId,
              medicationId: medication.id,
              scheduleId: schedule.id,
              date: dateString,
              notificationType: 'follow_up',
              isGrouped: true,
              groupKey: time,
            });
          }
        }
      }
    }
  }
}

/**
 * Schedule grouped notifications for N days
 * Groups medications by time and schedules them together
 *
 * Grouping Strategy:
 * - Medications are grouped by their scheduled time (HH:mm format)
 * - Each time group gets a single notification containing all medications for that time
 * - The `isGrouped: true` flag in database mappings indicates the notification is shared
 * - The `groupKey` field stores the time key (HH:mm) for identifying grouped notifications
 *
 * Follow-up Delay Behavior:
 * - When multiple medications in a group have different follow-up delays, the MAXIMUM delay is used
 * - Example: If Med A has 15-min follow-up and Med B has 60-min follow-up, the group follow-up fires at 60 minutes
 * - This ensures all medications get sufficient time before the follow-up reminder
 *
 * @param items - Array of medication/schedule pairs to schedule
 * @param days - Number of days to schedule
 */
export async function scheduleGroupedNotificationsForDays(
  items: Array<{ medication: Medication; schedule: MedicationSchedule }>,
  days: number
): Promise<void> {
  if (items.length === 0) {
    logger.log('[Notification] No items to schedule');
    return;
  }

  // Group by time and notification type (reminder vs follow-up)
  const grouped = new Map<string, Array<{ medication: Medication; schedule: MedicationSchedule }>>();

  for (const item of items) {
    const time = item.schedule.time;
    if (!grouped.has(time)) {
      grouped.set(time, []);
    }
    grouped.get(time)!.push(item);
  }

  logger.log('[Notification] Scheduling grouped notifications for days:', {
    itemCount: items.length,
    timeGroups: grouped.size,
    days,
  });

  // Schedule notifications for each day
  for (let i = 0; i < days; i++) {
    const dateString = toLocalDateStringOffset(i);

    // Schedule grouped notifications for each time group
    for (const [time, groupItems] of grouped.entries()) {
      const triggerDate = localDateTimeFromStrings(dateString, time);

      // Skip if trigger time has already passed
      if (triggerDate <= new Date()) {
        continue;
      }

      if (groupItems.length === 1) {
        // Single medication at this time - schedule individually
        const { medication, schedule } = groupItems[0];
        const effectiveSettings = useNotificationSettingsStore.getState().getEffectiveSettings(medication.id);

        // Check if already scheduled
        const existingMapping = await scheduledNotificationRepository.getMapping(
          medication.id,
          schedule.id,
          dateString,
          'reminder'
        );

        if (!existingMapping) {
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
                scheduledAt: Date.now(),
              },
              categoryIdentifier: MEDICATION_REMINDER_CATEGORY,
              sound: true,
              ...(effectiveSettings.timeSensitiveEnabled && { interruptionLevel: 'timeSensitive' } as unknown as Record<string, unknown>),
            },
            triggerDate,
            mapping
          );
        }

        // Schedule follow-up if enabled
        if (effectiveSettings.followUpDelay !== 'off') {
          const followUpDate = new Date(triggerDate.getTime() + effectiveSettings.followUpDelay * 60 * 1000);

          if (followUpDate > new Date()) {
            const existingFollowUp = await scheduledNotificationRepository.getMapping(
              medication.id,
              schedule.id,
              dateString,
              'follow_up'
            );

            if (!existingFollowUp) {
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
                    scheduledAt: Date.now(),
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
      } else {
        // Multiple medications at this time - schedule as grouped using helper function
        await scheduleGroupedNotificationForTime(groupItems, time, triggerDate, dateString);
      }
    }
  }

  logger.log('[Notification] Finished scheduling grouped notifications for days');
}
