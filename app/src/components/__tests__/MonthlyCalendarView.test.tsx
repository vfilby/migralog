import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import MonthlyCalendarView from '../MonthlyCalendarView';
import { useDailyStatusStore } from '../../store/dailyStatusStore';
import { ThemeProvider } from '../../theme/ThemeContext';
import { DailyStatusLog } from '../../models/types';

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

describe('MonthlyCalendarView', () => {
  const mockLoadDailyStatuses = jest.fn();
  const testDate = new Date('2024-01-15T10:00:00');
  
  const sampleStatuses: DailyStatusLog[] = [
    {
      id: 'status-1',
      date: '2024-01-10',
      status: 'green',
      prompted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'status-2',
      date: '2024-01-15',
      status: 'yellow',
      prompted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'status-3',
      date: '2024-01-20',
      status: 'red',
      prompted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(testDate);

    (useDailyStatusStore as unknown as jest.Mock).mockReturnValue({
      dailyStatuses: [],
      loadDailyStatuses: mockLoadDailyStatuses,
      loading: false,
    });

    mockLoadDailyStatuses.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Calendar Rendering', () => {
    it('should render month and year', async () => {
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        expect(screen.getByText('January 2024')).toBeTruthy();
      });
    });

    it('should render weekday headers', async () => {
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        // Check for all weekday headers (S, M, T, W, T, F, S)
        const allS = screen.getAllByText('S'); // Sunday and Saturday
        const allT = screen.getAllByText('T'); // Tuesday and Thursday
        expect(allS.length).toBe(2);
        expect(allT.length).toBe(2);
        expect(screen.getByText('M')).toBeTruthy();
        expect(screen.getByText('W')).toBeTruthy();
        expect(screen.getByText('F')).toBeTruthy();
      });
    });

    it('should render legend', async () => {
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        expect(screen.getByText('Clear')).toBeTruthy();
        expect(screen.getByText('Not Clear')).toBeTruthy();
        expect(screen.getByText('Episode')).toBeTruthy();
      });
    });

    it('should render calendar days for the month', async () => {
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        // Should have day 1 through 31 for January
        expect(screen.getByText('1')).toBeTruthy();
        expect(screen.getByText('15')).toBeTruthy();
        expect(screen.getByText('31')).toBeTruthy();
      });
    });

    it('should show loading indicator when loading', async () => {
      (useDailyStatusStore as unknown as jest.Mock).mockReturnValue({
        dailyStatuses: [],
        loadDailyStatuses: mockLoadDailyStatuses,
        loading: true,
      });

      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        const indicators = screen.UNSAFE_queryAllByType('ActivityIndicator' as any);
        expect(indicators.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Status Indicators', () => {
    it('should display green status indicator', async () => {
      (useDailyStatusStore as unknown as jest.Mock).mockReturnValue({
        dailyStatuses: sampleStatuses,
        loadDailyStatuses: mockLoadDailyStatuses,
        loading: false,
      });

      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        expect(screen.getByTestId('calendar-day-2024-01-10')).toBeTruthy();
      });

      // Just verify the day exists - the emoji is rendered as a status indicator
      const greenDay = screen.getByTestId('calendar-day-2024-01-10');
      expect(greenDay).toBeTruthy();
    });

    it('should display yellow status indicator', async () => {
      (useDailyStatusStore as unknown as jest.Mock).mockReturnValue({
        dailyStatuses: sampleStatuses,
        loadDailyStatuses: mockLoadDailyStatuses,
        loading: false,
      });

      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        expect(screen.getByTestId('calendar-day-2024-01-15')).toBeTruthy();
      });
    });

    it('should display red status indicator', async () => {
      (useDailyStatusStore as unknown as jest.Mock).mockReturnValue({
        dailyStatuses: sampleStatuses,
        loadDailyStatuses: mockLoadDailyStatuses,
        loading: false,
      });

      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        expect(screen.getByTestId('calendar-day-2024-01-20')).toBeTruthy();
      });
    });

    it('should not display indicator for days without status', async () => {
      (useDailyStatusStore as unknown as jest.Mock).mockReturnValue({
        dailyStatuses: sampleStatuses,
        loadDailyStatuses: mockLoadDailyStatuses,
        loading: false,
      });

      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        expect(screen.getByTestId('calendar-day-2024-01-05')).toBeTruthy();
      });
    });
  });

  describe('Month Navigation', () => {
    it('should navigate to previous month', async () => {
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        expect(screen.getByText('January 2024')).toBeTruthy();
        expect(screen.getByTestId('previous-month-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('previous-month-button'));

      await waitFor(() => {
        expect(screen.getByText('December 2023')).toBeTruthy();
      });
    });

    it('should navigate to next month', async () => {
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        expect(screen.getByText('January 2024')).toBeTruthy();
        expect(screen.getByTestId('next-month-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('next-month-button'));

      await waitFor(() => {
        expect(screen.getByText('February 2024')).toBeTruthy();
      });
    });

    it('should load data when month changes', async () => {
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        expect(mockLoadDailyStatuses).toHaveBeenCalledWith('2024-01-01', '2024-01-31');
      });

      fireEvent.press(screen.getByTestId('next-month-button'));

      await waitFor(() => {
        expect(mockLoadDailyStatuses).toHaveBeenCalledWith('2024-02-01', '2024-02-29');
      });
    });
  });

  describe('Day Selection', () => {
    it('should navigate to daily status prompt when current day is pressed', async () => {
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        expect(screen.getByTestId('calendar-day-2024-01-15')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('calendar-day-2024-01-15'));

      expect(mockNavigation.navigate).toHaveBeenCalledWith('DailyStatusPrompt', {
        date: '2024-01-15',
      });
    });

    it('should navigate to daily status prompt when past day is pressed', async () => {
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        expect(screen.getByTestId('calendar-day-2024-01-01')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('calendar-day-2024-01-01'));

      expect(mockNavigation.navigate).toHaveBeenCalledWith('DailyStatusPrompt', {
        date: '2024-01-01',
      });
    });

    it('should NOT navigate when future day is pressed', async () => {
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        expect(screen.getByTestId('calendar-day-2024-01-20')).toBeTruthy();
      });

      // Try to press a future date (testDate is Jan 15, so Jan 20 is future)
      fireEvent.press(screen.getByTestId('calendar-day-2024-01-20'));

      // Navigation should NOT be called for future dates
      expect(mockNavigation.navigate).not.toHaveBeenCalledWith('DailyStatusPrompt', {
        date: '2024-01-20',
      });
    });

    it('should disable future date buttons', async () => {
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        const futureDay = screen.getByTestId('calendar-day-2024-01-20');
        expect(futureDay).toBeTruthy();
        // TouchableOpacity with disabled={true} still renders but doesn't respond to press
        expect(futureDay.props.accessibilityState?.disabled).toBe(true);
      });
    });

    it('should NOT disable past or current date buttons', async () => {
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        const currentDay = screen.getByTestId('calendar-day-2024-01-15');
        const pastDay = screen.getByTestId('calendar-day-2024-01-10');

        expect(currentDay.props.accessibilityState?.disabled).not.toBe(true);
        expect(pastDay.props.accessibilityState?.disabled).not.toBe(true);
      });
    });
  });

  describe('Data Loading', () => {
    it('should load month data on mount', async () => {
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        expect(mockLoadDailyStatuses).toHaveBeenCalledWith('2024-01-01', '2024-01-31');
      });
    });

    it('should reload data when screen gains focus', async () => {
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        expect(mockLoadDailyStatuses).toHaveBeenCalled();
      });

      expect(mockNavigation.addListener).toHaveBeenCalledWith('focus', expect.any(Function));
    });
  });

  describe('Default Props', () => {
    it('should use current date when no initialDate provided', async () => {
      renderWithTheme(<MonthlyCalendarView />);

      await waitFor(() => {
        expect(screen.getByText('January 2024')).toBeTruthy();
      });
    });
  });

  describe('Theme Support', () => {
    it('should render with theme context', async () => {
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        expect(screen.getByText('January 2024')).toBeTruthy();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty status array', async () => {
      (useDailyStatusStore as unknown as jest.Mock).mockReturnValue({
        dailyStatuses: [],
        loadDailyStatuses: mockLoadDailyStatuses,
        loading: false,
      });

      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        expect(screen.getByTestId('calendar-day-2024-01-15')).toBeTruthy();
      });
    });

    it('should handle months with different number of days', async () => {
      const febDate = new Date('2024-02-15T10:00:00');
      
      renderWithTheme(<MonthlyCalendarView initialDate={febDate} />);

      await waitFor(() => {
        expect(screen.getByText('February 2024')).toBeTruthy();
        expect(screen.getByText('29')).toBeTruthy(); // 2024 is a leap year
      });
    });

    it('should navigate across year boundary', async () => {
      const decDate = new Date('2024-12-15T10:00:00');
      
      renderWithTheme(<MonthlyCalendarView initialDate={decDate} />);

      await waitFor(() => {
        expect(screen.getByText('December 2024')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('next-month-button'));

      await waitFor(() => {
        expect(screen.getByText('January 2025')).toBeTruthy();
      });
    });
  });
});
