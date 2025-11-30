import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/logger';
import { errorLogger } from '../errorLogger';
import { BackupMetadata } from '../../models/types';
import {
  MAX_AUTO_BACKUPS,
  WEEKLY_BACKUP_INTERVAL_MS,
  LAST_WEEKLY_BACKUP_KEY,
  formatFileSize,
  formatDate,
  initializeBackupDirectory,
  getBackupPath,
  getMetadataPath,
} from './backupUtils';
import { backupCreator } from './BackupCreator';
import { backupValidator } from './BackupValidator';
import { backupExporter } from './BackupExporter';

/**
 * BackupServiceImpl - Main coordinator for backup operations
 * Delegates to specialized modules for specific functionality:
 * - BackupCreator: Creates snapshot backups
 * - BackupValidator: Validates and cleans up broken backups
 * - BackupExporter: Handles export/import operations and JSON data export
 * - BackupRestorer: Handles backup restoration (via backupService facade)
 */
class BackupServiceImpl {
  /**
   * Create a database snapshot backup (DB file copy)
   * Delegates to BackupCreator
   */
  async createSnapshotBackup(db?: SQLite.SQLiteDatabase): Promise<BackupMetadata> {
    return backupCreator.createSnapshotBackup(db);
  }



  /**
   * List all available backups
   */
  async listBackups(): Promise<BackupMetadata[]> {
    try {
      await initializeBackupDirectory();

      const dirInfo = await FileSystem.getInfoAsync(
        `${FileSystem.documentDirectory}backups/`
      );
      if (!dirInfo.exists) {
        return [];
      }

      const files = await FileSystem.readDirectoryAsync(
        `${FileSystem.documentDirectory}backups/`
      );
      const backups: BackupMetadata[] = [];

      for (const file of files) {
        try {
          // Handle snapshot backups (.db files with .meta.json sidecar)
          if (file.endsWith('.db')) {
            const backupId = file.replace('.db', '');
            const metadataPath = getMetadataPath(backupId);
            const metadataInfo = await FileSystem.getInfoAsync(metadataPath);

            if (metadataInfo.exists) {
              const metadataContent = await FileSystem.readAsStringAsync(metadataPath);
              const metadata: BackupMetadata = JSON.parse(metadataContent);
              // Ensure ID is set (some old metadata files may not have it)
              if (!metadata.id) {
                metadata.id = backupId;
              }
              backups.push(metadata);
            } else {
              // Legacy snapshot without metadata - create basic metadata
              const filePath = `${FileSystem.documentDirectory}backups/${file}`;
              const fileInfo = await FileSystem.getInfoAsync(filePath);
              const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

              backups.push({
                id: backupId,
                timestamp: 0, // Unknown
                version: '1.0.0',
                schemaVersion: 0, // Unknown
                episodeCount: 0,
                medicationCount: 0,
                fileName: file,
                fileSize,
                backupType: 'snapshot',
              });
            }
          }
          // Skip JSON backups - JSON restore support removed in Issue #185
          else if (file.endsWith('.json') && !file.endsWith('.meta.json')) {
            logger.log(`[Backup] Skipping legacy JSON backup file: ${file} (JSON restore no longer supported)`);
          }
        } catch (error) {
          logger.error(`Failed to read backup ${file}:`, error);
          // Continue processing other backups even if one fails
        }
      }

      // Filter out any backups with invalid IDs before returning
      const validBackups = backups.filter(backup => {
        if (!backup.id || backup.id === 'undefined') {
          logger.warn(`[Backup] Filtering out backup with invalid ID:`, backup);
          return false;
        }
        return true;
      });

      // Sort by timestamp, newest first
      return validBackups.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      logger.error('Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    try {
      logger.log('[Delete] Attempting to delete backup:', backupId);

      // Delete snapshot backup files (.db and .meta.json)
      const snapshotPath = getBackupPath(backupId);
      const metadataPath = getMetadataPath(backupId);

      // Check which files actually exist
      const snapshotExists = await FileSystem.getInfoAsync(snapshotPath);
      const metadataExists = await FileSystem.getInfoAsync(metadataPath);

      let deletedCount = 0;

      // Delete snapshot file if it exists
      if (snapshotExists.exists) {
        await FileSystem.deleteAsync(snapshotPath);
        logger.log('[Delete] Deleted snapshot file:', snapshotPath);
        deletedCount++;
      }

      // Delete metadata file if it exists
      if (metadataExists.exists) {
        await FileSystem.deleteAsync(metadataPath);
        logger.log('[Delete] Deleted metadata file:', metadataPath);
        deletedCount++;
      }

      if (deletedCount === 0) {
        logger.warn('[Delete] No files found for backup:', backupId);
        throw new Error('Backup files not found');
      }

      logger.log(`[Delete] Successfully deleted ${deletedCount} file(s) for backup:`, backupId);
    } catch (error) {
      logger.error('[Delete] Failed to delete backup:', error);
      throw new Error('Failed to delete backup: ' + (error as Error).message);
    }
  }

  /**
   * Check for broken backup files
   * Delegates to BackupValidator
   */
  async checkForBrokenBackups(): Promise<number> {
    return backupValidator.checkForBrokenBackups();
  }

  /**
   * Clean up broken backup files
   * Delegates to BackupValidator
   */
  async cleanupBrokenBackups(): Promise<number> {
    return backupValidator.cleanupBrokenBackups();
  }

  /**
   * Export current database as JSON for data portability and healthcare sharing
   * Delegates to BackupExporter
   */
  async exportDataAsJson(): Promise<void> {
    return backupExporter.exportDataAsJson();
  }

  /**
   * Export a backup file
   * Delegates to BackupExporter
   */
  async exportBackup(backupId: string): Promise<void> {
    return backupExporter.exportBackup(backupId);
  }

  /**
   * Import a backup file
   * Delegates to BackupExporter
   */
  async importBackup(): Promise<BackupMetadata> {
    return backupExporter.importBackup();
  }

  /**
   * Export the raw database file
   * Delegates to BackupExporter
   */
  async exportDatabaseFile(): Promise<void> {
    return backupExporter.exportDatabaseFile();
  }

  /**
   * Clean up old automatic backups, keeping only the newest MAX_AUTO_BACKUPS
   */
  private async cleanupOldAutoBackups(): Promise<void> {
    try {
      const backups = await this.listBackups();
      const autoBackups = backups.filter(b => b.id.startsWith('backup_'));

      if (autoBackups.length > MAX_AUTO_BACKUPS) {
        // Sort by timestamp and keep only the newest MAX_AUTO_BACKUPS
        const toDelete = autoBackups
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(MAX_AUTO_BACKUPS);

        logger.log(`[Backup] Cleaning up ${toDelete.length} old automatic backups (keeping ${MAX_AUTO_BACKUPS} most recent)`);
        for (const backup of toDelete) {
          await this.deleteBackup(backup.id);
          logger.log(`[Backup] Deleted old backup: ${backup.id}`);
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old backups:', error);
      // Log to error logger for Sentry tracking
      try {
        await errorLogger.log(
          'storage',
          'Failed to cleanup old automatic backups',
          error as Error,
          { operation: 'cleanupOldAutoBackups' }
        );
      } catch (e) {
        logger.error('[Backup] Failed to log cleanup error:', e);
      }
    }
  }

  /**
   * Check if a weekly backup is needed and create one if so
   * This should be called on app startup to ensure weekly backups happen automatically
   */
  async checkAndCreateWeeklyBackup(db?: SQLite.SQLiteDatabase): Promise<BackupMetadata | null> {
    try {
      logger.log('[Backup] Checking if weekly backup is needed...');

      // Get last weekly backup timestamp
      const lastBackupTime = await AsyncStorage.getItem(LAST_WEEKLY_BACKUP_KEY);
      const lastBackupTimestamp = lastBackupTime ? parseInt(lastBackupTime, 10) : 0;
      const now = Date.now();
      const timeSinceLastBackup = now - lastBackupTimestamp;

      logger.log('[Backup] Last weekly backup:', lastBackupTimestamp ? new Date(lastBackupTimestamp).toISOString() : 'never');
      logger.log('[Backup] Time since last backup:', Math.floor(timeSinceLastBackup / (24 * 60 * 60 * 1000)), 'days');

      if (timeSinceLastBackup >= WEEKLY_BACKUP_INTERVAL_MS) {
        logger.log('[Backup] Weekly backup needed, creating...');

        // Create automatic snapshot backup (safer than JSON)
        const metadata = await this.createSnapshotBackup(db);

        // Cleanup old automatic backups
        await this.cleanupOldAutoBackups();

        // Update last backup timestamp
        await AsyncStorage.setItem(LAST_WEEKLY_BACKUP_KEY, now.toString());

        logger.log('[Backup] Weekly backup created successfully:', metadata.id);
        return metadata;
      } else {
        const daysUntilNext = Math.ceil((WEEKLY_BACKUP_INTERVAL_MS - timeSinceLastBackup) / (24 * 60 * 60 * 1000));
        logger.log(`[Backup] No weekly backup needed. Next backup in ${daysUntilNext} days`);
        return null;
      }
    } catch (error) {
      logger.error('[Backup] Failed to check/create weekly backup:', error);
      // Log to error logger for Sentry tracking
      try {
        await errorLogger.log(
          'storage',
          'Failed to check/create weekly backup',
          error as Error,
          { operation: 'checkAndCreateWeeklyBackup' }
        );
      } catch (e) {
        logger.error('[Backup] Failed to log weekly backup error:', e);
      }
      // Don't throw - weekly backup failure shouldn't crash the app
      return null;
    }
  }

  /**
   * Get the timestamp of the last weekly backup
   */
  async getLastWeeklyBackupTime(): Promise<number> {
    try {
      const lastBackupTime = await AsyncStorage.getItem(LAST_WEEKLY_BACKUP_KEY);
      return lastBackupTime ? parseInt(lastBackupTime, 10) : 0;
    } catch (error) {
      logger.error('[Backup] Failed to get last weekly backup time:', error);
      return 0;
    }
  }

  /**
   * Get the number of days until the next weekly backup
   */
  async getDaysUntilNextWeeklyBackup(): Promise<number> {
    try {
      const lastBackupTime = await this.getLastWeeklyBackupTime();
      if (lastBackupTime === 0) {
        return 0; // Backup needed now
      }

      const now = Date.now();
      const timeSinceLastBackup = now - lastBackupTime;
      const timeUntilNextBackup = WEEKLY_BACKUP_INTERVAL_MS - timeSinceLastBackup;

      if (timeUntilNextBackup <= 0) {
        return 0; // Backup needed now
      }

      return Math.ceil(timeUntilNextBackup / (24 * 60 * 60 * 1000));
    } catch (error) {
      logger.error('[Backup] Failed to calculate days until next backup:', error);
      return 0;
    }
  }

  // Utility methods
  formatFileSize = formatFileSize;
  formatDate = formatDate;
}

export const backupServiceImpl = new BackupServiceImpl();
