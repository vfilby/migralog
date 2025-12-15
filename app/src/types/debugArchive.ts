/**
 * Type definitions for Debug Archive feature
 * 
 * The debug archive creates a comprehensive ZIP file containing all necessary
 * information for debugging app issues including logs, database state,
 * notification state, and system metadata.
 */

// Import types from existing models
import type { LogEntry } from '../utils/logger';
import type { MedicationDose, Episode, MedicationSchedule } from '../models/types';

export interface SystemMetadata {
  exportTimestamp: string;          // ISO string in UTC
  exportTimestampLocal: string;     // ISO string in local timezone
  timezone: string;                 // IANA timezone identifier
  appVersion: string;               // From buildInfo.version
  buildNumber: string;              // From buildInfo.buildNumber
  iosVersion: string;               // iOS version string
  deviceModel: string;              // Device model identifier
  schemaVersion: number;            // Current database schema version
  archiveFormat: string;            // Archive format version for compatibility
}

export interface DatabaseDebugData {
  fullSnapshot: string;                    // Base64 encoded SQLite database file
  recentDoses: MedicationDose[];          // Last 48h medication doses for quick analysis
  activeEpisodes: Episode[];              // Current active episodes
  medicationSchedules: MedicationSchedule[]; // All medication schedules with timing info
}

export interface LogDebugData {
  allLogs: LogEntry[];                    // Complete 48h log history from logger
  notificationLogs: LogEntry[];           // Filtered notification-related events
  errorLogs: LogEntry[];                 // Errors and warnings only
  medicationLogs: LogEntry[];            // Medication dose logging events
}

export interface NotificationDebugData {
  scheduled: {
    medicationNotifications: NotificationRequest[];    // OS-level scheduled medication notifications
    dailyCheckinNotifications: NotificationRequest[];  // OS-level scheduled daily checkin notifications
    orphanedNotifications: NotificationRequest[];      // Notifications without database mappings
  };
  presented: NotificationResponse[];                    // Recently presented notifications
  permissions: NotificationPermissionsStatus;          // Current notification permissions
  categories: NotificationCategory[];                   // Registered notification categories
}

export interface MappingDebugData {
  scheduledMappings: NotificationMapping[];           // Database notification mappings
  orphanedMappings: NotificationMapping[];            // Database mappings without OS notifications
  reconciliationStatus: {
    totalMappings: number;            // Total mappings in database
    totalOSNotifications: number;     // Total OS notifications scheduled
    orphanedMappings: number;         // Mappings without corresponding OS notifications
    orphanedNotifications: number;    // OS notifications without database mappings
  };
}

// Additional types for notification debugging
export interface NotificationRequest {
  identifier: string;
  content: {
    title?: string;
    body?: string;
    categoryIdentifier?: string;
    data?: Record<string, unknown>;
  };
  trigger: {
    type: 'timeInterval' | 'daily' | 'calendar';
    seconds?: number;
    repeats?: boolean;
  };
}

export interface NotificationResponse {
  request: NotificationRequest;
  date: number;
  actionIdentifier?: string;
}

export interface NotificationPermissionsStatus {
  granted: boolean;
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
  expires?: 'never' | number;
  android?: {
    importance: number;
    interruptionFilter: number;
  };
  ios?: {
    allowsAlert: boolean;
    allowsBadge: boolean;
    allowsSound: boolean;
    allowsCriticalAlerts: boolean;
    allowsAnnouncements: boolean;
    allowsDisplayInCarPlay: boolean;
    allowsDisplayInNotificationCenter: boolean;
    allowsDisplayOnLockScreen: boolean;
    alertStyle: 'none' | 'banner' | 'alert';
    showPreviews: 'always' | 'whenAuthenticated' | 'never';
    allowsPreviews: boolean;
  };
}

export interface NotificationCategory {
  identifier: string;
  actions: NotificationAction[];
  options?: {
    allowInCarPlay?: boolean;
    allowAnnouncement?: boolean;
    intentIdentifiers?: string[];
    hiddenPreviewsBodyPlaceholder?: string;
    categorySummaryFormat?: string;
  };
}

export interface NotificationAction {
  identifier: string;
  title: string;
  options?: {
    isAuthenticationRequired?: boolean;
    isDestructive?: boolean;
    opensAppToForeground?: boolean;
  };
}

export interface NotificationMapping {
  id: string;
  medicationId: string;
  scheduleId: string;
  notificationId: string;
  type: 'medication' | 'dailyCheckin';
  scheduledTime: string; // ISO string
  timezone: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DebugArchiveData {
  metadata: SystemMetadata;
  database: DatabaseDebugData;
  logs: LogDebugData;
  notifications: NotificationDebugData;
  mappings: MappingDebugData;
}

/**
 * Configuration for debug archive generation
 */
export interface DebugArchiveOptions {
  includeFullDatabase?: boolean;     // Whether to include full database snapshot (default: true)
  includeLogs?: boolean;             // Whether to include logs (default: true)
  includeNotifications?: boolean;    // Whether to include notification state (default: true)
  logHistoryHours?: number;          // Hours of log history to include (default: 48)
  progressCallback?: (message: string, progress: number) => void; // Progress updates
}