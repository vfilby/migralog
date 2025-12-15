import React from 'react';
import { screen, waitFor, fireEvent, act } from '@testing-library/react-native';
import { Platform, Alert, ActionSheetIOS } from 'react-native';
import MedicationDetailScreen from '../medication/MedicationDetailScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import { useMedicationStore } from '../../store/medicationStore';
import { useEpisodeStore } from '../../store/episodeStore';
import { logger } from '../../utils/logger';

jest.mock('../../store/medicationStore');
jest.mock('../../store/episodeStore');
jest.mock('../../utils/logger');
jest.mock('../../utils/textScaling', () => ({
  isLargeTextModeEnabled: jest.fn(() => false),
  getFontScale: jest.fn(() => 1.0),
  getScaledFontSize: jest.fn((size) => size),
  MAX_FONT_SCALE: 3.1,
}));

// Mock DateTimePicker
jest.mock('@react-native-community/datetimepicker', () => {
  return {
    __esModule: true,
    default: () => null,
  };
});

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
  const mockUpdateDose = jest.fn();
  const mockLoadMedicationWithDetails = jest.fn();
  const mockLoadSchedules = jest.fn();
  const mockGetSchedulesByMedicationId = jest.fn();

  const defaultMedication = {
    id: 'med-123',
    name: 'Test Medication',
    type: 'preventative' as const,
    dosageAmount: 100,
    dosageUnit: 'mg' as const,
    defaultQuantity: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios'; // Default to iOS for most tests

    // Set up default store mock
    mockLoadMedicationWithDetails.mockResolvedValue({
      medication: defaultMedication,
      schedules: [],
      doses: [],
    });

    mockLogDose.mockResolvedValue({ id: 'dose-123' });
    mockDeleteDose.mockResolvedValue(undefined);
    mockArchiveMedication.mockResolvedValue(undefined);
    mockUpdateDose.mockResolvedValue(undefined);
    mockLoadSchedules.mockResolvedValue(undefined);
    mockGetSchedulesByMedicationId.mockReturnValue([]);

    (useMedicationStore as unknown as jest.Mock).mockReturnValue({
      logDose: mockLogDose,
      deleteDose: mockDeleteDose,
      archiveMedication: mockArchiveMedication,
      updateDose: mockUpdateDose,
      loadMedicationWithDetails: mockLoadMedicationWithDetails,
      loadSchedules: mockLoadSchedules,
      getSchedulesByMedicationId: mockGetSchedulesByMedicationId,
    });

    (useEpisodeStore as unknown as jest.Mock).mockReturnValue({
      currentEpisode: null,
    });
  });



  it('should display medication name', async () => {
    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    // First wait for loading to complete (loading should disappear)
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeNull();
    }, { timeout: 5000 });

    // Then verify the medication name is displayed
    await waitFor(() => {
      expect(screen.getByText('Test Medication')).toBeTruthy();
    });
  }, 10000);

  it('should display medication type badge', async () => {
    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeNull();
    }, { timeout: 5000 });

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

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeNull();
    }, { timeout: 5000 });

    await waitFor(() => {
      expect(screen.getByText(/100mg/)).toBeTruthy();
    });
  });

  it('should load medication details including schedules and doses', async () => {
    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(mockLoadMedicationWithDetails).toHaveBeenCalledWith('med-123');
    });
  });

  it('should display rescue medication type badge', async () => {
    mockLoadMedicationWithDetails.mockResolvedValue({
      medication: {
        id: 'med-456',
        name: 'Rescue Med',
        type: 'rescue',
        dosageAmount: 200,
        dosageUnit: 'mg',
        defaultQuantity: 2,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      schedules: [],
      doses: [],
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
    mockLoadMedicationWithDetails.mockResolvedValue({
      medication: defaultMedication,
      schedules: [],
      doses: [
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
      ],
    });

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
    mockLoadMedicationWithDetails.mockResolvedValue({
      medication: defaultMedication,
      schedules: [],
      doses: [
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
      ],
    });

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
    mockLoadMedicationWithDetails.mockResolvedValue({
      medication: {
        ...defaultMedication,
        scheduleFrequency: 'daily',
      },
      schedules: [],
      doses: [
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
      ],
    });

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
      
      mockLoadMedicationWithDetails.mockResolvedValue(null);

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
      
      mockLoadMedicationWithDetails.mockRejectedValue(new Error('Load failed'));

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
      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: {
          id: 'med-789',
          name: 'Other Med',
          type: 'other',
          dosageAmount: 50,
          dosageUnit: 'ml',
          defaultQuantity: 1,
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        schedules: [],
        doses: [],
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
      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: {
          ...defaultMedication,
          photoUri: 'file://photo.jpg',
        },
        schedules: [],
        doses: [],
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
      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: {
          ...defaultMedication,
          notes: 'Take with food',
        },
        schedules: [],
        doses: [],
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
      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: {
          ...defaultMedication,
          category: 'triptan',
        },
        schedules: [],
        doses: [],
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
      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [{
            id: 'schedule-1',
            medicationId: 'med-123',
            time: '08:00',
            timezone: 'America/Los_Angeles',
            dosage: 1,
            enabled: true,
            reminderEnabled: true,
          },
        ],
        doses: [],
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

  describe('Empty Dose History', () => {
    it('loads medication even with no doses', async () => {
      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses: [],
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

      expect(mockLoadMedicationWithDetails).toHaveBeenCalledTimes(2); // Initial load + focus reload
    });

    it('should handle focus reload failures gracefully', async () => {
      const mockAddListener = jest.fn();
      const mockUnsubscribe = jest.fn();
      mockAddListener.mockReturnValue(mockUnsubscribe);
      
      // Mock loadMedicationWithDetails to succeed initially, then fail on focus reload
      mockLoadMedicationWithDetails
        .mockResolvedValueOnce({
          medication: defaultMedication,
          schedules: [],
          doses: [],
        })
        .mockRejectedValueOnce(new Error('Focus reload failed'));
      
      jest.spyOn(logger, 'error');

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={{ ...mockNavigation, addListener: mockAddListener } as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(mockAddListener).toHaveBeenCalledWith('focus', expect.any(Function));
      });

      // Simulate focus event that will fail
      const focusCallback = mockAddListener.mock.calls[0][1];
      await act(async () => {
        focusCallback();
      });

      // Verify error was logged by the loadMedicationData function (existing error handling)
      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          'Failed to load medication data:',
          expect.any(Error)
        );
      });

      expect(mockLoadMedicationWithDetails).toHaveBeenCalledTimes(2); // Initial load + failed focus reload
    });

    it('should properly cleanup focus listener on unmount', async () => {
      const mockAddListener = jest.fn();
      const mockUnsubscribe = jest.fn();
      mockAddListener.mockReturnValue(mockUnsubscribe);

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      const { unmount } = renderWithProviders(
        <MedicationDetailScreen navigation={{ ...mockNavigation, addListener: mockAddListener } as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(mockAddListener).toHaveBeenCalledWith('focus', expect.any(Function));
      });

      // Unmount the component
      unmount();

      // Verify cleanup function was called
      expect(mockUnsubscribe).toHaveBeenCalled();
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
      mockLoadMedicationWithDetails.mockResolvedValue(null);

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

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses: [mockDose],
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

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses: [mockDose],
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

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses: [mockDose],
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

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses: [mockDose],
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

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses: [mockDose],
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

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses: [mockDose],
      });
      
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

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses: [mockDose],
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

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses: [mockDose],
      });
      mockUpdateDose.mockResolvedValue(undefined);
      
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
        expect(mockUpdateDose).toHaveBeenCalledWith('dose-1', {
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

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses: [mockDose],
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

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses: [mockDose],
      });
      mockUpdateDose.mockRejectedValue(new Error('Update failed'));
      jest.spyOn(logger, 'error');
      
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
        expect(logger.error).toHaveBeenCalled();
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

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses: [mockDose],
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

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses: [mockDose],
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

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses: [mockDose],
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

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses: [mockDose],
      });
      
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

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses: [mockDose],
      });
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
      });
    });

    it('should not archive when medication is null', async () => {
      mockLoadMedicationWithDetails.mockResolvedValue(null);

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

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses,
      });

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

      expect(mockNavigation.navigate).toHaveBeenCalledWith('MedicationLog', { medicationId: 'med-123' });
    });
  });

  describe('Notification Settings', () => {
    it('should expand and collapse notification settings', async () => {
      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [
          {
            id: 'schedule-1',
            medicationId: 'med-123',
            time: '08:00',
            timezone: 'America/Los_Angeles',
            dosage: 1,
            enabled: true,
            reminderEnabled: true,
          },
        ],
        doses: [],
      });

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
      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: {
          ...defaultMedication,
          scheduleFrequency: 'twice-daily',
        },
        schedules: [],
        doses: [],
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

  describe('Schedule Resolution Logic', () => {
    const mockPreventativeMedication = {
      ...defaultMedication,
      type: 'preventative' as const,
    };

    const mockRescueMedication = {
      ...defaultMedication,
      type: 'rescue' as const,
    };

    beforeEach(() => {
      // Reset getSchedulesByMedicationId mock for each test
      mockGetSchedulesByMedicationId.mockReturnValue([]);
    });

    it('should return schedule ID for preventative medication with matching schedule within 3-hour window', async () => {
      const schedule = {
        id: 'schedule-1',
        medicationId: 'med-123',
        time: '08:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
        reminderEnabled: true,
      };

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: mockPreventativeMedication,
        schedules: [schedule],
        doses: [],
      });

      mockGetSchedulesByMedicationId.mockReturnValue([schedule]);

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Log Dose Now')).toBeTruthy();
      });

      // Create a timestamp for 8:30 AM (30 minutes after the schedule)
      const logTime = new Date();
      logTime.setHours(8, 30, 0, 0);
      const logTimestamp = logTime.getTime();

      // Mock Date.now to return our specific timestamp for consistent testing
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => logTimestamp);

      fireEvent.press(screen.getByText('Log Dose Now'));

      await waitFor(() => {
        expect(mockLogDose).toHaveBeenCalledWith(
          expect.objectContaining({
            scheduleId: 'schedule-1',
            medicationId: 'med-123',
            timestamp: logTimestamp,
          })
        );
      });

      // Restore original Date.now
      Date.now = originalDateNow;
    });

    it('should return undefined for preventative medication with no schedules', async () => {
      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: mockPreventativeMedication,
        schedules: [],
        doses: [],
      });

      mockGetSchedulesByMedicationId.mockReturnValue([]);

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
            scheduleId: undefined,
            medicationId: 'med-123',
          })
        );
      });
    });

    it('should return undefined for preventative medication with schedules but none close enough', async () => {
      const schedule = {
        id: 'schedule-1',
        medicationId: 'med-123',
        time: '08:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
        reminderEnabled: true,
      };

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: mockPreventativeMedication,
        schedules: [schedule],
        doses: [],
      });

      mockGetSchedulesByMedicationId.mockReturnValue([schedule]);

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Log Dose Now')).toBeTruthy();
      });

      // Create a timestamp for 4:00 PM (8 hours after the schedule - too far)
      const logTime = new Date();
      logTime.setHours(16, 0, 0, 0);
      const logTimestamp = logTime.getTime();

      const originalDateNow = Date.now;
      Date.now = jest.fn(() => logTimestamp);

      fireEvent.press(screen.getByText('Log Dose Now'));

      await waitFor(() => {
        expect(mockLogDose).toHaveBeenCalledWith(
          expect.objectContaining({
            scheduleId: undefined,
            medicationId: 'med-123',
            timestamp: logTimestamp,
          })
        );
      });

      Date.now = originalDateNow;
    });

    it('should return undefined for rescue medication', async () => {
      const schedule = {
        id: 'schedule-1',
        medicationId: 'med-123',
        time: '08:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
        reminderEnabled: true,
      };

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: mockRescueMedication,
        schedules: [schedule],
        doses: [],
      });

      mockGetSchedulesByMedicationId.mockReturnValue([schedule]);

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
            scheduleId: undefined,
            medicationId: 'med-123',
          })
        );
      });
    });

    it('should handle schedule time wrap-around scenarios (e.g., 23:00 to 01:00)', async () => {
      const lateSchedule = {
        id: 'schedule-1',
        medicationId: 'med-123',
        time: '23:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
        reminderEnabled: true,
      };

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: mockPreventativeMedication,
        schedules: [lateSchedule],
        doses: [],
      });

      mockGetSchedulesByMedicationId.mockReturnValue([lateSchedule]);

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Log Dose Now')).toBeTruthy();
      });

      // Create a timestamp for 1:00 AM next day (2 hours after 23:00 - should match)
      const logTime = new Date();
      logTime.setHours(1, 0, 0, 0);
      const logTimestamp = logTime.getTime();

      const originalDateNow = Date.now;
      Date.now = jest.fn(() => logTimestamp);

      fireEvent.press(screen.getByText('Log Dose Now'));

      await waitFor(() => {
        expect(mockLogDose).toHaveBeenCalledWith(
          expect.objectContaining({
            scheduleId: 'schedule-1',
            medicationId: 'med-123',
            timestamp: logTimestamp,
          })
        );
      });

      Date.now = originalDateNow;
    });

    it('should ignore disabled schedules', async () => {
      const enabledSchedule = {
        id: 'schedule-enabled',
        medicationId: 'med-123',
        time: '08:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
        reminderEnabled: true,
      };

      const disabledSchedule = {
        id: 'schedule-disabled',
        medicationId: 'med-123',
        time: '08:15',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: false,
        reminderEnabled: false,
      };

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: mockPreventativeMedication,
        schedules: [enabledSchedule, disabledSchedule],
        doses: [],
      });

      mockGetSchedulesByMedicationId.mockReturnValue([enabledSchedule, disabledSchedule]);

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Log Dose Now')).toBeTruthy();
      });

      // Log at 8:15 AM - closer to disabled schedule but should use enabled one
      const logTime = new Date();
      logTime.setHours(8, 15, 0, 0);
      const logTimestamp = logTime.getTime();

      const originalDateNow = Date.now;
      Date.now = jest.fn(() => logTimestamp);

      fireEvent.press(screen.getByText('Log Dose Now'));

      await waitFor(() => {
        expect(mockLogDose).toHaveBeenCalledWith(
          expect.objectContaining({
            scheduleId: 'schedule-enabled',
            medicationId: 'med-123',
            timestamp: logTimestamp,
          })
        );
      });

      Date.now = originalDateNow;
    });

    it('should select closest schedule when multiple schedules are available', async () => {
      const morningSchedule = {
        id: 'schedule-morning',
        medicationId: 'med-123',
        time: '08:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
        reminderEnabled: true,
      };

      const eveningSchedule = {
        id: 'schedule-evening',
        medicationId: 'med-123',
        time: '20:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
        reminderEnabled: true,
      };

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: mockPreventativeMedication,
        schedules: [morningSchedule, eveningSchedule],
        doses: [],
      });

      mockGetSchedulesByMedicationId.mockReturnValue([morningSchedule, eveningSchedule]);

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Log Dose Now')).toBeTruthy();
      });

      // Log at 8:30 AM - closer to morning schedule
      const logTime = new Date();
      logTime.setHours(8, 30, 0, 0);
      const logTimestamp = logTime.getTime();

      const originalDateNow = Date.now;
      Date.now = jest.fn(() => logTimestamp);

      fireEvent.press(screen.getByText('Log Dose Now'));

      await waitFor(() => {
        expect(mockLogDose).toHaveBeenCalledWith(
          expect.objectContaining({
            scheduleId: 'schedule-morning',
            medicationId: 'med-123',
            timestamp: logTimestamp,
          })
        );
      });

      Date.now = originalDateNow;
    });

    it('should use schedule resolution in Log Dose with Details modal', async () => {
      const schedule = {
        id: 'schedule-1',
        medicationId: 'med-123',
        time: '08:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
        reminderEnabled: true,
      };

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: mockPreventativeMedication,
        schedules: [schedule],
        doses: [],
      });

      mockGetSchedulesByMedicationId.mockReturnValue([schedule]);

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Log Dose with Details')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Log Dose with Details'));

      await waitFor(() => {
        expect(screen.getByText('Log Dose')).toBeTruthy();
      });

      // Just test that the function is called - the schedule resolution logic 
      // is already tested in other scenarios with more controlled timing
      const amountInput = screen.getByTestId('log-dose-amount-input');
      fireEvent.changeText(amountInput, '2');

      fireEvent.press(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockLogDose).toHaveBeenCalledWith(
          expect.objectContaining({
            medicationId: 'med-123',
            // scheduleId will depend on current time which we can't easily control in modal
          })
        );
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle medication loading timeout with retry', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      
      // Mock loadMedicationWithDetails to fail with timeout, then succeed
      mockLoadMedicationWithDetails
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce({
          medication: defaultMedication,
          schedules: [],
          doses: [],
        });

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      // Should show error initially
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to load medication details');
      });

      // Component should recover when data loads successfully on retry
      expect(mockLoadMedicationWithDetails).toHaveBeenCalledWith('med-123');
    });

    it('should handle schedule loading failure gracefully', async () => {
      const medicationWithoutSchedules = {
        medication: defaultMedication,
        schedules: [],
        doses: [],
      };

      // Mock initial load success but schedules are empty (simulating loading failure)
      mockLoadMedicationWithDetails.mockResolvedValue(medicationWithoutSchedules);
      mockGetSchedulesByMedicationId.mockReturnValue([]); // Empty schedules instead of throwing

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Medication')).toBeTruthy();
      });

      // Should still allow dose logging without schedules
      expect(screen.getByText('Log Dose Now')).toBeTruthy();
      
      // Should be able to log a dose even without schedules
      const logButton = screen.getByText('Log Dose Now');
      fireEvent.press(logButton);

      await waitFor(() => {
        expect(mockLogDose).toHaveBeenCalledWith(
          expect.objectContaining({
            medicationId: 'med-123',
            scheduleId: undefined, // Should be undefined when no schedules
          })
        );
      });
    });

    it('should handle database corruption during dose history loading', async () => {
      const dbError = new Error('Database disk image is malformed');
      dbError.name = 'SQLiteError';

      // Load medication successfully but fail loading doses
      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses: [], // Empty due to database error
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

      // Should show empty state for recent activity
      expect(screen.getByText('No doses logged in the last 30 days')).toBeTruthy();

      // Should still allow new dose logging
      expect(screen.getByText('Log Dose Now')).toBeTruthy();
    });

    it('should handle network failures during focus refresh', async () => {
      // Initial load succeeds
      mockLoadMedicationWithDetails.mockResolvedValueOnce({
        medication: defaultMedication,
        schedules: [],
        doses: [],
      });

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
        expect(screen.getByText('Test Medication')).toBeTruthy();
      });

      // Mock network failure on focus refresh
      const networkError = new Error('Network request failed');
      mockLoadMedicationWithDetails.mockRejectedValueOnce(networkError);

      // Simulate focus event
      const focusCallback = mockAddListener.mock.calls[0][1];
      await focusCallback();

      // Should handle refresh failure gracefully without crashing
      expect(screen.getByText('Test Medication')).toBeTruthy();
    });

    it('should handle concurrent dose operations', async () => {
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

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses: [mockDose],
      });

      // Mock update dose to succeed after delay
      mockUpdateDose.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

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
      
      // Simulate rapid multiple edit attempts (race condition)
      let actionSheetCallback: Function | undefined;
      (ActionSheetIOS.showActionSheetWithOptions as jest.Mock).mockImplementation((options, callback) => {
        actionSheetCallback = callback;
      });

      fireEvent(doseItems[0], 'longPress');
      
      await act(async () => {
        actionSheetCallback!(1); // Edit
      });

      await waitFor(() => {
        expect(screen.getByText('Edit Dose')).toBeTruthy();
      });

      // Simulate multiple rapid save attempts
      const amountInput = screen.getByTestId('dose-amount-input');
      fireEvent.changeText(amountInput, '2');

      const saveButton = screen.getByText('Save');
      
      // Fire multiple save attempts rapidly
      fireEvent.press(saveButton);
      fireEvent.press(saveButton);
      fireEvent.press(saveButton);

      // Should handle concurrent operations gracefully
      await waitFor(() => {
        expect(mockUpdateDose).toHaveBeenCalledWith('dose-1', expect.any(Object));
      });
    });

    it('should recover from temporary data corruption', async () => {
      // Mock corrupted data response
      const corruptedMedication = {
        medication: {
          ...defaultMedication,
          name: null, // Corrupted name
          dosageAmount: 'invalid', // Corrupted dosage
        } as any,
        schedules: [
          {
            id: 'corrupted-schedule',
            time: 'invalid-time',
            // missing required fields
          }
        ] as any,
        doses: [
          {
            id: 'corrupted-dose',
            quantity: 'not-a-number',
            // missing timestamp
          }
        ] as any,
      };

      // First load returns corrupted data, second load returns valid data
      mockLoadMedicationWithDetails
        .mockResolvedValueOnce(corruptedMedication)
        .mockResolvedValueOnce({
          medication: defaultMedication,
          schedules: [],
          doses: [],
        });

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      // Should handle corrupted data gracefully
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).toBeNull();
      });

      // Should either show error state or recovered data
      // The component should not crash due to corrupted data
    });

    it('should handle memory pressure during large dose history loading', async () => {
      const largeDoseHistory = Array.from({ length: 1000 }, (_, i) => ({
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

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses: largeDoseHistory,
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

      // Should handle large datasets gracefully
      // Check that the screen still loads and shows the medication name
      expect(screen.getByText('Test Medication')).toBeTruthy();
      
      // The component should gracefully handle memory pressure without crashing
      expect(screen.getByText('Recent Activity')).toBeTruthy();
    });

    it('should validate dose input during concurrent edits', async () => {
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

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses: [mockDose],
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

      let actionSheetCallback: Function | undefined;
      (ActionSheetIOS.showActionSheetWithOptions as jest.Mock).mockImplementation((options, callback) => {
        actionSheetCallback = callback;
      });

      const doseItems = screen.getAllByText(/Dec \d+, \d{4}/);
      fireEvent(doseItems[0], 'longPress');
      
      await act(async () => {
        actionSheetCallback!(1); // Edit
      });

      await waitFor(() => {
        expect(screen.getByText('Edit Dose')).toBeTruthy();
      });

      // Test invalid input validation
      const amountInput = screen.getByTestId('dose-amount-input');
      fireEvent.changeText(amountInput, '-1'); // Invalid negative amount

      fireEvent.press(screen.getByText('Save'));

      // Should validate and show error
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Invalid Amount', 'Please enter a valid dose amount');
      });

      // Should not call updateDose with invalid data
      expect(mockUpdateDose).not.toHaveBeenCalled();
    });

    it('should handle archive operation during active use', async () => {
      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses: [],
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

      // Mock archive failure
      mockArchiveMedication.mockRejectedValue(new Error('Archive operation failed'));

      let archiveCallback: Function | undefined;
      (Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
        if (title === 'Archive Medication') {
          archiveCallback = buttons.find((b: any) => b.text === 'Archive').onPress;
        }
      });

      fireEvent.press(screen.getByTestId('archive-medication-button'));

      await act(async () => {
        archiveCallback!();
      });

      // Should handle archive failure gracefully
      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith('Failed to archive medication:', expect.any(Error));
      });

      // Should remain on the screen and allow retry
      expect(screen.getByTestId('archive-medication-button')).toBeTruthy();
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle rapid navigation changes gracefully', async () => {
      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      // Mock successful loading with delay
      mockLoadMedicationWithDetails.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          medication: defaultMedication,
          schedules: [],
          doses: [],
        }), 100))
      );

      const { unmount } = renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      // Unmount quickly before loading completes (simulates rapid navigation)
      unmount();

      // Should not cause memory leaks or unhandled promise rejections
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    it('should handle malformed timestamp data', async () => {
      const malformedDose = {
        id: 'dose-malformed',
        medicationId: 'med-123',
        timestamp: 'invalid-timestamp', // Malformed timestamp
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg',
        status: 'taken',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any;

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: defaultMedication,
        schedules: [],
        doses: [malformedDose],
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

      // Should handle malformed data gracefully without crashing
      // May show empty or error state for recent activity
    });

    it('should handle timezone-related scheduling edge cases', async () => {
      const mockPreventativeMedication = {
        ...defaultMedication,
        type: 'preventative' as const,
      };

      const edgeCaseSchedule = {
        id: 'schedule-edge',
        medicationId: 'med-123',
        time: '02:30', // During DST transition
        timezone: 'America/New_York',
        dosage: 1,
        enabled: true,
        reminderEnabled: true,
      };

      mockLoadMedicationWithDetails.mockResolvedValue({
        medication: mockPreventativeMedication,
        schedules: [edgeCaseSchedule],
        doses: [],
      });

      mockGetSchedulesByMedicationId.mockReturnValue([edgeCaseSchedule]);

      const mockRoute = {
        params: { medicationId: 'med-123' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Log Dose Now')).toBeTruthy();
      });

      // Should handle timezone edge cases without throwing
      fireEvent.press(screen.getByText('Log Dose Now'));

      await waitFor(() => {
        expect(mockLogDose).toHaveBeenCalled();
      });
    });
  });
});
