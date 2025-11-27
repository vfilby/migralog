import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/logger';

// AsyncStorage key for global notification toggle
export const NOTIFICATIONS_ENABLED_KEY = '@notifications_enabled';

/**
 * Check if notifications are globally enabled
 * This is extracted to avoid circular dependencies between notification services
 */
export async function areNotificationsGloballyEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    // Default to true if not set (for existing users)
    return value === null ? true : JSON.parse(value);
  } catch (error) {
    logger.error('[NotificationUtils] Error reading global toggle state:', error);
    return true; // Default to enabled on error
  }
}

/**
 * Set the global notification enabled state
 */
export async function setNotificationsGloballyEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, JSON.stringify(enabled));
    logger.log('[NotificationUtils] Global notifications set to:', enabled);
  } catch (error) {
    logger.error('[NotificationUtils] Error saving global toggle state:', error);
    throw error;
  }
}
