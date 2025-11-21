import { restoreService } from '../RestoreService';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import {
  episodeRepository,
  episodeNoteRepository,
} from '../../database/episodeRepository';
import {
  medicationRepository,
  medicationDoseRepository,
  medicationScheduleRepository,
} from '../../database/medicationRepository';
import { migrationRunner } from '../../database/migrations';
import { BackupData } from '../../models/types';

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

      const metadata = await restoreService.getBackupMetadata('snapshot-1');

      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe('snapshot-1');
      expect(metadata?.backupType).toBe('snapshot');
    });

    it('should return metadata for JSON backup', async () => {
      const mockBackupData: BackupData = {
        metadata: {
          id: 'json-backup',
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: 6,
          episodeCount: 3,
          medicationCount: 2,
        },
        schemaSQL: 'CREATE TABLE episodes (...);',
        episodes: [],
        episodeNotes: [],
        intensityReadings: [],
        dailyStatusLogs: [],
        medications: [],
        medicationDoses: [],
        medicationSchedules: [],
      };

      (FileSystem.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: false }) // .meta.json doesn't exist
        .mockResolvedValueOnce({ exists: true, size: 10000 }); // .json exists
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(mockBackupData)
      );

      const metadata = await restoreService.getBackupMetadata('json-backup');

      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe('json-backup');
      expect(metadata?.backupType).toBe('json');
      expect(metadata?.fileSize).toBe(10000);
    });

    it('should return null if backup does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      const metadata = await restoreService.getBackupMetadata('nonexistent');

      expect(metadata).toBeNull();
    });

    it('should return null on error', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(new Error('File error'));

      const metadata = await restoreService.getBackupMetadata('backup-1');

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

  describe('restoreJsonBackup', () => {
    const mockBackupData: BackupData = {
      metadata: {
        id: 'json-backup',
        timestamp: Date.now(),
        version: '1.0.0',
        schemaVersion: 6,
        episodeCount: 1,
        medicationCount: 1,
      },
      schemaSQL: 'CREATE TABLE episodes (...);',
      episodes: [
        {
          id: 'ep-1',
          startTime: Date.now(),
          endTime: undefined,
          locations: [],
          qualities: [],
          symptoms: [],
          triggers: [],
          notes: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      episodeNotes: [],
      intensityReadings: [],
      dailyStatusLogs: [],
      medications: [
        {
          id: 'med-1',
          name: 'Test',
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
      ],
      medicationDoses: [],
      medicationSchedules: [],
    };

    beforeEach(() => {
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: false });
        }
        if (path.includes('.json')) {
          return Promise.resolve({ exists: true, size: 10000 });
        }
        return Promise.resolve({ exists: true });
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(mockBackupData)
      );
      (mockDatabase.getAllAsync as jest.Mock).mockResolvedValue([]);
      (mockDatabase.execAsync as jest.Mock).mockResolvedValue(undefined);
      (mockDatabase.runAsync as jest.Mock).mockResolvedValue(undefined);
      (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(6);
      (migrationRunner.runMigrations as jest.Mock).mockResolvedValue(undefined);
      mockDbModule.getDatabase.mockResolvedValue(mockDatabase);
    });

    it('should restore JSON backup successfully', async () => {
      await restoreService.restoreBackup('json-backup');

      expect(mockDatabase.execAsync).toHaveBeenCalledWith(mockBackupData.schemaSQL);
      expect(mockDatabase.runAsync).toHaveBeenCalled();
    });

    it('should throw error if backup has invalid format', async () => {
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify({ metadata: { id: 'test' } })
      );

      await expect(restoreService.restoreBackup('json-backup')).rejects.toThrow(
        'Invalid backup file format'
      );
    });

    it('should restore old backup without schemaSQL using legacy method', async () => {
      const oldBackup = { ...mockBackupData };
      delete (oldBackup as any).schemaSQL;

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(oldBackup)
      );
      (episodeRepository.deleteAll as jest.Mock).mockResolvedValue(undefined);
      (episodeNoteRepository.deleteAll as jest.Mock).mockResolvedValue(undefined);
      (medicationRepository.deleteAll as jest.Mock).mockResolvedValue(undefined);
      (medicationDoseRepository.deleteAll as jest.Mock).mockResolvedValue(undefined);
      (medicationScheduleRepository.deleteAll as jest.Mock).mockResolvedValue(undefined);

      await restoreService.restoreBackup('json-backup');

      expect(episodeRepository.deleteAll).toHaveBeenCalled();
      expect(medicationRepository.deleteAll).toHaveBeenCalled();
      expect(mockDatabase.runAsync).toHaveBeenCalled();
    });

    it('should reject restoring backup from newer schema version', async () => {
      const newerBackup = {
        ...mockBackupData,
        metadata: { ...mockBackupData.metadata, schemaVersion: 10 },
      };

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(newerBackup)
      );
      (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(6);

      await expect(restoreService.restoreBackup('json-backup')).rejects.toThrow(
        'Cannot restore backup from newer schema version'
      );
    });

    it('should run migrations for older backup schema', async () => {
      const olderBackup = {
        ...mockBackupData,
        metadata: { ...mockBackupData.metadata, schemaVersion: 4 },
      };

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(olderBackup)
      );
      (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(6);

      await restoreService.restoreBackup('json-backup');

      expect(migrationRunner.runMigrations).toHaveBeenCalled();
    });

    it('should drop existing tables before restoring', async () => {
      (mockDatabase.getAllAsync as jest.Mock)
        .mockResolvedValueOnce([
          { name: 'episodes' },
          { name: 'medications' },
        ])
        .mockResolvedValueOnce([
          { name: 'idx_episodes' },
        ]);

      await restoreService.restoreBackup('json-backup');

      expect(mockDatabase.execAsync).toHaveBeenCalledWith(
        'DROP TABLE IF EXISTS episodes'
      );
      expect(mockDatabase.execAsync).toHaveBeenCalledWith(
        'DROP TABLE IF EXISTS medications'
      );
      expect(mockDatabase.execAsync).toHaveBeenCalledWith(
        'DROP INDEX IF EXISTS idx_episodes'
      );
    });

    it('should set schema version after restoring', async () => {
      await restoreService.restoreBackup('json-backup');

      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'UPDATE schema_version SET version = ?, updated_at = ? WHERE id = 1',
        expect.arrayContaining([6, expect.any(Number)])
      );
    });

    it('should insert episode notes if present', async () => {
      const backupWithNotes = {
        ...mockBackupData,
        episodeNotes: [
          {
            id: 'note-1',
            episodeId: 'ep-1',
            timestamp: Date.now(),
            note: 'Test note',
            createdAt: Date.now(),
          },
        ],
      };

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(backupWithNotes)
      );

      await restoreService.restoreBackup('json-backup');

      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO episode_notes'),
        expect.any(Array)
      );
    });

    it('should insert intensity readings if present', async () => {
      const backupWithReadings = {
        ...mockBackupData,
        intensityReadings: [
          {
            id: 'reading-1',
            episodeId: 'ep-1',
            timestamp: Date.now(),
            intensity: 5,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      };

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(backupWithReadings)
      );

      await restoreService.restoreBackup('json-backup');

      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO intensity_readings'),
        expect.any(Array)
      );
    });

    it('should insert daily status logs if present', async () => {
      const backupWithStatus = {
        ...mockBackupData,
        dailyStatusLogs: [
          {
            id: 'status-1',
            date: '2025-01-01',
            status: 'good',
            statusType: 'user',
            notes: undefined,
            prompted: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      };

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(backupWithStatus)
      );

      await restoreService.restoreBackup('json-backup');

      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO daily_status_logs'),
        expect.any(Array)
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
