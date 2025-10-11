const { resetDatabase, waitForAnimation } = require('./helpers');

/**
 * Simple Log Update Test
 *
 * Tests if the Log Update button works immediately after creating an episode
 */
describe('Log Update Navigation Test', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it('should navigate to Log Update screen', async () => {
    // Create an episode
    await waitFor(element(by.id('start-episode-button')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('start-episode-button')).tap();
    await waitForAnimation(1000);

    await waitFor(element(by.text('Cancel')))
      .toBeVisible()
      .withTimeout(5000);

    // Save with defaults
    await element(by.id('new-episode-scroll-view')).scrollTo('bottom');
    await waitForAnimation(500);

    await element(by.id('save-episode-button')).tap();
    await waitForAnimation(1500);

    // Should be back on dashboard
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(5000);

    // Tap active episode card
    await waitFor(element(by.id('active-episode-card')))
      .toBeVisible()
      .withTimeout(3000);

    await element(by.id('active-episode-card')).tap();
    await waitForAnimation(1000);

    // Should be on Episode Detail screen
    await waitFor(element(by.text('Episode Details')))
      .toBeVisible()
      .withTimeout(3000);

    console.log('On Episode Details screen');

    // Scroll to top
    await element(by.id('episode-detail-scroll-view')).scrollTo('top');
    await waitForAnimation(1000);

    // Find and tap Log Update button
    await waitFor(element(by.id('log-update-button')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('Found Log Update button');

    await element(by.id('log-update-button')).tap();

    console.log('Tapped Log Update button');

    await waitForAnimation(2500);

    // Check if Log Update screen opened
    await waitFor(element(by.text('Log Update')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('SUCCESS: Log Update screen opened!');

    // If we got here, it worked!
    expect(element(by.text('Log Update'))).toBeVisible();
  });
});
