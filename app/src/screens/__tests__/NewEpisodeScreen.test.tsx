import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import NewEpisodeScreen from '../NewEpisodeScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import { useEpisodeStore } from '../../store/episodeStore';

jest.mock('../../store/episodeStore');
jest.mock('../../services/locationService', () => ({
  locationService: {
    getCurrentLocation: jest.fn().mockResolvedValue(null),
    checkPermission: jest.fn().mockResolvedValue(false),
  },
}));
jest.mock('@react-native-community/slider', () => {
  const { View } = require('react-native');
  return function Slider(props: any) {
    return <View testID="intensity-slider" {...props} />;
  };
});

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

describe('NewEpisodeScreen', () => {
  const mockStartEpisode = jest.fn();
  const mockAddIntensityReading = jest.fn();
  const mockUpdateEpisode = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
      startEpisode: mockStartEpisode,
      addIntensityReading: mockAddIntensityReading,
      updateEpisode: mockUpdateEpisode,
    });

    mockStartEpisode.mockResolvedValue({ id: 'new-episode-123' });
    mockAddIntensityReading.mockResolvedValue({ id: 'reading-123' });
  });

  it('should render new episode screen with title', async () => {
    const mockRoute = { params: {} };
    
    renderWithProviders(
      <NewEpisodeScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      const startEpisodeElements = screen.getAllByText('Start Episode');
      expect(startEpisodeElements.length).toBeGreaterThan(0);
    });
  });

  it('should display Cancel button', async () => {
    const mockRoute = { params: {} };
    
    renderWithProviders(
      <NewEpisodeScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeTruthy();
    });
  });

  it('should display Start Episode button', async () => {
    const mockRoute = { params: {} };
    
    renderWithProviders(
      <NewEpisodeScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('save-episode-button')).toBeTruthy();
    });
  });

  it('should display pain intensity section', async () => {
    const mockRoute = { params: {} };
    
    renderWithProviders(
      <NewEpisodeScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Initial Pain Intensity')).toBeTruthy();
      expect(screen.getByTestId('intensity-slider')).toBeTruthy();
    });
  });

  it('should display pain location section', async () => {
    const mockRoute = { params: {} };
    
    renderWithProviders(
      <NewEpisodeScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Pain Location')).toBeTruthy();
    });
  });

  it('should display start time section', async () => {
    const mockRoute = { params: {} };
    
    renderWithProviders(
      <NewEpisodeScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Start Time')).toBeTruthy();
    });
  });

  it('should display symptoms section', async () => {
    const mockRoute = { params: {} };
    
    renderWithProviders(
      <NewEpisodeScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Symptoms')).toBeTruthy();
      expect(screen.getByText('Nausea')).toBeTruthy();
    });
  });

  it('should display triggers section', async () => {
    const mockRoute = { params: {} };
    
    renderWithProviders(
      <NewEpisodeScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Possible Triggers')).toBeTruthy();
      expect(screen.getByText('Stress')).toBeTruthy();
    });
  });

  it('should display notes section', async () => {
    const mockRoute = { params: {} };
    
    renderWithProviders(
      <NewEpisodeScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Notes')).toBeTruthy();
      expect(screen.getByPlaceholderText('Any additional details...')).toBeTruthy();
    });
  });

  it('should show Edit Episode title when editing', async () => {
    const mockRoute = { 
      params: { episodeId: 'episode-123' } 
    };
    
    (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
      startEpisode: mockStartEpisode,
      addIntensityReading: mockAddIntensityReading,
      updateEpisode: mockUpdateEpisode,
      episodes: [],
    });

    renderWithProviders(
      <NewEpisodeScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Edit Episode')).toBeTruthy();
    });
  });
});
