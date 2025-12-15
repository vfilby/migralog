/**
 * CI Setup for Notification-Schedule Consistency Tests
 * 
 * Provides CI-specific configuration and optimizations for the notification-schedule
 * consistency testing suite to ensure reliable execution in CI environments.
 */

const { TestEnvironmentMonitor } = require('../../test-utils/notification-consistency/testEnvironmentHelpers');

// CI Environment Detection
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

// Configure CI-specific timeouts
if (isCI) {
  // Increase default Jest timeout for CI environment
  jest.setTimeout(60000); // 60 seconds
  
  // Set CI-specific environment variables
  process.env.NOTIFICATION_CONSISTENCY_CI_MODE = 'true';
  process.env.TZ = 'UTC'; // Ensure UTC timezone for consistency
  
  // Log CI configuration to stderr to avoid test output pollution
  process.stderr.write(`[CI Setup] Notification consistency tests configured for CI environment\n`);
}

// Memory monitoring for CI
let memoryMonitoringInterval;

beforeAll(() => {
  if (isCI) {
    // Start memory monitoring in CI
    TestEnvironmentMonitor.startMonitoring(5000); // Check every 5 seconds
    
    // Set up memory pressure monitoring
    memoryMonitoringInterval = setInterval(() => {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
        
        // Log memory usage periodically in CI for debugging
        if (heapUsedMB > 200) { // Log if heap usage > 200MB
          process.stderr.write(`[CI Memory Monitor] High memory usage detected: ${heapUsedMB}MB heap, ${heapTotalMB}MB total\n`);
        }
      }
    }, 10000); // Check every 10 seconds
    
    process.stderr.write(`[CI Setup] Memory monitoring started\n`);
  }
});

afterAll(() => {
  if (isCI) {
    // Stop monitoring
    TestEnvironmentMonitor.stopMonitoring();
    
    if (memoryMonitoringInterval) {
      clearInterval(memoryMonitoringInterval);
    }
    
    // Log final CI metrics
    const metrics = TestEnvironmentMonitor.getMetrics();
    const avgMemoryUsageMB = metrics.memoryUsage.length > 0 
      ? Math.round(metrics.memoryUsage.reduce((a, b) => a + b, 0) / metrics.memoryUsage.length / 1024 / 1024)
      : 0;
    const avgTestDurationMs = metrics.testDurations.length > 0
      ? Math.round(metrics.testDurations.reduce((a, b) => a + b, 0) / metrics.testDurations.length)
      : 0;
    
    process.stderr.write(`[CI Setup] Final CI metrics - Memory: ${avgMemoryUsageMB}MB avg, Duration: ${avgTestDurationMs}ms avg\n`);
  }
});

// CI-specific mock configurations
beforeEach(() => {
  if (isCI) {
    // Configure notification mocks for CI reliability
    const Notifications = require('expo-notifications');
    
    // Mock implementations should be more tolerant in CI
    if (jest.isMockFunction(Notifications.scheduleNotificationAsync)) {
      Notifications.scheduleNotificationAsync.mockImplementation(async (_request) => {
        // Simulate some processing time for realism
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
        return `mock-notification-${Date.now()}-${Math.random()}`;
      });
    }
    
    if (jest.isMockFunction(Notifications.cancelScheduledNotificationAsync)) {
      Notifications.cancelScheduledNotificationAsync.mockImplementation(async (_id) => {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
        return true;
      });
    }
  }
});

// Error handling and debugging for CI
process.on('unhandledRejection', (reason, _promise) => {
  if (isCI) {
    const reasonMessage = reason instanceof Error ? reason.message : String(reason);
    process.stderr.write(`[CI Error] Unhandled promise rejection: ${reasonMessage}\n`);
    if (reason instanceof Error && reason.stack) {
      process.stderr.write(`[CI Error] Stack: ${reason.stack}\n`);
    }
  }
});

process.on('uncaughtException', (error) => {
  if (isCI) {
    process.stderr.write(`[CI Error] Uncaught exception: ${error.message}\n`);
    if (error.stack) {
      process.stderr.write(`[CI Error] Stack: ${error.stack}\n`);
    }
  }
});

// CI-specific performance optimizations
if (isCI) {
  // Optimize garbage collection for CI
  if (typeof global.gc === 'function') {
    // Run GC before each test in CI to ensure consistent memory state
    beforeEach(() => {
      global.gc();
    });
  }
  
  // Disable console.debug in CI to reduce noise
  // eslint-disable-next-line no-console
  const originalConsoleDebug = console.debug;
  // eslint-disable-next-line no-console
  console.debug = (...args) => {
    // Only log debug messages that are critical in CI
    if (args.some(arg => 
      typeof arg === 'string' && 
      (arg.includes('[CI') || arg.includes('CRITICAL') || arg.includes('ERROR'))
    )) {
      originalConsoleDebug(...args);
    }
  };
}

// CI test retry mechanism for flaky tests
const originalIt = global.it;
global.it = function(name, fn, timeout) {
  if (isCI && fn) {
    return originalIt(name, async function(...args) {
      let lastError;
      let attempts = 0;
      const maxAttempts = 2; // Retry once in CI
      
      while (attempts < maxAttempts) {
        try {
          attempts++;
          return await fn.call(this, ...args);
        } catch (error) {
          lastError = error;
          
          if (attempts < maxAttempts) {
            process.stderr.write(`[CI Retry] Test "${name}" failed on attempt ${attempts}, retrying...\n`);
            
            // Brief pause before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      // If all retries failed, throw the last error
      process.stderr.write(`[CI Retry] Test "${name}" failed after ${maxAttempts} attempts: ${lastError.message}\n`);
      throw lastError;
    }, timeout);
  }
  
  return originalIt(name, fn, timeout);
};

// Export CI configuration for other test files to use
module.exports = {
  isCI,
  isGitHubActions,
  ciConfig: {
    timeoutMultiplier: isCI ? 2 : 1,
    retryCount: isCI ? 1 : 0,
    memoryMonitoring: isCI,
    verboseLogging: isCI,
  },
};