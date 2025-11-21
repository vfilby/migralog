import * as FileSystem from 'expo-file-system/legacy';
import {
  validateBackupMetadata,
  validateBackupData,
  formatFileSize,
  formatDate,
  generateBackupId,
  getBackupPath,
  getMetadataPath,
  getBackupMetadata,
  initializeBackupDirectory,
  BACKUP_DIR,
} from '../backupUtils';
import { BackupData, BackupMetadata } from '../../models/types';

// Mock dependencies
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file://mockDocDir/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
}));
jest.mock('../errorLogger');

describe('backupUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validateBackupMetadata', () => {
    const validMetadata = {
      id: 'test-backup-123',
      timestamp: Date.now(),
      version: '1.0.0',
      schemaVersion: 1,
      episodeCount: 5,
      medicationCount: 3,
    };

    it('should accept valid metadata', () => {
      expect(validateBackupMetadata(validMetadata)).toBe(true);
    });

    describe('id validation', () => {
      it('should reject metadata with missing id', () => {
        const invalid = { ...validMetadata };
        delete (invalid as any).id;
        expect(validateBackupMetadata(invalid)).toBe(false);
      });

      it('should reject metadata with undefined id', () => {
        const invalid = { ...validMetadata, id: undefined };
        expect(validateBackupMetadata(invalid)).toBe(false);
      });

      it('should reject metadata with null id', () => {
        const invalid = { ...validMetadata, id: null };
        expect(validateBackupMetadata(invalid)).toBe(false);
      });

      it('should reject metadata with empty string id', () => {
        const invalid = { ...validMetadata, id: '' };
        expect(validateBackupMetadata(invalid)).toBe(false);
      });

      it('should reject metadata with whitespace-only id', () => {
        const invalid = { ...validMetadata, id: '   ' };
        expect(validateBackupMetadata(invalid)).toBe(false);
      });

      it('should reject metadata with numeric id', () => {
        const invalid = { ...validMetadata, id: 12345 as any };
        expect(validateBackupMetadata(invalid)).toBe(false);
      });
    });

    describe('timestamp validation', () => {
      it('should reject metadata with zero timestamp', () => {
        const invalid = { ...validMetadata, timestamp: 0 };
        expect(validateBackupMetadata(invalid)).toBe(false);
      });

      it('should reject metadata with negative timestamp', () => {
        const invalid = { ...validMetadata, timestamp: -100 };
        expect(validateBackupMetadata(invalid)).toBe(false);
      });

      it('should reject metadata with missing timestamp', () => {
        const invalid = { ...validMetadata };
        delete (invalid as any).timestamp;
        expect(validateBackupMetadata(invalid)).toBe(false);
      });

      it('should reject metadata with non-numeric timestamp', () => {
        const invalid = { ...validMetadata, timestamp: '1234' as any };
        expect(validateBackupMetadata(invalid)).toBe(false);
      });
    });

    describe('version validation', () => {
      it('should reject metadata with missing version', () => {
        const invalid = { ...validMetadata };
        delete (invalid as any).version;
        expect(validateBackupMetadata(invalid)).toBe(false);
      });

      it('should reject metadata with empty version', () => {
        const invalid = { ...validMetadata, version: '' };
        expect(validateBackupMetadata(invalid)).toBe(false);
      });

      it('should reject metadata with non-string version', () => {
        const invalid = { ...validMetadata, version: 1.0 as any };
        expect(validateBackupMetadata(invalid)).toBe(false);
      });
    });

    describe('schemaVersion validation', () => {
      it('should reject metadata with negative schemaVersion', () => {
        const invalid = { ...validMetadata, schemaVersion: -1 };
        expect(validateBackupMetadata(invalid)).toBe(false);
      });

      it('should accept metadata with zero schemaVersion', () => {
        const valid = { ...validMetadata, schemaVersion: 0 };
        expect(validateBackupMetadata(valid)).toBe(true);
      });

      it('should reject metadata with non-numeric schemaVersion', () => {
        const invalid = { ...validMetadata, schemaVersion: '1' as any };
        expect(validateBackupMetadata(invalid)).toBe(false);
      });
    });

    describe('count validation', () => {
      it('should reject metadata with negative episodeCount', () => {
        const invalid = { ...validMetadata, episodeCount: -5 };
        expect(validateBackupMetadata(invalid)).toBe(false);
      });

      it('should reject metadata with negative medicationCount', () => {
        const invalid = { ...validMetadata, medicationCount: -3 };
        expect(validateBackupMetadata(invalid)).toBe(false);
      });

      it('should accept metadata with zero counts', () => {
        const valid = { ...validMetadata, episodeCount: 0, medicationCount: 0 };
        expect(validateBackupMetadata(valid)).toBe(true);
      });
    });

    it('should reject non-object metadata', () => {
      expect(validateBackupMetadata(null)).toBe(false);
      expect(validateBackupMetadata(undefined)).toBe(false);
      expect(validateBackupMetadata('string')).toBe(false);
      expect(validateBackupMetadata(123)).toBe(false);
      expect(validateBackupMetadata([])).toBe(false);
    });
  });

  describe('validateBackupData', () => {
    const validMetadata = {
      id: 'test-backup',
      timestamp: Date.now(),
      version: '1.0.0',
      schemaVersion: 1,
      episodeCount: 0,
      medicationCount: 0,
    };

    const validBackupData: BackupData = {
      metadata: validMetadata,
      episodes: [],
      episodeNotes: [],
      medications: [],
      medicationDoses: [],
      medicationSchedules: [],
    };

    it('should accept valid backup data', () => {
      expect(validateBackupData(validBackupData)).toBe(true);
    });

    it('should accept valid backup data with items', () => {
      const backupWithData: BackupData = {
        ...validBackupData,
        episodes: [
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
        ],
        medications: [
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
        ],
      };

      expect(validateBackupData(backupWithData)).toBe(true);
    });

    describe('array field validation', () => {
      it('should reject backup with missing episodes array', () => {
        const invalid = { ...validBackupData };
        delete (invalid as any).episodes;
        expect(validateBackupData(invalid)).toBe(false);
      });

      it('should reject backup with non-array episodes', () => {
        const invalid = { ...validBackupData, episodes: 'not an array' as any };
        expect(validateBackupData(invalid)).toBe(false);
      });

      it('should reject backup with missing medications array', () => {
        const invalid = { ...validBackupData };
        delete (invalid as any).medications;
        expect(validateBackupData(invalid)).toBe(false);
      });

      it('should reject backup with non-array medications', () => {
        const invalid = { ...validBackupData, medications: {} as any };
        expect(validateBackupData(invalid)).toBe(false);
      });

      it('should reject backup with missing medicationDoses array', () => {
        const invalid = { ...validBackupData };
        delete (invalid as any).medicationDoses;
        expect(validateBackupData(invalid)).toBe(false);
      });

      it('should reject backup with non-array medicationDoses', () => {
        const invalid = { ...validBackupData, medicationDoses: null as any };
        expect(validateBackupData(invalid)).toBe(false);
      });

      it('should reject backup with missing medicationSchedules array', () => {
        const invalid = { ...validBackupData };
        delete (invalid as any).medicationSchedules;
        expect(validateBackupData(invalid)).toBe(false);
      });

      it('should reject backup with non-array medicationSchedules', () => {
        const invalid = { ...validBackupData, medicationSchedules: 123 as any };
        expect(validateBackupData(invalid)).toBe(false);
      });
    });

    describe('metadata validation within backup data', () => {
      it('should reject backup with invalid metadata', () => {
        const invalid = {
          ...validBackupData,
          metadata: { ...validMetadata, id: '' }, // Invalid: empty id
        };
        expect(validateBackupData(invalid)).toBe(false);
      });

      it('should reject backup with missing metadata', () => {
        const invalid = { ...validBackupData };
        delete (invalid as any).metadata;
        expect(validateBackupData(invalid)).toBe(false);
      });
    });

    it('should reject non-object backup data', () => {
      expect(validateBackupData(null)).toBe(false);
      expect(validateBackupData(undefined)).toBe(false);
      expect(validateBackupData('string')).toBe(false);
      expect(validateBackupData(123)).toBe(false);
      expect(validateBackupData([])).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('should format 0 bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('should format bytes correctly', () => {
      expect(formatFileSize(1)).toBe('1 Bytes');
      expect(formatFileSize(500)).toBe('500 Bytes');
      expect(formatFileSize(1023)).toBe('1023 Bytes');
    });

    it('should format KB correctly', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(2048)).toBe('2 KB');
      expect(formatFileSize(10240)).toBe('10 KB');
    });

    it('should format MB correctly', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1572864)).toBe('1.5 MB');
      expect(formatFileSize(5242880)).toBe('5 MB');
    });

    it('should format GB correctly', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB');
      expect(formatFileSize(2147483648)).toBe('2 GB');
      expect(formatFileSize(1610612736)).toBe('1.5 GB');
    });

    it('should round to 2 decimal places', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1638)).toBe('1.6 KB'); // 1.599609375 KB rounded
      expect(formatFileSize(1730)).toBe('1.69 KB'); // 1.689453125 KB rounded
    });

    it('should handle very large numbers', () => {
      // Very large numbers may exceed GB and cause undefined suffix
      // The function only supports up to GB in the sizes array
      const result = formatFileSize(5000000000); // 5 GB
      expect(result).toContain('GB');
      expect(result).toContain('4.66'); // ~4.66 GB
    });
  });

  describe('formatDate', () => {
    it('should format timestamp to string', () => {
      const timestamp = new Date('2025-01-01T12:00:00Z').getTime();
      const result = formatDate(timestamp);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should format current timestamp', () => {
      const timestamp = Date.now();
      const result = formatDate(timestamp);

      expect(typeof result).toBe('string');
      expect(result).toBeDefined();
    });

    it('should format different timestamps differently', () => {
      const timestamp1 = new Date('2025-01-01T12:00:00Z').getTime();
      const timestamp2 = new Date('2024-06-15T08:30:00Z').getTime();

      const result1 = formatDate(timestamp1);
      const result2 = formatDate(timestamp2);

      expect(result1).not.toBe(result2);
    });

    it('should handle zero timestamp', () => {
      const result = formatDate(0);
      expect(typeof result).toBe('string');
      expect(result).toBeDefined();
    });
  });

  describe('generateBackupId', () => {
    it('should generate a valid backup ID', () => {
      const id = generateBackupId();

      expect(typeof id).toBe('string');
      expect(id).toMatch(/^backup_\d+_[a-z0-9]+$/);
    });

    it('should generate unique IDs', () => {
      const id1 = generateBackupId();
      const id2 = generateBackupId();

      expect(id1).not.toBe(id2);
    });

    it('should include timestamp', () => {
      const beforeTime = Date.now();
      const id = generateBackupId();
      const afterTime = Date.now();

      // Extract timestamp from ID (format: backup_<timestamp>_<random>)
      const match = id.match(/^backup_(\d+)_/);
      expect(match).not.toBeNull();

      const timestamp = parseInt(match![1], 10);
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should include random component', () => {
      const id = generateBackupId();
      const parts = id.split('_');

      expect(parts.length).toBe(3);
      expect(parts[0]).toBe('backup');
      expect(parts[1]).toMatch(/^\d+$/); // timestamp
      expect(parts[2]).toMatch(/^[a-z0-9]+$/); // random string
    });
  });

  describe('getBackupPath', () => {
    it('should return correct path for snapshot backup', () => {
      const path = getBackupPath('test-backup-123', 'snapshot');
      expect(path).toBe(`${BACKUP_DIR}test-backup-123.db`);
    });

    it('should return correct path for JSON backup', () => {
      const path = getBackupPath('test-backup-456', 'json');
      expect(path).toBe(`${BACKUP_DIR}test-backup-456.json`);
    });

    it('should handle IDs with special characters', () => {
      const path = getBackupPath('backup_12345_abc123', 'json');
      expect(path).toBe(`${BACKUP_DIR}backup_12345_abc123.json`);
    });
  });

  describe('getMetadataPath', () => {
    it('should return correct metadata path', () => {
      const path = getMetadataPath('test-backup-123');
      expect(path).toBe(`${BACKUP_DIR}test-backup-123.meta.json`);
    });

    it('should handle IDs with special characters', () => {
      const path = getMetadataPath('backup_12345_abc123');
      expect(path).toBe(`${BACKUP_DIR}backup_12345_abc123.meta.json`);
    });
  });

  describe('getBackupMetadata', () => {
    const mockMetadata: BackupMetadata = {
      id: 'test-backup',
      timestamp: Date.now(),
      version: '1.0.0',
      schemaVersion: 1,
      episodeCount: 5,
      medicationCount: 3,
      fileName: 'test-backup.db',
      fileSize: 1024,
      backupType: 'snapshot',
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return metadata from snapshot backup (.meta.json)', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(mockMetadata)
      );

      const result = await getBackupMetadata('test-backup');

      expect(result).toEqual(mockMetadata);
      expect(FileSystem.getInfoAsync).toHaveBeenCalledWith(
        expect.stringContaining('.meta.json')
      );
    });

    it('should return metadata from JSON backup if .meta.json does not exist', async () => {
      const backupData: BackupData = {
        metadata: {
          id: 'test-backup',
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: 1,
          episodeCount: 2,
          medicationCount: 1,
        },
        episodes: [],
        episodeNotes: [],
        medications: [],
        medicationDoses: [],
        medicationSchedules: [],
      };

      // Mock: .meta.json doesn't exist, but .json does
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: false });
        }
        return Promise.resolve({ exists: true, size: 2048 });
      });

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(backupData)
      );

      const result = await getBackupMetadata('test-backup');

      expect(result).toEqual({
        ...backupData.metadata,
        fileName: 'test-backup.json',
        fileSize: 2048,
        backupType: 'json',
      });
    });

    it('should return null if backup does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      const result = await getBackupMetadata('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null on file read error', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(
        new Error('File read error')
      );

      const result = await getBackupMetadata('test-backup');

      expect(result).toBeNull();
    });

    it('should return null on JSON parse error', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('invalid json {{{');

      const result = await getBackupMetadata('test-backup');

      expect(result).toBeNull();
    });

    it('should handle missing size field in file info', async () => {
      const backupData: BackupData = {
        metadata: {
          id: 'test-backup',
          timestamp: Date.now(),
          version: '1.0.0',
          schemaVersion: 1,
          episodeCount: 0,
          medicationCount: 0,
        },
        episodes: [],
        episodeNotes: [],
        medications: [],
        medicationDoses: [],
        medicationSchedules: [],
      };

      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.meta.json')) {
          return Promise.resolve({ exists: false });
        }
        return Promise.resolve({ exists: true }); // No size field
      });

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(backupData)
      );

      const result = await getBackupMetadata('test-backup');

      expect(result?.fileSize).toBe(0);
    });
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

    it('should handle errors when creating directory', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
      (FileSystem.makeDirectoryAsync as jest.Mock).mockRejectedValue(
        new Error('Permission denied')
      );

      await expect(initializeBackupDirectory()).rejects.toThrow('Permission denied');
    });

    it('should handle errors when checking directory', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(
        new Error('File system error')
      );

      await expect(initializeBackupDirectory()).rejects.toThrow('File system error');
    });
  });
});
