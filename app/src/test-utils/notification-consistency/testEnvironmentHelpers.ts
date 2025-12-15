/**
 * Test Environment Helpers for Notification-Schedule Consistency Testing
 * 
 * Provides utilities for test isolation, cleanup automation, environment state management,
 * and cross-test data sharing to ensure reliable and maintainable test execution.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';
import { 
  createMockScheduleDatabase, 
  resetCurrentMockScheduleDatabase 
} from './scheduleTestHelpers';
import { useMedicationStore } from '../../store/medicationStore';
import { useNotificationSettingsStore } from '../../store/notificationSettingsStore';

export interface TestEnvironmentState {
  id: string;
  timestamp: number;
  medications: any[];
  schedules: any[];
  notifications: any[];
  storeStates: Record<string, any>;
  systemState: {
    mockCalls: Record<string, any[]>;
    timers: number[];
    intervals: number[];
  };
}

export interface TestIsolationConfig {
  resetStores: boolean;
  clearMocks: boolean;
  resetDatabase: boolean;
  clearNotifications: boolean;
  resetTimers: boolean;
  captureState: boolean;
}

export interface CrossTestDataStore {
  sharedData: Map<string, any>;
  testResults: Map<string, any>;
  performanceMetrics: Map<string, any>;
  environmentSnapshots: Map<string, TestEnvironmentState>;
}

export interface CleanupRegistration {
  id: string;
  description: string;
  cleanupFunction: () => Promise<void> | void;
  priority: number;
  conditions?: Array<() => boolean>;
}

/**
 * Test Environment Manager for comprehensive state management
 */
export class TestEnvironmentManager {
  private static instance: TestEnvironmentManager;
  private cleanupRegistry: Map<string, CleanupRegistration> = new Map();
  private stateSnapshots: Map<string, TestEnvironmentState> = new Map();
  private crossTestStore: CrossTestDataStore = {
    sharedData: new Map(),
    testResults: new Map(),
    performanceMetrics: new Map(),
    environmentSnapshots: new Map(),
  };
  private currentTestId: string | null = null;
  private globalCleanupFunctions: Array<() => Promise<void> | void> = [];

  static getInstance(): TestEnvironmentManager {
    if (!TestEnvironmentManager.instance) {
      TestEnvironmentManager.instance = new TestEnvironmentManager();
    }
    return TestEnvironmentManager.instance;
  }

  /**
   * Initialize test environment with isolation configuration
   */
  async initializeTest(
    testId: string,
    config: TestIsolationConfig = {
      resetStores: true,
      clearMocks: true,
      resetDatabase: true,
      clearNotifications: true,
      resetTimers: true,
      captureState: true,
    }
  ): Promise<void> {
    this.currentTestId = testId;
    
    try {
      logger.debug('[TestEnvironment] Initializing test environment', { testId, config });

      // Capture initial state if requested
      if (config.captureState) {
        await this.captureEnvironmentSnapshot(`${testId}_initial`);
      }

      // Reset stores
      if (config.resetStores) {
        await this.resetAllStores();
      }

      // Clear mocks
      if (config.clearMocks) {
        this.clearAllMocks();
      }

      // Reset database
      if (config.resetDatabase) {
        this.resetDatabase();
      }

      // Clear notifications
      if (config.clearNotifications) {
        this.clearNotifications();
      }

      // Reset timers
      if (config.resetTimers) {
        this.clearTimers();
      }

      // Initialize clean database
      createMockScheduleDatabase();

      logger.debug('[TestEnvironment] Test environment initialized', { testId });

    } catch (error) {
      logger.error('[TestEnvironment] Failed to initialize test environment', {
        testId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Cleanup test environment and run registered cleanup functions
   */
  async cleanupTest(testId?: string): Promise<void> {
    const currentId = testId || this.currentTestId;
    if (!currentId) {
      logger.warn('[TestEnvironment] No test ID provided for cleanup');
      return;
    }

    try {
      logger.debug('[TestEnvironment] Starting test cleanup', { testId: currentId });

      // Run registered cleanup functions in priority order
      const cleanupFunctions = Array.from(this.cleanupRegistry.values())
        .filter(reg => !reg.conditions || reg.conditions.every(condition => condition()))
        .sort((a, b) => b.priority - a.priority);

      for (const cleanupReg of cleanupFunctions) {
        try {
          logger.debug('[TestEnvironment] Running cleanup function', {
            id: cleanupReg.id,
            description: cleanupReg.description,
          });
          
          await cleanupReg.cleanupFunction();
        } catch (error) {
          logger.error('[TestEnvironment] Cleanup function failed', {
            id: cleanupReg.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Standard cleanup operations
      await this.performStandardCleanup();

      // Clear test-specific cleanup registrations
      this.cleanupRegistry.clear();
      this.currentTestId = null;

      logger.debug('[TestEnvironment] Test cleanup completed', { testId: currentId });

    } catch (error) {
      logger.error('[TestEnvironment] Test cleanup failed', {
        testId: currentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Register cleanup function for current test
   */
  registerCleanup(
    id: string,
    description: string,
    cleanupFunction: () => Promise<void> | void,
    priority: number = 0,
    conditions?: Array<() => boolean>
  ): void {
    this.cleanupRegistry.set(id, {
      id,
      description,
      cleanupFunction,
      priority,
      conditions,
    });

    logger.debug('[TestEnvironment] Cleanup function registered', {
      id,
      description,
      priority,
    });
  }

  /**
   * Capture current environment state as snapshot
   */
  async captureEnvironmentSnapshot(snapshotId: string): Promise<TestEnvironmentState> {
    try {
      const snapshot: TestEnvironmentState = {
        id: snapshotId,
        timestamp: Date.now(),
        medications: this.captureStoreState('medication'),
        schedules: this.captureStoreState('schedule'),
        notifications: this.captureNotificationState(),
        storeStates: this.captureAllStoreStates(),
        systemState: {
          mockCalls: this.captureMockCalls(),
          timers: [],
          intervals: [],
        },
      };

      this.stateSnapshots.set(snapshotId, snapshot);
      this.crossTestStore.environmentSnapshots.set(snapshotId, snapshot);

      logger.debug('[TestEnvironment] Environment snapshot captured', {
        snapshotId,
        dataSize: {
          medications: snapshot.medications.length,
          schedules: snapshot.schedules.length,
          notifications: snapshot.notifications.length,
        },
      });

      return snapshot;

    } catch (error) {
      logger.error('[TestEnvironment] Failed to capture environment snapshot', {
        snapshotId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Restore environment state from snapshot
   */
  async restoreEnvironmentSnapshot(snapshotId: string): Promise<void> {
    const snapshot = this.stateSnapshots.get(snapshotId) || 
                    this.crossTestStore.environmentSnapshots.get(snapshotId);

    if (!snapshot) {
      throw new Error(`Environment snapshot '${snapshotId}' not found`);
    }

    try {
      logger.debug('[TestEnvironment] Restoring environment snapshot', { snapshotId });

      // Restore store states
      await this.restoreAllStoreStates(snapshot.storeStates);

      // Clear and restore mocks
      this.clearAllMocks();
      // Note: Mock call history cannot be truly restored, but we can reset to clean state

      // Reset and restore database state
      this.resetDatabase();
      // Note: Database restoration would require storing actual mapping data

      logger.debug('[TestEnvironment] Environment snapshot restored', { snapshotId });

    } catch (error) {
      logger.error('[TestEnvironment] Failed to restore environment snapshot', {
        snapshotId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Share data across tests
   */
  setSharedData(key: string, data: any): void {
    this.crossTestStore.sharedData.set(key, data);
    logger.debug('[TestEnvironment] Shared data set', { key, dataType: typeof data });
  }

  getSharedData(key: string): any {
    return this.crossTestStore.sharedData.get(key);
  }

  /**
   * Store test results for analysis
   */
  storeTestResult(testId: string, result: any): void {
    this.crossTestStore.testResults.set(testId, {
      ...result,
      timestamp: Date.now(),
    });
    logger.debug('[TestEnvironment] Test result stored', { testId });
  }

  getTestResult(testId: string): any {
    return this.crossTestStore.testResults.get(testId);
  }

  /**
   * Store performance metrics for aggregation
   */
  storePerformanceMetrics(testId: string, metrics: any): void {
    this.crossTestStore.performanceMetrics.set(testId, {
      ...metrics,
      timestamp: Date.now(),
    });
    logger.debug('[TestEnvironment] Performance metrics stored', { testId });
  }

  getPerformanceMetrics(testId: string): any {
    return this.crossTestStore.performanceMetrics.get(testId);
  }

  getAllPerformanceMetrics(): Array<{ testId: string; metrics: any }> {
    return Array.from(this.crossTestStore.performanceMetrics.entries()).map(
      ([testId, metrics]) => ({ testId, metrics })
    );
  }

  /**
   * Get aggregated test statistics
   */
  getTestStatistics(): {
    totalTests: number;
    totalSnapshots: number;
    sharedDataKeys: string[];
    averageTestDuration: number;
    performanceMetricsCount: number;
  } {
    const results = Array.from(this.crossTestStore.testResults.values());
    const totalTests = results.length;
    const averageTestDuration = totalTests > 0 ? 
      results.reduce((sum, result) => sum + (result.duration || 0), 0) / totalTests : 0;

    return {
      totalTests,
      totalSnapshots: this.stateSnapshots.size,
      sharedDataKeys: Array.from(this.crossTestStore.sharedData.keys()),
      averageTestDuration,
      performanceMetricsCount: this.crossTestStore.performanceMetrics.size,
    };
  }

  /**
   * Private helper methods
   */
  private async resetAllStores(): Promise<void> {
    try {
      // Reset medication store
      useMedicationStore.setState({
        medications: [],
        preventativeMedications: [],
        rescueMedications: [],
        otherMedications: [],
        schedules: [],
        doses: [],
        loading: false,
        error: null,
      });

      // Reset notification settings store
      useNotificationSettingsStore.setState({
        settings: {
          timeSensitiveEnabled: true,
          followUpDelay: 30,
          criticalAlertsEnabled: true,
          medicationOverrides: {},
        },
        isLoaded: false,
        loadSettings: jest.fn(),
        updateGlobalSettings: jest.fn(),
        updateMedicationSettings: jest.fn(),
        removeMedicationSettings: jest.fn(),
        getEffectiveSettings: jest.fn(),
      });

      logger.debug('[TestEnvironment] All stores reset');
    } catch (error) {
      logger.error('[TestEnvironment] Failed to reset stores', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  private clearAllMocks(): void {
    jest.clearAllMocks();
    logger.debug('[TestEnvironment] All mocks cleared');
  }

  private resetDatabase(): void {
    try {
      resetCurrentMockScheduleDatabase();
      logger.debug('[TestEnvironment] Database reset');
    } catch (error) {
      logger.warn('[TestEnvironment] Database reset failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  private clearNotifications(): void {
    try {
      // Clear mock call history
      if (jest.isMockFunction(Notifications.scheduleNotificationAsync)) {
        (Notifications.scheduleNotificationAsync as jest.Mock).mockClear();
      }
      if (jest.isMockFunction(Notifications.cancelScheduledNotificationAsync)) {
        (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockClear();
      }
      logger.debug('[TestEnvironment] Notifications cleared');
    } catch (error) {
      logger.warn('[TestEnvironment] Failed to clear notifications', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  private clearTimers(): void {
    try {
      jest.clearAllTimers();
      logger.debug('[TestEnvironment] Timers cleared');
    } catch (error) {
      logger.warn('[TestEnvironment] Failed to clear timers', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  private captureStoreState(storeType: string): any[] {
    try {
      switch (storeType) {
        case 'medication':
          return useMedicationStore.getState().medications || [];
        case 'schedule':
          return useMedicationStore.getState().schedules || [];
        default:
          return [];
      }
    } catch {
      return [];
    }
  }

  private captureNotificationState(): any[] {
    try {
      if (jest.isMockFunction(Notifications.scheduleNotificationAsync)) {
        return (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      }
      return [];
    } catch {
      return [];
    }
  }

  private captureAllStoreStates(): Record<string, any> {
    try {
      return {
        medication: useMedicationStore.getState(),
        notificationSettings: useNotificationSettingsStore.getState(),
      };
    } catch {
      return {};
    }
  }

  private captureMockCalls(): Record<string, any[]> {
    const mockCalls: Record<string, any[]> = {};

    try {
      if (jest.isMockFunction(Notifications.scheduleNotificationAsync)) {
        mockCalls.scheduleNotification = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      }
      if (jest.isMockFunction(Notifications.cancelScheduledNotificationAsync)) {
        mockCalls.cancelNotification = (Notifications.cancelScheduledNotificationAsync as jest.Mock).mock.calls;
      }
    } catch {
      // Ignore errors capturing mock calls
    }

    return mockCalls;
  }

  private async restoreAllStoreStates(storeStates: Record<string, any>): Promise<void> {
    try {
      if (storeStates.medication) {
        useMedicationStore.setState(storeStates.medication);
      }
      if (storeStates.notificationSettings) {
        useNotificationSettingsStore.setState(storeStates.notificationSettings);
      }
    } catch (error) {
      logger.error('[TestEnvironment] Failed to restore store states', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  private async performStandardCleanup(): Promise<void> {
    // Reset all stores
    await this.resetAllStores();
    
    // Clear all mocks
    this.clearAllMocks();
    
    // Reset database
    this.resetDatabase();
    
    // Clear notifications
    this.clearNotifications();
    
    // Clear timers
    this.clearTimers();
  }

  /**
   * Register global cleanup function that runs after all tests
   */
  registerGlobalCleanup(cleanupFunction: () => Promise<void> | void): void {
    this.globalCleanupFunctions.push(cleanupFunction);
  }

  /**
   * Run all global cleanup functions
   */
  async runGlobalCleanup(): Promise<void> {
    for (const cleanupFn of this.globalCleanupFunctions) {
      try {
        await cleanupFn();
      } catch (error) {
        logger.error('[TestEnvironment] Global cleanup function failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    this.globalCleanupFunctions = [];
  }

  /**
   * Clear all cross-test data
   */
  clearCrossTestData(): void {
    this.crossTestStore.sharedData.clear();
    this.crossTestStore.testResults.clear();
    this.crossTestStore.performanceMetrics.clear();
    this.crossTestStore.environmentSnapshots.clear();
    this.stateSnapshots.clear();
  }
}

/**
 * Convenience functions for common test environment operations
 */
const testEnvManager = TestEnvironmentManager.getInstance();

export function initializeTestEnvironment(
  testId: string,
  config?: Partial<TestIsolationConfig>
): Promise<void> {
  const fullConfig: TestIsolationConfig = {
    resetStores: true,
    clearMocks: true,
    resetDatabase: true,
    clearNotifications: true,
    resetTimers: true,
    captureState: true,
    ...config,
  };
  
  return testEnvManager.initializeTest(testId, fullConfig);
}

export function cleanupTestEnvironment(testId?: string): Promise<void> {
  return testEnvManager.cleanupTest(testId);
}

export function registerTestCleanup(
  id: string,
  description: string,
  cleanupFunction: () => Promise<void> | void,
  priority: number = 0
): void {
  testEnvManager.registerCleanup(id, description, cleanupFunction, priority);
}

export function captureTestSnapshot(snapshotId: string): Promise<TestEnvironmentState> {
  return testEnvManager.captureEnvironmentSnapshot(snapshotId);
}

export function restoreTestSnapshot(snapshotId: string): Promise<void> {
  return testEnvManager.restoreEnvironmentSnapshot(snapshotId);
}

export function setTestSharedData(key: string, data: any): void {
  testEnvManager.setSharedData(key, data);
}

export function getTestSharedData(key: string): any {
  return testEnvManager.getSharedData(key);
}

export function storeTestResults(testId: string, result: any): void {
  testEnvManager.storeTestResult(testId, result);
}

export function storeTestPerformanceMetrics(testId: string, metrics: any): void {
  testEnvManager.storePerformanceMetrics(testId, metrics);
}

/**
 * Test Suite Coordinator for managing multiple related tests
 */
export class TestSuiteCoordinator {
  private suiteId: string;
  private testSequence: Array<{
    testId: string;
    dependencies: string[];
    sharedDataKeys: string[];
  }> = [];

  constructor(suiteId: string) {
    this.suiteId = suiteId;
  }

  addTest(
    testId: string, 
    dependencies: string[] = [],
    sharedDataKeys: string[] = []
  ): void {
    this.testSequence.push({
      testId,
      dependencies,
      sharedDataKeys,
    });
  }

  async executeSuite(): Promise<{
    totalTests: number;
    passedTests: string[];
    failedTests: Array<{ testId: string; error: string }>;
    sharedData: Record<string, any>;
  }> {
    const passedTests: string[] = [];
    const failedTests: Array<{ testId: string; error: string }> = [];
    const sharedData: Record<string, any> = {};

    logger.debug('[TestSuiteCoordinator] Starting test suite execution', {
      suiteId: this.suiteId,
      testCount: this.testSequence.length,
    });

    for (const testConfig of this.testSequence) {
      try {
        // Check dependencies
        const missingDependencies = testConfig.dependencies.filter(
          dep => !passedTests.includes(dep)
        );
        
        if (missingDependencies.length > 0) {
          throw new Error(`Missing dependencies: ${missingDependencies.join(', ')}`);
        }

        // Prepare shared data for test
        for (const key of testConfig.sharedDataKeys) {
          if (sharedData[key]) {
            setTestSharedData(key, sharedData[key]);
          }
        }

        // Initialize test environment
        await initializeTestEnvironment(testConfig.testId);

        // Test execution happens externally
        // This coordinator just manages the sequence and data sharing

        passedTests.push(testConfig.testId);
        
        // Collect shared data after test
        for (const key of testConfig.sharedDataKeys) {
          const data = getTestSharedData(key);
          if (data !== undefined) {
            sharedData[key] = data;
          }
        }

      } catch (error) {
        failedTests.push({
          testId: testConfig.testId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        logger.error('[TestSuiteCoordinator] Test failed', {
          testId: testConfig.testId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        await cleanupTestEnvironment(testConfig.testId);
      }
    }

    const result = {
      totalTests: this.testSequence.length,
      passedTests,
      failedTests,
      sharedData,
    };

    logger.debug('[TestSuiteCoordinator] Test suite execution completed', {
      suiteId: this.suiteId,
      ...result,
    });

    return result;
  }
}

/**
 * Automated test environment monitor
 */
export class TestEnvironmentMonitor {
  private static monitoringInterval: NodeJS.Timeout | null = null;
  private static metrics: {
    memoryUsage: number[];
    testDurations: number[];
    cleanupFailures: number;
    lastUpdate: number;
  } = {
    memoryUsage: [],
    testDurations: [],
    cleanupFailures: 0,
    lastUpdate: Date.now(),
  };

  static startMonitoring(intervalMs: number = 1000): void {
    if (this.monitoringInterval) {
      return; // Already monitoring
    }

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    logger.debug('[TestEnvironmentMonitor] Monitoring started', { intervalMs });
  }

  static stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.debug('[TestEnvironmentMonitor] Monitoring stopped');
  }

  static getMetrics(): typeof TestEnvironmentMonitor.metrics {
    return { ...this.metrics };
  }

  static reportCleanupFailure(): void {
    this.metrics.cleanupFailures++;
  }

  static recordTestDuration(duration: number): void {
    this.metrics.testDurations.push(duration);
    
    // Keep only last 100 durations
    if (this.metrics.testDurations.length > 100) {
      this.metrics.testDurations = this.metrics.testDurations.slice(-100);
    }
  }

  private static collectMetrics(): void {
    try {
      // Collect memory usage
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage();
        this.metrics.memoryUsage.push(memUsage.heapUsed);
        
        // Keep only last 100 measurements
        if (this.metrics.memoryUsage.length > 100) {
          this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
        }
      }

      this.metrics.lastUpdate = Date.now();

    } catch (error) {
      logger.warn('[TestEnvironmentMonitor] Failed to collect metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

/**
 * Utility for test timing and performance tracking
 */
export class TestTimer {
  private startTime: number = 0;
  private endTime: number = 0;
  private checkpoints: Map<string, number> = new Map();

  start(): void {
    this.startTime = Date.now();
    this.endTime = 0;
    this.checkpoints.clear();
  }

  checkpoint(name: string): void {
    this.checkpoints.set(name, Date.now());
  }

  stop(): number {
    this.endTime = Date.now();
    const duration = this.endTime - this.startTime;
    TestEnvironmentMonitor.recordTestDuration(duration);
    return duration;
  }

  getDuration(): number {
    const end = this.endTime || Date.now();
    return end - this.startTime;
  }

  getCheckpointDuration(name: string): number | null {
    const checkpointTime = this.checkpoints.get(name);
    if (!checkpointTime) {
      return null;
    }
    return checkpointTime - this.startTime;
  }

  getCheckpointDelta(checkpoint1: string, checkpoint2: string): number | null {
    const time1 = this.checkpoints.get(checkpoint1);
    const time2 = this.checkpoints.get(checkpoint2);
    
    if (!time1 || !time2) {
      return null;
    }
    
    return Math.abs(time2 - time1);
  }

  getAllCheckpoints(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [name, time] of this.checkpoints) {
      result[name] = time - this.startTime;
    }
    return result;
  }
}