import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import WelcomeScreen from '../WelcomeScreen';
import { ThemeProvider } from '../../theme/ThemeContext';
import { useOnboardingStore } from '../../store/onboardingStore';
import { notificationService } from '../../services/notifications/notificationService';
import { locationService } from '../../services/locationService';
import { logger } from '../../utils/logger';

// Mock dependencies
jest.mock('../../store/onboardingStore');
jest.mock('../../services/notifications/notificationService');
jest.mock('../../services/locationService');
jest.mock('../../utils/logger');

// Mock navigation
const mockReplace = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    replace: mockReplace,
  }),
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

// Test wrapper with providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    {children}
  </ThemeProvider>
);

describe('WelcomeScreen', () => {
  const mockCompleteOnboarding = jest.fn();
  const mockRequestPermissions = jest.fn();
  const mockRequestPermission = jest.fn();
  const mockLoggerLog = jest.fn();
  const mockLoggerError = jest.fn();
  const mockLoggerWarn = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();

    (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
      completeOnboarding: mockCompleteOnboarding,
    });

    (notificationService.requestPermissions as jest.Mock).mockImplementation(mockRequestPermissions);
    (locationService.requestPermission as jest.Mock).mockImplementation(mockRequestPermission);
    
    (logger.log as jest.Mock).mockImplementation(mockLoggerLog);
    (logger.error as jest.Mock).mockImplementation(mockLoggerError);
    (logger.warn as jest.Mock).mockImplementation(mockLoggerWarn);

    mockCompleteOnboarding.mockResolvedValue(undefined);
    mockRequestPermissions.mockResolvedValue(true);
    mockRequestPermission.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Component Rendering and Basic Functionality', () => {
    it('renders without crashing', async () => {
      const { getByLabelText } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByLabelText('Onboarding step 1 of 4')).toBeTruthy();
      });
    });

    it('displays progress indicator correctly', async () => {
      const { getByRole } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        const progressbar = getByRole('progressbar');
        expect(progressbar.props.accessibilityLabel).toBe('Step 1 of 4');
      });
    });

    it('displays welcome step initially', async () => {
      const { getByTestId } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });
    });

    it('has accessible progress indicators', async () => {
      const { getByLabelText } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByLabelText('Welcome - current step')).toBeTruthy();
        expect(getByLabelText('Disclaimer - upcoming')).toBeTruthy();
        expect(getByLabelText('Notifications - upcoming')).toBeTruthy();
        expect(getByLabelText('Location - upcoming')).toBeTruthy();
      });
    });
  });

  describe('Navigation and Step Management', () => {
    it('advances to step 2 when next button is pressed', async () => {
      const { getByTestId } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      const nextButton = getByTestId('next-button');
      fireEvent.press(nextButton);

      await waitFor(() => {
        expect(getByTestId('disclaimer-step')).toBeTruthy();
      });
    });

    it('shows back button on step 2', async () => {
      const { getByTestId } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Navigate to step 2
      fireEvent.press(getByTestId('next-button'));

      await waitFor(() => {
        expect(getByTestId('back-button')).toBeTruthy();
      });
    });

    it('goes back to previous step when back button is pressed', async () => {
      const { getByTestId } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Navigate to step 2
      fireEvent.press(getByTestId('next-button'));

      await waitFor(() => {
        expect(getByTestId('disclaimer-step')).toBeTruthy();
      });

      // Go back
      fireEvent.press(getByTestId('back-button'));

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });
    });

    it('does not go back beyond step 1', async () => {
      const { getByTestId, queryByTestId } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Verify we start on step 1 with no back button
      expect(queryByTestId('back-button')).toBeNull();

      // Navigate to step 2
      fireEvent.press(getByTestId('next-button'));

      await waitFor(() => {
        expect(getByTestId('disclaimer-step')).toBeTruthy();
      });

      // Go back to step 1
      fireEvent.press(getByTestId('back-button'));

      // Verify we're on step 1 with no back button
      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
        expect(queryByTestId('back-button')).toBeNull();
      });
    });

    it('updates accessibility labels when navigating', async () => {
      const { getByTestId, getByLabelText } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Navigate to step 2
      fireEvent.press(getByTestId('next-button'));

      await waitFor(() => {
        expect(getByLabelText('Welcome - completed')).toBeTruthy();
        expect(getByLabelText('Disclaimer - current step')).toBeTruthy();
        expect(getByLabelText('Onboarding step 2 of 4')).toBeTruthy();
      });
    });
  });

  describe('Notification Permission Handling', () => {
    it('requests notification permission on step 3 continue', async () => {
      const { getByTestId } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Navigate to step 3
      fireEvent.press(getByTestId('next-button')); // Step 1->2
      
      await waitFor(() => {
        expect(getByTestId('disclaimer-step')).toBeTruthy();
      });
      
      fireEvent.press(getByTestId('next-button')); // Step 2->3

      await waitFor(() => {
        expect(getByTestId('notification-permissions-step')).toBeTruthy();
      });

      // Continue from step 3 should request notification permission
      await act(async () => {
        fireEvent.press(getByTestId('next-button')); // Step 3->4 with permission request
      });

      expect(mockRequestPermissions).toHaveBeenCalled();
      expect(mockLoggerLog).toHaveBeenCalledWith(
        '[WelcomeScreen] Requesting notification permissions on step 3'
      );
    });

    it('handles notification permission error gracefully', async () => {
      const error = new Error('Permission denied');
      mockRequestPermissions.mockRejectedValue(error);

      const { getByTestId } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Navigate to step 3
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('disclaimer-step')).toBeTruthy();
      });
      
      fireEvent.press(getByTestId('next-button'));

      await waitFor(() => {
        expect(getByTestId('notification-permissions-step')).toBeTruthy();
      });

      // Continue from step 3
      await act(async () => {
        fireEvent.press(getByTestId('next-button'));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Permission Error',
          'Unable to request notification permission. You can enable notifications later in Settings.',
          [{ text: 'Continue', onPress: expect.any(Function) }]
        );
      });

      expect(mockLoggerError).toHaveBeenCalledWith(
        '[WelcomeScreen] Error requesting notification permissions:',
        error
      );
    });

    it('continues to step 4 when user acknowledges permission error', async () => {
      mockRequestPermissions.mockRejectedValue(new Error('Permission denied'));

      const { getByTestId } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Navigate to step 3
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('disclaimer-step')).toBeTruthy();
      });
      
      fireEvent.press(getByTestId('next-button'));

      await waitFor(() => {
        expect(getByTestId('notification-permissions-step')).toBeTruthy();
      });

      // Continue from step 3
      await act(async () => {
        fireEvent.press(getByTestId('next-button'));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Simulate user pressing Continue in the alert
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const continueCallback = alertCall[2][0].onPress;
      
      await act(async () => {
        continueCallback();
      });

      await waitFor(() => {
        expect(getByTestId('location-permissions-step')).toBeTruthy();
      });
    });

    it('continues to step 4 regardless of notification permission result', async () => {
      mockRequestPermissions.mockResolvedValue(false);

      const { getByTestId } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Navigate to step 3
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('disclaimer-step')).toBeTruthy();
      });
      
      fireEvent.press(getByTestId('next-button'));

      await waitFor(() => {
        expect(getByTestId('notification-permissions-step')).toBeTruthy();
      });

      // Continue from step 3
      await act(async () => {
        fireEvent.press(getByTestId('next-button'));
      });

      await waitFor(() => {
        expect(getByTestId('location-permissions-step')).toBeTruthy();
      });
    });
  });

  describe('Final Step and Onboarding Completion', () => {
    it('shows finish setup button on final step', async () => {
      const { getByTestId } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Navigate to final step
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('disclaimer-step')).toBeTruthy();
      });
      
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('notification-permissions-step')).toBeTruthy();
      });
      
      await act(async () => {
        fireEvent.press(getByTestId('next-button'));
      });

      await waitFor(() => {
        expect(getByTestId('enable-notifications-button')).toBeTruthy();
      });
    });

    it('completes onboarding and navigates to main tabs', async () => {
      const { getByTestId } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Navigate to final step
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('disclaimer-step')).toBeTruthy();
      });
      
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('notification-permissions-step')).toBeTruthy();
      });
      
      await act(async () => {
        fireEvent.press(getByTestId('next-button'));
      });

      await waitFor(() => {
        expect(getByTestId('enable-notifications-button')).toBeTruthy();
      });

      // Finish onboarding
      await act(async () => {
        fireEvent.press(getByTestId('enable-notifications-button'));
      });

      await waitFor(() => {
        expect(mockRequestPermission).toHaveBeenCalled();
        expect(mockCompleteOnboarding).toHaveBeenCalled();
        expect(mockReplace).toHaveBeenCalledWith('MainTabs');
      });
    });

    it('handles onboarding completion error gracefully', async () => {
      const error = new Error('Completion failed');
      mockCompleteOnboarding.mockRejectedValue(error);

      const { getByTestId } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Navigate to final step
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('disclaimer-step')).toBeTruthy();
      });
      
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('notification-permissions-step')).toBeTruthy();
      });
      
      await act(async () => {
        fireEvent.press(getByTestId('next-button'));
      });

      await waitFor(() => {
        expect(getByTestId('enable-notifications-button')).toBeTruthy();
      });

      // Finish onboarding
      await act(async () => {
        fireEvent.press(getByTestId('enable-notifications-button'));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Setup Complete',
          'Onboarding completed with some issues. You can adjust permissions in Settings.',
          [{ text: 'OK', onPress: expect.any(Function) }]
        );
      });

      expect(mockLoggerError).toHaveBeenCalledWith(
        '[WelcomeScreen] Error completing onboarding:',
        error
      );
    });

    it('still completes onboarding after error alert acknowledgment', async () => {
      mockCompleteOnboarding.mockRejectedValue(new Error('Error'));

      const { getByTestId } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Navigate to final step and trigger error
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('disclaimer-step')).toBeTruthy();
      });
      
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('notification-permissions-step')).toBeTruthy();
      });
      
      await act(async () => {
        fireEvent.press(getByTestId('next-button'));
      });

      await waitFor(() => {
        expect(getByTestId('enable-notifications-button')).toBeTruthy();
      });
      
      await act(async () => {
        fireEvent.press(getByTestId('enable-notifications-button'));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Reset the mock to succeed on retry
      mockCompleteOnboarding.mockResolvedValue(undefined);

      // Simulate user pressing OK in the alert
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const okCallback = alertCall[2][0].onPress;
      
      await act(async () => {
        await okCallback();
      });

      await waitFor(() => {
        expect(mockCompleteOnboarding).toHaveBeenCalledTimes(2);
        expect(mockReplace).toHaveBeenCalledWith('MainTabs');
      });
    });
  });

  describe('Location Permission with Timeout', () => {
    it('handles location permission timeout correctly', async () => {
      // Make location permission never resolve
      mockRequestPermission.mockImplementation(() => new Promise(() => {}));

      const { getByTestId } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Navigate to final step
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('disclaimer-step')).toBeTruthy();
      });
      
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('notification-permissions-step')).toBeTruthy();
      });
      
      await act(async () => {
        fireEvent.press(getByTestId('next-button'));
      });

      await waitFor(() => {
        expect(getByTestId('enable-notifications-button')).toBeTruthy();
      });

      // Finish onboarding
      await act(async () => {
        fireEvent.press(getByTestId('enable-notifications-button'));
      });

      // Fast-forward through timeout
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(mockLoggerWarn).toHaveBeenCalledWith(
          '[WelcomeScreen] Location permission request timed out (likely E2E test)'
        );
        expect(mockCompleteOnboarding).toHaveBeenCalled();
        expect(mockReplace).toHaveBeenCalledWith('MainTabs');
      });
    });

    it('handles location permission error gracefully', async () => {
      const error = new Error('Location error');
      mockRequestPermission.mockRejectedValue(error);

      const { getByTestId } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Navigate to final step and complete
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('disclaimer-step')).toBeTruthy();
      });
      
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('notification-permissions-step')).toBeTruthy();
      });
      
      await act(async () => {
        fireEvent.press(getByTestId('next-button'));
      });

      await waitFor(() => {
        expect(getByTestId('enable-notifications-button')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('enable-notifications-button'));
      });

      await waitFor(() => {
        expect(mockLoggerWarn).toHaveBeenCalledWith(
          '[WelcomeScreen] Location permission request failed:',
          error
        );
        expect(mockCompleteOnboarding).toHaveBeenCalled();
        expect(mockReplace).toHaveBeenCalledWith('MainTabs');
      });
    });

    it('cleans up timeout when location permission completes normally', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      mockRequestPermission.mockResolvedValue(true);

      const { getByTestId } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Navigate to final step and complete
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('disclaimer-step')).toBeTruthy();
      });
      
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('notification-permissions-step')).toBeTruthy();
      });
      
      await act(async () => {
        fireEvent.press(getByTestId('next-button'));
      });

      await waitFor(() => {
        expect(getByTestId('enable-notifications-button')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('enable-notifications-button'));
      });

      await waitFor(() => {
        expect(clearTimeoutSpy).toHaveBeenCalled();
        expect(mockCompleteOnboarding).toHaveBeenCalled();
      });

      clearTimeoutSpy.mockRestore();
    });
  });

  describe('Edge Cases and State Management', () => {
    it('navigates through all steps correctly', async () => {
      const { getByTestId } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Step 1 - Welcome
      expect(getByTestId('welcome-step')).toBeTruthy();

      // Navigate to step 2 - Disclaimer
      fireEvent.press(getByTestId('next-button'));
      await waitFor(() => {
        expect(getByTestId('disclaimer-step')).toBeTruthy();
      });

      // Navigate to step 3 - Notification permissions
      fireEvent.press(getByTestId('next-button'));
      await waitFor(() => {
        expect(getByTestId('notification-permissions-step')).toBeTruthy();
      });

      // Navigate to step 4 - Location permissions (this triggers notification request)
      await act(async () => {
        fireEvent.press(getByTestId('next-button'));
      });
      
      await waitFor(() => {
        expect(getByTestId('location-permissions-step')).toBeTruthy();
      });
    });

    it('does not navigate beyond total steps', async () => {
      const { getByTestId } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Navigate to final step
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('disclaimer-step')).toBeTruthy();
      });
      
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('notification-permissions-step')).toBeTruthy();
      });
      
      await act(async () => {
        fireEvent.press(getByTestId('next-button'));
      });

      // Verify we're on step 4
      await waitFor(() => {
        expect(getByTestId('location-permissions-step')).toBeTruthy();
      });

      // Verify finish button is shown, not continue
      expect(getByTestId('enable-notifications-button')).toBeTruthy();
    });

    it('handles button disabled state during permission requests', async () => {
      // Make permission request slow
      let resolvePermission: (value: boolean) => void;
      mockRequestPermissions.mockImplementation(() => new Promise(resolve => {
        resolvePermission = resolve;
      }));

      const { getByTestId } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Navigate to step 3
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('disclaimer-step')).toBeTruthy();
      });
      
      fireEvent.press(getByTestId('next-button'));

      await waitFor(() => {
        expect(getByTestId('notification-permissions-step')).toBeTruthy();
      });

      // Trigger permission request
      fireEvent.press(getByTestId('next-button'));

      await waitFor(() => {
        const button = getByTestId('next-button');
        expect(button.props.accessibilityState?.disabled).toBe(true);
      });

      // Complete the permission request
      await act(async () => {
        resolvePermission!(true);
      });
    });

    it('handles button disabled state during finish process', async () => {
      // Make location permission request slow
      let resolveLocationPermission: (value: boolean) => void;
      mockRequestPermission.mockImplementation(() => new Promise(resolve => {
        resolveLocationPermission = resolve;
      }));

      const { getByTestId } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Navigate to final step
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('disclaimer-step')).toBeTruthy();
      });
      
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('notification-permissions-step')).toBeTruthy();
      });
      
      await act(async () => {
        fireEvent.press(getByTestId('next-button'));
      });

      await waitFor(() => {
        expect(getByTestId('enable-notifications-button')).toBeTruthy();
      });

      // Start finish process
      fireEvent.press(getByTestId('enable-notifications-button'));

      await waitFor(() => {
        const finishButton = getByTestId('enable-notifications-button');
        expect(finishButton.props.accessibilityState?.disabled).toBe(true);
      });

      // Complete the location permission request
      await act(async () => {
        resolveLocationPermission!(true);
      });
    });
  });

  describe('Button text states', () => {
    it('shows correct button text for requesting notification permissions', async () => {
      // Make permission request slow
      let resolvePermission: (value: boolean) => void;
      mockRequestPermissions.mockImplementation(() => new Promise(resolve => {
        resolvePermission = resolve;
      }));

      const { getByTestId, getByText } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Navigate to step 3
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('disclaimer-step')).toBeTruthy();
      });
      
      fireEvent.press(getByTestId('next-button'));

      await waitFor(() => {
        expect(getByTestId('notification-permissions-step')).toBeTruthy();
      });

      // Trigger permission request
      fireEvent.press(getByTestId('next-button'));

      await waitFor(() => {
        expect(getByText('Requesting...')).toBeTruthy();
      });

      // Complete the permission request
      await act(async () => {
        resolvePermission!(true);
      });
    });

    it('shows correct button text during finish setup', async () => {
      // Make location permission request slow
      let resolveLocationPermission: (value: boolean) => void;
      mockRequestPermission.mockImplementation(() => new Promise(resolve => {
        resolveLocationPermission = resolve;
      }));

      const { getByTestId, getByText } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Navigate to final step
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('disclaimer-step')).toBeTruthy();
      });
      
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('notification-permissions-step')).toBeTruthy();
      });
      
      await act(async () => {
        fireEvent.press(getByTestId('next-button'));
      });

      await waitFor(() => {
        expect(getByTestId('enable-notifications-button')).toBeTruthy();
      });

      // Start finish process
      fireEvent.press(getByTestId('enable-notifications-button'));

      await waitFor(() => {
        expect(getByText('Setting up...')).toBeTruthy();
      });

      // Complete the location permission request
      await act(async () => {
        resolveLocationPermission!(true);
      });
    });
  });

  describe('Logging', () => {
    it('logs notification permission request and result', async () => {
      const { getByTestId } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Navigate to step 3 and continue
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('disclaimer-step')).toBeTruthy();
      });
      
      fireEvent.press(getByTestId('next-button'));

      await waitFor(() => {
        expect(getByTestId('notification-permissions-step')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('next-button'));
      });

      await waitFor(() => {
        expect(mockLoggerLog).toHaveBeenCalledWith(
          '[WelcomeScreen] Requesting notification permissions on step 3'
        );
        expect(mockLoggerLog).toHaveBeenCalledWith(
          '[WelcomeScreen] Notification permission result:',
          { granted: true }
        );
      });
    });

    it('logs onboarding completion process', async () => {
      const { getByTestId } = render(
        <WelcomeScreen />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('welcome-step')).toBeTruthy();
      });

      // Navigate to final step and complete
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('disclaimer-step')).toBeTruthy();
      });
      
      fireEvent.press(getByTestId('next-button'));
      
      await waitFor(() => {
        expect(getByTestId('notification-permissions-step')).toBeTruthy();
      });
      
      await act(async () => {
        fireEvent.press(getByTestId('next-button'));
      });

      await waitFor(() => {
        expect(getByTestId('enable-notifications-button')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('enable-notifications-button'));
      });

      await waitFor(() => {
        expect(mockLoggerLog).toHaveBeenCalledWith(
          '[WelcomeScreen] Completing onboarding and requesting location permission'
        );
        expect(mockLoggerLog).toHaveBeenCalledWith(
          '[WelcomeScreen] Completing onboarding'
        );
        expect(mockLoggerLog).toHaveBeenCalledWith(
          '[WelcomeScreen] Location permission result:',
          { granted: true }
        );
      });
    });
  });
});