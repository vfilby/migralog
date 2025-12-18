import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';
import { notifyUserOfError } from './errorNotificationHelper';
import {
  ScheduledNotificationMapping,
  ScheduledNotificationMappingInput,
} from '../../types/notifications';
import { scheduledNotificationRepository } from '../../database/scheduledNotificationRepository';

/**
 * Schedule a notification for a specific date/time
 *
 * Added comprehensive error handling:
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
    
    // Log with full context - No silent failures
    logger.error(error instanceof Error ? error : new Error(errorMessage), {
      component: 'NotificationScheduler',
      operation: 'scheduleNotification',
      notificationTitle: content.title,
      notificationBody: content.body,
      triggerType: typeof trigger === 'object' && trigger !== null && 'type' in trigger
        ? (trigger as { type: string }).type
        : 'unknown',
      errorMessage,
      // Include medication context if available
      medicationId: content.data?.medicationId,
      medicationIds: content.data?.medicationIds,
      scheduleId: content.data?.scheduleId,
      scheduleIds: content.data?.scheduleIds,
    });
    
    // Notify user for critical failures
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
    
    // Return null to indicate graceful failure
    return null;
  }
}

/**
 * Cancel a scheduled notification
 *
 * Added Sentry logging for cancellation failures
 */
export async function cancelNotification(notificationId: string): Promise<boolean> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    logger.log('[Notification] Cancelled:', notificationId);
    return true;
  } catch (error) {
    // Log - No silent failures
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

/**
 * Schedule a one-time notification with atomic database tracking
 *
 * This function ensures consistency between OS notifications and our database:
 * 1. Schedules the notification with the OS
 * 2. Extracts comprehensive metadata from notification content and trigger
 * 3. Saves the mapping with metadata to our database
 * 4. On DB failure, cancels the notification (compensating transaction)
 *
 * @param content - Notification content
 * @param trigger - Date when the notification should fire
 * @param mapping - Mapping data (without id, notificationId, createdAt)
 * @returns The created mapping with all fields populated, or null on failure
 */
export async function scheduleNotificationAtomic(
  content: Notifications.NotificationContentInput,
  trigger: Date,
  mapping: ScheduledNotificationMappingInput
): Promise<ScheduledNotificationMapping | null> {
  let notificationId: string | null = null;

  try {
    // Step 1: Schedule the notification with the OS
    // Use DATE trigger type for one-time notifications at a specific date/time
    notificationId = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: trigger,
      },
    });

    if (!notificationId) {
      logger.error('[NotificationScheduler] Failed to schedule notification - no ID returned');
      return null;
    }

    logger.log('[NotificationScheduler] Notification scheduled:', {
      notificationId,
      date: mapping.date,
      medicationId: mapping.medicationId,
    });

    // Step 2: Extract comprehensive metadata from notification content and trigger
    const metadata = {
      medicationName: extractMedicationName(content.title || ''),
      scheduledTriggerTime: calculateTriggerTime(trigger),
      notificationTitle: content.title || '',
      notificationBody: content.body || '',
      categoryIdentifier: content.categoryIdentifier || '',
    };

    logger.log('[NotificationScheduler] Extracted metadata:', {
      notificationId,
      medicationName: metadata.medicationName,
      triggerTime: metadata.scheduledTriggerTime?.toISOString(),
      categoryIdentifier: metadata.categoryIdentifier,
    });

    // Step 3: Save the mapping with metadata to our database
    const savedMapping = await scheduledNotificationRepository.saveMapping({
      ...mapping,
      notificationId,
      // Include extracted metadata (convert null to undefined for optional fields)
      medicationName: metadata.medicationName || undefined,
      scheduledTriggerTime: metadata.scheduledTriggerTime || undefined,
      notificationTitle: metadata.notificationTitle || undefined,
      notificationBody: metadata.notificationBody || undefined,
      categoryIdentifier: metadata.categoryIdentifier || undefined,
    });

    logger.log('[NotificationScheduler] Atomic scheduling complete:', {
      mappingId: savedMapping.id,
      notificationId,
      date: mapping.date,
      withMetadata: {
        medicationName: metadata.medicationName,
        categoryIdentifier: metadata.categoryIdentifier,
      },
    });

    return savedMapping;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(error instanceof Error ? error : new Error(errorMessage), {
      component: 'NotificationScheduler',
      operation: 'scheduleNotificationAtomic',
      medicationId: mapping.medicationId,
      scheduleId: mapping.scheduleId,
      date: mapping.date,
      notificationType: mapping.notificationType,
      notificationId,
      errorMessage,
    });

    // Compensating transaction: Cancel the notification if DB save failed
    if (notificationId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        logger.log('[NotificationScheduler] Compensating transaction: cancelled notification:', notificationId);
      } catch (cancelError) {
        logger.error('[NotificationScheduler] Failed to cancel notification in compensating transaction:', cancelError);
      }
    }

    return null;
  }
}

/**
 * Schedule multiple one-time notifications with atomic database tracking
 *
 * Processes notifications in order, with all-or-nothing semantics per notification.
 * If any notification fails, previous successes are kept (partial success is acceptable).
 *
 * @param notifications - Array of notification requests with content, trigger, and mapping
 * @returns Array of created mappings (only successful ones)
 */
export async function scheduleNotificationsBatch(
  notifications: Array<{
    content: Notifications.NotificationContentInput;
    trigger: Date;
    mapping: ScheduledNotificationMappingInput;
  }>
): Promise<ScheduledNotificationMapping[]> {
  const results: ScheduledNotificationMapping[] = [];

  for (const notification of notifications) {
    const result = await scheduleNotificationAtomic(
      notification.content,
      notification.trigger,
      notification.mapping
    );

    if (result) {
      results.push(result);
    }
  }

  logger.log('[NotificationScheduler] Batch scheduling complete:', {
    requested: notifications.length,
    successful: results.length,
  });

  return results;
}

/**
 * Cancel a notification and remove its mapping from the database
 *
 * @param notificationId - The OS notification ID to cancel
 * @returns True if successfully cancelled, false otherwise
 */
export async function cancelNotificationAtomic(notificationId: string): Promise<boolean> {
  try {
    // Cancel the OS notification
    await Notifications.cancelScheduledNotificationAsync(notificationId);

    // Remove the mapping from our database
    await scheduledNotificationRepository.deleteMappingsByNotificationId(notificationId);

    logger.log('[NotificationScheduler] Atomically cancelled notification:', notificationId);
    return true;
  } catch (error) {
    logger.error('[NotificationScheduler] Failed to cancel notification atomically:', error);
    return false;
  }
}

/**
 * Extract medication name from notification title
 * 
 * Handles patterns like:
 * - "Time for Ibuprofen" -> "Ibuprofen"
 * - "Reminder: Aspirin" -> "Aspirin"
 * - "How was your day?" -> null (daily check-in)
 * 
 * @param title - Notification title
 * @returns Extracted medication name or null if not found
 */
export function extractMedicationName(title: string): string | null {
  // Pattern: "Time for <medication>" or "Reminder: <medication>"
  const timeForMatch = title.match(/^Time for (.+)$/);
  if (timeForMatch) {
    return timeForMatch[1].trim();
  }

  const reminderMatch = title.match(/^Reminder: (.+)$/);
  if (reminderMatch) {
    return reminderMatch[1].trim();
  }

  // No medication name found (e.g., daily check-in notifications)
  return null;
}

/**
 * Calculate exact trigger time from notification trigger
 * 
 * @param trigger - Notification trigger (Date or other trigger type)
 * @returns Calculated trigger time or null if cannot be determined
 */
export function calculateTriggerTime(trigger: Date | Notifications.NotificationTriggerInput): Date | null {
  // If trigger is already a Date object (used in scheduleNotificationAtomic)
  if (trigger instanceof Date) {
    return new Date(trigger);
  }

  // Handle different trigger types from Expo Notifications
  if (typeof trigger === 'object' && trigger !== null) {
    // Date trigger type
    if ('date' in trigger && trigger.date instanceof Date) {
      return new Date(trigger.date);
    }

    // Time interval trigger (not commonly used in this app, but handle gracefully)
    if ('seconds' in trigger && typeof trigger.seconds === 'number') {
      return new Date(Date.now() + trigger.seconds * 1000);
    }

    // Calendar trigger (not used in this app, but handle gracefully) 
    if ('dateComponents' in trigger) {
      // Complex calendar trigger - would need more logic to calculate exact time
      // For now, return null as this isn't used in the current app
      return null;
    }
  }

  // Unknown trigger type
  return null;
}
