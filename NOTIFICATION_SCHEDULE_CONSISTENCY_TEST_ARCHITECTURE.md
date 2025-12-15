# Notification-Schedule Consistency Test Architecture

## Overview

This document designs a comprehensive test architecture for notification-schedule consistency integration tests. The design builds on the excellent existing test patterns identified in the codebase and provides a clear roadmap for implementing robust integration tests that cover both medication notifications AND daily check-in notifications.

## Test File Structure

Following the established patterns from the existing test infrastructure:

```
app/src/__tests__/integration/
├── notificationScheduleConsistency/
│   ├── core/
│   │   ├── medicationNotificationConsistency.integration.test.ts
│   │   ├── dailyCheckinConsistency.integration.test.ts
│   │   └── crossTypeConsistency.integration.test.ts
│   ├── edgeCases/
│   │   ├── raceConditionConsistency.integration.test.ts
│   │   ├── concurrentOperationsConsistency.integration.test.ts
│   │   └── errorRecoveryConsistency.integration.test.ts
│   └── helpers/
│       ├── notificationTestHelpers.ts
│       ├── scheduleTestHelpers.ts
│       └── consistencyAssertions.ts
```

### File Responsibilities

#### Core Tests
- **medicationNotificationConsistency.integration.test.ts**: Tests medication notification workflows
- **dailyCheckinConsistency.integration.test.ts**: Tests daily check-in notification workflows  
- **crossTypeConsistency.integration.test.ts**: Tests interaction between medication and daily check-in notifications

#### Edge Cases
- **raceConditionConsistency.integration.test.ts**: Tests schedule changes during active notifications
- **concurrentOperationsConsistency.integration.test.ts**: Tests light concurrent operations
- **errorRecoveryConsistency.integration.test.ts**: Tests error scenarios and recovery

#### Helpers
- **notificationTestHelpers.ts**: Notification mock utilities and assertions
- **scheduleTestHelpers.ts**: Schedule manipulation and verification utilities
- **consistencyAssertions.ts**: Specialized assertion helpers for consistency verification

## Test Utilities Architecture

### 1. Notification State Assertions (`notificationTestHelpers.ts`)

```typescript
export interface NotificationTestHelpers {
  // Mock OS-like notification behavior
  mockExpoNotifications: () => NotificationMockManager;
  
  // Assertion helpers
  expectNotificationScheduled: (medicationId: string, scheduleId: string, date: string) => Promise<void>;
  expectNotificationCancelled: (notificationId: string) => Promise<void>;
  expectGroupedNotification: (medicationIds: string[], scheduleIds: string[], time: string) => Promise<void>;
  expectNotificationSuppressed: (medicationId: string, scheduleId: string) => Promise<void>;
  
  // Verification utilities
  verifyNotificationCount: (expectedCount: number) => Promise<void>;
  verifyNotificationTiming: (scheduleTime: string, actualTrigger: any) => void;
  verifyNotificationActions: (notificationId: string, expectedActions: string[]) => void;
  
  // Daily check-in specific
  expectDailyCheckinScheduled: (date: string) => Promise<void>;
  expectDailyCheckinCancelled: (date: string) => Promise<void>;
}
```

### 2. Database Consistency Verification (`scheduleTestHelpers.ts`)

```typescript
export interface ScheduleTestHelpers {
  // Database state verification
  verifyScheduleMappingExists: (medicationId: string, scheduleId: string, date: string) => Promise<void>;
  verifyScheduleMappingAbsent: (medicationId: string, scheduleId: string, date: string) => Promise<void>;
  verifyGroupedMappings: (groupKey: string, date: string, expectedMedIds: string[]) => Promise<void>;
  
  // Schedule manipulation
  createTestMedicationSchedule: (medicationId: string, time: string, timezone: string) => Promise<MedicationSchedule>;
  createTestDailyCheckinSchedule: (time: string) => Promise<void>;
  modifyScheduleTime: (scheduleId: string, newTime: string) => Promise<void>;
  
  // Database integrity checks
  verifyForeignKeyConstraints: () => Promise<void>;
  verifyScheduleIdConsistency: () => Promise<void>;
  verifyNoOrphanedNotifications: () => Promise<void>;
  
  // Daily check-in specific
  verifyDailyCheckinMapping: (date: string) => Promise<void>;
  verifyDailyCheckinCount: (expectedCount: number) => Promise<void>;
}
```

### 3. Schedule ID Synchronization Testing (`consistencyAssertions.ts`)

```typescript
export interface ConsistencyAssertions {
  // Cross-layer ID verification
  assertScheduleIdSync: (medicationId: string, scheduleId: string) => Promise<void>;
  assertNotificationIdMapping: (scheduleId: string, notificationId: string) => Promise<void>;
  assertGroupKeyConsistency: (medicationIds: string[], expectedGroupKey: string) => Promise<void>;
  
  // State consistency
  assertStoreNotificationSync: (medicationId: string) => Promise<void>;
  assertDatabaseNotificationSync: (medicationId: string) => Promise<void>;
  assertOSNotificationSync: (expectedScheduled: string[]) => Promise<void>;
  
  // Timing consistency
  assertNotificationTiming: (scheduleTime: string, notificationTrigger: any) => void;
  assertTimezoneConsistency: (timezone: string, scheduledTime: string) => void;
  
  // Error state consistency
  assertErrorStateCleanup: () => Promise<void>;
  assertRecoveryStateIntegrity: () => Promise<void>;
  
  // Daily check-in consistency
  assertDailyCheckinIdSync: (date: string) => Promise<void>;
  assertDailyCheckinTiming: (expectedTime: string) => Promise<void>;
}
```

### 4. Mock Notification Lifecycle Management

```typescript
export class NotificationMockManager {
  // OS-like notification lifecycle
  scheduleNotification: (request: NotificationRequest) => Promise<string>;
  cancelNotification: (notificationId: string) => Promise<void>;
  getScheduledNotifications: () => Promise<NotificationRequest[]>;
  getPresentedNotifications: () => Promise<PresentedNotification[]>;
  
  // Simulation controls
  simulateNotificationReceived: (notificationId: string) => Promise<void>;
  simulateNotificationResponse: (notificationId: string, action: string) => Promise<void>;
  simulateOSSchedulingError: (errorType: 'permission' | 'timing' | 'system') => void;
  simulateOSRestart: () => Promise<void>;
  
  // Verification methods
  verifyScheduleCall: (medicationId: string, scheduleId: string) => NotificationRequest | null;
  verifyCancel: (notificationId: string) => boolean;
  getAllMockCalls: () => NotificationMockCall[];
  
  // Reset utilities
  reset: () => void;
  clearHistory: () => void;
}
```

### 5. Time Manipulation for Scheduling Tests

```typescript
export interface TimeTestUtilities {
  // Time control
  setMockDate: (date: Date) => void;
  advanceTime: (minutes: number) => void;
  setTimezone: (timezone: string) => void;
  resetTime: () => void;
  
  // Schedule timing helpers
  createFutureSchedule: (hoursFromNow: number) => { time: string; date: string };
  createPastSchedule: (hoursAgo: number) => { time: string; date: string };
  createTodaySchedule: (hour: number, minute: number) => string;
  
  // Date utilities for testing
  getTodayDateString: () => string;
  getTomorrowDateString: () => string;
  getDateString: (daysFromToday: number) => string;
  
  // Timezone testing
  convertTimeToTimezone: (time: string, fromTz: string, toTz: string) => string;
  verifyTimezoneHandling: (scheduleTime: string, timezone: string) => void;
}
```

## Mock Strategy

### 1. Expo Notifications System Mock

**Goal**: Simulate how the OS would handle notifications with realistic behavior and limitations.

```typescript
export class ExpoNotificationsMock {
  private scheduledNotifications = new Map<string, NotificationRequest>();
  private presentedNotifications = new Map<string, PresentedNotification>();
  private failureRate = 0; // Simulate occasional OS failures
  
  // Core notification methods
  scheduleNotificationAsync = jest.fn(this.handleScheduleRequest.bind(this));
  cancelScheduledNotificationAsync = jest.fn(this.handleCancelRequest.bind(this));
  getAllScheduledNotificationsAsync = jest.fn(this.getScheduled.bind(this));
  getPresentedNotificationsAsync = jest.fn(this.getPresented.bind(this));
  
  // Realistic OS-like behavior simulation
  private handleScheduleRequest(request: NotificationRequest): Promise<string> {
    if (Math.random() < this.failureRate) {
      throw new Error('OS scheduling failed');
    }
    
    const notificationId = `mock_${Date.now()}_${Math.random()}`;
    this.scheduledNotifications.set(notificationId, request);
    return Promise.resolve(notificationId);
  }
  
  private handleCancelRequest(notificationId: string): Promise<void> {
    this.scheduledNotifications.delete(notificationId);
    this.presentedNotifications.delete(notificationId);
    return Promise.resolve();
  }
  
  // Test utilities
  setFailureRate(rate: number): void {
    this.failureRate = rate;
  }
  
  simulateOSRestart(): void {
    // Simulate OS restart - some scheduled notifications might be lost
    const toKeep = Array.from(this.scheduledNotifications.entries()).filter(() => Math.random() > 0.1);
    this.scheduledNotifications.clear();
    toKeep.forEach(([id, request]) => this.scheduledNotifications.set(id, request));
  }
}
```

### 2. Database Repository Mocks with Notification Mappings

```typescript
export class MockRepositoryManager {
  // Repository mocks that maintain consistency
  scheduledNotificationRepository: typeof scheduledNotificationRepository;
  medicationRepository: typeof medicationRepository;
  medicationScheduleRepository: typeof medicationScheduleRepository;
  medicationDoseRepository: typeof medicationDoseRepository;
  
  constructor() {
    this.setupRepositoryMocks();
  }
  
  private setupRepositoryMocks(): void {
    // Mock scheduledNotificationRepository with in-memory storage
    this.setupScheduledNotificationMock();
    this.setupMedicationRepositoryMock();
    this.setupScheduleRepositoryMock();
    this.setupDoseRepositoryMock();
  }
  
  // Ensure all repositories maintain referential integrity
  verifyRepositoryConsistency(): Promise<void> {
    // Check that all notification mappings reference valid medications/schedules
    // Check that all schedules have corresponding notification mappings when enabled
    // Check foreign key consistency
  }
}
```

### 3. Store State Management Mocks

```typescript
export class MockStoreManager {
  // Store mocks that track state changes
  medicationStore: ReturnType<typeof useMedicationStore.getState>;
  notificationStore: any; // If notification store exists
  
  constructor() {
    this.setupStoreMocks();
  }
  
  private setupStoreMocks(): void {
    // Mock store methods with state tracking
    // Ensure store operations trigger appropriate repository calls
    // Track state changes for consistency verification
  }
  
  // Verify store-repository consistency
  verifyStoreRepositorySync(): Promise<void> {
    // Check that store state matches repository state
    // Verify notification-related store state
  }
}
```

### 4. Error Scenarios and Recovery Mocks

```typescript
export class ErrorScenarioSimulator {
  // Database error simulation
  simulateDatabaseError(operation: 'read' | 'write' | 'transaction'): void;
  
  // Network/OS error simulation  
  simulateNotificationSystemError(type: 'permission' | 'scheduling' | 'cancellation'): void;
  
  // Race condition simulation
  simulateRaceCondition(scenario: 'schedule-during-log' | 'reschedule-during-cancel'): void;
  
  // Recovery verification
  verifyErrorRecovery(): Promise<void>;
  verifyDataIntegrity(): Promise<void>;
}
```

## Test Scenarios Framework

### 1. Core Workflow Consistency Tests

```typescript
describe('Core Notification-Schedule Consistency', () => {
  describe('Medication Notifications', () => {
    it('should maintain schedule ID consistency through complete workflow', async () => {
      // Test: create schedule → schedule notification → log dose → cancel notification
      // Verify: schedule IDs match at each step
      // Verify: database mappings are correct
      // Verify: OS notifications are properly managed
    });
    
    it('should handle grouped notifications with consistent schedule IDs', async () => {
      // Test: multiple medications same time → grouped notification → log one → verify others remain
      // Verify: group key consistency
      // Verify: individual schedule ID preservation in group
    });
  });
  
  describe('Daily Check-in Notifications', () => {
    it('should maintain consistent daily check-in scheduling', async () => {
      // Test: schedule daily check-in → verify mapping → log status → verify cancellation
      // Verify: daily check-in notification ID consistency
      // Verify: proper separation from medication notifications
    });
    
    it('should handle daily check-in and medication notification coexistence', async () => {
      // Test: both types scheduled for same time → verify independence
      // Verify: no cross-contamination of schedule IDs
    });
  });
});
```

### 2. Schedule Change Race Conditions

```typescript
describe('Schedule Change Race Conditions', () => {
  it('should handle schedule modification during active notification', async () => {
    // Test: notification displayed → user changes schedule → verify consistency
    // Verify: old notification properly cancelled
    // Verify: new notification scheduled with correct IDs
    // Verify: no orphaned mappings
  });
  
  it('should handle concurrent schedule changes', async () => {
    // Test: multiple rapid schedule changes
    // Verify: final state is consistent
    // Verify: all intermediate notifications cancelled
  });
  
  it('should handle reschedule during medication logging', async () => {
    // Test: user logging dose while schedule changes in background
    // Verify: operation completes without corruption
    // Verify: correct final state
  });
});
```

### 3. Database Integrity During Concurrent Operations

```typescript
describe('Concurrent Operations Database Integrity', () => {
  it('should maintain foreign key constraints during concurrent modifications', async () => {
    // Test: concurrent medication creation, schedule changes, dose logging
    // Verify: no constraint violations
    // Verify: consistent state after all operations complete
  });
  
  it('should handle concurrent notification scheduling and cancellation', async () => {
    // Test: overlapping schedule/cancel operations
    // Verify: final state matches intended operations
    // Verify: no leaked notification mappings
  });
  
  it('should maintain consistency during medication archiving with active notifications', async () => {
    // Test: archive medication while notifications are scheduled
    // Verify: all notifications properly cancelled
    // Verify: mappings cleaned up correctly
  });
});
```

### 4. Error Recovery and User Guidance

```typescript
describe('Error Recovery and User Guidance', () => {
  it('should recover from notification system permissions denial', async () => {
    // Test: permissions denied during scheduling
    // Verify: app continues to function
    // Verify: user receives appropriate guidance
    // Verify: schedules can be re-activated when permissions granted
  });
  
  it('should handle notification system restart gracefully', async () => {
    // Test: simulate OS restart/notification system reset
    // Verify: app detects missing notifications
    // Verify: automatic rescheduling works
    // Verify: no duplicate notifications
  });
  
  it('should maintain consistency during partial operation failures', async () => {
    // Test: database succeeds but notification scheduling fails (or vice versa)
    // Verify: system reaches consistent state
    // Verify: user is informed of the issue
    // Verify: retry mechanisms work
  });
});
```

### 5. Daily Check-in Integration with Medication Notifications

```typescript
describe('Daily Check-in Integration', () => {
  it('should schedule daily check-ins without interfering with medication notifications', async () => {
    // Test: both daily check-in and medication notifications active
    // Verify: independent scheduling
    // Verify: proper categorization in database
    // Verify: correct notification types
  });
  
  it('should handle overlapping daily check-in and medication notification times', async () => {
    // Test: daily check-in and medication scheduled for same time
    // Verify: both notifications appear
    // Verify: no ID conflicts
    // Verify: independent cancellation
  });
  
  it('should maintain daily check-in consistency during medication changes', async () => {
    // Test: modify medications while daily check-ins are active
    // Verify: daily check-ins unaffected
    // Verify: no cross-contamination in mappings
  });
});
```

## Assertion Patterns

### 1. Schedule ID Consistency Verification

```typescript
export async function assertScheduleIdConsistency(
  medicationId: string,
  scheduleId: string,
  context: 'creation' | 'notification' | 'dose_log' | 'cancellation'
): Promise<void> {
  // Verify schedule exists in medication_schedules table
  const schedule = await medicationScheduleRepository.getById(scheduleId);
  expect(schedule).toBeTruthy();
  expect(schedule.medicationId).toBe(medicationId);
  
  // Verify notification mapping exists (if notification context)
  if (['notification', 'dose_log', 'cancellation'].includes(context)) {
    const mapping = await scheduledNotificationRepository.getMapping(
      medicationId, 
      scheduleId, 
      getCurrentDateString(), 
      'reminder'
    );
    expect(mapping).toBeTruthy();
    expect(mapping.medicationId).toBe(medicationId);
    expect(mapping.scheduleId).toBe(scheduleId);
  }
  
  // Verify store state consistency
  const storeState = useMedicationStore.getState();
  const medication = storeState.medications.find(m => m.id === medicationId);
  if (medication?.schedule) {
    const storeSchedule = medication.schedule.find(s => s.id === scheduleId);
    expect(storeSchedule).toBeTruthy();
    expect(storeSchedule.medicationId).toBe(medicationId);
  }
}
```

### 2. Database State Integrity Checking

```typescript
export async function assertDatabaseStateIntegrity(): Promise<void> {
  // Verify no orphaned notification mappings
  const mappings = await scheduledNotificationRepository.getAllMappings();
  for (const mapping of mappings) {
    if (mapping.medicationId) {
      const medication = await medicationRepository.getById(mapping.medicationId);
      expect(medication).toBeTruthy();
    }
    
    if (mapping.scheduleId) {
      const schedule = await medicationScheduleRepository.getById(mapping.scheduleId);
      expect(schedule).toBeTruthy();
    }
  }
  
  // Verify no orphaned schedules without medications
  const allSchedules = await medicationScheduleRepository.getAll();
  for (const schedule of allSchedules) {
    const medication = await medicationRepository.getById(schedule.medicationId);
    expect(medication).toBeTruthy();
  }
  
  // Verify foreign key constraints are maintained
  // (This would use the database integrity checks from migrations tests)
}
```

### 3. Notification Mock Verification

```typescript
export function assertNotificationMockState(
  mockManager: NotificationMockManager,
  expectedState: {
    scheduledCount: number;
    cancelledCount: number;
    medicationNotifications: Array<{ medicationId: string; scheduleId: string }>;
    dailyCheckinNotifications: Array<{ date: string }>;
  }
): void {
  const scheduledNotifications = mockManager.getAllMockCalls().filter(call => call.type === 'schedule');
  expect(scheduledNotifications).toHaveLength(expectedState.scheduledCount);
  
  const cancelledNotifications = mockManager.getAllMockCalls().filter(call => call.type === 'cancel');
  expect(cancelledNotifications).toHaveLength(expectedState.cancelledCount);
  
  // Verify medication notifications
  expectedState.medicationNotifications.forEach(({ medicationId, scheduleId }) => {
    const notification = mockManager.verifyScheduleCall(medicationId, scheduleId);
    expect(notification).toBeTruthy();
    expect(notification.content.data.medicationId).toBe(medicationId);
    expect(notification.content.data.scheduleId).toBe(scheduleId);
  });
  
  // Verify daily check-in notifications
  expectedState.dailyCheckinNotifications.forEach(({ date }) => {
    const notification = scheduledNotifications.find(call => 
      call.request.content.data.sourceType === 'daily_checkin' &&
      call.request.content.data.date === date
    );
    expect(notification).toBeTruthy();
  });
}
```

### 4. Error Handling Validation

```typescript
export async function assertErrorHandlingIntegrity(
  errorScenario: string,
  expectedRecoveryState: {
    notificationsScheduled: boolean;
    databaseConsistent: boolean;
    userInformed: boolean;
  }
): Promise<void> {
  // Verify database is in consistent state
  if (expectedRecoveryState.databaseConsistent) {
    await assertDatabaseStateIntegrity();
  }
  
  // Verify notifications are in expected state
  if (expectedRecoveryState.notificationsScheduled) {
    // Check that appropriate notifications are scheduled
    const mockManager = getCurrentNotificationMock();
    expect(mockManager.getScheduledNotifications().length).toBeGreaterThan(0);
  }
  
  // Verify user has been informed (would check UI state or logs)
  if (expectedRecoveryState.userInformed) {
    // Implementation depends on how errors are communicated to user
    // Could check error logs, toast messages, UI error states, etc.
  }
}
```

### 5. Performance Under Light Concurrency

```typescript
export async function assertPerformanceUnderConcurrency(
  operations: Array<() => Promise<void>>,
  maxExecutionTime: number = 5000,
  expectedConsistency: boolean = true
): Promise<void> {
  const startTime = Date.now();
  
  // Execute operations concurrently
  await Promise.all(operations.map(op => op()));
  
  const executionTime = Date.now() - startTime;
  expect(executionTime).toBeLessThan(maxExecutionTime);
  
  if (expectedConsistency) {
    // Verify final state is consistent
    await assertDatabaseStateIntegrity();
    await assertScheduleIdGlobalConsistency();
  }
}

async function assertScheduleIdGlobalConsistency(): Promise<void> {
  // Verify all schedule IDs are consistent across all systems
  const medications = await medicationRepository.getAll();
  
  for (const medication of medications) {
    if (medication.schedule) {
      for (const schedule of medication.schedule) {
        await assertScheduleIdConsistency(medication.id, schedule.id, 'notification');
      }
    }
  }
}
```

## Implementation Roadmap

### Phase 1: Infrastructure Setup
1. Create test file structure following established patterns
2. Implement `notificationTestHelpers.ts` with basic mock utilities
3. Implement `scheduleTestHelpers.ts` with database verification utilities
4. Set up `ExpoNotificationsMock` class with OS-like behavior

### Phase 2: Core Consistency Tests
1. Implement `medicationNotificationConsistency.integration.test.ts`
2. Implement `dailyCheckinConsistency.integration.test.ts` 
3. Create basic assertion helpers in `consistencyAssertions.ts`

### Phase 3: Edge Case Coverage
1. Implement `raceConditionConsistency.integration.test.ts`
2. Implement `concurrentOperationsConsistency.integration.test.ts`
3. Add advanced mock behaviors for error simulation

### Phase 4: Error Recovery & Polish
1. Implement `errorRecoveryConsistency.integration.test.ts`
2. Implement `crossTypeConsistency.integration.test.ts`
3. Add performance assertions and comprehensive documentation

### Phase 5: Validation & Documentation
1. Run full test suite and verify coverage
2. Document common patterns and troubleshooting
3. Create examples for future test development

## Integration with Existing Infrastructure

This design leverages the excellent existing patterns:

- **Test Structure**: Follows the `__tests__/integration/` pattern from `medicationFlow.integration.test.ts`
- **Mock Patterns**: Builds on the comprehensive Jest mocks from `jest.setup.js`
- **Database Testing**: Uses the adapter pattern from `migrations.integration.test.ts`
- **Helper Utilities**: Extends the pattern from `testHelpers.ts`
- **E2E Integration**: Can be combined with the robust E2E patterns from `medicationTracking.test.js`

The architecture ensures comprehensive coverage of notification-schedule consistency while maintaining the high quality standards established in the existing test infrastructure.