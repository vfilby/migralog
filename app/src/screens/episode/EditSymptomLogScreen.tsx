import React, { useState, useEffect } from 'react';
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
import { SymptomLog, Symptom } from '../../models/types';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme, ThemeColors } from '../../theme';
import { formatDateTime } from '../../utils/dateFormatting';
import { useEpisodeStore } from '../../store/episodeStore';

type Props = NativeStackScreenProps<RootStackParamList, 'EditSymptomLog'>;

const SYMPTOMS: { value: Symptom; label: string }[] = [
  { value: 'nausea', label: 'Nausea' },
  { value: 'vomiting', label: 'Vomiting' },
  { value: 'visual_disturbances', label: 'Visual Disturbances' },
  { value: 'aura', label: 'Aura' },
  { value: 'light_sensitivity', label: 'Light Sensitivity' },
  { value: 'sound_sensitivity', label: 'Sound Sensitivity' },
  { value: 'smell_sensitivity', label: 'Smell Sensitivity' },
  { value: 'dizziness', label: 'Dizziness' },
  { value: 'confusion', label: 'Confusion' },
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
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  chipText: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '500',
  },
  chipTextActive: {
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

export default function EditSymptomLogScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { symptomLogId } = route.params;

  const {
    getSymptomLogById,
    updateSymptomLog,
    deleteSymptomLog,
    addSymptomLog,
    symptomLogs: allSymptomLogs
  } = useEpisodeStore();

  const [primaryLog, setPrimaryLog] = useState<SymptomLog | null>(null);
  const [originalSymptoms, setOriginalSymptoms] = useState<Set<Symptom>>(new Set());
  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<Symptom>>(new Set());
  const [timestamp, setTimestamp] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Map of symptom -> log ID for existing logs at this timestamp
  const [symptomToLogId, setSymptomToLogId] = useState<Map<Symptom, string>>(new Map());

  // Load symptom logs only once on mount
  useEffect(() => {
    const loadSymptomLogs = async () => {
      try {
        setLoading(true);
        const loadedLog = getSymptomLogById(symptomLogId);

        if (!loadedLog) {
          Alert.alert('Error', 'Symptom log not found');
          navigation.goBack();
          return;
        }

        setPrimaryLog(loadedLog);
        setTimestamp(new Date(loadedLog.onsetTime));

        // Get all symptom logs for this episode
        const currentSymptomLogs = allSymptomLogs || [];
        const episodeLogs = currentSymptomLogs.filter(log =>
          log.episodeId === loadedLog.episodeId
        );

        // Sort by timestamp to compute cumulative state
        const sortedLogs = [...episodeLogs].sort((a, b) => a.onsetTime - b.onsetTime);

        // Compute the complete symptom state at this timestamp
        // by processing all logs up to and including this timestamp
        const activeSymptoms = new Set<Symptom>();
        const logsAtTimestamp: typeof sortedLogs = [];

        sortedLogs.forEach(log => {
          if (log.onsetTime < loadedLog.onsetTime) {
            // Earlier log - update cumulative state
            const isAdded = log.resolutionTime === null || log.resolutionTime === undefined;
            if (isAdded) {
              activeSymptoms.add(log.symptom);
            } else {
              activeSymptoms.delete(log.symptom);
            }
          } else if (log.onsetTime === loadedLog.onsetTime) {
            // Log at current timestamp
            logsAtTimestamp.push(log);
            const isAdded = log.resolutionTime === null || log.resolutionTime === undefined;
            if (isAdded) {
              activeSymptoms.add(log.symptom);
            } else {
              activeSymptoms.delete(log.symptom);
            }
          }
          // Ignore logs after this timestamp
        });

        // Build map of symptoms with logs at this timestamp
        const logIdMap = new Map<Symptom, string>();
        logsAtTimestamp.forEach(log => {
          logIdMap.set(log.symptom, log.id);
        });

        // The selected symptoms should be all ACTIVE symptoms at this point
        // (including unchanged ones from earlier timestamps)
        setOriginalSymptoms(new Set(activeSymptoms));
        setSelectedSymptoms(new Set(activeSymptoms));
        setSymptomToLogId(logIdMap);
      } catch (error) {
        logger.error('Failed to load symptom log:', error);
        Alert.alert('Error', 'Failed to load symptom log');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    loadSymptomLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symptomLogId]); // Only load on mount or when symptomLogId changes

  const toggleSymptom = (symptom: Symptom) => {
    setSelectedSymptoms(current => {
      const newSet = new Set(current);
      if (newSet.has(symptom)) {
        newSet.delete(symptom);
      } else {
        newSet.add(symptom);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!primaryLog || !timestamp) return;

    // All symptoms deselected means all become "removed" events - that's valid
    setSaving(true);
    try {
      const newTimestamp = timestamp.getTime();
      const promises: Promise<void>[] = [];

      // Handle deselected symptoms (were active, now not selected)
      originalSymptoms.forEach(symptom => {
        if (!selectedSymptoms.has(symptom)) {
          const logId = symptomToLogId.get(symptom);
          if (logId) {
            // Has a log at this timestamp - convert to removal event
            promises.push(updateSymptomLog(logId, {
              onsetTime: newTimestamp,
              resolutionTime: newTimestamp + 1, // Mark as "removed" event
            }));
          } else {
            // Was active from earlier (no log at this timestamp) - create new removal log
            promises.push(addSymptomLog({
              episodeId: primaryLog.episodeId,
              symptom,
              onsetTime: newTimestamp,
              resolutionTime: newTimestamp + 1, // Mark as "removed" event
            }));
          }
        }
      });

      // Handle symptoms that have logs at this timestamp and remain selected
      // Update them to ensure they're "added" events
      originalSymptoms.forEach(symptom => {
        if (selectedSymptoms.has(symptom)) {
          const logId = symptomToLogId.get(symptom);
          if (logId) {
            // Has a log at this timestamp - ensure it's an added event
            promises.push(updateSymptomLog(logId, {
              onsetTime: newTimestamp,
              resolutionTime: undefined, // Clear to mark as "added" event
            }));
          }
          // If no log at this timestamp but still selected, it remains unchanged
          // from earlier - no action needed
        }
      });

      // Handle newly added symptoms (not in original, now selected)
      selectedSymptoms.forEach(symptom => {
        if (!originalSymptoms.has(symptom)) {
          promises.push(addSymptomLog({
            episodeId: primaryLog.episodeId,
            symptom,
            onsetTime: newTimestamp,
            // New symptoms are always "symptom started" events (no resolutionTime)
          }));
        }
      });

      await Promise.all(promises);
      navigation.goBack();
    } catch (error) {
      logger.error('Failed to update symptom logs:', error);
      Alert.alert('Error', 'Failed to update symptom logs');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!primaryLog) return;

    const logsToDelete = Array.from(symptomToLogId.values());
    const message = logsToDelete.length > 1
      ? `Are you sure you want to delete all ${logsToDelete.length} symptom logs at this time?`
      : 'Are you sure you want to delete this symptom log?';

    Alert.alert(
      'Delete Symptom Log',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(logsToDelete.map(id => deleteSymptomLog(id)));
              navigation.goBack();
            } catch (error) {
              logger.error('Failed to delete symptom logs:', error);
              Alert.alert('Error', 'Failed to delete symptom logs');
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
          <Text style={styles.title}>Edit Symptom</Text>
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
        <Text style={styles.title}>Edit Symptom</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Symptom Selection - Multi-select */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Symptoms</Text>
          <View style={styles.chipContainer}>
            {SYMPTOMS.map(item => (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.chip,
                  selectedSymptoms.has(item.value) && styles.chipActive,
                ]}
                onPress={() => toggleSymptom(item.value)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityHint={selectedSymptoms.has(item.value) ? `Tap to deselect ${item.label.toLowerCase()}` : `Tap to select ${item.label.toLowerCase()}`}
                accessibilityState={{ selected: selectedSymptoms.has(item.value) }}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedSymptoms.has(item.value) && styles.chipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Time</Text>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowTimePicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`Change time, currently ${formatDateTime(timestamp)}`}
            accessibilityHint="Opens date and time picker"
          >
            <Text style={styles.timeText}>
              {formatDateTime(timestamp)}
            </Text>
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={timestamp}
              mode="datetime"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                setShowTimePicker(Platform.OS === 'ios');
                if (date) setTimestamp(date);
              }}
            />
          )}
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
          accessibilityHint="Saves the edited symptom logs and returns to previous screen"
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
          accessibilityLabel="Delete symptom log"
          accessibilityHint="Permanently deletes this symptom log"
          accessibilityState={{ disabled: saving }}
        >
          <Text style={styles.deleteButtonText}>Delete Symptom Log</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
