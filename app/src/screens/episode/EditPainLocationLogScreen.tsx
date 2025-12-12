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
import { PainLocationLog, PainLocation } from '../../models/types';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme, ThemeColors } from '../../theme';
import { formatDateTime } from '../../utils/dateFormatting';
import { useEpisodeStore } from '../../store/episodeStore';

type Props = NativeStackScreenProps<RootStackParamList, 'EditPainLocationLog'>;

const PAIN_LOCATIONS: { value: PainLocation; label: string; side: 'left' | 'right' }[] = [
  { value: 'left_eye', label: 'Eye', side: 'left' },
  { value: 'left_temple', label: 'Temple', side: 'left' },
  { value: 'left_neck', label: 'Neck', side: 'left' },
  { value: 'left_head', label: 'Head', side: 'left' },
  { value: 'left_teeth', label: 'Teeth', side: 'left' },
  { value: 'right_eye', label: 'Eye', side: 'right' },
  { value: 'right_temple', label: 'Temple', side: 'right' },
  { value: 'right_neck', label: 'Neck', side: 'right' },
  { value: 'right_head', label: 'Head', side: 'right' },
  { value: 'right_teeth', label: 'Teeth', side: 'right' },
];

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
  locationContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  locationColumn: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
  },
  columnHeader: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  locationButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: theme.borderLight,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  locationButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  locationText: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '500',
    textAlign: 'center',
  },
  locationTextActive: {
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

export default function EditPainLocationLogScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { painLocationLogId } = route.params;

  const { getPainLocationLogById, updatePainLocationLog, deletePainLocationLog } = useEpisodeStore();

  const [painLocationLog, setPainLocationLog] = useState<PainLocationLog | null>(null);
  const [painLocations, setPainLocations] = useState<PainLocation[]>([]);
  const [timestamp, setTimestamp] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadPainLocationLog = useCallback(async () => {
    try {
      setLoading(true);
      const loadedLog = getPainLocationLogById(painLocationLogId);

      if (!loadedLog) {
        Alert.alert('Error', 'Pain location log not found');
        navigation.goBack();
        return;
      }

      setPainLocationLog(loadedLog);
      setPainLocations(loadedLog.painLocations || []);
      setTimestamp(new Date(loadedLog.timestamp));
    } catch (error) {
      logger.error('Failed to load pain location log:', error);
      Alert.alert('Error', 'Failed to load pain location log');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [painLocationLogId, navigation, getPainLocationLogById]);

  useEffect(() => {
    loadPainLocationLog();
  }, [loadPainLocationLog]);

  const toggleLocation = (location: PainLocation) => {
    setPainLocations(current =>
      current.includes(location)
        ? current.filter(l => l !== location)
        : [...current, location]
    );
  };

  const handleSave = async () => {
    if (!painLocationLog || !timestamp) return;

    if (painLocations.length === 0) {
      Alert.alert('No Locations', 'Please select at least one pain location');
      return;
    }

    setSaving(true);
    try {
      await updatePainLocationLog(painLocationLog.id, {
        painLocations,
        timestamp: timestamp.getTime(),
      });

      navigation.goBack();
    } catch (error) {
      logger.error('Failed to update pain location log:', error);
      Alert.alert('Error', 'Failed to update pain location log');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!painLocationLog) return;

    Alert.alert(
      'Delete Pain Location Log',
      'Are you sure you want to delete this pain location log?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePainLocationLog(painLocationLog.id);
              navigation.goBack();
            } catch (error) {
              logger.error('Failed to delete pain location log:', error);
              Alert.alert('Error', 'Failed to delete pain location log');
            }
          },
        },
      ]
    );
  };

  const leftLocations = PAIN_LOCATIONS.filter(l => l.side === 'left');
  const rightLocations = PAIN_LOCATIONS.filter(l => l.side === 'right');

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
          <Text style={styles.title}>Edit Pain Locations</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

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
        <Text style={styles.title}>Edit Pain Locations</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Timestamp */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Time</Text>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowDatePicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`Change time, currently ${formatDateTime(timestamp)}`}
            accessibilityHint="Opens date and time picker"
          >
            <Text style={styles.timeText}>
              {formatDateTime(timestamp)}
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

        {/* Pain Locations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pain Locations</Text>
          <View style={styles.locationContainer}>
            {/* Left Side */}
            <View style={styles.locationColumn}>
              <Text style={styles.columnHeader}>Left Side</Text>
              {leftLocations.map(item => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.locationButton,
                    painLocations.includes(item.value) && styles.locationButtonActive,
                  ]}
                  onPress={() => toggleLocation(item.value)}
                  accessibilityRole="button"
                  accessibilityLabel={`Left ${item.label}`}
                  accessibilityHint={painLocations.includes(item.value) ? `Tap to deselect left ${item.label.toLowerCase()}` : `Tap to select left ${item.label.toLowerCase()}`}
                  accessibilityState={{ selected: painLocations.includes(item.value) }}
                >
                  <Text
                    style={[
                      styles.locationText,
                      painLocations.includes(item.value) && styles.locationTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Right Side */}
            <View style={styles.locationColumn}>
              <Text style={styles.columnHeader}>Right Side</Text>
              {rightLocations.map(item => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.locationButton,
                    painLocations.includes(item.value) && styles.locationButtonActive,
                  ]}
                  onPress={() => toggleLocation(item.value)}
                  accessibilityRole="button"
                  accessibilityLabel={`Right ${item.label}`}
                  accessibilityHint={painLocations.includes(item.value) ? `Tap to deselect right ${item.label.toLowerCase()}` : `Tap to select right ${item.label.toLowerCase()}`}
                  accessibilityState={{ selected: painLocations.includes(item.value) }}
                >
                  <Text
                    style={[
                      styles.locationText,
                      painLocations.includes(item.value) && styles.locationTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Save and Delete Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, (saving || painLocations.length === 0) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving || painLocations.length === 0}
          accessibilityRole="button"
          accessibilityLabel="Save changes"
          accessibilityHint="Saves the edited pain location log and returns to previous screen"
          accessibilityState={{ disabled: saving || painLocations.length === 0 }}
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
          accessibilityLabel="Delete pain location log"
          accessibilityHint="Permanently deletes this pain location log"
          accessibilityState={{ disabled: saving }}
        >
          <Text style={styles.deleteButtonText}>Delete Pain Location Log</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
