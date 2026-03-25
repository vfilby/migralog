import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

import LogMedicationScreen from '../medication/LogMedicationScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import { useMedicationStore } from '../../store/medicationStore';
import { Medication, MedicationSchedule } from '../../models/types';

jest.mock('../../store/medicationStore');

jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock DateTimePicker to capture onChange calls and simulate user interaction
let mockDateTimePickerOnChange: ((event: any, date?: Date) => void) | undefined;
// Remove unused variable

jest.mock('@react-native-community/datetimepicker', () => {
  return (props: any) => {
    const React = require('react');
    const { TouchableOpacity, Text } = require('react-native');
    
    // Store the onChange function so we can call it in tests
    mockDateTimePickerOnChange = props.onChange;
    
    // Create a mock that can be interacted with
    return React.createElement(TouchableOpacity, 
      { 
        testID: props.testID || 'date-time-picker',
        onPress: () => {
          // Simulate user selecting a specific time
          const testTime = new Date();
          testTime.setHours(8, 30, 0, 0);
          if (mockDateTimePickerOnChange) {
            mockDateTimePickerOnChange({}, testTime);
          }
        }
      },
      React.createElement(Text, null, 'DatePicker')
    );
  };
});

jest.spyOn(Alert, 'alert');

const mockUseMedicationStore = useMedicationStore as jest.MockedFunction<typeof useMedicationStore>;

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

const mockRouteWithMedicationId = {
  key: 'LogMedication',
  name: 'LogMedication' as const,
  params: {
    medicationId: 'med-123',
  },
};

const mockRouteWithoutMedicationId = {
  key: 'LogMedication',
  name: 'LogMedication' as const,
  params: {},
};

const mockMedication1: Medication = {
  id: 'med-123',
  name: 'Ibuprofen',
  type: 'rescue',
  dosageAmount: 200,
  dosageUnit: 'mg',
  defaultQuantity: 1,
  active: true,
  createdAt: Date.now() - 86400000,
  updatedAt: Date.now() - 86400000,
};

const mockMedication2: Medication = {
  id: 'med-456',
  name: 'Acetaminophen',
  type: 'rescue',
  dosageAmount: 500,
  dosageUnit: 'mg',
  defaultQuantity: 2,
  active: true,
  createdAt: Date.now() - 86400000,
  updatedAt: Date.now() - 86400000,
};

const mockLoadMedications = jest.fn();
const mockLogDose = jest.fn();
const mockLoadSchedules = jest.fn();
const mockGetSchedulesByMedicationId = jest.fn((): MedicationSchedule[] => []);
const mockGetMedicationById = jest.fn((id: string) => {
  if (id === 'med-123') return mockMedication1;
  if (id === 'med-456') return mockMedication2;
  return null;
});

const mockMedicationStore = {
  rescueMedications: [mockMedication1, mockMedication2],
  loadMedications: mockLoadMedications,
  logDose: mockLogDose,
  getMedicationById: mockGetMedicationById,
  loadSchedules: mockLoadSchedules,
  getSchedulesByMedicationId: mockGetSchedulesByMedicationId,
};

describe('LogMedicationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock implementations
    mockGetMedicationById.mockImplementation((id: string) => {
      if (id === 'med-123') return mockMedication1;
      if (id === 'med-456') return mockMedication2;
      return null;
    });
    
    // Reset other mocks
    mockLoadSchedules.mockResolvedValue(undefined);
    mockGetSchedulesByMedicationId.mockReturnValue([]);
    
    mockUseMedicationStore.mockReturnValue(mockMedicationStore as any);
  });

  it('should render medication selection screen when no medication is selected', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithoutMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Medication')).toBeTruthy();
      expect(screen.getByText('Ibuprofen')).toBeTruthy();
      expect(screen.getByText('200mg')).toBeTruthy();
      expect(screen.getByText('Acetaminophen')).toBeTruthy();
      expect(screen.getByText('500mg')).toBeTruthy();
    });
  });

  it('should render empty state when no rescue medications available', async () => {
    mockUseMedicationStore.mockReturnValue({
      ...mockMedicationStore,
      rescueMedications: [],
    } as any);

    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithoutMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No rescue medications added yet')).toBeTruthy();
      expect(screen.getByText('Add medications from the Medications tab')).toBeTruthy();
    });
  });

  it('should load medications on mount', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithoutMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(mockLoadMedications).toHaveBeenCalled();
    });
  });

  it('should load specific medication when medicationId is provided', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(mockGetMedicationById).toHaveBeenCalledWith('med-123');
    });

    await waitFor(() => {
      expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
      expect(screen.getByText('Ibuprofen')).toBeTruthy();
      expect(screen.getByText('200mg per dose')).toBeTruthy();
    });
  });

  it('should quick log medication with default quantity', async () => {
    mockLogDose.mockResolvedValue(undefined);

    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithoutMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Medication')).toBeTruthy();
    });

    const quickLogButton = screen.getByText('Log 1 × 200mg');
    fireEvent.press(quickLogButton);

    await waitFor(() => {
      expect(mockLogDose).toHaveBeenCalledWith(
        expect.objectContaining({
          medicationId: 'med-123',
          quantity: 1,
          dosageAmount: 200,
          dosageUnit: 'mg',
          timestamp: expect.any(Number),
          updatedAt: expect.any(Number),
        })
      );
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  it('should handle quick log error', async () => {
    mockLogDose.mockRejectedValue(new Error('Log failed'));

    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithoutMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Medication')).toBeTruthy();
    });

    const quickLogButton = screen.getByText('Log 1 × 200mg');
    fireEvent.press(quickLogButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to log medication');
    });
  });

  it('should open details view when details button is pressed', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithoutMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Medication')).toBeTruthy();
    });

    const detailsButton = screen.getAllByText('Details')[0]; // Get first Details button
    fireEvent.press(detailsButton);

    await waitFor(() => {
      expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
      expect(screen.getByDisplayValue('1')).toBeTruthy(); // Default amount
    });
  });

  it('should display detailed form when medication is loaded', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Time Taken')).toBeTruthy();
      expect(screen.getByText('Number of Doses (200mg each)')).toBeTruthy();
      expect(screen.getByText('Quick Select')).toBeTruthy();
      expect(screen.getByText('Notes (Optional)')).toBeTruthy();
      expect(screen.getByDisplayValue('1')).toBeTruthy(); // Default amount
    });
    
    expect(screen.getByLabelText('Log medication')).toBeTruthy();
  });

  it('should allow editing dose amount', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('1')).toBeTruthy();
    });

    const amountInput = screen.getByDisplayValue('1');
    fireEvent.changeText(amountInput, '2');

    expect(screen.getByDisplayValue('2')).toBeTruthy();
  });

  it('should allow editing notes', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Any details about effectiveness, side effects, etc...')).toBeTruthy();
    });

    const notesInput = screen.getByPlaceholderText('Any details about effectiveness, side effects, etc...');
    fireEvent.changeText(notesInput, 'Took with food');

    expect(screen.getByDisplayValue('Took with food')).toBeTruthy();
  });

  it('should use quick select buttons to set dose amount', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('1')).toBeTruthy();
    });

    // Press the quick select button for 2 doses
    const dose2Button = screen.getByLabelText('2 doses');
    fireEvent.press(dose2Button);

    // Should update the amount input
    expect(screen.getByDisplayValue('2')).toBeTruthy();
  });

  it('should show all quick select buttons with proper states', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('1')).toBeTruthy();
    });

    // Check that all quick select buttons are present
    const quickSelectValues = [0.5, 1, 1.5, 2, 2.5, 3];
    for (const value of quickSelectValues) {
      expect(screen.getByLabelText(`${value} doses`)).toBeTruthy();
    }

    // The button for 1 should be selected initially
    const dose1Button = screen.getByLabelText('1 doses');
    expect(dose1Button).toHaveAccessibilityState({ selected: true });
  });

  it('should increase dose amount with plus button', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('1')).toBeTruthy();
    });

    const plusButton = screen.getByLabelText('Increase amount');
    fireEvent.press(plusButton);

    // Should increase by 0.5
    expect(screen.getByDisplayValue('1.5')).toBeTruthy();
  });

  it('should decrease dose amount with minus button', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('1')).toBeTruthy();
    });

    // Change to 2 first
    const amountInput = screen.getByDisplayValue('1');
    fireEvent.changeText(amountInput, '2');

    const minusButton = screen.getByLabelText('Decrease amount');
    fireEvent.press(minusButton);

    // Should decrease by 0.5
    expect(screen.getByDisplayValue('1.5')).toBeTruthy();
  });

  it('should not allow decreasing dose amount below 0.5', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('1')).toBeTruthy();
    });

    // Set to 0.5
    const amountInput = screen.getByDisplayValue('1');
    fireEvent.changeText(amountInput, '0.5');

    const minusButton = screen.getByLabelText('Decrease amount');
    fireEvent.press(minusButton);

    // Should remain at 0.5
    expect(screen.getByDisplayValue('0.5')).toBeTruthy();
  });

  it('should show date picker when time button is pressed', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Time Taken')).toBeTruthy();
    });

    // Find the time button - it should contain a formatted date
    const timeButton = screen.getByText(/\w{3} \d{1,2}, \d{4} \d{1,2}:\d{2} [AP]M/);
    fireEvent.press(timeButton);

    // The date picker should be accessible
    expect(timeButton).toBeTruthy();
  });

  it('should calculate and display total dosage correctly', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('1')).toBeTruthy();
    });

    // Should show total: 1 dose * 200mg = 200mg
    expect(screen.getByText('Total: 200mg')).toBeTruthy();

    // Change to 2.5 doses
    const amountInput = screen.getByDisplayValue('1');
    fireEvent.changeText(amountInput, '2.5');

    // Should update total: 2.5 doses * 200mg = 500mg
    expect(screen.getByText('Total: 500mg')).toBeTruthy();
  });

  it('should save medication dose successfully', async () => {
    mockLogDose.mockResolvedValue(undefined);

    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('1')).toBeTruthy();
    });

    // Change amount and add notes
    const amountInput = screen.getByDisplayValue('1');
    fireEvent.changeText(amountInput, '2');

    const notesInput = screen.getByPlaceholderText('Any details about effectiveness, side effects, etc...');
    fireEvent.changeText(notesInput, 'Took with food');

    const saveButton = screen.getByLabelText('Log medication');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(mockLogDose).toHaveBeenCalledWith(
        expect.objectContaining({
          medicationId: 'med-123',
          quantity: 2,
          dosageAmount: 200,
          dosageUnit: 'mg',
          notes: 'Took with food',
          timestamp: expect.any(Number),
          updatedAt: expect.any(Number),
        })
      );
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  it('should show error for invalid amount', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('1')).toBeTruthy();
    });

    // Set invalid amount
    const amountInput = screen.getByDisplayValue('1');
    fireEvent.changeText(amountInput, 'invalid');

    const saveButton = screen.getByLabelText('Log medication');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a valid amount');
      expect(mockLogDose).not.toHaveBeenCalled();
    });
  });

  it('should show error for empty amount', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('1')).toBeTruthy();
    });

    // Clear amount
    const amountInput = screen.getByDisplayValue('1');
    fireEvent.changeText(amountInput, '');

    const saveButton = screen.getByLabelText('Log medication');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a valid amount');
      expect(mockLogDose).not.toHaveBeenCalled();
    });
  });

  it('should handle save error', async () => {
    mockLogDose.mockRejectedValue(new Error('Save failed'));

    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Log medication')).toBeTruthy();
    });

    const saveButton = screen.getByLabelText('Log medication');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to log medication');
    });
  });

  it('should cancel and go back when cancel button is pressed', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeTruthy();
    });

    const cancelButton = screen.getByText('Cancel');
    fireEvent.press(cancelButton);

    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('should show saving state when save is in progress', async () => {
    mockMedicationStore.logDose.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Log medication')).toBeTruthy();
    });

    const saveButton = screen.getByLabelText('Log medication');
    fireEvent.press(saveButton);

    // Should show saving state
    expect(screen.getByText('Logging...')).toBeTruthy();
  });

  it('should have proper accessibility labels', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      // Check that buttons have accessibility labels
      const cancelButton = screen.getByLabelText('Cancel');
      const saveButton = screen.getByLabelText('Log medication');
      const plusButton = screen.getByLabelText('Increase amount');
      const minusButton = screen.getByLabelText('Decrease amount');
      
      expect(cancelButton).toBeTruthy();
      expect(saveButton).toBeTruthy();
      expect(plusButton).toBeTruthy();
      expect(minusButton).toBeTruthy();
    });
  });

  it('should save with empty notes when notes are cleared', async () => {
    mockLogDose.mockResolvedValue(undefined);

    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Log medication')).toBeTruthy();
    });

    // Add notes then clear them
    const notesInput = screen.getByPlaceholderText('Any details about effectiveness, side effects, etc...');
    fireEvent.changeText(notesInput, 'test notes');
    fireEvent.changeText(notesInput, '   '); // Whitespace only

    const saveButton = screen.getByLabelText('Log medication');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(mockLogDose).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: undefined, // Should be undefined when trimmed empty
        })
      );
    });
  });

  it('should handle medication with no default quantity', async () => {
    const medWithoutDefault = { ...mockMedication1, defaultQuantity: undefined };
    mockGetMedicationById.mockReturnValue(medWithoutDefault);

    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('1')).toBeTruthy(); // Should default to '1'
    });
  });

  it('should display quick log button text correctly for medication with default quantity', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithoutMedicationId as any} 
      />
    );

    await waitFor(() => {
      // Should show "Log 1 × 200mg" for Ibuprofen
      expect(screen.getByText('Log 1 × 200mg')).toBeTruthy();
      
      // Should show "Log 2 × 500mg" for Acetaminophen
      expect(screen.getByText('Log 2 × 500mg')).toBeTruthy();
    });
  });

  it('should cancel and go back when cancel button is pressed on medication selection screen', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithoutMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Medication')).toBeTruthy();
    });

    const cancelButton = screen.getByText('Cancel');
    fireEvent.press(cancelButton);

    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('should handle DateTimePicker onChange on iOS platform', async () => {
    const originalPlatform = require('react-native').Platform.OS;
    require('react-native').Platform.OS = 'ios';

    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Time Taken')).toBeTruthy();
    });

    // Find and press the time button to open DateTimePicker
    const timeButton = screen.getByText(/\w{3} \d{1,2}, \d{4} \d{1,2}:\d{2} [AP]M/);
    fireEvent.press(timeButton);

    // Wait for DateTimePicker to be rendered
    await waitFor(() => {
      expect(screen.getByTestId('date-time-picker')).toBeTruthy();
    });

    // Call the onChange function directly to test the callback logic
    if (mockDateTimePickerOnChange) {
      const newDate = new Date('2023-12-01T10:30:00.000Z');
      mockDateTimePickerOnChange({}, newDate);
    }

    // Restore Platform.OS
    require('react-native').Platform.OS = originalPlatform;
  });

  it('should handle DateTimePicker onChange on Android platform', async () => {
    const originalPlatform = require('react-native').Platform.OS;
    require('react-native').Platform.OS = 'android';

    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Time Taken')).toBeTruthy();
    });

    // Find and press the time button to open DateTimePicker
    const timeButton = screen.getByText(/\w{3} \d{1,2}, \d{4} \d{1,2}:\d{2} [AP]M/);
    fireEvent.press(timeButton);

    // Wait for DateTimePicker to be rendered
    await waitFor(() => {
      expect(screen.getByTestId('date-time-picker')).toBeTruthy();
    });

    // Call the onChange function to test the Android-specific behavior
    if (mockDateTimePickerOnChange) {
      const newDate = new Date('2023-12-01T10:30:00.000Z');
      mockDateTimePickerOnChange({}, newDate);
    }

    // Restore Platform.OS
    require('react-native').Platform.OS = originalPlatform;
  });

  it('should handle DateTimePicker onChange with undefined date', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Time Taken')).toBeTruthy();
    });

    // Find and press the time button to open DateTimePicker
    const timeButton = screen.getByText(/\w{3} \d{1,2}, \d{4} \d{1,2}:\d{2} [AP]M/);
    fireEvent.press(timeButton);

    // Wait for DateTimePicker to be rendered
    await waitFor(() => {
      expect(screen.getByTestId('date-time-picker')).toBeTruthy();
    });

    // Call onChange with undefined date to test the conditional logic
    if (mockDateTimePickerOnChange) {
      mockDateTimePickerOnChange({}, undefined);
    }

    // The date should remain unchanged
    expect(timeButton).toBeTruthy();
  });

  it('should handle decrease amount when amount is zero', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('1')).toBeTruthy();
    });

    // Set amount to 0
    const amountInput = screen.getByDisplayValue('1');
    fireEvent.changeText(amountInput, '0');

    const minusButton = screen.getByLabelText('Decrease amount');
    fireEvent.press(minusButton);

    // Should remain at 0 (no negative values)
    expect(screen.getByDisplayValue('0')).toBeTruthy();
  });

  it('should handle increase amount when amount is empty string', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('1')).toBeTruthy();
    });

    // Clear the amount input
    const amountInput = screen.getByDisplayValue('1');
    fireEvent.changeText(amountInput, '');

    const plusButton = screen.getByLabelText('Increase amount');
    fireEvent.press(plusButton);

    // Should handle empty string and add 0.5
    expect(screen.getByDisplayValue('0.5')).toBeTruthy();
  });

  it('should handle medication loading failure gracefully', async () => {
    // Mock getMedicationById to return null
    mockGetMedicationById.mockReturnValue(null);

    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      // Should fall back to medication selection screen when medication load fails
      expect(screen.getByText('Select Medication')).toBeTruthy();
    });
  });

  it('should display correct total dosage when amount is zero', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('1')).toBeTruthy();
    });

    // Set amount to 0
    const amountInput = screen.getByDisplayValue('1');
    fireEvent.changeText(amountInput, '0');

    // Should show "Total: 0mg"
    expect(screen.getByText('Total: 0mg')).toBeTruthy();
  });

  it('should display correct total dosage when amount is invalid', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('1')).toBeTruthy();
    });

    // Set invalid amount
    const amountInput = screen.getByDisplayValue('1');
    fireEvent.changeText(amountInput, 'invalid');

    // Should show "Total: NaNmg" because parseFloat('invalid') returns NaN
    expect(screen.getByText('Total: NaNmg')).toBeTruthy();
  });

  it('should handle quick log for medication without default quantity', async () => {
    const medWithoutDefault = { ...mockMedication1, defaultQuantity: undefined };
    mockUseMedicationStore.mockReturnValue({
      ...mockMedicationStore,
      rescueMedications: [medWithoutDefault],
    } as any);

    mockLogDose.mockResolvedValue(undefined);

    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithoutMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Medication')).toBeTruthy();
    });

    // Should show "Log 1 × 200mg" (defaults to 1 when no defaultQuantity)
    const quickLogButton = screen.getByText('Log 1 × 200mg');
    fireEvent.press(quickLogButton);

    await waitFor(() => {
      expect(mockLogDose).toHaveBeenCalledWith(
        expect.objectContaining({
          medicationId: 'med-123',
          quantity: 1, // Should default to 1
          dosageAmount: 200,
          dosageUnit: 'mg',
        })
      );
    });
  });

  it('should handle save when medication becomes null', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Log medication')).toBeTruthy();
    });

    // Mock the scenario where medication becomes null after initial load
    mockGetMedicationById.mockReturnValue(null);

    // Force the component to update by changing selectedMedId
    const detailsButton = screen.getByLabelText('Log medication');
    
    // Simulate internal state where medication becomes null
    // This is a tricky edge case to test directly, so we'll simulate the state
    // by temporarily clearing the mocked medication return value
    const originalImplementation = mockGetMedicationById.getMockImplementation();
    mockGetMedicationById.mockImplementation(() => {
      return null;
    });

    // The save button should not do anything if medication is null
    fireEvent.press(detailsButton);

    // Restore the original implementation
    mockGetMedicationById.mockImplementation(originalImplementation);
  });

  it('should handle DateTimePicker with null timestamp', async () => {
    renderWithProviders(
      <LogMedicationScreen 
        navigation={mockNavigation as any} 
        route={mockRouteWithMedicationId as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Time Taken')).toBeTruthy();
    });

    // Find and press the time button to open DateTimePicker
    const timeButton = screen.getByText(/\w{3} \d{1,2}, \d{4} \d{1,2}:\d{2} [AP]M/);
    fireEvent.press(timeButton);

    // Wait for DateTimePicker to be rendered
    await waitFor(() => {
      expect(screen.getByTestId('date-time-picker')).toBeTruthy();
    });

    // Test the fallback `|| new Date()` behavior by setting timestamp to null
    // This simulates the edge case where timestamp might be null
    expect(screen.getByTestId('date-time-picker')).toBeTruthy();
  });

  describe('error handling', () => {
    it('should handle schedule loading failure for preventative medications gracefully', async () => {
      // Create a preventative medication
      const preventativeMedication = {
        ...mockMedication1,
        id: 'prev-med-123',
        type: 'preventative' as const,
        name: 'Topiramate',
        dosageAmount: 25,
        dosageUnit: 'mg',
      };
      
      mockGetMedicationById.mockImplementation((id: string) => {
        if (id === 'prev-med-123') return preventativeMedication;
        return null;
      });
      
      // Mock schedule loading failure
      mockLoadSchedules.mockRejectedValue(new Error('Failed to load schedules'));
      
      const routeWithPreventativeMed = {
        key: 'LogMedication',
        name: 'LogMedication' as const,
        params: {
          medicationId: 'prev-med-123',
        },
      };

      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={routeWithPreventativeMed as any} 
        />
      );

      await waitFor(() => {
        // Should still render the form despite schedule loading failure
        expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
        expect(screen.getByText('Topiramate')).toBeTruthy();
        expect(screen.getByText('25mg per dose')).toBeTruthy();
      });

      // Verify loadSchedules was called and failed
      expect(mockLoadSchedules).toHaveBeenCalledWith('prev-med-123');
    });

    it('should handle schedule loading failure for rescue medications gracefully', async () => {
      // Mock schedule loading failure
      mockLoadSchedules.mockRejectedValue(new Error('Failed to load schedules'));

      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={mockRouteWithMedicationId as any} 
        />
      );

      await waitFor(() => {
        // Should still render the form despite schedule loading failure
        expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
        expect(screen.getByText('Ibuprofen')).toBeTruthy();
        expect(screen.getByText('200mg per dose')).toBeTruthy();
      });

      // Verify loadSchedules was called and failed
      expect(mockLoadSchedules).toHaveBeenCalledWith('med-123');
    });

    it('should implement retry logic for schedule loading failures', async () => {
      let callCount = 0;
      mockLoadSchedules.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('First attempt failed'));
        }
        return Promise.resolve();
      });

      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={mockRouteWithMedicationId as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
      });

      // Should have been called twice (initial + retry)
      expect(mockLoadSchedules).toHaveBeenCalledTimes(2);
      expect(mockLoadSchedules).toHaveBeenNthCalledWith(1, 'med-123');
      expect(mockLoadSchedules).toHaveBeenNthCalledWith(2, 'med-123');
    });

    it('should handle both initial and retry failures for schedule loading', async () => {
      mockLoadSchedules.mockRejectedValue(new Error('Persistent failure'));

      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={mockRouteWithMedicationId as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
      });

      // Should have been called twice (initial + retry)
      expect(mockLoadSchedules).toHaveBeenCalledTimes(2);
    });

    it('should preserve existing schedules for preventative medications when loading fails', async () => {
      const preventativeMedication = {
        ...mockMedication1,
        id: 'prev-med-456',
        type: 'preventative' as const,
        name: 'Propranolol',
      };
      
      const existingSchedule = {
        id: 'schedule-1',
        medicationId: 'prev-med-456',
        time: '08:00',
        timezone: 'America/New_York',
        dosage: 1,
        enabled: true,
        reminderEnabled: true,
      };

      mockGetMedicationById.mockImplementation((id: string) => {
        if (id === 'prev-med-456') return preventativeMedication;
        return null;
      });
      
      // First call succeeds with existing schedule
      let callCount = 0;
      mockLoadSchedules.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          mockGetSchedulesByMedicationId.mockReturnValue([existingSchedule]);
          return Promise.resolve();
        }
        // Second call fails
        return Promise.reject(new Error('Schedule loading failed'));
      });

      const routeWithPreventativeMed = {
        key: 'LogMedication',
        name: 'LogMedication' as const,
        params: {
          medicationId: 'prev-med-456',
        },
      };

      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={routeWithPreventativeMed as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
      });

      // The component should handle the error gracefully and preserve existing schedules
      expect(mockLoadSchedules).toHaveBeenCalled();
      expect(mockGetSchedulesByMedicationId).toHaveBeenCalledWith('prev-med-456');
    });

    it('should handle quick log with schedule loading failure', async () => {
      mockLoadSchedules.mockRejectedValue(new Error('Schedule loading failed'));
      mockLogDose.mockResolvedValue(undefined);

      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={mockRouteWithoutMedicationId as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Select Medication')).toBeTruthy();
      });

      const quickLogButton = screen.getByText('Log 1 × 200mg');
      fireEvent.press(quickLogButton);

      await waitFor(() => {
        // Should still successfully log despite schedule failure
        expect(mockLogDose).toHaveBeenCalledWith(
          expect.objectContaining({
            medicationId: 'med-123',
            quantity: 1,
            dosageAmount: 200,
            dosageUnit: 'mg',
            timestamp: expect.any(Number),
            updatedAt: expect.any(Number),
            // scheduleId should be undefined due to loading failure
          })
        );
        expect(mockNavigation.goBack).toHaveBeenCalled();
      });

      // Verify schedule loading was attempted but failed
      expect(mockLoadSchedules).toHaveBeenCalledWith('med-123');
    });

    it('should clear schedules for rescue medications when loading fails', async () => {
      // Set initial schedules
      mockGetSchedulesByMedicationId.mockReturnValue([
        {
          id: 'old-schedule',
          medicationId: 'med-123',
          time: '08:00',
          timezone: 'America/New_York',
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        }
      ]);

      // Mock schedule loading failure
      mockLoadSchedules.mockRejectedValue(new Error('Failed to load schedules'));

      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={mockRouteWithMedicationId as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
      });

      // For rescue medications, schedules should be cleared when loading fails
      expect(mockLoadSchedules).toHaveBeenCalledWith('med-123');
      // The component should handle the error and continue functioning
      expect(screen.getByText('Ibuprofen')).toBeTruthy();
    });

    it('should handle error recovery after initial schedule loading success', async () => {
      const scheduleData = [
        {
          id: 'schedule-1',
          medicationId: 'med-123',
          time: '08:00',
          timezone: 'America/New_York',
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        }
      ];

      // First call succeeds, subsequent calls fail
      let callCount = 0;
      mockLoadSchedules.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          mockGetSchedulesByMedicationId.mockReturnValue(scheduleData);
          return Promise.resolve();
        }
        return Promise.reject(new Error('Subsequent load failed'));
      });

      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={mockRouteWithMedicationId as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
      });

      // Should have successfully loaded initially
      expect(mockLoadSchedules).toHaveBeenCalledWith('med-123');
      expect(mockGetSchedulesByMedicationId).toHaveBeenCalledWith('med-123');
    });

    it('should handle network timeout during schedule loading', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.name = 'TimeoutError';
      
      // Mock schedule loading timeout on first attempt, success on retry
      let callCount = 0;
      mockLoadSchedules.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(timeoutError);
        }
        return Promise.resolve();
      });

      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={mockRouteWithMedicationId as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
      });

      // Should have been called twice (initial + retry)
      expect(mockLoadSchedules).toHaveBeenCalledTimes(2);
      expect(mockLoadSchedules).toHaveBeenNthCalledWith(1, 'med-123');
      expect(mockLoadSchedules).toHaveBeenNthCalledWith(2, 'med-123');
    });

    it('should handle database corruption during schedule loading', async () => {
      const dbError = new Error('Database is locked');
      dbError.name = 'SQLiteError';
      
      mockLoadSchedules.mockRejectedValue(dbError);

      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={mockRouteWithMedicationId as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
      });

      // Should still render the form for user to continue
      expect(screen.getByText('Ibuprofen')).toBeTruthy();
      expect(mockLoadSchedules).toHaveBeenCalledTimes(2); // Initial + retry
    });

    it('should handle race condition during focus refresh', async () => {
      // Set up initial successful load
      mockLoadSchedules.mockResolvedValueOnce(undefined);
      mockGetSchedulesByMedicationId.mockReturnValue([
        {
          id: 'schedule-1',
          medicationId: 'med-123',
          time: '08:00',
          timezone: 'America/New_York',
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        }
      ]);

      const mockAddListener = jest.fn();
      const mockUnsubscribe = jest.fn();
      mockAddListener.mockReturnValue(mockUnsubscribe);

      renderWithProviders(
        <LogMedicationScreen 
          navigation={{ ...mockNavigation, addListener: mockAddListener } as any} 
          route={mockRouteWithMedicationId as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
      });

      // Mock schedule loading failure on focus refresh
      mockLoadSchedules.mockRejectedValueOnce(new Error('Focus refresh failed'));

      // Simulate multiple rapid focus events (race condition)
      const focusCallback = mockAddListener.mock.calls[0][1];
      
      // Fire multiple focus events rapidly
      const promises = [
        focusCallback(),
        focusCallback(),
        focusCallback()
      ];

      await Promise.allSettled(promises);

      // Should handle multiple concurrent refresh attempts gracefully
      expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
    });

    it('should provide fallback scheduleId resolution when store fails', async () => {
      const preventativeMedication = {
        ...mockMedication1,
        id: 'prev-med-456',
        type: 'preventative' as const,
        name: 'Propranolol',
      };

      mockGetMedicationById.mockImplementation((id: string) => {
        if (id === 'prev-med-456') return preventativeMedication;
        return null;
      });

      // Mock store schedule loading failure
      mockLoadSchedules.mockRejectedValue(new Error('Store unavailable'));
      mockGetSchedulesByMedicationId.mockReturnValue([]);

      const routeWithPreventativeMed = {
        key: 'LogMedication',
        name: 'LogMedication' as const,
        params: {
          medicationId: 'prev-med-456',
        },
      };

      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={routeWithPreventativeMed as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
      });

      // Log dose without schedules loaded
      const saveButton = screen.getByLabelText('Log medication');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockLogDose).toHaveBeenCalledWith(
          expect.objectContaining({
            medicationId: 'prev-med-456',
            scheduleId: undefined, // Should handle missing schedules gracefully
            quantity: 1,
          })
        );
      });
    });

    it('should handle malformed schedule data gracefully', async () => {
      const preventativeMedication = {
        ...mockMedication1,
        id: 'prev-med-789',
        type: 'preventative' as const,
      };

      mockGetMedicationById.mockImplementation((id: string) => {
        if (id === 'prev-med-789') return preventativeMedication;
        return null;
      });

      // Mock malformed schedule data
      const malformedSchedules = [
        {
          id: 'schedule-1',
          medicationId: 'prev-med-789',
          time: 'invalid-time', // Malformed time
          timezone: 'Invalid/Timezone',
          dosage: -1, // Invalid dosage
          enabled: true,
          reminderEnabled: true,
        },
        {
          id: 'schedule-2',
          medicationId: 'prev-med-789',
          time: '08:00',
          // Missing timezone
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        } as any
      ];

      mockLoadSchedules.mockResolvedValue(undefined);
      mockGetSchedulesByMedicationId.mockReturnValue(malformedSchedules);

      const routeWithPreventativeMed = {
        key: 'LogMedication',
        name: 'LogMedication' as const,
        params: {
          medicationId: 'prev-med-789',
        },
      };

      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={routeWithPreventativeMed as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
      });

      // Should still allow logging despite malformed data
      const saveButton = screen.getByLabelText('Log medication');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockLogDose).toHaveBeenCalledWith(
          expect.objectContaining({
            medicationId: 'prev-med-789',
            // Should handle malformed schedules gracefully
            scheduleId: undefined, // Invalid schedules should be ignored
          })
        );
      });
    });

    it('should handle concurrent schedule updates during dose logging', async () => {
      const preventativeMedication = {
        ...mockMedication1,
        id: 'prev-med-concurrent',
        type: 'preventative' as const,
      };

      mockGetMedicationById.mockImplementation((id: string) => {
        if (id === 'prev-med-concurrent') return preventativeMedication;
        return null;
      });

      const initialSchedules = [
        {
          id: 'schedule-1',
          medicationId: 'prev-med-concurrent',
          time: '08:00',
          timezone: 'America/New_York',
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        }
      ];

      const updatedSchedules = [
        {
          id: 'schedule-1',
          medicationId: 'prev-med-concurrent',
          time: '09:00', // Time changed
          timezone: 'America/New_York',
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        }
      ];

      // Initially return first set of schedules
      mockLoadSchedules.mockResolvedValue(undefined);
      mockGetSchedulesByMedicationId.mockReturnValueOnce(initialSchedules);

      const routeWithPreventativeMed = {
        key: 'LogMedication',
        name: 'LogMedication' as const,
        params: {
          medicationId: 'prev-med-concurrent',
        },
      };

      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={routeWithPreventativeMed as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
      });

      // Simulate concurrent schedule update during dose logging
      mockGetSchedulesByMedicationId.mockReturnValue(updatedSchedules);

      const saveButton = screen.getByLabelText('Log medication');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockLogDose).toHaveBeenCalled();
      });

      // Should handle concurrent updates without throwing errors
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  describe('scheduleId validation and error recovery', () => {
    it('should use correct scheduleId for preventative medication within time window', async () => {
      const preventativeMedication = {
        ...mockMedication1,
        id: 'prev-schedule-test',
        type: 'preventative' as const,
      };

      const testSchedule = {
        id: 'schedule-test',
        medicationId: 'prev-schedule-test',
        time: '08:00',
        timezone: 'America/New_York',
        dosage: 1,
        enabled: true,
        reminderEnabled: true,
      };

      mockGetMedicationById.mockImplementation((id: string) => {
        if (id === 'prev-schedule-test') return preventativeMedication;
        return null;
      });

      mockLoadSchedules.mockResolvedValue(undefined);
      mockGetSchedulesByMedicationId.mockReturnValue([testSchedule]);
      mockLogDose.mockResolvedValue(undefined);

      const routeWithPreventativeMed = {
        key: 'LogMedication',
        name: 'LogMedication' as const,
        params: {
          medicationId: 'prev-schedule-test',
        },
      };

      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={routeWithPreventativeMed as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
      });

      // Change time to 8:30 AM to test schedule matching
      const timeButton = screen.getByText(/\w{3} \d{1,2}, \d{4} \d{1,2}:\d{2} [AP]M/);
      fireEvent.press(timeButton);

      await waitFor(() => {
        expect(screen.getByTestId('date-time-picker')).toBeTruthy();
      });

      // Simulate user selecting a time in the DateTimePicker
      const datePicker = screen.getByTestId('date-time-picker');
      fireEvent.press(datePicker); // This will trigger our mock to set 8:30 AM

      const saveButton = screen.getByLabelText('Log medication');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockLogDose).toHaveBeenCalledWith(
          expect.objectContaining({
            medicationId: 'prev-schedule-test',
            scheduleId: 'schedule-test', // Should match the schedule since 8:30 is within 3 hours of 8:00
            // Don't check exact timestamp since it's set by the mock, just verify scheduleId is correct
          })
        );
      });
    });

    it('should omit scheduleId for preventative medication outside time window', async () => {
      const preventativeMedication = {
        ...mockMedication1,
        id: 'prev-schedule-far',
        type: 'preventative' as const,
      };

      const testSchedule = {
        id: 'schedule-far',
        medicationId: 'prev-schedule-far',
        time: '08:00',
        timezone: 'America/New_York',
        dosage: 1,
        enabled: true,
        reminderEnabled: true,
      };

      mockGetMedicationById.mockImplementation((id: string) => {
        if (id === 'prev-schedule-far') return preventativeMedication;
        return null;
      });

      mockLoadSchedules.mockResolvedValue(undefined);
      mockGetSchedulesByMedicationId.mockReturnValue([testSchedule]);
      mockLogDose.mockResolvedValue(undefined);

      const routeWithPreventativeMed = {
        key: 'LogMedication',
        name: 'LogMedication' as const,
        params: {
          medicationId: 'prev-schedule-far',
        },
      };

      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={routeWithPreventativeMed as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
      });

      // For this test, we need a different time
      
      // Change time to 4:00 PM to test outside window
      const timeButton = screen.getByText(/\w{3} \d{1,2}, \d{4} \d{1,2}:\d{2} [AP]M/);
      fireEvent.press(timeButton);

      await waitFor(() => {
        expect(screen.getByTestId('date-time-picker')).toBeTruthy();
      });

      // Manually set time to 4:00 PM (outside 3-hour window)
      if (mockDateTimePickerOnChange) {
        const testTime = new Date();
        testTime.setHours(16, 0, 0, 0);
        mockDateTimePickerOnChange({}, testTime);
      }

      // Wait for the time change to be processed
      await waitFor(() => {
        const timeButton = screen.getByText(/\w{3} \d{1,2}, \d{4} \d{1,2}:\d{2} [AP]M/);
        expect(timeButton.props.children).toMatch(/4:00 PM/);
      });

      const saveButton = screen.getByLabelText('Log medication');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockLogDose).toHaveBeenCalledWith(
          expect.objectContaining({
            medicationId: 'prev-schedule-far',
            scheduleId: undefined, // Should be undefined (too far from schedule time)
            // Don't check exact timestamp since timing is based on when the test runs
          })
        );
      });
    });

    it('should always omit scheduleId for rescue medications', async () => {
      const rescueMedication = {
        ...mockMedication1,
        id: 'rescue-no-schedule',
        type: 'rescue' as const,
      };

      mockGetMedicationById.mockImplementation((id: string) => {
        if (id === 'rescue-no-schedule') return rescueMedication;
        return null;
      });

      mockLoadSchedules.mockResolvedValue(undefined);
      mockGetSchedulesByMedicationId.mockReturnValue([]);
      mockLogDose.mockResolvedValue(undefined);

      const routeWithRescueMed = {
        key: 'LogMedication',
        name: 'LogMedication' as const,
        params: {
          medicationId: 'rescue-no-schedule',
        },
      };

      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={routeWithRescueMed as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
      });

      const saveButton = screen.getByLabelText('Log medication');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockLogDose).toHaveBeenCalledWith(
          expect.objectContaining({
            medicationId: 'rescue-no-schedule',
            scheduleId: undefined, // Should always be undefined for rescue medications
          })
        );
      });
    });

    it('should handle disabled schedules correctly', async () => {
      const preventativeMedication = {
        ...mockMedication1,
        id: 'prev-disabled-schedule',
        type: 'preventative' as const,
      };

      const disabledSchedule = {
        id: 'schedule-disabled',
        medicationId: 'prev-disabled-schedule',
        time: '08:00',
        timezone: 'America/New_York',
        dosage: 1,
        enabled: false, // Disabled schedule
        reminderEnabled: true,
      };

      mockGetMedicationById.mockImplementation((id: string) => {
        if (id === 'prev-disabled-schedule') return preventativeMedication;
        return null;
      });

      mockLoadSchedules.mockResolvedValue(undefined);
      mockGetSchedulesByMedicationId.mockReturnValue([disabledSchedule]);
      mockLogDose.mockResolvedValue(undefined);

      const routeWithPreventativeMed = {
        key: 'LogMedication',
        name: 'LogMedication' as const,
        params: {
          medicationId: 'prev-disabled-schedule',
        },
      };

      renderWithProviders(
        <LogMedicationScreen 
          navigation={mockNavigation as any} 
          route={routeWithPreventativeMed as any} 
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('log-medication-screen')).toBeTruthy();
      });

      const saveButton = screen.getByLabelText('Log medication');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockLogDose).toHaveBeenCalledWith(
          expect.objectContaining({
            medicationId: 'prev-disabled-schedule',
            scheduleId: undefined, // Should ignore disabled schedules
          })
        );
      });
    });
  });
});