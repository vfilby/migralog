import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import MedicationCard from '../medication/MedicationCard';
import { Medication, MedicationSchedule } from '../../models/types';
import { ScheduleLogState } from '../medication/MedicationScheduleStatus';
import { ThemeProvider } from '../../theme/ThemeContext';

// Mock the dependent components
jest.mock('../medication/MedicationBadges', () => {
  const { View, Text } = require('react-native');
  return function MedicationBadges({ type, category, testID }: any) {
    return (
      <View testID={testID}>
        <Text testID={testID ? `${testID}-type-badge` : undefined}>
          {type}
        </Text>
        {category && (
          <Text testID={testID ? `${testID}-category-badge` : undefined}>
            {category}
          </Text>
        )}
      </View>
    );
  };
});

jest.mock('../medication/MedicationQuickActions', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MedicationQuickActions({ onQuickLog, onDetailedLog, medicationId, defaultQuantity, testID }: any) {
    return (
      <View testID={testID}>
        <TouchableOpacity
          testID={testID ? `${testID}-quick-log` : undefined}
          onPress={() => onQuickLog(medicationId, defaultQuantity || 1)}
        >
          <Text>Quick Log</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={testID ? `${testID}-detailed-log` : undefined}
          onPress={() => onDetailedLog(medicationId)}
        >
          <Text>Log Details</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

jest.mock('../medication/MedicationScheduleStatus', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MedicationScheduleStatus({ 
    schedules, 
    scheduleLogStates, 
    onQuickLog, 
    onUndoLog, 
    medicationId, 
    showLogButtons,
    testID 
  }: any) {
    return (
      <View testID={testID}>
        {schedules.map((schedule: any) => {
          const stateKey = `${medicationId}-${schedule.id}`;
          const logState = scheduleLogStates[stateKey];
          
          return (
            <View key={schedule.id}>
              {logState?.logged && (
                <Text testID={testID ? `${testID}-logged-${schedule.id}` : undefined}>
                  {schedule.time} dose taken
                </Text>
              )}
              {logState?.doseId && (
                <TouchableOpacity
                  testID={testID ? `${testID}-undo-${schedule.id}` : undefined}
                  onPress={() => onUndoLog(medicationId, schedule.id, logState.doseId)}
                >
                  <Text>Undo</Text>
                </TouchableOpacity>
              )}
              {showLogButtons && !logState?.logged && (
                <TouchableOpacity
                  testID={testID ? `${testID}-log-${schedule.id}` : undefined}
                  onPress={() => onQuickLog(medicationId, schedule.id, schedule.dosage, schedule.time)}
                >
                  <Text>Log {schedule.time}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>
    );
  };
});

// Mock utilities
jest.mock('../../utils/medicationFormatting', () => ({
  formatMedicationDosage: jest.fn((quantity: number, amount: number, unit: string) => 
    `${quantity} × ${amount}${unit}`
  ),
}));

jest.mock('../../utils/dateFormatting', () => ({
  formatTime: jest.fn((date: Date | string) => {
    if (typeof date === 'string') {
      const [hours, minutes] = date.split(':');
      const hour = parseInt(hours, 10);
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      return `${displayHour}:${minutes} ${period}`;
    }
    return date.toLocaleTimeString();
  }),
}));

jest.mock('date-fns', () => ({
  ...jest.requireActual('date-fns'),
  format: jest.fn((date: Date, formatStr: string) => {
    if (formatStr.includes('MMM d, yyyy')) {
      return 'Jan 15, 2024';
    }
    return date.toLocaleDateString();
  }),
}));

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('MedicationCard', () => {
  const mockOnPress = jest.fn();
  const mockOnQuickLog = jest.fn();
  const mockOnDetailedLog = jest.fn();
  const mockOnScheduleLog = jest.fn();
  const mockOnUndoLog = jest.fn();

  const baseMedication: Medication = {
    id: 'med-1',
    name: 'Ibuprofen',
    type: 'rescue',
    dosageAmount: 200,
    dosageUnit: 'mg',
    defaultQuantity: 2,
    scheduleFrequency: undefined,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const baseSchedule: MedicationSchedule = {
    id: 'schedule-1',
    medicationId: 'med-1',
    time: '08:00',
    timezone: 'America/New_York',
    dosage: 1,
    enabled: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render medication name', async () => {
      renderWithTheme(
        <MedicationCard
          medication={baseMedication}
          type="rescue"
          onPress={mockOnPress}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Ibuprofen')).toBeTruthy();
      });
    });

    it('should render medication badges', async () => {
      renderWithTheme(
        <MedicationCard
          medication={baseMedication}
          type="rescue"
          onPress={mockOnPress}
          testID="medication-card"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('medication-card-badges')).toBeTruthy();
        expect(screen.getByTestId('medication-card-badges-type-badge')).toBeTruthy();
      });
    });

    it('should render dosage information', async () => {
      const { formatMedicationDosage } = require('../../utils/medicationFormatting');
      
      renderWithTheme(
        <MedicationCard
          medication={baseMedication}
          type="rescue"
          onPress={mockOnPress}
        />
      );

      await waitFor(() => {
        expect(formatMedicationDosage).toHaveBeenCalledWith(2, 200, 'mg');
        expect(screen.getByText('2 × 200mg')).toBeTruthy();
      });
    });

    it('should use default quantity of 1 when not specified', async () => {
      const medicationWithoutQuantity = { ...baseMedication, defaultQuantity: undefined };
      const { formatMedicationDosage } = require('../../utils/medicationFormatting');
      
      renderWithTheme(
        <MedicationCard
          medication={medicationWithoutQuantity}
          type="rescue"
          onPress={mockOnPress}
        />
      );

      await waitFor(() => {
        expect(formatMedicationDosage).toHaveBeenCalledWith(1, 200, 'mg');
      });
    });
  });

  describe('Card Interaction', () => {
    it('should call onPress when card is pressed', async () => {
      renderWithTheme(
        <MedicationCard
          medication={baseMedication}
          type="rescue"
          onPress={mockOnPress}
          testID="medication-card"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('medication-card')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('medication-card'));
      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it('should have correct accessibility properties', async () => {
      renderWithTheme(
        <MedicationCard
          medication={baseMedication}
          type="rescue"
          onPress={mockOnPress}
          testID="medication-card"
        />
      );

      await waitFor(() => {
        const card = screen.getByTestId('medication-card');
        expect(card.props.accessibilityRole).toBe('button');
        expect(card.props.accessibilityLabel).toBe('Ibuprofen rescue medication');
        expect(card.props.accessibilityHint).toBe('Opens details and history for this medication');
      });
    });
  });

  describe('Medication Photo', () => {
    it('should render medication photo when photoUri is provided', async () => {
      const medicationWithPhoto = {
        ...baseMedication,
        photoUri: 'file://photo.jpg',
      };

      renderWithTheme(
        <MedicationCard
          medication={medicationWithPhoto}
          type="rescue"
          onPress={mockOnPress}
        />
      );

      await waitFor(() => {
        const image = screen.getByLabelText('Photo of Ibuprofen');
        expect(image).toBeTruthy();
        expect(image.props.source.uri).toBe('file://photo.jpg');
      });
    });

    it('should not render photo when photoUri is not provided', async () => {
      renderWithTheme(
        <MedicationCard
          medication={baseMedication}
          type="rescue"
          onPress={mockOnPress}
        />
      );

      await waitFor(() => {
        expect(screen.queryByLabelText('Photo of Ibuprofen')).toBeNull();
      });
    });
  });

  describe('Schedule Frequency Display', () => {
    it('should render schedule frequency when provided', async () => {
      const medicationWithSchedule = {
        ...baseMedication,
        scheduleFrequency: 'daily' as const,
      };

      renderWithTheme(
        <MedicationCard
          medication={medicationWithSchedule}
          type="preventative"
          onPress={mockOnPress}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Daily/)).toBeTruthy();
      });
    });

    it('should capitalize schedule frequency', async () => {
      const medicationWithSchedule = {
        ...baseMedication,
        scheduleFrequency: 'monthly' as const,
      };

      renderWithTheme(
        <MedicationCard
          medication={medicationWithSchedule}
          type="preventative"
          onPress={mockOnPress}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Monthly/)).toBeTruthy();
      });
    });

    it('should not render schedule frequency when not provided', async () => {
      renderWithTheme(
        <MedicationCard
          medication={baseMedication}
          type="rescue"
          onPress={mockOnPress}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/Daily|Monthly|Quarterly/)).toBeNull();
      });
    });
  });

  describe('Schedule Details Formatting', () => {
    it('should format daily schedule times', async () => {
      const medicationWithDailySchedule = {
        ...baseMedication,
        scheduleFrequency: 'daily' as const,
      };

      const schedules = [
        { ...baseSchedule, time: '08:00' },
        { ...baseSchedule, id: 'schedule-2', time: '20:00' },
      ];

      renderWithTheme(
        <MedicationCard
          medication={medicationWithDailySchedule}
          type="preventative"
          schedules={schedules}
          onPress={mockOnPress}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/at 8:00:\d{2} AM, 8:00:\d{2} PM/)).toBeTruthy();
      });
    });

    it('should format monthly schedule last taken date', async () => {
      const medicationWithMonthlySchedule = {
        ...baseMedication,
        scheduleFrequency: 'monthly' as const,
      };

      const schedules = [
        { ...baseSchedule, time: '2024-01-15T10:00:00.000Z' },
      ];

      renderWithTheme(
        <MedicationCard
          medication={medicationWithMonthlySchedule}
          type="preventative"
          schedules={schedules}
          onPress={mockOnPress}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/— Last taken: Jan 15, 2024/)).toBeTruthy();
      });
    });

    it('should format quarterly schedule last taken date', async () => {
      const medicationWithQuarterlySchedule = {
        ...baseMedication,
        scheduleFrequency: 'quarterly' as const,
      };

      const schedules = [
        { ...baseSchedule, time: '2024-01-15T10:00:00.000Z' },
      ];

      renderWithTheme(
        <MedicationCard
          medication={medicationWithQuarterlySchedule}
          type="preventative"
          schedules={schedules}
          onPress={mockOnPress}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/— Last taken: Jan 15, 2024/)).toBeTruthy();
      });
    });

    it('should handle invalid time formats gracefully', async () => {
      const medicationWithDailySchedule = {
        ...baseMedication,
        scheduleFrequency: 'daily' as const,
      };

      const schedules = [
        { ...baseSchedule, time: 'invalid-time' },
      ];

      renderWithTheme(
        <MedicationCard
          medication={medicationWithDailySchedule}
          type="preventative"
          schedules={schedules}
          onPress={mockOnPress}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/at Invalid Date/)).toBeTruthy();
      });
    });

    it('should not show schedule details when no schedules provided', async () => {
      const medicationWithDailySchedule = {
        ...baseMedication,
        scheduleFrequency: 'daily' as const,
      };

      renderWithTheme(
        <MedicationCard
          medication={medicationWithDailySchedule}
          type="preventative"
          schedules={[]}
          onPress={mockOnPress}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Daily')).toBeTruthy();
      });
      
      // The text "Daily" appears on its own, no schedule details should be appended
      expect(screen.queryByText(/Daily at/)).toBeNull();
    });
  });

  describe('Notes Display', () => {
    it('should render medication notes when provided', async () => {
      const medicationWithNotes = {
        ...baseMedication,
        notes: 'Take with food to avoid stomach upset',
      };

      renderWithTheme(
        <MedicationCard
          medication={medicationWithNotes}
          type="rescue"
          onPress={mockOnPress}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Take with food to avoid stomach upset')).toBeTruthy();
      });
    });

    it('should not render notes section when notes are not provided', async () => {
      renderWithTheme(
        <MedicationCard
          medication={baseMedication}
          type="rescue"
          onPress={mockOnPress}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/Take with food/)).toBeNull();
      });
    });

    it('should limit notes to 2 lines with ellipsis', async () => {
      const medicationWithLongNotes = {
        ...baseMedication,
        notes: 'This is a very long note that should be truncated after two lines',
      };

      renderWithTheme(
        <MedicationCard
          medication={medicationWithLongNotes}
          type="rescue"
          onPress={mockOnPress}
          testID="medication-card"
        />
      );

      await waitFor(() => {
        const notesText = screen.getByText('This is a very long note that should be truncated after two lines');
        expect(notesText.props.numberOfLines).toBe(2);
        expect(notesText.props.ellipsizeMode).toBe('tail');
      });
    });
  });

  describe('Schedule Status (Daily Medications)', () => {
    it('should render schedule status for daily medications with schedules', async () => {
      const medicationWithDailySchedule = {
        ...baseMedication,
        scheduleFrequency: 'daily' as const,
      };

      const schedules = [baseSchedule];
      const scheduleLogStates: Record<string, ScheduleLogState> = {};

      renderWithTheme(
        <MedicationCard
          medication={medicationWithDailySchedule}
          type="preventative"
          schedules={schedules}
          scheduleLogStates={scheduleLogStates}
          onPress={mockOnPress}
          onScheduleLog={mockOnScheduleLog}
          onUndoLog={mockOnUndoLog}
          testID="medication-card"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('medication-card-schedule')).toBeTruthy();
      });
    });

    it('should not render schedule status when onScheduleLog is not provided', async () => {
      const medicationWithDailySchedule = {
        ...baseMedication,
        scheduleFrequency: 'daily' as const,
      };

      const schedules = [baseSchedule];

      renderWithTheme(
        <MedicationCard
          medication={medicationWithDailySchedule}
          type="preventative"
          schedules={schedules}
          onPress={mockOnPress}
          onUndoLog={mockOnUndoLog}
          testID="medication-card"
        />
      );

      await waitFor(() => {
        expect(screen.queryByTestId('medication-card-schedule')).toBeNull();
      });
    });

    it('should not render schedule status when onUndoLog is not provided', async () => {
      const medicationWithDailySchedule = {
        ...baseMedication,
        scheduleFrequency: 'daily' as const,
      };

      const schedules = [baseSchedule];

      renderWithTheme(
        <MedicationCard
          medication={medicationWithDailySchedule}
          type="preventative"
          schedules={schedules}
          onPress={mockOnPress}
          onScheduleLog={mockOnScheduleLog}
          testID="medication-card"
        />
      );

      await waitFor(() => {
        expect(screen.queryByTestId('medication-card-schedule')).toBeNull();
      });
    });

    it('should not render schedule status for non-daily medications', async () => {
      const medicationWithMonthlySchedule = {
        ...baseMedication,
        scheduleFrequency: 'monthly' as const,
      };

      const schedules = [baseSchedule];

      renderWithTheme(
        <MedicationCard
          medication={medicationWithMonthlySchedule}
          type="preventative"
          schedules={schedules}
          onPress={mockOnPress}
          onScheduleLog={mockOnScheduleLog}
          onUndoLog={mockOnUndoLog}
          testID="medication-card"
        />
      );

      await waitFor(() => {
        expect(screen.queryByTestId('medication-card-schedule')).toBeNull();
      });
    });

    it('should not render schedule status when no schedules provided', async () => {
      const medicationWithDailySchedule = {
        ...baseMedication,
        scheduleFrequency: 'daily' as const,
      };

      renderWithTheme(
        <MedicationCard
          medication={medicationWithDailySchedule}
          type="preventative"
          schedules={[]}
          onPress={mockOnPress}
          onScheduleLog={mockOnScheduleLog}
          onUndoLog={mockOnUndoLog}
          testID="medication-card"
        />
      );

      await waitFor(() => {
        expect(screen.queryByTestId('medication-card-schedule')).toBeNull();
      });
    });

    it('should pass correct props to MedicationScheduleStatus', async () => {
      const medicationWithDailySchedule = {
        ...baseMedication,
        scheduleFrequency: 'daily' as const,
      };

      const schedules = [baseSchedule];
      const scheduleLogStates: Record<string, ScheduleLogState> = {
        'med-1-schedule-1': { logged: true, doseId: 'dose-1' },
      };

      renderWithTheme(
        <MedicationCard
          medication={medicationWithDailySchedule}
          type="preventative"
          schedules={schedules}
          scheduleLogStates={scheduleLogStates}
          onPress={mockOnPress}
          onScheduleLog={mockOnScheduleLog}
          onUndoLog={mockOnUndoLog}
          showScheduleButtons={true}
          testID="medication-card"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('medication-card-schedule-logged-schedule-1')).toBeTruthy();
        expect(screen.getByTestId('medication-card-schedule-undo-schedule-1')).toBeTruthy();
      });

      // Test undo functionality
      fireEvent.press(screen.getByTestId('medication-card-schedule-undo-schedule-1'));
      expect(mockOnUndoLog).toHaveBeenCalledWith('med-1', 'schedule-1', 'dose-1');
    });
  });

  describe('Quick Actions (Rescue Medications)', () => {
    it('should render quick actions when showQuickActions is true and callbacks provided', async () => {
      renderWithTheme(
        <MedicationCard
          medication={baseMedication}
          type="rescue"
          onPress={mockOnPress}
          onQuickLog={mockOnQuickLog}
          onDetailedLog={mockOnDetailedLog}
          showQuickActions={true}
          testID="medication-card"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('medication-card-actions')).toBeTruthy();
        expect(screen.getByTestId('medication-card-actions-quick-log')).toBeTruthy();
        expect(screen.getByTestId('medication-card-actions-detailed-log')).toBeTruthy();
      });
    });

    it('should not render quick actions when showQuickActions is false', async () => {
      renderWithTheme(
        <MedicationCard
          medication={baseMedication}
          type="rescue"
          onPress={mockOnPress}
          onQuickLog={mockOnQuickLog}
          onDetailedLog={mockOnDetailedLog}
          showQuickActions={false}
          testID="medication-card"
        />
      );

      await waitFor(() => {
        expect(screen.queryByTestId('medication-card-actions')).toBeNull();
      });
    });

    it('should not render quick actions when onQuickLog is not provided', async () => {
      renderWithTheme(
        <MedicationCard
          medication={baseMedication}
          type="rescue"
          onPress={mockOnPress}
          onDetailedLog={mockOnDetailedLog}
          showQuickActions={true}
          testID="medication-card"
        />
      );

      await waitFor(() => {
        expect(screen.queryByTestId('medication-card-actions')).toBeNull();
      });
    });

    it('should not render quick actions when onDetailedLog is not provided', async () => {
      renderWithTheme(
        <MedicationCard
          medication={baseMedication}
          type="rescue"
          onPress={mockOnPress}
          onQuickLog={mockOnQuickLog}
          showQuickActions={true}
          testID="medication-card"
        />
      );

      await waitFor(() => {
        expect(screen.queryByTestId('medication-card-actions')).toBeNull();
      });
    });

    it('should trigger quick log with correct parameters', async () => {
      renderWithTheme(
        <MedicationCard
          medication={baseMedication}
          type="rescue"
          onPress={mockOnPress}
          onQuickLog={mockOnQuickLog}
          onDetailedLog={mockOnDetailedLog}
          showQuickActions={true}
          testID="medication-card"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('medication-card-actions-quick-log')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('medication-card-actions-quick-log'));
      expect(mockOnQuickLog).toHaveBeenCalledWith('med-1', 2);
    });

    it('should trigger detailed log with correct parameters', async () => {
      renderWithTheme(
        <MedicationCard
          medication={baseMedication}
          type="rescue"
          onPress={mockOnPress}
          onQuickLog={mockOnQuickLog}
          onDetailedLog={mockOnDetailedLog}
          showQuickActions={true}
          testID="medication-card"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('medication-card-actions-detailed-log')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('medication-card-actions-detailed-log'));
      expect(mockOnDetailedLog).toHaveBeenCalledWith('med-1');
    });
  });

  describe('Prop Variations', () => {
    it('should handle different medication types', async () => {
      const { rerender } = renderWithTheme(
        <MedicationCard
          medication={baseMedication}
          type="preventative"
          onPress={mockOnPress}
          testID="medication-card"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('medication-card-badges-type-badge')).toBeTruthy();
        expect(screen.getByText('preventative')).toBeTruthy();
      });

      rerender(
        <ThemeProvider>
          <MedicationCard
            medication={baseMedication}
            type="other"
            onPress={mockOnPress}
            testID="medication-card"
          />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('other')).toBeTruthy();
      });
    });

    it('should render category badge when category is provided', async () => {
      const medicationWithCategory = {
        ...baseMedication,
        category: 'nsaid' as const,
      };

      renderWithTheme(
        <MedicationCard
          medication={medicationWithCategory}
          type="rescue"
          onPress={mockOnPress}
          testID="medication-card"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('medication-card-badges-category-badge')).toBeTruthy();
        expect(screen.getByText('nsaid')).toBeTruthy();
      });
    });

    it('should use default values for optional props', async () => {
      renderWithTheme(
        <MedicationCard
          medication={baseMedication}
          type="rescue"
          onPress={mockOnPress}
        />
      );

      // Component should render without errors when optional props are not provided
      await waitFor(() => {
        expect(screen.getByText('Ibuprofen')).toBeTruthy();
      });
    });

    it('should pass testID to child components', async () => {
      renderWithTheme(
        <MedicationCard
          medication={baseMedication}
          type="rescue"
          onPress={mockOnPress}
          testID="test-medication-card"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('test-medication-card')).toBeTruthy();
        expect(screen.getByTestId('test-medication-card-badges')).toBeTruthy();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle medication with empty name', async () => {
      const medicationWithEmptyName = {
        ...baseMedication,
        name: '',
      };

      renderWithTheme(
        <MedicationCard
          medication={medicationWithEmptyName}
          type="rescue"
          onPress={mockOnPress}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('')).toBeTruthy(); // Empty name should still render
      });
    });

    it('should handle zero dosage amount', async () => {
      const medicationWithZeroDosage = {
        ...baseMedication,
        dosageAmount: 0,
      };

      const { formatMedicationDosage } = require('../../utils/medicationFormatting');

      renderWithTheme(
        <MedicationCard
          medication={medicationWithZeroDosage}
          type="rescue"
          onPress={mockOnPress}
        />
      );

      await waitFor(() => {
        expect(formatMedicationDosage).toHaveBeenCalledWith(2, 0, 'mg');
      });
    });

    it('should handle empty schedules array', async () => {
      const medicationWithDailySchedule = {
        ...baseMedication,
        scheduleFrequency: 'daily' as const,
      };

      renderWithTheme(
        <MedicationCard
          medication={medicationWithDailySchedule}
          type="preventative"
          schedules={[]}
          onPress={mockOnPress}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Daily')).toBeTruthy();
      });
      
      // The text "Daily" appears on its own, no schedule details should be appended
      expect(screen.queryByText(/Daily at/)).toBeNull();
    });

    it('should handle undefined scheduleLogStates', async () => {
      const medicationWithDailySchedule = {
        ...baseMedication,
        scheduleFrequency: 'daily' as const,
      };

      const schedules = [baseSchedule];

      renderWithTheme(
        <MedicationCard
          medication={medicationWithDailySchedule}
          type="preventative"
          schedules={schedules}
          scheduleLogStates={undefined}
          onPress={mockOnPress}
          onScheduleLog={mockOnScheduleLog}
          onUndoLog={mockOnUndoLog}
          testID="medication-card"
        />
      );

      // Should not crash and should still render
      await waitFor(() => {
        expect(screen.getByText('Ibuprofen')).toBeTruthy();
      });
    });
  });

  describe('Theme Support', () => {
    it('should render with theme context', async () => {
      renderWithTheme(
        <MedicationCard
          medication={baseMedication}
          type="rescue"
          onPress={mockOnPress}
          testID="themed-card"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('themed-card')).toBeTruthy();
      });
    });
  });
});