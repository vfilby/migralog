import { ulid } from 'ulidx';
import * as SQLite from 'expo-sqlite';
import { createTables } from './schema';
import { migrationRunner } from './migrations';
import { errorLogger } from '../services/errorLogger';
import { logger } from '../utils/logger';

let db: SQLite.SQLiteDatabase | null = null;
let isInitialized = false;
let initializationPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  // If already initialized, return immediately
  if (db && isInitialized) {
    // Don't log - this happens on every database access and creates noise
    return db;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    logger.log('[DB] Waiting for existing initialization to complete...');
    return initializationPromise;
  }

  logger.log('[DB] Initializing database...');

  // Create and store initialization promise BEFORE starting async work
  const doInitialization = async (): Promise<SQLite.SQLiteDatabase> => {
    try {
      logger.log('[DB] Opening database...');
      db = await SQLite.openDatabaseAsync('migralog.db');
      logger.log('[DB] Database opened successfully');

    // Enable foreign key constraints (must be done before any other operations)
    // SQLite has foreign keys disabled by default
    try {
      logger.log('[DB] Enabling foreign key constraints...');
      await db.execAsync('PRAGMA foreign_keys = ON;');
      logger.log('[DB] Foreign key constraints enabled');
    } catch (error) {
      logger.error('[DB] FAILED to enable foreign keys:', error);
      await errorLogger.log(
        'database',
        'Failed to enable foreign key constraints',
        error as Error,
        { operation: 'enableForeignKeys' }
      ).catch(e => logger.error('[DB] Failed to log error:', e));
      throw error;
    }

    // Initialize database schema (creates tables if they don't exist)
    try {
      logger.log('[DB] Creating tables...');
      await db.execAsync(createTables);
      logger.log('[DB] Tables created successfully');
    } catch (error) {
      logger.error('[DB] FAILED to create tables:', error);
      await errorLogger.log(
        'database',
        'Failed to create database tables',
        error as Error,
        { operation: 'createTables' }
      ).catch(e => logger.error('[DB] Failed to log error:', e));
      throw error;
    }

    // Initialize migration runner
    try {
      logger.log('[DB] Initializing migration runner...');
      await migrationRunner.initialize(db);
      logger.log('[DB] Migration runner initialized');
    } catch (error) {
      logger.error('[DB] FAILED to initialize migration runner:', error);
      await errorLogger.log(
        'database',
        'Failed to initialize migration runner',
        error as Error,
        { operation: 'migrationRunner.initialize' }
      ).catch(e => logger.error('[DB] Failed to log error:', e));
      throw error;
    }

    // Run any pending migrations
    const needsMigration = await migrationRunner.needsMigration();
    if (needsMigration) {
      logger.log('[DB] Database migrations needed, running migrations...');
      try {
        // Create snapshot backup before migration (DB file copy - safer than JSON export)
        // Make backup non-blocking - if it fails, log warning but continue with migration
        const createBackup = async (db: SQLite.SQLiteDatabase) => {
          try {
            const { backupService } = await import('../services/backupService');
            await backupService.createSnapshotBackup(db);
            logger.log('[DB] Automatic snapshot backup created successfully before migration');
          } catch (backupError) {
            logger.warn('[DB] Failed to create automatic snapshot backup before migration:', backupError);
            logger.warn('[DB] Continuing with migration without backup');
            // Don't throw - allow migration to proceed
          }
        };

        await migrationRunner.runMigrations(createBackup);
        logger.log('[DB] Database migrations completed successfully');
      } catch (error) {
        logger.error('[DB] FAILED database migration:', error);
        await errorLogger.log(
          'database',
          'Database migration failed',
          error as Error,
          { operation: 'runMigrations' }
        ).catch(e => logger.error('[DB] Failed to log error:', e));
        throw error;
      }
    } else {
      logger.log('[DB] No migrations needed');
    }

    // Check and create weekly backup if needed (non-blocking)
    try {
      const { backupService } = await import('../services/backupService');
      logger.log('[DB] Checking for weekly backup...');
      await backupService.checkAndCreateWeeklyBackup(db);
    } catch (backupError) {
      logger.warn('[DB] Failed to check/create weekly backup:', backupError);
      // Don't throw - weekly backup failure shouldn't prevent app from starting
    }

      isInitialized = true;
      logger.log('[DB] Database initialization complete');
      return db;
    } catch (error) {
      logger.error('[DB] FATAL: Failed to initialize database:', error);
      await errorLogger.log(
        'database',
        'Failed to initialize database',
        error as Error,
        { operation: 'getDatabase' }
      ).catch(e => logger.error('[DB] Failed to log error:', e));
      throw error;
    } finally {
      // Clear initialization promise whether success or failure
      initializationPromise = null;
    }
  };

  // Set the promise FIRST, then start the work
  initializationPromise = doInitialization();
  return initializationPromise;
};

export const closeDatabase = async (): Promise<void> => {
  if (db) {
    await db.closeAsync();
    db = null;
  }
};

// Utility function to generate unique IDs using ULID
// ULID provides: 128-bit, lexicographically sortable, cryptographically secure
export const generateId = (): string => {
  return ulid();
};
