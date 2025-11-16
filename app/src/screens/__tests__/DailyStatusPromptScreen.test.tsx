import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import DailyStatusPromptScreen from '../DailyStatusPromptScreen';
import { ThemeProvider } from '../../theme/ThemeContext';
import { Alert } from 'react-native';

const mockLogDayStatus = jest.fn();
const mockGetEpisodesForDate = jest.fn();

jest.mock('../../store/dailyStatusStore', () => ({
  useDailyStatusStore: jest.fn(() => ({
    logDayStatus: mockLogDayStatus,
    getEpisodesForDate: mockGetEpisodesForDate,
    todayStatus: null,
    logs: [],
    loading: false,
    error: null,
  })),
}));

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: mockNavigate,
  }),
}));

jest.spyOn(Alert, 'alert');

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    {children}
  </ThemeProvider>
);

    const mockRoute = {
      key: 'DailyStatusPrompt',
      name: 'DailyStatusPrompt' as const,
      params: { date: '2025-01-15' },
    };

describe('DailyStatusPromptScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogDayStatus.mockResolvedValue(undefined);
    mockGetEpisodesForDate.mockResolvedValue([]);
  });

  describe('Rendering', () => {
    it('renders without crashing', async () => {
      const { getByTestId } = render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByTestId('daily-status-prompt-screen')).toBeTruthy();
      });
    });

    it('displays correct header title', async () => {
      const { getByText } = render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByText('Daily Check-in')).toBeTruthy();
      });
    });

    it('displays status options', async () => {
      const { getByText } = render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      
      await waitFor(() => {
        expect(getByText('Clear Day')).toBeTruthy();
        expect(getByText('Not Clear')).toBeTruthy();
      });
    });

    it('displays close button', async () => {
      const { getByText } = render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      
      await waitFor(() => {
        expect(getByText('Close')).toBeTruthy();
      });
    });
  });

  describe('User Interactions', () => {
    it('navigates back when close button is pressed', async () => {
      const { getByText } = render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      
      await waitFor(() => {
        expect(getByText('Close')).toBeTruthy();
      });

      const closeButton = getByText('Close');
      fireEvent.press(closeButton);

      expect(mockGoBack).toHaveBeenCalled();
    });

    it('shows save button', async () => {
      const { getByText } = render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      
      await waitFor(() => {
        expect(getByText('Save')).toBeTruthy();
      });
    });
  });

  describe('Form Validation', () => {
    it('displays status options for selection', async () => {
      const { getByText } = render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      
      await waitFor(() => {
        expect(getByText('Clear Day')).toBeTruthy();
        expect(getByText('Not Clear')).toBeTruthy();
      });
    });

    it('shows descriptive text for status options', async () => {
      const { getByText } = render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      
      await waitFor(() => {
        expect(getByText('No symptoms or concerns')).toBeTruthy();
        expect(getByText('Prodrome, postdrome, or anxiety')).toBeTruthy();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper testID for the screen', async () => {
      const { getByTestId } = render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByTestId('daily-status-prompt-screen')).toBeTruthy();
      });
    });

    it('provides accessible labels for status options', async () => {
      const { getByText } = render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      
      await waitFor(() => {
        expect(getByText('Clear Day')).toBeTruthy();
        expect(getByText('Not Clear')).toBeTruthy();
      });
    });

    it('provides descriptive help text', async () => {
      const { getByText } = render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      
      await waitFor(() => {
        expect(getByText('No symptoms or concerns')).toBeTruthy();
        expect(getByText('Prodrome, postdrome, or anxiety')).toBeTruthy();
      });
    });
  });

  describe('Theme Support', () => {
    it('renders correctly with theme integration', async () => {
      const { getByTestId } = render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByTestId('daily-status-prompt-screen')).toBeTruthy();
      });
    });
  });

  describe('Episode Integration', () => {
    it('loads episodes on mount', async () => {
      render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(mockGetEpisodesForDate).toHaveBeenCalledWith('2025-01-15');
      });
    });

    it('displays episode info when episodes exist', async () => {
      const mockEpisode = {
        id: 'episode-1',
        startTime: new Date('2025-01-15T10:00:00').getTime(),
        endTime: new Date('2025-01-15T14:30:00').getTime(),
        notes: 'Stress migraine',
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockGetEpisodesForDate.mockResolvedValue([mockEpisode]);

      const { getByText } = render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByText('🔴 Episode Day')).toBeTruthy();
        expect(getByText('You had an episode on this day:')).toBeTruthy();
        expect(getByText(/Stress migraine/)).toBeTruthy();
      });
    });

    it('displays multiple episodes when present', async () => {
      const mockEpisodes = [
        {
          id: 'episode-1',
          startTime: new Date('2025-01-15T10:00:00').getTime(),
          endTime: new Date('2025-01-15T14:00:00').getTime(),
          notes: '',
          locations: [],
          qualities: [],
          symptoms: [],
          triggers: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'episode-2',
          startTime: new Date('2025-01-15T18:00:00').getTime(),
          endTime: new Date('2025-01-15T20:00:00').getTime(),
          notes: '',
          locations: [],
          qualities: [],
          symptoms: [],
          triggers: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      mockGetEpisodesForDate.mockResolvedValue(mockEpisodes);

      const { getByText } = render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByText('You had 2 episodes on this day:')).toBeTruthy();
      });
    });

    it('hides status buttons when episodes exist', async () => {
      const mockEpisode = {
        id: 'episode-1',
        startTime: new Date('2025-01-15T10:00:00').getTime(),
        endTime: new Date('2025-01-15T14:00:00').getTime(),
        notes: '',
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockGetEpisodesForDate.mockResolvedValue([mockEpisode]);

      const { queryByTestId } = render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(queryByTestId('green-day-button')).toBeNull();
        expect(queryByTestId('yellow-day-button')).toBeNull();
      });
    });

    it('shows automatic red day message when episodes exist', async () => {
      const mockEpisode = {
        id: 'episode-1',
        startTime: new Date('2025-01-15T10:00:00').getTime(),
        endTime: new Date('2025-01-15T14:00:00').getTime(),
        notes: '',
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockGetEpisodesForDate.mockResolvedValue([mockEpisode]);

      const { getByText } = render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByText('This day is automatically marked as red based on your episode data.')).toBeTruthy();
      });
    });

    it('formats episode time correctly for ended episodes', async () => {
      const mockEpisode = {
        id: 'episode-1',
        startTime: new Date('2025-01-15T10:30:00').getTime(),
        endTime: new Date('2025-01-15T14:45:00').getTime(),
        notes: '',
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockGetEpisodesForDate.mockResolvedValue([mockEpisode]);

      const { getByText } = render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByText(/10:30 AM - 2:45 PM/)).toBeTruthy();
      });
    });

    it('formats episode time correctly for ongoing episodes', async () => {
      const mockEpisode = {
        id: 'episode-1',
        startTime: new Date('2025-01-15T10:30:00').getTime(),
        endTime: null,
        notes: '',
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockGetEpisodesForDate.mockResolvedValue([mockEpisode]);

      const { getByText } = render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByText(/Started at 10:30 AM/)).toBeTruthy();
      });
    });

    it('formats episode duration correctly', async () => {
      const mockEpisode = {
        id: 'episode-1',
        startTime: new Date('2025-01-15T10:00:00').getTime(),
        endTime: new Date('2025-01-15T14:30:00').getTime(),
        notes: '',
        locations: [],
        qualities: [],
        symptoms: [],
        triggers: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockGetEpisodesForDate.mockResolvedValue([mockEpisode]);

      const { getByText } = render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByText(/Duration: 4h 30m/)).toBeTruthy();
      });
    });
  });

  describe('Status Selection and Saving', () => {
    it('allows selecting green status', async () => {
      const { getByTestId } = render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('green-day-button')).toBeTruthy();
      });

      const greenButton = getByTestId('green-day-button');
      fireEvent.press(greenButton);

      await waitFor(() => {
        expect(getByTestId('save-status-button')).toBeTruthy();
      });

      const saveButton = getByTestId('save-status-button');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockLogDayStatus).toHaveBeenCalledWith(
          '2025-01-15',
          'green',
          undefined,
          undefined,
          true
        );
      });
    });

    it('allows selecting yellow status', async () => {
      const { getByTestId } = render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('yellow-day-button')).toBeTruthy();
      });

      const yellowButton = getByTestId('yellow-day-button');
      fireEvent.press(yellowButton);

      await waitFor(() => {
        expect(getByTestId('save-status-button')).toBeTruthy();
      });

      const saveButton = getByTestId('save-status-button');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockLogDayStatus).toHaveBeenCalledWith(
          '2025-01-15',
          'yellow',
          undefined,
          undefined,
          true
        );
      });
    });

    it('navigates back after successful save', async () => {
      const { getByTestId } = render(
        <DailyStatusPromptScreen navigation={{ goBack: mockGoBack, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('green-day-button')).toBeTruthy();
      });

      const greenButton = getByTestId('green-day-button');
      fireEvent.press(greenButton);

      await waitFor(() => {
        expect(getByTestId('save-status-button')).toBeTruthy();
      });

      const saveButton = getByTestId('save-status-button');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockGoBack).toHaveBeenCalled();
      });
    });
  });
});
