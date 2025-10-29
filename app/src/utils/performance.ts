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
 * Usage:
 *   import { performanceMonitor } from '../utils/performance';
 *
 *   // Simple timer
 *   const timer = performanceMonitor.startTimer('database-query');
 *   await someOperation();
 *   timer.end(); // Logs: "⏱️ database-query: 45ms"
 *
 *   // With slow threshold
 *   const timer = performanceMonitor.startTimer('render', { slowThreshold: 16 });
 *   render();
 *   timer.end(); // Warns if > 16ms
 *
 *   // Measure function execution
 *   const result = await performanceMonitor.measure('fetch-data', async () => {
 *     return await fetchData();
 *   });
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
