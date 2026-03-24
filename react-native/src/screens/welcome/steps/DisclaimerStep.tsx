import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StepProps } from '../constants';

/**
 * Step 2: Medical Disclaimer
 * Informs users that this is a tracking tool, not medical advice
 */
export function DisclaimerStep({ colors }: StepProps) {
  return (
    <View style={styles.stepContainer} testID="disclaimer-step">
      <View style={styles.iconContainer}>
        <Text 
          style={styles.icon}
          accessible={true}
          accessibilityLabel="Medical symbol"
        >
          ⚕️
        </Text>
      </View>

      <Text style={[styles.title, { color: colors.text }]}>
        Medical Disclaimer
      </Text>

      <View 
        style={[styles.disclaimerCard, { backgroundColor: colors.card }]}
        accessible={true}
        accessibilityRole="text"
      >
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

const styles = StyleSheet.create({
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
  title: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  disclaimerCard: {
    padding: 24,
    borderRadius: 16,
    marginTop: 24,
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
});
