/**
 * Test Deep Link Handler
 *
 * Handles test-only deep links for E2E testing
 * SECURITY: Only enabled in __DEV__ mode, stripped from production
 */

import { Linking } from 'react-native';

// Compile-time guard
if (__DEV__ === false) {
  throw new Error('testDeepLinks.ts should not be imported in production builds');
}

// Dynamic import to prevent bundling in production
let testHelpers: typeof import('./testHelpers') | null = null;

/**
 * Initialize test deep link handlers
 * ONLY call this in __DEV__ mode
 */
export function initializeTestDeepLinks() {
  if (!__DEV__) {
    console.warn('[TestDeepLinks] Attempted to initialize in production - ignoring');
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
 * - migrainetracker://test/reset - Reset database to clean state
 * - migrainetracker://test/reset?fixtures=true - Reset and load test fixtures
 * - migrainetracker://test/state - Log current database state
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

    // Lazy load test helpers
    if (!testHelpers) {
      testHelpers = await import('./testHelpers');
    }

    switch (path) {
      case '/reset':
        {
          const loadFixtures = params.get('fixtures') === 'true';
          console.log('[TestDeepLinks] Resetting database, fixtures:', loadFixtures);

          const result = await testHelpers.resetDatabaseForTesting({
            createBackup: true,
            loadFixtures,
          });

          console.log('[TestDeepLinks] Reset result:', result);
        }
        break;

      case '/state':
        {
          const state = await testHelpers.getDatabaseState();
          console.log('[TestDeepLinks] Current database state:', state);
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
  if (!__DEV__) return;

  Linking.removeAllListeners('url');
  console.log('[TestDeepLinks] Test deep link handlers cleaned up');
}
