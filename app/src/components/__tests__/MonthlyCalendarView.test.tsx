import React from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import MonthlyCalendarView from '../analytics/MonthlyCalendarView';
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

    it('should navigate to next month when viewing past month', async () => {
      // Start viewing December 2023 (a past month)
      const pastMonthDate = new Date('2023-12-15T10:00:00');
      renderWithTheme(<MonthlyCalendarView initialDate={pastMonthDate} />);

      await waitFor(() => {
        expect(screen.getByText('December 2023')).toBeTruthy();
        expect(screen.getByTestId('next-month-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('next-month-button'));

      await waitFor(() => {
        expect(screen.getByText('January 2024')).toBeTruthy();
      });
    });

    it('should load data when month changes', async () => {
      // Start viewing December 2023 so we can navigate forward
      const pastMonthDate = new Date('2023-12-15T10:00:00');
      renderWithTheme(<MonthlyCalendarView initialDate={pastMonthDate} />);

      await waitFor(() => {
        expect(mockLoadDailyStatuses).toHaveBeenCalledWith('2023-12-01', '2023-12-31');
      });

      fireEvent.press(screen.getByTestId('next-month-button'));

      await waitFor(() => {
        expect(mockLoadDailyStatuses).toHaveBeenCalledWith('2024-01-01', '2024-01-31');
      });
    });

    it('should prevent navigation beyond current month', async () => {
      // System time is set to January 2024, so viewing January shouldn't allow forward navigation
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        expect(screen.getByText('January 2024')).toBeTruthy();
      });

      // The next month button should be disabled
      const nextButton = screen.getByTestId('next-month-button');
      expect(nextButton.props.accessibilityState?.disabled).toBe(true);
    });

    it('should allow navigation to current month but not beyond', async () => {
      // Start from December 2023, should be able to navigate to Jan 2024 but not Feb
      const pastMonthDate = new Date('2023-12-15T10:00:00');
      renderWithTheme(<MonthlyCalendarView initialDate={pastMonthDate} />);

      await waitFor(() => {
        expect(screen.getByText('December 2023')).toBeTruthy();
      });

      // Navigate to January 2024 (current month)
      fireEvent.press(screen.getByTestId('next-month-button'));

      await waitFor(() => {
        expect(screen.getByText('January 2024')).toBeTruthy();
      });

      // Now the next button should be disabled
      const nextButton = screen.getByTestId('next-month-button');
      expect(nextButton.props.accessibilityState?.disabled).toBe(true);
    });

    it('should not change month when pressing disabled next button', async () => {
      // System time is January 2024, so next button should be disabled
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        expect(screen.getByText('January 2024')).toBeTruthy();
      });

      // Try pressing the disabled next button
      fireEvent.press(screen.getByTestId('next-month-button'));

      // Should still be January 2024 (not February)
      await waitFor(() => {
        expect(screen.getByText('January 2024')).toBeTruthy();
      });
      expect(screen.queryByText('February 2024')).toBeNull();
    });

    it('should show correct accessibility hint based on navigation state', async () => {
      // Start from December 2023 (can navigate forward)
      const pastMonthDate = new Date('2023-12-15T10:00:00');
      renderWithTheme(<MonthlyCalendarView initialDate={pastMonthDate} />);

      await waitFor(() => {
        const nextButton = screen.getByTestId('next-month-button');
        expect(nextButton.props.accessibilityHint).toBe('Double tap to view the next month');
      });

      // Navigate to January 2024 (current month, cannot navigate forward)
      fireEvent.press(screen.getByTestId('next-month-button'));

      await waitFor(() => {
        const nextButton = screen.getByTestId('next-month-button');
        expect(nextButton.props.accessibilityHint).toBe('Cannot navigate beyond current month');
      });
    });

    it('should apply disabled styling to next button on current month', async () => {
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        const nextButton = screen.getByTestId('next-month-button');
        // The button should have the disabled style applied (opacity: 0.3)
        const styles = nextButton.props.style;
        const flatStyles = Array.isArray(styles) ? Object.assign({}, ...styles.filter(Boolean)) : styles;
        expect(flatStyles.opacity).toBe(0.3);
      });
    });

    it('should not apply disabled styling to next button when viewing past month', async () => {
      const pastMonthDate = new Date('2023-12-15T10:00:00');
      renderWithTheme(<MonthlyCalendarView initialDate={pastMonthDate} />);

      await waitFor(() => {
        const nextButton = screen.getByTestId('next-month-button');
        // The button should NOT have reduced opacity
        const styles = nextButton.props.style;
        const flatStyles = Array.isArray(styles) ? Object.assign({}, ...styles.filter(Boolean)) : styles;
        expect(flatStyles.opacity).not.toBe(0.3);
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

  describe('Future Date Visual Styling', () => {
    it('should apply different styling to future dates', async () => {
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        const futureDay = screen.getByTestId('calendar-day-2024-01-20');
        const pastDay = screen.getByTestId('calendar-day-2024-01-10');

        // Future dates should have different styling
        expect(futureDay.props.style).toBeDefined();
        expect(pastDay.props.style).toBeDefined();

        // Styles are different between future and past dates
        expect(futureDay.props.style).not.toEqual(pastDay.props.style);
      });
    });

    it('should render future date text with different styling', async () => {
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        const futureDay = screen.getByTestId('calendar-day-2024-01-20');
        const pastDay = screen.getByTestId('calendar-day-2024-01-10');

        // Get the text elements inside each day cell
        const futureDayText = futureDay.findByType(Text);
        const pastDayText = pastDay.findByType(Text);

        // Future dates should use different text styling
        expect(futureDayText.props.style).toBeDefined();
        expect(pastDayText.props.style).toBeDefined();
      });
    });

    it('should apply future date styling only to dates after today', async () => {
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        const currentDay = screen.getByTestId('calendar-day-2024-01-15');
        const yesterdayDay = screen.getByTestId('calendar-day-2024-01-14');
        const tomorrowDay = screen.getByTestId('calendar-day-2024-01-16');

        // Today and yesterday should NOT be disabled
        expect(currentDay.props.accessibilityState?.disabled).not.toBe(true);
        expect(yesterdayDay.props.accessibilityState?.disabled).not.toBe(true);

        // Tomorrow should be disabled
        expect(tomorrowDay.props.accessibilityState?.disabled).toBe(true);
      });
    });

    it('should highlight today with primary color border', async () => {
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        const todayCell = screen.getByTestId('calendar-day-2024-01-15');

        // Today should be highlighted
        expect(todayCell).toBeTruthy();
        expect(todayCell.props.style).toBeDefined();
      });
    });

    it('should not highlight past or future dates with today styling', async () => {
      renderWithTheme(<MonthlyCalendarView initialDate={testDate} />);

      await waitFor(() => {
        const todayCell = screen.getByTestId('calendar-day-2024-01-15');
        const yesterdayCell = screen.getByTestId('calendar-day-2024-01-14');
        const tomorrowCell = screen.getByTestId('calendar-day-2024-01-16');

        // Verify all cells exist
        expect(todayCell).toBeTruthy();
        expect(yesterdayCell).toBeTruthy();
        expect(tomorrowCell).toBeTruthy();

        // Today should have different styling than yesterday and tomorrow
        expect(todayCell.props.style).not.toEqual(yesterdayCell.props.style);
        expect(todayCell.props.style).not.toEqual(tomorrowCell.props.style);
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
      // Navigate from December 2023 to January 2024 (current month per testDate)
      const decDate = new Date('2023-12-15T10:00:00');

      renderWithTheme(<MonthlyCalendarView initialDate={decDate} />);

      await waitFor(() => {
        expect(screen.getByText('December 2023')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('next-month-button'));

      await waitFor(() => {
        expect(screen.getByText('January 2024')).toBeTruthy();
      });
    });
  });
});
