import {
  PRESET_MEDICATIONS,
  searchMedications,
  getMedicationByName,
  getCategoryName,
  PresetMedication,
} from '../presetMedications';

describe('presetMedications', () => {
  describe('PRESET_MEDICATIONS', () => {
    it('should have medications defined', () => {
      expect(PRESET_MEDICATIONS).toBeDefined();
      expect(PRESET_MEDICATIONS.length).toBeGreaterThan(0);
    });

    it('should have all required fields for each medication', () => {
      PRESET_MEDICATIONS.forEach((med) => {
        expect(med.name).toBeDefined();
        expect(med.dosageAmount).toBeDefined();
        expect(med.dosageUnit).toBeDefined();
        expect(med.category).toBeDefined();
        expect(['otc', 'triptan', 'cgrp', 'preventive', 'other']).toContain(med.category);
      });
    });

    it('should include common OTC medications', () => {
      const otcMeds = PRESET_MEDICATIONS.filter((med) => med.category === 'otc');
      const names = otcMeds.map((med) => med.name);

      expect(names).toContain('Tylenol');
      expect(names).toContain('Advil');
      expect(names).toContain('Aleve');
    });

    it('should include triptans', () => {
      const triptans = PRESET_MEDICATIONS.filter((med) => med.category === 'triptan');
      const names = triptans.map((med) => med.name);

      expect(names).toContain('Imitrex');
      expect(names).toContain('Maxalt');
    });

    it('should include CGRP antagonists', () => {
      const cgrps = PRESET_MEDICATIONS.filter((med) => med.category === 'cgrp');
      const names = cgrps.map((med) => med.name);

      expect(names).toContain('Nurtec');
      expect(names).toContain('Ubrelvy');
      expect(names).toContain('Aimovig');
    });

    it('should include preventive medications', () => {
      const preventive = PRESET_MEDICATIONS.filter((med) => med.category === 'preventive');
      const names = preventive.map((med) => med.name);

      expect(names).toContain('Topamax');
      expect(names).toContain('Propranolol');
      expect(names).toContain('Botox');
    });
  });

  describe('searchMedications', () => {
    it('should return all medications when query is empty', () => {
      const results = searchMedications('');
      expect(results).toEqual(PRESET_MEDICATIONS);
    });

    it('should return all medications when query is whitespace', () => {
      const results = searchMedications('   ');
      expect(results).toEqual(PRESET_MEDICATIONS);
    });

    it('should search by medication name', () => {
      const results = searchMedications('Advil');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('Advil');
    });

    it('should search case-insensitively', () => {
      const results = searchMedications('advil');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('Advil');
    });

    it('should search by partial name', () => {
      const results = searchMedications('Adv');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((med) => med.name === 'Advil')).toBe(true);
    });

    it('should search by generic name', () => {
      const results = searchMedications('Ibuprofen');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((med) => med.name === 'Advil')).toBe(true);
    });

    it('should search by partial generic name', () => {
      const results = searchMedications('Ibup');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((med) => med.name === 'Advil')).toBe(true);
    });

    it('should return empty array when no matches', () => {
      const results = searchMedications('XyzNotAMedication');
      expect(results).toEqual([]);
    });

    it('should return multiple results for common terms', () => {
      const results = searchMedications('a');
      expect(results.length).toBeGreaterThan(1);
    });

    it('should find triptans', () => {
      const results = searchMedications('Imitrex');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].category).toBe('triptan');
    });

    it('should find CGRP medications', () => {
      const results = searchMedications('Nurtec');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].category).toBe('cgrp');
    });
  });

  describe('getMedicationByName', () => {
    it('should find medication by exact name', () => {
      const result = getMedicationByName('Advil');
      expect(result).toBeDefined();
      expect(result?.name).toBe('Advil');
    });

    it('should find medication by name case-insensitively', () => {
      const result = getMedicationByName('advil');
      expect(result).toBeDefined();
      expect(result?.name).toBe('Advil');
    });

    it('should find medication by exact generic name', () => {
      const result = getMedicationByName('Ibuprofen');
      expect(result).toBeDefined();
      expect(result?.name).toBe('Advil');
    });

    it('should find medication by generic name case-insensitively', () => {
      const result = getMedicationByName('ibuprofen');
      expect(result).toBeDefined();
      expect(result?.name).toBe('Advil');
    });

    it('should return undefined when medication not found', () => {
      const result = getMedicationByName('NotAMedication');
      expect(result).toBeUndefined();
    });

    it('should not match partial names', () => {
      const result = getMedicationByName('Adv');
      expect(result).toBeUndefined();
    });

    it('should find medication with no generic name', () => {
      const result = getMedicationByName('Excedrin Migraine');
      expect(result).toBeDefined();
      expect(result?.name).toBe('Excedrin Migraine');
    });
  });

  describe('getCategoryName', () => {
    it('should return display name for otc', () => {
      expect(getCategoryName('otc')).toBe('Over-the-Counter');
    });

    it('should return display name for triptan', () => {
      expect(getCategoryName('triptan')).toBe('Triptans');
    });

    it('should return display name for cgrp', () => {
      expect(getCategoryName('cgrp')).toBe('CGRP Antagonists');
    });

    it('should return display name for preventive', () => {
      expect(getCategoryName('preventive')).toBe('Preventive');
    });

    it('should return display name for other', () => {
      expect(getCategoryName('other')).toBe('Other');
    });
  });

  describe('PresetMedication interface', () => {
    it('should have correct structure', () => {
      const mockMed: PresetMedication = {
        name: 'Test Med',
        genericName: 'Test Generic',
        dosageAmount: '100',
        dosageUnit: 'mg',
        category: 'otc',
        commonDoses: ['50', '100', '200'],
      };

      expect(mockMed.name).toBe('Test Med');
      expect(mockMed.genericName).toBe('Test Generic');
      expect(mockMed.dosageAmount).toBe('100');
      expect(mockMed.dosageUnit).toBe('mg');
      expect(mockMed.category).toBe('otc');
      expect(mockMed.commonDoses).toEqual(['50', '100', '200']);
    });

    it('should allow optional fields to be undefined', () => {
      const mockMed: PresetMedication = {
        name: 'Test Med',
        dosageAmount: '100',
        dosageUnit: 'mg',
        category: 'otc',
      };

      expect(mockMed.genericName).toBeUndefined();
      expect(mockMed.commonDoses).toBeUndefined();
    });
  });
});
