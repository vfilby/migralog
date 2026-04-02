import * as FileSystem from 'expo-file-system/legacy';
import { logger } from '../../utils/logger';
import { errorLogger } from '../errorLogger';
import { migrationRunner } from '../../database/migrations';
import { BackupMetadata } from '../../models/types';
import {
  DB_PATH,
  getBackupPath,
  getBackupMetadata,
} from './backupUtils';

class BackupRestorer {
  async restoreBackup(backupId: string): Promise<void> {
    try {
      logger.log('[Restore] Starting backup restore:', backupId);

      // Get metadata to determine backup type
      const metadata = await getBackupMetadata(backupId);
      if (!metadata) {
        throw new Error('Backup not found');
      }

      if (metadata.backupType === 'snapshot') {
        await this.restoreSnapshotBackup(backupId, metadata);
      } else {
        // JSON restore support removed in Issue #185
        throw new Error(
          'JSON backup restore is no longer supported. Please use a snapshot (.db) backup instead. ' +
          'You can export your data using the Export Data feature and create a new snapshot backup.'
        );
      }

      logger.log('[Restore] Backup restored successfully');
    } catch (error) {
      logger.error('[Restore] FAILED to restore backup:', error);
      await errorLogger.log(
        'storage',
        'Failed to restore backup',
        error as Error,
        { context: 'BackupRestorer.restoreBackup', backupId }
      );
      throw new Error('Failed to restore backup: ' + (error as Error).message);
    }
  }

  /**
   * Restore from a database snapshot backup (.db file)
   * This is much simpler than JSON restore - just copy the file and run migrations
   */
  private async restoreSnapshotBackup(backupId: string, metadata: BackupMetadata): Promise<void> {
    try {
      logger.log('[Restore] Restoring from snapshot backup');

      const backupPath = getBackupPath(backupId);
      const backupInfo = await FileSystem.getInfoAsync(backupPath);

      if (!backupInfo.exists) {
        throw new Error('Snapshot backup file not found');
      }

      // Validate backup schema version compatibility
      const appSchemaVersion = await migrationRunner.getCurrentVersion();
      if (metadata.schemaVersion > appSchemaVersion) {
        throw new Error(
          `Cannot restore backup from newer schema version (backup: v${metadata.schemaVersion}, current: v${appSchemaVersion}). ` +
          `Please update the app to the latest version before restoring this backup.`
        );
      }

      // Checkpoint WAL to ensure all changes are flushed to main DB
      // This prevents data loss when we delete the WAL file
      logger.log('[Restore] Checkpointing WAL file');
      try {
        const { getDatabase } = await import('../../database/db');
        const currentDb = await getDatabase();
        await currentDb.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
        logger.log('[Restore] WAL checkpointed successfully');
      } catch (error) {
        logger.warn('[Restore] WAL checkpoint failed (database may already be closed):', error);
      }

      // Close current database connection
      const { closeDatabase } = await import('../../database/db');
      await closeDatabase();

      // Create a safety backup of current database before replacing
      const safetyBackupPath = `${FileSystem.documentDirectory}SQLite/migralog_pre_restore_${Date.now()}.db`;
      const currentDbInfo = await FileSystem.getInfoAsync(DB_PATH);
      if (currentDbInfo.exists) {
        logger.log('[Restore] Creating safety backup of current database');
        await FileSystem.copyAsync({
          from: DB_PATH,
          to: safetyBackupPath,
        });
        logger.log('[Restore] Safety backup created at:', safetyBackupPath);
      }

      // Delete existing database files (including WAL and SHM journal files)
      // WAL (Write-Ahead Logging) files can have read-only permissions that persist
      logger.log('[Restore] Removing existing database files');
      const dbExists = await FileSystem.getInfoAsync(DB_PATH);
      if (dbExists.exists) {
        await FileSystem.deleteAsync(DB_PATH);
      }

      // Also delete WAL and SHM files if they exist
      const walPath = `${DB_PATH}-wal`;
      const shmPath = `${DB_PATH}-shm`;

      const walExists = await FileSystem.getInfoAsync(walPath);
      if (walExists.exists) {
        logger.log('[Restore] Removing WAL file');
        await FileSystem.deleteAsync(walPath);
      }

      const shmExists = await FileSystem.getInfoAsync(shmPath);
      if (shmExists.exists) {
        logger.log('[Restore] Removing SHM file');
        await FileSystem.deleteAsync(shmPath);
      }

      // Copy snapshot to database location using read/write to ensure proper permissions
      // Direct copyAsync can preserve read-only permissions from the source file
      logger.log('[Restore] Copying snapshot to database location');

      // Read backup file as base64
      const backupContent = await FileSystem.readAsStringAsync(backupPath, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Write to database location (creates new file with write permissions)
      await FileSystem.writeAsStringAsync(DB_PATH, backupContent, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Re-open database and run migrations if needed
      logger.log('[Restore] Reopening database');
      const { getDatabase } = await import('../../database/db');
      const restoredDb = await getDatabase();

      // Reinitialize migration runner with new database connection
      await migrationRunner.initialize(restoredDb);

      const restoredSchemaVersion = await migrationRunner.getCurrentVersion();
      logger.log('[Restore] Current schema version after restore:', restoredSchemaVersion);
      logger.log('[Restore] Backup schema version:', metadata.schemaVersion);

      if (metadata.schemaVersion < appSchemaVersion) {
        logger.log('[Restore] Running migrations from version', metadata.schemaVersion, 'to', appSchemaVersion);
        await migrationRunner.runMigrations();
        logger.log('[Restore] Migrations completed successfully');
      } else {
        logger.log('[Restore] No migrations needed');
      }

      logger.log('[Restore] Snapshot restore complete');
    } catch (error) {
      logger.error('[Restore] FAILED to restore snapshot:', error);
      await errorLogger.log(
        'storage',
        'Failed to restore snapshot backup',
        error as Error,
        { context: 'BackupRestorer.restoreSnapshotBackup', backupId }
      );
      throw error;
    }
  }

  /**
   * Import a raw SQLite database file
   * WARNING: This will replace the entire database!
   */
  async importDatabaseFile(): Promise<void> {
    try {
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/x-sqlite3', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        throw new Error('Import cancelled');
      }

      const fileUri = result.assets[0].uri;

      // Close the current database connection
      const { closeDatabase } = await import('../../database/db');
      await closeDatabase();

      // Backup the current database before replacing it
      const backupPath = `${FileSystem.documentDirectory}SQLite/migralog_backup_${Date.now()}.db`;
      const currentDbInfo = await FileSystem.getInfoAsync(DB_PATH);
      if (currentDbInfo.exists) {
        await FileSystem.copyAsync({
          from: DB_PATH,
          to: backupPath,
        });
        logger.log('Current database backed up to:', backupPath);
      }

      // Copy the imported file to the database location
      await FileSystem.copyAsync({
        from: fileUri,
        to: DB_PATH,
      });

      logger.log('Database file imported successfully');

      // The app will need to be reloaded to reinitialize the database
      // The database will be opened again on next getDatabase() call
    } catch (error) {
      logger.error('Failed to import database file:', error);
      throw new Error('Failed to import database file: ' + (error as Error).message);
    }
  }
}

export const backupRestorer = new BackupRestorer();
