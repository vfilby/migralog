import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import { Episode } from '../../models/types';
import { locationService } from '../../services/locationService';
import { useTheme, ThemeColors } from '../../theme';
import { useEpisodeStore } from '../../store/episodeStore';
import IntensitySparkline from '../analytics/IntensitySparkline';
import { formatDurationLong } from '../../utils/dateFormatting';
import { getTimeFormatString } from '../../utils/localeUtils';

interface EpisodeCardProps {
  episode: Episode;
  onPress?: () => void;
  compact?: boolean;
  isLast?: boolean;
  testID?: string;
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  // Compact styles (for Dashboard Recent Episodes)
  episodeItemCompact: {
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },

  // Full card styles (for Episodes list and Episode Detail)
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
    flexWrap: 'wrap',
    marginBottom: 8,
    gap: 8,
    minHeight: 28,
  },
  cardDate: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
    flexShrink: 1,
  },
  cardSecondRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    marginBottom: 4,
    gap: 8,
    minHeight: 24,
  },
  cardDuration: {
    fontSize: 15,
    color: theme.textSecondary,
    flexShrink: 1,
    flexGrow: 1,
  },
  cardSparklineContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardLocation: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 8,
    flexShrink: 1,
  },
  cardMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  cardMetaItem: {
    fontSize: 14,
    color: theme.textSecondary,
    flexShrink: 1,
  },
  notes: {
    marginTop: 12,
    fontSize: 14,
    color: theme.textSecondary,
    fontStyle: 'italic',
  },
  ongoingBadge: {
    backgroundColor: theme.ongoing,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexShrink: 0,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ongoingText: {
    color: theme.ongoingText,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

const EpisodeCard = React.memo(({ episode, onPress, compact = false, isLast = false, testID }: EpisodeCardProps) => {
  const { theme } = useTheme();
  const [locationAddress, setLocationAddress] = useState<string | null>(null);
  
  // Use episode store to get intensity readings
  const { intensityReadings: storeIntensityReadings } = useEpisodeStore();
  
  // Filter intensity readings for this episode
  const intensityReadings = storeIntensityReadings.filter(r => r.episodeId === episode.id);

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

  const styles = createStyles(theme);

  return (
    <TouchableOpacity
      style={[
        compact ? styles.episodeItemCompact : styles.episodeCard,
        compact && isLast && { borderBottomWidth: 0 }
      ]}
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Episode from ${format(episode.startTime, 'EEEE, MMM d, yyyy')}`}
    >
      {/* Row 1: Date and Ongoing badge */}
      <View style={[styles.cardFirstRow, !locationAddress && { marginBottom: 4 }]}>
        <Text style={styles.cardDate}>
          {format(episode.startTime, `EEE, MMM d · ${getTimeFormatString()}`)}
        </Text>
        {!episode.endTime && (
          <View style={styles.ongoingBadge}>
            <Text style={styles.ongoingText}>Ongoing</Text>
          </View>
        )}
      </View>

      {/* Row 2: Location if available */}
      {locationAddress && (
        <Text style={styles.cardLocation}>
          {locationAddress}
        </Text>
      )}

      {/* Row 3: Duration on left, Sparkline on right */}
      <View style={styles.cardSecondRow}>
        <Text style={styles.cardDuration}>
          {formatDurationLong(durationHours)}
        </Text>
        {intensityReadings.length > 0 && (
          <View style={styles.cardSparklineContainer}>
            <IntensitySparkline
              readings={intensityReadings}
              episodeEndTime={episode.endTime}
              width={120}
              height={50}
            />
          </View>
        )}
      </View>

      {/* Row 4: Metadata (pain areas, symptoms) - hidden in compact mode */}
      {!compact && (episode.locations.length > 0 || episode.symptoms.length > 0) && (
        <View style={styles.cardMetaRow}>
          {episode.locations.length > 0 && (
            <Text style={styles.cardMetaItem}>
              {episode.locations.length} area{episode.locations.length === 1 ? '' : 's'}
            </Text>
          )}
          {episode.symptoms.length > 0 && (
            <Text style={styles.cardMetaItem}>
              {episode.symptoms.length === 1 ? '1 symptom' : `${episode.symptoms.length} symptoms`}
            </Text>
          )}
        </View>
      )}

      {/* Notes - hidden in compact mode */}
      {!compact && episode.notes && (
        <Text style={styles.notes} numberOfLines={2}>
          {episode.notes}
        </Text>
      )}
    </TouchableOpacity>
  );
});

EpisodeCard.displayName = 'EpisodeCard';

export default EpisodeCard;
