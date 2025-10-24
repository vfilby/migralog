import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import { Episode, IntensityReading } from '../models/types';
import { getPainColor, getPainLevel } from '../utils/painScale';
import { locationService } from '../services/locationService';
import { useTheme, ThemeColors } from '../theme';
import { intensityRepository } from '../database/episodeRepository';
import IntensitySparkline from './IntensitySparkline';

interface EpisodeCardProps {
  episode: Episode;
  onPress?: () => void;
  compact?: boolean;
  isLast?: boolean;
  testID?: string;
}

/**
 * Format duration in hours to a human-readable string
 * For durations >= 24 hours, shows days and hours (e.g., "1 day, 2 hours")
 * For durations < 24 hours, shows just hours (e.g., "5 hours")
 */
const formatDuration = (hours: number): string => {
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) {
      return `${days} ${days === 1 ? 'day' : 'days'}`;
    }
    return `${days} ${days === 1 ? 'day' : 'days'}, ${remainingHours} ${remainingHours === 1 ? 'hour' : 'hours'}`;
  }
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
};

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  // Compact styles (for Dashboard)
  episodeItemCompact: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  compactFirstRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  compactDate: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
  },
  compactLocation: {
    fontSize: 14,
    color: theme.textSecondary,
    marginLeft: 8,
  },
  compactSecondRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  compactDuration: {
    fontSize: 14,
    color: theme.textSecondary,
    flex: 1,
  },
  compactThirdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactPeakGroup: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  compactPeakText: {
    fontSize: 14,
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
  cardFirstRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardDate: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
  },
  cardLocation: {
    fontSize: 15,
    color: theme.textSecondary,
    marginLeft: 12,
  },
  cardSecondRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardDuration: {
    fontSize: 15,
    color: theme.textSecondary,
    flex: 1,
  },
  cardPeakGroup: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  cardPeakText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cardMetaItem: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  notes: {
    marginTop: 12,
    fontSize: 14,
    color: theme.textSecondary,
    fontStyle: 'italic',
  },
});

const EpisodeCard = React.memo(({ episode, onPress, compact = false, isLast = false, testID }: EpisodeCardProps) => {
  const { theme } = useTheme();
  const [locationAddress, setLocationAddress] = useState<string | null>(null);
  const [intensityReadings, setIntensityReadings] = useState<IntensityReading[]>([]);

  // Calculate duration - either completed duration or elapsed time for ongoing
  const durationHours = episode.endTime
    ? Math.round((episode.endTime - episode.startTime) / 3600000)
    : Math.round((Date.now() - episode.startTime) / 3600000);

  useEffect(() => {
    // Load geocoded location if available
    if (episode.location) {
      locationService
        .reverseGeocode(episode.location.latitude, episode.location.longitude)
        .then(setLocationAddress)
        .catch(() => setLocationAddress(null));
    }
  }, [episode.location]);

  useEffect(() => {
    // Load intensity readings for the episode
    intensityRepository
      .getByEpisodeId(episode.id)
      .then(readings => setIntensityReadings(readings))
      .catch(() => setIntensityReadings([]));
  }, [episode.id]);

  const styles = createStyles(theme);

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.episodeItemCompact, isLast && { borderBottomWidth: 0 }]}
        onPress={onPress}
        disabled={!onPress}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`Episode from ${format(episode.startTime, 'MMM d, yyyy')}`}
      >
        {/* Row 1: Date on left, Location on right */}
        <View style={styles.compactFirstRow}>
          <Text style={styles.compactDate}>
            {format(episode.startTime, 'MMM d, h:mm a')}
          </Text>
          {locationAddress && (
            <Text style={styles.compactLocation} numberOfLines={1}>
              {locationAddress}
            </Text>
          )}
        </View>

        {/* Row 2: Duration on left, Peak + Sparkline on right */}
        <View style={styles.compactSecondRow}>
          <Text style={styles.compactDuration}>
            {formatDuration(durationHours)}
            {!episode.endTime && ' (ongoing)'}
          </Text>
          {episode.peakIntensity && (
            <View style={styles.compactPeakGroup}>
              <Text style={[styles.compactPeakText, { color: getPainColor(episode.peakIntensity) }]}>
                {episode.peakIntensity}
              </Text>
              {intensityReadings.length > 0 && (
                <IntensitySparkline
                  intensities={intensityReadings.map(r => r.intensity)}
                  width={100}
                  height={24}
                />
              )}
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
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Episode from ${format(episode.startTime, 'EEEE, MMM d, yyyy')}`}
    >
      {/* Row 1: Date on left, Location on right */}
      <View style={styles.cardFirstRow}>
        <Text style={styles.cardDate}>
          {format(episode.startTime, 'EEE, MMM d · h:mm a')}
        </Text>
        {locationAddress && (
          <Text style={styles.cardLocation} numberOfLines={1}>
            {locationAddress}
          </Text>
        )}
      </View>

      {/* Row 2: Duration on left, Peak + Sparkline on right */}
      <View style={styles.cardSecondRow}>
        <Text style={styles.cardDuration}>
          {formatDuration(durationHours)}
          {!episode.endTime && ' (ongoing)'}
        </Text>
        {episode.peakIntensity && (
          <View style={styles.cardPeakGroup}>
            <Text style={[styles.cardPeakText, { color: getPainColor(episode.peakIntensity) }]}>
              Peak: {episode.peakIntensity} {getPainLevel(episode.peakIntensity).label}
            </Text>
            {intensityReadings.length > 0 && (
              <IntensitySparkline
                intensities={intensityReadings.map(r => r.intensity)}
                width={120}
                height={40}
              />
            )}
          </View>
        )}
      </View>

      {/* Row 4: Metadata (pain areas, symptoms) */}
      {(episode.locations.length > 0 || episode.symptoms.length > 0) && (
        <View style={styles.cardMetaRow}>
          {episode.locations.length > 0 && (
            <Text style={styles.cardMetaItem}>
              {episode.locations.length} area{episode.locations.length === 1 ? '' : 's'}
            </Text>
          )}
          {episode.symptoms.length > 0 && (
            <Text style={styles.cardMetaItem}>
              {episode.symptoms.length} symptom{episode.symptoms.length === 1 ? '' : 's'}
            </Text>
          )}
        </View>
      )}

      {/* Notes */}
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
