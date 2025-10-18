import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import MedicationsScreen from '../MedicationsScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import { useMedicationStore } from '../../store/medicationStore';
import { useEpisodeStore } from '../../store/episodeStore';

jest.mock('../../store/medicationStore');
jest.mock('../../store/episodeStore');
jest.mock('../../database/medicationRepository', () => ({
  medicationRepository: {
    getAll: jest.fn().mockResolvedValue([]),
  },
  medicationScheduleRepository: {
    getByMedicationId: jest.fn().mockResolvedValue([]),
  },
  medicationDoseRepository: {
    getByMedicationId: jest.fn().mockResolvedValue([]),
  },
}));

const mockNavigate = jest.fn();
const mockAddListener = jest.fn((event, callback) => {
  if (event === 'focus') {
    callback();
  }
  return jest.fn();
});

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    addListener: mockAddListener,
  }),
}));

describe('MedicationsScreen', () => {
  const mockLoadMedications = jest.fn();
  const mockLogDose = jest.fn();
  const mockDeleteDose = jest.fn();
  const mockLoadCurrentEpisode = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
      currentEpisode: null,
      loadCurrentEpisode: mockLoadCurrentEpisode,
    });

    (useMedicationStore as unknown as jest.Mock).mockReturnValue({
      preventativeMedications: [],
      rescueMedications: [],
      loadMedications: mockLoadMedications,
      logDose: mockLogDose,
      deleteDose: mockDeleteDose,
      loading: false,
    });

    mockLoadMedications.mockResolvedValue(undefined);
    mockLoadCurrentEpisode.mockResolvedValue(undefined);
  });

  it('should render medications screen with title', async () => {
    renderWithProviders(<MedicationsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Medications')).toBeTruthy();
    });
  });

  it('should display Preventative and Rescue sections', async () => {
    renderWithProviders(<MedicationsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Preventative')).toBeTruthy();
      expect(screen.getByText('Rescue')).toBeTruthy();
    });
  });

  it('should show Add Medication button', async () => {
    renderWithProviders(<MedicationsScreen />);

    await waitFor(() => {
      expect(screen.getByText('+ Add Medication')).toBeTruthy();
    });
  });

  it('should show empty state for preventative medications when none exist', async () => {
    (useMedicationStore as unknown as jest.Mock).mockReturnValue({
      preventativeMedications: [],
      rescueMedications: [],
      loadMedications: mockLoadMedications,
      logDose: mockLogDose,
      deleteDose: mockDeleteDose,
      loading: false,
    });

    renderWithProviders(<MedicationsScreen />);

    await waitFor(() => {
      expect(screen.getByText('No preventative medications')).toBeTruthy();
    });
  });

  it('should show empty state for rescue medications when none exist', async () => {
    (useMedicationStore as unknown as jest.Mock).mockReturnValue({
      preventativeMedications: [],
      rescueMedications: [],
      loadMedications: mockLoadMedications,
      logDose: mockLogDose,
      deleteDose: mockDeleteDose,
      loading: false,
    });

    renderWithProviders(<MedicationsScreen />);

    await waitFor(() => {
      expect(screen.getByText('No rescue medications')).toBeTruthy();
    });
  });

  it('should display preventative medication cards', async () => {
    (useMedicationStore as unknown as jest.Mock).mockReturnValue({
      preventativeMedications: [
        {
          id: 'prev-1',
          name: 'Daily Preventative Med',
          type: 'preventative',
          dosageAmount: 50,
          dosageUnit: 'mg',
          defaultDosage: 1,
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      rescueMedications: [],
      loadMedications: mockLoadMedications,
      logDose: mockLogDose,
      deleteDose: mockDeleteDose,
      loading: false,
    });

    renderWithProviders(<MedicationsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Daily Preventative Med')).toBeTruthy();
      expect(screen.getAllByText('Preventative').length).toBeGreaterThan(0);
    });
  });

  it('should display rescue medication cards with Quick Log button', async () => {
    (useMedicationStore as unknown as jest.Mock).mockReturnValue({
      preventativeMedications: [],
      rescueMedications: [
        {
          id: 'rescue-1',
          name: 'Rescue Med',
          type: 'rescue',
          dosageAmount: 100,
          dosageUnit: 'mg',
          defaultDosage: 2,
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      loadMedications: mockLoadMedications,
      logDose: mockLogDose,
      deleteDose: mockDeleteDose,
      loading: false,
    });

    renderWithProviders(<MedicationsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Rescue Med')).toBeTruthy();
      expect(screen.getByText('Quick Log')).toBeTruthy();
      expect(screen.getByText('Log Details')).toBeTruthy();
    });
  });

  it('should load medications on mount', async () => {
    renderWithProviders(<MedicationsScreen />);

    await waitFor(() => {
      expect(mockLoadMedications).toHaveBeenCalled();
      expect(mockLoadCurrentEpisode).toHaveBeenCalled();
    });
  });

  it('should display multiple preventative medications', async () => {
    (useMedicationStore as unknown as jest.Mock).mockReturnValue({
      preventativeMedications: [
        {
          id: 'prev-1',
          name: 'Medication A',
          type: 'preventative',
          dosageAmount: 50,
          dosageUnit: 'mg',
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'prev-2',
          name: 'Medication B',
          type: 'preventative',
          dosageAmount: 100,
          dosageUnit: 'mg',
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      rescueMedications: [],
      loadMedications: mockLoadMedications,
      logDose: mockLogDose,
      deleteDose: mockDeleteDose,
      loading: false,
    });

    renderWithProviders(<MedicationsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Medication A')).toBeTruthy();
      expect(screen.getByText('Medication B')).toBeTruthy();
    });
  });

  it('should display multiple rescue medications', async () => {
    (useMedicationStore as unknown as jest.Mock).mockReturnValue({
      preventativeMedications: [],
      rescueMedications: [
        {
          id: 'rescue-1',
          name: 'Rescue A',
          type: 'rescue',
          dosageAmount: 100,
          dosageUnit: 'mg',
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'rescue-2',
          name: 'Rescue B',
          type: 'rescue',
          dosageAmount: 200,
          dosageUnit: 'mg',
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      loadMedications: mockLoadMedications,
      logDose: mockLogDose,
      deleteDose: mockDeleteDose,
      loading: false,
    });

    renderWithProviders(<MedicationsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Rescue A')).toBeTruthy();
      expect(screen.getByText('Rescue B')).toBeTruthy();
    });
  });

  // User Interaction Tests
  describe('User Interactions', () => {
    const { fireEvent, within } = require('@testing-library/react-native');

    it('should navigate to AddMedication when Add Medication button pressed', async () => {
      renderWithProviders(<MedicationsScreen />);

      await waitFor(() => {
        expect(screen.getByText('+ Add Medication')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('+ Add Medication'));
      expect(mockNavigate).toHaveBeenCalledWith('AddMedication');
    });

    it('should navigate to MedicationDetail when medication card pressed', async () => {
      (useMedicationStore as unknown as jest.Mock).mockReturnValue({
        preventativeMedications: [{
          id: 'prev-1',
          name: 'Test Med',
          type: 'preventative',
          dosageAmount: 50,
          dosageUnit: 'mg',
          defaultDosage: 1,
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }],
        rescueMedications: [],
        loadMedications: mockLoadMedications,
        logDose: mockLogDose,
        deleteDose: mockDeleteDose,
        loading: false,
      });

      renderWithProviders(<MedicationsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Test Med')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Test Med'));
      expect(mockNavigate).toHaveBeenCalledWith('MedicationDetail', { medicationId: 'prev-1' });
    });

    it('should call logDose when Quick Log is pressed on rescue medication', async () => {
      const Alert = require('react-native').Alert;
      jest.spyOn(Alert, 'alert');

      (useMedicationStore as unknown as jest.Mock).mockReturnValue({
        preventativeMedications: [],
        rescueMedications: [{
          id: 'rescue-1',
          name: 'Rescue Med',
          type: 'rescue',
          dosageAmount: 100,
          dosageUnit: 'mg',
          defaultDosage: 2,
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }],
        loadMedications: mockLoadMedications,
        logDose: mockLogDose,
        deleteDose: mockDeleteDose,
        loading: false,
      });

      mockLogDose.mockResolvedValue({ id: 'dose-123' });

      renderWithProviders(<MedicationsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Quick Log')).toBeTruthy();
      });

      // Create a mock event with stopPropagation
      const mockEvent = { stopPropagation: jest.fn() };
      fireEvent(screen.getByText('Quick Log'), 'press', mockEvent);

      await waitFor(() => {
        expect(mockLogDose).toHaveBeenCalledWith({
          medicationId: 'rescue-1',
          timestamp: expect.any(Number),
          amount: 2,
          episodeId: undefined,
        });
        expect(Alert.alert).toHaveBeenCalledWith('Success', 'Medication logged successfully');
      });
    });

    it('should navigate to LogMedication when Log Details pressed', async () => {
      (useMedicationStore as unknown as jest.Mock).mockReturnValue({
        preventativeMedications: [],
        rescueMedications: [{
          id: 'rescue-1',
          name: 'Rescue Med',
          type: 'rescue',
          dosageAmount: 100,
          dosageUnit: 'mg',
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }],
        loadMedications: mockLoadMedications,
        logDose: mockLogDose,
        deleteDose: mockDeleteDose,
        loading: false,
      });

      renderWithProviders(<MedicationsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Log Details')).toBeTruthy();
      });

      const mockEvent = { stopPropagation: jest.fn() };
      fireEvent(screen.getByText('Log Details'), 'press', mockEvent);
      expect(mockNavigate).toHaveBeenCalledWith('LogMedication', { medicationId: 'rescue-1' });
    });
  });

  // Error Handling Tests
  describe('Error Handling', () => {
    const { fireEvent } = require('@testing-library/react-native');
    const Alert = require('react-native').Alert;

    it('should show error alert when Quick Log fails', async () => {
      jest.spyOn(Alert, 'alert');
      jest.spyOn(console, 'error').mockImplementation(() => {});

      (useMedicationStore as unknown as jest.Mock).mockReturnValue({
        preventativeMedications: [],
        rescueMedications: [{
          id: 'rescue-1',
          name: 'Rescue Med',
          type: 'rescue',
          dosageAmount: 100,
          dosageUnit: 'mg',
          defaultDosage: 2,
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }],
        loadMedications: mockLoadMedications,
        logDose: mockLogDose,
        deleteDose: mockDeleteDose,
        loading: false,
      });

      mockLogDose.mockRejectedValue(new Error('Network error'));

      renderWithProviders(<MedicationsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Quick Log')).toBeTruthy();
      });

      const mockEvent = { stopPropagation: jest.fn() };
      fireEvent(screen.getByText('Quick Log'), 'press', mockEvent);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to log medication');
      });
    });
  });
});
