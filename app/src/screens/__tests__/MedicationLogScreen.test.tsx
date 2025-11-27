import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import MedicationLogScreen from '../medication/MedicationLogScreen';
import { ThemeProvider } from '../../theme/ThemeContext';

const mockMedicationDoseRepository = {
  getAll: jest.fn(),
};

const mockMedicationRepository = {
  getById: jest.fn(),
};

jest.mock('../../database/medicationRepository', () => ({
  medicationDoseRepository: mockMedicationDoseRepository,
  medicationRepository: mockMedicationRepository,
}));

const mockGoBack = jest.fn();
const mockAddListener = jest.fn(() => jest.fn());
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    goBack: mockGoBack,
    addListener: mockAddListener,
    navigate: mockNavigate,
  }),
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    {children}
  </ThemeProvider>
);

const mockRoute = {
  key: 'medication-log',
  name: 'MedicationLog' as const,
};

describe('MedicationLogScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMedicationDoseRepository.getAll.mockResolvedValue([]);
  });

  describe('Rendering', () => {
    it('renders without crashing', async () => {
      const { getByTestId } = render(
        <MedicationLogScreen navigation={{ goBack: mockGoBack, addListener: mockAddListener, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByTestId('medication-log-screen')).toBeTruthy();
      });
    });

    it('displays correct header title', async () => {
      const { getByText } = render(
        <MedicationLogScreen navigation={{ goBack: mockGoBack, addListener: mockAddListener, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByText('Medication Log')).toBeTruthy();
      });
    });

    it('displays back button', async () => {
      const { getByText } = render(
        <MedicationLogScreen navigation={{ goBack: mockGoBack, addListener: mockAddListener, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByText('Back')).toBeTruthy();
      });
    });

  });

  describe('User Interactions', () => {
    it('calls loadDoses when screen focuses', async () => {
      const { getByTestId } = render(
        <MedicationLogScreen navigation={{ goBack: mockGoBack, addListener: mockAddListener, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      
      await waitFor(() => {
        expect(getByTestId('medication-log-screen')).toBeTruthy();
      });
      
      expect(mockAddListener).toHaveBeenCalledWith('focus', expect.any(Function));
    });
  });

  describe('Accessibility', () => {
    it('has proper testID for the screen', async () => {
      const { getByTestId } = render(
        <MedicationLogScreen navigation={{ goBack: mockGoBack, addListener: mockAddListener, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByTestId('medication-log-screen')).toBeTruthy();
      });
    });



    it('provides accessible header', async () => {
      const { getByText } = render(
        <MedicationLogScreen navigation={{ goBack: mockGoBack, addListener: mockAddListener, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      
      await waitFor(() => {
        expect(getByText('Medication Log')).toBeTruthy();
        expect(getByText('Back')).toBeTruthy();
      });
    });
  });

  describe('Theme Support', () => {
    it('renders correctly with theme integration', async () => {
      const { getByTestId } = render(
        <MedicationLogScreen navigation={{ goBack: mockGoBack, addListener: mockAddListener, navigate: mockNavigate } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByTestId('medication-log-screen')).toBeTruthy();
      });
    });
  });
});
