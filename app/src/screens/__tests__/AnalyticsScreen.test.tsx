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

jest.mock('../../components/TimeRangeSelector', () => {
  const { View, Text } = require('react-native');
  return function MockTimeRangeSelector() {
    return (
      <View testID="time-range-selector">
        <Text>Time Range Selector</Text>
      </View>
    );
  };
});

jest.mock('../../components/EpisodeStatistics', () => {
  const { View, Text } = require('react-native');
  return function MockEpisodeStatistics() {
    return (
      <View testID="episode-statistics">
        <Text>Episode Statistics</Text>
      </View>
    );
  };
});

jest.mock('../../components/IntensityHistogram', () => {
  const { View, Text } = require('react-native');
  return function MockIntensityHistogram() {
    return (
      <View testID="intensity-histogram">
        <Text>Intensity Histogram</Text>
      </View>
    );
  };
});

jest.mock('../../components/MedicationUsageStatistics', () => {
  const { View, Text } = require('react-native');
  return function MockMedicationUsageStatistics() {
    return (
      <View testID="medication-usage-statistics">
        <Text>Medication Usage Statistics</Text>
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

    it('renders time range selector component', async () => {
      const { getByTestId } = render(<AnalyticsScreen />, { wrapper: TestWrapper });
      await waitFor(() => {
        expect(getByTestId('time-range-selector')).toBeTruthy();
      });
    });

    it('renders episode statistics component', async () => {
      const { getByTestId } = render(<AnalyticsScreen />, { wrapper: TestWrapper });
      await waitFor(() => {
        expect(getByTestId('episode-statistics')).toBeTruthy();
      });
    });

    it('renders medication usage statistics component', async () => {
      const { getByTestId } = render(<AnalyticsScreen />, { wrapper: TestWrapper });
      await waitFor(() => {
        expect(getByTestId('medication-usage-statistics')).toBeTruthy();
      });
    });

    it('renders intensity histogram component', async () => {
      const { getByTestId } = render(<AnalyticsScreen />, { wrapper: TestWrapper });
      await waitFor(() => {
        expect(getByTestId('intensity-histogram')).toBeTruthy();
      });
    });

    it('renders monthly calendar component', async () => {
      const { getByTestId } = render(<AnalyticsScreen />, { wrapper: TestWrapper });
      await waitFor(() => {
        expect(getByTestId('monthly-calendar-view')).toBeTruthy();
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
