import { backupCreator } from '../backup/BackupCreator';
import * as FileSystem from 'expo-file-system/legacy';
import { migrationRunner } from '../../database/migrations';
import { errorLogger } from '../errorLogger';

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

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(),
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

// Mock buildInfo
jest.mock('../../buildInfo', () => ({
  buildInfo: {
    version: '1.0.0',
    buildNumber: '1',
    buildDate: '2024-01-01',
  },
}));

describe('BackupCreator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();

    // Setup default mocks
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
    (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(6);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createSnapshotBackup', () => {
    beforeEach(() => {
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('migralog.db')) {
          return Promise.resolve({ exists: true, size: 10000 });
        }
        if (path.includes('.db') && !path.includes('migralog')) {
          return Promise.resolve({ exists: true, size: 10000 });
        }
        return Promise.resolve({ exists: true });
      });

      (mockDatabase.getAllAsync as jest.Mock).mockImplementation((query: string) => {
        if (query.includes('COUNT') && query.includes('episodes')) {
          return Promise.resolve([{ count: 5 }]);
        }
        if (query.includes('COUNT') && query.includes('medications')) {
          return Promise.resolve([{ count: 3 }]);
        }
        return Promise.resolve([]);
      });
    });

    it('should create snapshot backup successfully with metadata', async () => {
      const metadata = await backupCreator.createSnapshotBackup();

      expect(metadata).toBeDefined();
      expect(metadata.id).toBeDefined();
      expect(metadata.timestamp).toBeDefined();
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.schemaVersion).toBe(6);
      expect(metadata.episodeCount).toBe(5);
      expect(metadata.medicationCount).toBe(3);
      expect(metadata.fileSize).toBe(10000);
      expect(metadata.backupType).toBe('snapshot');
      expect(metadata.fileName).toContain('.db');
    });

    it('should throw error when database file not found', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('migralog.db')) {
          return Promise.resolve({ exists: false });
        }
        return Promise.resolve({ exists: true });
      });

      await expect(backupCreator.createSnapshotBackup()).rejects.toThrow(
        'Database file not found'
      );
    });

    it('should generate correct metadata with counts and file size', async () => {
      (mockDatabase.getAllAsync as jest.Mock).mockImplementation((query: string) => {
        if (query.includes('COUNT') && query.includes('episodes')) {
          return Promise.resolve([{ count: 15 }]);
        }
        if (query.includes('COUNT') && query.includes('medications')) {
          return Promise.resolve([{ count: 8 }]);
        }
        return Promise.resolve([]);
      });

      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('migralog.db')) {
          return Promise.resolve({ exists: true, size: 50000 });
        }
        if (path.includes('.db') && !path.includes('migralog')) {
          return Promise.resolve({ exists: true, size: 50000 });
        }
        return Promise.resolve({ exists: true });
      });

      const metadata = await backupCreator.createSnapshotBackup();

      expect(metadata.episodeCount).toBe(15);
      expect(metadata.medicationCount).toBe(8);
      expect(metadata.fileSize).toBe(50000);
    });

    it('should log to errorLogger on failure', async () => {
      const testError = new Error('Copy failed');
      (FileSystem.copyAsync as jest.Mock).mockRejectedValue(testError);

      await expect(backupCreator.createSnapshotBackup()).rejects.toThrow();

      expect(errorLogger.log).toHaveBeenCalledWith(
        'storage',
        'Failed to create snapshot backup',
        testError,
        { operation: 'createSnapshotBackup' }
      );
    });

    it('should copy database file to correct backup location', async () => {
      await backupCreator.createSnapshotBackup();

      expect(FileSystem.copyAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining('migralog.db'),
          to: expect.stringContaining('.db'),
        })
      );
    });

    it('should write metadata file to correct location', async () => {
      await backupCreator.createSnapshotBackup();

      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('.meta.json'),
        expect.stringContaining('"backupType": "snapshot"')
      );
    });

    it('should use provided db connection when available', async () => {
      const customDb = {
        getAllAsync: jest.fn().mockImplementation((query: string) => {
          if (query.includes('COUNT') && query.includes('episodes')) {
            return Promise.resolve([{ count: 10 }]);
          }
          if (query.includes('COUNT') && query.includes('medications')) {
            return Promise.resolve([{ count: 5 }]);
          }
          return Promise.resolve([]);
        }),
      } as any;

      const metadata = await backupCreator.createSnapshotBackup(customDb);

      expect(customDb.getAllAsync).toHaveBeenCalled();
      expect(metadata.episodeCount).toBe(10);
      expect(metadata.medicationCount).toBe(5);
    });

    it('should handle count query errors gracefully', async () => {
      (mockDatabase.getAllAsync as jest.Mock).mockRejectedValue(
        new Error('Query failed')
      );

      const metadata = await backupCreator.createSnapshotBackup();

      // Should still create backup with 0 counts
      expect(metadata.episodeCount).toBe(0);
      expect(metadata.medicationCount).toBe(0);
    });

    it('should create backup directory if it does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('backups') && !path.includes('.')) {
          return Promise.resolve({ exists: false });
        }
        if (path.includes('migralog.db')) {
          return Promise.resolve({ exists: true, size: 10000 });
        }
        if (path.includes('.db') && !path.includes('migralog')) {
          return Promise.resolve({ exists: true, size: 10000 });
        }
        return Promise.resolve({ exists: true });
      });

      await backupCreator.createSnapshotBackup();

      expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        expect.stringContaining('backups'),
        expect.any(Object)
      );
    });
  });

  // createBackup method removed - Issue #185: JSON backup functionality removed

  // Schema export tests removed - Issue #185: JSON backup functionality removed (schema export was only for JSON backups)

  describe('Error handling', () => {
    it('should throw meaningful error when backup directory creation fails', async () => {
      (FileSystem.makeDirectoryAsync as jest.Mock).mockRejectedValue(
        new Error('Permission denied')
      );
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      await expect(backupCreator.createSnapshotBackup()).rejects.toThrow();
    });

    it('should throw meaningful error when file copy fails', async () => {
      (FileSystem.copyAsync as jest.Mock).mockRejectedValue(
        new Error('No space left on device')
      );

      await expect(backupCreator.createSnapshotBackup()).rejects.toThrow(
        'Failed to create snapshot backup'
      );
    });

    it('should throw meaningful error when metadata write fails', async () => {
      (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValue(
        new Error('Write failed')
      );

      await expect(backupCreator.createSnapshotBackup()).rejects.toThrow(
        'Failed to create snapshot backup'
      );
    });

    it('should handle errorLogger failures gracefully in snapshot backup', async () => {
      (FileSystem.copyAsync as jest.Mock).mockRejectedValue(new Error('Copy failed'));
      (errorLogger.log as jest.Mock).mockRejectedValue(new Error('Logger failed'));

      await expect(backupCreator.createSnapshotBackup()).rejects.toThrow(
        'Failed to create snapshot backup'
      );

      // Error should still be thrown even if errorLogger fails
      expect(errorLogger.log).toHaveBeenCalled();
    });
  });
});
