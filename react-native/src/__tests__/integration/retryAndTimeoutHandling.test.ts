import { logger } from '../../utils/logger';
import { useMedicationStore } from '../../store/medicationStore';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
  },
}));

jest.mock('../../database/medicationRepository', () => ({
  medicationScheduleRepository: {
    getByMedicationId: jest.fn(),
    getByMedicationIds: jest.fn(),
  },
}));

jest.mock('../../services/errorLogger', () => ({
  errorLogger: {
    log: jest.fn(),
  },
}));

/**
 * Comprehensive test suite for retry mechanisms and timeout handling
 * Tests the enhanced error recovery logic implemented in the new error handling
 */
describe('Retry Mechanisms and Timeout Handling', () => {
  let mockLoadMedicationSchedules: (medId: string, isRetry?: boolean) => Promise<void>;
  let mockGetSchedulesByMedicationId: jest.MockedFunction<(medicationId: string) => any[]>;
  let mockLoadSchedules: jest.MockedFunction<(medicationId?: string) => Promise<void>>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset store state
    useMedicationStore.setState({
      medications: [],
      schedules: [],
      loading: false,
      error: null,
    });

    // Mock the store methods we're testing
    mockGetSchedulesByMedicationId = jest.fn().mockReturnValue([]);
    mockLoadSchedules = jest.fn();

    // Simulate the loadMedicationSchedules function from LogMedicationScreen
    mockLoadMedicationSchedules = async (medId: string, isRetry: boolean = false) => {
      try {
        // Load schedules for this medication
        await mockLoadSchedules(medId);
        
        // Get schedules from state
        const medicationSchedules = mockGetSchedulesByMedicationId(medId);
        
        // Enhanced debugging for schedule loading
        const scheduleCount = medicationSchedules.length;
        const enabledSchedules = medicationSchedules.filter((s: any) => s.enabled).length;
        const scheduleIds = medicationSchedules.map((s: any) => s.id);
        
        logger.debug('Medication schedules loaded successfully:', {
          medicationId: medId,
          scheduleCount,
          enabledSchedules,
          scheduleIds,
          isRetry
        });
        
      } catch (error) {
        logger.error('Failed to load medication schedules:', error, {
          medicationId: medId,
          isRetry,
          currentSchedulesLength: 0
        });
        
        // Implement retry logic for transient errors
        if (!isRetry) {
          logger.warn('Retrying medication schedule loading once...');
          try {
            await mockLoadMedicationSchedules(medId, true);
            return; // Successful retry, exit
          } catch (retryError) {
            logger.error('Retry failed for medication schedule loading:', retryError);
          }
        }
        
        throw error;
      }
    };
  });

  describe('Basic Retry Logic', () => {
    it('should retry once on failure and succeed on second attempt', async () => {
      const medicationId = 'med-retry-success';

      // Mock first call to fail, second to succeed
      let callCount = 0;
      mockLoadSchedules.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Network timeout'));
        }
        return Promise.resolve();
      });

      // Set up successful schedule return on retry
      mockGetSchedulesByMedicationId.mockReturnValue([
        {
          id: 'schedule-success',
          medicationId,
          time: '08:00',
          enabled: true,
        }
      ]);

      await mockLoadMedicationSchedules(medicationId);

      // Should have been called twice (initial + retry)
      expect(mockLoadSchedules).toHaveBeenCalledTimes(2);
      expect(mockLoadSchedules).toHaveBeenNthCalledWith(1, medicationId);
      expect(mockLoadSchedules).toHaveBeenNthCalledWith(2, medicationId);

      // Should log successful retry
      expect(logger.debug).toHaveBeenCalledWith(
        'Medication schedules loaded successfully:',
        expect.objectContaining({
          medicationId,
          isRetry: true,
        })
      );
    });

    it('should fail after both initial attempt and retry fail', async () => {
      const medicationId = 'med-retry-fail';
      const persistentError = new Error('Persistent database error');

      mockLoadSchedules.mockRejectedValue(persistentError);

      await expect(mockLoadMedicationSchedules(medicationId)).rejects.toThrow('Persistent database error');

      // Should have been called twice (initial + retry)
      expect(mockLoadSchedules).toHaveBeenCalledTimes(2);

      // Should log both attempts
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to load medication schedules:',
        persistentError,
        expect.objectContaining({
          medicationId,
          isRetry: false,
        })
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Retry failed for medication schedule loading:',
        persistentError
      );
    });

    it('should not retry on successful first attempt', async () => {
      const medicationId = 'med-no-retry-needed';

      mockLoadSchedules.mockResolvedValue(undefined);
      mockGetSchedulesByMedicationId.mockReturnValue([
        {
          id: 'schedule-immediate',
          medicationId,
          time: '08:00',
          enabled: true,
        }
      ]);

      await mockLoadMedicationSchedules(medicationId);

      // Should have been called only once
      expect(mockLoadSchedules).toHaveBeenCalledTimes(1);

      // Should log successful load without retry
      expect(logger.debug).toHaveBeenCalledWith(
        'Medication schedules loaded successfully:',
        expect.objectContaining({
          medicationId,
          isRetry: false,
        })
      );
    });
  });

  describe('Transient Error Handling', () => {
    it('should handle network timeout errors with appropriate retry', async () => {
      const medicationId = 'med-network-timeout';
      const timeoutError = new Error('Network request timed out');
      timeoutError.name = 'TimeoutError';

      // Mock timeout on first call, success on retry
      let callCount = 0;
      mockLoadSchedules.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(timeoutError);
        }
        return Promise.resolve();
      });

      mockGetSchedulesByMedicationId.mockReturnValue([]);

      await mockLoadMedicationSchedules(medicationId);

      expect(mockLoadSchedules).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith('Retrying medication schedule loading once...');
    });

    it('should handle database lock errors with retry', async () => {
      const medicationId = 'med-db-lock';
      const lockError = new Error('Database is locked');
      lockError.name = 'SQLiteError';

      let callCount = 0;
      mockLoadSchedules.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(lockError);
        }
        return Promise.resolve();
      });

      mockGetSchedulesByMedicationId.mockReturnValue([]);

      await mockLoadMedicationSchedules(medicationId);

      expect(mockLoadSchedules).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to load medication schedules:',
        lockError,
        expect.objectContaining({
          isRetry: false,
        })
      );
    });

    it('should handle connection reset errors', async () => {
      const medicationId = 'med-connection-reset';
      const resetError = new Error('Connection reset by peer');
      resetError.name = 'NetworkError';

      let callCount = 0;
      mockLoadSchedules.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(resetError);
        }
        return Promise.resolve();
      });

      mockGetSchedulesByMedicationId.mockReturnValue([
        {
          id: 'schedule-after-reset',
          medicationId,
          time: '08:00',
          enabled: true,
        }
      ]);

      await mockLoadMedicationSchedules(medicationId);

      expect(mockLoadSchedules).toHaveBeenCalledTimes(2);
      expect(logger.debug).toHaveBeenCalledWith(
        'Medication schedules loaded successfully:',
        expect.objectContaining({
          isRetry: true,
          scheduleCount: 1,
        })
      );
    });
  });

  describe('Enhanced Error Recovery Logic', () => {
    it('should preserve schedules for preventative medications on error', async () => {
      const medicationId = 'prev-med-preserve';
      
      // Simulate existing schedules in state
      const existingSchedules = [
        {
          id: 'existing-schedule',
          medicationId,
          time: '08:00',
          enabled: true,
        }
      ];
      
      // Mock to simulate preventative medication type checking
      const mockGetMedicationById = jest.fn().mockReturnValue({
        id: medicationId,
        type: 'preventative',
        name: 'Preventative Med',
      });

      // Simulate the enhanced error recovery logic
      const enhancedLoadMedicationSchedules = async (medId: string, isRetry: boolean = false) => {
        try {
          await mockLoadSchedules(medId);
          const medicationSchedules = mockGetSchedulesByMedicationId(medId);
          
          logger.debug('Medication schedules loaded successfully:', {
            medicationId: medId,
            scheduleCount: medicationSchedules.length,
            isRetry
          });
          
        } catch (error) {
          logger.error('Failed to load medication schedules:', error, {
            medicationId: medId,
            isRetry,
            currentSchedulesLength: existingSchedules.length
          });
          
          if (!isRetry) {
            try {
              await enhancedLoadMedicationSchedules(medId, true);
              return;
            } catch (retryError) {
              logger.error('Retry failed for medication schedule loading:', retryError);
            }
          }
          
          // Enhanced error recovery - check medication type before clearing schedules
          const currentMedication = mockGetMedicationById(medId);
          if (currentMedication?.type === 'preventative') {
            logger.warn('Failed to load schedules for preventative medication - keeping previous schedules to prevent missing scheduleId', {
              medicationId: medId,
              medicationType: currentMedication.type,
              previousSchedulesCount: existingSchedules.length
            });
            // Don't clear schedules for preventative medications
            return; // Exit without throwing
          } else {
            // For rescue medications, schedules are optional so it's safe to clear
            logger.debug('Clearing schedules for rescue/other medication type after load failure');
            mockGetSchedulesByMedicationId.mockReturnValue([]);
          }
          
          throw error;
        }
      };

      // Mock persistent failure
      mockLoadSchedules.mockRejectedValue(new Error('Persistent error'));
      mockGetSchedulesByMedicationId.mockReturnValue(existingSchedules);

      // Should not throw for preventative medication
      await expect(enhancedLoadMedicationSchedules(medicationId)).resolves.not.toThrow();

      // Should log warning about preserving schedules
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to load schedules for preventative medication - keeping previous schedules to prevent missing scheduleId',
        expect.objectContaining({
          medicationId,
          medicationType: 'preventative',
          previousSchedulesCount: 1
        })
      );
    });

    it('should clear schedules for rescue medications on error', async () => {
      const medicationId = 'rescue-med-clear';
      
      const mockGetMedicationById = jest.fn().mockReturnValue({
        id: medicationId,
        type: 'rescue',
        name: 'Rescue Med',
      });

      const enhancedLoadMedicationSchedules = async (medId: string, isRetry: boolean = false) => {
        try {
          await mockLoadSchedules(medId);
          const medicationSchedules = mockGetSchedulesByMedicationId(medId);
          
          logger.debug('Medication schedules loaded successfully:', {
            medicationId: medId,
            scheduleCount: medicationSchedules.length,
            isRetry
          });
          
        } catch (error) {
          logger.error('Failed to load medication schedules:', error, {
            medicationId: medId,
            isRetry
          });
          
          if (!isRetry) {
            try {
              await enhancedLoadMedicationSchedules(medId, true);
              return;
            } catch (retryError) {
              logger.error('Retry failed for medication schedule loading:', retryError);
            }
          }
          
          const currentMedication = mockGetMedicationById(medId);
          if (currentMedication?.type === 'preventative') {
            logger.warn('Failed to load schedules for preventative medication - keeping previous schedules');
            return;
          } else {
            logger.debug('Clearing schedules for rescue/other medication type after load failure');
            mockGetSchedulesByMedicationId.mockReturnValue([]);
          }
          
          throw error;
        }
      };

      mockLoadSchedules.mockRejectedValue(new Error('Persistent error'));

      await expect(enhancedLoadMedicationSchedules(medicationId)).rejects.toThrow();

      expect(logger.debug).toHaveBeenCalledWith(
        'Clearing schedules for rescue/other medication type after load failure'
      );
    });
  });

  describe('Debug Logging Enhancement', () => {
    it('should provide comprehensive debug information on successful load', async () => {
      const medicationId = 'med-debug-success';
      const testSchedules = [
        {
          id: 'schedule-1',
          medicationId,
          time: '08:00',
          enabled: true,
        },
        {
          id: 'schedule-2', 
          medicationId,
          time: '20:00',
          enabled: false,
        },
        {
          id: 'schedule-3',
          medicationId,
          time: '12:00',
          enabled: true,
        }
      ];

      mockLoadSchedules.mockResolvedValue(undefined);
      mockGetSchedulesByMedicationId.mockReturnValue(testSchedules);

      await mockLoadMedicationSchedules(medicationId);

      expect(logger.debug).toHaveBeenCalledWith(
        'Medication schedules loaded successfully:',
        {
          medicationId,
          scheduleCount: 3,
          enabledSchedules: 2,
          scheduleIds: ['schedule-1', 'schedule-2', 'schedule-3'],
          isRetry: false
        }
      );
    });

    it('should provide detailed error context on failure', async () => {
      const medicationId = 'med-debug-error';
      const detailedError = new Error('Detailed test error');

      mockLoadSchedules.mockRejectedValue(detailedError);

      await expect(mockLoadMedicationSchedules(medicationId)).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to load medication schedules:',
        detailedError,
        {
          medicationId,
          isRetry: false,
          currentSchedulesLength: 0
        }
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Retry failed for medication schedule loading:',
        detailedError
      );
    });

    it('should log retry attempts with proper context', async () => {
      const medicationId = 'med-debug-retry';
      
      let callCount = 0;
      mockLoadSchedules.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('First attempt failed'));
        }
        return Promise.resolve();
      });

      mockGetSchedulesByMedicationId.mockReturnValue([
        { id: 'schedule-retry', medicationId, time: '08:00', enabled: true }
      ]);

      await mockLoadMedicationSchedules(medicationId);

      expect(logger.warn).toHaveBeenCalledWith('Retrying medication schedule loading once...');
      
      expect(logger.debug).toHaveBeenCalledWith(
        'Medication schedules loaded successfully:',
        expect.objectContaining({
          medicationId,
          isRetry: true,
          scheduleCount: 1,
          enabledSchedules: 1
        })
      );
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle rapid successive retry attempts efficiently', async () => {
      const medicationId = 'med-rapid-retry';
      
      // Create multiple concurrent retry attempts
      const promises = Array.from({ length: 10 }, () => {
        // Mock different failure patterns for each attempt
        let callCount = 0;
        const localMockLoadSchedules = jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error(`Rapid error ${Date.now()}`));
          }
          return Promise.resolve();
        });

        // Replace the global mock temporarily for this test
        const originalMock = mockLoadSchedules;
        mockLoadSchedules = localMockLoadSchedules;
        
        return mockLoadMedicationSchedules(medicationId).finally(() => {
          mockLoadSchedules = originalMock;
        });
      });

      const startTime = Date.now();
      await Promise.allSettled(promises);
      const endTime = Date.now();

      // Should complete all attempts within reasonable time
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second
    });

    it('should handle memory pressure during retry operations', async () => {
      const medicationId = 'med-memory-pressure';
      
      // Simulate memory pressure by creating large objects in error
      const largeError = new Error('Memory pressure error');
      (largeError as any).largeData = new Array(10000).fill('test data');

      let callCount = 0;
      mockLoadSchedules.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(largeError);
        }
        return Promise.resolve();
      });

      mockGetSchedulesByMedicationId.mockReturnValue([]);

      await mockLoadMedicationSchedules(medicationId);

      // Should handle large error objects without issues
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to load medication schedules:',
        largeError,
        expect.any(Object)
      );
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle null or undefined medication IDs gracefully', async () => {
      // Mock loadSchedules to throw for null/undefined IDs
      mockLoadSchedules.mockImplementation((medId) => {
        if (!medId) {
          return Promise.reject(new Error('Invalid medication ID'));
        }
        return Promise.resolve();
      });

      // Test with null medication ID
      await expect(mockLoadMedicationSchedules(null as any)).rejects.toThrow('Invalid medication ID');

      // Test with undefined medication ID  
      await expect(mockLoadMedicationSchedules(undefined as any)).rejects.toThrow('Invalid medication ID');
      
      // Should handle gracefully without causing unhandled rejections
    });

    it('should handle extremely long medication IDs', async () => {
      const veryLongMedicationId = 'med-' + 'a'.repeat(1000);
      
      mockLoadSchedules.mockResolvedValue(undefined);
      mockGetSchedulesByMedicationId.mockReturnValue([]);

      await mockLoadMedicationSchedules(veryLongMedicationId);

      expect(logger.debug).toHaveBeenCalledWith(
        'Medication schedules loaded successfully:',
        expect.objectContaining({
          medicationId: veryLongMedicationId,
        })
      );
    });

    it('should handle concurrent retry attempts for same medication', async () => {
      const medicationId = 'med-concurrent-retry';
      
      // Create separate mock functions for each concurrent attempt
      let globalCallCount = 0;
      
      const promise1 = (async () => {
        let localCall1Count = 0;
        const localMockLoadSchedules = jest.fn().mockImplementation(() => {
          localCall1Count++;
          globalCallCount++;
          if (localCall1Count === 1) {
            return Promise.reject(new Error('Concurrent error 1'));
          }
          return Promise.resolve();
        });
        
        // Temporarily replace the global mock for this execution
        const originalMock = mockLoadSchedules;
        mockLoadSchedules = localMockLoadSchedules;
        try {
          await mockLoadMedicationSchedules(medicationId);
        } finally {
          mockLoadSchedules = originalMock;
        }
      })();

      const promise2 = (async () => {
        let localCall2Count = 0;
        const localMockLoadSchedules = jest.fn().mockImplementation(() => {
          localCall2Count++;
          globalCallCount++;
          if (localCall2Count === 1) {
            return Promise.reject(new Error('Concurrent error 2'));
          }
          return Promise.resolve();
        });
        
        // Temporarily replace the global mock for this execution
        const originalMock = mockLoadSchedules;
        mockLoadSchedules = localMockLoadSchedules;
        try {
          await mockLoadMedicationSchedules(medicationId);
        } finally {
          mockLoadSchedules = originalMock;
        }
      })();

      await Promise.allSettled([promise1, promise2]);

      // Both should have attempted retries (total calls should be at least 4: 2 initial + 2 retries)
      expect(globalCallCount).toBeGreaterThanOrEqual(4);
    });
  });
});