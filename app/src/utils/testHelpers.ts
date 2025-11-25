/**
 * Test Helpers - Safe Testing Utilities
 *
 * This file contains SAFE testing utilities that can be included in any build.
 * Dangerous database operations have been moved to devTestHelpers.ts which
 * is excluded from production builds.
 */

import { Alert } from 'react-native';

interface AlertButton {
  text?: string;
  onPress?: () => void | Promise<void>;
  style?: 'default' | 'cancel' | 'destructive';
}

/**
 * Alert Testing Utilities
 * Helpers for testing Alert.alert interactions in Jest tests
 * 
 * Usage example:
 * 
 * ```typescript
 * import { Alert } from 'react-native';
 * import { getLastAlert, pressAlertButton, expectAlert } from './testHelpers';
 * 
 * // Mock Alert in your test setup
 * jest.spyOn(Alert, 'alert').mockImplementation(() => {});
 * 
 * // In your test:
 * fireEvent.press(deleteButton);
 * 
 * // Verify the alert was shown
 * expectAlert('Confirm Delete', 'Are you sure?');
 * 
 * // Simulate pressing the "Delete" button
 * pressAlertButtonByText('Delete');
 * 
 * // Or press by index (0 = first button)
 * pressAlertButton(1); // Press second button
 * ```
 */

/**
 * Get the last Alert.alert call details
 * Returns the title, message, and buttons from the most recent Alert.alert call
 */
export function getLastAlert() {
  const alertMock = Alert.alert as jest.Mock;
  if (!alertMock.mock || alertMock.mock.calls.length === 0) {
    throw new Error('No Alert.alert calls found. Make sure Alert.alert is mocked.');
  }
  
  const lastCall = alertMock.mock.calls[alertMock.mock.calls.length - 1];
  const [title, message, buttons] = lastCall;
  
  return { title, message, buttons };
}

/**
 * Simulate pressing a button in the most recent Alert.alert
 * @param buttonIndex The index of the button to press (0 = first button, 1 = second, etc.)
 */
export function pressAlertButton(buttonIndex: number) {
  const { buttons } = getLastAlert();
  
  if (!buttons || !buttons[buttonIndex]) {
    throw new Error(`Button at index ${buttonIndex} not found. Available buttons: ${buttons?.length || 0}`);
  }
  
  const button = buttons[buttonIndex];
  if (button.onPress) {
    return button.onPress();
  }
  
  throw new Error(`Button at index ${buttonIndex} has no onPress handler`);
}

/**
 * Simulate pressing a button by its text
 * @param buttonText The text of the button to press
 */
export function pressAlertButtonByText(buttonText: string) {
  const { buttons } = getLastAlert();
  
  if (!buttons) {
    throw new Error('No buttons found in Alert');
  }
  
  const buttonIndex = buttons.findIndex((button: AlertButton) => button.text === buttonText);
  if (buttonIndex === -1) {
    const availableButtons = buttons.map((b: AlertButton) => b.text).join(', ');
    throw new Error(`Button with text "${buttonText}" not found. Available buttons: ${availableButtons}`);
  }
  
  return pressAlertButton(buttonIndex);
}

/**
 * Assert that an Alert was shown with specific title and/or message
 * @param expectedTitle Expected alert title (optional)
 * @param expectedMessage Expected alert message (optional)
 */
export function expectAlert(expectedTitle?: string, expectedMessage?: string) {
  const { title, message } = getLastAlert();
  
  if (expectedTitle !== undefined) {
    expect(title).toBe(expectedTitle);
  }
  
  if (expectedMessage !== undefined) {
    expect(message).toBe(expectedMessage);
  }
}

/**
 * Assert that an Alert was shown with specific button texts
 * @param expectedButtonTexts Array of expected button texts
 */
export function expectAlertButtons(expectedButtonTexts: string[]) {
  const { buttons } = getLastAlert();
  
  if (!buttons) {
    throw new Error('No buttons found in Alert');
  }
  
  const actualButtonTexts = buttons.map((button: AlertButton) => button.text);
  expect(actualButtonTexts).toEqual(expectedButtonTexts);
}

/**
 * Clear all Alert.alert mock calls
 * Useful for resetting state between tests
 */
export function clearAlertMocks() {
  const alertMock = Alert.alert as jest.Mock;
  if (alertMock.mockClear) {
    alertMock.mockClear();
  }
}

/**
 * Mock ULID for deterministic tests
 * Generates a valid ULID format with predictable values for testing
 */
export const mockUlid = (seed: number = 0): string => {
  // ULID format: 26 characters, Base32 encoded
  // First 10 chars: timestamp (48 bits)
  // Last 16 chars: randomness (80 bits)
  const timestamp = (1609459200000 + seed).toString(36).toUpperCase().padStart(10, '0');
  const random = seed.toString(36).toUpperCase().padStart(16, '0');
  return `${timestamp}${random}`.substring(0, 26);
};

// Re-export dangerous operations from devTestHelpers for development only
// These will only be available in __DEV__ mode
if (__DEV__) {
  // Dynamically import dangerous operations only in dev mode
  // This ensures they're never bundled in production
  const loadDevHelpers = async () => {
    const devHelpers = await import('./devTestHelpers');
    return devHelpers;
  };

  // Export a proxy that loads dev helpers on demand
  exports.getDevTestHelpers = loadDevHelpers;
}