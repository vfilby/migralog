import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors } from '../../../theme';

export interface DeveloperSectionProps {
  theme: ThemeColors;
  onNavigate: () => void;
}

export const DeveloperSection: React.FC<DeveloperSectionProps> = ({
  theme,
  onNavigate,
}) => {
  const styles = createStyles(theme);

  return (
    <View style={styles.navigationSection}>
      <TouchableOpacity
        style={[styles.navigationItem, styles.navigationItemDanger]}
        onPress={onNavigate}
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
});
