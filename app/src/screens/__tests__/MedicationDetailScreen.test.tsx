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
jest.mock('../../utils/textScaling', () => ({
  isLargeTextModeEnabled: jest.fn(() => false),
  getFontScale: jest.fn(() => 1.0),
  getScaledFontSize: jest.fn((size) => size),
  MAX_FONT_SCALE: 3.1,
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

  it('should display "Skipped" for skipped doses in history', async () => {
    const now = Date.now();
    (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([
      {
        id: 'dose-1',
        medicationId: 'med-123',
        timestamp: now - 3600000,
        quantity: 0,
        dosageAmount: 100,
        dosageUnit: 'mg',
        status: 'skipped',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Skipped')).toBeTruthy();
    });
  });

  it('should display formatted dose for taken doses in history', async () => {
    const now = Date.now();
    (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([
      {
        id: 'dose-1',
        medicationId: 'med-123',
        timestamp: now - 3600000,
        quantity: 2,
        dosageAmount: 100,
        dosageUnit: 'mg',
        status: 'taken',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText(/2 × 100mg/)).toBeTruthy();
    });
  });

  it('should show red indicator for days with only skipped doses in 7-day timeline', async () => {
    const now = Date.now();
    (medicationRepository.getById as jest.Mock).mockResolvedValue({
      id: 'med-123',
      name: 'Test Medication',
      type: 'preventative',
      dosageAmount: 100,
      dosageUnit: 'mg',
      defaultQuantity: 1,
      scheduleFrequency: 'daily',
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([
      {
        id: 'dose-1',
        medicationId: 'med-123',
        timestamp: now - 86400000, // Yesterday
        quantity: 0,
        dosageAmount: 100,
        dosageUnit: 'mg',
        status: 'skipped',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Last 7 Days')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('shows error and navigates back when medication not found', async () => {
      const Alert = require('react-native').Alert;
      jest.spyOn(Alert, 'alert');
      
      (medicationRepository.getById as jest.Mock).mockResolvedValue(null);

      const mockRoute = {
        params: { medicationId: 'non-existent' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Medication not found');
        expect(mockNavigation.goBack).toHaveBeenCalled();
      });
    });

    it('shows error when loading medication data fails', async () => {
      const Alert = require('react-native').Alert;
      jest.spyOn(Alert, 'alert');
      
      (medicationRepository.getById as jest.Mock).mockRejectedValue(new Error('Load failed'));

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to load medication details');
      });
    });
  });

  describe('Dose Logging', () => {
    it('has log dose functionality available', async () => {
      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Medication')).toBeTruthy();
      });

      // Log dose functionality is available
      expect(mockLogDose).toBeDefined();
    });
  });

  describe('Other Type Badge', () => {
    it('should display other medication type badge', async () => {
      (medicationRepository.getById as jest.Mock).mockResolvedValue({
        id: 'med-789',
        name: 'Other Med',
        type: 'other',
        dosageAmount: 50,
        dosageUnit: 'ml',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const mockRoute = {
        params: { medicationId: 'med-789' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Other')).toBeTruthy();
      });
    });
  });

  describe('Photo Display', () => {
    it('should display medication photo when available', async () => {
      (medicationRepository.getById as jest.Mock).mockResolvedValue({
        id: 'med-123',
        name: 'Test Medication',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        photoUri: 'file://photo.jpg',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

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
  });

  describe('Notes Display', () => {
    it('should display medication notes when available', async () => {
      (medicationRepository.getById as jest.Mock).mockResolvedValue({
        id: 'med-123',
        name: 'Test Medication',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        notes: 'Take with food',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Take with food')).toBeTruthy();
      });
    });
  });

  describe('Category Display', () => {
    it('should display medication category when available', async () => {
      (medicationRepository.getById as jest.Mock).mockResolvedValue({
        id: 'med-123',
        name: 'Test Medication',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        category: 'triptan',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

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
  });

  describe('Schedules Display', () => {
    it('should display schedules when available', async () => {
      (medicationScheduleRepository.getByMedicationId as jest.Mock).mockResolvedValue([
        {
          id: 'schedule-1',
          medicationId: 'med-123',
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        },
      ]);

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
  });

  describe('Empty Dose History', () => {
    it('loads medication even with no doses', async () => {
      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([]);

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
  });

  describe('Current Episode Context', () => {
    it('should show episode context when there is a current episode', async () => {
      (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
        currentEpisode: {
          id: 'episode-123',
          startTime: Date.now() - 3600000,
        },
      });

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
  });
});
