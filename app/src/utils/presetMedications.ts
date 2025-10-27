// Preset medications database for quick medication entry
// Organized by category for easy browsing

export interface PresetMedication {
  name: string;
  genericName?: string;
  dosageAmount: string;
  dosageUnit: string;
  category: 'otc' | 'triptan' | 'cgrp' | 'preventive' | 'other';
  commonDoses?: string[]; // Alternative common doses
}

export const PRESET_MEDICATIONS: PresetMedication[] = [
  // Over-the-Counter (OTC)
  {
    name: 'Tylenol',
    genericName: 'Acetaminophen',
    dosageAmount: '500',
    dosageUnit: 'mg',
    category: 'otc',
    commonDoses: ['325', '500', '650'],
  },
  {
    name: 'Advil',
    genericName: 'Ibuprofen',
    dosageAmount: '200',
    dosageUnit: 'mg',
    category: 'otc',
    commonDoses: ['200', '400', '600', '800'],
  },
  {
    name: 'Aleve',
    genericName: 'Naproxen',
    dosageAmount: '220',
    dosageUnit: 'mg',
    category: 'otc',
    commonDoses: ['220', '500'],
  },
  {
    name: 'Excedrin Migraine',
    dosageAmount: '2',
    dosageUnit: 'tablets',
    category: 'otc',
  },
  {
    name: 'Aspirin',
    dosageAmount: '325',
    dosageUnit: 'mg',
    category: 'otc',
    commonDoses: ['81', '325', '500'],
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
    triptan: 'Triptans',
    cgrp: 'CGRP Antagonists',
    preventive: 'Preventive',
    other: 'Other',
  };
  return names[category];
}
