import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import DailyStatusWidget from '../DailyStatusWidget';
import { useDailyStatusStore } from '../../store/dailyStatusStore';
import { ThemeProvider } from '../../theme/ThemeContext';

jest.mock('../../store/dailyStatusStore');

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  addListener: jest.fn((event, callback) => {
    if (event === 'focus') {
      callback();
    }
    return jest.fn();
  }),
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
}));

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('DailyStatusWidget', () => {
  const mockLogDayStatus = jest.fn();
  const mockGetDayStatus = jest.fn();
  const mockDeleteDayStatus = jest.fn();
  const mockOnStatusLogged = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-16T10:00:00'));

    (useDailyStatusStore as unknown as jest.Mock).mockReturnValue({
      logDayStatus: mockLogDayStatus,
      getDayStatus: mockGetDayStatus,
      deleteDayStatus: mockDeleteDayStatus,
    });

    mockLogDayStatus.mockResolvedValue(undefined);
    mockDeleteDayStatus.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Widget Visibility', () => {
    it('should show widget when no status logged', async () => {
      mockGetDayStatus.mockResolvedValue(null);

      renderWithTheme(<DailyStatusWidget />);

      await waitFor(() => {
        expect(screen.getByTestId('daily-status-widget')).toBeTruthy();
        expect(screen.getByText('How was yesterday?')).toBeTruthy();
      });
    });

    it('should hide widget when status logged over 15 minutes ago', async () => {
      const oldTimestamp = Date.now() - 20 * 60 * 1000; // 20 minutes ago
      mockGetDayStatus.mockResolvedValue({
        id: 'status-1',
        date: '2024-01-15',
        status: 'green',
        createdAt: oldTimestamp,
        updatedAt: oldTimestamp,
      });

      renderWithTheme(<DailyStatusWidget />);

      await waitFor(() => {
        expect(screen.queryByTestId('daily-status-widget')).toBeNull();
        expect(screen.queryByTestId('daily-status-widget-logged')).toBeNull();
      });
    });

    it('should show logged status when logged within 15 minutes', async () => {
      const recentTimestamp = Date.now() - 5 * 60 * 1000; // 5 minutes ago
      mockGetDayStatus.mockResolvedValue({
        id: 'status-1',
        date: '2024-01-15',
        status: 'green',
        createdAt: recentTimestamp,
        updatedAt: recentTimestamp,
      });

      renderWithTheme(<DailyStatusWidget />);

      await waitFor(() => {
        expect(screen.getByTestId('daily-status-widget-logged')).toBeTruthy();
      });
    });
  });

  describe('Logging Status', () => {
    it('should display green and yellow buttons', async () => {
      mockGetDayStatus.mockResolvedValue(null);

      renderWithTheme(<DailyStatusWidget />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-green-button')).toBeTruthy();
        expect(screen.getByTestId('widget-yellow-button')).toBeTruthy();
        expect(screen.getByText('Clear')).toBeTruthy();
        expect(screen.getByText('Not Clear')).toBeTruthy();
      });
    });

    it('should log green status when green button pressed', async () => {
      mockGetDayStatus.mockResolvedValue(null);

      renderWithTheme(<DailyStatusWidget />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-green-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('widget-green-button'));

      await waitFor(() => {
        expect(mockLogDayStatus).toHaveBeenCalledWith(
          '2024-01-15', // yesterday
          'green',
          undefined,
          undefined,
          false
        );
      });
    });

    it('should log yellow status when yellow button pressed', async () => {
      mockGetDayStatus.mockResolvedValue(null);

      renderWithTheme(<DailyStatusWidget />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-yellow-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('widget-yellow-button'));

      await waitFor(() => {
        expect(mockLogDayStatus).toHaveBeenCalledWith(
          '2024-01-15',
          'yellow',
          undefined,
          undefined,
          false
        );
      });
    });

    it('should call onStatusLogged callback after logging', async () => {
      mockGetDayStatus.mockResolvedValue(null);

      renderWithTheme(<DailyStatusWidget onStatusLogged={mockOnStatusLogged} />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-green-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('widget-green-button'));

      await waitFor(() => {
        expect(mockOnStatusLogged).toHaveBeenCalled();
      });
    });

    it('should show loading state while logging', async () => {
      mockGetDayStatus.mockResolvedValue(null);
      let resolveLogStatus: any;
      mockLogDayStatus.mockReturnValue(
        new Promise((resolve) => {
          resolveLogStatus = resolve;
        })
      );

      renderWithTheme(<DailyStatusWidget />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-green-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('widget-green-button'));

      await waitFor(() => {
        // Check that ActivityIndicator is rendered during loading
        const indicators = screen.UNSAFE_queryAllByType('ActivityIndicator' as any);
        expect(indicators.length).toBeGreaterThan(0);
      });

      resolveLogStatus();
    });
  });

  describe('Logged Status Display', () => {
    it('should display green status with emoji and label', async () => {
      const recentTimestamp = Date.now() - 5 * 60 * 1000;
      mockGetDayStatus.mockResolvedValue({
        id: 'status-1',
        date: '2024-01-15',
        status: 'green',
        createdAt: recentTimestamp,
        updatedAt: recentTimestamp,
      });

      renderWithTheme(<DailyStatusWidget />);

      await waitFor(() => {
        expect(screen.getByText(/Yesterday logged as Clear day/)).toBeTruthy();
      });
    });

    it('should display yellow status with emoji and label', async () => {
      const recentTimestamp = Date.now() - 5 * 60 * 1000;
      mockGetDayStatus.mockResolvedValue({
        id: 'status-1',
        date: '2024-01-15',
        status: 'yellow',
        createdAt: recentTimestamp,
        updatedAt: recentTimestamp,
      });

      renderWithTheme(<DailyStatusWidget />);

      await waitFor(() => {
        expect(screen.getByText(/Yesterday logged as Not clear/)).toBeTruthy();
      });
    });

    it('should display undo button when status logged', async () => {
      const recentTimestamp = Date.now() - 5 * 60 * 1000;
      mockGetDayStatus.mockResolvedValue({
        id: 'status-1',
        date: '2024-01-15',
        status: 'green',
        createdAt: recentTimestamp,
        updatedAt: recentTimestamp,
      });

      renderWithTheme(<DailyStatusWidget />);

      await waitFor(() => {
        expect(screen.getByTestId('undo-status-button')).toBeTruthy();
        expect(screen.getByText('Undo')).toBeTruthy();
      });
    });
  });

  describe('Undo Functionality', () => {
    it('should delete status when undo button pressed', async () => {
      const recentTimestamp = Date.now() - 5 * 60 * 1000;
      const statusData = {
        id: 'status-1',
        date: '2024-01-15',
        status: 'green' as const,
        createdAt: recentTimestamp,
        updatedAt: recentTimestamp,
      };

      mockGetDayStatus.mockResolvedValue(statusData);

      renderWithTheme(<DailyStatusWidget />);

      await waitFor(() => {
        expect(screen.getByTestId('undo-status-button')).toBeTruthy();
      });

      // Mock second call to return same status for undo
      mockGetDayStatus.mockResolvedValue(statusData);
      fireEvent.press(screen.getByTestId('undo-status-button'));

      await waitFor(() => {
        expect(mockDeleteDayStatus).toHaveBeenCalledWith('status-1');
      });
    });

    it('should call onStatusLogged callback after undo', async () => {
      const recentTimestamp = Date.now() - 5 * 60 * 1000;
      const statusData = {
        id: 'status-1',
        date: '2024-01-15',
        status: 'green' as const,
        createdAt: recentTimestamp,
        updatedAt: recentTimestamp,
      };

      mockGetDayStatus.mockResolvedValue(statusData);

      renderWithTheme(<DailyStatusWidget onStatusLogged={mockOnStatusLogged} />);

      await waitFor(() => {
        expect(screen.getByTestId('undo-status-button')).toBeTruthy();
      });

      mockGetDayStatus.mockResolvedValue(statusData);
      fireEvent.press(screen.getByTestId('undo-status-button'));

      await waitFor(() => {
        expect(mockOnStatusLogged).toHaveBeenCalled();
      });
    });

    it('should show prompt after undo', async () => {
      const recentTimestamp = Date.now() - 5 * 60 * 1000;
      const statusData = {
        id: 'status-1',
        date: '2024-01-15',
        status: 'green' as const,
        createdAt: recentTimestamp,
        updatedAt: recentTimestamp,
      };

      mockGetDayStatus.mockResolvedValue(statusData);

      renderWithTheme(<DailyStatusWidget />);

      await waitFor(() => {
        expect(screen.getByTestId('undo-status-button')).toBeTruthy();
      });

      // Mock undo - next call returns null (status deleted)
      mockGetDayStatus.mockResolvedValueOnce(statusData).mockResolvedValueOnce(null);
      fireEvent.press(screen.getByTestId('undo-status-button'));

      await waitFor(() => {
        expect(mockDeleteDayStatus).toHaveBeenCalled();
      });
    });
  });

  describe('Navigation Focus', () => {
    it('should re-check status when screen gains focus', async () => {
      mockGetDayStatus.mockResolvedValue(null);

      renderWithTheme(<DailyStatusWidget />);

      await waitFor(() => {
        expect(mockGetDayStatus).toHaveBeenCalled();
      });

      expect(mockNavigation.addListener).toHaveBeenCalledWith('focus', expect.any(Function));
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should handle logging error gracefully', async () => {
      mockGetDayStatus.mockResolvedValue(null);
      mockLogDayStatus.mockRejectedValue(new Error('Network error'));

      renderWithTheme(<DailyStatusWidget />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-green-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('widget-green-button'));

      await waitFor(() => {
         
        expect(console.error).toHaveBeenCalledWith('Failed to log status:', expect.any(Error));
      });
    });

    it('should handle undo error gracefully', async () => {
      const recentTimestamp = Date.now() - 5 * 60 * 1000;
      const statusData = {
        id: 'status-1',
        date: '2024-01-15',
        status: 'green' as const,
        createdAt: recentTimestamp,
        updatedAt: recentTimestamp,
      };

      mockGetDayStatus.mockResolvedValue(statusData);
      mockDeleteDayStatus.mockRejectedValue(new Error('Delete failed'));

      renderWithTheme(<DailyStatusWidget />);

      await waitFor(() => {
        expect(screen.getByTestId('undo-status-button')).toBeTruthy();
      });

      mockGetDayStatus.mockResolvedValue(statusData);
      fireEvent.press(screen.getByTestId('undo-status-button'));

      await waitFor(() => {
         
        expect(console.error).toHaveBeenCalledWith('Failed to undo status:', expect.any(Error));
      });
    });
  });

  describe('Theme Support', () => {
    it('should render with theme context', async () => {
      mockGetDayStatus.mockResolvedValue(null);

      renderWithTheme(<DailyStatusWidget />);

      await waitFor(() => {
        expect(screen.getByTestId('daily-status-widget')).toBeTruthy();
      });
    });
  });
});
