import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { EpisodeTimeline } from '../EpisodeTimeline';
import { Episode, IntensityReading } from '../../../models/types';

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

describe('EpisodeTimeline', () => {
  const mockOnIntensityLongPress = jest.fn();
  const mockOnNoteLongPress = jest.fn();
  const mockOnMedicationLongPress = jest.fn();
  const mockOnSymptomLongPress = jest.fn();
  const mockOnPainLocationLongPress = jest.fn();
  const mockOnEpisodeEndLongPress = jest.fn();

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

  const baseIntensityReadings: IntensityReading[] = [
    {
      id: 'reading-1',
      episodeId: 'episode-1',
      timestamp: new Date('2024-01-15T11:30:00').getTime(),
      intensity: 7,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  const baseTimeline = [
    {
      date: new Date('2024-01-15T00:00:00').getTime(),
      dateLabel: 'Jan 15, 2024',
      events: [
        {
          id: 'intensity-reading-1',
          type: 'intensity' as const,
          timestamp: new Date('2024-01-15T11:30:00').getTime(),
          data: baseIntensityReadings[0],
        },
      ],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render timeline title', () => {
    renderWithTheme(
      <EpisodeTimeline
        timeline={baseTimeline}
        intensityReadings={baseIntensityReadings}
        episode={baseEpisode}
        sparklineWidth={300}
        onIntensityLongPress={mockOnIntensityLongPress}
        onNoteLongPress={mockOnNoteLongPress}
        onMedicationLongPress={mockOnMedicationLongPress}
        onSymptomLongPress={mockOnSymptomLongPress}
        onPainLocationLongPress={mockOnPainLocationLongPress}
        onEpisodeEndLongPress={mockOnEpisodeEndLongPress}
      />
    );

    expect(screen.getByText('Timeline')).toBeTruthy();
  });

  it('should render sparkline when intensity readings exist', () => {
    renderWithTheme(
      <EpisodeTimeline
        timeline={baseTimeline}
        intensityReadings={baseIntensityReadings}
        episode={baseEpisode}
        sparklineWidth={300}
        onIntensityLongPress={mockOnIntensityLongPress}
        onNoteLongPress={mockOnNoteLongPress}
        onMedicationLongPress={mockOnMedicationLongPress}
        onSymptomLongPress={mockOnSymptomLongPress}
        onPainLocationLongPress={mockOnPainLocationLongPress}
        onEpisodeEndLongPress={mockOnEpisodeEndLongPress}
      />
    );

    // The sparkline is rendered as a View component, so we can't easily test its content
    // But we can verify it's in the tree by checking for the container
    expect(screen.getByTestId('intensity-sparkline-container')).toBeTruthy();
  });

  it('should not render sparkline when no intensity readings', () => {
    renderWithTheme(
      <EpisodeTimeline
        timeline={baseTimeline}
        intensityReadings={[]}
        episode={baseEpisode}
        sparklineWidth={300}
        onIntensityLongPress={mockOnIntensityLongPress}
        onNoteLongPress={mockOnNoteLongPress}
        onMedicationLongPress={mockOnMedicationLongPress}
        onSymptomLongPress={mockOnSymptomLongPress}
        onPainLocationLongPress={mockOnPainLocationLongPress}
        onEpisodeEndLongPress={mockOnEpisodeEndLongPress}
      />
    );

    expect(screen.queryByTestId('intensity-sparkline-container')).toBeNull();
  });

  it('should render timeline events when timeline has data', () => {
    renderWithTheme(
      <EpisodeTimeline
        timeline={baseTimeline}
        intensityReadings={baseIntensityReadings}
        episode={baseEpisode}
        sparklineWidth={300}
        onIntensityLongPress={mockOnIntensityLongPress}
        onNoteLongPress={mockOnNoteLongPress}
        onMedicationLongPress={mockOnMedicationLongPress}
        onSymptomLongPress={mockOnSymptomLongPress}
        onPainLocationLongPress={mockOnPainLocationLongPress}
        onEpisodeEndLongPress={mockOnEpisodeEndLongPress}
      />
    );

    // The TimelineEventRenderer is used to render events, so we can check for
    // elements that would be rendered by it
    expect(screen.getByText('11:30 AM')).toBeTruthy();
  });

  it('should not render when timeline is empty', () => {
    renderWithTheme(
      <EpisodeTimeline
        timeline={[]}
        intensityReadings={[]}
        episode={baseEpisode}
        sparklineWidth={300}
        onIntensityLongPress={mockOnIntensityLongPress}
        onNoteLongPress={mockOnNoteLongPress}
        onMedicationLongPress={mockOnMedicationLongPress}
        onSymptomLongPress={mockOnSymptomLongPress}
        onPainLocationLongPress={mockOnPainLocationLongPress}
        onEpisodeEndLongPress={mockOnEpisodeEndLongPress}
      />
    );

    // When timeline is empty, the component returns null, so nothing should be rendered
    expect(screen.queryByText('Timeline')).toBeNull();
  });

  it('should render date label on two lines for regular dates', () => {
    const timelineWithMultipleDays = [
      {
        date: new Date('2024-01-15T00:00:00').getTime(),
        dateLabel: 'Mon, Jan 15',
        events: [
          {
            id: 'intensity-reading-1',
            type: 'intensity' as const,
            timestamp: new Date('2024-01-15T11:30:00').getTime(),
            data: baseIntensityReadings[0],
          },
        ],
      },
      {
        date: new Date('2024-01-16T00:00:00').getTime(),
        dateLabel: 'Tue, Jan 16',
        events: [
          {
            id: 'intensity-reading-2',
            type: 'intensity' as const,
            timestamp: new Date('2024-01-16T09:00:00').getTime(),
            data: {
              ...baseIntensityReadings[0],
              id: 'reading-2',
              timestamp: new Date('2024-01-16T09:00:00').getTime(),
            },
          },
        ],
      },
    ];

    renderWithTheme(
      <EpisodeTimeline
        timeline={timelineWithMultipleDays}
        intensityReadings={baseIntensityReadings}
        episode={baseEpisode}
        sparklineWidth={300}
        onIntensityLongPress={mockOnIntensityLongPress}
        onNoteLongPress={mockOnNoteLongPress}
        onMedicationLongPress={mockOnMedicationLongPress}
        onSymptomLongPress={mockOnSymptomLongPress}
        onPainLocationLongPress={mockOnPainLocationLongPress}
        onEpisodeEndLongPress={mockOnEpisodeEndLongPress}
      />
    );

    // Should render the day name on first line and month/day on second line
    expect(screen.getByText('Mon')).toBeTruthy();
    expect(screen.getByText('Jan 15')).toBeTruthy();
    expect(screen.getByText('Tue')).toBeTruthy();
    expect(screen.getByText('Jan 16')).toBeTruthy();
  });

  it('should render Today and Yesterday on single line', () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    const timelineWithTodayYesterday = [
      {
        date: yesterday.getTime(),
        dateLabel: 'Sun, Nov 26', // This would be ignored for yesterday
        events: [
          {
            id: 'intensity-reading-yesterday',
            type: 'intensity' as const,
            timestamp: yesterday.getTime(),
            data: baseIntensityReadings[0],
          },
        ],
      },
      {
        date: today.getTime(),
        dateLabel: 'Mon, Nov 27', // This would be ignored for today
        events: [
          {
            id: 'intensity-reading-today',
            type: 'intensity' as const,
            timestamp: today.getTime(),
            data: {
              ...baseIntensityReadings[0],
              id: 'reading-today',
              timestamp: today.getTime(),
            },
          },
        ],
      },
    ];

    renderWithTheme(
      <EpisodeTimeline
        timeline={timelineWithTodayYesterday}
        intensityReadings={baseIntensityReadings}
        episode={baseEpisode}
        sparklineWidth={300}
        onIntensityLongPress={mockOnIntensityLongPress}
        onNoteLongPress={mockOnNoteLongPress}
        onMedicationLongPress={mockOnMedicationLongPress}
        onSymptomLongPress={mockOnSymptomLongPress}
        onPainLocationLongPress={mockOnPainLocationLongPress}
        onEpisodeEndLongPress={mockOnEpisodeEndLongPress}
      />
    );

    // Should render Today and Yesterday as single line text
    expect(screen.getByText('Yesterday')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
  });
});