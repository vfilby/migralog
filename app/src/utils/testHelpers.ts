/**
 * Test Helpers - Database Reset and Test Fixtures
 *
 * SECURITY: These functions are only available in development builds
 * and will be stripped from production builds.
 */

import { getDatabase } from '../database/db';
import { backupService } from '../services/backupService';
import { Alert } from 'react-native';

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

  console.log('[TestHelpers] Starting database reset...');

  try {
    // 1. Create backup before reset (safety measure)
    if (createBackup) {
      console.log('[TestHelpers] Creating pre-reset backup...');
      const backupId = await backupService.createBackup(false); // Not automatic
      console.log(`[TestHelpers] Backup created: ${backupId}`);
    }

    // 2. Get database instance
    const db = await getDatabase();

    // 3. Clear all data from tables (preserves schema)
    console.log('[TestHelpers] Clearing all tables...');
    await db.execAsync('DELETE FROM medication_reminders');
    await db.execAsync('DELETE FROM medication_doses');
    await db.execAsync('DELETE FROM medication_schedules');
    await db.execAsync('DELETE FROM medications');
    await db.execAsync('DELETE FROM symptom_logs');
    await db.execAsync('DELETE FROM intensity_readings');
    await db.execAsync('DELETE FROM episode_notes');
    await db.execAsync('DELETE FROM episodes');

    console.log('[TestHelpers] All tables cleared');

    // 4. Optionally load test fixtures
    if (loadFixtures) {
      console.log('[TestHelpers] Loading test fixtures...');
      await loadTestFixtures();
    }

    console.log('[TestHelpers] Database reset complete');
    return { success: true, message: 'Database reset successfully' };
  } catch (error) {
    console.error('[TestHelpers] Failed to reset database:', error);
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
    `INSERT INTO episodes (id, startTime, endTime, peakIntensity, location, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      testEpisodeId,
      oneDayAgo,
      twentyHoursAgo,
      7,
      JSON.stringify({ latitude: 37.7749, longitude: -122.4194 }), // San Francisco
      'Test episode for E2E testing'
    ]
  );

  // Add intensity readings to the test episode
  await db.runAsync(
    `INSERT INTO intensity_readings (id, episodeId, timestamp, intensity, location, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      `test-reading-1-${Date.now()}`,
      testEpisodeId,
      oneDayAgo + 1000,
      5,
      JSON.stringify({ latitude: 37.7749, longitude: -122.4194 }),
      'Initial reading'
    ]
  );

  await db.runAsync(
    `INSERT INTO intensity_readings (id, episodeId, timestamp, intensity, location, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      `test-reading-2-${Date.now()}`,
      testEpisodeId,
      oneDayAgo + 2 * 60 * 60 * 1000, // 2 hours later
      7,
      JSON.stringify({ latitude: 37.7749, longitude: -122.4194 }),
      'Peak reading'
    ]
  );

  // Create a test medication
  const testMedicationId = `test-medication-${Date.now()}`;
  await db.runAsync(
    `INSERT INTO medications (id, name, type, dosageAmount, dosageUnit, instructions, active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      testMedicationId,
      'Test Ibuprofen',
      'rescue',
      400,
      'mg',
      'Take with food',
      1
    ]
  );

  console.log('[TestHelpers] Test fixtures loaded');
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

  return {
    episodes: episodeCount?.count || 0,
    medications: medicationCount?.count || 0,
    intensityReadings: intensityCount?.count || 0,
    medicationDoses: doseCount?.count || 0,
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
