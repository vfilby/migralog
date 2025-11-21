import { backupService, BackupData } from '../backupService';
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
import { Episode, Medication, MedicationDose, EpisodeNote } from '../../models/types';

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
};

jest.mock('../../database/db', () => ({
  getDatabase: jest.fn(() => Promise.resolve(mockDatabase)),
}));

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

  describe('initialize', () => {
    it('should create backup directory if it does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);

      await backupService.initialize();

      expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(BACKUP_DIR, {
        intermediates: true,
      });
    });

    it('should not create directory if it already exists', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });

      await backupService.initialize();

      expect(FileSystem.makeDirectoryAsync).not.toHaveBeenCalled();
    });
  });

  describe('createBackup', () => {
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
      (mockDatabase.getAllAsync as jest.Mock).mockResolvedValue([
        { sql: 'CREATE TABLE episodes (...)' },
      ]);
    });

    it('should create a backup successfully', async () => {
      const metadata = await backupService.createBackup();

      expect(metadata.id).toBeDefined();
      expect(metadata.episodeCount).toBe(1);
      expect(metadata.medicationCount).toBe(1);
      expect(metadata.fileSize).toBe(1234);
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
    });

    it('should include schema SQL in backup', async () => {
      let writtenData: string = '';
      (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(
        (_path, data) => {
          writtenData = data;
          return Promise.resolve();
        }
      );

      await backupService.createBackup();

      const backupData: BackupData = JSON.parse(writtenData);
      expect(backupData.schemaSQL).toBeDefined();
      expect(backupData.schemaSQL).toContain('CREATE TABLE');
    });

    it('should gather all data correctly', async () => {
      let writtenData: string = '';
      (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(
        (_path, data) => {
          writtenData = data;
          return Promise.resolve();
        }
      );

      await backupService.createBackup();

      const backupData: BackupData = JSON.parse(writtenData);
      expect(backupData.episodes).toHaveLength(1);
      expect(backupData.medications).toHaveLength(1);
      expect(backupData.medicationDoses).toHaveLength(1);
      expect(backupData.episodeNotes).toHaveLength(1);
    });

    it('should clean up old automatic backups', async () => {
      // Mock 8 existing backups (more than MAX_AUTO_BACKUPS = 7)
      const mockBackups = Array.from({ length: 8 }, (_, i) => ({
        id: `backup_${i}`,
        timestamp: Date.now() - (i * 24 * 60 * 60 * 1000), // i days old
        version: '1.0.0',
        schemaVersion: 1,
        episodeCount: 0,
        medicationCount: 0,
        fileSize: 100,
        fileName: `backup_${i}.json`,
      }));

      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(
        mockBackups.map(b => b.fileName)
      );

      (FileSystem.readAsStringAsync as jest.Mock).mockImplementation((path: string) => {
        const fileName = path.split('/').pop();
        const backup = mockBackups.find(b => b.fileName === fileName);
        return Promise.resolve(
          JSON.stringify({
            metadata: backup,
            episodes: [],
            medications: [],
            medicationDoses: [],
            medicationSchedules: [],
          })
        );
      });

      await backupService.createBackup(true);

      // Should trigger cleanup and delete at least 1 old backup
      expect(FileSystem.deleteAsync).toHaveBeenCalled();
    });

    it('should handle errors during backup creation', async () => {
      (episodeRepository.getAll as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(backupService.createBackup()).rejects.toThrow(
        'Failed to create backup: Database error'
      );
    });
  });

  describe('listBackups', () => {
    it('should list all backups sorted by timestamp', async () => {
      const mockBackups = [
        {
          metadata: {
            id: 'backup-1',
            timestamp: 2000,
            version: '1.0.0',
            schemaVersion: 1,
            episodeCount: 5,
            medicationCount: 3,
          },
          episodes: [],
          medications: [],
          medicationDoses: [],
          medicationSchedules: [],
        },
        {
          metadata: {
            id: 'backup-2',
            timestamp: 1000,
            version: '1.0.0',
            schemaVersion: 1,
            episodeCount: 2,
            medicationCount: 1,
          },
          episodes: [],
          medications: [],
          medicationDoses: [],
          medicationSchedules: [],
        },
      ];

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 500 });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'backup-1.json',
        'backup-2.json',
      ]);
      (FileSystem.readAsStringAsync as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify(mockBackups[0]))
        .mockResolvedValueOnce(JSON.stringify(mockBackups[1]));

      const backups = await backupService.listBackups();

      expect(backups).toHaveLength(2);
      expect(backups[0].id).toBe('backup-1'); // Newest first
      expect(backups[1].id).toBe('backup-2');
    });

    it('should return empty array if backup directory does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      const backups = await backupService.listBackups();

      expect(backups).toEqual([]);
    });

    it('should skip invalid backup files', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 100 });
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'valid.json',
        'invalid.json',
      ]);
      (FileSystem.readAsStringAsync as jest.Mock)
        .mockResolvedValueOnce(
          JSON.stringify({
            metadata: { id: 'valid', timestamp: 1000, version: '1.0.0', schemaVersion: 1, episodeCount: 0, medicationCount: 0 },
            episodes: [],
            medications: [],
            medicationDoses: [],
            medicationSchedules: [],
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
    it('should return backup metadata for JSON backup if backup exists', async () => {
      const mockBackup = {
        metadata: {
          id: 'backup-123',
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: 1,
          episodeCount: 5,
          medicationCount: 3,
        },
        episodes: [],
        medications: [],
        medicationDoses: [],
        medicationSchedules: [],
      };

      // Mock: .meta.json doesn't exist (not a snapshot), but .json exists
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: false });
        }
        return Promise.resolve({ exists: true, size: 1000 });
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(mockBackup)
      );

      const metadata = await backupService.getBackupMetadata('backup-123');

      expect(metadata).not.toBeUndefined();
      expect(metadata?.id).toBe('backup-123');
      expect(metadata?.fileSize).toBe(1000);
      expect(metadata?.backupType).toBe('json');
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
    const mockBackupData: BackupData = {
      metadata: {
        id: 'backup-123',
        timestamp: Date.now(),
        version: '1.0.0',
        schemaVersion: 1,
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
      // Mock getInfoAsync to simulate JSON backup (not snapshot)
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: false });
        }
        return Promise.resolve({ exists: true, size: 1000 });
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(mockBackupData)
      );
      (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(1);
      (episodeRepository.create as jest.Mock).mockResolvedValue(undefined);
      (medicationRepository.create as jest.Mock).mockResolvedValue(undefined);
      (medicationDoseRepository.create as jest.Mock).mockResolvedValue(undefined);
      (medicationScheduleRepository.create as jest.Mock).mockResolvedValue(undefined);
      (mockDatabase.getAllAsync as jest.Mock).mockResolvedValue([]);
      (mockDatabase.execAsync as jest.Mock).mockResolvedValue(undefined);
      (mockDatabase.runAsync as jest.Mock).mockResolvedValue(undefined);
    });

    it('should restore backup with schema migration', async () => {
      await backupService.restoreBackup('backup-123');

      expect(mockDatabase.execAsync).toHaveBeenCalledWith(mockBackupData.schemaSQL);
      // Should use raw SQL inserts to preserve IDs
      expect(mockDatabase.runAsync).toHaveBeenCalled();
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

      await backupService.restoreBackup('backup-123');

      expect(episodeRepository.deleteAll).toHaveBeenCalled();
      expect(medicationRepository.deleteAll).toHaveBeenCalled();
      // Should use raw SQL inserts to preserve IDs
      expect(mockDatabase.runAsync).toHaveBeenCalled();
    });

    it('should reject restoring backup from newer schema version', async () => {
      const newerBackup = {
        ...mockBackupData,
        metadata: { ...mockBackupData.metadata, schemaVersion: 5 },
      };

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(newerBackup)
      );
      (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(1);

      await expect(backupService.restoreBackup('backup-123')).rejects.toThrow(
        'Cannot restore backup from newer schema version'
      );
    });

    it('should run migrations after restoring old schema version', async () => {
      const oldBackup = {
        ...mockBackupData,
        metadata: { ...mockBackupData.metadata, schemaVersion: 0 },
      };

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(oldBackup)
      );
      (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(1);
      (migrationRunner.runMigrations as jest.Mock).mockResolvedValue(undefined);

      await backupService.restoreBackup('backup-123');

      expect(migrationRunner.runMigrations).toHaveBeenCalled();
    });

    it('should validate backup structure', async () => {
      const invalidBackup = {
        metadata: { id: 'test', timestamp: Date.now() },
        // Missing episodes and medications
      };

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(invalidBackup)
      );

      await expect(backupService.restoreBackup('backup-123')).rejects.toThrow(
        'Invalid backup file format'
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
    it('should export JSON backup via sharing', async () => {
      const mockBackup = {
        metadata: {
          id: 'backup-123',
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: 1,
          episodeCount: 5,
          medicationCount: 3,
        },
        episodes: [],
        medications: [],
        medicationDoses: [],
        medicationSchedules: [],
      };

      // Mock: .meta.json doesn't exist (not a snapshot), but .json exists
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: false });
        }
        return Promise.resolve({ exists: true, size: 1000 });
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(mockBackup)
      );
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);

      await backupService.exportBackup('backup-123');

      expect(Sharing.shareAsync).toHaveBeenCalled();
    });

    it('should throw error if backup file does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      await expect(backupService.exportBackup('nonexistent')).rejects.toThrow(
        'Backup not found'
      );
    });

    it('should throw error if sharing is not available', async () => {
      const mockBackup = {
        metadata: {
          id: 'backup-123',
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: 1,
          episodeCount: 5,
          medicationCount: 3,
        },
        episodes: [],
        medications: [],
        medicationDoses: [],
        medicationSchedules: [],
      };

      // Mock: .meta.json doesn't exist (not a snapshot), but .json exists
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: false });
        }
        return Promise.resolve({ exists: true, size: 1000 });
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(mockBackup)
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

      const result = (backupService as any).validateBackupMetadata(invalidMetadata);
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

      const result = (backupService as any).validateBackupMetadata(invalidMetadata);
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

      const result = (backupService as any).validateBackupMetadata(invalidMetadata);
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

      const result = (backupService as any).validateBackupMetadata(invalidMetadata);
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

      const result = (backupService as any).validateBackupMetadata(invalidMetadata);
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

      const result = (backupService as any).validateBackupMetadata(invalidMetadata);
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

      const result = (backupService as any).validateBackupMetadata(invalidMetadata);
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

      const result = (backupService as any).validateBackupMetadata(invalidMetadata);
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

      const result = (backupService as any).validateBackupMetadata(invalidMetadata);
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

      const result = (backupService as any).validateBackupMetadata(invalidMetadata);
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

      const result = (backupService as any).validateBackupMetadata(invalidMetadata);
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

      const result = (backupService as any).validateBackupMetadata(invalidMetadata);
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

      const result = (backupService as any).validateBackupMetadata(validMetadata);
      expect(result).toBe(true);
    });
  });

  describe('validateBackupData', () => {
    it('should reject backup with missing episodes array', () => {
      const invalidBackup = {
        metadata: {
          id: 'test',
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: 1,
          episodeCount: 0,
          medicationCount: 0,
        },
        medications: [],
        medicationDoses: [],
        medicationSchedules: [],
      };

      const result = (backupService as any).validateBackupData(invalidBackup);
      expect(result).toBe(false);
    });

    it('should reject backup with non-array episodes field', () => {
      const invalidBackup = {
        metadata: {
          id: 'test',
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: 1,
          episodeCount: 0,
          medicationCount: 0,
        },
        episodes: 'not an array',
        medications: [],
        medicationDoses: [],
        medicationSchedules: [],
      };

      const result = (backupService as any).validateBackupData(invalidBackup);
      expect(result).toBe(false);
    });

    it('should reject backup with invalid metadata', () => {
      const invalidBackup = {
        metadata: {
          id: '',  // Invalid: empty string
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: 1,
          episodeCount: 0,
          medicationCount: 0,
        },
        episodes: [],
        medications: [],
        medicationDoses: [],
        medicationSchedules: [],
      };

      const result = (backupService as any).validateBackupData(invalidBackup);
      expect(result).toBe(false);
    });

    it('should accept valid backup data', () => {
      const validBackup = {
        metadata: {
          id: 'test',
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: 1,
          episodeCount: 0,
          medicationCount: 0,
        },
        episodes: [],
        medications: [],
        medicationDoses: [],
        medicationSchedules: [],
      };

      const result = (backupService as any).validateBackupData(validBackup);
      expect(result).toBe(true);
    });
  });

  describe('importBackup', () => {
    const mockBackupData: BackupData = {
      metadata: {
        id: 'imported-backup',
        timestamp: Date.now(),
        version: '1.0.0',
        schemaVersion: 1,
        episodeCount: 1,
        medicationCount: 1,
      },
      schemaSQL: 'CREATE TABLE episodes (...);',
      episodes: [],
      medications: [],
      medicationDoses: [],
      medicationSchedules: [],
    };

    it('should import backup successfully', async () => {
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///path/to/backup.json' }],
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(mockBackupData)
      );
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 1000 });

      const metadata = await backupService.importBackup();

      expect(metadata).toBeDefined();
      expect(metadata.episodeCount).toBe(1);
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
    });

    it('should upgrade old backup format during import', async () => {
      const oldBackup = { ...mockBackupData };
      delete (oldBackup as any).schemaSQL;

      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///path/to/backup.json' }],
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(oldBackup)
      );
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 1000 });
      (mockDatabase.getAllAsync as jest.Mock).mockResolvedValue([
        { sql: 'CREATE TABLE episodes (...)' },
      ]);
      (migrationRunner.getCurrentVersion as jest.Mock).mockResolvedValue(1);

      const metadata = await backupService.importBackup();

      expect(metadata).toBeDefined();
    });

    it('should throw error if import is cancelled', async () => {
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: true,
      });

      await expect(backupService.importBackup()).rejects.toThrow('Import cancelled');
    });

    it('should validate imported backup structure', async () => {
      const invalidBackup = { metadata: { id: 'test' } };

      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///path/to/backup.json', name: 'backup.json' }],
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(invalidBackup)
      );

      await expect(backupService.importBackup()).rejects.toThrow(
        'Invalid backup file format'
      );
    });

    it('should reject backup with missing metadata.id', async () => {
      const invalidBackup = {
        metadata: {
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: 1,
          episodeCount: 0,
          medicationCount: 0,
        },
        episodes: [],
        medications: [],
        medicationDoses: [],
        medicationSchedules: [],
      };

      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///path/to/backup.json', name: 'backup.json' }],
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(invalidBackup)
      );

      await expect(backupService.importBackup()).rejects.toThrow(
        'Invalid backup file format'
      );
    });

    it('should reject backup with undefined metadata.id', async () => {
      const invalidBackup = {
        metadata: {
          id: undefined,
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: 1,
          episodeCount: 0,
          medicationCount: 0,
        },
        episodes: [],
        medications: [],
        medicationDoses: [],
        medicationSchedules: [],
      };

      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///path/to/backup.json', name: 'backup.json' }],
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(invalidBackup)
      );

      await expect(backupService.importBackup()).rejects.toThrow(
        'Invalid backup file format'
      );
    });

    it('should reject backup with null metadata.id', async () => {
      const invalidBackup = {
        metadata: {
          id: null,
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: 1,
          episodeCount: 0,
          medicationCount: 0,
        },
        episodes: [],
        medications: [],
        medicationDoses: [],
        medicationSchedules: [],
      };

      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///path/to/backup.json', name: 'backup.json' }],
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(invalidBackup)
      );

      await expect(backupService.importBackup()).rejects.toThrow(
        'Invalid backup file format'
      );
    });

    it('should reject backup with empty string metadata.id', async () => {
      const invalidBackup = {
        metadata: {
          id: '',
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: 1,
          episodeCount: 0,
          medicationCount: 0,
        },
        episodes: [],
        medications: [],
        medicationDoses: [],
        medicationSchedules: [],
      };

      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///path/to/backup.json', name: 'backup.json' }],
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(invalidBackup)
      );

      await expect(backupService.importBackup()).rejects.toThrow(
        'Invalid backup file format'
      );
    });

    it('should reject backup with numeric metadata.id', async () => {
      const invalidBackup = {
        metadata: {
          id: 12345,
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: 1,
          episodeCount: 0,
          medicationCount: 0,
        },
        episodes: [],
        medications: [],
        medicationDoses: [],
        medicationSchedules: [],
      };

      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///path/to/backup.json', name: 'backup.json' }],
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(invalidBackup)
      );

      await expect(backupService.importBackup()).rejects.toThrow(
        'Invalid backup file format'
      );
    });

    it('should reject corrupted JSON file', async () => {
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///path/to/backup.json', name: 'backup.json' }],
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        'invalid json {{{['
      );

      await expect(backupService.importBackup()).rejects.toThrow(
        'Invalid backup file: corrupted or not valid JSON'
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
        const mockBackups = Array.from({ length: 9 }, (_, i) => ({
          id: `backup_${Date.now() - i * 1000}_${i}`,
          timestamp: Date.now() - (i * 24 * 60 * 60 * 1000), // i days old
          version: '1.0.0',
          schemaVersion: 6,
          episodeCount: 0,
          medicationCount: 0,
          fileSize: 100,
          fileName: `backup_${Date.now() - i * 1000}_${i}.db`,
          backupType: 'snapshot' as const,
        }));

        // Mock directory listing with .db files and .meta.json files
        const files = mockBackups.flatMap(b => [
          b.fileName,
          b.fileName.replace('.db', '.meta.json'),
        ]);

        (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(files);

        // Mock readAsStringAsync for metadata files
        (FileSystem.readAsStringAsync as jest.Mock).mockImplementation((path: string) => {
          const fileName = path.split('/').pop();
          if (fileName?.endsWith('.meta.json')) {
            const backupId = fileName.replace('.meta.json', '');
            const backup = mockBackups.find(b => b.id === backupId);
            return Promise.resolve(JSON.stringify(backup));
          }
          return Promise.resolve('{}');
        });

        AsyncStorage.getItem.mockResolvedValue(null);

        // Create a new backup (should trigger cleanup)
        await backupService.checkAndCreateWeeklyBackup();

        // Should trigger cleanup and delete old backups
        expect(FileSystem.deleteAsync).toHaveBeenCalled();
      });
    });
  });
});
