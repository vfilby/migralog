import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { StepProps } from '../constants';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface PermissionItemProps {
  icon: IoniconName;
  title: string;
  description: string;
  colors: StepProps['colors'];
}

/**
 * Displays a permission item explaining why a permission is needed
 * Uses color-coded icons based on permission type
 */
export function PermissionItem({ icon, title, description, colors }: PermissionItemProps) {
  const { theme } = useTheme();
  
  /**
   * Choose appropriate color for each icon based on its purpose
   */
  const getIconColor = () => {
    switch (icon) {
      case 'warning':
        return theme.warning;
      case 'shield-checkmark-outline':
        return theme.success;
      default:
        return theme.primary;
    }
  };
  
  return (
    <View style={styles.permissionItem}>
      <View style={styles.permissionIconContainer}>
        <Ionicons 
          name={icon} 
          size={32} 
          color={getIconColor()} 
        />
      </View>
      <View style={styles.permissionText}>
        <Text style={[styles.permissionTitle, { color: colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.permissionDescription, { color: colors.textSecondary }]}>
          {description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  permissionIconContainer: {
    marginRight: 16,
    width: 32,
    alignItems: 'center',
  },
  permissionText: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 15,
    lineHeight: 21,
  },
});
