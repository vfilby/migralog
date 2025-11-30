import { backupValidator } from '../backup/BackupValidator';
import * as FileSystem from 'expo-file-system/legacy';
import { logger } from '../../utils/logger';

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

jest.mock('../../database/episodeRepository');
jest.mock('../../database/medicationRepository');
jest.mock('../../database/dailyStatusRepository');
jest.mock('../../database/migrations');
jest.mock('../../utils/logger', () => ({
  logger: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('BackupValidator', () => {
  const BACKUP_DIR = 'file://mockDocDir/backups/';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('checkForBrokenBackups', () => {
    it('should return 0 when no backups exist', async () => {
      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      const count = await backupValidator.checkForBrokenBackups();

      expect(count).toBe(0);
    });

    it('should count JSON backups with invalid metadata (missing id)', async () => {
      const invalidBackupData = {
        metadata: {
          // id is missing
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: 6,
          episodeCount: 5,
          medicationCount: 3,
        },
        episodes: [],
        medications: [],
      };

      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['broken-backup.json']);
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(invalidBackupData)
      );

      const count = await backupValidator.checkForBrokenBackups();

      expect(count).toBe(1);
    });

    it('should count JSON backups with missing metadata', async () => {
      const invalidBackupData = {
        // metadata is completely missing
        episodes: [],
        medications: [],
      };

      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['broken-backup.json']);
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(invalidBackupData)
      );

      const count = await backupValidator.checkForBrokenBackups();

      expect(count).toBe(1);
    });

    it('should count orphaned .meta.json files (no corresponding .db)', async () => {
      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath === BACKUP_DIR) {
          return Promise.resolve({ exists: true });
        }
        // .db file doesn't exist (orphaned metadata)
        if (filePath.includes('.db')) {
          return Promise.resolve({ exists: false });
        }
        return Promise.resolve({ exists: true });
      });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'orphaned-backup.meta.json',
      ]);

      const count = await backupValidator.checkForBrokenBackups();

      expect(count).toBe(1);
    });

    it('should count corrupted/unparseable JSON files', async () => {
      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['corrupted.json']);
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('{ invalid json :::');

      const count = await backupValidator.checkForBrokenBackups();

      expect(count).toBe(1);
    });

    it('should not count valid JSON backups', async () => {
      const validBackupData = {
        metadata: {
          id: 'valid-backup-1',
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: 6,
          episodeCount: 5,
          medicationCount: 3,
        },
        episodes: [],
        medications: [],
      };

      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['valid-backup.json']);
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(validBackupData)
      );

      const count = await backupValidator.checkForBrokenBackups();

      expect(count).toBe(0);
    });

    it('should not count .meta.json files with corresponding .db files', async () => {
      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(() => {
        // Both .meta.json and .db exist
        return Promise.resolve({ exists: true });
      });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'valid-backup.meta.json',
      ]);

      const count = await backupValidator.checkForBrokenBackups();

      expect(count).toBe(0);
    });

    it('should count multiple broken backups correctly', async () => {
      const invalidBackupData = {
        metadata: {
          // id is missing
          timestamp: Date.now(),
        },
      };

      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath === BACKUP_DIR) {
          return Promise.resolve({ exists: true });
        }
        // .db files don't exist (orphaned metadata)
        if (filePath.includes('.db')) {
          return Promise.resolve({ exists: false });
        }
        return Promise.resolve({ exists: true });
      });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'broken1.json',
        'broken2.json',
        'orphaned1.meta.json',
        'orphaned2.meta.json',
      ]);
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(invalidBackupData)
      );

      const count = await backupValidator.checkForBrokenBackups();

      expect(count).toBe(4); // 2 invalid JSON + 2 orphaned .meta.json
    });

    it('should return 0 on error', async () => {
      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(new Error('File system error'));

      const count = await backupValidator.checkForBrokenBackups();

      expect(count).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(
        '[Backup] Failed to check for broken backups:',
        expect.any(Error)
      );
    });

    it('should not count .meta.json files when processing them', async () => {
      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'backup.meta.json',
        'backup.db',
      ]);

      const count = await backupValidator.checkForBrokenBackups();

      expect(count).toBe(0);
      // readAsStringAsync should not be called for .meta.json files in the JSON backup check
      expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
    });
  });

  describe('cleanupBrokenBackups', () => {
    it('should delete JSON backups with invalid metadata', async () => {
      const invalidBackupData = {
        metadata: {
          // id is missing
          timestamp: Date.now(),
          version: '1.0.0',
        },
        episodes: [],
      };

      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['broken-backup.json']);
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(invalidBackupData)
      );
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      const count = await backupValidator.cleanupBrokenBackups();

      expect(count).toBe(1);
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        BACKUP_DIR + 'broken-backup.json'
      );
      expect(logger.log).toHaveBeenCalledWith(
        '[Cleanup] Deleting broken JSON backup: broken-backup.json'
      );
    });

    it('should delete orphaned .meta.json files', async () => {
      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath === BACKUP_DIR) {
          return Promise.resolve({ exists: true });
        }
        // .db file doesn't exist (orphaned metadata)
        if (filePath.includes('.db')) {
          return Promise.resolve({ exists: false });
        }
        return Promise.resolve({ exists: true });
      });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'orphaned-backup.meta.json',
      ]);
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      const count = await backupValidator.cleanupBrokenBackups();

      expect(count).toBe(1);
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        BACKUP_DIR + 'orphaned-backup.meta.json'
      );
      expect(logger.log).toHaveBeenCalledWith(
        '[Cleanup] Deleting orphaned metadata file: orphaned-backup.meta.json'
      );
    });

    it('should delete corrupted JSON files', async () => {
      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['corrupted.json']);
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('{ invalid json :::');
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      const count = await backupValidator.cleanupBrokenBackups();

      expect(count).toBe(1);
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(BACKUP_DIR + 'corrupted.json');
      expect(logger.log).toHaveBeenCalledWith(
        '[Cleanup] Deleting corrupted JSON backup: corrupted.json'
      );
    });

    it('should not delete valid JSON backups', async () => {
      const validBackupData = {
        metadata: {
          id: 'valid-backup-1',
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: 6,
          episodeCount: 5,
          medicationCount: 3,
        },
        episodes: [],
        medications: [],
      };

      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['valid-backup.json']);
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(validBackupData)
      );

      const count = await backupValidator.cleanupBrokenBackups();

      expect(count).toBe(0);
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });

    it('should not delete valid .meta.json files with corresponding .db files', async () => {
      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(() => {
        // Both .meta.json and .db exist
        return Promise.resolve({ exists: true });
      });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'valid-backup.meta.json',
      ]);

      const count = await backupValidator.cleanupBrokenBackups();

      expect(count).toBe(0);
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });

    it('should return count of deleted files', async () => {
      const invalidBackupData = {
        metadata: {
          timestamp: Date.now(),
        },
      };

      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath === BACKUP_DIR) {
          return Promise.resolve({ exists: true });
        }
        // .db files don't exist (orphaned metadata)
        if (filePath.includes('.db')) {
          return Promise.resolve({ exists: false });
        }
        return Promise.resolve({ exists: true });
      });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'broken1.json',
        'broken2.json',
        'orphaned1.meta.json',
      ]);
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(invalidBackupData)
      );
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      const count = await backupValidator.cleanupBrokenBackups();

      expect(count).toBe(3);
      expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(3);
    });

    it('should handle directory not existing', async () => {
      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      const count = await backupValidator.cleanupBrokenBackups();

      expect(count).toBe(0);
      expect(FileSystem.readDirectoryAsync).not.toHaveBeenCalled();
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });

    it('should log summary of cleanup operation', async () => {
      const invalidBackupData = {
        metadata: {},
      };

      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'broken1.json',
        'broken2.json',
      ]);
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(invalidBackupData)
      );
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      await backupValidator.cleanupBrokenBackups();

      expect(logger.log).toHaveBeenCalledWith(
        '[Cleanup] Cleaned up 2 broken backup file(s)'
      );
    });

    it('should throw error on failure', async () => {
      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(
        new Error('File system error')
      );

      await expect(backupValidator.cleanupBrokenBackups()).rejects.toThrow(
        'Failed to cleanup broken backups: File system error'
      );
      expect(logger.error).toHaveBeenCalledWith(
        '[Cleanup] Failed to cleanup broken backups:',
        expect.any(Error)
      );
    });

    it('should handle delete failure gracefully for corrupted files', async () => {
      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['corrupted.json']);
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('{ invalid json :::');
      (FileSystem.deleteAsync as jest.Mock).mockRejectedValue(
        new Error('Permission denied')
      );

      const count = await backupValidator.cleanupBrokenBackups();

      expect(count).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(
        '[Cleanup] Failed to process corrupted.json:',
        expect.any(Error)
      );
      expect(logger.error).toHaveBeenCalledWith(
        '[Cleanup] Failed to delete corrupted backup corrupted.json:',
        expect.any(Error)
      );
    });

    it('should continue processing after individual file errors', async () => {
      const validBackupData = {
        metadata: {
          id: 'valid',
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: 6,
          episodeCount: 0,
          medicationCount: 0,
        },
      };
      const invalidBackupData = {
        metadata: {},
      };

      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'corrupted.json',
        'valid.json',
        'broken.json',
      ]);
      (FileSystem.readAsStringAsync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('corrupted')) {
          return Promise.resolve('{ invalid');
        }
        if (filePath.includes('valid')) {
          return Promise.resolve(JSON.stringify(validBackupData));
        }
        if (filePath.includes('broken')) {
          return Promise.resolve(JSON.stringify(invalidBackupData));
        }
        return Promise.resolve('{}');
      });
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      const count = await backupValidator.cleanupBrokenBackups();

      expect(count).toBe(2); // corrupted.json and broken.json
      expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(2);
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(BACKUP_DIR + 'corrupted.json');
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(BACKUP_DIR + 'broken.json');
    });
  });
});
