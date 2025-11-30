import { screen, waitFor, fireEvent, act } from '@testing-library/react-native';
import { Alert, Linking, Platform, AppState } from 'react-native';
import NotificationSettingsScreen from '../NotificationSettingsScreen';
import { renderWithProviders } from '../../../utils/screenTestHelpers';
import { notificationService } from '../../../services/notifications/notificationService';
import { dailyCheckinService } from '../../../services/notifications/dailyCheckinService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

// Mock dependencies
jest.mock('../../../services/notifications/notificationService');
jest.mock('../../../services/notifications/dailyCheckinService');
jest.mock('../../../store/dailyCheckinSettingsStore');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('expo-notifications');
jest.mock('../../../components/shared/NotificationSettings', () => {
  const MockNotificationSettings = ({ showTitle }: { showTitle?: boolean }) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="notification-settings-component">
        {showTitle !== false && <Text>Notification Settings Component</Text>}
      </View>
    );
  };
  return MockNotificationSettings;
});
jest.mock('@react-native-community/datetimepicker', () => {
  const MockDateTimePicker = (props: any) => {
    const { View, TouchableOpacity, Text } = require('react-native');
    return (
      <View testID={props.testID || 'date-time-picker'}>
        <TouchableOpacity
          onPress={() => {
            if (props.onChange) {
              const testDate = new Date();
              testDate.setHours(10, 30); // 10:30 AM for testing
              props.onChange({ type: 'set' }, testDate);
            }
          }}
          testID="time-picker-button"
        >
          <Text>Time Picker Mock</Text>
        </TouchableOpacity>
      </View>
    );
  };
  return { __esModule: true, default: MockDateTimePicker };
});

// Create mocks
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

const mockRoute = {
  key: 'NotificationSettingsScreen',
  name: 'NotificationSettingsScreen' as const,
};

// Mock store actions
const mockLoadSettings = jest.fn();
const mockUpdateSettings = jest.fn();

// Mock service responses
const mockNotificationPermissions = {
  granted: true,
  canAskAgain: true,
  ios: {
    allowsCriticalAlerts: false,
  },
};

// Spy on Alert and Linking
jest.spyOn(Alert, 'alert');
jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);

describe('NotificationSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
    
    // Setup default mocks
    const { useDailyCheckinSettingsStore } = require('../../../store/dailyCheckinSettingsStore');
    useDailyCheckinSettingsStore.mockImplementation((selector: any) => {
      const state = {
        settings: {
          enabled: true,
          checkInTime: '21:00',
          timeSensitive: false,
        },
        isLoaded: true,
        loadSettings: mockLoadSettings,
        updateSettings: mockUpdateSettings,
      };
      return selector ? selector(state) : state;
    });

    (notificationService.getPermissions as jest.Mock).mockResolvedValue(mockNotificationPermissions);
    (notificationService.areNotificationsGloballyEnabled as jest.Mock).mockResolvedValue(true);
    (notificationService.setGlobalNotificationsEnabled as jest.Mock).mockResolvedValue(undefined);
    (notificationService.requestPermissions as jest.Mock).mockResolvedValue(mockNotificationPermissions);
    (notificationService.getAllScheduledNotifications as jest.Mock).mockResolvedValue([]);
    
    (dailyCheckinService.scheduleNotification as jest.Mock).mockResolvedValue(undefined);
    (dailyCheckinService.cancelNotification as jest.Mock).mockResolvedValue(undefined);
    (dailyCheckinService.rescheduleNotification as jest.Mock).mockResolvedValue(undefined);
    
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('test-notification-id');
    
    mockLoadSettings.mockResolvedValue(undefined);
    mockUpdateSettings.mockResolvedValue(undefined);
  });

  describe('Component Rendering', () => {
    it('should render the notification settings screen', async () => {
      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('notification-settings-screen')).toBeTruthy();
        expect(screen.getByText('Notification Settings')).toBeTruthy();
        expect(screen.getByText('Back')).toBeTruthy();
        expect(screen.getByText('Medication Reminders')).toBeTruthy();
      });
    });

    it('should display notification permissions status when granted', async () => {
      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeTruthy();
        expect(screen.getByText('Enabled')).toBeTruthy();
      });
    });

    it('should display notification permissions status when denied', async () => {
      (notificationService.getPermissions as jest.Mock).mockResolvedValue({
        granted: false,
        canAskAgain: true,
      });

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeTruthy();
        expect(screen.getByText('Disabled')).toBeTruthy();
      });
    });

    it('should display critical alerts status on iOS when permissions granted', async () => {
      (notificationService.getPermissions as jest.Mock).mockResolvedValue({
        ...mockNotificationPermissions,
        ios: {
          allowsCriticalAlerts: true,
        },
      });

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Critical Alerts')).toBeTruthy();
        expect(screen.getAllByText('Enabled')).toHaveLength(2); // Status and Critical Alerts
      });
    });

    it('should not display critical alerts status on Android', async () => {
      Platform.OS = 'android';

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeTruthy();
        expect(screen.queryByText('Critical Alerts')).toBeNull();
      });
    });

    it('should show daily check-in settings when permissions are granted and enabled', async () => {
      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Enable Daily Check-in')).toBeTruthy();
        expect(screen.getByText('Check-in Time')).toBeTruthy();
        expect(screen.getByText('9:00 PM')).toBeTruthy(); // Formatted time
        expect(screen.getByText('Time-Sensitive')).toBeTruthy();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate back when back button is pressed', async () => {
      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Back')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Back'));
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });

    it('should have accessible back button', async () => {
      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const backButton = await screen.findByLabelText('Back');
      expect(backButton).toBeTruthy();
      expect(backButton.props.accessibilityRole).toBe('button');
    });
  });

  describe('Notification Permission Requests', () => {
    it('should show enable notifications button when permissions not granted', async () => {
      (notificationService.getPermissions as jest.Mock).mockResolvedValue({
        granted: false,
        canAskAgain: true,
      });

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Enable Notifications')).toBeTruthy();
      });
    });

    it('should request permissions when enable button is pressed', async () => {
      (notificationService.getPermissions as jest.Mock).mockResolvedValue({
        granted: false,
        canAskAgain: true,
      });

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const enableButton = await screen.findByText('Enable Notifications');
      fireEvent.press(enableButton);

      await waitFor(() => {
        expect(notificationService.requestPermissions).toHaveBeenCalled();
      });
    });

    it('should show alert when permission denied and cannot ask again', async () => {
      (notificationService.getPermissions as jest.Mock).mockResolvedValue({
        granted: false,
        canAskAgain: true,
      });

      (notificationService.requestPermissions as jest.Mock).mockResolvedValue({
        granted: false,
        canAskAgain: false,
      });

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const enableButton = await screen.findByText('Enable Notifications');
      fireEvent.press(enableButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Notifications Not Enabled',
          expect.stringContaining('Notifications are not enabled in iOS Settings'),
          expect.arrayContaining([
            expect.objectContaining({ text: 'Cancel' }),
            expect.objectContaining({ text: 'Open Settings' }),
          ])
        );
      });
    });

    it('should open app settings when Open Settings is pressed in alert', async () => {
      (notificationService.getPermissions as jest.Mock).mockResolvedValue({
        granted: false,
        canAskAgain: true,
      });

      (notificationService.requestPermissions as jest.Mock).mockResolvedValue({
        granted: false,
        canAskAgain: false,
      });

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const enableButton = await screen.findByText('Enable Notifications');
      fireEvent.press(enableButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Simulate pressing "Open Settings" in alert
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const openSettingsAction = alertCall[2].find((button: any) => button.text === 'Open Settings');
      await act(async () => {
        await openSettingsAction.onPress();
      });

      expect(Linking.openURL).toHaveBeenCalledWith('app-settings:');
    });

    it('should handle permission request errors', async () => {
      (notificationService.getPermissions as jest.Mock).mockResolvedValue({
        granted: false,
        canAskAgain: true,
      });

      (notificationService.requestPermissions as jest.Mock).mockRejectedValue(
        new Error('Permission request failed')
      );

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const enableButton = await screen.findByText('Enable Notifications');
      fireEvent.press(enableButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to request notification permissions');
      });
    });
  });

  describe('Medication Reminder Settings', () => {
    it('should show medication reminder toggle when permissions granted', async () => {
      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Enable Medication Reminders')).toBeTruthy();
        expect(screen.getByLabelText('Enable medication reminders')).toBeTruthy();
      });
    });

    it('should toggle medication reminders on/off', async () => {
      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const medicationToggle = await screen.findByLabelText('Enable medication reminders');
      fireEvent(medicationToggle, 'valueChange', false);

      await waitFor(() => {
        expect(notificationService.setGlobalNotificationsEnabled).toHaveBeenCalledWith(false);
      });
    });

    it('should show success alert when medication reminders are toggled', async () => {
      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const medicationToggle = await screen.findByLabelText('Enable medication reminders');
      fireEvent(medicationToggle, 'valueChange', false);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Success',
          'All medication reminders have been disabled. Your schedules are preserved.'
        );
      });
    });

    it('should handle medication toggle errors', async () => {
      (notificationService.setGlobalNotificationsEnabled as jest.Mock).mockRejectedValue(
        new Error('Toggle failed')
      );

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const medicationToggle = await screen.findByLabelText('Enable medication reminders');
      fireEvent(medicationToggle, 'valueChange', false);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to update notification settings');
      });
    });

    it('should show NotificationSettings component when medication reminders enabled', async () => {
      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('notification-settings-component')).toBeTruthy();
      });
    });

    it('should disable medication toggle while toggling', async () => {
      (notificationService.setGlobalNotificationsEnabled as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const medicationToggle = await screen.findByLabelText('Enable medication reminders');
      fireEvent(medicationToggle, 'valueChange', false);

      // Switch should be disabled during the async operation
      expect(medicationToggle.props.disabled).toBe(true);
    });
  });

  describe('Daily Check-in Settings', () => {
    it('should toggle daily check-in on/off', async () => {
      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const dailyCheckinToggle = await screen.findByLabelText('Enable daily check-in');
      fireEvent(dailyCheckinToggle, 'valueChange', false);

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalledWith({ enabled: false });
        expect(dailyCheckinService.cancelNotification).toHaveBeenCalled();
      });
    });

    it('should schedule notification when daily check-in is enabled', async () => {
      const { useDailyCheckinSettingsStore } = require('../../../store/dailyCheckinSettingsStore');
      useDailyCheckinSettingsStore.mockImplementation((selector: any) => {
        const state = {
          settings: {
            enabled: false,
            checkInTime: '21:00',
            timeSensitive: false,
          },
          isLoaded: true,
          loadSettings: mockLoadSettings,
          updateSettings: mockUpdateSettings,
        };
        return selector ? selector(state) : state;
      });

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const dailyCheckinToggle = await screen.findByLabelText('Enable daily check-in');
      fireEvent(dailyCheckinToggle, 'valueChange', true);

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalledWith({ enabled: true });
        expect(dailyCheckinService.scheduleNotification).toHaveBeenCalled();
      });
    });

    it('should show success alert when daily check-in is toggled', async () => {
      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const dailyCheckinToggle = await screen.findByLabelText('Enable daily check-in');
      fireEvent(dailyCheckinToggle, 'valueChange', false);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Success', 'Daily check-in reminders have been disabled');
      });
    });

    it('should handle daily check-in toggle errors', async () => {
      mockUpdateSettings.mockRejectedValue(new Error('Update failed'));

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const dailyCheckinToggle = await screen.findByLabelText('Enable daily check-in');
      fireEvent(dailyCheckinToggle, 'valueChange', false);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to update daily check-in settings');
      });
    });

    it('should toggle time-sensitive setting', async () => {
      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const timeSensitiveToggle = await screen.findByLabelText('Time-sensitive daily check-in');
      fireEvent(timeSensitiveToggle, 'valueChange', true);

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalledWith({ timeSensitive: true });
      });
    });
  });

  describe('Time Picker Interactions', () => {
    it('should show time picker when check-in time is pressed', async () => {
      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const timeButton = await screen.findByText('9:00 PM');
      fireEvent.press(timeButton);

      await waitFor(() => {
        expect(screen.getByTestId('checkin-time-picker')).toBeTruthy();
      });
    });

    it('should update check-in time when time picker value changes', async () => {
      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const timeButton = await screen.findByText('9:00 PM');
      fireEvent.press(timeButton);

      const timePicker = await screen.findByTestId('time-picker-button');
      fireEvent.press(timePicker);

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalledWith({ checkInTime: '10:30' });
        expect(dailyCheckinService.rescheduleNotification).toHaveBeenCalled();
      });
    });

    it('should handle time update errors', async () => {
      mockUpdateSettings.mockRejectedValue(new Error('Time update failed'));

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const timeButton = await screen.findByText('9:00 PM');
      fireEvent.press(timeButton);

      const timePicker = await screen.findByTestId('time-picker-button');
      fireEvent.press(timePicker);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to update check-in time');
      });
    });

    it('should hide time picker on Android after selection', async () => {
      Platform.OS = 'android';

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const timeButton = await screen.findByText('9:00 PM');
      fireEvent.press(timeButton);

      const timePicker = await screen.findByTestId('time-picker-button');
      fireEvent.press(timePicker);

      // On Android, picker should be hidden after selection
      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalled();
      });
    });
  });

  describe('App State Management', () => {
    it('should refresh permissions when app returns to foreground', async () => {
      // Mock AppState.addEventListener to capture the listener
      let appStateListener: (state: string) => void;
      (AppState.addEventListener as jest.Mock) = jest.fn((event, listener) => {
        if (event === 'change') {
          appStateListener = listener;
        }
        return { remove: jest.fn() };
      });

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      // Clear the initial call
      jest.clearAllMocks();

      // Simulate app going to background and back to foreground
      act(() => {
        // Mock AppState.currentState as background first
        Object.defineProperty(AppState, 'currentState', {
          value: 'background',
          writable: true,
        });
      });

      // Trigger the app state change event
      act(() => {
        if (appStateListener) {
          appStateListener('active');
        }
      });

      await waitFor(() => {
        expect(notificationService.getPermissions).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle permission loading errors', async () => {
      (notificationService.getPermissions as jest.Mock).mockRejectedValue(
        new Error('Permission loading failed')
      );

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('notification-settings-screen')).toBeTruthy();
      });

      // Should still render without crashing
      expect(screen.getByText('Notification Settings')).toBeTruthy();
    });

    it('should handle developer mode loading errors', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('notification-settings-screen')).toBeTruthy();
      });

      // Should still render without crashing
      expect(screen.getByText('Notification Settings')).toBeTruthy();
    });

    it('should handle notifications enabled check errors', async () => {
      (notificationService.areNotificationsGloballyEnabled as jest.Mock).mockRejectedValue(
        new Error('Check failed')
      );

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('notification-settings-screen')).toBeTruthy();
      });

      // Should still render without crashing
      expect(screen.getByText('Notification Settings')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible back button', async () => {
      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const backButton = await screen.findByLabelText('Back');
      expect(backButton).toBeTruthy();
      expect(backButton.props.accessibilityRole).toBe('button');
      expect(backButton.props.accessibilityHint).toBe('Returns to settings');
    });

    it('should have accessible enable notifications button', async () => {
      (notificationService.getPermissions as jest.Mock).mockResolvedValue({
        granted: false,
        canAskAgain: true,
      });

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const enableButton = await screen.findByLabelText('Enable notifications');
      expect(enableButton).toBeTruthy();
      expect(enableButton.props.accessibilityRole).toBe('button');
      expect(enableButton.props.accessibilityHint).toBe('Requests permission to send medication reminder notifications');
    });

    it('should have accessible medication toggle switch', async () => {
      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const medicationToggle = await screen.findByLabelText('Enable medication reminders');
      expect(medicationToggle).toBeTruthy();
      expect(medicationToggle.props.accessibilityRole).toBe('switch');
      expect(medicationToggle.props.accessibilityHint).toBe('Toggles all medication reminder notifications on or off');
    });

    it('should have accessible daily check-in toggle switch', async () => {
      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const dailyCheckinToggle = await screen.findByLabelText('Enable daily check-in');
      expect(dailyCheckinToggle).toBeTruthy();
      expect(dailyCheckinToggle.props.accessibilityRole).toBe('switch');
      expect(dailyCheckinToggle.props.accessibilityHint).toBe('Toggles daily check-in reminders on or off');
    });

    it('should have accessible time-sensitive toggle switch', async () => {
      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const timeSensitiveToggle = await screen.findByLabelText('Time-sensitive daily check-in');
      expect(timeSensitiveToggle).toBeTruthy();
      expect(timeSensitiveToggle.props.accessibilityRole).toBe('switch');
      expect(timeSensitiveToggle.props.accessibilityHint).toBe('Toggles whether daily check-in notifications break through focus modes');
    });

    it('should have accessible check-in time button', async () => {
      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const timeButton = await screen.findByLabelText('Check-in time: 9:00 PM');
      expect(timeButton).toBeTruthy();
      expect(timeButton.props.accessibilityRole).toBe('button');
      expect(timeButton.props.accessibilityHint).toBe('Tap to change the daily check-in reminder time');
    });
  });

  describe('Data Loading and Initialization', () => {
    it('should load daily check-in settings on mount if not loaded', async () => {
      const { useDailyCheckinSettingsStore } = require('../../../store/dailyCheckinSettingsStore');
      useDailyCheckinSettingsStore.mockImplementation((selector: any) => {
        const state = {
          settings: {
            enabled: true,
            checkInTime: '21:00',
            timeSensitive: false,
          },
          isLoaded: false,
          loadSettings: mockLoadSettings,
          updateSettings: mockUpdateSettings,
        };
        return selector ? selector(state) : state;
      });

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(mockLoadSettings).toHaveBeenCalled();
      });
    });

    it('should not reload daily check-in settings if already loaded', async () => {
      const { useDailyCheckinSettingsStore } = require('../../../store/dailyCheckinSettingsStore');
      useDailyCheckinSettingsStore.mockImplementation((selector: any) => {
        const state = {
          settings: {
            enabled: true,
            checkInTime: '21:00',
            timeSensitive: false,
          },
          isLoaded: true,
          loadSettings: mockLoadSettings,
          updateSettings: mockUpdateSettings,
        };
        return selector ? selector(state) : state;
      });

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('notification-settings-screen')).toBeTruthy();
      });

      // Should not call loadSettings since isLoaded is true
      expect(mockLoadSettings).not.toHaveBeenCalled();
    });

    it('should load notification status on mount', async () => {
      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(notificationService.getPermissions).toHaveBeenCalled();
        expect(notificationService.areNotificationsGloballyEnabled).toHaveBeenCalled();
      });
    });

    it('should load developer mode setting on mount', async () => {
      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(AsyncStorage.getItem).toHaveBeenCalledWith('@settings_developer_mode');
      });
    });
  });

  describe('Platform Differences', () => {
    it('should handle iOS-specific app settings URL', async () => {
      Platform.OS = 'ios';

      (notificationService.getPermissions as jest.Mock).mockResolvedValue({
        granted: false,
        canAskAgain: true,
      });

      (notificationService.requestPermissions as jest.Mock).mockResolvedValue({
        granted: false,
        canAskAgain: false,
      });

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const enableButton = await screen.findByText('Enable Notifications');
      fireEvent.press(enableButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Simulate pressing "Open Settings" in alert
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const openSettingsAction = alertCall[2].find((button: any) => button.text === 'Open Settings');
      await act(async () => {
        await openSettingsAction.onPress();
      });

      expect(Linking.openURL).toHaveBeenCalledWith('app-settings:');
    });

    it('should handle Android settings URL fallback', async () => {
      Platform.OS = 'android';
      (Linking.openURL as jest.Mock).mockRejectedValue(new Error('App settings not supported'));

      (notificationService.getPermissions as jest.Mock).mockResolvedValue({
        granted: false,
        canAskAgain: true,
      });

      (notificationService.requestPermissions as jest.Mock).mockResolvedValue({
        granted: false,
        canAskAgain: false,
      });

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      const enableButton = await screen.findByText('Enable Notifications');
      fireEvent.press(enableButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Simulate pressing "Open Settings" in alert
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const openSettingsAction = alertCall[2].find((button: any) => button.text === 'Open Settings');
      await act(async () => {
        await openSettingsAction.onPress();
      });

      expect(Linking.openSettings).toHaveBeenCalled();
    });
  });

  describe('Time Formatting', () => {
    it('should format 24-hour time correctly for display', async () => {
      const { useDailyCheckinSettingsStore } = require('../../../store/dailyCheckinSettingsStore');
      useDailyCheckinSettingsStore.mockImplementation((selector: any) => {
        const state = {
          settings: {
            enabled: true,
            checkInTime: '14:30',
            timeSensitive: false,
          },
          isLoaded: true,
          loadSettings: mockLoadSettings,
          updateSettings: mockUpdateSettings,
        };
        return selector ? selector(state) : state;
      });

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('2:30 PM')).toBeTruthy();
      });
    });

    it('should format morning time correctly', async () => {
      const { useDailyCheckinSettingsStore } = require('../../../store/dailyCheckinSettingsStore');
      useDailyCheckinSettingsStore.mockImplementation((selector: any) => {
        const state = {
          settings: {
            enabled: true,
            checkInTime: '09:15',
            timeSensitive: false,
          },
          isLoaded: true,
          loadSettings: mockLoadSettings,
          updateSettings: mockUpdateSettings,
        };
        return selector ? selector(state) : state;
      });

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('9:15 AM')).toBeTruthy();
      });
    });

    it('should format midnight correctly', async () => {
      const { useDailyCheckinSettingsStore } = require('../../../store/dailyCheckinSettingsStore');
      useDailyCheckinSettingsStore.mockImplementation((selector: any) => {
        const state = {
          settings: {
            enabled: true,
            checkInTime: '00:00',
            timeSensitive: false,
          },
          isLoaded: true,
          loadSettings: mockLoadSettings,
          updateSettings: mockUpdateSettings,
        };
        return selector ? selector(state) : state;
      });

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('12:00 AM')).toBeTruthy();
      });
    });

    it('should format noon correctly', async () => {
      const { useDailyCheckinSettingsStore } = require('../../../store/dailyCheckinSettingsStore');
      useDailyCheckinSettingsStore.mockImplementation((selector: any) => {
        const state = {
          settings: {
            enabled: true,
            checkInTime: '12:00',
            timeSensitive: false,
          },
          isLoaded: true,
          loadSettings: mockLoadSettings,
          updateSettings: mockUpdateSettings,
        };
        return selector ? selector(state) : state;
      });

      renderWithProviders(
        <NotificationSettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('12:00 PM')).toBeTruthy();
      });
    });
  });
});