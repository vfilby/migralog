// Migraine pain scale utilities based on clinical migraine pain scales
// Reference: https://www.painscale.com/tools/migraine-pain-scale/

export interface PainLevel {
  value: number;
  label: string;
  description: string;
  color: string;
}

export const PAIN_SCALE: PainLevel[] = [
  {
    value: 0,
    label: 'No Pain',
    description: 'Pain-free',
    color: '#2E7D32', // Dark Green - better contrast
  },
  {
    value: 1,
    label: 'Minimal',
    description: 'Very mild, barely noticeable',
    color: '#558B2F', // Darker Green
  },
  {
    value: 2,
    label: 'Mild',
    description: 'Minor annoyance, can be ignored',
    color: '#689F38', // Olive Green
  },
  {
    value: 3,
    label: 'Mild',
    description: 'Noticeable but can function normally',
    color: '#F9A825', // Darker Yellow - better contrast
  },
  {
    value: 4,
    label: 'Uncomfortable',
    description: 'Distracting but manageable',
    color: '#FF8F00', // Darker Amber
  },
  {
    value: 5,
    label: 'Moderate',
    description: 'Interferes with concentration',
    color: '#EF6C00', // Darker Orange
  },
  {
    value: 6,
    label: 'Distressing',
    description: 'Difficult to ignore, limits activities',
    color: '#E65100', // Deep Orange
  },
  {
    value: 7,
    label: 'Severe',
    description: 'Dominant focus, impedes daily function',
    color: '#D84315', // Dark Deep Orange
  },
  {
    value: 8,
    label: 'Intense',
    description: 'Overwhelming, unable to function',
    color: '#C62828', // Dark Red
  },
  {
    value: 9,
    label: 'Excruciating',
    description: 'Unbearable, incapacitating',
    color: '#EC407A', // Bright Pink - better contrast in dark mode
  },
  {
    value: 10,
    label: 'Debilitating',
    description: 'Worst imaginable, requires emergency care',
    color: '#AB47BC', // Bright Purple - better contrast in dark mode
  },
];

export const getPainLevel = (intensity: number): PainLevel => {
  return PAIN_SCALE[Math.max(0, Math.min(10, Math.round(intensity)))];
};

export const getPainColor = (intensity: number): string => {
  return getPainLevel(intensity).color;
};

export const getPainDescription = (intensity: number): string => {
  const level = getPainLevel(intensity);
  return `${level.label}: ${level.description}`;
};
