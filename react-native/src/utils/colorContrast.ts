/**
 * Color contrast utilities for WCAG AA compliance
 * WCAG AA requires:
 * - Normal text (< 18pt or < 14pt bold): 4.5:1 contrast ratio
 * - Large text (>= 18pt or >= 14pt bold): 3:1 contrast ratio
 */

import { logger } from './logger';

/**
 * Convert hex color to RGB
 * @param hex - Hex color string (e.g., "#FF0000" or "FF0000")
 * @returns RGB object or null if invalid
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Validate input type
  if (typeof hex !== 'string') {
    logger.warn('[colorContrast] Invalid hex color type:', typeof hex);
    return null;
  }

  // Validate hex format
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    logger.warn('[colorContrast] Invalid hex color format:', hex);
    return null;
  }

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Calculate relative luminance of a color
 * https://www.w3.org/TR/WCAG20-TECHS/G17.html
 * @param hex - Hex color string
 * @returns Luminance value (0-1), or 0 if invalid color
 */
function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    logger.warn('[colorContrast] Cannot calculate luminance for invalid color:', hex);
    return 0;
  }

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((val) => {
    const sRGB = val / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 * https://www.w3.org/TR/WCAG20-TECHS/G17.html
 * @param foreground - Foreground color (hex string)
 * @param background - Background color (hex string)
 * @returns Contrast ratio (1-21), or 1 if either color is invalid
 */
export function getContrastRatio(foreground: string, background: string): number {
  const L1 = getLuminance(foreground);
  const L2 = getLuminance(background);

  // If either color is invalid, getLuminance returns 0
  // Return minimum contrast ratio of 1 as a safe fallback
  if (L1 === 0 && L2 === 0) {
    logger.warn('[colorContrast] Both colors invalid, returning minimum contrast ratio');
    return 1;
  }

  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if color combination meets WCAG AA standards
 * @param foreground - Foreground color (text)
 * @param background - Background color
 * @param isLargeText - Whether the text is large (>= 18pt or >= 14pt bold)
 * @returns true if the contrast ratio meets WCAG AA standards
 */
export function meetsWCAG_AA(
  foreground: string,
  background: string,
  isLargeText = false
): boolean {
  const ratio = getContrastRatio(foreground, background);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Check if color combination meets WCAG AAA standards
 * @param foreground - Foreground color (text)
 * @param background - Background color
 * @param isLargeText - Whether the text is large (>= 18pt or >= 14pt bold)
 * @returns true if the contrast ratio meets WCAG AAA standards
 */
export function meetsWCAG_AAA(
  foreground: string,
  background: string,
  isLargeText = false
): boolean {
  const ratio = getContrastRatio(foreground, background);
  return isLargeText ? ratio >= 4.5 : ratio >= 7;
}
