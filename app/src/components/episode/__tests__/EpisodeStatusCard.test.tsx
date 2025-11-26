import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { EpisodeStatusCard } from '../EpisodeStatusCard';
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

describe('EpisodeStatusCard', () => {
  const mockOnOpenMap = jest.fn();
  const mockOnNavigateToLogUpdate = jest.fn();
  const mockOnNavigateToLogMedication = jest.fn();

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

  it('should render episode date', () => {
    renderWithTheme(
      <EpisodeStatusCard
        episode={baseEpisode}
        duration={240}
        locationAddress={null}
        onOpenMap={mockOnOpenMap}
        onNavigateToLogUpdate={mockOnNavigateToLogUpdate}
        onNavigateToLogMedication={mockOnNavigateToLogMedication}
      />
    );

    expect(screen.getByText('Monday, Jan 15, 2024')).toBeTruthy();
  });

  it('should render duration', () => {
    renderWithTheme(
      <EpisodeStatusCard
        episode={baseEpisode}
        duration={240}
        locationAddress={null}
        onOpenMap={mockOnOpenMap}
        onNavigateToLogUpdate={mockOnNavigateToLogUpdate}
        onNavigateToLogMedication={mockOnNavigateToLogMedication}
      />
    );

    expect(screen.getByText('4h 0m')).toBeTruthy();
  });

  it('should render location link when location exists', () => {
    renderWithTheme(
      <EpisodeStatusCard
        episode={{
          ...baseEpisode,
          location: {
            latitude: 37.7749,
            longitude: -122.4194,
            timestamp: Date.now(),
          },
        }}
        duration={240}
        locationAddress="San Francisco, CA"
        onOpenMap={mockOnOpenMap}
        onNavigateToLogUpdate={mockOnNavigateToLogUpdate}
        onNavigateToLogMedication={mockOnNavigateToLogMedication}
      />
    );

    expect(screen.getByText('San Francisco, CA →')).toBeTruthy();
  });

  it('should render "View on Map" when no location address', () => {
    renderWithTheme(
      <EpisodeStatusCard
        episode={{
          ...baseEpisode,
          location: {
            latitude: 37.7749,
            longitude: -122.4194,
            timestamp: Date.now(),
          },
        }}
        duration={240}
        locationAddress={null}
        onOpenMap={mockOnOpenMap}
        onNavigateToLogUpdate={mockOnNavigateToLogUpdate}
        onNavigateToLogMedication={mockOnNavigateToLogMedication}
      />
    );

    expect(screen.getByText('View on Map →')).toBeTruthy();
  });

  it('should not render location when no location data', () => {
    renderWithTheme(
      <EpisodeStatusCard
        episode={baseEpisode}
        duration={240}
        locationAddress={null}
        onOpenMap={mockOnOpenMap}
        onNavigateToLogUpdate={mockOnNavigateToLogUpdate}
        onNavigateToLogMedication={mockOnNavigateToLogMedication}
      />
    );

    expect(screen.queryByText('Location:')).toBeNull();
  });

  it('should render Ongoing badge for active episodes', () => {
    renderWithTheme(
      <EpisodeStatusCard
        episode={{ ...baseEpisode, endTime: undefined }}
        duration={240}
        locationAddress={null}
        onOpenMap={mockOnOpenMap}
        onNavigateToLogUpdate={mockOnNavigateToLogUpdate}
        onNavigateToLogMedication={mockOnNavigateToLogMedication}
      />
    );

    expect(screen.getByText('Ongoing')).toBeTruthy();
  });

  it('should not render Ongoing badge for completed episodes', () => {
    renderWithTheme(
      <EpisodeStatusCard
        episode={baseEpisode}
        duration={240}
        locationAddress={null}
        onOpenMap={mockOnOpenMap}
        onNavigateToLogUpdate={mockOnNavigateToLogUpdate}
        onNavigateToLogMedication={mockOnNavigateToLogMedication}
      />
    );

    expect(screen.queryByText('Ongoing')).toBeNull();
  });

  it('should render action buttons for active episodes', () => {
    renderWithTheme(
      <EpisodeStatusCard
        episode={{ ...baseEpisode, endTime: undefined }}
        duration={240}
        locationAddress={null}
        onOpenMap={mockOnOpenMap}
        onNavigateToLogUpdate={mockOnNavigateToLogUpdate}
        onNavigateToLogMedication={mockOnNavigateToLogMedication}
      />
    );

    expect(screen.getByText('Log Update')).toBeTruthy();
    expect(screen.getByText('Log Medication')).toBeTruthy();
  });

  it('should not render action buttons for completed episodes', () => {
    renderWithTheme(
      <EpisodeStatusCard
        episode={baseEpisode}
        duration={240}
        locationAddress={null}
        onOpenMap={mockOnOpenMap}
        onNavigateToLogUpdate={mockOnNavigateToLogUpdate}
        onNavigateToLogMedication={mockOnNavigateToLogMedication}
      />
    );

    expect(screen.queryByText('Log Update')).toBeNull();
    expect(screen.queryByText('Log Medication')).toBeNull();
  });

  it('should call onOpenMap when location is pressed', () => {
    renderWithTheme(
      <EpisodeStatusCard
        episode={{
          ...baseEpisode,
          location: {
            latitude: 37.7749,
            longitude: -122.4194,
            timestamp: Date.now(),
          },
        }}
        duration={240}
        locationAddress="San Francisco, CA"
        onOpenMap={mockOnOpenMap}
        onNavigateToLogUpdate={mockOnNavigateToLogUpdate}
        onNavigateToLogMedication={mockOnNavigateToLogMedication}
      />
    );

    fireEvent.press(screen.getByText('San Francisco, CA →'));
    expect(mockOnOpenMap).toHaveBeenCalled();
  });

  it('should call onNavigateToLogUpdate when Log Update is pressed', () => {
    renderWithTheme(
      <EpisodeStatusCard
        episode={{ ...baseEpisode, endTime: undefined }}
        duration={240}
        locationAddress={null}
        onOpenMap={mockOnOpenMap}
        onNavigateToLogUpdate={mockOnNavigateToLogUpdate}
        onNavigateToLogMedication={mockOnNavigateToLogMedication}
      />
    );

    fireEvent.press(screen.getByText('Log Update'));
    expect(mockOnNavigateToLogUpdate).toHaveBeenCalled();
  });

  it('should call onNavigateToLogMedication when Log Medication is pressed', () => {
    renderWithTheme(
      <EpisodeStatusCard
        episode={{ ...baseEpisode, endTime: undefined }}
        duration={240}
        locationAddress={null}
        onOpenMap={mockOnOpenMap}
        onNavigateToLogUpdate={mockOnNavigateToLogUpdate}
        onNavigateToLogMedication={mockOnNavigateToLogMedication}
      />
    );

    fireEvent.press(screen.getByText('Log Medication'));
    expect(mockOnNavigateToLogMedication).toHaveBeenCalled();
  });
});