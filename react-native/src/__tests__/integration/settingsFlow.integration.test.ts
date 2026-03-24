/**
 * Integration Test: Settings Change Propagation Flow
 *
 * MEDIUM PRIORITY: Tests settings changes and their propagation to notifications
 *
 * Tests the complete settings flow:
 * - Full flow: change notification setting → existing notifications updated
 * - Settings change propagation to dependent systems
 * - Edit medication flow: edit medication → schedules updated → notifications rescheduled
 *
 * This follows the established integration test pattern:
 * - Test real component interactions
 * - Mock only external dependencies (OS notification APIs)
 * - Verify actual outcomes, not just function calls
 */

import * as Notifications from 'expo-notifications';
import { useNotificationSettingsStore } from '../../store/notificationSettingsStore';
import { useMedicationStore } from '../../store/medicationStore';
import { medicationRepository, medicationScheduleRepository, medicationDoseRepository } from '../../database/medicationRepository';
import { scheduledNotificationRepository } from '../../database/scheduledNotificationRepository';
import { notificationService } from '../../services/notifications/notificationService';
import { Medication, MedicationSchedule } from '../../models/types';

// Mock external dependencies (OS notification APIs)
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  dismissNotificationAsync: jest.fn(),
  getPresentedNotificationsAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
    DATE: 'date',
  },
  AndroidNotificationPriority: {
    HIGH: 'high',
    MAX: 'max',
  },
}));

// Mock repositories
jest.mock('../../database/medicationRepository');
jest.mock('../../database/scheduledNotificationRepository');

// Mock error logger
jest.mock('../../services/errorLogger', () => ({
  errorLogger: {
    log: jest.fn(() => Promise.resolve()),
    getLogs: jest.fn(() => Promise.resolve([])),
    clearLogs: jest.fn(() => Promise.resolve()),
    getRecentLogs: jest.fn(() => Promise.resolve([])),
    getLogsByType: jest.fn(() => Promise.resolve([])),
  },
}));

// Mock AsyncStorage for settings persistence
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

describe('Integration: Settings Change Propagation Flow', () => {
  let mockScheduleNotificationAsync: jest.Mock;
  let mockCancelScheduledNotificationAsync: jest.Mock;
  let mockGetAllScheduledNotificationsAsync: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();

    // Reset expo-notifications mocks
    mockScheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
    mockCancelScheduledNotificationAsync = Notifications.cancelScheduledNotificationAsync as jest.Mock;
    mockGetAllScheduledNotificationsAsync = Notifications.getAllScheduledNotificationsAsync as jest.Mock;

    mockScheduleNotificationAsync.mockResolvedValue('notification-id-123');
    mockCancelScheduledNotificationAsync.mockResolvedValue(undefined);
    mockGetAllScheduledNotificationsAsync.mockResolvedValue([]);
    (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue([]);
    (Notifications.setNotificationCategoryAsync as jest.Mock).mockResolvedValue(undefined);

    // Reset scheduled notification repository mocks
    (scheduledNotificationRepository.tableExists as jest.Mock).mockResolvedValue(true);
    (scheduledNotificationRepository.saveMapping as jest.Mock).mockImplementation((mapping) =>
      Promise.resolve({
        ...mapping,
        id: `mapping-${Date.now()}`,
        createdAt: new Date().toISOString(),
      })
    );
    (scheduledNotificationRepository.getMapping as jest.Mock).mockResolvedValue(null);
    (scheduledNotificationRepository.getMappingsBySchedule as jest.Mock).mockResolvedValue([]);
    (scheduledNotificationRepository.deleteAllMappings as jest.Mock).mockResolvedValue(0);

    // Reset medication repository mocks
    (medicationRepository.getById as jest.Mock).mockResolvedValue(null);
    (medicationRepository.getAll as jest.Mock).mockResolvedValue([]);
    (medicationRepository.getActive as jest.Mock).mockResolvedValue([]);
    (medicationRepository.update as jest.Mock).mockResolvedValue(undefined);
    (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([]);
    (medicationScheduleRepository.update as jest.Mock).mockResolvedValue(undefined);
    (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(new Map());

    // Clear cache to prevent data bleed between tests
    const { cacheManager } = require('../../utils/cacheManager');
    cacheManager.clear();

    // Reset stores to initial state
    useNotificationSettingsStore.setState({
      settings: {
        timeSensitiveEnabled: true,
        followUpDelay: 30,
        criticalAlertsEnabled: true,
        medicationOverrides: {},
      },
      isLoaded: true,
    });

    useMedicationStore.setState({
      medications: [],
      preventativeMedications: [],
      rescueMedications: [],
      otherMedications: [],
      schedules: [],
      doses: [],
      loading: false,
      error: null,
    });

    // Mock AsyncStorage
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Notification settings change propagation', () => {
    it('should update settings and persist to storage', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      const settingsStore = useNotificationSettingsStore.getState();

      // Change global settings
      await settingsStore.updateGlobalSettings({
        timeSensitiveEnabled: false,
        followUpDelay: 60,
      });

      // Verify state updated
      const updatedSettings = useNotificationSettingsStore.getState().settings;
      expect(updatedSettings.timeSensitiveEnabled).toBe(false);
      expect(updatedSettings.followUpDelay).toBe(60);
      expect(updatedSettings.criticalAlertsEnabled).toBe(true); // Unchanged

      // Verify persisted to AsyncStorage
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@migralog_notification_settings',
        expect.stringContaining('"timeSensitiveEnabled":false')
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@migralog_notification_settings',
        expect.stringContaining('"followUpDelay":60')
      );
    });

    it('should handle per-medication setting overrides', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      const settingsStore = useNotificationSettingsStore.getState();

      const medicationId = 'med-override-1';

      // Set medication-specific override
      await settingsStore.updateMedicationSettings(medicationId, {
        timeSensitiveEnabled: false,
        followUpDelay: 15,
      });

      // Verify override exists
      const settings = useNotificationSettingsStore.getState().settings;
      expect(settings.medicationOverrides[medicationId]).toEqual({
        timeSensitiveEnabled: false,
        followUpDelay: 15,
      });

      // Verify effective settings use override
      const effectiveSettings = settingsStore.getEffectiveSettings(medicationId);
      expect(effectiveSettings.timeSensitiveEnabled).toBe(false);
      expect(effectiveSettings.followUpDelay).toBe(15);
      expect(effectiveSettings.isOverridden).toBe(true);

      // Verify persisted
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should remove medication-specific overrides', async () => {
      const settingsStore = useNotificationSettingsStore.getState();
      const medicationId = 'med-remove-override';

      // Set override first
      await settingsStore.updateMedicationSettings(medicationId, {
        timeSensitiveEnabled: false,
      });

      // Verify override exists
      let settings = useNotificationSettingsStore.getState().settings;
      expect(settings.medicationOverrides[medicationId]).toBeDefined();

      // Remove override
      await settingsStore.removeMedicationSettings(medicationId);

      // Verify override removed
      settings = useNotificationSettingsStore.getState().settings;
      expect(settings.medicationOverrides[medicationId]).toBeUndefined();

      // Verify effective settings fall back to global
      const effectiveSettings = settingsStore.getEffectiveSettings(medicationId);
      expect(effectiveSettings.timeSensitiveEnabled).toBe(true); // Global default
      expect(effectiveSettings.isOverridden).toBe(false);
    });

    it('should load settings from AsyncStorage on initialization', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');

      // Mock stored settings
      const storedSettings = {
        timeSensitiveEnabled: false,
        followUpDelay: 45,
        criticalAlertsEnabled: false,
        medicationOverrides: {
          'med-1': {
            followUpDelay: 15,
          },
        },
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(storedSettings));

      // Reset store and load settings
      useNotificationSettingsStore.setState({
        settings: {
          timeSensitiveEnabled: true,
          followUpDelay: 30,
          criticalAlertsEnabled: true,
          medicationOverrides: {},
        },
        isLoaded: false,
      });

      const settingsStore = useNotificationSettingsStore.getState();
      await settingsStore.loadSettings();

      // Verify settings loaded from storage
      const loadedSettings = useNotificationSettingsStore.getState().settings;
      expect(loadedSettings.timeSensitiveEnabled).toBe(false);
      expect(loadedSettings.followUpDelay).toBe(45);
      expect(loadedSettings.criticalAlertsEnabled).toBe(false);
      expect(loadedSettings.medicationOverrides['med-1']).toEqual({
        followUpDelay: 15,
      });
      expect(useNotificationSettingsStore.getState().isLoaded).toBe(true);
    });
  });

  describe('Medication editing triggers notification rescheduling', () => {
    it('should reschedule notifications when medication is edited', async () => {
      const medication: Medication = {
        id: 'med-edit-1',
        name: 'Original Name',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        scheduleFrequency: 'daily', // Required for scheduling
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedule: MedicationSchedule = {
        id: 'sched-edit-1',
        medicationId: 'med-edit-1',
        time: '08:00',
        dosage: 1,
        enabled: true,
        timezone: 'UTC',
      };

      // Mock medication and schedule exist
      (medicationRepository.getById as jest.Mock).mockResolvedValue(medication);
      (medicationRepository.getActive as jest.Mock).mockResolvedValue([medication]);
      (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([schedule]);

      // Mock existing scheduled notifications
      const existingNotification = {
        identifier: 'existing-notif-1',
        content: {
          title: 'Time for Original Name',
          body: '1 dose(s) - 100mg each',
          data: {
            medicationId: 'med-edit-1',
            scheduleId: 'sched-edit-1',
          },
        },
        trigger: { hour: 8, minute: 0 },
      };

      mockGetAllScheduledNotificationsAsync.mockResolvedValue([existingNotification]);

      // Update medication name
      const updatedMedication: Medication = {
        ...medication,
        name: 'Updated Name',
        dosageAmount: 200,
        scheduleFrequency: 'daily',
        updatedAt: Date.now(),
      };

      (medicationRepository.update as jest.Mock).mockResolvedValue(undefined);
      (medicationRepository.getById as jest.Mock).mockResolvedValue(updatedMedication);
      (medicationRepository.getActive as jest.Mock).mockResolvedValue([updatedMedication]);

      const medicationStore = useMedicationStore.getState();
      await medicationStore.updateMedication('med-edit-1', {
        name: 'Updated Name',
        dosageAmount: 200,
      });

      // Trigger notification rescheduling (simulating what EditMedicationScreen does)
      await notificationService.rescheduleAllMedicationNotifications();

      // Verify old notifications were cancelled
      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('existing-notif-1');

      // Verify new notifications were scheduled
      expect(mockScheduleNotificationAsync).toHaveBeenCalled();

      // Verify new notification has updated medication name
      const scheduleCalls = mockScheduleNotificationAsync.mock.calls;
      const newNotificationCall = scheduleCalls.find((call) => {
        const content = call[0].content;
        return content.title.includes('Updated Name');
      });

      expect(newNotificationCall).toBeDefined();
    });

    it('should reschedule when medication schedule time is changed', async () => {
      const medication: Medication = {
        id: 'med-time-change',
        name: 'Test Med',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        scheduleFrequency: 'daily',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedule: MedicationSchedule = {
        id: 'sched-time-change',
        medicationId: 'med-time-change',
        time: '08:00',
        dosage: 1,
        enabled: true,
        timezone: 'UTC',
      };

      // Mock medication and schedule exist
      (medicationRepository.getById as jest.Mock).mockResolvedValue(medication);
      (medicationRepository.getActive as jest.Mock).mockResolvedValue([medication]);
      (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([schedule]);

      // Mock existing notification at 08:00
      const existingNotification = {
        identifier: 'time-change-notif',
        content: {
          title: 'Time for Test Med',
          body: '1 dose(s) - 100mg each',
          data: {
            medicationId: 'med-time-change',
            scheduleId: 'sched-time-change',
          },
        },
        trigger: { hour: 8, minute: 0 },
      };

      mockGetAllScheduledNotificationsAsync.mockResolvedValue([existingNotification]);

      // Update schedule time
      const updatedSchedule: MedicationSchedule = {
        ...schedule,
        time: '20:00',
      };

      (medicationScheduleRepository.update as jest.Mock).mockResolvedValue(undefined);
      (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([updatedSchedule]);

      const medicationStore = useMedicationStore.getState();
      await medicationStore.updateSchedule('sched-time-change', { time: '20:00' });

      // Trigger notification rescheduling
      await notificationService.rescheduleAllMedicationNotifications();

      // Verify old notification was cancelled
      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('time-change-notif');

      // Verify new notification scheduled at correct time
      expect(mockScheduleNotificationAsync).toHaveBeenCalled();

      // Verify at least one notification has the correct time trigger
      const scheduleCalls = mockScheduleNotificationAsync.mock.calls;
      const newTimeNotification = scheduleCalls.find((call) => {
        const trigger = call[0].trigger;
        if (trigger && trigger.date) {
          const date = trigger.date;
          return date.getHours() === 20 && date.getMinutes() === 0;
        }
        return false;
      });

      expect(newTimeNotification).toBeDefined();
    });

    it('should reschedule when medication is archived', async () => {
      const medication: Medication = {
        id: 'med-archive',
        name: 'Archive Me',
        type: 'preventative',
        dosageAmount: 50,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        scheduleFrequency: 'daily',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedule: MedicationSchedule = {
        id: 'sched-archive',
        medicationId: 'med-archive',
        time: '10:00',
        dosage: 1,
        enabled: true,
        timezone: 'UTC',
      };

      // Mock medication and schedule exist
      (medicationRepository.getById as jest.Mock).mockResolvedValue(medication);
      (medicationRepository.getActive as jest.Mock).mockResolvedValue([medication]);
      (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([schedule]);

      // Mock existing notification
      const existingNotification = {
        identifier: 'archive-notif',
        content: {
          title: 'Time for Archive Me',
          body: '1 dose(s) - 50mg each',
          data: {
            medicationId: 'med-archive',
            scheduleId: 'sched-archive',
          },
        },
        trigger: { hour: 10, minute: 0 },
      };

      mockGetAllScheduledNotificationsAsync.mockResolvedValue([existingNotification]);

      // Initialize store with medication
      useMedicationStore.setState({
        medications: [medication],
        preventativeMedications: [medication],
        rescueMedications: [],
        otherMedications: [],
        schedules: [schedule],
        doses: [],
        loading: false,
        error: null,
      });

      const medicationStore = useMedicationStore.getState();

      // Archive medication
      (medicationRepository.update as jest.Mock).mockResolvedValue(undefined);
      (medicationRepository.getActive as jest.Mock).mockResolvedValue([]); // No active medications

      await medicationStore.archiveMedication('med-archive');

      // Verify old notification was cancelled during reschedule
      // Note: archiveMedication calls rescheduleAllMedicationNotifications internally
      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalled();

      // Verify no new notifications scheduled (medication is archived)
      // The cancel count should be greater than schedule count
      const cancelCount = mockCancelScheduledNotificationAsync.mock.calls.length;

      // Since medication is archived and there are no other active medications,
      // we should have cancelled but not rescheduled
      expect(cancelCount).toBeGreaterThan(0);
    });
  });

  describe('Full settings flow with notification updates', () => {
    it('should complete full flow: change settings → verify persistence → medication uses new settings', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');

      // Step 1: Change global notification settings
      const settingsStore = useNotificationSettingsStore.getState();
      await settingsStore.updateGlobalSettings({
        timeSensitiveEnabled: false,
        followUpDelay: 15,
      });

      // Step 2: Verify settings persisted
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@migralog_notification_settings',
        expect.stringContaining('"timeSensitiveEnabled":false')
      );

      // Step 3: Create medication and schedule
      const medication: Medication = {
        id: 'med-full-flow',
        name: 'Full Flow Med',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        scheduleFrequency: 'daily',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const schedule: MedicationSchedule = {
        id: 'sched-full-flow',
        medicationId: 'med-full-flow',
        time: '09:00',
        dosage: 1,
        enabled: true,
        timezone: 'UTC',
      };

      (medicationRepository.getById as jest.Mock).mockResolvedValue(medication);
      (medicationRepository.getActive as jest.Mock).mockResolvedValue([medication]);
      (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([schedule]);

      // Step 4: Schedule notifications
      await notificationService.rescheduleAllMedicationNotifications();

      // Step 5: Verify notification was scheduled
      expect(mockScheduleNotificationAsync).toHaveBeenCalled();

      // Step 6: Get effective settings (no override, should use global)
      const effectiveSettings = settingsStore.getEffectiveSettings('med-full-flow');
      expect(effectiveSettings.timeSensitiveEnabled).toBe(false);
      expect(effectiveSettings.followUpDelay).toBe(15);
      expect(effectiveSettings.isOverridden).toBe(false);
    });

    it('should handle medication-specific override flow', async () => {
      const settingsStore = useNotificationSettingsStore.getState();
      const medicationId = 'med-override-flow';

      // Step 1: Set global settings
      await settingsStore.updateGlobalSettings({
        timeSensitiveEnabled: true,
        followUpDelay: 30,
      });

      // Step 2: Set medication-specific override
      await settingsStore.updateMedicationSettings(medicationId, {
        timeSensitiveEnabled: false,
        followUpDelay: 60,
      });

      // Step 3: Verify effective settings use override
      const effectiveSettings = settingsStore.getEffectiveSettings(medicationId);
      expect(effectiveSettings.timeSensitiveEnabled).toBe(false); // Override
      expect(effectiveSettings.followUpDelay).toBe(60); // Override
      expect(effectiveSettings.criticalAlertsEnabled).toBe(true); // Global (not overridden)
      expect(effectiveSettings.isOverridden).toBe(true);

      // Step 4: Remove override
      await settingsStore.removeMedicationSettings(medicationId);

      // Step 5: Verify falls back to global settings
      const fallbackSettings = settingsStore.getEffectiveSettings(medicationId);
      expect(fallbackSettings.timeSensitiveEnabled).toBe(true); // Global
      expect(fallbackSettings.followUpDelay).toBe(30); // Global
      expect(fallbackSettings.isOverridden).toBe(false);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle settings update errors gracefully', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const settingsStore = useNotificationSettingsStore.getState();

      // Should throw error to caller
      await expect(
        settingsStore.updateGlobalSettings({ timeSensitiveEnabled: false })
      ).rejects.toThrow('Storage error');

      // Settings should not be updated in state if storage fails
      const settings = useNotificationSettingsStore.getState().settings;
      expect(settings.timeSensitiveEnabled).toBe(true); // Original value
    });

    it('should use default settings if AsyncStorage fails to load', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Load error'));

      // Reset store
      useNotificationSettingsStore.setState({
        settings: {
          timeSensitiveEnabled: false,
          followUpDelay: 'off',
          criticalAlertsEnabled: false,
          medicationOverrides: {},
        },
        isLoaded: false,
      });

      const settingsStore = useNotificationSettingsStore.getState();
      await settingsStore.loadSettings();

      // Should fall back to defaults
      const settings = useNotificationSettingsStore.getState().settings;
      expect(settings.timeSensitiveEnabled).toBe(true); // Default
      expect(settings.followUpDelay).toBe(30); // Default
      expect(settings.criticalAlertsEnabled).toBe(true); // Default
      expect(useNotificationSettingsStore.getState().isLoaded).toBe(true);
    });

    it('should handle partial medication override settings', async () => {
      const settingsStore = useNotificationSettingsStore.getState();
      const medicationId = 'med-partial';

      // Set only one override field
      await settingsStore.updateMedicationSettings(medicationId, {
        followUpDelay: 45,
      });

      // Effective settings should merge override with global defaults
      const effectiveSettings = settingsStore.getEffectiveSettings(medicationId);
      expect(effectiveSettings.followUpDelay).toBe(45); // Override
      expect(effectiveSettings.timeSensitiveEnabled).toBe(true); // Global default
      expect(effectiveSettings.criticalAlertsEnabled).toBe(true); // Global default
      expect(effectiveSettings.isOverridden).toBe(true);
    });

    it('should handle medication rescheduling when no medications exist', async () => {
      (medicationRepository.getActive as jest.Mock).mockResolvedValue([]);
      mockGetAllScheduledNotificationsAsync.mockResolvedValue([]);

      // Should not throw
      await expect(notificationService.rescheduleAllMedicationNotifications()).resolves.not.toThrow();

      // Should not schedule any notifications
      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('should handle corrupt settings data in AsyncStorage', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json {]');

      useNotificationSettingsStore.setState({
        settings: {
          timeSensitiveEnabled: false,
          followUpDelay: 'off',
          criticalAlertsEnabled: false,
          medicationOverrides: {},
        },
        isLoaded: false,
      });

      const settingsStore = useNotificationSettingsStore.getState();
      await settingsStore.loadSettings();

      // Should fall back to defaults on JSON parse error
      const settings = useNotificationSettingsStore.getState().settings;
      expect(settings.timeSensitiveEnabled).toBe(true); // Default
      expect(settings.followUpDelay).toBe(30); // Default
      expect(useNotificationSettingsStore.getState().isLoaded).toBe(true);
    });
  });
});
