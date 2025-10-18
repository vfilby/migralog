import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import DashboardScreen from '../DashboardScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import { useEpisodeStore } from '../../store/episodeStore';
import { useMedicationStore } from '../../store/medicationStore';
import { useDailyStatusStore } from '../../store/dailyStatusStore';

jest.mock('../../store/episodeStore');
jest.mock('../../store/medicationStore');
jest.mock('../../store/dailyStatusStore');
jest.mock('../../components/DailyStatusWidget', () => {
  const { View, Text } = require('react-native');
  return function DailyStatusWidget() {
    return <View testID="daily-status-widget"><Text>Daily Status</Text></View>;
  };
});
jest.mock('../../components/EpisodeCard', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return function EpisodeCard({ episode, onPress, testID }: any) {
    return (
      <TouchableOpacity onPress={onPress} testID={testID || `episode-card-${episode.id}`}>
        <Text>Episode: {episode.id}</Text>
      </TouchableOpacity>
    );
  };
});

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
  useFocusEffect: (callback: () => void) => {
    callback();
  },
  useNavigationState: () => ({}),
}));

describe('DashboardScreen', () => {
  const mockLoadCurrentEpisode = jest.fn();
  const mockLoadEpisodes = jest.fn();
  const mockLoadMedications = jest.fn();
  const mockLoadSchedules = jest.fn();
  const mockLoadRecentDoses = jest.fn();
  const mockLogDose = jest.fn();
  const mockDeleteDose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useMedicationStore.getState as jest.Mock) = jest.fn().mockReturnValue({
      preventativeMedications: [],
      rescueMedications: [],
      schedules: [],
      doses: [],
    });

    (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
      currentEpisode: null,
      episodes: [],
      loading: false,
      error: null,
      loadCurrentEpisode: mockLoadCurrentEpisode,
      loadEpisodes: mockLoadEpisodes,
    });

    (useMedicationStore as unknown as jest.Mock).mockReturnValue({
      preventativeMedications: [],
      rescueMedications: [],
      schedules: [],
      doses: [],
      loading: false,
      error: null,
      loadMedications: mockLoadMedications,
      loadSchedules: mockLoadSchedules,
      loadRecentDoses: mockLoadRecentDoses,
      logDose: mockLogDose,
      deleteDose: mockDeleteDose,
    });

    (useDailyStatusStore as unknown as jest.Mock).mockReturnValue({
      logs: [],
      todayStatus: null,
      loading: false,
      error: null,
    });

    mockLoadCurrentEpisode.mockResolvedValue(undefined);
    mockLoadEpisodes.mockResolvedValue(undefined);
    mockLoadMedications.mockResolvedValue(undefined);
    mockLoadSchedules.mockResolvedValue(undefined);
    mockLoadRecentDoses.mockResolvedValue(undefined);
  });

  it('should render dashboard with title', async () => {
    renderWithProviders(<DashboardScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-title')).toBeTruthy();
      expect(screen.getByText('MigraLog')).toBeTruthy();
    });
  });

  it('should render settings button', async () => {
    renderWithProviders(<DashboardScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('settings-button')).toBeTruthy();
    });
  });

  it('should render daily status widget', async () => {
    renderWithProviders(<DashboardScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('daily-status-widget')).toBeTruthy();
    });
  });

  it('should show Start Episode button when no active episode', async () => {
    (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
      currentEpisode: null,
      episodes: [],
      loading: false,
      error: null,
      loadCurrentEpisode: mockLoadCurrentEpisode,
      loadEpisodes: mockLoadEpisodes,
    });

    renderWithProviders(<DashboardScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('start-episode-button')).toBeTruthy();
      expect(screen.getByText('Start Episode')).toBeTruthy();
    });
  });

  it('should not show Start Episode button when episode is active', async () => {
    (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
      currentEpisode: {
        id: 'active-123',
        startTime: Date.now(),
        endTime: null,
        peakIntensity: 5,
        averageIntensity: 4,
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      episodes: [],
      loading: false,
      error: null,
      loadCurrentEpisode: mockLoadCurrentEpisode,
      loadEpisodes: mockLoadEpisodes,
    });

    renderWithProviders(<DashboardScreen />);

    await waitFor(() => {
      expect(screen.queryByTestId('start-episode-button')).toBeNull();
    });
  });

  it('should show Log Medication button when rescue medications exist', async () => {
    (useMedicationStore as unknown as jest.Mock).mockReturnValue({
      preventativeMedications: [],
      rescueMedications: [
        {
          id: 'med-1',
          name: 'Rescue Med',
          type: 'rescue',
          dosageAmount: 100,
          dosageUnit: 'mg',
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      schedules: [],
      doses: [],
      loading: false,
      error: null,
      loadMedications: mockLoadMedications,
      loadSchedules: mockLoadSchedules,
      loadRecentDoses: mockLoadRecentDoses,
      logDose: mockLogDose,
      deleteDose: mockDeleteDose,
    });

    renderWithProviders(<DashboardScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('log-medication-button')).toBeTruthy();
      expect(screen.getByText('Log Medication')).toBeTruthy();
    });
  });

  it('should display active episode card when episode is active', async () => {
    (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
      currentEpisode: {
        id: 'active-123',
        startTime: Date.now(),
        endTime: null,
        peakIntensity: 5,
        averageIntensity: 4,
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      episodes: [],
      loading: false,
      error: null,
      loadCurrentEpisode: mockLoadCurrentEpisode,
      loadEpisodes: mockLoadEpisodes,
    });

    renderWithProviders(<DashboardScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('active-episode-card')).toBeTruthy();
    });
  });

  it('should display Recent Episodes section', async () => {
    renderWithProviders(<DashboardScreen />);

    await waitFor(() => {
      expect(screen.getByText('Recent Episodes')).toBeTruthy();
    });
  });

  it('should show empty state when no closed episodes', async () => {
    (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
      currentEpisode: null,
      episodes: [],
      loading: false,
      error: null,
      loadCurrentEpisode: mockLoadCurrentEpisode,
      loadEpisodes: mockLoadEpisodes,
    });

    renderWithProviders(<DashboardScreen />);

    await waitFor(() => {
      expect(screen.getByText('No closed episodes yet')).toBeTruthy();
    });
  });

  it('should load data on mount', async () => {
    renderWithProviders(<DashboardScreen />);

    await waitFor(() => {
      expect(mockLoadCurrentEpisode).toHaveBeenCalled();
      expect(mockLoadEpisodes).toHaveBeenCalled();
      expect(mockLoadMedications).toHaveBeenCalled();
    });
  });
});
