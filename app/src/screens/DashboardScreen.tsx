import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEpisodeStore } from '../store/episodeStore';
import { useMedicationStore } from '../store/medicationStore';
import { format, differenceInDays } from 'date-fns';
import { MainTabsScreenProps } from '../navigation/types';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { getPainColor, getPainLevel } from '../utils/painScale';
import EpisodeCard from '../components/EpisodeCard';
import { useTheme, ThemeColors } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    backgroundColor: theme.backgroundSecondary,
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: theme.text,
    flex: 1,
  },
  settingsButton: {
    padding: 8,
  },
  card: {
    backgroundColor: theme.card,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    color: theme.text,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '500',
    color: theme.primary,
    marginBottom: 4,
  },
  statusSubtext: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  tapHint: {
    fontSize: 13,
    color: theme.primary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  intensityText: {
    fontSize: 16,
    color: theme.danger,
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
    backgroundColor: theme.primary,
  },
  secondaryButton: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.primary,
  },
  primaryButtonText: {
    color: theme.primaryText,
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: theme.primary,
    fontSize: 17,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  medicationItem: {
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  medicationName: {
    fontSize: 16,
    color: theme.text,
  },
  medicationDosage: {
    fontSize: 14,
    color: theme.textSecondary,
  },
});

export default function DashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
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

  const styles = createStyles(theme);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pain Tracker</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name="settings-outline" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Current Status Card */}
      <TouchableOpacity
        style={styles.card}
        onPress={() => currentEpisode && navigation.navigate('EpisodeDetail', { episodeId: currentEpisode.id })}
        activeOpacity={currentEpisode ? 0.7 : 1}
        disabled={!currentEpisode}
      >
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
            <Text style={styles.tapHint}>Tap to update</Text>
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
      </TouchableOpacity>

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

        {rescueMedications.length > 0 && (
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => {
              navigation.navigate('LogMedication', {
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
              <EpisodeCard
                key={episode.id}
                episode={episode}
                compact
                onPress={() => navigation.navigate('EpisodeDetail', { episodeId: episode.id })}
              />
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
