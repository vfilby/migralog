import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useEpisodeStore } from '../store/episodeStore';
import { format } from 'date-fns';
import { Episode } from '../models/types';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function EpisodesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { episodes, loadEpisodes, loading } = useEpisodeStore();

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadEpisodes();
    });
    return unsubscribe;
  }, [navigation]);

  const renderEpisode = ({ item }: { item: Episode }) => {
    const duration = item.endTime
      ? Math.round((item.endTime - item.startTime) / 3600000)
      : null;

    return (
      <TouchableOpacity
        style={styles.episodeCard}
        onPress={() => navigation.navigate('EpisodeDetail', { episodeId: item.id })}
      >
        <View style={styles.episodeHeader}>
          <Text style={styles.episodeDate}>
            {format(item.startTime, 'EEEE, MMM d, yyyy')}
          </Text>
          {!item.endTime && (
            <View style={styles.ongoingBadge}>
              <Text style={styles.ongoingText}>Ongoing</Text>
            </View>
          )}
        </View>

        <View style={styles.episodeDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Started:</Text>
            <Text style={styles.detailValue}>
              {format(item.startTime, 'h:mm a')}
            </Text>
          </View>

          {item.endTime && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Duration:</Text>
              <Text style={styles.detailValue}>
                {duration} hour{duration === 1 ? '' : 's'}
              </Text>
            </View>
          )}

          {item.peakIntensity && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Peak Intensity:</Text>
              <Text style={[
                styles.detailValue,
                styles.intensityValue,
                { color: getIntensityColor(item.peakIntensity) }
              ]}>
                {item.peakIntensity}/10
              </Text>
            </View>
          )}

          {item.locations.length > 0 && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Locations:</Text>
              <Text style={styles.detailValue}>
                {item.locations.length} area{item.locations.length === 1 ? '' : 's'}
              </Text>
            </View>
          )}

          {item.symptoms.length > 0 && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Symptoms:</Text>
              <Text style={styles.detailValue}>
                {item.symptoms.length}
              </Text>
            </View>
          )}
        </View>

        {item.notes && (
          <Text style={styles.notes} numberOfLines={2}>
            {item.notes}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Episodes</Text>
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Loading...</Text>
      ) : episodes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No episodes recorded yet</Text>
          <Text style={styles.emptySubtext}>
            Start tracking your pain episodes from the Home tab
          </Text>
        </View>
      ) : (
        <FlatList
          data={episodes}
          renderItem={renderEpisode}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

function getIntensityColor(intensity: number): string {
  if (intensity <= 3) return '#34C759'; // Green
  if (intensity <= 6) return '#FF9500'; // Orange
  return '#FF3B30'; // Red
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#000',
  },
  listContent: {
    padding: 16,
  },
  episodeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
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
    color: '#000',
  },
  ongoingBadge: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ongoingText: {
    color: '#fff',
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
    color: '#8E8E93',
  },
  detailValue: {
    fontSize: 15,
    color: '#000',
    fontWeight: '500',
  },
  intensityValue: {
    fontWeight: '600',
  },
  notes: {
    marginTop: 12,
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: '#8E8E93',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#C7C7CC',
    textAlign: 'center',
  },
});
