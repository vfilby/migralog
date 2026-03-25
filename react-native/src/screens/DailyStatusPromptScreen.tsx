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
import { YellowDayType, Episode, CalendarOverlay } from '../models/types';
import { useTheme, ThemeColors } from '../theme';
import { format, subDays } from 'date-fns';
import { formatEpisodeTimeRange, formatEpisodeDuration } from '../utils/dateFormatting';
import { useOverlayStore } from '../store/overlayStore';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyStatusPrompt'>;

const YELLOW_TYPES: { value: YellowDayType; label: string; description: string }[] = [
  { value: 'prodrome', label: 'Prodrome', description: 'Warning signs before episode' },
  { value: 'postdrome', label: 'Postdrome', description: 'Recovery period after episode' },
  { value: 'anxiety', label: 'Migraine Anxiety', description: 'Worried about potential episode' },
];

// Helper to format overlay date range
const formatOverlayDateRange = (startDate: string, endDate: string | undefined): string => {
  const start = new Date(startDate + 'T00:00:00');

  // Handle ongoing overlays (no end date)
  if (!endDate) {
    return `${format(start, 'MMM d, yyyy')} - Ongoing`;
  }

  const end = new Date(endDate + 'T00:00:00');
  if (startDate === endDate) {
    return format(start, 'MMM d, yyyy');
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
  }
  return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
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
  statusCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  statusCircleGreen: {
    backgroundColor: '#22c55e',
  },
  statusCircleYellow: {
    backgroundColor: '#eab308',
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
  tapToViewText: {
    fontSize: 12,
    color: theme.primary,
    marginTop: 6,
    fontWeight: '500',
  },
  notesSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  overlaySection: {
    marginTop: 24,
    marginBottom: 16,
  },
  overlaySectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
  },
  overlayCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  overlayCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  overlayCardLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
  },
  overlayCardDates: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 12,
  },
  overlayActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  overlayActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
  },
  overlayActionButtonText: {
    fontSize: 13,
    color: theme.text,
    fontWeight: '500',
  },
  overlayActionButtonDelete: {
    backgroundColor: '#ffebee',
    borderColor: '#ef5350',
  },
  overlayActionButtonDeleteText: {
    color: '#c62828',
  },
  overlayHint: {
    fontSize: 13,
    color: theme.textSecondary,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.background,
  },
  modalContent: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  modalCloseButton: {
    fontSize: 16,
    color: theme.primary,
  },
  modalScrollView: {
    flex: 1,
  },
  modalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
    marginTop: 16,
  },
  modalInput: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
  },
  modalTextArea: {
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
  dateRangeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 16,
  },
  dateRangeItem: {
    alignItems: 'center',
  },
  dateRangeLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  dateRangeLabelActive: {
    color: theme.primary,
  },
  dateRangeButton: {
    backgroundColor: theme.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: theme.border,
  },
  dateRangeButtonActive: {
    borderColor: theme.primary,
    backgroundColor: theme.background,
  },
  dateRangeButtonText: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '500',
  },
  dateRangeArrow: {
    fontSize: 18,
    color: theme.textSecondary,
  },
  dateRangeHint: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  modalSaveButton: {
    backgroundColor: theme.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  modalSaveButtonText: {
    color: theme.primaryText,
    fontSize: 17,
    fontWeight: '600',
  },
  ongoingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  ongoingLabel: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '500',
  },
  ongoingDescription: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
  },
});

export default function DailyStatusPromptScreen({ navigation, route }: Props) {
  const { date: dateParam } = route.params || {};
  const targetDate = dateParam || format(subDays(new Date(), 1), 'yyyy-MM-dd');

  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { logDayStatus, getEpisodesForDate, getDayStatus } = useDailyStatusStore();
  const { getOverlaysForDate } = useOverlayStore();

  const [selectedStatus, setSelectedStatus] = useState<'green' | 'yellow' | null>(null);
  const [selectedType, setSelectedType] = useState<YellowDayType | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dateOverlays, setDateOverlays] = useState<CalendarOverlay[]>([]);

  // Computed values for readability
  const hasEpisodes = episodes.length > 0;
  const isRedDay = hasEpisodes;

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      // Load episodes, existing status, and overlays in parallel
      const [episodesForDate, existingStatus, overlaysForDate] = await Promise.all([
        getEpisodesForDate(targetDate),
        getDayStatus(targetDate),
        getOverlaysForDate(targetDate),
      ]);

      setEpisodes(episodesForDate);
      setDateOverlays(overlaysForDate);

      // Pre-populate form with existing status data
      if (existingStatus) {
        // Only pre-populate green/yellow statuses (red is calculated from episodes)
        if (existingStatus.status === 'green' || existingStatus.status === 'yellow') {
          setSelectedStatus(existingStatus.status);
          if (existingStatus.statusType) {
            setSelectedType(existingStatus.statusType);
          }
        }
        if (existingStatus.notes) {
          setNotes(existingStatus.notes);
        }
      }
    } catch (error) {
      logger.error('[DailyStatusPrompt] Failed to load data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleStatusSelect = (status: 'green' | 'yellow') => {
    setSelectedStatus(status);
    if (status === 'green') {
      // Clear yellow-specific field (type), but keep notes
      setSelectedType(null);
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

  const handleSaveRedDayNotes = async () => {
    // If no notes, just close
    if (!notes.trim()) {
      navigation.goBack();
      return;
    }

    setSaving(true);
    try {
      // Save notes for red day using logDayStatus with 'red' status
      await logDayStatus(
        targetDate,
        'red',
        undefined,
        notes.trim(),
        true // prompted = true
      );
      navigation.goBack();
    } catch (error) {
      logger.error('[DailyStatusPrompt] Failed to save red day notes:', error);
      Alert.alert('Error', 'Failed to save notes. Please try again.');
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return format(date, 'EEEE, MMMM d, yyyy');
    } catch {
      return 'Yesterday';
    }
  };

  if (loadingData) {
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
        {isRedDay && (
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
              <TouchableOpacity
                key={episode.id}
                style={styles.episodeItem}
                onPress={() => navigation.navigate('EpisodeDetail', { episodeId: episode.id })}
                testID={`episode-card-${episode.id}`}
                accessibilityRole="button"
                accessibilityLabel={`View episode details`}
              >
                <Text style={styles.episodeTime}>
                  {formatEpisodeTimeRange(episode.startTime, episode.endTime, targetDate)}
                </Text>
                <Text style={styles.episodeDetails}>
                  Duration: {formatEpisodeDuration(episode.startTime, episode.endTime)}
                  {episode.notes ? ` • ${episode.notes}` : ''}
                </Text>
                <Text style={styles.tapToViewText}>Tap to view details →</Text>
              </TouchableOpacity>
            ))}
            <Text style={[styles.episodeInfoText, { marginTop: 12, marginBottom: 0 }]}>
              This day is automatically marked as red based on your episode data.
            </Text>
          </View>
        )}

        {/* Notes section for red days - outside the red bubble */}
        {isRedDay && (
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              multiline
              numberOfLines={4}
              placeholder="Any additional details about this day..."
              placeholderTextColor={theme.textTertiary}
              value={notes}
              onChangeText={setNotes}
              testID="red-day-notes-input"
            />
          </View>
        )}

        {/* Overlays section for red days (read-only) */}
        {isRedDay && dateOverlays.length > 0 && (
          <View style={styles.overlaySection}>
            <Text style={styles.overlaySectionTitle}>Active Overlays</Text>
            {dateOverlays.map((overlay) => (
              <View key={overlay.id} style={styles.overlayCard}>
                <View style={styles.overlayCardHeader}>
                  <Text style={styles.overlayCardLabel}>{overlay.label}</Text>
                </View>
                <Text style={styles.overlayCardDates}>
                  {formatOverlayDateRange(overlay.startDate, overlay.endDate)}
                </Text>
              </View>
            ))}
            <Text style={styles.overlayHint}>Manage overlays from the calendar view</Text>
          </View>
        )}

        {/* Only show status buttons if there are no episodes */}
        {!isRedDay && (
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
                <View style={[styles.statusCircle, styles.statusCircleGreen]} />
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
                <View style={[styles.statusCircle, styles.statusCircleYellow]} />
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

        {/* Expanded Green Day Details - notes only */}
        {!isRedDay && selectedStatus === 'green' && (
          <View style={styles.expandedSection}>
            <Text style={styles.sectionTitle}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              multiline
              numberOfLines={4}
              placeholder="Any additional details..."
              placeholderTextColor={theme.textTertiary}
              value={notes}
              onChangeText={setNotes}
              testID="green-day-notes-input"
            />
          </View>
        )}

        {/* Expanded Yellow Day Details - only if no episodes */}
        {!isRedDay && selectedStatus === 'yellow' && (
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

        {/* Overlays section for non-red days (read-only) */}
        {!isRedDay && dateOverlays.length > 0 && (
          <View style={styles.overlaySection}>
            <Text style={styles.overlaySectionTitle}>Active Overlays</Text>
            {dateOverlays.map((overlay) => (
              <View key={overlay.id} style={styles.overlayCard}>
                <View style={styles.overlayCardHeader}>
                  <Text style={styles.overlayCardLabel}>{overlay.label}</Text>
                </View>
                <Text style={styles.overlayCardDates}>
                  {formatOverlayDateRange(overlay.startDate, overlay.endDate)}
                </Text>
              </View>
            ))}
            <Text style={styles.overlayHint}>Manage overlays from the calendar view</Text>
          </View>
        )}
      </ScrollView>

      {/* Save Button Footer for green/yellow days */}
      {!isRedDay && (
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

      {/* Save Button Footer for red days - to save notes */}
      {isRedDay && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSaveRedDayNotes}
              disabled={saving}
              testID="save-red-day-notes-button"
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : (notes.trim() ? 'Save Notes' : 'Close')}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

    </View>
  );
}
