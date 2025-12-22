/**
 * Development Test Helpers - Database Reset and Dangerous Operations
 * 
 * SECURITY WARNING: This file contains dangerous database operations
 * that should NEVER be included in production builds.
 * 
 * This file is excluded from production builds via metro.config.js
 */

import { logger } from '../utils/logger';
import { getDatabase } from '../database/db';
import { backupService } from '../services/backup/backupService';
import { useDailyStatusStore } from '../store/dailyStatusStore';
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { scheduledNotificationRepository } from '../database/scheduledNotificationRepository';
import { toLocalDateString } from '../utils/dateFormatting';

// Fail fast if this somehow gets imported in production
if (__DEV__ === false) {
  throw new Error('CRITICAL: devTestHelpers.ts imported in production build!');
}

/**
 * Reset database to clean state with automatic backup
 * ONLY available in __DEV__ mode
 * 
 * DANGER: This function will DELETE ALL DATA from the database!
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
      logger.log('[TestHelpers] Creating pre-reset snapshot backup...');
      const metadata = await backupService.createSnapshotBackup();
      logger.log(`[TestHelpers] Backup created: ${metadata.id}`);
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
    // scheduled_notifications table may not exist if migration v20 hasn't run
    try {
      await db.execAsync('DELETE FROM scheduled_notifications');
    } catch {
      // Table doesn't exist yet - safe to ignore
    }

    logger.log('[TestHelpers] All tables cleared');

    // 3a. Update schema_version to current version to avoid running migrations
    // This prevents the ~1 second migration delay during tests
    logger.log('[TestHelpers] Updating schema version to current...');
    const { SCHEMA_VERSION } = await import('../database/schema');
    await db.runAsync(
      'UPDATE schema_version SET version = ?, updated_at = ? WHERE id = 1',
      [SCHEMA_VERSION, Date.now()]
    );
    logger.log(`[TestHelpers] Schema version set to ${SCHEMA_VERSION}`);

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
      const { useAnalyticsStore } = await import('../store/analyticsStore');
      await useMedicationStore.getState().loadMedications();
      await useEpisodeStore.getState().loadEpisodes();
      // Refresh analytics store to pick up new fixture data
      await useAnalyticsStore.getState().refreshData();
      logger.log('[TestHelpers] Stores reloaded with fixture data');
    }

    logger.log('[TestHelpers] Database reset complete');
    return { success: true, message: 'Database reset successfully' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('[TestHelpers] Failed to reset database:', errorMessage, errorStack);

    // Show error as toast for E2E test visibility
    if (__DEV__) {
      const Toast = require('react-native-toast-message').default;
      Toast.show({
        type: 'error',
        text1: '[TestHelpers] Failed to reset database',
        text2: errorMessage,
        visibilityTime: 5000,
      });
    }

    return { success: false, message: `Reset failed: ${errorMessage}` };
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
    `INSERT INTO medication_schedules (id, medication_id, time, timezone, dosage, enabled)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      scheduleId,
      preventativeMedId,
      timeString,
      'America/Los_Angeles', // Default timezone for test fixtures
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
    // scheduled_notifications table may not exist if migration v20 hasn't run
    try {
      await db.execAsync('DELETE FROM scheduled_notifications');
    } catch {
      // Table doesn't exist yet - safe to ignore
    }

    // Update schema_version to current version to avoid running migrations
    logger.log('[TestHelpers] Updating schema version to current...');
    const { SCHEMA_VERSION } = await import('../database/schema');
    await db.runAsync(
      'UPDATE schema_version SET version = ?, updated_at = ? WHERE id = 1',
      [SCHEMA_VERSION, Date.now()]
    );
    logger.log(`[TestHelpers] Schema version set to ${SCHEMA_VERSION}`);

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

/**
 * Result of setting up notification test scenarios
 */
export interface NotificationTestSetupResult {
  success: boolean;
  scenarios: Array<{
    name: string;
    scheduledTime: Date;
    followUpTime?: Date;
    instruction: string;
  }>;
  totalNotifications: number;
  message: string;
}

/**
 * Test medication configurations for notification testing
 * Each medication is named for the action to take when the notification appears
 *
 * Order: Snooze and Ignore come first since they have follow-up actions to wait for
 */
const TEST_MEDICATIONS = [
  { name: 'ACTION: Snooze', dosageAmount: 100, dosageUnit: 'mg', instruction: 'Tap "Snooze" - wait for snoozed notification to reappear' },
  { name: 'ACTION: Ignore (Follow-up)', dosageAmount: 200, dosageUnit: 'mg', instruction: 'Do NOT interact - wait for follow-up notification' },
  { name: 'ACTION: Skip This', dosageAmount: 300, dosageUnit: 'mg', instruction: 'Tap "Skip" when notification appears' },
  { name: 'ACTION: Take Now', dosageAmount: 400, dosageUnit: 'mg', instruction: 'Tap "Take Now" when notification appears' },
  { name: 'TEST: Pre-Take', dosageAmount: 500, dosageUnit: 'mg', instruction: 'Log dose BEFORE notification fires - verify no notification' },
];

/**
 * Setup notification test scenarios for manual testing
 *
 * This function:
 * 1. Resets the database to a clean state
 * 2. Creates 5 test medications, each named for the action to test
 * 3. Schedules notifications at specified intervals
 *
 * Test scenarios (singles only):
 * - "ACTION: Skip This" - test Skip action
 * - "ACTION: Take Now" - test Take Now action
 * - "ACTION: Snooze" - test Snooze action
 * - "ACTION: Ignore (Follow-up)" - don't interact, wait for follow-up
 * - "TEST: Pre-Take" - log dose BEFORE notification fires to verify cancellation
 *
 * @param intervalSeconds - Seconds between each notification (default: 60 = 1 minute)
 * @returns Setup result with scheduled notification details
 */
export async function setupNotificationTestScenarios(
  intervalSeconds: number = 60
): Promise<NotificationTestSetupResult> {
  logger.log('[TestHelpers] Setting up notification test scenarios with real medications...');

  const results: NotificationTestSetupResult['scenarios'] = [];
  let totalNotifications = 0;

  try {
    const db = await getDatabase();
    const now = new Date();

    // Step 1: Clear existing test data
    logger.log('[TestHelpers] Clearing existing data...');

    // Cancel all scheduled notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Clear notification mappings
    try {
      await db.execAsync('DELETE FROM scheduled_notifications');
    } catch {
      // Table may not exist
    }

    // Clear medication-related tables
    await db.execAsync('DELETE FROM medication_reminders');
    await db.execAsync('DELETE FROM medication_doses');
    await db.execAsync('DELETE FROM medication_schedules');
    await db.execAsync('DELETE FROM medications');

    // Step 2: Calculate schedule times
    // For burst mode (small intervals), we still need valid time strings for the database
    // but the actual notification timing uses the intervalSeconds parameter
    const getTimeString = (secondsFromNow: number): string => {
      const time = new Date(now.getTime() + secondsFromNow * 1000);
      return `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
    };

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timestamp = Date.now();

    // Step 3: Create test medications with schedules
    const medications: Array<{ id: string; scheduleId: string; config: typeof TEST_MEDICATIONS[0]; secondsFromNow: number }> = [];

    for (let i = 0; i < TEST_MEDICATIONS.length; i++) {
      const config = TEST_MEDICATIONS[i];
      const secondsFromNow = (i + 1) * intervalSeconds; // e.g., 10, 20, 30... or 60, 120, 180...
      const medId = `test-med-${i}-${timestamp}`;
      const scheduleId = `test-schedule-${i}-${timestamp}`;
      const timeStr = getTimeString(secondsFromNow);

      await db.runAsync(
        `INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, default_quantity, schedule_frequency, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [medId, config.name, 'preventative', config.dosageAmount, config.dosageUnit, 1, 'daily', 1, timestamp, timestamp]
      );

      // Create schedule with enabled=0 so production scheduler ignores it
      // We schedule notifications manually for testing
      await db.runAsync(
        `INSERT INTO medication_schedules (id, medication_id, time, timezone, dosage, enabled)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [scheduleId, medId, timeStr, timezone, 1, 0]
      );

      medications.push({ id: medId, scheduleId, config, secondsFromNow });
    }

    logger.log('[TestHelpers] Created test medications:', { count: medications.length, intervalSeconds });

    // Step 4: Reload medication store so the app sees the new medications
    const { useMedicationStore } = await import('../store/medicationStore');
    await useMedicationStore.getState().loadMedications();

    // Step 5: Schedule notifications manually and save mappings
    const { MEDICATION_REMINDER_CATEGORY } = await import('../services/notifications/notificationCategories');
    const todayStr = toLocalDateString(now);

    for (const med of medications) {
      const triggerTime = new Date(now.getTime() + med.secondsFromNow * 1000);
      const notificationTitle = `Time for ${med.config.name}`;
      const notificationBody = `1 dose - ${med.config.dosageAmount}${med.config.dosageUnit}`;

      // Schedule the main notification
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: notificationTitle,
          body: notificationBody,
          data: { medicationId: med.id, scheduleId: med.scheduleId, scheduledAt: now.getTime() },
          categoryIdentifier: MEDICATION_REMINDER_CATEGORY,
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerTime },
      });
      totalNotifications++;

      // Save the mapping so production handlers can find it
      await scheduledNotificationRepository.saveMapping({
        medicationId: med.id,
        scheduleId: med.scheduleId,
        date: todayStr,
        notificationId,
        notificationType: 'reminder',
        isGrouped: false,
        sourceType: 'medication',
        medicationName: med.config.name,
        scheduledTriggerTime: triggerTime,
        notificationTitle,
        notificationBody,
        categoryIdentifier: MEDICATION_REMINDER_CATEGORY,
      });

      // For the "Ignore (Follow-up)" test, also schedule a follow-up notification
      if (med.config.name.includes('Ignore')) {
        // Follow-up comes 2 intervals after main (or minimum 30 seconds for burst mode)
        const followUpDelay = Math.max(intervalSeconds * 2, 30) * 1000;
        const followUpTime = new Date(triggerTime.getTime() + followUpDelay);
        const followUpTitle = `Reminder: ${med.config.name}`;
        const followUpBody = 'Did you take your medication?';

        const followUpNotificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: followUpTitle,
            body: followUpBody,
            data: { medicationId: med.id, scheduleId: med.scheduleId, isFollowUp: true, scheduledAt: now.getTime() },
            categoryIdentifier: MEDICATION_REMINDER_CATEGORY,
            sound: true,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: followUpTime },
        });
        totalNotifications++;

        // Save follow-up mapping
        await scheduledNotificationRepository.saveMapping({
          medicationId: med.id,
          scheduleId: med.scheduleId,
          date: todayStr,
          notificationId: followUpNotificationId,
          notificationType: 'follow_up',
          isGrouped: false,
          sourceType: 'medication',
          medicationName: med.config.name,
          scheduledTriggerTime: followUpTime,
          notificationTitle: followUpTitle,
          notificationBody: followUpBody,
          categoryIdentifier: MEDICATION_REMINDER_CATEGORY,
        });

        results.push({
          name: med.config.name,
          scheduledTime: triggerTime,
          followUpTime: followUpTime,
          instruction: med.config.instruction,
        });
      } else {
        results.push({
          name: med.config.name,
          scheduledTime: triggerTime,
          instruction: med.config.instruction,
        });
      }
    }

    // Build display message
    const scheduleDetails = results.map(r => {
      const time = r.scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const followUp = r.followUpTime
        ? ` → follow-up at ${r.followUpTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : '';
      return `• ${time}: ${r.name}${followUp}\n  → ${r.instruction}`;
    }).join('\n\n');

    logger.log('[TestHelpers] Notification test scenarios setup complete', {
      scenarioCount: results.length,
      totalNotifications,
    });

    return {
      success: true,
      scenarios: results,
      totalNotifications,
      message: `Created ${medications.length} test medications.\nScheduled ${totalNotifications} notifications:\n\n${scheduleDetails}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[TestHelpers] Failed to setup notification test scenarios:', error);
    return {
      success: false,
      scenarios: results,
      totalNotifications,
      message: `Failed to setup: ${errorMessage}`,
    };
  }
}

/**
 * Confirm and setup notification test scenarios with user dialog (1-minute intervals)
 *
 * WARNING: This will reset the medication database!
 */
export async function confirmAndSetupNotificationTests(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Setup Notification Tests',
      '⚠️ WARNING: This will CLEAR ALL MEDICATIONS and create test data.\n\n' +
        'Test scenarios (1 min apart):\n' +
        '• +1 min: Snooze → wait for snoozed notification\n' +
        '• +2 min: Ignore → wait for follow-up\n' +
        '• +3 min: Skip action test\n' +
        '• +4 min: Take Now action test\n' +
        '• +5 min: Pre-Take → log dose before notification\n\n' +
        'Snooze and Ignore are first since they have follow-ups.\n\n' +
        'Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Reset & Setup',
          style: 'destructive',
          onPress: async () => {
            const result = await setupNotificationTestScenarios(60); // 60 seconds = 1 minute

            if (result.success) {
              Alert.alert('Test Setup Complete', result.message);
              resolve(true);
            } else {
              Alert.alert('Setup Failed', result.message);
              resolve(false);
            }
          },
        },
      ]
    );
  });
}

/**
 * Confirm and setup notification test scenarios in BURST mode (10-second intervals)
 *
 * This fires all 5 notifications rapidly to test how the system handles
 * multiple simultaneous notifications without grouping.
 *
 * WARNING: This will reset the medication database!
 */
export async function confirmAndSetupNotificationTestsBurst(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Setup Notification Tests (BURST)',
      '⚠️ WARNING: This will CLEAR ALL MEDICATIONS and create test data.\n\n' +
        'BURST MODE: All 5 notifications fire 10 seconds apart!\n\n' +
        '• +10s: Snooze → wait for snoozed notification\n' +
        '• +20s: Ignore → follow-up +30s later\n' +
        '• +30s: Skip action test\n' +
        '• +40s: Take Now action test\n' +
        '• +50s: Pre-Take (log dose quickly!)\n\n' +
        'Tests how multiple notifications appear rapidly.\n\n' +
        'Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Reset & Setup (Burst)',
          style: 'destructive',
          onPress: async () => {
            const result = await setupNotificationTestScenarios(10); // 10 seconds

            if (result.success) {
              Alert.alert('Burst Test Setup Complete', result.message);
              resolve(true);
            } else {
              Alert.alert('Setup Failed', result.message);
              resolve(false);
            }
          },
        },
      ]
    );
  });
}

/**
 * Test medications for grouped notification testing
 * All medications scheduled at the same time to trigger grouping
 */
const GROUPED_TEST_MEDICATIONS = [
  { name: 'GROUP: Log Before', dosageAmount: 100, dosageUnit: 'mg', instruction: 'Log dose BEFORE notification - should be excluded from group' },
  { name: 'GROUP: Take via Action', dosageAmount: 200, dosageUnit: 'mg', instruction: 'Use "Take All" or individual take action' },
  { name: 'GROUP: Skip via Action', dosageAmount: 300, dosageUnit: 'mg', instruction: 'Use "Skip All" or individual skip action' },
  { name: 'GROUP: Leave Pending', dosageAmount: 400, dosageUnit: 'mg', instruction: 'Do nothing - should remain in follow-up' },
];

/**
 * Setup grouped notification test scenario
 *
 * Creates 4 medications all scheduled at the same time to test:
 * - Partial logging before notification (1 med logged beforehand)
 * - Group notification shows remaining 3 meds
 * - Taking/skipping individual meds from group
 * - Follow-up only includes non-actioned meds
 *
 * @param delayMinutes - Minutes until the grouped notification fires (default: 2)
 * @param followUpDelayMinutes - Minutes after reminder for follow-up (default: 2 for testing, production uses 30)
 */
export async function setupGroupedNotificationTest(
  delayMinutes: number = 2,
  followUpDelayMinutes: number = 2
): Promise<NotificationTestSetupResult> {
  logger.log('[TestHelpers] Setting up grouped notification test...');

  const results: NotificationTestSetupResult['scenarios'] = [];
  let totalNotifications = 0;

  try {
    const db = await getDatabase();
    const now = new Date();
    const timestamp = Date.now();

    // Step 1: Clear existing data
    logger.log('[TestHelpers] Clearing existing data...');
    await Notifications.cancelAllScheduledNotificationsAsync();

    try {
      await db.execAsync('DELETE FROM scheduled_notifications');
    } catch {
      // Table may not exist
    }

    await db.execAsync('DELETE FROM medication_reminders');
    await db.execAsync('DELETE FROM medication_doses');
    await db.execAsync('DELETE FROM medication_schedules');
    await db.execAsync('DELETE FROM medications');

    // Step 2: Calculate the grouped schedule time
    const triggerTime = new Date(now.getTime() + delayMinutes * 60 * 1000);
    const followUpTime = new Date(triggerTime.getTime() + followUpDelayMinutes * 60 * 1000);
    const timeStr = `${triggerTime.getHours().toString().padStart(2, '0')}:${triggerTime.getMinutes().toString().padStart(2, '0')}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const todayStr = toLocalDateString(now);

    // Step 3: Create test medications - all with the SAME schedule time
    const medications: Array<{ id: string; scheduleId: string; config: typeof GROUPED_TEST_MEDICATIONS[0] }> = [];

    for (let i = 0; i < GROUPED_TEST_MEDICATIONS.length; i++) {
      const config = GROUPED_TEST_MEDICATIONS[i];
      const medId = `group-med-${i}-${timestamp}`;
      const scheduleId = `group-schedule-${i}-${timestamp}`;

      await db.runAsync(
        `INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, default_quantity, schedule_frequency, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [medId, config.name, 'preventative', config.dosageAmount, config.dosageUnit, 1, 'daily', 1, timestamp, timestamp]
      );

      // Create schedule with enabled=0 so production scheduler ignores it
      // We schedule notifications manually for testing with short delays
      await db.runAsync(
        `INSERT INTO medication_schedules (id, medication_id, time, timezone, dosage, enabled)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [scheduleId, medId, timeStr, timezone, 1, 0]
      );

      medications.push({ id: medId, scheduleId, config });
    }

    logger.log('[TestHelpers] Created grouped test medications:', {
      count: medications.length,
      scheduledTime: timeStr,
      followUpDelayMinutes,
    });

    // Step 4: Reload medication store
    const { useMedicationStore } = await import('../store/medicationStore');
    await useMedicationStore.getState().loadMedications();

    // Step 5: Directly schedule grouped notifications (bypass production scheduler for short delays)
    const { MULTIPLE_MEDICATION_REMINDER_CATEGORY } = await import('../services/notifications/notificationCategories');

    // Build grouped notification content
    const medCount = medications.length;
    const reminderTitle = `Time for ${medCount} Medications`;
    const reminderBody = medications.map(m => `• ${m.config.name}`).join('\n');
    const followUpTitle = `Reminder: ${medCount} Medications`;
    const followUpBody = 'Did you take your medications?';

    // Create medication data for the grouped notification
    const groupedMedData = medications.map(m => ({
      medicationId: m.id,
      scheduleId: m.scheduleId,
      medicationName: m.config.name,
    }));

    // Schedule the grouped reminder notification
    const reminderNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: reminderTitle,
        body: reminderBody,
        data: {
          medicationIds: medications.map(m => m.id),
          scheduleIds: medications.map(m => m.scheduleId),
          medications: groupedMedData,
          isGrouped: true,
          scheduledAt: now.getTime(),
        },
        categoryIdentifier: MULTIPLE_MEDICATION_REMINDER_CATEGORY,
        sound: true,
        interruptionLevel: 'timeSensitive',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerTime },
    });
    totalNotifications++;

    // Save reminder mapping for each medication in the group
    for (const med of medications) {
      await scheduledNotificationRepository.saveMapping({
        medicationId: med.id,
        scheduleId: med.scheduleId,
        date: todayStr,
        notificationId: reminderNotificationId,
        notificationType: 'reminder',
        isGrouped: true,
        groupKey: timeStr,
        sourceType: 'medication',
        medicationName: med.config.name,
        scheduledTriggerTime: triggerTime,
        notificationTitle: reminderTitle,
        notificationBody: reminderBody,
        categoryIdentifier: MULTIPLE_MEDICATION_REMINDER_CATEGORY,
      });
    }

    // Schedule the grouped follow-up notification
    const followUpNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: followUpTitle,
        body: followUpBody,
        data: {
          medicationIds: medications.map(m => m.id),
          scheduleIds: medications.map(m => m.scheduleId),
          medications: groupedMedData,
          isGrouped: true,
          isFollowUp: true,
          scheduledAt: now.getTime(),
        },
        categoryIdentifier: MULTIPLE_MEDICATION_REMINDER_CATEGORY,
        sound: true,
        interruptionLevel: 'critical',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: followUpTime },
    });
    totalNotifications++;

    // Save follow-up mapping for each medication in the group
    for (const med of medications) {
      await scheduledNotificationRepository.saveMapping({
        medicationId: med.id,
        scheduleId: med.scheduleId,
        date: todayStr,
        notificationId: followUpNotificationId,
        notificationType: 'follow_up',
        isGrouped: true,
        groupKey: timeStr,
        sourceType: 'medication',
        medicationName: med.config.name,
        scheduledTriggerTime: followUpTime,
        notificationTitle: followUpTitle,
        notificationBody: followUpBody,
        categoryIdentifier: MULTIPLE_MEDICATION_REMINDER_CATEGORY,
      });
    }

    // Build results
    const groupedNames = medications.map(m => m.config.name).join(', ');
    const reminderTimeStr = triggerTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const followUpTimeStr = followUpTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    results.push({
      name: `Grouped: ${medications.length} medications`,
      scheduledTime: triggerTime,
      followUpTime: followUpTime,
      instruction: `Group notification at ${reminderTimeStr}. Log "${GROUPED_TEST_MEDICATIONS[0].name}" BEFORE it fires to test partial logging.`,
    });

    const message =
      `Created ${medications.length} medications scheduled at ${reminderTimeStr}.\n\n` +
      `Scheduled ${totalNotifications} notification(s):\n` +
      `• Reminder: ${reminderTimeStr}\n` +
      `• Follow-up: ${followUpTimeStr} (+${followUpDelayMinutes} min)\n\n` +
      `TEST STEPS:\n` +
      `1. IMMEDIATELY log a dose for "${GROUPED_TEST_MEDICATIONS[0].name}"\n` +
      `2. Wait for grouped notification (should show ${medications.length - 1} meds)\n` +
      `3. Test group actions (Take All, Skip All, or individual)\n` +
      `4. Verify follow-up at ${followUpTimeStr} only includes non-actioned meds\n\n` +
      `Medications: ${groupedNames}`;

    logger.log('[TestHelpers] Grouped notification test setup complete', {
      medicationCount: medications.length,
      scheduledTime: timeStr,
      followUpTime: followUpTimeStr,
      totalNotifications,
    });

    return {
      success: true,
      scenarios: results,
      totalNotifications,
      message,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[TestHelpers] Failed to setup grouped notification test:', error);
    return {
      success: false,
      scenarios: results,
      totalNotifications,
      message: `Failed to setup: ${errorMessage}`,
    };
  }
}

/**
 * Confirm and setup grouped notification test with user dialog
 *
 * WARNING: This will reset the medication database!
 */
export async function confirmAndSetupGroupedNotificationTest(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Setup Grouped Notification Test',
      '⚠️ WARNING: This will CLEAR ALL MEDICATIONS and create test data.\n\n' +
        'Creates 4 medications at the SAME time to test grouped notifications:\n\n' +
        '• GROUP: Log Before - log IMMEDIATELY after setup\n' +
        '• GROUP: Take via Action - use Take action\n' +
        '• GROUP: Skip via Action - use Skip action\n' +
        '• GROUP: Leave Pending - ignore for follow-up test\n\n' +
        'TIMING:\n' +
        '• Reminder: +2 minutes\n' +
        '• Follow-up: +2 minutes after reminder\n\n' +
        'Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Reset & Setup',
          style: 'destructive',
          onPress: async () => {
            // 2 minutes until reminder, 2 minutes follow-up delay
            const result = await setupGroupedNotificationTest(2, 2);

            if (result.success) {
              Alert.alert('Grouped Test Setup Complete', result.message);
              resolve(true);
            } else {
              Alert.alert('Setup Failed', result.message);
              resolve(false);
            }
          },
        },
      ]
    );
  });
}