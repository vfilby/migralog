import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { logger } from '../utils/logger';
import { episodeRepository, episodeNoteRepository } from '../database/episodeRepository';
import { medicationRepository, medicationDoseRepository, medicationScheduleRepository } from '../database/medicationRepository';
import { migrationRunner } from '../database/migrations';
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
  DB_PATH,
  getBackupPath,
  getMetadataPath,
  validateBackupMetadata,
} from './backupUtils';

class RestoreService {
  /**
   * Validate backup data structure
   * Ensures critical fields are present and valid
   */
  private validateBackupData(backupData: unknown): backupData is BackupData {
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

  async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
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

  async restoreBackup(backupId: string): Promise<void> {
    try {
      logger.log('[Restore] Starting backup restore:', backupId);

      // Get metadata to determine backup type
      const metadata = await this.getBackupMetadata(backupId);
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
      const { closeDatabase } = await import('../database/db');
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

export const restoreService = new RestoreService();
