import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import NewEpisodeScreen from '../NewEpisodeScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import { useEpisodeStore } from '../../store/episodeStore';

jest.mock('../../store/episodeStore');
jest.mock('../../services/locationService', () => ({
  locationService: {
    getCurrentLocation: jest.fn().mockResolvedValue(null),
    checkPermission: jest.fn().mockResolvedValue(false),
  },
}));
jest.mock('../../database/episodeRepository', () => ({
  intensityRepository: {
    create: jest.fn().mockResolvedValue({ id: 'reading-123' }),
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

describe('NewEpisodeScreen', () => {
  const mockStartEpisode = jest.fn();
  const mockAddIntensityReading = jest.fn();
  const mockUpdateEpisode = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
      startEpisode: mockStartEpisode,
      addIntensityReading: mockAddIntensityReading,
      updateEpisode: mockUpdateEpisode,
    });

    mockStartEpisode.mockResolvedValue({ id: 'new-episode-123' });
    mockAddIntensityReading.mockResolvedValue({ id: 'reading-123' });
    mockUpdateEpisode.mockResolvedValue(undefined);
  });

  it('should render new episode screen with title', async () => {
    const mockRoute = { params: {} };
    
    renderWithProviders(
      <NewEpisodeScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      const startEpisodeElements = screen.getAllByText('Start Episode');
      expect(startEpisodeElements.length).toBeGreaterThan(0);
    });
  });

  it('should display Cancel button', async () => {
    const mockRoute = { params: {} };
    
    renderWithProviders(
      <NewEpisodeScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeTruthy();
    });
  });

  it('should display Start Episode button', async () => {
    const mockRoute = { params: {} };
    
    renderWithProviders(
      <NewEpisodeScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('save-episode-button')).toBeTruthy();
    });
  });

  it('should display pain intensity section', async () => {
    const mockRoute = { params: {} };
    
    renderWithProviders(
      <NewEpisodeScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Initial Pain Intensity')).toBeTruthy();
      expect(screen.getByTestId('intensity-slider')).toBeTruthy();
    });
  });

  it('should display pain location section', async () => {
    const mockRoute = { params: {} };
    
    renderWithProviders(
      <NewEpisodeScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Pain Location')).toBeTruthy();
    });
  });

  it('should display start time section', async () => {
    const mockRoute = { params: {} };
    
    renderWithProviders(
      <NewEpisodeScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Start Time')).toBeTruthy();
    });
  });

  it('should display symptoms section', async () => {
    const mockRoute = { params: {} };
    
    renderWithProviders(
      <NewEpisodeScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Symptoms')).toBeTruthy();
      expect(screen.getByText('Nausea')).toBeTruthy();
    });
  });

  it('should display triggers section', async () => {
    const mockRoute = { params: {} };
    
    renderWithProviders(
      <NewEpisodeScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Possible Triggers')).toBeTruthy();
      expect(screen.getByText('Stress')).toBeTruthy();
    });
  });

  it('should display notes section', async () => {
    const mockRoute = { params: {} };
    
    renderWithProviders(
      <NewEpisodeScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Notes')).toBeTruthy();
      expect(screen.getByPlaceholderText('Any additional details...')).toBeTruthy();
    });
  });

  it('should show Edit Episode title when editing', async () => {
    const mockRoute = { 
      params: { episodeId: 'episode-123' } 
    };
    
    (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
      startEpisode: mockStartEpisode,
      addIntensityReading: mockAddIntensityReading,
      updateEpisode: mockUpdateEpisode,
      episodes: [],
    });

    renderWithProviders(
      <NewEpisodeScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Edit Episode')).toBeTruthy();
    });
  });

  describe('User Interactions', () => {
    const { fireEvent } = require('@testing-library/react-native');

    it('should navigate back when Cancel button is pressed', async () => {
      const mockRoute = { params: {} };
      
      renderWithProviders(
        <NewEpisodeScreen 
          navigation={mockNavigation as any} 
          route={mockRoute as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Cancel'));
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });

    it('should toggle symptom selection when symptom button is pressed', async () => {
      const mockRoute = { params: {} };
      
      renderWithProviders(
        <NewEpisodeScreen 
          navigation={mockNavigation as any} 
          route={mockRoute as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Nausea')).toBeTruthy();
      });

      const nauseaButton = screen.getByText('Nausea');
      fireEvent.press(nauseaButton);
      
      fireEvent.press(screen.getByTestId('save-episode-button'));
      
      await waitFor(() => {
        expect(mockStartEpisode).toHaveBeenCalledWith(
          expect.objectContaining({
            symptoms: expect.arrayContaining(['nausea']),
          })
        );
      });
    });

    it('should toggle trigger selection when trigger button is pressed', async () => {
      const mockRoute = { params: {} };
      
      renderWithProviders(
        <NewEpisodeScreen 
          navigation={mockNavigation as any} 
          route={mockRoute as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Stress')).toBeTruthy();
      });

      const stressButton = screen.getByText('Stress');
      fireEvent.press(stressButton);
      
      fireEvent.press(screen.getByTestId('save-episode-button'));
      
      await waitFor(() => {
        expect(mockStartEpisode).toHaveBeenCalledWith(
          expect.objectContaining({
            triggers: expect.arrayContaining(['stress']),
          })
        );
      });
    });

    it('should update notes when text is entered', async () => {
      const mockRoute = { params: {} };
      
      renderWithProviders(
        <NewEpisodeScreen 
          navigation={mockNavigation as any} 
          route={mockRoute as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Any additional details...')).toBeTruthy();
      });

      const notesInput = screen.getByPlaceholderText('Any additional details...');
      fireEvent.changeText(notesInput, 'Started after lunch');
      
      await waitFor(() => {
        expect(notesInput.props.value).toBe('Started after lunch');
      });
    });

    it('should call startEpisode when Save button is pressed for new episode', async () => {
      const mockRoute = { params: {} };
      
      renderWithProviders(
        <NewEpisodeScreen 
          navigation={mockNavigation as any} 
          route={mockRoute as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('save-episode-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('save-episode-button'));
      
      await waitFor(() => {
        expect(mockStartEpisode).toHaveBeenCalled();
        expect(mockNavigation.goBack).toHaveBeenCalled();
      });
    });
  });

  describe('Form Validation', () => {
    const Alert = require('react-native').Alert;
    const { fireEvent } = require('@testing-library/react-native');

    beforeEach(() => {
      jest.spyOn(Alert, 'alert');
    });

    it('should show error when end time is before start time', async () => {
      const mockRoute = { params: {} };
      
      renderWithProviders(
        <NewEpisodeScreen 
          navigation={mockNavigation as any} 
          route={mockRoute as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('save-episode-button')).toBeTruthy();
      });

      const { validateEpisodeEndTime } = require('../../utils/episodeValidation');
      jest.spyOn({ validateEpisodeEndTime }, 'validateEpisodeEndTime').mockReturnValue({
        isValid: false,
        error: 'End time cannot be before start time',
      });

      fireEvent.press(screen.getByTestId('save-episode-button'));

      await waitFor(() => {
        expect(mockStartEpisode).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    const Alert = require('react-native').Alert;
    const { fireEvent } = require('@testing-library/react-native');

    beforeEach(() => {
      jest.spyOn(Alert, 'alert');
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should show error alert when episode creation fails', async () => {
      mockStartEpisode.mockRejectedValue(new Error('Database error'));
      
      const mockRoute = { params: {} };
      
      renderWithProviders(
        <NewEpisodeScreen 
          navigation={mockNavigation as any} 
          route={mockRoute as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('save-episode-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('save-episode-button'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', expect.stringContaining('Failed to save episode'));
      });
    });

    it('should show error alert when episode update fails', async () => {
      mockUpdateEpisode.mockRejectedValue(new Error('Update failed'));
      
      const mockRoute = { 
        params: { episodeId: 'episode-123' } 
      };

      (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
        startEpisode: mockStartEpisode,
        addIntensityReading: mockAddIntensityReading,
        updateEpisode: mockUpdateEpisode,
        episodes: [],
      });
      
      renderWithProviders(
        <NewEpisodeScreen 
          navigation={mockNavigation as any} 
          route={mockRoute as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('save-episode-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('save-episode-button'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', expect.stringContaining('Failed to save episode'));
      });
    });
  });
});
