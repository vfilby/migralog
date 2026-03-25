import { backupServiceImpl } from '../backup/BackupServiceImpl';
import * as FileSystem from 'expo-file-system/legacy';

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
jest.mock('../backup/BackupCreator', () => ({
  backupCreator: {
    createSnapshotBackup: jest.fn(),
  },
}));
jest.mock('../backup/BackupValidator', () => ({
  backupValidator: {
    checkForBrokenBackups: jest.fn(),
    cleanupBrokenBackups: jest.fn(),
  },
}));
jest.mock('../backup/BackupExporter', () => ({
  backupExporter: {
    exportDataAsJson: jest.fn(),
    exportBackup: jest.fn(),
    importBackup: jest.fn(),
    exportDatabaseFile: jest.fn(),
  },
}));

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

  describe('delegation', () => {
    it('should delegate createSnapshotBackup to BackupCreator', async () => {
      const { backupCreator } = require('../backup/BackupCreator');
      const mockMetadata = { id: 'test', timestamp: Date.now() };
      backupCreator.createSnapshotBackup.mockResolvedValue(mockMetadata);

      const result = await backupServiceImpl.createSnapshotBackup();

      expect(backupCreator.createSnapshotBackup).toHaveBeenCalled();
      expect(result).toEqual(mockMetadata);
    });

    it('should delegate exportDataAsJson to BackupExporter', async () => {
      const { backupExporter } = require('../backup/BackupExporter');
      backupExporter.exportDataAsJson.mockResolvedValue(undefined);

      await backupServiceImpl.exportDataAsJson();

      expect(backupExporter.exportDataAsJson).toHaveBeenCalled();
    });

    it('should delegate checkForBrokenBackups to BackupValidator', async () => {
      const { backupValidator } = require('../backup/BackupValidator');
      backupValidator.checkForBrokenBackups.mockResolvedValue(5);

      const result = await backupServiceImpl.checkForBrokenBackups();

      expect(backupValidator.checkForBrokenBackups).toHaveBeenCalled();
      expect(result).toBe(5);
    });
  });

  describe('listBackups', () => {
    it('should list snapshot backups', async () => {
      const mockMetadata = {
        id: 'backup-1',
        timestamp: Date.now(),
        version: '1.0.0',
        schemaVersion: 6,
        episodeCount: 5,
        medicationCount: 3,
        backupType: 'snapshot',
        fileName: 'backup-1.db',
        fileSize: 5000,
      };

      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('backups') && !path.includes('.')) {
          return Promise.resolve({ exists: true });
        }
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: true });
        }
        return Promise.resolve({ exists: true, size: 5000 });
      });

      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'backup-1.db',
        'backup-1.meta.json',
      ]);

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(mockMetadata)
      );

      const backups = await backupServiceImpl.listBackups();

      expect(backups).toHaveLength(1);
      expect(backups[0].id).toBe('backup-1');
    });

    it('should return empty array when directory does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      const backups = await backupServiceImpl.listBackups();

      expect(backups).toEqual([]);
    });
  });

  describe('deleteBackup', () => {
    it('should delete snapshot backup files', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.db')) {
          return Promise.resolve({ exists: true });
        }
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: true });
        }
        return Promise.resolve({ exists: false });
      });

      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      await backupServiceImpl.deleteBackup('test-backup');

      expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(2); // .db and .meta.json
    });

    it('should throw error when no files found', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      await expect(backupServiceImpl.deleteBackup('nonexistent')).rejects.toThrow(
        'Backup files not found'
      );
    });
  });

  describe('formatFileSize', () => {
    it('should format file sizes correctly', () => {
      expect(backupServiceImpl.formatFileSize(0)).toBe('0 Bytes');
      expect(backupServiceImpl.formatFileSize(1024)).toBe('1 KB');
      expect(backupServiceImpl.formatFileSize(1048576)).toBe('1 MB');
    });
  });

  describe('formatDate', () => {
    it('should format timestamps correctly', () => {
      const timestamp = Date.now();
      const formatted = backupServiceImpl.formatDate(timestamp);

      expect(typeof formatted).toBe('string');
      expect(formatted).toBeDefined();
    });
  });
});
