import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, ThemeColors } from '../../theme';
import { getCategoryName, PresetMedication } from '../../utils/presetMedications';

export type MedicationType = 'preventative' | 'rescue' | 'other';

interface MedicationBadgesProps {
  type: MedicationType;
  category?: PresetMedication['category'];
  testID?: string;
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

const getBadgeConfig = (type: MedicationType, theme: ThemeColors) => {
  switch (type) {
    case 'preventative':
      return {
        backgroundColor: theme.success + '20',
        color: theme.success,
        label: 'Preventative',
      };
    case 'rescue':
      return {
        backgroundColor: theme.primary + '20',
        color: theme.primary,
        label: 'Rescue',
      };
    case 'other':
      return {
        backgroundColor: theme.textSecondary + '20',
        color: theme.textSecondary,
        label: 'Other',
      };
  }
};

export default function MedicationBadges({ type, category, testID }: MedicationBadgesProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const badgeConfig = getBadgeConfig(type, theme);

  return (
    <View style={styles.container} testID={testID}>
      {/* Type Badge */}
      <View 
        style={[styles.badge, { backgroundColor: badgeConfig.backgroundColor }]}
        testID={testID ? `${testID}-type-badge` : undefined}
      >
        <Text 
          style={[styles.badgeText, { color: badgeConfig.color }]}
          accessibilityLabel={`${badgeConfig.label} medication`}
        >
          {badgeConfig.label}
        </Text>
      </View>

      {/* Category Badge */}
      {category && (
        <View 
          style={[styles.badge, { backgroundColor: theme.textSecondary + '20' }]}
          testID={testID ? `${testID}-category-badge` : undefined}
        >
          <Text 
            style={[styles.badgeText, { color: theme.textSecondary }]}
            accessibilityLabel={`Category: ${getCategoryName(category)}`}
          >
            {getCategoryName(category)}
          </Text>
        </View>
      )}
    </View>
  );
}