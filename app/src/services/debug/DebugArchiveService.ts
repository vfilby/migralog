/**
 * Debug Archive Service
 * 
 * Creates comprehensive ZIP archives containing logs, database state, and notification
 * information for debugging complex issues. The archive is designed to provide all
 * necessary context for troubleshooting problems without compromising user privacy.
 * 
 * Features:
 * - Complete database snapshot (Base64 encoded SQLite file)
 * - Last 48 hours of application logs with filtering options
 * - OS notification state and permission information
 * - Database notification mapping reconciliation
 * - System metadata for environment context
 * - ZIP compression for efficient transfer
 * 
 * The generated archive follows a structured format with separate JSON files
 * for different data types, making it easy to analyze specific aspects of the app state.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as JSZip from 'jszip';
import { Buffer } from 'buffer';
import { logger } from '../../utils/logger';
import { buildInfo } from '../../buildInfo';
import { migrationRunner } from '../../database/migrations';
import { getDatabase } from '../../database/db';
// ARCHITECTURAL EXCEPTION: Debug archive needs direct repository access for complete data collection
import { medicationRepository, medicationDoseRepository } from '../../database/medicationRepository';
import { episodeRepository } from '../../database/episodeRepository';
import { scheduledNotificationRepository } from '../../database/scheduledNotificationRepository';
import { notificationService } from '../notifications/notificationService';
import type { 
  DebugArchiveData, 
  SystemMetadata, 
  DatabaseDebugData,
  LogDebugData,
  NotificationDebugData,
  MappingDebugData,
  NotificationPermissionsStatus,
  DebugArchiveOptions,
  NotificationRequest,
  NotificationResponse,
  NotificationMapping
} from '../../types/debugArchive';

export class DebugArchiveService {
  private static instance: DebugArchiveService;
  private progressCallback?: (message: string, progress: number) => void;
  
  public static getInstance(): DebugArchiveService {
    if (!DebugArchiveService.instance) {
      DebugArchiveService.instance = new DebugArchiveService();
    }
    return DebugArchiveService.instance;
  }

  /**
   * Set a progress callback for archive generation
   */
  public setProgressCallback(callback: (message: string, progress: number) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Clear the progress callback
   */
  public clearProgressCallback(): void {
    this.progressCallback = undefined;
  }

  /**
   * Report progress to the callback if available
   */
  private reportProgress(message: string, progress: number): void {
    if (this.progressCallback) {
      this.progressCallback(message, progress);
    }
  }

  /**
   * Main orchestration method - collect all data and create ZIP archive
   * 
   * @param options Configuration options for archive generation
   * @returns Promise resolving to file path of generated archive
   */
  public async generateDebugArchive(options: DebugArchiveOptions = {}): Promise<string> {
    try {
      logger.log('[DebugArchive] Starting debug archive generation...');
      this.reportProgress('Starting archive generation...', 0);
      
      const {
        includeFullDatabase = true,
        includeLogs = true,
        includeNotifications = true,
        logHistoryHours = 48,
        progressCallback
      } = options;

      // Set progress callback if provided
      if (progressCallback) {
        this.setProgressCallback(progressCallback);
      }

      // Collect all debug data with progress reporting
      this.reportProgress('Collecting system metadata...', 10);
      const metadata = await this.collectSystemMetadata();

      this.reportProgress('Collecting database data...', 30);
      const database = includeFullDatabase ? await this.collectDatabaseData() : this.getEmptyDatabaseData();

      this.reportProgress('Collecting logs...', 50);
      const logs = includeLogs ? await this.collectLogData(logHistoryHours) : this.getEmptyLogData();

      this.reportProgress('Collecting notifications...', 70);
      const notifications = includeNotifications ? await this.collectNotificationData() : this.getEmptyNotificationData();

      this.reportProgress('Collecting mappings...', 80);
      const mappings = includeNotifications ? await this.collectMappingData() : this.getEmptyMappingData();

      const debugData: DebugArchiveData = {
        metadata,
        database,
        logs,
        notifications,
        mappings,
      };

      // Create ZIP archive
      this.reportProgress('Creating ZIP archive...', 90);
      const archivePath = await this.createZipArchive(debugData);
      
      this.reportProgress('Archive generation complete!', 100);
      logger.log('[DebugArchive] Debug archive generated successfully:', archivePath);
      
      // Clear progress callback
      this.clearProgressCallback();
      
      return archivePath;
    } catch (error) {
      logger.error('[DebugArchive] Failed to generate debug archive:', error);
      this.reportProgress(`Error: ${(error as Error).message}`, 0);
      
      // Clear progress callback on error
      this.clearProgressCallback();
      
      throw new Error(`Failed to generate debug archive: ${(error as Error).message}`);
    }
  }

  /**
   * Collect enhanced system metadata including app version, device info, and timestamps
   */
  public async collectSystemMetadata(): Promise<SystemMetadata> {
    try {
      logger.log('[DebugArchive] Collecting system metadata...');

      const now = new Date();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const schemaVersion = await migrationRunner.getCurrentVersion();

      // Get enhanced device information
      const deviceModel = Constants.deviceName || 'unknown';
      const iosVersion = Platform.OS === 'ios' ? 
        Platform.Version?.toString() || 'unknown' : 
        'unknown';

      // Check if we're in DST
      const isDST = now.getTimezoneOffset() < new Date(now.getFullYear(), 0, 1).getTimezoneOffset();

      const metadata: SystemMetadata = {
        exportTimestamp: now.toISOString(),
        exportTimestampLocal: now.toLocaleString(),
        timezone: `${timezone}${isDST ? ' (DST)' : ''}`,
        appVersion: buildInfo.version,
        buildNumber: buildInfo.buildNumber,
        iosVersion,
        deviceModel,
        schemaVersion,
        archiveFormat: '1.0.0',
      };

      logger.log('[DebugArchive] System metadata collected successfully', {
        timezone: metadata.timezone,
        deviceModel: metadata.deviceModel,
        iosVersion: metadata.iosVersion,
        schemaVersion: metadata.schemaVersion
      });

      return metadata;
    } catch (error) {
      logger.error('[DebugArchive] Failed to collect system metadata:', error);
      // Return minimal metadata on error to not block archive generation
      return {
        exportTimestamp: new Date().toISOString(),
        exportTimestampLocal: new Date().toLocaleString(),
        timezone: 'unknown',
        appVersion: buildInfo.version,
        buildNumber: buildInfo.buildNumber,
        iosVersion: 'unknown',
        deviceModel: 'unknown',
        schemaVersion: 0,
        archiveFormat: '1.0.0',
      };
    }
  }

  /**
   * Collect database snapshot and recent critical data
   */
  public async collectDatabaseData(): Promise<DatabaseDebugData> {
    try {
      logger.log('[DebugArchive] Collecting database data...');

      const db = await getDatabase();

      // 1. Create full database snapshot (Base64 encoded SQLite file)
      logger.log('[DebugArchive] Creating database snapshot...');
      const dbPath = `${FileSystem.documentDirectory}SQLite/migralog.db`;
      const dbInfo = await FileSystem.getInfoAsync(dbPath);
      
      let fullSnapshot = '';
      if (dbInfo.exists) {
        try {
          const dbData = await FileSystem.readAsStringAsync(dbPath, {
            encoding: 'base64' as 'base64',
          });
          fullSnapshot = dbData;
          logger.log('[DebugArchive] Database snapshot created', {
            size: Math.round(dbData.length / 1024),
            sizeUnit: 'KB'
          });
        } catch (error) {
          logger.warn('[DebugArchive] Failed to read database file, continuing without snapshot:', error);
        }
      } else {
        logger.warn('[DebugArchive] Database file not found at expected path');
      }

      // 2. Query recent medication doses (last 48 hours)
      logger.log('[DebugArchive] Collecting recent medication doses...');
      const now = Date.now();
      const fortyEightHoursAgo = now - (48 * 60 * 60 * 1000); // 48 hours in milliseconds
      const recentDoses = await medicationDoseRepository.getByDateRange(fortyEightHoursAgo, now, db);

      // 3. Query active episodes
      logger.log('[DebugArchive] Collecting active episodes...');
      const currentEpisode = await episodeRepository.getCurrentEpisode(db);
      const activeEpisodesArray = currentEpisode ? [currentEpisode] : [];

      // 4. Query all medication schedules
      logger.log('[DebugArchive] Collecting medication schedules...');
      const medications = await medicationRepository.getAll(db);
      const medicationSchedules: Array<{
        id: string;
        medicationId: string;
        time: string;
        timezone: string;
        dosage: number;
        enabled: boolean;
        notificationId?: string;
        reminderEnabled?: boolean;
        medicationName: string;
      }> = [];
      
      for (const medication of medications) {
        if (medication.schedule && medication.schedule.length > 0) {
          // Add medication context to schedules for debugging
          const enrichedSchedules = medication.schedule.map(schedule => ({
            ...schedule,
            medicationId: medication.id,
            medicationName: medication.name,
          }));
          medicationSchedules.push(...enrichedSchedules);
        }
      }

      const databaseData: DatabaseDebugData = {
        fullSnapshot,
        recentDoses,
        activeEpisodes: activeEpisodesArray,
        medicationSchedules,
      };

      logger.log('[DebugArchive] Database data collected successfully', {
        snapshotSize: Math.round(fullSnapshot.length / 1024),
        recentDoses: recentDoses.length,
        activeEpisodes: activeEpisodesArray.length,
        medicationSchedules: medicationSchedules.length
      });

      return databaseData;
    } catch (error) {
      logger.error('[DebugArchive] Failed to collect database data:', error);
      return this.getEmptyDatabaseData();
    }
  }

  /**
   * Collect and filter application logs for debugging
   * 
   * @param historyHours Number of hours of log history to include
   */
  public async collectLogData(historyHours: number = 48): Promise<LogDebugData> {
    try {
      logger.log('[DebugArchive] Collecting log data...');

      // Get all logs from logger
      const allLogs = await logger.getLogsAsync();
      
      // Filter logs by time window
      const cutoffTime = Date.now() - (historyHours * 60 * 60 * 1000);
      const recentLogs = allLogs.filter(log => 
        log.timestamp.getTime() >= cutoffTime
      );

      // Filter different types of logs for easier analysis
      const notificationLogs = recentLogs.filter(log =>
        log.message.toLowerCase().includes('notification') ||
        log.message.toLowerCase().includes('remind') ||
        log.context?.source?.toString().toLowerCase().includes('notification')
      );

      const errorLogs = recentLogs.filter(log =>
        log.level >= 2 // WARN and ERROR levels
      );

      const medicationLogs = recentLogs.filter(log =>
        log.message.toLowerCase().includes('medication') ||
        log.message.toLowerCase().includes('dose') ||
        log.context?.source?.toString().toLowerCase().includes('medication')
      );

      const logData: LogDebugData = {
        allLogs: recentLogs,
        notificationLogs,
        errorLogs,
        medicationLogs,
      };

      logger.log('[DebugArchive] Log data collected successfully', {
        totalLogs: recentLogs.length,
        notificationLogs: notificationLogs.length,
        errorLogs: errorLogs.length,
        medicationLogs: medicationLogs.length,
        historyHours
      });
      
      return logData;
    } catch (error) {
      logger.error('[DebugArchive] Failed to collect log data:', error);
      return this.getEmptyLogData();
    }
  }

  /**
   * Collect OS-level notification state and permissions
   */
  public async collectNotificationData(): Promise<NotificationDebugData> {
    try {
      logger.log('[DebugArchive] Collecting notification data...');

      // 1. Get all scheduled notifications from OS
      logger.log('[DebugArchive] Getting OS scheduled notifications...');
      const osNotifications = await notificationService.getAllScheduledNotifications();

      // 2. Filter by medication vs daily checkin types
      const medicationNotifications: NotificationRequest[] = [];
      const dailyCheckinNotifications: NotificationRequest[] = [];
      const orphanedNotifications: NotificationRequest[] = [];

      for (const notification of osNotifications) {
        const data = notification.content.data as Record<string, unknown> | undefined;
        
        // Check if this is a daily checkin notification
        if (data?.sourceType === 'daily_checkin' || 
            notification.content.title?.toLowerCase().includes('daily') ||
            notification.content.title?.toLowerCase().includes('check-in')) {
          dailyCheckinNotifications.push({
            identifier: notification.identifier,
            content: {
              title: notification.content.title ?? undefined,
              body: notification.content.body ?? undefined,
              categoryIdentifier: notification.content.categoryIdentifier ?? undefined,
              data: notification.content.data ?? undefined,
            },
            trigger: {
              type: 'timeInterval', // Default to timeInterval for debug purposes
            }
          });
        } else if (data?.medicationId || data?.medicationIds) {
          // This is a medication notification
          medicationNotifications.push({
            identifier: notification.identifier,
            content: {
              title: notification.content.title ?? undefined,
              body: notification.content.body ?? undefined,
              categoryIdentifier: notification.content.categoryIdentifier ?? undefined,
              data: notification.content.data ?? undefined,
            },
            trigger: {
              type: 'timeInterval', // Default to timeInterval for debug purposes
            }
          });
        } else {
          // Orphaned notification - no clear categorization
          orphanedNotifications.push({
            identifier: notification.identifier,
            content: {
              title: notification.content.title ?? undefined,
              body: notification.content.body ?? undefined,
              categoryIdentifier: notification.content.categoryIdentifier ?? undefined,
              data: notification.content.data ?? undefined,
            },
            trigger: {
              type: 'timeInterval', // Default to timeInterval for debug purposes
            }
          });
        }
      }

      // 3. Get notification permissions
      logger.log('[DebugArchive] Getting notification permissions...');
      const rawPermissions = await notificationService.getPermissions();
      
      // Convert to debug archive format
      const permissions: NotificationPermissionsStatus = {
        granted: rawPermissions.granted,
        status: rawPermissions.granted ? 'granted' : (rawPermissions.canAskAgain ? 'undetermined' : 'denied'),
        canAskAgain: rawPermissions.canAskAgain,
        ios: rawPermissions.ios ? {
          allowsAlert: rawPermissions.ios.allowsAlert,
          allowsBadge: rawPermissions.ios.allowsBadge,
          allowsSound: rawPermissions.ios.allowsSound,
          allowsCriticalAlerts: rawPermissions.ios.allowsCriticalAlerts,
          allowsAnnouncements: false, // Default values for missing properties
          allowsDisplayInCarPlay: false,
          allowsDisplayInNotificationCenter: true,
          allowsDisplayOnLockScreen: true,
          alertStyle: 'banner' as const,
          showPreviews: 'always' as const,
          allowsPreviews: true,
        } : undefined,
      };

      // 4. Get registered notification categories (simplified - expo-notifications doesn't expose getCategories)
      const categories = [
        {
          identifier: 'MEDICATION_REMINDER',
          actions: [
            { identifier: 'TAKE_NOW', title: '✓ Take Now' },
            { identifier: 'SNOOZE_10', title: 'Snooze 10min' },
            { identifier: 'SKIP', title: 'Skip' },
          ]
        },
        {
          identifier: 'MULTIPLE_MEDICATION_REMINDER',
          actions: [
            { identifier: 'TAKE_ALL_NOW', title: '✓ Take All' },
            { identifier: 'REMIND_LATER', title: 'Remind Later' },
            { identifier: 'VIEW_DETAILS', title: 'View Details' },
            { identifier: 'SKIP_ALL', title: 'Skip All' },
          ]
        }
      ];

      // 5. Get recently presented notifications (not available in expo-notifications API)
      const presented: NotificationResponse[] = [];

      const notificationData: NotificationDebugData = {
        scheduled: {
          medicationNotifications,
          dailyCheckinNotifications,
          orphanedNotifications,
        },
        presented,
        permissions,
        categories,
      };

      logger.log('[DebugArchive] Notification data collected successfully', {
        totalScheduled: osNotifications.length,
        medicationNotifications: medicationNotifications.length,
        dailyCheckinNotifications: dailyCheckinNotifications.length,
        orphanedNotifications: orphanedNotifications.length,
        permissionsGranted: permissions.granted
      });

      return notificationData;
    } catch (error) {
      logger.error('[DebugArchive] Failed to collect notification data:', error);
      return this.getEmptyNotificationData();
    }
  }

  /**
   * Collect database notification mappings and reconcile with OS state
   */
  public async collectMappingData(): Promise<MappingDebugData> {
    try {
      logger.log('[DebugArchive] Collecting mapping data...');

      // Check if the scheduled notifications table exists
      const tableExists = await scheduledNotificationRepository.tableExists();
      if (!tableExists) {
        logger.warn('[DebugArchive] Scheduled notifications table does not exist, skipping mapping collection');
        return this.getEmptyMappingData();
      }

      // 1. Query all notification mappings from database
      logger.log('[DebugArchive] Getting database notification mappings...');
      const allMappings = await scheduledNotificationRepository.getAllMappings();

      // 2. Get actual OS notifications for cross-reference
      const osNotifications = await notificationService.getAllScheduledNotifications();
      const osNotificationIds = new Set(osNotifications.map(n => n.identifier));

      // 3. Identify orphaned mappings (DB mappings without OS notifications)
      const orphanedMappings: NotificationMapping[] = [];
      const validMappings: NotificationMapping[] = [];

      for (const mapping of allMappings) {
        if (!osNotificationIds.has(mapping.notificationId)) {
          orphanedMappings.push({
            id: mapping.id,
            medicationId: mapping.medicationId ?? '',
            scheduleId: mapping.scheduleId ?? '',
            notificationId: mapping.notificationId,
            type: mapping.sourceType === 'daily_checkin' ? 'dailyCheckin' : 'medication',
            scheduledTime: mapping.date,
            timezone: 'unknown', // Not stored in current schema
            enabled: true, // Assume enabled if mapped
            createdAt: mapping.createdAt ? new Date(mapping.createdAt).getTime() : Date.now(),
            updatedAt: mapping.createdAt ? new Date(mapping.createdAt).getTime() : Date.now(),
          });
        } else {
          validMappings.push({
            id: mapping.id,
            medicationId: mapping.medicationId ?? '',
            scheduleId: mapping.scheduleId ?? '',
            notificationId: mapping.notificationId,
            type: mapping.sourceType === 'daily_checkin' ? 'dailyCheckin' : 'medication',
            scheduledTime: mapping.date,
            timezone: 'unknown', // Not stored in current schema
            enabled: true, // Assume enabled if mapped
            createdAt: mapping.createdAt ? new Date(mapping.createdAt).getTime() : Date.now(),
            updatedAt: mapping.createdAt ? new Date(mapping.createdAt).getTime() : Date.now(),
          });
        }
      }

      // 4. Identify orphaned notifications (OS notifications without DB mappings)
      const mappingNotificationIds = new Set(allMappings.map(m => m.notificationId));
      const orphanedNotificationIds = osNotifications
        .filter(n => !mappingNotificationIds.has(n.identifier))
        .map(n => n.identifier);

      // 5. Generate reconciliation status summary
      const reconciliationStatus = {
        totalMappings: allMappings.length,
        totalOSNotifications: osNotifications.length,
        orphanedMappings: orphanedMappings.length,
        orphanedNotifications: orphanedNotificationIds.length,
      };

      const mappingData: MappingDebugData = {
        scheduledMappings: validMappings,
        orphanedMappings,
        reconciliationStatus,
      };

      logger.log('[DebugArchive] Mapping data collected successfully', {
        totalMappings: allMappings.length,
        validMappings: validMappings.length,
        orphanedMappings: orphanedMappings.length,
        totalOSNotifications: osNotifications.length,
        orphanedOSNotifications: orphanedNotificationIds.length,
        reconciliationHealth: orphanedMappings.length === 0 && orphanedNotificationIds.length === 0 ? 'healthy' : 'issues-detected'
      });

      return mappingData;
    } catch (error) {
      logger.error('[DebugArchive] Failed to collect mapping data:', error);
      return this.getEmptyMappingData();
    }
  }

  /**
   * Create ZIP archive with all collected debug data
   * 
   * @param data Complete debug archive data
   * @returns Promise resolving to file path of created archive
   */
  private async createZipArchive(data: DebugArchiveData): Promise<string> {
    try {
      logger.log('[DebugArchive] Creating ZIP archive...');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const zip = new (JSZip as any)();

      // Add each data type as a separate JSON file for easier analysis
      zip.file('metadata.json', JSON.stringify(data.metadata, null, 2));
      zip.file('database.json', JSON.stringify(data.database, null, 2));
      zip.file('logs.json', JSON.stringify(data.logs, null, 2));
      zip.file('notifications.json', JSON.stringify(data.notifications, null, 2));
      zip.file('mappings.json', JSON.stringify(data.mappings, null, 2));

      // Add a README with archive structure explanation
      const readmeContent = this.generateArchiveReadme(data.metadata);
      zip.file('README.md', readmeContent);

      // Generate ZIP file
      const zipBuffer = await zip.generateAsync({
        type: 'uint8array',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      // Write to file system
      const fileName = this.getTimestampedFilename();
      const archivePath = `${(FileSystem as unknown as { cacheDirectory: string }).cacheDirectory}${fileName}`;

      // Convert Uint8Array to base64 for FileSystem.writeAsStringAsync
      const base64Data = Buffer.from(zipBuffer).toString('base64');
      await FileSystem.writeAsStringAsync(archivePath, base64Data, {
        encoding: 'base64' as 'base64', // Type assertion for compatibility
      });

      logger.log('[DebugArchive] ZIP archive created successfully:', archivePath);
      return archivePath;
    } catch (error) {
      logger.error('[DebugArchive] Failed to create ZIP archive:', error);
      throw new Error(`Failed to create ZIP archive: ${(error as Error).message}`);
    }
  }

  /**
   * Generate timestamped filename for debug archive
   * Format: debug_archive_2025-12-11_21-21-31.zip
   */
  private getTimestampedFilename(): string {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    return `debug_archive_${dateStr}_${timeStr}.zip`;
  }

  /**
   * Generate README content explaining the archive structure
   */
  private generateArchiveReadme(metadata: SystemMetadata): string {
    return `# MigraLog Debug Archive

Generated: ${metadata.exportTimestamp}
App Version: ${metadata.appVersion}
Build: ${metadata.buildNumber}
Device: ${metadata.deviceModel}
iOS Version: ${metadata.iosVersion}
Schema Version: ${metadata.schemaVersion}

## Archive Contents

- **metadata.json**: System and app metadata
- **database.json**: Database snapshot and recent critical data
- **logs.json**: Application logs with filtered categories
- **notifications.json**: OS notification state and permissions
- **mappings.json**: Notification mapping reconciliation data
- **README.md**: This file

## File Descriptions

### metadata.json
Contains system information, app version, device details, and export timestamps.

### database.json
- \`fullSnapshot\`: Base64 encoded SQLite database file
- \`recentDoses\`: Medication doses from last 48 hours
- \`activeEpisodes\`: Currently active migraine episodes
- \`medicationSchedules\`: All medication schedule configurations

### logs.json
- \`allLogs\`: All application logs from last 48 hours
- \`notificationLogs\`: Notification-related log entries
- \`errorLogs\`: Error and warning log entries only
- \`medicationLogs\`: Medication-related log entries

### notifications.json
- \`scheduled\`: OS-level scheduled notifications by type
- \`presented\`: Recently presented notifications
- \`permissions\`: Current notification permission status
- \`categories\`: Registered notification categories

### mappings.json
- \`scheduledMappings\`: Database notification mapping entries
- \`orphanedMappings\`: Mappings without corresponding OS notifications
- \`reconciliationStatus\`: Summary of mapping consistency

## Privacy Notice

This archive contains health data and should be handled securely. 
Only share with authorized support personnel or healthcare providers.
`;
  }

  // Helper methods for empty data structures
  private getEmptyDatabaseData(): DatabaseDebugData {
    return {
      fullSnapshot: '',
      recentDoses: [],
      activeEpisodes: [],
      medicationSchedules: [],
    };
  }

  private getEmptyLogData(): LogDebugData {
    return {
      allLogs: [],
      notificationLogs: [],
      errorLogs: [],
      medicationLogs: [],
    };
  }

  private getEmptyNotificationData(): NotificationDebugData {
    return {
      scheduled: {
        medicationNotifications: [],
        dailyCheckinNotifications: [],
        orphanedNotifications: [],
      },
        presented: [],
        permissions: this.getEmptyPermissionsStatus(),
        categories: [],
    };
  }

  private getEmptyMappingData(): MappingDebugData {
    return {
      scheduledMappings: [],
      orphanedMappings: [],
      reconciliationStatus: {
        totalMappings: 0,
        totalOSNotifications: 0,
        orphanedMappings: 0,
        orphanedNotifications: 0,
      },
    };
  }

  private getEmptyPermissionsStatus(): NotificationPermissionsStatus {
    return {
      granted: false,
      status: 'undetermined',
      canAskAgain: true,
    };
  }
}

export const debugArchiveService = DebugArchiveService.getInstance();