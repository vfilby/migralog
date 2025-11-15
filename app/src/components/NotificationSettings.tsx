import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../theme';
import { useNotificationSettingsStore, FollowUpDelay } from '../store/notificationSettingsStore';
import { logger } from '../utils/logger';
import * as Notifications from 'expo-notifications';

const FOLLOW_UP_DELAY_OPTIONS: { value: FollowUpDelay; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
];

interface NotificationSettingsProps {
  /** Optional medication ID for per-medication settings */
  medicationId?: string;
  /** Show section title and description */
  showTitle?: boolean;
  /** Notification permissions - if not provided, will check internally */
  notificationPermissions?: Notifications.NotificationPermissionsStatus | null;
}

const NotificationSettings = React.memo(({ medicationId, showTitle = true, notificationPermissions }: NotificationSettingsProps) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const {
    settings,
    isLoaded,
    loadSettings,
    updateGlobalSettings,
    updateMedicationSettings,
    removeMedicationSettings,
    getEffectiveSettings,
  } = useNotificationSettingsStore();
  const [internalPermissions, setInternalPermissions] = React.useState<Notifications.NotificationPermissionsStatus | null>(null);

  // Use provided permissions or check internally
  const permissions = notificationPermissions !== undefined ? notificationPermissions : internalPermissions;
  const permissionsGranted = permissions?.granted ?? false;

  useEffect(() => {
    if (!isLoaded) {
      loadSettings();
    }
  }, [isLoaded, loadSettings]);

  useEffect(() => {
    // Only check permissions if not provided as prop
    if (notificationPermissions === undefined) {
      Notifications.getPermissionsAsync().then(setInternalPermissions);
    }
  }, [notificationPermissions]);

  const effectiveSettings = getEffectiveSettings(medicationId);
  const isOverridden = medicationId ? effectiveSettings.isOverridden : false;

  const handleToggle = async (key: keyof typeof settings, value: boolean) => {
    try {
      if (medicationId) {
        // Update medication-specific settings
        const currentOverride = settings.medicationOverrides[medicationId] || {};
        await updateMedicationSettings(medicationId, {
          ...currentOverride,
          [key]: value,
        });
      } else {
        // Update global settings
        await updateGlobalSettings({ [key]: value });
      }
    } catch (error) {
      logger.error('[NotificationSettings] Failed to update setting:', error);
      Alert.alert('Error', 'Failed to update notification settings');
    }
  };

  const handleFollowUpDelayChange = async (delay: FollowUpDelay) => {
    try {
      if (medicationId) {
        const currentOverride = settings.medicationOverrides[medicationId] || {};
        await updateMedicationSettings(medicationId, {
          ...currentOverride,
          followUpDelay: delay,
        });
      } else {
        await updateGlobalSettings({ followUpDelay: delay });
      }
    } catch (error) {
      logger.error('[NotificationSettings] Failed to update follow-up delay:', error);
      Alert.alert('Error', 'Failed to update follow-up delay');
    }
  };

  const showFollowUpDelayPicker = () => {
    Alert.alert(
      'Follow-up Delay',
      'Choose when to send a follow-up reminder after the initial notification',
      [
        ...FOLLOW_UP_DELAY_OPTIONS.map(option => ({
          text: option.label,
          onPress: () => handleFollowUpDelayChange(option.value),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  };

  const handleResetToDefaults = () => {
    if (!medicationId) return;

    Alert.alert(
      'Reset to Defaults',
      'This will remove all custom settings for this medication and use the global defaults.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMedicationSettings(medicationId);
              Alert.alert('Success', 'Settings reset to defaults');
            } catch (error) {
              logger.error('[NotificationSettings] Failed to reset settings:', error);
              Alert.alert('Error', 'Failed to reset settings');
            }
          },
        },
      ]
    );
  };

  const handleOpenSystemSettings = async () => {
    try {
      await Linking.openSettings();
    } catch (error) {
      logger.error('[NotificationSettings] Failed to open system settings:', error);
      Alert.alert('Error', 'Failed to open Settings');
    }
  };

  if (!isLoaded || (notificationPermissions === undefined && !internalPermissions)) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  // Show disabled message if permissions not granted
  if (!permissionsGranted) {
    return (
      <View style={styles.container}>
        <View style={styles.disabledCard}>
          <Text style={styles.disabledText}>
            Notifications are currently disabled. Enable notifications in Settings to customize notification behavior.
          </Text>
          <TouchableOpacity
            style={styles.settingsLinkButton}
            onPress={handleOpenSystemSettings}
            accessibilityRole="button"
            accessibilityLabel="Open Settings"
            accessibilityHint="Double tap to open system settings to enable notifications"
          >
            <Text style={styles.settingsLinkButtonText}>Open Settings</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showTitle && (
        <>
          <Text style={styles.sectionTitle}>
            {medicationId ? 'Notification Overrides' : 'Notification Settings'}
          </Text>
          <Text style={styles.sectionDescription}>
            {medicationId
              ? 'Customize notification behavior for this medication. Leave unchanged to use global defaults.'
              : 'Configure default notification behavior for all medication reminders'}
          </Text>
        </>
      )}

      {isOverridden && (
        <View style={styles.overrideNotice}>
          <Ionicons name="information-circle" size={20} color={theme.primary} />
          <Text style={styles.overrideNoticeText}>
            Using custom settings for this medication
          </Text>
        </View>
      )}

      <View style={styles.settingsCard}>
        {/* Time-Sensitive Notifications */}
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Ionicons name="time-outline" size={20} color={theme.textSecondary} />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Time-Sensitive</Text>
              <Text style={styles.settingDescription}>
                Show notifications even in Focus mode
              </Text>
            </View>
          </View>
          <Switch
            value={effectiveSettings.timeSensitiveEnabled}
            onValueChange={(value) => handleToggle('timeSensitiveEnabled', value)}
            trackColor={{ false: theme.border, true: theme.primary }}
            ios_backgroundColor={theme.border}
            accessibilityRole="switch"
            accessibilityLabel="Time-Sensitive notifications"
            accessibilityHint="Toggle to show notifications even in Focus mode"
          />
        </View>

        <View style={styles.divider} />

        {/* Follow-up Delay */}
        <TouchableOpacity
          style={styles.settingRow}
          onPress={showFollowUpDelayPicker}
          testID="follow-up-delay-picker"
          accessibilityRole="button"
          accessibilityLabel={`Follow-up Reminder: ${FOLLOW_UP_DELAY_OPTIONS.find(o => o.value === effectiveSettings.followUpDelay)?.label}`}
          accessibilityHint="Double tap to change the follow-up reminder delay"
        >
          <View style={styles.settingLeft}>
            <Ionicons name="alarm-outline" size={20} color={theme.textSecondary} />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Follow-up Reminder</Text>
              <Text style={styles.settingDescription}>
                Send a second reminder if medication not taken
              </Text>
            </View>
          </View>
          <View style={styles.settingRight}>
            <Text style={styles.settingValue}>
              {FOLLOW_UP_DELAY_OPTIONS.find(o => o.value === effectiveSettings.followUpDelay)?.label}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Critical Alerts */}
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Ionicons name="volume-high-outline" size={20} color={theme.textSecondary} />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Critical Alerts</Text>
              <Text style={styles.settingDescription}>
                Play sound on follow-up reminders even when device is silenced
              </Text>
            </View>
          </View>
          <Switch
            value={effectiveSettings.criticalAlertsEnabled}
            onValueChange={(value) => handleToggle('criticalAlertsEnabled', value)}
            trackColor={{ false: theme.border, true: theme.primary }}
            ios_backgroundColor={theme.border}
            accessibilityRole="switch"
            accessibilityLabel="Critical Alerts"
            accessibilityHint="Toggle to play sound on follow-up reminders even when device is silenced"
          />
        </View>
      </View>

      {medicationId && isOverridden && (
        <TouchableOpacity
          style={styles.resetButton}
          onPress={handleResetToDefaults}
          testID="reset-to-defaults-button"
          accessibilityRole="button"
          accessibilityLabel="Reset to Defaults"
          accessibilityHint="Double tap to remove custom settings and use global defaults"
        >
          <Ionicons name="refresh-outline" size={20} color={theme.error} />
          <Text style={styles.resetButtonText}>Reset to Defaults</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

NotificationSettings.displayName = 'NotificationSettings';

export default NotificationSettings;

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
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
    lineHeight: 20,
  },
  overrideNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary + '15',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  overrideNoticeText: {
    flex: 1,
    fontSize: 14,
    color: theme.primary,
    fontWeight: '500',
  },
  settingsCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 60,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
    paddingRight: 16,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.text,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 16,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingValue: {
    fontSize: 15,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: theme.borderLight,
    marginLeft: 48, // Align with text (icon width + gap)
  },
  resetButton: {
    backgroundColor: theme.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.error + '40',
    gap: 8,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.error,
  },
  disabledCard: {
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  disabledText: {
    fontSize: 15,
    color: theme.textSecondary,
    lineHeight: 22,
  },
  settingsLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.primary + '15',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  settingsLinkButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primary,
  },
});
