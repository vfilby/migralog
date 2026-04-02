import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors } from '../../../theme';
import { NotificationPermissions } from '../../../services/notifications/notificationService';

export interface NotificationSectionProps {
  theme: ThemeColors;
  notificationPermissions: NotificationPermissions | null;
  onNavigate: () => void;
}

export const NotificationSection: React.FC<NotificationSectionProps> = ({
  theme,
  notificationPermissions,
  onNavigate,
}) => {
  const styles = createStyles(theme);

  const getDescription = () => {
    if (!notificationPermissions) {
      return 'Loading...';
    }
    return notificationPermissions.granted
      ? 'Manage medication reminders and daily check-ins'
      : 'Enable notifications for reminders';
  };

  return (
    <View style={styles.navigationSection}>
      <TouchableOpacity
        style={styles.navigationItem}
        onPress={onNavigate}
        accessibilityRole="button"
        accessibilityLabel="Notification settings"
        accessibilityHint="Opens notification and medication reminder settings"
      >
        <View style={styles.navigationItemContent}>
          <Ionicons name="notifications-outline" size={24} color={theme.primary} />
          <View style={styles.navigationItemText}>
            <Text style={styles.navigationItemTitle}>Notifications</Text>
            <Text style={styles.navigationItemDescription}>
              {getDescription()}
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
