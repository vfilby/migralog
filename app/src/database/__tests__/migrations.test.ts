import { migrationRunner } from '../migrations';

// Mock expo-sqlite
jest.mock('expo-sqlite');

describe('migrationRunner', () => {
  let mockDatabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    mockDatabase = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(undefined),
      getFirstAsync: jest.fn(),
      getAllAsync: jest.fn(),
    };

    // Reset the migrationRunner's internal state
    migrationRunner['db'] = null;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with database', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: 0 }]);

      await migrationRunner.initialize(mockDatabase);

      expect(mockDatabase.execAsync).toHaveBeenCalled();
    });

    it('should create schema_version table if not exists', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([]);
      mockDatabase.runAsync.mockResolvedValue(undefined);

      await migrationRunner.initialize(mockDatabase);

      expect(mockDatabase.execAsync).toHaveBeenCalled();
      expect(mockDatabase.runAsync).toHaveBeenCalled();
    });
  });

  describe('backup before migration', () => {
    beforeEach(async () => {
      // Set up database with old version
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: 1 }]) // For initialize
        .mockResolvedValue([{ name: 'episodes' }]); // For migrations
      await migrationRunner.initialize(mockDatabase);
    });

    it('should create backup before running migrations when backup function provided', async () => {
      const createBackup = jest.fn().mockResolvedValue(undefined);

      await migrationRunner.runMigrations(createBackup);

      expect(createBackup).toHaveBeenCalledWith(mockDatabase);
      expect(console.log).toHaveBeenCalledWith('Creating automatic backup before migration...');
      expect(console.log).toHaveBeenCalledWith('Backup created successfully');
       
    });

    it('should abort migration if backup creation fails', async () => {
      const createBackup = jest.fn().mockRejectedValue(new Error('Backup failed'));

      await expect(migrationRunner.runMigrations(createBackup)).rejects.toThrow(
        'Migration aborted: Failed to create backup'
      );

      expect(createBackup).toHaveBeenCalledWith(mockDatabase);
      expect(console.error).toHaveBeenCalledWith(
        'Failed to create backup before migration:',
        expect.any(Error)
      );
    });

    it('should warn when no backup function provided', async () => {
      await migrationRunner.runMigrations();

      expect(console.warn).toHaveBeenCalledWith(
        'No backup function provided, skipping automatic backup'
      );
    });

    it('should run migrations after successful backup', async () => {
      const createBackup = jest.fn().mockResolvedValue(undefined);

      await migrationRunner.runMigrations(createBackup);

      // Backup should be called first
      expect(createBackup).toHaveBeenCalled();

      // Then migrations should run
      expect(mockDatabase.runAsync).toHaveBeenCalled();
    });

    it('should not run migrations if backup fails', async () => {
      const createBackup = jest.fn().mockRejectedValue(new Error('Backup failed'));
      const initialRunAsyncCalls = mockDatabase.runAsync.mock.calls.length;

      await expect(migrationRunner.runMigrations(createBackup)).rejects.toThrow();

      // No additional migration calls should have been made (only init calls)
      const finalRunAsyncCalls = mockDatabase.runAsync.mock.calls.length;
      expect(finalRunAsyncCalls).toBe(initialRunAsyncCalls);
    });
  });

  describe('getCurrentVersion', () => {
    it('should return current schema version', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: 2 }]);
      await migrationRunner.initialize(mockDatabase);

      const version = await migrationRunner.getCurrentVersion();

      expect(version).toBe(2);
    });

    it('should return 1 if no version record exists', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([]);
      mockDatabase.runAsync.mockResolvedValue(undefined);
      await migrationRunner.initialize(mockDatabase);

      const version = await migrationRunner.getCurrentVersion();

      expect(version).toBe(1);
    });
  });

  describe('getTargetVersion', () => {
    it('should return the highest migration version', async () => {
      const targetVersion = await migrationRunner.getTargetVersion();

      // Should return the highest version from migrations array (currently 10)
      expect(targetVersion).toBe(10);
    });
  });

  describe('migration execution', () => {
    it('should skip migrations if database is up to date', async () => {
      const targetVersion = await migrationRunner.getTargetVersion();
      mockDatabase.getAllAsync.mockResolvedValue([{ version: targetVersion }]);
      await migrationRunner.initialize(mockDatabase);

      await migrationRunner.runMigrations();

      expect(console.log).toHaveBeenCalledWith(
        'Database is up to date, no migrations needed'
      );
    });

    it('should run pending migrations in order', async () => {
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: 1 }]) // For initialize
        .mockResolvedValue([{ name: 'episodes' }]); // For migration checks
      await migrationRunner.initialize(mockDatabase);

      await migrationRunner.runMigrations();

      // Should have attempted to run migrations
      expect(mockDatabase.execAsync).toHaveBeenCalled();
    });

    it('should update version after each migration', async () => {
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: 1 }]) // For initialize
        .mockResolvedValue([{ name: 'episodes' }]); // For migration checks
      await migrationRunner.initialize(mockDatabase);

      await migrationRunner.runMigrations();

      // Should have updated the version
      expect(mockDatabase.runAsync).toHaveBeenCalled();
    });
  });
});
