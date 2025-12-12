import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

import EditSymptomLogScreen from '../episode/EditSymptomLogScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';

import { SymptomLog } from '../../models/types';

// Mock the episode store instead of repository
jest.mock('../../store/episodeStore', () => ({
  useEpisodeStore: jest.fn(() => ({
    getSymptomLogById: jest.fn(),
    updateSymptomLog: jest.fn(),
    deleteSymptomLog: jest.fn(),
    addSymptomLog: jest.fn(),
    symptomLogs: [],
  })),
}));

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
  key: 'EditSymptomLog',
  name: 'EditSymptomLog' as const,
  params: {
    symptomLogId: 'test-symptom-123',
  },
};

const testOnsetTime = Date.now() - 3600000; // 1 hour ago

const mockSymptomLog: SymptomLog = {
  id: 'test-symptom-123',
  episodeId: 'episode-456',
  symptom: 'nausea',
  onsetTime: testOnsetTime,
  resolutionTime: undefined,
  createdAt: testOnsetTime,
};

// Second symptom at same timestamp for multi-select testing
const mockSymptomLog2: SymptomLog = {
  id: 'test-symptom-456',
  episodeId: 'episode-456',
  symptom: 'aura',
  onsetTime: testOnsetTime, // Same timestamp as first log
  resolutionTime: undefined,
  createdAt: testOnsetTime,
};

describe('EditSymptomLogScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { useEpisodeStore } = require('../../store/episodeStore');
    useEpisodeStore.mockReturnValue({
      getSymptomLogById: jest.fn().mockReturnValue(mockSymptomLog),
      updateSymptomLog: jest.fn().mockResolvedValue(undefined),
      deleteSymptomLog: jest.fn().mockResolvedValue(undefined),
      addSymptomLog: jest.fn().mockResolvedValue(undefined),
      symptomLogs: [mockSymptomLog], // Single symptom at this timestamp by default
    });
  });

  it('should render loading state initially when symptom log is null', async () => {
    const { useEpisodeStore } = require('../../store/episodeStore');

    useEpisodeStore.mockReturnValue({
      getSymptomLogById: jest.fn().mockReturnValue(null),
      updateSymptomLog: jest.fn(),
      deleteSymptomLog: jest.fn(),
      addSymptomLog: jest.fn(),
      symptomLogs: [],
    });

    renderWithProviders(
      <EditSymptomLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    // During loading, the save/delete buttons should not be present
    expect(screen.queryByText('Save Changes')).toBeNull();
    expect(screen.queryByText('Delete Symptom Log')).toBeNull();
  });

  it('should load and display symptom log data correctly', async () => {
    renderWithProviders(
      <EditSymptomLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Symptoms')).toBeTruthy();
      expect(screen.getByText('Time')).toBeTruthy();
      expect(screen.getByText('Save Changes')).toBeTruthy();
      expect(screen.getByText('Delete Symptom Log')).toBeTruthy();
    });
  });

  it('should show error and go back if symptom log not found', async () => {
    const { useEpisodeStore } = require('../../store/episodeStore');
    useEpisodeStore.mockReturnValue({
      getSymptomLogById: jest.fn().mockReturnValue(null),
      updateSymptomLog: jest.fn(),
      deleteSymptomLog: jest.fn(),
      addSymptomLog: jest.fn(),
      symptomLogs: [],
    });

    renderWithProviders(
      <EditSymptomLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Symptom log not found');
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  it('should handle loading error and go back', async () => {
    const { useEpisodeStore } = require('../../store/episodeStore');
    useEpisodeStore.mockReturnValue({
      getSymptomLogById: jest.fn(() => { throw new Error('Database error'); }),
      updateSymptomLog: jest.fn(),
      deleteSymptomLog: jest.fn(),
      addSymptomLog: jest.fn(),
      symptomLogs: [],
    });

    renderWithProviders(
      <EditSymptomLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to load symptom log');
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  it('should display all symptom options', async () => {
    renderWithProviders(
      <EditSymptomLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });

    // Check that all symptoms are displayed
    expect(screen.getByText('Nausea')).toBeTruthy();
    expect(screen.getByText('Vomiting')).toBeTruthy();
    expect(screen.getByText('Visual Disturbances')).toBeTruthy();
    expect(screen.getByText('Aura')).toBeTruthy();
    expect(screen.getByText('Light Sensitivity')).toBeTruthy();
    expect(screen.getByText('Sound Sensitivity')).toBeTruthy();
    expect(screen.getByText('Smell Sensitivity')).toBeTruthy();
    expect(screen.getByText('Dizziness')).toBeTruthy();
    expect(screen.getByText('Confusion')).toBeTruthy();
  });

  it('should highlight the selected symptoms', async () => {
    renderWithProviders(
      <EditSymptomLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });

    // Nausea should be selected (from mockSymptomLog)
    const nauseaButton = screen.getByLabelText('Nausea');
    expect(nauseaButton).toHaveAccessibilityState({ selected: true });

    // Other symptoms should not be selected
    const auraButton = screen.getByLabelText('Aura');
    expect(auraButton).toHaveAccessibilityState({ selected: false });
  });

  it('should allow toggling symptoms (multi-select)', async () => {
    renderWithProviders(
      <EditSymptomLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });

    // Nausea is already selected
    const nauseaButton = screen.getByLabelText('Nausea');
    expect(nauseaButton).toHaveAccessibilityState({ selected: true });

    // Select Aura as well (multi-select)
    const auraButton = screen.getByLabelText('Aura');
    fireEvent.press(auraButton);

    // Both should now be selected
    expect(auraButton).toHaveAccessibilityState({ selected: true });
    expect(nauseaButton).toHaveAccessibilityState({ selected: true });

    // Deselect Nausea
    fireEvent.press(nauseaButton);
    expect(nauseaButton).toHaveAccessibilityState({ selected: false });
    expect(auraButton).toHaveAccessibilityState({ selected: true });
  });

  it('should add new symptom log when selecting additional symptom', async () => {
    const { useEpisodeStore } = require('../../store/episodeStore');
    const mockAddSymptomLog = jest.fn().mockResolvedValue(undefined);
    useEpisodeStore.mockReturnValue({
      getSymptomLogById: jest.fn().mockReturnValue(mockSymptomLog),
      updateSymptomLog: jest.fn().mockResolvedValue(undefined),
      deleteSymptomLog: jest.fn().mockResolvedValue(undefined),
      addSymptomLog: mockAddSymptomLog,
      symptomLogs: [mockSymptomLog],
    });

    renderWithProviders(
      <EditSymptomLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });

    // Add aura (keeping nausea selected)
    const auraButton = screen.getByLabelText('Aura');
    fireEvent.press(auraButton);

    const saveButton = screen.getByText('Save Changes');
    fireEvent.press(saveButton);

    await waitFor(() => {
      // New symptom log should be created for aura
      expect(mockAddSymptomLog).toHaveBeenCalledWith(
        expect.objectContaining({
          symptom: 'aura',
          episodeId: 'episode-456',
          onsetTime: expect.any(Number),
        })
      );
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  it('should convert deselected symptom to removal event', async () => {
    const { useEpisodeStore } = require('../../store/episodeStore');
    const mockUpdateSymptomLog = jest.fn().mockResolvedValue(undefined);
    useEpisodeStore.mockReturnValue({
      getSymptomLogById: jest.fn().mockReturnValue(mockSymptomLog),
      updateSymptomLog: mockUpdateSymptomLog,
      deleteSymptomLog: jest.fn().mockResolvedValue(undefined),
      addSymptomLog: jest.fn().mockResolvedValue(undefined),
      symptomLogs: [mockSymptomLog, mockSymptomLog2], // Two symptoms at same timestamp
    });

    renderWithProviders(
      <EditSymptomLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });

    // Both should be selected initially
    const nauseaButton = screen.getByLabelText('Nausea');
    const auraButton = screen.getByLabelText('Aura');
    expect(nauseaButton).toHaveAccessibilityState({ selected: true });
    expect(auraButton).toHaveAccessibilityState({ selected: true });

    // Deselect nausea (keep aura)
    fireEvent.press(nauseaButton);

    const saveButton = screen.getByText('Save Changes');
    fireEvent.press(saveButton);

    await waitFor(() => {
      // Nausea log should be updated to a "removed" event (resolutionTime set)
      expect(mockUpdateSymptomLog).toHaveBeenCalledWith(
        'test-symptom-123',
        expect.objectContaining({
          resolutionTime: expect.any(Number), // Should have resolutionTime set
        })
      );
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  it('should handle save error', async () => {
    const { useEpisodeStore } = require('../../store/episodeStore');
    const mockAddSymptomLog = jest.fn().mockRejectedValue(new Error('Save failed'));
    useEpisodeStore.mockReturnValue({
      getSymptomLogById: jest.fn().mockReturnValue(mockSymptomLog),
      updateSymptomLog: jest.fn().mockResolvedValue(undefined),
      deleteSymptomLog: jest.fn().mockResolvedValue(undefined),
      addSymptomLog: mockAddSymptomLog,
      symptomLogs: [mockSymptomLog],
    });

    renderWithProviders(
      <EditSymptomLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });

    // Add a new symptom which will trigger addSymptomLog (which will fail)
    const auraButton = screen.getByLabelText('Aura');
    fireEvent.press(auraButton);

    const saveButton = screen.getByText('Save Changes');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to update symptom logs');
    });
  });

  it('should show confirmation dialog when delete button is pressed', async () => {
    renderWithProviders(
      <EditSymptomLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Delete Symptom Log')).toBeTruthy();
    });

    const deleteButton = screen.getByText('Delete Symptom Log');
    fireEvent.press(deleteButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Symptom Log',
        'Are you sure you want to delete this symptom log?',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel' }),
          expect.objectContaining({ text: 'Delete' }),
        ])
      );
    });
  });

  it('should delete symptom log when confirmed', async () => {
    const { useEpisodeStore } = require('../../store/episodeStore');
    const mockDeleteSymptomLog = jest.fn().mockResolvedValue(undefined);
    useEpisodeStore.mockReturnValue({
      getSymptomLogById: jest.fn().mockReturnValue(mockSymptomLog),
      updateSymptomLog: jest.fn(),
      deleteSymptomLog: mockDeleteSymptomLog,
      addSymptomLog: jest.fn(),
      symptomLogs: [mockSymptomLog],
    });

    renderWithProviders(
      <EditSymptomLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Delete Symptom Log')).toBeTruthy();
    });

    const deleteButton = screen.getByText('Delete Symptom Log');
    fireEvent.press(deleteButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Symptom Log',
        'Are you sure you want to delete this symptom log?',
        expect.any(Array)
      );
    });

    // Simulate pressing Delete in the confirmation dialog
    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const deleteAlert = alertCalls.find(call => call[0] === 'Delete Symptom Log');
    const deleteConfirmButton = deleteAlert[2].find((button: any) => button.text === 'Delete');
    await deleteConfirmButton.onPress();

    await waitFor(() => {
      expect(mockDeleteSymptomLog).toHaveBeenCalledWith('test-symptom-123');
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  it('should delete all symptom logs at same timestamp when confirmed', async () => {
    const { useEpisodeStore } = require('../../store/episodeStore');
    const mockDeleteSymptomLog = jest.fn().mockResolvedValue(undefined);
    useEpisodeStore.mockReturnValue({
      getSymptomLogById: jest.fn().mockReturnValue(mockSymptomLog),
      updateSymptomLog: jest.fn(),
      deleteSymptomLog: mockDeleteSymptomLog,
      addSymptomLog: jest.fn(),
      symptomLogs: [mockSymptomLog, mockSymptomLog2], // Two symptoms at same timestamp
    });

    renderWithProviders(
      <EditSymptomLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Delete Symptom Log')).toBeTruthy();
    });

    const deleteButton = screen.getByText('Delete Symptom Log');
    fireEvent.press(deleteButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Symptom Log',
        'Are you sure you want to delete all 2 symptom logs at this time?',
        expect.any(Array)
      );
    });

    // Simulate pressing Delete in the confirmation dialog
    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const deleteAlert = alertCalls.find(call => call[0] === 'Delete Symptom Log');
    const deleteConfirmButton = deleteAlert[2].find((button: any) => button.text === 'Delete');
    await deleteConfirmButton.onPress();

    await waitFor(() => {
      expect(mockDeleteSymptomLog).toHaveBeenCalledWith('test-symptom-123');
      expect(mockDeleteSymptomLog).toHaveBeenCalledWith('test-symptom-456');
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  it('should cancel and go back when cancel button is pressed', async () => {
    renderWithProviders(
      <EditSymptomLogScreen
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

  it('should have proper accessibility labels', async () => {
    renderWithProviders(
      <EditSymptomLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      // Check that buttons have accessibility labels
      const cancelButton = screen.getByLabelText('Cancel');
      const saveButton = screen.getByLabelText('Save changes');
      const deleteButton = screen.getByLabelText('Delete symptom log');

      expect(cancelButton).toBeTruthy();
      expect(saveButton).toBeTruthy();
      expect(deleteButton).toBeTruthy();
    });
  });

  it('should allow saving when all symptoms are deselected (converts to removal events)', async () => {
    const { useEpisodeStore } = require('../../store/episodeStore');
    const mockUpdateSymptomLog = jest.fn().mockResolvedValue(undefined);
    useEpisodeStore.mockReturnValue({
      getSymptomLogById: jest.fn().mockReturnValue(mockSymptomLog),
      updateSymptomLog: mockUpdateSymptomLog,
      deleteSymptomLog: jest.fn(),
      addSymptomLog: jest.fn(),
      symptomLogs: [mockSymptomLog],
    });

    renderWithProviders(
      <EditSymptomLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });

    // Deselect nausea (the only symptom)
    const nauseaButton = screen.getByLabelText('Nausea');
    fireEvent.press(nauseaButton);

    // Save should still be enabled (deselecting converts to removal event)
    const saveButton = screen.getByLabelText('Save changes');
    expect(saveButton).toHaveAccessibilityState({ disabled: false });

    // Save should convert the symptom to a removal event
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(mockUpdateSymptomLog).toHaveBeenCalledWith(
        'test-symptom-123',
        expect.objectContaining({
          resolutionTime: expect.any(Number),
        })
      );
    });
  });

  it('should show multiple symptoms selected when loaded from same timestamp', async () => {
    const { useEpisodeStore } = require('../../store/episodeStore');
    useEpisodeStore.mockReturnValue({
      getSymptomLogById: jest.fn().mockReturnValue(mockSymptomLog),
      updateSymptomLog: jest.fn(),
      deleteSymptomLog: jest.fn(),
      addSymptomLog: jest.fn(),
      symptomLogs: [mockSymptomLog, mockSymptomLog2], // Two symptoms at same timestamp
    });

    renderWithProviders(
      <EditSymptomLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });

    // Both symptoms should be selected
    const nauseaButton = screen.getByLabelText('Nausea');
    const auraButton = screen.getByLabelText('Aura');
    expect(nauseaButton).toHaveAccessibilityState({ selected: true });
    expect(auraButton).toHaveAccessibilityState({ selected: true });

    // Other symptoms should not be selected
    const dizzinessButton = screen.getByLabelText('Dizziness');
    expect(dizzinessButton).toHaveAccessibilityState({ selected: false });
  });
});
