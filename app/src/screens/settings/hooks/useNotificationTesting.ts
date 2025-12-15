import { Alert } from 'react-native';
import { logger } from '../../../utils/logger';
import { notificationService } from '../../../services/notifications/notificationService';
import { dailyCheckinService } from '../../../services/notifications/dailyCheckinService';
import * as Notifications from 'expo-notifications';
import { scheduledNotificationRepository } from '../../../database/scheduledNotificationRepository';
import { medicationRepository } from '../../../database/medicationRepository';

export function useNotificationTesting() {
  /**
   * View scheduled notification summary by medication
   * Shows how far out each medication has notifications scheduled
   */
  const handleViewScheduledNotifications = async () => {
    try {
      // Get both OS notifications and database mappings
      const osNotifications = await notificationService.getAllScheduledNotifications();

      // Check if database table exists
      const tableExists = await scheduledNotificationRepository.tableExists();
      if (!tableExists) {
        // Fallback to old display if table doesn't exist
        return handleViewScheduledNotificationsLegacy(osNotifications);
      }

      // Get database mappings grouped by medication
      const futureMappings = await scheduledNotificationRepository.getFutureMappings();
      const medications = await medicationRepository.getActive();

      // Create medication name lookup
      const medNameMap = new Map<string, string>();
      for (const med of medications) {
        medNameMap.set(med.id, med.name);
      }

      // Group mappings by medication with reminder/followup breakdown
      const byMedication = new Map<string, {
        reminders: string[];
        followups: string[];
        scheduleId: string
      }>();
      for (const mapping of futureMappings) {
        // Skip non-medication notifications (daily check-in)
        if (!mapping.medicationId || !mapping.scheduleId) {
          continue;
        }
        if (!byMedication.has(mapping.medicationId)) {
          byMedication.set(mapping.medicationId, { reminders: [], followups: [], scheduleId: mapping.scheduleId });
        }
        const medData = byMedication.get(mapping.medicationId)!;
        if (mapping.notificationType === 'follow_up') {
          medData.followups.push(mapping.date);
        } else {
          medData.reminders.push(mapping.date);
        }
      }

      // Get daily check-in mappings separately
      const dailyCheckinMappings = await scheduledNotificationRepository.getFutureDailyCheckinMappings();

      // Build summary message
      // futureMappings includes ALL mappings (medication + daily check-in)
      let message = `📊 OS Notifications: ${osNotifications.length}\n📂 DB Mappings: ${futureMappings.length}\n`;
      if (dailyCheckinMappings.length > 0) {
        const sortedDates = dailyCheckinMappings.map(m => m.date).sort();
        const firstDate = sortedDates[0];
        const lastDate = sortedDates[sortedDates.length - 1];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastDateObj = new Date(lastDate);
        const daysOut = Math.ceil((lastDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        message += `🌅 Daily Check-in: ${dailyCheckinMappings.length} (${firstDate} → ${lastDate}, ${daysOut} days)\n`;
      }
      message += '\n';

      if (byMedication.size === 0) {
        message += 'No medication notifications scheduled.';
      } else {
        message += '📅 Per-Medication Schedule:\n\n';

        for (const [medId, data] of byMedication) {
          const medName = medNameMap.get(medId) || `Unknown (${medId.slice(-8)})`;
          const allDates = [...data.reminders, ...data.followups].sort();
          const firstDate = allDates[0];
          const lastDate = allDates[allDates.length - 1];

          // Calculate days from today
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const lastDateObj = new Date(lastDate);
          const daysOut = Math.ceil((lastDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          const totalCount = data.reminders.length + data.followups.length;
          message += `• ${medName}\n`;
          message += `  ${totalCount} total (${data.reminders.length} reminders + ${data.followups.length} follow-ups)\n`;
          message += `  ${firstDate} → ${lastDate} (${daysOut} days out)\n\n`;
        }
      }

      Alert.alert(
        'Notification Schedule',
        message,
        [
          { text: 'Details', onPress: () => handleViewScheduledNotificationsLegacy(osNotifications) },
          { text: 'OK' },
        ],
        { cancelable: true }
      );
    } catch (error) {
      logger.error('Failed to get scheduled notifications:', error);
      Alert.alert('Error', 'Failed to get scheduled notifications');
    }
  };

  /**
   * Legacy detailed view of each individual notification
   */
  const handleViewScheduledNotificationsLegacy = async (scheduled: Notifications.NotificationRequest[]) => {
    if (scheduled.length === 0) {
      Alert.alert('No Notifications', 'No notifications are currently scheduled');
      return;
    }

    const message = scheduled.map((notif, index) => {
      // Trigger types vary (calendar/time/date) - use dynamic access
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const trigger = notif.trigger as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content = notif.content as any;
      let timeInfo = 'Unknown trigger';

      if (trigger.type === 'calendar' || (trigger.hour !== undefined && trigger.minute !== undefined)) {
        timeInfo = `Daily at ${trigger.hour}:${String(trigger.minute).padStart(2, '0')}`;
      } else if (trigger.date) {
        timeInfo = `At ${new Date(trigger.date).toLocaleString()}`;
      } else if (trigger.seconds) {
        timeInfo = `In ${trigger.seconds} seconds`;
      }

      // Extract debugging information
      const interruptionLevel = content.interruptionLevel || 'active';
      const critical = content.critical ? 'Yes' : 'No';
      const categoryId = content.categoryIdentifier || 'none';
      const data = content.data;
      let dataInfo = 'none';

      if (data) {
        const parts = [];
        if (data.medicationId) parts.push(`med:${data.medicationId.slice(-8)}`);
        if (data.medicationIds) parts.push(`meds:${data.medicationIds.length}`);
        if (data.scheduleId) parts.push(`sched:${data.scheduleId.slice(-8)}`);
        if (data.isFollowUp) parts.push('followUp');
        if (data.time) parts.push(`time:${data.time}`);
        dataInfo = parts.length > 0 ? parts.join(', ') : 'empty';
      }

      return `${index + 1}. ${notif.content.title}\n   ${timeInfo}\n   Level: ${interruptionLevel} | Critical: ${critical}\n   Category: ${categoryId}\n   Data: ${dataInfo}\n   ID: ${notif.identifier.slice(-8)}`;
    }).join('\n\n');

    Alert.alert(
      `Scheduled Notifications (${scheduled.length})`,
      message,
      [{ text: 'OK' }],
      { cancelable: true }
    );
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        trigger: testTime as any,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        trigger: testTime as any,
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

  return {
    handleViewScheduledNotifications,
    handleTestNotification,
    handleTestCriticalNotification,
    handleRecreateAllSchedules,
    handleFixScheduleInconsistencies,
    handleDiagnoseCriticalAlerts,
    handleTestCriticalAlertsRequest,
  };
}
