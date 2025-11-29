import { backupServiceImpl } from '../backup/BackupServiceImpl';
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
import { getBackupMetadata } from '../backup/backupUtils';

// Mock dependencies
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file://mockDocDir/',
  cacheDirectory: 'file://mockCacheDir/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  copyAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
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
jest.mock('../../services/errorLogger');

// Mock db module
const mockDatabase = {
  getAllAsync: jest.fn(),
  execAsync: jest.fn(),
  runAsync: jest.fn(),
  closeAsync: jest.fn(),
};

jest.mock('../../database/db', () => ({
  getDatabase: jest.fn(() => Promise.resolve(mockDatabase)),
  closeDatabase: jest.fn(() => Promise.resolve()),
}));

describe('BackupServiceImpl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createSnapshotBackup', () => {
    beforeEach(() => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 5000 });
      (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (mockDatabase.getAllAsync as jest.Mock).mockResolvedValue([{ count: 10 }]);
      (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(6);
    });

    it('should create a snapshot backup successfully', async () => {
      const metadata = await backupServiceImpl.createSnapshotBackup();

      expect(metadata).toBeDefined();
      expect(metadata.id).toBeDefined();
      expect(metadata.backupType).toBe('snapshot');
      expect(metadata.episodeCount).toBe(10);
      expect(metadata.medicationCount).toBe(10);
      expect(FileSystem.copyAsync).toHaveBeenCalled();
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalled(); // For metadata
    });

    it('should throw error if database file does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      await expect(backupServiceImpl.createSnapshotBackup()).rejects.toThrow(
        'Database file not found'
      );
    });

    it('should handle errors during snapshot backup creation', async () => {
      (FileSystem.copyAsync as jest.Mock).mockRejectedValue(new Error('Copy failed'));

      await expect(backupServiceImpl.createSnapshotBackup()).rejects.toThrow(
        'Failed to create snapshot backup'
      );
    });
  });

  describe('exportDatabaseFile', () => {
    beforeEach(() => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 5000 });
      (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);
    });

    it('should export database file successfully', async () => {
      await backupServiceImpl.exportDatabaseFile();

      expect(FileSystem.copyAsync).toHaveBeenCalled();
      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        expect.stringContaining('migralog_'),
        expect.objectContaining({
          mimeType: 'application/x-sqlite3',
          dialogTitle: 'Export MigraLog Database',
        })
      );
      expect(FileSystem.deleteAsync).toHaveBeenCalled();
    });

    it('should throw error if database file does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      await expect(backupServiceImpl.exportDatabaseFile()).rejects.toThrow(
        'Database file not found'
      );
    });

    it('should throw error if sharing is not available', async () => {
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);

      await expect(backupServiceImpl.exportDatabaseFile()).rejects.toThrow(
        'Sharing is not available on this device'
      );
    });

    it('should handle errors during export', async () => {
      (FileSystem.copyAsync as jest.Mock).mockRejectedValue(new Error('Copy failed'));

      await expect(backupServiceImpl.exportDatabaseFile()).rejects.toThrow(
        'Failed to export database file'
      );
    });
  });

  describe('importDatabaseFile', () => {
    const mockDbModule = require('../../database/db');

    beforeEach(() => {
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///path/to/backup.db' }],
      });
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
      mockDbModule.closeDatabase.mockResolvedValue(undefined);
    });

    it('should import database file successfully', async () => {
      await backupServiceImpl.importDatabaseFile();

      expect(mockDbModule.closeDatabase).toHaveBeenCalled();
      expect(FileSystem.copyAsync).toHaveBeenCalledTimes(2); // Backup + Import
      expect(FileSystem.copyAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining('migralog.db'),
          to: expect.stringContaining('migralog_backup_'),
        })
      );
      expect(FileSystem.copyAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'file:///path/to/backup.db',
          to: expect.stringContaining('migralog.db'),
        })
      );
    });

    it('should throw error if import is cancelled', async () => {
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: true,
      });

      await expect(backupServiceImpl.importDatabaseFile()).rejects.toThrow(
        'Import cancelled'
      );
    });

    it('should handle errors during import', async () => {
      (FileSystem.copyAsync as jest.Mock).mockRejectedValue(new Error('Copy failed'));

      await expect(backupServiceImpl.importDatabaseFile()).rejects.toThrow(
        'Failed to import database file'
      );
    });
  });

  describe('exportDataForSharing', () => {
    beforeEach(() => {
      (episodeRepository.getAll as jest.Mock).mockResolvedValue([]);
      (medicationRepository.getAll as jest.Mock).mockResolvedValue([]);
      (medicationDoseRepository.getAll as jest.Mock).mockResolvedValue([]);
      (episodeNoteRepository.getByEpisodeId as jest.Mock).mockResolvedValue([]);
      (intensityRepository.getByEpisodeId as jest.Mock).mockResolvedValue([]);
      (dailyStatusRepository.getDateRange as jest.Mock).mockResolvedValue([]);
      (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([]);
      (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(6);
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);
    });

    it('should export data for sharing successfully', async () => {
      await backupServiceImpl.exportDataForSharing();

      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('migralog_export_'),
        expect.any(String)
      );
      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        expect.stringContaining('migralog_export_'),
        expect.objectContaining({
          mimeType: 'application/json',
          dialogTitle: 'Export MigraLog Data',
        })
      );
    });

    it('should throw error if sharing is not available', async () => {
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);

      await expect(backupServiceImpl.exportDataForSharing()).rejects.toThrow(
        'Sharing is not available on this device'
      );
    });

    it('should handle errors during export', async () => {
      (episodeRepository.getAll as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(backupServiceImpl.exportDataForSharing()).rejects.toThrow(
        'Failed to export data'
      );
    });
  });

  describe('importBackup - database file', () => {
    beforeEach(() => {
      (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 5000 });
      (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(6);
    });

    it('should import .db file as snapshot backup', async () => {
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///path/to/backup.db', name: 'backup.db' }],
      });

      const metadata = await backupServiceImpl.importBackup();

      expect(metadata).toBeDefined();
      expect(metadata.backupType).toBe('snapshot');
      expect(FileSystem.copyAsync).toHaveBeenCalled();
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalled(); // For metadata
    });

    it('should import .sqlite file as snapshot backup', async () => {
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///path/to/backup.sqlite', name: 'backup.sqlite' }],
      });

      const metadata = await backupServiceImpl.importBackup();

      expect(metadata).toBeDefined();
      expect(metadata.backupType).toBe('snapshot');
      expect(FileSystem.copyAsync).toHaveBeenCalled();
    });

    it('should import .sqlite3 file as snapshot backup', async () => {
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///path/to/backup.sqlite3', name: 'backup.sqlite3' }],
      });

      const metadata = await backupServiceImpl.importBackup();

      expect(metadata).toBeDefined();
      expect(metadata.backupType).toBe('snapshot');
      expect(FileSystem.copyAsync).toHaveBeenCalled();
    });
  });

  describe('listBackups - snapshot backups', () => {
    it('should list snapshot backups with metadata files', async () => {
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

      (FileSystem.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: true }) // initialize check
        .mockResolvedValueOnce({ exists: true }) // directory check
        .mockResolvedValueOnce({ exists: true }); // metadata file check
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'snapshot-1.db',
        'snapshot-1.meta.json',
      ]);
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(mockMetadata)
      );

      const backups = await backupServiceImpl.listBackups();

      expect(backups).toHaveLength(1);
      expect(backups[0].id).toBe('snapshot-1');
      expect(backups[0].backupType).toBe('snapshot');
    });

    it('should handle snapshot backups without metadata files', async () => {
      (FileSystem.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: true }) // initialize check
        .mockResolvedValueOnce({ exists: true }) // directory check
        .mockResolvedValueOnce({ exists: false }) // metadata file does not exist
        .mockResolvedValueOnce({ exists: true, size: 5000 }); // DB file exists
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['snapshot-1.db']);

      const backups = await backupServiceImpl.listBackups();

      expect(backups).toHaveLength(1);
      expect(backups[0].id).toBe('snapshot-1');
      expect(backups[0].backupType).toBe('snapshot');
      expect(backups[0].timestamp).toBe(0); // Unknown
    });

    it('should filter out backups with invalid IDs', async () => {
      const invalidMetadata = {
        id: 'undefined',
        timestamp: Date.now(),
        version: '1.0.0',
        schemaVersion: 6,
        episodeCount: 0,
        medicationCount: 0,
        fileSize: 100,
        fileName: 'invalid.db',
        backupType: 'snapshot' as const,
      };

      (FileSystem.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: true }) // initialize check
        .mockResolvedValueOnce({ exists: true }) // directory check
        .mockResolvedValueOnce({ exists: true }); // metadata file check
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'invalid.db',
        'invalid.meta.json',
      ]);
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(invalidMetadata)
      );

      const backups = await backupServiceImpl.listBackups();

      expect(backups).toHaveLength(0); // Should be filtered out
    });
  });

  describe('getBackupMetadata - snapshot backups', () => {
    it('should return metadata for snapshot backup', async () => {
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

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(mockMetadata)
      );

      const metadata = await getBackupMetadata('snapshot-1');

      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe('snapshot-1');
      expect(metadata?.backupType).toBe('snapshot');
    });
  });

  describe('deleteBackup - all file types', () => {
    it('should delete snapshot backup with metadata', async () => {
      (FileSystem.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: true }) // snapshot file
        .mockResolvedValueOnce({ exists: false }) // json file
        .mockResolvedValueOnce({ exists: true }); // metadata file
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      await backupServiceImpl.deleteBackup('backup-1');

      expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(2); // .db and .meta.json
    });

    it('should delete all associated files', async () => {
      (FileSystem.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: true }) // snapshot file
        .mockResolvedValueOnce({ exists: true }) // json file
        .mockResolvedValueOnce({ exists: true }); // metadata file
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      await backupServiceImpl.deleteBackup('backup-1');

      expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(3); // All three files
    });
  });

  describe('formatFileSize', () => {
    it('should format file sizes correctly', () => {
      expect(backupServiceImpl.formatFileSize(0)).toBe('0 Bytes');
      expect(backupServiceImpl.formatFileSize(500)).toBe('500 Bytes');
      expect(backupServiceImpl.formatFileSize(1024)).toBe('1 KB');
      expect(backupServiceImpl.formatFileSize(1536)).toBe('1.5 KB');
      expect(backupServiceImpl.formatFileSize(1048576)).toBe('1 MB');
      expect(backupServiceImpl.formatFileSize(1572864)).toBe('1.5 MB');
      expect(backupServiceImpl.formatFileSize(1073741824)).toBe('1 GB');
    });
  });

  describe('formatDate', () => {
    it('should format timestamps correctly', () => {
      const timestamp = new Date('2025-01-01T12:00:00Z').getTime();
      const formatted = backupServiceImpl.formatDate(timestamp);

      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  describe('getDaysUntilNextWeeklyBackup - error handling', () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');

    it('should handle errors when calculating days', async () => {
      AsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      const result = await backupServiceImpl.getDaysUntilNextWeeklyBackup();

      expect(result).toBe(0);
    });
  });

  describe('restoreBackup', () => {
    const mockDbModule = require('../../database/db');
    const mockMetadata = {
      id: 'test-backup',
      timestamp: Date.now(),
      version: '1.0.0',
      schemaVersion: 6,
      episodeCount: 1,
      medicationCount: 1,
      fileSize: 5000,
      fileName: 'test-backup.db',
      backupType: 'snapshot' as const,
    };

    beforeEach(() => {
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: true });
        }
        if (path.includes('.db')) {
          return Promise.resolve({ exists: true, size: 5000 });
        }
        return Promise.resolve({ exists: true });
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockImplementation((path: string, options?: any) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve(JSON.stringify(mockMetadata));
        }
        if (options?.encoding === 'base64') {
          return Promise.resolve('base64data');
        }
        return Promise.resolve('{}');
      });
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
      (mockDatabase.execAsync as jest.Mock).mockResolvedValue(undefined);
      (mockDatabase.runAsync as jest.Mock).mockResolvedValue(undefined);
      (mockDatabase.getAllAsync as jest.Mock).mockResolvedValue([]);
      (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(6);
      (migrationRunner.initialize as jest.Mock).mockResolvedValue(undefined);
      (migrationRunner.runMigrations as jest.Mock).mockResolvedValue(undefined);
      mockDbModule.closeDatabase.mockResolvedValue(undefined);
      mockDbModule.getDatabase.mockResolvedValue(mockDatabase);
    });

    it('should restore snapshot backup', async () => {
      await backupServiceImpl.restoreBackup('test-backup');

      expect(mockDbModule.closeDatabase).toHaveBeenCalled();
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('migralog.db'),
        'base64data',
        expect.anything()
      );
    });

    it('should throw error if backup not found', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      await expect(backupServiceImpl.restoreBackup('nonexistent')).rejects.toThrow(
        'Backup not found'
      );
    });
  });
});
