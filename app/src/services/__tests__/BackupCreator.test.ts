import { backupCreator } from '../backup/BackupCreator';
import * as FileSystem from 'expo-file-system/legacy';
import { migrationRunner } from '../../database/migrations';
import { episodeRepository, episodeNoteRepository, intensityRepository } from '../../database/episodeRepository';
import { medicationRepository, medicationDoseRepository, medicationScheduleRepository } from '../../database/medicationRepository';
import { dailyStatusRepository } from '../../database/dailyStatusRepository';
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

  describe('createBackup', () => {
    const mockEpisodes = [
      { id: '1', startTime: '2024-01-01T10:00:00Z', painLevel: 7 },
      { id: '2', startTime: '2024-01-02T10:00:00Z', painLevel: 5 },
    ];

    const mockMedications = [
      { id: 'm1', name: 'Med 1', archived: false },
      { id: 'm2', name: 'Med 2', archived: false },
    ];

    const mockDoses = [
      { id: 'd1', medicationId: 'm1', dosage: '500mg', timestamp: '2024-01-01T10:00:00Z' },
    ];

    const mockSchedules = [
      { id: 's1', medicationId: 'm1', frequency: 'daily', time: '09:00' },
    ];

    const mockNotes = [
      { id: 'n1', episodeId: '1', note: 'Test note', timestamp: '2024-01-01T10:00:00Z' },
    ];

    const mockIntensityReadings = [
      { id: 'i1', episodeId: '1', intensity: 7, timestamp: '2024-01-01T10:00:00Z' },
    ];

    const mockDailyStatus = [
      { id: 'ds1', date: '2024-01-01', status: 'good' },
    ];

    beforeEach(() => {
      (episodeRepository.getAll as jest.Mock).mockResolvedValue(mockEpisodes);
      (medicationRepository.getAll as jest.Mock).mockResolvedValue(mockMedications);
      (medicationDoseRepository.getAll as jest.Mock).mockResolvedValue(mockDoses);
      (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue(mockSchedules);
      (episodeNoteRepository.getByEpisodeId as jest.Mock).mockResolvedValue(mockNotes);
      (intensityRepository.getByEpisodeId as jest.Mock).mockResolvedValue(mockIntensityReadings);
      (dailyStatusRepository.getDateRange as jest.Mock).mockResolvedValue(mockDailyStatus);

      (mockDatabase.getAllAsync as jest.Mock).mockResolvedValue([
        { sql: 'CREATE TABLE episodes (id TEXT PRIMARY KEY)' },
        { sql: 'CREATE TABLE medications (id TEXT PRIMARY KEY)' },
      ]);

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 15000 });
    });

    it('should create JSON backup successfully', async () => {
      const metadata = await backupCreator.createBackup(false);

      expect(metadata).toBeDefined();
      expect(metadata.id).toBeDefined();
      expect(metadata.backupType).toBe('json');
      expect(metadata.fileName).toContain('.json');
      expect(metadata.episodeCount).toBe(2);
      expect(metadata.medicationCount).toBe(2);
    });

    it('should include all data types in JSON backup', async () => {
      await backupCreator.createBackup(false);

      const writeCall = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls.find(
        call => call[0].endsWith('.json')
      );

      expect(writeCall).toBeDefined();
      const backupData = JSON.parse(writeCall[1]);

      expect(backupData.episodes).toEqual(mockEpisodes);
      expect(backupData.medications).toEqual(mockMedications);
      expect(backupData.medicationDoses).toEqual(mockDoses);
      expect(backupData.medicationSchedules).toHaveLength(2); // One for each medication
      expect(backupData.episodeNotes).toHaveLength(2); // One for each episode
      expect(backupData.intensityReadings).toHaveLength(2); // One for each episode
      expect(backupData.dailyStatusLogs).toEqual(mockDailyStatus);
    });

    it('should include schema SQL in JSON backup', async () => {
      await backupCreator.createBackup(false);

      const writeCall = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls.find(
        call => call[0].endsWith('.json')
      );

      expect(writeCall).toBeDefined();
      const backupData = JSON.parse(writeCall[1]);

      expect(backupData.schemaSQL).toBeDefined();
      expect(backupData.schemaSQL).toContain('CREATE TABLE episodes');
      expect(backupData.schemaSQL).toContain('CREATE TABLE medications');
    });

    it('should handle empty database gracefully', async () => {
      (episodeRepository.getAll as jest.Mock).mockResolvedValue([]);
      (medicationRepository.getAll as jest.Mock).mockResolvedValue([]);
      (medicationDoseRepository.getAll as jest.Mock).mockResolvedValue([]);
      (dailyStatusRepository.getDateRange as jest.Mock).mockResolvedValue([]);

      const metadata = await backupCreator.createBackup(false);

      expect(metadata.episodeCount).toBe(0);
      expect(metadata.medicationCount).toBe(0);
      expect(metadata).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      (episodeRepository.getAll as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(backupCreator.createBackup(false)).rejects.toThrow(
        'Failed to create backup'
      );
    });

    it('should use provided db connection when available', async () => {
      const customDb = {
        getAllAsync: jest.fn().mockResolvedValue([
          { sql: 'CREATE TABLE custom_table (id TEXT)' },
        ]),
      } as any;

      await backupCreator.createBackup(false, customDb);

      expect(episodeRepository.getAll).toHaveBeenCalledWith(50, 0, customDb);
      expect(medicationRepository.getAll).toHaveBeenCalledWith(customDb);
    });

    it('should handle automatic vs manual backup flag', async () => {
      const autoMetadata = await backupCreator.createBackup(true);
      const manualMetadata = await backupCreator.createBackup(false);

      expect(autoMetadata).toBeDefined();
      expect(manualMetadata).toBeDefined();
      // The flag is passed but doesn't affect metadata - just for logging
      expect(autoMetadata.id).not.toBe(manualMetadata.id);
    });

    it('should write backup files to correct locations', async () => {
      await backupCreator.createBackup(false);

      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('backups'),
        expect.any(String)
      );

      const writeCall = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls[0];
      expect(writeCall[0]).toMatch(/\.json$/);
    });

    it('should fetch correct date range for daily status logs', async () => {
      await backupCreator.createBackup(false);

      expect(dailyStatusRepository.getDateRange).toHaveBeenCalled();
      const call = (dailyStatusRepository.getDateRange as jest.Mock).mock.calls[0];
      
      // Verify it fetches 2 years of data
      const startDate = new Date(call[0]);
      const endDate = new Date(call[1]);
      const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      expect(daysDiff).toBeGreaterThan(700); // ~2 years (allowing for leap years)
      expect(daysDiff).toBeLessThan(750);
    });

    it('should include file size in metadata', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 25000 });

      const metadata = await backupCreator.createBackup(false);

      expect(metadata.fileSize).toBe(25000);
    });

    it('should set fileSize to 0 if file info not available', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      const metadata = await backupCreator.createBackup(false);

      expect(metadata.fileSize).toBe(0);
    });
  });

  describe('Schema export', () => {
    it('should export schema SQL from sqlite_master', async () => {
      const mockSchemaRows = [
        { sql: 'CREATE TABLE episodes (id TEXT PRIMARY KEY, startTime TEXT)' },
        { sql: 'CREATE TABLE medications (id TEXT PRIMARY KEY, name TEXT)' },
        { sql: 'CREATE INDEX idx_episodes_start ON episodes(startTime)' },
      ];

      (mockDatabase.getAllAsync as jest.Mock).mockResolvedValue(mockSchemaRows);
      (episodeRepository.getAll as jest.Mock).mockResolvedValue([]);
      (medicationRepository.getAll as jest.Mock).mockResolvedValue([]);
      (medicationDoseRepository.getAll as jest.Mock).mockResolvedValue([]);
      (dailyStatusRepository.getDateRange as jest.Mock).mockResolvedValue([]);

      await backupCreator.createBackup(false);

      const writeCall = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls.find(
        call => call[0].endsWith('.json')
      );

      const backupData = JSON.parse(writeCall[1]);
      
      expect(backupData.schemaSQL).toContain('CREATE TABLE episodes');
      expect(backupData.schemaSQL).toContain('CREATE TABLE medications');
      expect(backupData.schemaSQL).toContain('CREATE INDEX idx_episodes_start');
    });

    it('should exclude system tables from schema export', async () => {
      const mockSchemaRows = [
        { sql: 'CREATE TABLE episodes (id TEXT PRIMARY KEY)' },
        { sql: 'CREATE TABLE sqlite_sequence (name TEXT, seq INTEGER)' },
        { sql: 'CREATE TABLE schema_version (version INTEGER)' },
      ];

      (mockDatabase.getAllAsync as jest.Mock).mockResolvedValue(mockSchemaRows);
      (episodeRepository.getAll as jest.Mock).mockResolvedValue([]);
      (medicationRepository.getAll as jest.Mock).mockResolvedValue([]);
      (medicationDoseRepository.getAll as jest.Mock).mockResolvedValue([]);
      (dailyStatusRepository.getDateRange as jest.Mock).mockResolvedValue([]);

      await backupCreator.createBackup(false);

      const writeCall = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls.find(
        call => call[0].endsWith('.json')
      );

      // Verify the JSON backup was written
      expect(writeCall).toBeDefined();
      
      // Schema export query should filter these out via WHERE clause
      // The mock returns all rows, but in reality the query filters them
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining("name NOT LIKE 'sqlite_%'")
      );
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining("name != 'schema_version'")
      );
    });

    it('should handle schema export errors', async () => {
      (mockDatabase.getAllAsync as jest.Mock).mockRejectedValue(
        new Error('Schema query failed')
      );

      await expect(backupCreator.createBackup(false)).rejects.toThrow(
        'Failed to export schema SQL'
      );
    });

    it('should filter null SQL statements from schema', async () => {
      const mockSchemaRows = [
        { sql: 'CREATE TABLE episodes (id TEXT PRIMARY KEY)' },
        { sql: null },
        { sql: 'CREATE TABLE medications (id TEXT PRIMARY KEY)' },
      ];

      (mockDatabase.getAllAsync as jest.Mock).mockResolvedValue(mockSchemaRows);
      (episodeRepository.getAll as jest.Mock).mockResolvedValue([]);
      (medicationRepository.getAll as jest.Mock).mockResolvedValue([]);
      (medicationDoseRepository.getAll as jest.Mock).mockResolvedValue([]);
      (dailyStatusRepository.getDateRange as jest.Mock).mockResolvedValue([]);

      await backupCreator.createBackup(false);

      const writeCall = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls.find(
        call => call[0].endsWith('.json')
      );

      expect(writeCall).toBeDefined();
      const backupData = JSON.parse(writeCall![1]);
      
      // Should not include null entries
      expect(backupData.schemaSQL.split(';').filter((s: string) => s.trim()).length).toBe(2);
    });
  });

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
