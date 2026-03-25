import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useColorScheme, Alert, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../theme';
import { ThemeColors, lightColors, darkColors } from '../../theme/colors';
import { DB_PATH } from '../../services/backup/backupUtils';
import { logger } from '../../utils/logger';

interface ErrorRecoveryScreenProps {
  error: Error;
  onReset: () => void;
}

/**
 * ErrorRecoveryScreen - Displayed when Error Boundary catches an error
 * Provides user-friendly error message and recovery options
 *
 * Note: This component must work even if ThemeProvider is not available,
 * as it's used by ErrorBoundary which may catch errors during app initialization.
 */
const ErrorRecoveryScreen: React.FC<ErrorRecoveryScreenProps> = ({ error, onReset }) => {
  const systemColorScheme = useColorScheme();
  const [isExporting, setIsExporting] = useState(false);

  // Try to get theme from context, but fallback to system color scheme if not available
  let theme: ThemeColors;
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;
  } catch {
    // ThemeProvider not available, use system color scheme
    theme = systemColorScheme === 'dark' ? darkColors : lightColors;
  }

  const styles = createStyles(theme);

  /**
   * Export the database file so users can save a copy before losing data
   * This is critical for data recovery when the app fails to initialize
   */
  const handleExportDatabase = async () => {
    setIsExporting(true);
    try {
      // Check if database file exists
      const dbInfo = await FileSystem.getInfoAsync(DB_PATH);
      if (!dbInfo.exists) {
        Alert.alert(
          'Database Not Found',
          'The database file could not be found. There may be no data to export.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(
          'Sharing Not Available',
          'Sharing is not available on this device. The database cannot be exported.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Create a timestamped copy for export in the cache directory
      const timestamp = Date.now();
      const exportPath = `${FileSystem.cacheDirectory}migralog_recovery_${timestamp}.db`;

      await FileSystem.copyAsync({
        from: DB_PATH,
        to: exportPath,
      });

      // Share the file (user can save to Files, email, etc.)
      await Sharing.shareAsync(exportPath, {
        mimeType: 'application/x-sqlite3',
        dialogTitle: 'Export MigraLog Database',
        UTI: 'public.database',
      });

      // Clean up the temporary copy
      await FileSystem.deleteAsync(exportPath, { idempotent: true });

      logger.log('[ErrorRecovery] Database exported successfully');
    } catch (exportError) {
      logger.error('[ErrorRecovery] Failed to export database:', exportError);
      Alert.alert(
        'Export Failed',
        'Failed to export the database. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.title}>Something Went Wrong</Text>
        <Text style={styles.message}>
          The app encountered an unexpected error. Don't worry - your data is safe.
        </Text>

        {__DEV__ && (
          <View style={styles.errorDetails}>
            <Text style={styles.errorDetailsTitle}>Error Details (Dev Mode):</Text>
            <Text style={styles.errorDetailsText}>{error.message}</Text>
            {error.stack && (
              <Text style={styles.errorStack} numberOfLines={10}>
                {error.stack}
              </Text>
            )}
          </View>
        )}

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onReset}
          testID="error-recovery-reset"
          accessibilityRole="button"
          accessibilityLabel="Try Again"
          accessibilityHint="Double tap to reset the app and try again"
        >
          <Text style={styles.primaryButtonText}>Try Again</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleExportDatabase}
          disabled={isExporting}
          testID="error-recovery-export"
          accessibilityRole="button"
          accessibilityLabel="Export Database"
          accessibilityHint="Double tap to save a copy of your data before restarting"
        >
          {isExporting ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Text style={styles.secondaryButtonText}>Export Database</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.helpText}>
          If this problem persists, try exporting your data first, then restart the app.
        </Text>
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContent: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    icon: {
      fontSize: 64,
      marginBottom: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    message: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 24,
    },
    errorDetails: {
      backgroundColor: theme.card,
      borderRadius: 8,
      padding: 16,
      marginBottom: 24,
      width: '100%',
      borderWidth: 1,
      borderColor: theme.border,
    },
    errorDetailsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    errorDetailsText: {
      fontSize: 13,
      color: theme.danger,
      fontFamily: 'Courier',
      marginBottom: 8,
    },
    errorStack: {
      fontSize: 11,
      color: theme.textTertiary,
      fontFamily: 'Courier',
    },
    primaryButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 8,
      minWidth: 200,
      alignItems: 'center',
      marginBottom: 16,
    },
    primaryButtonText: {
      color: theme.primaryText,
      fontSize: 17,
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 8,
      minWidth: 200,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    secondaryButtonText: {
      color: theme.primary,
      fontSize: 17,
      fontWeight: '600',
    },
    helpText: {
      fontSize: 14,
      color: theme.textTertiary,
      textAlign: 'center',
      marginTop: 8,
    },
  });

export default ErrorRecoveryScreen;
