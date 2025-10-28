// Preset medications database for quick medication entry
// Organized by category for easy browsing

export interface IngredientInfo {
  name: string;
  amount: string;
  unit: string;
}

export interface PresetMedication {
  name: string;
  genericName?: string;
  dosageAmount: string;
  dosageUnit: string;
  category: 'otc' | 'nsaid' | 'triptan' | 'cgrp' | 'preventive' | 'supplement' | 'other';
  commonDoses?: string[]; // Alternative common doses
  ingredients?: IngredientInfo[]; // Constituent ingredients for combination formulas
}

export const PRESET_MEDICATIONS: PresetMedication[] = [
  // Over-the-Counter (OTC) - Non-NSAID
  {
    name: 'Tylenol',
    genericName: 'Acetaminophen',
    dosageAmount: '500',
    dosageUnit: 'mg',
    category: 'otc',
    commonDoses: ['325', '500', '650'],
  },
  {
    name: 'Excedrin Migraine',
    dosageAmount: '2',
    dosageUnit: 'tablets',
    category: 'otc',
  },

  // NSAIDs (Non-Steroidal Anti-Inflammatory Drugs)
  {
    name: 'Advil',
    genericName: 'Ibuprofen',
    dosageAmount: '200',
    dosageUnit: 'mg',
    category: 'nsaid',
    commonDoses: ['200', '400', '600', '800'],
  },
  {
    name: 'Aleve',
    genericName: 'Naproxen',
    dosageAmount: '220',
    dosageUnit: 'mg',
    category: 'nsaid',
    commonDoses: ['220', '500'],
  },
  {
    name: 'Aspirin',
    dosageAmount: '325',
    dosageUnit: 'mg',
    category: 'nsaid',
    commonDoses: ['81', '325', '500'],
  },
  {
    name: 'Motrin',
    genericName: 'Ibuprofen',
    dosageAmount: '200',
    dosageUnit: 'mg',
    category: 'nsaid',
    commonDoses: ['200', '400', '600', '800'],
  },
  {
    name: 'Cambia',
    genericName: 'Diclofenac Potassium',
    dosageAmount: '50',
    dosageUnit: 'mg',
    category: 'nsaid',
    commonDoses: ['50', '100'],
  },
  {
    name: 'Indocin',
    genericName: 'Indomethacin',
    dosageAmount: '25',
    dosageUnit: 'mg',
    category: 'nsaid',
    commonDoses: ['25', '50', '75'],
  },

  // Triptans
  {
    name: 'Imitrex',
    genericName: 'Sumatriptan',
    dosageAmount: '50',
    dosageUnit: 'mg',
    category: 'triptan',
    commonDoses: ['25', '50', '100'],
  },
  {
    name: 'Maxalt',
    genericName: 'Rizatriptan',
    dosageAmount: '10',
    dosageUnit: 'mg',
    category: 'triptan',
    commonDoses: ['5', '10'],
  },
  {
    name: 'Zomig',
    genericName: 'Zolmitriptan',
    dosageAmount: '2.5',
    dosageUnit: 'mg',
    category: 'triptan',
    commonDoses: ['2.5', '5'],
  },
  {
    name: 'Relpax',
    genericName: 'Eletriptan',
    dosageAmount: '40',
    dosageUnit: 'mg',
    category: 'triptan',
    commonDoses: ['20', '40'],
  },
  {
    name: 'Amerge',
    genericName: 'Naratriptan',
    dosageAmount: '2.5',
    dosageUnit: 'mg',
    category: 'triptan',
    commonDoses: ['1', '2.5'],
  },
  {
    name: 'Frova',
    genericName: 'Frovatriptan',
    dosageAmount: '2.5',
    dosageUnit: 'mg',
    category: 'triptan',
  },
  {
    name: 'Axert',
    genericName: 'Almotriptan',
    dosageAmount: '12.5',
    dosageUnit: 'mg',
    category: 'triptan',
    commonDoses: ['6.25', '12.5'],
  },

  // CGRP Antagonists
  {
    name: 'Nurtec',
    genericName: 'Rimegepant',
    dosageAmount: '75',
    dosageUnit: 'mg',
    category: 'cgrp',
  },
  {
    name: 'Ubrelvy',
    genericName: 'Ubrogepant',
    dosageAmount: '50',
    dosageUnit: 'mg',
    category: 'cgrp',
    commonDoses: ['50', '100'],
  },
  {
    name: 'Qulipta',
    genericName: 'Atogepant',
    dosageAmount: '60',
    dosageUnit: 'mg',
    category: 'cgrp',
    commonDoses: ['10', '30', '60'],
  },
  {
    name: 'Aimovig',
    genericName: 'Erenumab',
    dosageAmount: '70',
    dosageUnit: 'mg',
    category: 'cgrp',
    commonDoses: ['70', '140'],
  },
  {
    name: 'Ajovy',
    genericName: 'Fremanezumab',
    dosageAmount: '225',
    dosageUnit: 'mg',
    category: 'cgrp',
  },
  {
    name: 'Emgality',
    genericName: 'Galcanezumab',
    dosageAmount: '120',
    dosageUnit: 'mg',
    category: 'cgrp',
    commonDoses: ['120', '240'],
  },
  {
    name: 'Vyepti',
    genericName: 'Eptinezumab',
    dosageAmount: '100',
    dosageUnit: 'mg',
    category: 'cgrp',
    commonDoses: ['100', '300'],
  },

  // Preventive Medications
  {
    name: 'Topamax',
    genericName: 'Topiramate',
    dosageAmount: '50',
    dosageUnit: 'mg',
    category: 'preventive',
    commonDoses: ['25', '50', '100', '200'],
  },
  {
    name: 'Propranolol',
    dosageAmount: '40',
    dosageUnit: 'mg',
    category: 'preventive',
    commonDoses: ['20', '40', '80'],
  },
  {
    name: 'Amitriptyline',
    dosageAmount: '25',
    dosageUnit: 'mg',
    category: 'preventive',
    commonDoses: ['10', '25', '50', '75'],
  },
  {
    name: 'Depakote',
    genericName: 'Valproic Acid',
    dosageAmount: '500',
    dosageUnit: 'mg',
    category: 'preventive',
    commonDoses: ['250', '500', '1000'],
  },
  {
    name: 'Botox',
    genericName: 'OnabotulinumtoxinA',
    dosageAmount: '155',
    dosageUnit: 'units',
    category: 'preventive',
  },
  {
    name: 'Verapamil',
    dosageAmount: '80',
    dosageUnit: 'mg',
    category: 'preventive',
    commonDoses: ['80', '120', '240'],
  },
  {
    name: 'Memantine',
    dosageAmount: '10',
    dosageUnit: 'mg',
    category: 'preventive',
    commonDoses: ['5', '10', '20'],
  },
  {
    name: 'Duloxetine',
    genericName: 'Cymbalta',
    dosageAmount: '60',
    dosageUnit: 'mg',
    category: 'preventive',
    commonDoses: ['30', '60', '90', '120'],
  },

  // Anti-nausea
  {
    name: 'Zofran',
    genericName: 'Ondansetron',
    dosageAmount: '4',
    dosageUnit: 'mg',
    category: 'other',
    commonDoses: ['4', '8'],
  },
  {
    name: 'Reglan',
    genericName: 'Metoclopramide',
    dosageAmount: '10',
    dosageUnit: 'mg',
    category: 'other',
    commonDoses: ['5', '10'],
  },
  {
    name: 'Phenergan',
    genericName: 'Promethazine',
    dosageAmount: '25',
    dosageUnit: 'mg',
    category: 'other',
    commonDoses: ['12.5', '25', '50'],
  },

  // Supplements - Individual
  {
    name: 'Magnesium',
    dosageAmount: '400',
    dosageUnit: 'mg',
    category: 'supplement',
    commonDoses: ['200', '400', '500', '600'],
  },
  {
    name: 'Riboflavin',
    genericName: 'Vitamin B2',
    dosageAmount: '400',
    dosageUnit: 'mg',
    category: 'supplement',
    commonDoses: ['100', '200', '400'],
  },
  {
    name: 'CoQ10',
    genericName: 'Coenzyme Q10',
    dosageAmount: '100',
    dosageUnit: 'mg',
    category: 'supplement',
    commonDoses: ['100', '200', '300'],
  },
  {
    name: 'Feverfew',
    dosageAmount: '100',
    dosageUnit: 'mg',
    category: 'supplement',
    commonDoses: ['50', '100', '150'],
  },
  {
    name: 'Butterbur',
    dosageAmount: '75',
    dosageUnit: 'mg',
    category: 'supplement',
    commonDoses: ['50', '75', '150'],
  },
  {
    name: 'Ginger',
    dosageAmount: '500',
    dosageUnit: 'mg',
    category: 'supplement',
    commonDoses: ['250', '500', '1000'],
  },
  {
    name: 'Vitamin D',
    dosageAmount: '2000',
    dosageUnit: 'IU',
    category: 'supplement',
    commonDoses: ['1000', '2000', '5000'],
  },
  {
    name: 'Melatonin',
    dosageAmount: '3',
    dosageUnit: 'mg',
    category: 'supplement',
    commonDoses: ['1', '3', '5', '10'],
  },

  // Supplements - Combination Formulas
  {
    name: 'Beam',
    dosageAmount: '1',
    dosageUnit: 'dose',
    category: 'supplement',
    ingredients: [
      { name: 'Magnesium (Bisglycinate Chelate)', amount: '400', unit: 'mg' },
      { name: 'Riboflavin (Vitamin B2)', amount: '400', unit: 'mg' },
      { name: 'CoQ10', amount: '150', unit: 'mg' },
    ],
  },
  {
    name: 'MigreLief',
    dosageAmount: '2',
    dosageUnit: 'capsules',
    category: 'supplement',
    ingredients: [
      { name: 'Magnesium (citrate & oxide)', amount: '360', unit: 'mg' },
      { name: 'Riboflavin (Vitamin B2)', amount: '400', unit: 'mg' },
      { name: 'Feverfew (Puracol)', amount: '100', unit: 'mg' },
    ],
  },
  {
    name: 'Migraine MD',
    dosageAmount: '2',
    dosageUnit: 'capsules',
    category: 'supplement',
    ingredients: [
      { name: 'Magnesium (Glycinate)', amount: '600', unit: 'mg' },
      { name: 'Riboflavin (Vitamin B2)', amount: '400', unit: 'mg' },
      { name: 'CoQ10', amount: '300', unit: 'mg' },
      { name: 'Melatonin', amount: '3', unit: 'mg' },
      { name: 'Vitamin D3', amount: '4000', unit: 'IU' },
    ],
  },
  {
    name: 'Dolovent',
    dosageAmount: '2',
    dosageUnit: 'capsules',
    category: 'supplement',
    ingredients: [
      { name: 'Magnesium (Oxide)', amount: '600', unit: 'mg' },
      { name: 'Riboflavin (Vitamin B2)', amount: '400', unit: 'mg' },
      { name: 'CoQ10', amount: '150', unit: 'mg' },
    ],
  },
  {
    name: 'Migravent',
    dosageAmount: '2',
    dosageUnit: 'softgels',
    category: 'supplement',
    ingredients: [
      { name: 'Magnesium (Oxide & Citrate)', amount: '57', unit: 'mg' },
      { name: 'Riboflavin (Vitamin B2)', amount: '133', unit: 'mg' },
      { name: 'Butterbur (PA-free)', amount: '50', unit: 'mg' },
      { name: 'CoQ10', amount: '50', unit: 'mg' },
      { name: 'BioPerine', amount: '5', unit: 'mg' },
    ],
  },
  {
    name: 'Cove',
    dosageAmount: '1',
    dosageUnit: 'dose',
    category: 'supplement',
    ingredients: [
      { name: 'Magnesium (Bisglycinate Chelate)', amount: '400', unit: 'mg' },
      { name: 'Riboflavin (Vitamin B2)', amount: '400', unit: 'mg' },
      { name: 'CoQ10', amount: '150', unit: 'mg' },
    ],
  },
];

// Helper function to search medications
export function searchMedications(query: string): PresetMedication[] {
  if (!query.trim()) {
    return PRESET_MEDICATIONS;
  }

  const lowerQuery = query.toLowerCase();
  return PRESET_MEDICATIONS.filter(med =>
    med.name.toLowerCase().includes(lowerQuery) ||
    (med.genericName && med.genericName.toLowerCase().includes(lowerQuery))
  );
}

// Helper to get medication by exact name
export function getMedicationByName(name: string): PresetMedication | undefined {
  return PRESET_MEDICATIONS.find(med =>
    med.name.toLowerCase() === name.toLowerCase() ||
    (med.genericName && med.genericName.toLowerCase() === name.toLowerCase())
  );
}

// Get category display name
export function getCategoryName(category: PresetMedication['category']): string {
  const names = {
    otc: 'Over-the-Counter',
    nsaid: 'NSAIDs',
    triptan: 'Triptans',
    cgrp: 'CGRP Antagonists',
    preventive: 'Preventive',
    supplement: 'Supplements',
    other: 'Other',
  };
  return names[category];
}
