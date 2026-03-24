import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';
import { useOnboardingStore } from '../../store/onboardingStore';
import { notificationService } from '../../services/notifications/notificationService';
import { locationService } from '../../services/locationService';
import { logger } from '../../utils/logger';
import { TOTAL_STEPS, ONBOARDING_STEPS, PERMISSION_REQUEST_TIMEOUT_MS } from './constants';
import {
  WelcomeStep,
  DisclaimerStep,
  NotificationPermissionsStep,
  LocationPermissionsStep,
} from './steps';

type WelcomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

/**
 * Welcome Screen - 4-step onboarding flow
 * 
 * Guides users through:
 * 1. Welcome & feature introduction
 * 2. Medical disclaimer
 * 3. Notification permissions
 * 4. Location permissions
 * 
 * Includes proper error handling, accessibility support, and E2E test compatibility
 */
export default function WelcomeScreen() {
  const navigation = useNavigation<WelcomeScreenNavigationProp>();
  const { theme: colors } = useTheme();
  const { completeOnboarding } = useOnboardingStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [isRequestingPermissions, setIsRequestingPermissions] = useState(false);

  /**
   * Handle navigation to next step
   * Requests notification permission on step 3
   */
  const handleNext = async () => {
    if (currentStep === 3) {
      // Step 3 -> 4: Request notification permissions
      await requestNotificationPermission();
    } else if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  /**
   * Request notification permission with error handling
   */
  const requestNotificationPermission = async () => {
    try {
      setIsRequestingPermissions(true);
      logger.log('[WelcomeScreen] Requesting notification permissions on step 3');
      
      const notificationGranted = await notificationService.requestPermissions();
      logger.log('[WelcomeScreen] Notification permission result:', { granted: notificationGranted });
      
      // Continue to next step regardless of permission result
      setCurrentStep(currentStep + 1);
    } catch (error) {
      logger.error('[WelcomeScreen] Error requesting notification permissions:', error);
      
      // Show user-friendly error message
      Alert.alert(
        'Permission Error',
        'Unable to request notification permission. You can enable notifications later in Settings.',
        [
          { 
            text: 'Continue', 
            onPress: () => setCurrentStep(currentStep + 1) 
          }
        ]
      );
    } finally {
      setIsRequestingPermissions(false);
    }
  };

  /**
   * Handle navigation to previous step
   */
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  /**
   * Complete onboarding and request location permission
   * Uses timeout to prevent hanging in E2E tests
   */
  const handleFinish = async () => {
    try {
      setIsRequestingPermissions(true);
      logger.log('[WelcomeScreen] Completing onboarding and requesting location permission');

      // Request location permission with timeout
      await requestLocationPermissionWithTimeout();

      // Mark onboarding as complete
      logger.log('[WelcomeScreen] Completing onboarding');
      await completeOnboarding();

      // Navigate to main app
      navigation.replace('MainTabs');
    } catch (error) {
      logger.error('[WelcomeScreen] Error completing onboarding:', error);
      
      // Show error but still complete onboarding
      Alert.alert(
        'Setup Complete',
        'Onboarding completed with some issues. You can adjust permissions in Settings.',
        [
          {
            text: 'OK',
            onPress: async () => {
              await completeOnboarding();
              navigation.replace('MainTabs');
            }
          }
        ]
      );
    } finally {
      setIsRequestingPermissions(false);
    }
  };

  /**
   * Request location permission with timeout to prevent E2E test hangs
   * Implements proper cleanup to avoid memory leaks
   */
  const requestLocationPermissionWithTimeout = async (): Promise<void> => {
    let timeoutId: NodeJS.Timeout | null = null;
    let permissionCompleted = false;

    try {
      const locationPromise = locationService.requestPermission().then((granted) => {
        permissionCompleted = true;
        if (timeoutId) clearTimeout(timeoutId);
        return granted;
      });

      const timeoutPromise = new Promise<boolean>((resolve) => {
        timeoutId = setTimeout(() => {
          if (!permissionCompleted) {
            logger.warn('[WelcomeScreen] Location permission request timed out (likely E2E test)');
            resolve(false);
          }
        }, PERMISSION_REQUEST_TIMEOUT_MS);
      });
      
      const locationGranted = await Promise.race([locationPromise, timeoutPromise]);
      logger.log('[WelcomeScreen] Location permission result:', { granted: locationGranted });
    } catch (locationError) {
      logger.warn('[WelcomeScreen] Location permission request failed:', locationError);
      // Continue without location permission - this is optional
    } finally {
      // Cleanup timeout
      if (timeoutId && !permissionCompleted) {
        clearTimeout(timeoutId);
      }
    }
  };

  /**
   * Get the current step component
   */
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return <WelcomeStep colors={colors} />;
      case 2:
        return <DisclaimerStep colors={colors} />;
      case 3:
        return <NotificationPermissionsStep colors={colors} />;
      case 4:
        return <LocationPermissionsStep colors={colors} />;
      default:
        return null;
    }
  };

  return (
    <View 
      style={[styles.container, { backgroundColor: colors.background }]}
      accessible={true}
      accessibilityLabel={`Onboarding step ${currentStep} of ${TOTAL_STEPS}`}
    >
      {/* Progress Indicator */}
      <View 
        style={styles.progressContainer}
        accessible={true}
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${currentStep} of ${TOTAL_STEPS}`}
      >
        {ONBOARDING_STEPS.map((step) => (
          <View
            key={step.id}
            style={[
              styles.progressDot,
              step.id === currentStep && styles.progressDotActive,
              step.id < currentStep && styles.progressDotComplete,
              { 
                backgroundColor: step.id === currentStep 
                  ? colors.primary 
                  : step.id < currentStep
                    ? colors.primary
                    : colors.border
              },
            ]}
            accessible={true}
            accessibilityLabel={`${step.title}${step.id === currentStep ? ' - current step' : step.id < currentStep ? ' - completed' : ' - upcoming'}`}
          />
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        accessible={false}
      >
        {renderCurrentStep()}
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
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Go back to previous step"
                accessibilityHint="Returns to the previous onboarding step"
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
              disabled={isRequestingPermissions}
              testID="next-button"
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Continue to next step"
              accessibilityHint="Advances to the next onboarding step"
              accessibilityState={{ disabled: isRequestingPermissions }}
            >
              <Text style={styles.primaryButtonText}>
                {isRequestingPermissions && currentStep === 3 ? 'Requesting...' : 'Continue'}
              </Text>
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
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Finish setup and start using the app"
            accessibilityHint="Completes onboarding and opens the main app"
            accessibilityState={{ disabled: isRequestingPermissions }}
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
