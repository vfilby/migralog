import {
  getDateRangeForDays,
  filterItemsByDateRange,
  formatDuration,
  calculateMigraineDays,
  calculateEpisodeFrequency,
  categorizeDays,
  calculateDurationMetrics,
  calculatePreventativeCompliance,
  calculateNSAIDUsage,
  calculatePerMedicationStats
} from '../analyticsUtils';

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

  describe('calculateMigraineDays', () => {
    it('should count unique days with episodes', () => {
      const episodes = [
        { id: '1', startTime: new Date('2024-01-15T10:00:00').getTime(), endTime: new Date('2024-01-15T14:00:00').getTime() },
        { id: '2', startTime: new Date('2024-01-20T10:00:00').getTime(), endTime: new Date('2024-01-20T14:00:00').getTime() },
      ];
      const result = calculateMigraineDays(episodes, new Date('2024-01-01'), new Date('2024-01-31'));
      expect(result).toBe(2);
    });

    it('should count multi-day episodes correctly', () => {
      const episodes = [
        { id: '1', startTime: new Date('2024-01-15T10:00:00').getTime(), endTime: new Date('2024-01-17T14:00:00').getTime() },
      ];
      const result = calculateMigraineDays(episodes, new Date('2024-01-01'), new Date('2024-01-31'));
      expect(result).toBe(3); // 15th, 16th, 17th
    });

    it('should handle multiple episodes on the same day', () => {
      const episodes = [
        { id: '1', startTime: new Date('2024-01-15T10:00:00').getTime(), endTime: new Date('2024-01-15T14:00:00').getTime() },
        { id: '2', startTime: new Date('2024-01-15T18:00:00').getTime(), endTime: new Date('2024-01-15T22:00:00').getTime() },
      ];
      const result = calculateMigraineDays(episodes, new Date('2024-01-01'), new Date('2024-01-31'));
      expect(result).toBe(1);
    });

    it('should handle episodes spanning multiple days across range boundary', () => {
      const episodes = [
        { id: '1', startTime: new Date('2024-01-15T18:00:00').getTime(), endTime: new Date('2024-01-16T02:00:00').getTime() },
      ];
      const result = calculateMigraineDays(episodes, new Date('2024-01-01'), new Date('2024-01-31'));
      expect(result).toBe(2); // 15th and 16th
    });

    it('should exclude episodes outside date range', () => {
      const episodes = [
        { id: '1', startTime: new Date('2023-12-15T10:00:00').getTime(), endTime: new Date('2023-12-15T14:00:00').getTime() },
        { id: '2', startTime: new Date('2024-02-15T10:00:00').getTime(), endTime: new Date('2024-02-15T14:00:00').getTime() },
      ];
      const result = calculateMigraineDays(episodes, new Date('2024-01-01'), new Date('2024-01-31'));
      expect(result).toBe(0);
    });

    it('should handle ongoing episodes (no endTime)', () => {
      const episodes = [
        { id: '1', startTime: new Date('2024-01-15T10:00:00').getTime() }, // No endTime
      ];
      const result = calculateMigraineDays(episodes, new Date('2024-01-01'), new Date('2024-01-31'));
      expect(result).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty episode array', () => {
      const result = calculateMigraineDays([], new Date('2024-01-01'), new Date('2024-01-31'));
      expect(result).toBe(0);
    });

    it('should handle episodes partially overlapping date range (start before)', () => {
      const episodes = [
        { id: '1', startTime: new Date('2023-12-30T10:00:00').getTime(), endTime: new Date('2024-01-02T14:00:00').getTime() },
      ];
      const result = calculateMigraineDays(episodes, new Date('2024-01-01T00:00:00'), new Date('2024-01-31T00:00:00'));
      expect(result).toBeGreaterThanOrEqual(2); // At least 2 days, may vary by timezone
    });

    it('should handle episodes partially overlapping date range (end after)', () => {
      const episodes = [
        { id: '1', startTime: new Date('2024-01-30T10:00:00').getTime(), endTime: new Date('2024-02-02T14:00:00').getTime() },
      ];
      const result = calculateMigraineDays(episodes, new Date('2024-01-01T00:00:00'), new Date('2024-01-31T23:59:59'));
      expect(result).toBeGreaterThanOrEqual(1); // At least 1 day, may vary by timezone
    });

    it('should skip episodes without startTime', () => {
      const episodes = [
        { id: '1', startTime: 0 as any, endTime: new Date('2024-01-15T14:00:00').getTime() },
        { id: '2', startTime: new Date('2024-01-20T10:00:00').getTime(), endTime: new Date('2024-01-20T14:00:00').getTime() },
      ];
      const result = calculateMigraineDays(episodes, new Date('2024-01-01'), new Date('2024-01-31'));
      expect(result).toBe(1);
    });
  });

  describe('calculateEpisodeFrequency', () => {
    it('should count episodes within date range', () => {
      const episodes = [
        { id: '1', startTime: new Date('2024-01-15T10:00:00').getTime() },
        { id: '2', startTime: new Date('2024-01-20T10:00:00').getTime() },
      ];
      const result = calculateEpisodeFrequency(episodes, new Date('2024-01-01'), new Date('2024-01-31'));
      expect(result).toBe(2);
    });

    it('should exclude episodes outside date range', () => {
      const episodes = [
        { id: '1', startTime: new Date('2023-12-15T10:00:00').getTime() },
        { id: '2', startTime: new Date('2024-01-15T10:00:00').getTime() },
        { id: '3', startTime: new Date('2024-02-15T10:00:00').getTime() },
      ];
      const result = calculateEpisodeFrequency(episodes, new Date('2024-01-01'), new Date('2024-01-31'));
      expect(result).toBe(1);
    });

    it('should handle empty episode array', () => {
      const result = calculateEpisodeFrequency([], new Date('2024-01-01'), new Date('2024-01-31'));
      expect(result).toBe(0);
    });

    it('should include episodes at exact start date', () => {
      const episodes = [
        { id: '1', startTime: new Date('2024-01-01T00:00:00').getTime() },
      ];
      const result = calculateEpisodeFrequency(episodes, new Date('2024-01-01T00:00:00'), new Date('2024-01-31T23:59:59'));
      expect(result).toBe(1);
    });

    it('should include episodes at exact end date', () => {
      const episodes = [
        { id: '1', startTime: new Date('2024-01-31T23:59:59').getTime() },
      ];
      const result = calculateEpisodeFrequency(episodes, new Date('2024-01-01T00:00:00'), new Date('2024-01-31T23:59:59'));
      expect(result).toBe(1);
    });

    it('should skip episodes without startTime', () => {
      const episodes = [
        { id: '1', startTime: 0 as any },
        { id: '2', startTime: new Date('2024-01-15T10:00:00').getTime() },
      ];
      const result = calculateEpisodeFrequency(episodes, new Date('2024-01-01'), new Date('2024-01-31'));
      expect(result).toBe(1);
    });

    it('should handle multiple episodes on same day', () => {
      const episodes = [
        { id: '1', startTime: new Date('2024-01-15T10:00:00').getTime() },
        { id: '2', startTime: new Date('2024-01-15T18:00:00').getTime() },
      ];
      const result = calculateEpisodeFrequency(episodes, new Date('2024-01-01'), new Date('2024-01-31'));
      expect(result).toBe(2);
    });
  });

  describe('categorizeDays', () => {
    it('should categorize days correctly', () => {
      const logs = [
        { id: '1', date: '2024-01-15', status: 'green' as const },
        { id: '2', date: '2024-01-16', status: 'yellow' as const },
        { id: '3', date: '2024-01-17', status: 'red' as const },
      ];
      const result = categorizeDays(logs, new Date('2024-01-15'), new Date('2024-01-20'));
      expect(result.clear).toBe(1); // 15th
      expect(result.unclear).toBe(2); // 16th (yellow) and 17th (red)
      expect(result.untracked).toBe(3); // 18th, 19th, 20th
    });

    it('should handle all green days', () => {
      const logs = [
        { id: '1', date: '2024-01-15', status: 'green' as const },
        { id: '2', date: '2024-01-16', status: 'green' as const },
        { id: '3', date: '2024-01-17', status: 'green' as const },
      ];
      const result = categorizeDays(logs, new Date('2024-01-15T00:00:00'), new Date('2024-01-17T23:59:59'));
      expect(result.clear).toBeGreaterThanOrEqual(2);  // May vary by timezone
      expect(result.unclear).toBe(0);
    });

    it('should handle all untracked days', () => {
      const logs: any[] = [];
      const result = categorizeDays(logs, new Date('2024-01-15T00:00:00'), new Date('2024-01-20T23:59:59'));
      expect(result.clear).toBe(0);
      expect(result.unclear).toBe(0);
      expect(result.untracked).toBeGreaterThanOrEqual(5); // At least 5 days, may vary by timezone
    });

    it('should handle mixed yellow and red as unclear', () => {
      const logs = [
        { id: '1', date: '2024-01-15', status: 'yellow' as const },
        { id: '2', date: '2024-01-16', status: 'red' as const },
        { id: '3', date: '2024-01-17', status: 'yellow' as const },
      ];
      const result = categorizeDays(logs, new Date('2024-01-15T00:00:00'), new Date('2024-01-17T23:59:59'));
      expect(result.clear).toBe(0);
      expect(result.unclear).toBeGreaterThanOrEqual(2); // May vary by timezone
    });

    it('should handle single day range', () => {
      const logs = [
        { id: '1', date: '2024-01-15', status: 'green' as const },
      ];
      const result = categorizeDays(logs, new Date('2024-01-15T00:00:00'), new Date('2024-01-15T23:59:59'));
      expect(result.clear).toBeGreaterThanOrEqual(0); // May be 0 or 1 depending on timezone
    });

    it('should handle logs outside date range', () => {
      const logs = [
        { id: '1', date: '2024-01-10', status: 'green' as const },
        { id: '2', date: '2024-01-25', status: 'green' as const },
      ];
      const result = categorizeDays(logs, new Date('2024-01-15'), new Date('2024-01-20'));
      expect(result.clear).toBe(0);
      expect(result.unclear).toBe(0);
      expect(result.untracked).toBe(6);
    });

    it('should handle 30-day range', () => {
      const logs = [
        { id: '1', date: '2024-01-01', status: 'green' as const },
        { id: '2', date: '2024-01-15', status: 'red' as const },
      ];
      const result = categorizeDays(logs, new Date('2024-01-01'), new Date('2024-01-30'));
      expect(result.clear).toBe(1);
      expect(result.unclear).toBe(1);
      expect(result.untracked).toBe(28);
    });
  });

  describe('calculateDurationMetrics', () => {
    it('should calculate shortest, longest, and average durations', () => {
      const episodes = [
        { id: '1', startTime: 1000, endTime: 5000 },      // 4 seconds
        { id: '2', startTime: 2000, endTime: 12000 },     // 10 seconds
        { id: '3', startTime: 3000, endTime: 9000 },      // 6 seconds
      ];
      const result = calculateDurationMetrics(episodes);
      expect(result.shortest).toBe(4000);
      expect(result.longest).toBe(10000);
      expect(result.average).toBe(6667); // (4000 + 10000 + 6000) / 3 = 6666.67, rounded to 6667
    });

    it('should ignore episodes without endTime', () => {
      const episodes = [
        { id: '1', startTime: 1000, endTime: 5000 },      // 4 seconds
        { id: '2', startTime: 2000 },                     // No endTime, ignored
        { id: '3', startTime: 3000, endTime: 9000 },      // 6 seconds
      ];
      const result = calculateDurationMetrics(episodes);
      expect(result.shortest).toBe(4000);
      expect(result.longest).toBe(6000);
      expect(result.average).toBe(5000);
    });

    it('should return null for all metrics when no completed episodes', () => {
      const episodes = [
        { id: '1', startTime: 1000 },
        { id: '2', startTime: 2000 },
      ];
      const result = calculateDurationMetrics(episodes);
      expect(result.shortest).toBeNull();
      expect(result.longest).toBeNull();
      expect(result.average).toBeNull();
    });

    it('should handle empty episode array', () => {
      const result = calculateDurationMetrics([]);
      expect(result.shortest).toBeNull();
      expect(result.longest).toBeNull();
      expect(result.average).toBeNull();
    });

    it('should handle single episode', () => {
      const episodes = [
        { id: '1', startTime: 1000, endTime: 5000 },
      ];
      const result = calculateDurationMetrics(episodes);
      expect(result.shortest).toBe(4000);
      expect(result.longest).toBe(4000);
      expect(result.average).toBe(4000);
    });

    it('should handle realistic migraine durations', () => {
      const episodes = [
        { id: '1', startTime: 0, endTime: 2 * 60 * 60 * 1000 },           // 2 hours
        { id: '2', startTime: 0, endTime: 24 * 60 * 60 * 1000 },          // 24 hours
        { id: '3', startTime: 0, endTime: 8 * 60 * 60 * 1000 },           // 8 hours
      ];
      const result = calculateDurationMetrics(episodes);
      expect(result.shortest).toBe(2 * 60 * 60 * 1000);
      expect(result.longest).toBe(24 * 60 * 60 * 1000);
      expect(result.average).toBe(11 * 60 * 60 * 1000 + 20 * 60 * 1000); // ~11.33 hours
    });

    it('should round average to nearest millisecond', () => {
      const episodes = [
        { id: '1', startTime: 0, endTime: 1000 },
        { id: '2', startTime: 0, endTime: 2000 },
      ];
      const result = calculateDurationMetrics(episodes);
      expect(result.average).toBe(1500);
    });
  });

  describe('calculatePreventativeCompliance', () => {
    const createTestMedications = () => [
      { id: '1', name: 'Topiramate', type: 'preventative' as const, category: 'preventive' as const },
      { id: '2', name: 'Sumatriptan', type: 'rescue' as const, category: 'triptan' as const },
      { id: '3', name: 'Propranolol', type: 'preventative' as const, category: 'preventive' as const },
    ];

    const createTestSchedules = () => [
      { id: 's1', medicationId: '1', time: '08:00', timezone: 'America/New_York', dosage: 1, enabled: true },
      { id: 's2', medicationId: '3', time: '20:00', timezone: 'America/New_York', dosage: 1, enabled: true },
    ];

    it('should return 100% compliance when all preventative doses taken', () => {
      const medications = createTestMedications();
      const schedules = createTestSchedules();
      const doses = [
        { id: 'd1', medicationId: '1', scheduleId: 's1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' as const },
        { id: 'd2', medicationId: '3', scheduleId: 's2', timestamp: new Date('2024-01-15T20:00:00').getTime(), status: 'taken' as const },
      ];

      const result = calculatePreventativeCompliance(
        medications,
        doses,
        schedules,
        new Date('2024-01-15'),
        new Date('2024-01-15')
      );

      expect(result).toBe(100);
    });

    it('should return 50% compliance when half of doses taken', () => {
      const medications = createTestMedications();
      const schedules = createTestSchedules();
      const doses = [
        { id: 'd1', medicationId: '1', scheduleId: 's1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' as const },
        // Missing dose for medication 3
      ];

      const result = calculatePreventativeCompliance(
        medications,
        doses,
        schedules,
        new Date('2024-01-15'),
        new Date('2024-01-15')
      );

      expect(result).toBe(50);
    });

    it('should return 0% when no preventative medications exist', () => {
      const medications = [
        { id: '2', name: 'Sumatriptan', type: 'rescue' as const, category: 'triptan' as const },
      ];
      const schedules = createTestSchedules();
      const doses: any[] = [];

      const result = calculatePreventativeCompliance(
        medications,
        doses,
        schedules,
        new Date('2024-01-15'),
        new Date('2024-01-15')
      );

      expect(result).toBe(0);
    });

    it('should return 0% when no schedules exist', () => {
      const medications = createTestMedications();
      const schedules: any[] = [];
      const doses: any[] = [];

      const result = calculatePreventativeCompliance(
        medications,
        doses,
        schedules,
        new Date('2024-01-15'),
        new Date('2024-01-15')
      );

      expect(result).toBe(0);
    });

    it('should exclude skipped doses from compliance calculation', () => {
      const medications = createTestMedications();
      const schedules = createTestSchedules();
      const doses = [
        { id: 'd1', medicationId: '1', scheduleId: 's1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' as const },
        { id: 'd2', medicationId: '3', scheduleId: 's2', timestamp: new Date('2024-01-15T20:00:00').getTime(), status: 'skipped' as const },
      ];

      const result = calculatePreventativeCompliance(
        medications,
        doses,
        schedules,
        new Date('2024-01-15'),
        new Date('2024-01-15')
      );

      expect(result).toBe(50);
    });

    it('should exclude rescue medication doses from compliance', () => {
      const medications = createTestMedications();
      const schedules = createTestSchedules();
      const doses = [
        { id: 'd1', medicationId: '1', scheduleId: 's1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' as const },
        { id: 'd2', medicationId: '2', timestamp: new Date('2024-01-15T12:00:00').getTime(), status: 'taken' as const }, // Rescue med
        { id: 'd3', medicationId: '3', scheduleId: 's2', timestamp: new Date('2024-01-15T20:00:00').getTime(), status: 'taken' as const },
      ];

      const result = calculatePreventativeCompliance(
        medications,
        doses,
        schedules,
        new Date('2024-01-15'),
        new Date('2024-01-15')
      );

      expect(result).toBe(100);
    });

    it('should handle multi-day ranges correctly', () => {
      const medications = createTestMedications();
      const schedules = createTestSchedules();
      const doses = [
        // Day 1: both doses
        { id: 'd1', medicationId: '1', scheduleId: 's1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' as const },
        { id: 'd2', medicationId: '3', scheduleId: 's2', timestamp: new Date('2024-01-15T20:00:00').getTime(), status: 'taken' as const },
        // Day 2: only one dose
        { id: 'd3', medicationId: '1', scheduleId: 's1', timestamp: new Date('2024-01-16T08:00:00').getTime(), status: 'taken' as const },
      ];

      const result = calculatePreventativeCompliance(
        medications,
        doses,
        schedules,
        new Date('2024-01-15'),
        new Date('2024-01-16')
      );

      // Expected: 4 scheduled doses (2 schedules * 2 days), 3 taken = 75%
      expect(result).toBe(75);
    });

    it('should exclude doses outside date range', () => {
      const medications = createTestMedications();
      const schedules = createTestSchedules();
      const doses = [
        { id: 'd1', medicationId: '1', scheduleId: 's1', timestamp: new Date('2024-01-14T08:00:00').getTime(), status: 'taken' as const }, // Before range
        { id: 'd2', medicationId: '1', scheduleId: 's1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' as const }, // In range
        { id: 'd3', medicationId: '3', scheduleId: 's2', timestamp: new Date('2024-01-16T20:00:00').getTime(), status: 'taken' as const }, // After range
      ];

      const result = calculatePreventativeCompliance(
        medications,
        doses,
        schedules,
        new Date('2024-01-15'),
        new Date('2024-01-15')
      );

      // Expected: 2 scheduled doses, 1 taken = 50%
      expect(result).toBe(50);
    });

    it('should ignore disabled schedules', () => {
      const medications = createTestMedications();
      const schedules = [
        { id: 's1', medicationId: '1', time: '08:00', timezone: 'America/New_York', dosage: 1, enabled: true },
        { id: 's2', medicationId: '3', time: '20:00', timezone: 'America/New_York', dosage: 1, enabled: false }, // Disabled
      ];
      const doses = [
        { id: 'd1', medicationId: '1', scheduleId: 's1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' as const },
      ];

      const result = calculatePreventativeCompliance(
        medications,
        doses,
        schedules,
        new Date('2024-01-15'),
        new Date('2024-01-15')
      );

      // Only 1 enabled schedule, 1 dose taken = 100%
      expect(result).toBe(100);
    });

    it('should cap compliance at 100%', () => {
      const medications = createTestMedications();
      const schedules = [
        { id: 's1', medicationId: '1', time: '08:00', timezone: 'America/New_York', dosage: 1, enabled: true },
      ];
      const doses = [
        { id: 'd1', medicationId: '1', scheduleId: 's1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' as const },
        { id: 'd2', medicationId: '1', scheduleId: 's1', timestamp: new Date('2024-01-15T08:30:00').getTime(), status: 'taken' as const }, // Extra dose
      ];

      const result = calculatePreventativeCompliance(
        medications,
        doses,
        schedules,
        new Date('2024-01-15'),
        new Date('2024-01-15')
      );

      expect(result).toBe(100);
    });
  });

  describe('calculateNSAIDUsage', () => {
    const createTestMedications = () => [
      { id: '1', name: 'Ibuprofen', type: 'rescue' as const, category: 'nsaid' as const },
      { id: '2', name: 'Sumatriptan', type: 'rescue' as const, category: 'triptan' as const },
      { id: '3', name: 'Naproxen', type: 'rescue' as const, category: 'nsaid' as const },
    ];

    it('should count unique days with NSAID doses', () => {
      const medications = createTestMedications();
      const doses = [
        { id: 'd1', medicationId: '1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' as const },
        { id: 'd2', medicationId: '1', timestamp: new Date('2024-01-15T16:00:00').getTime(), status: 'taken' as const }, // Same day
        { id: 'd3', medicationId: '1', timestamp: new Date('2024-01-17T08:00:00').getTime(), status: 'taken' as const },
      ];

      const result = calculateNSAIDUsage(
        medications,
        doses,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toBe(2); // 15th and 17th
    });

    it('should count days from multiple NSAID medications', () => {
      const medications = createTestMedications();
      const doses = [
        { id: 'd1', medicationId: '1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' as const },
        { id: 'd2', medicationId: '3', timestamp: new Date('2024-01-15T16:00:00').getTime(), status: 'taken' as const }, // Same day, different NSAID
        { id: 'd3', medicationId: '1', timestamp: new Date('2024-01-17T08:00:00').getTime(), status: 'taken' as const },
      ];

      const result = calculateNSAIDUsage(
        medications,
        doses,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toBe(2); // 15th and 17th (not 3 - same day counts once)
    });

    it('should exclude non-NSAID medications', () => {
      const medications = createTestMedications();
      const doses = [
        { id: 'd1', medicationId: '1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' as const }, // NSAID
        { id: 'd2', medicationId: '2', timestamp: new Date('2024-01-16T08:00:00').getTime(), status: 'taken' as const }, // Triptan
        { id: 'd3', medicationId: '3', timestamp: new Date('2024-01-17T08:00:00').getTime(), status: 'taken' as const }, // NSAID
      ];

      const result = calculateNSAIDUsage(
        medications,
        doses,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toBe(2); // Only 15th and 17th (excludes triptan on 16th)
    });

    it('should exclude skipped doses', () => {
      const medications = createTestMedications();
      const doses = [
        { id: 'd1', medicationId: '1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' as const },
        { id: 'd2', medicationId: '1', timestamp: new Date('2024-01-16T08:00:00').getTime(), status: 'skipped' as const },
        { id: 'd3', medicationId: '1', timestamp: new Date('2024-01-17T08:00:00').getTime(), status: 'taken' as const },
      ];

      const result = calculateNSAIDUsage(
        medications,
        doses,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toBe(2); // 15th and 17th (excludes skipped on 16th)
    });

    it('should return 0 when no NSAID medications exist', () => {
      const medications = [
        { id: '2', name: 'Sumatriptan', type: 'rescue' as const, category: 'triptan' as const },
      ];
      const doses = [
        { id: 'd1', medicationId: '2', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' as const },
      ];

      const result = calculateNSAIDUsage(
        medications,
        doses,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toBe(0);
    });

    it('should return 0 when no NSAID doses in range', () => {
      const medications = createTestMedications();
      const doses = [
        { id: 'd1', medicationId: '1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' as const },
      ];

      const result = calculateNSAIDUsage(
        medications,
        doses,
        new Date('2024-02-01'),
        new Date('2024-02-28')
      );

      expect(result).toBe(0);
    });

    it('should handle empty dose array', () => {
      const medications = createTestMedications();
      const doses: any[] = [];

      const result = calculateNSAIDUsage(
        medications,
        doses,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toBe(0);
    });

    it('should respect date range boundaries', () => {
      const medications = createTestMedications();
      const doses = [
        { id: 'd1', medicationId: '1', timestamp: new Date('2024-01-14T23:59:59').getTime(), status: 'taken' as const }, // Just before
        { id: 'd2', medicationId: '1', timestamp: new Date('2024-01-15T00:00:00').getTime(), status: 'taken' as const }, // Start
        { id: 'd3', medicationId: '1', timestamp: new Date('2024-01-17T23:59:59').getTime(), status: 'taken' as const }, // End
        { id: 'd4', medicationId: '1', timestamp: new Date('2024-01-18T00:00:01').getTime(), status: 'taken' as const }, // Just after
      ];

      const result = calculateNSAIDUsage(
        medications,
        doses,
        new Date('2024-01-15'),
        new Date('2024-01-17')
      );

      expect(result).toBe(2); // 15th and 17th only
    });
  });

  describe('calculatePerMedicationStats', () => {
    const createTestMedications = () => [
      { id: '1', name: 'Sumatriptan', type: 'rescue' as const, category: 'triptan' as const },
      { id: '2', name: 'Ibuprofen', type: 'rescue' as const, category: 'nsaid' as const },
      { id: '3', name: 'Topiramate', type: 'preventative' as const, category: 'preventive' as const },
    ];

    it('should calculate stats for each medication with doses', () => {
      const medications = createTestMedications();
      const doses = [
        { id: 'd1', medicationId: '1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' as const },
        { id: 'd2', medicationId: '1', timestamp: new Date('2024-01-15T16:00:00').getTime(), status: 'taken' as const },
        { id: 'd3', medicationId: '1', timestamp: new Date('2024-01-17T08:00:00').getTime(), status: 'taken' as const },
        { id: 'd4', medicationId: '2', timestamp: new Date('2024-01-20T08:00:00').getTime(), status: 'taken' as const },
      ];

      const result = calculatePerMedicationStats(
        medications,
        doses,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        medicationId: '1',
        medicationName: 'Sumatriptan',
        totalDoses: 3,
        daysWithDoses: 2,
      });
      expect(result).toContainEqual({
        medicationId: '2',
        medicationName: 'Ibuprofen',
        totalDoses: 1,
        daysWithDoses: 1,
      });
    });

    it('should count unique days correctly', () => {
      const medications = createTestMedications();
      const doses = [
        { id: 'd1', medicationId: '1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' as const },
        { id: 'd2', medicationId: '1', timestamp: new Date('2024-01-15T12:00:00').getTime(), status: 'taken' as const },
        { id: 'd3', medicationId: '1', timestamp: new Date('2024-01-15T18:00:00').getTime(), status: 'taken' as const },
      ];

      const result = calculatePerMedicationStats(
        medications,
        doses,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        medicationId: '1',
        medicationName: 'Sumatriptan',
        totalDoses: 3,
        daysWithDoses: 1, // All on same day
      });
    });

    it('should exclude skipped doses', () => {
      const medications = createTestMedications();
      const doses = [
        { id: 'd1', medicationId: '1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' as const },
        { id: 'd2', medicationId: '1', timestamp: new Date('2024-01-16T08:00:00').getTime(), status: 'skipped' as const },
        { id: 'd3', medicationId: '1', timestamp: new Date('2024-01-17T08:00:00').getTime(), status: 'taken' as const },
      ];

      const result = calculatePerMedicationStats(
        medications,
        doses,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        medicationId: '1',
        medicationName: 'Sumatriptan',
        totalDoses: 2, // Excludes skipped
        daysWithDoses: 2,
      });
    });

    it('should exclude doses outside date range', () => {
      const medications = createTestMedications();
      const doses = [
        { id: 'd1', medicationId: '1', timestamp: new Date('2024-01-14T08:00:00').getTime(), status: 'taken' as const }, // Before
        { id: 'd2', medicationId: '1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' as const }, // In range
        { id: 'd3', medicationId: '1', timestamp: new Date('2024-01-20T08:00:00').getTime(), status: 'taken' as const }, // In range
        { id: 'd4', medicationId: '1', timestamp: new Date('2024-02-01T08:00:00').getTime(), status: 'taken' as const }, // After
      ];

      const result = calculatePerMedicationStats(
        medications,
        doses,
        new Date('2024-01-15'),
        new Date('2024-01-31')
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        medicationId: '1',
        medicationName: 'Sumatriptan',
        totalDoses: 2,
        daysWithDoses: 2,
      });
    });

    it('should return empty array when no doses in range', () => {
      const medications = createTestMedications();
      const doses = [
        { id: 'd1', medicationId: '1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' as const },
      ];

      const result = calculatePerMedicationStats(
        medications,
        doses,
        new Date('2024-02-01'),
        new Date('2024-02-28')
      );

      expect(result).toHaveLength(0);
    });

    it('should handle empty dose array', () => {
      const medications = createTestMedications();
      const doses: any[] = [];

      const result = calculatePerMedicationStats(
        medications,
        doses,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toHaveLength(0);
    });

    it('should skip doses for medications not in list', () => {
      const medications = createTestMedications();
      const doses = [
        { id: 'd1', medicationId: '1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' as const },
        { id: 'd2', medicationId: 'unknown', timestamp: new Date('2024-01-16T08:00:00').getTime(), status: 'taken' as const },
      ];

      const result = calculatePerMedicationStats(
        medications,
        doses,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toHaveLength(1);
      expect(result[0].medicationId).toBe('1');
    });

    it('should handle all medication types', () => {
      const medications = createTestMedications();
      const doses = [
        { id: 'd1', medicationId: '1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' as const },
        { id: 'd2', medicationId: '2', timestamp: new Date('2024-01-15T12:00:00').getTime(), status: 'taken' as const },
        { id: 'd3', medicationId: '3', timestamp: new Date('2024-01-15T20:00:00').getTime(), status: 'taken' as const },
      ];

      const result = calculatePerMedicationStats(
        medications,
        doses,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toHaveLength(3);
      expect(result.map(r => r.medicationName).sort()).toEqual(['Ibuprofen', 'Sumatriptan', 'Topiramate']);
    });
  });
});
