/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../theme';
import { buildInfo } from '../../buildInfo';
import { errorLogger, ErrorLog } from '../../services/errorLogger';
import { notificationService, NotificationPermissions } from '../../services/notificationService';
import { dailyCheckinService } from '../../services/dailyCheckinService';
import { locationService } from '../../services/locationService';
import { useDailyCheckinSettingsStore } from '../../store/dailyCheckinSettingsStore';
import * as SQLite from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DateTimePickerEvent } from '@react-native-community/datetimepicker';


type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const DEVELOPER_MODE_KEY = '@settings_developer_mode';

export default function SettingsScreen({ navigation }: Props) {
  const { theme, themeMode, setThemeMode, isDark } = useTheme();
  
   
  const styles = createStyles(theme);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [dbStatus, setDbStatus] = useState<'checking' | 'healthy' | 'error'>('checking');
  const [notificationPermissions, setNotificationPermissions] = useState<NotificationPermissions | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [developerMode, setDeveloperMode] = useState(false);
  const [versionTapCount, setVersionTapCount] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isTogglingNotifications, setIsTogglingNotifications] = useState(false);
  const [showCheckinTimePicker, setShowCheckinTimePicker] = useState(false);

  // Daily check-in settings
  const dailyCheckinSettings = useDailyCheckinSettingsStore((state) => state.settings);
  const updateDailyCheckinSettings = useDailyCheckinSettingsStore((state) => state.updateSettings);
  const loadDailyCheckinSettings = useDailyCheckinSettingsStore((state) => state.loadSettings);
  const isDailyCheckinLoaded = useDailyCheckinSettingsStore((state) => state.isLoaded);

  const [sentryStatus, setSentryStatus] = useState<{
    isConfigured: boolean;
    isEnabled: boolean;
    environment: string;
    reason?: string;
    dsn?: string;
    org?: string;
    project?: string;
    slug?: string;
    bundleId?: string;
  } | null>(null);

  useEffect(() => {
    loadDiagnostics();
    loadDeveloperMode();
    loadNotificationsEnabled();
    if (!isDailyCheckinLoaded) {
      loadDailyCheckinSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const toggleDeveloperMode = async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(DEVELOPER_MODE_KEY, enabled.toString());
      setDeveloperMode(enabled);
    } catch (error) {
      logger.error('Failed to save developer mode setting:', error);
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

  const handleVersionTap = () => {
    const newCount = versionTapCount + 1;
    setVersionTapCount(newCount);

    if (newCount === 7) {
      const newMode = !developerMode;
      toggleDeveloperMode(newMode);
      setVersionTapCount(0);
      Alert.alert(
        newMode ? 'Developer Mode Enabled' : 'Developer Mode Disabled',
        newMode
          ? 'Developer tools are now visible in Settings.'
          : 'Developer tools have been hidden.'
      );
    }
  };

  const loadDiagnostics = async () => {
    try {
      // Load recent error logs
      const logs = await errorLogger.getRecentLogs(5);
      setErrorLogs(logs);

      // Check database health
      await checkDatabaseHealth();

      // Check Sentry configuration
      checkSentryConfiguration();

      // Load notification permissions
      const permissions = await notificationService.getPermissions();
      setNotificationPermissions(permissions);

      // Check location permissions
      const hasLocationPermission = await locationService.checkPermission();
      setLocationPermission(hasLocationPermission);
    } catch (error) {
      logger.error('Failed to load diagnostics:', error);
    }
  };

  const checkSentryConfiguration = () => {
    try {
      const client = Sentry.getClient();
      const dsn = client?.getOptions().dsn;
      const enabled = client?.getOptions().enabled ?? false;
      const environment = client?.getOptions().environment ?? 'unknown';
      const isConfigured = !!dsn && enabled;

      // Get configuration values from Constants and environment
      const expoConfig = Constants.expoConfig || {};
      const slug = (expoConfig as Record<string, unknown>)?.slug;
      const bundleId = ((expoConfig as Record<string, unknown>)?.ios as Record<string, unknown>)?.bundleIdentifier;

      let reason: string | undefined;
      if (!isConfigured) {
        if (!dsn) {
          reason = 'DSN not configured\n\nCheck EXPO_PUBLIC_SENTRY_DSN environment variable in GitHub Actions secrets';
        } else if (!enabled) {
          reason = 'Sentry is disabled\n\nCheck EXPO_PUBLIC_SENTRY_ENABLED environment variable in GitHub Actions secrets';
        }
      }

      setSentryStatus({
        isConfigured,
        isEnabled: enabled,
        environment,
        reason,
        dsn: dsn || 'not configured',
        org: process.env.SENTRY_ORG || 'eff3',
        project: process.env.SENTRY_PROJECT || 'migralog',
        slug: typeof slug === 'string' ? slug : undefined,
        bundleId: typeof bundleId === 'string' ? bundleId : undefined,
      });
    } catch (error) {
      logger.error('Failed to check Sentry configuration:', error);
    }
  };

  const checkDatabaseHealth = async () => {
    try {
      const db = await SQLite.openDatabaseAsync('migralog.db');
      await db.execAsync('SELECT 1'); // Simple query to test connection
      setDbStatus('healthy');
    } catch (error) {
      logger.error('Database health check failed:', error);
      setDbStatus('error');
      await errorLogger.log('database', 'Database health check failed', error as Error);
    }
  };

  const viewErrorLogs = () => {
    navigation.navigate('ErrorLogs');
  };

  const viewPerformance = () => {
    navigation.navigate('Performance');
  };

  const clearAllLogs = async () => {
    Alert.alert(
      'Clear Error Logs',
      'Are you sure you want to clear all error logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await errorLogger.clearLogs();
            setErrorLogs([]);
            Alert.alert('Success', 'Error logs cleared');
          },
        },
      ]
    );
  };

  const testErrorLogging = async () => {
    await errorLogger.log(
      'general',
      'Test error log',
      new Error('This is a test error'),
      { timestamp: new Date().toISOString() }
    );
    await loadDiagnostics();
    Alert.alert('Success', 'Test error logged');
  };

  const testSentry = () => {
    Alert.alert(
      'Test Sentry Integration',
      'This will send test events to Sentry to verify the integration is working. Check your Sentry dashboard after sending.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Test Events',
          onPress: () => {
            try {
              // Send a test exception
              Sentry.captureException(new Error('TestFlight Sentry Integration Test'));

              // Send a test message
              Sentry.captureMessage('Sentry integration test from Settings screen', 'info');

              // Add a breadcrumb to show user action
              Sentry.addBreadcrumb({
                category: 'test',
                message: 'User triggered Sentry test from Settings',
                level: 'info',
              });

              Alert.alert(
                'Test Sent',
                'Test events sent to Sentry! Check your Sentry dashboard in a few moments to verify they appear.\n\nLook for:\n• Error: "TestFlight Sentry Integration Test"\n• Message: "Sentry integration test..."'
              );
            } catch (error) {
              logger.error('Failed to send Sentry test:', error);
              Alert.alert('Error', 'Failed to send test events. Sentry may not be configured.');
            }
          },
        },
      ]
    );
  };


  const handleRequestNotifications = async () => {
    try {
      const permissions = await notificationService.requestPermissions();
      setNotificationPermissions(permissions);

      // Only show alert if permission was denied and can't ask again (need to go to Settings)
      if (!permissions.granted && !permissions.canAskAgain) {
        Alert.alert(
          'Permission Denied',
          'Please enable notifications in Settings to receive medication reminders.',
          [
            { text: 'OK', style: 'cancel' },
          ]
        );
      }
      // UI already shows permission status, no need for success alert
    } catch (error) {
      logger.error('Failed to request notification permissions:', error);
      Alert.alert('Error', 'Failed to request notification permissions');
    }
  };

  const handleOpenSystemSettings = async () => {
    try {
      await Linking.openSettings();
    } catch (error) {
      logger.error('Failed to open system settings:', error);
      Alert.alert('Error', 'Failed to open Settings');
    }
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
        let timeInfo = 'Unknown trigger';

        if (trigger.type === 'calendar' || (trigger.hour !== undefined && trigger.minute !== undefined)) {
          timeInfo = `Daily at ${trigger.hour}:${String(trigger.minute).padStart(2, '0')}`;
        } else if (trigger.date) {
          timeInfo = `At ${new Date(trigger.date).toLocaleString()}`;
        } else if (trigger.seconds) {
          timeInfo = `In ${trigger.seconds} seconds`;
        }

        return `${index + 1}. ${notif.content.title}\n   ${timeInfo}\n   ID: ${notif.identifier}`;
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

  const handleRequestLocationPermission = async () => {
    try {
      const granted = await locationService.requestPermission();
      setLocationPermission(granted);

      if (granted) {
        Alert.alert('Success', 'Location permission granted. The app will now capture your location when you start a new episode.');
      } else {
        Alert.alert(
          'Permission Denied',
          'Location permission is optional. The app will work without it, but you won\'t see location data in your episode history.'
        );
      }
    } catch (error) {
      logger.error('Failed to request location permission:', error);
      Alert.alert('Error', 'Failed to request location permission');
    }
  };

  // Daily check-in handlers
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
        logger.log('[Settings] Updated daily check-in time to:', newTime);
      } catch (error) {
        logger.error('Failed to update check-in time:', error);
        Alert.alert('Error', 'Failed to update check-in time');
      }
    }
  };

  const formatCheckinTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const getCheckinTimeAsDate = (): Date => {
    const [hours, minutes] = dailyCheckinSettings.checkInTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes);
    return date;
  };

  const handleResetDatabase = async () => {
    Alert.alert(
      'Reset Database (Testing)',
      'This will:\n• Create an automatic backup\n• Clear ALL data from the database\n\nYou can restore from the backup in Backup & Recovery.\n\nThis action is for testing only.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              // Dynamically import test helper (only available in __DEV__)
              if (__DEV__) {
                const { resetDatabaseForTesting } = await import('../../utils/devTestHelpers');
                const result = await resetDatabaseForTesting({
                  createBackup: true,
                  loadFixtures: false,
                });
                Alert.alert('Database Reset', result.message);
              } else {
                Alert.alert('Error', 'Database reset is only available in development mode');
              }
            } catch (error) {
              logger.error('Failed to reset database:', error);
              Alert.alert('Error', `Failed to reset database: ${(error as Error).message}`);
            }
          },
        },
      ]
    );
  };

  const handleResetDatabaseWithFixtures = async () => {
    Alert.alert(
      'Reset with Test Data',
      'This will:\n• Create an automatic backup\n• Clear ALL data from the database\n• Load test medications and episodes\n\nTest data includes:\n• Preventative medication with daily schedule (8:00 AM)\n• Rescue medication\n• Sample episode from yesterday\n\nThis action is for testing only.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset & Load',
          style: 'default',
          onPress: async () => {
            try {
              // Dynamically import test helper (only available in __DEV__)
              if (__DEV__) {
                const { resetDatabaseForTesting } = await import('../../utils/devTestHelpers');
                await resetDatabaseForTesting({ // Intentionally unused - tracks operation for future features
                  createBackup: true,
                  loadFixtures: true,
                });
                Alert.alert('Success', 'Database reset with test data loaded!\n\nCheck Dashboard to see test medications.');
              } else {
                Alert.alert('Error', 'Database reset is only available in development mode');
              }
            } catch (error) {
              logger.error('Failed to reset database with fixtures:', error);
              Alert.alert('Error', `Failed to reset database: ${(error as Error).message}`);
            }
          },
        },
      ]
    );
  };



  return (
    <View style={styles.container} testID="settings-screen">
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Done"
          accessibilityHint="Closes the settings screen and returns to the previous screen"
        >
          <Text style={styles.backButton}>Done</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content} testID="settings-scroll-view">
        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.aboutCard}>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>App Name</Text>
              <Text style={styles.aboutValue}>MigraLog</Text>
            </View>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.aboutRow}
              onPress={handleVersionTap}
              activeOpacity={0.6}
              testID="version-info-button"
              accessibilityRole="button"
              accessibilityLabel={`App version ${buildInfo.version} build ${buildInfo.buildNumber}`}
              accessibilityHint="Tap 7 times to toggle developer mode"
            >
              <Text style={styles.aboutLabel}>Version</Text>
              <View style={styles.buildValueContainer}>
                <Text style={styles.aboutValue}>
                  {buildInfo.version} ({buildInfo.buildNumber}: {buildInfo.commitHash})
                </Text>
                {developerMode && (
                  <Ionicons name="code-slash" size={16} color={theme.primary} style={{ marginLeft: 6 }} />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Developer Tools */}
        {developerMode && (
          <View style={styles.navigationSection}>
            <TouchableOpacity
              style={[styles.navigationItem, styles.navigationItemDanger]}
              onPress={() => navigation.navigate('DeveloperToolsScreen')}
              accessibilityRole="button"
              accessibilityLabel="Developer tools"
              accessibilityHint="Opens the developer tools screen with diagnostics and debugging options"
            >
              <View style={styles.navigationItemContent}>
                <Ionicons name="code-slash-outline" size={24} color={theme.error} />
                <View style={styles.navigationItemText}>
                  <Text style={[styles.navigationItemTitle, styles.navigationItemTitleDanger]}>Developer Tools</Text>
                  <Text style={styles.navigationItemDescription}>
                    System diagnostics and debugging tools
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <Text style={styles.sectionDescription}>
            Choose how the app looks, or let it follow your device settings.
          </Text>

          <View style={styles.themeOptions}>
            <TouchableOpacity
              style={[
                styles.themeOption,
                themeMode === 'light' && styles.themeOptionActive
              ]}
              onPress={() => setThemeMode('light')}
              accessibilityRole="button"
              accessibilityLabel="Light theme"
              accessibilityHint="Switches the app appearance to light mode"
              accessibilityState={{ selected: themeMode === 'light' }}
            >
              <Ionicons
                name="sunny"
                size={24}
                color={themeMode === 'light' ? theme.primary : theme.textSecondary}
              />
              <Text style={[
                styles.themeOptionText,
                themeMode === 'light' && styles.themeOptionTextActive
              ]}>
                Light
              </Text>
              {themeMode === 'light' && (
                <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeOption,
                themeMode === 'dark' && styles.themeOptionActive
              ]}
              onPress={() => setThemeMode('dark')}
              accessibilityRole="button"
              accessibilityLabel="Dark theme"
              accessibilityHint="Switches the app appearance to dark mode"
              accessibilityState={{ selected: themeMode === 'dark' }}
            >
              <Ionicons
                name="moon"
                size={24}
                color={themeMode === 'dark' ? theme.primary : theme.textSecondary}
              />
              <Text style={[
                styles.themeOptionText,
                themeMode === 'dark' && styles.themeOptionTextActive
              ]}>
                Dark
              </Text>
              {themeMode === 'dark' && (
                <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeOption,
                themeMode === 'system' && styles.themeOptionActive
              ]}
              onPress={() => setThemeMode('system')}
              accessibilityRole="button"
              accessibilityLabel="System theme"
              accessibilityHint="Sets the app appearance to match your device settings"
              accessibilityState={{ selected: themeMode === 'system' }}
            >
              <Ionicons
                name="phone-portrait"
                size={24}
                color={themeMode === 'system' ? theme.primary : theme.textSecondary}
              />
              <Text style={[
                styles.themeOptionText,
                themeMode === 'system' && styles.themeOptionTextActive
              ]}>
                System
              </Text>
              {themeMode === 'system' && (
                <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
        </View>

        {/* Notifications Section */}
        <View style={styles.navigationSection}>
          <TouchableOpacity
            style={styles.navigationItem}
            onPress={() => navigation.navigate('NotificationSettingsScreen')}
            accessibilityRole="button"
            accessibilityLabel="Notification settings"
            accessibilityHint="Opens notification and medication reminder settings"
          >
            <View style={styles.navigationItemContent}>
              <Ionicons name="notifications-outline" size={24} color={theme.primary} />
              <View style={styles.navigationItemText}>
                <Text style={styles.navigationItemTitle}>Notifications</Text>
                <Text style={styles.navigationItemDescription}>
                  {!notificationPermissions
                    ? 'Loading...'
                    : notificationPermissions.granted
                    ? 'Manage medication reminders and daily check-ins'
                    : 'Enable notifications for reminders'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Location Section */}
        <View style={styles.navigationSection}>
          <TouchableOpacity
            style={styles.navigationItem}
            onPress={() => navigation.navigate('LocationSettingsScreen')}
            accessibilityRole="button"
            accessibilityLabel="Location settings"
            accessibilityHint="Opens location permission settings"
          >
            <View style={styles.navigationItemContent}>
              <Ionicons name="location-outline" size={24} color={theme.primary} />
              <View style={styles.navigationItemText}>
                <Text style={styles.navigationItemTitle}>Location</Text>
                <Text style={styles.navigationItemDescription}>
                  {locationPermission === null
                    ? 'Loading...'
                    : locationPermission
                    ? 'Location access enabled for episode tracking'
                    : 'Enable location capture for episodes (optional)'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Data Section */}
        <View style={styles.navigationSection}>
          <TouchableOpacity
            style={styles.navigationItem}
            onPress={() => navigation.navigate('DataSettingsScreen')}
            accessibilityRole="button"
            accessibilityLabel="Data management"
            accessibilityHint="Opens data management settings for export and backup"
          >
            <View style={styles.navigationItemContent}>
              <Ionicons name="folder-outline" size={24} color={theme.primary} />
              <View style={styles.navigationItemText}>
                <Text style={styles.navigationItemTitle}>Data</Text>
                <Text style={styles.navigationItemDescription}>
                  Export data and manage backups
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>



        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    backgroundColor: theme.backgroundSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
  },
  backButton: {
    fontSize: 17,
    color: theme.primary,
    minWidth: 60,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  navigationSection: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 15,
    color: theme.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: theme.borderLight,
    marginVertical: 20,
  },
  subsectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  aboutCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  aboutLabel: {
    fontSize: 16,
    color: theme.text,
  },
  aboutValue: {
    fontSize: 16,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  buildValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: theme.borderLight,
    marginLeft: 16,
  },
  navigationItem: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navigationItemDanger: {
    borderWidth: 1,
    borderColor: theme.error + '40', // 40% opacity
    backgroundColor: theme.error + '10', // 10% opacity
  },
  navigationItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  navigationItemText: {
    flex: 1,
  },
  navigationItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 2,
  },
  navigationItemTitleDanger: {
    color: theme.error,
  },
  navigationItemDescription: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  themeOptions: {
    gap: 12,
  },
  themeOption: {
    backgroundColor: theme.card,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.border,
    gap: 12,
  },
  themeOptionActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '15', // 15% opacity
  },
  themeOptionText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    color: theme.text,
  },
  themeOptionTextActive: {
    color: theme.primary,
    fontWeight: '600',
  },
  diagnosticCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  diagnosticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  diagnosticLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  diagnosticRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  diagnosticLabel: {
    fontSize: 16,
    color: theme.text,
  },
  diagnosticValueSecondary: {
    fontSize: 15,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  diagnosticValueSuccess: {
    fontSize: 15,
    color: theme.success,
    fontWeight: '600',
  },
  diagnosticValueError: {
    fontSize: 15,
    color: theme.error,
    fontWeight: '600',
  },
  developerActions: {
    gap: 12,
  },
  settingsSection: {
    marginTop: 16,
  },
  disabledNotificationsCard: {
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 12,
  },
  disabledNotificationsText: {
    fontSize: 15,
    color: theme.textSecondary,
    lineHeight: 22,
  },
  settingsLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.primary + '15',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  settingsLinkButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primary,
  },
  developerButton: {
    backgroundColor: theme.card,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.border,
    gap: 12,
  },
  developerButtonDanger: {
    borderColor: theme.error + '40', // 40% opacity
  },
  developerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primary,
  },
  developerButtonTextDanger: {
    color: theme.error,
  },
  notificationToggleSection: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  timePickerContainer: {
    marginTop: 8,
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 8,
  },
});
