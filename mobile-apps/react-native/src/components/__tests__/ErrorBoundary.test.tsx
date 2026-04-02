import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text, View, TouchableOpacity } from 'react-native';
import ErrorBoundary from '../shared/ErrorBoundary';
import { errorLogger } from '../../services/errorLogger';

// Mock dependencies
jest.mock('../../services/errorLogger', () => ({
  errorLogger: {
    log: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../shared/ErrorRecoveryScreen', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return ({ error, onReset }: any) => (
    <View testID="error-recovery-screen">
      <Text testID="error-message">{error.message}</Text>
      <TouchableOpacity testID="reset-button" onPress={onReset}>
        <Text>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
});

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <Text testID="success-content">Content loaded successfully</Text>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error for cleaner test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders children when no error occurs', () => {
      const { getByTestId, queryByTestId } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(getByTestId('success-content')).toBeTruthy();
      expect(queryByTestId('error-recovery-screen')).toBeNull();
    });

    it('renders error recovery screen when error is caught', () => {
      const { getByTestId, queryByTestId } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(queryByTestId('success-content')).toBeNull();
      expect(getByTestId('error-recovery-screen')).toBeTruthy();
      expect(getByTestId('error-message')).toHaveTextContent('Test error');
    });

    it('renders custom fallback when provided', () => {
      const customFallback = (error: Error, resetError: () => void) => (
        <View testID="custom-fallback">
          <Text testID="custom-error-message">{error.message}</Text>
          <TouchableOpacity testID="custom-reset" onPress={resetError}>
            <Text>Custom Reset</Text>
          </TouchableOpacity>
        </View>
      );

      const { getByTestId } = render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByTestId('custom-fallback')).toBeTruthy();
      expect(getByTestId('custom-error-message')).toHaveTextContent('Test error');
    });
  });

  describe('Error Logging', () => {
    it('logs error to errorLogger service when error is caught', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(errorLogger.log).toHaveBeenCalledWith(
        'general',
        'React component error caught by ErrorBoundary',
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });

    it('handles errorLogger.log failure gracefully', async () => {
      const mockLog = errorLogger.log as jest.Mock;
      mockLog.mockRejectedValueOnce(new Error('Logging failed'));

      // Should not throw even if logging fails
      const { getByTestId } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByTestId('error-recovery-screen')).toBeTruthy();
    });
  });

  describe('Error Recovery', () => {
    it('provides resetError callback to error UI', () => {
      const { getByTestId } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Error state is active
      expect(getByTestId('error-recovery-screen')).toBeTruthy();

      // Reset button should be available
      const resetButton = getByTestId('reset-button');
      expect(resetButton).toBeTruthy();

      // Pressing reset button should not throw
      expect(() => fireEvent.press(resetButton)).not.toThrow();
    });

    it('allows custom fallback to provide reset functionality', () => {
      const customFallback = (error: Error, resetError: () => void) => (
        <View testID="custom-fallback">
          <Text>{error.message}</Text>
          <TouchableOpacity testID="custom-reset" onPress={resetError}>
            <Text>Reset</Text>
          </TouchableOpacity>
        </View>
      );

      const { getByTestId } = render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByTestId('custom-fallback')).toBeTruthy();

      const resetButton = getByTestId('custom-reset');
      expect(resetButton).toBeTruthy();

      // Pressing reset button should not throw
      expect(() => fireEvent.press(resetButton)).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('captures and displays different error messages', () => {
      const { getByTestId, unmount } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByTestId('error-message')).toHaveTextContent('Test error');

      unmount();

      // Test with different error
      const DifferentError = () => {
        throw new Error('Different error message');
      };

      const { getByTestId: getByTestId2 } = render(
        <ErrorBoundary>
          <DifferentError />
        </ErrorBoundary>
      );

      expect(getByTestId2('error-message')).toHaveTextContent('Different error message');
    });

    it('preserves error message across re-renders before reset', () => {
      const { getByTestId, rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const initialMessage = getByTestId('error-message').props.children;

      // Re-render without resetting
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByTestId('error-message')).toHaveTextContent(initialMessage);
    });
  });
});
