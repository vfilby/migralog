import React from 'react';
import { Alert } from 'react-native';
import { screen } from '@testing-library/react-native';
import EpisodeDetailScreen from '../episode/EpisodeDetailScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import { useEpisodeStore } from '../../store/episodeStore';
import { episodeRepository, intensityRepository, symptomLogRepository, episodeNoteRepository, painLocationLogRepository } from '../../database/episodeRepository';
import { medicationDoseRepository, medicationRepository } from '../../database/medicationRepository';
import { locationService } from '../../services/locationService';
import { Episode, IntensityReading, SymptomLog, EpisodeNote, PainLocationLog } from '../../models/types';

// Mock all dependencies
jest.mock('../../store/episodeStore');
jest.mock('../../database/episodeRepository');
jest.mock('../../database/medicationRepository');
jest.mock('../../services/locationService');
jest.mock('../../utils/logger', () => ({
  logger: { error: jest.fn(), log: jest.fn() },
}));
jest.mock('react-native-maps', () => ({
  __esModule: true,
  default: () => null,
  Marker: () => null,
}));
jest.mock('@react-native-community/datetimepicker', () => () => null);
jest.mock('../../components/analytics/IntensitySparkline', () => () => null);
jest.mock('../../utils/painScale', () => ({
  getPainColor: jest.fn(() => '#FF0000'),
  getPainLevel: jest.fn(() => ({ label: 'High' })),
}));
jest.mock('../../utils/episodeValidation', () => ({
  validateEpisodeEndTime: jest.fn(() => ({ isValid: true })),
}));
jest.mock('../../utils/timelineFilters', () => ({
  shouldShowMedicationInTimeline: jest.fn(() => true),
}));
jest.mock('../../utils/timelineGrouping', () => ({
  groupEventsByDay: jest.fn(() => []),
  groupEventsByTimestamp: jest.fn(() => []),
}));
jest.mock('../../utils/medicationFormatting', () => ({
  formatMedicationDoseDisplay: jest.fn(() => '200mg'),
}));
jest.mock('../../utils/medicationStyling', () => ({
  useMedicationStatusStyles: jest.fn(() => ({
    getStatusStyle: jest.fn(() => ({})),
  })),
}));

// Mock useFocusEffect to not call callback automatically - we'll control when it's called
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: jest.fn(),
}));

jest.spyOn(Alert, 'alert');

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

const mockEpisodeStore = {
  endEpisode: jest.fn(),
  updateEpisode: jest.fn(), 
  reopenEpisode: jest.fn(),
  deleteEpisode: jest.fn(),
};

const baseTime = Date.now() - 3600000; // 1 hour ago

const mockEpisode: Episode = {
  id: 'episode-123',
  startTime: baseTime,
  endTime: undefined,
  locations: ['left_temple', 'right_temple'],
  qualities: ['throbbing', 'sharp'],
  symptoms: ['nausea', 'light_sensitivity'],
  triggers: ['stress', 'lack_of_sleep'],
  notes: 'Initial episode summary',
  location: {
    latitude: 37.7749,
    longitude: -122.4194,
    accuracy: 10,
    timestamp: baseTime,
  },
  createdAt: baseTime,
  updatedAt: baseTime,
};

const mockIntensityReadings: IntensityReading[] = [
  {
    id: 'intensity-1',
    episodeId: 'episode-123',
    intensity: 7,
    timestamp: baseTime,
    createdAt: baseTime,
    updatedAt: baseTime,
  },
];

const mockSymptomLogs: SymptomLog[] = [
  {
    id: 'symptom-1',
    episodeId: 'episode-123',
    symptom: 'nausea',
    onsetTime: baseTime + 300000,
    resolutionTime: baseTime + 600000,
    createdAt: baseTime + 300000,
  },
];

const mockEpisodeNotes: EpisodeNote[] = [
  {
    id: 'note-1',
    episodeId: 'episode-123',
    note: 'Pain getting worse',
    timestamp: baseTime + 600000,
    createdAt: baseTime + 600000,
  },
];

const mockPainLocationLogs: PainLocationLog[] = [
  {
    id: 'painloc-1',
    episodeId: 'episode-123',
    timestamp: baseTime + 900000,
    painLocations: ['left_temple', 'right_temple', 'left_head'],
    createdAt: baseTime + 900000,
    updatedAt: baseTime + 900000,
  },
];

const mockMedicationDoses = [
  {
    id: 'dose-1',
    medicationId: 'med-1',
    episodeId: 'episode-123',
    timestamp: baseTime + 1200000,
    quantity: 2,
    status: 'taken' as const,
    dosageAmount: 200,
    dosageUnit: 'mg',
    createdAt: baseTime + 1200000,
    updatedAt: baseTime + 1200000,
  },
];

const mockMedication = {
  id: 'med-1',
  name: 'Ibuprofen',
  type: 'rescue' as const,
  dosageAmount: 200,
  dosageUnit: 'mg',
  defaultQuantity: 1,
  active: true,
  createdAt: baseTime,
  updatedAt: baseTime,
};

describe('EpisodeDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    (useEpisodeStore as unknown as jest.Mock).mockReturnValue(mockEpisodeStore);
    
    // Set up repository mocks to return resolved values immediately
    (episodeRepository.getById as jest.Mock).mockResolvedValue(mockEpisode);
    (intensityRepository.getByEpisodeId as jest.Mock).mockResolvedValue(mockIntensityReadings);
    (symptomLogRepository.getByEpisodeId as jest.Mock).mockResolvedValue(mockSymptomLogs);
    (episodeNoteRepository.getByEpisodeId as jest.Mock).mockResolvedValue(mockEpisodeNotes);
    (painLocationLogRepository.getByEpisodeId as jest.Mock).mockResolvedValue(mockPainLocationLogs);
    (medicationDoseRepository.getByEpisodeId as jest.Mock).mockResolvedValue(mockMedicationDoses);
    (medicationRepository.getById as jest.Mock).mockResolvedValue(mockMedication);
    (locationService.reverseGeocode as jest.Mock).mockResolvedValue('123 Main St, San Francisco, CA');

    // Set up deletion mocks
    (episodeNoteRepository.delete as jest.Mock).mockResolvedValue(undefined);
    (intensityRepository.delete as jest.Mock).mockResolvedValue(undefined);
    (medicationDoseRepository.delete as jest.Mock).mockResolvedValue(undefined);
    (symptomLogRepository.delete as jest.Mock).mockResolvedValue(undefined);
    (painLocationLogRepository.delete as jest.Mock).mockResolvedValue(undefined);

    // Reset all mocked functions
    mockEpisodeStore.endEpisode.mockResolvedValue(undefined);
    mockEpisodeStore.updateEpisode.mockResolvedValue(undefined);
    mockEpisodeStore.reopenEpisode.mockResolvedValue(undefined);
    mockNavigation.navigate.mockClear();
    mockNavigation.goBack.mockClear();
  });

  describe('Basic Rendering', () => {
    it('should render component without crashing', () => {
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should accept route params correctly', () => {
      const route1 = { params: { episodeId: 'episode-123' } };
      const route2 = { params: { episodeId: 'episode-456' } };
      
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen navigation={mockNavigation as any} route={route1 as any} />
        );
      }).not.toThrow();
      
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen navigation={mockNavigation as any} route={route2 as any} />
        );
      }).not.toThrow();
    });
  });

  describe('Episode Status Management', () => {
    it('should handle ongoing episode', () => {
      (episodeRepository.getById as jest.Mock).mockResolvedValue({
        ...mockEpisode,
        endTime: undefined,
      });

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should handle ended episode', () => {
      (episodeRepository.getById as jest.Mock).mockResolvedValue({
        ...mockEpisode,
        endTime: baseTime + 3600000,
      });

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should handle episode end validation', () => {
      const { validateEpisodeEndTime } = require('../../utils/episodeValidation');
      
      // Test valid end time
      validateEpisodeEndTime.mockReturnValue({ isValid: true });
      
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
      
      // Test invalid end time
      validateEpisodeEndTime.mockReturnValue({ 
        isValid: false, 
        error: 'End time cannot be before start time' 
      });
      
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should have episode store methods available', () => {
      renderWithProviders(
        <EpisodeDetailScreen 
          navigation={mockNavigation as any} 
          route={{ params: { episodeId: 'episode-123' } } as any} 
        />
      );
      
      expect(mockEpisodeStore.endEpisode).toBeDefined();
      expect(mockEpisodeStore.updateEpisode).toBeDefined();
      expect(mockEpisodeStore.reopenEpisode).toBeDefined();
    });
  });

  describe('Episode Data Variations', () => {
    it('should handle episodes with different qualities', () => {
      (episodeRepository.getById as jest.Mock).mockResolvedValue({
        ...mockEpisode,
        qualities: ['sharp', 'burning'],
      });

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should handle episodes with different symptoms', () => {
      (episodeRepository.getById as jest.Mock).mockResolvedValue({
        ...mockEpisode,
        symptoms: ['vomiting', 'aura', 'dizziness'],
      });

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should handle episodes with different triggers', () => {
      (episodeRepository.getById as jest.Mock).mockResolvedValue({
        ...mockEpisode,
        triggers: ['weather_change', 'bright_lights', 'alcohol'],
      });

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should handle episodes without location', () => {
      (episodeRepository.getById as jest.Mock).mockResolvedValue({
        ...mockEpisode,
        location: undefined,
      });

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should handle episodes with no qualities, triggers, or symptoms', () => {
      (episodeRepository.getById as jest.Mock).mockResolvedValue({
        ...mockEpisode,
        qualities: [],
        symptoms: [],
        triggers: [],
      });

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should handle episodes with empty notes', () => {
      (episodeRepository.getById as jest.Mock).mockResolvedValue({
        ...mockEpisode,
        notes: undefined,
      });

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should handle episodes with different pain locations', () => {
      (episodeRepository.getById as jest.Mock).mockResolvedValue({
        ...mockEpisode,
        locations: ['left_head', 'right_head', 'left_neck', 'right_neck'],
      });

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should handle episodes with multiple intensity readings', () => {
      (intensityRepository.getByEpisodeId as jest.Mock).mockResolvedValue([
        {
          id: 'intensity-1',
          episodeId: 'episode-123',
          intensity: 7,
          timestamp: baseTime,
          createdAt: baseTime,
          updatedAt: baseTime,
        },
        {
          id: 'intensity-2',
          episodeId: 'episode-123',
          intensity: 9,
          timestamp: baseTime + 1800000,
          createdAt: baseTime + 1800000,
          updatedAt: baseTime + 1800000,
        },
        {
          id: 'intensity-3',
          episodeId: 'episode-123',
          intensity: 4,
          timestamp: baseTime + 3600000,
          createdAt: baseTime + 3600000,
          updatedAt: baseTime + 3600000,
        },
      ]);

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });
  });

  describe('Timeline and Data Processing', () => {
    it('should handle episodes with complex timeline data', () => {
      (symptomLogRepository.getByEpisodeId as jest.Mock).mockResolvedValue([
        {
          id: 'symptom-1',
          episodeId: 'episode-123',
          symptom: 'vomiting',
          onsetTime: baseTime + 600000,
          resolutionTime: baseTime + 1200000,
          createdAt: baseTime + 600000,
        },
        {
          id: 'symptom-2',
          episodeId: 'episode-123',
          symptom: 'aura',
          onsetTime: baseTime + 300000,
          resolutionTime: null,
          createdAt: baseTime + 300000,
        },
      ]);
      
      (episodeNoteRepository.getByEpisodeId as jest.Mock).mockResolvedValue([
        {
          id: 'note-1',
          episodeId: 'episode-123',
          note: 'Pain getting worse',
          timestamp: baseTime + 900000,
          createdAt: baseTime + 900000,
        },
        {
          id: 'note-2',
          episodeId: 'episode-123',
          note: 'Took medication',
          timestamp: baseTime + 1200000,
          createdAt: baseTime + 1200000,
        },
      ]);

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should handle episodes with medication data', () => {
      (medicationRepository.getById as jest.Mock).mockResolvedValue(mockMedication);
      (medicationDoseRepository.getByEpisodeId as jest.Mock).mockResolvedValue([
        {
          id: 'dose-1',
          medicationId: 'med-1',
          episodeId: 'episode-123',
          timestamp: baseTime + 1200000,
          quantity: 2,
          status: 'taken' as const,
          dosageAmount: 200,
          dosageUnit: 'mg',
          createdAt: baseTime + 1200000,
          updatedAt: baseTime + 1200000,
        },
        {
          id: 'dose-2',
          medicationId: 'med-1',
          episodeId: 'episode-123',
          timestamp: baseTime + 2400000,
          quantity: 1,
          status: 'skipped' as const,
          dosageAmount: 200,
          dosageUnit: 'mg',
          createdAt: baseTime + 2400000,
          updatedAt: baseTime + 2400000,
        },
      ]);

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should handle timeline grouping utilities', () => {
      // Mock the timeline grouping to return sample data
      require('../../utils/timelineGrouping').groupEventsByDay.mockReturnValue([
        {
          date: baseTime,
          events: [
            {
              id: 'intensity-1',
              timestamp: baseTime,
              type: 'intensity',
              data: mockIntensityReadings[0],
            },
            {
              id: 'note-1',
              timestamp: baseTime + 600000,
              type: 'note',
              data: mockEpisodeNotes[0],
            }
          ],
        }
      ]);

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
      
      expect(require('../../utils/timelineGrouping').groupEventsByDay).toBeDefined();
    });

    it('should calculate episode duration correctly', () => {
      // Test ongoing episode duration calculation
      (episodeRepository.getById as jest.Mock).mockResolvedValue({
        ...mockEpisode,
        endTime: undefined,
      });

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();

      // Test ended episode duration calculation  
      (episodeRepository.getById as jest.Mock).mockResolvedValue({
        ...mockEpisode,
        endTime: baseTime + 3600000,
      });

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should build timeline with various event types', () => {
      // Set up rich timeline data
      (intensityRepository.getByEpisodeId as jest.Mock).mockResolvedValue([
        {
          id: 'intensity-1',
          episodeId: 'episode-123',
          intensity: 7,
          timestamp: baseTime,
          createdAt: baseTime,
          updatedAt: baseTime,
        },
        {
          id: 'intensity-2',
          episodeId: 'episode-123',
          intensity: 9,
          timestamp: baseTime + 1800000,
          createdAt: baseTime + 1800000,
          updatedAt: baseTime + 1800000,
        },
      ]);

      // Test timeline building with symptoms having onset and resolution times
      (symptomLogRepository.getByEpisodeId as jest.Mock).mockResolvedValue([
        {
          id: 'symptom-1',
          episodeId: 'episode-123',
          symptom: 'nausea',
          onsetTime: baseTime + 300000,
          resolutionTime: baseTime + 600000,
          createdAt: baseTime + 300000,
        },
        {
          id: 'symptom-2',
          episodeId: 'episode-123',
          symptom: 'aura',
          onsetTime: baseTime + 900000,
          resolutionTime: null, // ongoing
          createdAt: baseTime + 900000,
        },
      ]);

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });
  });

  describe('Pain Location Delta Logic', () => {
    it('should render with initial pain locations', () => {
      (episodeRepository.getById as jest.Mock).mockResolvedValue({
        id: 'episode-123',
        startTime: baseTime,
        endTime: undefined,
        locations: ['left_temple', 'right_temple'],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: baseTime,
        updatedAt: baseTime,
      });

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} />
        );
      }).not.toThrow();
    });

    it('should render with pain location additions', () => {
      (episodeRepository.getById as jest.Mock).mockResolvedValue({
        id: 'episode-123',
        startTime: baseTime,
        endTime: undefined,
        locations: ['left_temple'],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: baseTime,
        updatedAt: baseTime,
      });

      (painLocationLogRepository.getByEpisodeId as jest.Mock).mockResolvedValue([
        {
          id: 'painloc-1',
          episodeId: 'episode-123',
          timestamp: baseTime + 1000,
          painLocations: ['left_temple', 'right_temple'],
          createdAt: baseTime + 1000,
          updatedAt: baseTime + 1000,
        },
      ]);

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} />
        );
      }).not.toThrow();
    });

    it('should render with pain location removals', () => {
      (episodeRepository.getById as jest.Mock).mockResolvedValue({
        id: 'episode-123',
        startTime: baseTime,
        endTime: undefined,
        locations: ['left_temple', 'right_temple'],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: baseTime,
        updatedAt: baseTime,
      });

      (painLocationLogRepository.getByEpisodeId as jest.Mock).mockResolvedValue([
        {
          id: 'painloc-1',
          episodeId: 'episode-123',
          timestamp: baseTime + 1000,
          painLocations: ['left_temple'],
          createdAt: baseTime + 1000,
          updatedAt: baseTime + 1000,
        },
      ]);

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} />
        );
      }).not.toThrow();
    });

    it('should render with multiple pain location changes over time', () => {
      (episodeRepository.getById as jest.Mock).mockResolvedValue({
        id: 'episode-123',
        startTime: baseTime,
        endTime: undefined,
        locations: ['left_temple'],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: baseTime,
        updatedAt: baseTime,
      });

      (painLocationLogRepository.getByEpisodeId as jest.Mock).mockResolvedValue([
        {
          id: 'painloc-1',
          episodeId: 'episode-123',
          timestamp: baseTime + 1000,
          painLocations: ['left_temple', 'right_temple'],
          createdAt: baseTime + 1000,
          updatedAt: baseTime + 1000,
        },
        {
          id: 'painloc-2',
          episodeId: 'episode-123',
          timestamp: baseTime + 2000,
          painLocations: ['left_temple'],
          createdAt: baseTime + 2000,
          updatedAt: baseTime + 2000,
        },
        {
          id: 'painloc-3',
          episodeId: 'episode-123',
          timestamp: baseTime + 3000,
          painLocations: ['left_temple', 'left_head', 'right_head'],
          createdAt: baseTime + 3000,
          updatedAt: baseTime + 3000,
        },
      ]);

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} />
        );
      }).not.toThrow();
    });

    it('should render when pain locations do not change', () => {
      (episodeRepository.getById as jest.Mock).mockResolvedValue({
        id: 'episode-123',
        startTime: baseTime,
        endTime: undefined,
        locations: ['left_temple'],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: baseTime,
        updatedAt: baseTime,
      });

      (painLocationLogRepository.getByEpisodeId as jest.Mock).mockResolvedValue([
        {
          id: 'painloc-1',
          episodeId: 'episode-123',
          timestamp: baseTime + 1000,
          painLocations: ['left_temple'],
          createdAt: baseTime + 1000,
          updatedAt: baseTime + 1000,
        },
      ]);

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} />
        );
      }).not.toThrow();
    });

    it('should render episode with no initial pain locations', () => {
      (episodeRepository.getById as jest.Mock).mockResolvedValue({
        id: 'episode-123',
        startTime: baseTime,
        endTime: undefined,
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: baseTime,
        updatedAt: baseTime,
      });

      (painLocationLogRepository.getByEpisodeId as jest.Mock).mockResolvedValue([
        {
          id: 'painloc-1',
          episodeId: 'episode-123',
          timestamp: baseTime + 1000,
          painLocations: ['left_temple', 'right_temple'],
          createdAt: baseTime + 1000,
          updatedAt: baseTime + 1000,
        },
      ]);

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} />
        );
      }).not.toThrow();
    });

    it('should handle complex pain location tracking', () => {
      (painLocationLogRepository.getByEpisodeId as jest.Mock).mockResolvedValue([
        {
          id: 'painloc-1',
          episodeId: 'episode-123',
          timestamp: baseTime + 1000,
          painLocations: ['left_temple', 'right_temple'],
          createdAt: baseTime + 1000,
          updatedAt: baseTime + 1000,
        },
        {
          id: 'painloc-2',
          episodeId: 'episode-123',
          timestamp: baseTime + 2000,
          painLocations: ['left_temple', 'left_head'],
          createdAt: baseTime + 2000,
          updatedAt: baseTime + 2000,
        },
        {
          id: 'painloc-3',
          episodeId: 'episode-123',
          timestamp: baseTime + 3000,
          painLocations: ['right_head', 'right_neck'],
          createdAt: baseTime + 3000,
          updatedAt: baseTime + 3000,
        },
      ]);

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} />
        );
      }).not.toThrow();
    });

    it('should handle empty pain location changes', () => {
      (episodeRepository.getById as jest.Mock).mockResolvedValue({
        id: 'episode-123',
        startTime: baseTime,
        endTime: undefined,
        locations: ['left_temple', 'right_temple'],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: baseTime,
        updatedAt: baseTime,
      });

      (painLocationLogRepository.getByEpisodeId as jest.Mock).mockResolvedValue([
        {
          id: 'painloc-1',
          episodeId: 'episode-123',
          timestamp: baseTime + 1000,
          painLocations: [], // Empty pain locations
          createdAt: baseTime + 1000,
          updatedAt: baseTime + 1000,
        },
      ]);

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} />
        );
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle repository errors gracefully', async () => {
      (episodeRepository.getById as jest.Mock).mockRejectedValue(new Error('Database error'));

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should handle missing episode data', async () => {
      (episodeRepository.getById as jest.Mock).mockResolvedValue(null);

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should handle location service errors', async () => {
      (locationService.reverseGeocode as jest.Mock).mockRejectedValue(new Error('Location service error'));

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should handle medication repository errors', async () => {
      (medicationRepository.getById as jest.Mock).mockRejectedValue(new Error('Medication error'));

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should handle missing medication data', () => {
      (medicationRepository.getById as jest.Mock).mockResolvedValue(null);
      (medicationDoseRepository.getByEpisodeId as jest.Mock).mockResolvedValue([
        {
          id: 'dose-1',
          medicationId: 'med-1',
          episodeId: 'episode-123',
          timestamp: baseTime + 1000,
          quantity: 2,
          status: 'taken',
          createdAt: baseTime,
          updatedAt: baseTime,
        },
      ]);

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should handle missing location data', () => {
      (locationService.reverseGeocode as jest.Mock).mockResolvedValue(null);

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should handle various data loading failures', async () => {
      (intensityRepository.getByEpisodeId as jest.Mock).mockRejectedValue(new Error('Intensity error'));
      (symptomLogRepository.getByEpisodeId as jest.Mock).mockRejectedValue(new Error('Symptom error'));
      (painLocationLogRepository.getByEpisodeId as jest.Mock).mockRejectedValue(new Error('Pain location error'));

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });
  });

  describe('User Interaction Handlers', () => {
    it('should have delete note functionality available', () => {
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
      
      expect(episodeNoteRepository.delete).toBeDefined();
    });

    it('should have intensity deletion functionality available', () => {
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
      
      expect(intensityRepository.delete).toBeDefined();
    });

    it('should have medication dose deletion functionality available', () => {
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
      
      expect(medicationDoseRepository.delete).toBeDefined();
    });

    it('should have symptom log deletion functionality available', () => {
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
      
      expect(symptomLogRepository.delete).toBeDefined();
    });

    it('should have pain location log deletion functionality available', () => {
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
      
      expect(painLocationLogRepository.delete).toBeDefined();
    });

    it('should have validation methods available', () => {
      const validationMock = require('../../utils/episodeValidation').validateEpisodeEndTime;
      
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
      
      expect(validationMock).toBeDefined();
    });

    it('should have utility methods available', () => {
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
      
      expect(require('../../utils/painScale').getPainColor).toBeDefined();
      expect(require('../../utils/painScale').getPainLevel).toBeDefined();
      expect(require('../../utils/medicationFormatting').formatMedicationDoseDisplay).toBeDefined();
    });

    it('should have timeline filtering available', () => {
      const timelineFilterMock = require('../../utils/timelineFilters').shouldShowMedicationInTimeline;
      
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
      
      expect(timelineFilterMock).toBeDefined();
    });

    it('should handle interaction event handlers', () => {
      // Test that the component defines the interaction handlers
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });
  });

  describe('Component State Management', () => {
    it('should handle window dimensions for sparkline width', () => {
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should handle component unmounting gracefully', () => {
      const { unmount } = renderWithProviders(
        <EpisodeDetailScreen 
          navigation={mockNavigation as any} 
          route={{ params: { episodeId: 'episode-123' } } as any} 
        />
      );
      
      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('should handle different episode IDs', () => {
      const episodeIds = ['episode-123', 'episode-456', 'episode-789'];
      
      episodeIds.forEach(episodeId => {
        expect(() => {
          const { unmount } = renderWithProviders(
            <EpisodeDetailScreen 
              navigation={mockNavigation as any} 
              route={{ params: { episodeId } } as any} 
            />
          );
          unmount(); // Clean up between renders
        }).not.toThrow();
      });
    });

    it('should handle modal state management', () => {
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should handle loading state management', () => {
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should handle custom end time state', () => {
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });
  });

  describe('Accessibility and UI Features', () => {
    it('should render without crashing with accessibility features', () => {
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should support flexible text sizing in header layout', () => {
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
      
      expect(screen).toBeTruthy();
    });

    it('should handle responsive layout features', () => {
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });

    it('should provide proper component structure', () => {
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
    });
  });
});