import { groupEventsByDay, groupEventsByTimestamp, TimelineEvent, DayGroup } from '../timelineGrouping';
import { startOfDay } from 'date-fns';

describe('timelineGrouping', () => {
  describe('groupEventsByDay', () => {
    it('should return empty array for no events', () => {
      const result = groupEventsByDay([], Date.now(), null);
      expect(result).toEqual([]);
    });

    it('should group events from the same day together', () => {
      const day1Start = new Date('2025-10-14T08:00:00').getTime();
      const day1Middle = new Date('2025-10-14T12:00:00').getTime();
      const day1End = new Date('2025-10-14T18:00:00').getTime();

      const events: TimelineEvent[] = [
        { id: '1', timestamp: day1Start, type: 'intensity', data: { intensity: 5 } },
        { id: '2', timestamp: day1Middle, type: 'medication', data: {} },
        { id: '3', timestamp: day1End, type: 'intensity', data: { intensity: 7 } },
      ];

      const result = groupEventsByDay(events, day1Start, null);

      expect(result).toHaveLength(1);
      expect(result[0].events).toHaveLength(3);
      expect(result[0].dateLabel).toContain('Oct 14');
    });

    it('should split events across multiple days', () => {
      const day1 = new Date('2025-10-14T08:00:00').getTime();
      const day2 = new Date('2025-10-15T10:00:00').getTime();
      const day3 = new Date('2025-10-16T14:00:00').getTime();

      const events: TimelineEvent[] = [
        { id: '1', timestamp: day1, type: 'intensity', data: { intensity: 5 } },
        { id: '2', timestamp: day2, type: 'medication', data: {} },
        { id: '3', timestamp: day3, type: 'intensity', data: { intensity: 3 } },
      ];

      const result = groupEventsByDay(events, day1, null);

      expect(result).toHaveLength(3);
      expect(result[0].events).toHaveLength(1);
      expect(result[1].events).toHaveLength(1);
      expect(result[2].events).toHaveLength(1);
    });

    it('should sort events within each day by timestamp', () => {
      const day1 = startOfDay(new Date('2025-10-14')).getTime();
      const time1 = day1 + 10 * 60 * 60 * 1000; // 10am
      const time2 = day1 + 8 * 60 * 60 * 1000;  // 8am
      const time3 = day1 + 15 * 60 * 60 * 1000; // 3pm

      // Add events in random order
      const events: TimelineEvent[] = [
        { id: '1', timestamp: time1, type: 'intensity', data: { intensity: 5 } },
        { id: '2', timestamp: time2, type: 'medication', data: {} },
        { id: '3', timestamp: time3, type: 'intensity', data: { intensity: 7 } },
      ];

      const result = groupEventsByDay(events, time2, null);

      expect(result).toHaveLength(1);
      // Events should be sorted 8am, 10am, 3pm
      expect(result[0].events[0].timestamp).toBe(time2);
      expect(result[0].events[1].timestamp).toBe(time1);
      expect(result[0].events[2].timestamp).toBe(time3);
    });

    it('should sort days chronologically', () => {
      const day1 = new Date('2025-10-14T08:00:00').getTime();
      const day2 = new Date('2025-10-15T10:00:00').getTime();
      const day3 = new Date('2025-10-16T14:00:00').getTime();

      // Add events in reverse order
      const events: TimelineEvent[] = [
        { id: '3', timestamp: day3, type: 'intensity', data: { intensity: 3 } },
        { id: '1', timestamp: day1, type: 'intensity', data: { intensity: 5 } },
        { id: '2', timestamp: day2, type: 'medication', data: {} },
      ];

      const result = groupEventsByDay(events, day1, null);

      expect(result).toHaveLength(3);
      expect(result[0].date).toBe(startOfDay(day1).getTime());
      expect(result[1].date).toBe(startOfDay(day2).getTime());
      expect(result[2].date).toBe(startOfDay(day3).getTime());
    });
  });

  describe('day statistics', () => {
    it('should calculate peak intensity correctly', () => {
      const day1 = new Date('2025-10-14T08:00:00').getTime();

      const events: TimelineEvent[] = [
        { id: '1', timestamp: day1, type: 'intensity', data: { intensity: 5 } },
        { id: '2', timestamp: day1 + 3600000, type: 'intensity', data: { intensity: 8 } },
        { id: '3', timestamp: day1 + 7200000, type: 'intensity', data: { intensity: 3 } },
      ];

      const result = groupEventsByDay(events, day1, null);

      expect(result[0].stats.peakIntensity).toBe(8);
    });

    it('should calculate average intensity correctly', () => {
      const day1 = new Date('2025-10-14T08:00:00').getTime();

      const events: TimelineEvent[] = [
        { id: '1', timestamp: day1, type: 'intensity', data: { intensity: 4 } },
        { id: '2', timestamp: day1 + 3600000, type: 'intensity', data: { intensity: 6 } },
        { id: '3', timestamp: day1 + 7200000, type: 'intensity', data: { intensity: 8 } },
      ];

      const result = groupEventsByDay(events, day1, null);

      expect(result[0].stats.averageIntensity).toBe(6); // (4 + 6 + 8) / 3
    });

    it('should count medications correctly', () => {
      const day1 = new Date('2025-10-14T08:00:00').getTime();

      const events: TimelineEvent[] = [
        { id: '1', timestamp: day1, type: 'medication', data: {} },
        { id: '2', timestamp: day1 + 3600000, type: 'intensity', data: { intensity: 5 } },
        { id: '3', timestamp: day1 + 7200000, type: 'medication', data: {} },
        { id: '4', timestamp: day1 + 10800000, type: 'medication', data: {} },
      ];

      const result = groupEventsByDay(events, day1, null);

      expect(result[0].stats.medicationCount).toBe(3);
    });

    it('should handle days with no intensity readings', () => {
      const day1 = new Date('2025-10-14T08:00:00').getTime();

      const events: TimelineEvent[] = [
        { id: '1', timestamp: day1, type: 'medication', data: {} },
        { id: '2', timestamp: day1 + 3600000, type: 'note', data: {} },
      ];

      const result = groupEventsByDay(events, day1, null);

      expect(result[0].stats.peakIntensity).toBeNull();
      expect(result[0].stats.averageIntensity).toBeNull();
    });

    it('should calculate hours in day for full day', () => {
      const day1Start = new Date('2025-10-14T00:00:00').getTime();
      const day1End = new Date('2025-10-15T00:00:00').getTime() - 1; // Last millisecond of day 1

      const events: TimelineEvent[] = [
        { id: '1', timestamp: day1Start, type: 'intensity', data: { intensity: 5 } },
      ];

      const result = groupEventsByDay(events, day1Start, day1End);

      // Should be close to 24 hours (23-24 due to rounding)
      expect(result[0].stats.hoursInDay).toBeGreaterThanOrEqual(23);
      expect(result[0].stats.hoursInDay).toBeLessThanOrEqual(24);
    });

    it('should calculate hours in day for partial day', () => {
      const day1Start = new Date('2025-10-14T08:00:00').getTime(); // 8am
      const day1End = new Date('2025-10-14T14:00:00').getTime();   // 2pm

      const events: TimelineEvent[] = [
        { id: '1', timestamp: day1Start, type: 'intensity', data: { intensity: 5 } },
      ];

      const result = groupEventsByDay(events, day1Start, day1End);

      expect(result[0].stats.hoursInDay).toBe(6); // 8am to 2pm = 6 hours
    });
  });

  describe('groupEventsByTimestamp', () => {
    it('should group events with same timestamp', () => {
      const time1 = Date.now();
      const time2 = time1 + 1000;

      const events: TimelineEvent[] = [
        { id: '1', timestamp: time1, type: 'intensity', data: {} },
        { id: '2', timestamp: time1, type: 'medication', data: {} },
        { id: '3', timestamp: time2, type: 'note', data: {} },
      ];

      const result = groupEventsByTimestamp(events);

      expect(result).toHaveLength(2);
      expect(result[0].events).toHaveLength(2); // time1 has 2 events
      expect(result[1].events).toHaveLength(1); // time2 has 1 event
    });

    it('should sort grouped timestamps chronologically', () => {
      const time1 = new Date('2025-10-14T08:00:00').getTime();
      const time2 = new Date('2025-10-14T10:00:00').getTime();
      const time3 = new Date('2025-10-14T12:00:00').getTime();

      // Add in reverse order
      const events: TimelineEvent[] = [
        { id: '3', timestamp: time3, type: 'intensity', data: {} },
        { id: '1', timestamp: time1, type: 'medication', data: {} },
        { id: '2', timestamp: time2, type: 'note', data: {} },
      ];

      const result = groupEventsByTimestamp(events);

      expect(result).toHaveLength(3);
      expect(result[0].timestamp).toBe(time1);
      expect(result[1].timestamp).toBe(time2);
      expect(result[2].timestamp).toBe(time3);
    });

    it('should return empty array for no events', () => {
      const result = groupEventsByTimestamp([]);
      expect(result).toEqual([]);
    });
  });

  describe('multi-day episode scenarios', () => {
    it('should handle 3-day episode correctly', () => {
      const day1 = new Date('2025-10-14T20:00:00').getTime(); // Start at 8pm
      const day2Morning = new Date('2025-10-15T08:00:00').getTime();
      const day2Evening = new Date('2025-10-15T18:00:00').getTime();
      const day3 = new Date('2025-10-16T10:00:00').getTime(); // End at 10am

      const events: TimelineEvent[] = [
        { id: '1', timestamp: day1, type: 'intensity', data: { intensity: 7 } },
        { id: '2', timestamp: day2Morning, type: 'intensity', data: { intensity: 8 } },
        { id: '3', timestamp: day2Morning + 1000, type: 'medication', data: {} },
        { id: '4', timestamp: day2Evening, type: 'intensity', data: { intensity: 5 } },
        { id: '5', timestamp: day3, type: 'intensity', data: { intensity: 3 } },
        { id: '6', timestamp: day3 + 1000, type: 'end', data: null },
      ];

      const result = groupEventsByDay(events, day1, day3);

      // Should have 3 days
      expect(result).toHaveLength(3);

      // Day 1: 1 event (intensity at 8pm)
      expect(result[0].events).toHaveLength(1);
      expect(result[0].stats.peakIntensity).toBe(7);

      // Day 2: 3 events (intensity + medication in morning, intensity in evening)
      expect(result[1].events).toHaveLength(3);
      expect(result[1].stats.peakIntensity).toBe(8);
      expect(result[1].stats.medicationCount).toBe(1);

      // Day 3: 2 events (intensity + end)
      expect(result[2].events).toHaveLength(2);
      expect(result[2].stats.peakIntensity).toBe(3);
    });
  });
});
