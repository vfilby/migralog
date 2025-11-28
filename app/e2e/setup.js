/**
 * E2E Test Environment Setup
 * Runs before all E2E tests to configure the test environment
 */

// Set global flag to indicate we're running in E2E/Detox environment
// This is used by the app to skip automatic permission requests that would block tests
global.isDetoxE2E = true;

console.log('[E2E Setup] Detox E2E environment initialized');

// NOTE: Skip onboarding is now called in individual test files after device.launchApp()
// because device.openURL() requires the app to be running
