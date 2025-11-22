import { formatFileSize, formatDate } from '../formatting';

describe('formatting utilities', () => {
  describe('formatFileSize', () => {
    it('should format 0 bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('should format bytes correctly', () => {
      expect(formatFileSize(1)).toBe('1 Bytes');
      expect(formatFileSize(500)).toBe('500 Bytes');
      expect(formatFileSize(1023)).toBe('1023 Bytes');
    });

    it('should format KB correctly', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(2048)).toBe('2 KB');
      expect(formatFileSize(10240)).toBe('10 KB');
    });

    it('should format MB correctly', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1572864)).toBe('1.5 MB');
      expect(formatFileSize(5242880)).toBe('5 MB');
    });

    it('should format GB correctly', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB');
      expect(formatFileSize(2147483648)).toBe('2 GB');
      expect(formatFileSize(1610612736)).toBe('1.5 GB');
    });

    it('should round to 2 decimal places', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1638)).toBe('1.6 KB'); // 1.599609375 KB rounded
      expect(formatFileSize(1730)).toBe('1.69 KB'); // 1.689453125 KB rounded
    });

    it('should handle very large numbers', () => {
      // Very large numbers may exceed GB and cause undefined suffix
      // The function only supports up to GB in the sizes array
      const result = formatFileSize(5000000000); // 5 GB
      expect(result).toContain('GB');
      expect(result).toContain('4.66'); // ~4.66 GB
    });
  });

  describe('formatDate', () => {
    it('should format timestamp to string', () => {
      const timestamp = new Date('2025-01-01T12:00:00Z').getTime();
      const result = formatDate(timestamp);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should format current timestamp', () => {
      const timestamp = Date.now();
      const result = formatDate(timestamp);

      expect(typeof result).toBe('string');
      expect(result).toBeDefined();
    });

    it('should format different timestamps differently', () => {
      const timestamp1 = new Date('2025-01-01T12:00:00Z').getTime();
      const timestamp2 = new Date('2024-06-15T08:30:00Z').getTime();

      const result1 = formatDate(timestamp1);
      const result2 = formatDate(timestamp2);

      expect(result1).not.toBe(result2);
    });

    it('should handle zero timestamp', () => {
      const result = formatDate(0);
      expect(typeof result).toBe('string');
      expect(result).toBeDefined();
    });
  });
});
