import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { episodeRepository, episodeNoteRepository } from '../database/episodeRepository';
import { medicationRepository, medicationDoseRepository, medicationScheduleRepository } from '../database/medicationRepository';
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
  episodes: Episode[];
  episodeNotes: EpisodeNote[];
  medications: Medication[];
  medicationDoses: MedicationDose[];
  medicationSchedules: MedicationSchedule[];
}

const BACKUP_DIR = `${FileSystem.documentDirectory}backups/`;
const MAX_AUTO_BACKUPS = 5;
const APP_VERSION = '1.0.0'; // TODO: Get from app.json
const SCHEMA_VERSION = 1;

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
      await this.initialize();

      // Gather all data - pass db to avoid circular dependency during migrations
      const episodes = await episodeRepository.getAll(50, 0, db);
      const medications = await medicationRepository.getAll(db);
      const medicationDoses = await medicationDoseRepository.getAll(100, db);

      // Gather all episode notes
      const episodeNotes: EpisodeNote[] = [];
      for (const ep of episodes) {
        const notes = await episodeNoteRepository.getByEpisodeId(ep.id, db);
        episodeNotes.push(...notes);
      }

      // Gather all medication schedules
      const medicationSchedules: MedicationSchedule[] = [];
      for (const med of medications) {
        const schedules = await medicationScheduleRepository.getByMedicationId(med.id, db);
        medicationSchedules.push(...schedules);
      }

      const backupId = this.generateBackupId();
      const backupData: BackupData = {
        metadata: {
          id: backupId,
          timestamp: Date.now(),
          version: APP_VERSION,
          schemaVersion: SCHEMA_VERSION,
          episodeCount: episodes.length,
          medicationCount: medications.length,
        },
        episodes,
        episodeNotes,
        medications,
        medicationDoses,
        medicationSchedules,
      };

      const backupPath = this.getBackupPath(backupId);
      const backupJson = JSON.stringify(backupData, null, 2);

      await FileSystem.writeAsStringAsync(backupPath, backupJson);

      const fileInfo = await FileSystem.getInfoAsync(backupPath);
      const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

      const metadata: BackupMetadata = {
        ...backupData.metadata,
        fileName: `${backupId}.json`,
        fileSize,
      };

      // Clean up old automatic backups if needed
      if (isAutomatic) {
        await this.cleanupOldAutoBackups();
      }

      return metadata;
    } catch (error) {
      console.error('Failed to create backup:', error);
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
      const backupPath = this.getBackupPath(backupId);
      const content = await FileSystem.readAsStringAsync(backupPath);
      const backupData: BackupData = JSON.parse(content);

      // Clear existing data first
      await episodeRepository.deleteAll();
      await episodeNoteRepository.deleteAll();
      await medicationRepository.deleteAll();
      await medicationDoseRepository.deleteAll();
      await medicationScheduleRepository.deleteAll();

      // Restore episodes
      for (const episode of backupData.episodes) {
        await episodeRepository.create(episode);
      }

      // Restore episode notes (if present in backup)
      if (backupData.episodeNotes) {
        for (const note of backupData.episodeNotes) {
          await episodeNoteRepository.create(note);
        }
      }

      // Restore medications
      for (const medication of backupData.medications) {
        await medicationRepository.create(medication);
      }

      // Restore medication doses
      for (const dose of backupData.medicationDoses) {
        await medicationDoseRepository.create(dose);
      }

      // Restore medication schedules
      for (const schedule of backupData.medicationSchedules) {
        await medicationScheduleRepository.create(schedule);
      }

      console.log('Backup restored successfully');
    } catch (error) {
      console.error('Failed to restore backup:', error);
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
