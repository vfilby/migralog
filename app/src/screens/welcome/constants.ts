/**
 * Constants and configuration for the onboarding flow
 */

export interface StepProps {
  colors: {
    text: string;
    textSecondary: string;
    textTertiary: string;
    card: string;
    border: string;
    primary: string;
  };
}

export interface OnboardingStep {
  id: number;
  title: string;
  testID: string;
  requiresPermission?: 'notification' | 'location';
}

export const TOTAL_STEPS = 4;

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { 
    id: 1, 
    title: 'Welcome', 
    testID: 'welcome-step' 
  },
  { 
    id: 2, 
    title: 'Disclaimer', 
    testID: 'disclaimer-step' 
  },
  { 
    id: 3, 
    title: 'Notifications', 
    testID: 'notification-permissions-step',
    requiresPermission: 'notification' 
  },
  { 
    id: 4, 
    title: 'Location', 
    testID: 'location-permissions-step',
    requiresPermission: 'location' 
  },
];

/**
 * Icon names that should use Ionicons
 * Using a Set for O(1) lookup performance
 */
export const IONICON_NAMES = new Set([
  'pulse-outline',
  'medical-outline',
  'trending-up-outline',
  'shield-checkmark-outline',
  'warning',
  'calendar-outline',
  'map-outline',
  'notifications-outline',
  'location-outline',
  'information-circle-outline',
]);

/**
 * Timeout for permission requests to prevent hanging in E2E tests
 */
export const PERMISSION_REQUEST_TIMEOUT_MS = 3000;
