import * as FileSystem from 'expo-file-system/legacy';
import { BackupMetadata } from '../../models/types';
import { logger } from '../../utils/logger';

// Re-export formatting utilities from their dedicated module
export { formatFileSize, formatDate } from '../../utils/formatting';

// Constants
export const BACKUP_DIR = `${FileSystem.documentDirectory}backups/`;
export const DB_PATH = `${FileSystem.documentDirectory}SQLite/migralog.db`;
export const MAX_AUTO_BACKUPS = 7; // Keep last 7 automatic backups (weekly backups for ~2 months)
export const WEEKLY_BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
export const LAST_WEEKLY_BACKUP_KEY = '@MigraLog:lastWeeklyBackup';

/**
 * Validate backup metadata to ensure data integrity
 * Critical for health data - we must validate all required fields
 */
export function validateBackupMetadata(metadata: unknown): metadata is Omit<BackupMetadata, 'fileSize' | 'fileName' | 'backupType'> {
  if (!metadata || typeof metadata !== 'object') {
    logger.error('[Validation] Metadata is missing or not an object');
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = metadata as any;

  // Validate id: must be a non-empty string
  if (typeof m.id !== 'string' || !m.id.trim()) {
    logger.error('[Validation] metadata.id is missing, empty, or not a string:', m.id);
    return false;
  }

  // Validate timestamp: must be a positive number
  if (typeof m.timestamp !== 'number' || m.timestamp <= 0) {
    logger.error('[Validation] metadata.timestamp is invalid:', m.timestamp);
    return false;
  }

  // Validate version: must be a non-empty string
  if (typeof m.version !== 'string' || !m.version.trim()) {
    logger.error('[Validation] metadata.version is missing or invalid:', m.version);
    return false;
  }

  // Validate schemaVersion: must be a non-negative number
  if (typeof m.schemaVersion !== 'number' || m.schemaVersion < 0) {
    logger.error('[Validation] metadata.schemaVersion is invalid:', m.schemaVersion);
    return false;
  }

  // Validate counts: must be non-negative numbers
  if (typeof m.episodeCount !== 'number' || m.episodeCount < 0) {
    logger.error('[Validation] metadata.episodeCount is invalid:', m.episodeCount);
    return false;
  }

  if (typeof m.medicationCount !== 'number' || m.medicationCount < 0) {
    logger.error('[Validation] metadata.medicationCount is invalid:', m.medicationCount);
    return false;
  }

  return true;
}

/**
 * Generate a unique backup ID
 */
export function generateBackupId(): string {
  return `backup_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Get the file path for a snapshot backup
 * Note: Only snapshot backups are supported (Issue #194)
 */
export function getBackupPath(backupId: string): string {
  return `${BACKUP_DIR}${backupId}.db`;
}

/**
 * Get the file path for backup metadata
 */
export function getMetadataPath(backupId: string): string {
  return `${BACKUP_DIR}${backupId}.meta.json`;
}


/**
 * Initialize backup directory
 */
export async function initializeBackupDirectory(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
  }
}

/**
 * Get metadata for a specific snapshot backup
 * Reads from .meta.json sidecar file
 * Note: Only snapshot backups are supported (Issue #194)
 */
export async function getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
  try {
    const metadataPath = getMetadataPath(backupId);
    const metadataInfo = await FileSystem.getInfoAsync(metadataPath);

    if (metadataInfo.exists) {
      const content = await FileSystem.readAsStringAsync(metadataPath);
      return JSON.parse(content);
    }

    return null;
  } catch (error) {
    logger.error('Failed to get backup metadata:', error);
    return null;
  }
}
