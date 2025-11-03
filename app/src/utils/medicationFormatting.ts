/**
 * Medication Formatting Utilities
 * Helper functions for displaying medication information
 */

import { MedicationDose, Medication } from '../models/types';

/**
 * Pluralization rules for medication units
 * Maps plural forms to their singular equivalents
 */
const PLURAL_TO_SINGULAR: Record<string, string> = {
  'tablets': 'tablet',
  'capsules': 'capsule',
  'drops': 'drop',
  'puffs': 'puff',
  'minutes': 'minute',
  'sessions': 'session',
};

/**
 * Format dosage amount with appropriate spacing and pluralization for units
 *
 * Rules:
 * - Abbreviated units (mg, ml) → no space: "200mg"
 * - Word units → with space and proper pluralization: "1 minute", "10 minutes"
 * - Amount of 1 uses singular form: "1 tablet"
 * - Other amounts use plural form: "2 tablets"
 *
 * @param amount - Dosage amount (e.g., 200, 2, 1)
 * @param unit - Dosage unit (e.g., 'mg', 'capsules', 'minutes')
 * @returns Formatted string with appropriate spacing and pluralization
 */
export function formatDosageWithUnit(amount: number, unit: string): string {
  // Units that should NOT have a space (abbreviated units)
  const noSpaceUnits = ['mg', 'ml'];

  // Check if this is a no-space unit
  const needsSpace = !noSpaceUnits.includes(unit.toLowerCase());

  if (!needsSpace) {
    return `${amount}${unit}`;
  }

  // Handle pluralization for word units
  // If amount is 1 and we have a plural form, use singular
  if (amount === 1 && PLURAL_TO_SINGULAR[unit.toLowerCase()]) {
    const singularUnit = PLURAL_TO_SINGULAR[unit.toLowerCase()];
    return `${amount} ${singularUnit}`;
  }

  return `${amount} ${unit}`;
}

/**
 * Format full medication dosage display
 * Example: "2 × 200mg" or "1 × 10 minutes"
 *
 * @param quantity - Number of doses taken (e.g., 2 tablets)
 * @param amount - Single dose amount (e.g., 200)
 * @param unit - Dosage unit (e.g., 'mg', 'minutes')
 * @returns Formatted string like "2 × 200mg" or "1 × 10 minutes"
 */
export function formatMedicationDosage(
  quantity: number,
  amount: number,
  unit: string
): string {
  const dosageStr = formatDosageWithUnit(amount, unit);
  return `${quantity} × ${dosageStr}`;
}

/**
 * Format dose display using historical snapshot or current medication dosage
 * This ensures correct dosage display even when medication dosages change over time.
 *
 * @param dose - Medication dose record
 * @param medication - Current medication record (used as fallback if no snapshot)
 * @returns Formatted string like "2 × 200mg" or "1 × 10 minutes"
 */
export function formatDoseWithSnapshot(
  dose: MedicationDose,
  medication: Medication
): string {
  // Use snapshot dosage if available (for historical accuracy)
  // Otherwise fallback to current medication dosage
  const dosageAmount = dose.dosageAmount ?? medication.dosageAmount;
  const dosageUnit = dose.dosageUnit ?? medication.dosageUnit;

  return formatMedicationDosage(dose.quantity, dosageAmount, dosageUnit);
}

/**
 * Format medication dose display text, handling skipped status
 * Returns "Skipped" for skipped doses, otherwise formats using snapshot
 *
 * @param dose - Medication dose record
 * @param medication - Medication details (optional)
 * @returns Formatted display text ("Skipped" or "2 × 200mg")
 */
export function formatMedicationDoseDisplay(
  dose: MedicationDose,
  medication?: Medication
): string {
  if (dose.status === 'skipped') {
    return 'Skipped';
  }

  if (!medication) {
    return 'Unknown Medication';
  }

  return formatDoseWithSnapshot(dose, medication);
}
