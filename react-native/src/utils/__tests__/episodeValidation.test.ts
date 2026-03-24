import { validateEpisodeEndTime } from '../episodeValidation';

describe('episodeValidation', () => {
  describe('validateEpisodeEndTime', () => {
    it('should return valid when end time is after start time', () => {
      const startTime = Date.now();
      const endTime = startTime + 3600000; // 1 hour later

      const result = validateEpisodeEndTime(startTime, endTime);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid when end time equals start time', () => {
      const startTime = Date.now();
      const endTime = startTime; // Same time (edge case)

      const result = validateEpisodeEndTime(startTime, endTime);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid when end time is before start time', () => {
      const startTime = Date.now();
      const endTime = startTime - 1; // 1ms before start

      const result = validateEpisodeEndTime(startTime, endTime);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('End time cannot be before the episode start time.');
    });

    it('should return invalid when end time is significantly before start time', () => {
      const startTime = Date.now();
      const endTime = startTime - 3600000; // 1 hour before start

      const result = validateEpisodeEndTime(startTime, endTime);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('End time cannot be before the episode start time.');
    });

    it('should handle edge case of very long episode duration', () => {
      const startTime = Date.now();
      const endTime = startTime + 86400000 * 7; // 7 days later

      const result = validateEpisodeEndTime(startTime, endTime);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle timestamps at epoch boundary', () => {
      const startTime = 0; // Unix epoch start
      const endTime = 1000; // 1 second after epoch

      const result = validateEpisodeEndTime(startTime, endTime);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle large timestamp values', () => {
      const startTime = 253402300799000; // Year 9999 (max reasonable date)
      const endTime = startTime + 1000;

      const result = validateEpisodeEndTime(startTime, endTime);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return consistent results for multiple validations', () => {
      const startTime = Date.now();
      const endTime = startTime - 100;

      const result1 = validateEpisodeEndTime(startTime, endTime);
      const result2 = validateEpisodeEndTime(startTime, endTime);

      expect(result1).toEqual(result2);
      expect(result1.isValid).toBe(false);
      expect(result2.isValid).toBe(false);
    });
  });
});
