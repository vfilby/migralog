import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { View, Text } from 'react-native';
import { useMedicationStatusStyles } from '../medicationStyling';
import { ThemeProvider } from '../../theme';

// Test component that uses the hook
const TestComponent = ({ status }: { status?: string }) => {
  const { getStatusColor, getStatusStyle } = useMedicationStatusStyles();
  const color = getStatusColor(status);
  const style = getStatusStyle(status);

  return (
    <View>
      <Text testID="color-output">{color}</Text>
      <Text testID="style-color-output">{String(style.color)}</Text>
    </View>
  );
};

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('medicationStyling', () => {
  describe('useMedicationStatusStyles', () => {
    it('should return danger color for skipped status', async () => {
      renderWithTheme(<TestComponent status="skipped" />);

      await waitFor(() => {
        const color = screen.getByTestId('color-output').props.children;

        // Should return a hex color (danger color)
        expect(color).toMatch(/^#[A-F0-9]{6}$/i);
        // In light theme, danger is '#D30F00' (updated for WCAG AA compliance)
        expect(color).toBe('#D30F00');
      });
    });

    it('should return text color for taken status', async () => {
      renderWithTheme(<TestComponent status="taken" />);

      await waitFor(() => {
        const color = screen.getByTestId('color-output').props.children;

        // Should return a hex color (text color)
        expect(color).toMatch(/^#[A-F0-9]{6}$/i);
        // In light theme, text is '#000000'
        expect(color).toBe('#000000');
      });
    });

    it('should return text color for undefined status', async () => {
      renderWithTheme(<TestComponent />);

      await waitFor(() => {
        const color = screen.getByTestId('color-output').props.children;

        // Should return a hex color (text color)
        expect(color).toMatch(/^#[A-F0-9]{6}$/i);
        expect(color).toBe('#000000');
      });
    });

    it('should return style object with danger color for skipped', async () => {
      renderWithTheme(<TestComponent status="skipped" />);

      await waitFor(() => {
        const styleColor = screen.getByTestId('style-color-output').props.children;

        expect(styleColor).toBe('#D30F00'); // danger color (updated for WCAG AA compliance)
      });
    });

    it('should return style object with text color for non-skipped', async () => {
      renderWithTheme(<TestComponent status="taken" />);

      await waitFor(() => {
        const styleColor = screen.getByTestId('style-color-output').props.children;

        expect(typeof styleColor).toBe('string');
        expect(styleColor).toMatch(/^#[A-F0-9]{6}$/i);
        expect(styleColor).toBe('#000000');
      });
    });
  });
});
