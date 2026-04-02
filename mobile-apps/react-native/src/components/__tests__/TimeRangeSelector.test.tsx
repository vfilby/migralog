import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import TimeRangeSelector from '../analytics/TimeRangeSelector';
import { ThemeProvider } from '../../theme/ThemeContext';

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('TimeRangeSelector', () => {
  const mockOnRangeChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the component with testID', async () => {
      renderWithTheme(
        <TimeRangeSelector selectedRange={7} onRangeChange={mockOnRangeChange} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('time-range-selector')).toBeTruthy();
      });
    });

    it('should render all three time range buttons', async () => {
      renderWithTheme(
        <TimeRangeSelector selectedRange={7} onRangeChange={mockOnRangeChange} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('time-range-7')).toBeTruthy();
        expect(screen.getByTestId('time-range-30')).toBeTruthy();
        expect(screen.getByTestId('time-range-90')).toBeTruthy();
      });
    });

    it('should render button labels', async () => {
      renderWithTheme(
        <TimeRangeSelector selectedRange={7} onRangeChange={mockOnRangeChange} />
      );

      await waitFor(() => {
        expect(screen.getByText('7 Days')).toBeTruthy();
        expect(screen.getByText('30 Days')).toBeTruthy();
        expect(screen.getByText('90 Days')).toBeTruthy();
      });
    });
  });

  describe('Button Selection', () => {
    it('should mark selected button and others as not selected', async () => {
      renderWithTheme(
        <TimeRangeSelector selectedRange={7} onRangeChange={mockOnRangeChange} />
      );

      await waitFor(() => {
        const button7 = screen.getByTestId('time-range-7');
        const button30 = screen.getByTestId('time-range-30');
        const button90 = screen.getByTestId('time-range-90');

        expect(button7.props.accessibilityState?.selected).toBe(true);
        expect(button30.props.accessibilityState?.selected).toBe(false);
        expect(button90.props.accessibilityState?.selected).toBe(false);
      });
    });

    it('should update selection when different range selected', async () => {
      const { rerender } = renderWithTheme(
        <TimeRangeSelector selectedRange={7} onRangeChange={mockOnRangeChange} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('time-range-7').props.accessibilityState?.selected).toBe(true);
      });

      rerender(
        <ThemeProvider>
          <TimeRangeSelector selectedRange={30} onRangeChange={mockOnRangeChange} />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('time-range-30').props.accessibilityState?.selected).toBe(true);
        expect(screen.getByTestId('time-range-7').props.accessibilityState?.selected).toBe(false);
      });
    });
  });

  describe('User Interactions', () => {
    it('should call onRangeChange when buttons are pressed', async () => {
      renderWithTheme(
        <TimeRangeSelector selectedRange={7} onRangeChange={mockOnRangeChange} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('time-range-30')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('time-range-30'));
      expect(mockOnRangeChange).toHaveBeenCalledWith(30);

      fireEvent.press(screen.getByTestId('time-range-90'));
      expect(mockOnRangeChange).toHaveBeenCalledWith(90);

      expect(mockOnRangeChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility attributes', async () => {
      renderWithTheme(
        <TimeRangeSelector selectedRange={7} onRangeChange={mockOnRangeChange} />
      );

      await waitFor(() => {
        const button7 = screen.getByTestId('time-range-7');
        expect(button7.props.accessibilityRole).toBe('button');
        expect(button7.props.accessibilityLabel).toBe('Select 7 days time range');
        expect(button7.props.accessibilityHint).toBe('Currently selected');
      });
    });

    it('should have correct accessibility hints for non-selected buttons', async () => {
      renderWithTheme(
        <TimeRangeSelector selectedRange={7} onRangeChange={mockOnRangeChange} />
      );

      await waitFor(() => {
        const button30 = screen.getByTestId('time-range-30');
        expect(button30.props.accessibilityHint).toBe('Double tap to select this time range');
      });
    });
  });

  describe('Theme Support', () => {
    it('should render with theme context', async () => {
      renderWithTheme(
        <TimeRangeSelector selectedRange={7} onRangeChange={mockOnRangeChange} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('time-range-selector')).toBeTruthy();
      });
    });
  });
});
