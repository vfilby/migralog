import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import ErrorLogsScreen from '../ErrorLogsScreen';
import { ThemeProvider } from '../../theme/ThemeContext';

const mockErrorLogger = {
  getLogs: jest.fn(),
  clearLogs: jest.fn(),
  log: jest.fn(),
};

jest.mock('../../services/errorLogger', () => ({
  errorLogger: mockErrorLogger,
  ErrorLog: {},
}));

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    goBack: mockGoBack,
  }),
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    {children}
  </ThemeProvider>
);

const mockRoute = {
  key: 'error-logs',
  name: 'ErrorLogs' as const,
};

describe('ErrorLogsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockErrorLogger.getLogs.mockResolvedValue([]);
  });

  describe('Rendering', () => {
    it('renders without crashing', async () => {
      const { getByTestId } = render(
        <ErrorLogsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByTestId('error-logs-screen')).toBeTruthy();
      });
    });

    it('displays correct header title', async () => {
      const { getByText } = render(
        <ErrorLogsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByText('Error Logs')).toBeTruthy();
      });
    });

    it('shows empty state when no logs exist', async () => {
      mockErrorLogger.getLogs.mockResolvedValue([]);

      const { getByText } = render(
        <ErrorLogsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      
      await waitFor(() => {
        expect(getByText('No Errors')).toBeTruthy();
        expect(getByText('No error logs have been recorded yet')).toBeTruthy();
      });
    });

  });

  describe('Accessibility', () => {
    it('has proper testID for the screen', async () => {
      const { getByTestId } = render(
        <ErrorLogsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByTestId('error-logs-screen')).toBeTruthy();
      });
    });

    it('provides accessible empty state content', async () => {
      mockErrorLogger.getLogs.mockResolvedValue([]);

      const { getByText } = render(
        <ErrorLogsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      
      await waitFor(() => {
        expect(getByText('No Errors')).toBeTruthy();
        expect(getByText('No error logs have been recorded yet')).toBeTruthy();
      });
    });

    it('provides accessible header with title', async () => {
      const { getByText } = render(
        <ErrorLogsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      
      await waitFor(() => {
        expect(getByText('Error Logs')).toBeTruthy();
      });
    });
  });

  describe('Theme Support', () => {
    it('renders correctly with theme integration', async () => {
      const { getByTestId } = render(
        <ErrorLogsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByTestId('error-logs-screen')).toBeTruthy();
      });
    });
  });
});
