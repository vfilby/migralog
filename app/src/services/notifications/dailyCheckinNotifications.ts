/**
 * Daily check-in notification handling
 * Note: Daily check-in service logic lives in dailyCheckinService.ts
 * This module only handles notification behavior when received
 */
import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';

/**
 * Handle daily check-in notification
 * Returns notification behavior or null if not a check-in notification
 */
export async function handleDailyCheckinNotification(
  notification: Notifications.Notification
): Promise<Notifications.NotificationBehavior | null> {
  const data = notification.request.content.data as { type?: string };
  
  if (data.type !== 'daily-checkin') {
    return null; // Not a daily check-in notification
  }

  logger.log('[Notification] Daily check-in notification received');

  // Always show daily check-in notifications
  return {
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  };
}
