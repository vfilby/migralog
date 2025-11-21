import * as FileSystem from 'expo-file-system/legacy';
import { BackupMetadata, BackupData } from '../models/types';
import { logger } from '../utils/logger';

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
 * Validate backup data structure
 * Ensures critical fields are present and valid
 */
export function validateBackupData(backupData: unknown): backupData is BackupData {
  if (!backupData || typeof backupData !== 'object') {
    logger.error('[Validation] Backup data is missing or not an object');
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = backupData as any;

  // Validate metadata
  if (!validateBackupMetadata(b.metadata)) {
    return false;
  }

  // Validate arrays are present and are actually arrays
  if (!Array.isArray(b.episodes)) {
    logger.error('[Validation] episodes field is missing or not an array');
    return false;
  }

  if (!Array.isArray(b.medications)) {
    logger.error('[Validation] medications field is missing or not an array');
    return false;
  }

  if (!Array.isArray(b.medicationDoses)) {
    logger.error('[Validation] medicationDoses field is missing or not an array');
    return false;
  }

  if (!Array.isArray(b.medicationSchedules)) {
    logger.error('[Validation] medicationSchedules field is missing or not an array');
    return false;
  }

  return true;
}

/**
 * Generate a unique backup ID
 */
export function generateBackupId(): string {
  return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get the file path for a backup
 */
export function getBackupPath(backupId: string, backupType: 'snapshot' | 'json'): string {
  const extension = backupType === 'snapshot' ? 'db' : 'json';
  return `${BACKUP_DIR}${backupId}.${extension}`;
}

/**
 * Get the file path for backup metadata
 */
export function getMetadataPath(backupId: string): string {
  return `${BACKUP_DIR}${backupId}.meta.json`;
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format timestamp as locale date string
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
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
 * Get metadata for a specific backup
 * Tries to read from .meta.json file first (snapshot backups), then from JSON backup file
 */
export async function getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
  try {
    // Try snapshot first (.meta.json)
    const metadataPath = getMetadataPath(backupId);
    const metadataInfo = await FileSystem.getInfoAsync(metadataPath);

    if (metadataInfo.exists) {
      const content = await FileSystem.readAsStringAsync(metadataPath);
      return JSON.parse(content);
    }

    // Try JSON backup
    const jsonPath = getBackupPath(backupId, 'json');
    const jsonInfo = await FileSystem.getInfoAsync(jsonPath);

    if (jsonInfo.exists) {
      const content = await FileSystem.readAsStringAsync(jsonPath);
      const backupData: BackupData = JSON.parse(content);
      const fileSize = 'size' in jsonInfo ? jsonInfo.size : 0;

      return {
        ...backupData.metadata,
        fileName: `${backupId}.json`,
        fileSize,
        backupType: 'json',
      };
    }

    return null;
  } catch (error) {
    logger.error('Failed to get backup metadata:', error);
    return null;
  }
}
