import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import LogUpdateScreen from '../LogUpdateScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';

jest.mock('../../database/episodeRepository', () => ({
  intensityRepository: {
    getByEpisodeId: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'reading-123' }),
  },
  symptomLogRepository: {
    getByEpisodeId: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'symptom-123' }),
    delete: jest.fn().mockResolvedValue(undefined),
  },
  episodeNoteRepository: {
    create: jest.fn().mockResolvedValue({ id: 'note-123' }),
  },
  episodeRepository: {
    update: jest.fn().mockResolvedValue(undefined),
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

describe('LogUpdateScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render log update screen with title', async () => {
    const mockRoute = {
      params: { episodeId: 'episode-123' },
    };

    renderWithProviders(
      <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Log Update')).toBeTruthy();
    });
  });

  it('should display Cancel button', async () => {
    const mockRoute = {
      params: { episodeId: 'episode-123' },
    };

    renderWithProviders(
      <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeTruthy();
    });
  });

  it('should display pain intensity slider', async () => {
    const mockRoute = {
      params: { episodeId: 'episode-123' },
    };

    renderWithProviders(
      <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('intensity-slider')).toBeTruthy();
    });
  });

  it('should display symptoms section', async () => {
    const mockRoute = {
      params: { episodeId: 'episode-123' },
    };

    renderWithProviders(
      <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Nausea')).toBeTruthy();
      expect(screen.getByText('Vomiting')).toBeTruthy();
    });
  });

  it('should display notes input', async () => {
    const mockRoute = {
      params: { episodeId: 'episode-123' },
    };

    renderWithProviders(
      <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add any additional notes...')).toBeTruthy();
    });
  });

  it('should display Save Update button', async () => {
    const mockRoute = {
      params: { episodeId: 'episode-123' },
    };

    renderWithProviders(
      <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Update')).toBeTruthy();
    });
  });

  it('should display all symptom options', async () => {
    const mockRoute = {
      params: { episodeId: 'episode-123' },
    };

    renderWithProviders(
      <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Nausea')).toBeTruthy();
      expect(screen.getByText('Vomiting')).toBeTruthy();
      expect(screen.getByText('Visual Disturbances')).toBeTruthy();
      expect(screen.getByText('Aura')).toBeTruthy();
      expect(screen.getByText('Light Sensitivity')).toBeTruthy();
      expect(screen.getByText('Sound Sensitivity')).toBeTruthy();
    });
  });
});
