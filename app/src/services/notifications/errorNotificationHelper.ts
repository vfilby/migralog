/**
 * Error Notification Helper
 * 
 * Centralized system for notifying users of errors and logging to Sentry.
 * Implements error categorization and rate limiting to prevent notification spam.
 * 
 * Usage:
 * ```typescript
 * await notifyUserOfError(
 *   'data',
 *   'There was a problem with your medication reminder',
 *   error
 * );
 * ```
 */

import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';
import { errorLogger } from '../errorLogger';

/**
 * Error types for categorization
 * - data: Data inconsistencies, missing data, corrupted data
 * - network: Network failures, timeout errors
 * - system: System-level errors, permission denied, quota exceeded
 */
export type ErrorType = 'data' | 'network' | 'system';

/**
 * Error severity levels
 * - transient: Temporary errors that may resolve on retry (network issues, temporary DB lock)
 * - catastrophic: Critical errors requiring user attention (data corruption, missing required data)
 */
export type ErrorSeverity = 'transient' | 'catastrophic';

/**
 * Rate limiting configuration
 * Prevents spamming user with error notifications
 */
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_NOTIFICATIONS_PER_WINDOW = 3;

// Track notification timestamps for rate limiting
const notificationTimestamps: number[] = [];

/**
 * Check if we should show notification based on rate limiting
 */
function shouldShowNotification(): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  
  // Remove old timestamps outside the window
  while (notificationTimestamps.length > 0 && notificationTimestamps[0] < windowStart) {
    notificationTimestamps.shift();
  }
  
  // Check if we've hit the limit
  if (notificationTimestamps.length >= MAX_NOTIFICATIONS_PER_WINDOW) {
    logger.log('[ErrorNotification] Rate limit reached, suppressing notification');
    return false;
  }
  
  // Record this notification
  notificationTimestamps.push(now);
  return true;
}

/**
 * Categorize error severity based on error type and details
 */
function categorizeErrorSeverity(
  errorType: ErrorType,
  error: unknown
): ErrorSeverity {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Network errors are typically transient
  if (errorType === 'network') {
    return 'transient';
  }
  
  // Data errors with specific patterns
  if (errorType === 'data') {
    // Missing data might be transient (race condition) or catastrophic (data loss)
    if (errorMessage.includes('not found') || errorMessage.includes('missing')) {
      return 'catastrophic';
    }
    // Data inconsistency is catastrophic
    if (errorMessage.includes('inconsist') || errorMessage.includes('corrupt')) {
      return 'catastrophic';
    }
  }
  
  // System errors with specific patterns
  if (errorType === 'system') {
    // Permission and quota errors are catastrophic
    if (errorMessage.includes('permission') || errorMessage.includes('quota')) {
      return 'catastrophic';
    }
    // Other system errors might be transient
    return 'transient';
  }
  
  // Default to transient for unknown cases (fail-safe)
  return 'transient';
}

/**
 * Get user-friendly error message based on error type and severity
 */
function getUserFriendlyMessage(
  errorType: ErrorType,
  severity: ErrorSeverity,
  customMessage?: string
): string {
  // Use custom message if provided
  if (customMessage) {
    return customMessage;
  }
  
  // Generate default messages
  if (errorType === 'data') {
    if (severity === 'catastrophic') {
      return 'There was a problem with your medication data. Please check your medications.';
    }
    return 'A temporary issue occurred. Please try again.';
  }
  
  if (errorType === 'network') {
    return 'Network error. Please check your connection and try again.';
  }
  
  if (errorType === 'system') {
    if (severity === 'catastrophic') {
      return 'A system error occurred. Please restart the app.';
    }
    return 'A temporary system issue occurred. Please try again.';
  }
  
  return 'An error occurred. Please try again.';
}

/**
 * Notify user of error via notification and log to Sentry
 * 
 * Features:
 * - Schedules one-time notification to user
 * - Logs to Sentry automatically
 * - Includes error categorization
 * - Rate limiting (prevents spam)
 * - Full context logging
 * 
 * @param errorType - Type of error (data, network, system)
 * @param userMessage - Optional custom user-facing message
 * @param technicalDetails - Optional technical error details for logging
 * @param context - Optional additional context for Sentry logging
 */
export async function notifyUserOfError(
  errorType: ErrorType,
  userMessage?: string,
  technicalDetails?: unknown,
  context?: Record<string, unknown>
): Promise<void> {
  // Categorize error severity
  const severity = categorizeErrorSeverity(errorType, technicalDetails);
  
  // Get user-friendly message
  const message = getUserFriendlyMessage(errorType, severity, userMessage);
  
  // Log with full context (ALWAYS do this, even if notification fails)
  const error = technicalDetails instanceof Error 
    ? technicalDetails 
    : new Error(message);
  
  if (severity === 'catastrophic') {
    logger.error(error, {
      errorType,
      severity,
      component: 'NotificationSystem',
      userMessage: message,
      technicalDetails: technicalDetails instanceof Error 
        ? technicalDetails.message 
        : String(technicalDetails),
      context,
    });
  } else {
    logger.warn(error, {
      errorType,
      severity,
      component: 'NotificationSystem',
      userMessage: message,
      technicalDetails: technicalDetails instanceof Error 
        ? technicalDetails.message 
        : String(technicalDetails),
      context,
    });
  }
  
  // Log to local error logger (ALWAYS do this)
  try {
    await errorLogger.log(
      errorType === 'network' ? 'network' : 
      errorType === 'data' ? 'database' : 
      'general',
      message,
      error,
      { errorType, severity, ...context }
    );
  } catch (logError) {
    // Don't let error logger failure stop us
    logger.error('[ErrorNotification] Failed to log to error logger:', logError);
  }
  
  // Log to console
  logger.error('[ErrorNotification] Error occurred:', {
    errorType,
    severity,
    message,
    technicalDetails: technicalDetails instanceof Error 
      ? technicalDetails.message 
      : String(technicalDetails),
    context,
  });
  
  // Check rate limiting
  if (!shouldShowNotification()) {
    logger.log('[ErrorNotification] Skipping user notification due to rate limiting');
    return;
  }
  
  // Schedule one-time notification to user
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: severity === 'catastrophic' ? '⚠️ Error' : 'Notice',
        body: message,
        sound: true,
        // Use high priority for catastrophic errors
        ...(Notifications.AndroidNotificationPriority && {
          priority: severity === 'catastrophic'
            ? Notifications.AndroidNotificationPriority.HIGH
            : Notifications.AndroidNotificationPriority.DEFAULT,
        }),
      },
      trigger: null, // Immediate notification
    });
    
    logger.log('[ErrorNotification] User notification scheduled:', {
      errorType,
      severity,
      message,
    });
  } catch (notificationError) {
    // If we fail to notify user, at least log it
    // Don't throw - we don't want error notification to crash the app
    const notificationFailureError = notificationError instanceof Error
      ? notificationError
      : new Error(`Failed to schedule error notification: ${String(notificationError)}`);
    
    logger.error(notificationFailureError, {
      component: 'ErrorNotificationHelper',
      operation: 'notifyUserOfError',
      originalError: technicalDetails instanceof Error 
        ? technicalDetails.message 
        : String(technicalDetails),
    });
  }
}

/**
 * Clear rate limiting history
 * Useful for testing
 */
export function clearRateLimitHistory(): void {
  notificationTimestamps.length = 0;
}

/**
 * Get current notification count in rate limit window
 * Useful for testing
 */
export function getRateLimitCount(): number {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  
  // Count timestamps within window
  return notificationTimestamps.filter(ts => ts >= windowStart).length;
}
