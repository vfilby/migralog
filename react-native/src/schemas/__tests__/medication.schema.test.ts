import {
  MedicationSchema,
  MedicationScheduleSchema,
  MedicationDoseSchema,
  MedicationReminderSchema,
  MedicationTypeSchema,
  ScheduleFrequencySchema,
  DoseStatusSchema,
  TimeStringSchema,
  EffectivenessRatingSchema,
} from '../medication.schema';

describe('Medication Validation Schemas', () => {
  describe('MedicationTypeSchema', () => {
    it('should accept valid medication types', () => {
      expect(MedicationTypeSchema.parse('preventative')).toBe('preventative');
      expect(MedicationTypeSchema.parse('rescue')).toBe('rescue');
    });

    it('should reject invalid medication types', () => {
      const result = MedicationTypeSchema.safeParse('invalid');
      expect(result.success).toBe(false);
    });
  });

  describe('ScheduleFrequencySchema', () => {
    it('should accept valid schedule frequencies', () => {
      expect(ScheduleFrequencySchema.parse('daily')).toBe('daily');
      expect(ScheduleFrequencySchema.parse('monthly')).toBe('monthly');
      expect(ScheduleFrequencySchema.parse('quarterly')).toBe('quarterly');
    });

    it('should reject invalid schedule frequencies', () => {
      const result = ScheduleFrequencySchema.safeParse('weekly');
      expect(result.success).toBe(false);
    });
  });

  describe('DoseStatusSchema', () => {
    it('should accept valid dose statuses', () => {
      expect(DoseStatusSchema.parse('taken')).toBe('taken');
      expect(DoseStatusSchema.parse('skipped')).toBe('skipped');
    });

    it('should reject invalid dose statuses', () => {
      const result = DoseStatusSchema.safeParse('cancelled');
      expect(result.success).toBe(false);
    });
  });

  describe('TimeStringSchema', () => {
    it('should accept valid time strings (HH:mm)', () => {
      expect(TimeStringSchema.parse('00:00')).toBe('00:00');
      expect(TimeStringSchema.parse('09:30')).toBe('09:30');
      expect(TimeStringSchema.parse('23:59')).toBe('23:59');
    });

    it('should reject time with invalid format', () => {
      const result = TimeStringSchema.safeParse('9:30');
      expect(result.success).toBe(false);
    });

    it('should reject time with hours > 23', () => {
      const result = TimeStringSchema.safeParse('24:00');
      expect(result.success).toBe(false);
    });

    it('should reject time with minutes > 59', () => {
      const result = TimeStringSchema.safeParse('12:60');
      expect(result.success).toBe(false);
    });

    it('should reject non-time string', () => {
      const result = TimeStringSchema.safeParse('not a time');
      expect(result.success).toBe(false);
    });
  });

  describe('EffectivenessRatingSchema', () => {
    it('should accept valid effectiveness ratings (0-10)', () => {
      expect(EffectivenessRatingSchema.parse(0)).toBe(0);
      expect(EffectivenessRatingSchema.parse(5)).toBe(5);
      expect(EffectivenessRatingSchema.parse(10)).toBe(10);
    });

    it('should reject rating below 0', () => {
      const result = EffectivenessRatingSchema.safeParse(-1);
      expect(result.success).toBe(false);
    });

    it('should reject rating above 10', () => {
      const result = EffectivenessRatingSchema.safeParse(11);
      expect(result.success).toBe(false);
    });
  });

  describe('MedicationSchema', () => {
    const validMedication = {
      id: 'med-123',
      name: 'Test Medicine',
      type: 'rescue' as const,
      dosageAmount: 50,
      dosageUnit: 'mg',
      defaultQuantity: 1,
      active: true,
      createdAt: 1000,
      updatedAt: 1000,
    };

    it('should accept valid medication', () => {
      const result = MedicationSchema.safeParse(validMedication);
      expect(result.success).toBe(true);
    });

    it('should accept preventative medication with schedule frequency', () => {
      const med = {
        ...validMedication,
        type: 'preventative' as const,
        scheduleFrequency: 'daily' as const,
      };
      const result = MedicationSchema.safeParse(med);
      expect(result.success).toBe(true);
    });

    it('should allow preventative medication without schedule frequency', () => {
      const med = { ...validMedication, type: 'preventative' as const };
      const result = MedicationSchema.safeParse(med);
      expect(result.success).toBe(true);
    });

    it('should reject medication with empty name', () => {
      const med = { ...validMedication, name: '' };
      const result = MedicationSchema.safeParse(med);
      expect(result.success).toBe(false);
    });

    it('should reject medication with name > 200 characters', () => {
      const med = { ...validMedication, name: 'x'.repeat(201) };
      const result = MedicationSchema.safeParse(med);
      expect(result.success).toBe(false);
    });

    it('should reject medication with negative dosage amount', () => {
      const med = { ...validMedication, dosageAmount: -1 };
      const result = MedicationSchema.safeParse(med);
      expect(result.success).toBe(false);
    });

    it('should reject medication with notes > 5000 characters', () => {
      const med = { ...validMedication, notes: 'x'.repeat(5001) };
      const result = MedicationSchema.safeParse(med);
      expect(result.success).toBe(false);
    });
  });

  describe('MedicationScheduleSchema', () => {
    const validSchedule = {
      id: 'schedule-123',
      medicationId: 'med-123',
      time: '09:00',
      timezone: 'America/Los_Angeles',
      dosage: 1,
      enabled: true,
    };

    it('should accept valid medication schedule', () => {
      const result = MedicationScheduleSchema.safeParse(validSchedule);
      expect(result.success).toBe(true);
    });

    it('should reject schedule with invalid time format', () => {
      const schedule = { ...validSchedule, time: '9:00' };
      const result = MedicationScheduleSchema.safeParse(schedule);
      expect(result.success).toBe(false);
    });

    it('should reject schedule with negative dosage', () => {
      const schedule = { ...validSchedule, dosage: -1 };
      const result = MedicationScheduleSchema.safeParse(schedule);
      expect(result.success).toBe(false);
    });

    it('should reject schedule with zero dosage', () => {
      const schedule = { ...validSchedule, dosage: 0 };
      const result = MedicationScheduleSchema.safeParse(schedule);
      expect(result.success).toBe(false);
    });

    it('should accept valid IANA timezone', () => {
      const schedule = { ...validSchedule, timezone: 'America/New_York' };
      const result = MedicationScheduleSchema.safeParse(schedule);
      expect(result.success).toBe(true);
    });

    it('should reject invalid timezone', () => {
      const schedule = { ...validSchedule, timezone: 'Invalid/Timezone' };
      const result = MedicationScheduleSchema.safeParse(schedule);
      expect(result.success).toBe(false);
    });

    it('should reject empty timezone', () => {
      const schedule = { ...validSchedule, timezone: '' };
      const result = MedicationScheduleSchema.safeParse(schedule);
      expect(result.success).toBe(false);
    });

    it('should reject missing timezone', () => {
      const schedule = { ...validSchedule };
      delete (schedule as any).timezone;
      const result = MedicationScheduleSchema.safeParse(schedule);
      expect(result.success).toBe(false);
    });
  });

  describe('MedicationDoseSchema', () => {
    const validDose = {
      id: 'dose-123',
      medicationId: 'med-123',
      timestamp: 1000,
      quantity: 50,
      status: 'taken' as const,
      createdAt: 1000,
      updatedAt: 1000,
    };

    it('should accept valid medication dose', () => {
      const result = MedicationDoseSchema.safeParse(validDose);
      expect(result.success).toBe(true);
    });

    it('should accept skipped dose with quantity 0', () => {
      const dose = { ...validDose, quantity: 0, status: 'skipped' as const };
      const result = MedicationDoseSchema.safeParse(dose);
      expect(result.success).toBe(true);
    });

    it('should reject taken dose with quantity 0', () => {
      const dose = { ...validDose, quantity: 0, status: 'taken' as const };
      const result = MedicationDoseSchema.safeParse(dose);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Quantity must be positive for taken doses');
      }
    });

    it('should reject dose with negative quantity', () => {
      const dose = { ...validDose, quantity: -1 };
      const result = MedicationDoseSchema.safeParse(dose);
      expect(result.success).toBe(false);
    });

    it('should reject dose with invalid effectiveness rating', () => {
      const dose = { ...validDose, effectivenessRating: 11 };
      const result = MedicationDoseSchema.safeParse(dose);
      expect(result.success).toBe(false);
    });

    it('should reject dose with timeToRelief > 1440', () => {
      const dose = { ...validDose, timeToRelief: 1441 };
      const result = MedicationDoseSchema.safeParse(dose);
      expect(result.success).toBe(false);
    });

    it('should reject dose with notes > 5000 characters', () => {
      const dose = { ...validDose, notes: 'x'.repeat(5001) };
      const result = MedicationDoseSchema.safeParse(dose);
      expect(result.success).toBe(false);
    });
  });

  describe('MedicationReminderSchema', () => {
    const validReminder = {
      id: 'reminder-123',
      medicationId: 'med-123',
      scheduledTime: 1000,
      completed: false,
    };

    it('should accept valid medication reminder', () => {
      const result = MedicationReminderSchema.safeParse(validReminder);
      expect(result.success).toBe(true);
    });

    it('should accept completed reminder with completedAt', () => {
      const reminder = { ...validReminder, completed: true, completedAt: 2000 };
      const result = MedicationReminderSchema.safeParse(reminder);
      expect(result.success).toBe(true);
    });

    it('should reject completed reminder without completedAt', () => {
      const reminder = { ...validReminder, completed: true };
      const result = MedicationReminderSchema.safeParse(reminder);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Completed at timestamp is required when reminder is completed');
      }
    });

    it('should reject reminder with snoozedUntil before scheduledTime', () => {
      const reminder = { ...validReminder, snoozedUntil: 500 };
      const result = MedicationReminderSchema.safeParse(reminder);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Snoozed until time must be after scheduled time');
      }
    });

    it('should accept reminder with valid snoozedUntil', () => {
      const reminder = { ...validReminder, snoozedUntil: 2000 };
      const result = MedicationReminderSchema.safeParse(reminder);
      expect(result.success).toBe(true);
    });
  });
});
