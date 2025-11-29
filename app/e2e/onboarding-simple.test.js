const { waitForAnimation } = require('./helpers');

/**
 * Simple Onboarding Test - Focused on Navigation
 * Tests the core onboarding flow without complex permission handling
 */
describe('Onboarding Navigation', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      delete: true,
    });
  });

  beforeEach(async () => {
    console.log('[TEST] Triggering onboarding flow...');
    await device.openURL({
      url: 'migraine-tracker://test/trigger-onboarding?token=detox'
    });
    await waitForAnimation(2000);
  });

  it('should navigate through all 4 onboarding steps', async () => {
    console.log('[TEST] Starting onboarding navigation test');
    
    // Step 1: Welcome Screen
    console.log('[TEST] Step 1: Welcome screen');
    await waitFor(element(by.text('Welcome to MigraLog')))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.text('Continue'))).toBeVisible();
    console.log('[TEST] ✅ Welcome screen verified');
    
    await element(by.text('Continue')).tap();
    await waitForAnimation(1500);
    
    // Step 2: Medical Disclaimer
    console.log('[TEST] Step 2: Medical disclaimer');
    await waitFor(element(by.text('Medical Disclaimer')))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.text('Back'))).toBeVisible();
    await expect(element(by.text('Continue'))).toBeVisible();
    console.log('[TEST] ✅ Medical disclaimer verified');
    
    await element(by.text('Continue')).tap();
    await waitForAnimation(1500);
    
    // Step 3: Enable Notifications
    console.log('[TEST] Step 3: Enable notifications');
    await waitFor(element(by.text('Enable Notifications')))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.text('Back'))).toBeVisible();
    await expect(element(by.text('Continue'))).toBeVisible();
    console.log('[TEST] ✅ Enable notifications screen verified');
    
    await element(by.text('Continue')).tap();
    
    // Handle any permission dialogs that might appear
    console.log('[TEST] Handling potential permission dialogs...');
    try {
      // Look for notification permission
      await waitFor(element(by.text('Allow')))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.text('Allow')).tap();
      console.log('[TEST] ✅ Handled notification permission');
      
      // Check for critical alerts
      try {
        await waitFor(element(by.text('Allow')))
          .toBeVisible()
          .withTimeout(2000);
        await element(by.text('Allow')).tap();
        console.log('[TEST] ✅ Handled critical alerts permission');
      } catch (e) {
        console.log('[TEST] No critical alerts dialog');
      }
    } catch (error) {
      console.log('[TEST] No permission dialogs appeared (may be cached)');
    }
    
    await waitForAnimation(2000);
    
    // Step 4: Location Services
    console.log('[TEST] Step 4: Location services');
    await waitFor(element(by.text('Location Services')))
      .toBeVisible()
      .withTimeout(8000);
    await expect(element(by.text('Back'))).toBeVisible();
    await expect(element(by.text('Finish Setup'))).toBeVisible();
    console.log('[TEST] ✅ Location services screen verified');
    
    // Complete onboarding
    await element(by.text('Finish Setup')).tap();
    
    // Handle location permission if it appears
    try {
      await waitFor(element(by.text('Allow Once')))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.text('Allow Once')).tap();
      console.log('[TEST] ✅ Handled location permission');
    } catch (error) {
      console.log('[TEST] No location permission dialog');
    }
    
    await waitForAnimation(3000);
    
    // Verify we reached the main app
    console.log('[TEST] Verifying completion...');
    await waitFor(element(by.text('Dashboard')))
      .toBeVisible()
      .withTimeout(10000);
    
    console.log('[TEST] ✅ Onboarding completed successfully!');
  });
});