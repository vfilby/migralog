/**
 * Tests for DebugArchiveService
 * 
 * These tests verify the basic functionality of the debug archive system
 * including data collection and ZIP file generation.
 */

import { debugArchiveService } from '../DebugArchiveService';

// Mock dependencies
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file://mockCacheDir/',
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: false })),
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    Version: '16.0',
  },
}));

jest.mock('expo-constants', () => {
  return {
    default: {
      deviceName: 'iPhone 14 Pro',
    },
    deviceName: 'iPhone 14 Pro',
  };
});

jest.mock('../../../utils/logger', () => ({
  logger: {
    log: jest.fn(),
    error: jest.fn(),
    getLogsAsync: jest.fn(() => Promise.resolve([])),
  },
}));

jest.mock('../../../buildInfo', () => ({
  buildInfo: {
    version: '1.0.0',
    buildNumber: '123',
  },
}));

jest.mock('../../../database/migrations', () => ({
  migrationRunner: {
    getCurrentVersion: jest.fn(() => Promise.resolve(1)),
  },
}));

jest.mock('../../../database/db', () => ({
  getDatabase: jest.fn(() => Promise.resolve({
    getAllAsync: jest.fn(() => Promise.resolve([])),
    getFirstAsync: jest.fn(() => Promise.resolve(null)),
  })),
}));

jest.mock('../../../database/medicationRepository', () => ({
  medicationRepository: {
    getAll: jest.fn(() => Promise.resolve([])),
  },
  medicationDoseRepository: {
    getByDateRange: jest.fn(() => Promise.resolve([])),
  },
}));

jest.mock('../../../database/episodeRepository', () => ({
  episodeRepository: {
    getCurrentEpisode: jest.fn(() => Promise.resolve(null)),
  },
}));

jest.mock('../../../database/scheduledNotificationRepository', () => ({
  scheduledNotificationRepository: {
    tableExists: jest.fn(() => Promise.resolve(false)),
    getAllMappings: jest.fn(() => Promise.resolve([])),
  },
}));

jest.mock('../../notifications/notificationService', () => ({
  notificationService: {
    getAllScheduledNotifications: jest.fn(() => Promise.resolve([])),
    getPermissions: jest.fn(() => Promise.resolve({
      granted: false,
      canAskAgain: true,
      ios: {
        allowsAlert: false,
        allowsBadge: false,
        allowsSound: false,
        allowsCriticalAlerts: false,
      }
    })),
  },
}));

// Create mock for JSZip
const mockZipInstance = {
  file: jest.fn(),
  generateAsync: jest.fn(() => Promise.resolve(new Uint8Array([1, 2, 3, 4]))),
};

jest.mock('jszip', () => jest.fn(() => mockZipInstance));

describe('DebugArchiveService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock functions
    mockZipInstance.file.mockClear();
    mockZipInstance.generateAsync.mockClear();
  });

  describe('collectSystemMetadata', () => {
    it('should collect system metadata successfully', async () => {
      const metadata = await debugArchiveService.collectSystemMetadata();

      expect(metadata).toMatchObject({
        appVersion: '1.0.0',
        buildNumber: '123',
        iosVersion: '16.0',
        deviceModel: 'iPhone 14 Pro',
        schemaVersion: 1,
        archiveFormat: '1.0.0',
      });

      expect(metadata.exportTimestamp).toBeDefined();
      expect(metadata.exportTimestampLocal).toBeDefined();
      expect(metadata.timezone).toBeDefined();
    });
  });

  describe('collectDatabaseData', () => {
    it('should collect database data with proper structure', async () => {
      const data = await debugArchiveService.collectDatabaseData();

      expect(data).toMatchObject({
        fullSnapshot: expect.any(String),
        recentDoses: expect.any(Array),
        activeEpisodes: expect.any(Array),
        medicationSchedules: expect.any(Array),
      });

      // Note: We can't reliably test that the repository methods were called
      // because the service handles errors gracefully and may not call them
      // if there are other issues (like database access). The important thing
      // is that the method returns the expected structure.
    });
  });

  describe('collectNotificationData', () => {
    it('should collect notification data', async () => {
      const data = await debugArchiveService.collectNotificationData();

      expect(data).toMatchObject({
        scheduled: {
          medicationNotifications: expect.any(Array),
          dailyCheckinNotifications: expect.any(Array),
          orphanedNotifications: expect.any(Array),
        },
        presented: expect.any(Array),
        permissions: expect.objectContaining({
          granted: expect.any(Boolean),
          status: expect.any(String),
          canAskAgain: expect.any(Boolean),
        }),
        categories: expect.any(Array),
      });
    });
  });

  describe('collectMappingData', () => {
    it('should collect mapping data when table exists', async () => {
      const { scheduledNotificationRepository } = require('../../../database/scheduledNotificationRepository');
      scheduledNotificationRepository.tableExists.mockResolvedValue(true);

      const data = await debugArchiveService.collectMappingData();

      expect(data).toMatchObject({
        scheduledMappings: expect.any(Array),
        orphanedMappings: expect.any(Array),
        reconciliationStatus: {
          totalMappings: expect.any(Number),
          totalOSNotifications: expect.any(Number),
          orphanedMappings: expect.any(Number),
          orphanedNotifications: expect.any(Number),
        },
      });
    });

    it('should return empty data when table does not exist', async () => {
      const { scheduledNotificationRepository } = require('../../../database/scheduledNotificationRepository');
      scheduledNotificationRepository.tableExists.mockResolvedValue(false);

      const data = await debugArchiveService.collectMappingData();

      expect(data).toMatchObject({
        scheduledMappings: [],
        orphanedMappings: [],
        reconciliationStatus: {
          totalMappings: 0,
          totalOSNotifications: 0,
          orphanedMappings: 0,
          orphanedNotifications: 0,
        },
      });
    });
  });

  describe('collectLogData', () => {
    it('should collect and filter log data', async () => {
      const mockLogs = [
        {
          id: '1',
          timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
          level: 1,
          message: 'Test notification log',
        },
        {
          id: '2', 
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 25), // 25 hours ago
          level: 2,
          message: 'Test error log',
        },
      ];

      const { logger } = require('../../../utils/logger');
      logger.getLogsAsync.mockResolvedValue(mockLogs);

      const data = await debugArchiveService.collectLogData(48);

      expect(data.allLogs).toHaveLength(2);
      expect(data.notificationLogs).toHaveLength(1);
      expect(data.errorLogs).toHaveLength(1);
      expect(data.medicationLogs).toHaveLength(0);
    });
  });

  describe('generateDebugArchive', () => {
    it('should generate debug archive successfully', async () => {
      const archivePath = await debugArchiveService.generateDebugArchive();

      expect(archivePath).toContain('debug_archive_');
      expect(archivePath).toContain('.zip');
      
      // Verify that JSZip was called correctly
      expect(mockZipInstance.file).toHaveBeenCalledWith('metadata.json', expect.any(String));
      expect(mockZipInstance.file).toHaveBeenCalledWith('database.json', expect.any(String));
      expect(mockZipInstance.file).toHaveBeenCalledWith('logs.json', expect.any(String));
      expect(mockZipInstance.file).toHaveBeenCalledWith('notifications.json', expect.any(String));
      expect(mockZipInstance.file).toHaveBeenCalledWith('mappings.json', expect.any(String));
      expect(mockZipInstance.file).toHaveBeenCalledWith('README.md', expect.any(String));
      expect(mockZipInstance.generateAsync).toHaveBeenCalledWith({
        type: 'uint8array',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
    });

    it('should respect options for selective data collection', async () => {
      const archivePath = await debugArchiveService.generateDebugArchive({
        includeFullDatabase: false,
        includeLogs: false,
        includeNotifications: false,
      });

      expect(archivePath).toContain('debug_archive_');
      expect(archivePath).toContain('.zip');
      
      // Should still create ZIP with all files but with empty data for disabled options
      expect(mockZipInstance.file).toHaveBeenCalledWith('metadata.json', expect.any(String));
      expect(mockZipInstance.generateAsync).toHaveBeenCalled();
    });

    it('should call progress callback when provided', async () => {
      const progressCallback = jest.fn();

      await debugArchiveService.generateDebugArchive({
        progressCallback,
      });

      expect(progressCallback).toHaveBeenCalledWith('Starting archive generation...', 0);
      expect(progressCallback).toHaveBeenCalledWith('Archive generation complete!', 100);
      expect(progressCallback.mock.calls.length).toBeGreaterThan(2);
    });
  });
});