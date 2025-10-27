import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import AddMedicationScreen from '../AddMedicationScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import { useMedicationStore } from '../../store/medicationStore';

jest.mock('../../store/medicationStore');
jest.mock('../../database/medicationRepository', () => ({
  medicationScheduleRepository: {
    create: jest.fn().mockResolvedValue({ id: 'schedule-123' }),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../services/errorLogger', () => ({
  errorLogger: {
    log: jest.fn(),
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

describe('AddMedicationScreen', () => {
  const mockAddMedication = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useMedicationStore as unknown as jest.Mock).mockReturnValue({
      addMedication: mockAddMedication,
    });

    mockAddMedication.mockResolvedValue({ id: 'new-med-123' });
  });

  it('should render add medication screen with title', async () => {
    const mockRoute = { params: {} };

    renderWithProviders(
      <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Add Medication')).toBeTruthy();
    });
  });

  it('should display Cancel button', async () => {
    const mockRoute = { params: {} };

    renderWithProviders(
      <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeTruthy();
    });
  });

  it('should display medication type buttons', async () => {
    const mockRoute = { params: {} };

    renderWithProviders(
      <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Preventative')).toBeTruthy();
      expect(screen.getByText('Rescue')).toBeTruthy();
    });
  });

  it('should display medication name input', async () => {
    const mockRoute = { params: {} };

    renderWithProviders(
      <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Start typing (e.g., Advil, Sumatriptan)')).toBeTruthy();
    });
  });

  it('should display dosage inputs', async () => {
    const mockRoute = { params: {} };

    renderWithProviders(
      <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('200')).toBeTruthy();
    });
  });

  it('should display notes input', async () => {
    const mockRoute = { params: {} };

    renderWithProviders(
      <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Any additional information...')).toBeTruthy();
    });
  });

  it('should display Save button', async () => {
    const mockRoute = { params: {} };

    renderWithProviders(
      <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Medication')).toBeTruthy();
    });
  });

  it('should display dosage unit options', async () => {
    const mockRoute = { params: {} };

    renderWithProviders(
      <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('mg')).toBeTruthy();
      expect(screen.getByText('ml')).toBeTruthy();
      expect(screen.getByText('tablets')).toBeTruthy();
    });
  });
});
