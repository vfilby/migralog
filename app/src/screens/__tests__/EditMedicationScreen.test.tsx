import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react-native';

import EditMedicationScreen from '../medication/EditMedicationScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import { useMedicationStore } from '../../store/medicationStore';
import { medicationRepository } from '../../database/medicationRepository';

jest.mock('../../store/medicationStore');
jest.mock('../../database/medicationRepository', () => ({
  medicationRepository: {
    getById: jest.fn(),
  },
  medicationScheduleRepository: {
    getByMedicationId: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'schedule-123' }),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../services/notifications/notificationService', () => ({
  notificationService: {
    scheduleNotification: jest.fn(),
    cancelScheduledNotification: jest.fn(),
  },
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));
jest.mock('../../components/shared/MedicationScheduleManager', () => {
  const { View, Text } = require('react-native');
  return function MedicationScheduleManager() {
    return <View testID="medication-schedule-manager"><Text>Schedule Manager</Text></View>;
  };
});
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

describe('EditMedicationScreen', () => {
  const mockUpdateMedication = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useMedicationStore as unknown as jest.Mock).mockReturnValue({
      updateMedication: mockUpdateMedication,
    });

    (medicationRepository.getById as jest.Mock).mockResolvedValue({
      id: 'med-123',
      name: 'Test Med',
      type: 'preventative',
      dosageAmount: 100,
      dosageUnit: 'mg',
      defaultQuantity: 1,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    mockUpdateMedication.mockResolvedValue(undefined);
  });

  it('should render edit medication screen with title', async () => {
    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Edit Medication')).toBeTruthy();
    });
  });

  it('should display Cancel button', async () => {
    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeTruthy();
    });
  });

  it('should load and display medication data', async () => {
    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(medicationRepository.getById).toHaveBeenCalledWith('med-123');
    });
  });

  it('should display medication type buttons', async () => {
    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Preventative')).toBeTruthy();
      expect(screen.getByText('Rescue')).toBeTruthy();
    });
  });

  it('should display Save Changes button', async () => {
    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });
  });

  it('should display dosage unit options', async () => {
    const mockRoute = {
      params: { medicationId: 'med-123' },
    };

    renderWithProviders(
      <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('mg')).toBeTruthy();
      expect(screen.getByText('ml')).toBeTruthy();
      expect(screen.getByText('tablets')).toBeTruthy();
    });
  });

  describe('Form Interactions', () => {
    it('should allow changing medication name', async () => {
      const mockRoute = { params: { medicationId: 'med-123' } };
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Med')).toBeTruthy();
      });

      const nameInput = screen.getByDisplayValue('Test Med');
      fireEvent.changeText(nameInput, 'Updated Medication');

      expect(screen.getByDisplayValue('Updated Medication')).toBeTruthy();
    });

    it('should allow changing medication type', async () => {
      const mockRoute = { params: { medicationId: 'med-123' } };
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Rescue')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Rescue'));
      expect(screen.getByText('Rescue')).toBeTruthy();
    });

    it('should allow changing dosage amount', async () => {
      const mockRoute = { params: { medicationId: 'med-123' } };
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('100')).toBeTruthy();
      });

      const dosageInput = screen.getByDisplayValue('100');
      fireEvent.changeText(dosageInput, '200');

      expect(screen.getByDisplayValue('200')).toBeTruthy();
    });

    it('should allow changing dosage unit', async () => {
      const mockRoute = { params: { medicationId: 'med-123' } };
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('ml')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('ml'));
      expect(screen.getByText('ml')).toBeTruthy();
    });

    it('should go back when Cancel is pressed', async () => {
      const mockRoute = { params: { medicationId: 'med-123' } };
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Cancel'));

      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  describe('Schedules', () => {
    it('should display schedule manager component when Scheduled is selected', async () => {
      const mockRoute = { params: { medicationId: 'med-123' } };
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      // Wait for the form to fully load by checking for a form element
      await waitFor(() => {
        expect(screen.getByText('Scheduled')).toBeTruthy();
      });

      // Click the Scheduled button to show the schedule manager
      fireEvent.press(screen.getByText('Scheduled'));

      // Now the schedule manager should be visible
      await waitFor(() => {
        expect(screen.getByTestId('medication-schedule-manager')).toBeTruthy();
      });
    });

    it('should clear schedules when switching from Scheduled to As Needed', async () => {
      const mockRoute = { params: { medicationId: 'med-123' } };
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Scheduled')).toBeTruthy();
      });

      // Switch to Scheduled mode first
      fireEvent.press(screen.getByText('Scheduled'));
      await waitFor(() => {
        expect(screen.getByTestId('medication-schedule-manager')).toBeTruthy();
      });

      // Switch back to As Needed
      fireEvent.press(screen.getByText('As Needed'));
      
      // Schedule manager should no longer be visible
      expect(screen.queryByTestId('medication-schedule-manager')).toBeNull();
    });

    it('should display schedule frequency buttons when in scheduled mode', async () => {
      const mockRoute = { params: { medicationId: 'med-123' } };
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Scheduled')).toBeTruthy();
      });
      
      await waitFor(() => {
        expect(screen.getByText('Edit Medication')).toBeTruthy();
      });

      // Switch to Scheduled mode
      fireEvent.press(screen.getByText('Scheduled'));

      await waitFor(() => {
        expect(screen.getByText('Daily')).toBeTruthy();
        expect(screen.getByText('Monthly')).toBeTruthy();
        expect(screen.getByText('Quarterly')).toBeTruthy();
      });
    });

    it('should allow changing schedule frequency to Monthly', async () => {
      const mockRoute = { params: { medicationId: 'med-123' } };
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Edit Medication')).toBeTruthy();
      });

      // Switch to Scheduled mode
      fireEvent.press(screen.getByText('Scheduled'));

      await waitFor(() => {
        expect(screen.getByText('Monthly')).toBeTruthy();
      });

      // Click Monthly frequency
      fireEvent.press(screen.getByText('Monthly'));
      expect(screen.getByText('Monthly')).toBeTruthy();
    });

    it('should allow changing schedule frequency to Quarterly', async () => {
      const mockRoute = { params: { medicationId: 'med-123' } };
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Edit Medication')).toBeTruthy();
      });

      // Switch to Scheduled mode
      fireEvent.press(screen.getByText('Scheduled'));

      await waitFor(() => {
        expect(screen.getByText('Quarterly')).toBeTruthy();
      });

      // Click Quarterly frequency
      fireEvent.press(screen.getByText('Quarterly'));
      expect(screen.getByText('Quarterly')).toBeTruthy();
    });
  });

  describe('Medication Type - Other', () => {
    it('should allow selecting "Other" medication type', async () => {
      const mockRoute = { params: { medicationId: 'med-123' } };
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Other')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Other'));
      expect(screen.getByText('Other')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should show error and go back when medication fails to load', async () => {
      const mockAlert = jest.spyOn(require('react-native').Alert, 'alert');
      (medicationRepository.getById as jest.Mock).mockRejectedValueOnce(new Error('Load failed'));

      const mockRoute = { params: { medicationId: 'med-123' } };
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Error', 'Failed to load medication');
        expect(mockNavigation.goBack).toHaveBeenCalled();
      });

      mockAlert.mockRestore();
    });
  });

  describe('Image Picker', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should show image options when pressing add photo button', async () => {
      const mockAlert = jest.spyOn(require('react-native').Alert, 'alert');
      const mockRoute = { params: { medicationId: 'med-123' } };
      
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('+ Add Photo')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('+ Add Photo'));

      expect(mockAlert).toHaveBeenCalledWith(
        'Update Photo',
        'Choose a photo of your medication',
        expect.any(Array)
      );

      mockAlert.mockRestore();
    });

    it('should show change photo button when photo exists', async () => {
      (medicationRepository.getById as jest.Mock).mockResolvedValue({
        id: 'med-123',
        name: 'Test Med',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        photoUri: 'file://photo.jpg',
      });

      const mockRoute = { params: { medicationId: 'med-123' } };
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Change Photo')).toBeTruthy();
      });
    });

    it('should show image options when pressing change photo button', async () => {
      const mockAlert = jest.spyOn(require('react-native').Alert, 'alert');
      (medicationRepository.getById as jest.Mock).mockResolvedValue({
        id: 'med-123',
        name: 'Test Med',
        type: 'preventative',
        dosageAmount: 100,
        dosageUnit: 'mg',
        defaultQuantity: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        photoUri: 'file://photo.jpg',
      });

      const mockRoute = { params: { medicationId: 'med-123' } };
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Change Photo')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Change Photo'));

      expect(mockAlert).toHaveBeenCalledWith(
        'Update Photo',
        'Choose a photo of your medication',
        expect.any(Array)
      );

      mockAlert.mockRestore();
    });
  });

  describe('Save Functionality', () => {
    it('should show error when medication name is empty', async () => {
      const mockAlert = jest.spyOn(require('react-native').Alert, 'alert');
      const mockRoute = { params: { medicationId: 'med-123' } };
      
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Med')).toBeTruthy();
      });

      // Clear the name
      const nameInput = screen.getByDisplayValue('Test Med');
      fireEvent.changeText(nameInput, '   ');

      // Try to save
      fireEvent.press(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Error', 'Please enter a medication name');
      });

      mockAlert.mockRestore();
    });

    it('should show error when dosage amount is invalid', async () => {
      const mockAlert = jest.spyOn(require('react-native').Alert, 'alert');
      const mockRoute = { params: { medicationId: 'med-123' } };
      
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('100')).toBeTruthy();
      });

      // Set invalid dosage
      const dosageInput = screen.getByDisplayValue('100');
      fireEvent.changeText(dosageInput, 'abc');

      // Try to save
      fireEvent.press(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Error', 'Please enter a valid dosage amount');
      });

      mockAlert.mockRestore();
    });

    it('should successfully save medication with valid data', async () => {
      const mockRoute = { params: { medicationId: 'med-123' } };
      
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Med')).toBeTruthy();
      });

      // Update the name
      const nameInput = screen.getByDisplayValue('Test Med');
      fireEvent.changeText(nameInput, 'Updated Med');

      // Save
      fireEvent.press(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(mockUpdateMedication).toHaveBeenCalledWith('med-123', expect.objectContaining({
          name: 'Updated Med',
          type: 'preventative',
          dosageAmount: 100,
          dosageUnit: 'mg',
        }));
        expect(mockNavigation.goBack).toHaveBeenCalled();
      });
    });

    it('should show error when save fails', async () => {
      const mockAlert = jest.spyOn(require('react-native').Alert, 'alert');
      mockUpdateMedication.mockRejectedValueOnce(new Error('Save failed'));

      const mockRoute = { params: { medicationId: 'med-123' } };
      
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Med')).toBeTruthy();
      });

      // Try to save
      fireEvent.press(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Error', 'Failed to update medication');
      });

      mockAlert.mockRestore();
    });

    it('should display "Saving..." text while saving', async () => {
      // Make the update slow to catch the saving state
      mockUpdateMedication.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      const mockRoute = { params: { medicationId: 'med-123' } };
      
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeTruthy();
      });

      // Click save
      fireEvent.press(screen.getByText('Save Changes'));

      // Should show "Saving..."
      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeTruthy();
      });
    });
  });

  describe('Notes Field', () => {
    it('should allow editing notes field', async () => {
      const mockRoute = { params: { medicationId: 'med-123' } };
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Any additional information...')).toBeTruthy();
      });

      const notesInput = screen.getByPlaceholderText('Any additional information...');
      fireEvent.changeText(notesInput, 'Take with food');

      expect(screen.getByDisplayValue('Take with food')).toBeTruthy();
    });
  });

  describe('Default Quantity Field', () => {
    it('should allow editing default quantity field', async () => {
      const mockRoute = { params: { medicationId: 'med-123' } };
      renderWithProviders(
        <EditMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('1')).toBeTruthy();
      });

      const quantityInput = screen.getByDisplayValue('1');
      fireEvent.changeText(quantityInput, '2');

      expect(screen.getByDisplayValue('2')).toBeTruthy();
    });
  });
});
