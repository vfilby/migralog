import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import EpisodesScreen from '../episode/EpisodesScreen';
import { ThemeProvider } from '../../theme/ThemeContext';

jest.mock('../../store/episodeStore', () => ({
  useEpisodeStore: jest.fn(() => ({
    episodes: [],
    loading: false,
    error: null,
    loadEpisodes: jest.fn(),
  })),
}));

jest.mock('../../components/shared/EpisodeCard', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MockEpisodeCard({ episode, onPress }: any) {
    return (
      <TouchableOpacity testID={`episode-card-${episode.id}`} onPress={onPress}>
        <View>
          <Text>Episode {episode.id}</Text>
        </View>
      </TouchableOpacity>
    );
  };
});

const mockNavigate = jest.fn();
const mockAddListener = jest.fn(() => jest.fn());

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    addListener: mockAddListener,
  }),
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    {children}
  </ThemeProvider>
);

describe('EpisodesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing', async () => {
      const { getByTestId } = render(<EpisodesScreen />, { wrapper: TestWrapper });
      await waitFor(() => {
        expect(getByTestId('episodes-screen')).toBeTruthy();
      });
    });

    it('displays correct header title', async () => {
      const { getByText } = render(<EpisodesScreen />, { wrapper: TestWrapper });
      await waitFor(() => {
        expect(getByText('Episodes')).toBeTruthy();
      });
    });

    it('shows loading state', async () => {
      const { useEpisodeStore } = require('../../store/episodeStore');
      useEpisodeStore.mockReturnValue({
        episodes: [],
        loading: true,
        error: null,
        loadEpisodes: jest.fn(),
      });

      const { getByText } = render(<EpisodesScreen />, { wrapper: TestWrapper });
      await waitFor(() => {
        expect(getByText('Loading...')).toBeTruthy();
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

      const { getByText } = render(<EpisodesScreen />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(getByText('No episodes recorded yet')).toBeTruthy();
        expect(getByText('Start tracking your pain episodes from the Home tab')).toBeTruthy();
      });
    });

    it('renders episode list when episodes exist', async () => {
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
          notes: 'Test episode 1',
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

      const { queryByText, getByTestId } = render(<EpisodesScreen />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(queryByText('No episodes recorded yet')).toBeNull();
        expect(getByTestId('episode-card-episode-1')).toBeTruthy();
      });
    });
  });

  describe('User Interactions', () => {
    it('calls loadEpisodes when screen focuses', async () => {
      const { getByTestId } = render(<EpisodesScreen />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(getByTestId('episodes-screen')).toBeTruthy();
      });
      
      expect(mockAddListener).toHaveBeenCalledWith('focus', expect.any(Function));
    });
  });

  describe('Accessibility', () => {
    it('has proper testID for the screen', async () => {
      const { getByTestId } = render(<EpisodesScreen />, { wrapper: TestWrapper });
      await waitFor(() => {
        expect(getByTestId('episodes-screen')).toBeTruthy();
      });
    });

    it('provides accessible content for empty state', async () => {
      const { useEpisodeStore } = require('../../store/episodeStore');
      useEpisodeStore.mockReturnValue({
        episodes: [],
        loading: false,
        error: null,
        loadEpisodes: jest.fn(),
      });

      const { getByText } = render(<EpisodesScreen />, { wrapper: TestWrapper });
      
      await waitFor(() => {
        expect(getByText('No episodes recorded yet')).toBeTruthy();
        expect(getByText('Start tracking your pain episodes from the Home tab')).toBeTruthy();
      });
    });

    it('provides accessible content for loading state', async () => {
      const { useEpisodeStore } = require('../../store/episodeStore');
      useEpisodeStore.mockReturnValue({
        episodes: [],
        loading: true,
        error: null,
        loadEpisodes: jest.fn(),
      });

      const { getByText } = render(<EpisodesScreen />, { wrapper: TestWrapper });
      await waitFor(() => {
        expect(getByText('Loading...')).toBeTruthy();
      });
    });
  });

  describe('Theme Support', () => {
    it('renders correctly with theme integration', async () => {
      const { getByTestId } = render(<EpisodesScreen />, { wrapper: TestWrapper });
      await waitFor(() => {
        expect(getByTestId('episodes-screen')).toBeTruthy();
      });
    });
  });
});
