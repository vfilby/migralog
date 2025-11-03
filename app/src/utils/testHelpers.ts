/**
 * Test Helpers - Database Reset and Test Fixtures
 *
 * SECURITY: These functions are only available in development builds
 * and will be stripped from production builds.
 */

import { logger } from '../utils/logger';
import { getDatabase } from '../database/db';
import { backupService } from '../services/backupService';
import { useDailyStatusStore } from '../store/dailyStatusStore';
import { Alert } from 'react-native';

/**
 * Mock ULID for deterministic tests
 * Generates a valid ULID format with predictable values for testing
 */
export const mockUlid = (seed: number = 0): string => {
  // ULID format: 26 characters, Base32 encoded
  // First 10 chars: timestamp (48 bits)
  // Last 16 chars: randomness (80 bits)
  const timestamp = (1609459200000 + seed).toString(36).toUpperCase().padStart(10, '0');
  const random = seed.toString(36).toUpperCase().padStart(16, '0');
  return `${timestamp}${random}`.substring(0, 26);
};

// Compile-time check - this entire module is excluded in production
if (__DEV__ === false) {
  throw new Error('testHelpers.ts should not be imported in production builds');
}

/**
 * Reset database to clean state with automatic backup
 * ONLY available in __DEV__ mode
 */
export async function resetDatabaseForTesting(options: {
  createBackup?: boolean;
  loadFixtures?: boolean;
} = {}) {
  const { createBackup = true, loadFixtures = false } = options;

  logger.log('[TestHelpers] Starting database reset...');

  try {
    // 1. Create backup before reset (safety measure)
    if (createBackup) {
      logger.log('[TestHelpers] Creating pre-reset backup...');
      const backupId = await backupService.createBackup(false); // Not automatic
      logger.log(`[TestHelpers] Backup created: ${backupId}`);
    }

    // 2. Get database instance
    const db = await getDatabase();

    // 3. Clear all data from tables (preserves schema)
    logger.log('[TestHelpers] Clearing all tables...');
    await db.execAsync('DELETE FROM medication_reminders');
    await db.execAsync('DELETE FROM medication_doses');
    await db.execAsync('DELETE FROM medication_schedules');
    await db.execAsync('DELETE FROM medications');
    await db.execAsync('DELETE FROM symptom_logs');
    await db.execAsync('DELETE FROM intensity_readings');
    await db.execAsync('DELETE FROM episode_notes');
    await db.execAsync('DELETE FROM episodes');
    await db.execAsync('DELETE FROM daily_status_logs');

    logger.log('[TestHelpers] All tables cleared');

    // 4. Reset Zustand stores to clear in-memory state
    logger.log('[TestHelpers] Resetting stores...');
    useDailyStatusStore.getState().reset();

    // 4a. Clear cache manager to prevent stale data after reset
    const { cacheManager } = await import('./cacheManager');
    cacheManager.clear();
    logger.log('[TestHelpers] Cache cleared');

    logger.log('[TestHelpers] Stores reset');

    // 5. Optionally load test fixtures
    if (loadFixtures) {
      logger.log('[TestHelpers] Loading test fixtures...');
      await loadTestFixtures();

      // 5a. Reload stores with new fixture data
      logger.log('[TestHelpers] Reloading stores with fixture data...');
      const { useMedicationStore } = await import('../store/medicationStore');
      const { useEpisodeStore } = await import('../store/episodeStore');
      await useMedicationStore.getState().loadMedications();
      await useEpisodeStore.getState().loadEpisodes();
      logger.log('[TestHelpers] Stores reloaded with fixture data');
    }

    logger.log('[TestHelpers] Database reset complete');
    return { success: true, message: 'Database reset successfully' };
  } catch (error) {
    logger.error('[TestHelpers] Failed to reset database:', error);
    return { success: false, message: `Reset failed: ${error}` };
  }
}

/**
 * Load predefined test data for consistent test scenarios
 */
async function loadTestFixtures() {
  const db = await getDatabase();

  // Create a test episode (ended, for consistent state)
  const testEpisodeId = `test-episode-${Date.now()}`;
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const twentyHoursAgo = Date.now() - 20 * 60 * 60 * 1000;

  await db.runAsync(
    `INSERT INTO episodes (id, start_time, end_time, locations, qualities, symptoms, triggers, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      testEpisodeId,
      oneDayAgo,
      twentyHoursAgo,
      JSON.stringify(['front']),
      JSON.stringify(['throbbing']),
      JSON.stringify(['nausea']),
      JSON.stringify(['stress']),
      'Test episode for E2E testing',
      oneDayAgo,
      twentyHoursAgo
    ]
  );

  // Add intensity readings to the test episode
  await db.runAsync(
    `INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      `test-reading-1-${Date.now()}`,
      testEpisodeId,
      oneDayAgo + 1000,
      5,
      oneDayAgo + 1000,
      oneDayAgo + 1000
    ]
  );

  await db.runAsync(
    `INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      `test-reading-2-${Date.now()}`,
      testEpisodeId,
      oneDayAgo + 2 * 60 * 60 * 1000, // 2 hours later
      7,
      oneDayAgo + 2 * 60 * 60 * 1000,
      oneDayAgo + 2 * 60 * 60 * 1000
    ]
  );

  // Create test medications

  // 1. Preventative medication with daily schedule
  const preventativeMedId = `test-preventative-${Date.now()}`;
  await db.runAsync(
    `INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, default_quantity, schedule_frequency, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      preventativeMedId,
      'Test Topiramate',
      'preventative',
      50,
      'mg',
      1,
      'daily',
      1,
      Date.now(),
      Date.now()
    ]
  );

  // Add schedule for preventative medication (1 hour from now - will show as upcoming)
  const now = new Date();
  const scheduleTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
  const timeString = `${scheduleTime.getHours().toString().padStart(2, '0')}:${scheduleTime.getMinutes().toString().padStart(2, '0')}`;

  const scheduleId = `test-schedule-${Date.now()}`;
  await db.runAsync(
    `INSERT INTO medication_schedules (id, medication_id, time, dosage, enabled)
     VALUES (?, ?, ?, ?, ?)`,
    [
      scheduleId,
      preventativeMedId,
      timeString,
      1,
      1
    ]
  );

  // 2. Rescue medication
  const rescueMedId = `test-rescue-${Date.now()}`;
  await db.runAsync(
    `INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, default_quantity, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      rescueMedId,
      'Test Ibuprofen',
      'rescue',
      400,
      'mg',
      1,
      1,
      Date.now(),
      Date.now()
    ]
  );

  logger.log('[TestHelpers] Test fixtures loaded (preventative + rescue medications)');
}

/**
 * Load test fixtures specifically for demonstrating skipped doses UI (GH #116)
 * Creates a preventative medication with 7 days of dose history (mix of taken and skipped)
 */
export async function loadSkippedDosesFixtures() {
  const db = await getDatabase();
  const now = Date.now();

  // Create Test Preventative medication with daily schedule
  const medId = `test-skipped-doses-${now}`;
  await db.runAsync(
    `INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, default_quantity, schedule_frequency, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      medId,
      'Test Preventative',
      'preventative',
      50,
      'mg',
      1,
      'daily',
      1,
      now,
      now
    ]
  );

  // Add doses for the past 7 days - pattern: taken, taken, skipped, skipped, taken, skipped, taken
  const doses = [
    { daysAgo: 6, status: 'taken', quantity: 1 },
    { daysAgo: 5, status: 'taken', quantity: 1 },
    { daysAgo: 4, status: 'skipped', quantity: 0 },
    { daysAgo: 3, status: 'skipped', quantity: 0 },
    { daysAgo: 2, status: 'taken', quantity: 1 },
    { daysAgo: 1, status: 'skipped', quantity: 0 },
    { daysAgo: 0, status: 'taken', quantity: 1 }, // Today
  ];

  for (const dose of doses) {
    const doseTimestamp = now - (dose.daysAgo * 24 * 60 * 60 * 1000);
    const doseId = `dose-${medId}-${dose.daysAgo}`;

    await db.runAsync(
      `INSERT INTO medication_doses (id, medication_id, timestamp, quantity, dosage_amount, dosage_unit, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        doseId,
        medId,
        doseTimestamp,
        dose.quantity,
        50,
        'mg',
        dose.status,
        doseTimestamp,
        doseTimestamp
      ]
    );
  }

  logger.log('[TestHelpers] Skipped doses fixtures loaded (7 days of mixed taken/skipped doses)');
}

/**
 * Get current database state summary for debugging
 */
export async function getDatabaseState() {
  const db = await getDatabase();

  const episodeCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM episodes'
  );
  const medicationCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM medications'
  );
  const intensityCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM intensity_readings'
  );
  const doseCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM medication_doses'
  );
  const dailyStatusCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM daily_status_logs'
  );

  return {
    episodes: episodeCount?.count || 0,
    medications: medicationCount?.count || 0,
    intensityReadings: intensityCount?.count || 0,
    medicationDoses: doseCount?.count || 0,
    dailyStatusLogs: dailyStatusCount?.count || 0,
  };
}

/**
 * Confirm reset with user (for UI button)
 */
export async function confirmAndResetDatabase(loadFixtures = false): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Reset Database for Testing',
      `This will:\n\n• Create a backup of current data\n• Clear all episodes and medications\n${loadFixtures ? '• Load test fixtures\n' : ''}\nContinue?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const result = await resetDatabaseForTesting({
              createBackup: true,
              loadFixtures
            });

            if (result.success) {
              Alert.alert('Success', result.message);
              resolve(true);
            } else {
              Alert.alert('Error', result.message);
              resolve(false);
            }
          },
        },
      ]
    );
  });
}

/**
 * Load corrupted test data to trigger database errors
 * This is used to test error toast notifications
 *
 * Strategy: Create a medication with a constraint violation that will
 * trigger an error when the app tries to update it
 */
export async function loadCorruptedDatabase() {
  logger.log('[TestHelpers] Loading database with invalid data...');

  try {
    const db = await getDatabase();

    // First, clear existing data
    await db.execAsync('DELETE FROM medication_doses');
    await db.execAsync('DELETE FROM medication_schedules');
    await db.execAsync('DELETE FROM medications');

    // Create a normal medication that we can interact with
    const medicationId = `error-test-med-${Date.now()}`;
    await db.runAsync(
      `INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, default_quantity, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        medicationId,
        'Error Test Med',
        'rescue',
        50,
        'mg',
        1,
        1,
        Date.now(),
        Date.now()
      ]
    );

    // Store the medication ID for the test to use
    logger.log('[TestHelpers] ✅ Test database loaded with medication:', medicationId);
    logger.log('[TestHelpers] Note: To trigger errors, try logging a dose with invalid medicationId');

    return { success: true, medicationId };
  } catch (error) {
    logger.error('[TestHelpers] Failed to load test database:', error);
    return { success: false, message: `Database load failed: ${error}` };
  }
}
