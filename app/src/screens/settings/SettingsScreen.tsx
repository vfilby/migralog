import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme, ThemeColors } from '../../theme';
import { notificationService, NotificationPermissions } from '../../services/notifications/notificationService';
import { locationService } from '../../services/locationService';
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VersionSection } from './components/VersionSection';
import { ThemeSection } from './components/ThemeSection';
import { DeveloperSection } from './components/DeveloperSection';
import { NotificationSection } from './components/NotificationSection';
import { LocationSection } from './components/LocationSection';
import { DataSection } from './components/DataSection';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const DEVELOPER_MODE_KEY = '@settings_developer_mode';

export default function SettingsScreen({ navigation }: Props) {
  const { theme, themeMode, setThemeMode } = useTheme();
  const styles = createStyles(theme);

  const [notificationPermissions, setNotificationPermissions] = useState<NotificationPermissions | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [developerMode, setDeveloperMode] = useState(false);
  const [versionTapCount, setVersionTapCount] = useState(0);

  useEffect(() => {
    loadDiagnostics();
    loadDeveloperMode();
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
      // Check database health
      await checkDatabaseHealth();

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

  const checkDatabaseHealth = async () => {
    try {
      const db = await SQLite.openDatabaseAsync('migralog.db');
      await db.execAsync('SELECT 1'); // Simple query to test connection
    } catch (error) {
      logger.error('Database health check failed:', error);
    }
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
        <VersionSection
          theme={theme}
          developerMode={developerMode}
          onVersionTap={handleVersionTap}
        />

        {developerMode && (
          <DeveloperSection
            theme={theme}
            onNavigate={() => navigation.navigate('DeveloperToolsScreen')}
          />
        )}

        <ThemeSection
          theme={theme}
          themeMode={themeMode}
          onThemeChange={setThemeMode}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
        </View>

        <NotificationSection
          theme={theme}
          notificationPermissions={notificationPermissions}
          onNavigate={() => navigation.navigate('NotificationSettingsScreen')}
        />

        <LocationSection
          theme={theme}
          locationPermission={locationPermission}
          onNavigate={() => navigation.navigate('LocationSettingsScreen')}
        />

        <DataSection
          theme={theme}
          onNavigate={() => navigation.navigate('DataSettingsScreen')}
        />

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
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
});
