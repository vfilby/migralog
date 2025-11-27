import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../../utils/logger';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { intensityRepository } from '../../database/episodeRepository';
import { IntensityReading } from '../../models/types';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useTheme, ThemeColors } from '../../theme';
import { getPainColor, getPainLevel } from '../../utils/painScale';

type Props = NativeStackScreenProps<RootStackParamList, 'EditIntensityReading'>;

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
  cancelButton: {
    fontSize: 17,
    color: theme.primary,
    minWidth: 60,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 16,
    color: theme.textSecondary,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeButton: {
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
  },
  timeText: {
    fontSize: 17,
    color: theme.primary,
    fontWeight: '500',
  },
  intensityContainer: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 20,
  },
  intensityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  intensityValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: theme.text,
  },
  intensityLevel: {
    fontSize: 16,
    fontWeight: '600',
  },
  slider: {
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabel: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  quickButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  quickButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: theme.card,
    borderWidth: 2,
    borderColor: theme.border,
    minWidth: 60,
    alignItems: 'center',
  },
  quickButtonActive: {
    borderWidth: 2,
  },
  quickButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  quickButtonTextActive: {
    color: theme.primaryText,
  },
  footer: {
    backgroundColor: theme.card,
    padding: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  saveButton: {
    backgroundColor: theme.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: theme.textTertiary,
  },
  saveButtonText: {
    color: theme.primaryText,
    fontSize: 17,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: theme.danger,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  deleteButtonText: {
    color: theme.dangerText,
    fontSize: 17,
    fontWeight: '600',
  },
});

export default function EditIntensityReadingScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { readingId } = route.params;

  const [reading, setReading] = useState<IntensityReading | null>(null);
  const [timestamp, setTimestamp] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [intensity, setIntensity] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadReading = useCallback(async () => {
    try {
      setLoading(true);
      const loadedReading = await intensityRepository.getById(readingId);

      if (!loadedReading) {
        Alert.alert('Error', 'Intensity reading not found');
        navigation.goBack();
        return;
      }

      setReading(loadedReading);
      setTimestamp(new Date(loadedReading.timestamp));
      setIntensity(loadedReading.intensity);
    } catch (error) {
      logger.error('Failed to load intensity reading:', error);
      Alert.alert('Error', 'Failed to load intensity reading');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [readingId, navigation]);

  useEffect(() => {
    loadReading();
  }, [loadReading]);

  const handleSave = async () => {
    if (!reading || !timestamp) return;

    setSaving(true);
    try {
      await intensityRepository.update(reading.id, {
        timestamp: timestamp.getTime(),
        intensity,
      });

      navigation.goBack();
    } catch (error) {
      logger.error('Failed to update intensity reading:', error);
      Alert.alert('Error', 'Failed to update intensity reading');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!reading) return;

    Alert.alert(
      'Delete Intensity Reading',
      'Are you sure you want to delete this intensity reading?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await intensityRepository.delete(reading.id);
              navigation.goBack();
            } catch (error) {
              logger.error('Failed to delete intensity reading:', error);
              Alert.alert('Error', 'Failed to delete intensity reading');
            }
          },
        },
      ]
    );
  };

  if (loading || !timestamp) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            accessibilityHint="Return to previous screen"
          >
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Intensity</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  const painColor = getPainColor(intensity);
  const painLevel = getPainLevel(intensity);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          accessibilityHint="Discard changes and return to previous screen"
        >
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Intensity</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Time</Text>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowDatePicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`Change time, currently ${format(timestamp, 'MMM d, yyyy h:mm a')}`}
            accessibilityHint="Opens date and time picker"
          >
            <Text style={styles.timeText}>
              {format(timestamp, 'MMM d, yyyy h:mm a')}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={timestamp}
              mode="datetime"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (date) setTimestamp(date);
              }}
            />
          )}
        </View>

        {/* Intensity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pain Intensity</Text>
          <View style={styles.intensityContainer}>
            <View style={styles.intensityHeader}>
              <Text style={styles.intensityValue}>{intensity}</Text>
              <Text style={[styles.intensityLevel, { color: painColor }]}>
                {painLevel.label}
              </Text>
            </View>

            {/* Quick Select Buttons */}
            <View style={styles.quickButtonsContainer}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(value => {
                const isSelected = intensity === value;
                const buttonColor = getPainColor(value);
                return (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.quickButton,
                      isSelected && {
                        ...styles.quickButtonActive,
                        backgroundColor: buttonColor,
                        borderColor: buttonColor,
                      },
                    ]}
                    onPress={() => setIntensity(value)}
                    accessibilityRole="button"
                    accessibilityLabel={`Set pain intensity to ${value}`}
                    accessibilityHint={`Pain level ${value}, ${getPainLevel(value).label}`}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.quickButtonText,
                        isSelected && styles.quickButtonTextActive,
                      ]}
                    >
                      {value}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Save and Delete Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Save changes"
          accessibilityHint="Saves the edited intensity reading and returns to previous screen"
          accessibilityState={{ disabled: saving }}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Delete reading"
          accessibilityHint="Permanently deletes this intensity reading"
          accessibilityState={{ disabled: saving }}
        >
          <Text style={styles.deleteButtonText}>Delete Reading</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
