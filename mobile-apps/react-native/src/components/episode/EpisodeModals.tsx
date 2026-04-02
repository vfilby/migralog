import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Episode } from '../../models/types';
import { useTheme, ThemeColors } from '../../theme';
import { formatDateTime } from '../../utils/dateFormatting';

interface EpisodeModalsProps {
  showMapModal: boolean;
  showEndTimePicker: boolean;
  episode: Episode;
  locationAddress: string | null;
  customEndTime: number;
  onCloseMapModal: () => void;
  onCloseEndTimePicker: () => void;
  onCustomTimeChange: (time: number) => void;
  onCustomTimeAction: () => void;
}

export const EpisodeModals: React.FC<EpisodeModalsProps> = ({
  showMapModal,
  showEndTimePicker,
  episode,
  locationAddress,
  customEndTime,
  onCloseMapModal,
  onCloseEndTimePicker,
  onCustomTimeChange,
  onCustomTimeAction,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <>
      {/* Map Modal */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onCloseMapModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderSpacer} />
            <Text style={styles.modalTitle}>Episode Location</Text>
            <TouchableOpacity
              onPress={onCloseMapModal}
              accessibilityRole="button"
              accessibilityLabel="Done"
              accessibilityHint="Closes the map and returns to episode details"
            >
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
                description={locationAddress || formatDateTime(episode.startTime)}
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

      {/* End Time Picker Modal */}
      <Modal
        visible={showEndTimePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onCloseEndTimePicker}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={onCloseEndTimePicker}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              accessibilityHint={
                episode.endTime
                  ? 'Closes the time picker without changing the end time'
                  : 'Closes the time picker without ending the episode'
              }
            >
              <Text style={styles.modalCloseButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {episode.endTime ? 'Edit End Time' : 'Set End Time'}
            </Text>
            <TouchableOpacity
              onPress={onCustomTimeAction}
              accessibilityRole="button"
              accessibilityLabel="Done"
              accessibilityHint={
                episode.endTime
                  ? 'Updates the episode end time'
                  : 'Ends the episode with the selected time'
              }
            >
              <Text style={styles.modalCloseButton}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.datePickerContainer}>
            <DateTimePicker
              value={customEndTime && customEndTime > 0 ? new Date(customEndTime) : new Date()}
              mode="datetime"
              display="spinner"
              onChange={(_event, selectedDate) => {
                if (selectedDate) {
                  onCustomTimeChange(selectedDate.getTime());
                }
              }}
              maximumDate={new Date()}
              minimumDate={new Date(episode.startTime)}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    modalContainer: {
      flex: 1,
      backgroundColor: theme.background,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.card,
    },
    modalHeaderSpacer: {
      width: 60,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.text,
    },
    modalCloseButton: {
      fontSize: 17,
      color: theme.primary,
      fontWeight: '500',
    },
    modalMap: {
      flex: 1,
    },
    modalInfo: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.card,
    },
    modalLocationText: {
      fontSize: 16,
      color: theme.text,
      marginBottom: 4,
    },
    modalAccuracyText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    datePickerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
  });
