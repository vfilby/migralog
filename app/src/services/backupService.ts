import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { episodeRepository, episodeNoteRepository, intensityRepository } from '../database/episodeRepository';
import { medicationRepository, medicationDoseRepository, medicationScheduleRepository } from '../database/medicationRepository';
import { dailyStatusRepository } from '../database/dailyStatusRepository';
import { migrationRunner } from '../database/migrations';
import { Episode, Medication, MedicationDose, MedicationSchedule, EpisodeNote, IntensityReading, DailyStatusLog } from '../models/types';

export interface BackupMetadata {
  id: string;
  timestamp: number;
  version: string;
  schemaVersion: number;
  episodeCount: number;
  medicationCount: number;
  fileSize: number;
  fileName: string;
}

export interface BackupData {
  metadata: Omit<BackupMetadata, 'fileSize' | 'fileName'>;
  schemaSQL?: string; // Complete CREATE TABLE statements for the schema at backup time (optional for backward compatibility)
  episodes: Episode[];
  episodeNotes?: EpisodeNote[]; // Optional for backward compatibility
  intensityReadings?: IntensityReading[]; // Optional for backward compatibility
  dailyStatusLogs?: DailyStatusLog[]; // Optional for backward compatibility
  medications: Medication[];
  medicationDoses: MedicationDose[];
  medicationSchedules: MedicationSchedule[];
}

const BACKUP_DIR = `${FileSystem.documentDirectory}backups/`;
const MAX_AUTO_BACKUPS = 7; // Keep last 7 automatic backups (weekly backups for ~2 months)
const WEEKLY_BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const APP_VERSION = '1.0.0'; // TODO: Get from app.json
const LAST_WEEKLY_BACKUP_KEY = '@MigraLog:lastWeeklyBackup';

class BackupService {
  async initialize(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
    }
  }

  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getBackupPath(backupId: string): string {
    return `${BACKUP_DIR}${backupId}.json`;
  }

  async createBackup(isAutomatic: boolean = false, db?: SQLite.SQLiteDatabase): Promise<BackupMetadata> {
    try {
      console.log('[Backup] Starting backup creation, isAutomatic:', isAutomatic);
      console.log('[Backup] Backup directory:', BACKUP_DIR);
      await this.initialize();
      console.log('[Backup] Backup directory initialized');

      // Gather all data - pass db to avoid circular dependency during migrations
      console.log('[Backup] Fetching episodes...');
      const episodes = await episodeRepository.getAll(50, 0, db);
      console.log('[Backup] Fetched', episodes.length, 'episodes');

      console.log('[Backup] Fetching medications...');
      const medications = await medicationRepository.getAll(db);
      console.log('[Backup] Fetched', medications.length, 'medications');

      console.log('[Backup] Fetching medication doses...');
      const medicationDoses = await medicationDoseRepository.getAll(100, db);
      console.log('[Backup] Fetched', medicationDoses.length, 'doses');

      // Gather all episode notes
      console.log('[Backup] Fetching episode notes...');
      const episodeNotes: EpisodeNote[] = [];
      for (const ep of episodes) {
        const notes = await episodeNoteRepository.getByEpisodeId(ep.id, db);
        episodeNotes.push(...notes);
      }
      console.log('[Backup] Fetched', episodeNotes.length, 'episode notes');

      // Gather all intensity readings
      console.log('[Backup] Fetching intensity readings...');
      const intensityReadings: IntensityReading[] = [];
      for (const ep of episodes) {
        const readings = await intensityRepository.getByEpisodeId(ep.id, db);
        intensityReadings.push(...readings);
      }
      console.log('[Backup] Fetched', intensityReadings.length, 'intensity readings');

      // Gather all daily status logs (get last 2 years of data)
      console.log('[Backup] Fetching daily status logs...');
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const today = new Date();
      const startDate = twoYearsAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];
      const dailyStatusLogs = await dailyStatusRepository.getDateRange(startDate, endDate, db);
      console.log('[Backup] Fetched', dailyStatusLogs.length, 'daily status logs');

      // Gather all medication schedules
      console.log('[Backup] Fetching medication schedules...');
      const medicationSchedules: MedicationSchedule[] = [];
      for (const med of medications) {
        const schedules = await medicationScheduleRepository.getByMedicationId(med.id, db);
        medicationSchedules.push(...schedules);
      }
      console.log('[Backup] Fetched', medicationSchedules.length, 'schedules');

      console.log('[Backup] Generating backup ID...');
      const backupId = this.generateBackupId();
      console.log('[Backup] Backup ID:', backupId);

      // Get actual database schema version
      console.log('[Backup] Getting current schema version...');
      const schemaVersion = await migrationRunner.getCurrentVersion();
      console.log('[Backup] Current schema version:', schemaVersion);

      // Export complete schema SQL from database
      console.log('[Backup] Exporting schema SQL...');
      const schemaSQL = await this.exportSchemaSQL(db);
      console.log('[Backup] Schema SQL exported, length:', schemaSQL.length);

      const backupData: BackupData = {
        metadata: {
          id: backupId,
          timestamp: Date.now(),
          version: APP_VERSION,
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

      const backupPath = this.getBackupPath(backupId);
      console.log('[Backup] Backup path:', backupPath);

      console.log('[Backup] Stringifying backup data...');
      const backupJson = JSON.stringify(backupData, null, 2);
      console.log('[Backup] Backup JSON size:', backupJson.length, 'characters');

      console.log('[Backup] Writing backup file...');
      await FileSystem.writeAsStringAsync(backupPath, backupJson);
      console.log('[Backup] Backup file written successfully');

      console.log('[Backup] Getting file info...');
      const fileInfo = await FileSystem.getInfoAsync(backupPath);
      const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;
      console.log('[Backup] File size:', fileSize, 'bytes');

      const metadata: BackupMetadata = {
        ...backupData.metadata,
        fileName: `${backupId}.json`,
        fileSize,
      };

      // Clean up old automatic backups if needed
      if (isAutomatic) {
        console.log('[Backup] Cleaning up old automatic backups...');
        await this.cleanupOldAutoBackups();
      }

      console.log('[Backup] Backup created successfully:', metadata.id);
      return metadata;
    } catch (error) {
      console.error('[Backup] FAILED to create backup:', error);
      console.error('[Backup] Error type:', typeof error);
      console.error('[Backup] Error details:', JSON.stringify(error, null, 2));
      throw new Error('Failed to create backup: ' + (error as Error).message);
    }
  }

  async listBackups(): Promise<BackupMetadata[]> {
    try {
      await this.initialize();

      const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
      if (!dirInfo.exists) {
        return [];
      }

      const files = await FileSystem.readDirectoryAsync(BACKUP_DIR);
      const backups: BackupMetadata[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = BACKUP_DIR + file;
            const content = await FileSystem.readAsStringAsync(filePath);
            const backupData: BackupData = JSON.parse(content);

            const fileInfo = await FileSystem.getInfoAsync(filePath);
            const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

            backups.push({
              ...backupData.metadata,
              fileName: file,
              fileSize,
            });
          } catch (error) {
            console.error(`Failed to read backup ${file}:`, error);
          }
        }
      }

      // Sort by timestamp, newest first
      return backups.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }

  async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    try {
      const backupPath = this.getBackupPath(backupId);
      const fileInfo = await FileSystem.getInfoAsync(backupPath);

      if (!fileInfo.exists) {
        return null;
      }

      const content = await FileSystem.readAsStringAsync(backupPath);
      const backupData: BackupData = JSON.parse(content);
      const fileSize = 'size' in fileInfo ? fileInfo.size : 0;

      return {
        ...backupData.metadata,
        fileName: `${backupId}.json`,
        fileSize,
      };
    } catch (error) {
      console.error('Failed to get backup metadata:', error);
      return null;
    }
  }

  async restoreBackup(backupId: string): Promise<void> {
    try {
      console.log('[Restore] Starting backup restore:', backupId);
      const backupPath = this.getBackupPath(backupId);
      const content = await FileSystem.readAsStringAsync(backupPath);
      const backupData: BackupData = JSON.parse(content);

      // Validate backup structure
      if (!backupData.metadata || !backupData.episodes || !backupData.medications) {
        throw new Error('Invalid backup file format - missing required fields');
      }

      // Handle old backups without schemaSQL (backward compatibility)
      const isOldBackup = !backupData.schemaSQL;
      if (isOldBackup) {
        console.warn('[Restore] Old backup format detected (no schemaSQL) - using legacy restore method');
      }

      // Check schema version compatibility
      const currentSchemaVersion = await migrationRunner.getCurrentVersion();
      const backupSchemaVersion = backupData.metadata.schemaVersion;

      console.log('[Restore] Current schema version:', currentSchemaVersion);
      console.log('[Restore] Backup schema version:', backupSchemaVersion);

      if (backupSchemaVersion > currentSchemaVersion) {
        throw new Error(
          `Cannot restore backup from newer schema version ${backupSchemaVersion} to older version ${currentSchemaVersion}. ` +
          `Please update the app to the latest version before restoring this backup.`
        );
      }

      if (isOldBackup) {
        // Legacy restore method for old backups without schemaSQL
        // Clear existing data and insert into current schema, preserving IDs
        console.log('[Restore] Using legacy restore (delete data, insert into current schema with ID preservation)');
        await episodeRepository.deleteAll();
        await episodeNoteRepository.deleteAll();
        await medicationRepository.deleteAll();
        await medicationDoseRepository.deleteAll();
        await medicationScheduleRepository.deleteAll();

        // Get database instance for raw SQL inserts
        const db = await import('../database/db').then(m => m.getDatabase());

        console.log('[Restore] Inserting episodes...');
        for (const episode of backupData.episodes) {
          await this.insertEpisodeWithId(episode, db);
        }

        if (backupData.episodeNotes) {
          console.log('[Restore] Inserting episode notes...');
          for (const note of backupData.episodeNotes) {
            await this.insertEpisodeNoteWithId(note, db);
          }
        }

        if (backupData.intensityReadings) {
          console.log('[Restore] Inserting intensity readings...');
          for (const reading of backupData.intensityReadings) {
            await this.insertIntensityReadingWithId(reading, db);
          }
        }

        if (backupData.dailyStatusLogs) {
          console.log('[Restore] Inserting daily status logs...');
          for (const status of backupData.dailyStatusLogs) {
            await this.insertDailyStatusWithId(status, db);
          }
        }

        console.log('[Restore] Inserting medications...');
        for (const medication of backupData.medications) {
          await this.insertMedicationWithId(medication, db);
        }

        console.log('[Restore] Inserting medication doses...');
        for (const dose of backupData.medicationDoses) {
          await this.insertMedicationDoseWithId(dose, db);
        }

        console.log('[Restore] Inserting medication schedules...');
        for (const schedule of backupData.medicationSchedules) {
          await this.insertMedicationScheduleWithId(schedule, db);
        }

        console.log('[Restore] Legacy restore complete');
      } else {
        // New restore method: restore to backup's schema version, then run migrations
        console.log('[Restore] Using new restore (recreate schema from backup, then migrate)');

        // Get database instance
        const db = await import('../database/db').then(m => m.getDatabase());

        // Drop all tables except schema_version (which is managed by migration runner)
        console.log('[Restore] Dropping existing tables...');
        const tables = await db.getAllAsync<{ name: string }>(
          `SELECT name FROM sqlite_master
           WHERE type = 'table'
           AND name NOT LIKE 'sqlite_%'
           AND name != 'schema_version'`
        );

        for (const { name } of tables) {
          console.log('[Restore] Dropping table:', name);
          await db.execAsync(`DROP TABLE IF EXISTS ${name}`);
        }

        // Drop all indexes
        console.log('[Restore] Dropping existing indexes...');
        const indexes = await db.getAllAsync<{ name: string }>(
          `SELECT name FROM sqlite_master
           WHERE type = 'index'
           AND name NOT LIKE 'sqlite_%'`
        );

        for (const { name } of indexes) {
          console.log('[Restore] Dropping index:', name);
          await db.execAsync(`DROP INDEX IF EXISTS ${name}`);
        }

        // Execute schema SQL from backup to recreate tables at backup's schema version
        console.log('[Restore] Recreating tables from backup schema...');
        if (!backupData.schemaSQL) {
          throw new Error('Backup schema SQL is missing - cannot restore');
        }
        await db.execAsync(backupData.schemaSQL);
        console.log('[Restore] Tables recreated successfully');

        // Set schema_version to backup's version
        console.log('[Restore] Setting schema version to:', backupSchemaVersion);
        await db.runAsync(
          'UPDATE schema_version SET version = ?, updated_at = ? WHERE id = 1',
          [backupSchemaVersion, Date.now()]
        );

        // Insert backup data using raw SQL to preserve IDs
        console.log('[Restore] Inserting episodes...');
        for (const episode of backupData.episodes) {
          await this.insertEpisodeWithId(episode, db);
        }

        if (backupData.episodeNotes) {
          console.log('[Restore] Inserting episode notes...');
          for (const note of backupData.episodeNotes) {
            await this.insertEpisodeNoteWithId(note, db);
          }
        }

        if (backupData.intensityReadings) {
          console.log('[Restore] Inserting intensity readings...');
          for (const reading of backupData.intensityReadings) {
            await this.insertIntensityReadingWithId(reading, db);
          }
        }

        if (backupData.dailyStatusLogs) {
          console.log('[Restore] Inserting daily status logs...');
          for (const status of backupData.dailyStatusLogs) {
            await this.insertDailyStatusWithId(status, db);
          }
        }

        console.log('[Restore] Inserting medications...');
        for (const medication of backupData.medications) {
          await this.insertMedicationWithId(medication, db);
        }

        console.log('[Restore] Inserting medication doses...');
        for (const dose of backupData.medicationDoses) {
          await this.insertMedicationDoseWithId(dose, db);
        }

        console.log('[Restore] Inserting medication schedules...');
        for (const schedule of backupData.medicationSchedules) {
          await this.insertMedicationScheduleWithId(schedule, db);
        }

        console.log('[Restore] Data insertion complete');

        // Run migrations from backup version to current version
        if (backupSchemaVersion < currentSchemaVersion) {
          console.log('[Restore] Running migrations from version', backupSchemaVersion, 'to', currentSchemaVersion);
          await migrationRunner.runMigrations();
          console.log('[Restore] Migrations completed successfully');
        } else {
          console.log('[Restore] No migrations needed - backup is at current version');
        }
      }

      console.log('[Restore] Backup restored successfully');
    } catch (error) {
      console.error('[Restore] FAILED to restore backup:', error);
      throw new Error('Failed to restore backup: ' + (error as Error).message);
    }
  }

  async exportBackup(backupId: string): Promise<void> {
    try {
      const backupPath = this.getBackupPath(backupId);
      const fileInfo = await FileSystem.getInfoAsync(backupPath);

      if (!fileInfo.exists) {
        throw new Error('Backup file not found');
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sharing is not available on this device');
      }

      await Sharing.shareAsync(backupPath, {
        mimeType: 'application/json',
        dialogTitle: 'Export Migraine Tracker Backup',
        UTI: 'public.json',
      });
    } catch (error) {
      console.error('Failed to export backup:', error);
      throw new Error('Failed to export backup: ' + (error as Error).message);
    }
  }

  async importBackup(): Promise<BackupMetadata> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        throw new Error('Import cancelled');
      }

      const fileUri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(fileUri);
      const backupData: BackupData = JSON.parse(content);

      // Validate backup structure
      if (!backupData.metadata || !backupData.episodes || !backupData.medications) {
        throw new Error('Invalid backup file format');
      }

      // If imported backup doesn't have schemaSQL (old format), add current schema
      if (!backupData.schemaSQL) {
        console.log('[Import] Old backup format detected, adding current schema SQL');
        backupData.schemaSQL = await this.exportSchemaSQL();
        backupData.metadata.schemaVersion = await migrationRunner.getCurrentVersion();
      }

      // Create a new backup with imported data
      const backupId = this.generateBackupId();
      const backupPath = this.getBackupPath(backupId);

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
      };
    } catch (error) {
      console.error('Failed to import backup:', error);
      throw new Error('Failed to import backup: ' + (error as Error).message);
    }
  }

  async deleteBackup(backupId: string): Promise<void> {
    try {
      const backupPath = this.getBackupPath(backupId);
      const fileInfo = await FileSystem.getInfoAsync(backupPath);

      if (fileInfo.exists) {
        await FileSystem.deleteAsync(backupPath);
      }
    } catch (error) {
      console.error('Failed to delete backup:', error);
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
        peak_intensity, average_intensity, latitude, longitude,
        location_accuracy, location_timestamp, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        episode.id,
        episode.startTime,
        episode.endTime || null,
        JSON.stringify(episode.locations),
        JSON.stringify(episode.qualities),
        JSON.stringify(episode.symptoms),
        JSON.stringify(episode.triggers),
        episode.notes || null,
        episode.peakIntensity || null,
        episode.averageIntensity || null,
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
      `INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at) VALUES (?, ?, ?, ?, ?)`,
      [reading.id, reading.episodeId, reading.timestamp, reading.intensity, reading.createdAt]
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
        id, name, type, dosage_amount, dosage_unit, default_dosage, schedule_frequency,
        photo_uri, start_date, end_date, active, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        medication.id,
        medication.name,
        medication.type,
        medication.dosageAmount,
        medication.dosageUnit,
        medication.defaultDosage || null,
        medication.scheduleFrequency || null,
        medication.photoUri || null,
        medication.startDate || null,
        medication.endDate || null,
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
        id, medication_id, timestamp, amount, status, episode_id, effectiveness_rating,
        time_to_relief, side_effects, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dose.id,
        dose.medicationId,
        dose.timestamp,
        dose.amount,
        dose.status || 'taken',
        dose.episodeId || null,
        dose.effectivenessRating || null,
        dose.timeToRelief || null,
        dose.sideEffects ? JSON.stringify(dose.sideEffects) : null,
        dose.notes || null,
        dose.createdAt,
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
      console.error('[Backup] Failed to export schema SQL:', error);
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

        console.log(`[Backup] Cleaning up ${toDelete.length} old automatic backups (keeping ${MAX_AUTO_BACKUPS} most recent)`);
        for (const backup of toDelete) {
          await this.deleteBackup(backup.id);
          console.log(`[Backup] Deleted old backup: ${backup.id}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
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
      console.log('[Backup] Checking if weekly backup is needed...');

      // Get last weekly backup timestamp
      const lastBackupTime = await AsyncStorage.getItem(LAST_WEEKLY_BACKUP_KEY);
      const lastBackupTimestamp = lastBackupTime ? parseInt(lastBackupTime, 10) : 0;
      const now = Date.now();
      const timeSinceLastBackup = now - lastBackupTimestamp;

      console.log('[Backup] Last weekly backup:', lastBackupTimestamp ? new Date(lastBackupTimestamp).toISOString() : 'never');
      console.log('[Backup] Time since last backup:', Math.floor(timeSinceLastBackup / (24 * 60 * 60 * 1000)), 'days');

      if (timeSinceLastBackup >= WEEKLY_BACKUP_INTERVAL_MS) {
        console.log('[Backup] Weekly backup needed, creating...');

        // Create automatic backup
        const metadata = await this.createBackup(true, db);

        // Update last backup timestamp
        await AsyncStorage.setItem(LAST_WEEKLY_BACKUP_KEY, now.toString());

        console.log('[Backup] Weekly backup created successfully:', metadata.id);
        return metadata;
      } else {
        const daysUntilNext = Math.ceil((WEEKLY_BACKUP_INTERVAL_MS - timeSinceLastBackup) / (24 * 60 * 60 * 1000));
        console.log(`[Backup] No weekly backup needed. Next backup in ${daysUntilNext} days`);
        return null;
      }
    } catch (error) {
      console.error('[Backup] Failed to check/create weekly backup:', error);
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
      console.error('[Backup] Failed to get last weekly backup time:', error);
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
      console.error('[Backup] Failed to calculate days until next backup:', error);
      return 0;
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

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
      console.error('Failed to export database file:', error);
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
        console.log('Current database backed up to:', backupPath);
      }

      // Copy the imported file to the database location
      await FileSystem.copyAsync({
        from: fileUri,
        to: dbPath,
      });

      console.log('Database file imported successfully');

      // The app will need to be reloaded to reinitialize the database
      // The database will be opened again on next getDatabase() call
    } catch (error) {
      console.error('Failed to import database file:', error);
      throw new Error('Failed to import database file: ' + (error as Error).message);
    }
  }
}

export const backupService = new BackupService();
