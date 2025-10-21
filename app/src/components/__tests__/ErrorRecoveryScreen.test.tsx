import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ErrorRecoveryScreen from '../ErrorRecoveryScreen';

// Mock theme hook
jest.mock('../../theme', () => ({
  useTheme: jest.fn(() => ({
    theme: {
      background: '#FFFFFF',
      text: '#000000',
      textSecondary: '#666666',
      textTertiary: '#999999',
      card: '#F5F5F5',
      border: '#E0E0E0',
      primary: '#007AFF',
      primaryText: '#FFFFFF',
      danger: '#FF3B30',
    },
  })),
}));

describe('ErrorRecoveryScreen', () => {
  const mockError = new Error('Test error message');
  const mockOnReset = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      const { getByText } = render(
        <ErrorRecoveryScreen error={mockError} onReset={mockOnReset} />
      );

      expect(getByText('Something Went Wrong')).toBeTruthy();
    });

    it('displays error title and user-friendly message', () => {
      const { getByText } = render(
        <ErrorRecoveryScreen error={mockError} onReset={mockOnReset} />
      );

      expect(getByText('Something Went Wrong')).toBeTruthy();
      expect(getByText("The app encountered an unexpected error. Don't worry - your data is safe.")).toBeTruthy();
    });

    it('displays warning icon', () => {
      const { getByText } = render(
        <ErrorRecoveryScreen error={mockError} onReset={mockOnReset} />,
        
      );

      expect(getByText('⚠️')).toBeTruthy();
    });

    it('displays Try Again button', () => {
      const { getByText } = render(
        <ErrorRecoveryScreen error={mockError} onReset={mockOnReset} />,
        
      );

      expect(getByText('Try Again')).toBeTruthy();
    });

    it('displays help text', () => {
      const { getByText } = render(
        <ErrorRecoveryScreen error={mockError} onReset={mockOnReset} />,
        
      );

      expect(getByText('If this problem persists, try restarting the app.')).toBeTruthy();
    });

    it('hides error details in production mode', () => {
      const originalDev = __DEV__;
      (global as any).__DEV__ = false;

      const { queryByText } = render(
        <ErrorRecoveryScreen error={mockError} onReset={mockOnReset} />,
        
      );

      expect(queryByText('Error Details (Dev Mode):')).toBeNull();
      expect(queryByText('Test error message')).toBeNull();

      (global as any).__DEV__ = originalDev;
    });

    it('shows error details in development mode', () => {
      const originalDev = __DEV__;
      (global as any).__DEV__ = true;

      const { getByText } = render(
        <ErrorRecoveryScreen error={mockError} onReset={mockOnReset} />,
        
      );

      expect(getByText('Error Details (Dev Mode):')).toBeTruthy();
      expect(getByText('Test error message')).toBeTruthy();

      (global as any).__DEV__ = originalDev;
    });

    it('shows error stack trace in development mode if available', () => {
      const originalDev = __DEV__;
      (global as any).__DEV__ = true;

      const errorWithStack = new Error('Test error');
      errorWithStack.stack = 'Error: Test error\n  at Component.tsx:10:15';

      const { getByText } = render(
        <ErrorRecoveryScreen error={errorWithStack} onReset={mockOnReset} />,
        
      );

      expect(getByText('Error Details (Dev Mode):')).toBeTruthy();
      expect(getByText('Error: Test error\n  at Component.tsx:10:15')).toBeTruthy();

      (global as any).__DEV__ = originalDev;
    });
  });

  describe('User Interactions', () => {
    it('calls onReset when Try Again button is pressed', () => {
      const { getByTestId } = render(
        <ErrorRecoveryScreen error={mockError} onReset={mockOnReset} />,
        
      );

      const resetButton = getByTestId('error-recovery-reset');
      fireEvent.press(resetButton);

      expect(mockOnReset).toHaveBeenCalledTimes(1);
    });

    it('can be pressed multiple times', () => {
      const { getByTestId } = render(
        <ErrorRecoveryScreen error={mockError} onReset={mockOnReset} />,
        
      );

      const resetButton = getByTestId('error-recovery-reset');

      fireEvent.press(resetButton);
      fireEvent.press(resetButton);
      fireEvent.press(resetButton);

      expect(mockOnReset).toHaveBeenCalledTimes(3);
    });
  });

  describe('Accessibility', () => {
    it('has proper testID for the reset button', () => {
      const { getByTestId } = render(
        <ErrorRecoveryScreen error={mockError} onReset={mockOnReset} />,
        
      );

      expect(getByTestId('error-recovery-reset')).toBeTruthy();
    });

    it('provides accessible button text', () => {
      const { getByText } = render(
        <ErrorRecoveryScreen error={mockError} onReset={mockOnReset} />,
        
      );

      const buttonText = getByText('Try Again');
      expect(buttonText).toBeTruthy();
    });
  });

  describe('Theme Support', () => {
    it('renders correctly with theme integration', () => {
      const { getByText } = render(
        <ErrorRecoveryScreen error={mockError} onReset={mockOnReset} />,
        
      );

      // Component should render without throwing
      expect(getByText('Something Went Wrong')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('handles error without message', () => {
      const errorWithoutMessage = new Error();

      const { getByText } = render(
        <ErrorRecoveryScreen error={errorWithoutMessage} onReset={mockOnReset} />,
        
      );

      expect(getByText('Something Went Wrong')).toBeTruthy();
      expect(getByText('Try Again')).toBeTruthy();
    });

    it('handles error without stack trace', () => {
      const originalDev = __DEV__;
      (global as any).__DEV__ = true;

      const errorWithoutStack = new Error('Test error');
      delete errorWithoutStack.stack;

      const { getByText, queryByText } = render(
        <ErrorRecoveryScreen error={errorWithoutStack} onReset={mockOnReset} />,
        
      );

      expect(getByText('Error Details (Dev Mode):')).toBeTruthy();
      expect(getByText('Test error')).toBeTruthy();
      // Stack should not be rendered when not available
      // (no easy way to test absence of specific text when error details exist)

      (global as any).__DEV__ = originalDev;
    });

    it('handles very long error messages', () => {
      const longMessage = 'This is a very long error message that should still be displayed correctly without breaking the UI layout. '.repeat(10);
      const longError = new Error(longMessage);

      const { getByText } = render(
        <ErrorRecoveryScreen error={longError} onReset={mockOnReset} />,
        
      );

      expect(getByText('Something Went Wrong')).toBeTruthy();
      expect(getByText('Try Again')).toBeTruthy();
    });
  });
});
