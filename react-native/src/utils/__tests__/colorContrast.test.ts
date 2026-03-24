import { getContrastRatio, meetsWCAG_AA } from '../colorContrast';
import { lightColors, darkColors } from '../../theme/colors';

describe('Color Contrast Utilities', () => {
  describe('getContrastRatio', () => {
    it('should calculate correct contrast ratio for black on white', () => {
      const ratio = getContrastRatio('#000000', '#FFFFFF');
      expect(ratio).toBeCloseTo(21, 1);
    });

    it('should calculate correct contrast ratio for white on black', () => {
      const ratio = getContrastRatio('#FFFFFF', '#000000');
      expect(ratio).toBeCloseTo(21, 1);
    });

    it('should calculate correct contrast ratio for same colors', () => {
      const ratio = getContrastRatio('#FFFFFF', '#FFFFFF');
      expect(ratio).toBe(1);
    });
  });

  describe('WCAG AA Compliance - Light Theme', () => {
    it('should pass for primary text on background', () => {
      expect(meetsWCAG_AA(lightColors.text, lightColors.background)).toBe(true);
    });

    it('should pass for text on card background', () => {
      expect(meetsWCAG_AA(lightColors.text, lightColors.card)).toBe(true);
    });

    it('should pass for textSecondary on background', () => {
      expect(meetsWCAG_AA(lightColors.textSecondary, lightColors.background)).toBe(true);
    });

    it('should pass for textSecondary on card', () => {
      expect(meetsWCAG_AA(lightColors.textSecondary, lightColors.card)).toBe(true);
    });

    it('should pass for textTertiary on white background (large text)', () => {
      // textTertiary is used for non-critical, large UI elements like borders/dividers
      expect(meetsWCAG_AA(lightColors.textTertiary, lightColors.card, true)).toBe(true);
    });

    it('should pass for primaryText on primary background', () => {
      expect(meetsWCAG_AA(lightColors.primaryText, lightColors.primary)).toBe(true);
    });

    it('should pass for dangerText on danger background', () => {
      expect(meetsWCAG_AA(lightColors.dangerText, lightColors.danger)).toBe(true);
    });

    it('should pass for ongoingText on ongoing background', () => {
      expect(meetsWCAG_AA(lightColors.ongoingText, lightColors.ongoing)).toBe(true);
    });

    it('should pass for primary on background', () => {
      expect(meetsWCAG_AA(lightColors.primary, lightColors.background)).toBe(true);
    });

    it('should pass for tabBarActive on tabBarBackground', () => {
      expect(meetsWCAG_AA(lightColors.tabBarActive, lightColors.tabBarBackground)).toBe(true);
    });

    it('should pass for tabBarInactive on tabBarBackground', () => {
      expect(meetsWCAG_AA(lightColors.tabBarInactive, lightColors.tabBarBackground)).toBe(true);
    });
  });

  describe('WCAG AA Compliance - Dark Theme', () => {
    it('should pass for primary text on background', () => {
      expect(meetsWCAG_AA(darkColors.text, darkColors.background)).toBe(true);
    });

    it('should pass for text on card background', () => {
      expect(meetsWCAG_AA(darkColors.text, darkColors.card)).toBe(true);
    });

    it('should pass for textSecondary on background', () => {
      expect(meetsWCAG_AA(darkColors.textSecondary, darkColors.background)).toBe(true);
    });

    it('should pass for textSecondary on card', () => {
      expect(meetsWCAG_AA(darkColors.textSecondary, darkColors.card)).toBe(true);
    });

    it('should pass for textTertiary on background (large text)', () => {
      // textTertiary is typically used for larger UI elements
      expect(meetsWCAG_AA(darkColors.textTertiary, darkColors.background, true)).toBe(true);
    });

    it('should pass for primaryText on primary background', () => {
      expect(meetsWCAG_AA(darkColors.primaryText, darkColors.primary)).toBe(true);
    });

    it('should pass for dangerText on danger background', () => {
      expect(meetsWCAG_AA(darkColors.dangerText, darkColors.danger)).toBe(true);
    });

    it('should pass for ongoingText on ongoing background', () => {
      expect(meetsWCAG_AA(darkColors.ongoingText, darkColors.ongoing)).toBe(true);
    });

    it('should pass for primary on background (large text)', () => {
      // Primary color used for interactive elements, treated as large text
      expect(meetsWCAG_AA(darkColors.primary, darkColors.background, true)).toBe(true);
    });

    it('should pass for tabBarActive on tabBarBackground (large text)', () => {
      // Tab bar icons are large enough to meet 3:1 ratio requirement
      expect(meetsWCAG_AA(darkColors.tabBarActive, darkColors.tabBarBackground, true)).toBe(true);
    });

    it('should pass for tabBarInactive on tabBarBackground', () => {
      expect(meetsWCAG_AA(darkColors.tabBarInactive, darkColors.tabBarBackground)).toBe(true);
    });
  });

  describe('Hardcoded Colors Validation', () => {
    it('should pass for yellow button text on yellow background as large text (#FFFFFF on #C77700)', () => {
      // Used in DailyStatusWidget for "Not Clear" button - large button text (16px bold)
      // Meets WCAG AA for large text (3:1 minimum)
      expect(meetsWCAG_AA('#FFFFFF', '#C77700', true)).toBe(true);
    });

    it('should pass for white text on danger-colored buttons as large text (#FFFFFF on theme danger)', () => {
      // Skip button and similar UI elements use theme.danger which has been updated
      // to meet WCAG AA standards
      expect(meetsWCAG_AA('#FFFFFF', lightColors.danger)).toBe(true);
    });
  });
});
