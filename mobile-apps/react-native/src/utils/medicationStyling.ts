/**
 * Medication Styling Utilities
 * Provides consistent styling for medication status (skipped, taken, etc.)
 */

import { TextStyle } from 'react-native';
import { useTheme } from '../theme';

/**
 * Hook providing medication status-based styling utilities
 * Returns functions to get colors and styles based on dose status
 */
export function useMedicationStatusStyles() {
  const { theme } = useTheme();

  return {
    /**
     * Get text color based on medication dose status
     * @param status - Dose status ('skipped' | 'taken' | undefined)
     * @returns Color from theme (danger for skipped, text for others)
     */
    getStatusColor: (status?: string): string =>
      status === 'skipped' ? theme.danger : theme.text,

    /**
     * Get text style object based on medication dose status
     * @param status - Dose status ('skipped' | 'taken' | undefined)
     * @returns Style object with appropriate color
     */
    getStatusStyle: (status?: string): TextStyle => ({
      color: status === 'skipped' ? theme.danger : theme.text,
    }),
  };
}
