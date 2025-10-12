/**
 * Test Helpers - Database Reset and Test Fixtures
 *
 * SECURITY: These functions are only available in development builds
 * and will be stripped from production builds.
 */

import { getDatabase } from '../database/db';
import { backupService } from '../services/backupService';
import { useDailyStatusStore } from '../store/dailyStatusStore';
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
    await db.execAsync('DELETE FROM daily_status_logs');

    console.log('[TestHelpers] All tables cleared');

    // 4. Reset Zustand stores to clear in-memory state
    console.log('[TestHelpers] Resetting stores...');
    useDailyStatusStore.getState().reset();
    // Note: medicationStore and episodeStore don't have reset methods,
    // but they will reload data when screens gain focus
    console.log('[TestHelpers] Stores reset');

    // 5. Optionally load test fixtures
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
    `INSERT INTO episodes (id, start_time, end_time, peak_intensity, average_intensity, locations, qualities, symptoms, triggers, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      testEpisodeId,
      oneDayAgo,
      twentyHoursAgo,
      7,
      6,
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
    `INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      `test-reading-1-${Date.now()}`,
      testEpisodeId,
      oneDayAgo + 1000,
      5,
      oneDayAgo + 1000
    ]
  );

  await db.runAsync(
    `INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      `test-reading-2-${Date.now()}`,
      testEpisodeId,
      oneDayAgo + 2 * 60 * 60 * 1000, // 2 hours later
      7,
      oneDayAgo + 2 * 60 * 60 * 1000
    ]
  );

  // Create test medications

  // 1. Preventative medication with daily schedule
  const preventativeMedId = `test-preventative-${Date.now()}`;
  await db.runAsync(
    `INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, default_dosage, schedule_frequency, active, created_at, updated_at)
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

  // Add schedule for preventative medication (1 hour ago - will show as missed)
  const now = new Date();
  const scheduleTime = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
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
    `INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, default_dosage, active, created_at, updated_at)
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

  console.log('[TestHelpers] Test fixtures loaded (preventative + rescue medications)');
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
