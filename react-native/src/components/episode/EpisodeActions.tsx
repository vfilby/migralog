import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Episode } from '../../models/types';
import { useTheme, ThemeColors } from '../../theme';

interface EpisodeActionsProps {
  episode: Episode;
  onEndEpisodeNow: () => void;
  onShowCustomEndTime: () => void;
}

export const EpisodeActions: React.FC<EpisodeActionsProps> = ({
  episode,
  onEndEpisodeNow,
  onShowCustomEndTime,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (episode.endTime) {
    return null;
  }

  return (
    <View style={styles.footer}>
      <View style={styles.endButtonsContainer}>
        <TouchableOpacity
          style={styles.endButton}
          onPress={onEndEpisodeNow}
          testID="end-now-button"
          accessibilityRole="button"
          accessibilityLabel="End episode now"
          accessibilityHint="Ends this episode with the current time"
        >
          <Text style={styles.endButtonText}>End Now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.endCustomButton}
          onPress={onShowCustomEndTime}
          testID="end-custom-button"
          accessibilityRole="button"
          accessibilityLabel="End episode with custom time"
          accessibilityHint="Opens date picker to choose when the episode ended"
        >
          <Text style={styles.endCustomButtonText}>End...</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    footer: {
      backgroundColor: theme.card,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 32,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 5,
    },
    endButtonsContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    endButton: {
      flex: 1,
      backgroundColor: theme.danger,
      paddingVertical: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    endButtonText: {
      color: theme.dangerText,
      fontSize: 16,
      fontWeight: '600',
    },
    endCustomButton: {
      flex: 1,
      backgroundColor: theme.backgroundSecondary,
      paddingVertical: 16,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    endCustomButtonText: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '600',
    },
  });
