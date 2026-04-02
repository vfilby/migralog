import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors } from '../../../theme';
import { buildInfo } from '../../../buildInfo';

export interface VersionSectionProps {
  theme: ThemeColors;
  developerMode: boolean;
  onVersionTap: () => void;
}

export const VersionSection: React.FC<VersionSectionProps> = ({
  theme,
  developerMode,
  onVersionTap,
}) => {
  const styles = createStyles(theme);

  return (
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
          onPress={onVersionTap}
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
  );
};

const createStyles = (theme: ThemeColors) => StyleSheet.create({
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
});
