import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { logger } from '../../utils/logger';
import { errorLogger } from '../errorLogger';
import { episodeRepository, episodeNoteRepository, intensityRepository } from '../../database/episodeRepository';
import { medicationRepository, medicationDoseRepository, medicationScheduleRepository } from '../../database/medicationRepository';
import { dailyStatusRepository } from '../../database/dailyStatusRepository';
import { migrationRunner } from '../../database/migrations';
import { buildInfo } from '../../buildInfo';
import {
  MedicationSchedule,
  EpisodeNote,
  IntensityReading,
  BackupMetadata,
  BackupData,
} from '../../models/types';
import {
  DB_PATH,
  generateBackupId,
  getBackupPath,
  getMetadataPath,
  initializeBackupDirectory,
} from './backupUtils';

/**
 * BackupCreator - Handles creation of database backups
 * Supports both snapshot (.db) and JSON backup formats
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
      const backupPath = getBackupPath(backupId, 'snapshot');
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
   * Legacy method - creates JSON backup
   * Now mainly used for user-initiated exports for portability
   * Automatic backups should use createSnapshotBackup instead
   */
  async createBackup(isAutomatic: boolean = false, db?: SQLite.SQLiteDatabase): Promise<BackupMetadata> {
    try {
      logger.log('[Backup] Starting backup creation, isAutomatic:', isAutomatic);
      await initializeBackupDirectory();

      // Gather all data - pass db to avoid circular dependency during migrations
      logger.log('[Backup] Fetching episodes...');
      const episodes = await episodeRepository.getAll(50, 0, db);
      logger.log('[Backup] Fetched', episodes.length, 'episodes');

      logger.log('[Backup] Fetching medications...');
      const medications = await medicationRepository.getAll(db);
      logger.log('[Backup] Fetched', medications.length, 'medications');

      logger.log('[Backup] Fetching medication doses...');
      const medicationDoses = await medicationDoseRepository.getAll(100, db);
      logger.log('[Backup] Fetched', medicationDoses.length, 'doses');

      // Gather all episode notes
      logger.log('[Backup] Fetching episode notes...');
      const episodeNotes: EpisodeNote[] = [];
      for (const ep of episodes) {
        const notes = await episodeNoteRepository.getByEpisodeId(ep.id, db);
        episodeNotes.push(...notes);
      }
      logger.log('[Backup] Fetched', episodeNotes.length, 'episode notes');

      // Gather all intensity readings
      logger.log('[Backup] Fetching intensity readings...');
      const intensityReadings: IntensityReading[] = [];
      for (const ep of episodes) {
        const readings = await intensityRepository.getByEpisodeId(ep.id, db);
        intensityReadings.push(...readings);
      }
      logger.log('[Backup] Fetched', intensityReadings.length, 'intensity readings');

      // Gather all daily status logs (get last 2 years of data)
      logger.log('[Backup] Fetching daily status logs...');
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const today = new Date();
      const startDate = twoYearsAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];
      const dailyStatusLogs = await dailyStatusRepository.getDateRange(startDate, endDate, db);
      logger.log('[Backup] Fetched', dailyStatusLogs.length, 'daily status logs');

      // Gather all medication schedules
      logger.log('[Backup] Fetching medication schedules...');
      const medicationSchedules: MedicationSchedule[] = [];
      for (const med of medications) {
        const schedules = await medicationScheduleRepository.getByMedicationId(med.id, db);
        medicationSchedules.push(...schedules);
      }
      logger.log('[Backup] Fetched', medicationSchedules.length, 'schedules');

      logger.log('[Backup] Generating backup ID...');
      const backupId = generateBackupId();
      logger.log('[Backup] Backup ID:', backupId);

      // Get actual database schema version
      logger.log('[Backup] Getting current schema version...');
      const schemaVersion = await migrationRunner.getCurrentVersion();
      logger.log('[Backup] Current schema version:', schemaVersion);

      // Export complete schema SQL from database
      logger.log('[Backup] Exporting schema SQL...');
      const schemaSQL = await this.exportSchemaSQL(db);
      logger.log('[Backup] Schema SQL exported, length:', schemaSQL.length);

      const backupData: BackupData = {
        metadata: {
          id: backupId,
          timestamp: Date.now(),
          version: buildInfo.version,
          schemaVersion,
          episodeCount: episodes.length,
          medicationCount: medications.length,
        },
        schemaSQL,
        episodes,
        episodeNotes,
        intensityReadings,
        dailyStatusLogs,
        medications,
        medicationDoses,
        medicationSchedules,
      };

      const backupPath = getBackupPath(backupId, 'json');
      logger.log('[Backup] Backup path:', backupPath);

      logger.log('[Backup] Stringifying backup data...');
      const backupJson = JSON.stringify(backupData, null, 2);
      logger.log('[Backup] Backup JSON size:', backupJson.length, 'characters');

      logger.log('[Backup] Writing backup file...');
      await FileSystem.writeAsStringAsync(backupPath, backupJson);
      logger.log('[Backup] Backup file written successfully');

      logger.log('[Backup] Getting file info...');
      const fileInfo = await FileSystem.getInfoAsync(backupPath);
      const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;
      logger.log('[Backup] File size:', fileSize, 'bytes');

      const metadata: BackupMetadata = {
        ...backupData.metadata,
        fileName: `${backupId}.json`,
        fileSize,
        backupType: 'json',
      };

      logger.log('[Backup] Backup created successfully:', metadata.id);
      return metadata;
    } catch (error) {
      logger.error('[Backup] FAILED to create backup:', error);
      logger.error('[Backup] Error type:', typeof error);
      logger.error('[Backup] Error details:', JSON.stringify(error, null, 2));
      throw new Error('Failed to create backup: ' + (error as Error).message);
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

  /**
   * Export complete schema SQL from database
   */
  private async exportSchemaSQL(db?: SQLite.SQLiteDatabase): Promise<string> {
    try {
      // Get database instance
      let database: SQLite.SQLiteDatabase;
      if (db) {
        database = db;
      } else {
        database = await import('../../database/db').then(m => m.getDatabase());
      }

      // Query sqlite_master to get all CREATE statements for tables and indexes
      // Exclude system tables and schema_version (managed by migration runner)
      const schemaDefs = await database.getAllAsync<{ sql: string }>(
        `SELECT sql FROM sqlite_master
         WHERE type IN ('table', 'index')
         AND name NOT LIKE 'sqlite_%'
         AND name != 'schema_version'
         AND sql IS NOT NULL
         ORDER BY type DESC, name`
      );

      // Combine all SQL statements with semicolons
      const schemaSQL = schemaDefs
        .map(row => row.sql)
        .filter(sql => sql) // Filter out any null/undefined
        .join(';\n\n') + ';';

      return schemaSQL;
    } catch (error) {
      logger.error('[Backup] Failed to export schema SQL:', error);
      throw new Error('Failed to export schema SQL: ' + (error as Error).message);
    }
  }
}

export const backupCreator = new BackupCreator();
