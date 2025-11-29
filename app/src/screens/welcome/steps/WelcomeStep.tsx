import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { StepProps } from '../constants';
import { FeatureItem } from '../components';

/**
 * Step 1: Welcome and Introduction
 * Introduces the app and lists its key features
 */
export function WelcomeStep({ colors }: StepProps) {
  return (
    <View style={styles.stepContainer} testID="welcome-step">
      <View style={styles.iconContainer}>
        <Image 
          source={require('../../../../assets/icon.png')} 
          style={styles.logoImage}
          resizeMode="contain"
          accessible={true}
          accessibilityLabel="Migralog app icon"
        />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>
        Welcome to Migralog
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

const styles = StyleSheet.create({
  stepContainer: {
    flex: 1,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
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
});
