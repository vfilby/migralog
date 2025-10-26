import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import AnalyticsScreen from '../AnalyticsScreen';
import { ThemeProvider } from '../../theme/ThemeContext';

jest.mock('../../store/episodeStore', () => ({
  useEpisodeStore: jest.fn(() => ({
    episodes: [],
    loading: false,
    error: null,
    loadEpisodes: jest.fn(),
  })),
}));

jest.mock('../../components/MonthlyCalendarView', () => {
  const { View, Text } = require('react-native');
  return function MockMonthlyCalendarView() {
    return (
      <View testID="monthly-calendar-view">
        <Text>Monthly Calendar</Text>
      </View>
    );
  };
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    {children}
  </ThemeProvider>
);

describe('AnalyticsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing', async () => {
      const { getByTestId } = render(<AnalyticsScreen />, { wrapper: TestWrapper });
      await waitFor(() => {
        expect(getByTestId('analytics-screen')).toBeTruthy();
      });
    });

    it('displays correct header title', async () => {
      const { getByText } = render(<AnalyticsScreen />, { wrapper: TestWrapper });
      await waitFor(() => {
        expect(getByText('Trends & Analytics')).toBeTruthy();
      });
    });

    it('shows empty state when no episodes exist', async () => {
      const { useEpisodeStore } = require('../../store/episodeStore');
      useEpisodeStore.mockReturnValue({
        episodes: [],
        loading: false,
        error: null,
        loadEpisodes: jest.fn(),
      });

      const { getByText } = render(<AnalyticsScreen />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(getByText('No data yet')).toBeTruthy();
        expect(getByText('Start tracking episodes to see insights')).toBeTruthy();
      });
    });

    it('displays statistics sections', async () => {
      const { getByText } = render(<AnalyticsScreen />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(getByText('This Month')).toBeTruthy();
        expect(getByText('Overall Statistics')).toBeTruthy();
        expect(getByText('Coming Soon')).toBeTruthy();
      });
    });

    it('displays coming soon features', async () => {
      const { getByText } = render(<AnalyticsScreen />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(getByText('• Pattern recognition')).toBeTruthy();
        expect(getByText('• Trigger analysis')).toBeTruthy();
        expect(getByText('• Medication effectiveness')).toBeTruthy();
        expect(getByText('• Exportable reports')).toBeTruthy();
      });
    });

    it('renders monthly calendar component', async () => {
      const { getByTestId } = render(<AnalyticsScreen />, { wrapper: TestWrapper });
      await waitFor(() => {
        expect(getByTestId('monthly-calendar-view')).toBeTruthy();
      });
    });
  });

  describe('Statistics Display', () => {
    it('shows zero stats when no episodes exist', async () => {
      const { useEpisodeStore } = require('../../store/episodeStore');
      useEpisodeStore.mockReturnValue({
        episodes: [],
        loading: false,
        error: null,
        loadEpisodes: jest.fn(),
      });

      const { getAllByText } = render(<AnalyticsScreen />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        const zeros = getAllByText('0');
        expect(zeros.length).toBeGreaterThan(0);
      });
    });

    it('calculates and displays stats when episodes exist', async () => {
      const { useEpisodeStore } = require('../../store/episodeStore');
      const mockEpisodes = [
        {
          id: 'episode-1',
          startTime: Date.now() - 24 * 60 * 60 * 1000,
          endTime: Date.now() - 20 * 60 * 60 * 1000,
          locations: ['front'],
          qualities: ['throbbing'],
          symptoms: ['nausea'],
          triggers: ['stress'],
          notes: 'Test episode',
          createdAt: Date.now() - 24 * 60 * 60 * 1000,
          updatedAt: Date.now() - 20 * 60 * 60 * 1000,
        },
      ];

      useEpisodeStore.mockReturnValue({
        episodes: mockEpisodes,
        loading: false,
        error: null,
        loadEpisodes: jest.fn(),
      });

      const { getAllByText } = render(<AnalyticsScreen />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        const ones = getAllByText('1');
        expect(ones.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper testID for the screen', async () => {
      const { getByTestId } = render(<AnalyticsScreen />, { wrapper: TestWrapper });
      await waitFor(() => {
        expect(getByTestId('analytics-screen')).toBeTruthy();
      });
    });

    it('provides accessible labels for stats', async () => {
      const { getByText } = render(<AnalyticsScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(getByText('Episodes')).toBeTruthy();
        expect(getByText('Total Episodes')).toBeTruthy();
        expect(getByText('Avg Duration')).toBeTruthy();
      });
    });
  });

  describe('Theme Support', () => {
    it('renders correctly with theme integration', async () => {
      const { getByTestId } = render(<AnalyticsScreen />, { wrapper: TestWrapper });
      await waitFor(() => {
        expect(getByTestId('analytics-screen')).toBeTruthy();
      });
    });
  });
});
