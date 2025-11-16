import { getDateRangeForDays, filterItemsByDateRange, formatDuration } from '../analyticsUtils';

describe('analyticsUtils', () => {
  describe('getDateRangeForDays', () => {
    it('should return start and end dates', () => {
      const result = getDateRangeForDays(7);
      expect(result).toHaveProperty('startDate');
      expect(result).toHaveProperty('endDate');
      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
    });

    it('should set end date to end of today (23:59:59.999)', () => {
      const result = getDateRangeForDays(7);
      const endDate = result.endDate;
      expect(endDate.getHours()).toBe(23);
      expect(endDate.getMinutes()).toBe(59);
      expect(endDate.getSeconds()).toBe(59);
      expect(endDate.getMilliseconds()).toBe(999);
    });

    it('should set start date to beginning of day N days ago (00:00:00.000)', () => {
      const result = getDateRangeForDays(7);
      const startDate = result.startDate;
      expect(startDate.getHours()).toBe(0);
      expect(startDate.getMinutes()).toBe(0);
      expect(startDate.getSeconds()).toBe(0);
      expect(startDate.getMilliseconds()).toBe(0);
    });

    it('should calculate correct date range for 7 days', () => {
      const result = getDateRangeForDays(7);
      // Verify start date is 7 days before end date's day
      const expectedStart = new Date(result.endDate);
      expectedStart.setDate(expectedStart.getDate() - 7);
      expectedStart.setHours(0, 0, 0, 0);

      expect(result.startDate.toDateString()).toBe(expectedStart.toDateString());
    });

    it('should calculate correct date range for 30 days', () => {
      const result = getDateRangeForDays(30);
      // Verify start date is 30 days before end date's day
      const expectedStart = new Date(result.endDate);
      expectedStart.setDate(expectedStart.getDate() - 30);
      expectedStart.setHours(0, 0, 0, 0);

      expect(result.startDate.toDateString()).toBe(expectedStart.toDateString());
    });

    it('should calculate correct date range for 90 days', () => {
      const result = getDateRangeForDays(90);
      // Verify start date is 90 days before end date's day
      const expectedStart = new Date(result.endDate);
      expectedStart.setDate(expectedStart.getDate() - 90);
      expectedStart.setHours(0, 0, 0, 0);

      expect(result.startDate.toDateString()).toBe(expectedStart.toDateString());
    });

    it('should handle 1 day range', () => {
      const result = getDateRangeForDays(1);
      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
    });

    it('should handle 0 days (today only)', () => {
      const result = getDateRangeForDays(0);
      const startDate = result.startDate;
      const endDate = result.endDate;
      // Both should be today
      expect(startDate.toDateString()).toBe(endDate.toDateString());
    });
  });

  describe('filterItemsByDateRange', () => {
    const createTestItems = () => [
      { id: 1, timestamp: new Date('2024-01-01T10:00:00').getTime() },
      { id: 2, timestamp: new Date('2024-01-15T14:30:00').getTime() },
      { id: 3, timestamp: new Date('2024-01-31T23:59:59').getTime() },
      { id: 4, timestamp: new Date('2024-02-01T00:00:00').getTime() },
      { id: 5, timestamp: new Date('2024-02-15T12:00:00').getTime() },
    ];

    it('should filter items within date range (timestamp)', () => {
      const items = createTestItems();
      const startDate = new Date('2024-01-10T00:00:00');
      const endDate = new Date('2024-01-31T23:59:59');

      const result = filterItemsByDateRange(items, 'timestamp', startDate, endDate);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(3);
    });

    it('should include items at exact start date', () => {
      const items = createTestItems();
      const startDate = new Date('2024-01-15T14:30:00');
      const endDate = new Date('2024-02-15T12:00:00');

      const result = filterItemsByDateRange(items, 'timestamp', startDate, endDate);

      expect(result.some(item => item.id === 2)).toBe(true);
    });

    it('should include items at exact end date', () => {
      const items = createTestItems();
      const startDate = new Date('2024-01-01T00:00:00');
      const endDate = new Date('2024-01-15T14:30:00');

      const result = filterItemsByDateRange(items, 'timestamp', startDate, endDate);

      expect(result.some(item => item.id === 2)).toBe(true);
    });

    it('should return empty array when no items match', () => {
      const items = createTestItems();
      const startDate = new Date('2025-01-01T00:00:00');
      const endDate = new Date('2025-12-31T23:59:59');

      const result = filterItemsByDateRange(items, 'timestamp', startDate, endDate);

      expect(result).toHaveLength(0);
    });

    it('should handle empty input array', () => {
      const result = filterItemsByDateRange(
        [],
        'timestamp',
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );

      expect(result).toHaveLength(0);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle Date objects as values', () => {
      const items = [
        { id: 1, date: new Date('2024-01-15T10:00:00') },
        { id: 2, date: new Date('2024-02-15T10:00:00') },
      ];
      const startDate = new Date('2024-01-01T00:00:00');
      const endDate = new Date('2024-01-31T23:59:59');

      const result = filterItemsByDateRange(items, 'date', startDate, endDate);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('should filter out items with invalid dates', () => {
      const items = [
        { id: 1, timestamp: new Date('2024-01-15T10:00:00').getTime() },
        { id: 2, timestamp: 'invalid' as any },
        { id: 3, timestamp: null as any },
        { id: 4, timestamp: undefined as any },
        { id: 5, timestamp: new Date('2024-01-20T10:00:00').getTime() },
      ];
      const startDate = new Date('2024-01-01T00:00:00');
      const endDate = new Date('2024-01-31T23:59:59');

      const result = filterItemsByDateRange(items, 'timestamp', startDate, endDate);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(5);
    });

    it('should handle different property keys', () => {
      const items = [
        { id: 1, startTime: new Date('2024-01-15T10:00:00').getTime() },
        { id: 2, startTime: new Date('2024-02-15T10:00:00').getTime() },
      ];
      const startDate = new Date('2024-01-01T00:00:00');
      const endDate = new Date('2024-01-31T23:59:59');

      const result = filterItemsByDateRange(items, 'startTime', startDate, endDate);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('should preserve item properties', () => {
      const items = [
        { id: 1, name: 'Item 1', timestamp: new Date('2024-01-15T10:00:00').getTime() },
      ];
      const startDate = new Date('2024-01-01T00:00:00');
      const endDate = new Date('2024-01-31T23:59:59');

      const result = filterItemsByDateRange(items, 'timestamp', startDate, endDate);

      expect(result[0]).toEqual(items[0]);
      expect(result[0].name).toBe('Item 1');
    });
  });

  describe('formatDuration', () => {
    it('should format hours and minutes correctly', () => {
      const duration = 2 * 60 * 60 * 1000 + 30 * 60 * 1000; // 2h 30m in ms
      expect(formatDuration(duration)).toBe('2h 30m');
    });

    it('should format hours only when no remaining minutes', () => {
      const duration = 3 * 60 * 60 * 1000; // 3h in ms
      expect(formatDuration(duration)).toBe('3h');
    });

    it('should format minutes only when less than 1 hour', () => {
      const duration = 45 * 60 * 1000; // 45m in ms
      expect(formatDuration(duration)).toBe('45m');
    });

    it('should handle 1 hour exactly', () => {
      const duration = 60 * 60 * 1000; // 1h in ms
      expect(formatDuration(duration)).toBe('1h');
    });

    it('should handle 1 minute', () => {
      const duration = 60 * 1000; // 1m in ms
      expect(formatDuration(duration)).toBe('1m');
    });

    it('should round down partial minutes', () => {
      const duration = 2 * 60 * 1000 + 30 * 1000; // 2m 30s in ms
      expect(formatDuration(duration)).toBe('2m');
    });

    it('should handle 0 milliseconds', () => {
      expect(formatDuration(0)).toBe('0m');
    });

    it('should handle negative values as 0m', () => {
      expect(formatDuration(-1000)).toBe('0m');
      expect(formatDuration(-100000)).toBe('0m');
    });

    it('should handle very small positive values', () => {
      expect(formatDuration(1)).toBe('0m');
      expect(formatDuration(100)).toBe('0m');
      expect(formatDuration(59999)).toBe('0m'); // Just under 1 minute
    });

    it('should handle very large durations', () => {
      const duration = 24 * 60 * 60 * 1000; // 24 hours in ms
      expect(formatDuration(duration)).toBe('24h');
    });

    it('should format 10+ hours with minutes correctly', () => {
      const duration = 12 * 60 * 60 * 1000 + 15 * 60 * 1000; // 12h 15m
      expect(formatDuration(duration)).toBe('12h 15m');
    });

    it('should handle duration with 1 hour and 1 minute', () => {
      const duration = 60 * 60 * 1000 + 60 * 1000; // 1h 1m
      expect(formatDuration(duration)).toBe('1h 1m');
    });
  });
});
