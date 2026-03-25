import { Medication, MedicationDose } from '../models/types';

export type MedicationDoseWithDetails = MedicationDose & {
  medication?: Medication;
};

/**
 * Determines if a medication dose should be shown in the episode timeline.
 *
 * Timeline should only show:
 * - Rescue medications (taken or skipped)
 *
 * Timeline should NOT show:
 * - Preventative/scheduled medications (whether taken or skipped)
 * - Other medication types
 *
 * Rationale: Episode timelines focus on rescue interventions during the episode.
 * Preventative medications are tracked separately in medication detail screens.
 *
 * @param dose - The medication dose (potentially with medication details)
 * @returns true if the dose should be shown in timeline, false otherwise
 */
export function shouldShowMedicationInTimeline(dose: MedicationDoseWithDetails): boolean {
  const isRescue = dose.medication?.type === 'rescue';

  // Only show rescue medications
  return isRescue;
}
