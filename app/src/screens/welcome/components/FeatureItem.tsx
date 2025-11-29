import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { StepProps } from '../constants';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface FeatureItemProps {
  icon: IoniconName;
  title: string;
  description: string;
  colors: StepProps['colors'];
}

/**
 * Displays a feature item in the welcome screen with an Ionicon
 */
export function FeatureItem({ icon, title, description, colors }: FeatureItemProps) {
  const { theme } = useTheme();
  
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIconContainer}>
        <Ionicons 
          name={icon} 
          size={28} 
          color={theme.primary} 
        />
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
