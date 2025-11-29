import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';

/**
 * Schedule a notification for a specific date/time
 */
export async function scheduleNotification(
  content: Notifications.NotificationContentInput,
  trigger: Notifications.NotificationTriggerInput
): Promise<string> {
  const notificationId = await Notifications.scheduleNotificationAsync({
    content,
    trigger,
  });
  
  return notificationId;
}

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    logger.log('[Notification] Cancelled:', notificationId);
  } catch (error) {
    logger.error('[Notification] Error cancelling notification:', error);
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
