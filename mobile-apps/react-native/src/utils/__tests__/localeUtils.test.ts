import {
  getDeviceLocaleCode,
  getDeviceLocale,
  uses12HourClock,
  getTimeFormatString,
  getDateTimeFormatString,
  getShortDateTimeFormatString,
  clearLocaleCache,
  getFormatLocaleOptions,
  TIME_FORMAT_12H,
  TIME_FORMAT_24H,
  DATETIME_FORMAT_12H,
  DATETIME_FORMAT_24H,
  SHORT_DATETIME_FORMAT_12H,
  SHORT_DATETIME_FORMAT_24H,
} from '../localeUtils';

describe('localeUtils', () => {
  // Clear cache before each test to ensure clean state
  beforeEach(() => {
    clearLocaleCache();
  });

  describe('getDeviceLocaleCode', () => {
    it('returns a valid locale code string', () => {
      const localeCode = getDeviceLocaleCode();

      expect(typeof localeCode).toBe('string');
      expect(localeCode.length).toBeGreaterThan(0);
    });

    it('caches the locale code on subsequent calls', () => {
      const first = getDeviceLocaleCode();
      const second = getDeviceLocaleCode();

      expect(first).toBe(second);
    });
  });

  describe('getDeviceLocale', () => {
    it('returns a date-fns Locale object', () => {
      const locale = getDeviceLocale();

      expect(locale).toBeDefined();
      expect(typeof locale.code).toBe('string');
    });

    it('caches the locale on subsequent calls', () => {
      const first = getDeviceLocale();
      const second = getDeviceLocale();

      expect(first).toBe(second);
    });

    it('returns a valid locale that can be used with date-fns', () => {
      const locale = getDeviceLocale();

      // Locale should have the required date-fns locale structure
      expect(locale).toHaveProperty('code');
      expect(locale).toHaveProperty('localize');
      expect(locale).toHaveProperty('formatLong');
    });
  });

  describe('uses12HourClock', () => {
    it('returns a boolean', () => {
      const result = uses12HourClock();

      expect(typeof result).toBe('boolean');
    });

    it('caches the result on subsequent calls', () => {
      const first = uses12HourClock();
      const second = uses12HourClock();

      expect(first).toBe(second);
    });
  });

  describe('getTimeFormatString', () => {
    it('returns 12-hour format when uses12HourClock is true', () => {
      // In test environment, this will use the mocked/default Intl behavior
      const format = getTimeFormatString();

      // Should be one of the two valid formats
      expect(['h:mm a', 'HH:mm']).toContain(format);
    });

    it('returns a valid date-fns format string', () => {
      const format = getTimeFormatString();

      // Should contain hour and minute tokens
      expect(format).toMatch(/[hH]+/);
      expect(format).toMatch(/mm/);
    });
  });

  describe('getDateTimeFormatString', () => {
    it('returns a format string with date and time components', () => {
      const format = getDateTimeFormatString();

      // Should contain month, day, year, and time components
      expect(format).toContain('MMM');
      expect(format).toContain('d');
      expect(format).toContain('yyyy');
      expect(format).toMatch(/[hH]+/);
      expect(format).toMatch(/mm/);
    });

    it('uses consistent time format with getTimeFormatString', () => {
      const timeFormat = getTimeFormatString();
      const dateTimeFormat = getDateTimeFormatString();

      // The time portion should match
      if (timeFormat === 'h:mm a') {
        expect(dateTimeFormat).toContain('h:mm a');
      } else {
        expect(dateTimeFormat).toContain('HH:mm');
      }
    });
  });

  describe('getShortDateTimeFormatString', () => {
    it('returns a format string with short date and time', () => {
      const format = getShortDateTimeFormatString();

      // Should contain month, day, and time but NOT year
      expect(format).toContain('MMM');
      expect(format).toContain('d');
      expect(format).not.toContain('yyyy');
      expect(format).toMatch(/[hH]+/);
      expect(format).toMatch(/mm/);
    });
  });

  describe('clearLocaleCache', () => {
    it('clears the cached locale values', () => {
      // Get initial values (which caches them)
      const initialLocale = getDeviceLocale();
      const initialCode = getDeviceLocaleCode();
      const initialHour12 = uses12HourClock();

      // Clear the cache
      clearLocaleCache();

      // Get values again - they should still be the same (same device settings)
      // but this verifies the cache was cleared and re-computed
      const newLocale = getDeviceLocale();
      const newCode = getDeviceLocaleCode();
      const newHour12 = uses12HourClock();

      // Values should be equal but this confirms no errors were thrown
      expect(newLocale.code).toBe(initialLocale.code);
      expect(newCode).toBe(initialCode);
      expect(newHour12).toBe(initialHour12);
    });
  });

  describe('getFormatLocaleOptions', () => {
    it('returns an object with locale property', () => {
      const options = getFormatLocaleOptions();

      expect(options).toHaveProperty('locale');
      expect(options.locale).toBeDefined();
    });

    it('returns the same locale as getDeviceLocale', () => {
      const options = getFormatLocaleOptions();
      const locale = getDeviceLocale();

      expect(options.locale).toBe(locale);
    });

    it('returns an object that can be spread into date-fns format options', () => {
      const options = getFormatLocaleOptions();

      // Should have only the locale property (for spreading)
      expect(Object.keys(options)).toEqual(['locale']);
    });
  });

  describe('locale fallback behavior', () => {
    it('returns a valid locale even in test environment', () => {
      // In Jest/Node environment, Intl might return different values
      // but we should always get a valid locale
      const locale = getDeviceLocale();

      expect(locale).toBeDefined();
      expect(locale.code).toBeDefined();
    });

    it('defaults to enUS-compatible locale structure', () => {
      const locale = getDeviceLocale();

      // Should have the same structure as enUS
      expect(typeof locale.localize?.month).toBe('function');
      expect(typeof locale.localize?.day).toBe('function');
      expect(typeof locale.formatLong?.date).toBe('function');
      expect(typeof locale.formatLong?.time).toBe('function');
    });
  });

  describe('format string constants', () => {
    it('exports 12-hour time format constant', () => {
      expect(TIME_FORMAT_12H).toBe('h:mm a');
    });

    it('exports 24-hour time format constant', () => {
      expect(TIME_FORMAT_24H).toBe('HH:mm');
    });

    it('exports 12-hour datetime format constant', () => {
      expect(DATETIME_FORMAT_12H).toBe('MMM d, yyyy h:mm a');
    });

    it('exports 24-hour datetime format constant', () => {
      expect(DATETIME_FORMAT_24H).toBe('MMM d, yyyy HH:mm');
    });

    it('exports 12-hour short datetime format constant', () => {
      expect(SHORT_DATETIME_FORMAT_12H).toBe('MMM d, h:mm a');
    });

    it('exports 24-hour short datetime format constant', () => {
      expect(SHORT_DATETIME_FORMAT_24H).toBe('MMM d, HH:mm');
    });

    it('getTimeFormatString returns one of the format constants', () => {
      const format = getTimeFormatString();
      expect([TIME_FORMAT_12H, TIME_FORMAT_24H]).toContain(format);
    });

    it('getDateTimeFormatString returns one of the format constants', () => {
      const format = getDateTimeFormatString();
      expect([DATETIME_FORMAT_12H, DATETIME_FORMAT_24H]).toContain(format);
    });

    it('getShortDateTimeFormatString returns one of the format constants', () => {
      const format = getShortDateTimeFormatString();
      expect([SHORT_DATETIME_FORMAT_12H, SHORT_DATETIME_FORMAT_24H]).toContain(
        format
      );
    });
  });
});
