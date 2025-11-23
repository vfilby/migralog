import {
  formatEpisodeTimeRange,
  formatEpisodeDuration,
  formatDurationLong,
  formatRelativeDate,
  formatTime,
  formatDateTime,
  uses12HourClock,
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
