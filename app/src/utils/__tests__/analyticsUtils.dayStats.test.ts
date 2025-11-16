/**
 * Comprehensive tests for day statistics calculations
 * These tests verify the correctness of day categorization and prevent regression
 */

import {
  getDateRangeForDays,
  calculateMigraineDays,
  categorizeDays,
} from '../analyticsUtils';

describe('Day Statistics Calculations', () => {
  // Test data setup
  const createEpisode = (startTime: Date, endTime?: Date) => ({
    id: Math.random().toString(),
    startTime: startTime.getTime(),
    endTime: endTime?.getTime(),
  });

  const createDailyStatus = (date: string, status: 'green' | 'yellow' | 'red') => ({
    id: Math.random().toString(),
    date, // YYYY-MM-DD format
    status,
  });

  describe('getDateRangeForDays', () => {
    it('should return correct date range for 30 days', () => {
      const { startDate, endDate } = getDateRangeForDays(30);

      // Normalize to midnight for comparison
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);

      const diffDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(30); // getDateRangeForDays(30) goes back 30 days, creating a 31-day range (inclusive)
    });
  });

  describe('categorizeDays - 30 day scenario', () => {
    it('should correctly categorize days with full coverage', () => {
      // Create a 30-day range
      const endDate = new Date('2025-11-15T23:59:59');
      const startDate = new Date('2025-10-17T00:00:00');

      // Create daily status for all 30 days
      const dailyStatuses = [
        // 8 green days
        createDailyStatus('2025-11-09', 'green'),
        createDailyStatus('2025-11-08', 'green'),
        createDailyStatus('2025-11-07', 'green'),
        createDailyStatus('2025-11-04', 'green'),
        createDailyStatus('2025-11-03', 'green'),
        createDailyStatus('2025-10-27', 'green'),
        createDailyStatus('2025-10-24', 'green'),
        createDailyStatus('2025-10-22', 'green'),
        // 6 yellow days
        createDailyStatus('2025-11-02', 'yellow'),
        createDailyStatus('2025-10-29', 'yellow'),
        createDailyStatus('2025-10-28', 'yellow'),
        createDailyStatus('2025-10-21', 'yellow'),
        createDailyStatus('2025-10-20', 'yellow'),
        createDailyStatus('2025-10-17', 'yellow'),
        // 13 red days
        createDailyStatus('2025-11-13', 'red'),
        createDailyStatus('2025-11-11', 'red'),
        createDailyStatus('2025-11-10', 'red'),
        createDailyStatus('2025-11-06', 'red'),
        createDailyStatus('2025-11-05', 'red'),
        createDailyStatus('2025-11-01', 'red'),
        createDailyStatus('2025-10-31', 'red'),
        createDailyStatus('2025-10-30', 'red'),
        createDailyStatus('2025-10-26', 'red'),
        createDailyStatus('2025-10-25', 'red'),
        createDailyStatus('2025-10-23', 'red'),
        createDailyStatus('2025-10-19', 'red'),
        createDailyStatus('2025-10-18', 'red'),
        // Missing days: 11-12, 11-14, 11-15 = 3 untracked
      ];

      const result = categorizeDays(dailyStatuses, startDate, endDate);

      expect(result.clear).toBe(8); // green
      expect(result.unclear).toBe(19); // yellow (6) + red (13)
      expect(result.untracked).toBe(3); // 30 - 8 - 19

      // Total should always equal the date range
      expect(result.clear + result.unclear + result.untracked).toBe(30);
    });

    it('should handle no daily status entries', () => {
      const endDate = new Date('2025-11-15T23:59:59');
      const startDate = new Date('2025-10-17T00:00:00');

      const result = categorizeDays([], startDate, endDate);

      expect(result.clear).toBe(0);
      expect(result.unclear).toBe(0);
      expect(result.untracked).toBe(30);
    });

    it('should handle all days tracked', () => {
      const endDate = new Date('2025-11-15T23:59:59');
      const startDate = new Date('2025-10-17T00:00:00');

      // Create 30 days of statuses
      const dailyStatuses = [];
      const current = new Date('2025-10-17');
      for (let i = 0; i < 30; i++) {
        const dateStr = current.toISOString().split('T')[0];
        dailyStatuses.push(createDailyStatus(dateStr, 'green'));
        current.setDate(current.getDate() + 1);
      }

      const result = categorizeDays(dailyStatuses, startDate, endDate);

      expect(result.clear).toBe(30);
      expect(result.unclear).toBe(0);
      expect(result.untracked).toBe(0);
    });
  });

  describe('calculateMigraineDays - 30 day scenario', () => {
    it('should count unique days with episodes', () => {
      const endDate = new Date('2025-11-15T23:59:59');
      const startDate = new Date('2025-10-17T00:00:00');

      // Create episodes on 10 unique days
      const episodes = [
        createEpisode(new Date('2025-11-13T10:00:00'), new Date('2025-11-13T15:00:00')),
        createEpisode(new Date('2025-11-11T10:00:00'), new Date('2025-11-11T15:00:00')),
        createEpisode(new Date('2025-11-10T10:00:00'), new Date('2025-11-10T15:00:00')),
        createEpisode(new Date('2025-11-06T10:00:00'), new Date('2025-11-06T15:00:00')),
        createEpisode(new Date('2025-11-01T10:00:00'), new Date('2025-11-01T15:00:00')),
        createEpisode(new Date('2025-10-31T10:00:00'), new Date('2025-10-31T15:00:00')),
        createEpisode(new Date('2025-10-26T10:00:00'), new Date('2025-10-26T15:00:00')),
        createEpisode(new Date('2025-10-23T10:00:00'), new Date('2025-10-23T15:00:00')),
        createEpisode(new Date('2025-10-19T10:00:00'), new Date('2025-10-19T15:00:00')),
        createEpisode(new Date('2025-10-18T10:00:00'), new Date('2025-10-18T15:00:00')),
      ];

      const result = calculateMigraineDays(episodes, startDate, endDate);
      expect(result).toBe(10);
    });

    it('should count episodes spanning multiple days correctly', () => {
      const endDate = new Date('2025-11-15T23:59:59');
      const startDate = new Date('2025-10-17T00:00:00');

      // Create an episode that spans 2 days
      const episodes = [
        createEpisode(new Date('2025-11-01T22:00:00'), new Date('2025-11-02T02:00:00')),
      ];

      const result = calculateMigraineDays(episodes, startDate, endDate);
      expect(result).toBe(2); // Should count both Nov 1 and Nov 2
    });

    it('should handle multiple episodes on same day', () => {
      const endDate = new Date('2025-11-15T23:59:59');
      const startDate = new Date('2025-10-17T00:00:00');

      // Create multiple episodes on the same day
      const episodes = [
        createEpisode(new Date('2025-11-01T10:00:00'), new Date('2025-11-01T12:00:00')),
        createEpisode(new Date('2025-11-01T15:00:00'), new Date('2025-11-01T17:00:00')),
        createEpisode(new Date('2025-11-01T20:00:00'), new Date('2025-11-01T22:00:00')),
      ];

      const result = calculateMigraineDays(episodes, startDate, endDate);
      expect(result).toBe(1); // Should count Nov 1 only once
    });
  });

  describe('Percentage calculations', () => {
    it('should calculate percentages that sum to 100%', () => {
      const totalDays = 30;
      const clear = 8;
      const unclear = 19;
      const untracked = 3;

      const clearPercent = Math.round((clear / totalDays) * 100);
      const unclearPercent = Math.round((unclear / totalDays) * 100);
      const untrackedPercent = Math.round((untracked / totalDays) * 100);

      // Note: Due to rounding, percentages may not sum to exactly 100%
      // But they should be close (within 2%)
      const sum = clearPercent + unclearPercent + untrackedPercent;
      expect(sum).toBeGreaterThanOrEqual(98);
      expect(sum).toBeLessThanOrEqual(102);

      expect(clearPercent).toBe(27); // 8/30 = 26.67% -> 27%
      expect(unclearPercent).toBe(63); // 19/30 = 63.33% -> 63%
      expect(untrackedPercent).toBe(10); // 3/30 = 10%
      // Sum: 27 + 63 + 10 = 100%
    });
  });

  describe('Integration test with realistic data', () => {
    it('should match database query results for 30-day period', () => {
      // This test uses the same data as the test database
      const endDate = new Date('2025-11-15T23:59:59');
      const startDate = new Date('2025-10-17T00:00:00');

      // Daily status data from database (27 entries for 30-day period)
      const dailyStatuses = [
        createDailyStatus('2025-11-13', 'red'),
        createDailyStatus('2025-11-11', 'red'),
        createDailyStatus('2025-11-10', 'red'),
        createDailyStatus('2025-11-09', 'green'),
        createDailyStatus('2025-11-08', 'green'),
        createDailyStatus('2025-11-07', 'green'),
        createDailyStatus('2025-11-06', 'red'),
        createDailyStatus('2025-11-05', 'red'),
        createDailyStatus('2025-11-04', 'green'),
        createDailyStatus('2025-11-03', 'green'),
        createDailyStatus('2025-11-02', 'yellow'),
        createDailyStatus('2025-11-01', 'red'),
        createDailyStatus('2025-10-31', 'red'),
        createDailyStatus('2025-10-30', 'red'),
        createDailyStatus('2025-10-29', 'yellow'),
        createDailyStatus('2025-10-28', 'yellow'),
        createDailyStatus('2025-10-27', 'green'),
        createDailyStatus('2025-10-26', 'red'),
        createDailyStatus('2025-10-25', 'red'),
        createDailyStatus('2025-10-24', 'green'),
        createDailyStatus('2025-10-23', 'red'),
        createDailyStatus('2025-10-22', 'green'),
        createDailyStatus('2025-10-21', 'yellow'),
        createDailyStatus('2025-10-20', 'yellow'),
        createDailyStatus('2025-10-19', 'red'),
        createDailyStatus('2025-10-18', 'red'),
        createDailyStatus('2025-10-17', 'yellow'),
      ];

      const result = categorizeDays(dailyStatuses, startDate, endDate);

      // Expected counts from manual counting:
      // Green: 09, 08, 07, 04, 03, 27, 24, 22 = 8
      // Yellow: 02, 29, 28, 21, 20, 17 = 6
      // Red: 13, 11, 10, 06, 05, 01, 31, 30, 26, 25, 23, 19, 18 = 13
      // Untracked: 12, 14, 15 = 3
      expect(result.clear).toBe(8);
      expect(result.unclear).toBe(19); // 6 yellow + 13 red
      expect(result.untracked).toBe(3);

      // Verify percentages
      const clearPercent = Math.round((result.clear / 30) * 100);
      const unclearPercent = Math.round((result.unclear / 30) * 100);
      const untrackedPercent = Math.round((result.untracked / 30) * 100);

      expect(clearPercent).toBe(27);
      expect(unclearPercent).toBe(63);
      expect(untrackedPercent).toBe(10);
    });
  });
});
