import React, { useState, useEffect } from 'react';
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
import { useTheme, ThemeMode, ThemeColors } from '../theme';
import { buildInfo } from '../buildInfo';
import { errorLogger, ErrorLog } from '../services/errorLogger';
import * as SQLite from 'expo-sqlite';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const { theme, themeMode, setThemeMode } = useTheme();
  const styles = createStyles(theme);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [dbStatus, setDbStatus] = useState<'checking' | 'healthy' | 'error'>('checking');

  useEffect(() => {
    loadDiagnostics();
  }, []);

  const loadDiagnostics = async () => {
    try {
      // Load recent error logs
      const logs = await errorLogger.getRecentLogs(5);
      setErrorLogs(logs);

      // Check database health
      await checkDatabaseHealth();
    } catch (error) {
      console.error('Failed to load diagnostics:', error);
    }
  };

  const checkDatabaseHealth = async () => {
    try {
      const db = await SQLite.openDatabaseAsync('migrainetracker.db');
      await db.execAsync('SELECT 1'); // Simple query to test connection
      setDbStatus('healthy');
    } catch (error) {
      console.error('Database health check failed:', error);
      setDbStatus('error');
      await errorLogger.log('database', 'Database health check failed', error as Error);
    }
  };

  const viewErrorLogs = () => {
    navigation.navigate('ErrorLogs');
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>Done</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.aboutCard}>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>App Name</Text>
              <Text style={styles.aboutValue}>MigraineTracker</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Version</Text>
              <Text style={styles.aboutValue}>1.0.0</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Build</Text>
              <Text style={styles.aboutValue}>{buildInfo.commitHash}</Text>
            </View>
          </View>
        </View>

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

        {/* Data Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>
          <TouchableOpacity
            style={styles.navigationItem}
            onPress={() => navigation.navigate('BackupRecovery')}
          >
            <View style={styles.navigationItemContent}>
              <Ionicons name="cloud-upload-outline" size={24} color={theme.primary} />
              <View style={styles.navigationItemText}>
                <Text style={styles.navigationItemTitle}>Backup & Recovery</Text>
                <Text style={styles.navigationItemDescription}>
                  Create and manage backups
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Developer Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Developer</Text>
          <Text style={styles.sectionDescription}>
            Diagnostic tools for troubleshooting issues
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

          {/* Action Buttons */}
          <View style={styles.developerActions}>
            <TouchableOpacity
              style={styles.developerButton}
              onPress={viewErrorLogs}
            >
              <Ionicons name="list-outline" size={20} color={theme.primary} />
              <Text style={styles.developerButtonText}>View Error Logs</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.developerButton}
              onPress={testErrorLogging}
            >
              <Ionicons name="flask-outline" size={20} color={theme.primary} />
              <Text style={styles.developerButtonText}>Test Error Logging</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.developerButton, styles.developerButtonDanger]}
              onPress={clearAllLogs}
            >
              <Ionicons name="trash-outline" size={20} color={theme.error} />
              <Text style={[styles.developerButtonText, styles.developerButtonTextDanger]}>
                Clear Logs
              </Text>
            </TouchableOpacity>
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
    width: 60,
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
  developerButton: {
    backgroundColor: theme.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 8,
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
});
