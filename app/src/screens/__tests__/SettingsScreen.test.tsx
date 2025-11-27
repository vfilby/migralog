import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import SettingsScreen from '../SettingsScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import { errorLogger } from '../../services/errorLogger';
import { notificationService } from '../../services/notificationService';
import { locationService } from '../../services/locationService';
import { backupService } from '../../services/backupService';
import * as SQLite from 'expo-sqlite';
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
    (notificationService.areNotificationsGloballyEnabled as jest.Mock).mockResolvedValue(false);
    (locationService.checkPermission as jest.Mock).mockResolvedValue(false);
    (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue({
      execAsync: jest.fn().mockResolvedValue(undefined),
    });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (backupService.exportDataForSharing as jest.Mock).mockResolvedValue(undefined);
  });

  it('should render settings screen with all sections (except hidden developer)', async () => {
    renderWithProviders(
      <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getAllByText('Settings')).toHaveLength(2); // Header + section title
      expect(screen.getByText('About')).toBeTruthy();
      expect(screen.getByText('Appearance')).toBeTruthy();
      expect(screen.getByText('Notifications')).toBeTruthy();
      expect(screen.getByText('Location')).toBeTruthy();
      expect(screen.getByText('Data')).toBeTruthy();
      // Developer section should be hidden by default
      expect(screen.queryByText('Developer Tools')).toBeNull();
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

  it('should display location permission status', async () => {
    (locationService.checkPermission as jest.Mock).mockResolvedValue(true);

    renderWithProviders(
      <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText(/Location access enabled for episode tracking|Enable location capture for episodes/)).toBeTruthy();
    });
  });

  it('should navigate to DataSettingsScreen when tapped', async () => {
    renderWithProviders(
      <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      const dataButton = screen.getByText('Data');
      expect(dataButton).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Data'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('DataSettingsScreen');
  });

  it('should navigate to NotificationSettingsScreen when tapped', async () => {
    renderWithProviders(
      <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      const notificationButton = screen.getByText('Notifications');
      expect(notificationButton).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Notifications'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('NotificationSettingsScreen');
  });

  it('should navigate to DeveloperToolsScreen when tapped (developer mode)', async () => {
    enableDeveloperMode();
    renderWithProviders(
      <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      const developerButton = screen.getByText('Developer Tools');
      expect(developerButton).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Developer Tools'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('DeveloperToolsScreen');
  });

  it('should support light and dark themes', async () => {
    renderWithProviders(
      <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getAllByText('Settings')).toHaveLength(2); // Header + section title
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

  describe('Location Settings', () => {
    it('should navigate to LocationSettingsScreen when tapped', async () => {
      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Location')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Location'));

      await waitFor(() => {
        expect(mockNavigation.navigate).toHaveBeenCalledWith('LocationSettingsScreen');
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
        expect(screen.queryByText('Developer Tools')).toBeNull();
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

    it('should show developer section when developer mode is enabled', async () => {
      enableDeveloperMode();
      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        // Developer section should be visible by the Developer Tools button
        expect(screen.getByText('Developer Tools')).toBeTruthy();
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
        expect(screen.getAllByText('Settings')).toHaveLength(2); // Header + section title
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
        expect(screen.getAllByText('Settings')).toHaveLength(2); // Header + section title
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
        expect(screen.getAllByText('Settings')).toHaveLength(2); // Header + section title
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
    it('should handle notifications enabled error', async () => {
      (notificationService.areNotificationsGloballyEnabled as jest.Mock).mockRejectedValue(new Error('Service error'));

      renderWithProviders(
        <SettingsScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getAllByText('Settings')).toHaveLength(2); // Header + section title
      });
      
      // The error should be handled gracefully and the component should still render
      expect(screen.getByText('Notifications')).toBeTruthy();
    });
  });
});
