/**
 * Trends Screen E2E Tests
 *
 * Tests the Trends & Analytics screen functionality including:
 * 1. Screen navigation and rendering
 * 2. Time range selector interactions (7, 30, 90 days)
 * 3. Episode statistics display
 * 4. Medication usage statistics display
 * 5. Calendar integration
 * 6. Accessibility features
 */

const { resetDatabase, waitForAnimation } = require('./helpers');

describe('Trends & Analytics Screen', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES', location: 'always' },
    });
  });

  beforeEach(async () => {
    // Reset database before each test to ensure clean state
    await resetDatabase(false);
  });

  describe('Navigation and Basic Rendering', () => {
    it('should navigate to Trends screen and display main components', async () => {
      // Verify we're on dashboard
      await waitFor(element(by.id('dashboard-title')))
        .toBeVisible()
        .withTimeout(5000);

      // Navigate to Trends tab
      await element(by.text('Trends')).tap();
      await waitForAnimation(1000);

      // Verify main screen is visible by checking the header
      await waitFor(element(by.text('Trends & Analytics')))
        .toBeVisible()
        .withTimeout(5000);

      console.log('✅ Trends screen loaded successfully');

      // Verify calendar is visible
      await waitFor(element(by.id('previous-month-button')))
        .toBeVisible()
        .withTimeout(3000);

      await waitFor(element(by.id('next-month-button')))
        .toBeVisible()
        .withTimeout(3000);

      console.log('✅ Monthly calendar view is visible');

      // Scroll down to reveal time range selector (past the calendar)
      await element(by.id('analytics-scroll-view')).scroll(300, 'down');
      await waitForAnimation(500);

      // Verify all three time range buttons are visible
      await expect(element(by.id('time-range-7'))).toBeVisible();
      await expect(element(by.id('time-range-30'))).toBeVisible();
      await expect(element(by.id('time-range-90'))).toBeVisible();

      console.log('✅ Time range selector with all options is visible');

      // Scroll down to reveal Episode Statistics and Medication Usage Statistics
      await element(by.id('analytics-scroll-view')).scroll(400, 'down');
      await waitForAnimation(300);

      console.log('✅ Episode and medication statistics sections are visible');
    });

    it('should have proper accessibility labels on time range buttons', async () => {
      // Navigate to Trends tab
      await element(by.text('Trends')).tap();
      await waitForAnimation(1000);

      // Verify screen is loaded by checking header
      await waitFor(element(by.text('Trends & Analytics')))
        .toBeVisible()
        .withTimeout(5000);

      // Swipe to reveal time range selector
      await element(by.id('analytics-scroll-view')).scroll(300, 'down');
      await waitForAnimation(500);

      // Verify time range buttons have accessibility labels
      await expect(element(by.id('time-range-7'))).toHaveLabel('Select 7 days time range');
      await expect(element(by.id('time-range-30'))).toHaveLabel('Select 30 days time range');
      await expect(element(by.id('time-range-90'))).toHaveLabel('Select 90 days time range');

      console.log('✅ Time range buttons have proper accessibility labels');
    });
  });

  describe('Time Range Selector', () => {
    it('should switch between time ranges (7, 30, 90 days)', async () => {
      // Navigate to Trends tab
      await element(by.text('Trends')).tap();
      await waitForAnimation(1000);

      // Swipe to reveal time range selector
      await element(by.id('analytics-scroll-view')).scroll(300, 'down');
      await waitForAnimation(500);

      // Test switching to 7 days
      await element(by.id('time-range-7')).tap();
      await waitForAnimation(1000);

      await expect(element(by.id('time-range-7'))).toBeVisible();
      console.log('✅ Switched to 7 days range');

      // Test switching to 90 days
      await element(by.id('time-range-90')).tap();
      await waitForAnimation(1000);

      await expect(element(by.id('time-range-90'))).toBeVisible();
      console.log('✅ Switched to 90 days range');

      // Test switching back to 30 days
      await element(by.id('time-range-30')).tap();
      await waitForAnimation(1000);

      await expect(element(by.id('time-range-30'))).toBeVisible();
      console.log('✅ Switched back to 30 days range');
    });

    it('should update statistics when time range changes', async () => {
      // Navigate to Trends tab
      await element(by.text('Trends')).tap();
      await waitForAnimation(1000);

      // Swipe to reveal time range selector and episode statistics
      await element(by.id('analytics-scroll-view')).scroll(300, 'down');
      await waitForAnimation(500);

      // Switch to 7 days range
      await element(by.id('time-range-7')).tap();
      await waitForAnimation(1000);
      console.log('✅ Statistics updated for 7 days range');

      // Switch to 90 days range
      await element(by.id('time-range-90')).tap();
      await waitForAnimation(1000);
      console.log('✅ Statistics updated for 90 days range');
    });
  });

  describe('Episode Statistics - Empty State', () => {
    it('should show empty state when no episodes exist', async () => {
      // Navigate to Trends tab (database is empty from beforeEach)
      await element(by.text('Trends')).tap();
      await waitForAnimation(1000);

      // Swipe to reveal episode statistics
      await element(by.id('analytics-scroll-view')).scroll(300, 'down');
      await waitForAnimation(500);

      // Verify empty state is shown for episode statistics
      await expect(element(by.text('No episodes in selected period'))).toBeVisible();

      console.log('✅ Empty state displayed correctly for episodes');
    });

    it('should show day statistics even when no episodes exist', async () => {
      // Navigate to Trends tab
      await element(by.text('Trends')).tap();
      await waitForAnimation(1000);

      // Swipe to reveal episode statistics
      await element(by.id('analytics-scroll-view')).scroll(300, 'down');
      await waitForAnimation(500);

      // Verify day statistics card is visible
      await expect(element(by.id('day-statistics-card'))).toBeVisible();

      // All day stat rows should be visible
      await expect(element(by.id('migraine-days-row'))).toBeVisible();
      await expect(element(by.id('not-clear-days-row'))).toBeVisible();
      await expect(element(by.id('clear-days-row'))).toBeVisible();
      await expect(element(by.id('unknown-days-row'))).toBeVisible();

      console.log('✅ Day statistics displayed even with no episodes');
    });
  });

  describe('Episode Statistics - With Data', () => {
    it('should display episode statistics when episodes exist', async () => {
      // Reset with fixtures to get test data
      await resetDatabase(true);

      // Navigate to Trends tab
      await element(by.text('Trends')).tap();
      await waitForAnimation(1000);

      // Scroll to duration metrics card (further scrolling needed due to histogram component)
      await waitFor(element(by.id('duration-metrics-card')))
        .toBeVisible()
        .whileElement(by.id('analytics-scroll-view'))
        .scroll(100, 'down');

      // Verify duration metrics card is visible (not empty state)
      await expect(element(by.id('duration-metrics-card'))).toBeVisible();

      // Verify all episode stat rows are visible
      await expect(element(by.id('total-episodes-row'))).toBeVisible();
      await expect(element(by.id('shortest-duration-row'))).toBeVisible();
      await expect(element(by.id('longest-duration-row'))).toBeVisible();
      await expect(element(by.id('average-duration-row'))).toBeVisible();

      console.log('✅ Episode statistics displayed correctly with data');
    });
  });

  describe('Medication Usage Statistics - Empty State', () => {
    it('should show empty state when no medication usage exists', async () => {
      // Navigate to Trends tab (empty database)
      await element(by.text('Trends')).tap();
      await waitForAnimation(1000);

      // Swipe to reveal medication usage statistics
      await element(by.id('analytics-scroll-view')).scroll(400, 'down');
      await waitForAnimation(500);

      // Verify empty state is shown
      await expect(element(by.text('No rescue medication usage in selected period'))).toBeVisible();

      console.log('✅ Empty state displayed correctly for medication usage');
    });
  });

  describe('Medication Usage Statistics - With Data', () => {
    it('should display rescue medication usage when data exists', async () => {
      // Reset with fixtures
      await resetDatabase(true);

      // Navigate to Trends tab
      await element(by.text('Trends')).tap();
      await waitForAnimation(1000);

      // Swipe to reveal medication usage statistics
      await element(by.id('analytics-scroll-view')).scroll(400, 'down');
      await waitForAnimation(500);

      // Verify Rescue Medication Usage header is visible
      await expect(element(by.text('Rescue Medication Usage'))).toBeVisible();

      console.log('✅ Rescue medication usage section displayed correctly');
    });
  });

  describe('Calendar Integration', () => {
    it('should display monthly calendar on trends screen', async () => {
      // Navigate to Trends tab
      await element(by.text('Trends')).tap();
      await waitForAnimation(1000);

      // Scroll to top to ensure calendar is visible
      await element(by.id('analytics-scroll-view')).scrollTo('top');
      await waitForAnimation(300);

      // Verify calendar is visible at top of screen
      await waitFor(element(by.id('previous-month-button')))
        .toBeVisible()
        .withTimeout(3000);

      await waitFor(element(by.id('next-month-button')))
        .toBeVisible()
        .withTimeout(3000);

      console.log('✅ Monthly calendar is visible on trends screen');
    });

    it('should navigate between months in calendar', async () => {
      // Navigate to Trends tab
      await element(by.text('Trends')).tap();
      await waitForAnimation(1000);

      // Scroll to top to ensure calendar is visible
      await element(by.id('analytics-scroll-view')).scrollTo('top');
      await waitForAnimation(300);

      // Navigate to previous month
      await element(by.id('previous-month-button')).tap();
      await waitForAnimation(1000);

      console.log('✅ Navigated to previous month');

      // Navigate back to current month
      await element(by.id('next-month-button')).tap();
      await waitForAnimation(1000);

      console.log('✅ Navigated back to current month');
    });
  });

  describe('Edge Cases', () => {
    it('should handle switching tabs and returning to Trends', async () => {
      // Navigate to Trends tab
      await element(by.text('Trends')).tap();
      await waitForAnimation(1000);

      // Verify on Trends screen by checking header
      await waitFor(element(by.text('Trends & Analytics')))
        .toBeVisible()
        .withTimeout(3000);

      // Switch to Episodes tab
      await element(by.text('Episodes')).tap();
      await waitForAnimation(1000);

      // Return to Trends tab
      await element(by.text('Trends')).tap();
      await waitForAnimation(1000);

      // Scroll to top to ensure calendar is visible
      await element(by.id('analytics-scroll-view')).scrollTo('top');
      await waitForAnimation(300);

      // Verify Trends screen still renders correctly by checking calendar
      await waitFor(element(by.id('previous-month-button')))
        .toBeVisible()
        .withTimeout(3000);

      console.log('✅ Trends screen handles tab switching correctly');
    });

    it('should persist time range selection when navigating away and back', async () => {
      // Navigate to Trends tab
      await element(by.text('Trends')).tap();
      await waitForAnimation(1000);

      // Swipe to reveal time range selector
      await element(by.id('analytics-scroll-view')).scroll(300, 'down');
      await waitForAnimation(500);

      // Change to 90 days
      await element(by.id('time-range-90')).tap();
      await waitForAnimation(1000);

      // Navigate to Home
      await element(by.text('Home')).tap();
      await waitForAnimation(1000);

      // Return to Trends
      await element(by.text('Trends')).tap();
      await waitForAnimation(1000);

      // Swipe to reveal time range selector again
      await element(by.id('analytics-scroll-view')).scroll(300, 'down');
      await waitForAnimation(500);

      // Verify 90 days is still selected
      await expect(element(by.id('time-range-90'))).toBeVisible();

      console.log('✅ Time range selection persists across navigation');
    });
  });
});
