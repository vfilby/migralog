/**
 * Backup Service Facade
 *
 * This file has been refactored into three modules for better maintainability:
 * - BackupServiceImpl.ts: Backup creation and management operations
 * - RestoreService.ts: Backup restoration operations
 * - backupUtils.ts: Shared utilities, constants, and helper functions
 *
 * This facade maintains backward compatibility by combining both services.
 * All consumers can continue using `backupService` as before.
 *
 * See: https://github.com/vfilby/migralog/issues/167
 */

// Re-export types (now in models/types.ts)
export type { BackupMetadata, BackupData } from '../models/types';

// Re-export utilities and constants
export {
  BACKUP_DIR,
  DB_PATH,
  MAX_AUTO_BACKUPS,
  WEEKLY_BACKUP_INTERVAL_MS,
  LAST_WEEKLY_BACKUP_KEY,
  formatFileSize,
  formatDate,
} from './backupUtils';

// Import the actual service implementations
import { backupServiceImpl } from './BackupServiceImpl';
import { restoreService } from './RestoreService';
import * as SQLite from 'expo-sqlite';

/**
 * Combined BackupService that delegates to the appropriate implementation module.
 * This maintains the same API as before the refactoring.
 */
class BackupService {
  // Backup operations - delegate to BackupServiceImpl
  async createSnapshotBackup(db?: SQLite.SQLiteDatabase) {
    return await backupServiceImpl.createSnapshotBackup(db);
  }

  async createBackup(isAutomatic?: boolean, db?: SQLite.SQLiteDatabase) {
    return await backupServiceImpl.createBackup(isAutomatic, db);
  }

  async listBackups() {
    return await backupServiceImpl.listBackups();
  }

  async getBackupMetadata(backupId: string) {
    return await backupServiceImpl.getBackupMetadata(backupId);
  }

  async deleteBackup(backupId: string) {
    return await backupServiceImpl.deleteBackup(backupId);
  }

  async exportBackup(backupId: string) {
    return await backupServiceImpl.exportBackup(backupId);
  }

  async importBackup() {
    return await backupServiceImpl.importBackup();
  }

  async checkForBrokenBackups() {
    return await backupServiceImpl.checkForBrokenBackups();
  }

  async cleanupBrokenBackups() {
    return await backupServiceImpl.cleanupBrokenBackups();
  }

  async exportDataForSharing() {
    return await backupServiceImpl.exportDataForSharing();
  }

  async exportDatabaseFile() {
    return await backupServiceImpl.exportDatabaseFile();
  }

  async checkAndCreateWeeklyBackup(db?: SQLite.SQLiteDatabase) {
    return await backupServiceImpl.checkAndCreateWeeklyBackup(db);
  }

  async getLastWeeklyBackupTime() {
    return await backupServiceImpl.getLastWeeklyBackupTime();
  }

  async getDaysUntilNextWeeklyBackup() {
    return await backupServiceImpl.getDaysUntilNextWeeklyBackup();
  }

  // Restore operations - delegate to RestoreService
  async restoreBackup(backupId: string) {
    return await restoreService.restoreBackup(backupId);
  }

  async importDatabaseFile() {
    return await restoreService.importDatabaseFile();
  }

  // Utility methods
  formatFileSize(bytes: number) {
    return backupServiceImpl.formatFileSize(bytes);
  }

  formatDate(timestamp: number) {
    return backupServiceImpl.formatDate(timestamp);
  }
}

export const backupService = new BackupService();

