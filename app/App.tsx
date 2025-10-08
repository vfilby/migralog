import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/theme';
import { getDatabase } from './src/database/db';
import { migrationRunner } from './src/database/migrations';
import { notificationService } from './src/services/notificationService';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initialize() {
      try {
        // Initialize database
        const db = await getDatabase();

        // Run migrations
        await migrationRunner.initialize(db);
        const needsMigration = await migrationRunner.needsMigration();

        if (needsMigration) {
          console.log('Running database migrations...');
          await migrationRunner.runMigrations();
          console.log('Migrations completed successfully');
        }

        // Initialize notification service
        await notificationService.initialize();
        console.log('Notification service initialized');

        // Initialize test deep links (dev only)
        if (__DEV__) {
          const { initializeTestDeepLinks } = await import('./src/utils/testDeepLinks');
          initializeTestDeepLinks();
        }

        setIsReady(true);
      } catch (err) {
        console.error('App initialization error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }

    initialize();
  }, []);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Initialization Error</Text>
        <Text style={styles.errorMessage}>{error}</Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ThemeProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </ThemeProvider>
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
  },
});
