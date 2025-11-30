import { Alert } from 'react-native';
import { logger } from '../../../utils/logger';
import * as Sentry from '@sentry/react-native';

export function useSentryTesting() {
  const testSentry = () => {
    Alert.alert(
      'Test Sentry Integration',
      'This will send test events to Sentry to verify the integration is working. Check your Sentry dashboard after sending.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Test Events',
          onPress: () => {
            try {
              // Send a test exception
              Sentry.captureException(new Error('TestFlight Sentry Integration Test'));

              // Send a test message
              Sentry.captureMessage('Sentry integration test from Settings screen', 'info');

              // Add a breadcrumb to show user action
              Sentry.addBreadcrumb({
                category: 'test',
                message: 'User triggered Sentry test from Settings',
                level: 'info',
              });

              Alert.alert(
                'Test Sent',
                'Test events sent to Sentry! Check your Sentry dashboard in a few moments to verify they appear.\n\nLook for:\n• Error: "TestFlight Sentry Integration Test"\n• Message: "Sentry integration test..."'
              );
            } catch (error) {
              logger.error('Failed to send Sentry test:', error);
              Alert.alert('Error', 'Failed to send test events. Sentry may not be configured.');
            }
          },
        },
      ]
    );
  };

  return {
    testSentry,
  };
}
