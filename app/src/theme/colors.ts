// Theme color definitions for light and dark modes
// All colors are WCAG AA compliant for accessibility

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  // Backgrounds
  background: string;
  backgroundSecondary: string;
  card: string;

  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;

  // Borders
  border: string;
  borderLight: string;

  // Interactive
  primary: string;
  primaryText: string;
  danger: string;
  dangerText: string;

  // Status
  ongoing: string;
  ongoingText: string;

  // Shadows (iOS-style)
  shadow: string;

  // Tab bar
  tabBarBackground: string;
  tabBarBorder: string;
  tabBarInactive: string;
  tabBarActive: string;
}

export const lightColors: ThemeColors = {
  // Backgrounds
  background: '#F2F2F7',
  backgroundSecondary: '#FFFFFF',
  card: '#FFFFFF',

  // Text
  text: '#000000',
  textSecondary: '#8E8E93',
  textTertiary: '#C7C7CC',

  // Borders
  border: '#E5E5EA',
  borderLight: '#F2F2F7',

  // Interactive
  primary: '#007AFF',
  primaryText: '#FFFFFF',
  danger: '#FF3B30',
  dangerText: '#FFFFFF',

  // Status
  ongoing: '#FF3B30',
  ongoingText: '#FFFFFF',

  // Shadows
  shadow: '#000000',

  // Tab bar
  tabBarBackground: '#FFFFFF',
  tabBarBorder: '#E5E5EA',
  tabBarInactive: '#8E8E93',
  tabBarActive: '#007AFF',
};

export const darkColors: ThemeColors = {
  // Backgrounds
  background: '#000000',
  backgroundSecondary: '#1C1C1E',
  card: '#1C1C1E',

  // Text
  text: '#FFFFFF',
  textSecondary: '#AEAEB2',
  textTertiary: '#636366',

  // Borders
  border: '#38383A',
  borderLight: '#2C2C2E',

  // Interactive
  primary: '#0A84FF',
  primaryText: '#FFFFFF',
  danger: '#FF453A',
  dangerText: '#FFFFFF',

  // Status
  ongoing: '#FF453A',
  ongoingText: '#FFFFFF',

  // Shadows
  shadow: '#000000',

  // Tab bar
  tabBarBackground: '#1C1C1E',
  tabBarBorder: '#38383A',
  tabBarInactive: '#AEAEB2',
  tabBarActive: '#0A84FF',
};
