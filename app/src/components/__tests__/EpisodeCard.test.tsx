import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import EpisodeCard from '../EpisodeCard';
import { Episode } from '../../models/types';
import { locationService } from '../../services/locationService';
import { ThemeProvider } from '../../theme/ThemeContext';

jest.mock('../../services/locationService', () => ({
  locationService: {
    reverseGeocode: jest.fn(),
  },
}));

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('EpisodeCard', () => {
  const mockOnPress = jest.fn();
  const baseEpisode: Episode = {
    id: 'episode-1',
    startTime: new Date('2024-01-15T10:30:00').getTime(),
    endTime: new Date('2024-01-15T14:30:00').getTime(),
    peakIntensity: 7,
    averageIntensity: 5,
    locations: ['left_temple', 'left_eye'],
    qualities: ['throbbing'],
    symptoms: ['nausea', 'light_sensitivity'],
    triggers: ['stress'],
    notes: 'Started after stressful meeting',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (locationService.reverseGeocode as jest.Mock).mockResolvedValue(null);
  });

  describe('Full Card Mode', () => {
    it('should render episode date in condensed format', async () => {
      renderWithTheme(<EpisodeCard episode={baseEpisode} />);

      await waitFor(() => {
        expect(screen.getByText(/Mon, Jan 15/)).toBeTruthy();
      });
    });

    it('should display duration for completed episodes without label', async () => {
      renderWithTheme(<EpisodeCard episode={baseEpisode} />);

      await waitFor(() => {
        expect(screen.getByText('4 hours')).toBeTruthy();
      });
    });

    it('should display duration as singular hour', async () => {
      const episode = {
        ...baseEpisode,
        endTime: baseEpisode.startTime + 3600000,
      };

      renderWithTheme(<EpisodeCard episode={episode} />);

      await waitFor(() => {
        expect(screen.getByText('1 hour')).toBeTruthy();
      });
    });

    it('should display peak intensity with Peak label and level', async () => {
      renderWithTheme(<EpisodeCard episode={baseEpisode} />);

      await waitFor(() => {
        expect(screen.getByText('Peak: 7/10 Severe')).toBeTruthy();
      });
    });

    it('should display pain areas count without label', async () => {
      renderWithTheme(<EpisodeCard episode={baseEpisode} />);

      await waitFor(() => {
        expect(screen.getByText('2 areas')).toBeTruthy();
      });
    });

    it('should display symptoms count without label', async () => {
      renderWithTheme(<EpisodeCard episode={baseEpisode} />);

      await waitFor(() => {
        expect(screen.getByText('2 symptoms')).toBeTruthy();
      });
    });

    it('should display notes', async () => {
      renderWithTheme(<EpisodeCard episode={baseEpisode} />);

      await waitFor(() => {
        expect(screen.getByText('Started after stressful meeting')).toBeTruthy();
      });
    });

    it('should show elapsed time with (ongoing) suffix when no end time', async () => {
      const ongoingEpisode = { ...baseEpisode, endTime: undefined };

      renderWithTheme(<EpisodeCard episode={ongoingEpisode} />);

      await waitFor(() => {
        // Should show elapsed time with "(ongoing)" suffix
        expect(screen.getByText(/(ongoing)/)).toBeTruthy();
      });
    });

    it('should call onPress when pressed', async () => {
      renderWithTheme(<EpisodeCard episode={baseEpisode} onPress={mockOnPress} testID="card" />);

      await waitFor(() => {
        expect(screen.getByTestId('card')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('card'));
      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it('should be disabled when no onPress', async () => {
      renderWithTheme(<EpisodeCard episode={baseEpisode} testID="card" />);

      await waitFor(() => {
        const card = screen.getByTestId('card');
        expect(card.props.accessibilityState?.disabled || card.props.disabled).toBeTruthy();
      });
    });

    it('should display geocoded location on the right', async () => {
      const episodeWithLocation = {
        ...baseEpisode,
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          timestamp: Date.now(),
        },
      };

      (locationService.reverseGeocode as jest.Mock).mockResolvedValue('San Francisco, CA');

      renderWithTheme(<EpisodeCard episode={episodeWithLocation} />);

      await waitFor(() => {
        expect(screen.getByText('San Francisco, CA')).toBeTruthy();
      });
    });

    it('should handle geocoding failure', async () => {
      const episodeWithLocation = {
        ...baseEpisode,
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          timestamp: Date.now(),
        },
      };

      (locationService.reverseGeocode as jest.Mock).mockRejectedValue(new Error('Failed'));

      renderWithTheme(<EpisodeCard episode={episodeWithLocation} />);

      await waitFor(() => {
        expect(locationService.reverseGeocode).toHaveBeenCalled();
      });

      // Location text should not be shown if geocoding fails
      expect(screen.queryByText('San Francisco, CA')).toBeNull();
    });

    it('should not display optional fields when absent', async () => {
      const minimalEpisode: Episode = {
        id: 'episode-2',
        startTime: new Date('2024-01-15T10:30:00').getTime(),
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      renderWithTheme(<EpisodeCard episode={minimalEpisode} />);

      await waitFor(() => {
        expect(screen.getByText(/Mon, Jan 15/)).toBeTruthy();
      });

      expect(screen.queryByText(/\/10/)).toBeNull(); // No peak intensity
      expect(screen.queryByText(/areas?/)).toBeNull(); // No pain areas
      expect(screen.queryByText(/symptoms?/)).toBeNull(); // No symptoms
    });
  });

  describe('Compact Mode', () => {
    it('should render date in compact format', async () => {
      renderWithTheme(<EpisodeCard episode={baseEpisode} compact />);

      await waitFor(() => {
        expect(screen.getByText('Jan 15, 10:30 AM')).toBeTruthy();
      });
    });

    it('should display duration without label', async () => {
      renderWithTheme(<EpisodeCard episode={baseEpisode} compact />);

      await waitFor(() => {
        expect(screen.getByText('4 hours')).toBeTruthy();
      });
    });

    it('should show elapsed time with (ongoing) suffix', async () => {
      const ongoingEpisode = { ...baseEpisode, endTime: undefined };

      renderWithTheme(<EpisodeCard episode={ongoingEpisode} compact />);

      await waitFor(() => {
        expect(screen.getByText(/(ongoing)/)).toBeTruthy();
      });
    });

    it('should display peak intensity without Peak label', async () => {
      renderWithTheme(<EpisodeCard episode={baseEpisode} compact />);

      await waitFor(() => {
        expect(screen.getByText(/7\/10/)).toBeTruthy();
      });
    });

    it('should display geocoded location on the right', async () => {
      const episodeWithLocation = {
        ...baseEpisode,
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          timestamp: Date.now(),
        },
      };

      (locationService.reverseGeocode as jest.Mock).mockResolvedValue('San Francisco, CA');

      renderWithTheme(<EpisodeCard episode={episodeWithLocation} compact />);

      await waitFor(() => {
        expect(screen.getByText('San Francisco, CA')).toBeTruthy();
      });
    });

    it('should remove bottom border when isLast', async () => {
      renderWithTheme(<EpisodeCard episode={baseEpisode} compact isLast testID="last-card" />);

      await waitFor(() => {
        const card = screen.getByTestId('last-card');
        const styles = Array.isArray(card.props.style) ? card.props.style : [card.props.style];
        const hasBorderRemoved = styles.some((style: any) => style?.borderBottomWidth === 0);
        expect(hasBorderRemoved).toBe(true);
      });
    });

    it('should call onPress when pressed', async () => {
      renderWithTheme(<EpisodeCard episode={baseEpisode} compact onPress={mockOnPress} testID="card" />);

      await waitFor(() => {
        expect(screen.getByTestId('card')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('card'));
      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it('should have correct accessibility label', async () => {
      renderWithTheme(<EpisodeCard episode={baseEpisode} compact testID="card" />);

      await waitFor(() => {
        const card = screen.getByTestId('card');
        expect(card.props.accessibilityLabel).toContain('Jan 15, 2024');
      });
    });

    it('should not display peak when absent', async () => {
      const episodeNoPeak = { ...baseEpisode, peakIntensity: undefined };

      renderWithTheme(<EpisodeCard episode={episodeNoPeak} compact />);

      await waitFor(() => {
        expect(screen.getByText('Jan 15, 10:30 AM')).toBeTruthy();
      });

      expect(screen.queryByText(/\/10/)).toBeNull();
    });
  });

  describe('Theme Support', () => {
    it('should render with theme context', async () => {
      renderWithTheme(<EpisodeCard episode={baseEpisode} testID="themed-card" />);

      await waitFor(() => {
        expect(screen.getByTestId('themed-card')).toBeTruthy();
      });
    });
  });
});
