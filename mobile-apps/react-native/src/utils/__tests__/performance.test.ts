import { performanceMonitor, withQueryTiming, withRenderTiming } from '../performance';
import { logger } from '../logger';

// Mock the logger
jest.mock('../logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
}));

describe('performanceMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startTimer', () => {
    it('should create a timer that can be ended', () => {
      const timer = performanceMonitor.startTimer('test-operation');
      expect(timer).toHaveProperty('end');
      expect(timer).toHaveProperty('elapsed');
    });

    it('should measure elapsed time', async () => {
      const timer = performanceMonitor.startTimer('test-operation');

      // Wait a small amount
      await new Promise((resolve) => setTimeout(resolve, 10));

      const duration = timer.end();

      expect(duration).toBeGreaterThan(0);
      expect(typeof duration).toBe('number');
    });

    it('should log duration when timer ends', () => {
      const timer = performanceMonitor.startTimer('test-operation');
      timer.end();

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('⏱️ test-operation')
      );
    });

    it('should warn on slow operations', async () => {
      const timer = performanceMonitor.startTimer('slow-operation', {
        slowThreshold: 5,
      });

      // Wait longer than threshold
      await new Promise((resolve) => setTimeout(resolve, 10));

      timer.end();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ SLOW: slow-operation')
      );
    });

    it('should support silent mode', () => {
      const timer = performanceMonitor.startTimer('silent-operation', {
        silent: true,
      });
      timer.end();

      expect(logger.debug).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should allow checking elapsed time without ending timer', async () => {
      const timer = performanceMonitor.startTimer('test-operation');

      await new Promise((resolve) => setTimeout(resolve, 10));

      const elapsed1 = timer.elapsed();
      expect(elapsed1).toBeGreaterThan(0);

      await new Promise((resolve) => setTimeout(resolve, 5));

      const elapsed2 = timer.elapsed();
      expect(elapsed2).toBeGreaterThan(elapsed1);

      // Logger should not have been called yet
      expect(logger.debug).not.toHaveBeenCalled();

      timer.end();

      // Now logger should have been called
      expect(logger.debug).toHaveBeenCalled();
    });
  });

  describe('measure', () => {
    it('should measure async function execution', async () => {
      const testFn = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'result';
      });

      const result = await performanceMonitor.measure('async-operation', testFn);

      expect(result).toBe('result');
      expect(testFn).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('⏱️ async-operation')
      );
    });

    it('should handle errors and still log timing', async () => {
      const error = new Error('Test error');
      const testFn = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        throw error;
      });

      await expect(
        performanceMonitor.measure('failing-operation', testFn)
      ).rejects.toThrow('Test error');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ failing-operation failed after'),
        error
      );
    });

    it('should support slow threshold', async () => {
      const testFn = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'result';
      });

      await performanceMonitor.measure('slow-async', testFn, {
        slowThreshold: 5,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ SLOW: slow-async')
      );
    });
  });

  describe('measureSync', () => {
    it('should measure synchronous function execution', () => {
      const testFn = jest.fn(() => {
        // Simulate some work
        for (let i = 0; i < 1000; i++) {
          Math.sqrt(i);
        }
        return 'result';
      });

      const result = performanceMonitor.measureSync('sync-operation', testFn);

      expect(result).toBe('result');
      expect(testFn).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('⏱️ sync-operation')
      );
    });

    it('should handle sync errors and still log timing', () => {
      const error = new Error('Sync error');
      const testFn = jest.fn(() => {
        throw error;
      });

      expect(() =>
        performanceMonitor.measureSync('failing-sync', testFn)
      ).toThrow('Sync error');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ failing-sync failed after'),
        error
      );
    });
  });

  describe('mark', () => {
    it('should create performance marks', () => {
      // Mock performance.mark
      const mockMark = jest.fn();
      Object.defineProperty(global, 'performance', {
        value: {
          ...global.performance,
          mark: mockMark,
        },
        configurable: true,
      });

      performanceMonitor.mark('test-mark');

      expect(mockMark).toHaveBeenCalledWith('test-mark');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('📍 Performance mark: test-mark')
      );
    });

    it('should handle errors gracefully if Performance API unavailable', () => {
      const originalPerformance = global.performance;

      // Mock performance to throw
      Object.defineProperty(global, 'performance', {
        get: () => {
          throw new Error('Performance API not available');
        },
        configurable: true,
      });

      expect(() => performanceMonitor.mark('test-mark')).not.toThrow();

      // Restore
      Object.defineProperty(global, 'performance', {
        value: originalPerformance,
        configurable: true,
      });
    });
  });

  describe('measureBetweenMarks', () => {
    it('should measure duration between marks', () => {
      // Mock Performance API
      const mockMeasure = jest.fn();
      const mockGetEntriesByName = jest.fn().mockReturnValue([{ duration: 42.5 }]);
      const mockClearMarks = jest.fn();
      const mockClearMeasures = jest.fn();

      Object.defineProperty(global, 'performance', {
        value: {
          ...global.performance,
          mark: jest.fn(),
          measure: mockMeasure,
          getEntriesByName: mockGetEntriesByName,
          clearMarks: mockClearMarks,
          clearMeasures: mockClearMeasures,
        },
        configurable: true,
      });

      performanceMonitor.mark('start-mark');
      performanceMonitor.mark('end-mark');

      const duration = performanceMonitor.measureBetweenMarks(
        'operation-duration',
        'start-mark',
        'end-mark'
      );

      expect(mockMeasure).toHaveBeenCalledWith('operation-duration', 'start-mark', 'end-mark');
      expect(typeof duration).toBe('number');
      expect(duration).toBe(42.5);
    });

    it('should return undefined if marks do not exist', () => {
      // Mock Performance API that returns empty entries (marks don't exist)
      const mockMeasure = jest.fn();
      const mockGetEntriesByName = jest.fn().mockReturnValue([]);

      Object.defineProperty(global, 'performance', {
        value: {
          ...global.performance,
          measure: mockMeasure,
          getEntriesByName: mockGetEntriesByName,
        },
        configurable: true,
      });

      const duration = performanceMonitor.measureBetweenMarks(
        'missing-operation',
        'nonexistent-start',
        'nonexistent-end'
      );

      expect(duration).toBeUndefined();
    });
  });

  describe('logSummary', () => {
    it('should log performance summary without errors', () => {
      // Mock Performance API with entries
      const mockGetEntries = jest.fn().mockReturnValue([
        { entryType: 'mark', name: 'mark1', startTime: 100 },
        { entryType: 'mark', name: 'mark2', startTime: 200 },
        { entryType: 'measure', name: 'measure1', duration: 50 },
      ]);

      Object.defineProperty(global, 'performance', {
        value: {
          ...global.performance,
          getEntries: mockGetEntries,
        },
        configurable: true,
      });

      expect(() => performanceMonitor.logSummary()).not.toThrow();

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('📊 Performance Summary')
      );
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Total entries: 3')
      );
    });

    it('should handle errors gracefully', () => {
      const originalPerformance = global.performance;

      // Mock performance to throw
      Object.defineProperty(global, 'performance', {
        get: () => {
          throw new Error('Performance API not available');
        },
        configurable: true,
      });

      expect(() => performanceMonitor.logSummary()).not.toThrow();

      // Restore
      Object.defineProperty(global, 'performance', {
        value: originalPerformance,
        configurable: true,
      });
    });
  });
});

describe('withQueryTiming', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should wrap async queries with timing', async () => {
    const query = jest.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return ['row1', 'row2'];
    });

    const result = await withQueryTiming('test-query', query);

    expect(result).toEqual(['row1', 'row2']);
    expect(query).toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('⏱️ test-query')
    );
  });

  it('should warn on slow queries (> 100ms)', async () => {
    const slowQuery = jest.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return ['data'];
    });

    await withQueryTiming('slow-query', slowQuery);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('⚠️ SLOW: slow-query')
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('threshold: 100ms')
    );
  });
});

describe('withRenderTiming', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should wrap synchronous renders with timing', () => {
    const render = jest.fn(() => {
      // Simulate render work
      for (let i = 0; i < 100; i++) {
        Math.sqrt(i);
      }
      return 'rendered';
    });

    const result = withRenderTiming('MyComponent', render);

    expect(result).toBe('rendered');
    expect(render).toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('⏱️ MyComponent')
    );
  });

  it('should warn on slow renders (> 16ms)', () => {
    const slowRender = jest.fn(() => {
      // Simulate slow render
      const start = Date.now();
      while (Date.now() - start < 20) {
        // Busy wait
      }
      return 'rendered';
    });

    withRenderTiming('SlowComponent', slowRender);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('⚠️ SLOW: SlowComponent')
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('threshold: 16ms')
    );
  });
});
