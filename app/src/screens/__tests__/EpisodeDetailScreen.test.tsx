import React from 'react';
import EpisodeDetailScreen from '../EpisodeDetailScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import { useEpisodeStore } from '../../store/episodeStore';
import { episodeRepository, intensityRepository, symptomLogRepository, episodeNoteRepository } from '../../database/episodeRepository';
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
});
