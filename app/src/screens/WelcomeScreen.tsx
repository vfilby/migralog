import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme';
import { useOnboardingStore } from '../store/onboardingStore';
import { notificationService } from '../services/notifications/notificationService';
import { logger } from '../utils/logger';

type WelcomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

export default function WelcomeScreen() {
  const navigation = useNavigation<WelcomeScreenNavigationProp>();
  const { theme: colors } = useTheme();
  const { completeOnboarding } = useOnboardingStore();
  const [isEnabling, setIsEnabling] = useState(false);

  const handleEnableNotifications = async () => {
    try {
      setIsEnabling(true);
      logger.log('[WelcomeScreen] User requesting notification permissions');

      // Request all permissions including critical alerts
      const permissions = await notificationService.requestPermissions();

      logger.log('[WelcomeScreen] Permission request result:', {
        granted: permissions.granted,
        criticalAlerts: permissions.ios?.allowsCriticalAlerts,
      });

      // Mark onboarding as complete regardless of permission result
      // User may have denied permissions, but they've seen the prompt
      await completeOnboarding();

      // Navigate to main app
      navigation.replace('MainTabs');
    } catch (error) {
      logger.error('[WelcomeScreen] Error requesting permissions:', error);
      // Still mark as complete - they've been through the flow
      await completeOnboarding();
      navigation.replace('MainTabs');
    } finally {
      setIsEnabling(false);
    }
  };

  const handleSkip = async () => {
    try {
      logger.log('[WelcomeScreen] User skipped notification setup');
      await completeOnboarding();
      navigation.replace('MainTabs');
    } catch (error) {
      logger.error('[WelcomeScreen] Error skipping onboarding:', error);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      testID="welcome-screen"
    >
      <View style={styles.content}>
        {/* App Icon / Branding */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🧠</Text>
        </View>

        {/* Welcome Message */}
        <Text style={[styles.title, { color: colors.text }]}>
          Welcome to MigraLog
        </Text>
        
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Your personal migraine tracking companion
        </Text>

        {/* Feature Highlights */}
        <View style={styles.featuresContainer}>
          <FeatureItem
            icon="📊"
            title="Track Episodes"
            description="Log symptoms, triggers, and medications"
            colors={colors}
          />
          <FeatureItem
            icon="💊"
            title="Medication Reminders"
            description="Never miss a dose with smart notifications"
            colors={colors}
          />
          <FeatureItem
            icon="📈"
            title="Insights & Trends"
            description="Discover patterns in your migraine history"
            colors={colors}
          />
        </View>

        {/* Notification Permission Explanation */}
        <View style={[styles.notificationCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.notificationTitle, { color: colors.text }]}>
            📲 Enable Notifications
          </Text>
          <Text style={[styles.notificationDescription, { color: colors.textSecondary }]}>
            Get timely reminders for your medications and daily check-ins. 
            You can customize notification settings anytime.
          </Text>
          
          {Platform.OS === 'ios' && (
            <Text style={[styles.criticalAlertsNote, { color: colors.textTertiary }]}>
              ℹ️ We'll also request critical alerts permission for important medication reminders 
              that can break through Focus modes.
            </Text>
          )}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={handleEnableNotifications}
          disabled={isEnabling}
          testID="enable-notifications-button"
        >
          <Text style={styles.primaryButtonText}>
            {isEnabling ? 'Setting up...' : 'Enable Notifications'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={isEnabling}
          testID="skip-button"
        >
          <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>
            Skip for now
          </Text>
        </TouchableOpacity>

        <Text style={[styles.privacyNote, { color: colors.textTertiary }]}>
          Your health data stays private and secure on your device.
        </Text>
      </View>
    </ScrollView>
  );
}

interface FeatureItemProps {
  icon: string;
  title: string;
  description: string;
  colors: any;
}

function FeatureItem({ icon, title, description, colors }: FeatureItemProps) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <View style={styles.featureText}>
        <Text style={[styles.featureTitle, { color: colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.featureDescription, { color: colors.textSecondary }]}>
          {description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 80,
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
    marginBottom: 40,
  },
  featuresContainer: {
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  featureIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 15,
    lineHeight: 20,
  },
  notificationCard: {
    padding: 20,
    borderRadius: 12,
    marginTop: 8,
  },
  notificationTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
  },
  notificationDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  criticalAlertsNote: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  skipButtonText: {
    fontSize: 17,
    fontWeight: '500',
  },
  privacyNote: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
