import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, ThemeColors } from '../../theme';

export interface MedicationQuickActionsProps {
  medicationId: string;
  medicationName: string;
  defaultQuantity?: number;
  onQuickLog: (medicationId: string, quantity: number) => void;
  onDetailedLog: (medicationId: string) => void;
  testID?: string;
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    justifyContent: 'center',
  },
  quickLogButton: {
    flex: 1,
    backgroundColor: theme.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLogButtonText: {
    color: theme.primaryText,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  detailedLogButton: {
    flex: 1,
    backgroundColor: theme.card,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.primary,
  },
  detailedLogButtonText: {
    color: theme.primary,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default function MedicationQuickActions({
  medicationId,
  medicationName,
  defaultQuantity = 1,
  onQuickLog,
  onDetailedLog,
  testID
}: MedicationQuickActionsProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const handleQuickLog = () => {
    onQuickLog(medicationId, defaultQuantity);
  };

  const handleDetailedLog = () => {
    onDetailedLog(medicationId);
  };

  return (
    <View style={styles.container} testID={testID}>
      <TouchableOpacity
        style={styles.quickLogButton}
        onPress={handleQuickLog}
        accessibilityRole="button"
        accessibilityLabel={`Quick log ${medicationName}`}
        accessibilityHint={`Logs ${defaultQuantity} dose of ${medicationName} at the current time`}
        testID={testID ? `${testID}-quick-log` : undefined}
      >
        <Text style={styles.quickLogButtonText}>Quick Log</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.detailedLogButton}
        onPress={handleDetailedLog}
        accessibilityRole="button"
        accessibilityLabel="Log details"
        accessibilityHint="Opens detailed logging screen to specify time, dosage, and notes"
        testID={testID ? `${testID}-detailed-log` : undefined}
      >
        <Text style={styles.detailedLogButtonText}>Log Details</Text>
      </TouchableOpacity>
    </View>
  );
}