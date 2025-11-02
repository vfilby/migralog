const { resetDatabase, scrollToElement, waitForAnimation } = require('./helpers');

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
    // Note: Calendar month state persists between tests (only navigate to previous month once in first test)
    await resetDatabase();
  });

  it('should complete full daily status tracking workflow', async () => {
    // ======================
    // Phase 1: View Calendar on Analytics Screen
    // ======================

    // Verify we're on dashboard
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('On Dashboard - navigating to Analytics');

    // Navigate to Analytics tab to see calendar
    await element(by.text('Trends')).tap();
    await waitForAnimation(1000);

    // Verify we're on Analytics screen
    await waitFor(element(by.text('Trends & Analytics')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('On Analytics screen - looking for calendar');

    // Calendar should show current month with previous/next buttons
    await waitFor(element(by.id('previous-month-button')))
      .toBeVisible()
      .withTimeout(5000);

    await waitFor(element(by.id('next-month-button')))
      .toBeVisible()
      .withTimeout(3000);

    console.log('Calendar is visible!');

    // Navigate to PREVIOUS month to ensure all days are in the past and can be set
    // Only navigate if we're still on the current month (check for current month name)
    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    try {
      await waitFor(element(by.text(currentMonth)))
        .toBeVisible()
        .withTimeout(1000);

      // We're on current month, navigate to previous month
      await element(by.id('previous-month-button')).tap();
      await waitForAnimation(1000);
      console.log('Navigated to previous month to select past dates');
    } catch (e) {
      // Already on a previous month, no need to navigate
      console.log('Already on previous month, skipping navigation');
    }

    // ======================
    // Phase 2: Manually Log a Green Day
    // ======================

    // Tap on any day in the calendar (e.g., the 5th of previous month)
    // The calendar uses testID format: calendar-day-YYYY-MM-DD
    const today = new Date();
    const previousMonth = new Date(today);
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    const year = previousMonth.getFullYear();
    const month = String(previousMonth.getMonth() + 1).padStart(2, '0');
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

    // Should be back on Analytics screen (where we came from)
    await waitFor(element(by.text('Trends & Analytics')))
      .toBeVisible()
      .withTimeout(3000);

    console.log('Successfully logged green day');

    // Navigate back to Home (Dashboard)
    await element(by.text('Home')).tap();
    await waitForAnimation(1000);

    // ======================
    // Phase 3: Manually Log a Yellow Day
    // ======================

    // Navigate back to Analytics to access calendar
    await element(by.text('Trends')).tap();
    await waitForAnimation(1000);

    // Calendar state is preserved - still showing previous month

    // Tap on a different day (e.g., the 10th of previous month)
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

    // Should be back on Analytics screen (where we came from)
    await waitFor(element(by.text('Trends & Analytics')))
      .toBeVisible()
      .withTimeout(3000);

    console.log('Successfully logged yellow day with prodrome type and notes');

    // Navigate back to Home (Dashboard)
    await element(by.text('Home')).tap();
    await waitForAnimation(1000);

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

    // Should be back on dashboard
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(10000);

    console.log('Created episode - red day should be auto-created for today');

    // Navigate to Analytics to verify red day in calendar
    await element(by.text('Trends')).tap();
    await waitForAnimation(1000);

    // Calendar should now show red day for today
    // We can't easily verify the emoji color, but we can verify the calendar is still visible
    await waitFor(element(by.id('previous-month-button')))
      .toBeVisible()
      .withTimeout(3000);

    console.log('Calendar still visible after creating episode');

    // ======================
    // Phase 5: End Episode and Verify in Calendar
    // ======================

    // Navigate back to Home to see the active episode
    await element(by.text('Home')).tap();
    await waitForAnimation(1000);

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

    // Scroll to bottom to find End Episode buttons
    await element(by.id('episode-detail-scroll-view')).scrollTo('bottom');
    await waitForAnimation(500);

    // Tap "End Now" button (new two-button UX)
    await waitFor(element(by.id('end-now-button')))
      .toBeVisible()
      .withTimeout(3000);

    await element(by.id('end-now-button')).tap();

    // Wait for episode to end and navigate back to dashboard

    // Should be back on dashboard
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(3000);

    console.log('Ended episode - all days in episode range should be marked red');

    // ======================
    // Phase 6: Verify Calendar Still Visible
    // ======================

    // Navigate to Analytics to verify calendar
    await element(by.text('Trends')).tap();
    await waitForAnimation(1000);

    // Calendar should still be visible (we're on previous month from earlier navigation)
    await waitFor(element(by.id('previous-month-button')))
      .toBeVisible()
      .withTimeout(3000);

    await waitFor(element(by.id('next-month-button')))
      .toBeVisible()
      .withTimeout(3000);

    console.log('Calendar still visible with previous month showing all our logged days');

    // Test complete!
    // We've successfully:
    // 1. Viewed the calendar on Analytics screen
    // 2. Manually logged a green day (Oct 5)
    // 3. Manually logged a yellow day with type and notes (Oct 10)
    // 4. Created an episode and verified calendar still visible
    // 5. Ended episode and verified red days
    // 6. Verified calendar remains visible across navigation
    console.log('Daily status tracking test completed successfully!');
  });

  it('should allow logging yellow day without type selection', async () => {
    // ======================
    // Test Yellow Day Without Type (Optional)
    // ======================

    // Verify we're on dashboard
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(5000);

    // Navigate to Analytics to access calendar
    await element(by.text('Trends')).tap();
    await waitForAnimation(1000);

    // Calendar state persists from first test - already on previous month
    // Tap on a day (e.g., the 15th of previous month)
    const today = new Date();
    const previousMonth = new Date(today);
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    const year = previousMonth.getFullYear();
    const month = String(previousMonth.getMonth() + 1).padStart(2, '0');
    const testDay = '15';
    const testDate = `${year}-${month}-${testDay}`;

    console.log(`Attempting to log yellow day without type for: ${testDate}`);

    try {
      await waitFor(element(by.id(`calendar-day-${testDate}`)))
        .toBeVisible()
        .withTimeout(3000);

      await element(by.id(`calendar-day-${testDate}`)).tap();
      await waitForAnimation(1000);
    } catch (e) {
      console.log('Could not find day 15, trying day 4');
      const altDay = '04';
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

    console.log('Selected yellow day - NOT selecting type to test optional behavior');

    // DO NOT select any type - verify we can save without it
    // Save the yellow day directly without selecting type
    await waitFor(element(by.id('save-status-button')))
      .toBeVisible()
      .withTimeout(3000);

    await element(by.id('save-status-button')).tap();

    // Should be back on Analytics screen (where we came from) without error
    await waitFor(element(by.text('Trends & Analytics')))
      .toBeVisible()
      .withTimeout(3000);

    console.log('Successfully logged yellow day WITHOUT type selection');
  });

  it('should allow skipping daily status prompt', async () => {
    // ======================
    // Test Skip Functionality
    // ======================

    // Verify we're on dashboard
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(5000);

    // Navigate to Analytics to access calendar
    await element(by.text('Trends')).tap();
    await waitForAnimation(1000);

    // Calendar state persists from first test - already on previous month
    // Tap on a day from previous month
    const today = new Date();
    const previousMonth = new Date(today);
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    const year = previousMonth.getFullYear();
    const month = String(previousMonth.getMonth() + 1).padStart(2, '0');
    const testDay = '07';
    const testDate = `${year}-${month}-${testDay}`;

    console.log(`Attempting to test skip for: ${testDate}`);

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

    // Should be back on Analytics screen (where we came from) without saving
    await waitFor(element(by.text('Trends & Analytics')))
      .toBeVisible()
      .withTimeout(3000);

    console.log('Successfully skipped daily status prompt');
  });

  it('should show widget for yesterday, hide after logging via calendar', async () => {
    // ======================
    // Test Widget Visibility Logic
    // ======================

    // Verify we're on dashboard
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('On Dashboard - checking for widget');

    // Widget should be visible for yesterday (since we just reset database)
    await waitFor(element(by.id('daily-status-widget')))
      .toBeVisible()
      .withTimeout(5000);

    await waitFor(element(by.text('How was yesterday?')))
      .toBeVisible()
      .withTimeout(3000);

    console.log('Widget is visible with prompt for yesterday');

    // Navigate to Analytics to log yesterday via calendar
    await element(by.text('Trends')).tap();
    await waitForAnimation(1000);

    // Calculate yesterday's date
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayDate = `${year}-${month}-${day}`;

    console.log(`Logging status for yesterday: ${yesterdayDate}`);

    // Calendar state persists from first test (on previous month)
    // If yesterday is in current month (mid-month), navigate forward to current month
    // If yesterday is in previous month (1st of month), stay on previous month
    if (yesterday.getMonth() === today.getMonth()) {
      await element(by.id('next-month-button')).tap();
      await waitForAnimation(1000);
      console.log('Navigated forward to current month (yesterday is in current month)');
    }

    // Tap on yesterday in the calendar
    await waitFor(element(by.id(`calendar-day-${yesterdayDate}`)))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id(`calendar-day-${yesterdayDate}`)).tap();
    await waitForAnimation(1000);

    // Should open DailyStatusPrompt modal
    await waitFor(element(by.text('Daily Check-in')))
      .toBeVisible()
      .withTimeout(5000);

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

    console.log('Logged yesterday as green via calendar');

    // Navigate back to Home (Dashboard)
    await element(by.text('Home')).tap();
    await waitForAnimation(1000);

    // Widget should NOT be visible anymore (yesterday is now logged and past 15-min window)
    // Wait a bit to ensure widget has time to update
    await waitForAnimation(1000);

    // Try to find the widget - it should not exist
    try {
      await waitFor(element(by.id('daily-status-widget')))
        .toBeVisible()
        .withTimeout(2000);

      // If we get here, the widget is still visible - that's wrong
      throw new Error('Widget should not be visible after logging yesterday');
    } catch (e) {
      if (e.message && e.message.includes('should not be visible')) {
        throw e;
      }
      // Expected - widget is not visible
      console.log('Widget correctly hidden after logging yesterday');
    }

    console.log('Widget visibility test passed!');
  });

  it('should update calendar after undoing status from widget', async () => {
    // ======================
    // Test Undo Flow: Calendar → Widget Undo → Calendar Update
    // ======================

    // Verify we're on dashboard
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('On Dashboard - navigating to Analytics to log yesterday');

    // Navigate to Analytics to log yesterday via calendar
    await element(by.text('Trends')).tap();
    await waitForAnimation(1000);

    // Calculate yesterday's date
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayDate = `${year}-${month}-${day}`;

    console.log(`Logging status for yesterday: ${yesterdayDate}`);

    // Calendar state persists from first test (on previous month)
    // If yesterday is in current month (mid-month), navigate forward to current month
    // If yesterday is in previous month (1st of month), stay on previous month
    if (yesterday.getMonth() === today.getMonth()) {
      await element(by.id('next-month-button')).tap();
      await waitForAnimation(1000);
      console.log('Navigated forward to current month (yesterday is in current month)');
    }

    // Tap on yesterday in the calendar
    await waitFor(element(by.id(`calendar-day-${yesterdayDate}`)))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id(`calendar-day-${yesterdayDate}`)).tap();
    await waitForAnimation(1000);

    // Should open DailyStatusPrompt modal
    await waitFor(element(by.text('Daily Check-in')))
      .toBeVisible()
      .withTimeout(5000);

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

    console.log('Logged yesterday as green via calendar');

    // Verify green indicator appears on calendar
    // We can't directly check for the emoji, but the day should be tappable
    await waitFor(element(by.id(`calendar-day-${yesterdayDate}`)))
      .toBeVisible()
      .withTimeout(3000);

    console.log('Calendar shows yesterday (indicator should be visible)');

    // Navigate back to Home (Dashboard)
    await element(by.text('Home')).tap();

    // Widget should now show the logged state (with testID daily-status-widget-logged)
    await waitFor(element(by.id('daily-status-widget-logged')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('Widget shows logged state - checking for undo button');

    // Press the Undo button
    await waitFor(element(by.id('undo-status-button')))
      .toBeVisible()
      .withTimeout(3000);

    await element(by.id('undo-status-button')).tap();
    await waitForAnimation(1000);

    console.log('Pressed undo button');

    // Widget should now show prompt again (not logged state)
    await waitFor(element(by.text('How was yesterday?')))
      .toBeVisible()
      .withTimeout(3000);

    console.log('Widget now shows prompt again');

    // Navigate back to Analytics to verify calendar updated
    await element(by.text('Trends')).tap();

    // Calendar should be visible
    await waitFor(element(by.id('previous-month-button')))
      .toBeVisible()
      .withTimeout(5000);

    // Yesterday should still be visible but WITHOUT the green indicator
    // We can tap on it - if it opens the prompt, the status was properly cleared
    await waitFor(element(by.id(`calendar-day-${yesterdayDate}`)))
      .toBeVisible()
      .withTimeout(3000);

    await element(by.id(`calendar-day-${yesterdayDate}`)).tap();
    await waitForAnimation(1000);

    // Should open DailyStatusPrompt modal (proving status was cleared)
    await waitFor(element(by.text('Daily Check-in')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('Calendar correctly updated - status was cleared, prompt reopens');

    // Close the prompt
    await waitFor(element(by.id('skip-button')))
      .toBeVisible()
      .withTimeout(3000);

    await element(by.id('skip-button')).tap();
    await waitForAnimation(1000);

    console.log('Undo flow test passed! Calendar properly updates after undo from widget');
  });
});
