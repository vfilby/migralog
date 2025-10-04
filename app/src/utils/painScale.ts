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
    color: '#4CAF50', // Green
  },
  {
    value: 1,
    label: 'Minimal',
    description: 'Very mild, barely noticeable',
    color: '#8BC34A', // Light Green
  },
  {
    value: 2,
    label: 'Mild',
    description: 'Minor annoyance, can be ignored',
    color: '#CDDC39', // Lime
  },
  {
    value: 3,
    label: 'Mild',
    description: 'Noticeable but can function normally',
    color: '#FFEB3B', // Yellow
  },
  {
    value: 4,
    label: 'Uncomfortable',
    description: 'Distracting but manageable',
    color: '#FFC107', // Amber
  },
  {
    value: 5,
    label: 'Moderate',
    description: 'Interferes with concentration',
    color: '#FF9800', // Orange
  },
  {
    value: 6,
    label: 'Distressing',
    description: 'Difficult to ignore, limits activities',
    color: '#FF9800', // Orange
  },
  {
    value: 7,
    label: 'Severe',
    description: 'Dominant focus, impedes daily function',
    color: '#FF5722', // Deep Orange
  },
  {
    value: 8,
    label: 'Intense',
    description: 'Overwhelming, unable to function',
    color: '#F44336', // Red
  },
  {
    value: 9,
    label: 'Excruciating',
    description: 'Unbearable, incapacitating',
    color: '#E91E63', // Pink
  },
  {
    value: 10,
    label: 'Debilitating',
    description: 'Worst imaginable, requires emergency care',
    color: '#9C27B0', // Purple
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
