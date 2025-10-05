import * as SQLite from 'expo-sqlite';
import { createTables, SCHEMA_VERSION } from './schema';
import { migrationRunner } from './migrations';
import { errorLogger } from '../services/errorLogger';

let db: SQLite.SQLiteDatabase | null = null;
let isInitialized = false;
let initializationPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  // If already initialized, return immediately
  if (db && isInitialized) {
    console.log('[DB] Returning existing database instance');
    return db;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    console.log('[DB] Waiting for existing initialization to complete...');
    return initializationPromise;
  }

  console.log('[DB] Initializing database...');

  // Create and store initialization promise BEFORE starting async work
  const doInitialization = async (): Promise<SQLite.SQLiteDatabase> => {
    try {
      console.log('[DB] Opening database...');
      db = await SQLite.openDatabaseAsync('pain_tracker.db');
      console.log('[DB] Database opened successfully');

    // Initialize database schema (creates tables if they don't exist)
    try {
      console.log('[DB] Creating tables...');
      await db.execAsync(createTables);
      console.log('[DB] Tables created successfully');
    } catch (error) {
      console.error('[DB] FAILED to create tables:', error);
      await errorLogger.log(
        'database',
        'Failed to create database tables',
        error as Error,
        { operation: 'createTables' }
      ).catch(e => console.error('[DB] Failed to log error:', e));
      throw error;
    }

    // Initialize migration runner
    try {
      console.log('[DB] Initializing migration runner...');
      await migrationRunner.initialize(db);
      console.log('[DB] Migration runner initialized');
    } catch (error) {
      console.error('[DB] FAILED to initialize migration runner:', error);
      await errorLogger.log(
        'database',
        'Failed to initialize migration runner',
        error as Error,
        { operation: 'migrationRunner.initialize' }
      ).catch(e => console.error('[DB] Failed to log error:', e));
      throw error;
    }

    // Run any pending migrations
    const needsMigration = await migrationRunner.needsMigration();
    if (needsMigration) {
      console.log('[DB] Database migrations needed, running migrations...');
      try {
        // Create backup before migration using db parameter to avoid circular dependency
        // Make backup non-blocking - if it fails, log warning but continue with migration
        const createBackup = async (db: SQLite.SQLiteDatabase) => {
          try {
            const { backupService } = await import('../services/backupService');
            await backupService.createBackup(true, db);
            console.log('[DB] Automatic backup created successfully before migration');
          } catch (backupError) {
            console.warn('[DB] Failed to create automatic backup before migration:', backupError);
            console.warn('[DB] Continuing with migration without backup');
            // Don't throw - allow migration to proceed
          }
        };

        await migrationRunner.runMigrations(createBackup);
        console.log('[DB] Database migrations completed successfully');
      } catch (error) {
        console.error('[DB] FAILED database migration:', error);
        await errorLogger.log(
          'database',
          'Database migration failed',
          error as Error,
          { operation: 'runMigrations' }
        ).catch(e => console.error('[DB] Failed to log error:', e));
        throw error;
      }
    } else {
      console.log('[DB] No migrations needed');
    }

      isInitialized = true;
      console.log('[DB] Database initialization complete');
      return db;
    } catch (error) {
      console.error('[DB] FATAL: Failed to initialize database:', error);
      await errorLogger.log(
        'database',
        'Failed to initialize database',
        error as Error,
        { operation: 'getDatabase' }
      ).catch(e => console.error('[DB] Failed to log error:', e));
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

// Utility function to generate unique IDs
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
