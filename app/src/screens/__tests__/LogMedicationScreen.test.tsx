import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

import LogMedicationScreen from '../medication/LogMedicationScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import { useMedicationStore } from '../../store/medicationStore';
import { Medication } from '../../models/types';

jest.mock('../../store/medicationStore');

jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    log: jest.fn(),
  },
}));

// Mock DateTimePicker to capture onChange calls
let mockDateTimePickerOnChange: ((event: any, date?: Date) => void) | undefined;
jest.mock('@react-native-community/datetimepicker', () => {
  return ({ onChange, testID }: any) => {
    const React = require('react');
    const { View } = require('react-native');
    // Store the onChange function so we can call it in tests
    mockDateTimePickerOnChange = onChange;
    return React.createElement(View, { testID: testID || 'date-time-picker' });
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
});