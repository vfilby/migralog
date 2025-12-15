/**
 * Advanced Assertion Utilities for Notification-Schedule Consistency Testing
 * 
 * Provides sophisticated verification utilities for multi-layer consistency checks,
 * performance thresholds, and data integrity deep validation beyond basic assertions.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as Notifications from 'expo-notifications';
import { Medication, MedicationSchedule } from '../../models/types';
import { logger } from '../../utils/logger';
import { getCurrentMockScheduleDatabase } from './scheduleTestHelpers';

export interface MultiLayerConsistencyResult {
  passed: boolean;
  layers: {
    notification: LayerValidationResult;
    database: LayerValidationResult;
    store: LayerValidationResult;
    crossLayer: LayerValidationResult;
  };
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    warningCount: number;
    criticalIssues: string[];
  };
  recommendations: string[];
}

export interface LayerValidationResult {
  name: string;
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    details: any;
    severity: 'info' | 'warning' | 'error' | 'critical';
    message: string;
  }>;
  metrics: Record<string, number>;
}

export interface PerformanceAssertionResult {
  passed: boolean;
  thresholds: PerformanceThresholds;
  actual: PerformanceActuals;
  violations: Array<{
    metric: string;
    threshold: number;
    actual: number;
    severity: 'minor' | 'major' | 'critical';
    impact: string;
  }>;
  recommendations: string[];
}

export interface PerformanceThresholds {
  maxResponseTime: number;
  maxMemoryUsage: number;
  minThroughput: number;
  maxErrorRate: number;
  maxDatabaseQueryTime: number;
  maxConcurrentOperations: number;
}

export interface PerformanceActuals {
  responseTime: number;
  memoryUsage: number;
  throughput: number;
  errorRate: number;
  databaseQueryTime: number;
  concurrentOperations: number;
}

export interface DataIntegrityCheckResult {
  passed: boolean;
  referentialIntegrity: boolean;
  dataConsistency: boolean;
  constraintViolations: Array<{
    type: 'primary_key' | 'foreign_key' | 'unique' | 'not_null' | 'check' | 'custom';
    description: string;
    affectedRecords: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    autoFixable: boolean;
  }>;
  orphanedData: {
    notifications: number;
    schedules: number;
    mappings: number;
  };
  duplicates: {
    medications: number;
    schedules: number;
    notifications: number;
  };
  corruptedRecords: Array<{
    type: string;
    id: string;
    corruption: string;
    recoverable: boolean;
  }>;
}

/**
 * Advanced Multi-Layer Consistency Verification
 */
export async function assertMultiLayerConsistency(
  medications: Medication[],
  schedules: MedicationSchedule[],
  strictMode: boolean = false
): Promise<MultiLayerConsistencyResult> {
  const result: MultiLayerConsistencyResult = {
    passed: true,
    layers: {
      notification: { name: 'Notification Layer', passed: true, checks: [], metrics: {} },
      database: { name: 'Database Layer', passed: true, checks: [], metrics: {} },
      store: { name: 'Store Layer', passed: true, checks: [], metrics: {} },
      crossLayer: { name: 'Cross-Layer', passed: true, checks: [], metrics: {} },
    },
    summary: {
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      warningCount: 0,
      criticalIssues: [],
    },
    recommendations: [],
  };

  try {
    // Notification Layer Validation
    result.layers.notification = await validateNotificationLayer(medications, schedules, strictMode);
    
    // Database Layer Validation
    result.layers.database = await validateDatabaseLayer(medications, schedules, strictMode);
    
    // Store Layer Validation
    result.layers.store = await validateStoreLayer(medications, schedules, strictMode);
    
    // Cross-Layer Validation
    result.layers.crossLayer = await validateCrossLayerConsistency(medications, schedules, strictMode);

    // Calculate summary
    const allLayers = Object.values(result.layers);
    result.summary.totalChecks = allLayers.reduce((sum, layer) => sum + layer.checks.length, 0);
    result.summary.passedChecks = allLayers.reduce(
      (sum, layer) => sum + layer.checks.filter(check => check.passed).length,
      0
    );
    result.summary.failedChecks = result.summary.totalChecks - result.summary.passedChecks;
    result.summary.warningCount = allLayers.reduce(
      (sum, layer) => sum + layer.checks.filter(check => check.severity === 'warning').length,
      0
    );
    result.summary.criticalIssues = allLayers.flatMap(
      layer => layer.checks
        .filter(check => check.severity === 'critical' && !check.passed)
        .map(check => check.message)
    );

    // Determine overall pass/fail
    result.passed = allLayers.every(layer => layer.passed) && result.summary.criticalIssues.length === 0;

    // Generate recommendations
    result.recommendations = generateConsistencyRecommendations(result);

    logger.debug('[AdvancedAssertions] Multi-layer consistency check completed', {
      passed: result.passed,
      summary: result.summary,
      layerResults: allLayers.map(layer => ({ name: layer.name, passed: layer.passed })),
    });

    return result;

  } catch (error) {
    result.passed = false;
    result.summary.criticalIssues.push(`Multi-layer validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Validate notification layer integrity
 */
async function validateNotificationLayer(
  medications: Medication[],
  schedules: MedicationSchedule[],
  _strictMode: boolean
): Promise<LayerValidationResult> {
  const result: LayerValidationResult = {
    name: 'Notification Layer',
    passed: true,
    checks: [],
    metrics: {},
  };

  const scheduleCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
  result.metrics.totalNotifications = scheduleCalls.length;

  // Check 1: All enabled schedules have notifications
  const enabledSchedules = schedules.filter(s => s.enabled);
  const scheduleNotificationMap = new Map<string, any>();
  
  for (const call of scheduleCalls) {
    const request = call[0];
    const scheduleId = request?.content?.data?.scheduleId;
    if (scheduleId) {
      scheduleNotificationMap.set(scheduleId, request);
    }
  }

  for (const schedule of enabledSchedules) {
    const hasNotification = scheduleNotificationMap.has(schedule.id);
    result.checks.push({
      name: `Schedule ${schedule.id} has notification`,
      passed: hasNotification,
      details: { scheduleId: schedule.id, hasNotification },
      severity: hasNotification ? 'info' : 'error',
      message: hasNotification 
        ? `Schedule ${schedule.id} correctly has notification` 
        : `Schedule ${schedule.id} is enabled but missing notification`,
    });
    
    if (!hasNotification) {
      result.passed = false;
    }
  }

  // Check 2: No notifications for disabled schedules
  const disabledSchedules = schedules.filter(s => !s.enabled);
  for (const schedule of disabledSchedules) {
    const hasNotification = scheduleNotificationMap.has(schedule.id);
    result.checks.push({
      name: `Disabled schedule ${schedule.id} has no notification`,
      passed: !hasNotification,
      details: { scheduleId: schedule.id, hasNotification },
        severity: hasNotification ? (_strictMode ? 'error' : 'warning') : 'info',
      message: hasNotification 
        ? `Disabled schedule ${schedule.id} incorrectly has notification`
        : `Disabled schedule ${schedule.id} correctly has no notification`,
    });
    
    if (hasNotification && _strictMode) {
      result.passed = false;
    }
  }

  // Check 3: Notification data integrity
  for (const [scheduleId, notification] of scheduleNotificationMap) {
    const schedule = schedules.find(s => s.id === scheduleId);
    const medication = schedule ? medications.find(m => m.id === schedule.medicationId) : null;
    
    const integrityCheck = {
      name: `Notification data integrity for ${scheduleId}`,
      passed: true,
      details: { scheduleId, notification },
      severity: 'error' as const,
      message: '',
    };

    if (!schedule) {
      integrityCheck.passed = false;
      integrityCheck.message = `Notification exists for non-existent schedule ${scheduleId}`;
      result.passed = false;
    } else if (!medication) {
      integrityCheck.passed = false;
      integrityCheck.message = `Notification references non-existent medication for schedule ${scheduleId}`;
      result.passed = false;
    } else {
      // Validate notification content
      const content = notification.content;
      if (!content?.title || !content?.body) {
        integrityCheck.passed = false;
        integrityCheck.message = `Notification ${scheduleId} missing required content`;
        result.passed = false;
      } else if (content.data?.medicationId !== medication.id) {
        integrityCheck.passed = false;
        integrityCheck.message = `Notification ${scheduleId} has incorrect medication ID`;
        result.passed = false;
      } else {
        integrityCheck.message = `Notification ${scheduleId} data integrity verified`;
        integrityCheck.severity = 'error';
      }
    }

    result.checks.push(integrityCheck);
  }

  result.metrics.enabledSchedules = enabledSchedules.length;
  result.metrics.disabledSchedules = disabledSchedules.length;
  result.metrics.notificationMismatches = result.checks.filter(c => !c.passed).length;

  return result;
}

/**
 * Validate database layer integrity
 */
async function validateDatabaseLayer(
  medications: Medication[],
  schedules: MedicationSchedule[],
  _strictMode: boolean
): Promise<LayerValidationResult> {
  const result: LayerValidationResult = {
    name: 'Database Layer',
    passed: true,
    checks: [],
    metrics: {},
  };

  try {
    const mockDb = getCurrentMockScheduleDatabase();
    const allMappings = mockDb.getAllMappings();
    result.metrics.totalMappings = allMappings.length;

    // Check 1: All mappings reference valid schedules
    for (const mapping of allMappings) {
      const schedule = schedules.find(s => s.id === mapping.scheduleId);
      const check = {
        name: `Mapping ${mapping.scheduleId} references valid schedule`,
        passed: !!schedule,
        details: { mapping, scheduleExists: !!schedule },
        severity: schedule ? 'info' as const : 'error' as const,
        message: schedule 
          ? `Mapping ${mapping.scheduleId} correctly references valid schedule`
          : `Mapping ${mapping.scheduleId} references non-existent schedule`,
      };

      result.checks.push(check);
      if (!check.passed) {
        result.passed = false;
      }
    }

    // Check 2: All mappings reference valid medications
    for (const mapping of allMappings) {
      const medication = medications.find(m => m.id === mapping.medicationId);
      const check = {
        name: `Mapping ${mapping.scheduleId} references valid medication`,
        passed: !!medication,
        details: { mapping, medicationExists: !!medication },
        severity: medication ? 'info' as const : 'error' as const,
        message: medication 
          ? `Mapping ${mapping.scheduleId} correctly references valid medication`
          : `Mapping ${mapping.scheduleId} references non-existent medication`,
      };

      result.checks.push(check);
      if (!check.passed) {
        result.passed = false;
      }
    }

    // Check 3: No duplicate mappings
    const mappingKeys = new Set<string>();
    const duplicates: string[] = [];
    
    for (const mapping of allMappings) {
      const key = `${mapping.scheduleId}-${mapping.date}`;
      if (mappingKeys.has(key)) {
        duplicates.push(key);
      } else {
        mappingKeys.add(key);
      }
    }

    const duplicateCheck = {
      name: 'No duplicate schedule-date mappings',
      passed: duplicates.length === 0,
      details: { duplicates, count: duplicates.length },
      severity: duplicates.length === 0 ? 'info' as const : 'error' as const,
      message: duplicates.length === 0 
        ? 'No duplicate mappings found'
        : `Found ${duplicates.length} duplicate mappings: ${duplicates.join(', ')}`,
    };

    result.checks.push(duplicateCheck);
    if (!duplicateCheck.passed) {
      result.passed = false;
    }

    // Check 4: Timestamp consistency
    for (const mapping of allMappings) {
      let timestampCheck: {
        name: string;
        passed: boolean;
        details: any;
        severity: 'info' | 'warning' | 'error' | 'critical';
        message: string;
      };

      if (mapping.createdAt <= 0) {
        timestampCheck = {
          name: `Mapping ${mapping.scheduleId} has valid timestamps`,
          passed: false,
          details: { mapping: { scheduleId: mapping.scheduleId, createdAt: mapping.createdAt, updatedAt: mapping.updatedAt } },
          severity: 'error',
          message: `Mapping ${mapping.scheduleId} has invalid createdAt timestamp`,
        };
        result.passed = false;
      } else if (mapping.updatedAt < mapping.createdAt) {
        timestampCheck = {
          name: `Mapping ${mapping.scheduleId} has valid timestamps`,
          passed: false,
          details: { mapping: { scheduleId: mapping.scheduleId, createdAt: mapping.createdAt, updatedAt: mapping.updatedAt } },
          severity: 'error',
          message: `Mapping ${mapping.scheduleId} has updatedAt before createdAt`,
        };
        result.passed = false;
      } else {
        timestampCheck = {
          name: `Mapping ${mapping.scheduleId} has valid timestamps`,
          passed: true,
          details: { mapping: { scheduleId: mapping.scheduleId, createdAt: mapping.createdAt, updatedAt: mapping.updatedAt } },
          severity: 'info',
          message: `Mapping ${mapping.scheduleId} has valid timestamps`,
        };
      }

      result.checks.push(timestampCheck);
    }

    result.metrics.validMappings = result.checks.filter(c => c.passed).length;
    result.metrics.invalidMappings = result.checks.filter(c => !c.passed).length;
    result.metrics.duplicates = duplicates.length;

  } catch (error) {
    result.passed = false;
    result.checks.push({
      name: 'Database layer accessibility',
      passed: false,
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
      severity: 'critical',
      message: `Database layer validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  return result;
}

/**
 * Validate store layer integrity
 */
async function validateStoreLayer(
  medications: Medication[],
  schedules: MedicationSchedule[],
  _strictMode: boolean
): Promise<LayerValidationResult> {
  const result: LayerValidationResult = {
    name: 'Store Layer',
    passed: true,
    checks: [],
    metrics: {},
  };

  // Check 1: All medications have valid structure
  for (const medication of medications) {
    const structureCheck = {
      name: `Medication ${medication.id} has valid structure`,
      passed: true,
      details: { medication },
      severity: 'error' as const,
      message: '',
    };

    if (!medication.id || !medication.id.match(/^med-/)) {
      structureCheck.passed = false;
      structureCheck.message = `Medication ${medication.id} has invalid ID format`;
      result.passed = false;
    } else if (!medication.name || medication.name.length === 0) {
      structureCheck.passed = false;
      structureCheck.message = `Medication ${medication.id} has invalid name`;
      result.passed = false;
    } else if (!['preventative', 'rescue', 'other'].includes(medication.type)) {
      structureCheck.passed = false;
      structureCheck.message = `Medication ${medication.id} has invalid type: ${medication.type}`;
      result.passed = false;
    } else {
      structureCheck.message = `Medication ${medication.id} has valid structure`;
      structureCheck.severity = 'error';
    }

    result.checks.push(structureCheck);
  }

  // Check 2: All schedules have valid structure and reference valid medications
  for (const schedule of schedules) {
    const structureCheck = {
      name: `Schedule ${schedule.id} has valid structure`,
      passed: true,
      details: { schedule },
      severity: 'error' as const,
      message: '',
    };

    if (!schedule.id || !schedule.id.match(/^sched-/)) {
      structureCheck.passed = false;
      structureCheck.message = `Schedule ${schedule.id} has invalid ID format`;
      result.passed = false;
    } else if (!schedule.medicationId || !medications.find(m => m.id === schedule.medicationId)) {
      structureCheck.passed = false;
      structureCheck.message = `Schedule ${schedule.id} references invalid medication ${schedule.medicationId}`;
      result.passed = false;
    } else if (!schedule.time || !schedule.time.match(/^\d{2}:\d{2}$/)) {
      structureCheck.passed = false;
      structureCheck.message = `Schedule ${schedule.id} has invalid time format: ${schedule.time}`;
      result.passed = false;
    } else {
      structureCheck.message = `Schedule ${schedule.id} has valid structure`;
      structureCheck.severity = 'error';
    }

    result.checks.push(structureCheck);
  }

  // Check 3: Business logic consistency
  const medicationGroups = new Map<string, MedicationSchedule[]>();
  for (const schedule of schedules) {
    if (!medicationGroups.has(schedule.medicationId)) {
      medicationGroups.set(schedule.medicationId, []);
    }
    medicationGroups.get(schedule.medicationId)!.push(schedule);
  }

  for (const [medicationId, medSchedules] of medicationGroups) {
    const medication = medications.find(m => m.id === medicationId);
    if (medication) {
      // Check for rescue medications with multiple schedules (unusual but not invalid)
      if (medication.type === 'rescue' && medSchedules.length > 1) {
        result.checks.push({
          name: `Rescue medication ${medicationId} schedule count`,
          passed: true,
          details: { medicationId, scheduleCount: medSchedules.length, type: medication.type },
          severity: 'warning',
          message: `Rescue medication ${medicationId} has ${medSchedules.length} schedules (unusual but valid)`,
        });
      }

      // Check for conflicting times
      const enabledSchedules = medSchedules.filter(s => s.enabled);
      const times = enabledSchedules.map(s => s.time);
      const uniqueTimes = new Set(times);
      
      if (times.length !== uniqueTimes.size) {
        result.checks.push({
          name: `Medication ${medicationId} has no conflicting schedule times`,
          passed: false,
          details: { medicationId, times, duplicates: times.length - uniqueTimes.size },
          severity: _strictMode ? 'error' : 'warning',
          message: `Medication ${medicationId} has ${times.length - uniqueTimes.size} conflicting schedule times`,
        });
        
        if (_strictMode) {
          result.passed = false;
        }
      }
    }
  }

  result.metrics.totalMedications = medications.length;
  result.metrics.totalSchedules = schedules.length;
  result.metrics.enabledSchedules = schedules.filter(s => s.enabled).length;
  result.metrics.medicationsWithSchedules = medicationGroups.size;

  return result;
}

/**
 * Validate cross-layer consistency
 */
async function validateCrossLayerConsistency(
  medications: Medication[],
  schedules: MedicationSchedule[],
  _strictMode: boolean
): Promise<LayerValidationResult> {
  const result: LayerValidationResult = {
    name: 'Cross-Layer Consistency',
    passed: true,
    checks: [],
    metrics: {},
  };

  try {
    const mockDb = getCurrentMockScheduleDatabase();
    const allMappings = mockDb.getAllMappings();
    const scheduleCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;

    // Check 1: Notification-Database consistency
    for (const call of scheduleCalls) {
      const request = call[0];
      const scheduleId = request?.content?.data?.scheduleId;
      const medicationId = request?.content?.data?.medicationId;
      
      if (scheduleId && medicationId) {
        const mapping = allMappings.find(m => m.scheduleId === scheduleId);
        const check = {
          name: `Notification-Database consistency for ${scheduleId}`,
          passed: true,
          details: { scheduleId, medicationId, mapping },
          severity: 'error' as const,
          message: '',
        };

        if (!mapping) {
          check.passed = false;
          check.message = `Notification for ${scheduleId} exists but no database mapping found`;
          result.passed = false;
        } else if (mapping.medicationId !== medicationId) {
          check.passed = false;
          check.message = `Notification for ${scheduleId} has mismatched medication ID: notification=${medicationId}, database=${mapping.medicationId}`;
          result.passed = false;
        } else {
          check.message = `Notification-Database consistency verified for ${scheduleId}`;
          check.severity = 'error';
        }

        result.checks.push(check);
      }
    }

    // Check 2: Store-Database consistency
    for (const schedule of schedules.filter(s => s.enabled)) {
      const mapping = allMappings.find(m => m.scheduleId === schedule.id);
      const check = {
        name: `Store-Database consistency for ${schedule.id}`,
        passed: !!mapping,
        details: { schedule, mapping },
        severity: mapping ? 'info' as const : 'error' as const,
        message: mapping 
          ? `Store-Database consistency verified for ${schedule.id}`
          : `Enabled schedule ${schedule.id} missing database mapping`,
      };

      result.checks.push(check);
      if (!check.passed) {
        result.passed = false;
      }
    }

    // Check 3: Store-Notification consistency
    for (const schedule of schedules.filter(s => s.enabled)) {
      const hasNotification = scheduleCalls.some(call => 
        call[0]?.content?.data?.scheduleId === schedule.id
      );
      
      const check = {
        name: `Store-Notification consistency for ${schedule.id}`,
        passed: hasNotification,
        details: { schedule, hasNotification },
        severity: hasNotification ? 'info' as const : 'error' as const,
        message: hasNotification 
          ? `Store-Notification consistency verified for ${schedule.id}`
          : `Enabled schedule ${schedule.id} missing notification`,
      };

      result.checks.push(check);
      if (!check.passed) {
        result.passed = false;
      }
    }

    result.metrics.crossLayerChecks = result.checks.length;
    result.metrics.consistencyViolations = result.checks.filter(c => !c.passed).length;

  } catch (error) {
    result.passed = false;
    result.checks.push({
      name: 'Cross-layer validation accessibility',
      passed: false,
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
      severity: 'critical',
      message: `Cross-layer validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  return result;
}

/**
 * Generate recommendations based on consistency check results
 */
function generateConsistencyRecommendations(result: MultiLayerConsistencyResult): string[] {
  const recommendations: string[] = [];

  // Critical issues
  if (result.summary.criticalIssues.length > 0) {
    recommendations.push('CRITICAL: Address critical issues immediately to prevent system instability');
    recommendations.push('Review error logs and implement emergency fixes for critical consistency violations');
  }

  // High error rate
  if (result.summary.failedChecks > result.summary.totalChecks * 0.3) {
    recommendations.push('High error rate detected. Implement comprehensive consistency validation in application logic');
  }

  // Layer-specific recommendations
  if (!result.layers.notification.passed) {
    recommendations.push('Notification layer issues detected. Review notification scheduling and cleanup logic');
  }

  if (!result.layers.database.passed) {
    recommendations.push('Database layer issues detected. Implement database constraint validation and integrity checks');
  }

  if (!result.layers.store.passed) {
    recommendations.push('Store layer issues detected. Add input validation and business logic checks');
  }

  if (!result.layers.crossLayer.passed) {
    recommendations.push('Cross-layer consistency issues detected. Implement transactional operations to ensure data synchronization');
  }

  // Performance recommendations
  if (result.summary.totalChecks > 1000) {
    recommendations.push('Large dataset detected. Consider implementing incremental validation strategies');
  }

  // General recommendations
  if (recommendations.length === 0) {
    recommendations.push('Consistency validation passed. Consider implementing automated consistency monitoring');
  }

  return recommendations;
}

/**
 * Assert performance thresholds with detailed analysis
 */
export async function assertAdvancedPerformanceThresholds(
  actualMetrics: any,
  thresholds: PerformanceThresholds,
  testContext: string = 'unknown'
): Promise<PerformanceAssertionResult> {
  const result: PerformanceAssertionResult = {
    passed: true,
    thresholds,
    actual: actualMetrics,
    violations: [],
    recommendations: [],
  };

  // Check response time
  if (actualMetrics.responseTime > thresholds.maxResponseTime) {
    result.violations.push({
      metric: 'responseTime',
      threshold: thresholds.maxResponseTime,
      actual: actualMetrics.responseTime,
      severity: actualMetrics.responseTime > thresholds.maxResponseTime * 2 ? 'critical' : 'major',
      impact: 'User experience degradation, potential timeout issues',
    });
    result.passed = false;
  }

  // Check memory usage
  if (actualMetrics.memoryUsage > thresholds.maxMemoryUsage) {
    result.violations.push({
      metric: 'memoryUsage',
      threshold: thresholds.maxMemoryUsage,
      actual: actualMetrics.memoryUsage,
      severity: actualMetrics.memoryUsage > thresholds.maxMemoryUsage * 1.5 ? 'critical' : 'major',
      impact: 'Memory pressure, potential out-of-memory errors',
    });
    result.passed = false;
  }

  // Check throughput
  if (actualMetrics.throughput < thresholds.minThroughput) {
    result.violations.push({
      metric: 'throughput',
      threshold: thresholds.minThroughput,
      actual: actualMetrics.throughput,
      severity: actualMetrics.throughput < thresholds.minThroughput * 0.5 ? 'critical' : 'major',
      impact: 'System cannot handle expected load, bottleneck detected',
    });
    result.passed = false;
  }

  // Generate recommendations
  for (const violation of result.violations) {
    switch (violation.metric) {
      case 'responseTime':
        result.recommendations.push('Optimize notification scheduling algorithm, consider caching');
        break;
      case 'memoryUsage':
        result.recommendations.push('Review object lifecycle management, implement memory pooling');
        break;
      case 'throughput':
        result.recommendations.push('Implement batch processing, optimize database queries');
        break;
    }
  }

  if (result.passed) {
    result.recommendations.push(`Performance thresholds met for ${testContext}`);
  }

  logger.debug('[AdvancedAssertions] Performance assertion completed', {
    testContext,
    passed: result.passed,
    violations: result.violations.length,
    recommendations: result.recommendations.length,
  });

  return result;
}

/**
 * Deep data integrity validation
 */
export async function assertDeepDataIntegrity(
  medications: Medication[],
  schedules: MedicationSchedule[]
): Promise<DataIntegrityCheckResult> {
  const result: DataIntegrityCheckResult = {
    passed: true,
    referentialIntegrity: true,
    dataConsistency: true,
    constraintViolations: [],
    orphanedData: { notifications: 0, schedules: 0, mappings: 0 },
    duplicates: { medications: 0, schedules: 0, notifications: 0 },
    corruptedRecords: [],
  };

  try {
    const mockDb = getCurrentMockScheduleDatabase();
    const allMappings = mockDb.getAllMappings();
    const scheduleCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;

    // Check referential integrity
    let referentialIssues = 0;

    // Check medication references
    for (const schedule of schedules) {
      const medication = medications.find(m => m.id === schedule.medicationId);
      if (!medication) {
        result.constraintViolations.push({
          type: 'foreign_key',
          description: `Schedule ${schedule.id} references non-existent medication ${schedule.medicationId}`,
          affectedRecords: 1,
          severity: 'high',
          autoFixable: false,
        });
        referentialIssues++;
      }
    }

    // Check mapping references
    for (const mapping of allMappings) {
      const schedule = schedules.find(s => s.id === mapping.scheduleId);
      const medication = medications.find(m => m.id === mapping.medicationId);
      
      if (!schedule) {
        result.constraintViolations.push({
          type: 'foreign_key',
          description: `Mapping references non-existent schedule ${mapping.scheduleId}`,
          affectedRecords: 1,
          severity: 'high',
          autoFixable: true,
        });
        referentialIssues++;
        result.orphanedData.mappings++;
      }
      
      if (!medication) {
        result.constraintViolations.push({
          type: 'foreign_key',
          description: `Mapping references non-existent medication ${mapping.medicationId}`,
          affectedRecords: 1,
          severity: 'high',
          autoFixable: false,
        });
        referentialIssues++;
      }
    }

    result.referentialIntegrity = referentialIssues === 0;

    // Check for duplicates
    const medicationIds = medications.map(m => m.id);
    const uniqueMedicationIds = new Set(medicationIds);
    result.duplicates.medications = medicationIds.length - uniqueMedicationIds.size;

    const scheduleIds = schedules.map(s => s.id);
    const uniqueScheduleIds = new Set(scheduleIds);
    result.duplicates.schedules = scheduleIds.length - uniqueScheduleIds.size;

    const notificationIds = scheduleCalls.map(call => call[0]?.identifier).filter(Boolean);
    const uniqueNotificationIds = new Set(notificationIds);
    result.duplicates.notifications = notificationIds.length - uniqueNotificationIds.size;

    // Check for data corruption
    for (const medication of medications) {
      if (!medication.id || typeof medication.id !== 'string') {
        result.corruptedRecords.push({
          type: 'medication',
          id: medication.id || 'unknown',
          corruption: 'Invalid or missing ID',
          recoverable: false,
        });
      }
      
      if (!medication.name || typeof medication.name !== 'string' || medication.name.length === 0) {
        result.corruptedRecords.push({
          type: 'medication',
          id: medication.id,
          corruption: 'Invalid or missing name',
          recoverable: true,
        });
      }
    }

    for (const schedule of schedules) {
      if (!schedule.id || typeof schedule.id !== 'string') {
        result.corruptedRecords.push({
          type: 'schedule',
          id: schedule.id || 'unknown',
          corruption: 'Invalid or missing ID',
          recoverable: false,
        });
      }
      
      if (!schedule.time || !schedule.time.match(/^\d{2}:\d{2}$/)) {
        result.corruptedRecords.push({
          type: 'schedule',
          id: schedule.id,
          corruption: 'Invalid time format',
          recoverable: true,
        });
      }
    }

    // Overall integrity assessment
    result.dataConsistency = result.constraintViolations.filter(v => v.severity === 'high' || v.severity === 'critical').length === 0;
    result.passed = result.referentialIntegrity && 
                   result.dataConsistency && 
                   result.corruptedRecords.filter(r => !r.recoverable).length === 0;

    logger.debug('[AdvancedAssertions] Deep data integrity check completed', {
      passed: result.passed,
      referentialIntegrity: result.referentialIntegrity,
      dataConsistency: result.dataConsistency,
      violations: result.constraintViolations.length,
      orphanedData: result.orphanedData,
      duplicates: result.duplicates,
      corruptedRecords: result.corruptedRecords.length,
    });

    return result;

  } catch (error) {
    result.passed = false;
    result.corruptedRecords.push({
      type: 'system',
      id: 'unknown',
      corruption: `Data integrity validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      recoverable: false,
    });
    return result;
  }
}

/**
 * Comprehensive assertion that throws on failure with detailed error information
 */
export async function assertComprehensiveConsistency(
  medications: Medication[],
  schedules: MedicationSchedule[],
  performanceMetrics?: any,
  performanceThresholds?: PerformanceThresholds,
  strictMode: boolean = false
): Promise<void> {
  // Multi-layer consistency check
  const consistencyResult = await assertMultiLayerConsistency(medications, schedules, strictMode);
  
  // Data integrity check
  const integrityResult = await assertDeepDataIntegrity(medications, schedules);
  
  // Performance check (if metrics provided)
  let performanceResult: PerformanceAssertionResult | null = null;
  if (performanceMetrics && performanceThresholds) {
    performanceResult = await assertAdvancedPerformanceThresholds(
      performanceMetrics, 
      performanceThresholds, 
      'comprehensive_consistency'
    );
  }

  // Collect all failures
  const failures: string[] = [];
  
  if (!consistencyResult.passed) {
    failures.push('Multi-layer consistency check failed:');
    failures.push(...consistencyResult.summary.criticalIssues);
    failures.push(`Failed checks: ${consistencyResult.summary.failedChecks}/${consistencyResult.summary.totalChecks}`);
  }
  
  if (!integrityResult.passed) {
    failures.push('Data integrity check failed:');
    failures.push(...integrityResult.constraintViolations.map(v => v.description));
    failures.push(...integrityResult.corruptedRecords.filter(r => !r.recoverable).map(r => r.corruption));
  }
  
  if (performanceResult && !performanceResult.passed) {
    failures.push('Performance threshold check failed:');
    failures.push(...performanceResult.violations.map(v => 
      `${v.metric}: ${v.actual} exceeds threshold ${v.threshold} (${v.severity})`
    ));
  }

  // Throw detailed error if any failures
  if (failures.length > 0) {
    const errorMessage = [
      'Comprehensive consistency assertion failed:',
      ...failures,
      '',
      'Recommendations:',
      ...consistencyResult.recommendations,
      ...(performanceResult?.recommendations || []),
    ].join('\n');
    
    throw new Error(errorMessage);
  }

  logger.debug('[AdvancedAssertions] Comprehensive consistency assertion passed', {
    consistencyPassed: consistencyResult.passed,
    integrityPassed: integrityResult.passed,
    performancePassed: performanceResult?.passed ?? 'not_checked',
  });
}