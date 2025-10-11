const { resetDatabase } = require('./helpers');

/**
 * Database Reset Test
 * Tests that the database reset helper function works correctly
 */
describe('Database Reset', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should reset database successfully', async () => {
    // Reset database
    await resetDatabase();

    // Verify we're on dashboard
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(3000);

    // Verify start episode button is visible (no active episode)
    await waitFor(element(by.id('start-episode-button')))
      .toBeVisible()
      .withTimeout(3000);

    console.log('Database reset test passed!');
  });
});
