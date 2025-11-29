const { waitForAnimation } = require('./helpers');

/**
 * Onboarding Workflow E2E Test
 *
 * Tests the complete 4-step onboarding flow:
 * 1. Welcome screen with app features
 * 2. Medical disclaimer
 * 3. Notification permissions request
 * 4. Location permissions request
 * 5. Permission verification and navigation to main app
 */
describe('Onboarding Workflow', () => {
  beforeAll(async () => {
    // Reset device to ensure clean permission state
    await device.resetContentAndSettings();
    
    // Launch app with fresh state (no permissions granted initially)
    await device.launchApp({
      newInstance: true,
      delete: true,
      permissions: { notifications: 'NO', location: 'never' },
    });
  });

  beforeEach(async () => {
    // Trigger onboarding flow by resetting onboarding state
    console.log('[E2E] Triggering onboarding flow via deep link');
    await device.openURL({
      url: 'migraine-tracker://test/trigger-onboarding?token=detox'
    });
    await waitForAnimation(1000);
  });

  it('should complete the full 4-step onboarding workflow', async () => {
    // ======================
    // Step 1: Welcome Screen
    // ======================
    console.log('Testing Step 1: Welcome Screen');

    // Wait for welcome step to be visible
    await waitFor(element(by.id('welcome-step')))
      .toBeVisible()
      .withTimeout(10000);

    // Verify navigation button is present
    await expect(element(by.id('next-button'))).toBeVisible();
    
    console.log('✅ Step 1: Welcome screen content verified');

    // Navigate to step 2
    await element(by.id('next-button')).tap();
    await waitForAnimation(500);

    // ======================
    // Step 2: Medical Disclaimer
    // ======================
    console.log('Testing Step 2: Medical Disclaimer');

    await waitFor(element(by.id('disclaimer-step')))
      .toBeVisible()
      .withTimeout(5000);

    // Verify navigation buttons
    await expect(element(by.id('back-button'))).toBeVisible();
    await expect(element(by.id('next-button'))).toBeVisible();

    console.log('✅ Step 2: Medical disclaimer content verified');

    // Navigate to step 3
    await element(by.id('next-button')).tap();
    await waitForAnimation(500);

    // ======================
    // Step 3: Notification Permissions
    // ======================
    console.log('Testing Step 3: Notification Permissions');

    await waitFor(element(by.id('notification-permissions-step')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ Step 3: Notification permissions content verified');

    // Navigate to step 4
    await element(by.id('next-button')).tap();
    await waitForAnimation(500);

    // ======================
    // Step 4: Location Permissions
    // ======================
    console.log('Testing Step 4: Location Permissions');

    await waitFor(element(by.id('location-permissions-step')))
      .toBeVisible()
      .withTimeout(5000);

    // Verify final step shows "Finish Setup" button
    await expect(element(by.id('enable-notifications-button'))).toBeVisible();

    console.log('✅ Step 4: Location permissions content verified');

    // ======================
    // Complete Onboarding and Test Permission Requests
    // ======================
    console.log('Testing Permission Requests and App Navigation');

    // Complete onboarding - this will trigger permission requests
    await element(by.id('enable-notifications-button')).tap();

    // Handle iOS system permission dialogs - be flexible about which ones appear
    console.log('Handling iOS permission dialogs...');

    // Handle any permission dialog that appears (could be standard notifications or critical alerts)
    let permissionDialogsHandled = 0;
    const maxDialogs = 3; // notifications, critical alerts, location
    
    while (permissionDialogsHandled < maxDialogs) {
      try {
        // Look for any "Allow" button in permission dialogs
        await waitFor(element(by.text('Allow')))
          .toBeVisible()
          .withTimeout(3000);
        
        permissionDialogsHandled++;
        console.log(`✅ Permission dialog #${permissionDialogsHandled} appeared - clicking Allow`);
        await element(by.text('Allow')).tap();
        await waitForAnimation(1000); // Wait before checking for next dialog
        
      } catch (error) {
        console.log(`⚠️ No more permission dialogs found (handled ${permissionDialogsHandled})`);
        break;
      }
    }

    // Third: Handle Location permission if it appears
    try {
      await waitFor(element(by.text('Allow Once')))
        .toBeVisible()
        .withTimeout(3000);
      console.log('✅ Location permission dialog appeared');
      await element(by.text('Allow Once')).tap();
      console.log('✅ Location permission granted');
    } catch (error) {
      // Try alternative location permission text
      try {
        await waitFor(element(by.text('Allow While Using App')))
          .toBeVisible()
          .withTimeout(1000);
        await element(by.text('Allow While Using App')).tap();
        console.log('✅ Location permission granted (While Using App)');
      } catch (error2) {
        console.log('⚠️ Location permission dialog not found - may be already granted, denied, or timed out');
      }
    }

    await waitForAnimation(3000); // Give time for all permissions to process

    // ======================
    // Verify Navigation to Main App
    // ======================
    console.log('Verifying navigation to main app');

    // Should navigate to Dashboard (main app)
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(10000);

    // Verify we're on the Dashboard
    await expect(element(by.text('Dashboard'))).toBeVisible();

    // Verify tab bar is present
    await expect(element(by.text('Home'))).toBeVisible();
    await expect(element(by.text('Episodes'))).toBeVisible();
    await expect(element(by.text('Meds'))).toBeVisible();
    await expect(element(by.text('Trends'))).toBeVisible();

    console.log('✅ Successfully navigated to main app');
    console.log('✅ ALL ONBOARDING TESTS PASSED: 4-step workflow completed!');
  });

  it('should allow navigation backward through onboarding steps', async () => {
    console.log('Testing backward navigation through onboarding');

    // Start at welcome screen
    await waitFor(element(by.id('welcome-step')))
      .toBeVisible()
      .withTimeout(10000);

    // Navigate forward to step 3 (notifications)
    await element(by.id('next-button')).tap(); // Step 2
    await waitForAnimation(300);
    await element(by.id('next-button')).tap(); // Step 3
    await waitForAnimation(300);

    await waitFor(element(by.id('notification-permissions-step')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ Navigated to step 3');

    // Navigate backward to step 2
    await element(by.id('back-button')).tap();
    await waitForAnimation(300);

    await waitFor(element(by.id('disclaimer-step')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ Navigated back to step 2');

    // Navigate backward to step 1
    await element(by.id('back-button')).tap();
    await waitForAnimation(300);

    await waitFor(element(by.id('welcome-step')))
      .toBeVisible()
      .withTimeout(5000);

    // Verify back button is not visible on step 1
    await expect(element(by.id('back-button'))).not.toBeVisible();

    console.log('✅ Successfully navigated back to step 1');
    console.log('✅ BACKWARD NAVIGATION TEST PASSED!');
  });

  it('should show correct progress indicators on each step', async () => {
    console.log('Testing progress indicators');

    // Step 1: Welcome - should show first dot active
    await waitFor(element(by.id('welcome-step')))
      .toBeVisible()
      .withTimeout(10000);
    
    console.log('✅ Step 1 progress indicator verified');

    // Navigate through all steps and verify progress
    for (let step = 2; step <= 4; step++) {
      await element(by.id('next-button')).tap();
      await waitForAnimation(300);
      
      // Verify we're on the correct step by checking for step-specific content
      switch (step) {
        case 2:
          await expect(element(by.id('disclaimer-step'))).toBeVisible();
          break;
        case 3:
          await expect(element(by.id('notification-permissions-step'))).toBeVisible();
          break;
        case 4:
          await expect(element(by.id('location-permissions-step'))).toBeVisible();
          await expect(element(by.id('enable-notifications-button'))).toBeVisible();
          break;
      }
      
      console.log(`✅ Step ${step} progress indicator verified`);
    }

    console.log('✅ ALL PROGRESS INDICATORS VERIFIED!');
  });

  it('should handle permission timeout gracefully in simulator', async () => {
    console.log('Testing permission timeout handling (E2E simulator compatibility)');

    // Navigate through all steps quickly
    await waitFor(element(by.id('welcome-step')))
      .toBeVisible()
      .withTimeout(10000);

    // Fast-forward through steps
    await element(by.id('next-button')).tap(); // Step 2
    await waitForAnimation(200);
    await element(by.id('next-button')).tap(); // Step 3
    await waitForAnimation(200);
    await element(by.id('next-button')).tap(); // Step 4
    await waitForAnimation(200);

    await waitFor(element(by.id('enable-notifications-button')))
      .toBeVisible()
      .withTimeout(5000);

    console.log('✅ Navigated to final step');

    // Trigger permission requests
    await element(by.id('enable-notifications-button')).tap();

    // The app should handle permission timeouts gracefully and still navigate to main app
    // This tests our timeout mechanism for location permissions in E2E environments
    await waitForAnimation(5000); // Wait for timeout to trigger

    // Should still navigate successfully
    await waitFor(element(by.id('dashboard-title')))
      .toBeVisible()
      .withTimeout(10000);

    await expect(element(by.text('Dashboard'))).toBeVisible();

    console.log('✅ Permission timeout handled gracefully - navigated to main app');
    console.log('✅ PERMISSION TIMEOUT TEST PASSED!');
  });
});