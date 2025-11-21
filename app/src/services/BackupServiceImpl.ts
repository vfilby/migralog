import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import { errorLogger } from './errorLogger';
import { episodeRepository, episodeNoteRepository, intensityRepository } from '../database/episodeRepository';
import { medicationRepository, medicationDoseRepository, medicationScheduleRepository } from '../database/medicationRepository';
import { dailyStatusRepository } from '../database/dailyStatusRepository';
import { migrationRunner } from '../database/migrations';
import { buildInfo } from '../buildInfo';
import {
  Episode,
  Medication,
  MedicationDose,
  MedicationSchedule,
  EpisodeNote,
  IntensityReading,
  DailyStatusLog,
  BackupMetadata,
  BackupData,
} from '../models/types';
import {
  BACKUP_DIR,
  DB_PATH,
  MAX_AUTO_BACKUPS,
  WEEKLY_BACKUP_INTERVAL_MS,
  LAST_WEEKLY_BACKUP_KEY,
  generateBackupId,
  getBackupPath,
  getMetadataPath,
  getBackupMetadata,
  initializeBackupDirectory,
  validateBackupData,
  validateBackupMetadata,
  formatFileSize,
  formatDate,
} from './backupUtils';

class BackupServiceImpl {
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
      logger.log('[Backup] Backup directory:', BACKUP_DIR);
      await initializeBackupDirectory();
      logger.log('[Backup] Backup directory initialized');

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

      // Clean up old automatic backups if needed
      if (isAutomatic) {
        logger.log('[Backup] Cleaning up old automatic backups...');
        await this.cleanupOldAutoBackups();
      }

      logger.log('[Backup] Backup created successfully:', metadata.id);
      return metadata;
    } catch (error) {
      logger.error('[Backup] FAILED to create backup:', error);
      logger.error('[Backup] Error type:', typeof error);
      logger.error('[Backup] Error details:', JSON.stringify(error, null, 2));
      throw new Error('Failed to create backup: ' + (error as Error).message);
    }
  }

  async listBackups(): Promise<BackupMetadata[]> {
    try {
      await initializeBackupDirectory();

      const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
      if (!dirInfo.exists) {
        return [];
      }

      const files = await FileSystem.readDirectoryAsync(BACKUP_DIR);
      const backups: BackupMetadata[] = [];

      for (const file of files) {
        try {
          // Handle snapshot backups (.db files with .meta.json sidecar)
          // Metadata sidecar pattern: For each backup_xyz.db file, we store a backup_xyz.meta.json
          // containing episode/medication counts, schema version, and file size for quick display
          // without needing to open the database file
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
              const filePath = BACKUP_DIR + file;
              const fileInfo = await FileSystem.getInfoAsync(filePath);
              const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

              backups.push({
                id: backupId,
                timestamp: 0, // Unknown
                version: buildInfo.version,
                schemaVersion: 0, // Unknown
                episodeCount: 0,
                medicationCount: 0,
                fileName: file,
                fileSize,
                backupType: 'snapshot',
              });
            }
          }
          // Handle JSON backups (legacy or user exports)
          else if (file.endsWith('.json') && !file.endsWith('.meta.json')) {
            const filePath = BACKUP_DIR + file;
            const content = await FileSystem.readAsStringAsync(filePath);
            const backupData: BackupData = JSON.parse(content);

            // Validate backup metadata - CRITICAL for data integrity
            if (!backupData || !validateBackupMetadata(backupData.metadata)) {
              logger.warn(`[Backup] Skipping invalid backup file: ${file} (invalid or missing metadata)`);
              continue;
            }

            const fileInfo = await FileSystem.getInfoAsync(filePath);
            const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

            const metadata: BackupMetadata = {
              ...backupData.metadata,
              fileName: file,
              fileSize,
              backupType: 'json',
            };

            backups.push(metadata);
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
        await this.restoreJsonBackup(backupId);
      }

      logger.log('[Restore] Backup restored successfully');
    } catch (error) {
      logger.error('[Restore] FAILED to restore backup:', error);
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

      const backupPath = getBackupPath(backupId, 'snapshot');
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
        const { getDatabase } = await import('../database/db');
        const currentDb = await getDatabase();
        await currentDb.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
        logger.log('[Restore] WAL checkpointed successfully');
      } catch (error) {
        logger.warn('[Restore] WAL checkpoint failed (database may already be closed):', error);
      }

      // Close current database connection
      const { closeDatabase } = await import('../database/db');
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
      const { getDatabase } = await import('../database/db');
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
      throw error;
    }
  }

  /**
   * Restore from a JSON backup (legacy format)
   * This recreates the database from exported JSON data
   *
   * TODO: Remove this code path after 1 month migration period (added 2025-10-18)
   * This is only needed for backward compatibility with JSON backups created before
   * the snapshot-based backup system. After users have migrated to snapshot backups,
   * this can be safely removed to simplify the codebase.
   */
  private async restoreJsonBackup(backupId: string): Promise<void> {
    try {
      logger.log('[Restore] Restoring from JSON backup');
      const backupPath = getBackupPath(backupId, 'json');
      const content = await FileSystem.readAsStringAsync(backupPath);
      const backupData: BackupData = JSON.parse(content);

      // Validate backup structure
      if (!backupData.metadata || !backupData.episodes || !backupData.medications) {
        throw new Error('Invalid backup file format - missing required fields');
      }

      // Handle old backups without schemaSQL (backward compatibility)
      const isOldBackup = !backupData.schemaSQL;
      if (isOldBackup) {
        logger.warn('[Restore] Old backup format detected (no schemaSQL) - using legacy restore method');
      }

      // Check schema version compatibility
      const currentSchemaVersion = await migrationRunner.getCurrentVersion();
      const backupSchemaVersion = backupData.metadata.schemaVersion;

      logger.log('[Restore] Current schema version:', currentSchemaVersion);
      logger.log('[Restore] Backup schema version:', backupSchemaVersion);

      if (backupSchemaVersion > currentSchemaVersion) {
        throw new Error(
          `Cannot restore backup from newer schema version ${backupSchemaVersion} to older version ${currentSchemaVersion}. ` +
          `Please update the app to the latest version before restoring this backup.`
        );
      }

      if (isOldBackup) {
        // Legacy restore method for old backups without schemaSQL
        // Clear existing data and insert into current schema, preserving IDs
        logger.log('[Restore] Using legacy restore (delete data, insert into current schema with ID preservation)');
        await episodeRepository.deleteAll();
        await episodeNoteRepository.deleteAll();
        await medicationRepository.deleteAll();
        await medicationDoseRepository.deleteAll();
        await medicationScheduleRepository.deleteAll();

        // Get database instance for raw SQL inserts
        const db = await import('../database/db').then(m => m.getDatabase());

        logger.log('[Restore] Inserting episodes...');
        for (const episode of backupData.episodes) {
          await this.insertEpisodeWithId(episode, db);
        }

        if (backupData.episodeNotes) {
          logger.log('[Restore] Inserting episode notes...');
          for (const note of backupData.episodeNotes) {
            await this.insertEpisodeNoteWithId(note, db);
          }
        }

        if (backupData.intensityReadings) {
          logger.log('[Restore] Inserting intensity readings...');
          for (const reading of backupData.intensityReadings) {
            await this.insertIntensityReadingWithId(reading, db);
          }
        }

        if (backupData.dailyStatusLogs) {
          logger.log('[Restore] Inserting daily status logs...');
          for (const status of backupData.dailyStatusLogs) {
            await this.insertDailyStatusWithId(status, db);
          }
        }

        logger.log('[Restore] Inserting medications...');
        for (const medication of backupData.medications) {
          await this.insertMedicationWithId(medication, db);
        }

        logger.log('[Restore] Inserting medication doses...');
        for (const dose of backupData.medicationDoses) {
          await this.insertMedicationDoseWithId(dose, db);
        }

        logger.log('[Restore] Inserting medication schedules...');
        for (const schedule of backupData.medicationSchedules) {
          await this.insertMedicationScheduleWithId(schedule, db);
        }

        logger.log('[Restore] Legacy restore complete');
      } else {
        // New restore method: restore to backup's schema version, then run migrations
        logger.log('[Restore] Using new restore (recreate schema from backup, then migrate)');

        // Get database instance
        const db = await import('../database/db').then(m => m.getDatabase());

        // Drop all tables except schema_version (which is managed by migration runner)
        logger.log('[Restore] Dropping existing tables...');
        const tables = await db.getAllAsync<{ name: string }>(
          `SELECT name FROM sqlite_master
           WHERE type = 'table'
           AND name NOT LIKE 'sqlite_%'
           AND name != 'schema_version'`
        );

        for (const { name } of tables) {
          logger.log('[Restore] Dropping table:', name);
          await db.execAsync(`DROP TABLE IF EXISTS ${name}`);
        }

        // Drop all indexes
        logger.log('[Restore] Dropping existing indexes...');
        const indexes = await db.getAllAsync<{ name: string }>(
          `SELECT name FROM sqlite_master
           WHERE type = 'index'
           AND name NOT LIKE 'sqlite_%'`
        );

        for (const { name } of indexes) {
          logger.log('[Restore] Dropping index:', name);
          await db.execAsync(`DROP INDEX IF EXISTS ${name}`);
        }

        // Execute schema SQL from backup to recreate tables at backup's schema version
        logger.log('[Restore] Recreating tables from backup schema...');
        if (!backupData.schemaSQL) {
          throw new Error('Backup schema SQL is missing - cannot restore');
        }
        await db.execAsync(backupData.schemaSQL);
        logger.log('[Restore] Tables recreated successfully');

        // Set schema_version to backup's version
        logger.log('[Restore] Setting schema version to:', backupSchemaVersion);
        await db.runAsync(
          'UPDATE schema_version SET version = ?, updated_at = ? WHERE id = 1',
          [backupSchemaVersion, Date.now()]
        );

        // Insert backup data using raw SQL to preserve IDs
        logger.log('[Restore] Inserting episodes...');
        for (const episode of backupData.episodes) {
          await this.insertEpisodeWithId(episode, db);
        }

        if (backupData.episodeNotes) {
          logger.log('[Restore] Inserting episode notes...');
          for (const note of backupData.episodeNotes) {
            await this.insertEpisodeNoteWithId(note, db);
          }
        }

        if (backupData.intensityReadings) {
          logger.log('[Restore] Inserting intensity readings...');
          for (const reading of backupData.intensityReadings) {
            await this.insertIntensityReadingWithId(reading, db);
          }
        }

        if (backupData.dailyStatusLogs) {
          logger.log('[Restore] Inserting daily status logs...');
          for (const status of backupData.dailyStatusLogs) {
            await this.insertDailyStatusWithId(status, db);
          }
        }

        logger.log('[Restore] Inserting medications...');
        for (const medication of backupData.medications) {
          await this.insertMedicationWithId(medication, db);
        }

        logger.log('[Restore] Inserting medication doses...');
        for (const dose of backupData.medicationDoses) {
          await this.insertMedicationDoseWithId(dose, db);
        }

        logger.log('[Restore] Inserting medication schedules...');
        for (const schedule of backupData.medicationSchedules) {
          await this.insertMedicationScheduleWithId(schedule, db);
        }

        logger.log('[Restore] Data insertion complete');

        // Run migrations from backup version to current version
        if (backupSchemaVersion < currentSchemaVersion) {
          logger.log('[Restore] Running migrations from version', backupSchemaVersion, 'to', currentSchemaVersion);
          await migrationRunner.runMigrations();
          logger.log('[Restore] Migrations completed successfully');
        } else {
          logger.log('[Restore] No migrations needed - backup is at current version');
        }
      }

      logger.log('[Restore] JSON backup restored successfully');
    } catch (error) {
      logger.error('[Restore] FAILED to restore JSON backup:', error);
      throw error;
    }
  }

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
            const dbPath = getBackupPath(backupId, 'snapshot');
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
            const dbPath = getBackupPath(backupId, 'snapshot');
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

  /**
   * Export current database as JSON for sharing with healthcare providers
   * Creates temporary file and immediately prompts user to save/share
   * Does NOT store the file in backups directory - this is for data export, not backup
   */
  async exportDataForSharing(): Promise<void> {
    try {
      logger.log('[Export] Creating JSON export for sharing...');

      // Get current database instance
      const db = await import('../database/db').then(m => m.getDatabase());

      // Gather all data
      logger.log('[Export] Fetching all data...');
      const episodes = await episodeRepository.getAll(50, 0, db);
      const medications = await medicationRepository.getAll(db);
      const medicationDoses = await medicationDoseRepository.getAll(100, db);

      const episodeNotes: EpisodeNote[] = [];
      for (const ep of episodes) {
        const notes = await episodeNoteRepository.getByEpisodeId(ep.id, db);
        episodeNotes.push(...notes);
      }

      const intensityReadings: IntensityReading[] = [];
      for (const ep of episodes) {
        const readings = await intensityRepository.getByEpisodeId(ep.id, db);
        intensityReadings.push(...readings);
      }

      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const today = new Date();
      const startDate = twoYearsAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];
      const dailyStatusLogs = await dailyStatusRepository.getDateRange(startDate, endDate, db);

      const medicationSchedules: MedicationSchedule[] = [];
      for (const med of medications) {
        const schedules = await medicationScheduleRepository.getByMedicationId(med.id, db);
        medicationSchedules.push(...schedules);
      }

      const schemaVersion = await migrationRunner.getCurrentVersion();

      // Create export data structure
      // Note: schemaSQL omitted because this is for data sharing, not backup/restore
      const exportData: BackupData = {
        metadata: {
          id: `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          version: buildInfo.version,
          schemaVersion,
          episodeCount: episodes.length,
          medicationCount: medications.length,
        },
        schemaSQL: '', // Not needed for data sharing - only for backup/restore
        episodes,
        episodeNotes,
        intensityReadings,
        dailyStatusLogs,
        medications,
        medicationDoses,
        medicationSchedules,
      };

      // Create temporary file for sharing (in cache directory, will be auto-cleaned)
      const tempFileName = `migralog_export_${new Date().toISOString().split('T')[0]}.json`;
      const tempFilePath = `${FileSystem.cacheDirectory}${tempFileName}`;

      logger.log('[Export] Writing temporary JSON file...');
      await FileSystem.writeAsStringAsync(tempFilePath, JSON.stringify(exportData, null, 2));
      logger.log('[Export] Temporary file created at:', tempFilePath);

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sharing is not available on this device');
      }

      // Share the file (user can save to Files, email, etc.)
      logger.log('[Export] Opening share dialog...');
      await Sharing.shareAsync(tempFilePath, {
        mimeType: 'application/json',
        dialogTitle: 'Export MigraLog Data',
        UTI: 'public.json',
      });

      logger.log('[Export] JSON export completed successfully');
    } catch (error) {
      logger.error('[Export] Failed to export data as JSON:', error);
      throw new Error('Failed to export data: ' + (error as Error).message);
    }
  }

  async exportBackup(backupId: string): Promise<void> {
    try {
      // Get metadata to determine backup type
      const metadata = await getBackupMetadata(backupId);
      if (!metadata) {
        throw new Error('Backup not found');
      }

      const backupPath = getBackupPath(backupId, metadata.backupType);
      const fileInfo = await FileSystem.getInfoAsync(backupPath);

      if (!fileInfo.exists) {
        throw new Error('Backup file not found');
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sharing is not available on this device');
      }

      const mimeType = metadata.backupType === 'snapshot' ? 'application/x-sqlite3' : 'application/json';
      const uti = metadata.backupType === 'snapshot' ? 'public.database' : 'public.json';

      await Sharing.shareAsync(backupPath, {
        mimeType,
        dialogTitle: 'Export MigraLog Backup',
        UTI: uti,
      });
    } catch (error) {
      logger.error('Failed to export backup:', error);
      throw new Error('Failed to export backup: ' + (error as Error).message);
    }
  }

  async importBackup(): Promise<BackupMetadata> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'application/x-sqlite3', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        throw new Error('Import cancelled');
      }

      const fileUri = result.assets[0].uri;
      const fileName = result.assets[0].name || '';

      // Detect file type based on extension
      const isDbFile = fileName.endsWith('.db') || fileName.endsWith('.sqlite') || fileName.endsWith('.sqlite3');

      if (isDbFile) {
        // For .db files, we need to handle them differently
        // Copy the .db file as a backup snapshot
        const backupId = generateBackupId();
        const backupPath = getBackupPath(backupId, 'snapshot');

        await FileSystem.copyAsync({
          from: fileUri,
          to: backupPath,
        });

        // Get file info to determine size
        const fileInfo = await FileSystem.getInfoAsync(backupPath);
        const fileSize = fileInfo.exists && !fileInfo.isDirectory ? fileInfo.size : 0;

        // Create metadata for the snapshot backup
        const metadata: BackupMetadata = {
          id: backupId,
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: await migrationRunner.getCurrentVersion(),
          episodeCount: 0, // We can't easily count without opening the DB
          medicationCount: 0,
          fileSize,
          fileName: fileName,
          backupType: 'snapshot',
        };

        const metadataPath = getMetadataPath(backupId);
        await FileSystem.writeAsStringAsync(metadataPath, JSON.stringify(metadata, null, 2));

        logger.log('[Import] Database snapshot imported successfully:', backupId);
        return metadata;
      }

      // Handle JSON export files
      const content = await FileSystem.readAsStringAsync(fileUri);
      let backupData: unknown;

      try {
        backupData = JSON.parse(content);
      } catch (parseError) {
        logger.error('[Import] Failed to parse backup JSON:', parseError);
        throw new Error('Invalid backup file: corrupted or not valid JSON');
      }

      // Validate backup structure - CRITICAL for data integrity
      if (!validateBackupData(backupData)) {
        throw new Error('Invalid backup file format: missing or invalid required fields. Please ensure the backup file is complete and not corrupted.');
      }

      // If imported backup doesn't have schemaSQL (old format), add current schema
      if (!backupData.schemaSQL) {
        logger.log('[Import] Old backup format detected, adding current schema SQL');
        backupData.schemaSQL = await this.exportSchemaSQL();
        backupData.metadata.schemaVersion = await migrationRunner.getCurrentVersion();
      }

      // Create a new backup with imported data
      const backupId = generateBackupId();
      const backupPath = getBackupPath(backupId, 'json');

      // Update metadata with new ID and timestamp
      backupData.metadata.id = backupId;
      backupData.metadata.timestamp = Date.now();

      await FileSystem.writeAsStringAsync(backupPath, JSON.stringify(backupData, null, 2));

      const fileInfo = await FileSystem.getInfoAsync(backupPath);
      const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

      return {
        ...backupData.metadata,
        fileName: `${backupId}.json`,
        fileSize,
        backupType: 'json',
      };
    } catch (error) {
      logger.error('Failed to import backup:', error);
      throw new Error('Failed to import backup: ' + (error as Error).message);
    }
  }

  async deleteBackup(backupId: string): Promise<void> {
    try {
      logger.log('[Delete] Attempting to delete backup:', backupId);

      // Try to delete all possible file types (snapshot, json, metadata)
      // This handles corrupted backups or backups with missing/invalid metadata
      const snapshotPath = getBackupPath(backupId, 'snapshot');
      const jsonPath = getBackupPath(backupId, 'json');
      const metadataPath = getMetadataPath(backupId);

      // Check which files actually exist
      const snapshotExists = await FileSystem.getInfoAsync(snapshotPath);
      const jsonExists = await FileSystem.getInfoAsync(jsonPath);
      const metadataExists = await FileSystem.getInfoAsync(metadataPath);

      let deletedCount = 0;

      // Delete snapshot file if it exists
      if (snapshotExists.exists) {
        await FileSystem.deleteAsync(snapshotPath);
        logger.log('[Delete] Deleted snapshot file:', snapshotPath);
        deletedCount++;
      }

      // Delete JSON file if it exists
      if (jsonExists.exists) {
        await FileSystem.deleteAsync(jsonPath);
        logger.log('[Delete] Deleted JSON file:', jsonPath);
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
   * Insert data using raw SQL to preserve original IDs from backup
   * This is critical for maintaining foreign key relationships during restore
   */
  private async insertEpisodeWithId(episode: Episode, db: SQLite.SQLiteDatabase): Promise<void> {
    await db.runAsync(
      `INSERT INTO episodes (
        id, start_time, end_time, locations, qualities, symptoms, triggers, notes,
        latitude, longitude, location_accuracy, location_timestamp, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        episode.id,
        episode.startTime,
        episode.endTime || null,
        JSON.stringify(episode.locations),
        JSON.stringify(episode.qualities),
        JSON.stringify(episode.symptoms),
        JSON.stringify(episode.triggers),
        episode.notes || null,
        episode.location?.latitude || null,
        episode.location?.longitude || null,
        episode.location?.accuracy || null,
        episode.location?.timestamp || null,
        episode.createdAt,
        episode.updatedAt,
      ]
    );
  }

  private async insertEpisodeNoteWithId(note: EpisodeNote, db: SQLite.SQLiteDatabase): Promise<void> {
    await db.runAsync(
      `INSERT INTO episode_notes (id, episode_id, timestamp, note, created_at) VALUES (?, ?, ?, ?, ?)`,
      [note.id, note.episodeId, note.timestamp, note.note, note.createdAt]
    );
  }

  private async insertIntensityReadingWithId(reading: IntensityReading, db: SQLite.SQLiteDatabase): Promise<void> {
    await db.runAsync(
      `INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [reading.id, reading.episodeId, reading.timestamp, reading.intensity, reading.createdAt, reading.updatedAt]
    );
  }

  private async insertDailyStatusWithId(status: DailyStatusLog, db: SQLite.SQLiteDatabase): Promise<void> {
    await db.runAsync(
      `INSERT INTO daily_status_logs (
        id, date, status, status_type, notes, prompted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        status.id,
        status.date,
        status.status,
        status.statusType || null,
        status.notes || null,
        status.prompted ? 1 : 0,
        status.createdAt,
        status.updatedAt,
      ]
    );
  }

  private async insertMedicationWithId(medication: Medication, db: SQLite.SQLiteDatabase): Promise<void> {
    await db.runAsync(
      `INSERT INTO medications (
        id, name, type, dosage_amount, dosage_unit, default_quantity, schedule_frequency,
        photo_uri, active, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        medication.id,
        medication.name,
        medication.type,
        medication.dosageAmount,
        medication.dosageUnit,
        medication.defaultQuantity || null,
        medication.scheduleFrequency || null,
        medication.photoUri || null,
        medication.active ? 1 : 0,
        medication.notes || null,
        medication.createdAt,
        medication.updatedAt,
      ]
    );
  }

  private async insertMedicationDoseWithId(dose: MedicationDose, db: SQLite.SQLiteDatabase): Promise<void> {
    await db.runAsync(
      `INSERT INTO medication_doses (
        id, medication_id, timestamp, quantity, status, episode_id, effectiveness_rating,
        time_to_relief, side_effects, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dose.id,
        dose.medicationId,
        dose.timestamp,
        dose.quantity,
        dose.status || 'taken',
        dose.episodeId || null,
        dose.effectivenessRating || null,
        dose.timeToRelief || null,
        dose.sideEffects ? JSON.stringify(dose.sideEffects) : null,
        dose.notes || null,
        dose.createdAt,
        dose.updatedAt,
      ]
    );
  }

  private async insertMedicationScheduleWithId(schedule: MedicationSchedule, db: SQLite.SQLiteDatabase): Promise<void> {
    await db.runAsync(
      `INSERT INTO medication_schedules (
        id, medication_id, time, dosage, enabled, notification_id, reminder_enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        schedule.id,
        schedule.medicationId,
        schedule.time,
        schedule.dosage,
        schedule.enabled ? 1 : 0,
        schedule.notificationId || null,
        schedule.reminderEnabled !== undefined ? (schedule.reminderEnabled ? 1 : 0) : 1,
      ]
    );
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
        database = await import('../database/db').then(m => m.getDatabase());
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
        database = await import('../database/db').then(m => m.getDatabase());
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

  private async exportSchemaSQL(db?: SQLite.SQLiteDatabase): Promise<string> {
    try {
      // Get database instance
      let database: SQLite.SQLiteDatabase;
      if (db) {
        database = db;
      } else {
        database = await import('../database/db').then(m => m.getDatabase());
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
   *
   * Weekly backups are stored using the same automatic backup system,
   * so they're included in the MAX_AUTO_BACKUPS retention policy (keeps last 7)
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

  formatFileSize = formatFileSize;
  formatDate = formatDate;

  /**
   * Export the raw SQLite database file
   * This creates a complete binary copy of the database
   */
  async exportDatabaseFile(): Promise<void> {
    try {
      const dbPath = `${FileSystem.documentDirectory}SQLite/migralog.db`;
      const dbInfo = await FileSystem.getInfoAsync(dbPath);

      if (!dbInfo.exists) {
        throw new Error('Database file not found');
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sharing is not available on this device');
      }

      // Create a timestamped copy for export
      const timestamp = Date.now();
      const exportPath = `${FileSystem.cacheDirectory}migralog_${timestamp}.db`;

      await FileSystem.copyAsync({
        from: dbPath,
        to: exportPath,
      });

      await Sharing.shareAsync(exportPath, {
        mimeType: 'application/x-sqlite3',
        dialogTitle: 'Export MigraLog Database',
        UTI: 'public.database',
      });

      // Clean up the temporary copy
      await FileSystem.deleteAsync(exportPath, { idempotent: true });
    } catch (error) {
      logger.error('Failed to export database file:', error);
      throw new Error('Failed to export database file: ' + (error as Error).message);
    }
  }

  /**
   * Import a raw SQLite database file
   * WARNING: This will replace the entire database!
   */
  async importDatabaseFile(): Promise<void> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/x-sqlite3', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        throw new Error('Import cancelled');
      }

      const fileUri = result.assets[0].uri;
      const dbPath = `${FileSystem.documentDirectory}SQLite/migralog.db`;

      // Close the current database connection
      const { closeDatabase } = await import('../database/db');
      await closeDatabase();

      // Backup the current database before replacing it
      const backupPath = `${FileSystem.documentDirectory}SQLite/migralog_backup_${Date.now()}.db`;
      const currentDbInfo = await FileSystem.getInfoAsync(dbPath);
      if (currentDbInfo.exists) {
        await FileSystem.copyAsync({
          from: dbPath,
          to: backupPath,
        });
        logger.log('Current database backed up to:', backupPath);
      }

      // Copy the imported file to the database location
      await FileSystem.copyAsync({
        from: fileUri,
        to: dbPath,
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

export const backupServiceImpl = new BackupServiceImpl();
