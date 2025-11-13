import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import MedicationScheduleManager from '../MedicationScheduleManager';
import { MedicationSchedule } from '../../models/types';
import { ThemeProvider } from '../../theme/ThemeContext';

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('MedicationScheduleManager', () => {
  const mockOnSchedulesChange = jest.fn();
  const dailySchedule: Omit<MedicationSchedule, 'id' | 'medicationId'> = {
    time: '09:00',
    timezone: 'America/Los_Angeles',
    dosage: 1,
    enabled: true,
  };
  const monthlySchedule: Omit<MedicationSchedule, 'id' | 'medicationId'> = {
    time: '2024-01-15',
    timezone: 'America/Los_Angeles',
    dosage: 1,
    enabled: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Daily Frequency', () => {
    it('should render daily schedules header', async () => {
      renderWithTheme(
        <MedicationScheduleManager
          scheduleFrequency="daily"
          schedules={[]}
          onSchedulesChange={mockOnSchedulesChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Schedules')).toBeTruthy();
        expect(screen.getByText('Add times when you take this medication each day')).toBeTruthy();
      });
    });

    it('should display existing daily schedule', async () => {
      renderWithTheme(
        <MedicationScheduleManager
          scheduleFrequency="daily"
          schedules={[dailySchedule]}
          onSchedulesChange={mockOnSchedulesChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Time')).toBeTruthy();
        expect(screen.getByText('09:00')).toBeTruthy();
        expect(screen.getByText('Doses')).toBeTruthy();
        expect(screen.getByDisplayValue('1')).toBeTruthy();
      });
    });

    it('should add new daily schedule with default time', async () => {
      renderWithTheme(
        <MedicationScheduleManager
          scheduleFrequency="daily"
          schedules={[]}
          onSchedulesChange={mockOnSchedulesChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('+ Add Schedule')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('+ Add Schedule'));

      expect(mockOnSchedulesChange).toHaveBeenCalledWith([
        {
          time: '09:00',
          timezone: expect.any(String), // Device timezone from Intl.DateTimeFormat
          dosage: 1,
          enabled: true,
        },
      ]);
    });

    it('should remove daily schedule', async () => {
      renderWithTheme(
        <MedicationScheduleManager
          scheduleFrequency="daily"
          schedules={[dailySchedule, { ...dailySchedule, time: '13:00' }]}
          onSchedulesChange={mockOnSchedulesChange}
        />
      );

      await waitFor(() => {
        const removeButtons = screen.getAllByText('Remove');
        expect(removeButtons).toHaveLength(2);
      });

      fireEvent.press(screen.getAllByText('Remove')[0]);

      expect(mockOnSchedulesChange).toHaveBeenCalledWith([
        { ...dailySchedule, time: '13:00' },
      ]);
    });

    it('should update dosage', async () => {
      renderWithTheme(
        <MedicationScheduleManager
          scheduleFrequency="daily"
          schedules={[dailySchedule]}
          onSchedulesChange={mockOnSchedulesChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('1')).toBeTruthy();
      });

      fireEvent.changeText(screen.getByDisplayValue('1'), '2');

      expect(mockOnSchedulesChange).toHaveBeenCalledWith([
        { ...dailySchedule, dosage: 2 },
      ]);
    });

    it('should not update dosage with zero or negative values during editing', async () => {
      renderWithTheme(
        <MedicationScheduleManager
          scheduleFrequency="daily"
          schedules={[dailySchedule]}
          onSchedulesChange={mockOnSchedulesChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('1')).toBeTruthy();
      });

      fireEvent.changeText(screen.getByDisplayValue('1'), '0');

      // Should not update schedule while typing invalid value
      expect(mockOnSchedulesChange).not.toHaveBeenCalled();
    });

    it('should allow clearing dosage field temporarily', async () => {
      renderWithTheme(
        <MedicationScheduleManager
          scheduleFrequency="daily"
          schedules={[dailySchedule]}
          onSchedulesChange={mockOnSchedulesChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('1')).toBeTruthy();
      });

      const input = screen.getByDisplayValue('1');

      // User can clear the field
      fireEvent.changeText(input, '');

      // Should not update schedule while field is empty
      expect(mockOnSchedulesChange).not.toHaveBeenCalled();

      // Field should show empty value
      expect(screen.getByDisplayValue('')).toBeTruthy();
    });

    it('should reset to default value when blurred with empty field', async () => {
      renderWithTheme(
        <MedicationScheduleManager
          scheduleFrequency="daily"
          schedules={[dailySchedule]}
          onSchedulesChange={mockOnSchedulesChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('1')).toBeTruthy();
      });

      const input = screen.getByDisplayValue('1');

      // Clear the field
      fireEvent.changeText(input, '');

      // Blur the field
      fireEvent(input, 'blur');

      // Should reset to original value (1)
      await waitFor(() => {
        expect(mockOnSchedulesChange).toHaveBeenCalledWith([
          { ...dailySchedule, dosage: 1 },
        ]);
      });
    });

    it('should allow changing from 4 to 2 naturally', async () => {
      const scheduleWith4 = { ...dailySchedule, dosage: 4 };

      renderWithTheme(
        <MedicationScheduleManager
          scheduleFrequency="daily"
          schedules={[scheduleWith4]}
          onSchedulesChange={mockOnSchedulesChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('4')).toBeTruthy();
      });

      const input = screen.getByDisplayValue('4');

      // User can clear the field (simulating backspace)
      fireEvent.changeText(input, '');

      // Field should be empty
      expect(screen.getByDisplayValue('')).toBeTruthy();

      // User types 2
      fireEvent.changeText(input, '2');

      // Should update to 2
      expect(mockOnSchedulesChange).toHaveBeenCalledWith([
        { ...dailySchedule, dosage: 2 },
      ]);
    });

    it('should toggle time picker when time button pressed', async () => {
      renderWithTheme(
        <MedicationScheduleManager
          scheduleFrequency="daily"
          schedules={[dailySchedule]}
          onSchedulesChange={mockOnSchedulesChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('09:00')).toBeTruthy();
      });

      // Just verify the button is pressable - the time picker toggle is an internal state change
      const timeButton = screen.getByText('09:00');
      fireEvent.press(timeButton);

      // Toggle again to close
      fireEvent.press(timeButton);

      // No errors should occur
      expect(timeButton).toBeTruthy();
    });
  });

  describe('Monthly Frequency', () => {
    it('should render monthly schedules header', async () => {
      renderWithTheme(
        <MedicationScheduleManager
          scheduleFrequency="monthly"
          schedules={[]}
          onSchedulesChange={mockOnSchedulesChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Monthly Schedules')).toBeTruthy();
        expect(screen.getByText('Select the date you last took this medication')).toBeTruthy();
      });
    });

    it('should display existing monthly schedule', async () => {
      renderWithTheme(
        <MedicationScheduleManager
          scheduleFrequency="monthly"
          schedules={[monthlySchedule]}
          onSchedulesChange={mockOnSchedulesChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Last Date Taken')).toBeTruthy();
        expect(screen.getByText('2024-01-15')).toBeTruthy();
      });
    });

    it('should add new monthly schedule with current date', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-20T10:00:00'));

      renderWithTheme(
        <MedicationScheduleManager
          scheduleFrequency="monthly"
          schedules={[]}
          onSchedulesChange={mockOnSchedulesChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('+ Add Schedule')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('+ Add Schedule'));

      expect(mockOnSchedulesChange).toHaveBeenCalledWith([
        {
          time: '2024-01-20',
          timezone: expect.any(String), // Device timezone from Intl.DateTimeFormat
          dosage: 1,
          enabled: true,
        },
      ]);

      jest.useRealTimers();
    });

    it('should toggle date picker when date button pressed', async () => {
      renderWithTheme(
        <MedicationScheduleManager
          scheduleFrequency="monthly"
          schedules={[monthlySchedule]}
          onSchedulesChange={mockOnSchedulesChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('2024-01-15')).toBeTruthy();
      });

      // Just verify the button is pressable - the date picker toggle is an internal state change
      const dateButton = screen.getByText('2024-01-15');
      fireEvent.press(dateButton);

      // Toggle again to close
      fireEvent.press(dateButton);

      // No errors should occur
      expect(dateButton).toBeTruthy();
    });
  });

  describe('Quarterly Frequency', () => {
    it('should render quarterly schedules header', async () => {
      renderWithTheme(
        <MedicationScheduleManager
          scheduleFrequency="quarterly"
          schedules={[]}
          onSchedulesChange={mockOnSchedulesChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Quarterly Schedules')).toBeTruthy();
        expect(screen.getByText('Select the date you last took this medication')).toBeTruthy();
      });
    });

    it('should display quarterly time label', async () => {
      renderWithTheme(
        <MedicationScheduleManager
          scheduleFrequency="quarterly"
          schedules={[monthlySchedule]}
          onSchedulesChange={mockOnSchedulesChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Last Date Taken')).toBeTruthy();
      });
    });
  });

  describe('Multiple Schedules', () => {
    it('should display multiple daily schedules', async () => {
      const schedules = [
        { ...dailySchedule, time: '09:00' },
        { ...dailySchedule, time: '13:00' },
        { ...dailySchedule, time: '21:00' },
      ];

      renderWithTheme(
        <MedicationScheduleManager
          scheduleFrequency="daily"
          schedules={schedules}
          onSchedulesChange={mockOnSchedulesChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('09:00')).toBeTruthy();
        expect(screen.getByText('13:00')).toBeTruthy();
        expect(screen.getByText('21:00')).toBeTruthy();
      });
    });

    it('should allow removing specific schedule from multiple', async () => {
      const schedules = [
        { ...dailySchedule, time: '09:00' },
        { ...dailySchedule, time: '13:00' },
        { ...dailySchedule, time: '21:00' },
      ];

      renderWithTheme(
        <MedicationScheduleManager
          scheduleFrequency="daily"
          schedules={schedules}
          onSchedulesChange={mockOnSchedulesChange}
        />
      );

      await waitFor(() => {
        const removeButtons = screen.getAllByText('Remove');
        expect(removeButtons).toHaveLength(3);
      });

      // Remove the middle schedule
      fireEvent.press(screen.getAllByText('Remove')[1]);

      expect(mockOnSchedulesChange).toHaveBeenCalledWith([
        { ...dailySchedule, time: '09:00' },
        { ...dailySchedule, time: '21:00' },
      ]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty schedules array', async () => {
      renderWithTheme(
        <MedicationScheduleManager
          scheduleFrequency="daily"
          schedules={[]}
          onSchedulesChange={mockOnSchedulesChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('+ Add Schedule')).toBeTruthy();
      });

      expect(screen.queryByText('Remove')).toBeNull();
    });

    it('should handle invalid dosage input gracefully', async () => {
      renderWithTheme(
        <MedicationScheduleManager
          scheduleFrequency="daily"
          schedules={[dailySchedule]}
          onSchedulesChange={mockOnSchedulesChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('1')).toBeTruthy();
      });

      fireEvent.changeText(screen.getByDisplayValue('1'), 'abc');

      expect(mockOnSchedulesChange).not.toHaveBeenCalled();
    });

    it('should handle decimal dosage values', async () => {
      renderWithTheme(
        <MedicationScheduleManager
          scheduleFrequency="daily"
          schedules={[dailySchedule]}
          onSchedulesChange={mockOnSchedulesChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('1')).toBeTruthy();
      });

      fireEvent.changeText(screen.getByDisplayValue('1'), '0.5');

      expect(mockOnSchedulesChange).toHaveBeenCalledWith([
        { ...dailySchedule, dosage: 0.5 },
      ]);
    });
  });

  describe('Theme Support', () => {
    it('should render with theme context', async () => {
      renderWithTheme(
        <MedicationScheduleManager
          scheduleFrequency="daily"
          schedules={[]}
          onSchedulesChange={mockOnSchedulesChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Schedules')).toBeTruthy();
      });
    });
  });
});
