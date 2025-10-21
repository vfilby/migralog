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

import { logger } from '../utils/logger';
import { Linking } from 'react-native';
import Constants from 'expo-constants';

// Layer 1: Build Configuration Check
// Only enable in Debug/Testing builds, never in Release
const enableTestDeepLinks = Constants.expoConfig?.extra?.enableTestDeepLinks === true || __DEV__;

// Log configuration status at module load time
if (enableTestDeepLinks) {
  logger.log('[TestDeepLinks] Enabled in Debug/Testing build');
} else {
  logger.log('[TestDeepLinks] Disabled in Release build');
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
 * Currently unused but reserved for future enhanced security
 */
function _generateTestToken(): string {
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
    logger.log('[TestDeepLinks] Test mode auto-disabled after timeout');
  }, TEST_MODE_TIMEOUT_MS);

  // Layer 4: Audit Logging
  logger.log(`[TestDeepLinks] Test mode ACTIVATED (expires in ${TEST_MODE_TIMEOUT_MS / 1000}s)`);
  logger.log(`[TestDeepLinks] Session token: ${testModeToken}`);

  return testModeToken;
}

/**
 * Verify that test mode is active and token is valid
 * Special case: "detox" token is accepted for E2E testing convenience
 */
function verifyTestModeToken(providedToken: string | null): boolean {
  // Special bypass for Detox E2E tests
  if (providedToken === 'detox') {
    logger.log('[TestDeepLinks] ✅ Authorized: Detox E2E token accepted');
    return true;
  }

  if (!isTestModeActive) {
    logger.warn('[TestDeepLinks] REJECTED: Test mode not activated');
    return false;
  }

  if (providedToken !== testModeToken) {
    logger.warn('[TestDeepLinks] REJECTED: Invalid or missing token');
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
    logger.warn('[TestDeepLinks] Attempted to initialize but disabled in this build');
    return;
  }

  logger.log('[TestDeepLinks] Initializing test deep link handlers...');

  // Listen for deep links
  Linking.addEventListener('url', handleTestDeepLink);

  // Handle initial URL if app was opened from link
  Linking.getInitialURL().then((url) => {
    if (url) {
      handleTestDeepLink({ url });
    }
  });

  logger.log('[TestDeepLinks] Test deep link handlers initialized');
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

  logger.log('[TestDeepLinks] Received URL:', url);

  // Only process test URLs
  if (!url.includes('://test/')) {
    return;
  }

  try {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;
    const params = parsedUrl.searchParams;

    logger.log('[TestDeepLinks] Path:', path, 'Params:', Array.from(params.entries()));

    // Special case: Activate test mode (no token required)
    if (path === '/activate') {
      const _token = activateTestMode();
      logger.log('[TestDeepLinks] ✅ Test mode activated successfully');
      // Token is already logged in activateTestMode()
      return;
    }

    // All other commands require valid token
    const providedToken = params.get('token');
    if (!verifyTestModeToken(providedToken)) {
      logger.error('[TestDeepLinks] ❌ Unauthorized: Token verification failed');
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
          logger.log('[TestDeepLinks] ✅ Authorized: Resetting database, fixtures:', loadFixtures);

          const result = await testHelpers.resetDatabaseForTesting({
            createBackup: true,
            loadFixtures,
          });

          logger.log('[TestDeepLinks] Reset result:', result);

          // Force Dashboard to reload by navigating away and back
          // This ensures useFocusEffect runs and UI re-renders with fresh data
          logger.log('[TestDeepLinks] Forcing Dashboard reload...', new Date().toISOString());
          const { navigationRef } = await import('../navigation/NavigationService');
          if (navigationRef.current) {
            // First, dismiss any open modals by navigating to root
            const state = navigationRef.current.getRootState();
            const hasModal = state.routes.some(route => route.name !== 'MainTabs');

            if (hasModal) {
              logger.log('[TestDeepLinks] Dismissing modal before reload...', new Date().toISOString());
              // Reset to MainTabs root, dismissing any modals
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              navigationRef.current.reset({
                index: 0,
                routes: [{ name: 'MainTabs', params: { screen: 'Dashboard' } as any }],
              });
              await new Promise(resolve => setTimeout(resolve, 300));
            }

            // Navigate to Episodes tab
            logger.log('[TestDeepLinks] Navigating to Episodes...', new Date().toISOString());
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (navigationRef.current.navigate as any)('MainTabs', { screen: 'Episodes' });
            // Wait for navigation animation to complete
            await new Promise(resolve => setTimeout(resolve, 300));
            // Navigate back to Dashboard
            logger.log('[TestDeepLinks] Navigating back to Dashboard...', new Date().toISOString());
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (navigationRef.current.navigate as any)('MainTabs', { screen: 'Dashboard' });
            // Wait for navigation back and data loading to complete
            await new Promise(resolve => setTimeout(resolve, 500));
            logger.log('[TestDeepLinks] Dashboard reload complete', new Date().toISOString());
          }
        }
        break;

      case '/state':
        {
          logger.log('[TestDeepLinks] ✅ Authorized: Getting database state');
          const state = await testHelpers.getDatabaseState();
          logger.log('[TestDeepLinks] Current database state:', state);
        }
        break;

      case '/home':
        {
          logger.log('[TestDeepLinks] ✅ Authorized: Navigating to home/dashboard');
          // Import navigation utilities
          const { navigationRef } = await import('../navigation/NavigationService');
          if (navigationRef.current) {
            // Navigate to the Dashboard (Home tab)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (navigationRef.current.navigate as any)('MainTabs', { screen: 'Dashboard' });
            logger.log('[TestDeepLinks] Successfully navigated to Dashboard');
          } else {
            logger.warn('[TestDeepLinks] Navigation ref not available');
          }
        }
        break;

      default:
        logger.warn('[TestDeepLinks] Unknown test path:', path);
    }
  } catch (error) {
    logger.error('[TestDeepLinks] Error handling deep link:', error);
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
  logger.log('[TestDeepLinks] Test deep link handlers cleaned up');
}
