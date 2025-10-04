import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useEpisodeStore } from '../store/episodeStore';
import { episodeRepository, intensityRepository, symptomLogRepository } from '../database/episodeRepository';
import { medicationDoseRepository, medicationRepository } from '../database/medicationRepository';
import { Episode, IntensityReading, SymptomLog, MedicationDose, Medication } from '../models/types';
import { format, differenceInMinutes } from 'date-fns';
import { getPainColor, getPainLevel } from '../utils/painScale';

type Props = NativeStackScreenProps<RootStackParamList, 'EpisodeDetail'>;

type MedicationDoseWithDetails = MedicationDose & {
  medication?: Medication;
};

export default function EpisodeDetailScreen({ route, navigation }: Props) {
  const { episodeId } = route.params;
  const { endEpisode, addIntensityReading } = useEpisodeStore();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [intensityReadings, setIntensityReadings] = useState<IntensityReading[]>([]);
  const [symptomLogs, setSymptomLogs] = useState<SymptomLog[]>([]);
  const [medications, setMedications] = useState<MedicationDoseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIntensity, setCurrentIntensity] = useState(3);
  const [showIntensityUpdate, setShowIntensityUpdate] = useState(false);

  useEffect(() => {
    loadEpisodeData();
  }, [episodeId]);

  const loadEpisodeData = async () => {
    try {
      const [ep, readings, symptoms, meds] = await Promise.all([
        episodeRepository.getById(episodeId),
        intensityRepository.getByEpisodeId(episodeId),
        symptomLogRepository.getByEpisodeId(episodeId),
        medicationDoseRepository.getByEpisodeId(episodeId),
      ]);

      // Load medication details for each dose
      const medsWithDetails = await Promise.all(
        meds.map(async (dose) => {
          const medication = await medicationRepository.getById(dose.medicationId);
          return { ...dose, medication };
        })
      );

      setEpisode(ep);
      setIntensityReadings(readings);
      setSymptomLogs(symptoms);
      setMedications(medsWithDetails);
    } catch (error) {
      console.error('Failed to load episode:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEndEpisode = async () => {
    if (episode && !episode.endTime) {
      await endEpisode(episode.id, Date.now());
      navigation.goBack();
    }
  };

  const handleLogIntensity = async () => {
    if (episode && !episode.endTime) {
      await addIntensityReading(episode.id, currentIntensity);
      await loadEpisodeData();
      setShowIntensityUpdate(false);
    }
  };

  if (loading || !episode) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Episode</Text>
          <View style={{ width: 60 }} />
        </View>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const duration = episode.endTime
    ? differenceInMinutes(episode.endTime, episode.startTime)
    : differenceInMinutes(Date.now(), episode.startTime);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Episode Details</Text>
        <TouchableOpacity onPress={() => {/* TODO: Navigate to edit screen */}}>
          <Text style={styles.editButton}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Status Card */}
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

          {episode.peakIntensity !== undefined && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Peak Intensity:</Text>
              <Text style={[styles.detailValue, { color: getPainColor(episode.peakIntensity), fontWeight: '600' }]}>
                {episode.peakIntensity}/10 - {getPainLevel(episode.peakIntensity).label}
              </Text>
            </View>
          )}

          {episode.averageIntensity !== undefined && episode.averageIntensity !== null && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Average Intensity:</Text>
              <Text style={[styles.detailValue, { color: getPainColor(episode.averageIntensity), fontWeight: '600' }]}>
                {episode.averageIntensity.toFixed(1)}/10 - {getPainLevel(episode.averageIntensity).label}
              </Text>
            </View>
          )}
        </View>

        {/* Intensity Timeline */}
        {intensityReadings.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Intensity Timeline</Text>
            {intensityReadings.map((reading, index) => (
              <View key={reading.id} style={styles.timelineItem}>
                <Text style={styles.timelineTime}>
                  {format(reading.timestamp, 'h:mm a')}
                </Text>
                <View style={styles.timelineBar}>
                  <View
                    style={[
                      styles.timelineBarFill,
                      {
                        width: `${(reading.intensity / 10) * 100}%`,
                        backgroundColor: getPainColor(reading.intensity),
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.timelineIntensity, { color: getPainColor(reading.intensity) }]}>
                  {reading.intensity}
                </Text>
              </View>
            ))}

            {/* Log Current Intensity - Only for ongoing episodes */}
            {!episode.endTime && (
              <View style={styles.intensityUpdateSection}>
                {!showIntensityUpdate ? (
                  <TouchableOpacity
                    style={styles.updateButton}
                    onPress={() => setShowIntensityUpdate(true)}
                  >
                    <Text style={styles.updateButtonText}>Log Current Intensity</Text>
                  </TouchableOpacity>
                ) : (
                  <View>
                    <View style={styles.sliderHeader}>
                      <Text style={[styles.intensityValue, { color: getPainLevel(currentIntensity).color }]}>
                        {currentIntensity}/10
                      </Text>
                      <Text style={styles.intensityLabel}>
                        {getPainLevel(currentIntensity).label}
                      </Text>
                    </View>
                    <Slider
                      style={styles.slider}
                      minimumValue={0}
                      maximumValue={10}
                      step={1}
                      value={currentIntensity}
                      onValueChange={setCurrentIntensity}
                      minimumTrackTintColor={getPainLevel(currentIntensity).color}
                      maximumTrackTintColor="#E5E5EA"
                      thumbTintColor={getPainLevel(currentIntensity).color}
                    />
                    <View style={styles.sliderLabels}>
                      <Text style={styles.sliderLabelText}>0 - No Pain</Text>
                      <Text style={styles.sliderLabelText}>10 - Debilitating</Text>
                    </View>
                    <Text style={styles.painDescription}>
                      {getPainLevel(currentIntensity).description}
                    </Text>
                    <View style={styles.updateActions}>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => setShowIntensityUpdate(false)}
                      >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.saveIntensityButton}
                        onPress={handleLogIntensity}
                      >
                        <Text style={styles.saveIntensityButtonText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Pain Locations */}
        {episode.locations.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pain Locations</Text>
            <View style={styles.locationGrid}>
              <View style={styles.locationSide}>
                <Text style={styles.locationSideLabel}>Left Side</Text>
                {episode.locations
                  .filter(loc => loc.startsWith('left_'))
                  .map(location => (
                    <Text key={location} style={styles.locationItem}>
                      • {location.replace('left_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Text>
                  ))}
              </View>
              <View style={styles.locationSide}>
                <Text style={styles.locationSideLabel}>Right Side</Text>
                {episode.locations
                  .filter(loc => loc.startsWith('right_'))
                  .map(location => (
                    <Text key={location} style={styles.locationItem}>
                      • {location.replace('right_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Text>
                  ))}
              </View>
            </View>
          </View>
        )}

        {/* Pain Qualities */}
        {episode.qualities.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pain Quality</Text>
            <View style={styles.chipContainer}>
              {episode.qualities.map(quality => (
                <View key={quality} style={styles.chip}>
                  <Text style={styles.chipText}>
                    {quality.charAt(0).toUpperCase() + quality.slice(1)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Symptoms */}
        {episode.symptoms.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Symptoms</Text>
            <View style={styles.chipContainer}>
              {episode.symptoms.map(symptom => (
                <View key={symptom} style={styles.chip}>
                  <Text style={styles.chipText}>
                    {symptom.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Triggers */}
        {episode.triggers.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Possible Triggers</Text>
            <View style={styles.chipContainer}>
              {episode.triggers.map(trigger => (
                <View key={trigger} style={styles.chip}>
                  <Text style={styles.chipText}>
                    {trigger.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Medications Taken */}
        {medications.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Medications Taken</Text>
            {medications.map(dose => (
              <View key={dose.id} style={styles.medicationItem}>
                <View style={styles.medicationInfo}>
                  <Text style={styles.medicationName}>
                    {dose.medication?.name || 'Unknown Medication'}
                  </Text>
                  <Text style={styles.medicationTime}>
                    {format(dose.timestamp, 'h:mm a')}
                  </Text>
                </View>
                <Text style={styles.medicationAmount}>
                  {dose.amount} × {dose.medication?.dosageAmount}{dose.medication?.dosageUnit}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Notes */}
        {episode.notes && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notes</Text>
            <Text style={styles.notesText}>{episode.notes}</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* End Episode Button */}
      {!episode.endTime && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.endButton} onPress={handleEndEpisode}>
            <Text style={styles.endButtonText}>End Episode</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  backButton: {
    fontSize: 17,
    color: '#007AFF',
    width: 60,
  },
  editButton: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '600',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: '#8E8E93',
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
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
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
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
    color: '#FF3B30',
    fontWeight: '600',
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  timelineTime: {
    fontSize: 13,
    color: '#8E8E93',
    width: 70,
  },
  timelineBar: {
    flex: 1,
    height: 24,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    overflow: 'hidden',
  },
  timelineBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  timelineIntensity: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    width: 30,
    textAlign: 'right',
  },
  intensityUpdateSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
  },
  chipText: {
    fontSize: 14,
    color: '#000',
  },
  locationGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  locationSide: {
    flex: 1,
  },
  locationSideLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
  },
  locationItem: {
    fontSize: 15,
    color: '#000',
    marginBottom: 4,
  },
  medicationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
    marginBottom: 2,
  },
  medicationTime: {
    fontSize: 14,
    color: '#8E8E93',
  },
  medicationAmount: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '500',
  },
  notesText: {
    fontSize: 15,
    color: '#000',
    lineHeight: 22,
  },
  updateButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  intensityValue: {
    fontSize: 34,
    fontWeight: 'bold',
  },
  intensityLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabelText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  painDescription: {
    marginTop: 12,
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
  },
  updateActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '500',
  },
  saveIntensityButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  saveIntensityButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  endButton: {
    backgroundColor: '#FF3B30',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  endButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
