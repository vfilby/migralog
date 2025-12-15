/**
 * Debugging and Diagnostics Helpers for Notification-Schedule Consistency Testing
 * 
 * Provides enhanced logging, tracing, test execution visualization, and automatic
 * failure diagnosis utilities to simplify debugging when tests fail.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { logger } from '../../utils/logger';
import { Medication, MedicationSchedule } from '../../models/types';

export interface DebugTrace {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  operation: string;
  details: Record<string, any>;
  stackTrace?: string;
}

export interface TestExecutionVisualization {
  testId: string;
  timeline: Array<{
    timestamp: number;
    event: string;
    details: any;
    duration?: number;
  }>;
  dataFlow: Array<{
    source: string;
    target: string;
    dataType: string;
    payload: any;
    timestamp: number;
  }>;
  stateChanges: Array<{
    timestamp: number;
    component: string;
    before: any;
    after: any;
    trigger: string;
  }>;
  performanceMetrics: {
    totalTime: number;
    operationBreakdown: Record<string, number>;
    memoryPeaks: Array<{ timestamp: number; usage: number }>;
  };
}

export interface FailureDiagnosis {
  testId: string;
  failureType: 'assertion' | 'exception' | 'timeout' | 'consistency' | 'performance';
  rootCause: string;
  contributingFactors: string[];
  evidenceTrail: Array<{
    timestamp: number;
    evidence: string;
    relevance: 'high' | 'medium' | 'low';
  }>;
  recommendations: string[];
  reproducibilityScore: number; // 0-100
  potentialFixes: Array<{
    description: string;
    effort: 'low' | 'medium' | 'high';
    confidence: number; // 0-100
  }>;
}

export interface DiagnosticReport {
  summary: {
    testsPassed: number;
    testsFailed: number;
    totalExecutionTime: number;
    commonFailurePatterns: Array<{
      pattern: string;
      occurrences: number;
      testIds: string[];
    }>;
  };
  failureAnalysis: FailureDiagnosis[];
  performanceTrends: {
    averageTestTime: number;
    slowestTests: Array<{ testId: string; duration: number }>;
    memoryLeaks: Array<{ testId: string; leakSize: number }>;
  };
  recommendations: string[];
}

/**
 * Enhanced Debug Tracer for comprehensive operation tracking
 */
export class DebugTracer {
  private static instance: DebugTracer;
  private traces: DebugTrace[] = [];
  private currentTestId: string | null = null;
  private isEnabled: boolean = true;
  private maxTraces: number = 10000;

  static getInstance(): DebugTracer {
    if (!DebugTracer.instance) {
      DebugTracer.instance = new DebugTracer();
    }
    return DebugTracer.instance;
  }

  enable(enabled: boolean = true): void {
    this.isEnabled = enabled;
  }

  setTestId(testId: string): void {
    this.currentTestId = testId;
  }

  trace(
    level: 'debug' | 'info' | 'warn' | 'error',
    category: string,
    operation: string,
    details: Record<string, any> = {},
    includeStack: boolean = false
  ): void {
    if (!this.isEnabled) {
      return;
    }

    const trace: DebugTrace = {
      timestamp: Date.now(),
      level,
      category,
      operation,
      details: {
        ...details,
        testId: this.currentTestId,
      },
    };

    if (includeStack || level === 'error') {
      trace.stackTrace = new Error().stack;
    }

    this.traces.push(trace);

    // Trim traces if we exceed the maximum
    if (this.traces.length > this.maxTraces) {
      this.traces = this.traces.slice(-this.maxTraces * 0.8);
    }

    // Also log to the regular logger for immediate visibility
    const logMessage = `[${category}] ${operation}`;
    switch (level) {
      case 'debug':
        logger.debug(logMessage, details);
        break;
      case 'info':
        logger.info(logMessage, details);
        break;
      case 'warn':
        logger.warn(logMessage, details);
        break;
      case 'error':
        logger.error(logMessage, details);
        break;
    }
  }

  getTraces(
    testId?: string,
    category?: string,
    level?: 'debug' | 'info' | 'warn' | 'error'
  ): DebugTrace[] {
    let filteredTraces = this.traces;

    if (testId) {
      filteredTraces = filteredTraces.filter(t => t.details.testId === testId);
    }

    if (category) {
      filteredTraces = filteredTraces.filter(t => t.category === category);
    }

    if (level) {
      filteredTraces = filteredTraces.filter(t => t.level === level);
    }

    return filteredTraces;
  }

  getErrorTraces(testId?: string): DebugTrace[] {
    return this.getTraces(testId, undefined, 'error');
  }

  clearTraces(testId?: string): void {
    if (testId) {
      this.traces = this.traces.filter(t => t.details.testId !== testId);
    } else {
      this.traces = [];
    }
  }

  exportTraces(testId?: string): string {
    const traces = this.getTraces(testId);
    return JSON.stringify(traces, null, 2);
  }
}

/**
 * Test Execution Visualizer for creating detailed execution reports
 */
export class TestExecutionVisualizer {
  private visualizations: Map<string, TestExecutionVisualization> = new Map();
  private tracer = DebugTracer.getInstance();

  startVisualization(testId: string): void {
    const visualization: TestExecutionVisualization = {
      testId,
      timeline: [],
      dataFlow: [],
      stateChanges: [],
      performanceMetrics: {
        totalTime: 0,
        operationBreakdown: {},
        memoryPeaks: [],
      },
    };

    this.visualizations.set(testId, visualization);
    this.tracer.setTestId(testId);
    this.tracer.trace('info', 'Visualizer', 'test_started', { testId });
  }

  recordEvent(
    testId: string,
    event: string,
    details: any = {},
    duration?: number
  ): void {
    const visualization = this.visualizations.get(testId);
    if (!visualization) {
      return;
    }

    visualization.timeline.push({
      timestamp: Date.now(),
      event,
      details,
      duration,
    });

    this.tracer.trace('debug', 'Visualizer', 'event_recorded', {
      testId,
      event,
      details,
    });
  }

  recordDataFlow(
    testId: string,
    source: string,
    target: string,
    dataType: string,
    payload: any
  ): void {
    const visualization = this.visualizations.get(testId);
    if (!visualization) {
      return;
    }

    visualization.dataFlow.push({
      source,
      target,
      dataType,
      payload,
      timestamp: Date.now(),
    });

    this.tracer.trace('debug', 'Visualizer', 'data_flow_recorded', {
      testId,
      source,
      target,
      dataType,
    });
  }

  recordStateChange(
    testId: string,
    component: string,
    before: any,
    after: any,
    trigger: string
  ): void {
    const visualization = this.visualizations.get(testId);
    if (!visualization) {
      return;
    }

    visualization.stateChanges.push({
      timestamp: Date.now(),
      component,
      before,
      after,
      trigger,
    });

    this.tracer.trace('debug', 'Visualizer', 'state_change_recorded', {
      testId,
      component,
      trigger,
    });
  }

  recordPerformanceMetric(
    testId: string,
    operation: string,
    duration: number,
    memoryUsage?: number
  ): void {
    const visualization = this.visualizations.get(testId);
    if (!visualization) {
      return;
    }

    visualization.performanceMetrics.operationBreakdown[operation] = 
      (visualization.performanceMetrics.operationBreakdown[operation] || 0) + duration;

    if (memoryUsage) {
      visualization.performanceMetrics.memoryPeaks.push({
        timestamp: Date.now(),
        usage: memoryUsage,
      });
    }

    this.tracer.trace('debug', 'Visualizer', 'performance_recorded', {
      testId,
      operation,
      duration,
      memoryUsage,
    });
  }

  finishVisualization(testId: string): TestExecutionVisualization | null {
    const visualization = this.visualizations.get(testId);
    if (!visualization) {
      return null;
    }

    // Calculate total time
    const timeline = visualization.timeline;
    if (timeline.length > 1) {
      visualization.performanceMetrics.totalTime = 
        timeline[timeline.length - 1].timestamp - timeline[0].timestamp;
    }

    this.tracer.trace('info', 'Visualizer', 'test_finished', { testId });
    return visualization;
  }

  getVisualization(testId: string): TestExecutionVisualization | undefined {
    return this.visualizations.get(testId);
  }

  generateReport(testId: string): string {
    const visualization = this.visualizations.get(testId);
    if (!visualization) {
      return `No visualization data available for test: ${testId}`;
    }

    const report: string[] = [];
    report.push(`# Test Execution Report: ${testId}`);
    report.push(`Total Execution Time: ${visualization.performanceMetrics.totalTime}ms`);
    report.push('');

    // Timeline section
    report.push('## Timeline');
    visualization.timeline.forEach((event, index) => {
      const relativeTime = index > 0 ? 
        event.timestamp - visualization.timeline[0].timestamp : 0;
      report.push(`${relativeTime}ms: ${event.event} ${event.duration ? `(${event.duration}ms)` : ''}`);
    });
    report.push('');

    // Performance breakdown
    report.push('## Performance Breakdown');
    const operations = Object.entries(visualization.performanceMetrics.operationBreakdown)
      .sort(([, a], [, b]) => b - a);
    operations.forEach(([operation, duration]) => {
      const percentage = ((duration / visualization.performanceMetrics.totalTime) * 100).toFixed(1);
      report.push(`${operation}: ${duration}ms (${percentage}%)`);
    });
    report.push('');

    // State changes
    report.push('## State Changes');
    visualization.stateChanges.forEach(change => {
      report.push(`${change.component}: ${change.trigger}`);
    });
    report.push('');

    // Data flow
    report.push('## Data Flow');
    visualization.dataFlow.forEach(flow => {
      report.push(`${flow.source} -> ${flow.target} (${flow.dataType})`);
    });

    return report.join('\n');
  }
}

/**
 * Automatic Failure Diagnosis Engine
 */
export class FailureDiagnosticEngine {
  private tracer = DebugTracer.getInstance();
  private visualizer = new TestExecutionVisualizer();
  private knownPatterns: Map<string, RegExp> = new Map();
  private diagnosticReports: Map<string, FailureDiagnosis> = new Map();

  constructor() {
    this.initializeKnownPatterns();
  }

  private initializeKnownPatterns(): void {
    // Common failure patterns in notification-schedule consistency
    this.knownPatterns.set(
      'schedule_id_mismatch',
      /Schedule ID.*mismatch|Invalid schedule ID|Schedule.*not found/i
    );
    this.knownPatterns.set(
      'notification_not_scheduled',
      /Notification.*not scheduled|Missing notification|scheduleNotificationAsync.*not called/i
    );
    this.knownPatterns.set(
      'database_inconsistency',
      /Database.*inconsistency|Mapping.*not found|Foreign key.*violation/i
    );
    this.knownPatterns.set(
      'race_condition',
      /Race condition|Concurrent.*access|Transaction.*conflict/i
    );
    this.knownPatterns.set(
      'memory_leak',
      /Memory.*leak|Heap.*exceeded|Out of memory/i
    );
    this.knownPatterns.set(
      'timeout',
      /Timeout|Test.*exceeded.*time|Operation.*took too long/i
    );
  }

  diagnoseFailure(
    testId: string,
    error: Error,
    context?: {
      medications?: Medication[];
      schedules?: MedicationSchedule[];
      expectedBehavior?: string;
    }
  ): FailureDiagnosis {
    const traces = this.tracer.getTraces(testId);
    const errorTraces = this.tracer.getErrorTraces(testId);

    const diagnosis: FailureDiagnosis = {
      testId,
      failureType: this.classifyFailure(error),
      rootCause: 'Unknown',
      contributingFactors: [],
      evidenceTrail: [],
      recommendations: [],
      reproducibilityScore: 0,
      potentialFixes: [],
    };

    // Analyze error message for known patterns
    const errorMessage = error.message;
    for (const [patternName, pattern] of this.knownPatterns) {
      if (pattern.test(errorMessage)) {
        diagnosis.rootCause = this.getRootCauseForPattern(patternName);
        diagnosis.contributingFactors = this.getContributingFactorsForPattern(patternName);
        diagnosis.recommendations = this.getRecommendationsForPattern(patternName);
        diagnosis.potentialFixes = this.getPotentialFixesForPattern(patternName);
        break;
      }
    }

    // Build evidence trail from traces
    diagnosis.evidenceTrail = this.buildEvidenceTrail(traces, errorTraces, error);

    // Calculate reproducibility score
    diagnosis.reproducibilityScore = this.calculateReproducibilityScore(
      traces,
      errorTraces,
      context
    );

    // Add context-specific analysis
    if (context) {
      this.addContextualAnalysis(diagnosis, context);
    }

    // Store diagnosis for pattern analysis
    this.diagnosticReports.set(testId, diagnosis);

    this.tracer.trace('info', 'Diagnostic', 'failure_diagnosed', {
      testId,
      failureType: diagnosis.failureType,
      rootCause: diagnosis.rootCause,
      reproducibilityScore: diagnosis.reproducibilityScore,
    });

    return diagnosis;
  }

  private classifyFailure(error: Error): FailureDiagnosis['failureType'] {
    const message = error.message.toLowerCase();
    
    if (message.includes('expect') || message.includes('assertion')) {
      return 'assertion';
    }
    if (message.includes('timeout') || message.includes('exceeded')) {
      return 'timeout';
    }
    if (message.includes('consistency') || message.includes('mismatch')) {
      return 'consistency';
    }
    if (message.includes('performance') || message.includes('threshold')) {
      return 'performance';
    }
    
    return 'exception';
  }

  private getRootCauseForPattern(pattern: string): string {
    const rootCauses: Record<string, string> = {
      schedule_id_mismatch: 'Schedule ID synchronization failure between layers',
      notification_not_scheduled: 'Notification scheduling logic not executed',
      database_inconsistency: 'Database state inconsistent with application state',
      race_condition: 'Concurrent operations interfering with each other',
      memory_leak: 'Memory not properly released after operations',
      timeout: 'Operations taking longer than expected timeouts',
    };

    return rootCauses[pattern] || 'Unknown root cause';
  }

  private getContributingFactorsForPattern(pattern: string): string[] {
    const factors: Record<string, string[]> = {
      schedule_id_mismatch: [
        'Async operation timing issues',
        'State update race conditions',
        'Mock configuration problems',
      ],
      notification_not_scheduled: [
        'Disabled schedule not properly handled',
        'Notification service not properly mocked',
        'Conditional logic error',
      ],
      database_inconsistency: [
        'Transaction rollback issues',
        'Mock database state pollution',
        'Foreign key constraint violations',
      ],
      race_condition: [
        'Insufficient coordination between operations',
        'Non-deterministic test execution order',
        'Shared state modifications',
      ],
      memory_leak: [
        'Event listeners not cleaned up',
        'Large object references retained',
        'Mock implementations accumulating state',
      ],
      timeout: [
        'Complex operations taking longer than expected',
        'Network simulation delays',
        'Database operation bottlenecks',
      ],
    };

    return factors[pattern] || ['Unknown contributing factors'];
  }

  private getRecommendationsForPattern(pattern: string): string[] {
    const recommendations: Record<string, string[]> = {
      schedule_id_mismatch: [
        'Add explicit synchronization points in test',
        'Verify mock configurations match expected behavior',
        'Use deterministic coordination for async operations',
      ],
      notification_not_scheduled: [
        'Check notification service initialization',
        'Verify conditional logic with edge cases',
        'Add explicit assertions for notification calls',
      ],
      database_inconsistency: [
        'Reset database state between test iterations',
        'Add database integrity checks to test',
        'Use transactions for multi-step operations',
      ],
      race_condition: [
        'Implement deterministic operation ordering',
        'Use coordination mechanisms between operations',
        'Add proper cleanup between concurrent tests',
      ],
      memory_leak: [
        'Implement comprehensive cleanup functions',
        'Review object lifecycle management',
        'Use weak references where appropriate',
      ],
      timeout: [
        'Increase timeout thresholds for complex operations',
        'Optimize test operation performance',
        'Add progress monitoring to identify bottlenecks',
      ],
    };

    return recommendations[pattern] || ['Investigate test implementation'];
  }

  private getPotentialFixesForPattern(pattern: string): Array<{
    description: string;
    effort: 'low' | 'medium' | 'high';
    confidence: number;
  }> {
    const fixes: Record<string, Array<{
      description: string;
      effort: 'low' | 'medium' | 'high';
      confidence: number;
    }>> = {
      schedule_id_mismatch: [
        {
          description: 'Add explicit wait for state synchronization',
          effort: 'low',
          confidence: 80,
        },
        {
          description: 'Refactor to use deterministic coordination',
          effort: 'medium',
          confidence: 90,
        },
        {
          description: 'Implement comprehensive state validation',
          effort: 'high',
          confidence: 95,
        },
      ],
      notification_not_scheduled: [
        {
          description: 'Add missing notification mock setup',
          effort: 'low',
          confidence: 85,
        },
        {
          description: 'Fix conditional logic error',
          effort: 'medium',
          confidence: 75,
        },
      ],
      // Add more patterns as needed
    };

    return fixes[pattern] || [
      {
        description: 'Investigate and debug test implementation',
        effort: 'medium',
        confidence: 50,
      },
    ];
  }

  private buildEvidenceTrail(
    traces: DebugTrace[],
    errorTraces: DebugTrace[],
    error: Error
  ): Array<{
    timestamp: number;
    evidence: string;
    relevance: 'high' | 'medium' | 'low';
  }> {
    const evidenceTrail: Array<{
      timestamp: number;
      evidence: string;
      relevance: 'high' | 'medium' | 'low';
    }> = [];

    // Add error traces as high relevance
    errorTraces.forEach(trace => {
      evidenceTrail.push({
        timestamp: trace.timestamp,
        evidence: `Error in ${trace.category}: ${trace.operation} - ${JSON.stringify(trace.details)}`,
        relevance: 'high',
      });
    });

    // Add warning traces as medium relevance
    const warningTraces = traces.filter(t => t.level === 'warn');
    warningTraces.forEach(trace => {
      evidenceTrail.push({
        timestamp: trace.timestamp,
        evidence: `Warning in ${trace.category}: ${trace.operation}`,
        relevance: 'medium',
      });
    });

    // Add the actual error as highest relevance
    evidenceTrail.push({
      timestamp: Date.now(),
      evidence: `Test failure: ${error.message}`,
      relevance: 'high',
    });

    return evidenceTrail.sort((a, b) => a.timestamp - b.timestamp);
  }

  private calculateReproducibilityScore(
    traces: DebugTrace[],
    errorTraces: DebugTrace[],
    context?: any
  ): number {
    let score = 100; // Start with perfect reproducibility

    // Reduce score based on non-deterministic factors
    const randomFactors = traces.filter(t => 
      t.details && (
        JSON.stringify(t.details).includes('Math.random') ||
        JSON.stringify(t.details).includes('Date.now') ||
        t.details.hasOwnProperty('timestamp')
      )
    ).length;

    score -= randomFactors * 5; // Reduce by 5 for each random factor

    // Reduce score if error traces are inconsistent
    if (errorTraces.length > 1) {
      const uniqueErrorTypes = new Set(errorTraces.map(t => t.operation));
      score -= (uniqueErrorTypes.size - 1) * 10; // Multiple error types reduce reproducibility
    }

    // Increase score if context is deterministic
    if (context && typeof context === 'object') {
      const contextKeys = Object.keys(context);
      if (contextKeys.includes('medications') && contextKeys.includes('schedules')) {
        score += 10; // Well-defined context increases reproducibility
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  private addContextualAnalysis(diagnosis: FailureDiagnosis, context: any): void {
    if (context.medications && context.schedules) {
      const medicationCount = context.medications.length;
      const scheduleCount = context.schedules.length;

      if (medicationCount === 0) {
        diagnosis.contributingFactors.push('No medications in test context');
      }

      if (scheduleCount === 0) {
        diagnosis.contributingFactors.push('No schedules in test context');
      }

      const enabledSchedules = context.schedules.filter((s: any) => s.enabled).length;
      if (enabledSchedules === 0) {
        diagnosis.contributingFactors.push('No enabled schedules in test context');
      }

      // Add contextual recommendations
      if (medicationCount > scheduleCount * 2) {
        diagnosis.recommendations.push('Consider adding more schedules to match medication count');
      }
    }

    if (context.expectedBehavior) {
      diagnosis.evidenceTrail.push({
        timestamp: Date.now(),
        evidence: `Expected behavior: ${context.expectedBehavior}`,
        relevance: 'medium',
      });
    }
  }

  generateDiagnosticReport(): DiagnosticReport {
    const reports = Array.from(this.diagnosticReports.values());
    
    const summary = {
      testsPassed: 0, // This would need to be tracked externally
      testsFailed: reports.length,
      totalExecutionTime: reports.reduce((sum, r) => sum + (r.evidenceTrail.length * 100), 0), // Rough estimate
      commonFailurePatterns: this.analyzeFailurePatterns(reports),
    };

    const performanceTrends = this.analyzePerformanceTrends(reports);
    const overallRecommendations = this.generateOverallRecommendations(reports);

    return {
      summary,
      failureAnalysis: reports,
      performanceTrends,
      recommendations: overallRecommendations,
    };
  }

  private analyzeFailurePatterns(reports: FailureDiagnosis[]): Array<{
    pattern: string;
    occurrences: number;
    testIds: string[];
  }> {
    const patterns = new Map<string, string[]>();

    reports.forEach(report => {
      const pattern = report.rootCause;
      if (!patterns.has(pattern)) {
        patterns.set(pattern, []);
      }
      patterns.get(pattern)!.push(report.testId);
    });

    return Array.from(patterns.entries()).map(([pattern, testIds]) => ({
      pattern,
      occurrences: testIds.length,
      testIds,
    })).sort((a, b) => b.occurrences - a.occurrences);
  }

  private analyzePerformanceTrends(reports: FailureDiagnosis[]): {
    averageTestTime: number;
    slowestTests: Array<{ testId: string; duration: number }>;
    memoryLeaks: Array<{ testId: string; leakSize: number }>;
  } {
    return {
      averageTestTime: 0, // Would need actual timing data
      slowestTests: [],
      memoryLeaks: reports
        .filter(r => r.rootCause.includes('Memory'))
        .map(r => ({ testId: r.testId, leakSize: 0 })), // Would need actual memory data
    };
  }

  private generateOverallRecommendations(reports: FailureDiagnosis[]): string[] {
    const recommendations = new Set<string>();

    // Add most common recommendations
    reports.forEach(report => {
      report.recommendations.forEach(rec => recommendations.add(rec));
    });

    // Add pattern-based recommendations
    const patterns = this.analyzeFailurePatterns(reports);
    if (patterns.length > 0 && patterns[0].occurrences > 1) {
      recommendations.add(`Address common failure pattern: ${patterns[0].pattern} (${patterns[0].occurrences} occurrences)`);
    }

    return Array.from(recommendations);
  }
}

/**
 * Convenience functions for easy debugging integration
 */
const debugTracer = DebugTracer.getInstance();
const executionVisualizer = new TestExecutionVisualizer();
const diagnosticEngine = new FailureDiagnosticEngine();

export function enableDebugging(testId: string): void {
  debugTracer.enable(true);
  debugTracer.setTestId(testId);
  executionVisualizer.startVisualization(testId);
}

export function disableDebugging(): void {
  debugTracer.enable(false);
}

export function traceOperation(
  category: string,
  operation: string,
  details: Record<string, any> = {}
): void {
  debugTracer.trace('debug', category, operation, details);
}

export function traceError(
  category: string,
  operation: string,
  error: Error,
  details: Record<string, any> = {}
): void {
  debugTracer.trace('error', category, operation, {
    ...details,
    error: error.message,
    stack: error.stack,
  }, true);
}

export function recordTestEvent(
  testId: string,
  event: string,
  details: any = {}
): void {
  executionVisualizer.recordEvent(testId, event, details);
}

export function recordStateChange(
  testId: string,
  component: string,
  before: any,
  after: any,
  trigger: string
): void {
  executionVisualizer.recordStateChange(testId, component, before, after, trigger);
}

export function diagnoseTestFailure(
  testId: string,
  error: Error,
  context?: {
    medications?: Medication[];
    schedules?: MedicationSchedule[];
    expectedBehavior?: string;
  }
): FailureDiagnosis {
  return diagnosticEngine.diagnoseFailure(testId, error, context);
}

export function generateTestReport(testId: string): string {
  return executionVisualizer.generateReport(testId);
}

export function generateDiagnosticReport(): DiagnosticReport {
  return diagnosticEngine.generateDiagnosticReport();
}

export function exportDebugData(testId?: string): {
  traces: DebugTrace[];
  visualization?: TestExecutionVisualization;
  diagnosis?: FailureDiagnosis;
} {
  const traces = debugTracer.getTraces(testId);
  const visualization = testId ? executionVisualizer.getVisualization(testId) : undefined;
  const reports = diagnosticEngine.generateDiagnosticReport();
  const diagnosis = testId ? reports.failureAnalysis.find(d => d.testId === testId) : undefined;

  return {
    traces,
    visualization,
    diagnosis,
  };
}

export function clearDebugData(testId?: string): void {
  debugTracer.clearTraces(testId);
}