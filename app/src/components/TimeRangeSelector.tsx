import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AccessibilityRole } from 'react-native';
import { useTheme, ThemeColors } from '../theme';
import { TimeRangeDays, TIME_RANGE_OPTIONS } from '../models/types';

interface TimeRangeSelectorProps {
  selectedRange: TimeRangeDays;
  onRangeChange: (range: TimeRangeDays) => void;
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.background,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.text,
  },
  buttonTextSelected: {
    color: theme.primaryText,
  },
});

export default function TimeRangeSelector({ selectedRange, onRangeChange }: TimeRangeSelectorProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  // Dynamically generate ranges from TIME_RANGE_OPTIONS to ensure single source of truth
  const ranges = TIME_RANGE_OPTIONS.map((value) => ({
    value,
    label: `${value} Days`,
    accessibilityLabel: `Select ${value} days time range`,
  }));

  return (
    <View style={styles.container} testID="time-range-selector">
      <View style={styles.buttonContainer}>
        {ranges.map(({ value, label, accessibilityLabel }) => {
          const isSelected = selectedRange === value;
          return (
            <TouchableOpacity
              key={value}
              style={[styles.button, isSelected && styles.buttonSelected]}
              onPress={() => onRangeChange(value)}
              accessibilityRole={'button' as AccessibilityRole}
              accessibilityLabel={accessibilityLabel}
              accessibilityState={{ selected: isSelected }}
              accessibilityHint={isSelected ? 'Currently selected' : 'Double tap to select this time range'}
              testID={`time-range-${value}`}
            >
              <Text style={[styles.buttonText, isSelected && styles.buttonTextSelected]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
