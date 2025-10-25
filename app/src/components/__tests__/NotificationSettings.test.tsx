import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import NotificationSettings from '../NotificationSettings';
import { useNotificationSettingsStore } from '../../store/notificationSettingsStore';
import { ThemeProvider } from '../../theme/ThemeContext';
import * as Notifications from 'expo-notifications';

jest.mock('../../store/notificationSettingsStore');
jest.mock('expo-notifications');
jest.mock('../../services/errorLogger');

// Mock Alert
const mockAlert = jest.spyOn(Alert, 'alert');

// Mock Linking
jest.spyOn(Linking, 'openSettings').mockResolvedValue(true);

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('NotificationSettings', () => {
  const mockLoadSettings = jest.fn();
  const mockUpdateGlobalSettings = jest.fn();
  const mockUpdateMedicationSettings = jest.fn();
  const mockRemoveMedicationSettings = jest.fn();
  const mockGetEffectiveSettings = jest.fn();

  const defaultSettings = {
    timeSensitiveEnabled: true,
    followUpDelay: 30 as const,
    criticalAlertsEnabled: true,
    medicationOverrides: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useNotificationSettingsStore as unknown as jest.Mock).mockReturnValue({
      settings: defaultSettings,
      isLoaded: true,
      loadSettings: mockLoadSettings,
      updateGlobalSettings: mockUpdateGlobalSettings,
      updateMedicationSettings: mockUpdateMedicationSettings,
      removeMedicationSettings: mockRemoveMedicationSettings,
      getEffectiveSettings: mockGetEffectiveSettings,
    });

    mockGetEffectiveSettings.mockReturnValue({
      ...defaultSettings,
      isOverridden: false,
    });

    mockUpdateGlobalSettings.mockResolvedValue(undefined);
    mockUpdateMedicationSettings.mockResolvedValue(undefined);
    mockRemoveMedicationSettings.mockResolvedValue(undefined);
  });

  describe('Permission Handling', () => {
    it('should show disabled state when permissions not granted', async () => {
      const mockPermissions = { granted: false, canAskAgain: true, status: 'undetermined' as const };

      renderWithTheme(<NotificationSettings notificationPermissions={mockPermissions} />);

      await waitFor(() => {
        expect(screen.getByText(/Notifications are currently disabled/)).toBeTruthy();
        expect(screen.getByText('Open Settings')).toBeTruthy();
      });
    });

    it('should open system settings when "Open Settings" button pressed', async () => {
      const mockPermissions = { granted: false, canAskAgain: true, status: 'undetermined' as const };

      renderWithTheme(<NotificationSettings notificationPermissions={mockPermissions} />);

      await waitFor(() => {
        expect(screen.getByText('Open Settings')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Open Settings'));

      expect(Linking.openSettings).toHaveBeenCalled();
    });

    it('should check permissions internally when not provided as prop', async () => {
      const mockPermissions = { granted: true, canAskAgain: true, status: 'granted' as const };
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue(mockPermissions);

      renderWithTheme(<NotificationSettings />);

      await waitFor(() => {
        expect(Notifications.getPermissionsAsync).toHaveBeenCalled();
      });
    });
  });
});
