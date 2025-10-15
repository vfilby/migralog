/**
 * E2E Test Helper Functions
 */

/**
 * Reset the database to a clean state
 * This navigates to Settings and uses the Reset Database feature
 * @param {boolean} withFixtures - If true, loads test data (medications, episodes)
 */
async function resetDatabase(withFixtures = false) {
  // Wait for app to fully initialize with a more robust approach
  // This includes: DB init, running migrations, store initialization, UI render
  // Migrations can take several seconds on first launch
  console.log('Waiting for app initialization (database, migrations, UI)...');

  // Use exponential backoff to wait for dashboard - app might take varying time to init
  let dashboardVisible = false;
  let attempt = 0;
  const maxAttempts = 10;

  while (!dashboardVisible && attempt < maxAttempts) {
    attempt++;
    console.log(`Dashboard check attempt ${attempt}/${maxAttempts}`);

    try {
      // Check if dashboard is visible with a reasonable timeout
      await waitFor(element(by.id('dashboard-title')))
        .toBeVisible()
        .withTimeout(5000);
      dashboardVisible = true;
      console.log('Dashboard is visible, app initialized successfully');
    } catch (e) {
      // Dashboard not visible yet, wait progressively longer
      const waitTime = Math.min(3000 * attempt, 10000); // 3s, 6s, 9s, max 10s
      console.log(`Dashboard not ready, waiting ${waitTime}ms before retry...`);
      await waitForAnimation(waitTime);

      // Try tapping Home tab in case we're on a different screen
      try {
        await element(by.text('Home')).tap();
        await waitForAnimation(500);
        console.log('Tapped Home tab');
      } catch (tapError) {
        console.log('Could not tap Home tab, continuing...');
      }
    }
  }

  if (!dashboardVisible) {
    throw new Error('Failed to initialize app - dashboard never became visible after 10 attempts');
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

  // Wait for the database reset to complete with retry logic
  console.log('Waiting for database reset to complete...');
  let successAlertVisible = false;
  let resetAttempt = 0;

  while (!successAlertVisible && resetAttempt < 5) {
    resetAttempt++;
    try {
      await waitFor(element(by.text('OK')))
        .toBeVisible()
        .withTimeout(3000);
      successAlertVisible = true;
      console.log('Database reset success alert appeared');
    } catch (e) {
      console.log(`Waiting for reset completion, attempt ${resetAttempt}/5...`);
      await waitForAnimation(2000);
    }
  }

  if (!successAlertVisible) {
    throw new Error('Database reset did not complete - success alert never appeared');
  }

  // Dismiss the success alert
  await element(by.text('OK')).tap();
  await waitForAnimation(500);

  // Go back to dashboard
  await element(by.text('Done')).tap();
  await waitForAnimation(1000);

  // Verify we're back on dashboard with clean state - use retry logic
  console.log('Verifying dashboard after reset...');
  let dashboardReady = false;
  let verifyAttempt = 0;

  while (!dashboardReady && verifyAttempt < 5) {
    verifyAttempt++;
    try {
      await waitFor(element(by.id('dashboard-title')))
        .toBeVisible()
        .withTimeout(3000);
      dashboardReady = true;
      console.log('Dashboard is ready after reset');
    } catch (e) {
      console.log(`Dashboard not ready after reset, attempt ${verifyAttempt}/5...`);
      await waitForAnimation(2000);
    }
  }

  if (!dashboardReady) {
    throw new Error('Dashboard did not become ready after database reset');
  }

  // Wait for store to reload data after database reset
  // This needs to be long enough for:
  // 1. Dashboard to gain focus
  // 2. Store actions to fire (loadMedications, loadSchedules, loadRecentDoses)
  // 3. UI to update with new data
  console.log('Waiting for store to reload data...');
  await waitForAnimation(3000);
  console.log('Database reset complete and store reloaded');
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
