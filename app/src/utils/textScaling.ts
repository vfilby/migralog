/**
 * Text Scaling Utilities for Dynamic Type Support
 *
 * React Native supports dynamic text sizing out of the box through:
 * 1. The `allowFontScaling` prop on Text components (defaults to true)
 * 2. The system's accessibility settings (iOS: Dynamic Type, Android: Font Size)
 *
 * This file provides utilities to ensure consistent text scaling across the app.
 */

import { PixelRatio, Platform } from 'react-native';

/**
 * Get the font scale factor from the device's accessibility settings
 * This is automatically applied by React Native's Text component when allowFontScaling is true
 */
export function getFontScale(): number {
  return PixelRatio.getFontScale();
}

/**
 * Check if large text mode is enabled (font scale > 1.0)
 */
export function isLargeTextModeEnabled(): boolean {
  return getFontScale() > 1.0;
}

/**
 * Get the effective font size after applying the system's font scale
 * @param baseFontSize - The base font size in pixels
 * @returns The scaled font size
 */
export function getScaledFontSize(baseFontSize: number): number {
  return baseFontSize * getFontScale();
}

/**
 * Platform-specific maximum font scale factors
 * iOS supports up to 7 accessibility sizes (largest: ~310% of base)
 * Android supports similar scaling through system settings
 */
export const MAX_FONT_SCALE = Platform.select({
  ios: 3.1,
  android: 2.0,
  default: 2.0,
});

/**
 * Best practices for dynamic text sizing:
 *
 * 1. Always allow font scaling (default behavior)
 * 2. Use relative units (em, rem equivalents) instead of fixed pixel sizes
 * 3. Test with different font sizes (iOS: Settings > Accessibility > Display & Text Size > Larger Text)
 * 4. Ensure UI layouts adapt to larger text (use flexbox, avoid fixed heights)
 * 5. For critical small text (e.g., legal disclaimers), consider `allowFontScaling={false}` sparingly
 * 6. Minimum touch target sizes should remain 44x44 points regardless of text size
 */
