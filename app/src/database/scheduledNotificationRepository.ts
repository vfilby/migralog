/**
 * Repository for scheduled notification mappings
 *
 * This repository manages the mapping between scheduled OS notifications
 * and our database records. It enables:
 * - Cancellation of specific day's notifications when medication is logged
 * - Tracking which notifications are scheduled for reconciliation
 * - Handling grouped notifications (multiple meds at same time)
 */

import { ulid } from 'ulidx';
import { getDatabase } from './db';
import { logger } from '../utils/logger';
import {
  ScheduledNotificationMapping,
  NotificationType,
  NotificationSourceType,
} from '../types/notifications';

/**
 * Check if the scheduled_notifications table exists
 * Used to gracefully handle cases where migration hasn't run yet
 */
export async function tableExists(): Promise<boolean> {
  try {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='scheduled_notifications'`
    );
    return result !== null;
  } catch (error) {
    logger.warn('[ScheduledNotificationRepo] Error checking table existence:', error);
    return false;
  }
}

/**
 * Generate a unique ID for a mapping using ULID
 * ULID provides time-ordered, collision-resistant unique IDs
 */
function generateId(): string {
  return `sn_${ulid()}`;
}

/**
 * Row type returned from database
 */
interface ScheduledNotificationRow {
  id: string;
  medication_id: string | null;
  schedule_id: string | null;
  date: string;
  notification_id: string;
  notification_type: string;
  is_grouped: number;
  group_key: string | null;
  source_type: string;
  created_at: number;
}

/**
 * Convert database row to domain model
 */
function rowToMapping(row: ScheduledNotificationRow): ScheduledNotificationMapping {
  return {
    id: row.id,
    medicationId: row.medication_id,
    scheduleId: row.schedule_id,
    date: row.date,
    notificationId: row.notification_id,
    notificationType: row.notification_type as NotificationType,
    isGrouped: row.is_grouped === 1,
    groupKey: row.group_key ?? undefined,
    sourceType: (row.source_type || 'medication') as NotificationSourceType,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * Input type for saving a mapping - sourceType defaults to 'medication'
 */
type SaveMappingInput = Omit<ScheduledNotificationMapping, 'id' | 'createdAt' | 'sourceType'> & {
  sourceType?: NotificationSourceType;
};

/**
 * Save a new notification mapping
 */
export async function saveMapping(
  mapping: SaveMappingInput
): Promise<ScheduledNotificationMapping> {
  const db = await getDatabase();
  const id = generateId();

  const createdAt = Date.now();
  const sourceType = mapping.sourceType || 'medication';

  await db.runAsync(
    `INSERT INTO scheduled_notifications
     (id, medication_id, schedule_id, date, notification_id, notification_type, is_grouped, group_key, source_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      mapping.medicationId,
      mapping.scheduleId,
      mapping.date,
      mapping.notificationId,
      mapping.notificationType,
      mapping.isGrouped ? 1 : 0,
      mapping.groupKey ?? null,
      sourceType,
      createdAt,
    ]
  );

  logger.log('[ScheduledNotificationRepo] Saved mapping:', {
    id,
    medicationId: mapping.medicationId,
    scheduleId: mapping.scheduleId,
    date: mapping.date,
    notificationType: mapping.notificationType,
    sourceType,
  });

  return {
    ...mapping,
    id,
    sourceType,
    createdAt: new Date(createdAt).toISOString(),
  };
}

/**
 * Save multiple notification mappings in a batch
 */
export async function saveMappingsBatch(
  mappings: Array<SaveMappingInput>
): Promise<ScheduledNotificationMapping[]> {
  if (mappings.length === 0) {
    return [];
  }

  const db = await getDatabase();
  const results: ScheduledNotificationMapping[] = [];

  // Use a transaction for batch insert
  await db.withTransactionAsync(async () => {
    for (const mapping of mappings) {
      const id = generateId();
      const createdAt = Date.now();
      const sourceType = mapping.sourceType || 'medication';
      await db.runAsync(
        `INSERT INTO scheduled_notifications
         (id, medication_id, schedule_id, date, notification_id, notification_type, is_grouped, group_key, source_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          mapping.medicationId,
          mapping.scheduleId,
          mapping.date,
          mapping.notificationId,
          mapping.notificationType,
          mapping.isGrouped ? 1 : 0,
          mapping.groupKey ?? null,
          sourceType,
          createdAt,
        ]
      );

      results.push({
        ...mapping,
        id,
        sourceType,
        createdAt: new Date(createdAt).toISOString(),
      });
    }
  });

  logger.log('[ScheduledNotificationRepo] Saved batch:', {
    count: mappings.length,
  });

  return results;
}

/**
 * Get a specific mapping by medication, schedule, date, and type
 */
export async function getMapping(
  medicationId: string,
  scheduleId: string,
  date: string,
  notificationType: NotificationType = 'reminder'
): Promise<ScheduledNotificationMapping | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<ScheduledNotificationRow>(
    `SELECT * FROM scheduled_notifications
     WHERE medication_id = ? AND schedule_id = ? AND date = ? AND notification_type = ?`,
    [medicationId, scheduleId, date, notificationType]
  );

  return row ? rowToMapping(row) : null;
}

/**
 * Get all mappings for a specific notification ID
 * Used to find all medications that share a grouped notification
 */
export async function getMappingsByNotificationId(
  notificationId: string
): Promise<ScheduledNotificationMapping[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<ScheduledNotificationRow>(
    `SELECT * FROM scheduled_notifications WHERE notification_id = ?`,
    [notificationId]
  );

  return rows.map(rowToMapping);
}

/**
 * Get all mappings for a medication schedule
 */
export async function getMappingsBySchedule(
  medicationId: string,
  scheduleId: string
): Promise<ScheduledNotificationMapping[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<ScheduledNotificationRow>(
    `SELECT * FROM scheduled_notifications
     WHERE medication_id = ? AND schedule_id = ?
     ORDER BY date ASC`,
    [medicationId, scheduleId]
  );

  return rows.map(rowToMapping);
}

/**
 * Get all mappings for a group key and date
 * Used to find all medications in a grouped notification
 */
export async function getMappingsByGroupKey(
  groupKey: string,
  date: string
): Promise<ScheduledNotificationMapping[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<ScheduledNotificationRow>(
    `SELECT * FROM scheduled_notifications
     WHERE group_key = ? AND date = ?`,
    [groupKey, date]
  );

  return rows.map(rowToMapping);
}

/**
 * Delete a mapping by ID
 */
export async function deleteMapping(id: string): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `DELETE FROM scheduled_notifications WHERE id = ?`,
    [id]
  );

  logger.log('[ScheduledNotificationRepo] Deleted mapping:', id);
}

/**
 * Delete all mappings for a medication schedule
 */
export async function deleteMappingsBySchedule(
  medicationId: string,
  scheduleId: string
): Promise<number> {
  const db = await getDatabase();

  const result = await db.runAsync(
    `DELETE FROM scheduled_notifications
     WHERE medication_id = ? AND schedule_id = ?`,
    [medicationId, scheduleId]
  );

  logger.log('[ScheduledNotificationRepo] Deleted mappings for schedule:', {
    medicationId,
    scheduleId,
    count: result.changes,
  });

  return result.changes;
}

/**
 * Delete mappings by notification ID
 */
export async function deleteMappingsByNotificationId(
  notificationId: string
): Promise<number> {
  const db = await getDatabase();

  const result = await db.runAsync(
    `DELETE FROM scheduled_notifications WHERE notification_id = ?`,
    [notificationId]
  );

  logger.log('[ScheduledNotificationRepo] Deleted mappings for notification:', {
    notificationId,
    count: result.changes,
  });

  return result.changes;
}

/**
 * Count scheduled notifications for a medication schedule
 */
export async function countBySchedule(
  medicationId: string,
  scheduleId: string
): Promise<number> {
  const db = await getDatabase();

  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM scheduled_notifications
     WHERE medication_id = ? AND schedule_id = ?`,
    [medicationId, scheduleId]
  );

  return result?.count ?? 0;
}

/**
 * Get the last scheduled date for a medication schedule
 */
export async function getLastScheduledDate(
  medicationId: string,
  scheduleId: string
): Promise<string | null> {
  const db = await getDatabase();

  const result = await db.getFirstAsync<{ date: string }>(
    `SELECT MAX(date) as date FROM scheduled_notifications
     WHERE medication_id = ? AND schedule_id = ?`,
    [medicationId, scheduleId]
  );

  return result?.date ?? null;
}

/**
 * Get all notification mappings
 */
export async function getAllMappings(): Promise<ScheduledNotificationMapping[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<ScheduledNotificationRow>(
    `SELECT * FROM scheduled_notifications ORDER BY date ASC`
  );

  return rows.map(rowToMapping);
}

/**
 * Get all mappings for a specific date
 */
export async function getMappingsByDate(
  date: string
): Promise<ScheduledNotificationMapping[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<ScheduledNotificationRow>(
    `SELECT * FROM scheduled_notifications WHERE date = ?`,
    [date]
  );

  return rows.map(rowToMapping);
}

/**
 * Get all future mappings (date >= today)
 */
export async function getFutureMappings(): Promise<ScheduledNotificationMapping[]> {
  const db = await getDatabase();
  const today = new Date().toISOString().split('T')[0];

  const rows = await db.getAllAsync<ScheduledNotificationRow>(
    `SELECT * FROM scheduled_notifications
     WHERE date >= ?
     ORDER BY date ASC`,
    [today]
  );

  return rows.map(rowToMapping);
}

/**
 * Delete all mappings for dates before a given date
 * Used for cleanup of old mappings
 */
export async function deleteMappingsBeforeDate(date: string): Promise<number> {
  const db = await getDatabase();

  const result = await db.runAsync(
    `DELETE FROM scheduled_notifications WHERE date < ?`,
    [date]
  );

  logger.log('[ScheduledNotificationRepo] Cleaned up old mappings:', {
    beforeDate: date,
    count: result.changes,
  });

  return result.changes;
}

/**
 * Delete all mappings (used during full reschedule)
 */
export async function deleteAllMappings(): Promise<number> {
  const db = await getDatabase();

  const result = await db.runAsync(
    `DELETE FROM scheduled_notifications`
  );

  logger.log('[ScheduledNotificationRepo] Deleted all mappings:', {
    count: result.changes,
  });

  return result.changes;
}

/**
 * Get unique notification IDs for a date
 * Returns distinct notification IDs (handles grouped notifications)
 */
export async function getUniqueNotificationIdsForDate(
  date: string
): Promise<string[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{ notification_id: string }>(
    `SELECT DISTINCT notification_id FROM scheduled_notifications WHERE date = ?`,
    [date]
  );

  return rows.map(r => r.notification_id);
}

/**
 * Get daily check-in mapping for a specific date
 */
export async function getDailyCheckinMapping(
  date: string
): Promise<ScheduledNotificationMapping | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<ScheduledNotificationRow>(
    `SELECT * FROM scheduled_notifications
     WHERE date = ? AND source_type = 'daily_checkin'`,
    [date]
  );

  return row ? rowToMapping(row) : null;
}

/**
 * Get all future daily check-in mappings
 */
export async function getFutureDailyCheckinMappings(): Promise<ScheduledNotificationMapping[]> {
  const db = await getDatabase();
  const today = new Date().toISOString().split('T')[0];

  const rows = await db.getAllAsync<ScheduledNotificationRow>(
    `SELECT * FROM scheduled_notifications
     WHERE source_type = 'daily_checkin' AND date >= ?
     ORDER BY date ASC`,
    [today]
  );

  return rows.map(rowToMapping);
}

/**
 * Count daily check-in notifications
 */
export async function countDailyCheckins(): Promise<number> {
  const db = await getDatabase();
  const today = new Date().toISOString().split('T')[0];

  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM scheduled_notifications
     WHERE source_type = 'daily_checkin' AND date >= ?`,
    [today]
  );

  return result?.count ?? 0;
}

/**
 * Get the last scheduled daily check-in date
 */
export async function getLastDailyCheckinDate(): Promise<string | null> {
  const db = await getDatabase();

  const result = await db.getFirstAsync<{ date: string }>(
    `SELECT MAX(date) as date FROM scheduled_notifications
     WHERE source_type = 'daily_checkin'`
  );

  return result?.date ?? null;
}

/**
 * Delete all daily check-in mappings
 */
export async function deleteDailyCheckinMappings(): Promise<number> {
  const db = await getDatabase();

  const result = await db.runAsync(
    `DELETE FROM scheduled_notifications WHERE source_type = 'daily_checkin'`
  );

  logger.log('[ScheduledNotificationRepo] Deleted daily check-in mappings:', {
    count: result.changes,
  });

  return result.changes;
}

/**
 * Get future medication mappings only (excludes daily check-in)
 */
export async function getFutureMedicationMappings(): Promise<ScheduledNotificationMapping[]> {
  const db = await getDatabase();
  const today = new Date().toISOString().split('T')[0];

  const rows = await db.getAllAsync<ScheduledNotificationRow>(
    `SELECT * FROM scheduled_notifications
     WHERE source_type = 'medication' AND date >= ?
     ORDER BY date ASC`,
    [today]
  );

  return rows.map(rowToMapping);
}

export const scheduledNotificationRepository = {
  tableExists,
  saveMapping,
  saveMappingsBatch,
  getMapping,
  getMappingsByNotificationId,
  getMappingsBySchedule,
  getMappingsByGroupKey,
  deleteMapping,
  deleteMappingsBySchedule,
  deleteMappingsByNotificationId,
  countBySchedule,
  getLastScheduledDate,
  getAllMappings,
  getMappingsByDate,
  getFutureMappings,
  deleteMappingsBeforeDate,
  deleteAllMappings,
  getUniqueNotificationIdsForDate,
  // Daily check-in specific functions
  getDailyCheckinMapping,
  getFutureDailyCheckinMappings,
  countDailyCheckins,
  getLastDailyCheckinDate,
  deleteDailyCheckinMappings,
  getFutureMedicationMappings,
};
