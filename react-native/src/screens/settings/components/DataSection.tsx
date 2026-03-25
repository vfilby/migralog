import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors } from '../../../theme';

export interface DataSectionProps {
  theme: ThemeColors;
  onNavigate: () => void;
}

export const DataSection: React.FC<DataSectionProps> = ({
  theme,
  onNavigate,
}) => {
  const styles = createStyles(theme);

  return (
    <View style={styles.navigationSection}>
      <TouchableOpacity
        style={styles.navigationItem}
        onPress={onNavigate}
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
  );
};

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  navigationSection: {
    marginTop: 12,
    paddingHorizontal: 16,
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
});
