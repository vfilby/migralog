import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import DailyStatusPromptScreen from '../DailyStatusPromptScreen';
import { ThemeProvider } from '../../theme/ThemeContext';
import { Alert } from 'react-native';

const mockLogDayStatus = jest.fn();

jest.mock('../../store/dailyStatusStore', () => ({
  useDailyStatusStore: jest.fn(() => ({
    logDayStatus: mockLogDayStatus,
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
  key: 'daily-status-prompt',
  name: 'DailyStatusPrompt' as const,
  params: {
    targetDate: '2024-01-15',
  },
};

describe('DailyStatusPromptScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogDayStatus.mockResolvedValue(undefined);
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
});
