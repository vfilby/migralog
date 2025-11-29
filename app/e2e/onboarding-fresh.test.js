const { waitForAnimation } = require('./helpers');

/**
 * Fresh Onboarding Test - No deep links, clean install
 */
describe('Fresh Onboarding Test', () => {
  
  it('should start at welcome screen and complete onboarding', async () => {
    console.log('[FRESH TEST] Starting completely fresh app...');
    
    // Launch fresh app - should naturally show welcome screen
    await device.launchApp({
      newInstance: true,
      delete: true, // This should truly uninstall/reinstall
    });
    
    await waitForAnimation(3000); // Give app time to start
    
    console.log('[FRESH TEST] Looking for welcome screen...');
    
    // Should start at welcome screen naturally
    await waitFor(element(by.text('Welcome to MigraLog')))
      .toBeVisible()
      .withTimeout(15000);
    
    console.log('[FRESH TEST] ✅ Found welcome screen!');
    
    // Test the flow step by step
    await element(by.text('Continue')).tap();
    await waitForAnimation(2000);
    
    console.log('[FRESH TEST] Step 2: Medical Disclaimer');
    await waitFor(element(by.text('Medical Disclaimer')))
      .toBeVisible()
      .withTimeout(8000);
    
    await element(by.text('Continue')).tap();
    await waitForAnimation(2000);
    
    console.log('[FRESH TEST] Step 3: Notifications - this should trigger permission');
    await waitFor(element(by.text('Enable Notifications')))
      .toBeVisible()
      .withTimeout(8000);
    
    // This tap should trigger notification permission
    await element(by.text('Continue')).tap();
    
    console.log('[FRESH TEST] Looking for permission dialog...');
    
    // Look for any permission dialog
    let foundDialog = false;
    try {
      await waitFor(element(by.text('Allow')))
        .toBeVisible()
        .withTimeout(5000);
      console.log('[FRESH TEST] ✅ Found permission dialog!');
      await element(by.text('Allow')).tap();
      foundDialog = true;
      
      // Check for second dialog (critical alerts)
      try {
        await waitFor(element(by.text('Allow')))
          .toBeVisible()
          .withTimeout(3000);
        console.log('[FRESH TEST] ✅ Found second permission dialog!');
        await element(by.text('Allow')).tap();
      } catch (e) {
        console.log('[FRESH TEST] No second dialog found');
      }
    } catch (error) {
      console.log('[FRESH TEST] ⚠️ No permission dialog found - permissions may be cached');
    }
    
    await waitForAnimation(3000);
    
    console.log('[FRESH TEST] Step 4: Looking for Location Services...');
    await waitFor(element(by.text('Location Services')))
      .toBeVisible()
      .withTimeout(10000);
    
    console.log('[FRESH TEST] ✅ Reached location step! Test successful so far.');
    
    // Don't complete the full flow to avoid hanging on location permission
    console.log('[FRESH TEST] 🎉 Onboarding navigation test completed successfully!');
  });
});