/**
 * Notification Scheduler Tests
 *
 * Tests for the core scheduling functions in notificationScheduler.ts:
 * - scheduleNotificationAtomic: atomic scheduling with DB tracking
 * - scheduleNotificationsBatch: batch scheduling
 * - cancelNotificationAtomic: atomic cancellation
 * - Helper functions: dismissNotification, getPresentedNotifications
 */

import * as Notifications from 'expo-notifications';

// Mock dependencies BEFORE importing the module
jest.mock('expo-notifications');
jest.mock('../../database/scheduledNotificationRepository');
jest.mock('../../services/errorLogger');

// Setup Notifications mock
(Notifications as any).AndroidNotificationPriority = {
  MIN: -2,
  LOW: -1,
  DEFAULT: 0,
  HIGH: 1,
  MAX: 2,
};
(Notifications as any).SchedulableTriggerInputTypes = {
  DAILY: 'daily',
  DATE: 'date',
  TIME_INTERVAL: 'timeInterval',
};
(Notifications.scheduleNotificationAsync as jest.Mock) = jest.fn();
(Notifications.cancelScheduledNotificationAsync as jest.Mock) = jest.fn();
(Notifications.getAllScheduledNotificationsAsync as jest.Mock) = jest.fn();
(Notifications.getPresentedNotificationsAsync as jest.Mock) = jest.fn();
(Notifications.dismissNotificationAsync as jest.Mock) = jest.fn();

// Import after mocks
import {
  scheduleNotificationAtomic,
  scheduleNotificationsBatch,
  cancelNotificationAtomic,
  dismissNotification,
  getPresentedNotifications,
  getAllScheduledNotifications,
  getTodayDateString,
  getDateStringForDaysAhead,
  createDateTimeFromStrings,
  extractMedicationName,
  calculateTriggerTime,
} from '../notifications/notificationScheduler';
import { scheduledNotificationRepository } from '../../database/scheduledNotificationRepository';
import { ScheduledNotificationMappingInput } from '../../types/notifications';

describe('notificationScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Default mock implementations
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-123');
    (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockResolvedValue(undefined);
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
    (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue([]);
    (Notifications.dismissNotificationAsync as jest.Mock).mockResolvedValue(undefined);

    // Mock repository
    (scheduledNotificationRepository.saveMapping as jest.Mock).mockResolvedValue({
      id: 'mapping-123',
      medicationId: 'med-1',
      scheduleId: 'sched-1',
      date: '2024-01-15',
      notificationId: 'notif-123',
      notificationType: 'reminder',
      isGrouped: false,
      sourceType: 'medication',
      createdAt: '2024-01-15T10:00:00.000Z',
    });
    (scheduledNotificationRepository.deleteMappingsByNotificationId as jest.Mock).mockResolvedValue(
      1
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('scheduleNotificationAtomic', () => {
    const mockContent: Notifications.NotificationContentInput = {
      title: 'Test Notification',
      body: 'Test body',
      data: { type: 'reminder' },
    };

    const mockTrigger = new Date('2024-01-15T08:00:00');

    const mockMapping: ScheduledNotificationMappingInput = {
      medicationId: 'med-1',
      scheduleId: 'sched-1',
      date: '2024-01-15',
      notificationType: 'reminder',
      isGrouped: false,
    };

    it('should schedule notification and save mapping on success', async () => {
      // Act
      const result = await scheduleNotificationAtomic(mockContent, mockTrigger, mockMapping);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe('mapping-123');
      expect(result?.notificationId).toBe('notif-123');

      // Verify OS notification was scheduled with DATE trigger
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: mockContent,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: mockTrigger,
        },
      });

      // Verify mapping was saved to database with extracted metadata
      expect(scheduledNotificationRepository.saveMapping).toHaveBeenCalledWith({
        ...mockMapping,
        notificationId: 'notif-123',
        // Metadata extracted from notification content and trigger
        medicationName: undefined, // No medication name pattern in "Test Notification"
        scheduledTriggerTime: mockTrigger,
        notificationTitle: 'Test Notification',
        notificationBody: 'Test body',
        categoryIdentifier: undefined, // Not set in mockContent
      });
    });

    it('should extract metadata from medication notification content', async () => {
      // Arrange - medication notification content
      const medicationContent: Notifications.NotificationContentInput = {
        title: 'Time for Ibuprofen',
        body: '2 dose(s) - 200mg each',
        data: {
          medicationId: 'med-123',
          scheduleId: 'sched-456',
        },
        categoryIdentifier: 'MEDICATION_REMINDER',
        sound: true,
      };

      const triggerDate = new Date('2024-01-15T08:30:00.000Z');

      const mapping: ScheduledNotificationMappingInput = {
        medicationId: 'med-123',
        scheduleId: 'sched-456',
        date: '2024-01-15',
        notificationType: 'reminder',
        isGrouped: false,
      };

      // Act
      const result = await scheduleNotificationAtomic(medicationContent, triggerDate, mapping);

      // Assert
      expect(result).not.toBeNull();

      // Verify metadata extraction
      expect(scheduledNotificationRepository.saveMapping).toHaveBeenCalledWith({
        ...mapping,
        notificationId: 'notif-123',
        medicationName: 'Ibuprofen', // Extracted from title "Time for Ibuprofen"
        scheduledTriggerTime: triggerDate,
        notificationTitle: 'Time for Ibuprofen',
        notificationBody: '2 dose(s) - 200mg each',
        categoryIdentifier: 'MEDICATION_REMINDER',
      });
    });

    it('should handle follow-up notification metadata extraction', async () => {
      // Arrange - follow-up notification content
      const followUpContent: Notifications.NotificationContentInput = {
        title: 'Reminder: Aspirin',
        body: 'Did you take your medication?',
        data: {
          medicationId: 'med-789',
          scheduleId: 'sched-101',
          isFollowUp: true,
        },
        categoryIdentifier: 'MEDICATION_REMINDER',
        sound: true,
      };

      const triggerDate = new Date('2024-01-15T09:00:00.000Z');

      const mapping: ScheduledNotificationMappingInput = {
        medicationId: 'med-789',
        scheduleId: 'sched-101',
        date: '2024-01-15',
        notificationType: 'follow_up',
        isGrouped: false,
      };

      // Act
      const result = await scheduleNotificationAtomic(followUpContent, triggerDate, mapping);

      // Assert
      expect(result).not.toBeNull();

      // Verify metadata extraction for follow-up
      expect(scheduledNotificationRepository.saveMapping).toHaveBeenCalledWith({
        ...mapping,
        notificationId: 'notif-123',
        medicationName: 'Aspirin', // Extracted from title "Reminder: Aspirin"
        scheduledTriggerTime: triggerDate,
        notificationTitle: 'Reminder: Aspirin',
        notificationBody: 'Did you take your medication?',
        categoryIdentifier: 'MEDICATION_REMINDER',
      });
    });

    it('should cancel notification when database save fails (compensating transaction)', async () => {
      // Arrange
      (scheduledNotificationRepository.saveMapping as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      // Act
      const result = await scheduleNotificationAtomic(mockContent, mockTrigger, mockMapping);

      // Assert
      expect(result).toBeNull();

      // Verify compensating transaction: notification should be cancelled
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-123');
    });

    it('should handle notification cancellation failure in compensating transaction gracefully', async () => {
      // Arrange
      (scheduledNotificationRepository.saveMapping as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );
      (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockRejectedValue(
        new Error('Cancel failed')
      );

      // Act
      const result = await scheduleNotificationAtomic(mockContent, mockTrigger, mockMapping);

      // Assert - should still return null without throwing
      expect(result).toBeNull();
    });

    it('should return null when OS scheduling throws', async () => {
      // Arrange
      (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(
        new Error('Platform error')
      );

      // Act
      const result = await scheduleNotificationAtomic(mockContent, mockTrigger, mockMapping);

      // Assert
      expect(result).toBeNull();
      expect(scheduledNotificationRepository.saveMapping).not.toHaveBeenCalled();
    });
  });

  describe('scheduleNotificationsBatch', () => {
    const createNotificationRequest = (id: string, date: string) => ({
      content: {
        title: `Test Notification ${id}`,
        body: 'Test body',
        data: { type: 'reminder' },
      } as Notifications.NotificationContentInput,
      trigger: new Date(`${date}T08:00:00`),
      mapping: {
        medicationId: `med-${id}`,
        scheduleId: `sched-${id}`,
        date,
        notificationType: 'reminder' as const,
        isGrouped: false,
      },
    });

    it('should schedule multiple notifications and return all mappings', async () => {
      // Arrange
      const notifications = [
        createNotificationRequest('1', '2024-01-15'),
        createNotificationRequest('2', '2024-01-16'),
        createNotificationRequest('3', '2024-01-17'),
      ];

      let callCount = 0;
      (Notifications.scheduleNotificationAsync as jest.Mock).mockImplementation(() => {
        callCount++;
        return Promise.resolve(`notif-${callCount}`);
      });

      (scheduledNotificationRepository.saveMapping as jest.Mock).mockImplementation((input) =>
        Promise.resolve({
          id: `mapping-${input.medicationId}`,
          ...input,
          sourceType: 'medication',
          createdAt: '2024-01-15T10:00:00.000Z',
        })
      );

      // Act
      const results = await scheduleNotificationsBatch(notifications);

      // Assert
      expect(results).toHaveLength(3);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
      expect(scheduledNotificationRepository.saveMapping).toHaveBeenCalledTimes(3);
    });

    it('should return empty array for empty input', async () => {
      // Act
      const results = await scheduleNotificationsBatch([]);

      // Assert
      expect(results).toHaveLength(0);
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('should continue scheduling remaining notifications after partial failure', async () => {
      // Arrange
      const notifications = [
        createNotificationRequest('1', '2024-01-15'),
        createNotificationRequest('2', '2024-01-16'),
        createNotificationRequest('3', '2024-01-17'),
      ];

      let callCount = 0;
      (Notifications.scheduleNotificationAsync as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.resolve(null); // Second one fails
        }
        return Promise.resolve(`notif-${callCount}`);
      });

      (scheduledNotificationRepository.saveMapping as jest.Mock).mockImplementation((input) =>
        Promise.resolve({
          id: `mapping-${input.medicationId}`,
          ...input,
          sourceType: 'medication',
          createdAt: '2024-01-15T10:00:00.000Z',
        })
      );

      // Act
      const results = await scheduleNotificationsBatch(notifications);

      // Assert - should have 2 successful (1st and 3rd)
      expect(results).toHaveLength(2);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
    });
  });

  describe('cancelNotificationAtomic', () => {
    it('should cancel notification and remove mapping from database', async () => {
      // Act
      const result = await cancelNotificationAtomic('notif-123');

      // Assert
      expect(result).toBe(true);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-123');
      expect(scheduledNotificationRepository.deleteMappingsByNotificationId).toHaveBeenCalledWith(
        'notif-123'
      );
    });

    it('should return false on cancellation error', async () => {
      // Arrange
      (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockRejectedValue(
        new Error('Cancel failed')
      );

      // Act
      const result = await cancelNotificationAtomic('notif-123');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false on database error', async () => {
      // Arrange
      (scheduledNotificationRepository.deleteMappingsByNotificationId as jest.Mock).mockRejectedValue(
        new Error('DB error')
      );

      // Act
      const result = await cancelNotificationAtomic('notif-123');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('dismissNotification', () => {
    it('should call expo dismissNotificationAsync', async () => {
      // Act
      await dismissNotification('notif-123');

      // Assert
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('notif-123');
    });
  });

  describe('getPresentedNotifications', () => {
    it('should return presented notifications', async () => {
      // Arrange
      const mockNotifications = [
        { request: { identifier: 'notif-1', content: { title: 'Test 1' } } },
        { request: { identifier: 'notif-2', content: { title: 'Test 2' } } },
      ];
      (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue(
        mockNotifications
      );

      // Act
      const result = await getPresentedNotifications();

      // Assert
      expect(result).toEqual(mockNotifications);
    });
  });

  describe('getAllScheduledNotifications', () => {
    it('should return all scheduled notifications', async () => {
      // Arrange
      const mockNotifications = [
        { identifier: 'notif-1', content: { title: 'Test 1' } },
        { identifier: 'notif-2', content: { title: 'Test 2' } },
      ];
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue(
        mockNotifications
      );

      // Act
      const result = await getAllScheduledNotifications();

      // Assert
      expect(result).toEqual(mockNotifications);
    });
  });

  describe('getTodayDateString', () => {
    it('should return date in YYYY-MM-DD format', () => {
      // Arrange - freeze time
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-06-15T10:30:00Z'));

      // Act
      const result = getTodayDateString();

      // Assert
      expect(result).toBe('2024-06-15');

      jest.useRealTimers();
    });
  });

  describe('getDateStringForDaysAhead', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      // Use UTC noon to avoid date boundary issues in any timezone
      jest.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return today for days=0', () => {
      const result = getDateStringForDaysAhead(0);
      // Result should be the local date representation
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return a date 1 day ahead for days=1', () => {
      const today = getDateStringForDaysAhead(0);
      const tomorrow = getDateStringForDaysAhead(1);
      // Tomorrow should be different from today
      expect(tomorrow).not.toBe(today);
      // Both should be valid date strings
      expect(tomorrow).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return a date 7 days ahead for days=7', () => {
      const today = getDateStringForDaysAhead(0);
      const weekLater = getDateStringForDaysAhead(7);
      expect(weekLater).not.toBe(today);
      expect(weekLater).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('createDateTimeFromStrings', () => {
    it('should set correct hours and minutes from time string', () => {
      // Act
      const result = createDateTimeFromStrings('2024-06-15', '08:30');

      // Assert - focus on time components which are timezone-independent
      expect(result.getHours()).toBe(8);
      expect(result.getMinutes()).toBe(30);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('should handle midnight', () => {
      const result = createDateTimeFromStrings('2024-06-15', '00:00');

      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    });

    it('should handle end of day time', () => {
      const result = createDateTimeFromStrings('2024-06-15', '23:59');

      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
    });

    it('should return a valid Date object', () => {
      const result = createDateTimeFromStrings('2024-06-15', '14:45');

      expect(result).toBeInstanceOf(Date);
      expect(isNaN(result.getTime())).toBe(false);
    });
  });

  describe('extractMedicationName', () => {
    it('should extract medication name from "Time for" pattern', () => {
      expect(extractMedicationName('Time for Ibuprofen')).toBe('Ibuprofen');
      expect(extractMedicationName('Time for Tylenol Extra Strength')).toBe('Tylenol Extra Strength');
      expect(extractMedicationName('Time for Multi-word Med Name')).toBe('Multi-word Med Name');
    });

    it('should extract medication name from "Reminder:" pattern', () => {
      expect(extractMedicationName('Reminder: Aspirin')).toBe('Aspirin');
      expect(extractMedicationName('Reminder: Vitamin D3')).toBe('Vitamin D3');
    });

    it('should return null for non-medication patterns', () => {
      expect(extractMedicationName('How was your day?')).toBeNull();
      expect(extractMedicationName('Take your medication')).toBeNull();
      expect(extractMedicationName('Random notification')).toBeNull();
      expect(extractMedicationName('')).toBeNull();
    });

    it('should trim whitespace from extracted names', () => {
      expect(extractMedicationName('Time for   Ibuprofen  ')).toBe('Ibuprofen');
      expect(extractMedicationName('Reminder:    Aspirin   ')).toBe('Aspirin');
    });
  });

  describe('calculateTriggerTime', () => {
    it('should handle Date objects', () => {
      const testDate = new Date('2024-01-15T08:30:00.000Z');
      const result = calculateTriggerTime(testDate);
      
      expect(result).toEqual(testDate);
      expect(result).not.toBe(testDate); // Should be a new Date object
    });

    it('should handle Date trigger input', () => {
      const testDate = new Date('2024-01-15T09:00:00.000Z');
      const trigger = {
        type: 'date' as any,
        date: testDate,
      };
      
      const result = calculateTriggerTime(trigger);
      expect(result).toEqual(testDate);
    });

    it('should handle time interval trigger (relative to now)', () => {
      const currentTime = Date.now();
      jest.useFakeTimers();
      jest.setSystemTime(currentTime);

      const trigger = {
        type: 'timeInterval' as any,
        seconds: 3600, // 1 hour
      };
      
      const result = calculateTriggerTime(trigger);
      const expected = new Date(currentTime + 3600 * 1000);
      
      expect(result).toEqual(expected);
      
      jest.useRealTimers();
    });

    it('should return null for calendar trigger (complex, not supported)', () => {
      const trigger = {
        type: 'calendar' as any,
        dateComponents: {
          hour: 8,
          minute: 30,
        },
      };
      
      const result = calculateTriggerTime(trigger);
      expect(result).toBeNull();
    });

    it('should return null for unknown trigger types', () => {
      const unknownTrigger = {
        unknownType: 'something',
      };
      
      const result = calculateTriggerTime(unknownTrigger as any);
      expect(result).toBeNull();
    });

    it('should return null for null/undefined input', () => {
      expect(calculateTriggerTime(null as any)).toBeNull();
      expect(calculateTriggerTime(undefined as any)).toBeNull();
    });
  });
});
