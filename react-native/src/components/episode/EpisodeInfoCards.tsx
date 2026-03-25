import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, ThemeColors } from '../../theme';

interface EpisodeInfoCardsProps {
  qualities: string[];
  triggers: string[];
}

export const EpisodeInfoCards: React.FC<EpisodeInfoCardsProps> = ({
  qualities,
  triggers,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const formatQuality = (quality: string): string => {
    return quality.charAt(0).toUpperCase() + quality.slice(1);
  };

  const formatTrigger = (trigger: string): string => {
    return trigger.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <>
      {/* Pain Qualities */}
      {qualities.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pain Quality</Text>
          <View style={styles.chipContainer}>
            {qualities.map(quality => (
              <View key={quality} style={styles.chip}>
                <Text style={styles.chipText}>
                  {formatQuality(quality)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Triggers */}
      {triggers.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Possible Triggers</Text>
          <View style={styles.chipContainer}>
            {triggers.map(trigger => (
              <View key={trigger} style={styles.chip}>
                <Text style={styles.chipText}>
                  {formatTrigger(trigger)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  );
};

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      marginHorizontal: 16,
      marginTop: 16,
      padding: 16,
      borderRadius: 8,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    chipContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      backgroundColor: theme.borderLight,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    chipText: {
      fontSize: 14,
      color: theme.text,
    },
  });
