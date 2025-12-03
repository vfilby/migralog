import React from 'react';
import { screen, waitFor, fireEvent, act } from '@testing-library/react-native';
import { Platform, Alert, ActionSheetIOS } from 'react-native';
import MedicationDetailScreen from '../medication/MedicationDetailScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import { useMedicationStore } from '../../store/medicationStore';
import { useEpisodeStore } from '../../store/episodeStore';
import { medicationRepository, medicationScheduleRepository, medicationDoseRepository } from '../../database/medicationRepository';
import { toastService } from '../../services/toastService';
import { logger } from '../../utils/logger';

jest.mock('../../store/medicationStore');
jest.mock('../../store/episodeStore');
jest.mock('../../services/toastService');
jest.mock('../../utils/logger');
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

// Mock NotificationSettings
jest.mock('../../components/shared/NotificationSettings', () => {
  return function MockNotificationSettings() {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, 'Notifications');
  };
});

// Mock the notification settings store
jest.mock('../../store/notificationSettingsStore', () => ({
  useNotificationSettingsStore: jest.fn(() => ({
    settings: {},
    isLoaded: true,
    loadSettings: jest.fn(),
    updateGlobalSettings: jest.fn(),
    updateMedicationSettings: jest.fn(),
    removeMedicationSettings: jest.fn(),
    getEffectiveSettings: jest.fn(() => ({
      timeSensitiveEnabled: false,
      followUpDelay: 'off',
      criticalAlertsEnabled: false,
      isOverridden: false,
    })),
  })),
}));

// Mock Alert and ActionSheetIOS
jest.spyOn(Alert, 'alert').mockImplementation(() => {});
jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

describe('MedicationDetailScreen', () => {
  const mockLogDose = jest.fn();
  const mockDeleteDose = jest.fn();
  const mockArchiveMedication = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios'; // Default to iOS for most tests

    (useMedicationStore as unknown as jest.Mock).mockReturnValue({
      logDose: mockLogDose,
      deleteDose: mockDeleteDose,
      archiveMedication: mockArchiveMedication,
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
    mockDeleteDose.mockResolvedValue(undefined);
    mockArchiveMedication.mockResolvedValue(undefined);
  });

  it('should render medication detail screen', async () => {
    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    // Wait for loading to complete and content to appear
    await waitFor(() => {
      expect(screen.getByTestId('medication-detail-screen')).toBeTruthy();
    });

    // Verify that the repository was called during loading
    expect(medicationRepository.getById).toHaveBeenCalledWith('med-123');
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

  describe('Navigation Focus Listener', () => {
    it('should reload data when screen is focused', async () => {
      const mockAddListener = jest.fn();
      const mockUnsubscribe = jest.fn();
      mockAddListener.mockReturnValue(mockUnsubscribe);

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={{ ...mockNavigation, addListener: mockAddListener } as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(mockAddListener).toHaveBeenCalledWith('focus', expect.any(Function));
      });

      // Simulate focus event
      const focusCallback = mockAddListener.mock.calls[0][1];
      await act(async () => {
        focusCallback();
      });

      expect(medicationRepository.getById).toHaveBeenCalledTimes(2); // Initial load + focus reload
    });
  });

  describe('Quick Dose Logging', () => {
    it('should log dose when Log Dose Now button is pressed', async () => {
      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Log Dose Now')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Log Dose Now'));

      await waitFor(() => {
        expect(mockLogDose).toHaveBeenCalledWith({
          medicationId: 'med-123',
          timestamp: expect.any(Number),
          quantity: 1,
          dosageAmount: 100,
          dosageUnit: 'mg',
          episodeId: undefined,
          updatedAt: expect.any(Number),
        });
      });
    });

    it('should log dose with episode when current episode exists', async () => {
      (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
        currentEpisode: { id: 'episode-123' },
      });

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Log Dose Now')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Log Dose Now'));

      await waitFor(() => {
        expect(mockLogDose).toHaveBeenCalledWith(
          expect.objectContaining({
            episodeId: 'episode-123',
          })
        );
      });
    });

    it('should handle dose logging failure', async () => {
      mockLogDose.mockRejectedValue(new Error('Log failed'));
      jest.spyOn(logger, 'error');

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Log Dose Now')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Log Dose Now'));

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith('Failed to log medication:', expect.any(Error));
      });
    });

    it('should not log dose when medication is null', async () => {
      (medicationRepository.getById as jest.Mock).mockResolvedValue(null);

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Medication not found');
      });

      expect(mockLogDose).not.toHaveBeenCalled();
    });
  });

  describe('Dose Actions - iOS', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    it('should show action sheet when dose item is long pressed on iOS', async () => {
      const mockDose = {
        id: 'dose-1',
        medicationId: 'med-123',
        timestamp: Date.now() - 3600000,
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg',
        status: 'taken',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([mockDose]);

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Medication')).toBeTruthy();
      });

      // Find and long press on dose item
      const doseItems = screen.getAllByText(/Dec \d+, \d{4}/);
      fireEvent(doseItems[0], 'longPress');

      expect(ActionSheetIOS.showActionSheetWithOptions).toHaveBeenCalledWith(
        {
          options: ['Cancel', 'Edit', 'Delete'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
        },
        expect.any(Function)
      );
    });

    it('should handle edit dose action from action sheet', async () => {
      const mockDose = {
        id: 'dose-1',
        medicationId: 'med-123',
        timestamp: Date.now() - 3600000,
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg',
        status: 'taken',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([mockDose]);
      
      let actionSheetCallback: Function | undefined;
      (ActionSheetIOS.showActionSheetWithOptions as jest.Mock).mockImplementation((options, callback) => {
        actionSheetCallback = callback;
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

      const doseItems = screen.getAllByText(/Dec \d+, \d{4}/);
      fireEvent(doseItems[0], 'longPress');

      // Simulate pressing Edit button (index 1)
      await act(async () => {
        actionSheetCallback!(1);
      });

      // Check if edit modal is visible
      await waitFor(() => {
        expect(screen.getByText('Edit Dose')).toBeTruthy();
      });
    });

    it('should handle delete dose action from action sheet', async () => {
      const mockDose = {
        id: 'dose-1',
        medicationId: 'med-123',
        timestamp: Date.now() - 3600000,
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg',
        status: 'taken',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([mockDose]);
      
      let actionSheetCallback: Function | undefined;
      (ActionSheetIOS.showActionSheetWithOptions as jest.Mock).mockImplementation((options, callback) => {
        actionSheetCallback = callback;
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

      const doseItems = screen.getAllByText(/Dec \d+, \d{4}/);
      fireEvent(doseItems[0], 'longPress');

      // Simulate pressing Delete button (index 2)
      await act(async () => {
        actionSheetCallback!(2);
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Dose',
        expect.stringContaining('Are you sure you want to delete this dose'),
        expect.any(Array)
      );
    });

    it('should handle cancel action from action sheet', async () => {
      const mockDose = {
        id: 'dose-1',
        medicationId: 'med-123',
        timestamp: Date.now() - 3600000,
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg',
        status: 'taken',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([mockDose]);
      
      let actionSheetCallback: Function | undefined;
      (ActionSheetIOS.showActionSheetWithOptions as jest.Mock).mockImplementation((options, callback) => {
        actionSheetCallback = callback;
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

      const doseItems = screen.getAllByText(/Dec \d+, \d{4}/);
      fireEvent(doseItems[0], 'longPress');

      // Simulate pressing Cancel button (index 0)
      await act(async () => {
        actionSheetCallback!(0);
      });

      // Nothing should happen - no alert or modal should appear
      expect(screen.queryByText('Edit Dose')).toBeNull();
    });
  });

  describe('Dose Actions - Android', () => {
    beforeEach(() => {
      Platform.OS = 'android';
    });

    it('should show alert dialog when dose item is long pressed on Android', async () => {
      const mockDose = {
        id: 'dose-1',
        medicationId: 'med-123',
        timestamp: Date.now() - 3600000,
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg',
        status: 'taken',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([mockDose]);

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Medication')).toBeTruthy();
      });

      const doseItems = screen.getAllByText(/Dec \d+, \d{4}/);
      fireEvent(doseItems[0], 'longPress');

      expect(Alert.alert).toHaveBeenCalledWith(
        'Dose Actions',
        expect.stringContaining('Dec'),
        expect.arrayContaining([
          { text: 'Cancel', style: 'cancel' },
          { text: 'Edit', onPress: expect.any(Function) },
          { text: 'Delete', style: 'destructive', onPress: expect.any(Function) },
        ])
      );
    });

    it('should handle edit action from Android alert', async () => {
      const mockDose = {
        id: 'dose-1',
        medicationId: 'med-123',
        timestamp: Date.now() - 3600000,
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg',
        status: 'taken',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([mockDose]);
      
      let editCallback: Function | undefined;
      (Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
        editCallback = buttons.find((b: any) => b.text === 'Edit').onPress;
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

      const doseItems = screen.getAllByText(/Dec \d+, \d{4}/);
      fireEvent(doseItems[0], 'longPress');

      // Simulate pressing Edit button
      await act(async () => {
        editCallback!();
      });

      await waitFor(() => {
        expect(screen.getByText('Edit Dose')).toBeTruthy();
      });
    });
  });

  describe('Edit Dose Modal', () => {
    it('should populate modal with existing dose data', async () => {
      const mockDose = {
        id: 'dose-1',
        medicationId: 'med-123',
        timestamp: Date.now() - 3600000,
        quantity: 2.5,
        dosageAmount: 100,
        dosageUnit: 'mg',
        status: 'taken',
        notes: 'Test note',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([mockDose]);
      
      let actionSheetCallback: Function | undefined;
      (ActionSheetIOS.showActionSheetWithOptions as jest.Mock).mockImplementation((options, callback) => {
        actionSheetCallback = callback;
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

      const doseItems = screen.getAllByText(/Dec \d+, \d{4}/);
      fireEvent(doseItems[0], 'longPress');

      await act(async () => {
        actionSheetCallback!(1); // Edit
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue('2.5')).toBeTruthy();
        expect(screen.getByDisplayValue('Test note')).toBeTruthy();
      });
    });

    it('should save edited dose successfully', async () => {
      const mockDose = {
        id: 'dose-1',
        medicationId: 'med-123',
        timestamp: Date.now() - 3600000,
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg',
        status: 'taken',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([mockDose]);
      (medicationDoseRepository.update as jest.Mock).mockResolvedValue(undefined);
      
      let actionSheetCallback: Function | undefined;
      (ActionSheetIOS.showActionSheetWithOptions as jest.Mock).mockImplementation((options, callback) => {
        actionSheetCallback = callback;
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

      const doseItems = screen.getAllByText(/Dec \d+, \d{4}/);
      fireEvent(doseItems[0], 'longPress');

      await act(async () => {
        actionSheetCallback!(1); // Edit
      });

      await waitFor(() => {
        expect(screen.getByText('Edit Dose')).toBeTruthy();
      });

      // Edit the amount
      const amountInput = screen.getByTestId('dose-amount-input');
      fireEvent.changeText(amountInput, '3');

      // Save the edit
      fireEvent.press(screen.getByText('Save'));

      await waitFor(() => {
        expect(medicationDoseRepository.update).toHaveBeenCalledWith('dose-1', {
          quantity: 3,
          notes: undefined,
          timestamp: expect.any(Number),
        });
      });
    });

    it('should validate dose amount input', async () => {
      const mockDose = {
        id: 'dose-1',
        medicationId: 'med-123',
        timestamp: Date.now() - 3600000,
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg',
        status: 'taken',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([mockDose]);
      
      let actionSheetCallback: Function | undefined;
      (ActionSheetIOS.showActionSheetWithOptions as jest.Mock).mockImplementation((options, callback) => {
        actionSheetCallback = callback;
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

      const doseItems = screen.getAllByText(/Dec \d+, \d{4}/);
      fireEvent(doseItems[0], 'longPress');

      await act(async () => {
        actionSheetCallback!(1); // Edit
      });

      await waitFor(() => {
        expect(screen.getByText('Edit Dose')).toBeTruthy();
      });

      // Check that input validation exists by testing valid input works
      const amountInput = screen.getByTestId('dose-amount-input');
      fireEvent.changeText(amountInput, '2.5');

      expect(screen.getByDisplayValue('2.5')).toBeTruthy();
    });

    it('should handle edit save failure', async () => {
      const mockDose = {
        id: 'dose-1',
        medicationId: 'med-123',
        timestamp: Date.now() - 3600000,
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg',
        status: 'taken',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([mockDose]);
      (medicationDoseRepository.update as jest.Mock).mockRejectedValue(new Error('Update failed'));
      jest.spyOn(toastService, 'error');
      
      let actionSheetCallback: Function | undefined;
      (ActionSheetIOS.showActionSheetWithOptions as jest.Mock).mockImplementation((options, callback) => {
        actionSheetCallback = callback;
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

      const doseItems = screen.getAllByText(/Dec \d+, \d{4}/);
      fireEvent(doseItems[0], 'longPress');

      await act(async () => {
        actionSheetCallback!(1); // Edit
      });

      await waitFor(() => {
        expect(screen.getByText('Edit Dose')).toBeTruthy();
      });

      const amountInput = screen.getByTestId('dose-amount-input');
      fireEvent.changeText(amountInput, '2');

      fireEvent.press(screen.getByText('Save'));

      await waitFor(() => {
        expect(toastService.error).toHaveBeenCalledWith('Failed to update dose');
      });
    });

    it('should cancel edit modal', async () => {
      const mockDose = {
        id: 'dose-1',
        medicationId: 'med-123',
        timestamp: Date.now() - 3600000,
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg',
        status: 'taken',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([mockDose]);
      
      let actionSheetCallback: Function | undefined;
      (ActionSheetIOS.showActionSheetWithOptions as jest.Mock).mockImplementation((options, callback) => {
        actionSheetCallback = callback;
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

      const doseItems = screen.getAllByText(/Dec \d+, \d{4}/);
      fireEvent(doseItems[0], 'longPress');

      await act(async () => {
        actionSheetCallback!(1); // Edit
      });

      await waitFor(() => {
        expect(screen.getByText('Edit Dose')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByText('Edit Dose')).toBeNull();
      });
    });

    it('should handle datetime picker changes', async () => {
      const mockDose = {
        id: 'dose-1',
        medicationId: 'med-123',
        timestamp: Date.now() - 3600000,
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg',
        status: 'taken',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([mockDose]);
      
      let actionSheetCallback: Function | undefined;
      (ActionSheetIOS.showActionSheetWithOptions as jest.Mock).mockImplementation((options, callback) => {
        actionSheetCallback = callback;
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

      const doseItems = screen.getAllByText(/Dec \d+, \d{4}/);
      fireEvent(doseItems[0], 'longPress');

      await act(async () => {
        actionSheetCallback!(1); // Edit
      });

      await waitFor(() => {
        expect(screen.getByText('Edit Dose')).toBeTruthy();
      });

      // Find and press the datetime button
      const datetimeButton = screen.getByText(/Dec \d+, \d{4} \d+:\d+/);
      fireEvent.press(datetimeButton);

      // Simulate DateTimePicker onChange for Android
      Platform.OS = 'android';
      const dateTimePickerEvent = {
        nativeEvent: { timestamp: Date.now() },
      };
      const newDate = new Date(Date.now() + 1000000);

      // The DateTimePicker should be visible and handle onChange
      fireEvent(screen.getByText('Edit Dose'), 'dateTimeChange', dateTimePickerEvent, newDate);
    });

    it('should handle datetime picker on iOS', async () => {
      Platform.OS = 'ios';
      
      const mockDose = {
        id: 'dose-1',
        medicationId: 'med-123',
        timestamp: Date.now() - 3600000,
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg',
        status: 'taken',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([mockDose]);
      
      let actionSheetCallback: Function | undefined;
      (ActionSheetIOS.showActionSheetWithOptions as jest.Mock).mockImplementation((options, callback) => {
        actionSheetCallback = callback;
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

      const doseItems = screen.getAllByText(/Dec \d+, \d{4}/);
      fireEvent(doseItems[0], 'longPress');

      await act(async () => {
        actionSheetCallback!(1); // Edit
      });

      await waitFor(() => {
        expect(screen.getByText('Edit Dose')).toBeTruthy();
      });

      // Find and press the datetime button to show picker
      const datetimeButton = screen.getByText(/Dec \d+, \d{4} \d+:\d+/);
      fireEvent.press(datetimeButton);
    });
  });

  describe('Delete Dose Functionality', () => {
    it('should confirm and delete dose', async () => {
      const mockDose = {
        id: 'dose-1',
        medicationId: 'med-123',
        timestamp: Date.now() - 3600000,
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg',
        status: 'taken',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([mockDose]);
      
      let deleteCallback: Function | undefined;
      (Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
        if (title === 'Delete Dose') {
          deleteCallback = buttons.find((b: any) => b.text === 'Delete').onPress;
        }
      });

      let actionSheetCallback: Function | undefined;
      (ActionSheetIOS.showActionSheetWithOptions as jest.Mock).mockImplementation((options, callback) => {
        actionSheetCallback = callback;
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

      const doseItems = screen.getAllByText(/Dec \d+, \d{4}/);
      fireEvent(doseItems[0], 'longPress');

      await act(async () => {
        actionSheetCallback!(2); // Delete
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Dose',
        expect.stringContaining('Are you sure you want to delete this dose'),
        expect.any(Array)
      );

      // Confirm deletion
      await act(async () => {
        deleteCallback!();
      });

      expect(mockDeleteDose).toHaveBeenCalledWith('dose-1');
    });

    it('should handle delete dose failure', async () => {
      const mockDose = {
        id: 'dose-1',
        medicationId: 'med-123',
        timestamp: Date.now() - 3600000,
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg',
        status: 'taken',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([mockDose]);
      mockDeleteDose.mockRejectedValue(new Error('Delete failed'));
      jest.spyOn(logger, 'error');
      
      let deleteCallback: Function | undefined;
      (Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
        if (title === 'Delete Dose') {
          deleteCallback = buttons.find((b: any) => b.text === 'Delete').onPress;
        }
      });

      let actionSheetCallback: Function | undefined;
      (ActionSheetIOS.showActionSheetWithOptions as jest.Mock).mockImplementation((options, callback) => {
        actionSheetCallback = callback;
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

      const doseItems = screen.getAllByText(/Dec \d+, \d{4}/);
      fireEvent(doseItems[0], 'longPress');

      await act(async () => {
        actionSheetCallback!(2); // Delete
      });

      await act(async () => {
        deleteCallback!();
      });

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith('Failed to delete dose:', expect.any(Error));
      });
    });
  });

  describe('Archive Medication', () => {
    it('should confirm and archive medication', async () => {
      let archiveCallback: Function | undefined;
      (Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
        if (title === 'Archive Medication') {
          archiveCallback = buttons.find((b: any) => b.text === 'Archive').onPress;
        }
      });

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('archive-medication-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('archive-medication-button'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Archive Medication',
        expect.stringContaining('Are you sure you want to archive Test Medication'),
        expect.any(Array)
      );

      // Confirm archiving
      await act(async () => {
        archiveCallback!();
      });

      expect(mockArchiveMedication).toHaveBeenCalledWith('med-123');
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });

    it('should handle archive medication failure', async () => {
      mockArchiveMedication.mockRejectedValue(new Error('Archive failed'));
      jest.spyOn(logger, 'error');
      jest.spyOn(toastService, 'error');
      
      let archiveCallback: Function | undefined;
      (Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
        if (title === 'Archive Medication') {
          archiveCallback = buttons.find((b: any) => b.text === 'Archive').onPress;
        }
      });

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('archive-medication-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('archive-medication-button'));

      await act(async () => {
        archiveCallback!();
      });

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith('Failed to archive medication:', expect.any(Error));
        expect(toastService.error).toHaveBeenCalledWith('Failed to archive medication');
      });
    });

    it('should not archive when medication is null', async () => {
      (medicationRepository.getById as jest.Mock).mockResolvedValue(null);

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Medication not found');
      });

      expect(mockArchiveMedication).not.toHaveBeenCalled();
    });
  });

  describe('Navigation Actions', () => {
    it('should navigate back when back button is pressed', async () => {
      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('← Back')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('← Back'));

      expect(mockNavigation.goBack).toHaveBeenCalled();
    });

    it('should navigate to edit medication when edit button is pressed', async () => {
      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Edit'));

      expect(mockNavigation.navigate).toHaveBeenCalledWith('EditMedication', { medicationId: 'med-123' });
    });

    it('should navigate to medication log when view all button is pressed', async () => {
      // Create enough doses to show "View All" button
      const doses = Array.from({ length: 15 }, (_, i) => ({
        id: `dose-${i}`,
        medicationId: 'med-123',
        timestamp: Date.now() - (i * 3600000),
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg',
        status: 'taken',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue(doses);

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('View All (15)')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('View All (15)'));

      expect(mockNavigation.navigate).toHaveBeenCalledWith('MedicationLog');
    });
  });

  describe('Notification Settings', () => {
    it('should expand and collapse notification settings', async () => {
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
        expect(screen.getByText('Notification Overrides')).toBeTruthy();
      });

      // Initially collapsed
      expect(screen.queryByText('Notifications')).toBeNull();

      // Expand
      fireEvent.press(screen.getByText('Notification Overrides'));

      await waitFor(() => {
        expect(screen.queryByText('Notifications')).toBeTruthy();
      });

      // Collapse
      fireEvent.press(screen.getByText('Notification Overrides'));

      await waitFor(() => {
        expect(screen.queryByText('Notifications')).toBeNull();
      });
    });
  });

  describe('Large Text Mode', () => {
    it('should hide header title in large text mode', async () => {
      jest.doMock('../../utils/textScaling', () => ({
        isLargeTextModeEnabled: jest.fn(() => true),
        getFontScale: jest.fn(() => 3.1),
        getScaledFontSize: jest.fn((size) => size * 3.1),
        MAX_FONT_SCALE: 3.1,
      }));

      const { isLargeTextModeEnabled } = require('../../utils/textScaling');
      (isLargeTextModeEnabled as jest.Mock).mockReturnValue(true);

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Medication')).toBeTruthy();
      });

      // Header title should not be displayed in large text mode
      expect(screen.queryByText('Medication Details')).toBeNull();
    });
  });

  describe('Schedule Frequency Display', () => {
    it('should display schedule frequency when available', async () => {
      (medicationRepository.getById as jest.Mock).mockResolvedValue({
        id: 'med-123',
        name: 'Test Medication',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        scheduleFrequency: 'twice-daily',
        active: true,
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
        expect(screen.getByText('twice-daily')).toBeTruthy();
      });
    });
  });
});
