import { formatEpisodeTimeRange, formatEpisodeDuration } from '../dateFormatting';

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
      const start = now - (2 * 60 * 60 * 1000); // 2 hours ago

      const result = formatEpisodeDuration(start, null);

      // Should be approximately 2h 0m (allowing for test execution time)
      expect(result).toMatch(/^2h \d+m$/);
    });

    it('uses current time when end is undefined', () => {
      const now = Date.now();
      const start = now - (30 * 60 * 1000); // 30 minutes ago

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
