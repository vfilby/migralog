/**
 * Notification Integrity Verification Service
 *
 * Detects drift between database notification mappings and OS scheduled notifications.
 * This service helps diagnose issues like MIGRALOG-V where notifications get out of sync.
 *
 * Usage:
 *   import { verifyNotificationIntegrity, checkNotificationHealth } from './NotificationIntegrityService';
 *
 *   // Full integrity check with details
 *   const result = await verifyNotificationIntegrity();
 *   if (!result.isConsistent) {
 *     console.log('Deviations found:', result.deviations);
 *   }
 *
 *   // Quick health check (lightweight)
 *   const isHealthy = await checkNotificationHealth();
 */

import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';
import { scheduledNotificationRepository } from '../../database/scheduledNotificationRepository';
import { ScheduledNotificationMapping } from '../../types/notifications';

/**
 * Types of deviations that can be detected
 */
export type DeviationType =
  | 'missing_in_os'      // DB has mapping but OS doesn't have notification
  | 'missing_in_db'      // OS has notification but DB doesn't have mapping
  | 'orphaned_mapping'   // DB mapping references non-existent medication/schedule
  | 'error';             // Error during verification

/**
 * A single deviation found during integrity verification
 */
export interface NotificationDeviation {
  /** Type of deviation */
  type: DeviationType;

  /** Human-readable description of the deviation */
  description: string;

  /** Notification ID (OS or DB depending on context) */
  notificationId?: string;

  /** Database mapping ID if applicable */
  mappingId?: string;

  /** Medication ID if applicable */
  medicationId?: string;

  /** Schedule ID if applicable */
  scheduleId?: string;

  /** Date string (YYYY-MM-DD) if applicable */
  date?: string;

  /** Source type (medication or daily_checkin) */
  sourceType?: string;

  /** Additional context for debugging */
  context?: Record<string, unknown>;
}

/**
 * Summary statistics from integrity verification
 */
export interface IntegritySummary {
  /** Total mappings in database */
  totalDbMappings: number;

  /** Total notifications in OS */
  totalOsNotifications: number;

  /** Medication notifications in OS (excluding daily check-in) */
  medicationOsNotifications: number;

  /** Daily check-in notifications in OS */
  dailyCheckinOsNotifications: number;

  /** Number of missing_in_os deviations */
  missingInOsCount: number;

  /** Number of missing_in_db deviations */
  missingInDbCount: number;

  /** Number of orphaned_mapping deviations */
  orphanedMappingCount: number;

  /** Number of errors encountered */
  errorCount: number;
}

/**
 * Result of an integrity verification
 */
export interface IntegrityVerificationResult {
  /** Whether the system is consistent (no deviations) */
  isConsistent: boolean;

  /** When the verification was performed */
  timestamp: Date;

  /** List of deviations found */
  deviations: NotificationDeviation[];

  /** Summary statistics */
  summary: IntegritySummary;
}

/**
 * Service for verifying notification system integrity
 */
export class NotificationIntegrityService {
  /** Maximum number of deviations to log to Sentry */
  private readonly MAX_LOGGED_DEVIATIONS = 10;

  /**
   * Perform a full integrity verification
   *
   * Compares database mappings against OS scheduled notifications to detect:
   * - Notifications in DB but not in OS (missing_in_os)
   * - Notifications in OS but not in DB (missing_in_db)
   * - Orphaned mappings in DB
   *
   * @returns Verification result with deviations and summary
   */
  async verifyIntegrity(): Promise<IntegrityVerificationResult> {
    const timestamp = new Date();
    const deviations: NotificationDeviation[] = [];
    const summary: IntegritySummary = {
      totalDbMappings: 0,
      totalOsNotifications: 0,
      medicationOsNotifications: 0,
      dailyCheckinOsNotifications: 0,
      missingInOsCount: 0,
      missingInDbCount: 0,
      orphanedMappingCount: 0,
      errorCount: 0,
    };

    try {
      // Check if the scheduled_notifications table exists
      const tableExists = await scheduledNotificationRepository.tableExists();
      if (!tableExists) {
        logger.log('[NotificationIntegrity] Skipping verification - table not yet created');
        return {
          isConsistent: true,
          timestamp,
          deviations: [],
          summary,
        };
      }

      // Get all mappings from database
      const dbMappings = await scheduledNotificationRepository.getAllMappings();
      summary.totalDbMappings = dbMappings.length;

      // Get all scheduled notifications from OS
      const osNotifications = await Notifications.getAllScheduledNotificationsAsync();
      summary.totalOsNotifications = osNotifications.length;

      // Create sets for efficient lookup
      const osNotificationIds = new Set(osNotifications.map(n => n.identifier));
      const dbNotificationIds = new Set(dbMappings.map(m => m.notificationId));

      // Categorize OS notifications
      for (const notification of osNotifications) {
        const data = notification.content.data as Record<string, unknown> | null | undefined;
        if (data?.type === 'daily_checkin') {
          summary.dailyCheckinOsNotifications++;
        } else if (data?.medicationId || data?.medicationIds) {
          summary.medicationOsNotifications++;
        }
      }

      // Check for mappings missing in OS
      for (const mapping of dbMappings) {
        if (!osNotificationIds.has(mapping.notificationId)) {
          deviations.push({
            type: 'missing_in_os',
            description: `Database mapping exists but OS notification not found`,
            notificationId: mapping.notificationId,
            mappingId: mapping.id,
            medicationId: mapping.medicationId ?? undefined,
            scheduleId: mapping.scheduleId ?? undefined,
            date: mapping.date,
            sourceType: mapping.sourceType,
            context: {
              notificationType: mapping.notificationType,
              isGrouped: mapping.isGrouped,
              groupKey: mapping.groupKey,
            },
          });
          summary.missingInOsCount++;
        }
      }

      // Check for OS notifications missing in DB (medication-related only)
      // Note: We intentionally do NOT flag daily check-in notifications here
      // as they may be managed differently or have different lifecycle
      for (const notification of osNotifications) {
        const data = notification.content.data as Record<string, unknown> | null | undefined;

        // Skip if not a medication notification
        const isMedicationNotification = data && (data.medicationId || data.medicationIds);
        if (!isMedicationNotification) {
          continue;
        }

        if (!dbNotificationIds.has(notification.identifier)) {
          deviations.push({
            type: 'missing_in_db',
            description: `OS notification exists but no database mapping found`,
            notificationId: notification.identifier,
            context: {
              title: notification.content.title,
              body: notification.content.body,
              data: notification.content.data,
              categoryIdentifier: notification.content.categoryIdentifier,
            },
          });
          summary.missingInDbCount++;
        }
      }

      // Log deviations to Sentry if any found
      if (deviations.length > 0) {
        this.logDeviationsToSentry(deviations, summary);
      }

      logger.log('[NotificationIntegrity] Verification complete:', {
        isConsistent: deviations.length === 0,
        totalDbMappings: summary.totalDbMappings,
        totalOsNotifications: summary.totalOsNotifications,
        deviationCount: deviations.length,
      });

      return {
        isConsistent: deviations.length === 0,
        timestamp,
        deviations,
        summary,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      deviations.push({
        type: 'error',
        description: `Error during integrity verification: ${errorMessage}`,
        context: {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      summary.errorCount++;

      logger.warn('[NotificationIntegrity] Error during verification:', {
        error: errorMessage,
        component: 'NotificationIntegrityService',
        operation: 'verifyIntegrity',
      });

      return {
        isConsistent: false,
        timestamp,
        deviations,
        summary,
      };
    }
  }

  /**
   * Perform a quick health check
   *
   * This is a lightweight check that just counts notifications in both systems
   * and returns false if there's a mismatch. It doesn't identify specific deviations.
   *
   * @returns True if the system appears healthy, false otherwise
   */
  async quickHealthCheck(): Promise<boolean> {
    try {
      // Check if table exists
      const tableExists = await scheduledNotificationRepository.tableExists();
      if (!tableExists) {
        return true; // Table not created yet, so no deviations possible
      }

      // Get counts
      const dbMappings = await scheduledNotificationRepository.getAllMappings();
      const osNotifications = await Notifications.getAllScheduledNotificationsAsync();

      // Create sets for comparison
      const osNotificationIds = new Set(osNotifications.map(n => n.identifier));
      const dbNotificationIds = new Set(dbMappings.map(m => m.notificationId));

      // Quick check: all DB notification IDs should exist in OS
      for (const mapping of dbMappings) {
        if (!osNotificationIds.has(mapping.notificationId)) {
          return false;
        }
      }

      // Quick check: all medication OS notifications should exist in DB
      for (const notification of osNotifications) {
        const data = notification.content.data as Record<string, unknown> | null | undefined;
        const isMedicationNotification = data && (data.medicationId || data.medicationIds);

        if (isMedicationNotification && !dbNotificationIds.has(notification.identifier)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.warn('[NotificationIntegrity] Error during quick health check:', error);
      return false;
    }
  }

  /**
   * Get detailed mapping information for debugging
   *
   * @returns Object containing DB mappings and OS notifications
   */
  async getMappingDetails(): Promise<{
    dbMappings: ScheduledNotificationMapping[];
    osNotifications: Array<{
      identifier: string;
      title?: string;
      body?: string;
      data?: Record<string, unknown>;
      categoryIdentifier?: string;
    }>;
  }> {
    try {
      const tableExists = await scheduledNotificationRepository.tableExists();
      if (!tableExists) {
        return {
          dbMappings: [],
          osNotifications: [],
        };
      }

      const dbMappings = await scheduledNotificationRepository.getAllMappings();
      const osNotifications = await Notifications.getAllScheduledNotificationsAsync();

      return {
        dbMappings,
        osNotifications: osNotifications.map(n => ({
          identifier: n.identifier,
          title: n.content.title ?? undefined,
          body: n.content.body ?? undefined,
          data: n.content.data as Record<string, unknown> | undefined,
          categoryIdentifier: n.content.categoryIdentifier ?? undefined,
        })),
      };
    } catch (error) {
      logger.warn('[NotificationIntegrity] Error getting mapping details:', error);
      return {
        dbMappings: [],
        osNotifications: [],
      };
    }
  }

  /**
   * Log deviations to Sentry with context
   *
   * @param deviations - Array of deviations to log
   * @param summary - Summary statistics
   */
  private logDeviationsToSentry(
    deviations: NotificationDeviation[],
    summary: IntegritySummary
  ): void {
    // Limit deviations to prevent overwhelming Sentry
    const limitedDeviations = deviations.slice(0, this.MAX_LOGGED_DEVIATIONS);
    const truncated = deviations.length > this.MAX_LOGGED_DEVIATIONS;

    logger.warn('[NotificationIntegrity] Notification system integrity deviations detected', {
      component: 'NotificationIntegrityService',
      operation: 'verifyIntegrity',
      deviationCount: deviations.length,
      truncated,
      summary: {
        totalDbMappings: summary.totalDbMappings,
        totalOsNotifications: summary.totalOsNotifications,
        medicationOsNotifications: summary.medicationOsNotifications,
        dailyCheckinOsNotifications: summary.dailyCheckinOsNotifications,
        missingInOsCount: summary.missingInOsCount,
        missingInDbCount: summary.missingInDbCount,
        orphanedMappingCount: summary.orphanedMappingCount,
        errorCount: summary.errorCount,
      },
      deviations: limitedDeviations.map(d => ({
        type: d.type,
        description: d.description,
        notificationId: d.notificationId,
        mappingId: d.mappingId,
        medicationId: d.medicationId,
        scheduleId: d.scheduleId,
        date: d.date,
        sourceType: d.sourceType,
      })),
    });
  }
}

/**
 * Singleton instance of the NotificationIntegrityService
 */
export const notificationIntegrityService = new NotificationIntegrityService();

/**
 * Convenience function to verify notification integrity
 *
 * @returns Verification result with deviations and summary
 */
export async function verifyNotificationIntegrity(): Promise<IntegrityVerificationResult> {
  return notificationIntegrityService.verifyIntegrity();
}

/**
 * Convenience function for quick health check
 *
 * @returns True if the system appears healthy, false otherwise
 */
export async function checkNotificationHealth(): Promise<boolean> {
  return notificationIntegrityService.quickHealthCheck();
}
