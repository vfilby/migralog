import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StepProps } from '../constants';
import { PermissionItem } from '../components';

/**
 * Step 3: Notification Permissions
 * Explains notification permissions and their benefits
 */
export function NotificationPermissionsStep({ colors }: StepProps) {
  return (
    <View style={styles.stepContainer} testID="notification-permissions-step">
      <View style={styles.iconContainer}>
        <Ionicons 
          name="notifications-outline" 
          size={72} 
          color={colors.primary}
          accessible={true}
          accessibilityLabel="Notification bell icon"
        />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>
        Enable Notifications
      </Text>

      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Get the most out of MigraLog with timely reminders
      </Text>

      <View style={styles.permissionsContainer}>
        <PermissionItem
          icon="medical-outline"
          title="Medication Reminders"
          description="Never miss a dose with scheduled notifications"
          colors={colors}
        />
        <PermissionItem
          icon="calendar-outline"
          title="Daily Check-ins"
          description="Track your daily status and identify patterns"
          colors={colors}
        />
        {Platform.OS === 'ios' && (
          <PermissionItem
            icon="warning"
            title="Critical Alerts"
            description="Important follow-up reminders for missed medication doses"
            colors={colors}
          />
        )}
      </View>

      {Platform.OS === 'ios' && (
        <View 
          style={[styles.infoBox, { backgroundColor: colors.card }]}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel="Information: You'll see two permission requests"
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
              You'll see two permission requests: one for standard notifications and one for critical follow-up alerts.
            </Text>
          </View>
        </View>
      )}
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
