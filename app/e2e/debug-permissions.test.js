const { waitForAnimation } = require('./helpers');

/**
 * DEBUG: Simple onboarding permission test
 * Let's test just the permission flow step by step
 */
describe('DEBUG: Onboarding Permissions', () => {
  beforeAll(async () => {
    console.log('[DEBUG] Starting fresh app...');
    await device.launchApp({
      newInstance: true,
      delete: true,
      permissions: { notifications: 'NO', location: 'never' },
    });
  });

  beforeEach(async () => {
    console.log('[DEBUG] App should naturally start at onboarding with fresh install');
    // No deep link needed - fresh app starts at welcome screen
    await waitForAnimation(2000);
  });

  it('should navigate to final step and handle permissions', async () => {
    console.log('[DEBUG] Step 1: Navigate through onboarding slowly');
    
    // Step 1: Welcome
    console.log('[DEBUG] Starting from welcome step...');
    await waitFor(element(by.id('welcome-step')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('next-button')).tap();
    await waitForAnimation(1000); // Slow down
    
    // Step 2: Disclaimer  
    console.log('[DEBUG] On disclaimer step...');
    await waitFor(element(by.text('Medical Disclaimer')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.text('Continue')).tap();
    await waitForAnimation(2000); // Wait longer for permission request
    
    // Step 3: Notifications
    console.log('[DEBUG] On notification permissions step...');
    await waitFor(element(by.text('Enable Notifications')))
      .toBeVisible()
      .withTimeout(5000);
    
    console.log('[DEBUG] About to tap Continue on notifications step - this should trigger notification permissions...');
    await element(by.text('Continue')).tap();
    
    // Handle notification permission dialogs
    console.log('[DEBUG] Looking for notification permission dialog...');
    try {
      await waitFor(element(by.text('Allow')))
        .toBeVisible()
        .withTimeout(5000);
      console.log('[DEBUG] ✅ Found notification permission dialog');
      await element(by.text('Allow')).tap();
      console.log('[DEBUG] ✅ Clicked Allow on notification permission');
      
      // Wait for potential second dialog (Critical Alerts)
      try {
        await waitFor(element(by.text('Allow')))
          .toBeVisible()
          .withTimeout(3000);
        console.log('[DEBUG] ✅ Found critical alerts permission dialog');
        await element(by.text('Allow')).tap();
        console.log('[DEBUG] ✅ Clicked Allow on critical alerts permission');
      } catch (error) {
        console.log('[DEBUG] No second permission dialog found');
      }
    } catch (error) {
      console.log('[DEBUG] ⚠️ No notification permission dialog found:', error.message);
    }
    
    await waitForAnimation(2000); // Wait for permissions to process

    // Step 4: Location (final step)
    console.log('[DEBUG] Verify we are on final step (location)');
    await waitFor(element(by.text('Location Services')))
      .toBeVisible()
      .withTimeout(10000);

    await expect(element(by.text('Finish Setup'))).toBeVisible();
    console.log('[DEBUG] ✅ Reached final step successfully');

    console.log('[DEBUG] Step 3: Tap "Finish Setup" button - this should trigger location permissions...');
    await element(by.text('Finish Setup')).tap();
    
    // Give more time for the tap to register
    await waitForAnimation(2000);

    console.log('[DEBUG] Step 4: Looking for permission dialogs...');
    
    // Let's see what happens - just wait and log
    await waitForAnimation(2000);
    
    console.log('[DEBUG] Step 5: Checking for any permission dialog...');
    
    // Simple check for Allow button
    try {
      await waitFor(element(by.text('Allow')))
        .toBeVisible()
        .withTimeout(8000);
      console.log('[DEBUG] ✅ FOUND Permission dialog with Allow button!');
      
      // Take screenshot to see what we have
      await device.takeScreenshot('permission-dialog-found');
      
      // Click Allow
      await element(by.text('Allow')).tap();
      console.log('[DEBUG] ✅ Clicked Allow on first dialog');
      
      await waitForAnimation(2000);
      
      // Check for second dialog
      try {
        await waitFor(element(by.text('Allow')))
          .toBeVisible()
          .withTimeout(5000);
        console.log('[DEBUG] ✅ FOUND Second permission dialog!');
        
        await device.takeScreenshot('second-permission-dialog');
        
        await element(by.text('Allow')).tap();
        console.log('[DEBUG] ✅ Clicked Allow on second dialog');
      } catch (error) {
        console.log('[DEBUG] ⚠️ No second permission dialog found');
      }
      
    } catch (error) {
      console.log('[DEBUG] ❌ No permission dialogs found:', error.message);
    }

    console.log('[DEBUG] Step 6: Wait for app to settle...');
    await waitForAnimation(3000);

    console.log('[DEBUG] Step 7: Check if we navigated to main app...');
    try {
      await waitFor(element(by.id('dashboard-title')))
        .toBeVisible()
        .withTimeout(10000);
      console.log('[DEBUG] ✅ SUCCESS: Navigated to Dashboard!');
    } catch (error) {
      console.log('[DEBUG] ❌ Did not reach Dashboard:', error.message);
      await device.takeScreenshot('final-state');
    }
  });
});