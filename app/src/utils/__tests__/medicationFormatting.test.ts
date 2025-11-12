import { formatDosageWithUnit, formatMedicationDosage, formatMedicationDoseDisplay } from '../medicationFormatting';
import { MedicationDose, Medication } from '../../models/types';

describe('medicationFormatting', () => {
  describe('formatDosageWithUnit', () => {
    it('should format abbreviated units without space', () => {
      expect(formatDosageWithUnit(200, 'mg')).toBe('200mg');
      expect(formatDosageWithUnit(5, 'ml')).toBe('5ml');
      expect(formatDosageWithUnit(50, 'MG')).toBe('50MG'); // Case preserved
    });

    it('should format word units with space and proper pluralization', () => {
      // Plural forms when amount > 1
      expect(formatDosageWithUnit(2, 'tablets')).toBe('2 tablets');
      expect(formatDosageWithUnit(10, 'minutes')).toBe('10 minutes');
      expect(formatDosageWithUnit(3, 'drops')).toBe('3 drops');
      expect(formatDosageWithUnit(2, 'puffs')).toBe('2 puffs');
      expect(formatDosageWithUnit(2, 'capsules')).toBe('2 capsules');
      expect(formatDosageWithUnit(2, 'sessions')).toBe('2 sessions');

      // Singular forms when amount = 1
      expect(formatDosageWithUnit(1, 'tablets')).toBe('1 tablet');
      expect(formatDosageWithUnit(1, 'capsules')).toBe('1 capsule');
      expect(formatDosageWithUnit(1, 'minutes')).toBe('1 minute');
      expect(formatDosageWithUnit(1, 'sessions')).toBe('1 session');
      expect(formatDosageWithUnit(1, 'drops')).toBe('1 drop');
      expect(formatDosageWithUnit(1, 'puffs')).toBe('1 puff');

      // Unknown word units stay as-is
      expect(formatDosageWithUnit(1, 'other')).toBe('1 other');
      expect(formatDosageWithUnit(2, 'other')).toBe('2 other');
    });

    it('should handle decimal amounts', () => {
      expect(formatDosageWithUnit(2.5, 'mg')).toBe('2.5mg');
      expect(formatDosageWithUnit(1.5, 'tablets')).toBe('1.5 tablets');
    });

    it('should handle zero amounts', () => {
      expect(formatDosageWithUnit(0, 'mg')).toBe('0mg');
      expect(formatDosageWithUnit(0, 'tablets')).toBe('0 tablets');
    });
  });

  describe('formatMedicationDosage', () => {
    it('should format full medication dosage with abbreviated units', () => {
      expect(formatMedicationDosage(2, 200, 'mg')).toBe('2 × 200mg');
      expect(formatMedicationDosage(1, 5, 'ml')).toBe('1 × 5ml');
    });

    it('should format full medication dosage with word units', () => {
      expect(formatMedicationDosage(2, 400, 'tablets')).toBe('2 × 400 tablets');
      expect(formatMedicationDosage(1, 10, 'minutes')).toBe('1 × 10 minutes');
      expect(formatMedicationDosage(3, 1, 'sessions')).toBe('3 × 1 session');
    });

    it('should handle decimal quantities and amounts', () => {
      expect(formatMedicationDosage(1.5, 200, 'mg')).toBe('1.5 × 200mg');
      expect(formatMedicationDosage(2, 2.5, 'tablets')).toBe('2 × 2.5 tablets');
    });

    it('should format single dose correctly with proper pluralization', () => {
      expect(formatMedicationDosage(1, 200, 'mg')).toBe('1 × 200mg');
      expect(formatMedicationDosage(1, 10, 'minutes')).toBe('1 × 10 minutes');
      expect(formatMedicationDosage(1, 1, 'tablets')).toBe('1 × 1 tablet');
    });
  });

  describe('formatMedicationDoseDisplay', () => {
    const mockMedication: Medication = {
      id: 'med-1',
      name: 'Test Med',
      type: 'preventative',
      dosageAmount: 50,
      dosageUnit: 'mg',
      defaultQuantity: 1,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it('should return "Skipped" for skipped doses', () => {
      const skippedDose: MedicationDose = {
        id: 'dose-1',
        medicationId: 'med-1',
        timestamp: Date.now(),
        quantity: 0,
        status: 'skipped',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(formatMedicationDoseDisplay(skippedDose, mockMedication)).toBe('Skipped');
    });

    it('should format taken doses using snapshot data', () => {
      const takenDose: MedicationDose = {
        id: 'dose-1',
        medicationId: 'med-1',
        timestamp: Date.now(),
        quantity: 2,
        dosageAmount: 50,
        dosageUnit: 'mg',
        status: 'taken',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(formatMedicationDoseDisplay(takenDose, mockMedication)).toBe('2 × 50mg');
    });

    it('should return "Unknown Medication" when medication is not provided', () => {
      const dose: MedicationDose = {
        id: 'dose-1',
        medicationId: 'med-1',
        timestamp: Date.now(),
        quantity: 1,
        status: 'taken',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(formatMedicationDoseDisplay(dose)).toBe('Unknown Medication');
    });

    it('should handle doses without status (defaults to taken)', () => {
      const dose: MedicationDose = {
        id: 'dose-1',
        medicationId: 'med-1',
        timestamp: Date.now(),
        quantity: 1,
        dosageAmount: 100,
        dosageUnit: 'mg',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(formatMedicationDoseDisplay(dose, mockMedication)).toBe('1 × 100mg');
    });

    it('should use medication defaults when dose snapshot is missing', () => {
      const dose: MedicationDose = {
        id: 'dose-1',
        medicationId: 'med-1',
        timestamp: Date.now(),
        quantity: 1,
        status: 'taken',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(formatMedicationDoseDisplay(dose, mockMedication)).toBe('1 × 50mg');
    });
  });
});
