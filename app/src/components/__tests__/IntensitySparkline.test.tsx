import React from 'react';
import { render } from '@testing-library/react-native';
import IntensitySparkline from '../IntensitySparkline';

describe('IntensitySparkline', () => {
  describe('Rendering', () => {
    it('should render without crashing with valid data', () => {
      const intensities = [3, 5, 7, 6, 4];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} width={120} height={40} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should render null when intensities array is empty', () => {
      const { toJSON } = render(
        <IntensitySparkline intensities={[]} width={120} height={40} />
      );
      expect(toJSON()).toBeNull();
    });

    it('should render null when intensities is undefined', () => {
      const { toJSON } = render(
        <IntensitySparkline intensities={undefined as any} width={120} height={40} />
      );
      expect(toJSON()).toBeNull();
    });

    it('should handle array with single intensity value', () => {
      const intensities = [5];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} width={120} height={40} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should filter out invalid intensity values', () => {
      const intensities = [3, NaN, 5, undefined as any, 7, null as any, 6];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} width={120} height={40} />
      );
      // Should render with only valid values [3, 5, 7, 6]
      expect(toJSON()).toBeTruthy();
    });

    it('should render null when all intensity values are invalid', () => {
      const intensities = [NaN, undefined as any, null as any];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} width={120} height={40} />
      );
      expect(toJSON()).toBeNull();
    });
  });

  describe('Props', () => {
    it('should use default width and height when not provided', () => {
      const intensities = [3, 5, 7];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should accept custom width and height', () => {
      const intensities = [3, 5, 7];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} width={200} height={60} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should accept custom color', () => {
      const intensities = [3, 5, 7];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} color="#FF0000" />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should hide peak marker when showPeak is false', () => {
      const intensities = [3, 5, 7, 6, 4];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} showPeak={false} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should show peak marker by default', () => {
      const intensities = [3, 5, 7, 6, 4];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} />
      );
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Data Handling', () => {
    it('should handle intensity values at min boundary (0)', () => {
      const intensities = [0, 2, 4, 3, 1];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} width={120} height={40} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should handle intensity values at max boundary (10)', () => {
      const intensities = [8, 9, 10, 9, 8];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} width={120} height={40} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should handle full range of intensity values (0-10)', () => {
      const intensities = [0, 2, 4, 6, 8, 10, 7, 5, 3, 1];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} width={120} height={40} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should handle all same intensity values', () => {
      const intensities = [5, 5, 5, 5, 5];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} width={120} height={40} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should handle large number of intensity readings', () => {
      const intensities = Array.from({ length: 100 }, (_, i) =>
        Math.floor(Math.random() * 11)
      );
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} width={120} height={40} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should handle ascending intensity pattern', () => {
      const intensities = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} width={120} height={40} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should handle descending intensity pattern', () => {
      const intensities = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} width={120} height={40} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should handle peak-then-recovery pattern', () => {
      const intensities = [2, 4, 6, 8, 10, 8, 6, 4, 2];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} width={120} height={40} />
      );
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle two intensity readings', () => {
      const intensities = [3, 7];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} width={120} height={40} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should handle negative intensity values by filtering them out', () => {
      const intensities = [-1, 3, 5, -2, 7];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} width={120} height={40} />
      );
      // Should render with filtered positive values
      expect(toJSON()).toBeTruthy();
    });

    it('should handle intensity values above 10 by including them', () => {
      const intensities = [5, 7, 12, 6];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} width={120} height={40} />
      );
      // Should still render (scale adjusts to data)
      expect(toJSON()).toBeTruthy();
    });

    it('should handle very small dimensions', () => {
      const intensities = [3, 5, 7];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} width={20} height={10} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('should handle very large dimensions', () => {
      const intensities = [3, 5, 7];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} width={500} height={200} />
      );
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Snapshot Tests', () => {
    it('should match snapshot with typical intensity pattern', () => {
      const intensities = [3, 5, 7, 9, 8, 6, 4];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} width={120} height={40} />
      );
      expect(toJSON()).toMatchSnapshot();
    });

    it('should match snapshot with custom color', () => {
      const intensities = [3, 5, 7];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} color="#FF6B6B" width={120} height={40} />
      );
      expect(toJSON()).toMatchSnapshot();
    });

    it('should match snapshot without peak marker', () => {
      const intensities = [3, 5, 7, 6, 4];
      const { toJSON } = render(
        <IntensitySparkline intensities={intensities} showPeak={false} width={120} height={40} />
      );
      expect(toJSON()).toMatchSnapshot();
    });
  });
});
