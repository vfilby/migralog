import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../theme';
import { errorLogger, ErrorLog } from '../services/errorLogger';
import { notificationService } from '../services/notificationService';
import * as SQLite from 'expo-sqlite';
import * as Sentry from '@sentry/react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

type Props = NativeStackScreenProps<RootStackParamList, 'DeveloperToolsScreen'>;

export default function DeveloperToolsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [dbStatus, setDbStatus] = useState<'checking' | 'healthy' | 'error'>('checking');
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDiagnostics = async () => {
    try {
      // Load recent error logs
      const logs = await errorLogger.getRecentLogs(5);
      setErrorLogs(logs);

      // Check database health
      await checkDatabaseHealth();

      // Check Sentry configuration
      checkSentryConfiguration();
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
                const { resetDatabaseForTesting } = await import('../utils/devTestHelpers');
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
                const { resetDatabaseForTesting } = await import('../utils/devTestHelpers');
                await resetDatabaseForTesting({
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerSide}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.backButton}>Settings</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            Developer Tools
          </Text>
          <View style={styles.headerSide} />
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diagnostics</Text>
          <Text style={styles.sectionDescription}>
            System status and diagnostic information
          </Text>

          {/* Database Status */}
          <View style={styles.diagnosticCard}>
            <View style={styles.diagnosticRow}>
              <View style={styles.diagnosticLeft}>
                <Ionicons
                  name="server-outline"
                  size={20}
                  color={theme.textSecondary}
                />
                <Text style={styles.diagnosticLabel}>Database</Text>
              </View>
              <View style={styles.diagnosticRight}>
                {dbStatus === 'checking' && (
                  <Text style={styles.diagnosticValueSecondary}>Checking...</Text>
                )}
                {dbStatus === 'healthy' && (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                    <Text style={styles.diagnosticValueSuccess}>Healthy</Text>
                  </>
                )}
                {dbStatus === 'error' && (
                  <>
                    <Ionicons name="close-circle" size={18} color={theme.error} />
                    <Text style={styles.diagnosticValueError}>Error</Text>
                  </>
                )}
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.diagnosticRow}>
              <View style={styles.diagnosticLeft}>
                <Ionicons
                  name="bug-outline"
                  size={20}
                  color={theme.textSecondary}
                />
                <Text style={styles.diagnosticLabel}>Error Logs</Text>
              </View>
              <View style={styles.diagnosticRight}>
                <Text style={styles.diagnosticValueSecondary}>
                  {errorLogs.length} recent
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.section}>
          <Text style={styles.subsectionTitle}>Developer Actions</Text>

          <View style={styles.developerActions}>
            <TouchableOpacity
              style={styles.developerButton}
              onPress={viewErrorLogs}
              accessibilityRole="button"
              accessibilityLabel="View error logs"
              accessibilityHint="Opens the error logs screen to view recent app errors"
            >
              <Ionicons name="list-outline" size={24} color={theme.primary} />
              <Text style={styles.developerButtonText}>View Error Logs</Text>
            </TouchableOpacity>

            {__DEV__ && (
              <TouchableOpacity
                style={styles.developerButton}
                onPress={viewPerformance}
                testID="view-performance-button"
                accessibilityRole="button"
                accessibilityLabel="Performance"
                accessibilityHint="Opens the performance monitoring screen"
              >
                <Ionicons name="speedometer-outline" size={24} color={theme.primary} />
                <Text style={styles.developerButtonText}>Performance</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.developerButton}
              onPress={testErrorLogging}
              accessibilityRole="button"
              accessibilityLabel="Test error logging"
              accessibilityHint="Creates a test error entry in the error logs"
            >
              <Ionicons name="flask-outline" size={24} color={theme.primary} />
              <Text style={styles.developerButtonText}>Test Error Logging</Text>
            </TouchableOpacity>

            {sentryStatus && (
              <View>
                <View
                  style={[
                    styles.developerButton,
                    sentryStatus.isConfigured
                      ? { backgroundColor: theme.background }
                      : { backgroundColor: theme.background, borderColor: theme.danger, borderWidth: 1 },
                  ]}
                >
                  <Ionicons
                    name={sentryStatus.isConfigured ? 'checkmark-circle' : 'alert-circle'}
                    size={24}
                    color={sentryStatus.isConfigured ? '#34C759' : theme.danger}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.developerButtonText}>
                      Sentry: {sentryStatus.isConfigured ? '✅ Active' : '❌ Not Configured'}
                    </Text>
                    <Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 4 }}>
                      {sentryStatus.environment}
                    </Text>
                  </View>
                </View>

                {!sentryStatus.isConfigured && sentryStatus.reason && (
                  <View
                    style={{
                      backgroundColor: theme.card,
                      borderRadius: 8,
                      padding: 12,
                      marginHorizontal: 16,
                      marginTop: 8,
                      marginBottom: 12,
                      borderLeftWidth: 4,
                      borderLeftColor: theme.danger,
                    }}
                  >
                    <Text style={{ fontSize: 13, color: theme.text, lineHeight: 20 }}>
                      {sentryStatus.reason}
                    </Text>
                  </View>
                )}

                {sentryStatus && (
                  <View
                    style={{
                      backgroundColor: theme.card,
                      borderRadius: 8,
                      padding: 12,
                      marginHorizontal: 16,
                      marginTop: 8,
                      marginBottom: 12,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginBottom: 8 }}>
                      Configuration
                    </Text>

                    {sentryStatus.org && (
                      <View style={{ marginBottom: 6 }}>
                        <Text style={{ fontSize: 11, color: theme.textTertiary }}>Org</Text>
                        <Text style={{ fontSize: 13, color: theme.text, fontFamily: 'Menlo' }}>
                          {sentryStatus.org}
                        </Text>
                      </View>
                    )}

                    {sentryStatus.project && (
                      <View style={{ marginBottom: 6 }}>
                        <Text style={{ fontSize: 11, color: theme.textTertiary }}>Project</Text>
                        <Text style={{ fontSize: 13, color: theme.text, fontFamily: 'Menlo' }}>
                          {sentryStatus.project}
                        </Text>
                      </View>
                    )}

                    {sentryStatus.slug && (
                      <View style={{ marginBottom: 6 }}>
                        <Text style={{ fontSize: 11, color: theme.textTertiary }}>Slug</Text>
                        <Text style={{ fontSize: 13, color: theme.text, fontFamily: 'Menlo' }}>
                          {sentryStatus.slug}
                        </Text>
                      </View>
                    )}

                    {sentryStatus.bundleId && (
                      <View style={{ marginBottom: 6 }}>
                        <Text style={{ fontSize: 11, color: theme.textTertiary }}>Bundle ID</Text>
                        <Text style={{ fontSize: 13, color: theme.text, fontFamily: 'Menlo' }}>
                          {sentryStatus.bundleId}
                        </Text>
                      </View>
                    )}

                    {sentryStatus.dsn && (
                      <View>
                        <Text style={{ fontSize: 11, color: theme.textTertiary }}>DSN</Text>
                        <Text style={{ fontSize: 11, color: theme.text, fontFamily: 'Menlo' }}>
                          {sentryStatus.dsn === 'not configured'
                            ? 'not configured'
                            : `${sentryStatus.dsn.substring(0, 20)}...`}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              style={styles.developerButton}
              onPress={testSentry}
              testID="test-sentry-button"
              accessibilityRole="button"
              accessibilityLabel="Test Sentry integration"
              accessibilityHint="Sends test events to Sentry to verify error tracking is working"
            >
              <Ionicons name="bug-outline" size={24} color={theme.primary} />
              <Text style={styles.developerButtonText}>Test Sentry Integration</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.developerButton}
              onPress={() => handleTestNotification(false)}
              accessibilityRole="button"
              accessibilityLabel="Test regular notification"
              accessibilityHint="Schedules a test notification to appear in 5 seconds"
            >
              <Ionicons name="flask-outline" size={24} color={theme.primary} />
              <Text style={styles.developerButtonText}>Test Regular Notification (5s)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.developerButton}
              onPress={() => handleTestNotification(true)}
              accessibilityRole="button"
              accessibilityLabel="Test time-sensitive notification"
              accessibilityHint="Schedules a time-sensitive test notification that breaks through Focus mode in 5 seconds"
            >
              <Ionicons name="flash-outline" size={24} color={theme.primary} />
              <Text style={styles.developerButtonText}>Test Time-Sensitive (5s)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.developerButton}
              onPress={handleTestCriticalNotification}
              accessibilityRole="button"
              accessibilityLabel="Test critical notification"
              accessibilityHint="Schedules a critical priority test notification in 5 seconds"
            >
              <Ionicons name="notifications-outline" size={24} color={theme.primary} />
              <Text style={styles.developerButtonText}>Test Critical (5s)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.developerButton}
              onPress={handleViewScheduledNotifications}
              accessibilityRole="button"
              accessibilityLabel="View scheduled notifications"
              accessibilityHint="Shows a list of all currently scheduled notifications"
            >
              <Ionicons name="list-outline" size={24} color={theme.primary} />
              <Text style={styles.developerButtonText}>View Scheduled Notifications</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.developerButton, styles.developerButtonDanger]}
              onPress={clearAllLogs}
              accessibilityRole="button"
              accessibilityLabel="Clear logs"
              accessibilityHint="Deletes all error logs from the database"
            >
              <Ionicons name="trash-outline" size={20} color={theme.error} />
              <Text style={[styles.developerButtonText, styles.developerButtonTextDanger]}>
                Clear Logs
              </Text>
            </TouchableOpacity>

            {__DEV__ && (
              <>
                <TouchableOpacity
                  style={[styles.developerButton, styles.developerButtonDanger]}
                  onPress={handleResetDatabase}
                  testID="reset-database-button"
                  accessibilityRole="button"
                  accessibilityLabel="Reset database"
                  accessibilityHint="Creates a backup then clears all data from the database for testing purposes"
                >
                  <Ionicons name="refresh-outline" size={24} color={theme.error} />
                  <Text style={[styles.developerButtonText, styles.developerButtonTextDanger]}>
                    Reset Database (Testing)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.developerButton]}
                  onPress={handleResetDatabaseWithFixtures}
                  testID="reset-database-with-fixtures-button"
                  accessibilityRole="button"
                  accessibilityLabel="Reset with test data"
                  accessibilityHint="Creates a backup, clears the database, and loads sample medications and episodes for testing"
                >
                  <Ionicons name="flask-outline" size={24} color={theme.primary} />
                  <Text style={[styles.developerButtonText]}>
                    Reset with Test Data
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
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
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
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
  subsectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
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
    paddingVertical: 4,
  },
  diagnosticLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  diagnosticRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  diagnosticLabel: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '500',
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
  divider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 12,
  },
  developerActions: {
    gap: 12,
  },
  developerButton: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  developerButtonText: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '500',
    flex: 1,
  },
  developerButtonDanger: {
    borderColor: theme.error,
  },
  developerButtonTextDanger: {
    color: theme.error,
  },
});
