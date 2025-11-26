import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { Episode } from '../../models/types';
import { useTheme, ThemeColors } from '../../theme';

interface EpisodeStatusCardProps {
  episode: Episode;
  duration: number; // in minutes
  locationAddress: string | null;
  onOpenMap: () => void;
  onNavigateToLogUpdate: () => void;
  onNavigateToLogMedication: () => void;
}

export const EpisodeStatusCard: React.FC<EpisodeStatusCardProps> = ({
  episode,
  duration,
  locationAddress,
  onOpenMap,
  onNavigateToLogUpdate,
  onNavigateToLogMedication,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      <View style={styles.statusHeader}>
        <Text style={styles.cardTitle}>
          {format(episode.startTime, 'EEEE, MMM d, yyyy')}
        </Text>
        {!episode.endTime && (
          <View style={styles.ongoingBadge}>
            <Text style={styles.ongoingText}>Ongoing</Text>
          </View>
        )}
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Started:</Text>
        <Text style={styles.detailValue}>
          {format(episode.startTime, 'h:mm a')}
        </Text>
      </View>

      {episode.endTime && (
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Ended:</Text>
          <Text style={styles.detailValue}>
            {format(episode.endTime, 'h:mm a')}
          </Text>
        </View>
      )}

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Duration:</Text>
        <Text style={styles.detailValue}>
          {Math.floor(duration / 60)}h {duration % 60}m
        </Text>
      </View>

      {/* Location Link */}
      {episode.location && (
        <TouchableOpacity
          style={styles.detailRow}
          onPress={onOpenMap}
          accessibilityRole="button"
          accessibilityLabel={`Episode location: ${locationAddress || 'View on map'}`}
          accessibilityHint="Opens a map showing where this episode started"
        >
          <Text style={styles.detailLabel}>Location:</Text>
          <Text style={[styles.detailValue, styles.locationLink]}>
            {locationAddress || 'View on Map'} →
          </Text>
        </TouchableOpacity>
      )}

      {/* Action Buttons - Only for ongoing episodes */}
      {!episode.endTime && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onNavigateToLogUpdate}
            testID="log-update-button"
            accessibilityRole="button"
            accessibilityLabel="Log update"
            accessibilityHint="Opens screen to log pain intensity updates, symptoms, or notes"
          >
            <Text style={styles.actionButtonText}>Log Update</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onNavigateToLogMedication}
            testID="log-medication-from-episode-button"
            accessibilityRole="button"
            accessibilityLabel="Log medication"
            accessibilityHint="Opens screen to record medications taken for this episode"
          >
            <Text style={styles.actionButtonText}>Log Medication</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
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
    statusHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      gap: 12,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      flex: 1,
    },
    ongoingBadge: {
      backgroundColor: theme.ongoing,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    ongoingText: {
      color: theme.ongoingText,
      fontSize: 12,
      fontWeight: '600',
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    detailLabel: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    detailValue: {
      fontSize: 14,
      color: theme.text,
      fontWeight: '500',
    },
    locationLink: {
      color: theme.primary,
    },
    actionButtons: {
      flexDirection: 'row',
      marginTop: 16,
      gap: 8,
    },
    actionButton: {
      flex: 1,
      backgroundColor: theme.backgroundSecondary,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
  });
