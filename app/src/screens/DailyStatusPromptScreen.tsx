import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useDailyStatusStore } from '../store/dailyStatusStore';
import { YellowDayType, Episode } from '../models/types';
import { useTheme, ThemeColors } from '../theme';
import { format, subDays } from 'date-fns';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyStatusPrompt'>;

const YELLOW_TYPES: { value: YellowDayType; label: string; description: string }[] = [
  { value: 'prodrome', label: 'Prodrome', description: 'Warning signs before episode' },
  { value: 'postdrome', label: 'Postdrome', description: 'Recovery period after episode' },
  { value: 'anxiety', label: 'Migraine Anxiety', description: 'Worried about potential episode' },
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
  closeButton: {
    fontSize: 17,
    color: theme.primary,
    minWidth: 60,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 32,
  },
  dateText: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  statusButtonContainer: {
    gap: 16,
    marginBottom: 32,
  },
  statusButton: {
    backgroundColor: theme.card,
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.border,
  },
  statusButtonSelected: {
    borderColor: theme.primary,
    backgroundColor: theme.background,
  },
  statusButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statusEmoji: {
    fontSize: 36,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  statusDescription: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  expandedSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
  },
  typeChipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  typeChipSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  typeChipText: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '500',
  },
  typeChipTextSelected: {
    color: theme.primaryText,
  },
  typeChipDescription: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  notesInput: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.text,
    textAlignVertical: 'top',
    minHeight: 100,
    borderWidth: 1,
    borderColor: theme.border,
  },
  footer: {
    backgroundColor: theme.card,
    padding: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    gap: 12,
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
  skipButton: {
    padding: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    color: theme.textSecondary,
    fontSize: 15,
  },
  episodeInfo: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#ff4444',
  },
  episodeInfoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
  },
  episodeInfoText: {
    fontSize: 15,
    color: theme.textSecondary,
    marginBottom: 8,
  },
  episodeItem: {
    backgroundColor: theme.background,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  episodeTime: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  episodeDetails: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
});

export default function DailyStatusPromptScreen({ navigation, route }: Props) {
  const { date: dateParam } = route.params || {};
  const targetDate = dateParam || format(subDays(new Date(), 1), 'yyyy-MM-dd');

  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { logDayStatus, getEpisodesForDate } = useDailyStatusStore();

  const [selectedStatus, setSelectedStatus] = useState<'green' | 'yellow' | null>(null);
  const [selectedType, setSelectedType] = useState<YellowDayType | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(true);

  useEffect(() => {
    loadEpisodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate]);

  const loadEpisodes = async () => {
    setLoadingEpisodes(true);
    try {
      const episodesForDate = await getEpisodesForDate(targetDate);
      setEpisodes(episodesForDate);
    } catch (error) {
      logger.error('[DailyStatusPrompt] Failed to load episodes:', error);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const handleStatusSelect = (status: 'green' | 'yellow') => {
    setSelectedStatus(status);
    if (status === 'green') {
      // Clear yellow-specific fields
      setSelectedType(null);
      setNotes('');
    }
  };

  const handleSave = async () => {
    if (!selectedStatus) {
      Alert.alert('Please select a status', 'Choose whether yesterday was a clear day or not.');
      return;
    }

    // Yellow day type is now optional - no validation needed

    setSaving(true);
    try {
      await logDayStatus(
        targetDate,
        selectedStatus,
        selectedType || undefined,
        notes.trim() || undefined,
        true // prompted = true
      );
      navigation.goBack();
    } catch (error) {
      logger.error('[DailyStatusPrompt] Failed to log status:', error);
      Alert.alert('Error', 'Failed to log status. Please try again.');
      setSaving(false);
    }
  };

  const handleSkip = () => {
    navigation.goBack();
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return format(date, 'EEEE, MMMM d, yyyy');
    } catch {
      return 'Yesterday';
    }
  };

  const formatEpisodeTime = (startTime: number, endTime?: number) => {
    const start = format(new Date(startTime), 'h:mm a');
    if (endTime) {
      const end = format(new Date(endTime), 'h:mm a');
      return `${start} - ${end}`;
    }
    return `Started at ${start}`;
  };

  const formatEpisodeDuration = (startTime: number, endTime?: number) => {
    const end = endTime || Date.now();
    const durationMs = end - startTime;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loadingEpisodes) {
    return (
      <View style={styles.container} testID="daily-status-prompt-screen">
        <View style={styles.header}>
          <TouchableOpacity onPress={handleSkip}>
            <Text style={styles.closeButton}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Daily Check-in</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="daily-status-prompt-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.closeButton}>Close</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Daily Check-in</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.dateText}>
          How was {formatDate(targetDate)}?
        </Text>

        {/* Show episode info if there are episodes on this date */}
        {episodes.length > 0 && (
          <View style={styles.episodeInfo}>
            <Text style={styles.episodeInfoTitle}>
              🔴 Episode Day
            </Text>
            <Text style={styles.episodeInfoText}>
              {episodes.length === 1
                ? 'You had an episode on this day:'
                : `You had ${episodes.length} episodes on this day:`}
            </Text>
            {episodes.map((episode) => (
              <View key={episode.id} style={styles.episodeItem}>
                <Text style={styles.episodeTime}>
                  {formatEpisodeTime(episode.startTime, episode.endTime)}
                </Text>
                <Text style={styles.episodeDetails}>
                  Duration: {formatEpisodeDuration(episode.startTime, episode.endTime)}
                  {episode.notes ? ` • ${episode.notes}` : ''}
                </Text>
              </View>
            ))}
            <Text style={[styles.episodeInfoText, { marginTop: 12, marginBottom: 0 }]}>
              This day is automatically marked as red based on your episode data.
            </Text>
          </View>
        )}

        {/* Only show status buttons if there are no episodes */}
        {episodes.length === 0 && (
          <View style={styles.statusButtonContainer}>
            {/* Green Day Button */}
            <TouchableOpacity
              style={[
                styles.statusButton,
                selectedStatus === 'green' && styles.statusButtonSelected,
              ]}
              onPress={() => handleStatusSelect('green')}
              testID="green-day-button"
            >
              <View style={styles.statusButtonContent}>
                <Text style={styles.statusEmoji}>🟢</Text>
                <View style={styles.statusTextContainer}>
                  <Text style={styles.statusTitle}>Clear Day</Text>
                  <Text style={styles.statusDescription}>
                    No symptoms or concerns
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Yellow Day Button */}
            <TouchableOpacity
              style={[
                styles.statusButton,
                selectedStatus === 'yellow' && styles.statusButtonSelected,
              ]}
              onPress={() => handleStatusSelect('yellow')}
              testID="yellow-day-button"
            >
              <View style={styles.statusButtonContent}>
                <Text style={styles.statusEmoji}>🟡</Text>
                <View style={styles.statusTextContainer}>
                  <Text style={styles.statusTitle}>Not Clear</Text>
                  <Text style={styles.statusDescription}>
                    Prodrome, postdrome, or anxiety
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Expanded Yellow Day Details - only if no episodes */}
        {episodes.length === 0 && selectedStatus === 'yellow' && (
          <View style={styles.expandedSection}>
            <Text style={styles.sectionTitle}>Why wasn't it clear? (optional)</Text>
            <View style={styles.typeChipContainer}>
              {YELLOW_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.typeChip,
                    selectedType === type.value && styles.typeChipSelected,
                  ]}
                  onPress={() => setSelectedType(type.value)}
                  testID={`yellow-type-${type.value}`}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      selectedType === type.value && styles.typeChipTextSelected,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              multiline
              numberOfLines={4}
              placeholder="Any additional details..."
              placeholderTextColor={theme.textTertiary}
              value={notes}
              onChangeText={setNotes}
              testID="daily-status-notes-input"
            />
          </View>
        )}
      </ScrollView>

      {/* Save Button Footer - only show if no episodes */}
      {episodes.length === 0 && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveButton, (saving || !selectedStatus) && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving || !selectedStatus}
              testID="save-status-button"
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
              testID="skip-button"
            >
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
