import {
  DailyStatusLogSchema,
  DayStatusSchema,
  YellowDayTypeSchema,
  DateStringSchema,
} from '../dailyStatus.schema';

describe('Daily Status Validation Schemas', () => {
  describe('DayStatusSchema', () => {
    it('should accept valid day statuses', () => {
      expect(DayStatusSchema.parse('green')).toBe('green');
      expect(DayStatusSchema.parse('yellow')).toBe('yellow');
      expect(DayStatusSchema.parse('red')).toBe('red');
    });

    it('should reject invalid day statuses', () => {
      const result = DayStatusSchema.safeParse('orange');
      expect(result.success).toBe(false);
    });
  });

  describe('YellowDayTypeSchema', () => {
    it('should accept valid yellow day types', () => {
      expect(YellowDayTypeSchema.parse('prodrome')).toBe('prodrome');
      expect(YellowDayTypeSchema.parse('postdrome')).toBe('postdrome');
      expect(YellowDayTypeSchema.parse('anxiety')).toBe('anxiety');
      expect(YellowDayTypeSchema.parse('other')).toBe('other');
    });

    it('should reject invalid yellow day types', () => {
      const result = YellowDayTypeSchema.safeParse('invalid');
      expect(result.success).toBe(false);
    });
  });

  describe('DateStringSchema', () => {
    it('should accept valid date strings (YYYY-MM-DD)', () => {
      expect(DateStringSchema.parse('2025-01-15')).toBe('2025-01-15');
      expect(DateStringSchema.parse('2024-12-31')).toBe('2024-12-31');
    });

    it('should reject invalid date format', () => {
      const result = DateStringSchema.safeParse('15-01-2025');
      expect(result.success).toBe(false);
    });

    it('should reject invalid date string', () => {
      const result = DateStringSchema.safeParse('2025-13-01');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Invalid date string');
      }
    });

    it('should reject future date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const dateStr = futureDate.toISOString().split('T')[0];

      const result = DateStringSchema.safeParse(dateStr);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Date cannot be in the future');
      }
    });

    it('should accept today\'s date', () => {
      const today = new Date().toISOString().split('T')[0];
      const result = DateStringSchema.safeParse(today);
      expect(result.success).toBe(true);
    });

    it('should accept past date', () => {
      const result = DateStringSchema.safeParse('2024-01-01');
      expect(result.success).toBe(true);
    });
  });

  describe('DailyStatusLogSchema', () => {
    const validLog = {
      id: 'log-123',
      date: '2025-01-15',
      status: 'green' as const,
      prompted: false,
      createdAt: 1000,
      updatedAt: 1000,
    };

    it('should accept valid daily status log', () => {
      const result = DailyStatusLogSchema.safeParse(validLog);
      expect(result.success).toBe(true);
    });

    it('should accept yellow day with status type', () => {
      const log = {
        ...validLog,
        status: 'yellow' as const,
        statusType: 'prodrome' as const,
      };
      const result = DailyStatusLogSchema.safeParse(log);
      expect(result.success).toBe(true);
    });

    it('should reject non-yellow day with status type', () => {
      const log = {
        ...validLog,
        status: 'green' as const,
        statusType: 'prodrome' as const,
      };
      const result = DailyStatusLogSchema.safeParse(log);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Status type can only be set for yellow days');
      }
    });

    it('should reject log with invalid date format', () => {
      const log = { ...validLog, date: '01-15-2025' };
      const result = DailyStatusLogSchema.safeParse(log);
      expect(result.success).toBe(false);
    });

    it('should reject log with notes > 5000 characters', () => {
      const log = { ...validLog, notes: 'x'.repeat(5001) };
      const result = DailyStatusLogSchema.safeParse(log);
      expect(result.success).toBe(false);
    });

    it('should accept log with valid notes', () => {
      const log = { ...validLog, notes: 'Feeling good today' };
      const result = DailyStatusLogSchema.safeParse(log);
      expect(result.success).toBe(true);
    });

    it('should reject log with future date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const dateStr = futureDate.toISOString().split('T')[0];

      const log = { ...validLog, date: dateStr };
      const result = DailyStatusLogSchema.safeParse(log);
      expect(result.success).toBe(false);
    });
  });
});
