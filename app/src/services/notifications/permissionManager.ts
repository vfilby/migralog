import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';

export interface NotificationPermissions {
  granted: boolean;
  canAskAgain: boolean;
  ios?: {
    allowsAlert: boolean;
    allowsSound: boolean;
    allowsBadge: boolean;
    allowsCriticalAlerts: boolean;
  };
}

/**
 * Request notification permissions from the user
 */
export async function requestPermissions(): Promise<NotificationPermissions> {
  logger.log('[Notification] Requesting permissions including critical alerts...');
  
  const { status, canAskAgain, ios } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowSound: true,
      allowBadge: true,
      allowCriticalAlerts: true, // Requires com.apple.developer.usernotifications.critical-alerts entitlement
    },
  });

  const permissions: NotificationPermissions = {
    granted: status === 'granted',
    canAskAgain,
    ios: ios
      ? {
          allowsAlert: ios.allowsAlert ?? false,
          allowsSound: ios.allowsSound ?? false,
          allowsBadge: ios.allowsBadge ?? false,
          allowsCriticalAlerts: ios.allowsCriticalAlerts ?? false,
        }
      : undefined,
  };

  logger.log('[Notification] Permission request result:', {
    granted: permissions.granted,
    canAskAgain: permissions.canAskAgain,
    criticalAlerts: permissions.ios?.allowsCriticalAlerts,
  });

  return permissions;
}

/**
 * Get current notification permissions
 */
export async function getPermissions(): Promise<NotificationPermissions> {
  const { status, canAskAgain, ios } = await Notifications.getPermissionsAsync();

  return {
    granted: status === 'granted',
    canAskAgain,
    ios: ios
      ? {
          allowsAlert: ios.allowsAlert ?? false,
          allowsSound: ios.allowsSound ?? false,
          allowsBadge: ios.allowsBadge ?? false,
          allowsCriticalAlerts: ios.allowsCriticalAlerts ?? false,
        }
      : undefined,
  };
}
