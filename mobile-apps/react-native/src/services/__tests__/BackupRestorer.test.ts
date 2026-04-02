import { backupRestorer as restoreService } from '../backup/BackupRestorer';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
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
jest.mock('expo-document-picker');
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

describe('RestoreService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getBackupMetadata', () => {
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

    // Note: JSON backup metadata test updated for Issue #185 - JSON restore removed
    // getBackupMetadata now returns null for JSON backups since they can't be restored
    it('should return null for JSON backup (JSON restore removed)', async () => {
      (FileSystem.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: false }) // .meta.json doesn't exist
        .mockResolvedValueOnce({ exists: true, size: 10000 }); // .json exists

      const metadata = await getBackupMetadata('json-backup');

      // JSON backups no longer return metadata since they can't be restored
      expect(metadata).toBeNull();
    });

    it('should return null if backup does not exist', async () => {
      // Override any existing mocks to ensure file doesn't exist
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(() => 
        Promise.resolve({ exists: false })
      );
      (FileSystem.readAsStringAsync as jest.Mock).mockImplementation(() => 
        Promise.reject(new Error('File should not be read'))
      );

      const metadata = await getBackupMetadata('nonexistent');

      expect(metadata).toBeNull();
    });

    it('should return null on error', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(new Error('File error'));

      const metadata = await getBackupMetadata('backup-1');

      expect(metadata).toBeNull();
    });
  });

  describe('restoreBackup', () => {
    it('should throw error if backup not found', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      await expect(restoreService.restoreBackup('nonexistent')).rejects.toThrow(
        'Backup not found'
      );
    });
  });

  describe('restoreSnapshotBackup', () => {
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

    beforeEach(() => {
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: true });
        }
        if (path.includes('snapshot-1.db')) {
          return Promise.resolve({ exists: true, size: 5000 });
        }
        return Promise.resolve({ exists: true });
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockImplementation((path: string, options?: any) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve(JSON.stringify(mockMetadata));
        }
        if (options?.encoding === FileSystem.EncodingType.Base64) {
          return Promise.resolve('base64encodeddata');
        }
        return Promise.resolve('{}');
      });
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
      (mockDatabase.execAsync as jest.Mock).mockResolvedValue(undefined);
      (mockDatabase.runAsync as jest.Mock).mockResolvedValue(undefined);
      (mockDatabase.getAllAsync as jest.Mock).mockResolvedValue([]);
      (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(6);
      (migrationRunner.initialize as jest.Mock).mockResolvedValue(undefined);
      (migrationRunner.runMigrations as jest.Mock).mockResolvedValue(undefined);
      mockDbModule.closeDatabase.mockResolvedValue(undefined);
      mockDbModule.getDatabase.mockResolvedValue(mockDatabase);
    });

    it('should restore snapshot backup successfully', async () => {
      await restoreService.restoreBackup('snapshot-1');

      expect(mockDbModule.closeDatabase).toHaveBeenCalled();
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('migralog.db'),
        'base64encodeddata',
        expect.objectContaining({
          encoding: FileSystem.EncodingType.Base64,
        })
      );
      expect(mockDbModule.getDatabase).toHaveBeenCalled();
      expect(migrationRunner.initialize).toHaveBeenCalled();
    });

    it('should throw error if backup file not found', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: true });
        }
        if (path.includes('snapshot-1.db')) {
          return Promise.resolve({ exists: false });
        }
        return Promise.resolve({ exists: true });
      });

      await expect(restoreService.restoreBackup('snapshot-1')).rejects.toThrow(
        'Snapshot backup file not found'
      );
    });

    it('should reject restoring backup from newer schema version', async () => {
      const newerMetadata = {
        ...mockMetadata,
        schemaVersion: 10,
      };

      (FileSystem.readAsStringAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve(JSON.stringify(newerMetadata));
        }
        return Promise.resolve('{}');
      });
      (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(6);

      await expect(restoreService.restoreBackup('snapshot-1')).rejects.toThrow(
        'Cannot restore backup from newer schema version'
      );
    });

    it('should create safety backup before restoring', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: true });
        }
        if (path.includes('snapshot-1.db')) {
          return Promise.resolve({ exists: true, size: 5000 });
        }
        if (path.includes('migralog.db') && !path.includes('-wal') && !path.includes('-shm')) {
          return Promise.resolve({ exists: true });
        }
        return Promise.resolve({ exists: false });
      });

      await restoreService.restoreBackup('snapshot-1');

      expect(FileSystem.copyAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining('migralog.db'),
          to: expect.stringContaining('migralog_pre_restore_'),
        })
      );
    });

    it('should delete WAL and SHM files if they exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('-wal') || path.includes('-shm')) {
          return Promise.resolve({ exists: true });
        }
        return Promise.resolve({ exists: true });
      });

      await restoreService.restoreBackup('snapshot-1');

      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining('-wal')
      );
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining('-shm')
      );
    });

    it('should run migrations if backup is older version', async () => {
      const olderMetadata = {
        ...mockMetadata,
        schemaVersion: 4,
      };

      (FileSystem.readAsStringAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve(JSON.stringify(olderMetadata));
        }
        return Promise.resolve('{}');
      });
      (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(6);

      await restoreService.restoreBackup('snapshot-1');

      expect(migrationRunner.runMigrations).toHaveBeenCalled();
    });

    it('should handle WAL checkpoint failure gracefully', async () => {
      (mockDatabase.execAsync as jest.Mock).mockRejectedValueOnce(
        new Error('WAL checkpoint failed')
      );

      // Should not throw - WAL checkpoint failure is logged but not fatal
      await expect(restoreService.restoreBackup('snapshot-1')).resolves.not.toThrow();
    });
  });

  // Note: JSON restore tests removed in Issue #185 - JSON restore functionality removed
  // All tests for restoreJsonBackup, including insert helpers, schema restoration,
  // migrations, etc. have been removed since JSON restore is no longer supported.
  describe('JSON restore (removed)', () => {
    it('should throw error when trying to restore JSON backup (JSON restore removed)', async () => {
      // getBackupMetadata returns null for JSON-only backups,
      // so restoreBackup will throw "Backup not found"
      (FileSystem.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: false }) // .meta.json doesn't exist
        .mockResolvedValueOnce({ exists: true }); // .json exists

      await expect(restoreService.restoreBackup('json-backup')).rejects.toThrow(
        'Backup not found'
      );
    });
  });

  describe('importDatabaseFile', () => {
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
      await restoreService.importDatabaseFile();

      expect(mockDbModule.closeDatabase).toHaveBeenCalled();
      expect(FileSystem.copyAsync).toHaveBeenCalledTimes(2); // Backup + Import
    });

    it('should throw error if import is cancelled', async () => {
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: true,
      });

      await expect(restoreService.importDatabaseFile()).rejects.toThrow(
        'Import cancelled'
      );
    });

    it('should create backup before importing', async () => {
      await restoreService.importDatabaseFile();

      expect(FileSystem.copyAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining('migralog.db'),
          to: expect.stringContaining('migralog_backup_'),
        })
      );
    });

    it('should handle errors during import', async () => {
      (FileSystem.copyAsync as jest.Mock).mockRejectedValue(new Error('Copy failed'));

      await expect(restoreService.importDatabaseFile()).rejects.toThrow(
        'Failed to import database file'
      );
    });
  });
});
