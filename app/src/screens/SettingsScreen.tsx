import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { backupService, BackupMetadata } from '../services/backupService';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeMode, ThemeColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const { theme, themeMode, setThemeMode } = useTheme();
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    try {
      const backupList = await backupService.listBackups();
      setBackups(backupList);
    } catch (error) {
      console.error('Failed to load backups:', error);
      Alert.alert('Error', 'Failed to load backups');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      const backup = await backupService.createBackup(false);
      Alert.alert('Success', 'Backup created successfully');
      await loadBackups();
    } catch (error) {
      console.error('Failed to create backup:', error);
      Alert.alert('Error', 'Failed to create backup: ' + (error as Error).message);
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleExportBackup = async (backupId: string) => {
    try {
      await backupService.exportBackup(backupId);
    } catch (error) {
      console.error('Failed to export backup:', error);
      Alert.alert('Error', 'Failed to export backup: ' + (error as Error).message);
    }
  };

  const handleImportBackup = async () => {
    try {
      const backup = await backupService.importBackup();
      Alert.alert('Success', 'Backup imported successfully');
      await loadBackups();
    } catch (error) {
      if ((error as Error).message !== 'Import cancelled') {
        console.error('Failed to import backup:', error);
        Alert.alert('Error', 'Failed to import backup: ' + (error as Error).message);
      }
    }
  };

  const handleRestoreBackup = (backupId: string, backupDate: string) => {
    Alert.alert(
      'Restore Backup',
      `Are you sure you want to restore the backup from ${backupDate}? This will replace all current data and require an app restart.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              await backupService.restoreBackup(backupId);
              Alert.alert(
                'Success',
                'Backup restored successfully. Please restart the app.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            } catch (error) {
              console.error('Failed to restore backup:', error);
              Alert.alert('Error', 'Failed to restore backup: ' + (error as Error).message);
            }
          },
        },
      ]
    );
  };

  const handleDeleteBackup = (backupId: string, backupDate: string) => {
    Alert.alert(
      'Delete Backup',
      `Are you sure you want to delete the backup from ${backupDate}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await backupService.deleteBackup(backupId);
              Alert.alert('Success', 'Backup deleted successfully');
              await loadBackups();
            } catch (error) {
              console.error('Failed to delete backup:', error);
              Alert.alert('Error', 'Failed to delete backup: ' + (error as Error).message);
            }
          },
        },
      ]
    );
  };

  const styles = createStyles(theme);

  const renderBackupItem = (backup: BackupMetadata) => {
    const date = backupService.formatDate(backup.timestamp);
    const size = backupService.formatFileSize(backup.fileSize);

    return (
      <View key={backup.id} style={styles.backupCard}>
        <View style={styles.backupHeader}>
          <View style={styles.backupInfo}>
            <Text style={styles.backupDate}>{date}</Text>
            <Text style={styles.backupStats}>
              {backup.episodeCount} episodes • {backup.medicationCount} medications • {size}
            </Text>
          </View>
        </View>
        <View style={styles.backupActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleRestoreBackup(backup.id, date)}
          >
            <Ionicons name="refresh" size={20} color={theme.primary} />
            <Text style={styles.actionButtonText}>Restore</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleExportBackup(backup.id)}
          >
            <Ionicons name="share-outline" size={20} color={theme.primary} />
            <Text style={styles.actionButtonText}>Export</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteBackup(backup.id, date)}
          >
            <Ionicons name="trash-outline" size={20} color={theme.danger} />
            <Text style={[styles.actionButtonText, { color: theme.danger }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
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

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            loadBackups();
          }} />
        }
      >
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

        {/* Backup & Recovery Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backup & Recovery</Text>
          <Text style={styles.sectionDescription}>
            Create backups of your migraine data for safekeeping. Backups are stored locally on your device.
          </Text>

          <TouchableOpacity
            style={[styles.primaryButton, creatingBackup && styles.primaryButtonDisabled]}
            onPress={handleCreateBackup}
            disabled={creatingBackup}
          >
            {creatingBackup ? (
              <ActivityIndicator color={theme.primaryText} />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={24} color={theme.primaryText} />
                <Text style={styles.primaryButtonText}>Create Backup</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleImportBackup}>
            <Ionicons name="cloud-download-outline" size={24} color={theme.primary} />
            <Text style={styles.secondaryButtonText}>Import Backup</Text>
          </TouchableOpacity>
        </View>

        {/* Available Backups */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Backups</Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : backups.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={48} color={theme.textTertiary} />
              <Text style={styles.emptyText}>No backups yet</Text>
              <Text style={styles.emptySubtext}>
                Create your first backup to protect your data
              </Text>
            </View>
          ) : (
            backups.map(renderBackupItem)
          )}
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
  primaryButton: {
    backgroundColor: theme.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: theme.textTertiary,
  },
  primaryButtonText: {
    color: theme.primaryText,
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: theme.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.primary,
    gap: 8,
  },
  secondaryButtonText: {
    color: theme.primary,
    fontSize: 17,
    fontWeight: '600',
  },
  backupCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backupHeader: {
    marginBottom: 12,
  },
  backupInfo: {
    flex: 1,
  },
  backupDate: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  backupStats: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  backupActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: theme.borderLight,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.primary,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 15,
    color: theme.textTertiary,
    marginTop: 4,
    textAlign: 'center',
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
});
