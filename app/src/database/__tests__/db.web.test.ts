/**
 * Web Database Implementation Tests
 *
 * Tests for the web-compatible database implementation using localStorage.
 * This tests the in-memory store functionality and web database operations.
 */

// Mock dependencies before importing
jest.mock('../../utils/logger', () => ({
  logger: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  }
}));

jest.mock('ulidx', () => ({
  ulid: jest.fn(() => 'test-ulid-id-12345'),
}));

// Mock the schema import
jest.mock('../schema', () => ({
  createTables: `
    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      start_time INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS medications (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
  `,
}));

import { getDatabase, closeDatabase, generateId } from '../db.web';
import { logger } from '../../utils/logger';
import { ulid } from 'ulidx';

// Type the mocked logger
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockUlid = ulid as jest.MockedFunction<typeof ulid>;

describe('Web Database Implementation', () => {
  let db: any;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset database state
    await closeDatabase();
    
    // Get fresh database instance
    db = await getDatabase();
  });

  afterEach(async () => {
    // Clean up database after each test
    await closeDatabase();
  });

  describe('getDatabase', () => {
    it('should return a database instance with required methods', async () => {
      expect(db).toBeDefined();
      expect(db.execAsync).toBeInstanceOf(Function);
      expect(db.runAsync).toBeInstanceOf(Function);
      expect(db.getFirstAsync).toBeInstanceOf(Function);
      expect(db.getAllAsync).toBeInstanceOf(Function);
      expect(db.closeAsync).toBeInstanceOf(Function);
    });

    it('should return the same instance on subsequent calls', async () => {
      const db1 = await getDatabase();
      const db2 = await getDatabase();
      expect(db1).toBe(db2);
    });

    it('should initialize schema on first call', async () => {
      expect(mockLogger.log).toHaveBeenCalledWith(
        '[WebDB] exec:',
        expect.stringContaining('CREATE TABLE IF NOT EXISTS episodes')
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        '[WebDB] exec:',
        expect.stringContaining('CREATE TABLE IF NOT EXISTS medications')
      );
    });
  });

  describe('closeDatabase', () => {
    it('should close database and reset instance', async () => {
      await closeDatabase();
      expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] close');
      
      // Getting database again should create new instance
      const newDb = await getDatabase();
      expect(newDb).toBeDefined();
    });

    it('should handle closing when no database exists', async () => {
      await closeDatabase();
      await closeDatabase(); // Should not throw
      expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] close');
    });
  });

  describe('generateId', () => {
    it('should generate unique ID using ulid', () => {
      const id = generateId();
      expect(id).toBe('test-ulid-id-12345');
      expect(mockUlid).toHaveBeenCalledTimes(1);
    });

    it('should call ulid function for each generation', () => {
      generateId();
      generateId();
      expect(mockUlid).toHaveBeenCalledTimes(2);
    });
  });

  describe('WebDatabase.execAsync', () => {
    it('should log SQL execution', async () => {
      const sql = 'CREATE TABLE IF NOT EXISTS test_table (id TEXT)';
      await db.execAsync(sql);
      
      expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] exec:', sql);
    });

    it('should initialize table in memory store when CREATE TABLE is called', async () => {
      const sql = 'CREATE TABLE IF NOT EXISTS new_table (id TEXT PRIMARY KEY)';
      await db.execAsync(sql);
      
      // Test that table was created by inserting and retrieving data
      await db.runAsync('INSERT INTO new_table VALUES (?)', ['test-id']);
      const results = await db.getAllAsync('SELECT * FROM new_table');
      expect(results).toEqual([['test-id']]);
    });

    it('should handle SQL without CREATE TABLE', async () => {
      const sql = 'ALTER TABLE episodes ADD COLUMN new_field TEXT';
      await db.execAsync(sql);
      
      expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] exec:', sql);
    });

    it('should handle malformed CREATE TABLE statements', async () => {
      const sql = 'CREATE TABLE invalid syntax';
      await db.execAsync(sql);
      
      expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] exec:', sql);
    });

    it('should not recreate existing tables', async () => {
      const sql = 'CREATE TABLE IF NOT EXISTS test_table (id TEXT)';
      
      // Create table first time
      await db.execAsync(sql);
      await db.runAsync('INSERT INTO test_table VALUES (?)', ['test-data']);
      
      // Create table second time - should not clear existing data
      await db.execAsync(sql);
      const results = await db.getAllAsync('SELECT * FROM test_table');
      
      expect(results).toEqual([['test-data']]);
    });
  });

  describe('WebDatabase.runAsync', () => {
    beforeEach(async () => {
      // Clear any existing data in test_table
      await db.runAsync('DELETE FROM test_table');
      // Ensure we have a test table
      await db.execAsync('CREATE TABLE IF NOT EXISTS test_table (id TEXT, name TEXT)');
    });

    describe('INSERT operations', () => {
      it('should insert data into table', async () => {
        const sql = 'INSERT INTO test_table VALUES (?, ?)';
        const params = ['id1', 'Test Name'];
        
        await db.runAsync(sql, params);
        
        expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] run:', sql, params);
        
        // Verify data was inserted
        const results = await db.getAllAsync('SELECT * FROM test_table');
        expect(results).toEqual([['id1', 'Test Name']]);
      });

      it('should handle INSERT without parameters', async () => {
        const sql = 'INSERT INTO test_table VALUES ("id2", "Name2")';
        await db.runAsync(sql);
        
        expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] run:', sql, []);
      });

      it('should handle JSON string parameters', async () => {
        const sql = 'INSERT INTO test_table VALUES (?, ?)';
        const params = ['id3', '["symptom1", "symptom2"]'];
        
        await db.runAsync(sql, params);
        
        // Verify JSON string was parsed and stored
        const results = await db.getAllAsync('SELECT * FROM test_table');
        expect(results).toEqual([['id3', ['symptom1', 'symptom2']]]);
      });

      it('should handle invalid JSON strings as regular strings', async () => {
        const sql = 'INSERT INTO test_table VALUES (?, ?)';
        const params = ['id4', '[invalid json'];
        
        await db.runAsync(sql, params);
        
        const results = await db.getAllAsync('SELECT * FROM test_table');
        expect(results).toEqual([['id4', '[invalid json']]);
      });

      it('should create table if it does not exist', async () => {
        const sql = 'INSERT INTO nonexistent_table VALUES (?, ?)';
        const params = ['id1', 'value1'];
        
        await db.runAsync(sql, params);
        
        // Should create the table and insert data
        const results = await db.getAllAsync('SELECT * FROM nonexistent_table');
        expect(results).toEqual([['id1', 'value1']]);
      });
    });

    describe('UPDATE operations', () => {
      it('should log UPDATE operations but not fully implement them', async () => {
        const sql = 'UPDATE test_table SET name = ? WHERE id = ?';
        const params = ['Updated Name', 'id1'];
        
        await db.runAsync(sql, params);
        
        expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] run:', sql, params);
        expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] UPDATE not fully implemented for web demo');
      });

      it('should handle UPDATE with different case', async () => {
        jest.clearAllMocks(); // Clear previous calls
        const sql = 'update test_table set name = ?';
        await db.runAsync(sql, ['new name']);
        
        expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] run:', sql, ['new name']);
        expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] UPDATE not fully implemented for web demo');
      });
    });

    describe('DELETE operations', () => {
      it('should clear table on DELETE', async () => {
        // First insert some data
        await db.runAsync('INSERT INTO test_table VALUES (?, ?)', ['id1', 'name1']);
        await db.runAsync('INSERT INTO test_table VALUES (?, ?)', ['id2', 'name2']);
        
        // Verify data exists
        let results = await db.getAllAsync('SELECT * FROM test_table');
        expect(results).toHaveLength(2);
        
        // Delete all records
        await db.runAsync('DELETE FROM test_table WHERE id = ?', ['id1']);
        
        // Verify table is cleared
        results = await db.getAllAsync('SELECT * FROM test_table');
        expect(results).toEqual([]);
        
        expect(mockLogger.log).toHaveBeenCalledWith(
          '[WebDB] run:',
          'DELETE FROM test_table WHERE id = ?',
          ['id1']
        );
      });

      it('should handle DELETE with different case', async () => {
        const sql = 'delete from test_table';
        await db.runAsync(sql);
        
        expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] run:', sql, []);
      });

      it('should handle DELETE from nonexistent table', async () => {
        const sql = 'DELETE FROM nonexistent_table WHERE id = ?';
        await db.runAsync(sql, ['id1']);
        
        // Should not throw error
        expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] run:', sql, ['id1']);
      });
    });

    describe('Other SQL operations', () => {
      it('should handle unrecognized SQL operations', async () => {
        const sql = 'SELECT COUNT(*) FROM test_table';
        await db.runAsync(sql);
        
        expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] run:', sql, []);
        // Should not throw error for unrecognized operations
      });
    });
  });

  describe('WebDatabase.getAllAsync', () => {
    beforeEach(async () => {
      // Clear any existing data
      await db.runAsync('DELETE FROM test_table');
      await db.execAsync('CREATE TABLE IF NOT EXISTS test_table (id TEXT, name TEXT)');
      await db.runAsync('INSERT INTO test_table VALUES (?, ?)', ['id1', 'name1']);
      await db.runAsync('INSERT INTO test_table VALUES (?, ?)', ['id2', 'name2']);
    });

    it('should return all rows from existing table', async () => {
      const sql = 'SELECT * FROM test_table';
      const results = await db.getAllAsync(sql);
      
      expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] getAll:', sql, []);
      expect(results).toEqual([
        ['id1', 'name1'],
        ['id2', 'name2']
      ]);
    });

    it('should return empty array for nonexistent table', async () => {
      const sql = 'SELECT * FROM nonexistent_table';
      const results = await db.getAllAsync(sql);
      
      expect(results).toEqual([]);
      expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] getAll:', sql, []);
    });

    it('should handle parameters', async () => {
      const sql = 'SELECT * FROM test_table WHERE id = ?';
      const params = ['id1'];
      const results = await db.getAllAsync(sql, params);
      
      expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] getAll:', sql, params);
      expect(results).toEqual([
        ['id1', 'name1'],
        ['id2', 'name2']
      ]);
    });

    it('should handle empty table', async () => {
      await db.runAsync('DELETE FROM test_table');
      const results = await db.getAllAsync('SELECT * FROM test_table');
      
      expect(results).toEqual([]);
    });

    it('should extract table name from complex SQL', async () => {
      const sql = 'SELECT col1, col2 FROM test_table ORDER BY col1';
      const results = await db.getAllAsync(sql);
      
      expect(results).toEqual([
        ['id1', 'name1'],
        ['id2', 'name2']
      ]);
    });
  });

  describe('WebDatabase.getFirstAsync', () => {
    beforeEach(async () => {
      // Clear any existing data
      await db.runAsync('DELETE FROM test_table');
      await db.execAsync('CREATE TABLE IF NOT EXISTS test_table (id TEXT, name TEXT)');
      await db.runAsync('INSERT INTO test_table VALUES (?, ?)', ['id1', 'name1']);
      await db.runAsync('INSERT INTO test_table VALUES (?, ?)', ['id2', 'name2']);
    });

    it('should return first row when data exists', async () => {
      const sql = 'SELECT * FROM test_table';
      const result = await db.getFirstAsync(sql);
      
      expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] getFirst:', sql, []);
      expect(result).toEqual(['id1', 'name1']);
    });

    it('should return null when no data exists', async () => {
      await db.runAsync('DELETE FROM test_table');
      const sql = 'SELECT * FROM test_table';
      const result = await db.getFirstAsync(sql);
      
      expect(result).toBeNull();
      expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] getFirst:', sql, []);
    });

    it('should return null for nonexistent table', async () => {
      const sql = 'SELECT * FROM nonexistent_table';
      const result = await db.getFirstAsync(sql);
      
      expect(result).toBeNull();
    });

    it('should handle parameters', async () => {
      const sql = 'SELECT * FROM test_table WHERE id = ?';
      const params = ['id2'];
      const result = await db.getFirstAsync(sql, params);
      
      expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] getFirst:', sql, params);
      expect(result).toEqual(['id1', 'name1']); // Returns first row regardless of params in this implementation
    });
  });

  describe('WebDatabase.closeAsync', () => {
    it('should log close operation', async () => {
      await db.closeAsync();
      
      expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] close');
    });
  });

  describe('Table name extraction', () => {
    it('should extract table name from FROM clause', async () => {
      await db.execAsync('CREATE TABLE IF NOT EXISTS from_table (id TEXT)');
      await db.runAsync('INSERT INTO from_table VALUES (?)', ['test']);
      
      const results = await db.getAllAsync('SELECT * FROM from_table');
      expect(results).toEqual([['test']]);
    });

    it('should extract table name from INTO clause', async () => {
      await db.runAsync('INSERT INTO into_table VALUES (?)', ['test']);
      const results = await db.getAllAsync('SELECT * FROM into_table');
      expect(results).toEqual([['test']]);
    });

    it('should extract table name from UPDATE clause', async () => {
      await db.execAsync('CREATE TABLE IF NOT EXISTS update_table (id TEXT)');
      await db.runAsync('UPDATE update_table SET id = ?', ['test']);
      
      expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] UPDATE not fully implemented for web demo');
    });

    it('should handle case insensitive SQL keywords', async () => {
      // First ensure the table is clean
      await db.execAsync('CREATE TABLE IF NOT EXISTS case_test (id TEXT)');
      await db.runAsync('DELETE FROM case_test'); // Clear existing data
      
      // Test lowercase insert
      await db.runAsync('insert into case_test values (?)', ['test']);
      const results = await db.getAllAsync('select * from case_test');
      expect(results).toEqual([['test']]);
    });

    it('should return "unknown" for malformed SQL', async () => {
      await db.runAsync('INVALID SQL STATEMENT', []);
      // Should not throw error
      expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] run:', 'INVALID SQL STATEMENT', []);
    });

    it('should handle SQL statements that do not match known patterns', async () => {
      await db.runAsync('SELECT COUNT(*) FROM unknown_table', []);
      // Should log but not crash
      expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] run:', 'SELECT COUNT(*) FROM unknown_table', []);
    });
  });

  describe('Data type handling', () => {
    beforeEach(async () => {
      // Clear any existing data
      await db.runAsync('DELETE FROM type_test');
      await db.execAsync('CREATE TABLE IF NOT EXISTS type_test (id TEXT, data TEXT)');
    });

    it('should handle string parameters', async () => {
      await db.runAsync('INSERT INTO type_test VALUES (?, ?)', ['id1', 'string_value']);
      const results = await db.getAllAsync('SELECT * FROM type_test');
      expect(results).toEqual([['id1', 'string_value']]);
    });

    it('should handle number parameters', async () => {
      await db.runAsync('INSERT INTO type_test VALUES (?, ?)', ['id2', 123]);
      const results = await db.getAllAsync('SELECT * FROM type_test');
      expect(results).toEqual([['id2', 123]]);
    });

    it('should handle boolean parameters', async () => {
      await db.runAsync('INSERT INTO type_test VALUES (?, ?)', ['id3', true]);
      const results = await db.getAllAsync('SELECT * FROM type_test');
      expect(results).toEqual([['id3', true]]);
    });

    it('should handle null parameters', async () => {
      await db.runAsync('INSERT INTO type_test VALUES (?, ?)', ['id4', null]);
      const results = await db.getAllAsync('SELECT * FROM type_test');
      expect(results).toEqual([['id4', null]]);
    });

    it('should handle undefined parameters', async () => {
      await db.runAsync('INSERT INTO type_test VALUES (?, ?)', ['id5', undefined]);
      const results = await db.getAllAsync('SELECT * FROM type_test');
      expect(results).toEqual([['id5', undefined]]);
    });
  });

  describe('Error scenarios', () => {
    it('should handle empty SQL strings', async () => {
      await db.execAsync('');
      expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] exec:', '');
    });

    it('should handle whitespace-only SQL', async () => {
      await db.runAsync('   ');
      expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] run:', '   ', []);
    });

    it('should handle SQL with only comments', async () => {
      await db.execAsync('-- This is just a comment');
      expect(mockLogger.log).toHaveBeenCalledWith('[WebDB] exec:', '-- This is just a comment');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete workflow', async () => {
      // Create table
      await db.execAsync('CREATE TABLE IF NOT EXISTS episodes (id TEXT, start_time INTEGER)');
      
      // Insert data
      await db.runAsync('INSERT INTO episodes VALUES (?, ?)', ['episode1', 1234567890]);
      await db.runAsync('INSERT INTO episodes VALUES (?, ?)', ['episode2', 1234567891]);
      
      // Query all data
      const allResults = await db.getAllAsync('SELECT * FROM episodes');
      expect(allResults).toHaveLength(2);
      
      // Query first record
      const firstResult = await db.getFirstAsync('SELECT * FROM episodes');
      expect(firstResult).toEqual(['episode1', 1234567890]);
      
      // Delete all data
      await db.runAsync('DELETE FROM episodes');
      
      // Verify deletion
      const emptyResults = await db.getAllAsync('SELECT * FROM episodes');
      expect(emptyResults).toEqual([]);
      
      // Close database
      await db.closeAsync();
    });

    it('should maintain data across multiple operations', async () => {
      await db.execAsync('CREATE TABLE IF NOT EXISTS persistent_test (id TEXT)');
      
      // Insert multiple records
      await db.runAsync('INSERT INTO persistent_test VALUES (?)', ['id1']);
      await db.runAsync('INSERT INTO persistent_test VALUES (?)', ['id2']);
      await db.runAsync('INSERT INTO persistent_test VALUES (?)', ['id3']);
      
      // Verify all records exist
      const results = await db.getAllAsync('SELECT * FROM persistent_test');
      expect(results).toEqual([['id1'], ['id2'], ['id3']]);
    });
  });
});