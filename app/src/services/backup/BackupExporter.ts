import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { logger } from '../../utils/logger';
// ARCHITECTURAL EXCEPTION: Backup/export needs direct repository access
// because it requires complete database access independent of UI state. See docs/store-repository-guidelines.md
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
  generateBackupId,
  getBackupPath,
  getMetadataPath,
  getBackupMetadata,
} from './backupUtils';

/**
 * BackupExporter - Handles export and import of backup files
 * Supports sharing snapshot backups and exporting data as JSON for portability
 */
class BackupExporter {
  /**
   * Export current database as JSON for data portability and healthcare sharing
   * 
   * This creates a human-readable JSON export of all health data including:
   * - Episodes (migraine attacks with start/end times, intensity readings, notes)
   * - Medications (prescriptions, doses, schedules)
   * - Daily status logs (2 years of data)
   * 
   * Use cases:
   * - Sharing health data with healthcare providers
   * - Data portability between devices/platforms
   * - Future: Third-party data imports
   * 
   * NOTE: This is NOT a backup format. Use createSnapshotBackup() for backups.
   * JSON exports cannot be restored directly - they are for data sharing only.
   * 
   * The JSON format is documented in docs/json-export-format.md
   * 
   * Creates temporary file in cache directory and prompts user to save/share.
   * File is NOT stored in backups directory.
   */
  async exportDataAsJson(): Promise<void> {
    try {
      logger.log('[Export] Creating JSON export for sharing...');

      // Get current database instance
      const db = await import('../../database/db').then(m => m.getDatabase());

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
          id: `export_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          timestamp: Date.now(),
          version: buildInfo.version,
          schemaVersion,
          episodeCount: episodes.length,
          medicationCount: medications.length,
        },
        // schemaSQL omitted - not needed for data sharing, only for backup/restore
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

  /**
   * Export an existing snapshot backup file for sharing
   * Note: Only snapshot (.db) backups are supported (Issue #194)
   */
  async exportBackup(backupId: string): Promise<void> {
    try {
      const metadata = await getBackupMetadata(backupId);
      if (!metadata) {
        throw new Error('Backup not found');
      }

      const backupPath = getBackupPath(backupId);
      const fileInfo = await FileSystem.getInfoAsync(backupPath);

      if (!fileInfo.exists) {
        throw new Error('Backup file not found');
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sharing is not available on this device');
      }

      await Sharing.shareAsync(backupPath, {
        mimeType: 'application/x-sqlite3',
        dialogTitle: 'Export MigraLog Backup',
        UTI: 'public.database',
      });
    } catch (error) {
      logger.error('Failed to export backup:', error);
      throw new Error('Failed to export backup: ' + (error as Error).message);
    }
  }

  /**
   * Import a backup file from external source
   */
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
        // For .db files, copy as a backup snapshot
        const backupId = generateBackupId();
        const backupPath = getBackupPath(backupId);

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

      // Only snapshot (.db) backup files can be imported
      throw new Error(
        'Only snapshot (.db) backup files can be imported. ' +
        'Please select a .db backup file.'
      );
    } catch (error) {
      logger.error('Failed to import backup:', error);
      throw new Error('Failed to import backup: ' + (error as Error).message);
    }
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
      logger.error('Failed to export database file:', error);
      throw new Error('Failed to export database file: ' + (error as Error).message);
    }
  }

  /**
   * Import a raw SQLite database file
   * WARNING: This will replace the entire database!
   * Note: This is handled by BackupRestorer.importDatabaseFile()
   * This method is kept for backwards compatibility but delegates to BackupRestorer
   */
  async importDatabaseFile(): Promise<void> {
    const { backupRestorer } = await import('./BackupRestorer');
    return backupRestorer.importDatabaseFile();
  }
}

export const backupExporter = new BackupExporter();
