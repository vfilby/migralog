import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { EpisodeActions } from '../EpisodeActions';
import { Episode } from '../../../models/types';

// Mock the theme hook to return a fixed theme
jest.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      background: '#FFFFFF',
      backgroundSecondary: '#F5F5F5',
      card: '#FFFFFF',
      text: '#000000',
      textSecondary: '#666666',
      textTertiary: '#999999',
      border: '#E0E0E0',
      borderLight: '#F0F0F0',
      primary: '#007AFF',
      primaryText: '#FFFFFF',
      danger: '#FF3B30',
      dangerText: '#FFFFFF',
      shadow: '#000000',
      ongoing: '#FF9500',
      ongoingText: '#FFFFFF',
    },
  }),
}));

const renderWithTheme = (component: React.ReactElement) => {
  return render(component);
};

describe('EpisodeActions', () => {
  const mockOnEndEpisodeNow = jest.fn();
  const mockOnShowCustomEndTime = jest.fn();

  const baseEpisode: Episode = {
    id: 'episode-1',
    startTime: new Date('2024-01-15T10:30:00').getTime(),
    endTime: new Date('2024-01-15T14:30:00').getTime(),
    locations: ['left_temple'],
    qualities: ['throbbing'],
    symptoms: ['nausea'],
    triggers: ['stress'],
    notes: 'Test notes',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render End Now and End... buttons for active episodes', () => {
    renderWithTheme(
      <EpisodeActions
        episode={{ ...baseEpisode, endTime: undefined }}
        onEndEpisodeNow={mockOnEndEpisodeNow}
        onShowCustomEndTime={mockOnShowCustomEndTime}
      />
    );

    expect(screen.getByText('End Now')).toBeTruthy();
    expect(screen.getByText('End...')).toBeTruthy();
  });

  it('should not render buttons for completed episodes', () => {
    renderWithTheme(
      <EpisodeActions
        episode={baseEpisode}
        onEndEpisodeNow={mockOnEndEpisodeNow}
        onShowCustomEndTime={mockOnShowCustomEndTime}
      />
    );

    expect(screen.queryByText('End Now')).toBeNull();
    expect(screen.queryByText('End...')).toBeNull();
  });

  it('should call onEndEpisodeNow when End Now is pressed', () => {
    renderWithTheme(
      <EpisodeActions
        episode={{ ...baseEpisode, endTime: undefined }}
        onEndEpisodeNow={mockOnEndEpisodeNow}
        onShowCustomEndTime={mockOnShowCustomEndTime}
      />
    );

    fireEvent.press(screen.getByText('End Now'));
    expect(mockOnEndEpisodeNow).toHaveBeenCalled();
  });

  it('should call onShowCustomEndTime when End... is pressed', () => {
    renderWithTheme(
      <EpisodeActions
        episode={{ ...baseEpisode, endTime: undefined }}
        onEndEpisodeNow={mockOnEndEpisodeNow}
        onShowCustomEndTime={mockOnShowCustomEndTime}
      />
    );

    fireEvent.press(screen.getByText('End...'));
    expect(mockOnShowCustomEndTime).toHaveBeenCalled();
  });
});