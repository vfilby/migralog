/**
 * Navigation Service
 *
 * Provides a navigation ref for programmatic navigation outside of React components
 * Used by deep links and other utilities that need to navigate without props
 */

import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Navigate to a route programmatically
 * @param name Route name
 * @param params Route parameters
 */
export function navigate(name: keyof RootStackParamList, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as any, params);
  }
}

/**
 * Go back to the previous screen
 */
export function goBack() {
  if (navigationRef.isReady()) {
    navigationRef.goBack();
  }
}
