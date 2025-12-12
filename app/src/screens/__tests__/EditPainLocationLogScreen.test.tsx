import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

import EditPainLocationLogScreen from '../episode/EditPainLocationLogScreen';
import { renderWithProviders } from '../../utils/screenTestHelpers';

import { PainLocationLog } from '../../models/types';

// Mock the episode store instead of repository
jest.mock('../../store/episodeStore', () => ({
  useEpisodeStore: jest.fn(() => ({
    getPainLocationLogById: jest.fn(),
    updatePainLocationLog: jest.fn(),
    deletePainLocationLog: jest.fn(),
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
  key: 'EditPainLocationLog',
  name: 'EditPainLocationLog' as const,
  params: {
    painLocationLogId: 'test-pain-123',
  },
};

const mockPainLocationLog: PainLocationLog = {
  id: 'test-pain-123',
  episodeId: 'episode-456',
  timestamp: Date.now() - 3600000, // 1 hour ago
  painLocations: ['left_temple', 'right_eye'],
  createdAt: Date.now() - 3600000,
  updatedAt: Date.now() - 3600000,
};

describe('EditPainLocationLogScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { useEpisodeStore } = require('../../store/episodeStore');
    useEpisodeStore.mockReturnValue({
      getPainLocationLogById: jest.fn().mockReturnValue(mockPainLocationLog),
      updatePainLocationLog: jest.fn().mockResolvedValue(undefined),
      deletePainLocationLog: jest.fn().mockResolvedValue(undefined),
    });
  });

  it('should render loading state initially when pain location log is null', async () => {
    const { useEpisodeStore } = require('../../store/episodeStore');

    useEpisodeStore.mockReturnValue({
      getPainLocationLogById: jest.fn().mockReturnValue(null),
      updatePainLocationLog: jest.fn(),
      deletePainLocationLog: jest.fn(),
    });

    renderWithProviders(
      <EditPainLocationLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    // During loading, the save/delete buttons should not be present
    expect(screen.queryByText('Save Changes')).toBeNull();
    expect(screen.queryByText('Delete Pain Location Log')).toBeNull();
  });

  it('should load and display pain location log data correctly', async () => {
    renderWithProviders(
      <EditPainLocationLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Time')).toBeTruthy();
      expect(screen.getByText('Pain Locations')).toBeTruthy();
      expect(screen.getByText('Left Side')).toBeTruthy();
      expect(screen.getByText('Right Side')).toBeTruthy();
      expect(screen.getByText('Save Changes')).toBeTruthy();
      expect(screen.getByText('Delete Pain Location Log')).toBeTruthy();
    });
  });

  it('should show error and go back if pain location log not found', async () => {
    const { useEpisodeStore } = require('../../store/episodeStore');
    useEpisodeStore.mockReturnValue({
      getPainLocationLogById: jest.fn().mockReturnValue(null),
      updatePainLocationLog: jest.fn(),
      deletePainLocationLog: jest.fn(),
    });

    renderWithProviders(
      <EditPainLocationLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Pain location log not found');
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  it('should handle loading error and go back', async () => {
    const { useEpisodeStore } = require('../../store/episodeStore');
    useEpisodeStore.mockReturnValue({
      getPainLocationLogById: jest.fn(() => { throw new Error('Database error'); }),
      updatePainLocationLog: jest.fn(),
      deletePainLocationLog: jest.fn(),
    });

    renderWithProviders(
      <EditPainLocationLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to load pain location log');
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  it('should display all pain location options', async () => {
    renderWithProviders(
      <EditPainLocationLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });

    // Check that location labels are displayed (Eye, Temple, etc appear twice - left and right)
    expect(screen.getAllByText('Eye').length).toBe(2);
    expect(screen.getAllByText('Temple').length).toBe(2);
    expect(screen.getAllByText('Neck').length).toBe(2);
    expect(screen.getAllByText('Head').length).toBe(2);
    expect(screen.getAllByText('Teeth').length).toBe(2);
  });

  it('should highlight the selected pain locations', async () => {
    renderWithProviders(
      <EditPainLocationLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });

    // Left Temple and Right Eye should be selected (from mockPainLocationLog)
    const leftTempleButton = screen.getByLabelText('Left Temple');
    expect(leftTempleButton).toHaveAccessibilityState({ selected: true });

    const rightEyeButton = screen.getByLabelText('Right Eye');
    expect(rightEyeButton).toHaveAccessibilityState({ selected: true });

    // Other locations should not be selected
    const leftEyeButton = screen.getByLabelText('Left Eye');
    expect(leftEyeButton).toHaveAccessibilityState({ selected: false });
  });

  it('should allow toggling pain locations', async () => {
    renderWithProviders(
      <EditPainLocationLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });

    // Toggle left neck on
    const leftNeckButton = screen.getByLabelText('Left Neck');
    fireEvent.press(leftNeckButton);
    expect(leftNeckButton).toHaveAccessibilityState({ selected: true });

    // Toggle left temple off
    const leftTempleButton = screen.getByLabelText('Left Temple');
    fireEvent.press(leftTempleButton);
    expect(leftTempleButton).toHaveAccessibilityState({ selected: false });
  });

  it('should save pain location changes successfully', async () => {
    const { useEpisodeStore } = require('../../store/episodeStore');
    const mockUpdatePainLocationLog = jest.fn().mockResolvedValue(undefined);
    useEpisodeStore.mockReturnValue({
      getPainLocationLogById: jest.fn().mockReturnValue(mockPainLocationLog),
      updatePainLocationLog: mockUpdatePainLocationLog,
      deletePainLocationLog: jest.fn(),
    });

    renderWithProviders(
      <EditPainLocationLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });

    // Add left neck to selection
    const leftNeckButton = screen.getByLabelText('Left Neck');
    fireEvent.press(leftNeckButton);

    const saveButton = screen.getByText('Save Changes');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(mockUpdatePainLocationLog).toHaveBeenCalledWith(
        'test-pain-123',
        expect.objectContaining({
          painLocations: expect.arrayContaining(['left_temple', 'right_eye', 'left_neck']),
          timestamp: expect.any(Number),
        })
      );
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  it('should handle save error', async () => {
    const { useEpisodeStore } = require('../../store/episodeStore');
    useEpisodeStore.mockReturnValue({
      getPainLocationLogById: jest.fn().mockReturnValue(mockPainLocationLog),
      updatePainLocationLog: jest.fn().mockRejectedValue(new Error('Save failed')),
      deletePainLocationLog: jest.fn(),
    });

    renderWithProviders(
      <EditPainLocationLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to update pain location log');
    });
  });

  it('should disable save button when all locations are deselected', async () => {
    renderWithProviders(
      <EditPainLocationLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });

    // Initially the save button should be enabled (we have 2 locations selected)
    const saveButton = screen.getByLabelText('Save changes');
    expect(saveButton).toHaveAccessibilityState({ disabled: false });

    // Deselect all currently selected locations (left_temple and right_eye)
    const leftTempleButton = screen.getByLabelText('Left Temple');
    fireEvent.press(leftTempleButton);
    const rightEyeButton = screen.getByLabelText('Right Eye');
    fireEvent.press(rightEyeButton);

    // Now the save button should be disabled
    await waitFor(() => {
      expect(saveButton).toHaveAccessibilityState({ disabled: true });
    });
  });

  it('should show confirmation dialog when delete button is pressed', async () => {
    renderWithProviders(
      <EditPainLocationLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Delete Pain Location Log')).toBeTruthy();
    });

    const deleteButton = screen.getByText('Delete Pain Location Log');
    fireEvent.press(deleteButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Pain Location Log',
        'Are you sure you want to delete this pain location log?',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel' }),
          expect.objectContaining({ text: 'Delete' }),
        ])
      );
    });
  });

  it('should delete pain location log when confirmed', async () => {
    const { useEpisodeStore } = require('../../store/episodeStore');
    const mockDeletePainLocationLog = jest.fn().mockResolvedValue(undefined);
    useEpisodeStore.mockReturnValue({
      getPainLocationLogById: jest.fn().mockReturnValue(mockPainLocationLog),
      updatePainLocationLog: jest.fn(),
      deletePainLocationLog: mockDeletePainLocationLog,
    });

    renderWithProviders(
      <EditPainLocationLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Delete Pain Location Log')).toBeTruthy();
    });

    const deleteButton = screen.getByText('Delete Pain Location Log');
    fireEvent.press(deleteButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Pain Location Log',
        'Are you sure you want to delete this pain location log?',
        expect.any(Array)
      );
    });

    // Simulate pressing Delete in the confirmation dialog
    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const deleteAlert = alertCalls.find(call => call[0] === 'Delete Pain Location Log');
    const deleteConfirmButton = deleteAlert[2].find((button: any) => button.text === 'Delete');
    await deleteConfirmButton.onPress();

    await waitFor(() => {
      expect(mockDeletePainLocationLog).toHaveBeenCalledWith('test-pain-123');
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  it('should cancel and go back when cancel button is pressed', async () => {
    renderWithProviders(
      <EditPainLocationLogScreen
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
      <EditPainLocationLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      // Check that buttons have accessibility labels
      const cancelButton = screen.getByLabelText('Cancel');
      const saveButton = screen.getByLabelText('Save changes');
      const deleteButton = screen.getByLabelText('Delete pain location log');

      expect(cancelButton).toBeTruthy();
      expect(saveButton).toBeTruthy();
      expect(deleteButton).toBeTruthy();
    });
  });

  it('should disable save button when no locations are selected', async () => {
    const { useEpisodeStore } = require('../../store/episodeStore');
    const emptyLocationLog = { ...mockPainLocationLog, painLocations: [] };
    useEpisodeStore.mockReturnValue({
      getPainLocationLogById: jest.fn().mockReturnValue(emptyLocationLog),
      updatePainLocationLog: jest.fn(),
      deletePainLocationLog: jest.fn(),
    });

    renderWithProviders(
      <EditPainLocationLogScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    await waitFor(() => {
      const saveButton = screen.getByLabelText('Save changes');
      expect(saveButton).toHaveAccessibilityState({ disabled: true });
    });
  });
});
