import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MedicationMarkerData, getMedicationLabel } from '../utils/chartUtils';
import { useTheme, ThemeColors } from '../theme';

interface MedicationMarkerProps {
  markerData: MedicationMarkerData;
  x: number;
  y: number;
  onPress?: (markerData: MedicationMarkerData) => void;
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  marker: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  preventative: {
    backgroundColor: '#007AFF', // iOS blue
  },
  rescue: {
    backgroundColor: '#FF9500', // iOS orange
  },
  icon: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

/**
 * Medication marker component for timeline
 * Displays as a circular marker with icon indicating medication type
 */
export const MedicationMarker: React.FC<MedicationMarkerProps> = ({
  markerData,
  x,
  y,
  onPress,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const { type } = markerData;
  const icon = type === 'preventative' ? 'P' : 'R';

  const handlePress = () => {
    if (onPress) {
      onPress(markerData);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.marker,
        type === 'preventative' ? styles.preventative : styles.rescue,
        {
          left: x - 12, // Center the marker
          top: y - 24, // Position above the line
        },
      ]}
      onPress={handlePress}
      accessibilityLabel={`Medication: ${getMedicationLabel(markerData)}`}
      accessibilityRole="button"
    >
      <Text style={styles.icon}>{icon}</Text>
    </TouchableOpacity>
  );
};

export default MedicationMarker;
