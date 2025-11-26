import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Episode } from '../../models/types';

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

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    shadowColor: '#000',
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
    backgroundColor: '#FF6B6B',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  endButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  endCustomButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  endCustomButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
});