import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import { Episode } from '../models/types';
import { getPainColor, getPainLevel } from '../utils/painScale';
import { locationService } from '../services/locationService';
import { useTheme, ThemeColors } from '../theme';

interface EpisodeCardProps {
  episode: Episode;
  onPress?: () => void;
  compact?: boolean;
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  // Compact styles (for Dashboard)
  episodeItemCompact: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  episodeDateCompact: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
  },
  ongoingBadgeCompact: {
    backgroundColor: theme.ongoing,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ongoingTextCompact: {
    color: theme.ongoingText,
    fontSize: 11,
    fontWeight: '600',
  },
  compactDetails: {
    gap: 6,
  },
  compactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactLabel: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  compactValue: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  peakIntensity: {
    fontWeight: '600',
  },

  // Full card styles (for Episodes list)
  episodeCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  episodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  episodeDate: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
  },
  ongoingBadge: {
    backgroundColor: theme.ongoing,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ongoingText: {
    color: theme.ongoingText,
    fontSize: 12,
    fontWeight: '600',
  },
  episodeDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 15,
    color: theme.textSecondary,
  },
  detailValue: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '500',
  },
  intensityValue: {
    fontWeight: '600',
  },
  notes: {
    marginTop: 12,
    fontSize: 14,
    color: theme.textSecondary,
    fontStyle: 'italic',
  },
});

const EpisodeCard = React.memo(({ episode, onPress, compact = false }: EpisodeCardProps) => {
  const { theme } = useTheme();
  const [locationAddress, setLocationAddress] = useState<string | null>(null);

  const duration = episode.endTime
    ? Math.round((episode.endTime - episode.startTime) / 3600000)
    : null;

  useEffect(() => {
    // Load geocoded location if available
    if (episode.location) {
      locationService
        .reverseGeocode(episode.location.latitude, episode.location.longitude)
        .then(setLocationAddress)
        .catch(() => setLocationAddress(null));
    }
  }, [episode.location]);

  const styles = createStyles(theme);

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.episodeItemCompact}
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel={`Episode from ${format(episode.startTime, 'MMM d, yyyy')}`}
      >
        <View style={styles.compactHeader}>
          <Text style={styles.episodeDateCompact}>
            {format(episode.startTime, 'MMM d, h:mm a')}
          </Text>
          {!episode.endTime && (
            <View style={styles.ongoingBadgeCompact}>
              <Text style={styles.ongoingTextCompact}>Ongoing</Text>
            </View>
          )}
        </View>

        <View style={styles.compactDetails}>
          {locationAddress && (
            <View style={styles.compactRow}>
              <Text style={styles.compactLabel}>Location:</Text>
              <Text style={styles.compactValue} numberOfLines={1}>
                {locationAddress}
              </Text>
            </View>
          )}
          <View style={styles.compactRow}>
            <Text style={styles.compactLabel}>Duration:</Text>
            <Text style={styles.compactValue}>
              {episode.endTime
                ? `${Math.round((episode.endTime - episode.startTime) / 3600000)}h`
                : 'Ongoing'}
            </Text>
          </View>
          {episode.peakIntensity && (
            <View style={styles.compactRow}>
              <Text style={styles.compactLabel}>Peak:</Text>
              <Text style={[styles.compactValue, styles.peakIntensity, { color: getPainColor(episode.peakIntensity) }]}>
                {episode.peakIntensity}/10
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.episodeCard}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`Episode from ${format(episode.startTime, 'EEEE, MMM d, yyyy')}`}
    >
      <View style={styles.episodeHeader}>
        <Text style={styles.episodeDate}>
          {format(episode.startTime, 'EEEE, MMM d · h:mm a')}
        </Text>
        {!episode.endTime && (
          <View style={styles.ongoingBadge}>
            <Text style={styles.ongoingText}>Ongoing</Text>
          </View>
        )}
      </View>

      <View style={styles.episodeDetails}>

        {episode.endTime && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Duration:</Text>
            <Text style={styles.detailValue}>
              {duration} hour{duration === 1 ? '' : 's'}
            </Text>
          </View>
        )}

        {episode.peakIntensity && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Peak Intensity:</Text>
            <Text style={[
              styles.detailValue,
              styles.intensityValue,
              { color: getPainColor(episode.peakIntensity) }
            ]}>
              {episode.peakIntensity}/10 - {getPainLevel(episode.peakIntensity).label}
            </Text>
          </View>
        )}

        {locationAddress && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Location:</Text>
            <Text style={styles.detailValue}>
              {locationAddress}
            </Text>
          </View>
        )}

        {episode.locations.length > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Pain Areas:</Text>
            <Text style={styles.detailValue}>
              {episode.locations.length} area{episode.locations.length === 1 ? '' : 's'}
            </Text>
          </View>
        )}

        {episode.symptoms.length > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Symptoms:</Text>
            <Text style={styles.detailValue}>
              {episode.symptoms.length}
            </Text>
          </View>
        )}
      </View>

      {episode.notes && (
        <Text style={styles.notes} numberOfLines={2}>
          {episode.notes}
        </Text>
      )}
    </TouchableOpacity>
  );
});

EpisodeCard.displayName = 'EpisodeCard';

export default EpisodeCard;
