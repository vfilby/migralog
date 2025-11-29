import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { StepProps } from '../constants';
import { IONICON_NAMES } from '../constants';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface FeatureItemProps {
  icon: string;
  title: string;
  description: string;
  colors: StepProps['colors'];
}

/**
 * Displays a feature item in the welcome screen
 * Uses Ionicons for standard icons or text for emoji icons
 */
export function FeatureItem({ icon, title, description, colors }: FeatureItemProps) {
  const { theme } = useTheme();
  const isIonicon = IONICON_NAMES.has(icon);
  
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIconContainer}>
        {isIonicon ? (
          <Ionicons 
            name={icon as IoniconName} 
            size={28} 
            color={theme.primary} 
          />
        ) : (
          <Text style={styles.featureIcon}>{icon}</Text>
        )}
      </View>
      <View style={styles.featureText}>
        <Text style={[styles.featureTitle, { color: colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.featureDescription, { color: colors.textSecondary }]}>
          {description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  featureIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  featureIconContainer: {
    marginRight: 16,
    width: 28,
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 15,
    lineHeight: 21,
  },
});
