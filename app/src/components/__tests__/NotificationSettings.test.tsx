import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { Linking, Alert } from 'react-native';
import NotificationSettings from '../NotificationSettings';
import { useNotificationSettingsStore } from '../../store/notificationSettingsStore';
import { ThemeProvider } from '../../theme/ThemeContext';
import * as Notifications from 'expo-notifications';

jest.mock('../../store/notificationSettingsStore');
jest.mock('expo-notifications');
jest.mock('../../services/errorLogger');

// Mock Linking
jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

// Mock Alert
jest.spyOn(Alert, 'alert');

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
      const mockPermissions = {
        granted: false,
        canAskAgain: true,
      } as Notifications.NotificationPermissionsStatus;

      renderWithTheme(<NotificationSettings notificationPermissions={mockPermissions} />);

      await waitFor(() => {
        expect(screen.getByText(/Notifications are currently disabled/)).toBeTruthy();
        expect(screen.getByText('Open Settings')).toBeTruthy();
      });
    });

    it('should open system settings when "Open Settings" button pressed', async () => {
      const mockPermissions = {
        granted: false,
        canAskAgain: true,
      } as Notifications.NotificationPermissionsStatus;

      renderWithTheme(<NotificationSettings notificationPermissions={mockPermissions} />);

      await waitFor(() => {
        expect(screen.getByText('Open Settings')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Open Settings'));

      expect(Linking.openURL).toHaveBeenCalledWith('app-settings:');
    });

    it('should check permissions internally when not provided as prop', async () => {
      const mockPermissions = {
        granted: true,
        canAskAgain: true,
      } as Notifications.NotificationPermissionsStatus;
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue(mockPermissions);

      renderWithTheme(<NotificationSettings />);

      await waitFor(() => {
        expect(Notifications.getPermissionsAsync).toHaveBeenCalled();
      });
    });
  });

  describe('Global Settings', () => {
    const mockPermissions = {
      granted: true,
      canAskAgain: true,
    } as Notifications.NotificationPermissionsStatus;

    it('should update global settings when toggle is pressed', async () => {
      renderWithTheme(<NotificationSettings notificationPermissions={mockPermissions} />);

      // Find and press a toggle switch
      const switches = await screen.findAllByRole('switch');
      fireEvent(switches[0], 'valueChange', false);

      await waitFor(() => {
        expect(mockUpdateGlobalSettings).toHaveBeenCalled();
      });
    });

    it('should show error alert when global settings update fails', async () => {
      mockUpdateGlobalSettings.mockRejectedValueOnce(new Error('Update failed'));

      renderWithTheme(<NotificationSettings notificationPermissions={mockPermissions} />);

      const switches = await screen.findAllByRole('switch');
      fireEvent(switches[0], 'valueChange', false);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to update notification settings');
      });
    });
  });

  describe('Medication-Specific Settings', () => {
    const mockPermissions = {
      granted: true,
      canAskAgain: true,
    } as Notifications.NotificationPermissionsStatus;

    it('should update medication-specific settings when toggle is pressed', async () => {
      renderWithTheme(
        <NotificationSettings 
          notificationPermissions={mockPermissions} 
          medicationId="med-123" 
        />
      );

      const switches = await screen.findAllByRole('switch');
      fireEvent(switches[0], 'valueChange', false);

      await waitFor(() => {
        expect(mockUpdateMedicationSettings).toHaveBeenCalledWith('med-123', expect.any(Object));
      });
    });

    it('should show error alert when medication settings update fails', async () => {
      mockUpdateMedicationSettings.mockRejectedValueOnce(new Error('Update failed'));

      renderWithTheme(
        <NotificationSettings 
          notificationPermissions={mockPermissions} 
          medicationId="med-123" 
        />
      );

      const switches = await screen.findAllByRole('switch');
      fireEvent(switches[0], 'valueChange', false);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to update notification settings');
      });
    });

    it('should reset medication settings to defaults when reset is confirmed', async () => {
      const mockGetEffectiveSettingsWithOverride = jest.fn().mockReturnValue({
        ...defaultSettings,
        isOverridden: true,
      });

      (useNotificationSettingsStore as unknown as jest.Mock).mockReturnValue({
        settings: defaultSettings,
        isLoaded: true,
        loadSettings: mockLoadSettings,
        updateGlobalSettings: mockUpdateGlobalSettings,
        updateMedicationSettings: mockUpdateMedicationSettings,
        removeMedicationSettings: mockRemoveMedicationSettings,
        getEffectiveSettings: mockGetEffectiveSettingsWithOverride,
      });

      renderWithTheme(
        <NotificationSettings 
          notificationPermissions={mockPermissions} 
          medicationId="med-123" 
        />
      );

      // Find and press the reset button
      const resetButton = await screen.findByText('Reset to Defaults');
      fireEvent.press(resetButton);

      // Confirm the alert
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Simulate pressing the "Reset" button in the alert
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const resetAction = alertCall[2].find((button: any) => button.text === 'Reset');
      await resetAction.onPress();

      await waitFor(() => {
        expect(mockRemoveMedicationSettings).toHaveBeenCalledWith('med-123');
      });
    });

    it('should show error alert when reset fails', async () => {
      mockRemoveMedicationSettings.mockRejectedValueOnce(new Error('Reset failed'));

      const mockGetEffectiveSettingsWithOverride = jest.fn().mockReturnValue({
        ...defaultSettings,
        isOverridden: true,
      });

      (useNotificationSettingsStore as unknown as jest.Mock).mockReturnValue({
        settings: defaultSettings,
        isLoaded: true,
        loadSettings: mockLoadSettings,
        updateGlobalSettings: mockUpdateGlobalSettings,
        updateMedicationSettings: mockUpdateMedicationSettings,
        removeMedicationSettings: mockRemoveMedicationSettings,
        getEffectiveSettings: mockGetEffectiveSettingsWithOverride,
      });

      renderWithTheme(
        <NotificationSettings 
          notificationPermissions={mockPermissions} 
          medicationId="med-123" 
        />
      );

      const resetButton = await screen.findByText('Reset to Defaults');
      fireEvent.press(resetButton);

      // Simulate pressing the "Reset" button in the alert
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const resetAction = alertCall[2].find((button: any) => button.text === 'Reset');
      await resetAction.onPress();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to reset settings');
      });
    });
  });

  describe('Follow-up Delay', () => {
    const mockPermissions = {
      granted: true,
      canAskAgain: true,
    } as Notifications.NotificationPermissionsStatus;

    it('should update global follow-up delay when changed', async () => {
      renderWithTheme(<NotificationSettings notificationPermissions={mockPermissions} />);

      // Find and press the follow-up delay picker
      const delayButton = await screen.findByText(/30 minutes/);
      fireEvent.press(delayButton);

      // Confirm an alert was shown
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Simulate selecting a delay option
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const delayOption = alertCall[2][0]; // First delay option
      await delayOption.onPress();

      await waitFor(() => {
        expect(mockUpdateGlobalSettings).toHaveBeenCalled();
      });
    });

    it('should update medication-specific follow-up delay when changed', async () => {
      renderWithTheme(
        <NotificationSettings 
          notificationPermissions={mockPermissions} 
          medicationId="med-123" 
        />
      );

      const delayButton = await screen.findByText(/30 minutes/);
      fireEvent.press(delayButton);

      // Simulate selecting a delay option
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const delayOption = alertCall[2][0];
      await delayOption.onPress();

      await waitFor(() => {
        expect(mockUpdateMedicationSettings).toHaveBeenCalledWith('med-123', expect.any(Object));
      });
    });

    it('should show error alert when follow-up delay update fails', async () => {
      mockUpdateGlobalSettings.mockRejectedValueOnce(new Error('Update failed'));

      renderWithTheme(<NotificationSettings notificationPermissions={mockPermissions} />);

      const delayButton = await screen.findByText(/30 minutes/);
      fireEvent.press(delayButton);

      // Simulate selecting a delay option
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const delayOption = alertCall[2][0];
      await delayOption.onPress();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to update follow-up delay');
      });
    });
  });
});
