import {
  formatEpisodeTimeRange,
  formatEpisodeDuration,
  formatDurationLong,
  formatRelativeDate,
  formatTime,
  formatDateTime,
  uses12HourClock,
  toLocalDateString,
  toLocalDateStringOffset,
  localDateTimeFromStrings,
  formatTimeUntil,
} from '../dateFormatting';

// Mock the localeUtils module to ensure consistent test behavior
// Tests expect 12-hour format (US locale)
jest.mock('../localeUtils', () =>
  require('../testUtils/localeUtilsMock').createUSLocaleMock()
);

describe('formatEpisodeTimeRange', () => {
  const targetDate = '2024-01-15';

  describe('same-day episodes', () => {
    it('shows just times when start and end are on target date', () => {
      const start = new Date('2024-01-15T10:00:00').getTime();
      const end = new Date('2024-01-15T14:30:00').getTime();

      const result = formatEpisodeTimeRange(start, end, targetDate);

      expect(result).toBe('10:00 AM - 2:30 PM');
    });
  });

  describe('multi-day episodes', () => {
    it('shows date for start when start is before target date', () => {
      const start = new Date('2024-01-14T22:00:00').getTime();
      const end = new Date('2024-01-15T08:00:00').getTime();

      const result = formatEpisodeTimeRange(start, end, targetDate);

      expect(result).toBe('Jan 14, 10:00 PM - 8:00 AM');
    });

    it('shows date for end when end is after target date', () => {
      const start = new Date('2024-01-15T22:00:00').getTime();
      const end = new Date('2024-01-16T06:00:00').getTime();

      const result = formatEpisodeTimeRange(start, end, targetDate);

      expect(result).toBe('10:00 PM - Jan 16, 6:00 AM');
    });

    it('shows dates for both when neither is on target date', () => {
      const start = new Date('2024-01-14T22:00:00').getTime();
      const end = new Date('2024-01-16T08:00:00').getTime();

      const result = formatEpisodeTimeRange(start, end, targetDate);

      expect(result).toBe('Jan 14, 10:00 PM - Jan 16, 8:00 AM');
    });
  });

  describe('ongoing episodes', () => {
    it('shows "Started at" for ongoing episode on target date', () => {
      const start = new Date('2024-01-15T14:00:00').getTime();

      const result = formatEpisodeTimeRange(start, null, targetDate);

      expect(result).toBe('Started at 2:00 PM');
    });

    it('shows "Started" with date for ongoing episode from before target date', () => {
      const start = new Date('2024-01-14T20:00:00').getTime();

      const result = formatEpisodeTimeRange(start, null, targetDate);

      expect(result).toBe('Started Jan 14, 8:00 PM');
    });

    it('handles undefined endTime same as null', () => {
      const start = new Date('2024-01-15T14:00:00').getTime();

      const result = formatEpisodeTimeRange(start, undefined, targetDate);

      expect(result).toBe('Started at 2:00 PM');
    });
  });

  describe('error handling', () => {
    it('returns "Unknown time" for invalid start time', () => {
      const result = formatEpisodeTimeRange(NaN, null, targetDate);

      expect(result).toBe('Unknown time');
    });

    it('handles invalid end time gracefully', () => {
      const start = new Date('2024-01-15T10:00:00').getTime();

      const result = formatEpisodeTimeRange(start, NaN, targetDate);

      expect(result).toBe('Started at 10:00 AM');
    });
  });
});

describe('formatEpisodeDuration', () => {
  describe('completed episodes', () => {
    it('formats hours and minutes', () => {
      const start = new Date('2024-01-15T10:00:00').getTime();
      const end = new Date('2024-01-15T12:30:00').getTime();

      const result = formatEpisodeDuration(start, end);

      expect(result).toBe('2h 30m');
    });

    it('formats minutes only for short episodes', () => {
      const start = new Date('2024-01-15T10:00:00').getTime();
      const end = new Date('2024-01-15T10:45:00').getTime();

      const result = formatEpisodeDuration(start, end);

      expect(result).toBe('45m');
    });

    it('formats long durations correctly', () => {
      const start = new Date('2024-01-15T10:00:00').getTime();
      const end = new Date('2024-01-16T22:15:00').getTime();

      const result = formatEpisodeDuration(start, end);

      expect(result).toBe('36h 15m');
    });
  });

  describe('ongoing episodes', () => {
    it('uses current time when end is null', () => {
      const now = Date.now();
      const start = now - 2 * 60 * 60 * 1000; // 2 hours ago

      const result = formatEpisodeDuration(start, null);

      // Should be approximately 2h 0m (allowing for test execution time)
      expect(result).toMatch(/^2h \d+m$/);
    });

    it('uses current time when end is undefined', () => {
      const now = Date.now();
      const start = now - 30 * 60 * 1000; // 30 minutes ago

      const result = formatEpisodeDuration(start);

      // Should be approximately 30m (allowing for test execution time)
      expect(result).toMatch(/^\d+m$/);
    });
  });

  describe('error handling', () => {
    it('returns "Unknown duration" for invalid start time', () => {
      const result = formatEpisodeDuration(NaN, Date.now());

      expect(result).toBe('Unknown duration');
    });

    it('returns "Unknown duration" for negative duration', () => {
      const start = new Date('2024-01-15T14:00:00').getTime();
      const end = new Date('2024-01-15T10:00:00').getTime(); // end before start

      const result = formatEpisodeDuration(start, end);

      expect(result).toBe('Unknown duration');
    });
  });
});

describe('formatDurationLong', () => {
  describe('short durations (< 24 hours)', () => {
    it('formats 1 hour correctly', () => {
      expect(formatDurationLong(1)).toBe('1 hour');
    });

    it('formats multiple hours correctly', () => {
      expect(formatDurationLong(5)).toBe('5 hours');
    });

    it('formats 0 hours correctly', () => {
      expect(formatDurationLong(0)).toBe('0 hours');
    });

    it('rounds fractional hours', () => {
      expect(formatDurationLong(5.4)).toBe('5 hours');
      expect(formatDurationLong(5.6)).toBe('6 hours');
    });
  });

  describe('long durations (>= 24 hours)', () => {
    it('formats exactly 24 hours as 1 day', () => {
      expect(formatDurationLong(24)).toBe('1 day');
    });

    it('formats 48 hours as 2 days', () => {
      expect(formatDurationLong(48)).toBe('2 days');
    });

    it('formats days with remaining hours', () => {
      expect(formatDurationLong(26)).toBe('1 day, 2 hours');
    });

    it('formats multiple days with single hour', () => {
      expect(formatDurationLong(49)).toBe('2 days, 1 hour');
    });

    it('formats multiple days with multiple hours', () => {
      expect(formatDurationLong(75)).toBe('3 days, 3 hours');
    });
  });

  describe('error handling', () => {
    it('returns "Unknown duration" for NaN', () => {
      expect(formatDurationLong(NaN)).toBe('Unknown duration');
    });

    it('returns "Unknown duration" for negative values', () => {
      expect(formatDurationLong(-5)).toBe('Unknown duration');
    });
  });
});

describe('formatRelativeDate', () => {
  describe('relative dates', () => {
    it('formats today\'s date with "Today"', () => {
      const now = new Date();
      now.setHours(14, 30, 0, 0);
      const result = formatRelativeDate(now.getTime());
      expect(result).toMatch(/^Today, \d{1,2}:\d{2} [AP]M$/);
    });

    it('formats yesterday\'s date with "Yesterday"', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(10, 0, 0, 0);
      const result = formatRelativeDate(yesterday.getTime());
      expect(result).toMatch(/^Yesterday, \d{1,2}:\d{2} [AP]M$/);
    });

    it('formats older dates with full date', () => {
      const oldDate = new Date('2024-01-15T14:30:00');
      const result = formatRelativeDate(oldDate.getTime());
      expect(result).toBe('Jan 15, 2024 2:30 PM');
    });
  });

  describe('custom time format', () => {
    it('accepts custom time format', () => {
      const oldDate = new Date('2024-01-15T14:30:00');
      const result = formatRelativeDate(oldDate.getTime(), 'HH:mm');
      expect(result).toBe('Jan 15, 2024 14:30');
    });
  });

  describe('error handling', () => {
    it('returns "Unknown time" for invalid timestamp', () => {
      expect(formatRelativeDate(NaN)).toBe('Unknown time');
    });
  });
});

describe('formatTime', () => {
  describe('with timestamps', () => {
    it('formats timestamp to default time format', () => {
      const timestamp = new Date('2024-01-15T14:30:00').getTime();
      expect(formatTime(timestamp)).toBe('2:30 PM');
    });

    it('accepts custom format string', () => {
      const timestamp = new Date('2024-01-15T14:30:00').getTime();
      expect(formatTime(timestamp, 'HH:mm')).toBe('14:30');
    });
  });

  describe('with Date objects', () => {
    it('formats Date object to default time format', () => {
      const date = new Date('2024-01-15T09:00:00');
      expect(formatTime(date)).toBe('9:00 AM');
    });
  });

  describe('error handling', () => {
    it('returns "Unknown time" for NaN timestamp', () => {
      expect(formatTime(NaN)).toBe('Unknown time');
    });

    it('returns "Unknown time" for invalid Date object', () => {
      expect(formatTime(new Date('invalid'))).toBe('Unknown time');
    });
  });
});

describe('formatDateTime', () => {
  describe('with timestamps', () => {
    it('formats timestamp to default date-time format', () => {
      const timestamp = new Date('2024-01-15T14:30:00').getTime();
      expect(formatDateTime(timestamp)).toBe('Jan 15, 2024 2:30 PM');
    });

    it('accepts custom format string', () => {
      const timestamp = new Date('2024-01-15T14:30:00').getTime();
      expect(formatDateTime(timestamp, 'yyyy-MM-dd HH:mm')).toBe(
        '2024-01-15 14:30'
      );
    });
  });

  describe('with Date objects', () => {
    it('formats Date object to default date-time format', () => {
      const date = new Date('2024-03-20T09:15:00');
      expect(formatDateTime(date)).toBe('Mar 20, 2024 9:15 AM');
    });
  });

  describe('error handling', () => {
    it('returns "Unknown time" for NaN timestamp', () => {
      expect(formatDateTime(NaN)).toBe('Unknown time');
    });

    it('returns "Unknown time" for invalid Date object', () => {
      expect(formatDateTime(new Date('invalid'))).toBe('Unknown time');
    });
  });
});

describe('uses12HourClock export', () => {
  it('is exported from dateFormatting module', () => {
    expect(typeof uses12HourClock).toBe('function');
  });

  it('returns a boolean', () => {
    const result = uses12HourClock();
    expect(typeof result).toBe('boolean');
  });
});

/**
 * Tests for local timezone date utilities
 *
 * These functions exist to prevent UTC conversion bugs that occur when using:
 * - new Date().toISOString().split('T')[0]  - returns UTC date, not local date
 * - new Date("YYYY-MM-DD")  - parses as UTC midnight, wrong local date in western timezones
 *
 * BUG FIX CONTEXT:
 * At 11pm PST on Dec 14, toISOString() returns "2025-12-15T07:00:00.000Z"
 * which splits to "2025-12-15" - the WRONG local date.
 * These utilities use local date components to avoid this issue.
 */
describe('toLocalDateString', () => {
  it('returns YYYY-MM-DD format', () => {
    const date = new Date(2024, 0, 15); // Jan 15, 2024 (month is 0-indexed)
    expect(toLocalDateString(date)).toBe('2024-01-15');
  });

  it('pads single-digit months and days', () => {
    const date = new Date(2024, 2, 5); // Mar 5, 2024
    expect(toLocalDateString(date)).toBe('2024-03-05');
  });

  it('returns current date when called without arguments', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(toLocalDateString()).toBe(expected);
  });

  it('uses local date components, NOT UTC (critical bug fix test)', () => {
    // Simulate 11pm PST on Dec 14 (which is Dec 15 in UTC)
    // This date would be "2025-12-15" if using toISOString()
    const latePST = new Date(2025, 11, 14, 23, 0, 0); // Dec 14, 2025 11:00 PM local

    // Should return local date "2025-12-14", NOT UTC date "2025-12-15"
    expect(toLocalDateString(latePST)).toBe('2025-12-14');
  });

  it('differs from toISOString for late evening dates in negative UTC offset timezones', () => {
    // At 11pm on Dec 14 in PST (UTC-8), it's already Dec 15 in UTC
    const lateEvening = new Date(2025, 11, 14, 23, 30, 0); // Dec 14 11:30 PM local

    const localResult = toLocalDateString(lateEvening);

    // In PST, local should be Dec 14, but ISO (UTC) might be Dec 15
    // The local result should always match the local date components
    expect(localResult).toBe('2025-12-14');
    // Note: toISOString() result depends on the test machine's timezone
    // We intentionally don't compare against it because test results would vary by TZ
  });
});

describe('toLocalDateStringOffset', () => {
  it('adds days correctly', () => {
    const from = new Date(2024, 0, 15); // Jan 15
    expect(toLocalDateStringOffset(1, from)).toBe('2024-01-16');
    expect(toLocalDateStringOffset(7, from)).toBe('2024-01-22');
  });

  it('subtracts days correctly with negative offset', () => {
    const from = new Date(2024, 0, 15); // Jan 15
    expect(toLocalDateStringOffset(-1, from)).toBe('2024-01-14');
    expect(toLocalDateStringOffset(-7, from)).toBe('2024-01-08');
  });

  it('handles month boundaries', () => {
    const endOfMonth = new Date(2024, 0, 31); // Jan 31
    expect(toLocalDateStringOffset(1, endOfMonth)).toBe('2024-02-01');
  });

  it('handles year boundaries', () => {
    const endOfYear = new Date(2024, 11, 31); // Dec 31
    expect(toLocalDateStringOffset(1, endOfYear)).toBe('2025-01-01');
  });

  it('defaults to today when no from date provided', () => {
    const tomorrow = toLocalDateStringOffset(1);
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + 1);
    const expected = `${expectedDate.getFullYear()}-${String(expectedDate.getMonth() + 1).padStart(2, '0')}-${String(expectedDate.getDate()).padStart(2, '0')}`;
    expect(tomorrow).toBe(expected);
  });
});

describe('localDateTimeFromStrings', () => {
  it('creates Date with correct local components', () => {
    const result = localDateTimeFromStrings('2024-01-15', '14:30');

    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(0); // January is 0
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
  });

  it('handles midnight correctly', () => {
    const result = localDateTimeFromStrings('2024-06-15', '00:00');

    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getDate()).toBe(15);
  });

  it('handles end of day correctly', () => {
    const result = localDateTimeFromStrings('2024-06-15', '23:59');

    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
    expect(result.getDate()).toBe(15);
  });

  it('differs from new Date("YYYY-MM-DD") which parses as UTC (critical bug fix test)', () => {
    // new Date("2024-01-15") is parsed as UTC midnight
    // In PST (UTC-8), this becomes Jan 14 4pm!
    // We don't use this variable to avoid lint warnings, but document the bug

    // Our function should create Jan 15 at the specified time in LOCAL timezone
    const localParsed = localDateTimeFromStrings('2024-01-15', '08:00');

    // The local parsed date should have local date = 15
    expect(localParsed.getDate()).toBe(15);

    // Note: new Date("2024-01-15").getDate() may be 14 in western timezones
    // This test documents the bug that localDateTimeFromStrings fixes
  });

  it('round-trips with toLocalDateString', () => {
    const original = localDateTimeFromStrings('2024-07-20', '15:45');
    const dateString = toLocalDateString(original);
    expect(dateString).toBe('2024-07-20');
  });
});

/**
 * DST (Daylight Saving Time) edge case tests
 *
 * These tests document behavior around DST transitions.
 * Note: Actual DST behavior depends on the test machine's timezone.
 * The tests verify that the functions don't crash and produce reasonable output.
 */
describe('DST Edge Cases', () => {
  describe('toLocalDateString during DST transition', () => {
    it('handles spring forward transition date (March 2025)', () => {
      // March 9, 2025 is when most of the US springs forward
      // The functions should still work correctly on this date
      const springForward = new Date(2025, 2, 9, 2, 30, 0); // March 9, 2:30 AM

      const result = toLocalDateString(springForward);

      // Should return March 9 regardless of DST transition
      expect(result).toBe('2025-03-09');
    });

    it('handles fall back transition date (November 2025)', () => {
      // November 2, 2025 is when most of the US falls back
      const fallBack = new Date(2025, 10, 2, 1, 30, 0); // November 2, 1:30 AM

      const result = toLocalDateString(fallBack);

      // Should return November 2 regardless of DST transition
      expect(result).toBe('2025-11-02');
    });
  });

  describe('toLocalDateStringOffset during DST transition', () => {
    it('correctly adds days across spring forward', () => {
      const marchBefore = new Date(2025, 2, 8); // March 8
      const result = toLocalDateStringOffset(1, marchBefore);

      // Should add 1 day correctly
      expect(result).toBe('2025-03-09');
    });

    it('correctly adds days across fall back', () => {
      const novemberBefore = new Date(2025, 10, 1); // November 1
      const result = toLocalDateStringOffset(1, novemberBefore);

      // Should add 1 day correctly
      expect(result).toBe('2025-11-02');
    });

    it('correctly subtracts days across spring forward', () => {
      const marchAfter = new Date(2025, 2, 10); // March 10
      const result = toLocalDateStringOffset(-1, marchAfter);

      // Should subtract 1 day correctly
      expect(result).toBe('2025-03-09');
    });

    it('correctly subtracts days across fall back', () => {
      const novemberAfter = new Date(2025, 10, 3); // November 3
      const result = toLocalDateStringOffset(-1, novemberAfter);

      // Should subtract 1 day correctly
      expect(result).toBe('2025-11-02');
    });
  });

  describe('localDateTimeFromStrings during DST transition', () => {
    it('creates valid date on spring forward day', () => {
      // 2:30 AM doesn't exist on spring forward day in most US timezones
      // But we still create a Date object - JS handles the skipped hour
      const result = localDateTimeFromStrings('2025-03-09', '02:30');

      // Should create a Date with March 9
      expect(result.getMonth()).toBe(2); // March
      expect(result.getDate()).toBe(9);
      // The exact hour may be adjusted by JS but the date should be correct
    });

    it('creates valid date on fall back day', () => {
      // 1:30 AM occurs twice on fall back day
      const result = localDateTimeFromStrings('2025-11-02', '01:30');

      // Should create a Date with November 2
      expect(result.getMonth()).toBe(10); // November
      expect(result.getDate()).toBe(2);
      expect(result.getHours()).toBe(1);
      expect(result.getMinutes()).toBe(30);
    });
  });
});

describe('formatTimeUntil', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-15T12:00:00'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns "now" for times less than a minute away', () => {
    const date = new Date('2025-01-15T12:00:20'); // 20 seconds from now (rounds to 0m)
    expect(formatTimeUntil(date)).toBe('now');
  });

  it('returns minutes for times less than an hour away', () => {
    const date = new Date('2025-01-15T12:30:00'); // 30 minutes from now
    expect(formatTimeUntil(date)).toBe('30m');
  });

  it('returns hours for times less than a day away', () => {
    const date = new Date('2025-01-15T14:00:00'); // 2 hours from now
    expect(formatTimeUntil(date)).toBe('2h');
  });

  it('returns "1 day" for times about a day away', () => {
    const date = new Date('2025-01-16T12:00:00'); // 24 hours from now
    expect(formatTimeUntil(date)).toBe('1 day');
  });

  it('returns plural days for times multiple days away', () => {
    const date = new Date('2025-01-18T12:00:00'); // 3 days from now
    expect(formatTimeUntil(date)).toBe('3 days');
  });

  it('accepts timestamp numbers', () => {
    const timestamp = new Date('2025-01-15T14:00:00').getTime();
    expect(formatTimeUntil(timestamp)).toBe('2h');
  });

  it('returns "Unknown" for invalid dates', () => {
    expect(formatTimeUntil(new Date('invalid'))).toBe('Unknown');
  });
});
