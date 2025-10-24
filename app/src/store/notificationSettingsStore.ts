import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

const NOTIFICATION_SETTINGS_KEY = '@migralog_notification_settings';

export type FollowUpDelay = 'off' | 15 | 30 | 45 | 60;

export interface NotificationSettings {
  // Global settings
  timeSensitiveEnabled: boolean;
  followUpDelay: FollowUpDelay;
  criticalAlertsEnabled: boolean;
  confirmationNotificationsEnabled: boolean;

  // Per-medication overrides (medication ID -> settings)
  medicationOverrides: Record<string, MedicationNotificationSettings>;
}

export interface MedicationNotificationSettings {
  timeSensitiveEnabled?: boolean;
  followUpDelay?: FollowUpDelay;
  criticalAlertsEnabled?: boolean;
  confirmationNotificationsEnabled?: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  timeSensitiveEnabled: true,
  followUpDelay: 30,
  criticalAlertsEnabled: true,
  confirmationNotificationsEnabled: false,
  medicationOverrides: {},
};

interface NotificationSettingsState {
  settings: NotificationSettings;
  isLoaded: boolean;

  // Actions
  loadSettings: () => Promise<void>;
  updateGlobalSettings: (updates: Partial<Omit<NotificationSettings, 'medicationOverrides'>>) => Promise<void>;
  updateMedicationSettings: (medicationId: string, settings: MedicationNotificationSettings) => Promise<void>;
  removeMedicationSettings: (medicationId: string) => Promise<void>;
  getEffectiveSettings: (medicationId?: string) => NotificationSettings & { isOverridden: boolean };
}

export const useNotificationSettingsStore = create<NotificationSettingsState>((set, get) => ({
  settings: DEFAULT_NOTIFICATION_SETTINGS,
  isLoaded: false,

  loadSettings: async () => {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as NotificationSettings;
        set({ settings: parsed, isLoaded: true });
        logger.log('[NotificationSettings] Loaded settings from storage');
      } else {
        set({ settings: DEFAULT_NOTIFICATION_SETTINGS, isLoaded: true });
        logger.log('[NotificationSettings] Using default settings');
      }
    } catch (error) {
      logger.error('[NotificationSettings] Failed to load settings:', error);
      set({ settings: DEFAULT_NOTIFICATION_SETTINGS, isLoaded: true });
    }
  },

  updateGlobalSettings: async (updates) => {
    try {
      const currentSettings = get().settings;
      const newSettings: NotificationSettings = {
        ...currentSettings,
        ...updates,
      };

      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(newSettings));
      set({ settings: newSettings });
      logger.log('[NotificationSettings] Updated global settings:', updates);
    } catch (error) {
      logger.error('[NotificationSettings] Failed to update global settings:', error);
      throw error;
    }
  },

  updateMedicationSettings: async (medicationId, medicationSettings) => {
    try {
      const currentSettings = get().settings;
      const newSettings: NotificationSettings = {
        ...currentSettings,
        medicationOverrides: {
          ...currentSettings.medicationOverrides,
          [medicationId]: medicationSettings,
        },
      };

      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(newSettings));
      set({ settings: newSettings });
      logger.log('[NotificationSettings] Updated medication settings:', { medicationId, medicationSettings });
    } catch (error) {
      logger.error('[NotificationSettings] Failed to update medication settings:', error);
      throw error;
    }
  },

  removeMedicationSettings: async (medicationId) => {
    try {
      const currentSettings = get().settings;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [medicationId]: _removed, ...remainingOverrides } = currentSettings.medicationOverrides;

      const newSettings: NotificationSettings = {
        ...currentSettings,
        medicationOverrides: remainingOverrides,
      };

      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(newSettings));
      set({ settings: newSettings });
      logger.log('[NotificationSettings] Removed medication settings for:', medicationId);
    } catch (error) {
      logger.error('[NotificationSettings] Failed to remove medication settings:', error);
      throw error;
    }
  },

  getEffectiveSettings: (medicationId) => {
    const { settings } = get();

    if (!medicationId) {
      return { ...settings, isOverridden: false };
    }

    const override = settings.medicationOverrides[medicationId];
    if (!override) {
      return { ...settings, isOverridden: false };
    }

    // Merge global settings with medication-specific overrides
    return {
      ...settings,
      timeSensitiveEnabled: override.timeSensitiveEnabled ?? settings.timeSensitiveEnabled,
      followUpDelay: override.followUpDelay ?? settings.followUpDelay,
      criticalAlertsEnabled: override.criticalAlertsEnabled ?? settings.criticalAlertsEnabled,
      confirmationNotificationsEnabled: override.confirmationNotificationsEnabled ?? settings.confirmationNotificationsEnabled,
      isOverridden: true,
    };
  },
}));
