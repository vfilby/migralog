import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = keyof typeof Ionicons.glyphMap;
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme';
import { useOnboardingStore } from '../store/onboardingStore';
import { notificationService } from '../services/notifications/notificationService';
import { locationService } from '../services/locationService';
import { logger } from '../utils/logger';

type WelcomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

const TOTAL_STEPS = 4;

export default function WelcomeScreen() {
  const navigation = useNavigation<WelcomeScreenNavigationProp>();
  const { theme: colors } = useTheme();
  const { completeOnboarding } = useOnboardingStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [isRequestingPermissions, setIsRequestingPermissions] = useState(false);

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = async () => {
    try {
      setIsRequestingPermissions(true);
      logger.log('[WelcomeScreen] Requesting permissions');

      // Request notification permissions first
      const notificationPermissions = await notificationService.requestPermissions();
      logger.log('[WelcomeScreen] Notification permission result:', {
        granted: notificationPermissions.granted,
        criticalAlerts: notificationPermissions.ios?.allowsCriticalAlerts,
      });

      // Request location permission
      const locationGranted = await locationService.requestPermission();
      logger.log('[WelcomeScreen] Location permission result:', { granted: locationGranted });

      // Mark onboarding as complete regardless of permission results
      await completeOnboarding();

      // Navigate to main app
      navigation.replace('MainTabs');
    } catch (error) {
      logger.error('[WelcomeScreen] Error requesting permissions:', error);
      // Still mark as complete and continue
      await completeOnboarding();
      navigation.replace('MainTabs');
    } finally {
      setIsRequestingPermissions(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        {[1, 2, 3, 4].map((step) => (
          <View
            key={step}
            style={[
              styles.progressDot,
              step === currentStep && styles.progressDotActive,
              step < currentStep && styles.progressDotComplete,
              { 
                backgroundColor: step === currentStep 
                  ? colors.primary 
                  : step < currentStep
                    ? colors.primary
                    : colors.border
              },
            ]}
          />
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {currentStep === 1 && <WelcomeStep colors={colors} />}
        {currentStep === 2 && <DisclaimerStep colors={colors} />}
        {currentStep === 3 && <NotificationPermissionsStep colors={colors} />}
        {currentStep === 4 && <LocationPermissionsStep colors={colors} />}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.buttonContainer}>
        {currentStep < TOTAL_STEPS ? (
          <>
            {currentStep > 1 && (
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.border }]}
                onPress={handleBack}
                testID="back-button"
              >
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                  Back
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primary },
                currentStep === 1 && styles.primaryButtonFullWidth,
              ]}
              onPress={handleNext}
              testID="next-button"
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[
              styles.primaryButton,
              styles.primaryButtonFullWidth,
              { backgroundColor: colors.primary },
            ]}
            onPress={handleFinish}
            disabled={isRequestingPermissions}
            testID="enable-notifications-button"
          >
            <Text style={styles.primaryButtonText}>
              {isRequestingPermissions ? 'Setting up...' : 'Finish Setup'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

interface StepProps {
  colors: {
    text: string;
    textSecondary: string;
    textTertiary: string;
    card: string;
    border: string;
    primary: string;
  };
}

// Step 1: Welcome and Introduction
function WelcomeStep({ colors }: StepProps) {
  return (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Image 
          source={require('../../assets/icon.png')} 
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>
        Welcome to MigraLog
      </Text>

      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Your personal migraine tracking companion
      </Text>

      <View style={styles.featuresContainer}>
        <FeatureItem
          icon="pulse-outline"
          title="Track Episodes"
          description="Log symptoms, intensity, triggers, and medications in real-time"
          colors={colors}
        />
        <FeatureItem
          icon="medical-outline"
          title="Medication Management"
          description="Set schedules, get reminders, and track what works for you"
          colors={colors}
        />
        <FeatureItem
          icon="trending-up-outline"
          title="Insights & Trends"
          description="Discover patterns and share reports with your healthcare provider"
          colors={colors}
        />
        <FeatureItem
          icon="shield-checkmark-outline"
          title="Privacy First"
          description="Your health data stays private and secure on your device"
          colors={colors}
        />
      </View>
    </View>
  );
}

// Step 2: Medical Disclaimer
function DisclaimerStep({ colors }: StepProps) {
  return (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>⚕️</Text>
      </View>

      <Text style={[styles.title, { color: colors.text }]}>
        Medical Disclaimer
      </Text>

      <View style={[styles.disclaimerCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
          MigraLog is a <Text style={{ fontWeight: '600' }}>tracking and informational tool</Text> designed to help you monitor your migraines. It is <Text style={{ fontWeight: '600' }}>not medical advice</Text> and should not be used as a substitute for professional healthcare.
        </Text>

        <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
          • Always consult your doctor or healthcare provider for medical advice
        </Text>
        <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
          • Never ignore professional medical guidance
        </Text>
        <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
          • Do not change medications without consulting your doctor
        </Text>
        <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
          • In case of emergency, call 911 or your local emergency number
        </Text>

        <View style={[styles.disclaimerFooter, { borderTopColor: colors.border }]}>
          <Text style={[styles.disclaimerFooterText, { color: colors.textTertiary }]}>
            By continuing, you acknowledge that you understand this is a tracking tool and not medical advice.
          </Text>
        </View>
      </View>
    </View>
  );
}

// Step 3: Notification Permissions
function NotificationPermissionsStep({ colors }: StepProps) {
  return (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Ionicons name="notifications-outline" size={72} color={colors.primary} />
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
        <View style={[styles.infoBox, { backgroundColor: colors.card }]}>
          <View style={styles.infoTextContainer}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} style={styles.infoIcon} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              You'll see two permission requests: one for standard notifications and one for critical follow-up alerts.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// Step 4: Location Permissions
function LocationPermissionsStep({ colors }: StepProps) {
  return (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Ionicons name="location-outline" size={72} color={colors.primary} />
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

      <View style={[styles.infoBox, { backgroundColor: colors.card }]}>
        <View style={styles.infoTextContainer}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primary} style={styles.infoIcon} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Location services are completely optional. You can always change this setting later in the app.
          </Text>
        </View>
      </View>
    </View>
  );
}

// Helper Components
interface FeatureItemProps {
  icon: string;
  title: string;
  description: string;
  colors: StepProps['colors'];
}

function FeatureItem({ icon, title, description, colors }: FeatureItemProps) {
  const { theme } = useTheme();
  
  // Define which icons are Ionicons vs emojis
  const isIonicon = ['pulse-outline', 'medical-outline', 'trending-up-outline', 'shield-checkmark-outline'].includes(icon);
  
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIconContainer}>
        {isIonicon ? (
          <Ionicons name={icon as IoniconName} size={28} color={theme.primary} />
        ) : (
          <Text style={styles.featureIcon}>{icon}</Text>
        )}
      </View>
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

interface PermissionItemProps {
  icon: string;
  title: string;
  description: string;
  colors: StepProps['colors'];
}

function PermissionItem({ icon, title, description, colors }: PermissionItemProps) {
  const { theme } = useTheme();
  
  // Define which icons are Ionicons vs emojis
  const isIonicon = ['warning', 'medical-outline', 'calendar-outline', 'map-outline', 'shield-checkmark-outline'].includes(icon);
  
  // Choose appropriate color for each icon
  const getIconColor = () => {
    switch (icon) {
      case 'warning':
        return theme.warning;
      case 'medical-outline':
        return theme.primary;
      case 'calendar-outline':
        return theme.primary;
      case 'map-outline':
        return theme.primary;
      case 'shield-checkmark-outline':
        return theme.success;
      default:
        return theme.primary;
    }
  };
  
  return (
    <View style={styles.permissionItem}>
      <View style={styles.permissionIconContainer}>
        {isIonicon ? (
          <Ionicons name={icon as IoniconName} size={32} color={getIconColor()} />
        ) : (
          <Text style={styles.permissionIcon}>{icon}</Text>
        )}
      </View>
      <View style={styles.permissionText}>
        <Text style={[styles.permissionTitle, { color: colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.permissionDescription, { color: colors.textSecondary }]}>
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
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    paddingTop: 60,
    gap: 12,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  progressDotActive: {
    width: 24,
    height: 10,
    borderRadius: 5,
  },
  progressDotComplete: {
    width: 10,
    height: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  stepContainer: {
    flex: 1,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 72,
  },
  logoImage: {
    width: 72,
    height: 72,
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
  featuresContainer: {
    gap: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  featureIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  featureIconContainer: {
    marginRight: 16,
    width: 28,
    alignItems: 'center',
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
    lineHeight: 21,
  },
  disclaimerCard: {
    padding: 24,
    borderRadius: 16,
  },
  disclaimerTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  disclaimerText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  disclaimerFooter: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
  },
  disclaimerFooterText: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  permissionsContainer: {
    gap: 24,
    marginBottom: 24,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  permissionIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  permissionIconContainer: {
    marginRight: 16,
    width: 32,
    alignItems: 'center',
  },
  permissionText: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 15,
    lineHeight: 21,
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
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonFullWidth: {
    flex: 1,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
