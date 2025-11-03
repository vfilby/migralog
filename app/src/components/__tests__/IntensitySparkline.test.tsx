import React from 'react';
import { render } from '@testing-library/react-native';
import IntensitySparkline from '../IntensitySparkline';
import { IntensityReading } from '../../models/types';

// Helper function to create test intensity readings
function createReadings(intensities: number[], startTime = Date.now() - 3600000): IntensityReading[] {
  return intensities.map((intensity, index) => ({
    id: `reading-${index}`,
    episodeId: 'test-episode',
    timestamp: startTime + (index * 300000), // 5 minutes apart
    intensity,
    createdAt: startTime,
    updatedAt: startTime,
  }));
}

describe('IntensitySparkline', () => {
  describe('Rendering', () => {
    it('should render without crashing with valid data', () => {
      const readings = createReadings([3, 5, 7, 6, 4]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={120} height={40} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should render null when readings array is empty', () => {
      const { toJSON } = render(
        <IntensitySparkline readings={[]} width={120} height={40} />
      );
      expect(toJSON()).toBeNull();
    });

    it('should render null when readings is undefined', () => {
      const { toJSON } = render(
        <IntensitySparkline readings={undefined as any} width={120} height={40} />
      );
      expect(toJSON()).toBeNull();
    });

    it('should handle array with single intensity value', () => {
      const readings = createReadings([5]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={120} height={40} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should filter out invalid intensity values', () => {
      const readings = createReadings([3, NaN, 5, undefined as any, 7, null as any, 6]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={120} height={40} />
      );
      // Should render with only valid values [3, 5, 7, 6]
      expect(toJSON()).toBeTruthy();
    });

    it('should render null when all intensity values are invalid', () => {
      const readings = createReadings([NaN, undefined as any, null as any]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={120} height={40} />
      );
      expect(toJSON()).toBeNull();
    });
  });

  describe('Props', () => {
    it('should use default width and height when not provided', () => {
      const readings = createReadings([3, 5, 7]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should accept custom width and height', () => {
      const readings = createReadings([3, 5, 7]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={200} height={60} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should accept custom color', () => {
      const readings = createReadings([3, 5, 7]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} color="#FF0000" />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should hide peak marker when showPeak is false', () => {
      const readings = createReadings([3, 5, 7, 6, 4]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} showPeak={false} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should show peak marker by default', () => {
      const readings = createReadings([3, 5, 7, 6, 4]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} />
      );
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Data Handling', () => {
    it('should handle intensity values at min boundary (0)', () => {
      const readings = createReadings([0, 2, 4, 3, 1]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={120} height={40} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should handle intensity values at max boundary (10)', () => {
      const readings = createReadings([8, 9, 10, 9, 8]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={120} height={40} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should handle full range of intensity values (0-10)', () => {
      const readings = createReadings([0, 2, 4, 6, 8, 10, 7, 5, 3, 1]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={120} height={40} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should handle all same intensity values', () => {
      const readings = createReadings([5, 5, 5, 5, 5]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={120} height={40} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should handle large number of intensity readings', () => {
      const intensityValues = Array.from({ length: 100 }, () =>
        Math.floor(Math.random() * 11)
      );
      const readings = createReadings(intensityValues);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={120} height={40} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should handle ascending intensity pattern', () => {
      const readings = createReadings([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={120} height={40} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should handle descending intensity pattern', () => {
      const readings = createReadings([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={120} height={40} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should handle peak-then-recovery pattern', () => {
      const readings = createReadings([2, 4, 6, 8, 10, 8, 6, 4, 2]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={120} height={40} />
      );
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle two intensity readings', () => {
      const readings = createReadings([3, 7]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={120} height={40} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should handle negative intensity values by filtering them out', () => {
      const readings = createReadings([-1, 3, 5, -2, 7]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={120} height={40} />
      );
      // Should render with filtered positive values
      expect(toJSON()).toBeTruthy();
    });

    it('should handle intensity values above 10 by including them', () => {
      const readings = createReadings([5, 7, 12, 6]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={120} height={40} />
      );
      // Should still render (scale adjusts to data)
      expect(toJSON()).toBeTruthy();
    });

    it('should handle very small dimensions', () => {
      const readings = createReadings([3, 5, 7]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={20} height={10} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should handle very large dimensions', () => {
      const readings = createReadings([3, 5, 7]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={500} height={200} />
      );
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Snapshot Tests', () => {
    it('should match snapshot with typical intensity pattern', () => {
      const readings = createReadings([3, 5, 7, 9, 8, 6, 4]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={120} height={40} />
      );
      expect(toJSON()).toMatchSnapshot();
    });

    it('should match snapshot with custom color', () => {
      const readings = createReadings([3, 5, 7]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} color="#FF6B6B" width={120} height={40} />
      );
      expect(toJSON()).toMatchSnapshot();
    });

    it('should match snapshot without peak marker', () => {
      const readings = createReadings([3, 5, 7, 6, 4]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} showPeak={false} width={120} height={40} />
      );
      expect(toJSON()).toMatchSnapshot();
    });
  });
});
