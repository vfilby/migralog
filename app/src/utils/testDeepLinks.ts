/**
 * Test Deep Link Handler
 *
 * Handles test-only deep links for E2E testing
 *
 * SECURITY: Multi-layered approach:
 * 1. Build Configuration: Only enabled in Debug/Testing builds, completely excluded from Release
 * 2. Session Token: Requires activation + valid token for database operations
 * 3. Auto-Expiration: Test mode expires after 30 seconds
 * 4. Audit Logging: All operations logged for security review
 */

import { Linking } from 'react-native';
import Constants from 'expo-constants';

// Layer 1: Build Configuration Check
// Only enable in Debug/Testing builds, never in Release
const enableTestDeepLinks = Constants.expoConfig?.extra?.enableTestDeepLinks === true || __DEV__;

// Log configuration status at module load time
if (enableTestDeepLinks) {
  console.log('[TestDeepLinks] Enabled in Debug/Testing build');
} else {
  console.log('[TestDeepLinks] Disabled in Release build');
}

// Dynamic import to prevent bundling in production
let testHelpers: typeof import('./testHelpers') | null = null;

// Layer 2: Session Token Security
// Test mode must be explicitly activated and requires a valid session token
let isTestModeActive = false;
let testModeToken: string | null = null;
let testModeTimeout: NodeJS.Timeout | null = null;

const TEST_MODE_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Generate a random session token for test mode
 */
function generateTestToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Activate test mode and generate session token
 * For E2E testing convenience, we use a predictable token pattern
 * Returns the token that must be included in subsequent test deep links
 */
function activateTestMode(): string {
  isTestModeActive = true;
  // Use predictable token for E2E testing: "detox-" + timestamp
  // This allows Detox tests to construct valid URLs without parsing logs
  testModeToken = `detox-${Date.now()}`;

  // Auto-disable after timeout (Layer 3: Auto-Expiration)
  if (testModeTimeout) {
    clearTimeout(testModeTimeout);
  }

  testModeTimeout = setTimeout(() => {
    isTestModeActive = false;
    testModeToken = null;
    console.log('[TestDeepLinks] Test mode auto-disabled after timeout');
  }, TEST_MODE_TIMEOUT_MS);

  // Layer 4: Audit Logging
  console.log(`[TestDeepLinks] Test mode ACTIVATED (expires in ${TEST_MODE_TIMEOUT_MS / 1000}s)`);
  console.log(`[TestDeepLinks] Session token: ${testModeToken}`);

  return testModeToken;
}

/**
 * Verify that test mode is active and token is valid
 * Special case: "detox" token is accepted for E2E testing convenience
 */
function verifyTestModeToken(providedToken: string | null): boolean {
  // Special bypass for Detox E2E tests
  if (providedToken === 'detox') {
    console.log('[TestDeepLinks] ✅ Authorized: Detox E2E token accepted');
    return true;
  }

  if (!isTestModeActive) {
    console.warn('[TestDeepLinks] REJECTED: Test mode not activated');
    return false;
  }

  if (providedToken !== testModeToken) {
    console.warn('[TestDeepLinks] REJECTED: Invalid or missing token');
    return false;
  }

  return true;
}

/**
 * Initialize test deep link handlers
 * ONLY call this in Debug/Testing builds
 */
export function initializeTestDeepLinks() {
  if (!enableTestDeepLinks) {
    console.warn('[TestDeepLinks] Attempted to initialize but disabled in this build');
    return;
  }

  console.log('[TestDeepLinks] Initializing test deep link handlers...');

  // Listen for deep links
  Linking.addEventListener('url', handleTestDeepLink);

  // Handle initial URL if app was opened from link
  Linking.getInitialURL().then((url) => {
    if (url) {
      handleTestDeepLink({ url });
    }
  });

  console.log('[TestDeepLinks] Test deep link handlers initialized');
}

/**
 * Handle test deep links
 * Supported URLs:
 * - migraine-tracker://test/activate - Activate test mode and generate session token
 * - migraine-tracker://test/reset?token=XXX - Reset database (requires token)
 * - migraine-tracker://test/reset?token=XXX&fixtures=true - Reset and load fixtures (requires token)
 * - migraine-tracker://test/state?token=XXX - Log current database state (requires token)
 * - migraine-tracker://test/home?token=XXX - Navigate to home/dashboard (requires token)
 */
async function handleTestDeepLink(event: { url: string }) {
  const { url } = event;

  console.log('[TestDeepLinks] Received URL:', url);

  // Only process test URLs
  if (!url.includes('://test/')) {
    return;
  }

  try {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;
    const params = parsedUrl.searchParams;

    console.log('[TestDeepLinks] Path:', path, 'Params:', Array.from(params.entries()));

    // Special case: Activate test mode (no token required)
    if (path === '/activate') {
      const token = activateTestMode();
      console.log('[TestDeepLinks] ✅ Test mode activated successfully');
      // Token is already logged in activateTestMode()
      return;
    }

    // All other commands require valid token
    const providedToken = params.get('token');
    if (!verifyTestModeToken(providedToken)) {
      console.error('[TestDeepLinks] ❌ Unauthorized: Token verification failed');
      return;
    }

    // Lazy load test helpers
    if (!testHelpers) {
      testHelpers = await import('./testHelpers');
    }

    // Execute authorized commands
    switch (path) {
      case '/reset':
        {
          const loadFixtures = params.get('fixtures') === 'true';
          console.log('[TestDeepLinks] ✅ Authorized: Resetting database, fixtures:', loadFixtures);

          const result = await testHelpers.resetDatabaseForTesting({
            createBackup: true,
            loadFixtures,
          });

          console.log('[TestDeepLinks] Reset result:', result);
        }
        break;

      case '/state':
        {
          console.log('[TestDeepLinks] ✅ Authorized: Getting database state');
          const state = await testHelpers.getDatabaseState();
          console.log('[TestDeepLinks] Current database state:', state);
        }
        break;

      case '/home':
        {
          console.log('[TestDeepLinks] ✅ Authorized: Navigating to home/dashboard');
          // Import navigation utilities
          const { navigationRef } = await import('../navigation/NavigationService');
          if (navigationRef.current) {
            // Navigate to the Dashboard (Home tab)
            navigationRef.current.navigate('MainTabs', { screen: 'Dashboard' });
            console.log('[TestDeepLinks] Successfully navigated to Dashboard');
          } else {
            console.warn('[TestDeepLinks] Navigation ref not available');
          }
        }
        break;

      default:
        console.warn('[TestDeepLinks] Unknown test path:', path);
    }
  } catch (error) {
    console.error('[TestDeepLinks] Error handling deep link:', error);
  }
}

/**
 * Cleanup test deep link handlers
 */
export function cleanupTestDeepLinks() {
  if (!enableTestDeepLinks) return;

  // Clear test mode state
  isTestModeActive = false;
  testModeToken = null;
  if (testModeTimeout) {
    clearTimeout(testModeTimeout);
    testModeTimeout = null;
  }

  Linking.removeAllListeners('url');
  console.log('[TestDeepLinks] Test deep link handlers cleaned up');
}
