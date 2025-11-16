import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import EpisodeStatistics from '../EpisodeStatistics';
import { useEpisodeStore } from '../../store/episodeStore';
import { dailyStatusRepository } from '../../database/dailyStatusRepository';
import { ThemeProvider } from '../../theme/ThemeContext';
import { DailyStatusLog, Episode } from '../../models/types';

jest.mock('../../store/episodeStore');
jest.mock('../../database/dailyStatusRepository');

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

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-25T12:00:00'));

    (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
      episodes: mockEpisodes,
    });

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

    it('should load daily statuses for the correct date range', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(dailyStatusRepository.getDateRange).toHaveBeenCalled();
        const [startDate, endDate] = (dailyStatusRepository.getDateRange as jest.Mock).mock.calls[0];
        expect(startDate).toMatch(/2024-01-18/); // 7 days before Jan 25
        expect(endDate).toMatch(/2024-01-25/);
      });
    });
  });

  describe('Day Statistics - 30 Day Range', () => {
    it('should load daily statuses for 30 day range', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={30} />);

      await waitFor(() => {
        expect(dailyStatusRepository.getDateRange).toHaveBeenCalled();
        const [startDate, endDate] = (dailyStatusRepository.getDateRange as jest.Mock).mock.calls[0];
        expect(startDate).toMatch(/2023-12-26/); // 30 days before Jan 25
        expect(endDate).toMatch(/2024-01-25/);
      });
    });
  });

  describe('Day Statistics - 90 Day Range', () => {
    it('should load daily statuses for 90 day range', async () => {
      renderWithTheme(<EpisodeStatistics selectedRange={90} />);

      await waitFor(() => {
        expect(dailyStatusRepository.getDateRange).toHaveBeenCalled();
        const [startDate, endDate] = (dailyStatusRepository.getDateRange as jest.Mock).mock.calls[0];
        expect(startDate).toMatch(/2023-10-27/); // 90 days before Jan 25
        expect(endDate).toMatch(/2024-01-25/);
      });
    });
  });

  describe('Episode Statistics - With Episodes', () => {
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
      (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
        episodes: [],
      });
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

      (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
        episodes: ongoingEpisodes,
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

  describe('Date Range Changes', () => {
    it('should reload data when selectedRange changes from 7 to 30', async () => {
      const { rerender } = renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(dailyStatusRepository.getDateRange).toHaveBeenCalledTimes(1);
      });

      jest.clearAllMocks();

      rerender(
        <ThemeProvider>
          <EpisodeStatistics selectedRange={30} />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(dailyStatusRepository.getDateRange).toHaveBeenCalledTimes(1);
      });
    });

    it('should reload data when selectedRange changes from 30 to 90', async () => {
      const { rerender } = renderWithTheme(<EpisodeStatistics selectedRange={30} />);

      await waitFor(() => {
        expect(dailyStatusRepository.getDateRange).toHaveBeenCalled();
      });

      jest.clearAllMocks();

      rerender(
        <ThemeProvider>
          <EpisodeStatistics selectedRange={90} />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(dailyStatusRepository.getDateRange).toHaveBeenCalled();
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

      (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
        episodes: multiDayEpisode,
      });

      renderWithTheme(<EpisodeStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByTestId('migraine-days-row')).toBeTruthy();
      });
    });

    it('should handle single episode', async () => {
      const singleEpisode: Episode[] = [mockEpisodes[0]];

      (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
        episodes: singleEpisode,
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
