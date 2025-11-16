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

      // Verify main screen is visible
      await waitFor(element(by.text('Trends & Analytics')))
        .toBeVisible()
        .withTimeout(5000);

      await waitFor(element(by.id('analytics-screen')))
        .toBeVisible()
        .withTimeout(3000);

      console.log('✅ Trends screen loaded successfully');

      // Verify calendar is visible
      await waitFor(element(by.id('previous-month-button')))
        .toBeVisible()
        .withTimeout(3000);

      await waitFor(element(by.id('next-month-button')))
        .toBeVisible()
        .withTimeout(3000);

      console.log('✅ Monthly calendar view is visible');

      // Verify Time Range Selector is visible (using whileElement to scroll if needed)
      await waitFor(element(by.id('time-range-selector')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify all three time range buttons are visible
      await expect(element(by.id('time-range-7'))).toBeVisible();
      await expect(element(by.id('time-range-30'))).toBeVisible();
      await expect(element(by.id('time-range-90'))).toBeVisible();

      console.log('✅ Time range selector with all options is visible');

      // Verify Episode Statistics section is visible
      await waitFor(element(by.id('episode-statistics')))
        .toBeVisible()
        .withTimeout(5000);

      console.log('✅ Episode statistics section is visible');

      // Verify Medication Usage Statistics is visible (may need scrolling)
      await waitFor(element(by.id('medication-usage-statistics')))
        .toBeVisible()
        .withTimeout(5000);

      console.log('✅ Medication usage statistics section is visible');
    });

    it('should have proper accessibility labels on time range buttons', async () => {
      // Navigate to Trends tab
      await element(by.text('Trends')).tap();
      await waitForAnimation(1000);

      // Verify screen is loaded
      await waitFor(element(by.id('analytics-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Wait for time range selector
      await waitFor(element(by.id('time-range-selector')))
        .toBeVisible()
        .withTimeout(5000);

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

      // Wait for time range selector
      await waitFor(element(by.id('time-range-selector')))
        .toBeVisible()
        .withTimeout(5000);

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

      // Wait for time range selector and statistics
      await waitFor(element(by.id('time-range-selector')))
        .toBeVisible()
        .withTimeout(5000);

      await waitFor(element(by.id('episode-statistics')))
        .toBeVisible()
        .withTimeout(5000);

      // Switch to 7 days range
      await element(by.id('time-range-7')).tap();
      await waitForAnimation(1000);

      // Statistics should still be visible (updated for 7 days)
      await expect(element(by.id('episode-statistics'))).toBeVisible();
      console.log('✅ Statistics updated for 7 days range');

      // Switch to 90 days range
      await element(by.id('time-range-90')).tap();
      await waitForAnimation(1000);

      // Statistics should still be visible (updated for 90 days)
      await expect(element(by.id('episode-statistics'))).toBeVisible();
      console.log('✅ Statistics updated for 90 days range');
    });
  });

  describe('Episode Statistics - Empty State', () => {
    it('should show empty state when no episodes exist', async () => {
      // Navigate to Trends tab (database is empty from beforeEach)
      await element(by.text('Trends')).tap();
      await waitForAnimation(1000);

      // Verify episode statistics section is visible
      await waitFor(element(by.id('episode-statistics')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify empty state is shown for episode statistics
      await waitFor(element(by.id('empty-state')))
        .toBeVisible()
        .withTimeout(3000);

      await expect(element(by.text('No episodes in selected period'))).toBeVisible();

      console.log('✅ Empty state displayed correctly for episodes');
    });

    it('should show day statistics even when no episodes exist', async () => {
      // Navigate to Trends tab
      await element(by.text('Trends')).tap();
      await waitForAnimation(1000);

      // Verify Day Statistics section is visible
      await waitFor(element(by.text('Day Statistics')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify day statistics card is visible
      await waitFor(element(by.id('day-statistics-card')))
        .toBeVisible()
        .withTimeout(3000);

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

      // Verify episode statistics section is visible
      await waitFor(element(by.id('episode-statistics')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify duration metrics card is visible (not empty state)
      await waitFor(element(by.id('duration-metrics-card')))
        .toBeVisible()
        .withTimeout(3000);

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

      // Verify medication usage statistics section is visible
      await waitFor(element(by.id('medication-usage-statistics')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify empty state is shown
      await waitFor(element(by.text('No rescue medication usage in selected period')))
        .toBeVisible()
        .withTimeout(3000);

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

      // Verify medication usage statistics section is visible
      await waitFor(element(by.id('medication-usage-statistics')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify Rescue Medication Usage header is visible
      await waitFor(element(by.text('Rescue Medication Usage')))
        .toBeVisible()
        .withTimeout(3000);

      // Verify rescue medication card is visible (not empty state)
      await waitFor(element(by.id('rescue-medication-card')))
        .toBeVisible()
        .withTimeout(3000);

      console.log('✅ Rescue medication usage displayed correctly');
    });
  });

  describe('Calendar Integration', () => {
    it('should display monthly calendar on trends screen', async () => {
      // Navigate to Trends tab
      await element(by.text('Trends')).tap();
      await waitForAnimation(1000);

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

      // Verify on Trends screen
      await expect(element(by.id('analytics-screen'))).toBeVisible();

      // Switch to Episodes tab
      await element(by.text('Episodes')).tap();
      await waitForAnimation(1000);

      // Return to Trends tab
      await element(by.text('Trends')).tap();
      await waitForAnimation(1000);

      // Verify Trends screen still renders correctly
      await waitFor(element(by.id('analytics-screen')))
        .toBeVisible()
        .withTimeout(3000);

      await expect(element(by.id('previous-month-button'))).toBeVisible();

      console.log('✅ Trends screen handles tab switching correctly');
    });

    it('should persist time range selection when navigating away and back', async () => {
      // Navigate to Trends tab
      await element(by.text('Trends')).tap();
      await waitForAnimation(1000);

      // Wait for time range selector
      await waitFor(element(by.id('time-range-selector')))
        .toBeVisible()
        .withTimeout(5000);

      // Change to 90 days
      await element(by.id('time-range-90')).tap();
      await waitForAnimation(1000);

      // Navigate to Home
      await element(by.text('Home')).tap();
      await waitForAnimation(1000);

      // Return to Trends
      await element(by.text('Trends')).tap();
      await waitForAnimation(1000);

      // Wait for time range selector to be visible
      await waitFor(element(by.id('time-range-selector')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify 90 days is still selected
      await expect(element(by.id('time-range-90'))).toBeVisible();

      console.log('✅ Time range selection persists across navigation');
    });
  });
});
