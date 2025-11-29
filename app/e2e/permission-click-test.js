const { waitForAnimation } = require('./helpers');

/**
 * Simple Permission Click Test
 * Just click Allow on the permission dialog
 */
describe('Permission Click Test', () => {
  
  it('should click Allow on permission dialog', async () => {
    console.log('[PERMISSION TEST] Looking for permission dialog...');
    
    // The dialog should already be visible from the previous test
    try {
      await waitFor(element(by.text('Allow')))
        .toBeVisible()
        .withTimeout(5000);
        
      console.log('[PERMISSION TEST] ✅ Found Allow button - clicking it now!');
      await element(by.text('Allow')).tap();
      console.log('[PERMISSION TEST] ✅ Clicked Allow button');
      
      await waitForAnimation(3000);
      
      // Check for next dialog or next screen
      try {
        // Look for critical alerts dialog
        await waitFor(element(by.text('Allow')))
          .toBeVisible()
          .withTimeout(3000);
        console.log('[PERMISSION TEST] ✅ Found second dialog - clicking Allow again');
        await element(by.text('Allow')).tap();
        console.log('[PERMISSION TEST] ✅ Clicked Allow on second dialog');
      } catch (e) {
        console.log('[PERMISSION TEST] No second dialog found');
      }
      
      await waitForAnimation(3000);
      
      // Check if we moved to location screen
      try {
        await waitFor(element(by.text('Location Services')))
          .toBeVisible()
          .withTimeout(8000);
        console.log('[PERMISSION TEST] 🎉 SUCCESS! Reached Location Services screen');
      } catch (e) {
        console.log('[PERMISSION TEST] Still processing...');
      }
      
    } catch (error) {
      console.log('[PERMISSION TEST] ❌ Could not find Allow button');
      throw error;
    }
  });
});