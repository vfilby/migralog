/**
 * E2E test to capture screenshots for GitHub issue #116 - Skipped Doses UI
 *
 * This test demonstrates the fixes for three UI problems:
 * 1. 7-day timeline shows red indicators for skipped doses
 * 2. History section shows "Skipped" text instead of "0 × dose"
 * 3. Episode timeline only shows rescue medications
 */

const { waitForAnimation } = require('./helpers');

describe('GitHub Issue #116 - Skipped Doses Screenshots', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('should load skipped doses test data and capture screenshots', async () => {
    console.log('\n========================================');
    console.log('GH #116: Loading skipped doses test data');
    console.log('========================================\n');

    // Use deep link to load skipped doses fixtures
    await device.openURL({
      url: 'migraine-tracker://test/skipped-doses?token=detox'
    });

    // Wait for data to load and navigation to complete
    await waitForAnimation(3000);

    // Verify we're on Dashboard
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(10000);

    console.log('✅ Data loaded, navigating to Medications tab');

    // Navigate to Medications tab
    await element(by.text('Meds')).tap();
    await waitForAnimation(2000);

    // Take screenshot of medications list
    await device.takeScreenshot('gh-116-01-medications-list');
    console.log('📸 Screenshot 1: Medications list');

    // Tap on "Test Preventative" medication
    await waitFor(element(by.text('Test Preventative')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.text('Test Preventative')).tap();
    await waitForAnimation(2000);

    // Verify we're on the medication detail screen
    await waitFor(element(by.text('Medication Details')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ On Medication Detail screen');

    // Take screenshot showing the 7-day timeline at the top
    await device.takeScreenshot('gh-116-02-seven-day-timeline');
    console.log('📸 Screenshot 2: 7-day timeline (red indicators for skipped days)');

    // Scroll down to see the Recent Activity section
    try {
      await element(by.id('medication-detail-scrollview')).scrollTo('bottom');
    } catch (e) {
      // If scrollview ID doesn't exist, try scrolling on the main content
      console.log('Could not find scrollview, trying alternative scroll method');
    }

    await waitForAnimation(1000);

    // Take screenshot showing Recent Activity with "Skipped" text
    await device.takeScreenshot('gh-116-03-recent-activity');
    console.log('📸 Screenshot 3: Recent Activity (showing "Skipped" text)');

    // Scroll to middle position for comprehensive view
    try {
      await element(by.id('medication-detail-scrollview')).scroll(300, 'up');
    } catch (e) {
      // Ignore if scroll fails
    }

    await waitForAnimation(500);

    // Take final comprehensive screenshot
    await device.takeScreenshot('gh-116-04-full-view');
    console.log('📸 Screenshot 4: Full medication detail view');

    console.log('\n========================================');
    console.log('✅ Screenshots captured successfully!');
    console.log('Check artifacts folder for:');
    console.log('  - gh-116-01-medications-list.png');
    console.log('  - gh-116-02-seven-day-timeline.png');
    console.log('  - gh-116-03-recent-activity.png');
    console.log('  - gh-116-04-full-view.png');
    console.log('========================================\n');
  });
});
