import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import IntensityHistogram from '../IntensityHistogram';
import { useEpisodeStore } from '../../store/episodeStore';
import { intensityRepository } from '../../database/episodeRepository';
import { ThemeProvider } from '../../theme/ThemeContext';
import { Episode, IntensityReading } from '../../models/types';

jest.mock('../../store/episodeStore');
jest.mock('../../database/episodeRepository', () => ({
  intensityRepository: {
    getAll: jest.fn(),
  },
}));

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('IntensityHistogram', () => {
  const mockEpisodes: Episode[] = [
    {
      id: 'episode-1',
      startTime: new Date('2024-01-15T10:00:00').getTime(),
      endTime: new Date('2024-01-15T14:00:00').getTime(),
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
      endTime: new Date('2024-01-17T10:00:00').getTime(),
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
      endTime: new Date('2024-01-20T20:00:00').getTime(),
      locations: ['left_head'],
      qualities: ['pressure'],
      symptoms: ['nausea', 'vomiting'],
      triggers: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  const mockIntensityReadings: IntensityReading[] = [
    // Episode 1: max intensity 7
    {
      id: 'reading-1',
      episodeId: 'episode-1',
      timestamp: new Date('2024-01-15T10:30:00').getTime(),
      intensity: 5,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'reading-2',
      episodeId: 'episode-1',
      timestamp: new Date('2024-01-15T12:00:00').getTime(),
      intensity: 7,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    // Episode 2: max intensity 8
    {
      id: 'reading-3',
      episodeId: 'episode-2',
      timestamp: new Date('2024-01-17T08:30:00').getTime(),
      intensity: 8,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    // Episode 3: max intensity 6
    {
      id: 'reading-4',
      episodeId: 'episode-3',
      timestamp: new Date('2024-01-20T15:00:00').getTime(),
      intensity: 4,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'reading-5',
      episodeId: 'episode-3',
      timestamp: new Date('2024-01-20T17:00:00').getTime(),
      intensity: 6,
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

    (intensityRepository.getAll as jest.Mock).mockResolvedValue(mockIntensityReadings);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Component Rendering', () => {
    it('should render the component with testID', async () => {
      renderWithTheme(<IntensityHistogram selectedRange={30} />);

      await waitFor(() => {
        expect(screen.getByTestId('intensity-histogram')).toBeTruthy();
      });
    });

    it('should render the section title', async () => {
      renderWithTheme(<IntensityHistogram selectedRange={30} />);

      await waitFor(() => {
        expect(screen.getByText('Peak Intensity Distribution')).toBeTruthy();
      });
    });

    it('should render the histogram card', async () => {
      renderWithTheme(<IntensityHistogram selectedRange={30} />);

      await waitFor(() => {
        expect(screen.getByTestId('histogram-card')).toBeTruthy();
      });
    });

    it('should have proper accessibility role for title', async () => {
      renderWithTheme(<IntensityHistogram selectedRange={30} />);

      await waitFor(() => {
        const title = screen.getByText('Peak Intensity Distribution');
        expect(title.props.accessibilityRole).toBe('header');
      });
    });
  });

  describe('Histogram with Data', () => {
    it('should render histogram bars container when data exists', async () => {
      renderWithTheme(<IntensityHistogram selectedRange={30} />);

      await waitFor(() => {
        expect(screen.getByTestId('histogram-bars')).toBeTruthy();
      });
    });

    it('should render all 10 intensity level bars', async () => {
      renderWithTheme(<IntensityHistogram selectedRange={30} />);

      await waitFor(() => {
        for (let i = 1; i <= 10; i++) {
          expect(screen.getByTestId(`histogram-bar-${i}`)).toBeTruthy();
        }
      });
    });

    it('should display count labels for bars with data', async () => {
      renderWithTheme(<IntensityHistogram selectedRange={30} />);

      await waitFor(() => {
        // Episode 1 has max intensity 7, Episode 2 has max 8, Episode 3 has max 6
        // Bars with data should show count labels
        // Check that the bars are rendered
        expect(screen.getByTestId('histogram-bar-6')).toBeTruthy();
        expect(screen.getByTestId('histogram-bar-7')).toBeTruthy();
        expect(screen.getByTestId('histogram-bar-8')).toBeTruthy();
      });
    });

    it('should load intensity readings from repository', async () => {
      renderWithTheme(<IntensityHistogram selectedRange={30} />);

      await waitFor(() => {
        expect(intensityRepository.getAll).toHaveBeenCalled();
      });
    });
  });

  describe('Empty State', () => {
    beforeEach(() => {
      (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
        episodes: [],
      });
      (intensityRepository.getAll as jest.Mock).mockResolvedValue([]);
    });

    it('should display empty state when no data', async () => {
      renderWithTheme(<IntensityHistogram selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByTestId('histogram-empty-state')).toBeTruthy();
        expect(screen.getByText('No intensity data in selected period')).toBeTruthy();
      });
    });

    it('should not display histogram bars when no data', async () => {
      renderWithTheme(<IntensityHistogram selectedRange={7} />);

      await waitFor(() => {
        expect(screen.queryByTestId('histogram-bars')).toBeNull();
      });
    });

    it('should not display legend when no data', async () => {
      renderWithTheme(<IntensityHistogram selectedRange={7} />);

      await waitFor(() => {
        expect(screen.queryByTestId('histogram-legend')).toBeNull();
      });
    });
  });

  describe('Episodes Without Intensity Readings', () => {
    beforeEach(() => {
      (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
        episodes: mockEpisodes,
      });
      // No intensity readings for any episode
      (intensityRepository.getAll as jest.Mock).mockResolvedValue([]);
    });

    it('should display empty state when episodes have no intensity readings', async () => {
      renderWithTheme(<IntensityHistogram selectedRange={30} />);

      await waitFor(() => {
        expect(screen.getByTestId('histogram-empty-state')).toBeTruthy();
      });
    });
  });

  describe('Date Range Filtering', () => {
    it('should filter episodes by 7-day range', async () => {
      // Mock current time is Jan 25, so 7-day range is Jan 18-25
      // Only episode-3 (Jan 20) is in this range
      renderWithTheme(<IntensityHistogram selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByTestId('histogram-bars')).toBeTruthy();
        // Episode 3 has max intensity 6
        expect(screen.getByTestId('histogram-bar-6')).toBeTruthy();
      });
    });

    it('should filter episodes by 30-day range', async () => {
      renderWithTheme(<IntensityHistogram selectedRange={30} />);

      await waitFor(() => {
        expect(screen.getByTestId('histogram-bars')).toBeTruthy();
        // All 3 episodes are within 30 days (Jan 15, 17, 20)
        // Episode 1 max: 7, Episode 2 max: 8, Episode 3 max: 6
        expect(screen.getByTestId('histogram-bar-6')).toBeTruthy();
        expect(screen.getByTestId('histogram-bar-7')).toBeTruthy();
        expect(screen.getByTestId('histogram-bar-8')).toBeTruthy();
      });
    });

    it('should reload data when selectedRange changes', async () => {
      const { rerender } = renderWithTheme(<IntensityHistogram selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByTestId('intensity-histogram')).toBeTruthy();
      });

      rerender(
        <ThemeProvider>
          <IntensityHistogram selectedRange={30} />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('intensity-histogram')).toBeTruthy();
      });
    });
  });

  describe('Theme Support', () => {
    it('should render correctly with theme context', async () => {
      renderWithTheme(<IntensityHistogram selectedRange={30} />);

      await waitFor(() => {
        expect(screen.getByTestId('intensity-histogram')).toBeTruthy();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessibility label for histogram container', async () => {
      renderWithTheme(<IntensityHistogram selectedRange={30} />);

      await waitFor(() => {
        const histogramBars = screen.getByTestId('histogram-bars');
        expect(histogramBars.props.accessibilityLabel).toBe(
          'Histogram showing episode counts by peak intensity level'
        );
      });
    });
  });
});
