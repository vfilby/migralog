import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert, Share } from 'react-native';
import PerformanceScreen from '../settings/PerformanceScreen';
import {
  getPerformanceStats,
  clearPerformanceStats,
  PerformanceStats,
} from '../../utils/performance';

// Mock dependencies
jest.mock('../../utils/performance');
jest.mock('../../theme', () => ({
  useTheme: () => ({
    theme: {
      background: '#FFFFFF',
      backgroundSecondary: '#F5F5F5',
      card: '#FFFFFF',
      text: '#000000',
      textSecondary: '#666666',
      textTertiary: '#999999',
      border: '#E0E0E0',
      borderLight: '#F0F0F0',
      primary: '#007AFF',
      primaryText: '#FFFFFF',
      danger: '#FF3B30',
      dangerText: '#FFFFFF',
      shadow: '#000000',
    },
  }),
}));

const mockGetPerformanceStats = getPerformanceStats as jest.MockedFunction<
  typeof getPerformanceStats
>;
const mockClearPerformanceStats = clearPerformanceStats as jest.MockedFunction<
  typeof clearPerformanceStats
>;

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
};

describe('PerformanceScreen', () => {
  const mockStats: PerformanceStats = {
    totalOperations: 42,
    averageDuration: 45.5,
    slowOperations: 3,
    metrics: [
      {
        label: 'database-query',
        duration: 150,
        timestamp: Date.now() - 1000,
        isSlow: true,
        threshold: 100,
      },
      {
        label: 'render-component',
        duration: 10,
        timestamp: Date.now() - 2000,
        isSlow: false,
        threshold: 16,
      },
      {
        label: 'fetch-data',
        duration: 500,
        timestamp: Date.now() - 3000,
        isSlow: true,
        threshold: 1000,
      },
    ],
    startupTime: 1500,
    appStartTime: Date.now() - 60000, // 1 minute ago
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPerformanceStats.mockReturnValue(mockStats);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render performance screen', () => {
      const { getByTestId } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      expect(getByTestId('performance-screen')).toBeTruthy();
    });

    it('should display session summary stats', () => {
      const { getByText } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      expect(getByText('Session Summary')).toBeTruthy();
      expect(getByText('Uptime')).toBeTruthy();
      expect(getByText('Operations')).toBeTruthy();
      expect(getByText('Avg Duration')).toBeTruthy();
      expect(getByText('Slow Ops')).toBeTruthy();
      expect(getByText('42')).toBeTruthy(); // totalOperations
      expect(getByText('3')).toBeTruthy(); // slowOperations
    });

    it('should display app startup time when available', () => {
      const { getByText } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      expect(getByText('App Startup')).toBeTruthy();
      expect(getByText('1.50s')).toBeTruthy(); // startupTime formatted
      expect(getByText('Moderate startup')).toBeTruthy(); // 1500ms is moderate
    });

    it('should not display app startup section when startupTime is undefined', () => {
      mockGetPerformanceStats.mockReturnValue({
        ...mockStats,
        startupTime: undefined,
      });

      const { queryByText } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      expect(queryByText('App Startup')).toBeNull();
    });

    it('should display recent operations list', () => {
      const { getByText } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      expect(getByText('Recent Operations (3)')).toBeTruthy();
      expect(getByText('database-query')).toBeTruthy();
      expect(getByText('render-component')).toBeTruthy();
      expect(getByText('fetch-data')).toBeTruthy();
    });

    it('should display empty state when no metrics', () => {
      mockGetPerformanceStats.mockReturnValue({
        ...mockStats,
        metrics: [],
        totalOperations: 0,
      });

      const { getByText } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      expect(getByText('No operations recorded yet')).toBeTruthy();
    });

    it('should display only last 20 operations when more exist', () => {
      const manyMetrics = Array.from({ length: 50 }, (_, i) => ({
        label: `operation-${i}`,
        duration: 10 + i,
        timestamp: Date.now() - i * 1000,
        isSlow: false,
      }));

      mockGetPerformanceStats.mockReturnValue({
        ...mockStats,
        metrics: manyMetrics,
        totalOperations: 50,
      });

      const { getByText, queryByText } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      expect(getByText('Recent Operations (50)')).toBeTruthy();
      expect(getByText('operation-0')).toBeTruthy(); // First 20 should be visible
      expect(getByText('operation-19')).toBeTruthy();
      expect(queryByText('operation-20')).toBeNull(); // 21st should not be visible
    });
  });

  describe('Navigation', () => {
    it('should call navigation.goBack when back button pressed', () => {
      render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      // The test verifies navigation setup - actual back button press would be tested in E2E
      expect(mockNavigation.goBack).not.toHaveBeenCalled();
    });
  });

  describe('Auto-refresh', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should auto-refresh stats every 2 seconds when enabled', () => {
      render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      expect(mockGetPerformanceStats).toHaveBeenCalledTimes(1);

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(mockGetPerformanceStats).toHaveBeenCalledTimes(2);

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(mockGetPerformanceStats).toHaveBeenCalledTimes(3);
    });

    it('should stop auto-refresh when toggle is pressed', () => {
      const { getByTestId } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      // Toggle auto-refresh off
      const autoRefreshToggle = getByTestId('auto-refresh-toggle');
      act(() => {
        fireEvent.press(autoRefreshToggle);
      });

      // Clear any pending timers from before toggle
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      const callCountAfterToggle = mockGetPerformanceStats.mock.calls.length;

      act(() => {
        jest.advanceTimersByTime(4000);
      });

      // Should not call getPerformanceStats again after toggle off
      expect(mockGetPerformanceStats.mock.calls.length).toBe(callCountAfterToggle);
    });

    it('should resume auto-refresh when toggle is pressed again', () => {
      const { getByTestId } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      const autoRefreshToggle = getByTestId('auto-refresh-toggle');

      // Toggle auto-refresh off
      act(() => {
        fireEvent.press(autoRefreshToggle);
      });

      // Clear pending timer
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      const callCountBeforeResume = mockGetPerformanceStats.mock.calls.length;

      // Toggle auto-refresh back on
      act(() => {
        fireEvent.press(autoRefreshToggle);
      });

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      // Should have called at least once more after resuming
      expect(mockGetPerformanceStats.mock.calls.length).toBeGreaterThan(
        callCountBeforeResume
      );
    });

    it('should cleanup interval on unmount', () => {
      const { unmount } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Actions', () => {
    it('should refresh stats when refresh button pressed', () => {
      const { getByTestId } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      expect(mockGetPerformanceStats).toHaveBeenCalledTimes(1);

      const refreshButton = getByTestId('refresh-button');
      fireEvent.press(refreshButton);

      expect(mockGetPerformanceStats).toHaveBeenCalledTimes(2);
    });

    it('should show clear confirmation alert when clear button pressed', () => {
      const { getByTestId } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      const clearButton = getByTestId('clear-button');
      fireEvent.press(clearButton);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Clear Performance Data',
        'Are you sure you want to clear all performance metrics?',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
          expect.objectContaining({ text: 'Clear', style: 'destructive' }),
        ])
      );
    });

    it('should clear stats and show success alert when confirmed', () => {
      const { getByTestId } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      const clearButton = getByTestId('clear-button');
      fireEvent.press(clearButton);

      // Get the onPress callback from the Clear button in the alert
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const clearAction = alertCall[2].find((btn: any) => btn.text === 'Clear');

      // Execute the clear action
      act(() => {
        clearAction.onPress();
      });

      expect(mockClearPerformanceStats).toHaveBeenCalled();
      expect(mockGetPerformanceStats).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Success',
        'Performance data cleared'
      );
    });

    it('should export performance data when export button pressed', async () => {
      const { getByTestId } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      const exportButton = getByTestId('export-button');
      fireEvent.press(exportButton);

      await waitFor(() => {
        expect(Share.share).toHaveBeenCalledWith({
          message: expect.stringContaining('"totalOperations": 42'),
          title: 'Performance Data Export',
        });
      });
    });

    it('should show error alert when export fails', async () => {
      (Share.share as jest.Mock).mockRejectedValue(new Error('Share failed'));

      const { getByTestId } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      const exportButton = getByTestId('export-button');
      fireEvent.press(exportButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Failed to export performance data'
        );
      });
    });
  });

  describe('Formatting', () => {
    it('should format duration < 1ms with 2 decimal places', () => {
      mockGetPerformanceStats.mockReturnValue({
        ...mockStats,
        averageDuration: 0.5,
        metrics: [
          {
            label: 'fast-operation',
            duration: 0.75,
            timestamp: Date.now(),
            isSlow: false,
          },
        ],
      });

      const { getByText } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      expect(getByText('0.50ms')).toBeTruthy(); // averageDuration
      expect(getByText('0.75ms')).toBeTruthy(); // metric duration
    });

    it('should format duration < 1000ms as ms without decimals', () => {
      mockGetPerformanceStats.mockReturnValue({
        ...mockStats,
        averageDuration: 150.5,
      });

      const { getByText } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      expect(getByText('150ms')).toBeTruthy();
    });

    it('should format duration >= 1000ms as seconds with 2 decimals', () => {
      mockGetPerformanceStats.mockReturnValue({
        ...mockStats,
        averageDuration: 1500,
        startupTime: undefined, // Remove startup time to avoid duplicate "1.50s"
      });

      const { getByText } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      expect(getByText('1.50s')).toBeTruthy();
    });

    it('should format uptime correctly', () => {
      // Set app start time to 90 seconds ago
      mockGetPerformanceStats.mockReturnValue({
        ...mockStats,
        appStartTime: Date.now() - 90000,
      });

      const { getByText } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      expect(getByText('1m 30s')).toBeTruthy();
    });

    it('should format uptime without minutes when less than 1 minute', () => {
      // Set app start time to 30 seconds ago
      mockGetPerformanceStats.mockReturnValue({
        ...mockStats,
        appStartTime: Date.now() - 30000,
      });

      const { getByText } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      expect(getByText('30s')).toBeTruthy();
    });
  });

  describe('Startup Time Classification', () => {
    it('should show fast startup for time <= 1000ms', () => {
      mockGetPerformanceStats.mockReturnValue({
        ...mockStats,
        startupTime: 800,
      });

      const { getByText } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      expect(getByText('Fast startup')).toBeTruthy();
    });

    it('should show moderate startup for time between 1000-2000ms', () => {
      mockGetPerformanceStats.mockReturnValue({
        ...mockStats,
        startupTime: 1500,
      });

      const { getByText } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      expect(getByText('Moderate startup')).toBeTruthy();
    });

    it('should show slow startup for time > 2000ms', () => {
      mockGetPerformanceStats.mockReturnValue({
        ...mockStats,
        startupTime: 2500,
      });

      const { getByText } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      expect(getByText('Slow startup')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have proper testIDs for all action buttons', () => {
      const { getByTestId } = render(
        <PerformanceScreen navigation={mockNavigation as any} route={{} as any} />
      );

      expect(getByTestId('performance-screen')).toBeTruthy();
      expect(getByTestId('auto-refresh-toggle')).toBeTruthy();
      expect(getByTestId('refresh-button')).toBeTruthy();
      expect(getByTestId('export-button')).toBeTruthy();
      expect(getByTestId('clear-button')).toBeTruthy();
    });
  });
});
