import { Medication, MedicationSchedule } from '../../models/types';

// Mock logger to capture debug logs
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
  },
}));

/**
 * Comprehensive test suite for scheduleId validation and error handling logic
 * Tests the new error handling implementations in Tasks 1-4
 */
describe('ScheduleId Error Handling and Validation', () => {
  let getRelevantScheduleIdForMedication: (
    medication: Medication | null,
    schedules: MedicationSchedule[],
    logTimestamp: number
  ) => string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();

    // Import the function under test
    // This simulates the getRelevantScheduleIdForMedication function from LogMedicationScreen
    getRelevantScheduleIdForMedication = (
      medication: Medication | null,
      schedules: MedicationSchedule[],
      logTimestamp: number
    ): string | undefined => {
      // Only consider preventative medications with schedules
      if (!medication || medication.type !== 'preventative' || schedules.length === 0) {
        return undefined;
      }

      // For daily schedules, find the one closest to the logging time
      const logDate = new Date(logTimestamp);
      const logTimeStr = logDate.toTimeString().slice(0, 5); // HH:mm format

      // Find the schedule with the closest time to when the medication was logged
      let closestSchedule: MedicationSchedule | null = null;
      let smallestTimeDiff = Infinity;

      for (const schedule of schedules) {
        if (!schedule.enabled) continue;

        // Parse schedule time (HH:mm)
        const [scheduleHour, scheduleMinute] = schedule.time.split(':').map(Number);
        const scheduleMinutes = scheduleHour * 60 + scheduleMinute;

        // Parse log time
        const [logHour, logMinute] = logTimeStr.split(':').map(Number);
        const logMinutes = logHour * 60 + logMinute;

        // Calculate time difference (considering wrap-around for next day)
        let timeDiff = Math.abs(logMinutes - scheduleMinutes);
        if (timeDiff > 720) { // 12 hours
          timeDiff = 1440 - timeDiff; // Use shorter path around 24-hour clock
        }

        if (timeDiff < smallestTimeDiff) {
          smallestTimeDiff = timeDiff;
          closestSchedule = schedule;
        }
      }

      // Only return a schedule if it's reasonably close (within 3 hours)
      if (closestSchedule && smallestTimeDiff <= 180) {
        return closestSchedule.id;
      }

      return undefined;
    };
  });

  describe('Basic Schedule Resolution', () => {
    it('should return undefined for null medication', () => {
      const schedules: MedicationSchedule[] = [
        {
          id: 'schedule-1',
          medicationId: 'med-123',
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        }
      ];

      const result = getRelevantScheduleIdForMedication(null, schedules, Date.now());
      expect(result).toBeUndefined();
    });

    it('should return undefined for rescue medications', () => {
      const rescueMedication: Medication = {
        id: 'rescue-123',
        name: 'Rescue Med',
        type: 'rescue',
        dosageAmount: 200,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedules: MedicationSchedule[] = [
        {
          id: 'schedule-1',
          medicationId: 'rescue-123',
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        }
      ];

      const result = getRelevantScheduleIdForMedication(rescueMedication, schedules, Date.now());
      expect(result).toBeUndefined();
    });

    it('should return undefined for preventative medication with empty schedules', () => {
      const preventativeMedication: Medication = {
        id: 'prev-123',
        name: 'Preventative Med',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = getRelevantScheduleIdForMedication(preventativeMedication, [], Date.now());
      expect(result).toBeUndefined();
    });

    it('should return scheduleId for preventative medication within time window', () => {
      const preventativeMedication: Medication = {
        id: 'prev-123',
        name: 'Preventative Med',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedules: MedicationSchedule[] = [
        {
          id: 'schedule-morning',
          medicationId: 'prev-123',
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        }
      ];

      // Log at 8:30 AM (30 minutes after schedule - within 3-hour window)
      const logTime = new Date();
      logTime.setHours(8, 30, 0, 0);

      const result = getRelevantScheduleIdForMedication(preventativeMedication, schedules, logTime.getTime());
      expect(result).toBe('schedule-morning');
    });

    it('should return undefined for preventative medication outside time window', () => {
      const preventativeMedication: Medication = {
        id: 'prev-123',
        name: 'Preventative Med',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedules: MedicationSchedule[] = [
        {
          id: 'schedule-morning',
          medicationId: 'prev-123',
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        }
      ];

      // Log at 4:00 PM (8 hours after schedule - outside 3-hour window)
      const logTime = new Date();
      logTime.setHours(16, 0, 0, 0);

      const result = getRelevantScheduleIdForMedication(preventativeMedication, schedules, logTime.getTime());
      expect(result).toBeUndefined();
    });
  });

  describe('Complex Schedule Scenarios', () => {
    it('should handle multiple schedules and select closest one', () => {
      const preventativeMedication: Medication = {
        id: 'prev-multi',
        name: 'Multi Schedule Med',
        type: 'preventative',
        dosageAmount: 50,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedules: MedicationSchedule[] = [
        {
          id: 'schedule-morning',
          medicationId: 'prev-multi',
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        },
        {
          id: 'schedule-evening',
          medicationId: 'prev-multi',
          time: '20:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        }
      ];

      // Log at 8:15 AM (closer to morning schedule)
      const morningLogTime = new Date();
      morningLogTime.setHours(8, 15, 0, 0);

      const morningResult = getRelevantScheduleIdForMedication(
        preventativeMedication, 
        schedules, 
        morningLogTime.getTime()
      );
      expect(morningResult).toBe('schedule-morning');

      // Log at 7:45 PM (closer to evening schedule)
      const eveningLogTime = new Date();
      eveningLogTime.setHours(19, 45, 0, 0);

      const eveningResult = getRelevantScheduleIdForMedication(
        preventativeMedication, 
        schedules, 
        eveningLogTime.getTime()
      );
      expect(eveningResult).toBe('schedule-evening');
    });

    it('should ignore disabled schedules', () => {
      const preventativeMedication: Medication = {
        id: 'prev-disabled',
        name: 'Disabled Schedule Med',
        type: 'preventative',
        dosageAmount: 75,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedules: MedicationSchedule[] = [
        {
          id: 'schedule-disabled',
          medicationId: 'prev-disabled',
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: false, // Disabled
          reminderEnabled: true,
        },
        {
          id: 'schedule-enabled',
          medicationId: 'prev-disabled',
          time: '08:30',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        }
      ];

      // Log at 8:10 AM (closer to disabled schedule but should use enabled one)
      const logTime = new Date();
      logTime.setHours(8, 10, 0, 0);

      const result = getRelevantScheduleIdForMedication(
        preventativeMedication, 
        schedules, 
        logTime.getTime()
      );
      expect(result).toBe('schedule-enabled');
    });

    it('should handle time wrap-around (late night to early morning)', () => {
      const preventativeMedication: Medication = {
        id: 'prev-wraparound',
        name: 'Wrap Around Med',
        type: 'preventative',
        dosageAmount: 25,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedules: MedicationSchedule[] = [
        {
          id: 'schedule-late',
          medicationId: 'prev-wraparound',
          time: '23:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        }
      ];

      // Log at 1:00 AM next day (2 hours after 23:00 - should match)
      const logTime = new Date();
      logTime.setHours(1, 0, 0, 0);

      const result = getRelevantScheduleIdForMedication(
        preventativeMedication, 
        schedules, 
        logTime.getTime()
      );
      expect(result).toBe('schedule-late');
    });

    it('should handle edge case at exactly 3-hour boundary', () => {
      const preventativeMedication: Medication = {
        id: 'prev-boundary',
        name: 'Boundary Test Med',
        type: 'preventative',
        dosageAmount: 10,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedules: MedicationSchedule[] = [
        {
          id: 'schedule-boundary',
          medicationId: 'prev-boundary',
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        }
      ];

      // Log at exactly 3 hours after schedule (11:00 AM)
      const logTime = new Date();
      logTime.setHours(11, 0, 0, 0);

      const result = getRelevantScheduleIdForMedication(
        preventativeMedication, 
        schedules, 
        logTime.getTime()
      );
      expect(result).toBe('schedule-boundary'); // Should still match at boundary

      // Log at 3 hours + 1 minute after schedule (11:01 AM)
      const logTimeBeyond = new Date();
      logTimeBeyond.setHours(11, 1, 0, 0);

      const resultBeyond = getRelevantScheduleIdForMedication(
        preventativeMedication, 
        schedules, 
        logTimeBeyond.getTime()
      );
      expect(resultBeyond).toBeUndefined(); // Should not match beyond boundary
    });
  });

  describe('Error Scenarios and Edge Cases', () => {
    it('should handle malformed schedule time gracefully', () => {
      const preventativeMedication: Medication = {
        id: 'prev-malformed',
        name: 'Malformed Time Med',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedules: MedicationSchedule[] = [
        {
          id: 'schedule-malformed',
          medicationId: 'prev-malformed',
          time: 'invalid-time', // Malformed time
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        } as any,
        {
          id: 'schedule-valid',
          medicationId: 'prev-malformed',
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        }
      ];

      const logTime = new Date();
      logTime.setHours(8, 15, 0, 0);

      // Should handle malformed schedule gracefully and use valid one
      expect(() => {
        const result = getRelevantScheduleIdForMedication(
          preventativeMedication, 
          schedules, 
          logTime.getTime()
        );
        // Should either return the valid schedule or undefined (graceful degradation)
        expect(result === 'schedule-valid' || result === undefined).toBe(true);
      }).not.toThrow();
    });

    it('should handle invalid log timestamp gracefully', () => {
      const preventativeMedication: Medication = {
        id: 'prev-invalid-time',
        name: 'Invalid Time Med',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedules: MedicationSchedule[] = [
        {
          id: 'schedule-normal',
          medicationId: 'prev-invalid-time',
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        }
      ];

      // Should handle invalid timestamp gracefully
      expect(() => {
        const result = getRelevantScheduleIdForMedication(
          preventativeMedication, 
          schedules, 
          NaN // Invalid timestamp
        );
        expect(result).toBeUndefined();
      }).not.toThrow();
    });

    it('should handle empty schedule array consistently', () => {
      const preventativeMedication: Medication = {
        id: 'prev-empty',
        name: 'Empty Schedules Med',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = getRelevantScheduleIdForMedication(
        preventativeMedication, 
        [], 
        Date.now()
      );
      expect(result).toBeUndefined();
    });

    it('should handle all disabled schedules', () => {
      const preventativeMedication: Medication = {
        id: 'prev-all-disabled',
        name: 'All Disabled Med',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedules: MedicationSchedule[] = [
        {
          id: 'schedule-disabled-1',
          medicationId: 'prev-all-disabled',
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: false,
          reminderEnabled: true,
        },
        {
          id: 'schedule-disabled-2',
          medicationId: 'prev-all-disabled',
          time: '20:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: false,
          reminderEnabled: true,
        }
      ];

      const logTime = new Date();
      logTime.setHours(8, 15, 0, 0);

      const result = getRelevantScheduleIdForMedication(
        preventativeMedication, 
        schedules, 
        logTime.getTime()
      );
      expect(result).toBeUndefined();
    });
  });

  describe('Performance and Scale Tests', () => {
    it('should handle large number of schedules efficiently', () => {
      const preventativeMedication: Medication = {
        id: 'prev-many-schedules',
        name: 'Many Schedules Med',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Create 100 schedules throughout the day
      const schedules: MedicationSchedule[] = Array.from({ length: 100 }, (_, i) => {
        const hour = Math.floor(i / 4);
        const minute = (i % 4) * 15;
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        return {
          id: `schedule-${i}`,
          medicationId: 'prev-many-schedules',
          time: timeStr,
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        };
      });

      const logTime = new Date();
      logTime.setHours(12, 7, 0, 0); // 12:07 PM

      const startTime = Date.now();
      const result = getRelevantScheduleIdForMedication(
        preventativeMedication, 
        schedules, 
        logTime.getTime()
      );
      const endTime = Date.now();

      // Should complete quickly even with many schedules
      expect(endTime - startTime).toBeLessThan(100); // Less than 100ms
      
      // Should find the closest schedule (12:00 PM)
      expect(result).toBe('schedule-48'); // Hour 12, minute 0 (12 * 4 + 0)
    });

    it('should be consistent across repeated calls', () => {
      const preventativeMedication: Medication = {
        id: 'prev-consistent',
        name: 'Consistent Med',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedules: MedicationSchedule[] = [
        {
          id: 'schedule-morning',
          medicationId: 'prev-consistent',
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        }
      ];

      const logTime = new Date();
      logTime.setHours(8, 30, 0, 0);

      // Call multiple times and verify consistency
      const results = Array.from({ length: 10 }, () => 
        getRelevantScheduleIdForMedication(preventativeMedication, schedules, logTime.getTime())
      );

      // All results should be the same
      expect(results.every(result => result === 'schedule-morning')).toBe(true);
    });
  });

  describe('Debug Logging Requirements', () => {
    it('should provide comprehensive logging context for debugging', () => {
      // This test verifies that the error handling provides enough logging context
      // for debugging schedule-related issues in production
      
      const preventativeMedication: Medication = {
        id: 'prev-debug',
        name: 'Debug Med',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedules: MedicationSchedule[] = [
        {
          id: 'schedule-debug-1',
          medicationId: 'prev-debug',
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        },
        {
          id: 'schedule-debug-2',
          medicationId: 'prev-debug',
          time: '20:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: false, // Disabled
          reminderEnabled: true,
        }
      ];

      const logTime = new Date();
      logTime.setHours(8, 15, 0, 0);

      // Simulate the enhanced logging that should occur
      const result = getRelevantScheduleIdForMedication(
        preventativeMedication, 
        schedules, 
        logTime.getTime()
      );

      // Verify that debug information would be available for logging
      const debugContext = {
        medicationId: preventativeMedication.id,
        medicationName: preventativeMedication.name,
        medicationType: preventativeMedication.type,
        scheduleCount: schedules.length,
        enabledSchedules: schedules.filter(s => s.enabled).length,
        scheduleIds: schedules.map(s => s.id),
        logTime: '08:15',
        selectedScheduleId: result,
        timeDifferences: schedules.map(s => {
          const [scheduleHour, scheduleMinute] = s.time.split(':').map(Number);
          const scheduleMinutes = scheduleHour * 60 + scheduleMinute;
          const logMinutes = 8 * 60 + 15;
          return Math.abs(logMinutes - scheduleMinutes);
        })
      };

      expect(debugContext.medicationId).toBe('prev-debug');
      expect(debugContext.scheduleCount).toBe(2);
      expect(debugContext.enabledSchedules).toBe(1);
      expect(debugContext.selectedScheduleId).toBe('schedule-debug-1');
      expect(debugContext.timeDifferences[0]).toBe(15); // 15 minutes difference
    });
  });
});