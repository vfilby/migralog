import { useState, useEffect } from 'react';
import { logger } from '../../../utils/logger';
import { errorLogger, ErrorLog } from '../../../services/errorLogger';
import * as SQLite from 'expo-sqlite';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

export interface SentryStatus {
  isConfigured: boolean;
  isEnabled: boolean;
  environment: string;
  reason?: string;
  dsn?: string;
  org?: string;
  project?: string;
  slug?: string;
  bundleId?: string;
}

export function useDiagnostics() {
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [dbStatus, setDbStatus] = useState<'checking' | 'healthy' | 'error'>('checking');
  const [sentryStatus, setSentryStatus] = useState<SentryStatus | null>(null);

  useEffect(() => {
    loadDiagnostics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDiagnostics = async () => {
    try {
      // Load recent error logs
      const logs = await errorLogger.getRecentLogs(5);
      setErrorLogs(logs);

      // Check database health
      await checkDatabaseHealth();

      // Check Sentry configuration
      checkSentryConfiguration();
    } catch (error) {
      logger.error('Failed to load diagnostics:', error);
    }
  };

  const checkSentryConfiguration = () => {
    try {
      const client = Sentry.getClient();
      const clientDsn = client?.getOptions().dsn;
      const enabled = client?.getOptions().enabled ?? false;
      const environment = client?.getOptions().environment ?? 'unknown';

      // Use the same DSN logic as displayed to user - check environment variable as fallback
      const envDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
      const effectiveDsn = clientDsn || envDsn;

      // DSN being configured is separate from being enabled
      // isConfigured = DSN exists (ready for use)
      // isEnabled = Sentry is actively sending events
      const hasDsn = !!effectiveDsn;
      const isConfigured = hasDsn; // Configured means DSN is set
      const isDevelopment = __DEV__ || environment === 'development';

      // Get configuration values from Constants and environment
      const expoConfig = Constants.expoConfig || {};
      const slug = (expoConfig as Record<string, unknown>)?.slug;
      const bundleId = ((expoConfig as Record<string, unknown>)?.ios as Record<string, unknown>)?.bundleIdentifier;

      let reason: string | undefined;
      if (!hasDsn) {
        reason = 'DSN not configured\n\nCheck EXPO_PUBLIC_SENTRY_DSN environment variable in GitHub Actions secrets';
      } else if (!enabled && isDevelopment) {
        reason = 'Sentry is disabled in development builds (this is expected)';
      } else if (!enabled) {
        reason = 'Sentry is disabled\n\nCheck EXPO_PUBLIC_SENTRY_ENABLED environment variable';
      }

      setSentryStatus({
        isConfigured,
        isEnabled: enabled,
        environment,
        reason,
        dsn: effectiveDsn || 'not configured',
        org: process.env.SENTRY_ORG || 'eff3',
        project: process.env.SENTRY_PROJECT || 'migralog',
        slug: typeof slug === 'string' ? slug : undefined,
        bundleId: typeof bundleId === 'string' ? bundleId : undefined,
      });
    } catch (error) {
      logger.error('Failed to check Sentry configuration:', error);
    }
  };

  const checkDatabaseHealth = async () => {
    try {
      const db = await SQLite.openDatabaseAsync('migralog.db');
      await db.execAsync('SELECT 1'); // Simple query to test connection
      setDbStatus('healthy');
    } catch (error) {
      logger.error('Database health check failed:', error);
      setDbStatus('error');
      await errorLogger.log('database', 'Database health check failed', error as Error);
    }
  };

  return {
    errorLogs,
    dbStatus,
    sentryStatus,
    loadDiagnostics,
  };
}
