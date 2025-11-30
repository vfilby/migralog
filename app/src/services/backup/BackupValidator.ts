import * as FileSystem from 'expo-file-system/legacy';
import { logger } from '../../utils/logger';
import { BackupData } from '../../models/types';
import {
  BACKUP_DIR,
  getBackupPath,
  initializeBackupDirectory,
} from './backupUtils';

/**
 * BackupValidator - Handles validation and cleanup of backup files
 * Detects and removes broken or orphaned backup files
 */
class BackupValidator {
  /**
   * Check for broken backup files without deleting them
   * Returns the count of broken backup files found
   */
  async checkForBrokenBackups(): Promise<number> {
    try {
      await initializeBackupDirectory();

      const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
      if (!dirInfo.exists) {
        return 0;
      }

      const files = await FileSystem.readDirectoryAsync(BACKUP_DIR);
      let brokenCount = 0;

      for (const file of files) {
        try {
          // Check for JSON files with invalid metadata
          if (file.endsWith('.json') && !file.endsWith('.meta.json')) {
            const filePath = BACKUP_DIR + file;
            const content = await FileSystem.readAsStringAsync(filePath);
            const backupData: BackupData = JSON.parse(content);

            // If metadata is missing or invalid, count it
            if (!backupData || !backupData.metadata || !backupData.metadata.id) {
              brokenCount++;
            }
          }
          // Check for orphaned metadata files (no corresponding .db file)
          else if (file.endsWith('.meta.json')) {
            const backupId = file.replace('.meta.json', '');
            const dbPath = getBackupPath(backupId);
            const dbInfo = await FileSystem.getInfoAsync(dbPath);

            if (!dbInfo.exists) {
              brokenCount++;
            }
          }
        } catch {
          // If we can't parse a JSON file, it's probably corrupted - count it
          if (file.endsWith('.json') && !file.endsWith('.meta.json')) {
            brokenCount++;
          }
        }
      }

      return brokenCount;
    } catch (error) {
      logger.error('[Backup] Failed to check for broken backups:', error);
      return 0;
    }
  }

  /**
   * Clean up orphaned or broken backup files
   * This removes:
   * - JSON files with invalid/missing metadata
   * - Orphaned metadata files without corresponding backup files
   * Returns the number of files cleaned up
   */
  async cleanupBrokenBackups(): Promise<number> {
    try {
      await initializeBackupDirectory();

      const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
      if (!dirInfo.exists) {
        return 0;
      }

      const files = await FileSystem.readDirectoryAsync(BACKUP_DIR);
      let cleanedCount = 0;

      for (const file of files) {
        try {
          // Check for JSON files with invalid metadata
          if (file.endsWith('.json') && !file.endsWith('.meta.json')) {
            const filePath = BACKUP_DIR + file;
            const content = await FileSystem.readAsStringAsync(filePath);
            const backupData: BackupData = JSON.parse(content);

            // If metadata is missing or invalid, delete the file
            if (!backupData || !backupData.metadata || !backupData.metadata.id) {
              logger.log(`[Cleanup] Deleting broken JSON backup: ${file}`);
              await FileSystem.deleteAsync(filePath);
              cleanedCount++;
            }
          }
          // Check for orphaned metadata files (no corresponding .db file)
          else if (file.endsWith('.meta.json')) {
            const backupId = file.replace('.meta.json', '');
            const dbPath = getBackupPath(backupId);
            const dbInfo = await FileSystem.getInfoAsync(dbPath);

            if (!dbInfo.exists) {
              logger.log(`[Cleanup] Deleting orphaned metadata file: ${file}`);
              const metadataPath = BACKUP_DIR + file;
              await FileSystem.deleteAsync(metadataPath);
              cleanedCount++;
            }
          }
        } catch (error) {
          logger.error(`[Cleanup] Failed to process ${file}:`, error);
          // If we can't parse a JSON file, it's probably corrupted - delete it
          if (file.endsWith('.json') && !file.endsWith('.meta.json')) {
            try {
              logger.log(`[Cleanup] Deleting corrupted JSON backup: ${file}`);
              await FileSystem.deleteAsync(BACKUP_DIR + file);
              cleanedCount++;
            } catch (deleteError) {
              logger.error(`[Cleanup] Failed to delete corrupted backup ${file}:`, deleteError);
            }
          }
        }
      }

      logger.log(`[Cleanup] Cleaned up ${cleanedCount} broken backup file(s)`);
      return cleanedCount;
    } catch (error) {
      logger.error('[Cleanup] Failed to cleanup broken backups:', error);
      throw new Error('Failed to cleanup broken backups: ' + (error as Error).message);
    }
  }
}

export const backupValidator = new BackupValidator();
