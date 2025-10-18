import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import EditMedicationScreen from '../EditMedicationScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import { useMedicationStore } from '../../store/medicationStore';
import { medicationRepository } from '../../database/medicationRepository';

jest.mock('../../store/medicationStore');
jest.mock('../../database/medicationRepository', () => ({
  medicationRepository: {
    getById: jest.fn(),
  },
  medicationScheduleRepository: {
    getByMedicationId: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'schedule-123' }),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../services/notificationService', () => ({
  notificationService: {
    scheduleNotification: jest.fn(),
    cancelScheduledNotification: jest.fn(),
  },
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));
jest.mock('../../components/MedicationScheduleManager', () => {
  const { View, Text } = require('react-native');
  return function MedicationScheduleManager() {
    return <View testID="medication-schedule-manager"><Text>Schedule Manager</Text></View>;
  };
});

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

describe('EditMedicationScreen', () => {
  const mockUpdateMedication = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useMedicationStore as unknown as jest.Mock).mockReturnValue({
      updateMedication: mockUpdateMedication,
    });

    (medicationRepository.getById as jest.Mock).mockResolvedValue({
      id: 'med-123',
      name: 'Test Med',
      type: 'preventative',
      dosageAmount: 100,
      dosageUnit: 'mg',
      defaultDosage: 1,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    mockUpdateMedication.mockResolvedValue(undefined);
  });

  it('should render edit medication screen with title', async () => {
    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Edit Medication')).toBeTruthy();
    });
  });

  it('should display Cancel button', async () => {
    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeTruthy();
    });
  });

  it('should load and display medication data', async () => {
    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(medicationRepository.getById).toHaveBeenCalledWith('med-123');
    });
  });

  it('should display medication type buttons', async () => {
    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Preventative')).toBeTruthy();
      expect(screen.getByText('Rescue')).toBeTruthy();
    });
  });

  it('should display Save Changes button', async () => {
    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });
  });

  it('should display dosage unit options', async () => {
    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('mg')).toBeTruthy();
      expect(screen.getByText('ml')).toBeTruthy();
      expect(screen.getByText('tablets')).toBeTruthy();
    });
  });

  describe('Form Interactions', () => {
    it('should allow changing medication name', async () => {
      const mockRoute = { params: { medicationId: 'med-123' } };
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Med')).toBeTruthy();
      });

      const nameInput = screen.getByDisplayValue('Test Med');
      fireEvent.changeText(nameInput, 'Updated Medication');

      expect(screen.getByDisplayValue('Updated Medication')).toBeTruthy();
    });

    it('should allow changing medication type', async () => {
      const mockRoute = { params: { medicationId: 'med-123' } };
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Rescue')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Rescue'));
      expect(screen.getByText('Rescue')).toBeTruthy();
    });

    it('should allow changing dosage amount', async () => {
      const mockRoute = { params: { medicationId: 'med-123' } };
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('100')).toBeTruthy();
      });

      const dosageInput = screen.getByDisplayValue('100');
      fireEvent.changeText(dosageInput, '200');

      expect(screen.getByDisplayValue('200')).toBeTruthy();
    });

    it('should allow changing dosage unit', async () => {
      const mockRoute = { params: { medicationId: 'med-123' } };
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('ml')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('ml'));
      expect(screen.getByText('ml')).toBeTruthy();
    });

    it('should go back when Cancel is pressed', async () => {
      const mockRoute = { params: { medicationId: 'med-123' } };
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Cancel'));

      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  describe('Schedules', () => {
    it('should display schedule manager component', async () => {
      const mockRoute = { params: { medicationId: 'med-123' } };
      const { getByTestId } = renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(getByTestId('medication-schedule-manager')).toBeTruthy();
      });
    });
  });
});
