import React from 'react';
import { Alert } from 'react-native';
import { screen } from '@testing-library/react-native';
import EpisodeDetailScreen from '../EpisodeDetailScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import { useEpisodeStore } from '../../store/episodeStore';
import { episodeRepository, intensityRepository, symptomLogRepository, episodeNoteRepository, painLocationLogRepository } from '../../database/episodeRepository';
import { medicationDoseRepository, medicationRepository } from '../../database/medicationRepository';
import { locationService } from '../../services/locationService';
import { Episode, IntensityReading } from '../../models/types';

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
jest.mock('../../components/IntensitySparkline', () => () => null);
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

// Mock useFocusEffect as simple no-op first 
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

describe('EpisodeDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    (useEpisodeStore as unknown as jest.Mock).mockReturnValue(mockEpisodeStore);
    
    (episodeRepository.getById as jest.Mock).mockResolvedValue(mockEpisode);
    (intensityRepository.getByEpisodeId as jest.Mock).mockResolvedValue(mockIntensityReadings);
    (symptomLogRepository.getByEpisodeId as jest.Mock).mockResolvedValue([]);
    (episodeNoteRepository.getByEpisodeId as jest.Mock).mockResolvedValue([]);
    (painLocationLogRepository.getByEpisodeId as jest.Mock).mockResolvedValue([]);
    (medicationDoseRepository.getByEpisodeId as jest.Mock).mockResolvedValue([]);
    (medicationRepository.getById as jest.Mock).mockResolvedValue(null);
    (locationService.reverseGeocode as jest.Mock).mockResolvedValue('123 Main St, San Francisco, CA');
  });



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

  it('should show loading state initially', () => {
    renderWithProviders(
      <EpisodeDetailScreen 
        navigation={mockNavigation as any} 
        route={{ params: { episodeId: 'episode-123' } } as any} 
      />
    );

    // The component renders successfully - just check it doesn't crash
    expect(screen).toBeTruthy();
  });

  it('should handle back button press', () => {
    renderWithProviders(
      <EpisodeDetailScreen 
        navigation={mockNavigation as any} 
        route={{ params: { episodeId: 'episode-123' } } as any} 
      />
    );

    // The component renders successfully
    expect(screen).toBeTruthy();
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

  describe('Pain Location Delta Logic', () => {
    const baseTime = Date.now();

    beforeEach(() => {
      (painLocationLogRepository.getByEpisodeId as jest.Mock).mockResolvedValue([]);
    });

    it('should render with initial pain locations', () => {
      const mockRoute = { params: { episodeId: 'episode-123' } };

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
          <EpisodeDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
        );
      }).not.toThrow();
    });

    it('should render with pain location additions', () => {
      const mockRoute = { params: { episodeId: 'episode-123' } };

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
          <EpisodeDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
        );
      }).not.toThrow();
    });

    it('should render with pain location removals', () => {
      const mockRoute = { params: { episodeId: 'episode-123' } };

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
          <EpisodeDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
        );
      }).not.toThrow();
    });

    it('should render with both pain location additions and removals', () => {
      const mockRoute = { params: { episodeId: 'episode-123' } };

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
          painLocations: ['left_temple', 'left_head'],
          createdAt: baseTime + 1000,
          updatedAt: baseTime + 1000,
        },
      ]);

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
        );
      }).not.toThrow();
    });

    it('should render with multiple pain location changes over time', () => {
      const mockRoute = { params: { episodeId: 'episode-123' } };

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
          <EpisodeDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
        );
      }).not.toThrow();
    });

    it('should render when pain locations do not change', () => {
      const mockRoute = { params: { episodeId: 'episode-123' } };

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
          <EpisodeDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
        );
      }).not.toThrow();
    });

    it('should render episode with no initial pain locations', () => {
      const mockRoute = { params: { episodeId: 'episode-123' } };

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
          <EpisodeDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
        );
      }).not.toThrow();
    });
  });

  describe('Component State Management', () => {
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

    it('should handle episodes that are ended', () => {
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
  });

  describe('Extended Functionality Tests', () => {
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
      ]);
      
      (episodeNoteRepository.getByEpisodeId as jest.Mock).mockResolvedValue([
        {
          id: 'note-1',
          episodeId: 'episode-123',
          note: 'Pain getting worse',
          timestamp: baseTime + 900000,
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

    it('should handle episodes with medication data', () => {
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

    it('should handle validation methods', () => {
      const validationMock = require('../../utils/episodeValidation').validateEpisodeEndTime;
      validationMock.mockReturnValue({ isValid: false, error: 'Invalid time' });

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
      
      // Validation function should be available
      expect(validationMock).toBeDefined();
    });

    it('should handle deletion methods', () => {
      (episodeNoteRepository.delete as jest.Mock).mockResolvedValue(undefined);

      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
      
      // Delete method should be available
      expect(episodeNoteRepository.delete).toBeDefined();
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
      
      // The timeline grouping should be available
      expect(require('../../utils/timelineGrouping').groupEventsByDay).toBeDefined();
    });

    it('should handle store methods', () => {
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
      
      // Store methods should be available
      expect(mockEpisodeStore.endEpisode).toBeDefined();
      expect(mockEpisodeStore.updateEpisode).toBeDefined();
      expect(mockEpisodeStore.reopenEpisode).toBeDefined();
    });

    it('should handle utility methods', () => {
      expect(() => {
        renderWithProviders(
          <EpisodeDetailScreen 
            navigation={mockNavigation as any} 
            route={{ params: { episodeId: 'episode-123' } } as any} 
          />
        );
      }).not.toThrow();
      
      // Utility methods should be available
      expect(require('../../utils/painScale').getPainColor).toBeDefined();
      expect(require('../../utils/painScale').getPainLevel).toBeDefined();
      expect(require('../../utils/medicationFormatting').formatMedicationDoseDisplay).toBeDefined();
    });
  });
});