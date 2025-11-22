import { useDailyCheckinSettingsStore, DEFAULT_DAILY_CHECKIN_SETTINGS } from '../dailyCheckinSettingsStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

const DAILY_CHECKIN_SETTINGS_KEY = '@migralog_daily_checkin_settings';

describe('dailyCheckinSettingsStore', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset the store state
    useDailyCheckinSettingsStore.setState({
      settings: DEFAULT_DAILY_CHECKIN_SETTINGS,
      isLoaded: false,
    });
  });

  describe('loadSettings', () => {
    it('should load settings from AsyncStorage successfully', async () => {
      const storedSettings = {
        enabled: false,
        checkInTime: '20:30',
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(storedSettings));

      await useDailyCheckinSettingsStore.getState().loadSettings();

      const state = useDailyCheckinSettingsStore.getState();
      expect(state.settings).toEqual(storedSettings);
      expect(state.isLoaded).toBe(true);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(DAILY_CHECKIN_SETTINGS_KEY);
    });

    it('should use default settings when no stored settings exist', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await useDailyCheckinSettingsStore.getState().loadSettings();

      const state = useDailyCheckinSettingsStore.getState();
      expect(state.settings).toEqual(DEFAULT_DAILY_CHECKIN_SETTINGS);
      expect(state.isLoaded).toBe(true);
    });

    it('should handle errors and use default settings', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await useDailyCheckinSettingsStore.getState().loadSettings();

      const state = useDailyCheckinSettingsStore.getState();
      expect(state.settings).toEqual(DEFAULT_DAILY_CHECKIN_SETTINGS);
      expect(state.isLoaded).toBe(true);
    });

    it('should handle partial stored settings with backward compatibility', async () => {
      // Simulate older stored settings missing some fields
      const partialSettings = {
        enabled: false,
        // checkInTime missing - should use default
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(partialSettings));

      await useDailyCheckinSettingsStore.getState().loadSettings();

      const state = useDailyCheckinSettingsStore.getState();
      expect(state.settings.enabled).toBe(false);
      expect(state.settings.checkInTime).toBe(DEFAULT_DAILY_CHECKIN_SETTINGS.checkInTime);
      expect(state.isLoaded).toBe(true);
    });
  });

  describe('updateSettings', () => {
    it('should update enabled setting successfully', async () => {
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await useDailyCheckinSettingsStore.getState().updateSettings({ enabled: false });

      const state = useDailyCheckinSettingsStore.getState();
      expect(state.settings.enabled).toBe(false);
      expect(state.settings.checkInTime).toBe(DEFAULT_DAILY_CHECKIN_SETTINGS.checkInTime);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        DAILY_CHECKIN_SETTINGS_KEY,
        JSON.stringify(state.settings)
      );
    });

    it('should update checkInTime setting successfully', async () => {
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await useDailyCheckinSettingsStore.getState().updateSettings({ checkInTime: '08:00' });

      const state = useDailyCheckinSettingsStore.getState();
      expect(state.settings.enabled).toBe(DEFAULT_DAILY_CHECKIN_SETTINGS.enabled);
      expect(state.settings.checkInTime).toBe('08:00');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        DAILY_CHECKIN_SETTINGS_KEY,
        JSON.stringify(state.settings)
      );
    });

    it('should update multiple settings at once', async () => {
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await useDailyCheckinSettingsStore.getState().updateSettings({
        enabled: false,
        checkInTime: '22:00',
      });

      const state = useDailyCheckinSettingsStore.getState();
      expect(state.settings.enabled).toBe(false);
      expect(state.settings.checkInTime).toBe('22:00');
    });

    it('should throw error when AsyncStorage fails', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(
        useDailyCheckinSettingsStore.getState().updateSettings({ enabled: false })
      ).rejects.toThrow('Storage error');
    });
  });

  describe('getCheckInTimeComponents', () => {
    it('should return correct hours and minutes for 21:00', () => {
      useDailyCheckinSettingsStore.setState({
        settings: { enabled: true, checkInTime: '21:00' },
        isLoaded: true,
      });

      const { hours, minutes } = useDailyCheckinSettingsStore.getState().getCheckInTimeComponents();

      expect(hours).toBe(21);
      expect(minutes).toBe(0);
    });

    it('should return correct hours and minutes for 08:30', () => {
      useDailyCheckinSettingsStore.setState({
        settings: { enabled: true, checkInTime: '08:30' },
        isLoaded: true,
      });

      const { hours, minutes } = useDailyCheckinSettingsStore.getState().getCheckInTimeComponents();

      expect(hours).toBe(8);
      expect(minutes).toBe(30);
    });

    it('should return correct hours and minutes for 12:45', () => {
      useDailyCheckinSettingsStore.setState({
        settings: { enabled: true, checkInTime: '12:45' },
        isLoaded: true,
      });

      const { hours, minutes } = useDailyCheckinSettingsStore.getState().getCheckInTimeComponents();

      expect(hours).toBe(12);
      expect(minutes).toBe(45);
    });

    it('should return correct hours and minutes for 00:00 (midnight)', () => {
      useDailyCheckinSettingsStore.setState({
        settings: { enabled: true, checkInTime: '00:00' },
        isLoaded: true,
      });

      const { hours, minutes } = useDailyCheckinSettingsStore.getState().getCheckInTimeComponents();

      expect(hours).toBe(0);
      expect(minutes).toBe(0);
    });
  });

  describe('default values', () => {
    it('should have enabled true by default', () => {
      expect(DEFAULT_DAILY_CHECKIN_SETTINGS.enabled).toBe(true);
    });

    it('should have 9pm (21:00) as default check-in time', () => {
      expect(DEFAULT_DAILY_CHECKIN_SETTINGS.checkInTime).toBe('21:00');
    });
  });
});
