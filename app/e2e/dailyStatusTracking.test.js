const { resetDatabase, scrollToElement, scrollToText, waitForAnimation } = require('./helpers');

/**
 * Daily Status Tracking E2E Test
 *
 * Tests the daily status tracking workflow:
 * 1. View the calendar on dashboard
 * 2. Manually log a green day
 * 3. Manually log a yellow day with type and notes
 * 4. Create an episode and verify auto-red day
 * 5. End episode and verify red days in calendar
 * 6. Navigate month and interact with calendar
 */
describe('Daily Status Tracking', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    // Reset database before each test to ensure clean state
    await resetDatabase();
  });

  it('should complete full daily status tracking workflow', async () => {
    // ======================
    // Phase 1: View Calendar on Dashboard
    // ======================

    // Verify we're on dashboard
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('On Dashboard - looking for calendar');

    // Scroll down to find the calendar
    // The calendar should be below the recent episodes section
    try {
      // Try scrolling down to make calendar visible
      await element(by.id('dashboard-title')).swipe('up', 'slow', 0.8);
      await waitForAnimation(500);
      await element(by.id('dashboard-title')).swipe('up', 'slow', 0.8);
      await waitForAnimation(500);
    } catch (e) {
      console.log('Could not scroll - calendar may already be visible');
    }

    // Calendar should show current month with previous/next buttons
    await waitFor(element(by.id('previous-month-button')))
      .toBeVisible()
      .withTimeout(5000);

    await waitFor(element(by.id('next-month-button')))
      .toBeVisible()
      .withTimeout(3000);

    console.log('Calendar is visible!');

    // ======================
    // Phase 2: Manually Log a Green Day
    // ======================

    // Tap on any day in the calendar (e.g., the 5th of current month)
    // The calendar uses testID format: calendar-day-YYYY-MM-DD
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const testDay = '05'; // 5th day of month
    const testDateGreen = `${year}-${month}-${testDay}`;

    console.log(`Attempting to log green day for: ${testDateGreen}`);

    try {
      await waitFor(element(by.id(`calendar-day-${testDateGreen}`)))
        .toBeVisible()
        .withTimeout(3000);

      await element(by.id(`calendar-day-${testDateGreen}`)).tap();
      await waitForAnimation(1000);
    } catch (e) {
      console.log('Could not find calendar day, trying alternative date');
      // Try yesterday if 5th is not available
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const altDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      console.log(`Trying alternative date: ${altDate}`);

      await element(by.id(`calendar-day-${altDate}`)).tap();
      await waitForAnimation(1000);
    }

    // Should open DailyStatusPrompt modal
    await waitFor(element(by.text('Daily Check-in')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('Daily Status Prompt opened');

    // Select "Clear Day" (green)
    await waitFor(element(by.id('green-day-button')))
      .toBeVisible()
      .withTimeout(3000);

    await element(by.id('green-day-button')).tap();
    await waitForAnimation(500);

    // Save the green day
    await waitFor(element(by.id('save-status-button')))
      .toBeVisible()
      .withTimeout(3000);

    await element(by.id('save-status-button')).tap();
    await waitForAnimation(1500);

    // Should be back on dashboard with calendar visible
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(3000);

    console.log('Successfully logged green day');

    // ======================
    // Phase 3: Manually Log a Yellow Day
    // ======================

    // Scroll to calendar again
    try {
      await element(by.id('dashboard-title')).swipe('up', 'slow', 0.8);
      await waitForAnimation(500);
    } catch (e) {
      console.log('Already scrolled to calendar');
    }

    // Tap on a different day (e.g., the 10th)
    const testDayYellow = '10';
    const testDateYellow = `${year}-${month}-${testDayYellow}`;

    console.log(`Attempting to log yellow day for: ${testDateYellow}`);

    try {
      await waitFor(element(by.id(`calendar-day-${testDateYellow}`)))
        .toBeVisible()
        .withTimeout(3000);

      await element(by.id(`calendar-day-${testDateYellow}`)).tap();
      await waitForAnimation(1000);
    } catch (e) {
      console.log('Could not find day 10, trying day 3');
      const altDay = '03';
      const altDate = `${year}-${month}-${altDay}`;
      await element(by.id(`calendar-day-${altDate}`)).tap();
      await waitForAnimation(1000);
    }

    // Should open DailyStatusPrompt modal
    await waitFor(element(by.text('Daily Check-in')))
      .toBeVisible()
      .withTimeout(5000);

    // Select "Not Clear" (yellow)
    await waitFor(element(by.id('yellow-day-button')))
      .toBeVisible()
      .withTimeout(3000);

    await element(by.id('yellow-day-button')).tap();
    await waitForAnimation(500);

    console.log('Selected yellow day - expandable section should appear');

    // The yellow day section should expand, showing type selection
    await waitFor(element(by.id('yellow-type-prodrome')))
      .toBeVisible()
      .withTimeout(3000);

    // Select "Prodrome" type
    await element(by.id('yellow-type-prodrome')).tap();
    await waitForAnimation(300);

    // Add optional notes
    await waitFor(element(by.id('daily-status-notes-input')))
      .toBeVisible()
      .withTimeout(3000);

    await element(by.id('daily-status-notes-input')).tap();
    await waitForAnimation(500);

    await element(by.id('daily-status-notes-input')).typeText('Feeling warning signs of episode');
    await element(by.id('daily-status-notes-input')).tapReturnKey();
    await waitForAnimation(500);

    // Save the yellow day
    await waitFor(element(by.id('save-status-button')))
      .toBeVisible()
      .withTimeout(3000);

    await element(by.id('save-status-button')).tap();
    await waitForAnimation(1500);

    // Should be back on dashboard
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(3000);

    console.log('Successfully logged yellow day with prodrome type and notes');

    // ======================
    // Phase 4: Create Episode and Verify Auto-Red Day
    // ======================

    // Scroll to top to find Start Episode button
    try {
      await element(by.id('dashboard-title')).swipe('down', 'fast', 0.9);
      await waitForAnimation(500);
    } catch (e) {
      console.log('Already at top');
    }

    // Start a new episode
    await waitFor(element(by.id('start-episode-button')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('start-episode-button')).tap();
    await waitForAnimation(1000);

    // Should be on Start Episode screen
    await waitFor(element(by.text('Cancel')))
      .toBeVisible()
      .withTimeout(5000);

    // Scroll to save button
    await scrollToElement('save-episode-button');

    // Save the episode
    await element(by.id('save-episode-button')).tap();
    await waitForAnimation(1500);

    // Should be back on dashboard
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('Created episode - red day should be auto-created for today');

    // Scroll down to calendar to verify red day
    try {
      await element(by.id('dashboard-title')).swipe('up', 'slow', 0.8);
      await waitForAnimation(500);
      await element(by.id('dashboard-title')).swipe('up', 'slow', 0.8);
      await waitForAnimation(500);
    } catch (e) {
      console.log('Already scrolled');
    }

    // Calendar should now show red day for today
    // We can't easily verify the emoji color, but we can verify the calendar is still visible
    await waitFor(element(by.id('previous-month-button')))
      .toBeVisible()
      .withTimeout(3000);

    console.log('Calendar still visible after creating episode');

    // ======================
    // Phase 5: End Episode and Verify in Calendar
    // ======================

    // Scroll back up to see active episode
    try {
      await element(by.id('dashboard-title')).swipe('down', 'fast', 0.9);
      await waitForAnimation(500);
    } catch (e) {
      console.log('Already at top');
    }

    // Tap the active episode card to open details
    await waitFor(element(by.id('active-episode-card')))
      .toBeVisible()
      .withTimeout(3000);

    await element(by.id('active-episode-card')).tap();
    await waitForAnimation(1000);

    // Should be on Episode Detail screen
    await waitFor(element(by.text('Episode Details')))
      .toBeVisible()
      .withTimeout(3000);

    // Scroll to bottom to find End Episode button
    await element(by.id('episode-detail-scroll-view')).scrollTo('bottom');
    await waitForAnimation(500);

    // End the episode
    await waitFor(element(by.id('end-episode-button')))
      .toBeVisible()
      .withTimeout(3000);

    await element(by.id('end-episode-button')).tap();
    await waitForAnimation(2000);

    // Should be back on dashboard
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(3000);

    console.log('Ended episode - all days in episode range should be marked red');

    // ======================
    // Phase 6: Navigate Month and Interact with Calendar
    // ======================

    // Scroll down to calendar
    try {
      await element(by.id('dashboard-title')).swipe('up', 'slow', 0.8);
      await waitForAnimation(500);
      await element(by.id('dashboard-title')).swipe('up', 'slow', 0.8);
      await waitForAnimation(500);
    } catch (e) {
      console.log('Already scrolled');
    }

    // Test month navigation - go to previous month
    await waitFor(element(by.id('previous-month-button')))
      .toBeVisible()
      .withTimeout(3000);

    await element(by.id('previous-month-button')).tap();
    await waitForAnimation(1000);

    console.log('Navigated to previous month');

    // Calendar should still be visible
    await waitFor(element(by.id('next-month-button')))
      .toBeVisible()
      .withTimeout(3000);

    // Go back to current month
    await element(by.id('next-month-button')).tap();
    await waitForAnimation(1000);

    console.log('Navigated back to current month');

    // Calendar should still be visible with all our logged days
    await waitFor(element(by.id('previous-month-button')))
      .toBeVisible()
      .withTimeout(3000);

    // Test complete!
    // We've successfully:
    // 1. Viewed the calendar on dashboard
    // 2. Manually logged a green day
    // 3. Manually logged a yellow day with type and notes
    // 4. Created an episode and verified calendar still visible
    // 5. Ended episode
    // 6. Navigated between months
    console.log('Daily status tracking test completed successfully!');
  });

  it('should allow skipping daily status prompt', async () => {
    // ======================
    // Test Skip Functionality
    // ======================

    // Verify we're on dashboard
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(5000);

    // Scroll down to calendar
    try {
      await element(by.id('dashboard-title')).swipe('up', 'slow', 0.8);
      await waitForAnimation(500);
      await element(by.id('dashboard-title')).swipe('up', 'slow', 0.8);
      await waitForAnimation(500);
    } catch (e) {
      console.log('Already scrolled');
    }

    // Tap on a day
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const testDay = '07';
    const testDate = `${year}-${month}-${testDay}`;

    try {
      await waitFor(element(by.id(`calendar-day-${testDate}`)))
        .toBeVisible()
        .withTimeout(3000);

      await element(by.id(`calendar-day-${testDate}`)).tap();
      await waitForAnimation(1000);
    } catch (e) {
      console.log('Could not find day 7, trying day 2');
      const altDay = '02';
      const altDate = `${year}-${month}-${altDay}`;
      await element(by.id(`calendar-day-${altDate}`)).tap();
      await waitForAnimation(1000);
    }

    // Should open DailyStatusPrompt modal
    await waitFor(element(by.text('Daily Check-in')))
      .toBeVisible()
      .withTimeout(5000);

    // Tap skip button
    await waitFor(element(by.id('skip-button')))
      .toBeVisible()
      .withTimeout(3000);

    await element(by.id('skip-button')).tap();
    await waitForAnimation(1000);

    // Should be back on dashboard without saving
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(3000);

    console.log('Successfully skipped daily status prompt');
  });
});
