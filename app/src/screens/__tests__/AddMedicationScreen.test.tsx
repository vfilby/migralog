import React from 'react';
import { Alert } from 'react-native';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import AddMedicationScreen from '../AddMedicationScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import { useMedicationStore } from '../../store/medicationStore';
import { medicationScheduleRepository } from '../../database/medicationRepository';
import { notificationService } from '../../services/notificationService';
import { pressAlertButtonByText } from '../../utils/testUtils/alertHelpers';
import { createMockNavigation } from '../../utils/testUtils/fixtures';
import { errorLogger } from '../../services/errorLogger';

jest.mock('../../store/medicationStore');
jest.mock('../../database/medicationRepository', () => ({
  medicationScheduleRepository: {
    create: jest.fn().mockResolvedValue({ id: 'schedule-123' }),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../services/errorLogger', () => ({
  errorLogger: {
    log: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../services/notificationService', () => ({
  notificationService: {
    scheduleNotification: jest.fn(),
    cancelScheduledNotification: jest.fn(),
    getPermissions: jest.fn().mockResolvedValue({ granted: true }),
    rescheduleAllMedicationNotifications: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));
jest.mock('../../components/MedicationScheduleManager', () => {
  const { View, Text } = require('react-native');
  return function MedicationScheduleManager({ onSchedulesChange }: any) {
    return (
      <View testID="medication-schedule-manager">
        <Text>Schedule Manager</Text>
        <Text testID="schedules-change-callback" onPress={() => onSchedulesChange([{
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true
        }])}>Update Schedules</Text>
      </View>
    );
  };
});

// Mock Alert
jest.spyOn(Alert, 'alert');

const mockNavigation = createMockNavigation();

describe('AddMedicationScreen', () => {
  const mockAddMedication = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useMedicationStore as unknown as jest.Mock).mockReturnValue({
      addMedication: mockAddMedication,
    });

    mockAddMedication.mockResolvedValue({ id: 'new-med-123' });
  });

  it('should render add medication screen with title', async () => {
    const mockRoute = { params: {} };

    renderWithProviders(
      <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Add Medication')).toBeTruthy();
    });
  });

  it('should display Cancel button', async () => {
    const mockRoute = { params: {} };

    renderWithProviders(
      <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeTruthy();
    });
  });

  it('should display medication type buttons', async () => {
    const mockRoute = { params: {} };

    renderWithProviders(
      <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Preventative')).toBeTruthy();
      expect(screen.getByText('Rescue')).toBeTruthy();
    });
  });

  it('should display medication name input', async () => {
    const mockRoute = { params: {} };

    renderWithProviders(
      <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('medication-name-input')).toBeTruthy();
    });
  });

  it('should display dosage inputs', async () => {
    const mockRoute = { params: {} };

    renderWithProviders(
      <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('200')).toBeTruthy();
    });
  });

  it('should display notes input', async () => {
    const mockRoute = { params: {} };

    renderWithProviders(
      <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Any additional information...')).toBeTruthy();
    });
  });

  it('should display Save button', async () => {
    const mockRoute = { params: {} };

    renderWithProviders(
      <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Medication')).toBeTruthy();
    });
  });

  it('should display dosage unit options', async () => {
    const mockRoute = { params: {} };

    renderWithProviders(
      <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText('mg')).toBeTruthy();
      expect(screen.getByText('ml')).toBeTruthy();
      expect(screen.getByText('tablets')).toBeTruthy();
    });
  });

  describe('User Interactions', () => {
    it('should handle medication type selection', async () => {
      const mockRoute = { params: {} };

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      // Test rescue button selection (default)
      await waitFor(() => {
        const rescueButton = screen.getByText('Rescue');
        expect(rescueButton).toBeTruthy();
      });

      // Test preventative button selection
      const preventativeButton = screen.getByText('Preventative');
      fireEvent.press(preventativeButton);

      // Test other button selection
      const otherButton = screen.getByText('Other');
      fireEvent.press(otherButton);
      
      expect(screen.getByText('Other')).toBeTruthy();
    });

    it('should handle medication name input', async () => {
      const mockRoute = { params: {} };

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        const nameInput = screen.getByTestId('medication-name-input');
        fireEvent.changeText(nameInput, 'Advil');
        expect(nameInput.props.value).toBe('Advil');
      });
    });

    it('should handle dosage amount input', async () => {
      const mockRoute = { params: {} };

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        const dosageInput = screen.getByPlaceholderText('200');
        fireEvent.changeText(dosageInput, '400');
        expect(dosageInput.props.value).toBe('400');
      });
    });

    it('should handle dosage unit selection', async () => {
      const mockRoute = { params: {} };

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        // Test selecting ml unit
        const mlButton = screen.getByText('ml');
        fireEvent.press(mlButton);

        // Test selecting tablets unit
        const tabletsButton = screen.getByText('tablets');
        fireEvent.press(tabletsButton);
        
        expect(screen.getByText('tablets')).toBeTruthy();
      });
    });

    it('should handle default quantity input', async () => {
      const mockRoute = { params: {} };

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        const quantityInput = screen.getByDisplayValue('1'); // Default value is '1'
        fireEvent.changeText(quantityInput, '3');
        expect(quantityInput.props.value).toBe('3');
      });
    });

    it('should handle notes input', async () => {
      const mockRoute = { params: {} };

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        const notesInput = screen.getByPlaceholderText('Any additional information...');
        fireEvent.changeText(notesInput, 'Take with food');
        expect(notesInput.props.value).toBe('Take with food');
      });
    });

    it('should handle scheduling mode changes', async () => {
      const mockRoute = { params: {} };

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        // Switch to scheduled mode
        const scheduledButton = screen.getByText('Scheduled');
        fireEvent.press(scheduledButton);
      });

      // Should show schedule frequency options
      await waitFor(() => {
        expect(screen.getByText('Daily')).toBeTruthy();
        expect(screen.getByText('Monthly')).toBeTruthy();
        expect(screen.getByText('Quarterly')).toBeTruthy();
      });

      // Switch back to as-needed
      const asNeededButton = screen.getByText('As Needed');
      fireEvent.press(asNeededButton);

      expect(screen.getByText('As Needed')).toBeTruthy();
    });

    it('should handle schedule frequency changes in scheduled mode', async () => {
      const mockRoute = { params: {} };

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        // Switch to scheduled mode first
        const scheduledButton = screen.getByText('Scheduled');
        fireEvent.press(scheduledButton);
        
        expect(screen.getByText('Daily')).toBeTruthy();

        // Test monthly frequency
        const monthlyButton = screen.getByText('Monthly');
        fireEvent.press(monthlyButton);

        // Test quarterly frequency
        const quarterlyButton = screen.getByText('Quarterly');
        fireEvent.press(quarterlyButton);

        expect(screen.getByText('Quarterly')).toBeTruthy();
      });
    });

    it('should show schedule manager in scheduled mode', async () => {
      const mockRoute = { params: {} };

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        // Switch to scheduled mode
        const scheduledButton = screen.getByText('Scheduled');
        fireEvent.press(scheduledButton);
      });

      // Should show the schedule manager
      await waitFor(() => {
        expect(screen.getByTestId('medication-schedule-manager')).toBeTruthy();
      });
    });

    it('should handle cancel button press', async () => {
      const mockRoute = { params: {} };

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        const cancelButton = screen.getByText('Cancel');
        fireEvent.press(cancelButton);
        expect(mockNavigation.goBack).toHaveBeenCalled();
      });
    });
  });

  describe('Image Handling', () => {
    it('should handle add photo button press', async () => {
      const mockRoute = { params: {} };

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        const addPhotoButton = screen.getByText('+ Add Photo');
        fireEvent.press(addPhotoButton);

        expect(Alert.alert).toHaveBeenCalledWith(
          'Add Photo',
          'Choose a photo of your medication',
          expect.arrayContaining([
            expect.objectContaining({ text: 'Take Photo' }),
            expect.objectContaining({ text: 'Choose from Library' }),
            expect.objectContaining({ text: 'Cancel', style: 'cancel' })
          ])
        );
      });
    });

    it('should handle permission denied for photo access', async () => {
      const mockRoute = { params: {} };
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({ 
        granted: false, 
        status: 'denied' 
      });

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        const addPhotoButton = screen.getByText('+ Add Photo');
        fireEvent.press(addPhotoButton);
      });

      // Simulate selecting "Choose from Library"
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const chooseFromLibraryHandler = alertCall[2][1].onPress;
      await chooseFromLibraryHandler();

      expect(Alert.alert).toHaveBeenCalledWith(
        'Permission Required', 
        'Please grant camera/photo library access'
      );
    });

    it('should handle successful image selection', async () => {
      const mockRoute = { params: {} };
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file://test-image.jpg' }]
      });

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        const addPhotoButton = screen.getByText('+ Add Photo');
        fireEvent.press(addPhotoButton);
      });

      // Simulate selecting "Choose from Library"
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });
      
      pressAlertButtonByText('Choose from Library');

      await waitFor(() => {
        expect(screen.getByText('Change Photo')).toBeTruthy();
      });
    });

    it('should handle camera photo taking', async () => {
      const mockRoute = { params: {} };
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file://camera-image.jpg' }]
      });

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(screen.getByText('+ Add Photo')).toBeTruthy();
      });

      const addPhotoButton = screen.getByText('+ Add Photo');
      fireEvent.press(addPhotoButton);

      // Simulate selecting "Take Photo"
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });
      
      pressAlertButtonByText('Take Photo');

      await waitFor(() => {
        expect(screen.getByText('Change Photo')).toBeTruthy();
      });
    });
  });

  describe('Form Validation', () => {
    it('should show error for empty medication name', async () => {
      const mockRoute = { params: {} };

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        // Try to save without entering a name
        const saveButton = screen.getByText('Save Medication');
        fireEvent.press(saveButton);

        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a medication name');
      });
    });

    it('should show error for invalid dosage amount', async () => {
      const mockRoute = { params: {} };

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        // Enter a name but leave dosage empty
        const nameInput = screen.getByTestId('medication-name-input');
        fireEvent.changeText(nameInput, 'Test Medication');

        const saveButton = screen.getByText('Save Medication');
        fireEvent.press(saveButton);

        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a valid dosage amount');
      });
    });

    it('should show error for non-numeric dosage', async () => {
      const mockRoute = { params: {} };

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        // Enter a name and invalid dosage
        const nameInput = screen.getByTestId('medication-name-input');
        fireEvent.changeText(nameInput, 'Test Medication');

        const dosageInput = screen.getByPlaceholderText('200');
        fireEvent.changeText(dosageInput, 'invalid');

        const saveButton = screen.getByText('Save Medication');
        fireEvent.press(saveButton);

        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a valid dosage amount');
      });
    });
  });

  describe('Medication Saving', () => {
    it('should save medication successfully with basic information', async () => {
      const mockRoute = { params: {} };

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        // Fill in required fields
        const nameInput = screen.getByTestId('medication-name-input');
        fireEvent.changeText(nameInput, 'Advil');

        const dosageInput = screen.getByPlaceholderText('200');
        fireEvent.changeText(dosageInput, '400');

        const saveButton = screen.getByText('Save Medication');
        fireEvent.press(saveButton);
      });

      await waitFor(() => {
        expect(mockAddMedication).toHaveBeenCalledWith({
          name: 'Advil',
          type: 'rescue',
          dosageAmount: 400,
          dosageUnit: 'mg',
          defaultQuantity: 1,
          scheduleFrequency: undefined,
          photoUri: undefined,
          active: true,
          notes: undefined,
          category: undefined,
        });
      });

      expect(mockNavigation.goBack).toHaveBeenCalled();
    });

    it('should save medication with all optional fields', async () => {
      const mockRoute = { params: {} };

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        // Fill in all fields
        const nameInput = screen.getByTestId('medication-name-input');
        fireEvent.changeText(nameInput, 'Sumatriptan');

        const dosageInput = screen.getByPlaceholderText('200');
        fireEvent.changeText(dosageInput, '50');

        const quantityInput = screen.getByDisplayValue('1'); // Default value
        fireEvent.changeText(quantityInput, '2');

        const notesInput = screen.getByPlaceholderText('Any additional information...');
        fireEvent.changeText(notesInput, 'Take at onset');

        // Select preventative type
        const preventativeButton = screen.getByText('Preventative');
        fireEvent.press(preventativeButton);

        // Select different unit
        const tabletsButton = screen.getByText('tablets');
        fireEvent.press(tabletsButton);

        const saveButton = screen.getByText('Save Medication');
        fireEvent.press(saveButton);
      });

      await waitFor(() => {
        expect(mockAddMedication).toHaveBeenCalledWith({
          name: 'Sumatriptan',
          type: 'preventative',
          dosageAmount: 50,
          dosageUnit: 'tablets',
          defaultQuantity: 2,
          scheduleFrequency: undefined,
          photoUri: undefined,
          active: true,
          notes: 'Take at onset',
          category: undefined,
        });
      });
    });

    it('should save medication with schedules in scheduled mode', async () => {
      const mockRoute = { params: {} };

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        // Fill required fields
        const nameInput = screen.getByTestId('medication-name-input');
        fireEvent.changeText(nameInput, 'Daily Med');

        const dosageInput = screen.getByPlaceholderText('200');
        fireEvent.changeText(dosageInput, '100');

        // Switch to scheduled mode
        const scheduledButton = screen.getByText('Scheduled');
        fireEvent.press(scheduledButton);
      });

      // Mock schedule creation
      await waitFor(() => {
        const scheduleCallback = screen.getByTestId('schedules-change-callback');
        fireEvent.press(scheduleCallback);

        const saveButton = screen.getByText('Save Medication');
        fireEvent.press(saveButton);
      });

      await waitFor(() => {
        expect(mockAddMedication).toHaveBeenCalled();
        expect(medicationScheduleRepository.create).toHaveBeenCalledWith({
          medicationId: 'new-med-123',
          time: '08:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
          reminderEnabled: true,
        });
      });

      expect(notificationService.rescheduleAllMedicationNotifications).toHaveBeenCalled();
    });

    it('should handle save errors gracefully', async () => {
      const mockRoute = { params: {} };
      const saveError = new Error('Database error');
      mockAddMedication.mockRejectedValueOnce(saveError);

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        // Fill required fields
        const nameInput = screen.getByTestId('medication-name-input');
        fireEvent.changeText(nameInput, 'Test Med');

        const dosageInput = screen.getByPlaceholderText('200');
        fireEvent.changeText(dosageInput, '100');

        const saveButton = screen.getByText('Save Medication');
        fireEvent.press(saveButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error', 
          'Failed to save medication: Database error'
        );
      });

      expect(errorLogger.log).toHaveBeenCalledWith(
        'general',
        'AddMedication: Save failed',
        saveError,
        { medicationName: 'Test Med' }
      );
    });

    it('should disable save button while saving', async () => {
      const mockRoute = { params: {} };
      
      // Make addMedication take time to resolve
      let resolveSave: (value: any) => void;
      const savePromise = new Promise((resolve) => {
        resolveSave = resolve;
      });
      mockAddMedication.mockReturnValueOnce(savePromise);

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        // Fill required fields
        const nameInput = screen.getByTestId('medication-name-input');
        fireEvent.changeText(nameInput, 'Test Med');

        const dosageInput = screen.getByPlaceholderText('200');
        fireEvent.changeText(dosageInput, '100');

        const saveButton = screen.getByText('Save Medication');
        fireEvent.press(saveButton);
      });

      // Button should show "Saving..." and be disabled
      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeTruthy();
      });

      // Resolve the save
      resolveSave!({ id: 'new-med-123' });

      await waitFor(() => {
        expect(screen.getByText('Save Medication')).toBeTruthy();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle notification permission errors gracefully', async () => {
      const mockRoute = { params: {} };
      (notificationService.rescheduleAllMedicationNotifications as jest.Mock).mockRejectedValueOnce(
        new Error('Notification error')
      );

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        // Fill required fields
        const nameInput = screen.getByTestId('medication-name-input');
        fireEvent.changeText(nameInput, 'Test Med');

        const dosageInput = screen.getByPlaceholderText('200');
        fireEvent.changeText(dosageInput, '100');

        const saveButton = screen.getByText('Save Medication');
        fireEvent.press(saveButton);
      });

      // Should still complete successfully despite notification error
      await waitFor(() => {
        expect(mockNavigation.goBack).toHaveBeenCalled();
      });
    });

    it('should handle empty schedule arrays properly', async () => {
      const mockRoute = { params: {} };

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        // Fill required fields
        const nameInput = screen.getByTestId('medication-name-input');
        fireEvent.changeText(nameInput, 'Test Med');

        const dosageInput = screen.getByPlaceholderText('200');
        fireEvent.changeText(dosageInput, '100');

        // Switch to scheduled mode but don't add schedules
        const scheduledButton = screen.getByText('Scheduled');
        fireEvent.press(scheduledButton);

        const saveButton = screen.getByText('Save Medication');
        fireEvent.press(saveButton);
      });

      await waitFor(() => {
        expect(mockAddMedication).toHaveBeenCalledWith(
          expect.objectContaining({
            scheduleFrequency: undefined
          })
        );
      });

      // Should not try to create schedules or reschedule notifications
      expect(medicationScheduleRepository.create).not.toHaveBeenCalled();
      expect(notificationService.rescheduleAllMedicationNotifications).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only name input', async () => {
      const mockRoute = { params: {} };

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        // Enter whitespace-only name
        const nameInput = screen.getByTestId('medication-name-input');
        fireEvent.changeText(nameInput, '   ');

        const dosageInput = screen.getByPlaceholderText('200');
        fireEvent.changeText(dosageInput, '100');

        const saveButton = screen.getByText('Save Medication');
        fireEvent.press(saveButton);

        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a medication name');
      });
    });

    it('should clear schedules when switching from scheduled to as-needed', async () => {
      const mockRoute = { params: {} };

      renderWithProviders(
        <AddMedicationScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        // Switch to scheduled mode and add a schedule
        const scheduledButton = screen.getByText('Scheduled');
        fireEvent.press(scheduledButton);
      });

      await waitFor(() => {
        const scheduleCallback = screen.getByTestId('schedules-change-callback');
        fireEvent.press(scheduleCallback);
      });

      await waitFor(() => {
        // Switch back to as-needed
        const asNeededButton = screen.getByText('As Needed');
        fireEvent.press(asNeededButton);

        // Fill required fields and save
        const nameInput = screen.getByTestId('medication-name-input');
        fireEvent.changeText(nameInput, 'Test Med');
      });

      const dosageInput = screen.getByPlaceholderText('200');
      fireEvent.changeText(dosageInput, '100');

      const saveButton = screen.getByText('Save Medication');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockAddMedication).toHaveBeenCalledWith(
          expect.objectContaining({
            scheduleFrequency: undefined
          })
        );
      });

      // Should not create any schedules
      expect(medicationScheduleRepository.create).not.toHaveBeenCalled();
    });
  });
});
