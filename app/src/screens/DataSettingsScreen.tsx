import React from 'react';
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
import { backupService } from '../services/backupService';

type Props = NativeStackScreenProps<RootStackParamList, 'DataSettingsScreen'>;

export default function DataSettingsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const handleExportData = async () => {
    try {
      await backupService.exportDataForSharing();
    } catch (error) {
      logger.error('Failed to export data:', error);
      Alert.alert('Error', 'Failed to export data: ' + (error as Error).message);
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
            Data Management
          </Text>
          <View style={styles.headerSide} />
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export & Backup</Text>
          <Text style={styles.sectionDescription}>
            Manage your migraine data and create backups for safekeeping
          </Text>

          <TouchableOpacity
            style={styles.navigationItem}
            onPress={handleExportData}
            accessibilityRole="button"
            accessibilityLabel="Export data"
            accessibilityHint="Exports your migraine data as JSON to share with healthcare providers"
          >
            <View style={styles.navigationItemContent}>
              <Ionicons name="document-text-outline" size={24} color={theme.primary} />
              <View style={styles.navigationItemText}>
                <Text style={styles.navigationItemTitle}>Export Data</Text>
                <Text style={styles.navigationItemDescription}>
                  Share your data as JSON with healthcare providers
                </Text>
              </View>
            </View>
            <Ionicons name="share-outline" size={20} color={theme.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navigationItem}
            onPress={() => navigation.navigate('BackupRecovery')}
            accessibilityRole="button"
            accessibilityLabel="Backup and recovery"
            accessibilityHint="Opens the backup and recovery screen to create and manage backups"
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Privacy</Text>
          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark-outline" size={24} color={theme.primary} style={styles.infoIcon} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>Your Data is Private</Text>
              <Text style={styles.infoText}>
                All your migraine data is stored locally on your device. No data is sent to external servers unless you explicitly choose to export or backup your information.
              </Text>
            </View>
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
  navigationItem: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
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
  infoCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: 'row',
    gap: 12,
  },
  infoIcon: {
    marginTop: 2,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
});