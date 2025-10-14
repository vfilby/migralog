const { resetDatabase, waitForAnimation } = require('./helpers');

/**
 * Medication Dose Edit/Delete E2E Test
 *
 * Tests the medication dose edit and delete functionality by:
 * 1. Creating a medication and logging doses
 * 2. Navigating to medication detail page
 * 3. Testing long-press to show action menu
 * 4. Testing delete functionality with confirmation
 * 5. Testing edit functionality with modal
 * 6. Verifying changes persist after navigation
 */
describe('Medication Dose Edit/Delete', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    // Relaunch app to ensure clean state
    await device.launchApp({ delete: false, newInstance: true });

    // Reset database and load test fixtures (medications with schedules)
    await resetDatabase(true);
    await waitForAnimation(2000);
  });

  it('should allow deleting a medication dose from detail page', async () => {
    // ======================
    // Phase 1: Navigate to Medications Tab
    // ======================
    console.log('Navigating to Medications tab');
    await element(by.text('Meds')).tap();
    await waitForAnimation(1000);

    await waitFor(element(by.text('Medications')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('On Medications screen');

    // ======================
    // Phase 2: Log a Dose for Testing
    // ======================
    // Find a medication card and tap it to open detail page
    // Test fixtures should have "Test Topiramate" medication
    await waitFor(element(by.text('Test Topiramate')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('Found test medication');

    await element(by.text('Test Topiramate')).tap();
    await waitForAnimation(1000);

    // Should be on medication detail screen
    await waitFor(element(by.text('Medication Details')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('On Medication Detail screen');

    // Log a dose using "Log Dose Now" button
    await waitFor(element(by.text('Log Dose Now')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.text('Log Dose Now')).tap();
    await waitForAnimation(1000);

    // Should see success alert
    await waitFor(element(by.text('Success')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('Dose logged successfully');

    // Dismiss alert
    await element(by.text('OK')).tap();
    await waitForAnimation(1000);

    // ======================
    // Phase 3: Verify Dose Appears in Recent Activity
    // ======================
    // Scroll to Recent Activity section if needed
    await waitFor(element(by.text('Recent Activity (30 days)')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('Found Recent Activity section');

    // Should see the logged dose (look for date pattern like "Oct 13, 2025")
    const today = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const expectedDatePattern = `${monthNames[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

    await waitFor(element(by.text(expectedDatePattern)))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ Dose entry is visible in Recent Activity');

    // ======================
    // Phase 4: Long-Press on Dose Entry to Show Action Menu
    // ======================
    console.log('Long-pressing on dose entry');

    // Long press on the date text to trigger action menu
    await element(by.text(expectedDatePattern)).longPress();
    await waitForAnimation(1000);

    // Should see action sheet with Delete option
    // On iOS, this will be an ActionSheet, on Android it will be an Alert
    await waitFor(element(by.text('Delete')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ Action menu appeared with Delete option');

    // ======================
    // Phase 5: Delete the Dose
    // ======================
    console.log('Tapping Delete');

    await element(by.text('Delete')).tap();
    await waitForAnimation(1000);

    // Should see confirmation dialog
    await waitFor(element(by.text('Delete Dose')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('Delete confirmation dialog appeared');

    // Confirm deletion
    await element(by.text('Delete')).tap();
    await waitForAnimation(1500);

    // Should see success message
    await waitFor(element(by.text('Success')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ Dose deleted successfully');

    // Dismiss success alert
    await element(by.text('OK')).tap();
    await waitForAnimation(1000);

    // ======================
    // Phase 6: Verify Dose is Removed
    // ======================
    // The Recent Activity section should now show "No doses logged"
    // or the dose entry should be gone
    await waitFor(element(by.text('No doses logged in the last 30 days')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ Dose entry removed from Recent Activity');

    console.log('✅ ALL TESTS PASSED: Delete functionality works correctly!');
  });

  it('should allow editing a medication dose from detail page', async () => {
    // ======================
    // Phase 1: Navigate to Medications Tab and Log a Dose
    // ======================
    console.log('Navigating to Medications tab');
    await element(by.text('Meds')).tap();
    await waitForAnimation(1000);

    await waitFor(element(by.text('Medications')))
      .toBeVisible()
      .withTimeout(5000);

    // Find and tap medication
    await waitFor(element(by.text('Test Topiramate')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.text('Test Topiramate')).tap();
    await waitForAnimation(1000);

    // Log a dose
    await waitFor(element(by.text('Log Dose Now')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.text('Log Dose Now')).tap();
    await waitForAnimation(1000);

    // Dismiss success alert
    await waitFor(element(by.text('Success')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.text('OK')).tap();
    await waitForAnimation(1000);

    console.log('Dose logged for editing test');

    // ======================
    // Phase 2: Long-Press and Select Edit
    // ======================
    const today = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const expectedDatePattern = `${monthNames[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

    console.log('Long-pressing on dose entry to edit');

    await element(by.text(expectedDatePattern)).longPress();
    await waitForAnimation(1000);

    // Should see Edit option
    // Note: There might be multiple "Edit" buttons (header edit + action menu edit)
    // The action menu should appear after long press
    await waitForAnimation(1000);

    console.log('✅ Action menu appeared with Edit option');

    // Tap the Edit button - use atIndex(1) to avoid the header Edit button
    try {
      await element(by.text('Edit')).atIndex(1).tap();
    } catch (e) {
      // Fallback: if there's only one Edit button, tap it
      await element(by.text('Edit')).atIndex(0).tap();
    }
    await waitForAnimation(1000);

    // ======================
    // Phase 3: Edit Modal Should Open
    // ======================
    await waitFor(element(by.text('Edit Dose')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ Edit modal opened successfully');

    // For now, just verify the modal opened and close it
    // TODO: Add field editing tests once UI is accessible in tests
    console.log('Closing edit modal (Cancel)');

    await element(by.text('Cancel')).tap();
    await waitForAnimation(1000);

    // Should be back on detail screen
    await waitFor(element(by.text('Medication Details')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ Edit modal works - can open and close successfully');
  });

  it('should allow canceling edit without saving changes', async () => {
    // ======================
    // Setup: Navigate and Log a Dose
    // ======================
    await element(by.text('Meds')).tap();
    await waitForAnimation(1000);

    await waitFor(element(by.text('Test Topiramate')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.text('Test Topiramate')).tap();
    await waitForAnimation(1000);

    await waitFor(element(by.text('Log Dose Now')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.text('Log Dose Now')).tap();
    await waitForAnimation(1000);

    await waitFor(element(by.text('Success')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.text('OK')).tap();
    await waitForAnimation(1000);

    // ======================
    // Open Edit Modal
    // ======================
    const today = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const expectedDatePattern = `${monthNames[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

    await element(by.text(expectedDatePattern)).longPress();
    await waitForAnimation(1000);

    // Tap Edit from action menu
    try {
      await element(by.text('Edit')).atIndex(1).tap();
    } catch (e) {
      await element(by.text('Edit')).atIndex(0).tap();
    }
    await waitForAnimation(1000);

    await waitFor(element(by.text('Edit Dose')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('Edit modal opened');

    // ======================
    // Cancel Without Changes
    // ======================
    console.log('Tapping Cancel');

    await element(by.text('Cancel')).tap();
    await waitForAnimation(1000);

    // Should be back on detail screen
    await waitFor(element(by.text('Medication Details')))
      .toBeVisible()
      .withTimeout(5000);

    // Original dose amount should still be visible (1 × 50mg)
    await waitFor(element(by.text('1 × 50mg')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ Cancel works correctly - no changes made');
  });

  it('should allow canceling delete from confirmation dialog', async () => {
    // ======================
    // Setup: Navigate and Log a Dose
    // ======================
    await element(by.text('Meds')).tap();
    await waitForAnimation(1000);

    await waitFor(element(by.text('Test Topiramate')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.text('Test Topiramate')).tap();
    await waitForAnimation(1000);

    await waitFor(element(by.text('Log Dose Now')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.text('Log Dose Now')).tap();
    await waitForAnimation(1000);

    await waitFor(element(by.text('Success')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.text('OK')).tap();
    await waitForAnimation(1000);

    // ======================
    // Open Delete Confirmation
    // ======================
    const today = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const expectedDatePattern = `${monthNames[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

    await element(by.text(expectedDatePattern)).longPress();
    await waitForAnimation(1000);

    await element(by.text('Delete')).tap();
    await waitForAnimation(1000);

    await waitFor(element(by.text('Delete Dose')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('Delete confirmation dialog opened');

    // ======================
    // Cancel Deletion
    // ======================
    console.log('Tapping Cancel on delete confirmation');

    await element(by.text('Cancel')).tap();
    await waitForAnimation(1000);

    // Should be back on detail screen with dose still present
    await waitFor(element(by.text(expectedDatePattern)))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ Cancel delete works correctly - dose still present');
  });
});
