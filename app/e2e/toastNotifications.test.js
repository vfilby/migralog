const { resetDatabase, waitForAnimation } = require('./helpers');

/**
 * Toast Notification E2E Tests
 *
 * Verifies that toast notifications appear for user actions.
 * This demonstrates the error handling infrastructure is working end-to-end.
 */
describe('Toast Notifications', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    // Reset database with test data
    await resetDatabase({ includeFixtures: true });
  });

  it('should show success toast when starting episode', async () => {
    // Verify we're on Dashboard
    await waitFor(element(by.id('dashboard-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Tap Start Episode button
    await element(by.id('start-episode-button')).tap();
    await waitForAnimation(1000);

    // Save episode with default values
    await element(by.id('save-episode-button')).tap();
    await waitForAnimation(1000);

    // Verify success toast appears
    // This confirms:
    // 1. Toast service is working
    // 2. Store integration is correct
    // 3. UI renders toast notifications
    await waitFor(element(by.text('Episode started')))
      .toBeVisible()
      .withTimeout(3000);
  });
});
