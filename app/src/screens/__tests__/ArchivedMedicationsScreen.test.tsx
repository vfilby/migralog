import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import ArchivedMedicationsScreen from '../ArchivedMedicationsScreen';
import { ThemeProvider } from '../../theme/ThemeContext';

const mockMedicationRepository = {
  getArchived: jest.fn(),
};

const mockUnarchiveMedication = jest.fn();

jest.mock('../../database/medicationRepository', () => ({
  medicationRepository: mockMedicationRepository,
}));

jest.mock('../../store/medicationStore', () => ({
  useMedicationStore: jest.fn(() => ({
    unarchiveMedication: mockUnarchiveMedication,
    medications: [],
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

describe('ArchivedMedicationsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMedicationRepository.getArchived.mockResolvedValue([]);
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
      mockMedicationRepository.getArchived.mockResolvedValue([]);

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
      mockMedicationRepository.getArchived.mockResolvedValue([]);

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

});
