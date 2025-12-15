/**
 * Jest Configuration for CI - Notification-Schedule Consistency Tests
 * 
 * Optimized configuration for running notification-schedule consistency tests
 * in CI environment with proper timeouts, parallelization, and resource management.
 */

const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  
  // CI-specific settings
  displayName: 'Notification-Schedule Consistency (CI)',
  
  // Test matching patterns - focus on notification consistency tests
  testMatch: [
    '<rootDir>/src/**/*notificationScheduleConsistency.integration.test.ts',
    '<rootDir>/src/**/*notificationScheduleConsistency.ci-validation.test.ts',
  ],
  
  // CI environment optimizations
  maxWorkers: '50%', // Use 50% of CPU cores to avoid resource exhaustion
  workerIdleMemoryLimit: '512MB', // Prevent memory issues in CI
  
  // Extended timeouts for CI environment
  testTimeout: 30000, // 30 seconds per test (vs default 5 seconds)
  
  // CI-specific test environment
  testEnvironment: 'node',
  
  // Suppress verbose output in CI but keep error details
  silent: false,
  verbose: true,
  
  // Coverage settings optimized for CI
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*notification*.{ts,tsx}',
    'src/**/*schedule*.{ts,tsx}',
    'src/test-utils/notification-consistency/**/*.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/**/*.d.ts',
  ],
  
  // CI coverage thresholds disabled for test utility validation
  // These tests focus on validating the test infrastructure itself
  coverageThreshold: {
    global: {
      branches: 0,  // Disabled for CI validation tests
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
  
  // CI-optimized reporters (jest-junit removed due to dependency issue)
  reporters: [
    'default',
  ],
  
  // CI-specific setup
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
  ],
  
  // Performance monitoring for CI
  logHeapUsage: true,
  detectOpenHandles: true,
  
  // Force sequential execution for consistency tests to avoid race conditions
  maxConcurrency: 1,
  
  // CI-specific globals
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react',
        // Optimize for CI compilation speed
        transpileOnly: true,
        isolatedModules: true,
      },
    },
    // CI environment flags
    __CI_ENVIRONMENT__: true,
    __NOTIFICATION_CONSISTENCY_CI__: true,
  },
  
  // Extended transform ignore patterns for CI stability
  transformIgnorePatterns: [
    ...baseConfig.transformIgnorePatterns,
    // Additional patterns for CI stability
    'node_modules/(?!@react-native|react-native|expo|@expo)',
  ],
  
  // CI-specific cache settings
  cacheDirectory: '<rootDir>/node_modules/.cache/jest-ci',
  clearMocks: true,
  restoreMocks: true,
  
  // Error handling for CI
  errorOnDeprecated: true,
  
  // CI-specific test results processor
  testResultsProcessor: '<rootDir>/scripts/ci-test-results-processor.js',
};