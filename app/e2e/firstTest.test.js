describe('MigraineTracker E2E', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should show dashboard screen on launch', async () => {
    // Wait for the dashboard to load
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('should show Pain Tracker title', async () => {
    await expect(element(by.text('Pain Tracker'))).toBeVisible();
  });

  it('should have settings button', async () => {
    await expect(element(by.id('settings-button'))).toBeVisible();
  });
});
