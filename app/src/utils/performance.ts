/**
 * Performance Monitoring Utilities
 *
 * Provides lightweight performance measurement and monitoring for development.
 * All operations are no-ops in production to avoid overhead.
 *
 * Features:
 * - Timer utilities for measuring operation duration
 * - Performance marks and measures
 * - Automatic slow operation detection
 * - Integration with development logger
 *
 * Performance Budgets:
 * These thresholds are based on industry best practices and user perception research:
 *
 * - **16ms (60fps renders)**: Target for UI renders to maintain 60fps
 *   - Why: 1000ms / 60fps = 16.67ms per frame
 *   - Exceeding this causes dropped frames and janky UI
 *   - Used by: React Native render operations, animations
 *
 * - **100ms (database queries)**: Maximum acceptable time for local database operations
 *   - Why: Research shows users perceive <100ms as "instant"
 *   - Beyond 100ms, users notice the delay and it feels sluggish
 *   - Used by: SQLite queries, data access operations
 *
 * - **1000ms (network requests)**: Target for API calls and network operations
 *   - Why: Users expect network operations to take time, but >1s feels slow
 *   - Provides feedback before users become impatient
 *   - Used by: External API calls, data synchronization
 *
 * - **2000ms (app startup)**: Maximum acceptable cold start time
 *   - Why: 1s feels fast, 2s feels moderate, >2s feels slow
 *   - Critical for first impression and user retention
 *   - Used by: Application initialization, splash screen duration
 *
 * Usage:
 *   import { performanceMonitor } from '../utils/performance';
 *
 *   // Simple timer
 *   const timer = performanceMonitor.startTimer('database-query');
 *   await someOperation();
 *   timer.end(); // Logs: "⏱️ database-query: 45ms"
 *
 *   // With slow threshold (automatic warning if exceeded)
 *   const timer = performanceMonitor.startTimer('render', { slowThreshold: 16 });
 *   render();
 *   timer.end(); // Warns if > 16ms: "⚠️ SLOW: render took 25ms (threshold: 16ms)"
 *
 *   // Measure function execution
 *   const result = await performanceMonitor.measure('fetch-data', async () => {
 *     return await fetchData();
 *   }, { slowThreshold: 1000 });
 */

import { logger } from './logger';

/** Performance timer interface */
interface PerformanceTimer {
  /** End the timer and log the duration */
  end: () => number;
  /** Get elapsed time without ending the timer */
  elapsed: () => number;
}

/** Options for performance timing */
interface TimerOptions {
  /** Threshold in ms to trigger slow operation warning (default: none) */
  slowThreshold?: number;
  /** Whether to log the result (default: true) */
  silent?: boolean;
}

/** Performance metric entry */
interface PerformanceMetric {
  label: string;
  duration: number;
  timestamp: number;
  isSlow: boolean;
  threshold?: number;
}

/** Performance statistics */
interface PerformanceStats {
  totalOperations: number;
  averageDuration: number;
  slowOperations: number;
  metrics: PerformanceMetric[];
  startupTime?: number;
  appStartTime: number;
}

/** In-memory performance metrics store (dev only) */
class PerformanceMetricsStore {
  private metrics: PerformanceMetric[] = [];
  private startupTime?: number;
  private readonly appStartTime: number = Date.now();
  private readonly maxMetrics = 100; // Keep last 100 metrics

  recordMetric(
    label: string,
    duration: number,
    slowThreshold?: number
  ): void {
    if (!__DEV__) return;

    const metric: PerformanceMetric = {
      label,
      duration,
      timestamp: Date.now(),
      isSlow: slowThreshold ? duration > slowThreshold : false,
      threshold: slowThreshold,
    };

    this.metrics.push(metric);

    // Keep only last maxMetrics entries
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Record app startup time
    if (label === 'app-startup') {
      this.startupTime = duration;
    }
  }

  getStats(): PerformanceStats {
    if (!__DEV__) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        slowOperations: 0,
        metrics: [],
        appStartTime: this.appStartTime,
      };
    }

    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const slowCount = this.metrics.filter((m) => m.isSlow).length;

    return {
      totalOperations: this.metrics.length,
      averageDuration:
        this.metrics.length > 0 ? totalDuration / this.metrics.length : 0,
      slowOperations: slowCount,
      metrics: [...this.metrics].reverse(), // Most recent first
      startupTime: this.startupTime,
      appStartTime: this.appStartTime,
    };
  }

  clear(): void {
    if (!__DEV__) return;
    this.metrics = [];
    this.startupTime = undefined;
  }
}

const metricsStore = new PerformanceMetricsStore();

/**
 * Performance monitoring utilities
 * Only active in development mode (__DEV__)
 */
export const performanceMonitor = {
  /**
   * Start a timer to measure operation duration
   *
   * @param label - Label for the operation being measured
   * @param options - Timer configuration options
   * @returns Timer object with end() and elapsed() methods
   *
   * @example
   * const timer = performanceMonitor.startTimer('database-query', {
   *   slowThreshold: 100
   * });
   * await db.getAllAsync(query);
   * const duration = timer.end(); // Logs and returns duration
   */
  startTimer(label: string, options: TimerOptions = {}): PerformanceTimer {
    if (!__DEV__) {
      // No-op in production
      return {
        end: () => 0,
        elapsed: () => 0,
      };
    }

    const startTime = performance.now();
    const { slowThreshold, silent = false } = options;

    return {
      end: (): number => {
        const duration = performance.now() - startTime;
        const durationMs = Math.round(duration * 100) / 100; // Round to 2 decimal places

        // Record metric in store
        metricsStore.recordMetric(label, durationMs, slowThreshold);

        if (!silent) {
          if (slowThreshold && duration > slowThreshold) {
            logger.warn(
              `⚠️ SLOW: ${label} took ${durationMs}ms (threshold: ${slowThreshold}ms)`
            );
          } else {
            logger.debug(`⏱️ ${label}: ${durationMs}ms`);
          }
        }

        return durationMs;
      },

      elapsed: (): number => {
        return Math.round((performance.now() - startTime) * 100) / 100;
      },
    };
  },

  /**
   * Measure the execution time of a function
   *
   * @param label - Label for the operation
   * @param fn - Function to measure
   * @param options - Timer configuration options
   * @returns The result of the function
   *
   * @example
   * const data = await performanceMonitor.measure('fetch-users', async () => {
   *   return await api.fetchUsers();
   * }, { slowThreshold: 1000 });
   */
  async measure<T>(
    label: string,
    fn: () => Promise<T>,
    options: TimerOptions = {}
  ): Promise<T> {
    if (!__DEV__) {
      // No overhead in production
      return fn();
    }

    const timer = this.startTimer(label, options);
    try {
      const result = await fn();
      timer.end();
      return result;
    } catch (error) {
      const duration = timer.elapsed();
      logger.error(`❌ ${label} failed after ${duration}ms:`, error);
      throw error;
    }
  },

  /**
   * Measure the execution time of a synchronous function
   *
   * @param label - Label for the operation
   * @param fn - Synchronous function to measure
   * @param options - Timer configuration options
   * @returns The result of the function
   *
   * @example
   * const result = performanceMonitor.measureSync('parse-json', () => {
   *   return JSON.parse(data);
   * });
   */
  measureSync<T>(label: string, fn: () => T, options: TimerOptions = {}): T {
    if (!__DEV__) {
      // No overhead in production
      return fn();
    }

    const timer = this.startTimer(label, options);
    try {
      const result = fn();
      timer.end();
      return result;
    } catch (error) {
      const duration = timer.elapsed();
      logger.error(`❌ ${label} failed after ${duration}ms:`, error);
      throw error;
    }
  },

  /**
   * Mark a point in time for later measurement
   * Uses the Performance API when available
   *
   * @param name - Name of the performance mark
   *
   * @example
   * performanceMonitor.mark('app-start');
   * // ... app initialization
   * performanceMonitor.mark('app-ready');
   * performanceMonitor.measureBetweenMarks('app-startup', 'app-start', 'app-ready');
   */
  mark(name: string): void {
    if (!__DEV__) {
      return;
    }

    try {
      if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark(name);
        logger.debug(`📍 Performance mark: ${name}`);
      }
    } catch (error) {
      // Silently fail if Performance API not available
      logger.debug(`Could not create performance mark ${name}:`, error);
    }
  },

  /**
   * Measure duration between two performance marks
   *
   * @param label - Label for the measurement
   * @param startMark - Name of the start mark
   * @param endMark - Name of the end mark
   * @returns Duration in milliseconds, or undefined if marks don't exist
   *
   * @example
   * performanceMonitor.mark('query-start');
   * await db.query();
   * performanceMonitor.mark('query-end');
   * performanceMonitor.measureBetweenMarks('query-time', 'query-start', 'query-end');
   */
  measureBetweenMarks(
    label: string,
    startMark: string,
    endMark: string
  ): number | undefined {
    if (!__DEV__) {
      return undefined;
    }

    try {
      if (typeof performance !== 'undefined' && performance.measure) {
        performance.measure(label, startMark, endMark);

        const entries = performance.getEntriesByName(label, 'measure');
        if (entries.length > 0) {
          const duration = Math.round(entries[0].duration * 100) / 100;
          logger.debug(`⏱️ ${label}: ${duration}ms (${startMark} → ${endMark})`);

          // Clean up
          performance.clearMarks(startMark);
          performance.clearMarks(endMark);
          performance.clearMeasures(label);

          return duration;
        }
      }
    } catch (error) {
      logger.debug(`Could not measure between marks ${startMark} and ${endMark}:`, error);
    }

    return undefined;
  },

  /**
   * Log current performance metrics summary
   * Useful for debugging or development insights
   */
  logSummary(): void {
    if (!__DEV__) {
      return;
    }

    try {
      if (typeof performance !== 'undefined') {
        const entries = performance.getEntries();

        logger.log('📊 Performance Summary:');
        logger.log(`  Total entries: ${entries.length}`);

        const marks = entries.filter((e) => e.entryType === 'mark');
        const measures = entries.filter((e) => e.entryType === 'measure');

        if (marks.length > 0) {
          logger.log(`  Marks: ${marks.length}`);
          marks.forEach((mark) => {
            logger.log(`    - ${mark.name}: ${Math.round(mark.startTime)}ms`);
          });
        }

        if (measures.length > 0) {
          logger.log(`  Measures: ${measures.length}`);
          measures.forEach((measure) => {
            logger.log(
              `    - ${measure.name}: ${Math.round(measure.duration)}ms`
            );
          });
        }
      }
    } catch (error) {
      logger.debug('Could not log performance summary:', error);
    }
  },
};

/**
 * Convenience wrapper for database query timing
 * Specifically designed for database operations with appropriate thresholds
 *
 * @example
 * const result = await withQueryTiming('getAllEpisodes', async () => {
 *   return await db.getAllAsync('SELECT * FROM episodes');
 * });
 */
export async function withQueryTiming<T>(
  queryLabel: string,
  query: () => Promise<T>
): Promise<T> {
  return performanceMonitor.measure(queryLabel, query, {
    slowThreshold: 100, // 100ms is considered slow for a query
  });
}

/**
 * Convenience wrapper for render timing
 * Uses 16ms threshold (60fps target)
 *
 * @example
 * const result = withRenderTiming('MyComponent', () => {
 *   return renderComponent();
 * });
 */
export function withRenderTiming<T>(label: string, render: () => T): T {
  return performanceMonitor.measureSync(label, render, {
    slowThreshold: 16, // 16ms for 60fps
  });
}

/**
 * Get current performance statistics
 * Returns metrics collected during this app session
 *
 * @example
 * const stats = getPerformanceStats();
 * console.log(`Total operations: ${stats.totalOperations}`);
 * console.log(`Startup time: ${stats.startupTime}ms`);
 */
export function getPerformanceStats(): PerformanceStats {
  return metricsStore.getStats();
}

/**
 * Clear all collected performance metrics
 * Useful for resetting stats during development
 *
 * @example
 * clearPerformanceStats();
 */
export function clearPerformanceStats(): void {
  metricsStore.clear();
}

// Export types for use in components
export type { PerformanceStats, PerformanceMetric };
