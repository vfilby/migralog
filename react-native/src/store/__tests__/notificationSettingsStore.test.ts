import { useNotificationSettingsStore, DEFAULT_NOTIFICATION_SETTINGS, FollowUpDelay } from '../notificationSettingsStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../../services/errorLogger');

const NOTIFICATION_SETTINGS_KEY = '@migralog_notification_settings';

describe('notificationSettingsStore', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset the store state
    useNotificationSettingsStore.setState({
      settings: DEFAULT_NOTIFICATION_SETTINGS,
      isLoaded: false,
    });
  });

  describe('loadSettings', () => {
    it('should load settings from AsyncStorage successfully', async () => {
      const storedSettings = {
        timeSensitiveEnabled: false,
        followUpDelay: 15 as FollowUpDelay,
        criticalAlertsEnabled: false,
        medicationOverrides: {
          'med-1': {
            timeSensitiveEnabled: true,
            followUpDelay: 45 as FollowUpDelay,
          },
        },
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(storedSettings));

      await useNotificationSettingsStore.getState().loadSettings();

      const state = useNotificationSettingsStore.getState();
      expect(state.settings).toEqual(storedSettings);
      expect(state.isLoaded).toBe(true);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(NOTIFICATION_SETTINGS_KEY);
    });

    it('should use default settings when no stored settings exist', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await useNotificationSettingsStore.getState().loadSettings();

      const state = useNotificationSettingsStore.getState();
      expect(state.settings).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
      expect(state.isLoaded).toBe(true);
    });

    it('should handle errors and use default settings', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await useNotificationSettingsStore.getState().loadSettings();

      const state = useNotificationSettingsStore.getState();
      expect(state.settings).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
      expect(state.isLoaded).toBe(true);
    });
  });

  describe('updateGlobalSettings', () => {
    it('should update global settings successfully', async () => {
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const updates = {
        timeSensitiveEnabled: false,
        followUpDelay: 60 as FollowUpDelay,
      };

      await useNotificationSettingsStore.getState().updateGlobalSettings(updates);

      const state = useNotificationSettingsStore.getState();
      expect(state.settings.timeSensitiveEnabled).toBe(false);
      expect(state.settings.followUpDelay).toBe(60);
      expect(state.settings.criticalAlertsEnabled).toBe(DEFAULT_NOTIFICATION_SETTINGS.criticalAlertsEnabled);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        NOTIFICATION_SETTINGS_KEY,
        JSON.stringify(state.settings)
      );
    });

    it('should preserve medication overrides when updating global settings', async () => {
      const medicationOverrides = {
        'med-1': { timeSensitiveEnabled: false },
      };

      useNotificationSettingsStore.setState({
        settings: {
          ...DEFAULT_NOTIFICATION_SETTINGS,
          medicationOverrides,
        },
        isLoaded: true,
      });

      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await useNotificationSettingsStore.getState().updateGlobalSettings({
        followUpDelay: 45 as FollowUpDelay,
      });

      const state = useNotificationSettingsStore.getState();
      expect(state.settings.medicationOverrides).toEqual(medicationOverrides);
      expect(state.settings.followUpDelay).toBe(45);
    });

    it('should throw error when AsyncStorage fails', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(
        useNotificationSettingsStore.getState().updateGlobalSettings({ followUpDelay: 30 as FollowUpDelay })
      ).rejects.toThrow('Storage error');
    });
  });

  describe('updateMedicationSettings', () => {
    it('should create new medication override', async () => {
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const medicationSettings = {
        timeSensitiveEnabled: false,
        followUpDelay: 15 as FollowUpDelay,
        criticalAlertsEnabled: false,
      };

      await useNotificationSettingsStore.getState().updateMedicationSettings('med-1', medicationSettings);

      const state = useNotificationSettingsStore.getState();
      expect(state.settings.medicationOverrides['med-1']).toEqual(medicationSettings);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        NOTIFICATION_SETTINGS_KEY,
        JSON.stringify(state.settings)
      );
    });

    it('should update existing medication override', async () => {
      useNotificationSettingsStore.setState({
        settings: {
          ...DEFAULT_NOTIFICATION_SETTINGS,
          medicationOverrides: {
            'med-1': { timeSensitiveEnabled: false },
          },
        },
        isLoaded: true,
      });

      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await useNotificationSettingsStore.getState().updateMedicationSettings('med-1', {
        followUpDelay: 45 as FollowUpDelay,
      });

      const state = useNotificationSettingsStore.getState();
      expect(state.settings.medicationOverrides['med-1']).toEqual({
        followUpDelay: 45,
      });
    });

    it('should preserve other medication overrides', async () => {
      useNotificationSettingsStore.setState({
        settings: {
          ...DEFAULT_NOTIFICATION_SETTINGS,
          medicationOverrides: {
            'med-1': { timeSensitiveEnabled: false },
            'med-2': { followUpDelay: 60 as FollowUpDelay },
          },
        },
        isLoaded: true,
      });

      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await useNotificationSettingsStore.getState().updateMedicationSettings('med-1', {
        criticalAlertsEnabled: false,
      });

      const state = useNotificationSettingsStore.getState();
      expect(state.settings.medicationOverrides['med-2']).toEqual({ followUpDelay: 60 });
    });

    it('should throw error when AsyncStorage fails', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(
        useNotificationSettingsStore.getState().updateMedicationSettings('med-1', {
          timeSensitiveEnabled: false,
        })
      ).rejects.toThrow('Storage error');
    });
  });

  describe('removeMedicationSettings', () => {
    it('should remove medication override', async () => {
      useNotificationSettingsStore.setState({
        settings: {
          ...DEFAULT_NOTIFICATION_SETTINGS,
          medicationOverrides: {
            'med-1': { timeSensitiveEnabled: false },
            'med-2': { followUpDelay: 60 as FollowUpDelay },
          },
        },
        isLoaded: true,
      });

      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await useNotificationSettingsStore.getState().removeMedicationSettings('med-1');

      const state = useNotificationSettingsStore.getState();
      expect(state.settings.medicationOverrides['med-1']).toBeUndefined();
      expect(state.settings.medicationOverrides['med-2']).toEqual({ followUpDelay: 60 });
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        NOTIFICATION_SETTINGS_KEY,
        JSON.stringify(state.settings)
      );
    });

    it('should handle removing non-existent medication override', async () => {
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await useNotificationSettingsStore.getState().removeMedicationSettings('non-existent');

      const state = useNotificationSettingsStore.getState();
      expect(state.settings.medicationOverrides).toEqual({});
    });

    it('should throw error when AsyncStorage fails', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(
        useNotificationSettingsStore.getState().removeMedicationSettings('med-1')
      ).rejects.toThrow('Storage error');
    });
  });

  describe('getEffectiveSettings', () => {
    it('should return global settings when no medication ID provided', () => {
      useNotificationSettingsStore.setState({
        settings: {
          timeSensitiveEnabled: false,
          followUpDelay: 45 as FollowUpDelay,
          criticalAlertsEnabled: false,
          medicationOverrides: {},
        },
        isLoaded: true,
      });

      const effectiveSettings = useNotificationSettingsStore.getState().getEffectiveSettings();

      expect(effectiveSettings.timeSensitiveEnabled).toBe(false);
      expect(effectiveSettings.followUpDelay).toBe(45);
      expect(effectiveSettings.criticalAlertsEnabled).toBe(false);
      expect(effectiveSettings.isOverridden).toBe(false);
    });

    it('should return global settings when medication has no override', () => {
      useNotificationSettingsStore.setState({
        settings: {
          ...DEFAULT_NOTIFICATION_SETTINGS,
          medicationOverrides: {},
        },
        isLoaded: true,
      });

      const effectiveSettings = useNotificationSettingsStore.getState().getEffectiveSettings('med-1');

      expect(effectiveSettings.timeSensitiveEnabled).toBe(DEFAULT_NOTIFICATION_SETTINGS.timeSensitiveEnabled);
      expect(effectiveSettings.followUpDelay).toBe(DEFAULT_NOTIFICATION_SETTINGS.followUpDelay);
      expect(effectiveSettings.criticalAlertsEnabled).toBe(DEFAULT_NOTIFICATION_SETTINGS.criticalAlertsEnabled);
      expect(effectiveSettings.isOverridden).toBe(false);
    });

    it('should merge medication override with global settings', () => {
      useNotificationSettingsStore.setState({
        settings: {
          timeSensitiveEnabled: true,
          followUpDelay: 30 as FollowUpDelay,
          criticalAlertsEnabled: true,
          medicationOverrides: {
            'med-1': {
              timeSensitiveEnabled: false,
              followUpDelay: 60 as FollowUpDelay,
              // criticalAlertsEnabled not overridden
            },
          },
        },
        isLoaded: true,
      });

      const effectiveSettings = useNotificationSettingsStore.getState().getEffectiveSettings('med-1');

      expect(effectiveSettings.timeSensitiveEnabled).toBe(false); // Overridden
      expect(effectiveSettings.followUpDelay).toBe(60); // Overridden
      expect(effectiveSettings.criticalAlertsEnabled).toBe(true); // From global
      expect(effectiveSettings.isOverridden).toBe(true);
    });

    it('should handle partial medication overrides', () => {
      useNotificationSettingsStore.setState({
        settings: {
          timeSensitiveEnabled: true,
          followUpDelay: 30 as FollowUpDelay,
          criticalAlertsEnabled: true,
          medicationOverrides: {
            'med-1': {
              followUpDelay: 'off' as FollowUpDelay,
            },
          },
        },
        isLoaded: true,
      });

      const effectiveSettings = useNotificationSettingsStore.getState().getEffectiveSettings('med-1');

      expect(effectiveSettings.timeSensitiveEnabled).toBe(true); // From global
      expect(effectiveSettings.followUpDelay).toBe('off'); // Overridden
      expect(effectiveSettings.criticalAlertsEnabled).toBe(true); // From global
      expect(effectiveSettings.isOverridden).toBe(true);
    });
  });
});
