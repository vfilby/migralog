// Integration test for database retry wrapper
import { episodeRepository } from '../episodeRepository';

// Simple integration test to verify retry wrapper integration
describe('Database Retry Integration', () => {
  test('should work with existing repository patterns', async () => {
    // This test mainly verifies that the wrapped database maintains the same interface
    // and that repository methods can still call database methods without errors
    
    // Mock the database to test interface compatibility
    const mockDb = {
      runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
      getAllAsync: jest.fn().mockResolvedValue([]),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      execAsync: jest.fn().mockResolvedValue(undefined),
      withTransactionAsync: jest.fn().mockImplementation(async (fn) => fn(mockDb)),
      withExclusiveTransactionAsync: jest.fn().mockImplementation(async (fn) => fn(mockDb)),
      closeAsync: jest.fn().mockResolvedValue(undefined),
      databasePath: '/test/path',
      options: {},
    };

    // Test that repository methods can work with the wrapped database interface
    try {
      // This should not throw type errors or runtime errors
      await episodeRepository.getAll(10, 0, mockDb as any);
      await episodeRepository.getCurrentEpisode(mockDb as any);
      
      // Verify that the mock methods were called
      expect(mockDb.getAllAsync).toHaveBeenCalled();
      expect(mockDb.getFirstAsync).toHaveBeenCalled();
    } catch (error) {
      // If there are interface compatibility issues, they will show up here
      console.error('Integration test failed:', error);
      throw error;
    }
  });

  test('database wrapper preserves all required properties', async () => {
    // Mock database with all required SQLite properties
    const mockDb = {
      runAsync: jest.fn(),
      getAllAsync: jest.fn(),
      getFirstAsync: jest.fn(),
      execAsync: jest.fn(),
      withTransactionAsync: jest.fn(),
      withExclusiveTransactionAsync: jest.fn(),
      closeAsync: jest.fn(),
      databasePath: '/mock/path',
      options: { enableChangeListener: true },
      // Add other SQLite properties that might be accessed
    };

    const { createRetryWrapper } = await import('../retryWrapper');
    const wrappedDb = createRetryWrapper(mockDb as any);

    // Verify that important properties are preserved
    expect(wrappedDb.databasePath).toBe('/mock/path');
    expect(wrappedDb.options).toEqual({ enableChangeListener: true });
    
    // Verify that all methods exist and are functions
    expect(typeof wrappedDb.runAsync).toBe('function');
    expect(typeof wrappedDb.getAllAsync).toBe('function');
    expect(typeof wrappedDb.getFirstAsync).toBe('function');
    expect(typeof wrappedDb.execAsync).toBe('function');
    expect(typeof wrappedDb.withTransactionAsync).toBe('function');
    expect(typeof wrappedDb.withExclusiveTransactionAsync).toBe('function');
    expect(typeof wrappedDb.closeAsync).toBe('function');
  });
});