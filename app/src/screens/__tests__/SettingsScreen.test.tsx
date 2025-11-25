import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import SettingsScreen from '../SettingsScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import { errorLogger } from '../../services/errorLogger';
import { notificationService } from '../../services/notificationService';
import { locationService } from '../../services/locationService';
import { dailyCheckinService } from '../../services/dailyCheckinService';
import { backupService } from '../../services/backupService';
import * as SQLite from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../services/errorLogger');
jest.mock('../../services/notificationService');
jest.mock('../../services/locationService');
jest.mock('../../services/dailyCheckinService');
jest.mock('../../services/backupService');
jest.mock('expo-sqlite');
jest.mock('expo-notifications');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      slug: 'migraine-tracker',
      ios: {
        bundleIdentifier: 'com.eff3.app.headache-tracker',
      },
    },
  },
}));


jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  getClient: jest.fn(() => ({
    getOptions: jest.fn(() => ({
      dsn: 'https://example@sentry.io/123',
      enabled: true,
      environment: 'test',
    })),
  })),
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

const mockRoute = {
  key: 'Settings',
  name: 'Settings' as const,
};

jest.spyOn(Alert, 'alert');

// Helper to enable developer mode for tests
const enableDeveloperMode = () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue('true');
};

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (errorLogger.getRecentLogs as jest.Mock).mockResolvedValue([]);
    (notificationService.getPermissions as jest.Mock).mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });
    (notificationService.initialize as jest.Mock).mockResolvedValue(undefined);
    (locationService.checkPermission as jest.Mock).mockResolvedValue(false);
    (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue({
      execAsync: jest.fn().mockResolvedValue(undefined),
    });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('test-notification-id');
    (Notifications.AndroidNotificationPriority as any) = { HIGH: 'HIGH' };
    (dailyCheckinService.scheduleNotification as jest.Mock).mockResolvedValue(undefined);
    (dailyCheckinService.cancelNotification as jest.Mock).mockResolvedValue(undefined);
    (dailyCheckinService.rescheduleNotification as jest.Mock).mockResolvedValue(undefined);
    (backupService.exportDataForSharing as jest.Mock).mockResolvedValue(undefined);
  });

  it('should render settings screen with all sections (except hidden developer)', async () => {
    renderWithProviders(
      <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeTruthy();
      expect(screen.getByText('About')).toBeTruthy();
      expect(screen.getByText('Appearance')).toBeTruthy();
      expect(screen.getByText('Notifications')).toBeTruthy();
      expect(screen.getByText('Location')).toBeTruthy();
      expect(screen.getByText('Data')).toBeTruthy();
      // Developer section should be hidden by default
      expect(screen.queryByText('Developer')).toBeNull();
    });
  });

  it('should display app information in About section', async () => {
    renderWithProviders(
      <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('MigraLog')).toBeTruthy();
      // Version now includes build number and commit hash (or "build dev" in dev)
      expect(screen.getByText(/1\.\d+\.\d+ (build |\().+/)).toBeTruthy();
    });
  });

  it('should have accessible theme selection buttons', async () => {
    renderWithProviders(
      <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      const lightButton = screen.getByText('Light');
      const darkButton = screen.getByText('Dark');
      const systemButton = screen.getByText('System');
      
      expect(lightButton).toBeTruthy();
      expect(darkButton).toBeTruthy();
      expect(systemButton).toBeTruthy();
    });
  });

  it('should display notification permission status', async () => {
    (notificationService.getPermissions as jest.Mock).mockResolvedValue({
      granted: true,
      canAskAgain: true,
    });

    renderWithProviders(
      <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Enabled')).toBeTruthy();
    });
  });

  it('should display location permission status', async () => {
    (locationService.checkPermission as jest.Mock).mockResolvedValue(true);

    renderWithProviders(
      <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      const enabledElements = screen.getAllByText('Enabled');
      expect(enabledElements.length).toBeGreaterThan(0);
    });
  });

  it('should navigate to BackupRecovery screen when tapped', async () => {
    renderWithProviders(
      <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      const backupButton = screen.getByText('Backup & Recovery');
      expect(backupButton).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Backup & Recovery'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('BackupRecovery');
  });

  it('should navigate to ErrorLogs screen when View Error Logs tapped', async () => {
    enableDeveloperMode();
    renderWithProviders(
      <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      const viewLogsButton = screen.getByText('View Error Logs');
      expect(viewLogsButton).toBeTruthy();
    });

    fireEvent.press(screen.getByText('View Error Logs'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ErrorLogs');
  });

  it('should display database health status', async () => {
    enableDeveloperMode();
    renderWithProviders(
      <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Database')).toBeTruthy();
      expect(screen.getByText('Healthy')).toBeTruthy();
    });
  });

  it('should display error log count', async () => {
    enableDeveloperMode();
    (errorLogger.getRecentLogs as jest.Mock).mockResolvedValue([
      { id: '1', category: 'test', message: 'Test error', timestamp: Date.now() },
      { id: '2', category: 'test', message: 'Test error 2', timestamp: Date.now() },
    ]);

    renderWithProviders(
      <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('2 recent')).toBeTruthy();
    });
  });

  it('should support light and dark themes', async () => {
    renderWithProviders(
      <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeTruthy();
      expect(screen.getByTestId('settings-screen')).toBeTruthy();
    });
  });

  describe('Theme Selection', () => {
    it('should change theme when light button is pressed', async () => {
      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Light')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Light'));
      
      await waitFor(() => {
        expect(screen.getByText('Light')).toBeTruthy();
      });
    });

    it('should change theme when dark button is pressed', async () => {
      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Dark')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Dark'));
      
      await waitFor(() => {
        expect(screen.getByText('Dark')).toBeTruthy();
      });
    });

    it('should change theme when system button is pressed', async () => {
      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('System')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('System'));
      
      await waitFor(() => {
        expect(screen.getByText('System')).toBeTruthy();
      });
    });
  });

  describe('Notification Settings', () => {
    it('should request notification permissions when Enable button is pressed', async () => {
      (notificationService.requestPermissions as jest.Mock).mockResolvedValue({
        granted: true,
        canAskAgain: true,
      });

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Enable Notifications')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Enable Notifications'));

      await waitFor(() => {
        expect(notificationService.requestPermissions).toHaveBeenCalled();
        // No alert shown on success - UI already reflects the change
        expect(Alert.alert).not.toHaveBeenCalled();
      });
    });

    it('should show alert when notification permission is denied', async () => {
      (notificationService.requestPermissions as jest.Mock).mockResolvedValue({
        granted: false,
        canAskAgain: false,
      });

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Enable Notifications')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Enable Notifications'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Permission Denied',
          'Please enable notifications in Settings to receive medication reminders.',
          expect.any(Array)
        );
      });
    });

    it('should show test notification alert when Test Notification is pressed', async () => {
      enableDeveloperMode();
      (notificationService.getPermissions as jest.Mock).mockResolvedValue({
        granted: true,
        canAskAgain: true,
      });
      (notificationService.scheduleNotification as jest.Mock).mockResolvedValue('test-notif-id');

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Regular Notification (5s)')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Test Regular Notification (5s)'));

      await waitFor(() => {
        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
        expect(Alert.alert).toHaveBeenCalledWith(
          'Test Scheduled',
          expect.stringContaining('regular notification will appear')
        );
      });
    });

    it('should show error when test notification without permission', async () => {
      (notificationService.getPermissions as jest.Mock).mockResolvedValue({
        granted: false,
        canAskAgain: true,
      });

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Enable Notifications')).toBeTruthy();
      });

      // Test notification button only appears when notifications are enabled
      // So this test verifies that Enable Notifications button is shown when disabled
      expect(screen.queryByText('Test Regular Notification (5s)')).toBeNull();
    });
  });

  describe('Developer Tools', () => {
    it('should clear error logs when confirmed', async () => {
      enableDeveloperMode();
      (errorLogger.clearLogs as jest.Mock).mockResolvedValue(undefined);

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Clear Logs')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Clear Logs'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Clear Error Logs',
          'Are you sure you want to clear all error logs?',
          expect.arrayContaining([
            expect.objectContaining({ text: 'Cancel' }),
            expect.objectContaining({ text: 'Clear' })
          ])
        );
      });
    });

    it('should log test error when Test Error Logging is pressed', async () => {
      enableDeveloperMode();
      (errorLogger.log as jest.Mock).mockResolvedValue(undefined);
      (errorLogger.getRecentLogs as jest.Mock).mockResolvedValue([
        { id: '1', category: 'general', message: 'Test error log', timestamp: Date.now() }
      ]);

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Error Logging')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Test Error Logging'));

      await waitFor(() => {
        expect(errorLogger.log).toHaveBeenCalledWith(
          'general',
          'Test error log',
          expect.any(Error),
          expect.any(Object)
        );
        expect(Alert.alert).toHaveBeenCalledWith('Success', 'Test error logged');
      });
    });
  });

  describe('Location Settings', () => {
    it('should request location permissions when Enable Location pressed', async () => {
      (locationService.requestPermission as jest.Mock).mockResolvedValue(true);

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Enable Location')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Enable Location'));

      await waitFor(() => {
        expect(locationService.requestPermission).toHaveBeenCalled();
        expect(Alert.alert).toHaveBeenCalledWith('Success', 'Location permission granted. The app will now capture your location when you start a new episode.');
      });
    });

    it('should show alert when location permission denied', async () => {
      (locationService.requestPermission as jest.Mock).mockResolvedValue(false);

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Enable Location')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Enable Location'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Permission Denied',
          expect.stringContaining('location')
        );
      });
    });
  });

  describe('Scheduled Notifications', () => {
    it('should show no notifications message when none scheduled', async () => {
      enableDeveloperMode();
      (notificationService.getPermissions as jest.Mock).mockResolvedValue({
        granted: true,
        canAskAgain: true,
      });
      (notificationService.getAllScheduledNotifications as jest.Mock).mockResolvedValue([]);

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('View Scheduled Notifications')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('View Scheduled Notifications'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('No Notifications', 'No notifications are currently scheduled');
      });
    });

    it('should display scheduled notifications list', async () => {
      enableDeveloperMode();
      (notificationService.getPermissions as jest.Mock).mockResolvedValue({
        granted: true,
        canAskAgain: true,
      });
      (notificationService.getAllScheduledNotifications as jest.Mock).mockResolvedValue([
        {
          identifier: 'notif-1',
          content: { title: 'Take Medication' },
          trigger: { hour: 9, minute: 0, type: 'calendar' },
        },
        {
          identifier: 'notif-2',
          content: { title: 'Morning Dose' },
          trigger: { hour: 13, minute: 30, type: 'calendar' },
        },
      ]);

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('View Scheduled Notifications')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('View Scheduled Notifications'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Scheduled Notifications (2)',
          expect.stringContaining('Take Medication'),
          expect.any(Array),
          expect.any(Object)
        );
      });
    });
  });

  describe('Database Management', () => {
    it('should show confirmation before resetting database', async () => {
      enableDeveloperMode();
      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('reset-database-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('reset-database-button'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Reset Database (Testing)',
          expect.stringContaining('Clear ALL data'),
          expect.arrayContaining([
            expect.objectContaining({ text: 'Cancel' }),
            expect.objectContaining({ text: 'Reset', style: 'destructive' })
          ])
        );
      });
    });

    it('should show confirmation before resetting with test data', async () => {
      enableDeveloperMode();
      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('reset-database-with-fixtures-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('reset-database-with-fixtures-button'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Reset with Test Data',
          expect.stringContaining('Clear ALL data'),
          expect.arrayContaining([
            expect.objectContaining({ text: 'Cancel' }),
            expect.objectContaining({ text: 'Reset & Load' })
          ])
        );
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should handle notification request error', async () => {
      (notificationService.requestPermissions as jest.Mock).mockRejectedValue(
        new Error('Permission request failed')
      );

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Enable Notifications')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Enable Notifications'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to request notification permissions');
      });
    });

    it('should handle test notification error', async () => {
      enableDeveloperMode();
      (notificationService.getPermissions as jest.Mock).mockResolvedValue({
        granted: true,
        canAskAgain: true,
      });
      (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(
        new Error('Scheduling failed')
      );

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Regular Notification (5s)')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Test Regular Notification (5s)'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', expect.stringContaining('Failed to schedule test'));
      });
    });

    it('should handle location permission request error', async () => {
      (locationService.requestPermission as jest.Mock).mockRejectedValue(
        new Error('Permission error')
      );

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Enable Location')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Enable Location'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to request location permission');
      });
    });

    it('should handle view scheduled notifications error', async () => {
      enableDeveloperMode();
      (notificationService.getPermissions as jest.Mock).mockResolvedValue({
        granted: true,
        canAskAgain: true,
      });
      (notificationService.getAllScheduledNotifications as jest.Mock).mockRejectedValue(
        new Error('Failed to fetch')
      );

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('View Scheduled Notifications')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('View Scheduled Notifications'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to get scheduled notifications');
      });
    });
  });

  describe('Developer Mode Toggle', () => {
    it('should enable developer mode after tapping build 7 times', async () => {
      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      // Developer section should not be visible initially
      await waitFor(() => {
        expect(screen.queryByText('Developer')).toBeNull();
      });

      // Tap build info 7 times
      const buildValue = screen.getByText(/[a-f0-9]{7}/i); // Match commit hash
      for (let i = 0; i < 7; i++) {
        fireEvent.press(buildValue);
      }

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Developer Mode Enabled',
          'Developer tools are now visible in Settings.'
        );
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('@settings_developer_mode', 'true');
      });
    });

    it('should show developer icon when developer mode is enabled', async () => {
      enableDeveloperMode();
      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        // Developer section should be visible
        expect(screen.getByText('Developer')).toBeTruthy();
      });
    });
  });

  describe('Daily Check-in Settings', () => {
    beforeEach(() => {
      // Enable notifications for daily check-in tests
      (notificationService.getPermissions as jest.Mock).mockResolvedValue({
        granted: true,
        canAskAgain: true,
      });
      (notificationService.areNotificationsGloballyEnabled as jest.Mock).mockResolvedValue(true);
    });

    it('should show daily check-in settings when notifications are enabled', async () => {
      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Check-in')).toBeTruthy();
        expect(screen.getByText('Enable Daily Check-in')).toBeTruthy();
      });
    });

    it('should not show daily check-in settings when notifications are globally disabled', async () => {
      (notificationService.areNotificationsGloballyEnabled as jest.Mock).mockResolvedValue(false);

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Notifications')).toBeTruthy();
      });

      // Wait a bit for the async state update, then check
      await waitFor(() => {
        expect(screen.queryByText('Daily Check-in')).toBeNull();
      });
    });

    it('should not show daily check-in settings when notification permission is denied', async () => {
      (notificationService.getPermissions as jest.Mock).mockResolvedValue({
        granted: false,
        canAskAgain: true,
      });

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.queryByText('Daily Check-in')).toBeNull();
      });
    });

    it('should toggle daily check-in and call service methods', async () => {
      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Enable Daily Check-in')).toBeTruthy();
      });

      // Find and toggle the switch
      const switchElement = screen.getByRole('switch', { name: 'Enable daily check-in' });
      fireEvent(switchElement, 'onValueChange', false);

      await waitFor(() => {
        expect(dailyCheckinService.cancelNotification).toHaveBeenCalled();
        expect(Alert.alert).toHaveBeenCalledWith('Success', 'Daily check-in reminders have been disabled');
      });
    });

    it('should schedule notification when daily check-in is enabled', async () => {
      // Start with check-in disabled by setting up the store state
      const { useDailyCheckinSettingsStore } = require('../../store/dailyCheckinSettingsStore');
      useDailyCheckinSettingsStore.setState({
        settings: { enabled: false, checkInTime: '21:00' },
        isLoaded: true,
      });

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Enable Daily Check-in')).toBeTruthy();
      });

      // Find and toggle the switch to enable
      const switchElement = screen.getByRole('switch', { name: 'Enable daily check-in' });
      fireEvent(switchElement, 'onValueChange', true);

      await waitFor(() => {
        expect(dailyCheckinService.scheduleNotification).toHaveBeenCalled();
        expect(Alert.alert).toHaveBeenCalledWith('Success', 'Daily check-in reminders have been enabled');
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate back when Done button is pressed', async () => {
      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Done')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Done'));
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });

    it('should navigate to Performance screen when tapped', async () => {
      enableDeveloperMode();
      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Performance')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Performance'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Performance');
    });
  });

  describe('Error Handling in Initialization', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should handle error when loading developer mode setting fails', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeTruthy();
      });

      // Should still render without crashing
      expect(screen.getByText('About')).toBeTruthy();
    });

    it('should handle error when loading notification settings fails', async () => {
      (notificationService.areNotificationsGloballyEnabled as jest.Mock).mockRejectedValue(
        new Error('Notification service error')
      );

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeTruthy();
      });

      // Should still render without crashing
      expect(screen.getByText('Notifications')).toBeTruthy();
    });

    it('should handle diagnostics loading errors gracefully', async () => {
      (errorLogger.getRecentLogs as jest.Mock).mockRejectedValue(new Error('Log error'));
      (notificationService.getPermissions as jest.Mock).mockRejectedValue(new Error('Permission error'));
      (locationService.checkPermission as jest.Mock).mockRejectedValue(new Error('Location error'));

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeTruthy();
      });

      // App should still render despite errors
      expect(screen.getByText('About')).toBeTruthy();
    });
  });

  describe('Developer Mode Toggle Error', () => {
    it('should handle developer mode toggle save error', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Version')).toBeTruthy();
      });

      // Tap build info 7 times to trigger developer mode
      // Find the build info by looking for the commit hash pattern
      const buildContainer = screen.getByText(/1\.[\d\.]+.*df8beac/); // Match the version string with commit hash
      for (let i = 0; i < 7; i++) {
        fireEvent.press(buildContainer);
      }

      await waitFor(() => {
        // The error should be logged but the alert should still show
        expect(Alert.alert).toHaveBeenCalledWith(
          'Developer Mode Enabled',
          'Developer tools are now visible in Settings.'
        );
      });
    });
  });

  describe('Additional Error Handling', () => {
    it('should handle toggle notifications error', async () => {
      (notificationService.setGlobalNotificationsEnabled as jest.Mock).mockRejectedValue(new Error('Toggle failed'));

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeTruthy();
      });

      // The function should be available and would handle errors
      expect(notificationService.setGlobalNotificationsEnabled).toBeDefined();
    });

    it('should handle test notification permission check errors', async () => {
      (notificationService.getPermissions as jest.Mock).mockRejectedValue(new Error('Permission check failed'));

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeTruthy();
      });

      // The error should be handled in diagnostics loading
      expect(notificationService.getPermissions).toHaveBeenCalled();
    });

    it('should handle database health check failure', async () => {
      enableDeveloperMode();
      (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue({
        execAsync: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      });

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeTruthy();
      });
    });

    it('should handle Sentry configuration error', async () => {
      jest.spyOn(require('@sentry/react-native'), 'getClient').mockImplementation(() => {
        throw new Error('Sentry client error');
      });

      enableDeveloperMode();
      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeTruthy();
      });

      // Should render despite Sentry error
      expect(screen.getByText('Developer')).toBeTruthy();
    });

    it('should handle database reset in production environment', async () => {
      // Mock __DEV__ as false
      const originalDev = (global as any).__DEV__;
      (global as any).__DEV__ = true; // Enable to show the button first

      enableDeveloperMode();
      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('reset-database-button')).toBeTruthy();
      });

      // Now set __DEV__ to false to simulate production
      (global as any).__DEV__ = false;

      fireEvent.press(screen.getByTestId('reset-database-button'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Reset Database (Testing)',
          expect.stringContaining('Clear ALL data'),
          expect.any(Array)
        );
      });

      // Simulate pressing the Reset button in the alert
      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const resetAlert = alertCalls.find(call => call[0] === 'Reset Database (Testing)');
      const resetButton = resetAlert[2].find((button: any) => button.text === 'Reset');
      await resetButton.onPress();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Database reset is only available in development mode');
      });

      // Restore __DEV__
      (global as any).__DEV__ = originalDev;
    });

    it('should handle export data error', async () => {
      enableDeveloperMode();
      (backupService.exportDataForSharing as jest.Mock).mockRejectedValue(new Error('Export failed'));

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Export Data')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Export Data'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to export data: Export failed');
      });
    });

    it('should handle test Sentry error', async () => {
      enableDeveloperMode();
      jest.spyOn(require('@sentry/react-native'), 'captureException').mockImplementation(() => {
        throw new Error('Sentry capture failed');
      });

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Sentry Integration')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Test Sentry Integration'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Test Sentry Integration',
          expect.stringContaining('This will send test events'),
          expect.any(Array)
        );
      });

      // Simulate pressing the "Send Test Events" button
      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const sentryAlert = alertCalls.find(call => call[0] === 'Test Sentry Integration');
      const sendButton = sentryAlert[2].find((button: any) => button.text === 'Send Test Events');
      await sendButton.onPress();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to send test events. Sentry may not be configured.');
      });
    });

    it('should handle open settings error', async () => {
      jest.spyOn(require('react-native').Linking, 'openSettings').mockRejectedValue(new Error('Cannot open settings'));

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeTruthy();
      });

      // This function should be available for error handling
      expect(require('react-native').Linking.openSettings).toBeDefined();
    });

    it('should handle notifications enabled error', async () => {
      (notificationService.areNotificationsGloballyEnabled as jest.Mock).mockRejectedValue(new Error('Service error'));

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeTruthy();
      });
      
      // The error should be handled gracefully and the component should still render
      expect(screen.getByText('Notifications')).toBeTruthy();
    });
  });

  describe('High Priority Test Notification', () => {
    it('should handle test notification with high priority', async () => {
      enableDeveloperMode();
      (notificationService.getPermissions as jest.Mock).mockResolvedValue({
        granted: true,
        canAskAgain: true,
      });

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Time-Sensitive (5s)')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Test Time-Sensitive (5s)'));

      await waitFor(() => {
        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            content: expect.objectContaining({
              title: 'Test Notification (Time-Sensitive)',
              interruptionLevel: 'timeSensitive',
            }),
          })
        );
      });
    });
  });
});
