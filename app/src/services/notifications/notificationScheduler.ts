import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';
import { notifyUserOfError } from './errorNotificationHelper';

/**
 * Schedule a notification for a specific date/time
 * 
 * ISSUE FIX (SCHED-324): Added comprehensive error handling
 * - Logs scheduling failures to Sentry with context
 * - Returns null on failure instead of throwing
 * - Notifies user for critical scheduling failures
 */
export async function scheduleNotification(
  content: Notifications.NotificationContentInput,
  trigger: Notifications.NotificationTriggerInput
): Promise<string | null> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content,
      trigger,
    });
    
    logger.log('[NotificationScheduler] Notification scheduled successfully:', {
      notificationId,
      title: content.title,
    });
    
    return notificationId;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Log with full context (Issue 3: HAND-334 - No silent failures)
    logger.error(error instanceof Error ? error : new Error(errorMessage), {
      component: 'NotificationScheduler',
      operation: 'scheduleNotification',
      notificationTitle: content.title,
      notificationBody: content.body,
      triggerType: typeof trigger === 'object' && trigger !== null && 'type' in trigger 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (trigger as any).type 
        : 'unknown',
      errorMessage,
      // Include medication context if available
      medicationId: content.data?.medicationId,
      medicationIds: content.data?.medicationIds,
      scheduleId: content.data?.scheduleId,
      scheduleIds: content.data?.scheduleIds,
    });
    
    // Notify user for critical failures (Issue 2: HAND-238)
    // Only notify for medication reminders (has medicationId or medicationIds)
    // Don't spam user with notifications for every scheduling failure
    if (content.data?.medicationId || content.data?.medicationIds) {
      await notifyUserOfError(
        'system',
        'Failed to schedule medication reminder. Please check notification settings.',
        error instanceof Error ? error : new Error(errorMessage),
        {
          medicationId: content.data.medicationId,
          medicationIds: content.data.medicationIds,
          scheduleId: content.data.scheduleId,
          operation: 'scheduleNotification',
        }
      );
    }
    
    // Return null to indicate failure (Issue 1: HAND-138 - Graceful failure)
    return null;
  }
}

/**
 * Cancel a scheduled notification
 * 
 * ISSUE FIX (SCHED-324): Added Sentry logging for cancellation failures
 */
export async function cancelNotification(notificationId: string): Promise<boolean> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    logger.log('[Notification] Cancelled:', notificationId);
    return true;
  } catch (error) {
    // Log (Issue 3: HAND-334 - No silent failures)
    logger.warn(error instanceof Error ? error : new Error(String(error)), {
      component: 'NotificationScheduler',
      operation: 'cancelNotification',
      notificationId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    
    return false;
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  logger.log('[Notification] Cancelled all notifications');
}

/**
 * Get all scheduled notifications
 */
export async function getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return await Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Dismiss a presented notification
 */
export async function dismissNotification(identifier: string): Promise<void> {
  await Notifications.dismissNotificationAsync(identifier);
}

/**
 * Get all presented notifications
 */
export async function getPresentedNotifications(): Promise<Notifications.Notification[]> {
  return await Notifications.getPresentedNotificationsAsync();
}
