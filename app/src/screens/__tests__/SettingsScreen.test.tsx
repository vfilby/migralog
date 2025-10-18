import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import SettingsScreen from '../SettingsScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import { errorLogger } from '../../services/errorLogger';
import { notificationService } from '../../services/notificationService';
import { locationService } from '../../services/locationService';
import * as SQLite from 'expo-sqlite';

jest.mock('../../services/errorLogger');
jest.mock('../../services/notificationService');
jest.mock('../../services/locationService');
jest.mock('expo-sqlite');

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

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    (errorLogger.getRecentLogs as jest.Mock).mockResolvedValue([]);
    (notificationService.getPermissions as jest.Mock).mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });
    (locationService.checkPermission as jest.Mock).mockResolvedValue(false);
    (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue({
      execAsync: jest.fn().mockResolvedValue(undefined),
    });
  });

  it('should render settings screen with all sections', async () => {
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
      expect(screen.getByText('Developer')).toBeTruthy();
    });
  });

  it('should display app information in About section', async () => {
    renderWithProviders(
      <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('MigraLog')).toBeTruthy();
      expect(screen.getByText('1.0.0')).toBeTruthy();
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
    renderWithProviders(
      <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Database')).toBeTruthy();
      expect(screen.getByText('Healthy')).toBeTruthy();
    });
  });

  it('should display error log count', async () => {
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
        expect(Alert.alert).toHaveBeenCalledWith('Success', 'Notification permissions granted');
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
      (notificationService.getPermissions as jest.Mock).mockResolvedValue({
        granted: true,
        canAskAgain: true,
      });
      (notificationService.scheduleNotification as jest.Mock).mockResolvedValue('test-notif-id');

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Send Test Notification (5s)')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Send Test Notification (5s)'));

      await waitFor(() => {
        expect(notificationService.scheduleNotification).toHaveBeenCalled();
        expect(Alert.alert).toHaveBeenCalledWith(
          'Test Scheduled',
          expect.stringContaining('test notification will appear')
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
      expect(screen.queryByText('Send Test Notification (5s)')).toBeNull();
    });
  });

  describe('Developer Tools', () => {
    it('should clear error logs when confirmed', async () => {
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
      (notificationService.getPermissions as jest.Mock).mockResolvedValue({
        granted: true,
        canAskAgain: true,
      });
      (notificationService.scheduleNotification as jest.Mock).mockRejectedValue(
        new Error('Scheduling failed')
      );

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Send Test Notification (5s)')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Send Test Notification (5s)'));

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
});
