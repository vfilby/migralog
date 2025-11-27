import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

const DAILY_CHECKIN_SETTINGS_KEY = '@migralog_daily_checkin_settings';

export interface DailyCheckinSettings {
  // Whether daily check-in notifications are enabled
  enabled: boolean;
  // Time of day to send the check-in notification (24-hour format HH:mm)
  checkInTime: string;
  // Whether the daily check-in notification should be time-sensitive (breaks through focus modes)
  timeSensitive: boolean;
}

export const DEFAULT_DAILY_CHECKIN_SETTINGS: DailyCheckinSettings = {
  enabled: true,
  checkInTime: '21:00', // Default to 9pm
  timeSensitive: false, // Default to regular notifications
};

interface DailyCheckinSettingsState {
  settings: DailyCheckinSettings;
  isLoaded: boolean;

  // Actions
  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<DailyCheckinSettings>) => Promise<void>;
  getCheckInTimeComponents: () => { hours: number; minutes: number };
}

export const useDailyCheckinSettingsStore = create<DailyCheckinSettingsState>((set, get) => ({
  settings: DEFAULT_DAILY_CHECKIN_SETTINGS,
  isLoaded: false,

  loadSettings: async () => {
    try {
      const stored = await AsyncStorage.getItem(DAILY_CHECKIN_SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as DailyCheckinSettings;
        // Ensure all required fields exist (backward compatibility)
        const settings: DailyCheckinSettings = {
          enabled: parsed.enabled ?? DEFAULT_DAILY_CHECKIN_SETTINGS.enabled,
          checkInTime: parsed.checkInTime ?? DEFAULT_DAILY_CHECKIN_SETTINGS.checkInTime,
          timeSensitive: parsed.timeSensitive ?? DEFAULT_DAILY_CHECKIN_SETTINGS.timeSensitive,
        };
        set({ settings, isLoaded: true });
        logger.log('[DailyCheckinSettings] Loaded settings from storage:', settings);
      } else {
        set({ settings: DEFAULT_DAILY_CHECKIN_SETTINGS, isLoaded: true });
        logger.log('[DailyCheckinSettings] Using default settings');
      }
    } catch (error) {
      logger.error('[DailyCheckinSettings] Failed to load settings:', error);
      set({ settings: DEFAULT_DAILY_CHECKIN_SETTINGS, isLoaded: true });
    }
  },

  updateSettings: async (updates) => {
    try {
      const currentSettings = get().settings;
      const newSettings: DailyCheckinSettings = {
        ...currentSettings,
        ...updates,
      };

      await AsyncStorage.setItem(DAILY_CHECKIN_SETTINGS_KEY, JSON.stringify(newSettings));
      set({ settings: newSettings });
      logger.log('[DailyCheckinSettings] Updated settings:', updates);
    } catch (error) {
      logger.error('[DailyCheckinSettings] Failed to update settings:', error);
      throw error;
    }
  },

  getCheckInTimeComponents: () => {
    const { checkInTime } = get().settings;
    const [hours, minutes] = checkInTime.split(':').map(Number);
    return { hours, minutes };
  },
}));
