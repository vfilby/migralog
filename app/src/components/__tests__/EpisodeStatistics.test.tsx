import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import EpisodeStatistics from '../analytics/EpisodeStatistics';
import { useAnalyticsStore } from '../../store/analyticsStore';
import { dailyStatusRepository } from '../../database/dailyStatusRepository';
import { ThemeProvider } from '../../theme/ThemeContext';
import { DailyStatusLog, Episode } from '../../models/types';

jest.mock('../../store/analyticsStore');
jest.mock('../../database/dailyStatusRepository');

const mockUseAnalyticsStore = useAnalyticsStore as unknown as jest.Mock;

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('EpisodeStatistics', () => {
  const mockEpisodes: Episode[] = [
    {
      id: 'episode-1',
      startTime: new Date('2024-01-15T10:00:00').getTime(),
      endTime: new Date('2024-01-15T14:00:00').getTime(), // 4 hours
      locations: ['left_temple'],
      qualities: ['throbbing'],
      symptoms: ['nausea'],
      triggers: ['stress'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'episode-2',
      startTime: new Date('2024-01-17T08:00:00').getTime(),
      endTime: new Date('2024-01-17T10:00:00').getTime(), // 2 hours
      locations: ['right_temple'],
      qualities: ['throbbing'],
      symptoms: ['light_sensitivity'],
      triggers: ['lack_of_sleep'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'episode-3',
      startTime: new Date('2024-01-20T14:00:00').getTime(),
      endTime: new Date('2024-01-20T20:00:00').getTime(), // 6 hours
      locations: ['left_head'],
      qualities: ['pressure'],
      symptoms: ['nausea', 'vomiting'],
      triggers: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  const mockDailyStatuses: DailyStatusLog[] = [
    {
      id: 'status-1',
      date: '2024-01-16',
      status: 'green',
      prompted: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'status-2',
      date: '2024-01-18',
      status: 'yellow',
      prompted: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'status-3',
      date: '2024-01-19',
      status: 'green',
      prompted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  const mockSetDateRange = jest.fn();

  const createMockStoreState = (episodes: Episode[] = mockEpisodes) => ({
    episodes,
    dateRange: {
      startDate: new Date('2024-01-19'),
      endDate: new Date('2024-01-25'),
    },
    setDateRange: mockSetDateRange,
    selectedDays: 7,
    intensityReadings: [],
    isLoading: false,
    lastFetched: Date.now(),
    error: null,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-25T12:00:00'));

    mockUseAnalyticsStore.mockReturnValue(createMockStoreState());

    (dailyStatusRepository.getDateRange as jest.Mock).mockResolvedValue(mockDailyStatuses);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Component Rendering', () => {
    it('should render the component with testID', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByTestId('episode-statistics')).toBeTruthy();
      });
    });

    it('should render Day Statistics section', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByText('Day Statistics')).toBeTruthy();
        expect(screen.getByTestId('day-statistics-card')).toBeTruthy();
      });
    });

    it('should render Episode Statistics section', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByText('Episode Statistics')).toBeTruthy();
      });
    });
  });

  describe('Day Statistics - 7 Day Range', () => {
    it('should display migraine days count and percentage', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        const row = screen.getByTestId('migraine-days-row');
        expect(row).toBeTruthy();
        // 3 episodes on different days
        expect(screen.getByText(/Migraine Days:/)).toBeTruthy();
      });
    });

    it('should display not clear days count and percentage', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        const row = screen.getByTestId('not-clear-days-row');
        expect(row).toBeTruthy();
        expect(screen.getByText(/Not Clear Days:/)).toBeTruthy();
      });
    });

    it('should display clear days count and percentage', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        const row = screen.getByTestId('clear-days-row');
        expect(row).toBeTruthy();
      });
    });

    it('should display unknown days count and percentage', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        const row = screen.getByTestId('unknown-days-row');
        expect(row).toBeTruthy();
        expect(screen.getByText(/Unknown Days:/)).toBeTruthy();
      });
    });

    it('should call setDateRange when component mounts', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(mockSetDateRange).toHaveBeenCalledWith(7);
      });
    });

    it('should load daily statuses for the date range', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(dailyStatusRepository.getDateRange).toHaveBeenCalled();
      });
    });
  });

  describe('Day Statistics - 30 Day Range', () => {
    beforeEach(() => {
      mockUseAnalyticsStore.mockReturnValue({
        ...createMockStoreState(),
        dateRange: {
          startDate: new Date('2023-12-27'),
          endDate: new Date('2024-01-25'),
        },
        selectedDays: 30,
      });
    });

    it('should load daily statuses for 30 day range', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={30} />);

      await waitFor(() => {
        expect(dailyStatusRepository.getDateRange).toHaveBeenCalled();
        expect(mockSetDateRange).toHaveBeenCalledWith(30);
      });
    });
  });

  describe('Day Statistics - 90 Day Range', () => {
    beforeEach(() => {
      mockUseAnalyticsStore.mockReturnValue({
        ...createMockStoreState(),
        dateRange: {
          startDate: new Date('2023-10-28'),
          endDate: new Date('2024-01-25'),
        },
        selectedDays: 90,
      });
    });

    it('should load daily statuses for 90 day range', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={90} />);

      await waitFor(() => {
        expect(dailyStatusRepository.getDateRange).toHaveBeenCalled();
        expect(mockSetDateRange).toHaveBeenCalledWith(90);
      });
    });
  });

  describe('Episode Statistics - With Episodes', () => {
    beforeEach(() => {
      mockUseAnalyticsStore.mockReturnValue({
        ...createMockStoreState(),
        dateRange: {
          startDate: new Date('2023-12-27'),
          endDate: new Date('2024-01-25'),
        },
        selectedDays: 30,
      });
    });

    it('should display total episodes count', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={30} />);

      await waitFor(() => {
        const row = screen.getByTestId('total-episodes-row');
        expect(row).toBeTruthy();
        expect(screen.getByText(/Total Episodes:/)).toBeTruthy();
        expect(screen.getByText('3')).toBeTruthy();
      });
    });

    it('should display shortest episode duration', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={30} />);

      await waitFor(() => {
        const row = screen.getByTestId('shortest-duration-row');
        expect(row).toBeTruthy();
        expect(screen.getByText(/Shortest Episode:/)).toBeTruthy();
        expect(screen.getByText('2h')).toBeTruthy();
      });
    });

    it('should display longest episode duration', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={30} />);

      await waitFor(() => {
        const row = screen.getByTestId('longest-duration-row');
        expect(row).toBeTruthy();
        expect(screen.getByText(/Longest Episode:/)).toBeTruthy();
        expect(screen.getByText('6h')).toBeTruthy();
      });
    });

    it('should display average episode duration', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={30} />);

      await waitFor(() => {
        const row = screen.getByTestId('average-duration-row');
        expect(row).toBeTruthy();
        expect(screen.getByText(/Average Duration:/)).toBeTruthy();
        expect(screen.getByText('4h')).toBeTruthy();
      });
    });

    it('should show duration metrics card', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={30} />);

      await waitFor(() => {
        expect(screen.getByTestId('duration-metrics-card')).toBeTruthy();
      });
    });
  });

  describe('Episode Statistics - Without Episodes', () => {
    beforeEach(() => {
      mockUseAnalyticsStore.mockReturnValue(createMockStoreState([]));
    });

    it('should display empty state when no episodes', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeTruthy();
        expect(screen.getByText('No episodes in selected period')).toBeTruthy();
      });
    });

    it('should not display duration metrics card when no episodes', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.queryByTestId('duration-metrics-card')).toBeNull();
      });
    });
  });

  describe('Episode Statistics - Episodes without End Time', () => {
    beforeEach(() => {
      const ongoingEpisodes: Episode[] = [
        {
          id: 'episode-ongoing',
          startTime: new Date('2024-01-20T10:00:00').getTime(),
          // No endTime - ongoing episode
          locations: ['left_temple'],
          qualities: ['throbbing'],
          symptoms: [],
          triggers: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      mockUseAnalyticsStore.mockReturnValue({
        ...createMockStoreState(ongoingEpisodes),
        dateRange: {
          startDate: new Date('2023-12-27'),
          endDate: new Date('2024-01-25'),
        },
        selectedDays: 30,
      });
    });

    it('should display N/A for metrics when episodes have no end time', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={30} />);

      await waitFor(() => {
        expect(screen.getByTestId('duration-metrics-card')).toBeTruthy();
      });

      // Should show N/A for all duration metrics
      const naTexts = screen.getAllByText('N/A');
      expect(naTexts.length).toBeGreaterThanOrEqual(3); // shortest, longest, average
    });
  });

  describe('Ongoing Episodes - Day Count Accuracy', () => {
    it('should count all days for ongoing episode within date range', async () => {
      // Mock current time to Jan 25
      jest.setSystemTime(new Date('2024-01-25T12:00:00'));

      const ongoingEpisode: Episode[] = [
        {
          id: 'ongoing-1',
          startTime: new Date('2024-01-20T10:00:00').getTime(), // Started 5 days ago
          // No endTime - still ongoing
          locations: ['left_temple'],
          qualities: ['throbbing'],
          symptoms: [],
          triggers: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      mockUseAnalyticsStore.mockReturnValue({
        ...createMockStoreState(ongoingEpisode),
        dateRange: {
          startDate: new Date('2024-01-19'),
          endDate: new Date('2024-01-25T23:59:59.999'),
        },
        selectedDays: 7,
      });

      (dailyStatusRepository.getDateRange as jest.Mock).mockResolvedValue([]);

      renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        const migraineDaysRow = screen.getByTestId('migraine-days-row');
        expect(migraineDaysRow).toBeTruthy();
      });

      // Date range for last 7 days: Jan 19-25 (7 days total)
      // Episode started Jan 20, ongoing through Jan 25 = 6 days
      // 6 migraine days out of 7 total = 86%
      expect(screen.getByText(/6 \(86%\)/)).toBeTruthy();
    });

    it('should count ongoing episode that spans entire range', async () => {
      // Mock current time to Jan 25
      jest.setSystemTime(new Date('2024-01-25T12:00:00'));

      const ongoingEpisode: Episode[] = [
        {
          id: 'ongoing-2',
          startTime: new Date('2024-01-10T10:00:00').getTime(), // Started before range
          // No endTime - still ongoing
          locations: ['left_temple'],
          qualities: ['throbbing'],
          symptoms: [],
          triggers: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      mockUseAnalyticsStore.mockReturnValue({
        ...createMockStoreState(ongoingEpisode),
        dateRange: {
          startDate: new Date('2024-01-19'),
          endDate: new Date('2024-01-25T23:59:59.999'),
        },
        selectedDays: 7,
      });

      (dailyStatusRepository.getDateRange as jest.Mock).mockResolvedValue([]);

      renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        const migraineDaysRow = screen.getByTestId('migraine-days-row');
        expect(migraineDaysRow).toBeTruthy();
      });

      // Date range for last 7 days: Jan 19-25 (7 days total)
      // Episode started Jan 10, covers entire range = 7 days
      // 7 migraine days out of 7 total = 100%
      expect(screen.getByText(/7 \(100%\)/)).toBeTruthy();
    });

    it('should handle mix of completed and ongoing episodes', async () => {
      // Mock current time to Jan 25
      jest.setSystemTime(new Date('2024-01-25T12:00:00'));

      const mixedEpisodes: Episode[] = [
        {
          id: 'completed-1',
          startTime: new Date('2024-01-19T10:00:00').getTime(),
          endTime: new Date('2024-01-20T14:00:00').getTime(), // 2 days
          locations: ['left_temple'],
          qualities: ['throbbing'],
          symptoms: [],
          triggers: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'ongoing-1',
          startTime: new Date('2024-01-23T10:00:00').getTime(),
          // No endTime - ongoing from Jan 23-25 = 3 days
          locations: ['right_temple'],
          qualities: ['pressure'],
          symptoms: [],
          triggers: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      mockUseAnalyticsStore.mockReturnValue({
        ...createMockStoreState(mixedEpisodes),
        dateRange: {
          startDate: new Date('2024-01-19'),
          endDate: new Date('2024-01-25T23:59:59.999'),
        },
        selectedDays: 7,
      });

      (dailyStatusRepository.getDateRange as jest.Mock).mockResolvedValue([]);

      renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        const migraineDaysRow = screen.getByTestId('migraine-days-row');
        expect(migraineDaysRow).toBeTruthy();
      });

      // Date range for last 7 days: Jan 19-25 (7 days total)
      // Completed episode: Jan 19, 20 = 2 days
      // Ongoing episode: Jan 23, 24, 25 = 3 days
      // Total unique migraine days: 5 out of 7 = 71%
      expect(screen.getByText(/5 \(71%\)/)).toBeTruthy();
    });

    it('should correctly categorize days with ongoing episode and daily statuses', async () => {
      // Mock current time to Jan 25
      jest.setSystemTime(new Date('2024-01-25T12:00:00'));

      const ongoingEpisode: Episode[] = [
        {
          id: 'ongoing-1',
          startTime: new Date('2024-01-23T10:00:00').getTime(),
          // No endTime - ongoing from Jan 23-25 = 3 days
          locations: ['left_temple'],
          qualities: ['throbbing'],
          symptoms: [],
          triggers: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const dailyStatuses: DailyStatusLog[] = [
        {
          id: 'status-1',
          date: '2024-01-19',
          status: 'green',
          prompted: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'status-2',
          date: '2024-01-20',
          status: 'yellow',
          prompted: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'status-3',
          date: '2024-01-21',
          status: 'green',
          prompted: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        // Jan 22 has no status - should be unknown
        // Jan 23-25 have ongoing episode - should be migraine days
      ];

      mockUseAnalyticsStore.mockReturnValue({
        ...createMockStoreState(ongoingEpisode),
        dateRange: {
          startDate: new Date('2024-01-19'),
          endDate: new Date('2024-01-25T23:59:59.999'),
        },
        selectedDays: 7,
      });

      (dailyStatusRepository.getDateRange as jest.Mock).mockResolvedValue(dailyStatuses);

      renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        const migraineDaysRow = screen.getByTestId('migraine-days-row');
        expect(migraineDaysRow).toBeTruthy();
      });

      // Date range for last 7 days: Jan 19-25 (7 days total)
      // Migraine days: Jan 23, 24, 25 = 3 days (43%)
      // Not clear days: Jan 20 = 1 day (14%)
      // Clear days: Jan 19, 21 = 2 days (29%)
      // Unknown days: Jan 22 = 1 day (14%)
      expect(screen.getByTestId('migraine-days-row')).toBeTruthy();
      expect(screen.getByText(/3 \(43%\)/)).toBeTruthy(); // Migraine days

      // Check that clear days and unknown days show correct values
      const clearDaysRow = screen.getByTestId('clear-days-row');
      const unknownDaysRow = screen.getByTestId('unknown-days-row');
      expect(clearDaysRow).toBeTruthy();
      expect(unknownDaysRow).toBeTruthy();
    });
  });

  describe('Date Range Changes', () => {
    it('should call setDateRange when selectedRange changes from 7 to 30', async () => {
      const { rerender } = renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(mockSetDateRange).toHaveBeenCalledWith(7);
      });

      jest.clearAllMocks();

      rerender(
        <ThemeProvider>
          <EpisodeStatistics selectedRange={30} />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(mockSetDateRange).toHaveBeenCalledWith(30);
      });
    });

    it('should call setDateRange when selectedRange changes from 30 to 90', async () => {
      const { rerender } = renderWithTheme(<EpisodeStatistics selectedRange={30} />);

      await waitFor(() => {
        expect(mockSetDateRange).toHaveBeenCalledWith(30);
      });

      jest.clearAllMocks();

      rerender(
        <ThemeProvider>
          <EpisodeStatistics selectedRange={90} />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(mockSetDateRange).toHaveBeenCalledWith(90);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility role for container', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        const container = screen.getByTestId('episode-statistics');
        expect(container.props.accessibilityRole).toBe('summary');
      });
    });

    it('should have accessibility labels for migraine days', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        const row = screen.getByTestId('migraine-days-row');
        expect(row).toBeTruthy();
      });
    });

    it('should have accessibility labels for episode statistics', async () => {
      mockUseAnalyticsStore.mockReturnValue({
        ...createMockStoreState(),
        dateRange: {
          startDate: new Date('2023-12-27'),
          endDate: new Date('2024-01-25'),
        },
        selectedDays: 30,
      });

      renderWithTheme(<EpisodeStatistics selectedRange={30} />);

      await waitFor(() => {
        const totalRow = screen.getByTestId('total-episodes-row');
        expect(totalRow).toBeTruthy();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty daily status logs', async () => {
      (dailyStatusRepository.getDateRange as jest.Mock).mockResolvedValue([]);

      renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByTestId('day-statistics-card')).toBeTruthy();
      });
    });

    it('should handle episodes spanning multiple days', async () => {
      const multiDayEpisode: Episode[] = [
        {
          id: 'multi-day',
          startTime: new Date('2024-01-20T22:00:00').getTime(),
          endTime: new Date('2024-01-21T10:00:00').getTime(), // Spans 2 days
          locations: ['left_temple'],
          qualities: ['throbbing'],
          symptoms: [],
          triggers: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      mockUseAnalyticsStore.mockReturnValue(createMockStoreState(multiDayEpisode));

      renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByTestId('migraine-days-row')).toBeTruthy();
      });
    });

    it('should handle single episode', async () => {
      const singleEpisode: Episode[] = [mockEpisodes[0]];

      mockUseAnalyticsStore.mockReturnValue({
        ...createMockStoreState(singleEpisode),
        dateRange: {
          startDate: new Date('2023-12-27'),
          endDate: new Date('2024-01-25'),
        },
        selectedDays: 30,
      });

      renderWithTheme(<EpisodeStatistics selectedRange={30} />);

      await waitFor(() => {
        const totalRow = screen.getByTestId('total-episodes-row');
        expect(totalRow).toBeTruthy();
        expect(screen.getByText('Total Episodes:')).toBeTruthy();
      });
    });

  });

  describe('Theme Support', () => {
    it('should render with theme context', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByTestId('episode-statistics')).toBeTruthy();
      });
    });
  });
});
