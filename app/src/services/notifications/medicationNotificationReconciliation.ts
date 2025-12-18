import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';
import { Medication, MedicationSchedule } from '../../models/types';
// ARCHITECTURAL EXCEPTION: Notification handlers need direct repository access
// because they run in background when app may be suspended. See docs/store-repository-guidelines.md
import { medicationRepository, medicationScheduleRepository } from '../../database/medicationRepository';
import { useNotificationSettingsStore } from '../../store/notificationSettingsStore';
import {
  scheduleNotificationAtomic,
  cancelNotificationAtomic,
} from './notificationScheduler';
import {
  toLocalDateString,
  toLocalDateStringOffset,
  localDateTimeFromStrings,
} from '../../utils/dateFormatting';
import { scheduledNotificationRepository } from '../../database/scheduledNotificationRepository';
import { MEDICATION_REMINDER_CATEGORY, MULTIPLE_MEDICATION_REMINDER_CATEGORY } from './notificationCategories';
import {
  scheduleSingleNotification,
  scheduleMultipleNotification,
  scheduleGroupedNotificationsForDays,
} from './medicationNotificationScheduling';

/**
 * iOS limits total scheduled notifications to 64.
 * Calculate how many days of notifications we can schedule per medication.
 */
const IOS_NOTIFICATION_LIMIT = 64;

/**
 * Calculate how many days of notifications to schedule based on actual slots needed per day
 *
 * This calculates dynamically based on the actual notification slots needed:
 * - Each schedule with follow-up enabled needs 2 slots per day (reminder + follow-up)
 * - Each schedule with follow-up disabled needs 1 slot per day (reminder only)
 * - Reserved slots for daily check-in and buffer
 *
 * @param slotsNeededPerDay - Total notification slots needed per day (calculated by caller based on actual settings)
 * @returns Number of days to schedule notifications for
 */
export function calculateNotificationDays(slotsNeededPerDay: number): number {
  if (slotsNeededPerDay === 0) return 0;

  // Reserve slots for:
  // - 14 for daily check-in notifications (14 days)
  // - 2 for buffer/unexpected notifications
  const reservedSlots = 16;
  const availableSlots = IOS_NOTIFICATION_LIMIT - reservedSlots;

  // Calculate maximum days we can schedule
  const maxDays = Math.floor(availableSlots / slotsNeededPerDay);

  // Return at least 3 days, at most 14 days
  const result = Math.max(3, Math.min(maxDays, 14));

  logger.log('[Notification] calculateNotificationDays:', {
    slotsNeededPerDay,
    reservedSlots,
    availableSlots,
    maxDays,
    result,
  });

  return result;
}

/**
 * Fix notification schedule inconsistencies by checking for orphaned notifications
 *
 * This function specifically addresses the issue where notifications contain
 * schedule IDs that no longer exist in the medication's schedule array.
 * It cancels any notifications with invalid schedule IDs.
 */
export async function fixNotificationScheduleInconsistencies(): Promise<{
  orphanedNotifications: number;
  invalidScheduleIds: string[];
}> {
  try {
    logger.log('[Notification] Starting notification schedule consistency check...');

    // Get all scheduled notifications
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const medicationNotifs = scheduled.filter((n) => {
      const data = n.content.data as Record<string, unknown> | null | undefined;
      if (!data) return false;
      const medicationId = data.medicationId as string | undefined;
      const medicationIds = data.medicationIds as string[] | undefined;
      const type = data.type as string | undefined;
      return (medicationId || medicationIds) && type !== 'daily_checkin';
    });

    // Use store to load medications and schedules
    const { useMedicationStore } = await import('../../store/medicationStore');
    const store = useMedicationStore.getState();

    // Load medications and schedules into store state
    await store.loadMedications();
    await store.loadSchedules();

    // Get active medications from state
    const medications = store.medications.filter(m => m.active);
    const medicationMap = new Map<string, Medication>();
    for (const medication of medications) {
      medicationMap.set(medication.id, medication);
    }

    // Get schedules for each medication from store state
    const schedulesByMedicationId = new Map<string, MedicationSchedule[]>();
    for (const medication of medications) {
      const schedules = store.getSchedulesByMedicationId(medication.id);
      schedulesByMedicationId.set(medication.id, schedules);
    }

    let orphanedCount = 0;
    const invalidScheduleIds: string[] = [];

    for (const notif of medicationNotifs) {
      const data = notif.content.data as Record<string, unknown>;

      // Handle single medication notifications
      if (data.medicationId && data.scheduleId) {
        const medicationId = data.medicationId as string;
        const scheduleId = data.scheduleId as string;
        const medication = medicationMap.get(medicationId);
        const schedules = schedulesByMedicationId.get(medicationId) || [];

        if (!medication || !schedules.find(s => s.id === scheduleId)) {
          logger.warn('[Notification] Canceling orphaned notification with invalid schedule:', {
            notificationId: notif.identifier,
            medicationId,
            scheduleId,
            medicationExists: !!medication,
            availableScheduleIds: schedules.map(s => s.id),
          });

          await Notifications.cancelScheduledNotificationAsync(notif.identifier);
          orphanedCount++;
          invalidScheduleIds.push(scheduleId);
        }
      }

      // Handle grouped medication notifications
      if (data.medicationIds && data.scheduleIds) {
        const medicationIds = data.medicationIds as string[];
        const scheduleIds = data.scheduleIds as string[];
        let hasInvalidSchedule = false;

        for (let i = 0; i < medicationIds.length; i++) {
          const medicationId = medicationIds[i];
          const scheduleId = scheduleIds[i];
          const medication = medicationMap.get(medicationId);
          const schedules = schedulesByMedicationId.get(medicationId) || [];

          if (!medication || !schedules.find(s => s.id === scheduleId)) {
            hasInvalidSchedule = true;
            invalidScheduleIds.push(scheduleId);
          }
        }

        if (hasInvalidSchedule) {
          logger.warn('[Notification] Canceling orphaned grouped notification with invalid schedules:', {
            notificationId: notif.identifier,
            medicationIds,
            scheduleIds,
          });

          await Notifications.cancelScheduledNotificationAsync(notif.identifier);
          orphanedCount++;
        }
      }
    }

    logger.log('[Notification] Consistency check completed:', {
      totalChecked: medicationNotifs.length,
      orphanedCanceled: orphanedCount,
      invalidScheduleIds: [...new Set(invalidScheduleIds)],
    });

    return {
      orphanedNotifications: orphanedCount,
      invalidScheduleIds: [...new Set(invalidScheduleIds)],
    };
  } catch (error) {
    logger.error('[Notification] Error during consistency check:', error);
    throw error;
  }
}

/**
 * Reschedule all medication notifications using the one-time notification system
 *
 * This function:
 * 1. Cancels all existing OS medication notifications
 * 2. Clears all entries from the scheduled_notifications database table
 * 3. Schedules new one-time notifications for all active medication schedules
 *
 * This should be called after any medication schedule changes or to fix
 * inconsistencies between OS notifications and database mappings.
 */
export async function rescheduleAllMedicationNotifications(): Promise<void> {
  try {
    // Step 1: Cancel all medication notifications from the OS
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const medicationNotifs = scheduled.filter((n) => {
      const data = n.content.data as Record<string, unknown> | null | undefined;
      if (!data) return false;

      const medicationId = data.medicationId as string | undefined;
      const medicationIds = data.medicationIds as string[] | undefined;
      const type = data.type as string | undefined;

      // Filter for medication reminders (have medicationId or medicationIds, but not type 'daily_checkin')
      // Also catch notifications with category identifiers that suggest they're medication-related
      const isMedicationData = (medicationId || medicationIds) && type !== 'daily_checkin';
      const isMedicationCategory = n.content.categoryIdentifier === 'MEDICATION_REMINDER' ||
                                   n.content.categoryIdentifier === 'MULTIPLE_MEDICATION_REMINDER';
      return isMedicationData || isMedicationCategory;
    });

    for (const notif of medicationNotifs) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }

    logger.log('[Notification] Cancelled', medicationNotifs.length, 'OS medication notifications');

    // Step 1.5: Clear all presented notifications that may be cluttering the system
    try {
      const presentedNotifications = await Notifications.getPresentedNotificationsAsync();
      const medicationPresentedNotifs = presentedNotifications.filter((n) => {
        const data = n.request.content.data as Record<string, unknown> | null | undefined;
        if (!data) return false;

        const medicationId = data.medicationId as string | undefined;
        const medicationIds = data.medicationIds as string[] | undefined;
        const type = data.type as string | undefined;

        // Filter for medication reminders (have medicationId or medicationIds, but not type 'daily_checkin')
        // Also catch notifications with category identifiers that suggest they're medication-related
        const isMedicationData = (medicationId || medicationIds) && type !== 'daily_checkin';
        const isMedicationCategory = n.request.content.categoryIdentifier === 'MEDICATION_REMINDER' ||
                                     n.request.content.categoryIdentifier === 'MULTIPLE_MEDICATION_REMINDER';
        return isMedicationData || isMedicationCategory;
      });

      for (const notif of medicationPresentedNotifs) {
        await Notifications.dismissNotificationAsync(notif.request.identifier);
      }

      logger.log('[Notification] Dismissed', medicationPresentedNotifs.length, 'presented medication notifications');
    } catch (error) {
      logger.warn('[Notification] Failed to clear presented notifications:', error);
    }

    // Step 2: Clear all entries from scheduled_notifications database
    const tableExists = await scheduledNotificationRepository.tableExists();
    if (tableExists) {
      const deletedCount = await scheduledNotificationRepository.deleteAllMappings();
      logger.log('[Notification] Cleared', deletedCount, 'database notification mappings');
    }

    // Step 3: Get all active medications with schedules
    const medications = await medicationRepository.getActive();
    const activeMedSchedules: Array<{ medication: Medication; schedule: MedicationSchedule }> = [];

    for (const medication of medications) {
      if (medication.type === 'preventative' && medication.scheduleFrequency === 'daily') {
        const schedules = await medicationScheduleRepository.getByMedicationId(medication.id);
        for (const schedule of schedules) {
          if (schedule.enabled) {
            activeMedSchedules.push({ medication, schedule });
          }
        }
      }
    }

    if (activeMedSchedules.length === 0) {
      logger.log('[Notification] No active medication schedules to reschedule');
      return;
    }

    // Step 4: Calculate how many days to schedule based on actual slots needed per day
    // Each schedule needs 1 slot for reminder, plus 1 slot for follow-up if enabled
    const settingsStore = useNotificationSettingsStore.getState();
    let slotsNeededPerDay = 0;
    for (const { medication } of activeMedSchedules) {
      const effectiveSettings = settingsStore.getEffectiveSettings(medication.id);
      // 1 for reminder, +1 for follow-up if enabled
      const hasFollowUp = effectiveSettings.followUpDelay !== 'off';
      slotsNeededPerDay += hasFollowUp ? 2 : 1;
    }

    const daysToSchedule = calculateNotificationDays(slotsNeededPerDay);

    logger.log('[Notification] Rescheduling notifications:', {
      activeSchedules: activeMedSchedules.length,
      slotsNeededPerDay,
      daysToSchedule,
    });

    // Step 5: Schedule one-time notifications using grouped scheduling
    // This ensures medications at the same time are grouped together
    await scheduleGroupedNotificationsForDays(activeMedSchedules, daysToSchedule);

    logger.log('[Notification] Rescheduled all medication notifications:', {
      schedulesProcessed: activeMedSchedules.length,
      daysPerSchedule: daysToSchedule,
    });

    // NOTIFICATION SCHEDULE CONSISTENCY FIX: Validation step to check for any remaining orphaned notifications
    try {
      const remainingScheduled = await Notifications.getAllScheduledNotificationsAsync();
      const remainingMedicationNotifs = remainingScheduled.filter((n) => {
        const data = n.content.data as Record<string, unknown> | null | undefined;
        if (!data) return false;
        const medicationId = data.medicationId as string | undefined;
        const medicationIds = data.medicationIds as string[] | undefined;
        const type = data.type as string | undefined;
        return (medicationId || medicationIds) && type !== 'daily_checkin';
      });

      if (remainingMedicationNotifs.length > 0) {
        logger.warn('[Notification] Found remaining medication notifications after reschedule:', {
          count: remainingMedicationNotifs.length,
          component: 'NotificationConsistency',
          operation: 'rescheduleAllMedicationNotifications',
          details: remainingMedicationNotifs.map(n => ({
            id: n.identifier,
            title: n.content.title,
            data: n.content.data,
          })),
        });
      } else {
        logger.log('[Notification] No orphaned medication notifications found after reschedule');
      }
    } catch (error) {
      logger.warn('[Notification] Failed to validate cleanup after reschedule:', error);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // No silent failures
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

    // No silent failures
    logger.error(error instanceof Error ? error : new Error(errorMessage), {
      component: 'NotificationScheduler',
      operation: 'rescheduleAllNotifications',
      errorMessage,
    });

    throw error;
  }
}

/**
 * Top up notifications to ensure we always have N days scheduled
 *
 * Called after:
 * - Medication is logged (notification cancelled, need to add one at the end)
 * - App startup (ensure we have enough notifications scheduled)
 * - Skip action
 *
 * @param threshold - Minimum number of days to maintain (default: 3)
 */
export async function topUpNotifications(threshold: number = 3): Promise<void> {
  try {
    // Check if the scheduled_notifications table exists yet
    // It may not exist if migration v20 hasn't run
    if (!await scheduledNotificationRepository.tableExists()) {
      logger.log('[Notification] Skipping top-up - table not yet created');
      return;
    }

    logger.log('[Notification] Starting top-up with threshold:', threshold);

    // Get all active medications with schedules
    const medications = await medicationRepository.getActive();
    const activeMedSchedules: Array<{ medication: Medication; schedule: MedicationSchedule }> = [];

    for (const medication of medications) {
      if (medication.type === 'preventative' && medication.scheduleFrequency === 'daily') {
        const schedules = await medicationScheduleRepository.getByMedicationId(medication.id);
        for (const schedule of schedules) {
          if (schedule.enabled) {
            activeMedSchedules.push({ medication, schedule });
          }
        }
      }
    }

    // Calculate target number of days
    const targetDays = calculateNotificationDays(activeMedSchedules.length);

    logger.log('[Notification] Top-up calculation:', {
      activeMedications: activeMedSchedules.length,
      targetDays,
      threshold,
    });

    // Determine which dates need to be scheduled for each medication/schedule
    // Build a set of dates that need scheduling, organized by time slot
    const datesToScheduleByTime = new Map<string, Set<string>>();
    const schedulesByTime = new Map<string, Array<{ medication: Medication; schedule: MedicationSchedule }>>();
    let maxDaysToAdd = 0;

    for (const { medication, schedule } of activeMedSchedules) {
      const count = await scheduledNotificationRepository.countBySchedule(
        medication.id,
        schedule.id
      );

      if (count < threshold) {
        // Get the last scheduled date
        const lastDate = await scheduledNotificationRepository.getLastScheduledDate(
          medication.id,
          schedule.id
        );

        // Calculate how many more days to schedule
        const daysToAdd = targetDays - count;
        maxDaysToAdd = Math.max(maxDaysToAdd, daysToAdd);

        // Start from the day after the last scheduled, or today if none scheduled
        let startFromDay = 0;
        if (lastDate) {
          const lastDateObj = new Date(lastDate);
          const todayObj = new Date(toLocalDateString());
          const diffDays = Math.ceil((lastDateObj.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24));
          startFromDay = diffDays + 1;
        }

        logger.log('[Notification] Top-up needed for schedule:', {
          medicationId: medication.id,
          scheduleId: schedule.id,
          currentCount: count,
          daysToAdd,
          startFromDay,
        });

        // Track which dates need to be scheduled for this time slot
        const time = schedule.time;
        if (!datesToScheduleByTime.has(time)) {
          datesToScheduleByTime.set(time, new Set<string>());
        }
        if (!schedulesByTime.has(time)) {
          schedulesByTime.set(time, []);
        }

        const dateSet = datesToScheduleByTime.get(time)!;
        for (let i = 0; i < daysToAdd; i++) {
          const dateString = toLocalDateStringOffset(startFromDay + i);
          dateSet.add(dateString);
        }

        // Add this schedule to the time group
        if (!schedulesByTime.get(time)!.find(s => s.schedule.id === schedule.id)) {
          schedulesByTime.get(time)!.push({ medication, schedule });
        }
      }
    }

    // If no top-up needed, exit early
    if (maxDaysToAdd === 0) {
      logger.log('[Notification] No top-up needed');
      return;
    }

    // Now schedule notifications using grouped scheduling for the specific dates needed
    // Group by time and schedule grouped notifications
    for (const [time, dateSet] of datesToScheduleByTime.entries()) {
      const groupItems = schedulesByTime.get(time) || [];
      if (groupItems.length === 0) continue;

      // Sort dates to schedule them in order
      const sortedDates = Array.from(dateSet).sort();

      for (const dateString of sortedDates) {
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
          const existing = await scheduledNotificationRepository.getMapping(
            medication.id,
            schedule.id,
            dateString,
            'reminder'
          );

          if (!existing) {
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
              {
                medicationId: medication.id,
                scheduleId: schedule.id,
                date: dateString,
                notificationType: 'reminder',
                isGrouped: false,
              }
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
                  {
                    medicationId: medication.id,
                    scheduleId: schedule.id,
                    date: dateString,
                    notificationType: 'follow_up',
                    isGrouped: false,
                  }
                );
              }
            }
          }
        } else {
          // Multiple medications at this time - schedule as grouped
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
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    logger.log('[Notification] Top-up complete');
  } catch (error) {
    logger.error('[Notification] Error in topUpNotifications:', error);
  }
}

/**
 * Reconcile notifications between OS and database
 *
 * Called on app startup to fix any inconsistencies:
 * - Remove orphaned mappings (DB has ID, OS doesn't)
 * - Cancel orphaned notifications (OS has ID, DB doesn't - medication-related only)
 */
export async function reconcileNotifications(): Promise<void> {
  try {
    // Check if the scheduled_notifications table exists yet
    // It may not exist if migration v20 hasn't run
    if (!await scheduledNotificationRepository.tableExists()) {
      logger.log('[Notification] Skipping reconciliation - table not yet created');
      return;
    }

    logger.log('[Notification] Starting reconciliation...');

    // Get all scheduled notifications from OS
    const osNotifications = await Notifications.getAllScheduledNotificationsAsync();
    const osNotificationIds = new Set(osNotifications.map(n => n.identifier));

    // Get all mappings from DB
    const dbMappings = await scheduledNotificationRepository.getAllMappings();
    const dbNotificationIds = new Set(dbMappings.map(m => m.notificationId));

    // Find orphaned mappings (in DB but not in OS)
    const orphanedMappings = dbMappings.filter(m => !osNotificationIds.has(m.notificationId));

    for (const mapping of orphanedMappings) {
      logger.log('[Notification] Removing orphaned mapping:', mapping.id);
      await scheduledNotificationRepository.deleteMapping(mapping.id);
    }

    // Find orphaned notifications (in OS but not in DB) - only medication-related
    const orphanedNotifications = osNotifications.filter(n => {
      const data = n.content.data as Record<string, unknown> | null;
      // Only consider medication notifications (have medicationId or medicationIds)
      const isMedicationNotification = data && (data.medicationId || data.medicationIds);
      return isMedicationNotification && !dbNotificationIds.has(n.identifier);
    });

    for (const notification of orphanedNotifications) {
      logger.log('[Notification] Cancelling orphaned notification:', notification.identifier);
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }

    // Clean up old mappings (dates in the past)
    const today = toLocalDateString();
    const deletedOld = await scheduledNotificationRepository.deleteMappingsBeforeDate(today);

    logger.log('[Notification] Reconciliation complete:', {
      orphanedMappingsRemoved: orphanedMappings.length,
      orphanedNotificationsCancelled: orphanedNotifications.length,
      oldMappingsCleaned: deletedOld,
    });
  } catch (error) {
    logger.error('[Notification] Error in reconcileNotifications:', error);
  }
}

/**
 * Rebalance notifications when medication count changes
 *
 * Called when:
 * - Medication is added
 * - Medication is deleted/archived
 *
 * Recalculates N and adjusts scheduled notifications accordingly.
 */
export async function rebalanceNotifications(): Promise<void> {
  try {
    logger.log('[Notification] Starting rebalance...');

    // Get all active medications with schedules
    const medications = await medicationRepository.getActive();
    let scheduleCount = 0;

    for (const medication of medications) {
      if (medication.type === 'preventative' && medication.scheduleFrequency === 'daily') {
        const schedules = await medicationScheduleRepository.getByMedicationId(medication.id);
        scheduleCount += schedules.filter(s => s.enabled).length;
      }
    }

    // Calculate new target days
    const newTargetDays = calculateNotificationDays(scheduleCount);

    logger.log('[Notification] Rebalance calculation:', {
      scheduleCount,
      newTargetDays,
    });

    // For each schedule, trim or extend as needed
    for (const medication of medications) {
      if (medication.type === 'preventative' && medication.scheduleFrequency === 'daily') {
        const schedules = await medicationScheduleRepository.getByMedicationId(medication.id);

        for (const schedule of schedules) {
          if (!schedule.enabled) continue;

          const mappings = await scheduledNotificationRepository.getMappingsBySchedule(
            medication.id,
            schedule.id
          );

          if (mappings.length > newTargetDays) {
            // Trim excess notifications
            const sortedMappings = mappings.sort((a, b) => a.date.localeCompare(b.date));
            const toRemove = sortedMappings.slice(newTargetDays);

            for (const mapping of toRemove) {
              await cancelNotificationAtomic(mapping.notificationId);
            }

            logger.log('[Notification] Trimmed excess notifications:', {
              medicationId: medication.id,
              scheduleId: schedule.id,
              removed: toRemove.length,
            });
          }
        }
      }
    }

    // Top up to ensure minimum threshold
    await topUpNotifications();

    logger.log('[Notification] Rebalance complete');
  } catch (error) {
    logger.error('[Notification] Error in rebalanceNotifications:', error);
  }
}
