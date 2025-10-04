import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useEpisodeStore } from '../store/episodeStore';
import { useMedicationStore } from '../store/medicationStore';
import { format, differenceInDays } from 'date-fns';
import { MainTabsScreenProps } from '../navigation/types';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { getPainColor, getPainLevel } from '../utils/painScale';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { currentEpisode, episodes, loadCurrentEpisode, loadEpisodes } = useEpisodeStore();
  const { preventativeMedications, rescueMedications, loadMedications } = useMedicationStore();

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadCurrentEpisode();
      loadEpisodes();
      loadMedications();
    });
    return unsubscribe;
  }, [navigation]);

  const lastEpisode = episodes.find(ep => ep.endTime);
  const daysSinceLastEpisode = lastEpisode
    ? differenceInDays(Date.now(), lastEpisode.endTime!)
    : null;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pain Tracker</Text>
      </View>

      {/* Current Status Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current Status</Text>
        {currentEpisode ? (
          <View>
            <Text style={styles.statusText}>Episode In Progress</Text>
            <Text style={styles.statusSubtext}>
              Started {format(currentEpisode.startTime, 'MMM d, h:mm a')}
            </Text>
            {currentEpisode.peakIntensity && (
              <Text style={[styles.intensityText, { color: getPainColor(currentEpisode.peakIntensity) }]}>
                Peak Intensity: {currentEpisode.peakIntensity}/10 - {getPainLevel(currentEpisode.peakIntensity).label}
              </Text>
            )}
          </View>
        ) : (
          <View>
            <Text style={styles.statusText}>No Active Episode</Text>
            {daysSinceLastEpisode !== null && (
              <Text style={styles.statusSubtext}>
                {daysSinceLastEpisode === 0
                  ? 'Last episode today'
                  : `${daysSinceLastEpisode} day${daysSinceLastEpisode === 1 ? '' : 's'} since last episode`}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        {!currentEpisode && (
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={() => navigation.navigate('NewEpisode')}
          >
            <Text style={styles.primaryButtonText}>Start Episode</Text>
          </TouchableOpacity>
        )}

        {currentEpisode && (
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => navigation.navigate('EpisodeDetail', { episodeId: currentEpisode.id })}
          >
            <Text style={styles.secondaryButtonText}>Update Episode</Text>
          </TouchableOpacity>
        )}

        {rescueMedications.length > 0 && (
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => {
              const firstMed = rescueMedications[0];
              navigation.navigate('LogMedication', {
                medicationId: firstMed.id,
                episodeId: currentEpisode?.id
              });
            }}
          >
            <Text style={styles.secondaryButtonText}>Log Medication</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Recent Episodes Summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Episodes</Text>
        {episodes.length === 0 ? (
          <Text style={styles.emptyText}>No episodes recorded yet</Text>
        ) : (
          <View>
            {episodes.slice(0, 3).map(episode => (
              <View key={episode.id} style={styles.episodeItem}>
                <Text style={styles.episodeDate}>
                  {format(episode.startTime, 'MMM d, yyyy')}
                </Text>
                <Text style={styles.episodeDetails}>
                  Duration: {episode.endTime
                    ? `${Math.round((episode.endTime - episode.startTime) / 3600000)}h`
                    : 'Ongoing'}
                </Text>
                {episode.peakIntensity && (
                  <Text style={styles.episodeDetails}>
                    Peak: {episode.peakIntensity}/10
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Active Medications */}
      {preventativeMedications.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Active Preventative Medications</Text>
          {preventativeMedications.map(med => (
            <View key={med.id} style={styles.medicationItem}>
              <Text style={styles.medicationName}>{med.name}</Text>
              <Text style={styles.medicationDosage}>
                {med.dosageAmount}{med.dosageUnit}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
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
  card: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    color: '#000',
  },
  statusText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#007AFF',
    marginBottom: 4,
  },
  statusSubtext: {
    fontSize: 14,
    color: '#8E8E93',
  },
  intensityText: {
    fontSize: 16,
    color: '#FF3B30',
    marginTop: 8,
    fontWeight: '500',
  },
  actionsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  actionButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 20,
  },
  episodeItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  episodeDate: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  episodeDetails: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  medicationItem: {
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  medicationName: {
    fontSize: 16,
    color: '#000',
  },
  medicationDosage: {
    fontSize: 14,
    color: '#8E8E93',
  },
});
