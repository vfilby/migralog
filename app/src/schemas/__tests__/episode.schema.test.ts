import {
  EpisodeSchema,
  IntensityReadingSchema,
  IntensityValueSchema,
  EpisodeNoteSchema,
  SymptomLogSchema,
  PainLocationLogSchema,
  PainLocationSchema,
  PainQualitySchema,
  SymptomSchema,
  TriggerSchema,
} from '../episode.schema';

describe('Episode Validation Schemas', () => {
  describe('IntensityValueSchema', () => {
    it('should accept valid intensity values (0-10)', () => {
      expect(IntensityValueSchema.parse(0)).toBe(0);
      expect(IntensityValueSchema.parse(5)).toBe(5);
      expect(IntensityValueSchema.parse(10)).toBe(10);
    });

    it('should reject intensity below 0', () => {
      const result = IntensityValueSchema.safeParse(-1);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Intensity must be >= 0');
      }
    });

    it('should reject intensity above 10', () => {
      const result = IntensityValueSchema.safeParse(11);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Intensity must be <= 10');
      }
    });
  });

  describe('PainLocationSchema', () => {
    it('should accept valid pain locations', () => {
      expect(PainLocationSchema.parse('left_eye')).toBe('left_eye');
      expect(PainLocationSchema.parse('right_temple')).toBe('right_temple');
    });

    it('should reject invalid pain locations', () => {
      const result = PainLocationSchema.safeParse('invalid_location');
      expect(result.success).toBe(false);
    });
  });

  describe('PainQualitySchema', () => {
    it('should accept valid pain qualities', () => {
      expect(PainQualitySchema.parse('throbbing')).toBe('throbbing');
      expect(PainQualitySchema.parse('sharp')).toBe('sharp');
    });

    it('should reject invalid pain qualities', () => {
      const result = PainQualitySchema.safeParse('invalid_quality');
      expect(result.success).toBe(false);
    });
  });

  describe('SymptomSchema', () => {
    it('should accept valid symptoms', () => {
      expect(SymptomSchema.parse('nausea')).toBe('nausea');
      expect(SymptomSchema.parse('vomiting')).toBe('vomiting');
    });

    it('should reject invalid symptoms', () => {
      const result = SymptomSchema.safeParse('invalid_symptom');
      expect(result.success).toBe(false);
    });
  });

  describe('TriggerSchema', () => {
    it('should accept valid triggers', () => {
      expect(TriggerSchema.parse('stress')).toBe('stress');
      expect(TriggerSchema.parse('weather_change')).toBe('weather_change');
    });

    it('should reject invalid triggers', () => {
      const result = TriggerSchema.safeParse('invalid_trigger');
      expect(result.success).toBe(false);
    });
  });

  describe('EpisodeSchema', () => {
    const validEpisode = {
      id: 'episode-123',
      startTime: 1000,
      endTime: 2000,
      locations: ['left_eye'] as const,
      qualities: ['throbbing'] as const,
      symptoms: ['nausea'] as const,
      triggers: ['stress'] as const,
      notes: 'Test episode',
      createdAt: 1000,
      updatedAt: 2000,
    };

    it('should accept valid episode', () => {
      const result = EpisodeSchema.safeParse(validEpisode);
      expect(result.success).toBe(true);
    });

    it('should accept episode without end time', () => {
      const episode = { ...validEpisode };
      delete (episode as any).endTime;
      const result = EpisodeSchema.safeParse(episode);
      expect(result.success).toBe(true);
    });

    it('should reject episode with endTime before startTime', () => {
      const episode = { ...validEpisode, startTime: 2000, endTime: 1000 };
      const result = EpisodeSchema.safeParse(episode);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('End time must be after start time');
      }
    });

    it('should reject episode with notes > 5000 characters', () => {
      const episode = { ...validEpisode, notes: 'x'.repeat(5001) };
      const result = EpisodeSchema.safeParse(episode);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('5000 characters');
      }
    });

    it('should reject episode with negative startTime', () => {
      const episode = { ...validEpisode, startTime: -1 };
      const result = EpisodeSchema.safeParse(episode);
      expect(result.success).toBe(false);
    });
  });

  describe('IntensityReadingSchema', () => {
    const validReading = {
      id: 'reading-123',
      episodeId: 'episode-123',
      timestamp: 1000,
      intensity: 7,
      createdAt: 1000,
    };

    it('should accept valid intensity reading', () => {
      const result = IntensityReadingSchema.safeParse(validReading);
      expect(result.success).toBe(true);
    });

    it('should reject reading with invalid intensity', () => {
      const reading = { ...validReading, intensity: 11 };
      const result = IntensityReadingSchema.safeParse(reading);
      expect(result.success).toBe(false);
    });

    it('should reject reading with negative timestamp', () => {
      const reading = { ...validReading, timestamp: -1 };
      const result = IntensityReadingSchema.safeParse(reading);
      expect(result.success).toBe(false);
    });
  });

  describe('EpisodeNoteSchema', () => {
    const validNote = {
      id: 'note-123',
      episodeId: 'episode-123',
      timestamp: 1000,
      note: 'Test note',
      createdAt: 1000,
    };

    it('should accept valid episode note', () => {
      const result = EpisodeNoteSchema.safeParse(validNote);
      expect(result.success).toBe(true);
    });

    it('should reject note with empty string', () => {
      const note = { ...validNote, note: '' };
      const result = EpisodeNoteSchema.safeParse(note);
      expect(result.success).toBe(false);
    });

    it('should reject note > 5000 characters', () => {
      const note = { ...validNote, note: 'x'.repeat(5001) };
      const result = EpisodeNoteSchema.safeParse(note);
      expect(result.success).toBe(false);
    });
  });

  describe('SymptomLogSchema', () => {
    const validSymptomLog = {
      id: 'symptom-123',
      episodeId: 'episode-123',
      symptom: 'nausea' as const,
      onsetTime: 1000,
      resolutionTime: 2000,
      severity: 5,
      createdAt: 1000,
    };

    it('should accept valid symptom log', () => {
      const result = SymptomLogSchema.safeParse(validSymptomLog);
      expect(result.success).toBe(true);
    });

    it('should accept symptom log without resolution time', () => {
      const log = { ...validSymptomLog };
      delete (log as any).resolutionTime;
      const result = SymptomLogSchema.safeParse(log);
      expect(result.success).toBe(true);
    });

    it('should reject symptom log with resolutionTime before onsetTime', () => {
      const log = { ...validSymptomLog, onsetTime: 2000, resolutionTime: 1000 };
      const result = SymptomLogSchema.safeParse(log);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Resolution time must be after onset time');
      }
    });

    it('should reject symptom log with invalid severity', () => {
      const log = { ...validSymptomLog, severity: 11 };
      const result = SymptomLogSchema.safeParse(log);
      expect(result.success).toBe(false);
    });
  });

  describe('PainLocationLogSchema', () => {
    const validLocationLog = {
      id: 'location-123',
      episodeId: 'episode-123',
      timestamp: 1000,
      painLocations: ['left_eye', 'right_temple'] as const,
      createdAt: 1000,
    };

    it('should accept valid pain location log', () => {
      const result = PainLocationLogSchema.safeParse(validLocationLog);
      expect(result.success).toBe(true);
    });

    it('should reject pain location log with empty locations', () => {
      const log = { ...validLocationLog, painLocations: [] };
      const result = PainLocationLogSchema.safeParse(log);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('At least one pain location');
      }
    });

    it('should reject pain location log with invalid location', () => {
      const log = { ...validLocationLog, painLocations: ['invalid'] };
      const result = PainLocationLogSchema.safeParse(log);
      expect(result.success).toBe(false);
    });
  });
});
