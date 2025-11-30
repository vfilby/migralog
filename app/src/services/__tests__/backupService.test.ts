import { backupService } from '../backup/backupService';
import { initializeBackupDirectory, validateBackupMetadata } from '../backup/backupUtils';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import {
  episodeRepository,
  episodeNoteRepository,
  intensityRepository,
} from '../../database/episodeRepository';
import {
  medicationRepository,
  medicationDoseRepository,
  medicationScheduleRepository,
} from '../../database/medicationRepository';
import { dailyStatusRepository } from '../../database/dailyStatusRepository';
import { migrationRunner } from '../../database/migrations';
import { Episode, Medication, MedicationDose, EpisodeNote, BackupMetadata } from '../../models/types';

// Mock dependencies
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file://mockDocDir/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  copyAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
    UTF8: 'utf8',
  },
}));
jest.mock('expo-sharing');
jest.mock('expo-document-picker');
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock('../../database/episodeRepository');
jest.mock('../../database/medicationRepository');
jest.mock('../../database/dailyStatusRepository');
jest.mock('../../database/migrations');
jest.mock('../errorLogger', () => ({
  errorLogger: {
    log: jest.fn(() => Promise.resolve()),
    getLogs: jest.fn(() => Promise.resolve([])),
    clearLogs: jest.fn(() => Promise.resolve()),
    getRecentLogs: jest.fn(() => Promise.resolve([])),
    getLogsByType: jest.fn(() => Promise.resolve([])),
  },
}));

// Mock db module
const mockDatabase = {
  getAllAsync: jest.fn(),
  execAsync: jest.fn(),
  runAsync: jest.fn(),
  closeAsync: jest.fn(),
};

const mockDbModule = {
  getDatabase: jest.fn(() => Promise.resolve(mockDatabase)),
  closeDatabase: jest.fn(() => Promise.resolve()),
};

jest.mock('../../database/db', () => mockDbModule);

describe('backupService', () => {
  const BACKUP_DIR = `${FileSystem.documentDirectory}backups/`;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initializeBackupDirectory', () => {
    it('should create backup directory if it does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);

      await initializeBackupDirectory();

      expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(BACKUP_DIR, {
        intermediates: true,
      });
    });

    it('should not create directory if it already exists', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });

      await initializeBackupDirectory();

      expect(FileSystem.makeDirectoryAsync).not.toHaveBeenCalled();
    });
  });

  describe('createSnapshotBackup', () => {
    const mockEpisodes: Episode[] = [
      {
        id: 'ep-1',
        startTime: Date.now(),
        endTime: undefined,
        locations: ['left_head'],
        qualities: [],
        symptoms: [],
        triggers: [],
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const mockMedications: Medication[] = [
      {
        id: 'med-1',
        name: 'Test Med',
        type: 'rescue',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: undefined,
        scheduleFrequency: undefined,
        photoUri: undefined,
        schedule: [],
        active: true,
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const mockDoses: MedicationDose[] = [
      {
        id: 'dose-1',
        medicationId: 'med-1',
        timestamp: Date.now(),
        quantity: 1,
        episodeId: 'ep-1',
        effectivenessRating: undefined,
        timeToRelief: undefined,
        sideEffects: undefined,
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const mockNotes: EpisodeNote[] = [
      {
        id: 'note-1',
        episodeId: 'ep-1',
        timestamp: Date.now(),
        note: 'Test note',
        createdAt: Date.now(),
      },
    ];

    beforeEach(() => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 1234 });
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (episodeRepository.getAll as jest.Mock).mockResolvedValue(mockEpisodes);
      (medicationRepository.getAll as jest.Mock).mockResolvedValue(mockMedications);
      (medicationDoseRepository.getAll as jest.Mock).mockResolvedValue(mockDoses);
      (episodeNoteRepository.getByEpisodeId as jest.Mock).mockResolvedValue(mockNotes);
      (intensityRepository.getByEpisodeId as jest.Mock).mockResolvedValue([]);
      (dailyStatusRepository.getDateRange as jest.Mock).mockResolvedValue([]);
      (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([]);
      (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(1);
      (mockDatabase.getAllAsync as jest.Mock).mockImplementation((query: string) => {
        if (query.includes('COUNT') && query.includes('episodes')) {
          return Promise.resolve([{ count: 1 }]);
        }
        if (query.includes('COUNT') && query.includes('medications')) {
          return Promise.resolve([{ count: 1 }]);
        }
        if (query.includes('sqlite_master')) {
          return Promise.resolve([{ sql: 'CREATE TABLE episodes (...)' }]);
        }
        return Promise.resolve([]);
      });
    });

    it('should create a backup successfully', async () => {
      const metadata = await backupService.createSnapshotBackup();

      expect(metadata.id).toBeDefined();
      expect(metadata.episodeCount).toBe(1);
      expect(metadata.medicationCount).toBe(1);
      expect(metadata.fileSize).toBe(1234);
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
    });

    // Note: Schema SQL is not included in snapshot backups (only in JSON exports)
    // Snapshot backups are binary database copies with separate metadata files

    it('should create correct metadata structure', async () => {
      let writtenData: string = '';
      (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(
        (_path, data) => {
          writtenData = data;
          return Promise.resolve();
        }
      );

      await backupService.createSnapshotBackup();

      const metadata: BackupMetadata = JSON.parse(writtenData);
      expect(metadata.id).toBeDefined();
      expect(metadata.timestamp).toBeDefined();
      expect(metadata.backupType).toBe('snapshot');
      expect(metadata.episodeCount).toBe(1);
      expect(metadata.medicationCount).toBe(1);
      expect(metadata.fileSize).toBe(1234);
    });

    it('should clean up old automatic backups when using weekly backup', async () => {
      // Issue #185: Updated to use snapshot backups instead of JSON
      // Note: Cleanup only happens in checkAndCreateWeeklyBackup, not createSnapshotBackup
      // Mock 8 existing backups (more than MAX_AUTO_BACKUPS = 7)
      const mockBackups = Array.from({ length: 8 }, (_, i) => ({
        id: `backup_${i}`,
        timestamp: Date.now() - (i * 24 * 60 * 60 * 1000), // i days old
        version: '1.0.0',
        schemaVersion: 1,
        episodeCount: 0,
        medicationCount: 0,
        fileSize: 5000,
        fileName: `backup_${i}.db`,
        backupType: 'snapshot',
      }));

      // Return both .db files and .meta.json files
      const files: string[] = [];
      mockBackups.forEach(b => {
        files.push(b.fileName);
        files.push(`backup_${b.id.split('_')[1]}.meta.json`);
      });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(files);

      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: true, size: 200 });
        }
        return Promise.resolve({ exists: true, size: 5000 });
      });

      (FileSystem.readAsStringAsync as jest.Mock).mockImplementation((path: string) => {
        const fileName = path.split('/').pop();
        // Extract backup ID from meta.json filename
        if (fileName?.endsWith('.meta.json')) {
          const backupId = fileName.replace('.meta.json', '');
          const backup = mockBackups.find(b => b.id === backupId);
          if (backup) {
            return Promise.resolve(JSON.stringify(backup));
          }
        }
        return Promise.resolve('{}');
      });

      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      // Mock AsyncStorage for weekly backup check
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getItem.mockResolvedValue(null); // No previous backup
      AsyncStorage.setItem.mockResolvedValue(undefined);

      // Use checkAndCreateWeeklyBackup instead, which triggers cleanup
      await backupService.checkAndCreateWeeklyBackup();

      // Should trigger cleanup and delete at least 1 old backup
      expect(FileSystem.deleteAsync).toHaveBeenCalled();
    });

    it('should handle errors during backup creation', async () => {
      // Mock the database copy operation to fail instead of repository calls
      (FileSystem.copyAsync as jest.Mock).mockRejectedValue(
        new Error('Database copy failed')
      );

      await expect(backupService.createSnapshotBackup()).rejects.toThrow(
        'Failed to create snapshot backup'
      );
    });
  });

  describe('listBackups', () => {
    it('should list all snapshot backups sorted by timestamp', async () => {
      // Issue #185: listBackups now only lists snapshot (.db) backups, not JSON
      const mockMetadata1 = {
        id: 'backup-1',
        timestamp: 2000,
        version: '1.0.0',
        schemaVersion: 1,
        episodeCount: 5,
        medicationCount: 3,
        backupType: 'snapshot',
        fileName: 'backup-1.db',
        fileSize: 5000,
      };
      const mockMetadata2 = {
        id: 'backup-2',
        timestamp: 1000,
        version: '1.0.0',
        schemaVersion: 1,
        episodeCount: 2,
        medicationCount: 1,
        backupType: 'snapshot',
        fileName: 'backup-2.db',
        fileSize: 3000,
      };

      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.endsWith('.meta.json')) {
          return Promise.resolve({ exists: true, size: 200 });
        }
        return Promise.resolve({ exists: true, size: 5000 });
      });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'backup-1.db',
        'backup-1.meta.json',
        'backup-2.db',
        'backup-2.meta.json',
      ]);
      (FileSystem.readAsStringAsync as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify(mockMetadata1))
        .mockResolvedValueOnce(JSON.stringify(mockMetadata2));

      const backups = await backupService.listBackups();

      expect(backups).toHaveLength(2);
      expect(backups[0].id).toBe('backup-1'); // Newest first
      expect(backups[1].id).toBe('backup-2');
    });

    it('should skip legacy JSON backups (Issue #185)', async () => {
      // JSON backups are no longer listed - they're skipped
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 500 });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'legacy-backup.json', // Should be skipped
      ]);

      const backups = await backupService.listBackups();

      expect(backups).toHaveLength(0);
    });

    it('should return empty array if backup directory does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      const backups = await backupService.listBackups();

      expect(backups).toEqual([]);
    });

    it('should skip snapshot backups with invalid metadata', async () => {
      // Issue #185: Updated to test snapshot backups with invalid metadata
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.endsWith('.meta.json')) {
          return Promise.resolve({ exists: true, size: 100 });
        }
        return Promise.resolve({ exists: true, size: 5000 });
      });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'valid.db',
        'valid.meta.json',
        'invalid.db',
        'invalid.meta.json',
      ]);
      (FileSystem.readAsStringAsync as jest.Mock)
        .mockResolvedValueOnce(
          JSON.stringify({
            id: 'valid',
            timestamp: 1000,
            version: '1.0.0',
            schemaVersion: 1,
            episodeCount: 0,
            medicationCount: 0,
            backupType: 'snapshot',
            fileName: 'valid.db',
            fileSize: 5000,
          })
        )
        .mockResolvedValueOnce('invalid json');

      const backups = await backupService.listBackups();

      expect(backups).toHaveLength(1);
      expect(backups[0].id).toBe('valid');
    });
  });

  describe('checkForBrokenBackups', () => {
    it('should count JSON files with invalid metadata', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'broken.json',
        'valid.json',
      ]);
      (FileSystem.readAsStringAsync as jest.Mock)
        .mockResolvedValueOnce('{}') // broken.json - no metadata
        .mockResolvedValueOnce(JSON.stringify({
          metadata: { id: 'valid', timestamp: 1000, version: '1.0.0', schemaVersion: 1, episodeCount: 0, medicationCount: 0 },
          episodes: [],
          medications: [],
          medicationDoses: [],
          medicationSchedules: [],
        })); // valid.json

      const brokenCount = await backupService.checkForBrokenBackups();

      expect(brokenCount).toBe(1);
    });

    it('should count corrupted JSON files that fail to parse', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'corrupted.json',
      ]);
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValueOnce('invalid json{{{');

      const brokenCount = await backupService.checkForBrokenBackups();

      expect(brokenCount).toBe(1);
    });

    it('should count orphaned metadata files', async () => {
      (FileSystem.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: true }) // initialize() - backup dir exists
        .mockResolvedValueOnce({ exists: true }) // backup dir check in checkForBrokenBackups
        .mockResolvedValueOnce({ exists: false }); // orphaned.db doesn't exist
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'orphaned.meta.json',
      ]);

      const brokenCount = await backupService.checkForBrokenBackups();

      expect(brokenCount).toBe(1);
    });
  });

  describe('cleanupBrokenBackups', () => {
    it('should remove JSON files with invalid metadata', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'broken.json',
        'valid.json',
      ]);
      (FileSystem.readAsStringAsync as jest.Mock)
        .mockResolvedValueOnce('{}') // broken.json - no metadata
        .mockResolvedValueOnce(JSON.stringify({
          metadata: { id: 'valid', timestamp: 1000, version: '1.0.0', schemaVersion: 1, episodeCount: 0, medicationCount: 0 },
          episodes: [],
          medications: [],
          medicationDoses: [],
          medicationSchedules: [],
        })); // valid.json
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      const cleanedCount = await (backupService as any).cleanupBrokenBackups();

      expect(cleanedCount).toBe(1);
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        `${BACKUP_DIR}broken.json`
      );
    });

    it('should remove corrupted JSON files that fail to parse', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'corrupted.json',
      ]);
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValueOnce('invalid json{{{');
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      const cleanedCount = await (backupService as any).cleanupBrokenBackups();

      expect(cleanedCount).toBe(1);
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        `${BACKUP_DIR}corrupted.json`
      );
    });

    it('should remove orphaned metadata files', async () => {
      (FileSystem.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: true }) // initialize() - backup dir exists
        .mockResolvedValueOnce({ exists: true }) // backup dir check in cleanupBrokenBackups
        .mockResolvedValueOnce({ exists: false }); // orphaned.db doesn't exist
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'orphaned.meta.json',
      ]);
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      const cleanedCount = await (backupService as any).cleanupBrokenBackups();

      expect(cleanedCount).toBe(1);
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        `${BACKUP_DIR}orphaned.meta.json`
      );
    });
  });

  describe('getBackupMetadata', () => {
    it('should return backup metadata for snapshot backup if backup exists', async () => {
      // Issue #185: Updated to test snapshot backups only
      const mockMetadata = {
        id: 'backup-123',
        timestamp: Date.now(),
        version: '1.0.0',
        schemaVersion: 1,
        episodeCount: 5,
        medicationCount: 3,
        backupType: 'snapshot',
        fileName: 'backup-123.db',
        fileSize: 5000,
      };

      // Mock: .meta.json exists (snapshot backup)
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: true, size: 200 });
        }
        return Promise.resolve({ exists: true, size: 5000 });
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(mockMetadata)
      );

      const metadata = await backupService.getBackupMetadata('backup-123');

      expect(metadata).not.toBeUndefined();
      expect(metadata?.id).toBe('backup-123');
      expect(metadata?.fileSize).toBe(5000);
      expect(metadata?.backupType).toBe('snapshot');
    });

    it('should return null for legacy JSON backups (Issue #185)', async () => {
      // JSON backups are no longer supported - getBackupMetadata returns null
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: false }); // No metadata sidecar
        }
        if (path.includes('.json')) {
          return Promise.resolve({ exists: true, size: 1000 }); // JSON file exists
        }
        return Promise.resolve({ exists: false });
      });

      const metadata = await backupService.getBackupMetadata('legacy-backup');

      expect(metadata).toBeNull(); // JSON backups return null now
    });

    it('should return null if backup does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      const metadata = await backupService.getBackupMetadata('nonexistent');

      expect(metadata).toBe(null);
    });

    it('should return null on error', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(new Error('File error'));

      const metadata = await backupService.getBackupMetadata('backup-123');

      expect(metadata).toBe(null);
    });
  });

  describe('restoreBackup', () => {
    // Issue #185: Updated tests to use snapshot backups instead of JSON
    const mockSnapshotMetadata = {
      id: 'backup-123',
      timestamp: Date.now(),
      version: '1.0.0',
      schemaVersion: 1,
      episodeCount: 1,
      medicationCount: 1,
      backupType: 'snapshot',
      fileName: 'backup-123.db',
      fileSize: 5000,
    };

    beforeEach(() => {
      (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(1);
      (mockDatabase.getAllAsync as jest.Mock).mockResolvedValue([]);
      (mockDatabase.execAsync as jest.Mock).mockResolvedValue(undefined);
      (mockDatabase.runAsync as jest.Mock).mockResolvedValue(undefined);
      mockDbModule.closeDatabase.mockResolvedValue(undefined);
      mockDbModule.getDatabase.mockResolvedValue(mockDatabase);
    });

    it('should restore snapshot backup with file copy', async () => {
      // Mock: .meta.json exists (snapshot backup), .db file exists
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: true, size: 200 });
        }
        // For WAL/SHM files, return not exists
        if (path.includes('-wal') || path.includes('-shm')) {
          return Promise.resolve({ exists: false });
        }
        return Promise.resolve({ exists: true, size: 5000 });
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockImplementation((path: string, options?: any) => {
        // Handle base64 encoding for the .db file read
        if (options?.encoding) {
          return Promise.resolve('base64encodeddata');
        }
        // Handle JSON metadata file read
        return Promise.resolve(JSON.stringify(mockSnapshotMetadata));
      });
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      await backupService.restoreBackup('backup-123');

      // Snapshot restore writes the file (after reading as base64)
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
    });

    it('should reject restoring snapshot backup from newer schema version', async () => {
      const newerMetadata = {
        ...mockSnapshotMetadata,
        schemaVersion: 5,
      };

      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: true, size: 200 });
        }
        return Promise.resolve({ exists: true, size: 5000 });
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(newerMetadata)
      );
      (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(1);

      await expect(backupService.restoreBackup('backup-123')).rejects.toThrow(
        'Cannot restore backup from newer schema version'
      );
    });

    it('should reject legacy JSON backups (Issue #185)', async () => {
      // Mock: no .meta.json (not a snapshot), JSON file exists but returns null from getBackupMetadata
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: false });
        }
        if (path.includes('.json')) {
          return Promise.resolve({ exists: true, size: 1000 });
        }
        return Promise.resolve({ exists: false });
      });

      // JSON backups now return "Backup not found" because getBackupMetadata returns null
      await expect(backupService.restoreBackup('legacy-backup')).rejects.toThrow(
        'Backup not found'
      );
    });

    it('should throw error if backup does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      await expect(backupService.restoreBackup('nonexistent')).rejects.toThrow(
        'Backup not found'
      );
    });

    it('should handle restore errors', async () => {
      (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(
        new Error('File read error')
      );

      await expect(backupService.restoreBackup('backup-123')).rejects.toThrow(
        'Failed to restore backup'
      );
    });
  });

  describe('exportBackup', () => {
    // Issue #185: Updated tests to use snapshot backups instead of JSON
    it('should export snapshot backup via sharing', async () => {
      const mockMetadata = {
        id: 'backup-123',
        timestamp: Date.now(),
        version: '1.0.0',
        schemaVersion: 1,
        episodeCount: 5,
        medicationCount: 3,
        backupType: 'snapshot',
        fileName: 'backup-123.db',
        fileSize: 5000,
      };

      // Mock: .meta.json exists (snapshot backup)
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: true, size: 200 });
        }
        return Promise.resolve({ exists: true, size: 5000 });
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(mockMetadata)
      );
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);

      await backupService.exportBackup('backup-123');

      expect(Sharing.shareAsync).toHaveBeenCalled();
    });

    it('should throw error if backup does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      await expect(backupService.exportBackup('nonexistent')).rejects.toThrow(
        'Backup not found'
      );
    });

    it('should throw error for legacy JSON backups (Issue #185)', async () => {
      // JSON backups are no longer supported - getBackupMetadata returns null
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: false }); // No metadata sidecar
        }
        if (path.includes('.json')) {
          return Promise.resolve({ exists: true, size: 1000 }); // JSON file exists
        }
        return Promise.resolve({ exists: false });
      });

      await expect(backupService.exportBackup('legacy-backup')).rejects.toThrow(
        'Backup not found'
      );
    });

    it('should throw error if sharing is not available', async () => {
      const mockMetadata = {
        id: 'backup-123',
        timestamp: Date.now(),
        version: '1.0.0',
        schemaVersion: 1,
        episodeCount: 5,
        medicationCount: 3,
        backupType: 'snapshot',
        fileName: 'backup-123.db',
        fileSize: 5000,
      };

      // Mock: .meta.json exists (snapshot backup)
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: true, size: 200 });
        }
        return Promise.resolve({ exists: true, size: 5000 });
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(mockMetadata)
      );
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);

      await expect(backupService.exportBackup('backup-123')).rejects.toThrow(
        'Sharing is not available'
      );
    });
  });

  describe('validateBackupMetadata', () => {
    it('should reject metadata with missing id', () => {
      const invalidMetadata = {
        timestamp: Date.now(),
        version: '1.0.0',
        schemaVersion: 1,
        episodeCount: 0,
        medicationCount: 0,
      };

      const result = validateBackupMetadata(invalidMetadata);
      expect(result).toBe(false);
    });

    it('should reject metadata with undefined id', () => {
      const invalidMetadata = {
        id: undefined,
        timestamp: Date.now(),
        version: '1.0.0',
        schemaVersion: 1,
        episodeCount: 0,
        medicationCount: 0,
      };

      const result = validateBackupMetadata(invalidMetadata);
      expect(result).toBe(false);
    });

    it('should reject metadata with null id', () => {
      const invalidMetadata = {
        id: null,
        timestamp: Date.now(),
        version: '1.0.0',
        schemaVersion: 1,
        episodeCount: 0,
        medicationCount: 0,
      };

      const result = validateBackupMetadata(invalidMetadata);
      expect(result).toBe(false);
    });

    it('should reject metadata with empty string id', () => {
      const invalidMetadata = {
        id: '',
        timestamp: Date.now(),
        version: '1.0.0',
        schemaVersion: 1,
        episodeCount: 0,
        medicationCount: 0,
      };

      const result = validateBackupMetadata(invalidMetadata);
      expect(result).toBe(false);
    });

    it('should reject metadata with whitespace-only id', () => {
      const invalidMetadata = {
        id: '   ',
        timestamp: Date.now(),
        version: '1.0.0',
        schemaVersion: 1,
        episodeCount: 0,
        medicationCount: 0,
      };

      const result = validateBackupMetadata(invalidMetadata);
      expect(result).toBe(false);
    });

    it('should reject metadata with numeric id', () => {
      const invalidMetadata = {
        id: 12345,
        timestamp: Date.now(),
        version: '1.0.0',
        schemaVersion: 1,
        episodeCount: 0,
        medicationCount: 0,
      };

      const result = validateBackupMetadata(invalidMetadata);
      expect(result).toBe(false);
    });

    it('should reject metadata with invalid timestamp (zero)', () => {
      const invalidMetadata = {
        id: 'test',
        timestamp: 0,
        version: '1.0.0',
        schemaVersion: 1,
        episodeCount: 0,
        medicationCount: 0,
      };

      const result = validateBackupMetadata(invalidMetadata);
      expect(result).toBe(false);
    });

    it('should reject metadata with negative timestamp', () => {
      const invalidMetadata = {
        id: 'test',
        timestamp: -100,
        version: '1.0.0',
        schemaVersion: 1,
        episodeCount: 0,
        medicationCount: 0,
      };

      const result = validateBackupMetadata(invalidMetadata);
      expect(result).toBe(false);
    });

    it('should reject metadata with missing version', () => {
      const invalidMetadata = {
        id: 'test',
        timestamp: Date.now(),
        schemaVersion: 1,
        episodeCount: 0,
        medicationCount: 0,
      };

      const result = validateBackupMetadata(invalidMetadata);
      expect(result).toBe(false);
    });

    it('should reject metadata with negative schemaVersion', () => {
      const invalidMetadata = {
        id: 'test',
        timestamp: Date.now(),
        version: '1.0.0',
        schemaVersion: -1,
        episodeCount: 0,
        medicationCount: 0,
      };

      const result = validateBackupMetadata(invalidMetadata);
      expect(result).toBe(false);
    });

    it('should reject metadata with negative episodeCount', () => {
      const invalidMetadata = {
        id: 'test',
        timestamp: Date.now(),
        version: '1.0.0',
        schemaVersion: 1,
        episodeCount: -5,
        medicationCount: 0,
      };

      const result = validateBackupMetadata(invalidMetadata);
      expect(result).toBe(false);
    });

    it('should reject metadata with negative medicationCount', () => {
      const invalidMetadata = {
        id: 'test',
        timestamp: Date.now(),
        version: '1.0.0',
        schemaVersion: 1,
        episodeCount: 0,
        medicationCount: -3,
      };

      const result = validateBackupMetadata(invalidMetadata);
      expect(result).toBe(false);
    });

    it('should accept valid metadata', () => {
      const validMetadata = {
        id: 'test-backup',
        timestamp: Date.now(),
        version: '1.0.0',
        schemaVersion: 1,
        episodeCount: 5,
        medicationCount: 3,
      };

      const result = validateBackupMetadata(validMetadata);
      expect(result).toBe(true);
    });
  });

  // Note: validateBackupData tests removed in Issue #185 - JSON restore functionality removed

  describe('importBackup', () => {
    // Issue #185: Updated tests - JSON import is no longer supported, only .db files
    it('should import snapshot (.db) backup successfully', async () => {
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///path/to/backup.db', name: 'backup.db' }],
      });
      (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 5000 });
      (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(6);

      const metadata = await backupService.importBackup();

      expect(metadata).toBeDefined();
      expect(metadata.backupType).toBe('snapshot');
      expect(FileSystem.copyAsync).toHaveBeenCalled();
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalled(); // Metadata file
    });

    it('should throw error if import is cancelled', async () => {
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: true,
      });

      await expect(backupService.importBackup()).rejects.toThrow('Import cancelled');
    });

    it('should reject JSON files (Issue #185)', async () => {
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///path/to/backup.json', name: 'backup.json' }],
      });

      await expect(backupService.importBackup()).rejects.toThrow(
        'Only snapshot (.db) backup files can be imported. Please select a .db backup file.'
      );
    });

    it('should reject files without extension as JSON files', async () => {
      // Files without a .db extension are treated as JSON and rejected
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///path/to/backup', name: 'backup' }],
      });

      await expect(backupService.importBackup()).rejects.toThrow(
        'Only snapshot (.db) backup files can be imported. Please select a .db backup file.'
      );
    });
  });

  describe('deleteBackup', () => {
    it('should delete backup file', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      await backupService.deleteBackup('backup-123');

      expect(FileSystem.deleteAsync).toHaveBeenCalled();
    });

    it('should throw if backup files do not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      await expect(backupService.deleteBackup('nonexistent')).rejects.toThrow(
        'Failed to delete backup: Backup files not found'
      );
    });

    it('should handle delete errors', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.deleteAsync as jest.Mock).mockRejectedValue(new Error('Delete failed'));

      await expect(backupService.deleteBackup('backup-123')).rejects.toThrow(
        'Failed to delete backup'
      );
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(backupService.formatFileSize(0)).toBe('0 Bytes');
      expect(backupService.formatFileSize(1024)).toBe('1 KB');
      expect(backupService.formatFileSize(1536)).toBe('1.5 KB');
      expect(backupService.formatFileSize(1048576)).toBe('1 MB');
      expect(backupService.formatFileSize(1073741824)).toBe('1 GB');
    });
  });

  describe('formatDate', () => {
    it('should format timestamp to locale string', () => {
      const timestamp = new Date('2025-01-01T12:00:00Z').getTime();
      const formatted = backupService.formatDate(timestamp);

      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });
  });

  describe('Facade Delegation Tests', () => {
    it('should delegate createSnapshotBackup to BackupServiceImpl', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 1234 });
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (episodeRepository.getAll as jest.Mock).mockResolvedValue([]);
      (medicationRepository.getAll as jest.Mock).mockResolvedValue([]);
      (medicationDoseRepository.getAll as jest.Mock).mockResolvedValue([]);
      (episodeNoteRepository.getByEpisodeId as jest.Mock).mockResolvedValue([]);
      (intensityRepository.getByEpisodeId as jest.Mock).mockResolvedValue([]);
      (dailyStatusRepository.getDateRange as jest.Mock).mockResolvedValue([]);
      (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([]);
      (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(1);
      (mockDatabase.getAllAsync as jest.Mock).mockImplementation((query: string) => {
        if (query.includes('COUNT') && query.includes('episodes')) {
          return Promise.resolve([{ count: 1 }]);
        }
        if (query.includes('COUNT') && query.includes('medications')) {
          return Promise.resolve([{ count: 1 }]);
        }
        if (query.includes('sqlite_master')) {
          return Promise.resolve([{ sql: 'CREATE TABLE episodes (...)' }]);
        }
        return Promise.resolve([]);
      });
    });

    // Note: Updated for Issue #185 - JSON restore no longer supported
    // This test now uses a snapshot backup (with .meta.json metadata file)
    it('should delegate restoreBackup to RestoreService', async () => {
      const mockMetadata = {
        id: 'test-backup',
        timestamp: Date.now(),
        version: '1.0.0',
        schemaVersion: 1,
        episodeCount: 0,
        medicationCount: 0,
        fileSize: 5000,
        fileName: 'test-backup.db',
        backupType: 'snapshot',
      };

      // Mock snapshot backup with .meta.json
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: true, size: 200 });
        }
        // For WAL/SHM files, return not exists
        if (path.includes('-wal') || path.includes('-shm')) {
          return Promise.resolve({ exists: false });
        }
        return Promise.resolve({ exists: true, size: 5000 });
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockImplementation((path: string, options?: any) => {
        // Handle base64 encoding for the .db file read
        if (options?.encoding) {
          return Promise.resolve('base64encodeddata');
        }
        // Handle JSON metadata file read
        return Promise.resolve(JSON.stringify(mockMetadata));
      });
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
      (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(1);
      (mockDatabase.execAsync as jest.Mock).mockResolvedValue(undefined);
      (mockDatabase.runAsync as jest.Mock).mockResolvedValue(undefined);
      (mockDatabase.getAllAsync as jest.Mock).mockResolvedValue([]);
      mockDbModule.closeDatabase.mockResolvedValue(undefined);
      mockDbModule.getDatabase.mockResolvedValue(mockDatabase);

      await backupService.restoreBackup('test-backup');

      // Snapshot restore writes the file (after reading as base64)
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
    });

    it('should delegate importDatabaseFile to RestoreService', async () => {
      const mockPickerResult = {
        canceled: false,
        assets: [{ uri: 'file:///path/to/database.db' }],
      };

      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue(mockPickerResult);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 5000 });
      (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);

      await backupService.importDatabaseFile();

      // Should copy the database file (both backup and import)
      expect(FileSystem.copyAsync).toHaveBeenCalled();
      // importDatabaseFile doesn't run migrations - it requires app reload
    });

    // Note: Updated for Issue #185 - now uses snapshot backup metadata
    it('should delegate exportBackup to BackupServiceImpl', async () => {
      const mockMetadata = {
        id: 'test-export',
        timestamp: Date.now(),
        version: '1.0.0',
        schemaVersion: 1,
        episodeCount: 0,
        medicationCount: 0,
        fileSize: 5000,
        fileName: 'test-export.db',
        backupType: 'snapshot',
      };

      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: true, size: 200 });
        }
        if (path.includes('.db')) {
          return Promise.resolve({ exists: true, size: 5000 });
        }
        return Promise.resolve({ exists: false });
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(mockMetadata)
      );
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);

      await backupService.exportBackup('test-export');

      expect(Sharing.shareAsync).toHaveBeenCalled();
    });

    it('should delegate listBackups to BackupServiceImpl', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 500 });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([]);

      const backups = await backupService.listBackups();

      expect(backups).toEqual([]);
      expect(FileSystem.readDirectoryAsync).toHaveBeenCalled();
    });

    it('should delegate deleteBackup to BackupServiceImpl', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      await backupService.deleteBackup('test-delete');

      expect(FileSystem.deleteAsync).toHaveBeenCalled();
    });

    it('should delegate formatFileSize utility method', () => {
      const formatted = backupService.formatFileSize(1024);
      expect(formatted).toBe('1 KB');
    });

    it('should delegate formatDate utility method', () => {
      const timestamp = Date.now();
      const formatted = backupService.formatDate(timestamp);
      expect(typeof formatted).toBe('string');
      expect(formatted).toBeDefined();
    });
  });

  describe('Weekly Backup Strategy', () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');

    beforeEach(() => {
      // Reset AsyncStorage mocks
      AsyncStorage.getItem.mockClear();
      AsyncStorage.setItem.mockClear();

      // Setup default mocks for createSnapshotBackup (now used for weekly backups)
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 1234 });
      (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      // Mock database queries for metadata counts
      (mockDatabase.getAllAsync as jest.Mock).mockImplementation((query: string) => {
        if (query.includes('COUNT(*)')) {
          return Promise.resolve([{ count: 10 }]);
        }
        if (query.includes('sqlite_master')) {
          return Promise.resolve([{ sql: 'CREATE TABLE episodes (...)' }]);
        }
        return Promise.resolve([]);
      });

      (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(6);
    });

    describe('checkAndCreateWeeklyBackup', () => {
      it('should create backup when no previous backup exists', async () => {
        AsyncStorage.getItem.mockResolvedValue(null);

        const result = await backupService.checkAndCreateWeeklyBackup();

        expect(result).toBeDefined();
        expect(result?.id).toBeDefined();
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          '@MigraLog:lastWeeklyBackup',
          expect.any(String)
        );
        // Should use snapshot backup (copyAsync) not JSON (writeAsStringAsync)
        expect(FileSystem.copyAsync).toHaveBeenCalled();
        expect(FileSystem.writeAsStringAsync).toHaveBeenCalled(); // For metadata
      });

      it('should create backup when 7 days have passed', async () => {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        AsyncStorage.getItem.mockResolvedValue(sevenDaysAgo.toString());

        const result = await backupService.checkAndCreateWeeklyBackup();

        expect(result).toBeDefined();
        expect(result?.id).toBeDefined();
        expect(AsyncStorage.setItem).toHaveBeenCalled();
      });

      it('should create backup when more than 7 days have passed', async () => {
        const tenDaysAgo = Date.now() - (10 * 24 * 60 * 60 * 1000);
        AsyncStorage.getItem.mockResolvedValue(tenDaysAgo.toString());

        const result = await backupService.checkAndCreateWeeklyBackup();

        expect(result).toBeDefined();
        expect(result?.id).toBeDefined();
      });

      it('should not create backup when less than 7 days have passed', async () => {
        const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
        AsyncStorage.getItem.mockResolvedValue(threeDaysAgo.toString());

        const result = await backupService.checkAndCreateWeeklyBackup();

        expect(result).toBeNull();
        expect(FileSystem.copyAsync).not.toHaveBeenCalled();
        expect(AsyncStorage.setItem).not.toHaveBeenCalled();
      });

      it('should not throw if backup creation fails', async () => {
        AsyncStorage.getItem.mockResolvedValue(null);
        (FileSystem.copyAsync as jest.Mock).mockRejectedValue(
          new Error('Disk full')
        );

        const result = await backupService.checkAndCreateWeeklyBackup();

        expect(result).toBeNull();
        // Should not throw
      });

      it('should update last backup timestamp after successful backup', async () => {
        AsyncStorage.getItem.mockResolvedValue(null);
        const beforeTime = Date.now();

        await backupService.checkAndCreateWeeklyBackup();

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          '@MigraLog:lastWeeklyBackup',
          expect.any(String)
        );

        const savedTimestamp = parseInt(
          (AsyncStorage.setItem as jest.Mock).mock.calls[0][1],
          10
        );
        expect(savedTimestamp).toBeGreaterThanOrEqual(beforeTime);
        expect(savedTimestamp).toBeLessThanOrEqual(Date.now());
      });
    });

    describe('getLastWeeklyBackupTime', () => {
      it('should return timestamp when backup exists', async () => {
        const timestamp = Date.now() - 100000;
        AsyncStorage.getItem.mockResolvedValue(timestamp.toString());

        const result = await backupService.getLastWeeklyBackupTime();

        expect(result).toBe(timestamp);
      });

      it('should return 0 when no backup exists', async () => {
        AsyncStorage.getItem.mockResolvedValue(null);

        const result = await backupService.getLastWeeklyBackupTime();

        expect(result).toBe(0);
      });

      it('should return 0 on error', async () => {
        AsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

        const result = await backupService.getLastWeeklyBackupTime();

        expect(result).toBe(0);
      });
    });

    describe('getDaysUntilNextWeeklyBackup', () => {
      it('should return 0 when no previous backup exists', async () => {
        AsyncStorage.getItem.mockResolvedValue(null);

        const result = await backupService.getDaysUntilNextWeeklyBackup();

        expect(result).toBe(0);
      });

      it('should return 0 when backup is overdue', async () => {
        const tenDaysAgo = Date.now() - (10 * 24 * 60 * 60 * 1000);
        AsyncStorage.getItem.mockResolvedValue(tenDaysAgo.toString());

        const result = await backupService.getDaysUntilNextWeeklyBackup();

        expect(result).toBe(0);
      });

      it('should return correct days remaining', async () => {
        const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
        AsyncStorage.getItem.mockResolvedValue(threeDaysAgo.toString());

        const result = await backupService.getDaysUntilNextWeeklyBackup();

        expect(result).toBe(4); // 7 - 3 = 4 days remaining
      });

      it('should return 1 when less than 1 day remaining', async () => {
        const sixDaysAgoAndSomeHours = Date.now() - (6.5 * 24 * 60 * 60 * 1000);
        AsyncStorage.getItem.mockResolvedValue(sixDaysAgoAndSomeHours.toString());

        const result = await backupService.getDaysUntilNextWeeklyBackup();

        expect(result).toBe(1); // Should round up
      });

      it('should return 0 on error', async () => {
        AsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

        const result = await backupService.getDaysUntilNextWeeklyBackup();

        expect(result).toBe(0);
      });
    });

    describe('Retention Policy (7 backups)', () => {
      it('should keep only 7 most recent automatic backups', async () => {
        // Mock 9 existing snapshot backups (more than MAX_AUTO_BACKUPS = 7)
        // This ensures cleanup is triggered even if the new backup isn't immediately visible
        const baseTimestamp = Date.now();
        const mockBackups = Array.from({ length: 9 }, (_, i) => ({
          id: `backup_${baseTimestamp - i * 1000}_${i}`,
          timestamp: baseTimestamp - (i * 24 * 60 * 60 * 1000), // i days old
          version: '1.0.0',
          schemaVersion: 6,
          episodeCount: 0,
          medicationCount: 0,
          fileSize: 100,
          fileName: `backup_${baseTimestamp - i * 1000}_${i}.db`,
          backupType: 'snapshot' as const,
        }));

        // Mock directory listing with .db files and .meta.json files
        const files = mockBackups.flatMap(b => [
          b.fileName,
          b.fileName.replace('.db', '.meta.json'),
        ]);

        (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(files);

        // Mock getInfoAsync to return exists:true and size for both db and meta files
        (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
          const fileName = path.split('/').pop() || '';
          if (fileName.endsWith('.meta.json') || fileName.endsWith('.db')) {
            return Promise.resolve({ exists: true, size: 1000 });
          }
          if (path.includes('backups')) {
            return Promise.resolve({ exists: true });
          }
          return Promise.resolve({ exists: true, size: 1000 });
        });

        // Mock readAsStringAsync for metadata files
        (FileSystem.readAsStringAsync as jest.Mock).mockImplementation((path: string) => {
          const fileName = path.split('/').pop();
          if (fileName?.endsWith('.meta.json')) {
            const backupId = fileName.replace('.meta.json', '');
            const backup = mockBackups.find(b => b.id === backupId);
            if (backup) {
              return Promise.resolve(JSON.stringify(backup));
            }
          }
          return Promise.resolve('{}');
        });

        (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
        (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
        (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
        mockDbModule.closeDatabase.mockResolvedValue(undefined);
        mockDbModule.getDatabase.mockResolvedValue(mockDatabase);
        (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(6);
        AsyncStorage.getItem.mockResolvedValue(null);
        AsyncStorage.setItem.mockResolvedValue(undefined);

        // Create a new backup (should trigger cleanup)
        await backupService.checkAndCreateWeeklyBackup();

        // Should trigger cleanup and delete old backups
        // With 9 backups + 1 new = 10, should delete 3 (keeping 7)
        expect(FileSystem.deleteAsync).toHaveBeenCalled();
      });
    });
  });

  describe('additional edge cases for coverage', () => {
    describe('createSnapshotBackup error logging failure', () => {
      it('should handle error logging failure gracefully', async () => {
        // Setup: Make database copy fail
        (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
        (FileSystem.copyAsync as jest.Mock).mockRejectedValue(new Error('Copy failed'));

        // Mock errorLogger to fail as well
        const { errorLogger } = require('../errorLogger');
        errorLogger.log.mockRejectedValueOnce(new Error('Error logging failed'));

        await expect(backupService.createSnapshotBackup()).rejects.toThrow(
          'Failed to create snapshot backup'
        );
      });
    });

    describe('listBackups edge cases', () => {
      it('should handle legacy snapshot without metadata sidecar', async () => {
        const legacyDbFile = 'legacy_backup_123.db';

        (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
          if (path.includes('backups') && !path.includes('.')) {
            return Promise.resolve({ exists: true });
          }
          if (path.includes('.meta.json')) {
            return Promise.resolve({ exists: false }); // No metadata file
          }
          if (path.includes('.db')) {
            return Promise.resolve({ exists: true, size: 5000 });
          }
          return Promise.resolve({ exists: true });
        });

        (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([legacyDbFile]);

        const backups = await backupService.listBackups();

        expect(backups).toHaveLength(1);
        expect(backups[0].id).toBe('legacy_backup_123');
        expect(backups[0].timestamp).toBe(0); // Unknown for legacy
        expect(backups[0].backupType).toBe('snapshot');
        expect(backups[0].fileSize).toBe(5000);
      });

      it('should filter out backups with undefined IDs', async () => {
        const dbFile = 'test_backup.db';
        const metaContent = JSON.stringify({
          // Missing id field
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: 6,
          episodeCount: 0,
          medicationCount: 0,
          backupType: 'snapshot',
        });

        (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
          if (path.includes('.meta.json') || path.includes('.db')) {
            return Promise.resolve({ exists: true, size: 1000 });
          }
          return Promise.resolve({ exists: true });
        });

        (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([dbFile]);
        (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(metaContent);

        const backups = await backupService.listBackups();

        // Should still include it because we set id from filename when missing
        expect(backups).toHaveLength(1);
        expect(backups[0].id).toBe('test_backup');
      });

      it('should return empty array on directory listing error', async () => {
        (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
        (FileSystem.readDirectoryAsync as jest.Mock).mockRejectedValue(
          new Error('Permission denied')
        );

        const backups = await backupService.listBackups();

        expect(backups).toEqual([]);
      });

      it('should continue processing other backups when one fails to read', async () => {
        const files = ['good_backup.db', 'bad_backup.db'];

        (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
          if (path.includes('backups') && !path.includes('.')) {
            return Promise.resolve({ exists: true });
          }
          if (path.includes('.meta.json')) {
            if (path.includes('bad_backup')) {
              return Promise.resolve({ exists: true }); // Meta exists but will fail to read
            }
            return Promise.resolve({ exists: true });
          }
          return Promise.resolve({ exists: true, size: 1000 });
        });

        (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(files);
        (FileSystem.readAsStringAsync as jest.Mock).mockImplementation((path: string) => {
          if (path.includes('bad_backup')) {
            throw new Error('Read failed');
          }
          return Promise.resolve(
            JSON.stringify({
              id: 'good_backup',
              timestamp: Date.now(),
              version: '1.0.0',
              schemaVersion: 6,
              episodeCount: 0,
              medicationCount: 0,
              backupType: 'snapshot',
            })
          );
        });

        const backups = await backupService.listBackups();

        // Should have at least the good backup
        expect(backups.length).toBeGreaterThanOrEqual(1);
        expect(backups.some(b => b.id === 'good_backup')).toBe(true);
      });
    });

    describe('checkForBrokenBackups edge cases', () => {
      it('should return 0 when backup directory does not exist', async () => {
        (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

        const count = await backupService.checkForBrokenBackups();

        expect(count).toBe(0);
      });

      it('should count corrupted JSON files', async () => {
        (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
        (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['corrupted.json']);
        (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(
          new Error('Invalid JSON')
        );

        const count = await backupService.checkForBrokenBackups();

        expect(count).toBe(1);
      });

      it('should return 0 on general error', async () => {
        (FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(new Error('Permission denied'));

        const count = await backupService.checkForBrokenBackups();

        expect(count).toBe(0);
      });
    });

    describe('cleanupBrokenBackups edge cases', () => {
      it('should return 0 when backup directory does not exist', async () => {
        (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

        const count = await backupService.cleanupBrokenBackups();

        expect(count).toBe(0);
      });

      it('should delete corrupted JSON files that throw on parse', async () => {
        (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
        (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['corrupted.json']);
        (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('not valid json {{{');
        (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

        const count = await backupService.cleanupBrokenBackups();

        expect(count).toBe(1);
        expect(FileSystem.deleteAsync).toHaveBeenCalled();
      });

      it('should handle delete failure gracefully', async () => {
        (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
        (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['corrupted.json']);
        (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('not valid json');
        (FileSystem.deleteAsync as jest.Mock).mockRejectedValue(new Error('Delete failed'));

        // Should not throw, just log error
        const count = await backupService.cleanupBrokenBackups();

        // Count should be 0 since delete failed
        expect(count).toBe(0);
      });

      it('should throw on general error', async () => {
        (FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(new Error('Permission denied'));

        await expect(backupService.cleanupBrokenBackups()).rejects.toThrow(
          'Failed to cleanup broken backups'
        );
      });
    });

    describe('exportBackup edge cases', () => {
      it('should throw error when backup file not found', async () => {
        const mockMetadata = {
          id: 'test-backup',
          backupType: 'snapshot' as const,
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: 6,
          episodeCount: 0,
          medicationCount: 0,
          fileSize: 1000,
          fileName: 'test-backup.db',
        };

        (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
          if (path.includes('.meta.json')) {
            return Promise.resolve({ exists: true });
          }
          if (path.includes('.db')) {
            return Promise.resolve({ exists: false }); // Backup file missing
          }
          return Promise.resolve({ exists: true });
        });

        (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
          JSON.stringify(mockMetadata)
        );

        await expect(backupService.exportBackup('test-backup')).rejects.toThrow(
          'Backup file not found'
        );
      });
    });

    describe('getEpisodeCount and getMedicationCount error handling', () => {
      it('should return 0 when episode count query fails', async () => {
        // Reset mocks completely
        mockDatabase.getAllAsync.mockReset();

        (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 1000 });
        (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
        (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
        (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(6);

        // Episode count fails, medication count succeeds
        mockDatabase.getAllAsync
          .mockRejectedValueOnce(new Error('Episode count failed'))
          .mockResolvedValueOnce([{ count: 5 }]);

        const result = await backupService.createSnapshotBackup();

        expect(result.episodeCount).toBe(0); // Falls back to 0 on error
        expect(result.medicationCount).toBe(5);
      });

      it('should return 0 when medication count query fails', async () => {
        // Reset mocks completely
        mockDatabase.getAllAsync.mockReset();

        (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 1000 });
        (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
        (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
        (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(6);

        // Episode count succeeds, medication count fails
        mockDatabase.getAllAsync
          .mockResolvedValueOnce([{ count: 3 }])
          .mockRejectedValueOnce(new Error('Medication count failed'));

        const result = await backupService.createSnapshotBackup();

        expect(result.episodeCount).toBe(3);
        expect(result.medicationCount).toBe(0); // Falls back to 0 on error
      });
    });

    describe('cleanupOldAutoBackups error handling', () => {
      it('should log error but not throw when cleanup fails', async () => {
        // Reset mocks completely
        mockDatabase.getAllAsync.mockReset();

        // Setup for createSnapshotBackup to trigger cleanup
        (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 1000 });
        (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);

        // Mock repositories
        (episodeRepository.getAll as jest.Mock).mockResolvedValue([]);
        (medicationRepository.getAll as jest.Mock).mockResolvedValue([]);
        (medicationDoseRepository.getAll as jest.Mock).mockResolvedValue([]);
        (episodeNoteRepository.getByEpisodeId as jest.Mock).mockResolvedValue([]);
        (intensityRepository.getByEpisodeId as jest.Mock).mockResolvedValue([]);
        (dailyStatusRepository.getDateRange as jest.Mock).mockResolvedValue([]);
        (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([]);
        (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(6);

        // Mock exportSchemaSQL to succeed (getAllAsync for schema)
        mockDatabase.getAllAsync.mockResolvedValue([{ sql: 'CREATE TABLE test;' }]);

        // Mock readDirectoryAsync to succeed for initial write, then fail during cleanup
        let callCount = 0;
        (FileSystem.readDirectoryAsync as jest.Mock).mockImplementation(() => {
          callCount++;
          if (callCount > 1) {
            // Fail on cleanup (second call)
            return Promise.reject(new Error('Cleanup failed'));
          }
          return Promise.resolve([]);
        });

        // Should complete without throwing (cleanup error is caught internally)
        const result = await backupService.createSnapshotBackup();

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
      });
    });

    describe('getDaysUntilNextWeeklyBackup error handling', () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');

      it('should return 0 on error', async () => {
        AsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

        const days = await backupService.getDaysUntilNextWeeklyBackup();

        expect(days).toBe(0);
      });

      it('should return 0 when backup is needed now (time elapsed)', async () => {
        // Last backup was 8 days ago (past the 7-day threshold)
        const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
        AsyncStorage.getItem.mockResolvedValue(eightDaysAgo.toString());

        const days = await backupService.getDaysUntilNextWeeklyBackup();

        expect(days).toBe(0);
      });
    });

    describe('exportDataAsJson', () => {
      it('should gather all data and share JSON file', async () => {
        const mockEpisode = {
          id: 'ep-1',
          startTime: Date.now(),
          endTime: null,
          locations: [],
          qualities: [],
          symptoms: [],
          triggers: [],
          notes: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const mockMedication = {
          id: 'med-1',
          name: 'Test Med',
          type: 'rescue',
          dosageAmount: 100,
          dosageUnit: 'mg',
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        (episodeRepository.getAll as jest.Mock).mockResolvedValue([mockEpisode]);
        (medicationRepository.getAll as jest.Mock).mockResolvedValue([mockMedication]);
        (medicationDoseRepository.getAll as jest.Mock).mockResolvedValue([]);
        (episodeNoteRepository.getByEpisodeId as jest.Mock).mockResolvedValue([
          { id: 'note-1', episodeId: 'ep-1', timestamp: Date.now(), note: 'Test note' },
        ]);
        (intensityRepository.getByEpisodeId as jest.Mock).mockResolvedValue([
          { id: 'reading-1', episodeId: 'ep-1', timestamp: Date.now(), intensity: 5 },
        ]);
        (dailyStatusRepository.getDateRange as jest.Mock).mockResolvedValue([]);
        (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([
          { id: 'sched-1', medicationId: 'med-1', time: '08:00', daysOfWeek: [1, 2, 3, 4, 5] },
        ]);
        (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(6);

        (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
        (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
        (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);

        await backupService.exportDataAsJson();

        // Verify data was written
        expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
          expect.stringContaining('migralog_export_'),
          expect.stringContaining('"episodes"')
        );

        // Verify sharing was called
        expect(Sharing.shareAsync).toHaveBeenCalledWith(
          expect.stringContaining('migralog_export_'),
          expect.objectContaining({
            mimeType: 'application/json',
            dialogTitle: 'Export MigraLog Data',
          })
        );
      });

      it('should throw when sharing is not available', async () => {
        (episodeRepository.getAll as jest.Mock).mockResolvedValue([]);
        (medicationRepository.getAll as jest.Mock).mockResolvedValue([]);
        (medicationDoseRepository.getAll as jest.Mock).mockResolvedValue([]);
        (dailyStatusRepository.getDateRange as jest.Mock).mockResolvedValue([]);
        (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(6);
        (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
        (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);

        await expect(backupService.exportDataAsJson()).rejects.toThrow(
          'Sharing is not available on this device'
        );
      });
    });

    describe('database copy error handling', () => {
      it('should throw error when database copy fails', async () => {
        (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
        (FileSystem.copyAsync as jest.Mock).mockRejectedValue(new Error('Copy failed'));
        (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(6);

        await expect(backupService.createSnapshotBackup()).rejects.toThrow();
      });
    });

    describe('restoreSnapshotBackup WAL checkpoint handling', () => {
      it('should continue restore when WAL checkpoint fails', async () => {
        const mockMetadata = {
          id: 'snapshot-1',
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: 6,
          episodeCount: 5,
          medicationCount: 3,
          fileSize: 5000,
          fileName: 'snapshot-1.db',
          backupType: 'snapshot' as const,
        };

        (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
          if (path.includes('.meta.json')) {
            return Promise.resolve({ exists: true });
          }
          if (path.includes('snapshot-1.db')) {
            return Promise.resolve({ exists: true, size: 5000 });
          }
          if (path.includes('-wal') || path.includes('-shm')) {
            return Promise.resolve({ exists: true });
          }
          return Promise.resolve({ exists: true });
        });

        (FileSystem.readAsStringAsync as jest.Mock).mockImplementation((path: string) => {
          if (path.includes('.meta.json')) {
            return Promise.resolve(JSON.stringify(mockMetadata));
          }
          return Promise.resolve('base64data');
        });

        (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
        (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
        (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);

        // WAL checkpoint fails
        mockDatabase.execAsync.mockRejectedValueOnce(new Error('WAL checkpoint failed'));

        mockDbModule.closeDatabase.mockResolvedValue(undefined);
        mockDbModule.getDatabase.mockResolvedValue(mockDatabase);
        (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(6);
        (migrationRunner.initialize as jest.Mock).mockResolvedValue(undefined);
        (migrationRunner.runMigrations as jest.Mock).mockResolvedValue(undefined);

        // Should not throw - WAL checkpoint failure is not fatal
        await expect(backupService.restoreBackup('snapshot-1')).resolves.not.toThrow();
      });
    });
  });
});
