const { resetDatabase } = require('./helpers');

/**
 * Start Episode Button Test
 * Tests that tapping the start episode button opens the modal
 */
describe('Start Episode Button', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should open start episode modal when button is tapped', async () => {
    // Reset database to ensure no active episode
    await resetDatabase();

    // Verify start episode button is visible
    await waitFor(element(by.id('start-episode-button')))
      .toBeVisible()
      .withTimeout(3000);

    console.log('Found start episode button');

    // Tap the button
    await element(by.id('start-episode-button')).tap();

    console.log('Tapped start episode button');

    // Wait a bit for modal to appear
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Try to find any text that should be on the New Episode screen
    try {
      await expect(element(by.text('Start Episode'))).toBeVisible();
      console.log('Found "Start Episode" text - SUCCESS!');
    } catch (e) {
      console.log('Could not find "Start Episode" text');

      // Try looking for the Cancel button instead
      try {
        await expect(element(by.text('Cancel'))).toBeVisible();
        console.log('Found "Cancel" button instead');
      } catch (e2) {
        console.log('Could not find Cancel button either');
        throw e;
      }
    }
  });
});
