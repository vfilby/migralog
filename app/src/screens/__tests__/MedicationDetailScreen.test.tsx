import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import MedicationDetailScreen from '../MedicationDetailScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import { useMedicationStore } from '../../store/medicationStore';
import { useEpisodeStore } from '../../store/episodeStore';
import { medicationRepository, medicationScheduleRepository, medicationDoseRepository } from '../../database/medicationRepository';

jest.mock('../../store/medicationStore');
jest.mock('../../store/episodeStore');
jest.mock('../../database/medicationRepository', () => ({
  medicationRepository: {
    getById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  medicationScheduleRepository: {
    getByMedicationId: jest.fn().mockResolvedValue([]),
  },
  medicationDoseRepository: {
    getByMedicationId: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

describe('MedicationDetailScreen', () => {
  const mockLogDose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useMedicationStore as unknown as jest.Mock).mockReturnValue({
      logDose: mockLogDose,
    });

    (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
      currentEpisode: null,
    });

    (medicationRepository.getById as jest.Mock).mockResolvedValue({
      id: 'med-123',
      name: 'Test Medication',
      type: 'preventative',
      dosageAmount: 100,
      dosageUnit: 'mg',
      defaultQuantity: 1,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    mockLogDose.mockResolvedValue({ id: 'dose-123' });
  });

  it('should render medication detail screen', async () => {
    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(medicationRepository.getById).toHaveBeenCalledWith('med-123');
    });
  });

  it('should display medication name', async () => {
    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Medication')).toBeTruthy();
    });
  });

  it('should display medication type badge', async () => {
    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Preventative')).toBeTruthy();
    });
  });

  it('should display dosage information', async () => {
    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText(/100mg/)).toBeTruthy();
    });
  });

  it('should load schedules for preventative medications', async () => {
    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(medicationScheduleRepository.getByMedicationId).toHaveBeenCalledWith('med-123');
    });
  });

  it('should load dose history', async () => {
    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(medicationDoseRepository.getByMedicationId).toHaveBeenCalledWith('med-123');
    });
  });

  it('should display rescue medication type badge', async () => {
    (medicationRepository.getById as jest.Mock).mockResolvedValue({
      id: 'med-456',
      name: 'Rescue Med',
      type: 'rescue',
      dosageAmount: 200,
      dosageUnit: 'mg',
      defaultQuantity: 2,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const mockRoute = {
      params: { medicationId: 'med-456' },
    };

    renderWithProviders(
      <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Rescue')).toBeTruthy();
    });
  });
});
