import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/theme';
import { getDatabase } from './src/database/db';
import { notificationService } from './src/services/notifications/notificationService';
import { dailyCheckinService } from './src/services/notifications/dailyCheckinService';
import { useOnboardingStore } from './src/store/onboardingStore';
import { logger } from './src/utils/logger';
import { performanceMonitor } from './src/utils/performance';
import ErrorBoundary from './src/components/shared/ErrorBoundary';
import * as Sentry from '@sentry/react-native';

// Only initialize Sentry if explicitly enabled or in production
// This prevents quota usage during development and testing
const shouldInitSentry = !__DEV__ || process.env.EXPO_PUBLIC_SENTRY_ENABLED === 'true';

if (shouldInitSentry) {
  Sentry.init({
    dsn: 'https://15bd8c3b6589a60a5e10f2703923db39@o4510275950608384.ingest.us.sentry.io/4510275952312320',

    // Adds more context data to events (IP address, cookies, user, etc.)
    // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
    sendDefaultPii: true,

    // Enable Logs
    enableLogs: true,

    // Configure Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

    // uncomment the line below to enable Spotlight (https://spotlightjs.com)
    // spotlight: __DEV__,
  });
}

// Note: In development, LogBox may overlay our ErrorBoundary screen with a red error screen.
// However, ErrorBoundary still works correctly - if you dismiss LogBox, you'll see ErrorRecoveryScreen.
// In production builds, LogBox doesn't exist, so ErrorBoundary is the only error handler.

function App() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const initialize = async () => {
    const startupTimer = performanceMonitor.startTimer('app-startup', {
      slowThreshold: 2000, // Warn if app takes more than 2s to start
    });

    try {
      setError(null);
      setIsRetrying(false);

      // Check onboarding status first (needed for navigation)
      performanceMonitor.mark('app-start');
      await useOnboardingStore.getState().checkOnboardingStatus();
      performanceMonitor.mark('onboarding-checked');

      // Initialize database (handles migrations automatically)
      await getDatabase();
      performanceMonitor.mark('database-ready');

      // Initialize notification service
      await notificationService.initialize();
      performanceMonitor.mark('notifications-ready');
      logger.log('Notification service initialized');

      // Initialize daily check-in service
      await dailyCheckinService.initialize();
      logger.log('Daily check-in service initialized');

      // Reschedule all notifications on startup to ensure they persist after app updates
      // This handles both medication reminders and daily check-in
      await notificationService.rescheduleAllNotifications();
      logger.log('All notifications rescheduled on startup');

      // Initialize test deep links (dev only)
      if (__DEV__) {
        const { initializeTestDeepLinks } = await import('./src/utils/testDeepLinks');
        initializeTestDeepLinks();
      }

      performanceMonitor.mark('app-ready');

      // Log phase durations
      performanceMonitor.measureBetweenMarks(
        'database-initialization-phase',
        'app-start',
        'database-ready'
      );
      performanceMonitor.measureBetweenMarks(
        'notification-initialization-phase',
        'database-ready',
        'notifications-ready'
      );

      setIsReady(true);
      startupTimer.end();
    } catch (err) {
      logger.error('App initialization error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsRetrying(false);
    }
  };

  const handleRetry = () => {
    setIsRetrying(true);
    initialize();
  };

  useEffect(() => {
    initialize();
  }, []);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Initialization Error</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRetry}
          disabled={isRetrying}
          testID="retry-button"
        >
          <Text style={styles.retryButtonText}>
            {isRetrying ? 'Retrying...' : 'Retry'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={styles.loadingContainer} testID="app-loading-screen">
        <Text style={styles.loadingText} testID="loading-text">Loading...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ThemeProvider>
          <AppNavigator />
          <StatusBar style="auto" />
          <Toast />
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: 17,
    color: '#8E8E93',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FF3B30',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});

export default shouldInitSentry ? Sentry.wrap(App) : App;