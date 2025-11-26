import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { TimelineEventRenderer } from '../TimelineEventRenderer';
import { Episode, IntensityReading, EpisodeNote, MedicationDose, Medication, SymptomLog, PainLocationLog, PainLocation } from '../../../models/types';

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

describe('TimelineEventRenderer', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render intensity event correctly', () => {
    const group = {
      timestamp: new Date('2024-01-15T11:30:00').getTime(),
      events: [
        {
          id: 'intensity-1',
          type: 'intensity' as const,
          timestamp: new Date('2024-01-15T11:30:00').getTime(),
          data: {
            id: 'reading-1',
            episodeId: 'episode-1',
            timestamp: new Date('2024-01-15T11:30:00').getTime(),
            intensity: 7,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          } as IntensityReading,
        },
      ],
    };

    renderWithTheme(
      <TimelineEventRenderer
        group={group}
        index={0}
        isLast={false}
        episode={baseEpisode}
        onIntensityLongPress={mockOnIntensityLongPress}
        onNoteLongPress={mockOnNoteLongPress}
        onMedicationLongPress={mockOnMedicationLongPress}
        onSymptomLongPress={mockOnSymptomLongPress}
        onPainLocationLongPress={mockOnPainLocationLongPress}
        onEpisodeEndLongPress={mockOnEpisodeEndLongPress}
      />
    );

    expect(screen.getByText('11:30 AM')).toBeTruthy();
    expect(screen.getByText('7 - Severe')).toBeTruthy();
  });

  it('should render note event correctly', () => {
    const group = {
      timestamp: new Date('2024-01-15T11:30:00').getTime(),
      events: [
        {
          id: 'note-1',
          type: 'note' as const,
          timestamp: new Date('2024-01-15T11:30:00').getTime(),
          data: {
            id: 'note-1',
            episodeId: 'episode-1',
            note: 'Test note content',
            timestamp: new Date('2024-01-15T11:30:00').getTime(),
            createdAt: Date.now(),
          } as EpisodeNote,
        },
      ],
    };

    renderWithTheme(
      <TimelineEventRenderer
        group={group}
        index={0}
        isLast={false}
        episode={baseEpisode}
        onIntensityLongPress={mockOnIntensityLongPress}
        onNoteLongPress={mockOnNoteLongPress}
        onMedicationLongPress={mockOnMedicationLongPress}
        onSymptomLongPress={mockOnSymptomLongPress}
        onPainLocationLongPress={mockOnPainLocationLongPress}
        onEpisodeEndLongPress={mockOnEpisodeEndLongPress}
      />
    );

    expect(screen.getByText('11:30 AM')).toBeTruthy();
    expect(screen.getByText('Test note content')).toBeTruthy();
  });

  it('should render medication event correctly', () => {
    const medicationDose: MedicationDose = {
      id: 'dose-1',
      medicationId: 'med-1',
      episodeId: 'episode-1',
      timestamp: new Date('2024-01-15T11:30:00').getTime(),
      quantity: 1,
      dosageAmount: 50,
      dosageUnit: 'mg',
      status: 'taken',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const medication: Medication = {
      id: 'med-1',
      name: 'Test Medication',
      dosageAmount: 50,
      dosageUnit: 'mg',
      type: 'rescue',
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const group = {
      timestamp: new Date('2024-01-15T11:30:00').getTime(),
      events: [
        {
          id: 'medication-1',
          type: 'medication' as const,
          timestamp: new Date('2024-01-15T11:30:00').getTime(),
          data: {
            ...medicationDose,
            medication: medication,
          } as MedicationDose,
        },
      ],
    };

    renderWithTheme(
      <TimelineEventRenderer
        group={group}
        index={0}
        isLast={false}
        episode={baseEpisode}
        onIntensityLongPress={mockOnIntensityLongPress}
        onNoteLongPress={mockOnNoteLongPress}
        onMedicationLongPress={mockOnMedicationLongPress}
        onSymptomLongPress={mockOnSymptomLongPress}
        onPainLocationLongPress={mockOnPainLocationLongPress}
        onEpisodeEndLongPress={mockOnEpisodeEndLongPress}
      />
    );

    expect(screen.getByText('11:30 AM')).toBeTruthy();
    expect(screen.getByText('Medication Taken')).toBeTruthy();
    expect(screen.getByText('Test Medication • 1 × 50mg')).toBeTruthy();
  });

  it('should render end event correctly', () => {
    const group = {
      timestamp: new Date('2024-01-15T14:30:00').getTime(),
      events: [
        {
          id: 'end',
          type: 'end' as const,
          timestamp: new Date('2024-01-15T14:30:00').getTime(),
          data: null,
        },
      ],
    };

    renderWithTheme(
      <TimelineEventRenderer
        group={group}
        index={0}
        isLast={false}
        episode={baseEpisode}
        onIntensityLongPress={mockOnIntensityLongPress}
        onNoteLongPress={mockOnNoteLongPress}
        onMedicationLongPress={mockOnMedicationLongPress}
        onSymptomLongPress={mockOnSymptomLongPress}
        onPainLocationLongPress={mockOnPainLocationLongPress}
        onEpisodeEndLongPress={mockOnEpisodeEndLongPress}
      />
    );

    expect(screen.getByText('2:30 PM')).toBeTruthy();
    expect(screen.getByText('Episode Ended')).toBeTruthy();
  });

  it('should call onIntensityLongPress when intensity event is long pressed', () => {
    const intensityReading: IntensityReading = {
      id: 'reading-1',
      episodeId: 'episode-1',
      timestamp: new Date('2024-01-15T11:30:00').getTime(),
      intensity: 7,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const group = {
      timestamp: new Date('2024-01-15T11:30:00').getTime(),
      events: [
        {
          id: 'intensity-1',
          type: 'intensity' as const,
          timestamp: new Date('2024-01-15T11:30:00').getTime(),
          data: intensityReading,
        },
      ],
    };

    renderWithTheme(
      <TimelineEventRenderer
        group={group}
        index={0}
        isLast={false}
        episode={baseEpisode}
        onIntensityLongPress={mockOnIntensityLongPress}
        onNoteLongPress={mockOnNoteLongPress}
        onMedicationLongPress={mockOnMedicationLongPress}
        onSymptomLongPress={mockOnSymptomLongPress}
        onPainLocationLongPress={mockOnPainLocationLongPress}
        onEpisodeEndLongPress={mockOnEpisodeEndLongPress}
      />
    );

    fireEvent(screen.getByText('7 - Severe'), 'onLongPress');
    expect(mockOnIntensityLongPress).toHaveBeenCalledWith(intensityReading);
  });

  it('should call onNoteLongPress when note event is long pressed', () => {
    const note: EpisodeNote = {
      id: 'note-1',
      episodeId: 'episode-1',
      note: 'Test note content',
      timestamp: new Date('2024-01-15T11:30:00').getTime(),
      createdAt: Date.now(),
    };

    const group = {
      timestamp: new Date('2024-01-15T11:30:00').getTime(),
      events: [
        {
          id: 'note-1',
          type: 'note' as const,
          timestamp: new Date('2024-01-15T11:30:00').getTime(),
          data: note,
        },
      ],
    };

    renderWithTheme(
      <TimelineEventRenderer
        group={group}
        index={0}
        isLast={false}
        episode={{ ...baseEpisode, notes: undefined }} // Make it not the summary note
        onIntensityLongPress={mockOnIntensityLongPress}
        onNoteLongPress={mockOnNoteLongPress}
        onMedicationLongPress={mockOnMedicationLongPress}
        onSymptomLongPress={mockOnSymptomLongPress}
        onPainLocationLongPress={mockOnPainLocationLongPress}
        onEpisodeEndLongPress={mockOnEpisodeEndLongPress}
      />
    );

    fireEvent(screen.getByText('Test note content'), 'onLongPress');
    expect(mockOnNoteLongPress).toHaveBeenCalledWith(note);
  });

it('should call onMedicationLongPress when medication event is long pressed', () => {
    const medicationDose: MedicationDose = {
      id: 'dose-1',
      medicationId: 'med-1',
      episodeId: 'episode-1',
      timestamp: new Date('2024-01-15T11:30:00').getTime(),
      quantity: 1,
      dosageAmount: 50,
      dosageUnit: 'mg',
      status: 'taken',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const medication: Medication = {
      id: 'med-1',
      name: 'Test Medication',
      dosageAmount: 50,
      dosageUnit: 'mg',
      type: 'rescue',
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const group = {
      timestamp: new Date('2024-01-15T11:30:00').getTime(),
      events: [
        {
          id: 'medication-1',
          type: 'medication' as const,
          timestamp: new Date('2024-01-15T11:30:00').getTime(),
          data: {
            ...medicationDose,
            medication: medication,
          } as MedicationDose,
        },
      ],
    };

    renderWithTheme(
      <TimelineEventRenderer
        group={group}
        index={0}
        isLast={false}
        episode={baseEpisode}
        onIntensityLongPress={mockOnIntensityLongPress}
        onNoteLongPress={mockOnNoteLongPress}
        onMedicationLongPress={mockOnMedicationLongPress}
        onSymptomLongPress={mockOnSymptomLongPress}
        onPainLocationLongPress={mockOnPainLocationLongPress}
        onEpisodeEndLongPress={mockOnEpisodeEndLongPress}
      />
    );

    fireEvent(screen.getByText('Test Medication • 1 × 50mg'), 'onLongPress');
    expect(mockOnMedicationLongPress).toHaveBeenCalledWith({
      ...medicationDose,
      medication: medication,
    } as MedicationDose);
  });

  it('should call onEpisodeEndLongPress when end event is long pressed', () => {
    const group = {
      timestamp: new Date('2024-01-15T14:30:00').getTime(),
      events: [
        {
          id: 'end',
          type: 'end' as const,
          timestamp: new Date('2024-01-15T14:30:00').getTime(),
          data: null,
        },
      ],
    };

    renderWithTheme(
      <TimelineEventRenderer
        group={group}
        index={0}
        isLast={false}
        episode={baseEpisode}
        onIntensityLongPress={mockOnIntensityLongPress}
        onNoteLongPress={mockOnNoteLongPress}
        onMedicationLongPress={mockOnMedicationLongPress}
        onSymptomLongPress={mockOnSymptomLongPress}
        onPainLocationLongPress={mockOnPainLocationLongPress}
        onEpisodeEndLongPress={mockOnEpisodeEndLongPress}
      />
    );

    fireEvent(screen.getByText('Episode Ended'), 'onLongPress');
    expect(mockOnEpisodeEndLongPress).toHaveBeenCalled();
  });

  it('should render symptom changes correctly', () => {
    const group = {
      timestamp: new Date('2024-01-15T11:30:00').getTime(),
      events: [
        {
          id: 'symptom-1',
          type: 'symptom' as const,
          timestamp: new Date('2024-01-15T11:30:00').getTime(),
          data: {
            log: {
              id: 'log-1',
              episodeId: 'episode-1',
              symptom: 'nausea',
              onsetTime: new Date('2024-01-15T11:30:00').getTime(),
              createdAt: Date.now(),
            } as SymptomLog,
            changes: [
              {
                symptom: 'nausea',
                changeType: 'added' as const,
              },
            ],
          },
        },
      ],
    };

    renderWithTheme(
      <TimelineEventRenderer
        group={group}
        index={0}
        isLast={false}
        episode={baseEpisode}
        onIntensityLongPress={mockOnIntensityLongPress}
        onNoteLongPress={mockOnNoteLongPress}
        onMedicationLongPress={mockOnMedicationLongPress}
        onSymptomLongPress={mockOnSymptomLongPress}
        onPainLocationLongPress={mockOnPainLocationLongPress}
        onEpisodeEndLongPress={mockOnEpisodeEndLongPress}
      />
    );

    expect(screen.getByText('Symptom Changes')).toBeTruthy();
    expect(screen.getByText('+ Nausea')).toBeTruthy();
  });

  it('should render pain location changes correctly', () => {
    const group = {
      timestamp: new Date('2024-01-15T11:30:00').getTime(),
      events: [
        {
          id: 'pain-location-1',
          type: 'pain_location' as const,
          timestamp: new Date('2024-01-15T11:30:00').getTime(),
          data: {
            log: {
              id: 'log-1',
              episodeId: 'episode-1',
              timestamp: new Date('2024-01-15T11:30:00').getTime(),
              painLocations: ['left_temple'],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            } as PainLocationLog,
            changes: [
              {
                location: 'left_temple' as PainLocation,
                changeType: 'added' as const,
              },
            ],
          },
        },
      ],
    };

    renderWithTheme(
      <TimelineEventRenderer
        group={group}
        index={0}
        isLast={false}
        episode={baseEpisode}
        onIntensityLongPress={mockOnIntensityLongPress}
        onNoteLongPress={mockOnNoteLongPress}
        onMedicationLongPress={mockOnMedicationLongPress}
        onSymptomLongPress={mockOnSymptomLongPress}
        onPainLocationLongPress={mockOnPainLocationLongPress}
        onEpisodeEndLongPress={mockOnEpisodeEndLongPress}
      />
    );

    expect(screen.getByText('Pain Location Changes')).toBeTruthy();
    expect(screen.getByText('+ Left Temple')).toBeTruthy();
  });
});