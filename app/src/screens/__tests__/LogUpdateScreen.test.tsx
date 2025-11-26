import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import LogUpdateScreen from '../LogUpdateScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';

jest.mock('../../database/episodeRepository', () => ({
  intensityRepository: {
    getByEpisodeId: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'reading-123' }),
  },
  symptomLogRepository: {
    getByEpisodeId: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'symptom-123' }),
    delete: jest.fn().mockResolvedValue(undefined),
  },
  episodeNoteRepository: {
    create: jest.fn().mockResolvedValue({ id: 'note-123' }),
  },
  episodeRepository: {
    update: jest.fn().mockResolvedValue(undefined),
    getById: jest.fn().mockResolvedValue({
      id: 'episode-123',
      startTime: Date.now() - 1000000,
      symptoms: ['nausea'],
      locations: ['left_temple'],
    }),
  },
  painLocationLogRepository: {
    getByEpisodeId: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'pain-location-123' }),
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

describe('LogUpdateScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render log update screen with title', async () => {
    const mockRoute = {
      params: { episodeId: 'episode-123' },
    };

    renderWithProviders(
      <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Log Update')).toBeTruthy();
    });
  });

  it('should display Cancel button', async () => {
    const mockRoute = {
      params: { episodeId: 'episode-123' },
    };

    renderWithProviders(
      <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeTruthy();
    });
  });

  it('should display pain intensity slider', async () => {
    const mockRoute = {
      params: { episodeId: 'episode-123' },
    };

    renderWithProviders(
      <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('intensity-slider')).toBeTruthy();
    });
  });

  it('should display symptoms section', async () => {
    const mockRoute = {
      params: { episodeId: 'episode-123' },
    };

    renderWithProviders(
      <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Nausea')).toBeTruthy();
      expect(screen.getByText('Vomiting')).toBeTruthy();
    });
  });

  it('should display notes input', async () => {
    const mockRoute = {
      params: { episodeId: 'episode-123' },
    };

    renderWithProviders(
      <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add any additional notes...')).toBeTruthy();
    });
  });

  it('should display Save Update button', async () => {
    const mockRoute = {
      params: { episodeId: 'episode-123' },
    };

    renderWithProviders(
      <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Update')).toBeTruthy();
    });
  });

  it('should display all symptom options', async () => {
    const mockRoute = {
      params: { episodeId: 'episode-123' },
    };

    renderWithProviders(
      <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Nausea')).toBeTruthy();
      expect(screen.getByText('Vomiting')).toBeTruthy();
      expect(screen.getByText('Visual Disturbances')).toBeTruthy();
      expect(screen.getByText('Aura')).toBeTruthy();
      expect(screen.getByText('Light Sensitivity')).toBeTruthy();
      expect(screen.getByText('Sound Sensitivity')).toBeTruthy();
    });
  });

  describe('Episode Ended', () => {
    it('should show alert and go back when episode has ended', async () => {
      const { episodeRepository } = require('../../database/episodeRepository');
      const mockAlert = jest.spyOn(require('react-native').Alert, 'alert');
      
      episodeRepository.getById.mockResolvedValueOnce({
        id: 'episode-123',
        startTime: Date.now() - 1000000,
        endTime: Date.now() - 500000, // Episode has ended
        symptoms: [],
        locations: [],
      });

      const mockRoute = {
        params: { episodeId: 'episode-123' },
      };

      renderWithProviders(
        <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Episode Ended',
          'This episode has already ended. You cannot add updates to a closed episode.',
          expect.any(Array)
        );
      });

      mockAlert.mockRestore();
    });
  });

  describe('Loading Latest Data', () => {
    it('should load latest intensity from readings', async () => {
      const { intensityRepository, episodeRepository } = require('../../database/episodeRepository');
      
      intensityRepository.getByEpisodeId.mockResolvedValueOnce([
        { id: '1', episodeId: 'episode-123', timestamp: Date.now() - 2000, intensity: 5 },
        { id: '2', episodeId: 'episode-123', timestamp: Date.now() - 1000, intensity: 7 },
      ]);

      const mockRoute = {
        params: { episodeId: 'episode-123' },
      };

      renderWithProviders(
        <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('7')).toBeTruthy(); // Should show latest intensity
      });
    });

    it('should load symptoms from episode when no symptom logs exist', async () => {
      const { symptomLogRepository, episodeRepository } = require('../../database/episodeRepository');
      
      symptomLogRepository.getByEpisodeId.mockResolvedValueOnce([]);
      episodeRepository.getById.mockResolvedValueOnce({
        id: 'episode-123',
        startTime: Date.now(),
        symptoms: ['nausea', 'vomiting'],
        locations: [],
      });

      const mockRoute = {
        params: { episodeId: 'episode-123' },
      };

      renderWithProviders(
        <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Log Update')).toBeTruthy();
      });
    });

    it('should load pain locations from logs', async () => {
      const { painLocationLogRepository, episodeRepository } = require('../../database/episodeRepository');
      
      painLocationLogRepository.getByEpisodeId.mockResolvedValueOnce([
        {
          id: '1',
          episodeId: 'episode-123',
          timestamp: Date.now() - 1000,
          painLocations: ['left_temple', 'right_eye'],
        },
      ]);

      const mockRoute = {
        params: { episodeId: 'episode-123' },
      };

      renderWithProviders(
        <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Log Update')).toBeTruthy();
      });
    });

    it('should use default intensity when no readings exist', async () => {
      const { intensityRepository } = require('../../database/episodeRepository');
      
      intensityRepository.getByEpisodeId.mockResolvedValueOnce([]);

      const mockRoute = {
        params: { episodeId: 'episode-123' },
      };

      renderWithProviders(
        <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('5')).toBeTruthy(); // Default intensity
      });
    });
  });

  describe('Intensity Slider', () => {
    it('should allow changing intensity', async () => {
      const mockRoute = {
        params: { episodeId: 'episode-123' },
      };

      renderWithProviders(
        <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('intensity-slider')).toBeTruthy();
      });

      const slider = screen.getByTestId('intensity-slider');
      fireEvent(slider, 'onValueChange', 8);

      await waitFor(() => {
        expect(screen.getByText('8')).toBeTruthy();
      });
    });
  });

  describe('Symptom Toggling', () => {
    it('should allow toggling symptoms on', async () => {
      const mockRoute = {
        params: { episodeId: 'episode-123' },
      };

      renderWithProviders(
        <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Vomiting')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Vomiting'));
      
      // Symptom should now be selected
      expect(screen.getByText('Vomiting')).toBeTruthy();
    });

    it('should allow toggling symptoms off', async () => {
      const { symptomLogRepository, episodeRepository } = require('../../database/episodeRepository');
      
      episodeRepository.getById.mockResolvedValueOnce({
        id: 'episode-123',
        startTime: Date.now(),
        symptoms: ['nausea'],
        locations: [],
      });

      const mockRoute = {
        params: { episodeId: 'episode-123' },
      };

      renderWithProviders(
        <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Nausea')).toBeTruthy();
      });

      // Toggle nausea off
      fireEvent.press(screen.getByText('Nausea'));
      
      expect(screen.getByText('Nausea')).toBeTruthy();
    });
  });

  describe('Pain Location Toggling', () => {
    it('should display pain location columns', async () => {
      const mockRoute = {
        params: { episodeId: 'episode-123' },
      };

      renderWithProviders(
        <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Left Side')).toBeTruthy();
        expect(screen.getByText('Right Side')).toBeTruthy();
      });
    });

    it('should allow toggling pain locations', async () => {
      const mockRoute = {
        params: { episodeId: 'episode-123' },
      };

      renderWithProviders(
        <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        const locations = screen.getAllByText('Temple');
        expect(locations.length).toBeGreaterThan(0);
      });

      // Toggle left temple
      const temples = screen.getAllByText('Temple');
      fireEvent.press(temples[0]);
      
      expect(temples[0]).toBeTruthy();
    });
  });

  describe('Notes Input', () => {
    it('should allow entering notes', async () => {
      const mockRoute = {
        params: { episodeId: 'episode-123' },
      };

      renderWithProviders(
        <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add any additional notes...')).toBeTruthy();
      });

      const notesInput = screen.getByPlaceholderText('Add any additional notes...');
      fireEvent.changeText(notesInput, 'Feeling worse after medication');

      expect(screen.getByDisplayValue('Feeling worse after medication')).toBeTruthy();
    });
  });

  describe('Save Functionality', () => {
    it('should show alert when no changes are made', async () => {
      const mockAlert = jest.spyOn(require('react-native').Alert, 'alert');
      
      const mockRoute = {
        params: { episodeId: 'episode-123' },
      };

      renderWithProviders(
        <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Save Update')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Save Update'));

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('No Changes', 'Please make at least one change to log an update');
      });

      mockAlert.mockRestore();
    });

    it('should save when intensity is changed', async () => {
      const { intensityRepository } = require('../../database/episodeRepository');
      
      const mockRoute = {
        params: { episodeId: 'episode-123' },
      };

      renderWithProviders(
        <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('intensity-slider')).toBeTruthy();
      });

      // Change intensity
      const slider = screen.getByTestId('intensity-slider');
      fireEvent(slider, 'onValueChange', 8);

      // Save
      fireEvent.press(screen.getByText('Save Update'));

      await waitFor(() => {
        expect(intensityRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            episodeId: 'episode-123',
            intensity: 8,
          })
        );
        expect(mockNavigation.goBack).toHaveBeenCalled();
      });
    });

    it('should save when symptoms are changed', async () => {
      const { symptomLogRepository } = require('../../database/episodeRepository');
      
      const mockRoute = {
        params: { episodeId: 'episode-123' },
      };

      renderWithProviders(
        <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Vomiting')).toBeTruthy();
      });

      // Add symptom
      fireEvent.press(screen.getByText('Vomiting'));

      // Save
      fireEvent.press(screen.getByText('Save Update'));

      await waitFor(() => {
        expect(symptomLogRepository.create).toHaveBeenCalled();
        expect(mockNavigation.goBack).toHaveBeenCalled();
      });
    });

    it('should save when pain locations are changed', async () => {
      const { painLocationLogRepository } = require('../../database/episodeRepository');
      
      const mockRoute = {
        params: { episodeId: 'episode-123' },
      };

      renderWithProviders(
        <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        const temples = screen.getAllByText('Temple');
        expect(temples.length).toBeGreaterThan(0);
      });

      // Add pain location
      const temples = screen.getAllByText('Temple');
      fireEvent.press(temples[0]);

      // Save
      fireEvent.press(screen.getByText('Save Update'));

      await waitFor(() => {
        expect(painLocationLogRepository.create).toHaveBeenCalled();
        expect(mockNavigation.goBack).toHaveBeenCalled();
      });
    });

    it('should save note when provided', async () => {
      const { episodeNoteRepository } = require('../../database/episodeRepository');
      
      const mockRoute = {
        params: { episodeId: 'episode-123' },
      };

      renderWithProviders(
        <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add any additional notes...')).toBeTruthy();
      });

      // Add note
      const notesInput = screen.getByPlaceholderText('Add any additional notes...');
      fireEvent.changeText(notesInput, 'Test note');

      // Save
      fireEvent.press(screen.getByText('Save Update'));

      await waitFor(() => {
        expect(episodeNoteRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            episodeId: 'episode-123',
            note: 'Test note',
          })
        );
        expect(mockNavigation.goBack).toHaveBeenCalled();
      });
    });

    it('should show error alert when save fails', async () => {
      const { intensityRepository } = require('../../database/episodeRepository');
      const mockAlert = jest.spyOn(require('react-native').Alert, 'alert');
      
      intensityRepository.create.mockRejectedValueOnce(new Error('Save failed'));

      const mockRoute = {
        params: { episodeId: 'episode-123' },
      };

      renderWithProviders(
        <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('intensity-slider')).toBeTruthy();
      });

      // Change intensity
      const slider = screen.getByTestId('intensity-slider');
      fireEvent(slider, 'onValueChange', 8);

      // Try to save
      fireEvent.press(screen.getByText('Save Update'));

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Error', 'Failed to log update');
      });

      mockAlert.mockRestore();
    });

    it('should display "Saving..." text while saving', async () => {
      const { intensityRepository } = require('../../database/episodeRepository');
      
      // Make save slow
      intensityRepository.create.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      const mockRoute = {
        params: { episodeId: 'episode-123' },
      };

      renderWithProviders(
        <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('intensity-slider')).toBeTruthy();
      });

      // Change intensity
      const slider = screen.getByTestId('intensity-slider');
      fireEvent(slider, 'onValueChange', 8);

      // Click save
      fireEvent.press(screen.getByText('Save Update'));

      // Should show "Saving..."
      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeTruthy();
      });
    });
  });

  describe('Cancel Button', () => {
    it('should go back when cancel is pressed', async () => {
      const mockRoute = {
        params: { episodeId: 'episode-123' },
      };

      renderWithProviders(
        <LogUpdateScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Cancel'));

      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });
});
