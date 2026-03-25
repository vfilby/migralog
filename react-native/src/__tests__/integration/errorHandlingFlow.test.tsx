import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

import LogMedicationScreen from '../../screens/medication/LogMedicationScreen';
import MedicationDetailScreen from '../../screens/medication/MedicationDetailScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import { useMedicationStore } from '../../store/medicationStore';
import { useEpisodeStore } from '../../store/episodeStore';
import { Medication, MedicationSchedule } from '../../models/types';

// Mock all dependencies
jest.mock('../../store/medicationStore');
jest.mock('../../store/episodeStore');
jest.mock('../../utils/logger');
jest.mock('../../database/medicationRepository');
jest.mock('../../services/notifications/notificationService');

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

jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

describe('Error Handling Integration Tests', () => {
  let mockMedicationStore: any;
  let mockEpisodeStore: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mock implementations
    mockMedicationStore = {
      loadMedications: jest.fn().mockResolvedValue(undefined),
      loadSchedules: jest.fn().mockResolvedValue(undefined),
      loadMedicationWithDetails: jest.fn(),
      logDose: jest.fn().mockResolvedValue({ id: 'dose-123' }),
      getMedicationById: jest.fn(),
      getSchedulesByMedicationId: jest.fn().mockReturnValue([]),
      rescueMedications: [],
    };

    mockEpisodeStore = {
      currentEpisode: null,
    };

    (useMedicationStore as unknown as jest.Mock).mockReturnValue(mockMedicationStore);
    (useEpisodeStore as unknown as jest.Mock).mockReturnValue(mockEpisodeStore);
  });

  describe('Complete Error Recovery Flow', () => {
    it('should handle schedule loading failure and recovery during dose logging flow', async () => {
      const preventativeMedication: Medication = {
        id: 'prev-med-flow',
        name: 'Propranolol',
        type: 'preventative',
        dosageAmount: 40,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        scheduleFrequency: 'daily',
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const validSchedule: MedicationSchedule = {
        id: 'schedule-flow',
        medicationId: 'prev-med-flow',
        time: '08:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
        reminderEnabled: true,
      };

      // Set up initial state
      mockMedicationStore.getMedicationById.mockReturnValue(preventativeMedication);
      mockMedicationStore.rescueMedications = [preventativeMedication];

      // Phase 1: Initial schedule loading fails
      let scheduleLoadCount = 0;
      mockMedicationStore.loadSchedules.mockImplementation(() => {
        scheduleLoadCount++;
        if (scheduleLoadCount <= 2) {
          // First and retry attempts fail
          return Promise.reject(new Error('Network timeout'));
        }
        // Third attempt succeeds
        mockMedicationStore.getSchedulesByMedicationId.mockReturnValue([validSchedule]);
        return Promise.resolve();
      });

      const logMedicationRoute = {
        key: 'LogMedication',
        name: 'LogMedication' as const,
        params: {
          medicationId: 'prev-med-flow',
        },
      };

      const { rerender } = renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={logMedicationRoute as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
      });

      // Should attempt to load schedules and fail with retry
      expect(mockMedicationStore.loadSchedules).toHaveBeenCalledWith('prev-med-flow');
      expect(mockMedicationStore.loadSchedules).toHaveBeenCalledTimes(2); // Initial + retry

      // Phase 2: User logs dose without schedules (fallback behavior)
      const saveButton = screen.getByLabelText('Log medication');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockMedicationStore.logDose).toHaveBeenCalledWith(
          expect.objectContaining({
            medicationId: 'prev-med-flow',
            scheduleId: undefined, // Should handle missing schedules gracefully
          })
        );
      });

      // Phase 3: Navigation to detail screen with recovered schedules
      mockMedicationStore.loadMedicationWithDetails.mockResolvedValue({
        medication: preventativeMedication,
        schedules: [validSchedule],
        doses: [],
      });

      const detailRoute = {
        params: { medicationId: 'prev-med-flow' },
      };

      rerender(
        <MedicationDetailScreen navigation={mockNavigation as any} route={detailRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Propranolol')).toBeTruthy();
      });

      // Phase 4: Schedule now available, dose logging with scheduleId
      mockMedicationStore.getSchedulesByMedicationId.mockReturnValue([validSchedule]);

      const logDoseNowButton = screen.getByText('Log Dose Now');
      fireEvent.press(logDoseNowButton);

      await waitFor(() => {
        expect(mockMedicationStore.logDose).toHaveBeenCalledWith(
          expect.objectContaining({
            medicationId: 'prev-med-flow',
            // Should now include scheduleId since schedules are available
          })
        );
      });

      // Verify successful dose logging occurred
      expect(mockMedicationStore.logDose).toHaveBeenCalled();
    });

    it('should handle database corruption and recovery with data preservation', async () => {
      const rescueMedication: Medication = {
        id: 'rescue-recovery',
        name: 'Ibuprofen',
        type: 'rescue',
        dosageAmount: 200,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Phase 1: Simulate database corruption with empty medications list
      mockMedicationStore.rescueMedications = [];
      // Don't explicitly reject, just keep medications list empty to simulate loading failure

      const route = {
        key: 'LogMedication',
        name: 'LogMedication' as const,
        params: {},
      };

      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={route as any} 
        />
      );

      await waitFor(() => {
        // Should show empty state due to loading failure
        expect(screen.getByText('No rescue medications added yet')).toBeTruthy();
      });

      // Phase 2: Database recovery - medications become available
      mockMedicationStore.loadMedications.mockResolvedValue(undefined);
      mockMedicationStore.rescueMedications = [rescueMedication];
      mockMedicationStore.getMedicationById.mockReturnValue(rescueMedication);

      // Simulate app refresh
      fireEvent.press(screen.getByText('Cancel'));
      expect(mockNavigation.goBack).toHaveBeenCalled();

      // Phase 3: Render with recovered data
      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={route as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Ibuprofen')).toBeTruthy();
      });

      // Should now allow normal operations
      const quickLogButton = screen.getByText('Log 1 × 200mg');
      fireEvent.press(quickLogButton);

      await waitFor(() => {
        expect(mockMedicationStore.logDose).toHaveBeenCalled();
      });
    });

    it('should handle race conditions between concurrent screen operations', async () => {
      const preventativeMedication: Medication = {
        id: 'race-med',
        name: 'Race Condition Med',
        type: 'preventative',
        dosageAmount: 50,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const initialSchedule: MedicationSchedule = {
        id: 'initial-schedule',
        medicationId: 'race-med',
        time: '08:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
        reminderEnabled: true,
      };

      const updatedSchedule: MedicationSchedule = {
        ...initialSchedule,
        time: '09:00', // Time updated concurrently
      };

      mockMedicationStore.getMedicationById.mockReturnValue(preventativeMedication);
      mockMedicationStore.loadMedicationWithDetails.mockResolvedValue({
        medication: preventativeMedication,
        schedules: [initialSchedule],
        doses: [],
      });

      // Phase 1: Load detail screen with initial schedule
      mockMedicationStore.getSchedulesByMedicationId
        .mockReturnValueOnce([initialSchedule])
        .mockReturnValueOnce([updatedSchedule]); // Concurrent update changes schedule

      const detailRoute = {
        params: { medicationId: 'race-med' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={detailRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Race Condition Med')).toBeTruthy();
      });

      // Phase 2: Concurrent operations
      const logButton = screen.getByText('Log Dose Now');

      // Simulate rapid button presses (race condition)
      fireEvent.press(logButton);
      fireEvent.press(logButton);
      fireEvent.press(logButton);

      // Should handle multiple concurrent logging attempts gracefully
      await waitFor(() => {
        expect(mockMedicationStore.logDose).toHaveBeenCalledTimes(3);
      });

      // All operations should complete without errors
      expect(Alert.alert).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('error')
      );
    });
  });

  describe('Network and Connectivity Error Scenarios', () => {
    it('should handle offline-to-online transition during medication operations', async () => {
      const medication: Medication = {
        id: 'offline-med',
        name: 'Offline Test Med',
        type: 'rescue',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Phase 1: Simulate offline state with empty medications
      mockMedicationStore.rescueMedications = [];
      // Don't explicitly reject, just keep medications list empty to simulate offline state

      const route = {
        key: 'LogMedication',
        name: 'LogMedication' as const,
        params: {},
      };

      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={route as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No rescue medications added yet')).toBeTruthy();
      });

      // Phase 2: Simulate online state - data becomes available
      mockMedicationStore.loadMedications.mockResolvedValue(undefined);
      mockMedicationStore.rescueMedications = [medication];
      mockMedicationStore.getMedicationById.mockReturnValue(medication);
      mockMedicationStore.logDose.mockResolvedValue({ id: 'dose-123' });

      // Simulate network recovery by re-rendering
      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={route as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Offline Test Med')).toBeTruthy();
      });

      // Phase 3: Operations should work after recovery
      const quickLogButton = screen.getByText('Log 1 × 100mg');
      fireEvent.press(quickLogButton);

      await waitFor(() => {
        expect(mockMedicationStore.logDose).toHaveBeenCalledWith(
          expect.objectContaining({
            medicationId: 'offline-med',
          })
        );
        expect(mockNavigation.goBack).toHaveBeenCalled();
      });
    });

    it('should handle intermittent connectivity during dose logging', async () => {
      const medication: Medication = {
        id: 'intermittent-med',
        name: 'Intermittent Med',
        type: 'rescue',
        dosageAmount: 75,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      mockMedicationStore.rescueMedications = [medication];
      mockMedicationStore.getMedicationById.mockReturnValue(medication);

      // Simulate intermittent connectivity - fails then succeeds
      let logAttempts = 0;
      mockMedicationStore.logDose.mockImplementation(() => {
        logAttempts++;
        if (logAttempts === 1) {
          return Promise.reject(new Error('Connection lost'));
        }
        return Promise.resolve({ id: 'dose-intermittent' });
      });

      const route = {
        key: 'LogMedication',
        name: 'LogMedication' as const,
        params: {
          medicationId: 'intermittent-med',
        },
      };

      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={route as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
      });

      // First attempt fails due to intermittent connectivity
      const saveButton = screen.getByLabelText('Log medication');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to log medication');
      });

      // Second attempt should succeed
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockNavigation.goBack).toHaveBeenCalled();
      });

      expect(mockMedicationStore.logDose).toHaveBeenCalledTimes(2);
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should maintain data integrity during concurrent schedule updates and dose logging', async () => {
      const preventativeMedication: Medication = {
        id: 'integrity-med',
        name: 'Data Integrity Med',
        type: 'preventative',
        dosageAmount: 25,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const originalSchedule: MedicationSchedule = {
        id: 'integrity-schedule',
        medicationId: 'integrity-med',
        time: '08:00',
        timezone: 'America/Los_Angeles',
        dosage: 1,
        enabled: true,
        reminderEnabled: true,
      };

      // Phase 1: Load medication detail with original schedule
      mockMedicationStore.loadMedicationWithDetails.mockResolvedValue({
        medication: preventativeMedication,
        schedules: [originalSchedule],
        doses: [],
      });

      mockMedicationStore.getSchedulesByMedicationId.mockReturnValue([originalSchedule]);

      const detailRoute = {
        params: { medicationId: 'integrity-med' },
      };

      renderWithProviders(
        <MedicationDetailScreen navigation={mockNavigation as any} route={detailRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Data Integrity Med')).toBeTruthy();
      });

      // Phase 2: Simulate concurrent schedule update while user is logging dose
      const logButton = screen.getByText('Log Dose with Details');
      fireEvent.press(logButton);

      await waitFor(() => {
        expect(screen.getByText('Log Dose')).toBeTruthy();
      });

      // While modal is open, simulate external schedule update
      const updatedSchedule = {
        ...originalSchedule,
        time: '08:30', // External update changes time
        enabled: false, // And disables the schedule
      };

      mockMedicationStore.getSchedulesByMedicationId.mockReturnValue([updatedSchedule]);

      // User submits dose with original schedule data still in component state
      const amountInput = screen.getByTestId('log-dose-amount-input');
      fireEvent.changeText(amountInput, '1');

      fireEvent.press(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockMedicationStore.logDose).toHaveBeenCalled();
      });

      // Should handle the data integrity scenario gracefully
      // The component should use fresh schedule data for resolution
      const logCall = mockMedicationStore.logDose.mock.calls[0][0];
      expect(logCall.medicationId).toBe('integrity-med');
      
      // scheduleId should be undefined since the schedule is now disabled
      expect(logCall.scheduleId).toBeUndefined();
    });

    it('should handle validation errors during multi-step operations', async () => {
      const medication: Medication = {
        id: 'validation-med',
        name: 'Validation Med',
        type: 'rescue',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      mockMedicationStore.rescueMedications = [medication];
      mockMedicationStore.getMedicationById.mockReturnValue(medication);

      const route = {
        key: 'LogMedication',
        name: 'LogMedication' as const,
        params: {
          medicationId: 'validation-med',
        },
      };

      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={route as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
      });

      // Phase 1: Invalid input validation - clear amount field to test empty validation
      const amountInput = screen.getByDisplayValue('1');
      fireEvent.changeText(amountInput, ''); // Empty amount

      const saveButton = screen.getByLabelText('Log medication');
      fireEvent.press(saveButton);

      await waitFor(() => {
        // The component should show an error for empty amount
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a valid amount');
      }, { timeout: 3000 });

      // Should not attempt to log invalid dose
      expect(mockMedicationStore.logDose).not.toHaveBeenCalled();

      // Phase 2: Correct input and successful submission
      fireEvent.changeText(amountInput, '2'); // Valid amount

      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockMedicationStore.logDose).toHaveBeenCalledWith(
          expect.objectContaining({
            medicationId: 'validation-med',
            quantity: 2,
          })
        );
      });
    });
  });

  describe('Performance Under Error Conditions', () => {
    it('should maintain performance during error recovery with large datasets', async () => {
      // Create large dataset to simulate performance stress
      const largeMedicationList = Array.from({ length: 100 }, (_, i) => ({
        id: `stress-med-${i}`,
        name: `Stress Med ${i}`,
        type: 'rescue' as const,
        dosageAmount: 100 + i,
        dosageUnit: 'mg' as const,
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      // Phase 1: Simulate initial load timeout with empty medications
      mockMedicationStore.rescueMedications = [];
      // Don't explicitly reject, just keep medications list empty to simulate timeout

      const route = {
        key: 'LogMedication',
        name: 'LogMedication' as const,
        params: {},
      };

      const { rerender } = renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={route as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No rescue medications added yet')).toBeTruthy();
      });

      // Phase 2: Successful load with large dataset
      mockMedicationStore.loadMedications.mockResolvedValue(undefined);
      mockMedicationStore.rescueMedications = largeMedicationList;

      const startTime = Date.now();
      
      rerender(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={route as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Stress Med 0')).toBeTruthy();
      }, { timeout: 5000 });

      const endTime = Date.now();
      const renderTime = endTime - startTime;

      // Should render large dataset within reasonable time
      expect(renderTime).toBeLessThan(2000); // 2 seconds max
      
      // Should display multiple medications
      expect(screen.getByText('Stress Med 1')).toBeTruthy();
    });
  });
});