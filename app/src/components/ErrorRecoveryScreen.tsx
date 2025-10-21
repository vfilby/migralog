import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../theme';
import { ThemeColors } from '../theme/colors';

interface ErrorRecoveryScreenProps {
  error: Error;
  onReset: () => void;
}

/**
 * ErrorRecoveryScreen - Displayed when Error Boundary catches an error
 * Provides user-friendly error message and recovery options
 */
const ErrorRecoveryScreen: React.FC<ErrorRecoveryScreenProps> = ({ error, onReset }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

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
        >
          <Text style={styles.primaryButtonText}>Try Again</Text>
        </TouchableOpacity>

        <Text style={styles.helpText}>
          If this problem persists, try restarting the app.
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
    helpText: {
      fontSize: 14,
      color: theme.textTertiary,
      textAlign: 'center',
      marginTop: 8,
    },
  });

export default ErrorRecoveryScreen;
