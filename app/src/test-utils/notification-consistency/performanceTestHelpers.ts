/**
 * Performance Test Helpers for Notification-Schedule Consistency Testing
 * 
 * Provides specialized utilities for benchmarking, memory tracking, and performance profiling
 * of notification-schedule operations to ensure they meet performance requirements under load.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';
import { getCurrentMockScheduleDatabase } from './scheduleTestHelpers';

export interface PerformanceMetrics {
  operationTime: number;
  memoryUsage: MemoryUsage;
  databaseOperations: DatabaseMetrics;
  notificationOperations: NotificationMetrics;
}

export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss?: number;
}

export interface DatabaseMetrics {
  insertOperations: number;
  updateOperations: number;
  deleteOperations: number;
  queryOperations: number;
  totalOperationTime: number;
  averageOperationTime: number;
}

export interface NotificationMetrics {
  scheduledCount: number;
  cancelledCount: number;
  totalSchedulingTime: number;
  averageSchedulingTime: number;
  failedOperations: number;
}

export interface BenchmarkResult {
  testName: string;
  operationCount: number;
  totalTime: number;
  averageTime: number;
  operationsPerSecond: number;
  peakMemoryUsage: number;
  memoryLeak: boolean;
  performanceMetrics: PerformanceMetrics;
  thresholdsPassed: ThresholdResults;
}

export interface ThresholdResults {
  timeThresholdPassed: boolean;
  memoryThresholdPassed: boolean;
  throughputThresholdPassed: boolean;
  details: Record<string, { actual: number; threshold: number; passed: boolean }>;
}

export interface PerformanceThresholds {
  maxOperationTime: number;
  maxMemoryUsage: number;
  minOperationsPerSecond: number;
  maxMemoryLeakPercent: number;
}

/**
 * Performance Test Manager for coordinating benchmarks and profiling
 */
export class PerformanceTestManager {
  private startMemory: MemoryUsage = { heapUsed: 0, heapTotal: 0, external: 0 };
  private currentMetrics: PerformanceMetrics = {
    operationTime: 0,
    memoryUsage: { heapUsed: 0, heapTotal: 0, external: 0 },
    databaseOperations: {
      insertOperations: 0,
      updateOperations: 0,
      deleteOperations: 0,
      queryOperations: 0,
      totalOperationTime: 0,
      averageOperationTime: 0,
    },
    notificationOperations: {
      scheduledCount: 0,
      cancelledCount: 0,
      totalSchedulingTime: 0,
      averageSchedulingTime: 0,
      failedOperations: 0,
    },
  };

  startProfiling(): void {
    this.startMemory = this.captureMemoryUsage();
    this.resetMetrics();
    
    // Start monitoring notification operations
    this.instrumentNotificationOperations();
    
    logger.debug('[Performance] Started performance profiling', {
      startMemory: this.startMemory,
    });
  }

  stopProfiling(): PerformanceMetrics {
    const endMemory = this.captureMemoryUsage();
    this.currentMetrics.memoryUsage = endMemory;
    
    logger.debug('[Performance] Stopped performance profiling', {
      endMemory,
      metrics: this.currentMetrics,
    });

    return { ...this.currentMetrics };
  }

  private captureMemoryUsage(): MemoryUsage {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
        rss: usage.rss,
      };
    }
    
    // Fallback for environments without process.memoryUsage
    return {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
    };
  }

  private resetMetrics(): void {
    this.currentMetrics = {
      operationTime: 0,
      memoryUsage: { heapUsed: 0, heapTotal: 0, external: 0 },
      databaseOperations: {
        insertOperations: 0,
        updateOperations: 0,
        deleteOperations: 0,
        queryOperations: 0,
        totalOperationTime: 0,
        averageOperationTime: 0,
      },
      notificationOperations: {
        scheduledCount: 0,
        cancelledCount: 0,
        totalSchedulingTime: 0,
        averageSchedulingTime: 0,
        failedOperations: 0,
      },
    };
  }

  private instrumentNotificationOperations(): void {
    const originalSchedule = Notifications.scheduleNotificationAsync;
    const originalCancel = Notifications.cancelScheduledNotificationAsync;

    (Notifications.scheduleNotificationAsync as jest.Mock).mockImplementation(
      async (request: any) => {
        const startTime = Date.now();
        
        try {
          const result = await originalSchedule.call(Notifications, request);
          const endTime = Date.now();
          
          this.currentMetrics.notificationOperations.scheduledCount++;
          this.currentMetrics.notificationOperations.totalSchedulingTime += (endTime - startTime);
          this.currentMetrics.notificationOperations.averageSchedulingTime = 
            this.currentMetrics.notificationOperations.totalSchedulingTime / 
            this.currentMetrics.notificationOperations.scheduledCount;
          
          return result;
        } catch (error) {
          this.currentMetrics.notificationOperations.failedOperations++;
          throw error;
        }
      }
    );

    (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockImplementation(
      async (notificationId: string) => {
        const startTime = Date.now();
        
        try {
          const result = await originalCancel.call(Notifications, notificationId);
          const endTime = Date.now();
          
          this.currentMetrics.notificationOperations.cancelledCount++;
          this.currentMetrics.notificationOperations.totalSchedulingTime += (endTime - startTime);
          
          return result;
        } catch (error) {
          this.currentMetrics.notificationOperations.failedOperations++;
          throw error;
        }
      }
    );
  }

  trackDatabaseOperation(operationType: 'insert' | 'update' | 'delete' | 'query', time: number): void {
    switch (operationType) {
      case 'insert':
        this.currentMetrics.databaseOperations.insertOperations++;
        break;
      case 'update':
        this.currentMetrics.databaseOperations.updateOperations++;
        break;
      case 'delete':
        this.currentMetrics.databaseOperations.deleteOperations++;
        break;
      case 'query':
        this.currentMetrics.databaseOperations.queryOperations++;
        break;
    }

    this.currentMetrics.databaseOperations.totalOperationTime += time;
    
    const totalOps = this.currentMetrics.databaseOperations.insertOperations +
                    this.currentMetrics.databaseOperations.updateOperations +
                    this.currentMetrics.databaseOperations.deleteOperations +
                    this.currentMetrics.databaseOperations.queryOperations;
    
    this.currentMetrics.databaseOperations.averageOperationTime = 
      this.currentMetrics.databaseOperations.totalOperationTime / totalOps;
  }
}

/**
 * Benchmark notification-schedule operations with performance thresholds
 */
export async function benchmarkNotificationScheduling(
  operationCount: number,
  testName: string = 'NotificationScheduling',
  thresholds: PerformanceThresholds = {
    maxOperationTime: 100, // ms
    maxMemoryUsage: 50 * 1024 * 1024, // 50MB
    minOperationsPerSecond: 10,
    maxMemoryLeakPercent: 5,
  }
): Promise<BenchmarkResult> {
  const manager = new PerformanceTestManager();
  manager.startProfiling();
  
  const startTime = Date.now();
  const initialMemory = manager['captureMemoryUsage']();

  try {
    // Perform scheduling operations
    for (let i = 0; i < operationCount; i++) {
      const notificationRequest = {
        content: {
          title: `Test Notification ${i}`,
          body: `Performance test notification`,
          data: {
            medicationId: `med-perf-${i}`,
            scheduleId: `sched-perf-${i}`,
            date: new Date().toISOString().split('T')[0],
          },
        },
        trigger: null,
      };

      await Notifications.scheduleNotificationAsync(notificationRequest);
      
      // Simulate database operation
      const dbStartTime = Date.now();
      getCurrentMockScheduleDatabase().addMapping({
        scheduleId: `sched-perf-${i}`,
        notificationId: `notif-perf-${i}`,
        date: new Date().toISOString().split('T')[0],
        medicationId: `med-perf-${i}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const dbEndTime = Date.now();
      manager.trackDatabaseOperation('insert', dbEndTime - dbStartTime);
    }

    const endTime = Date.now();
    const finalMemory = manager['captureMemoryUsage']();
    const metrics = manager.stopProfiling();

    // Calculate benchmark results
    const totalTime = endTime - startTime;
    const averageTime = totalTime / operationCount;
    const operationsPerSecond = (operationCount / totalTime) * 1000;
    const peakMemoryUsage = Math.max(finalMemory.heapUsed, finalMemory.heapTotal);
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryLeakPercent = (memoryIncrease / initialMemory.heapUsed) * 100;

    // Evaluate thresholds
    const thresholdResults: ThresholdResults = {
      timeThresholdPassed: averageTime <= thresholds.maxOperationTime,
      memoryThresholdPassed: peakMemoryUsage <= thresholds.maxMemoryUsage,
      throughputThresholdPassed: operationsPerSecond >= thresholds.minOperationsPerSecond,
      details: {
        averageTime: {
          actual: averageTime,
          threshold: thresholds.maxOperationTime,
          passed: averageTime <= thresholds.maxOperationTime,
        },
        peakMemoryUsage: {
          actual: peakMemoryUsage,
          threshold: thresholds.maxMemoryUsage,
          passed: peakMemoryUsage <= thresholds.maxMemoryUsage,
        },
        operationsPerSecond: {
          actual: operationsPerSecond,
          threshold: thresholds.minOperationsPerSecond,
          passed: operationsPerSecond >= thresholds.minOperationsPerSecond,
        },
        memoryLeakPercent: {
          actual: memoryLeakPercent,
          threshold: thresholds.maxMemoryLeakPercent,
          passed: Math.abs(memoryLeakPercent) <= thresholds.maxMemoryLeakPercent,
        },
      },
    };

    const result: BenchmarkResult = {
      testName,
      operationCount,
      totalTime,
      averageTime,
      operationsPerSecond,
      peakMemoryUsage,
      memoryLeak: Math.abs(memoryLeakPercent) > thresholds.maxMemoryLeakPercent,
      performanceMetrics: metrics,
      thresholdsPassed: thresholdResults,
    };

    logger.debug('[Performance] Benchmark completed', result);
    return result;

  } catch (error) {
    manager.stopProfiling();
    throw new Error(`Benchmark failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Memory leak detection for notification operations
 */
export async function detectMemoryLeaks(
  operationCount: number = 100,
  iterations: number = 3
): Promise<{
  memoryLeakDetected: boolean;
  memoryGrowthPercent: number;
  iterationResults: Array<{
    iteration: number;
    startMemory: number;
    endMemory: number;
    growthPercent: number;
  }>;
  recommendation: string;
}> {
  const iterationResults: Array<{
    iteration: number;
    startMemory: number;
    endMemory: number;
    growthPercent: number;
  }> = [];

  let totalGrowth = 0;

  for (let iteration = 0; iteration < iterations; iteration++) {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const manager = new PerformanceTestManager();
    const startMemory = manager['captureMemoryUsage']();

    // Perform operations
    for (let i = 0; i < operationCount; i++) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Memory Test ${iteration}-${i}`,
          body: 'Memory leak detection test',
          data: {
            medicationId: `med-mem-${iteration}-${i}`,
            scheduleId: `sched-mem-${iteration}-${i}`,
          },
        },
        trigger: null,
      });

      // Clean up immediately to test for leaks
      const scheduleCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      const lastCall = scheduleCalls[scheduleCalls.length - 1];
      if (lastCall && lastCall[0]) {
        // Simulate cleanup
        jest.clearAllMocks();
      }
    }

    const endMemory = manager['captureMemoryUsage']();
    const growthPercent = ((endMemory.heapUsed - startMemory.heapUsed) / startMemory.heapUsed) * 100;
    
    totalGrowth += growthPercent;

    iterationResults.push({
      iteration: iteration + 1,
      startMemory: startMemory.heapUsed,
      endMemory: endMemory.heapUsed,
      growthPercent,
    });

    logger.debug(`[Performance] Memory leak detection iteration ${iteration + 1}`, {
      startMemory: startMemory.heapUsed,
      endMemory: endMemory.heapUsed,
      growthPercent,
    });
  }

  const averageGrowth = totalGrowth / iterations;
  const memoryLeakDetected = averageGrowth > 5; // More than 5% average growth indicates potential leak

  let recommendation = 'Memory usage is within normal parameters.';
  if (memoryLeakDetected) {
    if (averageGrowth > 20) {
      recommendation = 'Significant memory leak detected. Review notification cleanup logic.';
    } else if (averageGrowth > 10) {
      recommendation = 'Moderate memory leak detected. Consider optimizing object lifecycle.';
    } else {
      recommendation = 'Minor memory growth detected. Monitor for trends in production.';
    }
  }

  logger.debug('[Performance] Memory leak detection completed', {
    memoryLeakDetected,
    memoryGrowthPercent: averageGrowth,
    recommendation,
  });

  return {
    memoryLeakDetected,
    memoryGrowthPercent: averageGrowth,
    iterationResults,
    recommendation,
  };
}

/**
 * Database performance profiling
 */
export async function profileDatabasePerformance(
  operationMix: {
    inserts: number;
    updates: number;
    deletes: number;
    queries: number;
  }
): Promise<{
  totalOperations: number;
  totalTime: number;
  operationBreakdown: Record<string, {
    count: number;
    totalTime: number;
    averageTime: number;
    operationsPerSecond: number;
  }>;
  recommendations: string[];
}> {
  const manager = new PerformanceTestManager();
  const mockDb = getCurrentMockScheduleDatabase();
  const operationBreakdown: Record<string, {
    count: number;
    totalTime: number;
    averageTime: number;
    operationsPerSecond: number;
  }> = {};

  const startTime = Date.now();

  // Inserts
  for (let i = 0; i < operationMix.inserts; i++) {
    const opStart = Date.now();
    mockDb.addMapping({
      scheduleId: `sched-prof-insert-${i}`,
      notificationId: `notif-prof-insert-${i}`,
      date: new Date().toISOString().split('T')[0],
      medicationId: `med-prof-insert-${i}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const opEnd = Date.now();
    manager.trackDatabaseOperation('insert', opEnd - opStart);
  }

  // Updates
  for (let i = 0; i < operationMix.updates; i++) {
    const opStart = Date.now();
    const mapping = mockDb.getMapping(`sched-prof-insert-${i % operationMix.inserts}`, new Date().toISOString().split('T')[0]);
    if (mapping) {
      mapping.updatedAt = Date.now();
    }
    const opEnd = Date.now();
    manager.trackDatabaseOperation('update', opEnd - opStart);
  }

  // Queries
  for (let i = 0; i < operationMix.queries; i++) {
    const opStart = Date.now();
    mockDb.getMapping(`sched-prof-insert-${i % operationMix.inserts}`, new Date().toISOString().split('T')[0]);
    const opEnd = Date.now();
    manager.trackDatabaseOperation('query', opEnd - opStart);
  }

  // Deletes
  for (let i = 0; i < operationMix.deletes; i++) {
    const opStart = Date.now();
    mockDb.removeMapping(`sched-prof-insert-${i}`, new Date().toISOString().split('T')[0]);
    const opEnd = Date.now();
    manager.trackDatabaseOperation('delete', opEnd - opStart);
  }

  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const totalOperations = operationMix.inserts + operationMix.updates + operationMix.deletes + operationMix.queries;

  const metrics = manager.stopProfiling();
  const dbMetrics = metrics.databaseOperations;

  // Calculate breakdown
  operationBreakdown.insert = {
    count: dbMetrics.insertOperations,
    totalTime: (dbMetrics.totalOperationTime * dbMetrics.insertOperations) / totalOperations,
    averageTime: dbMetrics.averageOperationTime,
    operationsPerSecond: (dbMetrics.insertOperations / totalTime) * 1000,
  };

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (dbMetrics.averageOperationTime > 50) {
    recommendations.push('Database operations are slower than expected. Consider indexing optimization.');
  }
  
  if (operationBreakdown.insert.operationsPerSecond < 100) {
    recommendations.push('Insert performance is below optimal. Review batch operation strategies.');
  }
  
  if (totalTime > 5000) {
    recommendations.push('Overall operation time is high. Consider implementing caching strategies.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Database performance is within acceptable parameters.');
  }

  logger.debug('[Performance] Database profiling completed', {
    totalOperations,
    totalTime,
    operationBreakdown,
    recommendations,
  });

  return {
    totalOperations,
    totalTime,
    operationBreakdown,
    recommendations,
  };
}

/**
 * Stress testing utility for high-load scenarios
 */
export async function stressTestNotificationScheduling(
  concurrentOperations: number = 50,
  _operationDuration: number = 5000 // ms
): Promise<{
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  operationsPerSecond: number;
  errorTypes: Record<string, number>;
  systemStability: 'stable' | 'unstable' | 'critical';
  recommendations: string[];
}> {
  const operations: Array<{
    id: string;
    startTime: number;
    endTime?: number;
    success: boolean;
    errorType?: string;
  }> = [];

  const errorTypes: Record<string, number> = {};
  const startTime = Date.now();

  // Launch concurrent operations
  const promises = Array.from({ length: concurrentOperations }, async (_, i) => {
    const operationId = `stress-${i}`;
    const operation = {
      id: operationId,
      startTime: Date.now(),
      success: false,
      endTime: undefined as number | undefined,
      errorType: undefined as string | undefined,
    };

    try {
      // Simulate varying operation complexity
      const notificationRequest = {
        content: {
          title: `Stress Test ${i}`,
          body: `Concurrent operation test`,
          data: {
            medicationId: `med-stress-${i}`,
            scheduleId: `sched-stress-${i}`,
          },
        },
        trigger: null,
      };

      await Notifications.scheduleNotificationAsync(notificationRequest);
      
      operation.success = true;
      operation.endTime = Date.now();
      
    } catch (error) {
      const errorType = error instanceof Error ? error.message : 'unknown_error';
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      operation.errorType = errorType;
      operation.endTime = Date.now();
    }

    operations.push(operation);
  });

  // Wait for all operations to complete or timeout
  try {
    await Promise.allSettled(promises);
  } catch (error) {
    logger.error('[Performance] Stress test encountered critical error', { error });
  }

  const endTime = Date.now();
  const totalTime = endTime - startTime;

  // Calculate metrics
  const successfulOperations = operations.filter(op => op.success).length;
  const failedOperations = operations.length - successfulOperations;
  
  const responseTimes = operations
    .filter(op => op.endTime)
    .map(op => op.endTime! - op.startTime);
  
  const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  const maxResponseTime = Math.max(...responseTimes);
  const minResponseTime = Math.min(...responseTimes);
  const operationsPerSecond = (operations.length / totalTime) * 1000;

  // Determine system stability
  let systemStability: 'stable' | 'unstable' | 'critical';
  const failureRate = failedOperations / operations.length;
  
  if (failureRate < 0.05) {
    systemStability = 'stable';
  } else if (failureRate < 0.2) {
    systemStability = 'unstable';
  } else {
    systemStability = 'critical';
  }

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (systemStability === 'critical') {
    recommendations.push('System is unstable under load. Implement circuit breaker patterns.');
  } else if (systemStability === 'unstable') {
    recommendations.push('System shows instability under load. Consider rate limiting.');
  }
  
  if (averageResponseTime > 1000) {
    recommendations.push('Response times are high. Optimize notification scheduling logic.');
  }
  
  if (operationsPerSecond < 10) {
    recommendations.push('Throughput is below expected levels. Review bottlenecks.');
  }

  if (recommendations.length === 0) {
    recommendations.push('System performs well under stress conditions.');
  }

  logger.debug('[Performance] Stress test completed', {
    totalOperations: operations.length,
    successfulOperations,
    failedOperations,
    systemStability,
    averageResponseTime,
    operationsPerSecond,
  });

  return {
    totalOperations: operations.length,
    successfulOperations,
    failedOperations,
    averageResponseTime,
    maxResponseTime,
    minResponseTime,
    operationsPerSecond,
    errorTypes,
    systemStability,
    recommendations,
  };
}

/**
 * Performance assertions for test validation
 */
export function assertPerformanceThresholds(
  result: BenchmarkResult,
  customThresholds?: Partial<PerformanceThresholds>
): void {
  const thresholds = {
    maxOperationTime: 100,
    maxMemoryUsage: 50 * 1024 * 1024,
    minOperationsPerSecond: 10,
    maxMemoryLeakPercent: 5,
    ...customThresholds,
  };

  if (result.averageTime > thresholds.maxOperationTime) {
    throw new Error(
      `Performance threshold exceeded: Average operation time ${result.averageTime}ms > ${thresholds.maxOperationTime}ms`
    );
  }

  if (result.peakMemoryUsage > thresholds.maxMemoryUsage) {
    throw new Error(
      `Performance threshold exceeded: Peak memory usage ${result.peakMemoryUsage} bytes > ${thresholds.maxMemoryUsage} bytes`
    );
  }

  if (result.operationsPerSecond < thresholds.minOperationsPerSecond) {
    throw new Error(
      `Performance threshold exceeded: Operations per second ${result.operationsPerSecond} < ${thresholds.minOperationsPerSecond}`
    );
  }

  if (result.memoryLeak) {
    throw new Error('Memory leak detected in performance test');
  }

  logger.debug('[Performance] All performance thresholds passed', {
    thresholds,
    actualResults: {
      averageTime: result.averageTime,
      peakMemoryUsage: result.peakMemoryUsage,
      operationsPerSecond: result.operationsPerSecond,
      memoryLeak: result.memoryLeak,
    },
  });
}