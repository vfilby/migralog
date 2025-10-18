import { IntensityReading, MedicationDose, Medication, MedicationType } from '../models/types';

export interface ChartDataPoint {
  x: number; // timestamp
  y: number; // intensity 0-10
}

export interface MedicationMarkerData {
  timestamp: number;
  medication: Medication;
  dose: MedicationDose;
  type: MedicationType;
}

// Gap threshold in milliseconds (2 hours)
const GAP_THRESHOLD = 2 * 60 * 60 * 1000;

/**
 * Prepare intensity readings for chart display
 * Sorts by timestamp and handles gaps in data
 * Returns array of data points, breaking lines where gaps exceed threshold
 */
export function prepareIntensityData(readings: IntensityReading[]): ChartDataPoint[][] {
  if (!readings || readings.length === 0) {
    return [];
  }

  // Sort by timestamp
  const sorted = [...readings].sort((a, b) => a.timestamp - b.timestamp);

  // Group into segments based on gaps
  const segments: ChartDataPoint[][] = [];
  let currentSegment: ChartDataPoint[] = [];

  sorted.forEach((reading, index) => {
    const dataPoint: ChartDataPoint = {
      x: reading.timestamp,
      y: reading.intensity,
    };

    if (index === 0) {
      // Start first segment
      currentSegment.push(dataPoint);
    } else {
      const previousReading = sorted[index - 1];
      const gap = reading.timestamp - previousReading.timestamp;

      if (gap > GAP_THRESHOLD) {
        // Gap too large, start new segment
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
        }
        currentSegment = [dataPoint];
      } else {
        // Continue current segment
        currentSegment.push(dataPoint);
      }
    }
  });

  // Add last segment
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

/**
 * Prepare medication markers for display on timeline
 * Merges dose data with medication details
 */
export function prepareMedicationMarkers(
  doses: MedicationDose[],
  medications: Medication[]
): MedicationMarkerData[] {
  const medicationMap = new Map<string, Medication>();
  medications.forEach(med => medicationMap.set(med.id, med));

  return doses
    .filter(dose => {
      // Only include doses that have matching medication
      const medication = medicationMap.get(dose.medicationId);
      return medication !== undefined;
    })
    .map(dose => {
      const medication = medicationMap.get(dose.medicationId)!;
      return {
        timestamp: dose.timestamp,
        medication,
        dose,
        type: medication.type,
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Calculate chart domain (time range and intensity range)
 */
export function calculateChartDomain(
  readings: IntensityReading[],
  startTime: number,
  endTime?: number
): { x: [number, number]; y: [number, number] } {
  const now = Date.now();
  const effectiveEndTime = endTime || now;

  // X-axis: episode timeframe
  const xDomain: [number, number] = [startTime, effectiveEndTime];

  // Y-axis: always 0-10 for pain scale
  const yDomain: [number, number] = [0, 10];

  return { x: xDomain, y: yDomain };
}

/**
 * Downsample data points if there are too many
 * Uses Largest Triangle Three Buckets (LTTB) algorithm
 * @param data - Array of data points
 * @param threshold - Maximum number of points to return
 */
export function downsampleData(
  data: ChartDataPoint[],
  threshold: number
): ChartDataPoint[] {
  if (data.length <= threshold) {
    return data;
  }

  const bucketSize = (data.length - 2) / (threshold - 2);
  const sampled: ChartDataPoint[] = [data[0]]; // Always keep first point

  for (let i = 0; i < threshold - 2; i++) {
    const bucketStart = Math.floor((i + 0) * bucketSize) + 1;
    const bucketEnd = Math.floor((i + 1) * bucketSize) + 1;
    const bucketCenter = Math.floor((bucketStart + bucketEnd) / 2);

    // Simple bucket average for now (can implement LTTB later if needed)
    const bucketData = data.slice(bucketStart, bucketEnd);
    if (bucketData.length > 0) {
      const avgY = bucketData.reduce((sum, d) => sum + d.y, 0) / bucketData.length;
      sampled.push({
        x: data[bucketCenter].x,
        y: avgY,
      });
    }
  }

  sampled.push(data[data.length - 1]); // Always keep last point

  return sampled;
}

/**
 * Get display label for medication dose
 */
export function getMedicationLabel(marker: MedicationMarkerData): string {
  const { medication, dose } = marker;
  return `${medication.name} - ${dose.amount} × ${medication.dosageAmount}${medication.dosageUnit}`;
}

/**
 * Determine if episode should have zoom enabled
 * Enable zoom for episodes longer than 12 hours
 */
export function shouldEnableZoom(startTime: number, endTime?: number): boolean {
  const now = Date.now();
  const effectiveEndTime = endTime || now;
  const duration = effectiveEndTime - startTime;
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;
  return duration > TWELVE_HOURS;
}
