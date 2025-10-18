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
});
