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
    // Reset database and load test fixtures (medications with schedules)
    // Deep link reset is fast (~2s) so no need to relaunch app
    await resetDatabase(true);
  });

  it('should allow deleting a medication dose from detail page', async () => {
    // ======================
    // Phase 1: Navigate to Medications Tab
    // ======================
    console.log('Navigating to Medications tab');

    // Wait for tab bar to be ready before tapping
    await waitFor(element(by.text('Meds')))
      .toBeVisible()
      .withTimeout(5000);

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
    // Longer timeout for CI environments (slower than local)
    await waitFor(element(by.text('Test Topiramate')))
      .toBeVisible()
      .withTimeout(15000);

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

    console.log('Dose logged successfully');

    // ======================
    // Phase 3: Verify Dose Appears in Recent Activity
    // ======================
    // Scroll down to Recent Activity section (it's below Notification Settings for preventative meds)
    await element(by.id('medication-detail-scrollview')).scrollTo('bottom');
    await waitForAnimation(500);

    await waitFor(element(by.text('Recent Activity')))
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
    await waitForAnimation(1000);

    console.log('✅ Dose deleted successfully');

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

  it('should allow editing medication dose amount and persist changes', async () => {
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


    console.log('Dose logged - should show 1 × 50mg');

    // Scroll down to see dose amount (it's below Notification Settings)
    await element(by.id('medication-detail-scrollview')).scrollTo('bottom');
    await waitForAnimation(500);

    // Verify initial dose amount (1 × 50mg)
    await waitFor(element(by.text('1 × 50mg')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ Initial dose amount verified: 1 × 50mg');

    // ======================
    // Phase 2: Open Edit Modal
    // ======================
    const today = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const expectedDatePattern = `${monthNames[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

    console.log('Long-pressing on dose entry to edit');
    // Scroll down to Recent Activity section to access the dose entry
    await element(by.id('medication-detail-scrollview')).scrollTo('bottom');
    await waitForAnimation(500);

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

    console.log('✅ Edit modal opened');

    // ======================
    // Phase 3: Edit the Dosage Amount
    // ======================
    console.log('Finding and editing dosage amount field');

    // Find the dose amount input field by testID and change it from 1 to 4
    await element(by.id('dose-amount-input')).replaceText('4');
    console.log('✅ Changed dosage amount from 1 to 4');

    await waitForAnimation(500);

    // ======================
    // Phase 4: Save Changes
    // ======================
    console.log('Saving changes');
    await element(by.text('Save')).tap();

    await waitForAnimation(1000);

    console.log('✅ Dose updated successfully');

    // ======================
    // Phase 5: Verify Changes Persisted in UI
    // ======================
    console.log('Verifying updated dose amount appears in UI');

    // Should now see 4 × 50mg instead of 1 × 50mg
    await waitFor(element(by.text('4 × 50mg')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ Dose amount updated to 4 × 50mg in UI');

    // ======================
    // Phase 6: Verify Persistence After Navigation
    // ======================
    console.log('Testing persistence: navigating away and back');

    // Navigate back to medications list
    await element(by.text('← Back')).tap();
    await waitForAnimation(1000);

    // Navigate back to detail page
    await element(by.text('Test Topiramate')).tap();
    await waitForAnimation(1000);

    // Scroll down to see dose amount (it's below Notification Settings)
    await element(by.id('medication-detail-scrollview')).scrollTo('bottom');
    await waitForAnimation(500);

    // Should still see the updated dose amount
    await waitFor(element(by.text('4 × 50mg')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ Dose amount persisted after navigation');
    console.log('✅ ALL TESTS PASSED: Edit functionality works correctly with persistence!');
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


    // ======================
    // Open Edit Modal
    // ======================
    const today = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const expectedDatePattern = `${monthNames[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

    // Scroll down to Recent Activity section to access the dose entry
    await element(by.id('medication-detail-scrollview')).scrollTo('bottom');
    await waitForAnimation(500);

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

    // Scroll down to see dose amount (it's below Notification Settings)
    await element(by.id('medication-detail-scrollview')).scrollTo('bottom');
    await waitForAnimation(500);

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


    // ======================
    // Open Delete Confirmation
    // ======================
    const today = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const expectedDatePattern = `${monthNames[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

    // Scroll down to Recent Activity section to access the dose entry
    await element(by.id('medication-detail-scrollview')).scrollTo('bottom');
    await waitForAnimation(500);

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
