import { Medication, MedicationDose } from '../models/types';

export type MedicationDoseWithDetails = MedicationDose & {
  medication?: Medication;
};

/**
 * Determines if a medication dose should be shown in the episode timeline.
 *
 * Timeline should only show:
 * - Rescue medications (non-scheduled)
 * - Scheduled/preventative medications that were skipped
 *
 * Timeline should NOT show:
 * - Preventative medications that were taken as expected
 *
 * @param dose - The medication dose (potentially with medication details)
 * @returns true if the dose should be shown in timeline, false otherwise
 */
export function shouldShowMedicationInTimeline(dose: MedicationDoseWithDetails): boolean {
  const isRescue = dose.medication?.type === 'rescue';
  const isSkipped = dose.status === 'skipped';

  // Show rescue medications or any medication that was skipped
  return isRescue || isSkipped;
}
