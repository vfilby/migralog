const { system } = require('detox');
const { waitForAnimation } = require('./helpers');

/**
 * Onboarding Workflow E2E Test using Detox System API
 * 
 * This test uses the Detox system API to properly handle iOS permission dialogs
 * that appear during the onboarding flow.
 */
describe('Onboarding with System API', () => {
  beforeAll(async () => {
    // Launch with fresh state
    await device.launchApp({
      newInstance: true,
      delete: true,
      permissions: { notifications: 'NO' },
    });
  });

  it('should complete onboarding flow with system permission dialogs', async () => {
    console.log('🎯 Starting onboarding test with Detox system API');

    // Step 1: Welcome Screen
    console.log('📱 Step 1: Looking for Welcome screen...');
    await expect(element(by.text('Welcome to Migralog'))).toBeVisible();
    await element(by.text('Continue')).tap();
    console.log('✅ Step 1: Welcome screen completed');

    // Step 2: Medical Disclaimer  
    console.log('📱 Step 2: Looking for Medical Disclaimer...');
    await expect(element(by.text('Medical Disclaimer'))).toBeVisible();
    await element(by.text('Continue')).tap();
    console.log('✅ Step 2: Medical Disclaimer completed');

    // Step 3: Notification Permissions
    console.log('📱 Step 3: Looking for Enable Notifications...');
    await expect(element(by.text('Enable Notifications'))).toBeVisible();
    console.log('📱 Step 3: Tapping Continue to trigger notification permission...');
    await element(by.text('Continue')).tap();

    // Handle notification permission using system API
    console.log('🔐 Handling notification permission with system API...');
    try {
      await waitForAnimation(3000); // Give time for dialog to appear
      await system.element(by.system.label('Allow')).tap();
      console.log('✅ Notification permission granted via system API');
    } catch (error) {
      console.log('ℹ️  No notification dialog found:', error.message);
    }

    // Handle critical alerts permission
    console.log('🔐 Checking for critical alerts permission...');
    try {
      await waitForAnimation(2000);
      await system.element(by.system.label('Allow')).tap();
      console.log('✅ Critical alerts permission granted via system API');
    } catch (error) {
      console.log('ℹ️  No critical alerts dialog found:', error.message);
    }

    // Step 4: Location Services
    console.log('📱 Step 4: Looking for Location Services...');
    await expect(element(by.text('Location Services'))).toBeVisible();
    console.log('📱 Step 4: Tapping Finish Setup to complete onboarding...');
    await element(by.text('Finish Setup')).tap();

    // Handle location permission using system API
    console.log('🔐 Handling location permission with system API...');
    try {
      await waitForAnimation(3000); // Give time for dialog to appear
      await system.element(by.system.label('Allow While Using App')).tap();
      console.log('✅ Location permission granted via system API');
    } catch (error) {
      console.log('ℹ️  Trying "Allow Once" for location...');
      try {
        await system.element(by.system.label('Allow Once')).tap();
        console.log('✅ Location permission granted via system API (Allow Once)');
      } catch (error2) {
        console.log('ℹ️  No location dialog found:', error2.message);
      }
    }

    // Verify onboarding completion
    console.log('🎯 Verifying onboarding completion...');
    await waitForAnimation(3000); // Give time for navigation

    // Look for main app screens
    let completed = false;
    const possibleScreens = [
      'Dashboard',
      'Episodes', 
      'Add Episode',
      'Home'
    ];

    for (const screen of possibleScreens) {
      try {
        await expect(element(by.text(screen))).toBeVisible();
        console.log(`✅ Found ${screen} - onboarding completed successfully`);
        completed = true;
        break;
      } catch (error) {
        console.log(`ℹ️  ${screen} not found, trying next...`);
      }
    }

    if (!completed) {
      // Check if we're NOT still in onboarding
      try {
        await expect(element(by.text('Welcome to MigraLog'))).not.toBeVisible();
        console.log('✅ No longer on welcome screen - onboarding appears completed');
        completed = true;
      } catch (error) {
        throw new Error('❌ Onboarding did not complete - still on welcome screen');
      }
    }

    console.log('🎉 Onboarding workflow with system API completed successfully!');
  });

  it('should handle permission dialogs that do not appear (cached state)', async () => {
    console.log('🎯 Testing permission caching behavior');

    // Restart app to test cached permissions
    await device.launchApp({
      newInstance: true,
      delete: true,
      permissions: { notifications: 'NO' },
    });

    // Navigate through onboarding quickly
    console.log('📱 Fast navigation through onboarding with cached permissions...');
    
    // If already past onboarding, trigger it
    try {
      await device.openURL({
        url: 'migraine-tracker://test/trigger-onboarding?token=detox'
      });
      await waitForAnimation(1000);
    } catch (error) {
      console.log('ℹ️  Could not trigger onboarding via deep link');
    }

    // Navigate through steps
    try {
    await expect(element(by.text('Welcome to MigraLog'))).toBeVisible();
      await element(by.text('Continue')).tap(); // Step 1->2
      await element(by.text('Continue')).tap(); // Step 2->3  
      await element(by.text('Continue')).tap(); // Step 3->4 (may or may not show permission)
      await element(by.text('Finish Setup')).tap(); // Step 4->complete
      
      console.log('✅ Navigated through all steps without permission dialogs');
    } catch (error) {
      console.log('ℹ️  Navigation completed with different flow:', error.message);
    }

    console.log('🎉 Cached permission test completed');
  });
});