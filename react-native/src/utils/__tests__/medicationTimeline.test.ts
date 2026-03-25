import { calculateDayStatus, getLast7DaysTimeline } from '../medicationTimeline';
import { MedicationDose } from '../../models/types';
import { subDays, startOfDay, endOfDay } from 'date-fns';

describe('medicationTimeline', () => {
  const now = Date.now();

  const createDose = (daysAgo: number, status: 'taken' | 'skipped' = 'taken'): MedicationDose => ({
    id: `dose-${daysAgo}-${status}`,
    medicationId: 'med-1',
    timestamp: now - (daysAgo * 24 * 60 * 60 * 1000),
    quantity: status === 'taken' ? 1 : 0,
    status,
    createdAt: now,
    updatedAt: now,
  });

  describe('calculateDayStatus', () => {
    it('should return taken=true when day has taken doses', () => {
      const doses = [createDose(0, 'taken')];
      const dayStart = startOfDay(new Date()).getTime();
      const dayEnd = endOfDay(new Date()).getTime();

      const result = calculateDayStatus(doses, dayStart, dayEnd);

      expect(result.taken).toBe(true);
      expect(result.skipped).toBe(false);
    });

    it('should return skipped=true when all doses are skipped', () => {
      const doses = [createDose(0, 'skipped')];
      const dayStart = startOfDay(new Date()).getTime();
      const dayEnd = endOfDay(new Date()).getTime();

      const result = calculateDayStatus(doses, dayStart, dayEnd);

      expect(result.taken).toBe(false);
      expect(result.skipped).toBe(true);
    });

    it('should return taken=true when day has both taken and skipped doses', () => {
      const doses = [
        createDose(0, 'taken'),
        createDose(0, 'skipped'),
      ];
      const dayStart = startOfDay(new Date()).getTime();
      const dayEnd = endOfDay(new Date()).getTime();

      const result = calculateDayStatus(doses, dayStart, dayEnd);

      expect(result.taken).toBe(true);
      expect(result.skipped).toBe(false); // Not ALL skipped
    });

    it('should return both false when day has no doses', () => {
      const doses: MedicationDose[] = [];
      const dayStart = startOfDay(new Date()).getTime();
      const dayEnd = endOfDay(new Date()).getTime();

      const result = calculateDayStatus(doses, dayStart, dayEnd);

      expect(result.taken).toBe(false);
      expect(result.skipped).toBe(false);
    });

    it('should only count doses within the day range', () => {
      const doses = [
        createDose(0, 'taken'), // Today
        createDose(1, 'skipped'), // Yesterday - should not affect today
      ];
      const dayStart = startOfDay(new Date()).getTime();
      const dayEnd = endOfDay(new Date()).getTime();

      const result = calculateDayStatus(doses, dayStart, dayEnd);

      expect(result.taken).toBe(true);
      expect(result.skipped).toBe(false); // Yesterday's skip doesn't count
    });

    it('should handle multiple skipped doses on same day', () => {
      const doses = [
        createDose(0, 'skipped'),
        createDose(0, 'skipped'),
        createDose(0, 'skipped'),
      ];
      const dayStart = startOfDay(new Date()).getTime();
      const dayEnd = endOfDay(new Date()).getTime();

      const result = calculateDayStatus(doses, dayStart, dayEnd);

      expect(result.taken).toBe(false);
      expect(result.skipped).toBe(true);
    });
  });

  describe('getLast7DaysTimeline', () => {
    it('should return 7 days by default', () => {
      const doses: MedicationDose[] = [];
      const timeline = getLast7DaysTimeline(doses);

      expect(timeline).toHaveLength(7);
    });

    it('should return correct number of days when specified', () => {
      const doses: MedicationDose[] = [];
      const timeline = getLast7DaysTimeline(doses, 14);

      expect(timeline).toHaveLength(14);
    });

    it('should order days from oldest to newest', () => {
      const doses: MedicationDose[] = [];
      const timeline = getLast7DaysTimeline(doses);

      for (let i = 1; i < timeline.length; i++) {
        expect(timeline[i].date.getTime()).toBeGreaterThan(timeline[i - 1].date.getTime());
      }
    });

    it('should correctly map taken doses to timeline', () => {
      const doses = [
        createDose(0, 'taken'), // Today
        createDose(2, 'taken'), // 2 days ago
      ];
      const timeline = getLast7DaysTimeline(doses);

      expect(timeline[timeline.length - 1].taken).toBe(true); // Today
      expect(timeline[timeline.length - 3].taken).toBe(true); // 2 days ago
      expect(timeline[timeline.length - 2].taken).toBe(false); // Yesterday - no dose
    });

    it('should correctly map skipped doses to timeline', () => {
      const doses = [
        createDose(1, 'skipped'), // Yesterday
        createDose(3, 'skipped'), // 3 days ago
      ];
      const timeline = getLast7DaysTimeline(doses);

      expect(timeline[timeline.length - 2].skipped).toBe(true); // Yesterday
      expect(timeline[timeline.length - 4].skipped).toBe(true); // 3 days ago
      expect(timeline[timeline.length - 1].skipped).toBe(false); // Today - no dose
    });

    it('should handle mixed taken and skipped doses', () => {
      const doses = [
        createDose(0, 'taken'),
        createDose(1, 'skipped'),
        createDose(2, 'taken'),
        createDose(3, 'skipped'),
      ];
      const timeline = getLast7DaysTimeline(doses);

      expect(timeline[timeline.length - 1].taken).toBe(true);
      expect(timeline[timeline.length - 2].skipped).toBe(true);
      expect(timeline[timeline.length - 3].taken).toBe(true);
      expect(timeline[timeline.length - 4].skipped).toBe(true);
    });

    it('should return all false status for days with no doses', () => {
      const doses: MedicationDose[] = [];
      const timeline = getLast7DaysTimeline(doses);

      timeline.forEach(day => {
        expect(day.taken).toBe(false);
        expect(day.skipped).toBe(false);
      });
    });

    it('should include date property for each day', () => {
      const doses: MedicationDose[] = [];
      const timeline = getLast7DaysTimeline(doses);

      timeline.forEach(day => {
        expect(day.date).toBeInstanceOf(Date);
      });
    });

    it('should match subDays calculation for each day', () => {
      const doses: MedicationDose[] = [];
      const timeline = getLast7DaysTimeline(doses);

      timeline.forEach((day, index) => {
        const expectedDate = subDays(new Date(), 6 - index);
        const expectedDay = startOfDay(expectedDate);

        expect(startOfDay(day.date).getTime()).toBe(expectedDay.getTime());
      });
    });
  });
});
