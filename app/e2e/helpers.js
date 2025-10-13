/**
 * E2E Test Helper Functions
 */

/**
 * Reset the database to a clean state
 * This navigates to Settings and uses the Reset Database feature
 * @param {boolean} withFixtures - If true, loads test data (medications, episodes)
 */
async function resetDatabase(withFixtures = false) {
  // Ensure we're on the dashboard and any modals are dismissed
  try {
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(3000);
  } catch (e) {
    console.log('Dashboard not visible, attempting to dismiss any modals');
    // Try to go back if we're in a modal
    try {
      await element(by.text('Close')).tap();
      await waitForAnimation(1000);
    } catch (e2) {
      // If no Close button, try Cancel
      try {
        await element(by.text('Cancel')).tap();
        await waitForAnimation(1000);
      } catch (e3) {
        console.log('Could not dismiss modal');
      }
    }

    // Try to navigate to Home tab if still not on Dashboard
    try {
      await element(by.text('Home')).tap();
      await waitForAnimation(1000);
    } catch (e4) {
      console.log('Could not navigate to Home tab');
    }
  }

  // Navigate to Settings
  await waitFor(element(by.id('settings-button')))
    .toBeVisible()
    .withTimeout(5000);

  await element(by.id('settings-button')).tap();

  // Wait for Settings screen to load
  await waitFor(element(by.text('Settings')))
    .toBeVisible()
    .withTimeout(5000);

  // Scroll down to Developer section to find Reset Database button
  const buttonId = withFixtures ? 'reset-database-with-fixtures-button' : 'reset-database-button';

  // Try to scroll to button, or just check if it's visible
  try {
    await waitFor(element(by.id(buttonId)))
      .toBeVisible()
      .whileElement(by.id('settings-scroll-view'))
      .scroll(400, 'down');
  } catch (e) {
    // If scroll fails, button might already be visible
    console.log('Scroll failed, checking if button is already visible');
    await waitFor(element(by.id(buttonId)))
      .toBeVisible()
      .withTimeout(3000);
  }

  // Tap the appropriate Reset Database button
  await element(by.id(buttonId)).tap();

  // Wait for the confirmation alert to appear
  await waitForAnimation(500);

  // Confirm the reset in the alert (tap "Reset" or "Reset & Load" button)
  const confirmButtonText = withFixtures ? 'Reset & Load' : 'Reset';
  await waitFor(element(by.text(confirmButtonText)))
    .toBeVisible()
    .withTimeout(3000);
  await element(by.text(confirmButtonText)).tap();

  // Wait for the database reset to complete (longer timeout for CI)
  await waitForAnimation(3000);

  // Dismiss the success alert (tap "OK" button) - wait for it to appear first
  await waitFor(element(by.text('OK')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.text('OK')).tap();

  // Go back to dashboard
  await element(by.text('Done')).tap();

  // Verify we're back on dashboard with clean state
  await waitFor(element(by.text('MigraLog')))
    .toBeVisible()
    .withTimeout(3000);

  await waitFor(element(by.id('dashboard-title')))
    .toBeVisible()
    .withTimeout(3000);

  // Wait for store to reload data after database reset
  // This needs to be long enough for:
  // 1. Dashboard to gain focus
  // 2. Store actions to fire (loadMedications, loadSchedules, loadRecentDoses)
  // 3. UI to update with new data
  await waitForAnimation(3000);
}

/**
 * Scroll to make an element visible
 * @param {string} elementId - The testID of the element to scroll to
 * @param {string} scrollViewTestID - The testID of the scroll view (required)
 * @param {number} pixels - Number of pixels to scroll per iteration (default 400)
 * @param {string} direction - 'down' or 'up' (default 'down')
 */
async function scrollToElement(elementId, scrollViewTestID = 'new-episode-scroll-view', pixels = 400, direction = 'down') {
  await waitFor(element(by.id(elementId)))
    .toBeVisible()
    .whileElement(by.id(scrollViewTestID))
    .scroll(pixels, direction);
}

/**
 * Scroll to make text visible
 * @param {string} text - The text to scroll to
 * @param {string} scrollViewTestID - The testID of the scroll view (required)
 * @param {number} pixels - Number of pixels to scroll per iteration (default 400)
 * @param {string} direction - 'down' or 'up' (default 'down')
 */
async function scrollToText(text, scrollViewTestID = 'episode-detail-scroll-view', pixels = 400, direction = 'down') {
  await waitFor(element(by.text(text)))
    .toBeVisible()
    .whileElement(by.id(scrollViewTestID))
    .scroll(pixels, direction);
}

/**
 * Wait for animation to complete
 * @param {number} milliseconds - Time to wait in ms (default 500)
 */
async function waitForAnimation(milliseconds = 500) {
  await new Promise(resolve => setTimeout(resolve, milliseconds));
}

module.exports = {
  resetDatabase,
  scrollToElement,
  scrollToText,
  waitForAnimation,
};
