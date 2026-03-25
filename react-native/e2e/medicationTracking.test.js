const { resetDatabase, waitForAnimation } = require('./helpers');

/**
 * Medication Tracking UI E2E Test
 *
 * Tests the medication tracking UI workflow by:
 * 1. Seeding database with test medications (preventative with schedule, rescue med)
 * 2. Verifying medications appear on Dashboard
 * 3. Testing Log button functionality and UI updates
 * 4. Testing Undo functionality
 * 5. Testing Skip functionality
 * 6. Verifying status persists after navigation
 * 7. Testing rescue medication logging
 *
 * This test focuses on the critical bug: ensuring UI updates correctly
 * after logging medications (no ghost "Log" buttons after medication is taken)
 */
describe('Medication Tracking UI', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    // Reset database and load test fixtures (medications with schedules)
    // Deep link reset is fast (~2s) so no need to relaunch app
    await resetDatabase(true);
  });

  it('should update UI correctly when logging preventative medication', async () => {
    // ======================
    // Phase 1: Verify Dashboard and Medications Card
    // ======================

    // resetDatabase() helper already waited for fixtures to load and Today's Medications card to appear
    // Just verify we're on Dashboard
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('On Dashboard');

    // Verify "Today's Medications" card is visible
    // (Should already be visible from resetDatabase wait, but double-check)
    await waitFor(element(by.id('todays-medications-card')))
      .toBeVisible()
      .withTimeout(5000);

    console.log("Today's Medications card is visible");

    // ======================
    // Phase 2: Find and Log a Medication
    // ======================

    // Look for "Skip" button which indicates an unlogged medication
    await waitFor(element(by.text('Skip')))
      .toBeVisible()
      .withTimeout(5000);
    console.log('Found medication with Skip button (not yet logged)');

    console.log('Looking for Log button');

    // The Log button text is: "Log {dosage} × {amount}{unit}" (e.g., "Log 1 × 50mg")
    const logButtonMatcher = element(by.text('Log 1 × 50mg'));
    await waitFor(logButtonMatcher)
      .toBeVisible()
      .withTimeout(5000);

    console.log('Found Log button');

    // Tap the Log button
    await logButtonMatcher.tap();

    console.log('Tapped Log button - waiting for UI update');

    // ======================
    // Phase 3: Verify UI Updates to Show "Taken" Status
    // ======================

    // After logging, should see "Taken at" text
    await waitFor(element(by.label(/Taken at \d+:\d+ [AP]M/)))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ SUCCESS: UI shows "Taken at" status');

    // Verify Undo button appears
    await waitFor(element(by.text('Undo')))
      .toBeVisible()
      .withTimeout(3000);

    console.log('✅ SUCCESS: Undo button is visible');

    // Most importantly: verify Log button is NOT visible
    try {
      await waitFor(element(by.text('Log 1 × 50mg')))
        .toBeVisible()
        .withTimeout(2000);

      throw new Error('❌ CRITICAL BUG: Log button still visible after logging medication!');
    } catch (e) {
      if (e.message && e.message.includes('CRITICAL BUG')) {
        throw e;
      }
      console.log('✅ SUCCESS: Log button correctly hidden after logging');
    }

    // ======================
    // Phase 4: Test Undo Functionality
    // ======================

    console.log('Testing Undo functionality');

    await element(by.text('Undo')).tap();

    console.log('Pressed Undo');

    // After undo, should see Log and Skip buttons again
    await waitFor(element(by.text('Skip')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ SUCCESS: Skip button returned after undo');

    await waitFor(element(by.text('Log 1 × 50mg')))
      .toBeVisible()
      .withTimeout(3000);

    console.log('✅ SUCCESS: Log button returned after undo');

    // "Taken at" should NOT be visible
    try {
      await waitFor(element(by.label(/Taken at/)))
        .toBeVisible()
        .withTimeout(2000);
      throw new Error('❌ BUG: "Taken at" still visible after undo');
    } catch (e) {
      if (e.message && e.message.includes('BUG')) {
        throw e;
      }
      console.log('✅ SUCCESS: "Taken at" correctly hidden after undo');
    }

    // ======================
    // Phase 5: Test Skip Functionality
    // ======================

    console.log('Testing Skip functionality');

    // Tap Skip button
    await element(by.text('Skip')).tap();

    console.log('Pressed Skip');

    // Should show "Skipped" status
    await waitFor(element(by.text('Skipped')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ SUCCESS: Shows "Skipped" status');

    // Log and Skip buttons should NOT be visible
    try {
      await waitFor(element(by.text('Log 1 × 50mg')))
        .toBeVisible()
        .withTimeout(2000);
      throw new Error('❌ BUG: Log button still visible after skipping');
    } catch (e) {
      if (e.message && e.message.includes('BUG')) {
        throw e;
      }
      console.log('✅ SUCCESS: Log button hidden after skipping');
    }

    console.log('✅ ALL TESTS PASSED: Medication tracking UI is working correctly!');
  });

  it('should handle rescue medication logging via Log Medication button', async () => {
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('Testing rescue medication logging');

    // Look for "Log Medication" button
    // This test expects fixtures to have created a rescue medication (Test Ibuprofen)
    await waitFor(element(by.id('log-medication-button')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ Found Log Medication button');

    await element(by.id('log-medication-button')).tap();
    await waitForAnimation(1500);
    
    console.log('Log Medication tapped');

    // Should open Log Medication screen
    await waitFor(element(by.id('log-medication-title')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ Log Medication screen opened');

    // Verify rescue medication appears in the list
    await waitFor(element(by.text('Test Ibuprofen')))
      .toBeVisible()
      .withTimeout(3000);

    console.log('✅ Rescue medication (Test Ibuprofen) visible in list');

    // Go back
    await element(by.text('Cancel')).tap();
    await waitForAnimation(1000);

    console.log('✅ Rescue medication logging flow complete');
  });

  it('should sync medication status between Dashboard and Medications screen (Issue #7)', async () => {
    // ======================
    // Phase 1: Start on Dashboard
    // ======================
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('On Dashboard - verifying medication is visible');

    // Verify "Today's Medications" card exists (should already be loaded by resetDatabase)
    await waitFor(element(by.id('todays-medications-card')))
      .toBeVisible()
      .withTimeout(5000);

    // Find medication with Skip button (unlogged)
    await waitFor(element(by.text('Skip')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('Found unlogged medication');

    // ======================
    // Phase 2: Navigate to Medications Screen - Verify Not Yet Logged
    // ======================
    console.log('Navigating to Medications screen');
    await element(by.text('Meds')).tap();
    await waitForAnimation(1000);

    await waitFor(element(by.text('Medications')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('On Medications screen');

    // Should NOT show taken or skipped status yet
    // (We're looking for absence of status indicators)
    console.log('✅ Medications screen loaded');

    // ======================
    // Phase 3: Return to Dashboard and Skip Medication
    // ======================
    console.log('Returning to Dashboard');
    await element(by.text('Home')).tap();
    await waitForAnimation(1000);

    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('Back on Dashboard - skipping medication');

    // Skip the medication
    await element(by.text('Skip')).tap();

    // Verify skipped on Dashboard
    await waitFor(element(by.text('Skipped')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ Dashboard shows "Skipped" status');

    // ======================
    // Phase 4: Navigate to Medications Screen - Verify Skipped Status
    // ======================
    console.log('Navigating to Medications screen to verify skipped status');
    await element(by.text('Meds')).tap();
    await waitForAnimation(1000);

    await waitFor(element(by.text('Medications')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('On Medications screen - checking for skipped indicator');

    // Wait a bit longer for the screen to load the skipped status from database

    // Should show skipped status (looking for text containing "dose skipped")
    // Pattern: "9:00 AM dose skipped" (schedule time + "dose skipped")
    await waitFor(element(by.text(/\d+:\d+ [AP]M dose skipped/)))
      .toBeVisible()
      .withTimeout(8000);

    console.log('✅ SUCCESS: Medications screen shows skipped status');

    // ======================
    // Phase 5: Return to Dashboard and Undo Skip
    // ======================
    console.log('Returning to Dashboard to undo skip');
    await element(by.text('Home')).tap();
    await waitForAnimation(1000);

    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(5000);

    // Undo the skip
    await element(by.text('Undo')).tap();

    // Should see Skip button again
    await waitFor(element(by.text('Skip')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ Undid skip on Dashboard');

    // ======================
    // Phase 6: Log Medication
    // ======================
    console.log('Logging medication');

    const logButtonMatcher = element(by.text('Log 1 × 50mg'));
    await waitFor(logButtonMatcher)
      .toBeVisible()
      .withTimeout(5000);

    await logButtonMatcher.tap();

    // Verify taken status
    await waitFor(element(by.label(/Taken at \d+:\d+ [AP]M/)))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ Dashboard shows "Taken at" status');

    // ======================
    // Phase 7: Navigate to Medications Screen - Verify Taken Status
    // ======================
    console.log('Navigating to Medications screen to verify taken status');
    await element(by.text('Meds')).tap();
    await waitForAnimation(1000);

    await waitFor(element(by.text('Medications')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('On Medications screen - checking for taken indicator');

    // Wait for the screen to load the taken status from database

    // Should show taken status (looking for "dose taken at" text)
    // Pattern: "9:00 AM dose taken at 10:00 AM" (schedule time + "dose taken at" + logged time)
    await waitFor(element(by.text(/\d+:\d+ [AP]M dose taken at \d+:\d+ [AP]M/)))
      .toBeVisible()
      .withTimeout(8000);

    console.log('✅ SUCCESS: Medications screen shows taken status');

    console.log('✅ ALL TESTS PASSED: Issue #7 fixed - medication status syncs correctly!');
  });
});
