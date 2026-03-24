import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StepProps } from '../constants';
import { PermissionItem } from '../components';

/**
 * Step 4: Location Permissions
 * Explains location permissions and privacy guarantees
 */
export function LocationPermissionsStep({ colors }: StepProps) {
  return (
    <View style={styles.stepContainer} testID="location-permissions-step">
      <View style={styles.iconContainer}>
        <Ionicons 
          name="location-outline" 
          size={72} 
          color={colors.primary}
          accessible={true}
          accessibilityLabel="Location pin icon"
        />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>
        Location Services
      </Text>

      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Help track patterns with location context (optional)
      </Text>

      <View style={styles.permissionsContainer}>
        <PermissionItem
          icon="map-outline"
          title="Episode Context"
          description="Automatically capture location when starting new episodes"
          colors={colors}
        />
        <PermissionItem
          icon="shield-checkmark-outline"
          title="Privacy Protected"
          description="Location data stays private and secure on your device"
          colors={colors}
        />
      </View>

      <View 
        style={[styles.infoBox, { backgroundColor: colors.card }]}
        accessible={true}
        accessibilityRole="text"
        accessibilityLabel="Information: Location services are optional"
      >
        <View style={styles.infoTextContainer}>
          <Ionicons 
            name="information-circle-outline" 
            size={16} 
            color={colors.primary} 
            style={styles.infoIcon}
            accessible={false}
          />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Location services are completely optional. You can always change this setting later in the app.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepContainer: {
    flex: 1,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  permissionsContainer: {
    gap: 24,
    marginBottom: 24,
  },
  infoBox: {
    padding: 16,
    borderRadius: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  infoTextContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIcon: {
    marginRight: 8,
    marginTop: 2,
  },
});
