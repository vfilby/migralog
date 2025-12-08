import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ArchivedMedicationsScreen from '../medication/ArchivedMedicationsScreen';
import { ThemeProvider } from '../../theme/ThemeContext';

const mockUnarchiveMedication = jest.fn();
const mockGetArchivedMedications = jest.fn();

jest.mock('../../store/medicationStore', () => ({
  useMedicationStore: jest.fn(() => ({
    unarchiveMedication: mockUnarchiveMedication,
    getArchivedMedications: mockGetArchivedMedications,
    archivedMedications: [],
    loading: false,
  })),
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
  key: 'archived-medications',
  name: 'ArchivedMedications' as const,
};

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('ArchivedMedicationsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetArchivedMedications.mockResolvedValue(undefined);
  });

  describe('Rendering', () => {
    it('renders without crashing', async () => {
      const { getByTestId } = render(
        <ArchivedMedicationsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByTestId('archived-medications-screen')).toBeTruthy();
      });
    });

    it('displays correct header title', async () => {
      const { getByText } = render(
        <ArchivedMedicationsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByText('Archived Medications')).toBeTruthy();
      });
    });

    it('displays back button', async () => {
      const { getByText } = render(
        <ArchivedMedicationsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByText('Back')).toBeTruthy();
      });
    });

    it('shows empty state when no archived medications exist', async () => {
      mockGetArchivedMedications.mockResolvedValue(undefined);

      const { getByText } = render(
        <ArchivedMedicationsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      
      await waitFor(() => {
        expect(getByText('No archived medications')).toBeTruthy();
        expect(getByText('Archived medications will appear here')).toBeTruthy();
      }, { timeout: 3000 });
    });
  });

  describe('Accessibility', () => {
    it('has proper testID for the screen', async () => {
      const { getByTestId } = render(
        <ArchivedMedicationsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByTestId('archived-medications-screen')).toBeTruthy();
      });
    });

    it('provides accessible header', async () => {
      const { getByText } = render(
        <ArchivedMedicationsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      
      await waitFor(() => {
        expect(getByText('Archived Medications')).toBeTruthy();
        expect(getByText('Back')).toBeTruthy();
      });
    });

    it('provides accessible empty state', async () => {
      mockGetArchivedMedications.mockResolvedValue(undefined);

      const { getByText } = render(
        <ArchivedMedicationsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      
      await waitFor(() => {
        expect(getByText('No archived medications')).toBeTruthy();
      }, { timeout: 3000 });
    });
  });

  describe('Theme Support', () => {
    it('renders correctly with theme integration', async () => {
      const { getByTestId } = render(
        <ArchivedMedicationsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByTestId('archived-medications-screen')).toBeTruthy();
      });
    });
  });

  describe('Interactions', () => {
    it('navigates back when back button is pressed', async () => {
      const { getByText } = render(
        <ArchivedMedicationsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByText('Back')).toBeTruthy();
      });

      fireEvent.press(getByText('Back'));

      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles loading error gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Override the mock for this specific test
      mockGetArchivedMedications.mockImplementation(() => {
        return Promise.reject(new Error('Network error'));
      });

      const { getByText, queryByText } = render(
        <ArchivedMedicationsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        // Should show empty state even on error
        expect(getByText('No archived medications')).toBeTruthy();
        expect(queryByText('Loading...')).toBeNull();
      });

      consoleSpy.mockRestore();
    });
  });

});
