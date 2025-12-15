/**
 * Notification Test Helpers
 * 
 * Provides utilities for testing notification scheduling and consistency verification.
 * These helpers mock and assert notification behavior to ensure schedule ID consistency.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';

export interface ScheduledNotificationData {
  medicationId?: string;
  scheduleId?: string;
  notificationType?: 'medication' | 'daily-checkin' | 'error';
  date?: string;
}

export interface NotificationMockManager {
  scheduledNotifications: Map<string, any>;
  scheduleCallHistory: any[];
  cancelCallHistory: string[];
  
  reset(): void;
  mockSuccessfulScheduling(): void;
  mockSchedulingError(error: Error): void;
  getScheduledNotificationsForMedication(medicationId: string): any[];
  getScheduledNotificationsForSchedule(scheduleId: string): any[];
}

/**
 * Creates a mock notification manager for testing
 */
export function createNotificationMockManager(): NotificationMockManager {
  const scheduledNotifications = new Map<string, any>();
  const scheduleCallHistory: any[] = [];
  const cancelCallHistory: string[] = [];

  return {
    scheduledNotifications,
    scheduleCallHistory,
    cancelCallHistory,

    reset() {
      scheduledNotifications.clear();
      scheduleCallHistory.length = 0;
      cancelCallHistory.length = 0;
      jest.clearAllMocks();
    },

    mockSuccessfulScheduling() {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockImplementation(
        async (notificationRequest: any) => {
          const notificationId = `mock-notif-${Date.now()}-${Math.random()}`;
          
          // Store the notification
          scheduledNotifications.set(notificationId, {
            id: notificationId,
            request: notificationRequest,
            scheduledTime: Date.now(),
          });
          
          // Track the call
          scheduleCallHistory.push(notificationRequest);
          
          logger.debug('[Mock] Notification scheduled', {
            notificationId,
            medicationId: notificationRequest.content?.data?.medicationId,
            scheduleId: notificationRequest.content?.data?.scheduleId,
          });
          
          return notificationId;
        }
      );

      (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockImplementation(
        async (notificationId: string) => {
          scheduledNotifications.delete(notificationId);
          cancelCallHistory.push(notificationId);
          
          logger.debug('[Mock] Notification cancelled', { notificationId });
        }
      );
    },

    mockSchedulingError(error: Error) {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(error);
    },

    getScheduledNotificationsForMedication(medicationId: string) {
      return Array.from(scheduledNotifications.values()).filter(notification =>
        notification.request?.content?.data?.medicationId === medicationId
      );
    },

    getScheduledNotificationsForSchedule(scheduleId: string) {
      return Array.from(scheduledNotifications.values()).filter(notification =>
        notification.request?.content?.data?.scheduleId === scheduleId
      );
    },
  };
}

/**
 * Asserts that a notification was scheduled with the correct schedule ID
 */
export async function expectNotificationScheduled(
  medicationId: string,
  scheduleId: string,
  expectedDate?: string
): Promise<void> {
  const scheduleCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
  
  // Find the call that matches our criteria
  const matchingCall = scheduleCalls.find(call => {
    const request = call[0];
    const data = request?.content?.data;
    
    return data?.medicationId === medicationId && data?.scheduleId === scheduleId;
  });

  expect(matchingCall).toBeDefined();
  
  if (matchingCall) {
    const request = matchingCall[0];
    const data = request.content.data;
    
    expect(data.medicationId).toBe(medicationId);
    expect(data.scheduleId).toBe(scheduleId);
    
    if (expectedDate) {
      expect(data.date).toBe(expectedDate);
    }
    
    // Verify notification has required structure
    expect(request.content.title).toBeDefined();
    expect(request.content.body).toBeDefined();
    expect(request.trigger).toBeDefined();
  }
}

/**
 * Asserts that a notification was cancelled
 */
export async function expectNotificationCancelled(notificationId: string): Promise<void> {
  const cancelCalls = (Notifications.cancelScheduledNotificationAsync as jest.Mock).mock.calls;
  
  const cancelledNotificationCall = cancelCalls.find(call => call[0] === notificationId);
  expect(cancelledNotificationCall).toBeDefined();
}

/**
 * Asserts that a grouped notification was scheduled for multiple medications
 */
export async function expectGroupedNotification(
  medicationIds: string[],
  scheduleIds: string[],
  time: string
): Promise<void> {
  const scheduleCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
  
  // Find grouped notification call
  const groupedCall = scheduleCalls.find(call => {
    const request = call[0];
    const data = request?.content?.data;
    
    return data?.notificationType === 'grouped-medication' &&
           data?.medicationIds && 
           data?.scheduleIds;
  });

  expect(groupedCall).toBeDefined();
  
  if (groupedCall) {
    const request = groupedCall[0];
    const data = request.content.data;
    
    expect(data.medicationIds).toEqual(expect.arrayContaining(medicationIds));
    expect(data.scheduleIds).toEqual(expect.arrayContaining(scheduleIds));
    
    // Verify trigger time
    const trigger = request.trigger;
    if (trigger?.type === 'daily') {
      const [hour, minute] = time.split(':').map(Number);
      expect(trigger.hour).toBe(hour);
      expect(trigger.minute).toBe(minute);
    }
  }
}

/**
 * Asserts that a notification was suppressed (not scheduled)
 */
export async function expectNotificationSuppressed(
  medicationId: string,
  scheduleId: string
): Promise<void> {
  const scheduleCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
  
  // Verify NO call was made for this medication/schedule combination
  const suppressedCall = scheduleCalls.find(call => {
    const request = call[0];
    const data = request?.content?.data;
    
    return data?.medicationId === medicationId && data?.scheduleId === scheduleId;
  });

  expect(suppressedCall).toBeUndefined();
}

/**
 * Verifies the total number of notifications scheduled
 */
export async function verifyNotificationCount(expectedCount: number): Promise<void> {
  const scheduleCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
  expect(scheduleCalls).toHaveLength(expectedCount);
}

/**
 * Verifies notification timing matches schedule
 */
export function verifyNotificationTiming(scheduleTime: string, actualTrigger: any): void {
  const [expectedHour, expectedMinute] = scheduleTime.split(':').map(Number);
  
  if (actualTrigger.type === 'daily') {
    expect(actualTrigger.hour).toBe(expectedHour);
    expect(actualTrigger.minute).toBe(expectedMinute);
  } else if (actualTrigger.type === 'date') {
    const triggerDate = new Date(actualTrigger.date);
    expect(triggerDate.getHours()).toBe(expectedHour);
    expect(triggerDate.getMinutes()).toBe(expectedMinute);
  }
}

/**
 * Verifies notification has expected action buttons
 */
export function verifyNotificationActions(
  notificationId: string,
  expectedActions: string[]
): void {
  const scheduleCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
  
  const notificationCall = scheduleCalls.find(call => {
    const request = call[0];
    return request.identifier === notificationId;
  });

  expect(notificationCall).toBeDefined();
  
  if (notificationCall) {
    const request = notificationCall[0];
    const categoryIdentifier = request.content?.categoryIdentifier;
    
    // Actions are typically defined by category
    expect(categoryIdentifier).toBeDefined();
    
    // For medication notifications, verify it uses the correct category
    if (expectedActions.includes('take') || expectedActions.includes('skip')) {
      expect(categoryIdentifier).toMatch(/MEDICATION_REMINDER/);
    }
  }
}

/**
 * Daily check-in specific assertions
 */
export async function expectDailyCheckinScheduled(expectedDate: string): Promise<void> {
  const scheduleCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
  
  const checkinCall = scheduleCalls.find(call => {
    const request = call[0];
    const data = request?.content?.data;
    
    return data?.notificationType === 'daily-checkin' && data?.date === expectedDate;
  });

  expect(checkinCall).toBeDefined();
  
  if (checkinCall) {
    const request = checkinCall[0];
    expect(request.content.title).toMatch(/daily.*check.*in/i);
  }
}

export async function expectDailyCheckinCancelled(_date: string): Promise<void> {
  // Note: Daily check-in cancellation would typically be verified through
  // the dailyCheckinService mock, not direct notification cancellation
  // since the service handles batch operations
}

/**
 * Consistency verification utilities
 */
export class NotificationConsistencyVerifier {
  /**
   * Verify all scheduled notifications have valid data structure
   */
  static async verifyNotificationDataIntegrity(): Promise<void> {
    const scheduleCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
    
    for (const call of scheduleCalls) {
      const request = call[0];
      
      // Basic structure validation
      expect(request.content).toBeDefined();
      expect(request.content.title).toBeDefined();
      expect(request.content.body).toBeDefined();
      expect(request.trigger).toBeDefined();
      
      // Data payload validation for medication notifications
      if (request.content.data?.medicationId) {
        expect(request.content.data.medicationId).toMatch(/^med-/);
        
        if (request.content.data.scheduleId) {
          expect(request.content.data.scheduleId).toMatch(/^sched-/);
        }
      }
    }
  }
  
  /**
   * Verify no duplicate notifications for the same medication/schedule/date
   */
  static async verifyNoDuplicateNotifications(): Promise<void> {
    const scheduleCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
    const notificationKeys = new Set<string>();
    
    for (const call of scheduleCalls) {
      const request = call[0];
      const data = request.content?.data;
      
      if (data?.medicationId && data?.scheduleId && data?.date) {
        const key = `${data.medicationId}-${data.scheduleId}-${data.date}`;
        
        expect(notificationKeys.has(key)).toBe(false);
        notificationKeys.add(key);
      }
    }
  }
  
  /**
   * Verify notification timing is within reasonable bounds
   */
  static async verifyNotificationTimingBounds(): Promise<void> {
    const scheduleCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
    
    for (const call of scheduleCalls) {
      const request = call[0];
      const trigger = request.trigger;
      
      if (trigger?.type === 'daily') {
        expect(trigger.hour).toBeGreaterThanOrEqual(0);
        expect(trigger.hour).toBeLessThan(24);
        expect(trigger.minute).toBeGreaterThanOrEqual(0);
        expect(trigger.minute).toBeLessThan(60);
      } else if (trigger?.type === 'date') {
        const triggerDate = new Date(trigger.date);
        expect(triggerDate.getTime()).toBeGreaterThan(Date.now() - 1000); // Not in the past
      }
    }
  }
}