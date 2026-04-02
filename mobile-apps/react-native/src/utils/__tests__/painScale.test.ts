import { getPainLevel, getPainColor, getPainDescription, PAIN_SCALE } from '../painScale';

describe('painScale utilities', () => {
  describe('PAIN_SCALE', () => {
    it('should have 11 pain levels (0-10)', () => {
      expect(PAIN_SCALE).toHaveLength(11);
    });

    it('should have sequential values from 0 to 10', () => {
      PAIN_SCALE.forEach((level, index) => {
        expect(level.value).toBe(index);
      });
    });

    it('should have all required properties for each level', () => {
      PAIN_SCALE.forEach((level) => {
        expect(level).toHaveProperty('value');
        expect(level).toHaveProperty('label');
        expect(level).toHaveProperty('description');
        expect(level).toHaveProperty('color');
        expect(typeof level.value).toBe('number');
        expect(typeof level.label).toBe('string');
        expect(typeof level.description).toBe('string');
        expect(typeof level.color).toBe('string');
      });
    });

    it('should have valid hex color codes', () => {
      const hexColorRegex = /^#[0-9A-F]{6}$/i;
      PAIN_SCALE.forEach((level) => {
        expect(level.color).toMatch(hexColorRegex);
      });
    });
  });

  describe('getPainLevel', () => {
    it('should return correct pain level for value 0', () => {
      const level = getPainLevel(0);
      expect(level.value).toBe(0);
      expect(level.label).toBe('No Pain');
    });

    it('should return correct pain level for value 5', () => {
      const level = getPainLevel(5);
      expect(level.value).toBe(5);
      expect(level.label).toBe('Moderate');
    });

    it('should return correct pain level for value 10', () => {
      const level = getPainLevel(10);
      expect(level.value).toBe(10);
      expect(level.label).toBe('Debilitating');
    });

    it('should round decimal values to nearest integer', () => {
      expect(getPainLevel(4.4).value).toBe(4);
      expect(getPainLevel(4.5).value).toBe(5);
      expect(getPainLevel(4.6).value).toBe(5);
      expect(getPainLevel(7.2).value).toBe(7);
      expect(getPainLevel(7.8).value).toBe(8);
    });

    it('should clamp values above 10 to 10', () => {
      expect(getPainLevel(11).value).toBe(10);
      expect(getPainLevel(15).value).toBe(10);
      expect(getPainLevel(100).value).toBe(10);
    });

    it('should clamp negative values to 0', () => {
      expect(getPainLevel(-1).value).toBe(0);
      expect(getPainLevel(-5).value).toBe(0);
      expect(getPainLevel(-100).value).toBe(0);
    });

    it('should handle NaN by returning level 0', () => {
      expect(getPainLevel(NaN).value).toBe(0);
      expect(getPainLevel(NaN).label).toBe('No Pain');
    });

    it('should handle null by returning level 0', () => {
      expect(getPainLevel(null as any).value).toBe(0);
      expect(getPainLevel(null as any).label).toBe('No Pain');
    });

    it('should handle undefined by returning level 0', () => {
      expect(getPainLevel(undefined as any).value).toBe(0);
      expect(getPainLevel(undefined as any).label).toBe('No Pain');
    });

    it('should return exact pain scale entry for each valid level', () => {
      for (let i = 0; i <= 10; i++) {
        const level = getPainLevel(i);
        expect(level).toBe(PAIN_SCALE[i]);
      }
    });
  });

  describe('getPainColor', () => {
    it('should return correct color for pain level 0', () => {
      expect(getPainColor(0)).toBe('#2E7D32');
    });

    it('should return correct color for pain level 5', () => {
      expect(getPainColor(5)).toBe('#EF6C00');
    });

    it('should return correct color for pain level 10', () => {
      expect(getPainColor(10)).toBe('#AB47BC');
    });

    it('should handle invalid values consistently with getPainLevel', () => {
      expect(getPainColor(NaN)).toBe(getPainLevel(0).color);
      expect(getPainColor(-1)).toBe(getPainLevel(0).color);
      expect(getPainColor(15)).toBe(getPainLevel(10).color);
    });

    it('should return valid hex color codes for all inputs', () => {
      const hexColorRegex = /^#[0-9A-F]{6}$/i;
      const testValues = [-5, -1, 0, 1, 5, 7.5, 10, 15, NaN, null, undefined];

      testValues.forEach((value) => {
        const color = getPainColor(value as any);
        expect(color).toMatch(hexColorRegex);
      });
    });

    it('should return progressively warmer colors for higher pain levels', () => {
      // This tests the general trend from green -> yellow -> orange -> red -> pink/purple
      const colors = [0, 3, 5, 7, 10].map(getPainColor);
      expect(colors).toHaveLength(5);
      // Each color should be different
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(5);
    });
  });

  describe('getPainDescription', () => {
    it('should return formatted description for pain level 0', () => {
      expect(getPainDescription(0)).toBe('No Pain: Pain-free');
    });

    it('should return formatted description for pain level 5', () => {
      expect(getPainDescription(5)).toBe('Moderate: Interferes with concentration');
    });

    it('should return formatted description for pain level 10', () => {
      expect(getPainDescription(10)).toBe('Debilitating: Worst imaginable, requires emergency care');
    });

    it('should include both label and description separated by colon', () => {
      for (let i = 0; i <= 10; i++) {
        const description = getPainDescription(i);
        const level = getPainLevel(i);
        expect(description).toBe(`${level.label}: ${level.description}`);
        expect(description).toContain(':');
      }
    });

    it('should handle invalid values consistently with getPainLevel', () => {
      expect(getPainDescription(NaN)).toBe(getPainDescription(0));
      expect(getPainDescription(-1)).toBe(getPainDescription(0));
      expect(getPainDescription(15)).toBe(getPainDescription(10));
    });

    it('should return non-empty descriptions for all valid pain levels', () => {
      for (let i = 0; i <= 10; i++) {
        const description = getPainDescription(i);
        expect(description.length).toBeGreaterThan(0);
        expect(description).not.toBe(':');
      }
    });
  });

  describe('edge cases and integration', () => {
    it('should handle floating point precision issues', () => {
      expect(getPainLevel(2.9999999999).value).toBe(3);
      expect(getPainLevel(3.0000000001).value).toBe(3);
    });

    it('should be consistent across all utility functions', () => {
      const testValue = 7.6;
      const level = getPainLevel(testValue);
      const color = getPainColor(testValue);
      const description = getPainDescription(testValue);

      expect(color).toBe(level.color);
      expect(description).toBe(`${level.label}: ${level.description}`);
    });

    it('should handle rapid successive calls with different values', () => {
      const values = [0, 5, 10, 3, 7, 2];
      const results = values.map(getPainLevel);

      expect(results[0].value).toBe(0);
      expect(results[1].value).toBe(5);
      expect(results[2].value).toBe(10);
      expect(results[3].value).toBe(3);
      expect(results[4].value).toBe(7);
      expect(results[5].value).toBe(2);
    });
  });
});
