// Web-compatible database implementation using localStorage
// This is a simplified version for web testing - data won't persist across sessions in production

import { ulid } from 'ulidx';
import { logger } from '../utils/logger';

interface WebDatabase {
  execAsync: (sql: string) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runAsync: (sql: string, params?: any[]) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getFirstAsync: <T>(sql: string, params?: any[]) => Promise<T | null>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAllAsync: <T>(sql: string, params?: any[]) => Promise<T[]>;
  closeAsync: () => Promise<void>;
}

// Simple in-memory store for web (row data types vary by table)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: Map<string, any[]> = new Map();

// Helper to parse table name from SQL
const getTableName = (sql: string): string => {
  const match = sql.match(/(?:FROM|INTO|UPDATE)\s+(\w+)/i);
  return match ? match[1] : 'unknown';
};

const webDb: WebDatabase = {
  async execAsync(sql: string) {
    logger.log('[WebDB] exec:', sql);
    // Initialize tables in memory
    const tableMatch = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
    if (tableMatch) {
      const tableName = tableMatch[1];
      if (!store.has(tableName)) {
        store.set(tableName, []);
      }
    }
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async runAsync(sql: string, params: any[] = []) {
    logger.log('[WebDB] run:', sql, params);

    if (sql.trim().startsWith('INSERT')) {
      const tableName = getTableName(sql);
      const table = store.get(tableName) || [];

      // Simple insert - just store the params as a row
      const values = params.map(p => (typeof p === 'string' && p.startsWith('[')) ? JSON.parse(p) : p);
      table.push(values);
      store.set(tableName, table);
    } else if (sql.trim().startsWith('UPDATE')) {
      // For demo purposes, update operations are logged but not fully implemented
      logger.log('[WebDB] UPDATE not fully implemented for web demo');
    } else if (sql.trim().startsWith('DELETE')) {
      const tableName = getTableName(sql);
      // Simple delete - clear the table
      store.set(tableName, []);
    }
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getFirstAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
    logger.log('[WebDB] getFirst:', sql, params);
    const results = await this.getAllAsync<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    logger.log('[WebDB] getAll:', sql, params);
    const tableName = getTableName(sql);
    const table = store.get(tableName) || [];

    // Return all rows (simplified - no WHERE clause handling)
    return table as T[];
  },

  async closeAsync() {
    logger.log('[WebDB] close');
  },
};

let db: WebDatabase | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getDatabase = async (): Promise<any> => {
  if (db) {
    return db;
  }

  db = webDb;

  // Initialize schema (tables will be created in memory)
  const { createTables } = await import('./schema');
  await db.execAsync(createTables);

  return db;
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
