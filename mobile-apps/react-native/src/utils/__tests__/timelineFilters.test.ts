import { shouldShowMedicationInTimeline, MedicationDoseWithDetails } from '../timelineFilters';
import { Medication } from '../../models/types';

describe('shouldShowMedicationInTimeline', () => {
  // Helper to create a medication
  const createMedication = (type: 'rescue' | 'preventative', id = 'med-1'): Medication => ({
    id,
    name: type === 'rescue' ? 'Ibuprofen' : 'Daily Preventative',
    type,
    dosageAmount: 200,
    dosageUnit: 'mg',
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Helper to create a medication dose
  const createDose = (
    medicationType: 'rescue' | 'preventative',
    status?: 'taken' | 'skipped'
  ): MedicationDoseWithDetails => {
    const medication = createMedication(medicationType);
    return {
      id: 'dose-1',
      medicationId: medication.id,
      timestamp: Date.now(),
      quantity: 1,
      status,
      medication,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  };

  describe('Rescue medications', () => {
    it('should show rescue medication that was taken', () => {
      const dose = createDose('rescue', 'taken');
      expect(shouldShowMedicationInTimeline(dose)).toBe(true);
    });

    it('should show rescue medication with no status (defaults to taken)', () => {
      const dose = createDose('rescue');
      expect(shouldShowMedicationInTimeline(dose)).toBe(true);
    });

    it('should show rescue medication that was skipped', () => {
      const dose = createDose('rescue', 'skipped');
      expect(shouldShowMedicationInTimeline(dose)).toBe(true);
    });
  });

  describe('Preventative/scheduled medications', () => {
    it('should NOT show preventative medication that was taken', () => {
      const dose = createDose('preventative', 'taken');
      expect(shouldShowMedicationInTimeline(dose)).toBe(false);
    });

    it('should NOT show preventative medication with no status (defaults to taken)', () => {
      const dose = createDose('preventative');
      expect(shouldShowMedicationInTimeline(dose)).toBe(false);
    });

    it('should NOT show preventative medication that was skipped', () => {
      const dose = createDose('preventative', 'skipped');
      expect(shouldShowMedicationInTimeline(dose)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should NOT show medication dose without medication details', () => {
      const dose: MedicationDoseWithDetails = {
        id: 'dose-1',
        medicationId: 'med-1',
        timestamp: Date.now(),
        quantity: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        // No medication object attached
      };
      expect(shouldShowMedicationInTimeline(dose)).toBe(false);
    });

    it('should NOT show dose without medication details even if marked as skipped', () => {
      const dose: MedicationDoseWithDetails = {
        id: 'dose-1',
        medicationId: 'med-1',
        timestamp: Date.now(),
        quantity: 1,
        status: 'skipped',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        // No medication object attached - can't determine if rescue
      };
      expect(shouldShowMedicationInTimeline(dose)).toBe(false);
    });
  });

  describe('Real-world scenarios', () => {
    it('should correctly filter a mixed array of doses', () => {
      const doses: MedicationDoseWithDetails[] = [
        createDose('rescue', 'taken'),           // Should show
        createDose('preventative', 'taken'),     // Should NOT show
        createDose('preventative', 'skipped'),   // Should NOT show
        createDose('rescue'),                    // Should show
        createDose('preventative'),              // Should NOT show
      ];

      const filtered = doses.filter(shouldShowMedicationInTimeline);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].medication?.type).toBe('rescue');
      expect(filtered[0].status).toBe('taken');
      expect(filtered[1].medication?.type).toBe('rescue');
      expect(filtered[1].status).toBeUndefined();
    });
  });
});
