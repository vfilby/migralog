import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors, ThemeMode } from '../../../theme';

export interface ThemeSectionProps {
  theme: ThemeColors;
  themeMode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
}

export const ThemeSection: React.FC<ThemeSectionProps> = ({
  theme,
  themeMode,
  onThemeChange,
}) => {
  const styles = createStyles(theme);

  return (
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
          onPress={() => onThemeChange('light')}
          accessibilityRole="button"
          accessibilityLabel="Light theme"
          accessibilityHint="Switches the app appearance to light mode"
          accessibilityState={{ selected: themeMode === 'light' }}
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
          onPress={() => onThemeChange('dark')}
          accessibilityRole="button"
          accessibilityLabel="Dark theme"
          accessibilityHint="Switches the app appearance to dark mode"
          accessibilityState={{ selected: themeMode === 'dark' }}
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
          onPress={() => onThemeChange('system')}
          accessibilityRole="button"
          accessibilityLabel="System theme"
          accessibilityHint="Sets the app appearance to match your device settings"
          accessibilityState={{ selected: themeMode === 'system' }}
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
  sectionDescription: {
    fontSize: 15,
    color: theme.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
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
