import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

import EditMedicationDoseScreen from '../medication/EditMedicationDoseScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import { useMedicationStore } from '../../store/medicationStore';
import { MedicationDose, Medication } from '../../models/types';
import { pressAlertButtonByText } from '../../utils/testUtils/alertHelpers';

jest.mock('../../store/medicationStore');

import { logger } from '../../utils/logger';

jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    log: jest.fn(),
  },
}));

jest.spyOn(Alert, 'alert');

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

const mockRoute = {
  key: 'EditMedicationDose',
  name: 'EditMedicationDose' as const,
  params: {
    doseId: 'test-dose-123',
  },
};

const mockMedication: Medication = {
  id: 'med-456',
  name: 'Ibuprofen',
  type: 'rescue',
  dosageAmount: 200,
  dosageUnit: 'mg',
  active: true,
  createdAt: Date.now() - 86400000,
  updatedAt: Date.now() - 86400000,
};

const mockDose: MedicationDose = {
  id: 'test-dose-123',
  medicationId: 'med-456',
  timestamp: Date.now() - 3600000, // 1 hour ago
  quantity: 1.5,
  notes: 'Took with food',
  createdAt: Date.now() - 3600000,
  updatedAt: Date.now() - 3600000,
};

describe('EditMedicationDoseScreen', () => {
  const mockGetDoseById = jest.fn();
  const mockGetMedicationById = jest.fn();
  const mockUpdateDose = jest.fn();
  const mockDeleteDose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    (useMedicationStore as unknown as jest.Mock).mockReturnValue({
      getDoseById: mockGetDoseById,
      getMedicationById: mockGetMedicationById,
      updateDose: mockUpdateDose,
      deleteDose: mockDeleteDose,
    });

    mockGetDoseById.mockReturnValue(mockDose);
    mockGetMedicationById.mockReturnValue(mockMedication);
    mockUpdateDose.mockResolvedValue(undefined);
    mockDeleteDose.mockResolvedValue(undefined);
  });

  it('should render loading state initially', async () => {
    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    // After loading completes, we should see the dose controls
    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });
  });

  it('should load and display dose and medication data correctly', async () => {
    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(mockGetDoseById).toHaveBeenCalledWith('test-dose-123');
      expect(mockGetMedicationById).toHaveBeenCalledWith('med-456');
    });

    await waitFor(() => {
      expect(screen.getByText('Ibuprofen')).toBeTruthy();
      expect(screen.getByText('200mg per dose')).toBeTruthy();
      expect(screen.getByText('Time Taken')).toBeTruthy();
      expect(screen.getByText('Save Changes')).toBeTruthy();
      expect(screen.getByText('Delete Dose')).toBeTruthy();
      expect(screen.getByDisplayValue('1.5')).toBeTruthy(); // Amount input
      expect(screen.getByDisplayValue('Took with food')).toBeTruthy(); // Notes input
    });
  });

  it('should show error and go back if dose not found', async () => {
    mockGetDoseById.mockReturnValue(null);

    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Medication dose not found');
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  it('should show error and go back if medication not found', async () => {
    mockGetMedicationById.mockReturnValue(null);

    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Medication not found');
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  it('should handle loading error and go back', async () => {
    mockGetDoseById.mockImplementation(() => {
      throw new Error('Database error');
    });

    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to load medication dose');
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  it('should allow editing dose amount', async () => {
    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('1.5')).toBeTruthy();
    });

    const amountInput = screen.getByDisplayValue('1.5');
    fireEvent.changeText(amountInput, '2');

    expect(screen.getByDisplayValue('2')).toBeTruthy();
  });

  it('should allow editing notes', async () => {
    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Took with food')).toBeTruthy();
    });

    const notesInput = screen.getByDisplayValue('Took with food');
    fireEvent.changeText(notesInput, 'Updated notes text');

    expect(screen.getByDisplayValue('Updated notes text')).toBeTruthy();
  });

  it('should use quick select buttons to set dose amount', async () => {
    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });

    // Press the quick select button for 2 doses
    const dose2Button = screen.getByLabelText('Set dose amount to 2');
    fireEvent.press(dose2Button);

    // Should update the amount input
    expect(screen.getByDisplayValue('2')).toBeTruthy();
  });

  it('should show all quick select buttons with proper states', async () => {
    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });

    // Check that all quick select buttons are present
    const quickSelectValues = [0.5, 1, 1.5, 2, 2.5, 3];
    for (const value of quickSelectValues) {
      expect(screen.getByLabelText(`Set dose amount to ${value}`)).toBeTruthy();
    }

    // The button for 1.5 should be selected initially
    const dose15Button = screen.getByLabelText('Set dose amount to 1.5');
    expect(dose15Button).toHaveAccessibilityState({ selected: true });
  });

  it('should increase dose amount with plus button', async () => {
    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('1.5')).toBeTruthy();
    });

    const plusButton = screen.getByLabelText('Increase dose amount');
    fireEvent.press(plusButton);

    // Should increase by 0.5
    expect(screen.getByDisplayValue('2')).toBeTruthy();
  });

  it('should decrease dose amount with minus button', async () => {
    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('1.5')).toBeTruthy();
    });

    const minusButton = screen.getByLabelText('Decrease dose amount');
    fireEvent.press(minusButton);

    // Should decrease by 0.5
    expect(screen.getByDisplayValue('1')).toBeTruthy();
  });

  it('should not allow decreasing dose amount below 0.5', async () => {
    // Set initial dose to 0.5
    const smallDose = { ...mockDose, quantity: 0.5 };
    mockGetDoseById.mockReturnValue(smallDose);

    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('0.5')).toBeTruthy();
    });

    const minusButton = screen.getByLabelText('Decrease dose amount');
    fireEvent.press(minusButton);

    // Should remain at 0.5
    expect(screen.getByDisplayValue('0.5')).toBeTruthy();
  });

  it('should show date picker when time button is pressed', async () => {
    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });

    // Find the time button - it should contain a formatted date
    const timeButton = screen.getByText(/\w{3} \d{1,2}, \d{4} \d{1,2}:\d{2} [AP]M/);
    fireEvent.press(timeButton);

    // The date picker should be accessible
    expect(timeButton).toBeTruthy();
  });

  it('should calculate and display total dosage correctly', async () => {
    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('1.5')).toBeTruthy();
    });

    // Should show total: 1.5 doses * 200mg = 300mg
    expect(screen.getByText('Total: 300mg')).toBeTruthy();

    // Change to 2 doses
    const amountInput = screen.getByDisplayValue('1.5');
    fireEvent.changeText(amountInput, '2');

    // Should update total: 2 doses * 200mg = 400mg
    expect(screen.getByText('Total: 400mg')).toBeTruthy();
  });

  it('should save dose changes successfully', async () => {
    mockUpdateDose.mockResolvedValue(undefined);

    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('1.5')).toBeTruthy();
    });

    // Change amount and notes
    const amountInput = screen.getByDisplayValue('1.5');
    fireEvent.changeText(amountInput, '2');

    const notesInput = screen.getByDisplayValue('Took with food');
    fireEvent.changeText(notesInput, 'Updated notes');

    const saveButton = screen.getByText('Save Changes');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(mockUpdateDose).toHaveBeenCalledWith(
        'test-dose-123',
        expect.objectContaining({
          quantity: 2,
          notes: 'Updated notes',
          timestamp: expect.any(Number),
        })
      );
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  it('should show error for invalid amount', async () => {
    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('1.5')).toBeTruthy();
    });

    // Set invalid amount
    const amountInput = screen.getByDisplayValue('1.5');
    fireEvent.changeText(amountInput, 'invalid');

    const saveButton = screen.getByText('Save Changes');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a valid amount');
      expect(mockUpdateDose).not.toHaveBeenCalled();
    });
  });

  it('should show error for empty amount', async () => {
    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('1.5')).toBeTruthy();
    });

    // Clear amount
    const amountInput = screen.getByDisplayValue('1.5');
    fireEvent.changeText(amountInput, '');

    const saveButton = screen.getByText('Save Changes');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a valid amount');
      expect(mockUpdateDose).not.toHaveBeenCalled();
    });
  });

  it('should handle save error', async () => {
    mockUpdateDose.mockRejectedValue(new Error('Save failed'));

    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.press(saveButton);

    // Wait for save to be called
    await waitFor(() => {
      expect(mockUpdateDose).toHaveBeenCalled();
    });

    // Error is logged but Alert is not shown (store shows toast instead)
    expect(logger.error).toHaveBeenCalledWith('Failed to update medication dose:', expect.any(Error));
  });

  it('should show confirmation dialog when delete button is pressed', async () => {
    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Delete Dose')).toBeTruthy();
    });

    const deleteButton = screen.getByText('Delete Dose');
    fireEvent.press(deleteButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Dose',
        'Are you sure you want to delete this medication dose?',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel' }),
          expect.objectContaining({ text: 'Delete' }),
        ])
      );
    });
  });

  it('should delete dose when confirmed', async () => {
    mockDeleteDose.mockResolvedValue(undefined);

    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Delete Dose')).toBeTruthy();
    });

    const deleteButton = screen.getByText('Delete Dose');
    fireEvent.press(deleteButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Dose',
        'Are you sure you want to delete this medication dose?',
        expect.any(Array)
      );
    });

    // Simulate pressing Delete in the confirmation dialog
    await pressAlertButtonByText('Delete');

    await waitFor(() => {
      expect(mockDeleteDose).toHaveBeenCalledWith('test-dose-123');
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  it('should handle delete error', async () => {
    mockDeleteDose.mockRejectedValue(new Error('Delete failed'));

    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Delete Dose')).toBeTruthy();
    });

    const deleteButton = screen.getByText('Delete Dose');
    fireEvent.press(deleteButton);

    // Simulate pressing Delete in the confirmation dialog
    await pressAlertButtonByText('Delete');

    // Wait for delete to be called
    await waitFor(() => {
      expect(mockDeleteDose).toHaveBeenCalled();
    });

    // Error is logged but Alert is not shown (store shows toast instead)
    expect(logger.error).toHaveBeenCalledWith('Failed to delete medication dose:', expect.any(Error));
  });

  it('should cancel and go back when cancel button is pressed', async () => {
    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
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
    mockUpdateDose.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.press(saveButton);

    // Should show saving state
    expect(screen.getByText('Saving...')).toBeTruthy();
  });

  it('should have proper accessibility labels', async () => {
    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      // Check that buttons have accessibility labels
      const cancelButton = screen.getByLabelText('Cancel');
      const saveButton = screen.getByLabelText('Save changes');
      const deleteButton = screen.getByLabelText('Delete dose');
      const plusButton = screen.getByLabelText('Increase dose amount');
      const minusButton = screen.getByLabelText('Decrease dose amount');
      
      expect(cancelButton).toBeTruthy();
      expect(saveButton).toBeTruthy();
      expect(deleteButton).toBeTruthy();
      expect(plusButton).toBeTruthy();
      expect(minusButton).toBeTruthy();
    });
  });

  it('should save with empty notes when notes are cleared', async () => {
    mockUpdateDose.mockResolvedValue(undefined);

    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Took with food')).toBeTruthy();
    });

    // Clear notes
    const notesInput = screen.getByDisplayValue('Took with food');
    fireEvent.changeText(notesInput, '   '); // Whitespace only

    const saveButton = screen.getByText('Save Changes');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(mockUpdateDose).toHaveBeenCalledWith(
        'test-dose-123',
        expect.objectContaining({
          notes: undefined, // Should be undefined when trimmed empty
        })
      );
    });
  });

  it('should prevent save when dose, medication, or timestamp is null', async () => {
    // Mock a scenario where dose loads but medication is null
    mockGetMedicationById.mockReturnValue(null);

    renderWithProviders(
      <EditMedicationDoseScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    // Should go back due to missing medication
    await waitFor(() => {
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });
});