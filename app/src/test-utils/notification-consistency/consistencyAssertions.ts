/**
 * Consistency Assertion Helpers
 * 
 * Provides specialized assertion utilities for verifying notification-schedule consistency.
 * These helpers check for schedule ID synchronization across notification and database layers.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as Notifications from 'expo-notifications';
import { Medication, MedicationSchedule } from '../../models/types';
import { logger } from '../../utils/logger';
import { getCurrentMockScheduleDatabase } from './scheduleTestHelpers';

export interface ConsistencyCheckResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  details: Record<string, unknown> & {
    checkedMappings?: number;
    medicationNotifications?: number;
    dailyCheckinNotifications?: number;
    duplicateMappings?: number;
    conflicts?: number;
    [key: string]: unknown;
  };
}

/**
 * Cross-layer ID verification utilities
 */
export async function verifyScheduleIdSynchronization(
  medications: Medication[],
  schedules: MedicationSchedule[]
): Promise<ConsistencyCheckResult> {
  const result: ConsistencyCheckResult = {
    passed: true,
    errors: [],
    warnings: [],
    details: {
      medicationCount: medications.length,
      scheduleCount: schedules.length,
      checkedMappings: 0,
    },
  };

  try {
    const scheduleCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
    const mockDb = getCurrentMockScheduleDatabase();
    const today = new Date().toISOString().split('T')[0];

    // Check each schedule has consistent ID across layers
    for (const schedule of schedules) {
      if (!schedule.enabled) continue;

      // Find corresponding medication
      const medication = medications.find(m => m.id === schedule.medicationId);
      if (!medication) {
        result.errors.push(`Schedule ${schedule.id} references non-existent medication ${schedule.medicationId}`);
        result.passed = false;
        continue;
      }

      // Check notification was scheduled with correct schedule ID
      const notificationCall = scheduleCalls.find(call => {
        const data = call[0]?.content?.data;
        return data?.medicationId === medication.id && data?.scheduleId === schedule.id;
      });

      if (!notificationCall) {
        result.errors.push(`No notification scheduled for medication ${medication.id} with schedule ${schedule.id}`);
        result.passed = false;
        continue;
      }

      // Check database mapping exists
      const dbMapping = mockDb.getMapping(schedule.id, today);
      if (!dbMapping) {
        result.errors.push(`No database mapping found for schedule ${schedule.id} on ${today}`);
        result.passed = false;
        continue;
      }

      // Verify IDs match across all layers
      const notificationData = notificationCall[0].content.data;
      if (notificationData.scheduleId !== schedule.id) {
        result.errors.push(
          `Schedule ID mismatch: notification has ${notificationData.scheduleId}, expected ${schedule.id}`
        );
        result.passed = false;
      }

      if (dbMapping.scheduleId !== schedule.id) {
        result.errors.push(
          `Database mapping schedule ID mismatch: DB has ${dbMapping.scheduleId}, expected ${schedule.id}`
        );
        result.passed = false;
      }

      if (dbMapping.medicationId !== medication.id) {
        result.errors.push(
          `Database mapping medication ID mismatch: DB has ${dbMapping.medicationId}, expected ${medication.id}`
        );
        result.passed = false;
      }

      result.details.checkedMappings = (result.details.checkedMappings as number || 0) + 1;
    }

    logger.debug('[Consistency] Schedule ID synchronization check completed', result);
    return result;

  } catch (error) {
    result.passed = false;
    result.errors.push(`Synchronization check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Verify notification data integrity across all scheduled notifications
 */
export async function verifyNotificationDataIntegrity(): Promise<ConsistencyCheckResult> {
  const result: ConsistencyCheckResult = {
    passed: true,
    errors: [],
    warnings: [],
    details: {
      notificationCount: 0,
      medicationNotifications: 0,
      dailyCheckinNotifications: 0,
    },
  };

  try {
    const scheduleCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
    result.details.notificationCount = scheduleCalls.length;

    for (const call of scheduleCalls) {
      const request = call[0];
      
      // Basic structure validation
      if (!request.content) {
        result.errors.push('Notification request missing content');
        result.passed = false;
        continue;
      }

      if (!request.content.title) {
        result.errors.push('Notification content missing title');
        result.passed = false;
      }

      if (!request.content.body) {
        result.errors.push('Notification content missing body');
        result.passed = false;
      }

      if (!request.trigger) {
        result.errors.push('Notification request missing trigger');
        result.passed = false;
      }

      // Data payload validation
      const data = request.content.data;
      if (data) {
        if (data.medicationId) {
          result.details.medicationNotifications = (result.details.medicationNotifications as number || 0) + 1;
          
          // Medication notification validation
          if (!data.medicationId.match(/^med-/)) {
            result.warnings.push(`Unexpected medication ID format: ${data.medicationId}`);
          }
          
          if (data.scheduleId && !data.scheduleId.match(/^sched-/)) {
            result.warnings.push(`Unexpected schedule ID format: ${data.scheduleId}`);
          }
          
          // Verify preventative medications have schedule IDs
          if (data.medicationType === 'preventative' && !data.scheduleId) {
            result.warnings.push(`Preventative medication ${data.medicationId} missing schedule ID`);
          }
        }
        
        if (data.notificationType === 'daily-checkin') {
          result.details.dailyCheckinNotifications = (result.details.dailyCheckinNotifications as number || 0) + 1;
        }
      }

      // Trigger validation
      if (request.trigger) {
        if (request.trigger.type === 'daily') {
          const hour = request.trigger.hour;
          const minute = request.trigger.minute;
          
          if (hour < 0 || hour >= 24) {
            result.errors.push(`Invalid hour in daily trigger: ${hour}`);
            result.passed = false;
          }
          
          if (minute < 0 || minute >= 60) {
            result.errors.push(`Invalid minute in daily trigger: ${minute}`);
            result.passed = false;
          }
        } else if (request.trigger.type === 'date') {
          const triggerDate = new Date(request.trigger.date);
          if (isNaN(triggerDate.getTime())) {
            result.errors.push(`Invalid date in trigger: ${request.trigger.date}`);
            result.passed = false;
          }
        }
      }
    }

    logger.debug('[Consistency] Notification data integrity check completed', result);
    return result;

  } catch (error) {
    result.passed = false;
    result.errors.push(`Data integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Verify database referential integrity
 */
export async function verifyDatabaseReferentialIntegrity(): Promise<ConsistencyCheckResult> {
  const result: ConsistencyCheckResult = {
    passed: true,
    errors: [],
    warnings: [],
    details: {
      mappingCount: 0,
      orphanedMappings: 0,
      duplicateMappings: 0,
    },
  };

  try {
    const mockDb = getCurrentMockScheduleDatabase();
    const mappings = mockDb.getAllMappings();
    result.details.mappingCount = mappings.length;

    const seenKeys = new Set<string>();

    for (const mapping of mappings) {
      // Check for duplicates
      const key = `${mapping.scheduleId}-${mapping.date}`;
      if (seenKeys.has(key)) {
        result.errors.push(`Duplicate mapping found: ${key}`);
        result.details.duplicateMappings = (result.details.duplicateMappings as number || 0) + 1;
        result.passed = false;
      }
      seenKeys.add(key);

      // Validate required fields
      if (!mapping.scheduleId || !mapping.medicationId || !mapping.notificationId) {
        result.errors.push(`Invalid mapping missing required fields: ${JSON.stringify(mapping)}`);
        result.passed = false;
      }

      // Validate ID formats
      if (!mapping.scheduleId.match(/^sched-/)) {
        result.warnings.push(`Unexpected schedule ID format: ${mapping.scheduleId}`);
      }

      if (!mapping.medicationId.match(/^med-/)) {
        result.warnings.push(`Unexpected medication ID format: ${mapping.medicationId}`);
      }

      if (!mapping.notificationId.match(/^(mock-)?notif-/)) {
        result.warnings.push(`Unexpected notification ID format: ${mapping.notificationId}`);
      }

      // Validate timestamps
      if (mapping.createdAt <= 0 || mapping.updatedAt <= 0) {
        result.errors.push(`Invalid timestamps in mapping: ${mapping.scheduleId}`);
        result.passed = false;
      }

      if (mapping.updatedAt < mapping.createdAt) {
        result.errors.push(`Invalid timestamp order in mapping: ${mapping.scheduleId}`);
        result.passed = false;
      }

      // Validate date format
      if (!mapping.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        result.errors.push(`Invalid date format in mapping: ${mapping.date}`);
        result.passed = false;
      }
    }

    logger.debug('[Consistency] Database referential integrity check completed', result);
    return result;

  } catch (error) {
    result.passed = false;
    result.errors.push(`Referential integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Verify no scheduling conflicts exist
 */
export async function verifyNoSchedulingConflicts(): Promise<ConsistencyCheckResult> {
  const result: ConsistencyCheckResult = {
    passed: true,
    errors: [],
    warnings: [],
    details: {
      timeSlots: 0,
      conflicts: 0,
    },
  };

  try {
    const scheduleCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
    const timeSlotMap = new Map<string, any[]>();

    // Group notifications by time slot
    for (const call of scheduleCalls) {
      const request = call[0];
      let timeKey = '';

      if (request.trigger?.type === 'daily') {
        timeKey = `${request.trigger.hour}:${request.trigger.minute.toString().padStart(2, '0')}`;
      } else if (request.trigger?.type === 'date') {
        const date = new Date(request.trigger.date);
        timeKey = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
      }

      if (timeKey) {
        if (!timeSlotMap.has(timeKey)) {
          timeSlotMap.set(timeKey, []);
        }
        timeSlotMap.get(timeKey)!.push(request);
      }
    }

    result.details.timeSlots = timeSlotMap.size;

    // Check for problematic conflicts
    for (const [timeSlot, notifications] of timeSlotMap) {
      if (notifications.length > 3) {
        result.warnings.push(`Many notifications at ${timeSlot}: ${notifications.length}`);
      }

      // Check for medication conflicts (same medication scheduled multiple times)
      const medicationIds = new Set<string>();
      for (const notification of notifications) {
        const medicationId = notification.content?.data?.medicationId;
        if (medicationId) {
          if (medicationIds.has(medicationId)) {
            result.errors.push(`Duplicate medication notification at ${timeSlot}: ${medicationId}`);
            result.details.conflicts = (result.details.conflicts as number || 0) + 1;
            result.passed = false;
          }
          medicationIds.add(medicationId);
        }
      }
    }

    logger.debug('[Consistency] Scheduling conflict check completed', result);
    return result;

  } catch (error) {
    result.passed = false;
    result.errors.push(`Scheduling conflict check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Comprehensive consistency verification
 */
export async function verifyComprehensiveConsistency(
  medications: Medication[],
  schedules: MedicationSchedule[]
): Promise<ConsistencyCheckResult> {
  const checks = [
    () => verifyScheduleIdSynchronization(medications, schedules),
    () => verifyNotificationDataIntegrity(),
    () => verifyDatabaseReferentialIntegrity(),
    () => verifyNoSchedulingConflicts(),
  ];

  const results = await Promise.all(checks.map(check => check()));
  
  const comprehensiveResult: ConsistencyCheckResult = {
    passed: results.every(r => r.passed),
    errors: results.flatMap(r => r.errors),
    warnings: results.flatMap(r => r.warnings),
    details: {
      checksRun: results.length,
      checksPassed: results.filter(r => r.passed).length,
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      totalWarnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
          individualResults: results,
    },
  };

  logger.debug('[Consistency] Comprehensive consistency check completed', comprehensiveResult);
  return comprehensiveResult;
}

/**
 * Assert helpers that throw on failure
 */
export async function assertScheduleIdSynchronization(
  medications: Medication[],
  schedules: MedicationSchedule[]
): Promise<void> {
  const result = await verifyScheduleIdSynchronization(medications, schedules);
  
  if (!result.passed) {
    const errorMessage = `Schedule ID synchronization failed:\n${result.errors.join('\n')}`;
    throw new Error(errorMessage);
  }
}

export async function assertNotificationDataIntegrity(): Promise<void> {
  const result = await verifyNotificationDataIntegrity();
  
  if (!result.passed) {
    const errorMessage = `Notification data integrity check failed:\n${result.errors.join('\n')}`;
    throw new Error(errorMessage);
  }
}

export async function assertDatabaseReferentialIntegrity(): Promise<void> {
  const result = await verifyDatabaseReferentialIntegrity();
  
  if (!result.passed) {
    const errorMessage = `Database referential integrity check failed:\n${result.errors.join('\n')}`;
    throw new Error(errorMessage);
  }
}

export async function assertNoSchedulingConflicts(): Promise<void> {
  const result = await verifyNoSchedulingConflicts();
  
  if (!result.passed) {
    const errorMessage = `Scheduling conflict check failed:\n${result.errors.join('\n')}`;
    throw new Error(errorMessage);
  }
}

export async function assertComprehensiveConsistency(
  medications: Medication[],
  schedules: MedicationSchedule[]
): Promise<void> {
  const result = await verifyComprehensiveConsistency(medications, schedules);
  
  if (!result.passed) {
    const errorMessage = `Comprehensive consistency check failed:\n${result.errors.join('\n')}`;
    throw new Error(errorMessage);
  }
}

/**
 * Race condition and graceful failure assertion utilities for Task 4
 */

/**
 * Verify graceful handling of schedule ID mismatches
 */
export async function verifyGracefulScheduleMismatchHandling(
  medicationId: string,
  invalidScheduleId: string,
  validScheduleIds: string[]
): Promise<ConsistencyCheckResult> {
  const result: ConsistencyCheckResult = {
    passed: true,
    errors: [],
    warnings: [],
    details: {
      medicationId,
      invalidScheduleId,
      validScheduleIds: validScheduleIds.length,
      errorHandlingVerified: false,
      userNotificationVerified: false,
      loggingVerified: false,
    },
  };

  try {
    const { logger } = require('../../utils/logger');
    
    // Check that error was logged with proper context
    const logCalls = (logger.error as jest.Mock).mock.calls;
    const relevantLogCall = logCalls.find(call => {
      const [, context] = call;
      return context?.medicationId === medicationId && 
             context?.scheduleId === invalidScheduleId &&
             context?.component === 'NotificationConsistency';
    });

    if (relevantLogCall) {
      result.details.loggingVerified = true;
      
      // Verify error context includes helpful information
      const [, context] = relevantLogCall;
      if (context?.availableScheduleIds) {
        result.details.errorHandlingVerified = true;
      }

      // Verify operation was properly identified
      if (context?.operation) {
        result.details.userNotificationVerified = true;
      }
    } else {
      result.errors.push(`No error log found for schedule mismatch: medicationId=${medicationId}, scheduleId=${invalidScheduleId}`);
      result.passed = false;
    }

    logger.debug('[Consistency] Graceful schedule mismatch handling verified', result);
    return result;

  } catch (error) {
    result.passed = false;
    result.errors.push(`Graceful handling verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Verify race condition detection and recovery
 */
export async function verifyRaceConditionRecovery(
  medicationId: string,
  originalScheduleId: string,
  newScheduleId: string
): Promise<ConsistencyCheckResult> {
  const result: ConsistencyCheckResult = {
    passed: true,
    errors: [],
    warnings: [],
    details: {
      medicationId,
      originalScheduleId,
      newScheduleId,
      raceConditionDetected: false,
      recoveryAttempted: false,
      finalStateConsistent: false,
    },
  };

  try {
    const mockDb = getCurrentMockScheduleDatabase();
    const today = new Date().toISOString().split('T')[0];
    
    // Check for presence of old schedule mapping
    const oldMapping = mockDb.getMapping(originalScheduleId, today);
    const newMapping = mockDb.getMapping(newScheduleId, today);
    
    if (oldMapping && newMapping) {
      result.details.raceConditionDetected = true;
      result.warnings.push(`Race condition detected: both old and new schedule mappings exist`);
    }
    
    // Verify recovery was attempted (one of the mappings should be cleaned up)
    if (result.details.raceConditionDetected) {
      // Check if system attempted to resolve the conflict
      const finalMappingCount = [oldMapping, newMapping].filter(Boolean).length;
      if (finalMappingCount === 1) {
        result.details.recoveryAttempted = true;
        result.details.finalStateConsistent = true;
      } else {
        result.errors.push(`Race condition recovery failed: ${finalMappingCount} mappings remain`);
        result.passed = false;
      }
    } else {
      // No race condition detected, verify only new mapping exists
      if (newMapping && !oldMapping) {
        result.details.finalStateConsistent = true;
      } else if (oldMapping && !newMapping) {
        result.warnings.push('Schedule update may not have completed successfully');
      }
    }

    logger.debug('[Consistency] Race condition recovery verified', result);
    return result;

  } catch (error) {
    result.passed = false;
    result.errors.push(`Race condition recovery verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Verify cleanup operations maintain consistency
 */
export async function verifyCleanupConsistency(): Promise<ConsistencyCheckResult> {
  const result: ConsistencyCheckResult = {
    passed: true,
    errors: [],
    warnings: [],
    details: {
      totalMappings: 0,
      orphanedMappings: 0,
      invalidMappings: 0,
      cleanupRequired: false,
    },
  };

  try {
    const mockDb = getCurrentMockScheduleDatabase();
    const allMappings = mockDb.getAllMappings();
    result.details.totalMappings = allMappings.length;

    // Check for orphaned mappings (mappings without corresponding notifications)
    const scheduleCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
    const scheduledIds = new Set(
      scheduleCalls.map(call => call[0]?.content?.data?.scheduleId).filter(Boolean)
    );

    let orphanedCount = 0;
    let invalidCount = 0;

    for (const mapping of allMappings) {
      // Check if mapping corresponds to a scheduled notification
      if (!scheduledIds.has(mapping.scheduleId)) {
        orphanedCount++;
      }

      // Check mapping validity
      if (!mapping.scheduleId?.match(/^sched-/) || 
          !mapping.medicationId?.match(/^med-/) ||
          !mapping.notificationId) {
        invalidCount++;
      }
    }

    result.details.orphanedMappings = orphanedCount;
    result.details.invalidMappings = invalidCount;

    if (orphanedCount > 0) {
      result.warnings.push(`${orphanedCount} orphaned mappings found`);
      result.details.cleanupRequired = true;
    }

    if (invalidCount > 0) {
      result.errors.push(`${invalidCount} invalid mappings found`);
      result.passed = false;
    }

    logger.debug('[Consistency] Cleanup consistency verified', result);
    return result;

  } catch (error) {
    result.passed = false;
    result.errors.push(`Cleanup consistency verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Verify notification firing error handling
 */
export async function verifyNotificationErrorHandling(
  expectedErrors: Array<{
    medicationId: string;
    scheduleId: string;
    errorType: string;
  }>
): Promise<ConsistencyCheckResult> {
  const result: ConsistencyCheckResult = {
    passed: true,
    errors: [],
    warnings: [],
    details: {
      expectedErrors: expectedErrors.length,
      actualErrors: 0,
      matchedErrors: 0,
      errorTypes: {},
    },
  };

  try {
    const { logger } = require('../../utils/logger');
    const logCalls = (logger.error as jest.Mock).mock.calls;
    
    let actualErrors = 0;
    let matchedErrors = 0;
    const errorTypes: Record<string, number> = {};

    // Analyze logged errors
    for (const call of logCalls) {
      const [, context] = call;
      
      if (context?.component === 'NotificationConsistency') {
        actualErrors++;
        
        const errorType = context.operation || 'unknown';
        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
        
        // Check if this error matches one of the expected errors
        const expectedError = expectedErrors.find(expected => 
          context.medicationId === expected.medicationId &&
          context.scheduleId === expected.scheduleId
        );
        
        if (expectedError) {
          matchedErrors++;
        }
      }
    }

    result.details.actualErrors = actualErrors;
    result.details.matchedErrors = matchedErrors;
    result.details.errorTypes = errorTypes;

    // Verify all expected errors were logged
    if (matchedErrors < expectedErrors.length) {
      result.errors.push(`Only ${matchedErrors}/${expectedErrors.length} expected errors were logged`);
      result.passed = false;
    }

    // Check for unexpected errors
    if (actualErrors > expectedErrors.length) {
      result.warnings.push(`${actualErrors - expectedErrors.length} unexpected errors logged`);
    }

    logger.debug('[Consistency] Notification error handling verified', result);
    return result;

  } catch (error) {
    result.passed = false;
    result.errors.push(`Notification error handling verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Verify concurrent operation safety
 */
export async function verifyConcurrentOperationSafety(
  operationResults: Array<{
    success: boolean;
    medicationId: string;
    scheduleId: string;
    operationType: string;
  }>
): Promise<ConsistencyCheckResult> {
  const result: ConsistencyCheckResult = {
    passed: true,
    errors: [],
    warnings: [],
    details: {
      totalOperations: operationResults.length,
      successfulOperations: 0,
      failedOperations: 0,
      concurrencyIssues: 0,
      dataIntegrity: true,
    },
  };

  try {
    // Analyze operation results
    const successful = operationResults.filter(op => op.success);
    const failed = operationResults.filter(op => !op.success);
    
    result.details.successfulOperations = successful.length;
    result.details.failedOperations = failed.length;

    // Check for potential concurrency issues
    const medicationGroups = new Map<string, any[]>();
    for (const op of operationResults) {
      const key = `${op.medicationId}-${op.scheduleId}`;
      if (!medicationGroups.has(key)) {
        medicationGroups.set(key, []);
      }
      medicationGroups.get(key)!.push(op);
    }

    // Detect concurrent operations on same medication/schedule
    let concurrencyIssues = 0;
    for (const [key, operations] of medicationGroups) {
      if (operations.length > 1) {
        // Multiple operations on same resource
        const successCount = operations.filter(op => op.success).length;
        if (successCount !== 1 && successCount !== 0) {
          // Multiple successful operations might indicate data corruption
          concurrencyIssues++;
          result.warnings.push(`Multiple successful operations on ${key}: ${successCount}`);
        }
      }
    }

    result.details.concurrencyIssues = concurrencyIssues;

    // Verify data integrity
    const dataIntegrityResult = await verifyDatabaseReferentialIntegrity();
    result.details.dataIntegrity = dataIntegrityResult.passed;
    
    if (!dataIntegrityResult.passed) {
      result.errors.push('Data integrity compromised after concurrent operations');
      result.passed = false;
    }

    logger.debug('[Consistency] Concurrent operation safety verified', result);
    return result;

  } catch (error) {
    result.passed = false;
    result.errors.push(`Concurrent operation safety verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Assert helpers for race condition scenarios
 */

export async function assertGracefulScheduleMismatchHandling(
  medicationId: string,
  invalidScheduleId: string,
  validScheduleIds: string[]
): Promise<void> {
  const result = await verifyGracefulScheduleMismatchHandling(medicationId, invalidScheduleId, validScheduleIds);
  
  if (!result.passed) {
    const errorMessage = `Graceful schedule mismatch handling verification failed:\n${result.errors.join('\n')}`;
    throw new Error(errorMessage);
  }
}

export async function assertRaceConditionRecovery(
  medicationId: string,
  originalScheduleId: string,
  newScheduleId: string
): Promise<void> {
  const result = await verifyRaceConditionRecovery(medicationId, originalScheduleId, newScheduleId);
  
  if (!result.passed) {
    const errorMessage = `Race condition recovery verification failed:\n${result.errors.join('\n')}`;
    throw new Error(errorMessage);
  }
}

export async function assertCleanupConsistency(): Promise<void> {
  const result = await verifyCleanupConsistency();
  
  if (!result.passed) {
    const errorMessage = `Cleanup consistency verification failed:\n${result.errors.join('\n')}`;
    throw new Error(errorMessage);
  }
}

export async function assertNotificationErrorHandling(
  expectedErrors: Array<{
    medicationId: string;
    scheduleId: string;
    errorType: string;
  }>
): Promise<void> {
  const result = await verifyNotificationErrorHandling(expectedErrors);
  
  if (!result.passed) {
    const errorMessage = `Notification error handling verification failed:\n${result.errors.join('\n')}`;
    throw new Error(errorMessage);
  }
}

export async function assertConcurrentOperationSafety(
  operationResults: Array<{
    success: boolean;
    medicationId: string;
    scheduleId: string;
    operationType: string;
  }>
): Promise<void> {
  const result = await verifyConcurrentOperationSafety(operationResults);
  
  if (!result.passed) {
    const errorMessage = `Concurrent operation safety verification failed:\n${result.errors.join('\n')}`;
    throw new Error(errorMessage);
  }
}