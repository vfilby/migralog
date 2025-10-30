import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import * as Sentry from '@sentry/react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/theme';
import { getDatabase } from './src/database/db';
import { notificationService } from './src/services/notificationService';
import { logger } from './src/utils/logger';
import { performanceMonitor } from './src/utils/performance';
import ErrorBoundary from './src/components/ErrorBoundary';
import { beforeSend, beforeSendTransaction } from './src/utils/sentryPrivacy';

// Initialize Sentry for error tracking and performance monitoring
// IMPORTANT: This must be called as early as possible, before any other code
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Enable performance monitoring
    tracesSampleRate: __DEV__ ? 1.0 : 0.1, // 100% in dev, 10% in production

    // Enable automatic session tracking
    enableAutoSessionTracking: true,

    // Session tracking interval
    sessionTrackingIntervalMillis: 30000, // 30 seconds

    // Privacy: Scrub all sensitive health data before sending
    beforeSend,
    beforeSendTransaction,

    // Environment detection
    environment: __DEV__ ? 'development' : 'production',

    // Enable debug logging in development
    debug: __DEV__,

    // Disable in development to avoid quota usage
    enabled: !__DEV__ || process.env.EXPO_PUBLIC_SENTRY_ENABLED === 'true',
  });

  logger.log('Sentry initialized with DSN');
} else {
  logger.warn('Sentry DSN not configured - error tracking disabled');
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

      // Initialize database (handles migrations automatically)
      performanceMonitor.mark('app-start');
      await getDatabase();
      performanceMonitor.mark('database-ready');

      // Initialize notification service
      await notificationService.initialize();
      performanceMonitor.mark('notifications-ready');
      logger.log('Notification service initialized');

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
    <ErrorBoundary>
      <ThemeProvider>
        <AppNavigator />
        <StatusBar style="auto" />
        <Toast />
      </ThemeProvider>
    </ErrorBoundary>
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

// Wrap the App component with Sentry's error boundary for automatic error capture
export default Sentry.wrap(App);
