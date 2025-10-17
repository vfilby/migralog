/**
 * E2E Test Helper Functions
 */

/**
 * Reset the database to a clean state using deep links (FAST - ~2 seconds)
 * Uses secure token-based authentication to prevent unauthorized access
 * @param {boolean} withFixtures - If true, loads test data (medications, episodes)
 */
async function resetDatabase(withFixtures = false) {
  console.log(`[E2E] Resetting database via deep link (fixtures: ${withFixtures})...`);

  try {
    // Use special "detox" token for E2E testing
    // This is accepted by the deep link handler only in Debug/Testing builds
    const fixturesParam = withFixtures ? '&fixtures=true' : '';

    console.log('[E2E] Executing database reset...');
    await device.openURL({
      url: `migraine-tracker://test/reset?token=detox${fixturesParam}`
    });

    // Wait for reset to complete
    // This is much faster than UI navigation (~2s vs 15-25s)
    await waitForAnimation(2000);

    // Verify app is still responsive and dashboard is visible
    console.log('[E2E] Verifying app state after reset...');
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(10000); // Increased from 5s to 10s for reliability

    console.log('[E2E] ✅ Database reset complete via deep link');
  } catch (error) {
    console.error('[E2E] ❌ Deep link reset failed, falling back to UI navigation:', error);
    // Fallback to old UI-based reset if deep link fails
    await resetDatabaseViaUI(withFixtures);
  }
}

/**
 * Legacy database reset via UI navigation (SLOW - 15-25 seconds)
 * Used as fallback if deep link approach fails
 * @param {boolean} withFixtures - If true, loads test data
 */
async function resetDatabaseViaUI(withFixtures = false) {
  console.log('[E2E] Using legacy UI-based database reset (slow)...');

  // Step 1: Use deep link to navigate home (much more reliable than tapping buttons)
  console.log('[E2E] Using deep link to navigate to home...');
  try {
    await device.openURL({
      url: 'migraine-tracker://test/home?token=detox'
    });
    await waitForAnimation(1000);
    console.log('[E2E] Navigated to home via deep link');
  } catch (e) {
    console.warn('[E2E] Deep link home navigation failed, falling back to button taps');

    // Fallback: Try to tap buttons
    const modalDismissButtons = ['Cancel', '← Back', 'Done', 'Close'];
    for (const buttonText of modalDismissButtons) {
      try {
        await element(by.text(buttonText)).tap();
        await waitForAnimation(500);
        console.log(`[E2E] Dismissed modal by tapping: ${buttonText}`);
      } catch (err) {
        // Button not found, continue
      }
    }

    try {
      await element(by.text('Home')).tap();
      await waitForAnimation(1000);
      console.log('[E2E] Tapped Home tab');
    } catch (err) {
      console.log('[E2E] Could not tap Home tab, continuing...');
    }
  }

  // Step 2: Wait for dashboard to be visible
  console.log('[E2E] Waiting for dashboard to be visible...');
  let dashboardVisible = false;
  let attempt = 0;
  const maxAttempts = 3;

  while (!dashboardVisible && attempt < maxAttempts) {
    attempt++;
    console.log(`[E2E] Dashboard check attempt ${attempt}/${maxAttempts}`);

    try {
      await waitFor(element(by.id('dashboard-title')))
        .toBeVisible()
        .withTimeout(5000);
      dashboardVisible = true;
      console.log('[E2E] Dashboard is visible, app initialized successfully');
    } catch (e) {
      console.log(`[E2E] Dashboard not ready, retrying...`);
      await waitForAnimation(1000);
    }
  }

  if (!dashboardVisible) {
    throw new Error('Failed to initialize app - dashboard never became visible after 3 attempts');
  }

  // Navigate to Settings
  await waitFor(element(by.id('settings-button')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('settings-button')).tap();

  // Wait for Settings screen
  await waitFor(element(by.text('Settings')))
    .toBeVisible()
    .withTimeout(5000);

  // Scroll to reset button
  const buttonId = withFixtures ? 'reset-database-with-fixtures-button' : 'reset-database-button';
  try {
    await waitFor(element(by.id(buttonId)))
      .toBeVisible()
      .whileElement(by.id('settings-scroll-view'))
      .scroll(400, 'down');
  } catch (e) {
    await waitFor(element(by.id(buttonId)))
      .toBeVisible()
      .withTimeout(3000);
  }

  // Tap reset button
  await element(by.id(buttonId)).tap();
  await waitForAnimation(500);

  // Confirm
  const confirmButtonText = withFixtures ? 'Reset & Load' : 'Reset';
  await waitFor(element(by.text(confirmButtonText)))
    .toBeVisible()
    .withTimeout(3000);
  await element(by.text(confirmButtonText)).tap();

  // Wait for success
  let successAlertVisible = false;
  let resetAttempt = 0;
  while (!successAlertVisible && resetAttempt < 5) {
    resetAttempt++;
    try {
      await waitFor(element(by.text('OK')))
        .toBeVisible()
        .withTimeout(3000);
      successAlertVisible = true;
    } catch (e) {
      await waitForAnimation(2000);
    }
  }

  if (!successAlertVisible) {
    throw new Error('Database reset did not complete');
  }

  // Dismiss and return to dashboard
  await element(by.text('OK')).tap();
  await waitForAnimation(500);
  await element(by.text('Done')).tap();
  await waitForAnimation(1000);

  // Verify dashboard
  await waitFor(element(by.id('dashboard-title')))
    .toBeVisible()
    .withTimeout(5000);

  await waitForAnimation(3000); // Store reload time
  console.log('[E2E] Database reset complete via UI');
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

/**
 * Disable animations in the iOS simulator for faster test execution
 * Sets FBSAnimationDragCoefficient to 0.0 which effectively disables all animations
 * This speeds up tests by removing animation wait times
 */
async function disableAnimations() {
  const { execSync } = require('child_process');
  try {
    console.log('[E2E] Disabling animations in simulator...');
    execSync('xcrun simctl spawn booted defaults write com.apple.SpringBoard FBSAnimationDragCoefficient -float 0.0');
    console.log('[E2E] ✅ Animations disabled');
  } catch (error) {
    console.warn('[E2E] ⚠️  Could not disable animations:', error.message);
  }
}

/**
 * Enable animations in the iOS simulator (restore normal behavior)
 * Removes the FBSAnimationDragCoefficient setting to restore default animation speed
 */
async function enableAnimations() {
  const { execSync } = require('child_process');
  try {
    console.log('[E2E] Enabling animations in simulator...');
    execSync('xcrun simctl spawn booted defaults delete com.apple.SpringBoard FBSAnimationDragCoefficient');
    console.log('[E2E] ✅ Animations enabled');
  } catch (error) {
    console.warn('[E2E] ⚠️  Could not enable animations:', error.message);
  }
}

module.exports = {
  resetDatabase,
  scrollToElement,
  scrollToText,
  waitForAnimation,
  disableAnimations,
  enableAnimations,
};
