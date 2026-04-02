import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import MedicationScheduleStatus, { 
  MedicationScheduleStatusProps, 
  ScheduleLogState 
} from '../medication/MedicationScheduleStatus';
import { MedicationSchedule } from '../../models/types';

// Mock the theme hook directly
jest.mock('../../theme', () => ({
  useTheme: jest.fn(() => ({
    theme: {
      background: '#ffffff',
      text: '#000000',
      textSecondary: '#666666',
      primary: '#007AFF',
      primaryText: '#ffffff',
      success: '#34C759',
      error: '#FF3B30',
      border: '#e0e0e0',
    },
    themeMode: 'light',
    isDark: false,
    setThemeMode: jest.fn(),
  })),
}));

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../utils/dateFormatting', () => ({
  formatTime: jest.fn((date: Date | number) => {
    if (date instanceof Date) {
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    const d = new Date(date);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, testID, ...props }: any) => {
    const { View, Text } = require('react-native');
    return <View testID={testID} {...props} accessibilityLabel={`icon-${name}`}>
      <Text>{name}</Text>
    </View>;
  },
}));

// Test helper to render components
const renderComponent = (component: React.ReactElement) => {
  return render(component);
};

// Test data
const mockSchedules: MedicationSchedule[] = [
  {
    id: 'schedule-1',
    medicationId: 'med-1',
    time: '08:00',
    timezone: 'America/New_York',
    dosage: 1,
    enabled: true,
    reminderEnabled: true,
  },
  {
    id: 'schedule-2',
    medicationId: 'med-1', 
    time: '20:00',
    timezone: 'America/New_York',
    dosage: 2,
    enabled: true,
    reminderEnabled: true,
  },
  {
    id: 'schedule-3',
    medicationId: 'med-1',
    time: '12:00',
    timezone: 'America/New_York',
    dosage: 1,
    enabled: false,
    reminderEnabled: false,
  },
];

const createDefaultProps = (): MedicationScheduleStatusProps => ({
  medicationId: 'med-1',
  medicationName: 'Test Medication',
  schedules: mockSchedules,
  scheduleLogStates: {},
  onQuickLog: jest.fn(),
  onUndoLog: jest.fn(),
  showLogButtons: true,
  testID: 'medication-schedule-status',
});

describe('MedicationScheduleStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic rendering', () => {
    it('renders with minimal props', () => {
      const props = createDefaultProps();
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      expect(screen.getByTestId('medication-schedule-status')).toBeOnTheScreen();
    });

    it('renders without testID', () => {
      const props = { ...createDefaultProps(), testID: undefined };
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      // Should still render the buttons (without testID)
      expect(screen.getByText('Log 08:00')).toBeOnTheScreen();
      expect(screen.getByText('Log 20:00')).toBeOnTheScreen();
      expect(screen.getByText('Log 12:00')).toBeOnTheScreen();
    });

    it('renders with empty schedules array', () => {
      const props = { ...createDefaultProps(), schedules: [] };
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      expect(screen.getByTestId('medication-schedule-status')).toBeOnTheScreen();
    });
  });

  describe('Schedule log buttons', () => {
    it('shows log buttons for unlogged schedules when showLogButtons is true', () => {
      const props = createDefaultProps();
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      expect(screen.getByTestId('medication-schedule-status-buttons')).toBeOnTheScreen();
      expect(screen.getByTestId('medication-schedule-status-log-schedule-1')).toBeOnTheScreen();
      expect(screen.getByTestId('medication-schedule-status-log-schedule-2')).toBeOnTheScreen();
      expect(screen.getByTestId('medication-schedule-status-log-schedule-3')).toBeOnTheScreen();
    });

    it('hides log buttons when showLogButtons is false', () => {
      const props = { ...createDefaultProps(), showLogButtons: false };
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      expect(screen.queryByTestId('medication-schedule-status-buttons')).not.toBeOnTheScreen();
    });

    it('displays correct time format on log buttons', () => {
      const props = createDefaultProps();
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      expect(screen.getByText('Log 08:00')).toBeOnTheScreen();
      expect(screen.getByText('Log 20:00')).toBeOnTheScreen();
      expect(screen.getByText('Log 12:00')).toBeOnTheScreen();
    });

    it('calls onQuickLog with correct parameters when log button is pressed', () => {
      const props = createDefaultProps();
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      const logButton = screen.getByTestId('medication-schedule-status-log-schedule-1');
      fireEvent.press(logButton);
      
      expect(props.onQuickLog).toHaveBeenCalledWith('med-1', 'schedule-1', 1, '08:00');
    });

    it('calls onQuickLog with different dosages correctly', () => {
      const props = createDefaultProps();
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      const logButton2 = screen.getByTestId('medication-schedule-status-log-schedule-2');
      fireEvent.press(logButton2);
      
      expect(props.onQuickLog).toHaveBeenCalledWith('med-1', 'schedule-2', 2, '20:00');
    });

    it('has proper accessibility labels and hints for log buttons', () => {
      const props = createDefaultProps();
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      const logButton = screen.getByTestId('medication-schedule-status-log-schedule-1');
      expect(logButton).toHaveProp('accessibilityRole', 'button');
      expect(logButton).toHaveProp('accessibilityLabel', 'Log 08:00 dose');
      expect(logButton).toHaveProp('accessibilityHint', 'Records that you took your 08:00 dose of Test Medication');
    });
  });

  describe('Logged and skipped schedules', () => {
    it('shows logged notification for logged schedules', () => {
      const scheduleLogStates: Record<string, ScheduleLogState> = {
        'med-1-schedule-1': {
          logged: true,
          doseId: 'dose-1',
          loggedAt: new Date('2023-10-15T08:30:00Z'),
        },
      };
      const props = { ...createDefaultProps(), scheduleLogStates };
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      expect(screen.getByTestId('medication-schedule-status-logged')).toBeOnTheScreen();
      expect(screen.getByTestId('medication-schedule-status-logged-schedule-1')).toBeOnTheScreen();
      expect(screen.getByText('08:00 dose taken at 08:30')).toBeOnTheScreen();
    });

    it('shows logged notification without timestamp when loggedAt is missing', () => {
      const scheduleLogStates: Record<string, ScheduleLogState> = {
        'med-1-schedule-1': {
          logged: true,
          doseId: 'dose-1',
        },
      };
      const props = { ...createDefaultProps(), scheduleLogStates };
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      expect(screen.getByText('08:00 dose taken')).toBeOnTheScreen();
    });

    it('shows skipped notification for skipped schedules', () => {
      const scheduleLogStates: Record<string, ScheduleLogState> = {
        'med-1-schedule-1': {
          logged: false,
          skipped: true,
          doseId: 'dose-1',
        },
      };
      const props = { ...createDefaultProps(), scheduleLogStates };
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      expect(screen.getByText('08:00 dose skipped')).toBeOnTheScreen();
    });

    it('displays correct icons for logged and skipped schedules', () => {
      const scheduleLogStates: Record<string, ScheduleLogState> = {
        'med-1-schedule-1': {
          logged: true,
          doseId: 'dose-1',
        },
        'med-1-schedule-2': {
          logged: false,
          skipped: true,
          doseId: 'dose-2',
        },
      };
      const props = { ...createDefaultProps(), scheduleLogStates };
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      const loggedIcon = screen.getByLabelText('icon-checkmark-circle');
      const skippedIcon = screen.getByLabelText('icon-close-circle');
      
      expect(loggedIcon).toBeOnTheScreen();
      expect(skippedIcon).toBeOnTheScreen();
    });

    it('hides log buttons for logged schedules', () => {
      const scheduleLogStates: Record<string, ScheduleLogState> = {
        'med-1-schedule-1': {
          logged: true,
          doseId: 'dose-1',
        },
      };
      const props = { ...createDefaultProps(), scheduleLogStates };
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      expect(screen.queryByTestId('medication-schedule-status-log-schedule-1')).not.toBeOnTheScreen();
      expect(screen.getByTestId('medication-schedule-status-log-schedule-2')).toBeOnTheScreen();
      expect(screen.getByTestId('medication-schedule-status-log-schedule-3')).toBeOnTheScreen();
    });

    it('hides log buttons for skipped schedules', () => {
      const scheduleLogStates: Record<string, ScheduleLogState> = {
        'med-1-schedule-1': {
          logged: false,
          skipped: true,
          doseId: 'dose-1',
        },
      };
      const props = { ...createDefaultProps(), scheduleLogStates };
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      expect(screen.queryByTestId('medication-schedule-status-log-schedule-1')).not.toBeOnTheScreen();
      expect(screen.getByTestId('medication-schedule-status-log-schedule-2')).toBeOnTheScreen();
    });
  });

  describe('Undo functionality', () => {
    it('shows undo button for logged schedules with doseId', () => {
      const scheduleLogStates: Record<string, ScheduleLogState> = {
        'med-1-schedule-1': {
          logged: true,
          doseId: 'dose-1',
        },
      };
      const props = { ...createDefaultProps(), scheduleLogStates };
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      expect(screen.getByTestId('medication-schedule-status-undo-schedule-1')).toBeOnTheScreen();
      expect(screen.getByText('Undo')).toBeOnTheScreen();
    });

    it('shows undo button for skipped schedules with doseId', () => {
      const scheduleLogStates: Record<string, ScheduleLogState> = {
        'med-1-schedule-1': {
          logged: false,
          skipped: true,
          doseId: 'dose-1',
        },
      };
      const props = { ...createDefaultProps(), scheduleLogStates };
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      expect(screen.getByTestId('medication-schedule-status-undo-schedule-1')).toBeOnTheScreen();
    });

    it('hides undo button when doseId is missing', () => {
      const scheduleLogStates: Record<string, ScheduleLogState> = {
        'med-1-schedule-1': {
          logged: true,
        },
      };
      const props = { ...createDefaultProps(), scheduleLogStates };
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      expect(screen.queryByTestId('medication-schedule-status-undo-schedule-1')).not.toBeOnTheScreen();
    });

    it('calls onUndoLog with correct parameters when undo button is pressed', () => {
      const scheduleLogStates: Record<string, ScheduleLogState> = {
        'med-1-schedule-1': {
          logged: true,
          doseId: 'dose-1',
        },
      };
      const props = { ...createDefaultProps(), scheduleLogStates };
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      const undoButton = screen.getByTestId('medication-schedule-status-undo-schedule-1');
      fireEvent.press(undoButton);
      
      expect(props.onUndoLog).toHaveBeenCalledWith('med-1', 'schedule-1', 'dose-1');
    });

    it('has proper accessibility properties for undo button', () => {
      const scheduleLogStates: Record<string, ScheduleLogState> = {
        'med-1-schedule-1': {
          logged: true,
          doseId: 'dose-1',
        },
      };
      const props = { ...createDefaultProps(), scheduleLogStates };
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      const undoButton = screen.getByTestId('medication-schedule-status-undo-schedule-1');
      expect(undoButton).toHaveProp('accessibilityRole', 'button');
      expect(undoButton).toHaveProp('accessibilityLabel', 'Undo');
      expect(undoButton).toHaveProp('accessibilityHint', 'Removes this logged dose');
    });
  });

  describe('Mixed states and edge cases', () => {
    it('handles mix of logged, skipped, and unlogged schedules', () => {
      const scheduleLogStates: Record<string, ScheduleLogState> = {
        'med-1-schedule-1': {
          logged: true,
          doseId: 'dose-1',
        },
        'med-1-schedule-2': {
          logged: false,
          skipped: true,
          doseId: 'dose-2',
        },
        // schedule-3 remains unlogged
      };
      const props = { ...createDefaultProps(), scheduleLogStates };
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      // Should show logged and skipped notifications
      expect(screen.getByTestId('medication-schedule-status-logged')).toBeOnTheScreen();
      expect(screen.getByText('08:00 dose taken')).toBeOnTheScreen();
      expect(screen.getByText('20:00 dose skipped')).toBeOnTheScreen();
      
      // Should show log button only for unlogged schedule
      expect(screen.getByTestId('medication-schedule-status-buttons')).toBeOnTheScreen();
      expect(screen.queryByTestId('medication-schedule-status-log-schedule-1')).not.toBeOnTheScreen();
      expect(screen.queryByTestId('medication-schedule-status-log-schedule-2')).not.toBeOnTheScreen();
      expect(screen.getByTestId('medication-schedule-status-log-schedule-3')).toBeOnTheScreen();
      
      // Should show undo buttons for logged/skipped schedules
      expect(screen.getByTestId('medication-schedule-status-undo-schedule-1')).toBeOnTheScreen();
      expect(screen.getByTestId('medication-schedule-status-undo-schedule-2')).toBeOnTheScreen();
    });

    it('hides logged notifications container when no schedules are logged or skipped', () => {
      const props = createDefaultProps();
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      expect(screen.queryByTestId('medication-schedule-status-logged')).not.toBeOnTheScreen();
    });

    it('hides log buttons container when all schedules are logged/skipped', () => {
      const scheduleLogStates: Record<string, ScheduleLogState> = {
        'med-1-schedule-1': { logged: true, doseId: 'dose-1' },
        'med-1-schedule-2': { logged: false, skipped: true, doseId: 'dose-2' },
        'med-1-schedule-3': { logged: true, doseId: 'dose-3' },
      };
      const props = { ...createDefaultProps(), scheduleLogStates };
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      expect(screen.queryByTestId('medication-schedule-status-buttons')).not.toBeOnTheScreen();
    });

    it('handles schedules with different medication IDs correctly', () => {
      const schedules = [
        { ...mockSchedules[0], medicationId: 'different-med' }
      ];
      const scheduleLogStates: Record<string, ScheduleLogState> = {
        'med-1-schedule-1': { logged: true, doseId: 'dose-1' }, // Wrong medication ID
        'different-med-schedule-1': { logged: true, doseId: 'dose-2' }, // Correct medication ID
      };
      const props = { 
        ...createDefaultProps(), 
        medicationId: 'different-med',
        schedules,
        scheduleLogStates 
      };
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      expect(screen.getByTestId('medication-schedule-status-logged')).toBeOnTheScreen();
      expect(screen.getByText('08:00 dose taken')).toBeOnTheScreen();
    });

    it('handles missing schedule log states gracefully', () => {
      const scheduleLogStates: Record<string, ScheduleLogState> = {
        'med-1-schedule-1': { logged: true, doseId: 'dose-1' },
        // schedule-2 and schedule-3 have no log states
      };
      const props = { ...createDefaultProps(), scheduleLogStates };
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      // Should show logged notification for schedule-1
      expect(screen.getByTestId('medication-schedule-status-logged-schedule-1')).toBeOnTheScreen();
      
      // Should show log buttons for schedules without log states
      expect(screen.getByTestId('medication-schedule-status-log-schedule-2')).toBeOnTheScreen();
      expect(screen.getByTestId('medication-schedule-status-log-schedule-3')).toBeOnTheScreen();
    });
  });

  describe('Time formatting', () => {
    it('correctly formats different time strings', () => {
      const schedules: MedicationSchedule[] = [
        { ...mockSchedules[0], time: '06:30' },
        { ...mockSchedules[1], time: '14:45' },
        { ...mockSchedules[2], time: '23:15' },
      ];
      const props = { ...createDefaultProps(), schedules };
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      expect(screen.getByText('Log 06:30')).toBeOnTheScreen();
      expect(screen.getByText('Log 14:45')).toBeOnTheScreen();
      expect(screen.getByText('Log 23:15')).toBeOnTheScreen();
    });

    it('handles edge case time strings', () => {
      const schedules: MedicationSchedule[] = [
        { ...mockSchedules[0], time: '00:00' },
        { ...mockSchedules[1], time: '12:00' },
        { ...mockSchedules[2], time: '23:59' },
      ];
      const props = { ...createDefaultProps(), schedules };
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      expect(screen.getByText('Log 00:00')).toBeOnTheScreen();
      expect(screen.getByText('Log 12:00')).toBeOnTheScreen();
      expect(screen.getByText('Log 23:59')).toBeOnTheScreen();
    });
  });

  describe('Default props', () => {
    it('uses default value for showLogButtons when not provided', () => {
      const propsWithoutShowLogButtons = {
        medicationId: 'med-1',
        medicationName: 'Test Medication',
        schedules: mockSchedules,
        scheduleLogStates: {},
        onQuickLog: jest.fn(),
        onUndoLog: jest.fn(),
        testID: 'test-schedule',
      };
      renderComponent(<MedicationScheduleStatus {...propsWithoutShowLogButtons} />);
      
      // showLogButtons defaults to true, so buttons should be shown
      expect(screen.getByTestId('test-schedule-buttons')).toBeOnTheScreen();
    });
  });

  describe('Performance and rendering optimization', () => {
    it('only renders notifications for schedules that are logged or skipped', () => {
      const scheduleLogStates: Record<string, ScheduleLogState> = {
        'med-1-schedule-1': { logged: true, doseId: 'dose-1' },
        'med-1-schedule-2': { logged: false }, // Not logged or skipped
      };
      const props = { ...createDefaultProps(), scheduleLogStates };
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      // Only schedule-1 should have a logged notification
      expect(screen.getByTestId('medication-schedule-status-logged-schedule-1')).toBeOnTheScreen();
      expect(screen.queryByTestId('medication-schedule-status-logged-schedule-2')).not.toBeOnTheScreen();
      expect(screen.queryByTestId('medication-schedule-status-logged-schedule-3')).not.toBeOnTheScreen();
    });

    it('correctly filters unlogged schedules for button rendering', () => {
      const scheduleLogStates: Record<string, ScheduleLogState> = {
        'med-1-schedule-1': { logged: true, doseId: 'dose-1' },
        'med-1-schedule-2': { logged: false, skipped: true, doseId: 'dose-2' },
        // schedule-3 remains unlogged
      };
      const props = { ...createDefaultProps(), scheduleLogStates };
      renderComponent(<MedicationScheduleStatus {...props} />);
      
      // Only schedule-3 should have a log button
      expect(screen.queryByTestId('medication-schedule-status-log-schedule-1')).not.toBeOnTheScreen();
      expect(screen.queryByTestId('medication-schedule-status-log-schedule-2')).not.toBeOnTheScreen();
      expect(screen.getByTestId('medication-schedule-status-log-schedule-3')).toBeOnTheScreen();
    });
  });
});