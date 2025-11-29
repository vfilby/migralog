/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useRef } from 'react';
import { logger } from '../../utils/logger';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Platform,
  AppState,
  AppStateStatus,
  Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../theme';
import { notificationService, NotificationPermissions } from '../../services/notifications/notificationService';
import { dailyCheckinService } from '../../services/notifications/dailyCheckinService';
import { useDailyCheckinSettingsStore } from '../../store/dailyCheckinSettingsStore';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import NotificationSettings from '../../components/shared/NotificationSettings';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationSettingsScreen'>;

const DEVELOPER_MODE_KEY = '@settings_developer_mode';

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    backgroundColor: theme.card,
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    minHeight: 80,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerSide: {
    minWidth: 60,
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
    flexShrink: 1,
    flexGrow: 1,
    textAlign: 'center',
  },
  backButton: {
    fontSize: 17,
    color: theme.primary,
    paddingVertical: 4,
  },
  section: {
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    color: theme.text,
  },
  sectionDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
    color: theme.text,
  },
  diagnosticCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  diagnosticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  diagnosticLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  diagnosticLabel: {
    fontSize: 15,
    color: theme.textSecondary,
  },
  diagnosticRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  diagnosticValueSecondary: {
    fontSize: 15,
    color: theme.textSecondary,
  },
  diagnosticValueSuccess: {
    fontSize: 15,
    color: theme.success,
    fontWeight: '500',
  },
  diagnosticValueError: {
    fontSize: 15,
    color: theme.error,
    fontWeight: '500',
  },
  diagnosticValueWarning: {
    fontSize: 15,
    color: theme.warning,
    fontWeight: '500',
  },
  diagnosticDivider: {
    height: 1,
    backgroundColor: theme.borderLight,
    marginVertical: 8,
    marginHorizontal: -4,
  },
  developerActions: {
    marginTop: 8,
    gap: 8,
  },
  developerButton: {
    backgroundColor: theme.card,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  developerButtonText: {
    fontSize: 15,
    color: theme.text,
    flex: 1,
  },
  settingsSection: {
    marginTop: 16,
  },
  notificationToggleSection: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 60,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 16,
  },
  timePickerContainer: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
    paddingRight: 16,
  },
  settingText: {
    flex: 1,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingValue: {
    fontSize: 15,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: theme.borderLight,
    marginLeft: 48, // Align with text (icon width + gap)
  },
});

export default function NotificationSettingsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [notificationPermissions, setNotificationPermissions] = useState<NotificationPermissions | null>(null);
  const [developerMode, setDeveloperMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isTogglingNotifications, setIsTogglingNotifications] = useState(false);
  const [showCheckinTimePicker, setShowCheckinTimePicker] = useState(false);

  // Daily check-in settings
  const dailyCheckinSettings = useDailyCheckinSettingsStore((state) => state.settings);
  const updateDailyCheckinSettings = useDailyCheckinSettingsStore((state) => state.updateSettings);
  const loadDailyCheckinSettings = useDailyCheckinSettingsStore((state) => state.loadSettings);
  const isDailyCheckinLoaded = useDailyCheckinSettingsStore((state) => state.isLoaded);

  useEffect(() => {
    loadNotificationStatus();
    loadDeveloperMode();
    loadNotificationsEnabled();
    if (!isDailyCheckinLoaded) {
      loadDailyCheckinSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh permissions when app comes back from background (e.g., from Settings)
  const appState = useRef(AppState.currentState);
  
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // If app is coming back to foreground, refresh permissions
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        logger.log('[NotificationSettingsScreen] App returned to foreground, refreshing permissions');
        loadNotificationStatus();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, []);

  const loadDeveloperMode = async () => {
    try {
      const stored = await AsyncStorage.getItem(DEVELOPER_MODE_KEY);
      if (stored !== null) {
        setDeveloperMode(stored === 'true');
      }
    } catch (error) {
      logger.error('Failed to load developer mode setting:', error);
    }
  };

  const loadNotificationStatus = async () => {
    try {
      const permissions = await notificationService.getPermissions();
      setNotificationPermissions(permissions);
    } catch (error) {
      logger.error('Failed to load notification permissions:', error);
    }
  };

  const openAppSettings = async () => {
    try {
      // Try to open app-specific settings first (iOS only)
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
    } catch (error) {
      logger.error('[NotificationSettingsScreen] Failed to open app settings, falling back to system settings:', error);
      // Fallback to general settings if app-specific fails
      try {
        await Linking.openSettings();
      } catch (fallbackError) {
        logger.error('[NotificationSettingsScreen] Failed to open system settings:', fallbackError);
        Alert.alert('Error', 'Failed to open Settings');
      }
    }
  };

  const loadNotificationsEnabled = async () => {
    try {
      const enabled = await notificationService.areNotificationsGloballyEnabled();
      setNotificationsEnabled(enabled);
    } catch (error) {
      logger.error('Failed to load notifications enabled setting:', error);
    }
  };

  const handleRequestNotifications = async () => {
    try {
      const permissions = await notificationService.requestPermissions();
      setNotificationPermissions(permissions);

      // Show alert if permission was denied and can't ask again (need to go to Settings)
      if (!permissions.granted && !permissions.canAskAgain) {
        Alert.alert(
          'Notifications Not Enabled',
          'Notifications are not enabled in iOS Settings. To receive medication reminders:\n\n1. Open iOS Settings\n2. Go to Notifications > MigraLog\n3. Enable "Allow Notifications"',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: openAppSettings },
          ]
        );
      } else if (!permissions.granted) {
        // Show alert for other cases where permission was denied but we might be able to ask again
        Alert.alert(
          'Notifications Disabled',
          'Notifications are required for medication reminders. Please enable them in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: openAppSettings },
          ]
        );
      }
      // UI already shows permission status, no need for success alert
    } catch (error) {
      logger.error('Failed to request notification permissions:', error);
      Alert.alert('Error', 'Failed to request notification permissions');
    }
  };



  const handleToggleNotifications = async (enabled: boolean) => {
    try {
      setIsTogglingNotifications(true);
      await notificationService.setGlobalNotificationsEnabled(enabled);
      setNotificationsEnabled(enabled);

      const message = enabled
        ? 'All medication reminders have been enabled'
        : 'All medication reminders have been disabled. Your schedules are preserved.';

      Alert.alert('Success', message);
    } catch (error) {
      logger.error('Failed to toggle notifications:', error);
      Alert.alert('Error', 'Failed to update notification settings');
    } finally {
      setIsTogglingNotifications(false);
    }
  };

  const handleToggleDailyCheckin = async (enabled: boolean) => {
    try {
      await updateDailyCheckinSettings({ enabled });
      // Reschedule or cancel notification based on new setting
      if (enabled) {
        await dailyCheckinService.scheduleNotification();
        Alert.alert('Success', 'Daily check-in reminders have been enabled');
      } else {
        await dailyCheckinService.cancelNotification();
        Alert.alert('Success', 'Daily check-in reminders have been disabled');
      }
    } catch (error) {
      logger.error('Failed to toggle daily check-in:', error);
      Alert.alert('Error', 'Failed to update daily check-in settings');
    }
  };

  const handleCheckinTimeChange = async (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowCheckinTimePicker(false);
    }

    if (selectedDate) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      const newTime = `${hours}:${minutes}`;

      try {
        await updateDailyCheckinSettings({ checkInTime: newTime });
        // Reschedule notification with new time
        await dailyCheckinService.rescheduleNotification();
        logger.log('[NotificationSettings] Updated daily check-in time to:', newTime);
      } catch (error) {
        logger.error('Failed to update check-in time:', error);
        Alert.alert('Error', 'Failed to update check-in time');
      }
    }
  };

  const getCheckinTimeAsDate = (): Date => {
    const [hours, minutes] = dailyCheckinSettings.checkInTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes);
    return date;
  };

  const formatCheckinTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const handleViewScheduledNotifications = async () => {
    try {
      const scheduled = await notificationService.getAllScheduledNotifications();

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
    } catch (error) {
      logger.error('Failed to get scheduled notifications:', error);
      Alert.alert('Error', 'Failed to get scheduled notifications');
    }
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
          body: 'This notification shows as time-sensitive with critical priority. On iOS with entitlement, it can break through silent mode.',
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

  return (
    <View style={styles.container} testID="notification-settings-screen">
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerSide}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Back"
              accessibilityHint="Returns to settings"
            >
              <Text style={styles.backButton}>Back</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>Notification Settings</Text>
          <View style={styles.headerSide} />
        </View>
      </View>

      <ScrollView>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medication Reminders</Text>
          <Text style={styles.sectionDescription}>
            Manage notification permissions for medication reminders
          </Text>

          <View style={styles.diagnosticCard}>
            <View style={styles.diagnosticRow}>
              <View style={styles.diagnosticLeft}>
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color={theme.textSecondary}
                />
                <Text style={styles.diagnosticLabel}>Status</Text>
              </View>
              <View style={styles.diagnosticRight}>
                {!notificationPermissions ? (
                  <Text style={styles.diagnosticValueSecondary}>Checking...</Text>
                ) : notificationPermissions.granted ? (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                    <Text style={styles.diagnosticValueSuccess}>Enabled</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="close-circle" size={18} color={theme.error} />
                    <Text style={styles.diagnosticValueError}>Disabled</Text>
                  </>
                )}
              </View>
            </View>
            
            {/* Critical Alerts Status - iOS Only */}
            {Platform.OS === 'ios' && notificationPermissions?.granted && (
              <>
                <View style={styles.diagnosticDivider} />
                <View style={styles.diagnosticRow}>
                  <View style={styles.diagnosticLeft}>
                    <Ionicons
                      name="volume-high-outline"
                      size={20}
                      color={theme.textSecondary}
                    />
                    <Text style={styles.diagnosticLabel}>Critical Alerts</Text>
                  </View>
                  <View style={styles.diagnosticRight}>
                    {notificationPermissions.ios?.allowsCriticalAlerts ? (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                        <Text style={styles.diagnosticValueSuccess}>Enabled</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="alert-circle" size={18} color={theme.warning} />
                        <Text style={styles.diagnosticValueWarning}>Disabled</Text>
                      </>
                    )}
                  </View>
                </View>
              </>
            )}
          </View>

          <View style={styles.developerActions}>
            {!notificationPermissions?.granted && (
              <TouchableOpacity
                style={styles.developerButton}
                onPress={handleRequestNotifications}
                accessibilityRole="button"
                accessibilityLabel="Enable notifications"
                accessibilityHint="Requests permission to send medication reminder notifications"
              >
                <Ionicons name="notifications-outline" size={24} color={theme.primary} />
                <Text style={styles.developerButtonText}>Enable Notifications</Text>
              </TouchableOpacity>
            )}


          </View>

          {notificationPermissions?.granted && (
            <>
              {/* Unified Medication Settings Block */}
              <View style={[styles.settingsSection, styles.notificationToggleSection]}>
                {/* Global Enable/Disable Toggle */}
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="notifications-outline" size={20} color={theme.textSecondary} />
                    <View style={styles.settingText}>
                      <Text style={styles.settingLabel}>Enable Medication Reminders</Text>
                      <Text style={styles.settingDescription}>
                        {notificationsEnabled
                          ? 'All medication notifications are enabled'
                          : 'All medication notifications are disabled'}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={handleToggleNotifications}
                    disabled={isTogglingNotifications}
                    trackColor={{ false: theme.border, true: theme.primary }}
                    ios_backgroundColor={theme.border}
                    accessibilityRole="switch"
                    accessibilityLabel="Enable medication reminders"
                    accessibilityHint="Toggles all medication reminder notifications on or off"
                  />
                </View>

                {/* Per-Medication Settings - Integrated */}
                {notificationsEnabled && (
                  <>
                    <View style={styles.divider} />
                    <NotificationSettings showTitle={false} />
                  </>
                )}
              </View>

              {/* Daily Check-in - Independent of medication reminders */}
              {notificationPermissions?.granted && (
                <>

                  {/* Unified Daily Check-in Settings Card */}
                  <View style={[styles.settingsSection, styles.notificationToggleSection]}>
                    {/* Enable/Disable Toggle */}
                    <View style={styles.settingRow}>
                      <View style={styles.settingLeft}>
                        <Ionicons name="checkmark-circle-outline" size={20} color={theme.textSecondary} />
                        <View style={styles.settingText}>
                          <Text style={styles.settingLabel}>Enable Daily Check-in</Text>
                          <Text style={styles.settingDescription}>
                            {dailyCheckinSettings.enabled
                              ? 'Daily reminders are enabled'
                              : 'Daily reminders are disabled'}
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={dailyCheckinSettings.enabled}
                        onValueChange={handleToggleDailyCheckin}
                        trackColor={{ false: theme.border, true: theme.primary }}
                        ios_backgroundColor={theme.border}
                        accessibilityRole="switch"
                        accessibilityLabel="Enable daily check-in"
                        accessibilityHint="Toggles daily check-in reminders on or off"
                      />
                    </View>

                    {dailyCheckinSettings.enabled && (
                      <>
                        <View style={styles.divider} />

                        {/* Check-in Time Setting */}
                        <TouchableOpacity
                          style={styles.settingRow}
                          onPress={() => setShowCheckinTimePicker(!showCheckinTimePicker)}
                          accessibilityRole="button"
                          accessibilityLabel={`Check-in time: ${formatCheckinTime(dailyCheckinSettings.checkInTime)}`}
                          accessibilityHint="Tap to change the daily check-in reminder time"
                        >
                          <View style={styles.settingLeft}>
                            <Ionicons name="time-outline" size={20} color={theme.textSecondary} />
                            <View style={styles.settingText}>
                              <Text style={styles.settingLabel}>Check-in Time</Text>
                              <Text style={styles.settingDescription}>
                                When to send the daily reminder
                              </Text>
                            </View>
                          </View>
                          <View style={styles.settingRight}>
                            <Text style={styles.settingValue}>
                              {formatCheckinTime(dailyCheckinSettings.checkInTime)}
                            </Text>
                            <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
                          </View>
                        </TouchableOpacity>

                        {showCheckinTimePicker && (
                          <View style={styles.timePickerContainer}>
                            <DateTimePicker
                              value={getCheckinTimeAsDate()}
                              mode="time"
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              onChange={handleCheckinTimeChange}
                              testID="checkin-time-picker"
                            />
                          </View>
                        )}

                        <View style={styles.divider} />

                        {/* Time-sensitive Toggle */}
                        <View style={styles.settingRow}>
                          <View style={styles.settingLeft}>
                            <Ionicons name="flash-outline" size={20} color={theme.textSecondary} />
                            <View style={styles.settingText}>
                              <Text style={styles.settingLabel}>Time-Sensitive</Text>
                              <Text style={styles.settingDescription}>
                                Show notifications even in Focus mode
                              </Text>
                            </View>
                          </View>
                          <Switch
                            value={dailyCheckinSettings.timeSensitive}
                            onValueChange={(value) => updateDailyCheckinSettings({ timeSensitive: value })}
                            trackColor={{ false: theme.border, true: theme.primary }}
                            ios_backgroundColor={theme.border}
                            accessibilityRole="switch"
                            accessibilityLabel="Time-sensitive daily check-in"
                            accessibilityHint="Toggles whether daily check-in notifications break through focus modes"
                          />
                        </View>
                      </>
                    )}
                  </View>
                </>
              )}
            </>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}
