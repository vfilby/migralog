import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import Slider from '@react-native-community/slider';
import MapView, { Marker } from 'react-native-maps';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useEpisodeStore } from '../store/episodeStore';
import { episodeRepository, intensityRepository, symptomLogRepository } from '../database/episodeRepository';
import { medicationDoseRepository, medicationRepository } from '../database/medicationRepository';
import { Episode, IntensityReading, SymptomLog, MedicationDose, Medication } from '../models/types';
import { format, differenceInMinutes } from 'date-fns';
import { getPainColor, getPainLevel } from '../utils/painScale';
import { locationService } from '../services/locationService';
import { useTheme, ThemeColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EpisodeDetail'>;

type MedicationDoseWithDetails = MedicationDose & {
  medication?: Medication;
};

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    backgroundColor: theme.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
  },
  backButton: {
    fontSize: 17,
    color: theme.primary,
    width: 60,
  },
  editButton: {
    fontSize: 17,
    color: theme.primary,
    fontWeight: '600',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: theme.textSecondary,
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: theme.card,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: theme.shadow,
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
    color: theme.text,
    marginBottom: 12,
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
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
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
  locationLink: {
    color: theme.primary,
    fontWeight: '600',
  },
  intensityValue: {
    color: theme.danger,
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
    color: theme.textSecondary,
    width: 70,
  },
  timelineBar: {
    flex: 1,
    height: 24,
    backgroundColor: theme.borderLight,
    borderRadius: 12,
    overflow: 'hidden',
  },
  timelineBarFill: {
    height: '100%',
    backgroundColor: theme.primary,
  },
  timelineIntensity: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
    width: 30,
    textAlign: 'right',
  },
  intensityUpdateSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
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
    backgroundColor: theme.borderLight,
  },
  chipText: {
    fontSize: 14,
    color: theme.text,
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
    color: theme.textSecondary,
    marginBottom: 8,
  },
  locationItem: {
    fontSize: 15,
    color: theme.text,
    marginBottom: 4,
  },
  medicationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '500',
    marginBottom: 2,
  },
  medicationTime: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  medicationAmount: {
    fontSize: 15,
    color: theme.primary,
    fontWeight: '500',
  },
  notesText: {
    fontSize: 15,
    color: theme.text,
    lineHeight: 22,
  },
  updateButton: {
    backgroundColor: theme.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  updateButtonText: {
    color: theme.primaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  intensityLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
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
    color: theme.textSecondary,
  },
  painDescription: {
    marginTop: 12,
    fontSize: 15,
    color: theme.textSecondary,
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
    color: theme.primary,
    fontSize: 15,
    fontWeight: '500',
  },
  saveIntensityButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.primary,
    alignItems: 'center',
  },
  saveIntensityButtonText: {
    color: theme.primaryText,
    fontSize: 17,
    fontWeight: '600',
  },
  footer: {
    backgroundColor: theme.card,
    padding: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  endButton: {
    backgroundColor: theme.danger,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  endButtonText: {
    color: theme.dangerText,
    fontSize: 17,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.background,
  },
  modalHeader: {
    backgroundColor: theme.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
  },
  modalCloseButton: {
    fontSize: 17,
    color: theme.primary,
    fontWeight: '600',
  },
  modalMap: {
    flex: 1,
  },
  modalInfo: {
    backgroundColor: theme.card,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  modalLocationText: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalAccuracyText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },
});

export default function EpisodeDetailScreen({ route, navigation }: Props) {
  const { episodeId } = route.params;
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { endEpisode, addIntensityReading } = useEpisodeStore();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [intensityReadings, setIntensityReadings] = useState<IntensityReading[]>([]);
  const [symptomLogs, setSymptomLogs] = useState<SymptomLog[]>([]);
  const [medications, setMedications] = useState<MedicationDoseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIntensity, setCurrentIntensity] = useState(3);
  const [showIntensityUpdate, setShowIntensityUpdate] = useState(false);
  const [locationAddress, setLocationAddress] = useState<string | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);

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

      // Reverse geocode location if available
      if (ep?.location) {
        const address = await locationService.reverseGeocode(
          ep.location.latitude,
          ep.location.longitude
        );
        setLocationAddress(address);
      }
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

  const handleOpenMap = () => {
    setShowMapModal(true);
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

          {/* Location Link */}
          {episode.location && (
            <TouchableOpacity style={styles.detailRow} onPress={handleOpenMap}>
              <Text style={styles.detailLabel}>Location:</Text>
              <Text style={[styles.detailValue, styles.locationLink]}>
                {locationAddress || 'View on Map'} →
              </Text>
            </TouchableOpacity>
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

      {/* Map Modal */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMapModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ width: 60 }} />
            <Text style={styles.modalTitle}>Episode Location</Text>
            <TouchableOpacity onPress={() => setShowMapModal(false)}>
              <Text style={styles.modalCloseButton}>Done</Text>
            </TouchableOpacity>
          </View>

          {episode.location && (
            <MapView
              style={styles.modalMap}
              initialRegion={{
                latitude: episode.location.latitude,
                longitude: episode.location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Marker
                coordinate={{
                  latitude: episode.location.latitude,
                  longitude: episode.location.longitude,
                }}
                title="Episode Started Here"
                description={locationAddress || format(episode.startTime, 'MMM d, yyyy h:mm a')}
              />
            </MapView>
          )}

          <View style={styles.modalInfo}>
            {locationAddress && (
              <Text style={styles.modalLocationText}>{locationAddress}</Text>
            )}
            {episode.location?.accuracy && (
              <Text style={styles.modalAccuracyText}>
                Accuracy: ±{Math.round(episode.location.accuracy)}m
              </Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

