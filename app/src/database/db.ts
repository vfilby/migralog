import * as SQLite from 'expo-sqlite';
import { createTables, SCHEMA_VERSION } from './schema';
import { migrationRunner } from './migrations';

let db: SQLite.SQLiteDatabase | null = null;
let isInitialized = false;

export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (db && isInitialized) {
    return db;
  }

  db = await SQLite.openDatabaseAsync('pain_tracker.db');

  // Initialize database schema (creates tables if they don't exist)
  await db.execAsync(createTables);

  // Initialize migration runner
  await migrationRunner.initialize(db);

  // Run any pending migrations
  const needsMigration = await migrationRunner.needsMigration();
  if (needsMigration) {
    console.log('Database migrations needed, running migrations...');
    try {
      await migrationRunner.runMigrations();
      console.log('Database migrations completed successfully');
    } catch (error) {
      console.error('Database migration failed:', error);
      throw error;
    }
  }

  isInitialized = true;
  return db;
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
