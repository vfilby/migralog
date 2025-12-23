import { Alert } from 'react-native';
import { logger } from '../../../utils/logger';
import { notificationService } from '../../../services/notifications/notificationService';
import { dailyCheckinService } from '../../../services/notifications/dailyCheckinService';
import * as Notifications from 'expo-notifications';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';

export function useNotificationTesting(
  navigation: NativeStackNavigationProp<RootStackParamList, 'DeveloperToolsScreen'>
) {
  /**
   * Navigate to scheduled notifications screen
   */
  const handleViewScheduledNotifications = () => {
    navigation.navigate('ScheduledNotificationsScreen');
  };

  const handleTestNotification = async (timeSensitive: boolean) => {
    try {
      // Check if notifications are enabled
      const permissions = await notificationService.getPermissions();
      if (!permissions.granted) {
        Alert.alert('Notifications Disabled', 'Please enable notifications in Settings.');
        return;
      }

      // Schedule a test notification for 5 seconds from now
      const testTime = new Date(Date.now() + 5000);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Test Notification${timeSensitive ? ' (Time-Sensitive)' : ''}`,
          body: 'This is a test notification from MigraLog',
          sound: true,
          ...(Notifications.AndroidNotificationPriority && {
            priority: Notifications.AndroidNotificationPriority.HIGH,
          }),
          // Only set time-sensitive interruption level if enabled
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(timeSensitive && { interruptionLevel: 'timeSensitive' } as any),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: testTime },
      });

      Alert.alert(
        'Test Scheduled',
        `A${timeSensitive ? ' time-sensitive' : ' regular'} notification will appear in 5 seconds.${
          timeSensitive
            ? ' Time-sensitive notifications break through Focus modes on iOS.'
            : ''
        }`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to schedule test notification');
      logger.error('Failed to schedule test notification:', error);
    }
  };

  const handleTestCriticalNotification = async () => {
    try {
      // Check if notifications are enabled
      const permissions = await notificationService.getPermissions();
      if (!permissions.granted) {
        Alert.alert('Notifications Disabled', 'Please enable notifications in Settings.');
        return;
      }

      // Schedule a test critical notification for 5 seconds from now
      const testTime = new Date(Date.now() + 5000);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Test Critical Notification',
          body: 'This notification shows as critical priority. On iOS with entitlement, it can break through silent mode.',
          sound: true,
          // Critical alert properties (requires entitlement on iOS)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...({ critical: true } as any),
          ...(Notifications.AndroidNotificationPriority && {
            priority: Notifications.AndroidNotificationPriority.MAX,
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...({ interruptionLevel: 'critical' } as any),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: testTime },
      });

      Alert.alert(
        'Critical Test Scheduled',
        'A critical notification will appear in 5 seconds.\n\nThis notification shows as time-sensitive on the build. Critical alerts that break through silent mode require Apple entitlement.'
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to schedule test notification');
      logger.error('Failed to schedule test critical notification:', error);
    }
  };

  const handleRecreateAllSchedules = async () => {
    Alert.alert(
      'Recreate All Notification Schedules',
      'This will cancel all existing notification schedules and recreate them with current settings. This can fix issues with orphaned or incorrect schedules.\n\nContinue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Recreate',
          style: 'default',
          onPress: async () => {
            try {
              await notificationService.rescheduleAllMedicationNotifications();
              await dailyCheckinService.rescheduleNotification();
              Alert.alert(
                'Success',
                'All notification schedules have been recreated with current settings.'
              );
              logger.log('[DeveloperTools] Successfully recreated all notification schedules');
            } catch (error) {
              logger.error('[DeveloperTools] Failed to recreate notification schedules:', error);
              Alert.alert('Error', 'Failed to recreate notification schedules');
            }
          },
        },
      ]
    );
  };

  const handleFixScheduleInconsistencies = async () => {
    Alert.alert(
      'Fix Schedule Inconsistencies',
      'This will check for and cancel notifications that contain outdated schedule IDs that no longer exist in your medications. This fixes the specific issue where notifications fail because they reference old schedules.\n\nContinue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Fix',
          style: 'default',
          onPress: async () => {
            try {
              const { fixNotificationScheduleInconsistencies } = await import('../../../services/notifications');
              const result = await fixNotificationScheduleInconsistencies();
              
              Alert.alert(
                'Inconsistency Check Complete',
                `Found and canceled ${result.orphanedNotifications} orphaned notifications with invalid schedule IDs.\n\nInvalid schedule IDs: ${result.invalidScheduleIds.length > 0 ? result.invalidScheduleIds.join(', ').substring(0, 100) + (result.invalidScheduleIds.join(', ').length > 100 ? '...' : '') : 'None'}`
              );
              logger.log('[DeveloperTools] Fixed notification schedule inconsistencies:', result);
            } catch (error) {
              logger.error('[DeveloperTools] Failed to fix schedule inconsistencies:', error);
              Alert.alert('Error', 'Failed to fix schedule inconsistencies');
            }
          },
        },
      ]
    );
  };

  const handleDiagnoseCriticalAlerts = async () => {
    try {
      // Check current permissions
      const permissions = await notificationService.getPermissions();
      
      // Import tracking functions
      const { hasCriticalAlertsBeenRequested } = await import('../../../services/notifications/notificationUtils');
      const criticalAlertsRequested = await hasCriticalAlertsBeenRequested();
      
      // Get detailed information
      const detailedInfo = {
        granted: permissions.granted,
        canAskAgain: permissions.canAskAgain,
        criticalAlerts: permissions.ios?.allowsCriticalAlerts,
        criticalAlertsRequested,
        allowsAlert: permissions.ios?.allowsAlert,
        allowsSound: permissions.ios?.allowsSound,
        allowsBadge: permissions.ios?.allowsBadge,
      };

      const message = `Critical Alerts Diagnosis:

🔔 Permissions:
• General: ${detailedInfo.granted ? '✅ Granted' : '❌ Denied'}
• Can Ask Again: ${detailedInfo.canAskAgain ? '✅ Yes' : '❌ No'}
• Alerts: ${detailedInfo.allowsAlert ? '✅' : '❌'}
• Sound: ${detailedInfo.allowsSound ? '✅' : '❌'}
• Badge: ${detailedInfo.allowsBadge ? '✅' : '❌'}
• Critical Alerts: ${detailedInfo.criticalAlerts ? '✅ Enabled' : '❌ Disabled'}
• Critical Ever Requested: ${detailedInfo.criticalAlertsRequested ? '✅ Yes' : '❌ No'}

🔧 Build Info:
For Critical Alerts to appear in iOS Settings, the app must be built with:
1. Production provisioning profile
2. Critical alerts entitlement enabled
3. App Store or TestFlight distribution

Development builds may not show Critical Alerts in iOS Settings even with proper entitlements.

📋 Config Check:
• Entitlement in config: ✅ com.apple.developer.usernotifications.critical-alerts
• Plugin config: ✅ expo-notifications with iosAllowCriticalAlerts
• Info.plist: ✅ UNNotificationCriticalAlertsEnabled

🚨 Common Issues:
1. Testing on simulator (Critical Alerts need physical device)
2. Development build (needs production profile)
3. Apple approval required for production use
4. Can only be requested once per app install`;

      Alert.alert('Critical Alerts Diagnosis', message, [{ text: 'OK' }]);
      
      logger.log('[DeveloperTools] Critical Alerts Diagnosis:', detailedInfo);
    } catch (error) {
      logger.error('[DeveloperTools] Failed to diagnose critical alerts:', error);
      Alert.alert('Error', 'Failed to get critical alerts information');
    }
  };

  const handleTestCriticalAlertsRequest = async () => {
    try {
      Alert.alert(
        'Test Critical Alerts Request',
        'This will attempt to request critical alerts permission directly. This should only work if:\n\n1. Running on a physical device\n2. Using a production build\n3. Critical alerts have never been requested before\n\nContinue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Test Request',
            style: 'default',
            onPress: async () => {
              try {
                logger.log('[DeveloperTools] Testing critical alerts request...');

                // Check current status first
                const beforePermissions = await notificationService.getPermissions();
                logger.log('[DeveloperTools] Permissions before request:', beforePermissions);

                // Make the request
                const afterPermissions = await notificationService.requestPermissions();
                logger.log('[DeveloperTools] Permissions after request:', afterPermissions);

                const resultMessage = `Test Results:

BEFORE REQUEST:
• General: ${beforePermissions.granted ? 'Granted' : 'Denied'}
• Critical: ${beforePermissions.ios?.allowsCriticalAlerts ? 'Enabled' : 'Disabled'}

AFTER REQUEST:
• General: ${afterPermissions.granted ? 'Granted' : 'Denied'}
• Critical: ${afterPermissions.ios?.allowsCriticalAlerts ? 'Enabled' : 'Disabled'}

CHANGED:
• Critical Alerts: ${beforePermissions.ios?.allowsCriticalAlerts !== afterPermissions.ios?.allowsCriticalAlerts ? 'YES' : 'NO'}

If Critical Alerts didn't change, check:
1. Physical device (not simulator)
2. Production build (not development)
3. Never requested before
4. Apple entitlement approval`;

                Alert.alert('Critical Alerts Test Result', resultMessage);
              } catch (error) {
                logger.error('[DeveloperTools] Critical alerts test failed:', error);
                Alert.alert('Test Failed', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            },
          },
        ]
      );
    } catch (error) {
      logger.error('[DeveloperTools] Failed to test critical alerts request:', error);
      Alert.alert('Error', 'Failed to test critical alerts request');
    }
  };

  /**
   * Setup notification test scenarios for manual testing
   * Schedules various notification types with short delays (1-6 minutes)
   */
  const handleSetupNotificationTests = async () => {
    try {
      // Check if notifications are enabled first
      const permissions = await notificationService.getPermissions();
      if (!permissions.granted) {
        Alert.alert('Notifications Disabled', 'Please enable notifications in Settings first.');
        return;
      }

      // Dynamic import to avoid bundling in production
      const { confirmAndSetupNotificationTests } = await import('../../../utils/devTestHelpers');
      await confirmAndSetupNotificationTests();
    } catch (error) {
      logger.error('[DeveloperTools] Failed to setup notification tests:', error);
      Alert.alert('Error', 'Failed to setup notification tests');
    }
  };

  /**
   * Setup notification test scenarios in BURST mode (10-second intervals)
   * Tests how multiple simultaneous notifications are handled
   */
  const handleSetupNotificationTestsBurst = async () => {
    try {
      // Check if notifications are enabled first
      const permissions = await notificationService.getPermissions();
      if (!permissions.granted) {
        Alert.alert('Notifications Disabled', 'Please enable notifications in Settings first.');
        return;
      }

      // Dynamic import to avoid bundling in production
      const { confirmAndSetupNotificationTestsBurst } = await import('../../../utils/devTestHelpers');
      await confirmAndSetupNotificationTestsBurst();
    } catch (error) {
      logger.error('[DeveloperTools] Failed to setup burst notification tests:', error);
      Alert.alert('Error', 'Failed to setup burst notification tests');
    }
  };

  /**
   * Setup grouped notification test scenario
   * Creates medications at the same time to test partial group logging
   */
  const handleSetupGroupedNotificationTest = async () => {
    try {
      // Check if notifications are enabled first
      const permissions = await notificationService.getPermissions();
      if (!permissions.granted) {
        Alert.alert('Notifications Disabled', 'Please enable notifications in Settings first.');
        return;
      }

      // Dynamic import to avoid bundling in production
      const { confirmAndSetupGroupedNotificationTest } = await import('../../../utils/devTestHelpers');
      await confirmAndSetupGroupedNotificationTest();
    } catch (error) {
      logger.error('[DeveloperTools] Failed to setup grouped notification test:', error);
      Alert.alert('Error', 'Failed to setup grouped notification test');
    }
  };

  return {
    handleViewScheduledNotifications,
    handleTestNotification,
    handleTestCriticalNotification,
    handleRecreateAllSchedules,
    handleFixScheduleInconsistencies,
    handleDiagnoseCriticalAlerts,
    handleTestCriticalAlertsRequest,
    handleSetupNotificationTests,
    handleSetupNotificationTestsBurst,
    handleSetupGroupedNotificationTest,
  };
}
