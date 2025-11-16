import React from 'react';
import EpisodeDetailScreen from '../EpisodeDetailScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import { useEpisodeStore } from '../../store/episodeStore';
import { episodeRepository, intensityRepository, symptomLogRepository, episodeNoteRepository, painLocationLogRepository } from '../../database/episodeRepository';
import { medicationDoseRepository } from '../../database/medicationRepository';

jest.mock('../../store/episodeStore');
jest.mock('../../database/episodeRepository');
jest.mock('../../database/medicationRepository');
jest.mock('../../services/locationService');
jest.mock('react-native-maps', () => ({
  __esModule: true,
  default: () => null,
  Marker: () => null,
}));
jest.mock('@react-native-community/slider', () => () => null);
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: jest.fn(),
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

describe('EpisodeDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
      endEpisode: jest.fn(),
      deleteEpisode: jest.fn(),
    });

    (episodeRepository.getById as jest.Mock) = jest.fn().mockResolvedValue({
      id: 'episode-123',
      startTime: Date.now(),
      endTime: null,
      locations: [],
      qualities: [],
      symptoms: [],
      triggers: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    (intensityRepository.getByEpisodeId as jest.Mock) = jest.fn().mockResolvedValue([]);
    (symptomLogRepository.getByEpisodeId as jest.Mock) = jest.fn().mockResolvedValue([]);
    (episodeNoteRepository.getByEpisodeId as jest.Mock) = jest.fn().mockResolvedValue([]);
    (medicationDoseRepository.getByEpisodeId as jest.Mock) = jest.fn().mockResolvedValue([]);
  });

  it('should accept route params', () => {
    const mockRoute = { params: { episodeId: 'episode-123' } };
    
    expect(() => {
      renderWithProviders(
        <EpisodeDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );
    }).not.toThrow();
  });

  it('should handle different episode IDs', () => {
    const mockRoute = { params: { episodeId: 'episode-456' } };

    expect(() => {
      renderWithProviders(
        <EpisodeDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );
    }).not.toThrow();
  });

  describe('Pain Location Delta Logic', () => {
    const baseTime = Date.now();

    beforeEach(() => {
      (painLocationLogRepository.getByEpisodeId as jest.Mock) = jest.fn().mockResolvedValue([]);
    });

    it('should render with initial pain locations', () => {
      const mockRoute = { params: { episodeId: 'episode-123' } };

      (episodeRepository.getById as jest.Mock) = jest.fn().mockResolvedValue({
        id: 'episode-123',
        startTime: baseTime,
        endTime: null,
        locations: ['front_right', 'back_left'],
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

      (episodeRepository.getById as jest.Mock) = jest.fn().mockResolvedValue({
        id: 'episode-123',
        startTime: baseTime,
        endTime: null,
        locations: ['front_right'],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: baseTime,
        updatedAt: baseTime,
      });

      (painLocationLogRepository.getByEpisodeId as jest.Mock) = jest.fn().mockResolvedValue([
        {
          id: 'painloc-1',
          episodeId: 'episode-123',
          timestamp: baseTime + 1000,
          painLocations: ['front_right', 'back_left'],
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

      (episodeRepository.getById as jest.Mock) = jest.fn().mockResolvedValue({
        id: 'episode-123',
        startTime: baseTime,
        endTime: null,
        locations: ['front_right', 'back_left'],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: baseTime,
        updatedAt: baseTime,
      });

      (painLocationLogRepository.getByEpisodeId as jest.Mock) = jest.fn().mockResolvedValue([
        {
          id: 'painloc-1',
          episodeId: 'episode-123',
          timestamp: baseTime + 1000,
          painLocations: ['front_right'],
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

      (episodeRepository.getById as jest.Mock) = jest.fn().mockResolvedValue({
        id: 'episode-123',
        startTime: baseTime,
        endTime: null,
        locations: ['front_right', 'back_left'],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: baseTime,
        updatedAt: baseTime,
      });

      (painLocationLogRepository.getByEpisodeId as jest.Mock) = jest.fn().mockResolvedValue([
        {
          id: 'painloc-1',
          episodeId: 'episode-123',
          timestamp: baseTime + 1000,
          painLocations: ['front_right', 'front_left'],
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

      (episodeRepository.getById as jest.Mock) = jest.fn().mockResolvedValue({
        id: 'episode-123',
        startTime: baseTime,
        endTime: null,
        locations: ['front_right'],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: baseTime,
        updatedAt: baseTime,
      });

      (painLocationLogRepository.getByEpisodeId as jest.Mock) = jest.fn().mockResolvedValue([
        {
          id: 'painloc-1',
          episodeId: 'episode-123',
          timestamp: baseTime + 1000,
          painLocations: ['front_right', 'back_left'],
          createdAt: baseTime + 1000,
          updatedAt: baseTime + 1000,
        },
        {
          id: 'painloc-2',
          episodeId: 'episode-123',
          timestamp: baseTime + 2000,
          painLocations: ['front_right'],
          createdAt: baseTime + 2000,
          updatedAt: baseTime + 2000,
        },
        {
          id: 'painloc-3',
          episodeId: 'episode-123',
          timestamp: baseTime + 3000,
          painLocations: ['front_right', 'front_left', 'back_right'],
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

      (episodeRepository.getById as jest.Mock) = jest.fn().mockResolvedValue({
        id: 'episode-123',
        startTime: baseTime,
        endTime: null,
        locations: ['front_right'],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: baseTime,
        updatedAt: baseTime,
      });

      (painLocationLogRepository.getByEpisodeId as jest.Mock) = jest.fn().mockResolvedValue([
        {
          id: 'painloc-1',
          episodeId: 'episode-123',
          timestamp: baseTime + 1000,
          painLocations: ['front_right'],
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

      (episodeRepository.getById as jest.Mock) = jest.fn().mockResolvedValue({
        id: 'episode-123',
        startTime: baseTime,
        endTime: null,
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: baseTime,
        updatedAt: baseTime,
      });

      (painLocationLogRepository.getByEpisodeId as jest.Mock) = jest.fn().mockResolvedValue([
        {
          id: 'painloc-1',
          episodeId: 'episode-123',
          timestamp: baseTime + 1000,
          painLocations: ['front_right', 'back_left'],
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
});
