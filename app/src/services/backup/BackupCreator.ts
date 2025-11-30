import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { logger } from '../../utils/logger';
import { errorLogger } from '../errorLogger';
import { migrationRunner } from '../../database/migrations';
import { buildInfo } from '../../buildInfo';
import { BackupMetadata } from '../../models/types';
import {
  DB_PATH,
  generateBackupId,
  getBackupPath,
  getMetadataPath,
  initializeBackupDirectory,
} from './backupUtils';

/**
 * BackupCreator - Handles creation of database snapshot backups
 * Only supports snapshot (.db) format for backup/restore operations
 * For JSON data export, see BackupExporter.exportDataAsJson()
 */
class BackupCreator {
  /**
   * Create a database snapshot backup (DB file copy)
   * This is the preferred method for automatic backups (pre-migration, weekly)
   * because it captures the complete database without risk of missing fields
   */
  async createSnapshotBackup(db?: SQLite.SQLiteDatabase): Promise<BackupMetadata> {
    try {
      logger.log('[Backup] Starting snapshot backup creation');
      await initializeBackupDirectory();

      // Generate backup ID
      const backupId = generateBackupId();
      const backupPath = getBackupPath(backupId);
      const metadataPath = getMetadataPath(backupId);

      // Check if database file exists
      const dbInfo = await FileSystem.getInfoAsync(DB_PATH);
      if (!dbInfo.exists) {
        throw new Error('Database file not found');
      }

      // Copy database file to backup location
      logger.log('[Backup] Copying database file...');
      await FileSystem.copyAsync({
        from: DB_PATH,
        to: backupPath,
      });

      // Get counts for metadata (quick queries)
      const episodeCount = await this.getEpisodeCount(db);
      const medicationCount = await this.getMedicationCount(db);
      const schemaVersion = await migrationRunner.getCurrentVersion();

      // Get file size
      const backupInfo = await FileSystem.getInfoAsync(backupPath);
      const fileSize = backupInfo.exists && 'size' in backupInfo ? backupInfo.size : 0;

      // Create metadata
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: Date.now(),
        version: buildInfo.version,
        schemaVersion,
        episodeCount,
        medicationCount,
        fileSize,
        fileName: `${backupId}.db`,
        backupType: 'snapshot',
      };

      // Save metadata sidecar file
      await FileSystem.writeAsStringAsync(metadataPath, JSON.stringify(metadata, null, 2));

      logger.log('[Backup] Snapshot backup created successfully:', metadata.id);
      return metadata;
    } catch (error) {
      logger.error('[Backup] FAILED to create snapshot backup:', error);
      // Log to error logger for Sentry tracking
      try {
        await errorLogger.log(
          'storage',
          'Failed to create snapshot backup',
          error as Error,
          { operation: 'createSnapshotBackup' }
        );
      } catch (e) {
        logger.error('[Backup] Failed to log snapshot backup error:', e);
      }
      throw new Error('Failed to create snapshot backup: ' + (error as Error).message);
    }
  }



  /**
   * Helper method to get episode count for metadata
   */
  private async getEpisodeCount(db?: SQLite.SQLiteDatabase): Promise<number> {
    try {
      let database: SQLite.SQLiteDatabase;
      if (db) {
        database = db;
      } else {
        database = await import('../../database/db').then(m => m.getDatabase());
      }

      const result = await database.getAllAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM episodes'
      );
      return result[0]?.count || 0;
    } catch (error) {
      logger.error('[Backup] Failed to get episode count:', error);
      return 0;
    }
  }

  /**
   * Helper method to get medication count for metadata
   */
  private async getMedicationCount(db?: SQLite.SQLiteDatabase): Promise<number> {
    try {
      let database: SQLite.SQLiteDatabase;
      if (db) {
        database = db;
      } else {
        database = await import('../../database/db').then(m => m.getDatabase());
      }

      const result = await database.getAllAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM medications'
      );
      return result[0]?.count || 0;
    } catch (error) {
      logger.error('[Backup] Failed to get medication count:', error);
      return 0;
    }
  }


}

export const backupCreator = new BackupCreator();
