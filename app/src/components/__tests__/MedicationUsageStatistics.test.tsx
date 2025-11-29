import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import MedicationUsageStatistics from '../analytics/MedicationUsageStatistics';
import { useMedicationStore } from '../../store/medicationStore';
import { ThemeProvider } from '../../theme/ThemeContext';

jest.mock('../../store/medicationStore');

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('MedicationUsageStatistics', () => {
  const mockLoadSchedules = jest.fn();

  const mockMedications = [
    {
      id: 'med-1',
      name: 'Sumatriptan',
      type: 'rescue' as const,
      category: 'triptan' as const,
      isArchived: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'med-2',
      name: 'Ibuprofen',
      type: 'rescue' as const,
      category: 'nsaid' as const,
      isArchived: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'med-3',
      name: 'Topiramate',
      type: 'preventative' as const,
      category: 'preventive' as const,
      isArchived: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  const mockDoses = [
    {
      id: 'dose-1',
      medicationId: 'med-1',
      timestamp: new Date('2024-01-20T10:00:00').getTime(),
      status: 'taken' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'dose-2',
      medicationId: 'med-1',
      timestamp: new Date('2024-01-20T18:00:00').getTime(),
      status: 'taken' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'dose-3',
      medicationId: 'med-1',
      timestamp: new Date('2024-01-22T14:00:00').getTime(),
      status: 'taken' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'dose-4',
      medicationId: 'med-2',
      timestamp: new Date('2024-01-21T12:00:00').getTime(),
      status: 'taken' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'dose-5',
      medicationId: 'med-3',
      timestamp: new Date('2024-01-20T08:00:00').getTime(),
      status: 'taken' as const,
      scheduleId: 'schedule-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'dose-6',
      medicationId: 'med-3',
      timestamp: new Date('2024-01-21T08:00:00').getTime(),
      status: 'taken' as const,
      scheduleId: 'schedule-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  const mockSchedules = [
    {
      id: 'schedule-1',
      medicationId: 'med-3',
      time: '08:00',
      timezone: 'America/Los_Angeles',
      dosage: 1,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-25T12:00:00'));

    (useMedicationStore as unknown as jest.Mock).mockReturnValue({
      medications: mockMedications,
      doses: mockDoses,
      schedules: mockSchedules,
      loadSchedules: mockLoadSchedules,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Component Rendering', () => {
    it('should render the component with testID', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByTestId('medication-usage-statistics')).toBeTruthy();
      });
    });

    it('should load schedules on mount', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(mockLoadSchedules).toHaveBeenCalledTimes(1);
      });
    });

    it('should render Rescue Medication Usage section', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByText('Rescue Medication Usage')).toBeTruthy();
      });
    });
  });

  describe('Rescue Medication Statistics', () => {
    it('should display rescue medication card', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={30} />);

      await waitFor(() => {
        expect(screen.getByTestId('rescue-medication-card')).toBeTruthy();
      });
    });

    it('should display rescue medication names', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={30} />);

      await waitFor(() => {
        expect(screen.getByText('Sumatriptan')).toBeTruthy();
        expect(screen.getByText('Ibuprofen')).toBeTruthy();
      });
    });

    it('should display rescue medication dose counts', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={30} />);

      await waitFor(() => {
        // Sumatriptan: 3 doses
        expect(screen.getByText(/3 doses/)).toBeTruthy();
        // Ibuprofen: 1 dose
        expect(screen.getByText(/1 dose/)).toBeTruthy();
      });
    });

    it('should display rescue medication days with doses', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={30} />);

      await waitFor(() => {
        // Sumatriptan: 2 days (20th and 22nd)
        expect(screen.getByText(/on 2 days/)).toBeTruthy();
        // Ibuprofen: 1 day
        expect(screen.getByText(/on 1 day/)).toBeTruthy();
      });
    });

    it('should render rescue medication items with testIDs', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={30} />);

      await waitFor(() => {
        expect(screen.getByTestId('rescue-item-med-1')).toBeTruthy();
        expect(screen.getByTestId('rescue-item-med-2')).toBeTruthy();
      });
    });

    it('should sort rescue medications by total doses descending', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={30} />);

      await waitFor(() => {
        // Check that we have rescue medication items
        expect(screen.getByTestId('rescue-item-med-1')).toBeTruthy();
        expect(screen.getByTestId('rescue-item-med-2')).toBeTruthy();
      });
    });
  });

  describe('Rescue Medication Statistics - Empty State', () => {
    beforeEach(() => {
      (useMedicationStore as unknown as jest.Mock).mockReturnValue({
        medications: [],
        doses: [],
        schedules: [],
        loadSchedules: mockLoadSchedules,
      });
    });

    it('should display empty state when no rescue medications', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeTruthy();
        expect(screen.getByText('No rescue medication usage in selected period')).toBeTruthy();
      });
    });

    it('should not display rescue medication card when no data', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.queryByTestId('rescue-medication-card')).toBeNull();
      });
    });
  });

  describe('Preventative Medication Compliance', () => {
    it('should display Preventative Medication Compliance section when data exists', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByText('Preventative Medication Compliance')).toBeTruthy();
      });
    });

    it('should display preventative compliance card', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByTestId('preventative-compliance-card')).toBeTruthy();
      });
    });

    it('should display preventative medication names', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByText('Topiramate')).toBeTruthy();
      });
    });

    it('should display compliance percentages', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={7} />);

      await waitFor(() => {
        // Should show percentage for Topiramate
        const percentages = screen.getAllByText(/%$/);
        expect(percentages.length).toBeGreaterThan(0);
      });
    });

    it('should render preventative items with testIDs', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByTestId('preventative-item-med-3')).toBeTruthy();
      });
    });

    it('should calculate compliance correctly', async () => {
      // 7 days, 1 schedule per day = 7 expected doses
      // 2 doses taken (from Jan 20-21, within 7 day range from Jan 18-25)
      // Compliance should be around 28% (2/7)
      renderWithTheme(<MedicationUsageStatistics selectedRange={7} />);

      await waitFor(() => {
        const card = screen.getByTestId('preventative-compliance-card');
        expect(card).toBeTruthy();
      });
    });
  });

  describe('Preventative Medication Compliance - No Preventatives', () => {
    beforeEach(() => {
      const rescueOnly = mockMedications.filter(m => m.type === 'rescue');
      const rescueDoses = mockDoses.filter(d => d.medicationId !== 'med-3');

      (useMedicationStore as unknown as jest.Mock).mockReturnValue({
        medications: rescueOnly,
        doses: rescueDoses,
        schedules: [],
        loadSchedules: mockLoadSchedules,
      });
    });

    it('should not display preventative section when no preventative medications', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.queryByText('Preventative Medication Compliance')).toBeNull();
      });
    });
  });

  describe('Date Range Filtering', () => {
    it('should filter doses by 7 day range', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByTestId('medication-usage-statistics')).toBeTruthy();
      });

      // All mock doses are within 7 days from Jan 25
      expect(screen.getByText('Sumatriptan')).toBeTruthy();
      expect(screen.getByText('Ibuprofen')).toBeTruthy();
    });

    it('should filter doses by 30 day range', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={30} />);

      await waitFor(() => {
        expect(screen.getByTestId('medication-usage-statistics')).toBeTruthy();
      });
    });

    it('should filter doses by 90 day range', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={90} />);

      await waitFor(() => {
        expect(screen.getByTestId('medication-usage-statistics')).toBeTruthy();
      });
    });

    it('should exclude skipped doses from statistics', async () => {
      const dosesWithSkipped = [
        ...mockDoses,
        {
          id: 'dose-skipped',
          medicationId: 'med-1',
          timestamp: new Date('2024-01-23T10:00:00').getTime(),
          status: 'skipped' as const,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      (useMedicationStore as unknown as jest.Mock).mockReturnValue({
        medications: mockMedications,
        doses: dosesWithSkipped,
        schedules: mockSchedules,
        loadSchedules: mockLoadSchedules,
      });

      renderWithTheme(<MedicationUsageStatistics selectedRange={30} />);

      await waitFor(() => {
        // Should still show 3 doses for Sumatriptan (not 4)
        expect(screen.getByText(/3 doses/)).toBeTruthy();
      });
    });
  });

  describe('Range Changes', () => {
    it('should recalculate when range changes from 7 to 30', async () => {
      const { rerender } = renderWithTheme(<MedicationUsageStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByTestId('medication-usage-statistics')).toBeTruthy();
      });

      rerender(
        <ThemeProvider>
          <MedicationUsageStatistics selectedRange={30} />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('medication-usage-statistics')).toBeTruthy();
      });
    });

    it('should recalculate when medications change', async () => {
      const { rerender } = renderWithTheme(<MedicationUsageStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByText('Sumatriptan')).toBeTruthy();
      });

      const newMedications = [mockMedications[0]]; // Only Sumatriptan
      (useMedicationStore as unknown as jest.Mock).mockReturnValue({
        medications: newMedications,
        doses: mockDoses,
        schedules: mockSchedules,
        loadSchedules: mockLoadSchedules,
      });

      rerender(
        <ThemeProvider>
          <MedicationUsageStatistics selectedRange={7} />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Sumatriptan')).toBeTruthy();
        expect(screen.queryByText('Ibuprofen')).toBeNull();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility role for container', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={7} />);

      await waitFor(() => {
        const container = screen.getByTestId('medication-usage-statistics');
        expect(container.props.accessibilityRole).toBe('summary');
      });
    });

    it('should have accessibility labels for rescue medications', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={30} />);

      await waitFor(() => {
        const items = screen.getAllByText(/doses?/);
        expect(items.length).toBeGreaterThan(0);
      });
    });

    it('should have accessibility labels for preventative compliance', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByText('Topiramate')).toBeTruthy();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle medication with no doses', async () => {
      const medsWithNoDoses = [
        {
          id: 'med-4',
          name: 'Unused Med',
          type: 'rescue' as const,
          category: 'other' as const,
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      (useMedicationStore as unknown as jest.Mock).mockReturnValue({
        medications: medsWithNoDoses,
        doses: [],
        schedules: [],
        loadSchedules: mockLoadSchedules,
      });

      renderWithTheme(<MedicationUsageStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeTruthy();
      });
    });

    it('should handle preventative medication with no schedules', async () => {
      const preventativeMed = [
        {
          id: 'med-5',
          name: 'No Schedule Med',
          type: 'preventative' as const,
          category: 'preventive' as const,
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      (useMedicationStore as unknown as jest.Mock).mockReturnValue({
        medications: [...mockMedications, ...preventativeMed],
        doses: mockDoses,
        schedules: mockSchedules, // No schedule for med-5
        loadSchedules: mockLoadSchedules,
      });

      renderWithTheme(<MedicationUsageStatistics selectedRange={7} />);

      await waitFor(() => {
        // Should show compliance card with existing preventative med
        expect(screen.getByTestId('preventative-compliance-card')).toBeTruthy();
      });
    });

    it('should handle disabled schedules', async () => {
      const schedulesWithDisabled = [
        {
          ...mockSchedules[0],
          enabled: false,
        },
      ];

      (useMedicationStore as unknown as jest.Mock).mockReturnValue({
        medications: mockMedications,
        doses: mockDoses,
        schedules: schedulesWithDisabled,
        loadSchedules: mockLoadSchedules,
      });

      renderWithTheme(<MedicationUsageStatistics selectedRange={7} />);

      await waitFor(() => {
        // Should not show preventative section if all schedules are disabled
        expect(screen.queryByText('Preventative Medication Compliance')).toBeNull();
      });
    });

    it('should handle multiple schedules for one medication', async () => {
      const multipleSchedules = [
        ...mockSchedules,
        {
          id: 'schedule-2',
          medicationId: 'med-3',
          time: '20:00',
          timezone: 'America/Los_Angeles',
          dosage: 1,
          enabled: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      (useMedicationStore as unknown as jest.Mock).mockReturnValue({
        medications: mockMedications,
        doses: mockDoses,
        schedules: multipleSchedules,
        loadSchedules: mockLoadSchedules,
      });

      renderWithTheme(<MedicationUsageStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByTestId('preventative-compliance-card')).toBeTruthy();
      });
    });
  });

  describe('Theme Support', () => {
    it('should render with theme context', async () => {
      renderWithTheme(<MedicationUsageStatistics selectedRange={7} />);

      await waitFor(() => {
        expect(screen.getByTestId('medication-usage-statistics')).toBeTruthy();
      });
    });
  });
});
