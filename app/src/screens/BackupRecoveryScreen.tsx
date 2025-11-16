import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
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
import { useTheme, ThemeColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'BackupRecovery'>;

export default function BackupRecoveryScreen({ navigation }: Props) {
  const { theme } = useTheme();
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
      logger.error('Failed to load backups:', error);
      Alert.alert('Error', 'Failed to load backups');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      // Create snapshot backup (complete database copy - safer than JSON)
      await backupService.createSnapshotBackup();
      Alert.alert('Success', 'Backup created successfully');
      await loadBackups();
    } catch (error) {
      logger.error('Failed to create backup:', error);
      Alert.alert('Error', 'Failed to create backup: ' + (error as Error).message);
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleExportBackup = async (backupId: string) => {
    try {
      await backupService.exportBackup(backupId);
    } catch (error) {
      logger.error('Failed to export backup:', error);
      Alert.alert('Error', 'Failed to export backup: ' + (error as Error).message);
    }
  };

  const handleImportBackup = async () => {
    Alert.alert(
      'Import Backup',
      'Select a backup file to import. Supports both .db (snapshot) and .json (export) formats.\n\nNote: Imported backups will be added to your backup list.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            try {
              await backupService.importBackup();
              Alert.alert('Success', 'Backup imported successfully');
              await loadBackups();
            } catch (error) {
              if ((error as Error).message !== 'Import cancelled') {
                logger.error('Failed to import backup:', error);
                Alert.alert('Error', 'Failed to import backup: ' + (error as Error).message);
              }
            }
          },
        },
      ]
    );
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
              logger.error('Failed to restore backup:', error);
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
              logger.error('Failed to delete backup:', error);
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
    const isSnapshot = backup.backupType === 'snapshot';

    return (
      <View key={backup.id} style={styles.backupCard}>
        <View style={styles.backupHeader}>
          <View style={styles.backupInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.backupDate}>{date}</Text>
              <View style={[styles.badge, isSnapshot ? styles.snapshotBadge : styles.jsonBadge]}>
                <Text style={[styles.badgeText, isSnapshot ? styles.snapshotBadgeText : styles.jsonBadgeText]}>
                  {isSnapshot ? 'Snapshot' : 'JSON'}
                </Text>
              </View>
            </View>
            <Text style={styles.backupStats}>
              {backup.episodeCount} episodes • {backup.medicationCount} medications • {size}
            </Text>
          </View>
        </View>
        <View style={styles.backupActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleRestoreBackup(backup.id, date)}
            accessibilityRole="button"
            accessibilityLabel="Restore backup"
            accessibilityHint={`Restore backup from ${date}`}
          >
            <Ionicons name="refresh" size={20} color={theme.primary} />
            <Text style={styles.actionButtonText}>Restore</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleExportBackup(backup.id)}
            accessibilityRole="button"
            accessibilityLabel="Export backup"
            accessibilityHint="Share or save this backup file"
          >
            <Ionicons name="share-outline" size={20} color={theme.primary} />
            <Text style={styles.actionButtonText}>Export</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteBackup(backup.id, date)}
            accessibilityRole="button"
            accessibilityLabel="Delete backup"
            accessibilityHint={`Permanently delete backup from ${date}`}
          >
            <Ionicons name="trash-outline" size={20} color={theme.danger} />
            <Text style={[styles.actionButtonText, { color: theme.danger }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container} testID="backup-recovery-screen">
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Return to previous screen"
        >
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Backup & Recovery</Text>
        <View style={{ width: 24 }} />
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
        <View style={styles.section}>
          <Text style={styles.sectionDescription}>
            Create complete snapshots of your migraine data for safekeeping. Backups are stored locally on your device and include all episodes, medications, and notes.
          </Text>

          <TouchableOpacity
            style={[styles.primaryButton, creatingBackup && styles.primaryButtonDisabled]}
            onPress={handleCreateBackup}
            disabled={creatingBackup}
            accessibilityRole="button"
            accessibilityLabel="Create backup"
            accessibilityHint="Creates a snapshot of all your migraine tracking data"
            accessibilityState={{ disabled: creatingBackup }}
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

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleImportBackup}
            accessibilityRole="button"
            accessibilityLabel="Import backup"
            accessibilityHint="Import a backup file from your device"
          >
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
            backups.map((backup) => renderBackupItem(backup))
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
    marginBottom: 12,
    gap: 8,
  },
  secondaryButtonText: {
    color: theme.primary,
    fontSize: 17,
    fontWeight: '600',
  },
  dangerSecondaryButton: {
    borderColor: theme.danger,
  },
  dangerSecondaryButtonText: {
    color: theme.danger,
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
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  snapshotBadge: {
    backgroundColor: theme.primary + '20', // 20% opacity
  },
  jsonBadge: {
    backgroundColor: theme.textTertiary + '20',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  snapshotBadgeText: {
    color: theme.primary,
  },
  jsonBadgeText: {
    color: theme.textSecondary,
  },
});
