import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { episodeRepository, episodeNoteRepository } from '../database/episodeRepository';
import { medicationRepository, medicationDoseRepository, medicationScheduleRepository } from '../database/medicationRepository';
import { migrationRunner } from '../database/migrations';
import { Episode, Medication, MedicationDose, MedicationSchedule, EpisodeNote } from '../models/types';

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
  medications: Medication[];
  medicationDoses: MedicationDose[];
  medicationSchedules: MedicationSchedule[];
}

const BACKUP_DIR = `${FileSystem.documentDirectory}backups/`;
const MAX_AUTO_BACKUPS = 5;
const APP_VERSION = '1.0.0'; // TODO: Get from app.json

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
        // Clear existing data and insert into current schema
        console.log('[Restore] Using legacy restore (delete data, insert into current schema)');
        await episodeRepository.deleteAll();
        await episodeNoteRepository.deleteAll();
        await medicationRepository.deleteAll();
        await medicationDoseRepository.deleteAll();
        await medicationScheduleRepository.deleteAll();

        console.log('[Restore] Inserting episodes...');
        for (const episode of backupData.episodes) {
          await episodeRepository.create(episode);
        }

        if (backupData.episodeNotes) {
          console.log('[Restore] Inserting episode notes...');
          for (const note of backupData.episodeNotes) {
            await episodeNoteRepository.create(note);
          }
        }

        console.log('[Restore] Inserting medications...');
        for (const medication of backupData.medications) {
          await medicationRepository.create(medication);
        }

        console.log('[Restore] Inserting medication doses...');
        for (const dose of backupData.medicationDoses) {
          await medicationDoseRepository.create(dose);
        }

        console.log('[Restore] Inserting medication schedules...');
        for (const schedule of backupData.medicationSchedules) {
          await medicationScheduleRepository.create(schedule);
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

        // Insert backup data
        console.log('[Restore] Inserting episodes...');
        for (const episode of backupData.episodes) {
          await episodeRepository.create(episode);
        }

        if (backupData.episodeNotes) {
          console.log('[Restore] Inserting episode notes...');
          for (const note of backupData.episodeNotes) {
            await episodeNoteRepository.create(note);
          }
        }

        console.log('[Restore] Inserting medications...');
        for (const medication of backupData.medications) {
          await medicationRepository.create(medication);
        }

        console.log('[Restore] Inserting medication doses...');
        for (const dose of backupData.medicationDoses) {
          await medicationDoseRepository.create(dose);
        }

        console.log('[Restore] Inserting medication schedules...');
        for (const schedule of backupData.medicationSchedules) {
          await medicationScheduleRepository.create(schedule);
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

        for (const backup of toDelete) {
          await this.deleteBackup(backup.id);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
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
}

export const backupService = new BackupService();
