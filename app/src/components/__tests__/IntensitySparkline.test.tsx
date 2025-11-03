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

    it('should render all intensity markers', () => {
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

    it('should match snapshot with all intensity markers', () => {
      const readings = createReadings([3, 5, 7, 6, 4]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={120} height={40} />
      );
      expect(toJSON()).toMatchSnapshot();
    });
  });

  describe('episodeEndTime Prop', () => {
    it('should handle ongoing episodes without episodeEndTime', () => {
      const readings = createReadings([3, 5, 7]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={120} height={40} />
      );
      // Should render and extend to current time
      expect(toJSON()).toBeTruthy();
    });

    it('should handle completed episodes with episodeEndTime', () => {
      const startTime = Date.now() - 7200000; // 2 hours ago
      const endTime = Date.now() - 3600000; // 1 hour ago
      const readings = createReadings([3, 5, 7], startTime);
      const { toJSON } = render(
        <IntensitySparkline
          readings={readings}
          episodeEndTime={endTime}
          width={120}
          height={40}
        />
      );
      // Should render and stop at episodeEndTime
      expect(toJSON()).toBeTruthy();
    });

    it('should render differently with and without episodeEndTime', () => {
      const startTime = Date.now() - 3600000; // 1 hour ago
      const endTime = Date.now() - 1800000; // 30 minutes ago
      const readings = createReadings([5, 7], startTime);

      const withEndTime = render(
        <IntensitySparkline
          readings={readings}
          episodeEndTime={endTime}
          width={120}
          height={40}
        />
      );

      const withoutEndTime = render(
        <IntensitySparkline
          readings={readings}
          width={120}
          height={40}
        />
      );

      // Should render different number of interpolated points
      expect(withEndTime.toJSON()).toBeTruthy();
      expect(withoutEndTime.toJSON()).toBeTruthy();
      expect(withEndTime.toJSON()).not.toEqual(withoutEndTime.toJSON());
    });
  });

  describe('5-Minute Interpolation', () => {
    it('should handle sparse readings with long time gaps', () => {
      // Create 2 readings 1 hour apart
      const startTime = Date.now() - 3600000;
      const readings: IntensityReading[] = [
        {
          id: 'reading-1',
          episodeId: 'test-episode',
          timestamp: startTime,
          intensity: 3,
          createdAt: startTime,
          updatedAt: startTime,
        },
        {
          id: 'reading-2',
          episodeId: 'test-episode',
          timestamp: startTime + 3600000, // 1 hour later
          intensity: 8,
          createdAt: startTime,
          updatedAt: startTime,
        },
      ];

      const { toJSON } = render(
        <IntensitySparkline
          readings={readings}
          episodeEndTime={startTime + 3600000}
          width={120}
          height={40}
        />
      );

      // Should create interpolated points every 5 minutes (12 points for 1 hour)
      expect(toJSON()).toBeTruthy();
    });

    it('should handle episode longer than reading intervals', () => {
      // Create 3 readings over 2 hours
      const startTime = Date.now() - 7200000; // 2 hours ago
      const readings: IntensityReading[] = [
        {
          id: 'reading-1',
          episodeId: 'test-episode',
          timestamp: startTime,
          intensity: 2,
          createdAt: startTime,
          updatedAt: startTime,
        },
        {
          id: 'reading-2',
          episodeId: 'test-episode',
          timestamp: startTime + 3600000, // 1 hour later
          intensity: 7,
          createdAt: startTime,
          updatedAt: startTime,
        },
        {
          id: 'reading-3',
          episodeId: 'test-episode',
          timestamp: startTime + 7200000, // 2 hours later
          intensity: 4,
          createdAt: startTime,
          updatedAt: startTime,
        },
      ];

      const { toJSON } = render(
        <IntensitySparkline
          readings={readings}
          episodeEndTime={startTime + 7200000}
          width={120}
          height={40}
        />
      );

      // Should render smoothly across long duration
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Sample-and-Hold Behavior', () => {
    it('should maintain intensity values between readings', () => {
      const startTime = Date.now() - 1800000; // 30 minutes ago
      const readings: IntensityReading[] = [
        {
          id: 'reading-1',
          episodeId: 'test-episode',
          timestamp: startTime,
          intensity: 5,
          createdAt: startTime,
          updatedAt: startTime,
        },
        {
          id: 'reading-2',
          episodeId: 'test-episode',
          timestamp: startTime + 1800000, // 30 minutes later
          intensity: 8,
          createdAt: startTime,
          updatedAt: startTime,
        },
      ];

      const { toJSON } = render(
        <IntensitySparkline
          readings={readings}
          episodeEndTime={startTime + 1800000}
          width={120}
          height={40}
        />
      );

      // Should create 6 interpolated points (30 min / 5 min intervals)
      // All points before the second reading should hold value 5
      expect(toJSON()).toBeTruthy();
    });

    it('should handle single reading held to current time', () => {
      const startTime = Date.now() - 900000; // 15 minutes ago
      const readings: IntensityReading[] = [
        {
          id: 'reading-1',
          episodeId: 'test-episode',
          timestamp: startTime,
          intensity: 6,
          createdAt: startTime,
          updatedAt: startTime,
        },
      ];

      const { toJSON } = render(
        <IntensitySparkline
          readings={readings}
          width={120}
          height={40}
        />
      );

      // Should hold value 6 from start to current time
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Timestamp Handling', () => {
    it('should handle unsorted timestamps', () => {
      const startTime = Date.now() - 1800000;
      const readings: IntensityReading[] = [
        {
          id: 'reading-3',
          episodeId: 'test-episode',
          timestamp: startTime + 1200000, // 20 min
          intensity: 7,
          createdAt: startTime,
          updatedAt: startTime,
        },
        {
          id: 'reading-1',
          episodeId: 'test-episode',
          timestamp: startTime, // 0 min (earliest)
          intensity: 3,
          createdAt: startTime,
          updatedAt: startTime,
        },
        {
          id: 'reading-2',
          episodeId: 'test-episode',
          timestamp: startTime + 600000, // 10 min
          intensity: 5,
          createdAt: startTime,
          updatedAt: startTime,
        },
      ];

      const { toJSON } = render(
        <IntensitySparkline
          readings={readings}
          episodeEndTime={startTime + 1200000}
          width={120}
          height={40}
        />
      );

      // Should automatically sort and render correctly
      expect(toJSON()).toBeTruthy();
    });

    it('should handle readings with varying time gaps', () => {
      const startTime = Date.now() - 3600000;
      const readings: IntensityReading[] = [
        {
          id: 'reading-1',
          episodeId: 'test-episode',
          timestamp: startTime,
          intensity: 2,
          createdAt: startTime,
          updatedAt: startTime,
        },
        {
          id: 'reading-2',
          episodeId: 'test-episode',
          timestamp: startTime + 300000, // 5 min gap
          intensity: 4,
          createdAt: startTime,
          updatedAt: startTime,
        },
        {
          id: 'reading-3',
          episodeId: 'test-episode',
          timestamp: startTime + 2100000, // 30 min gap
          intensity: 8,
          createdAt: startTime,
          updatedAt: startTime,
        },
        {
          id: 'reading-4',
          episodeId: 'test-episode',
          timestamp: startTime + 2400000, // 5 min gap
          intensity: 7,
          createdAt: startTime,
          updatedAt: startTime,
        },
      ];

      const { toJSON } = render(
        <IntensitySparkline
          readings={readings}
          episodeEndTime={startTime + 2400000}
          width={120}
          height={40}
        />
      );

      // Should handle varying gaps smoothly
      expect(toJSON()).toBeTruthy();
    });

    it('should filter out readings with invalid timestamps', () => {
      const startTime = Date.now() - 1800000;
      const readings: IntensityReading[] = [
        {
          id: 'reading-1',
          episodeId: 'test-episode',
          timestamp: startTime,
          intensity: 5,
          createdAt: startTime,
          updatedAt: startTime,
        },
        {
          id: 'reading-invalid',
          episodeId: 'test-episode',
          timestamp: NaN as any,
          intensity: 7,
          createdAt: startTime,
          updatedAt: startTime,
        },
        {
          id: 'reading-2',
          episodeId: 'test-episode',
          timestamp: startTime + 900000,
          intensity: 8,
          createdAt: startTime,
          updatedAt: startTime,
        },
      ];

      const { toJSON } = render(
        <IntensitySparkline
          readings={readings}
          episodeEndTime={startTime + 900000}
          width={120}
          height={40}
        />
      );

      // Should render with only valid readings
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Gradient and Markers', () => {
    it('should render with gradient stroke', () => {
      const readings = createReadings([3, 5, 7, 6]);
      const rendered = render(
        <IntensitySparkline readings={readings} width={120} height={40} />
      );

      const json = rendered.toJSON();
      expect(json).toBeTruthy();

      // Gradient should be applied (verified by snapshot)
      expect(rendered.toJSON()).toMatchSnapshot();
    });

    it('should render markers for all readings', () => {
      const readings = createReadings([2, 5, 8, 4, 6]);
      const rendered = render(
        <IntensitySparkline readings={readings} width={120} height={40} />
      );

      const json = rendered.toJSON();
      expect(json).toBeTruthy();

      // Should have circle markers for each reading (verified by snapshot)
      expect(rendered.toJSON()).toMatchSnapshot();
    });

    it('should handle custom color override', () => {
      const readings = createReadings([5, 7, 6]);
      const rendered = render(
        <IntensitySparkline
          readings={readings}
          color="#FF0000"
          width={120}
          height={40}
        />
      );

      const json = rendered.toJSON();
      expect(json).toBeTruthy();

      // Custom color should override gradient (verified by snapshot)
      expect(rendered.toJSON()).toMatchSnapshot();
    });

    it('should map gradient to absolute 0-10 scale', () => {
      // Low intensity values should use green/yellow, not purple
      const lowIntensityReadings = createReadings([1, 2, 3, 2, 1]);
      const lowRendered = render(
        <IntensitySparkline readings={lowIntensityReadings} width={120} height={40} />
      );

      // High intensity values should use red/purple
      const highIntensityReadings = createReadings([7, 8, 9, 10, 9]);
      const highRendered = render(
        <IntensitySparkline readings={highIntensityReadings} width={120} height={40} />
      );

      // Both should render but with different colors
      expect(lowRendered.toJSON()).toBeTruthy();
      expect(highRendered.toJSON()).toBeTruthy();
      expect(lowRendered.toJSON()).not.toEqual(highRendered.toJSON());
    });
  });

  describe('EMA Smoothing', () => {
    it('should apply EMA smoothing to interpolated data', () => {
      const readings = createReadings([2, 8, 2, 8, 2]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={120} height={40} />
      );

      // Should render with smoothed transitions
      expect(toJSON()).toBeTruthy();
    });

    it('should create smooth transitions for step changes', () => {
      const startTime = Date.now() - 1800000;
      const readings: IntensityReading[] = [
        {
          id: 'reading-1',
          episodeId: 'test-episode',
          timestamp: startTime,
          intensity: 2,
          createdAt: startTime,
          updatedAt: startTime,
        },
        {
          id: 'reading-2',
          episodeId: 'test-episode',
          timestamp: startTime + 900000, // 15 min later - sudden jump
          intensity: 9,
          createdAt: startTime,
          updatedAt: startTime,
        },
      ];

      const { toJSON } = render(
        <IntensitySparkline
          readings={readings}
          episodeEndTime={startTime + 900000}
          width={120}
          height={40}
        />
      );

      // EMA should smooth the sharp transition
      expect(toJSON()).toBeTruthy();
    });

    it('should preserve general trend while smoothing noise', () => {
      const readings = createReadings([5, 5, 5, 5, 5, 6, 7, 8, 9, 9, 9]);
      const { toJSON } = render(
        <IntensitySparkline readings={readings} width={120} height={40} />
      );

      // Should show smooth upward trend
      expect(toJSON()).toBeTruthy();
    });
  });
});
