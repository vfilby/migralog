import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../theme';
import { useDiagnostics } from './hooks/useDiagnostics';
import { useNotificationTesting } from './hooks/useNotificationTesting';
import { useDatabaseOperations } from './hooks/useDatabaseOperations';
import { useSentryTesting } from './hooks/useSentryTesting';
import { useErrorLogManagement } from './hooks/useErrorLogManagement';
import { useDebugArchive } from './hooks/useDebugArchive';
import { logger, LogLevel } from '../../utils/logger';

type Props = NativeStackScreenProps<RootStackParamList, 'DeveloperToolsScreen'>;

export default function DeveloperToolsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  
  // Logger state
  const [logLevel, setLogLevelState] = useState<LogLevel>(LogLevel.INFO);
  const [logCount, setLogCount] = useState<number>(0);
  
  // Custom hooks for different developer tools sections
  const { dbStatus, sentryStatus, loadDiagnostics } = useDiagnostics();
  const { viewPerformance, testErrorLogging } = useErrorLogManagement(
    navigation,
    loadDiagnostics
  );
  const { testSentry } = useSentryTesting();
  const { handleResetDatabase, handleResetDatabaseWithFixtures } = useDatabaseOperations();
  const {
    handleViewScheduledNotifications,
    handleTestNotification,
    handleTestCriticalNotification,
    handleRecreateAllSchedules,
    handleSetupNotificationTests,
    handleSetupNotificationTestsBurst,
    handleSetupGroupedNotificationTest,
  } = useNotificationTesting(navigation);
  const {
    generateArchive,
    isGenerating,
    progress,
  } = useDebugArchive();

  // Load current log level and log count on mount
  useEffect(() => {
    loadLoggerState();
  }, []);

  const loadLoggerState = async () => {
    try {
      const currentLevel = await logger.getLogLevel();
      const logs = await logger.getLogs();
      setLogLevelState(currentLevel);
      setLogCount(logs.length);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load logger state:', error);
    }
  };

  const handleLogLevelChange = async (level: LogLevel) => {
    try {
      await logger.setLogLevel(level);
      setLogLevelState(level);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to set log level:', error);
    }
  };

  const navigateToLogViewer = () => {
    navigation.navigate('LogViewerScreen');
  };

  // Helper to get log level name for display
  const getLogLevelName = (level: LogLevel): string => {
    return LogLevel[level];
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

      <ScrollView style={styles.content} testID="developer-tools-scroll-view">
        {/* Logging Configuration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Logging Configuration</Text>
          <Text style={styles.sectionDescription}>
            Control app logging verbosity and persistence
          </Text>

          <View style={styles.diagnosticCard}>
            <View style={styles.logLevelContainer}>
              <Text style={styles.logLevelLabel}>Current Log Level</Text>
              <View style={styles.segmentedControl}>
                {[LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.segmentButton,
                      logLevel === level && styles.segmentButtonActive,
                    ]}
                    onPress={() => handleLogLevelChange(level)}
                    accessibilityRole="button"
                    accessibilityLabel={`Set log level to ${getLogLevelName(level)}`}
                    accessibilityState={{ selected: logLevel === level }}
                  >
                    <Text
                      style={[
                        styles.segmentButtonText,
                        logLevel === level && styles.segmentButtonTextActive,
                      ]}
                    >
                      {getLogLevelName(level)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.logLevelDescription}>
              <Text style={styles.logLevelDescriptionTitle}>Log Level Descriptions:</Text>
              <Text style={styles.logLevelDescriptionItem}>
                <Text style={styles.logLevelDescriptionBold}>DEBUG:</Text> Most verbose - all logs including debugging information
              </Text>
              <Text style={styles.logLevelDescriptionItem}>
                <Text style={styles.logLevelDescriptionBold}>INFO:</Text> General information and important events
              </Text>
              <Text style={styles.logLevelDescriptionItem}>
                <Text style={styles.logLevelDescriptionBold}>WARN:</Text> Warning messages and potential issues
              </Text>
              <Text style={styles.logLevelDescriptionItem}>
                <Text style={styles.logLevelDescriptionBold}>ERROR:</Text> Only errors and critical issues
              </Text>
              <Text style={[styles.logLevelDescriptionItem, { marginTop: 8, fontStyle: 'italic' }]}>
                Note: Logs persist across app restarts
              </Text>
            </View>
          </View>
        </View>

        {/* System Diagnostics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Diagnostics</Text>
          <Text style={styles.sectionDescription}>
            System status and health monitoring
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

            <TouchableOpacity 
              style={styles.diagnosticRow}
              onPress={navigateToLogViewer}
              accessibilityRole="button"
              accessibilityLabel="View app logs"
              accessibilityHint="Opens the log viewer screen to view all app logs"
            >
              <View style={styles.diagnosticLeft}>
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={theme.textSecondary}
                />
                <Text style={styles.diagnosticLabel}>App Logs</Text>
              </View>
              <View style={styles.diagnosticRight}>
                <Text style={styles.diagnosticValueSecondary}>
                  {logCount} total
                </Text>
                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />
            <TouchableOpacity 
              style={styles.diagnosticRow}
              onPress={generateArchive}
              disabled={isGenerating}
              accessibilityRole="button"
              accessibilityLabel="Generate debug archive"
              accessibilityHint="Creates a comprehensive debug archive with logs, database, and notification state"
            >
              <View style={styles.diagnosticLeft}>
                <Ionicons
                  name="archive-outline"
                  size={20}
                  color={isGenerating ? theme.textTertiary : theme.textSecondary}
                />
                <Text style={[styles.diagnosticLabel, isGenerating && { color: theme.textTertiary }]}>
                  Generate Debug Archive
                </Text>
              </View>
              <View style={styles.diagnosticRight}>
                {isGenerating ? (
                  <>
                    <Text style={styles.diagnosticValueSecondary}>
                      {Math.round(progress)}%
                    </Text>
                    <ActivityIndicator size="small" color={theme.primary} />
                  </>
                ) : (
                  <>
                    <Text style={styles.diagnosticValueSecondary}>
                      Export All Debug Data
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                  </>
                )}
              </View>
            </TouchableOpacity>

            {__DEV__ && (
              <>
                <View style={styles.divider} />
                <TouchableOpacity 
                  style={styles.diagnosticRow}
                  onPress={viewPerformance}
                  testID="view-performance-button"
                  accessibilityRole="button"
                  accessibilityLabel="Performance monitoring"
                  accessibilityHint="Opens the performance monitoring screen"
                >
                  <View style={styles.diagnosticLeft}>
                    <Ionicons
                      name="speedometer-outline"
                      size={20}
                      color={theme.textSecondary}
                    />
                    <Text style={styles.diagnosticLabel}>Performance Monitoring</Text>
                  </View>
                  <View style={styles.diagnosticRight}>
                    <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                  </View>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.divider} />
            <TouchableOpacity 
              style={styles.diagnosticRow}
              onPress={testErrorLogging}
              accessibilityRole="button"
              accessibilityLabel="Test error logging"
              accessibilityHint="Creates a test error entry in the error logs"
            >
              <View style={styles.diagnosticLeft}>
                <Ionicons
                  name="flask-outline"
                  size={20}
                  color={theme.textSecondary}
                />
                <Text style={styles.diagnosticLabel}>Test Error Logging</Text>
              </View>
              <View style={styles.diagnosticRight}>
                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
              </View>
            </TouchableOpacity>
          </View>
        </View>



        {/* Error Tracking (Sentry) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Error Tracking</Text>
          <Text style={styles.sectionDescription}>
            Sentry integration for production error monitoring and crash reporting
          </Text>

          <View style={styles.developerActions}>
            {sentryStatus && (
              <View>
                <View
                  style={[
                    styles.developerButton,
                    !sentryStatus.isConfigured
                      ? { backgroundColor: theme.background, borderColor: theme.danger, borderWidth: 1 }
                      : { backgroundColor: theme.background },
                  ]}
                >
                  <Ionicons
                    name={
                      sentryStatus.isEnabled
                        ? 'checkmark-circle'
                        : sentryStatus.isConfigured
                          ? 'pause-circle'
                          : 'alert-circle'
                    }
                    size={24}
                    color={
                      sentryStatus.isEnabled
                        ? '#34C759'
                        : sentryStatus.isConfigured
                          ? theme.warning
                          : theme.danger
                    }
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.developerButtonText}>
                      Sentry:{' '}
                      {sentryStatus.isEnabled
                        ? '✅ Active'
                        : sentryStatus.isConfigured
                          ? '⏸️ Configured (Disabled)'
                          : '❌ Not Configured'}
                    </Text>
                    <Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 4 }}>
                      Environment: {sentryStatus.environment}
                    </Text>
                  </View>
                </View>

                {sentryStatus.reason && (
                  <View
                    style={{
                      backgroundColor: theme.card,
                      borderRadius: 8,
                      padding: 12,
                      marginTop: 8,
                      marginBottom: 12,
                      borderLeftWidth: 4,
                      borderLeftColor: sentryStatus.isConfigured ? theme.warning : theme.danger,
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
                      marginTop: 8,
                      marginBottom: 12,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginBottom: 8 }}>
                      Configuration Details
                    </Text>

                    {sentryStatus.org && (
                      <View style={{ marginBottom: 6 }}>
                        <Text style={{ fontSize: 11, color: theme.textTertiary }}>Organization</Text>
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
                        <Text style={{ fontSize: 11, color: theme.textTertiary }}>App Slug</Text>
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
          </View>
        </View>

        {/* Notification Testing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Testing</Text>
          <Text style={styles.sectionDescription}>
            Test different notification types and view scheduled notifications
          </Text>

          <View style={styles.developerActions}>
            {/* Quick setup for test scenarios */}
            {__DEV__ && (
              <View style={styles.groupedActionsBlock}>
                <TouchableOpacity
                  style={styles.groupedActionButton}
                  onPress={handleSetupNotificationTests}
                  testID="setup-notification-tests-button"
                  accessibilityRole="button"
                  accessibilityLabel="Setup notification test scenarios"
                  accessibilityHint="Schedules test notifications at 1 minute intervals"
                >
                  <Ionicons name="flask-outline" size={24} color={theme.primary} />
                  <Text style={styles.developerButtonText}>Setup Notification Tests (1 min)</Text>
                </TouchableOpacity>

                <View style={styles.actionSeparator} />

                <TouchableOpacity
                  style={styles.groupedActionButton}
                  onPress={handleSetupNotificationTestsBurst}
                  testID="setup-notification-tests-burst-button"
                  accessibilityRole="button"
                  accessibilityLabel="Setup burst notification test scenarios"
                  accessibilityHint="Schedules test notifications at 10 second intervals to test rapid notification handling"
                >
                  <Ionicons name="flash-outline" size={24} color={theme.primary} />
                  <Text style={styles.developerButtonText}>Setup Notification Tests (Burst 10s)</Text>
                </TouchableOpacity>

                <View style={styles.actionSeparator} />

                <TouchableOpacity
                  style={styles.groupedActionButton}
                  onPress={handleSetupGroupedNotificationTest}
                  testID="setup-grouped-notification-test-button"
                  accessibilityRole="button"
                  accessibilityLabel="Setup grouped notification test"
                  accessibilityHint="Creates 4 medications at the same time to test partial group logging"
                >
                  <Ionicons name="people-outline" size={24} color={theme.primary} />
                  <Text style={styles.developerButtonText}>Setup Grouped Notification Test</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Schedule management block with separator */}
            <View style={styles.groupedActionsBlock}>
              <TouchableOpacity
                style={styles.groupedActionButton}
                onPress={handleViewScheduledNotifications}
                accessibilityRole="button"
                accessibilityLabel="View scheduled notifications"
                accessibilityHint="Shows a list of all currently scheduled notifications"
              >
                <Ionicons name="list-outline" size={24} color={theme.primary} />
                <Text style={styles.developerButtonText}>View Scheduled Notifications</Text>
              </TouchableOpacity>

              <View style={styles.actionSeparator} />

              <TouchableOpacity
                style={styles.groupedActionButton}
                onPress={handleRecreateAllSchedules}
                accessibilityRole="button"
                accessibilityLabel="Recreate all notification schedules"
                accessibilityHint="Cancels and recreates all medication notification schedules with current settings"
              >
                <Ionicons name="refresh-circle-outline" size={24} color={theme.primary} />
                <Text style={styles.developerButtonText}>Recreate All Schedules</Text>
              </TouchableOpacity>
            </View>

            {/* Test notification buttons block with separators */}
            <View style={styles.groupedActionsBlock}>
              <TouchableOpacity
                style={styles.groupedActionButton}
                onPress={() => handleTestNotification(false)}
                accessibilityRole="button"
                accessibilityLabel="Test regular notification"
                accessibilityHint="Schedules a test notification to appear in 5 seconds"
              >
                <Ionicons name="notifications-outline" size={24} color={theme.primary} />
                <Text style={styles.developerButtonText}>Test Regular Notification (5s)</Text>
              </TouchableOpacity>

              <View style={styles.actionSeparator} />

              <TouchableOpacity
                style={styles.groupedActionButton}
                onPress={() => handleTestNotification(true)}
                accessibilityRole="button"
                accessibilityLabel="Test time-sensitive notification"
                accessibilityHint="Schedules a time-sensitive test notification that breaks through Focus mode in 5 seconds"
              >
                <Ionicons name="flash-outline" size={24} color={theme.primary} />
                <Text style={styles.developerButtonText}>Test Time-Sensitive (5s)</Text>
              </TouchableOpacity>

              <View style={styles.actionSeparator} />

              <TouchableOpacity
                style={styles.groupedActionButton}
                onPress={handleTestCriticalNotification}
                accessibilityRole="button"
                accessibilityLabel="Test critical notification"
                accessibilityHint="Schedules a critical priority test notification in 5 seconds"
              >
                <Ionicons name="warning-outline" size={24} color={theme.primary} />
                <Text style={styles.developerButtonText}>Test Critical Notification (5s)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Database Operations - Development Only */}
        {__DEV__ && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Database Operations</Text>
            <Text style={styles.sectionDescription}>
              Testing tools for database management (development builds only)
            </Text>

            <View style={styles.developerActions}>
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
                  Reset Database (Empty)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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
  groupedActionsBlock: {
    backgroundColor: theme.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  groupedActionButton: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 0,
  },
  groupedActionButtonDanger: {
    backgroundColor: 'transparent',
  },
  actionSeparator: {
    height: 1,
    backgroundColor: theme.border,
    marginHorizontal: 16,
  },
  logLevelContainer: {
    gap: 12,
  },
  logLevelLabel: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '500',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: theme.background,
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: theme.primary,
  },
  segmentButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  segmentButtonTextActive: {
    color: '#FFFFFF',
  },
  logLevelDescription: {
    gap: 8,
  },
  logLevelDescriptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  logLevelDescriptionItem: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  logLevelDescriptionBold: {
    fontWeight: '600',
    color: theme.text,
  },
});
