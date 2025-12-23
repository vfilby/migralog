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
  Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useDailyStatusStore } from '../store/dailyStatusStore';
import { YellowDayType, Episode, CalendarOverlay } from '../models/types';
import { useTheme, ThemeColors } from '../theme';
import { format, subDays } from 'date-fns';
import { formatEpisodeTimeRange, formatEpisodeDuration } from '../utils/dateFormatting';
import { useOverlayStore } from '../store/overlayStore';
import { Calendar, DateData } from 'react-native-calendars';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyStatusPrompt'>;

const YELLOW_TYPES: { value: YellowDayType; label: string; description: string }[] = [
  { value: 'prodrome', label: 'Prodrome', description: 'Warning signs before episode' },
  { value: 'postdrome', label: 'Postdrome', description: 'Recovery period after episode' },
  { value: 'anxiety', label: 'Migraine Anxiety', description: 'Worried about potential episode' },
];

// Helper to format overlay date range
const formatOverlayDateRange = (startDate: string, endDate: string): string => {
  const start = new Date(startDate + 'T00:00:00');
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
});

export default function DailyStatusPromptScreen({ navigation, route }: Props) {
  const { date: dateParam } = route.params || {};
  const targetDate = dateParam || format(subDays(new Date(), 1), 'yyyy-MM-dd');

  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { logDayStatus, getEpisodesForDate, getDayStatus } = useDailyStatusStore();
  const { getOverlaysForDate, updateOverlay, deleteOverlay } = useOverlayStore();

  const [selectedStatus, setSelectedStatus] = useState<'green' | 'yellow' | null>(null);
  const [selectedType, setSelectedType] = useState<YellowDayType | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Overlay state
  const [dateOverlays, setDateOverlays] = useState<CalendarOverlay[]>([]);
  const [showOverlayModal, setShowOverlayModal] = useState(false);
  const [editingOverlay, setEditingOverlay] = useState<CalendarOverlay | null>(null);
  const [savingOverlay, setSavingOverlay] = useState(false);
  const [overlayForm, setOverlayForm] = useState({
    label: '',
    startDate: targetDate,
    endDate: targetDate,
    notes: '',
  });
  // Range selection: 'start' means next tap sets start date, 'end' means next tap sets end date
  const [rangeSelectionMode, setRangeSelectionMode] = useState<'start' | 'end'>('start');

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

  // Overlay handlers
  const handleEditOverlay = (overlay: CalendarOverlay) => {
    setEditingOverlay(overlay);
    setOverlayForm({
      label: overlay.label,
      startDate: overlay.startDate,
      endDate: overlay.endDate,
      notes: overlay.notes || '',
    });
    setRangeSelectionMode('start');
    setShowOverlayModal(true);
  };

  const handleEndToday = async (overlay: CalendarOverlay) => {
    try {
      await updateOverlay(overlay.id, { endDate: targetDate });
      const updatedOverlays = await getOverlaysForDate(targetDate);
      setDateOverlays(updatedOverlays);
    } catch (error) {
      logger.error('[DailyStatusPrompt] Failed to end overlay:', error);
      Alert.alert('Error', 'Failed to update overlay. Please try again.');
    }
  };

  const handleDeleteOverlay = (overlay: CalendarOverlay) => {
    Alert.alert(
      'Delete Overlay',
      `Are you sure you want to delete "${overlay.label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOverlay(overlay.id);
              const updatedOverlays = await getOverlaysForDate(targetDate);
              setDateOverlays(updatedOverlays);
            } catch (error) {
              logger.error('[DailyStatusPrompt] Failed to delete overlay:', error);
              Alert.alert('Error', 'Failed to delete overlay. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleSaveOverlay = async () => {
    if (!overlayForm.label.trim()) {
      Alert.alert('Required', 'Please enter a label for this overlay.');
      return;
    }

    if (overlayForm.startDate > overlayForm.endDate) {
      Alert.alert('Invalid Dates', 'End date must be on or after start date.');
      return;
    }

    // Validate against future dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(overlayForm.endDate + 'T00:00:00');
    if (endDate > today) {
      Alert.alert('Invalid Date', 'Overlay end date cannot be in the future.');
      return;
    }

    if (!editingOverlay) {
      return;
    }

    setSavingOverlay(true);
    try {
      await updateOverlay(editingOverlay.id, overlayForm);

      const updatedOverlays = await getOverlaysForDate(targetDate);
      setDateOverlays(updatedOverlays);
      setShowOverlayModal(false);
    } catch (error) {
      logger.error('[DailyStatusPrompt] Failed to save overlay:', error);
      Alert.alert('Error', 'Failed to save overlay. Please try again.');
    } finally {
      setSavingOverlay(false);
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

        {/* Overlays section for red days */}
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
                <View style={styles.overlayActions}>
                  <TouchableOpacity
                    style={styles.overlayActionButton}
                    onPress={() => handleEditOverlay(overlay)}
                    testID={`edit-overlay-${overlay.id}`}
                  >
                    <Text style={styles.overlayActionButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.overlayActionButton}
                    onPress={() => handleEndToday(overlay)}
                    testID={`end-overlay-${overlay.id}`}
                  >
                    <Text style={styles.overlayActionButtonText}>End Today</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.overlayActionButton, styles.overlayActionButtonDelete]}
                    onPress={() => handleDeleteOverlay(overlay)}
                    testID={`delete-overlay-${overlay.id}`}
                  >
                    <Text style={[styles.overlayActionButtonText, styles.overlayActionButtonDeleteText]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
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

        {/* Overlays section for non-red days */}
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
                <View style={styles.overlayActions}>
                  <TouchableOpacity
                    style={styles.overlayActionButton}
                    onPress={() => handleEditOverlay(overlay)}
                    testID={`edit-overlay-${overlay.id}`}
                  >
                    <Text style={styles.overlayActionButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.overlayActionButton}
                    onPress={() => handleEndToday(overlay)}
                    testID={`end-overlay-${overlay.id}`}
                  >
                    <Text style={styles.overlayActionButtonText}>End Today</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.overlayActionButton, styles.overlayActionButtonDelete]}
                    onPress={() => handleDeleteOverlay(overlay)}
                    testID={`delete-overlay-${overlay.id}`}
                  >
                    <Text style={[styles.overlayActionButtonText, styles.overlayActionButtonDeleteText]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
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

      {/* Overlay Modal */}
      <Modal
        visible={showOverlayModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowOverlayModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowOverlayModal(false)}>
                <Text style={styles.modalCloseButton}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Overlay</Text>
              <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.modalScrollView}>
              <Text style={styles.modalLabel}>Label</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g., Cold - on medication"
                placeholderTextColor={theme.textTertiary}
                value={overlayForm.label}
                onChangeText={(text) => setOverlayForm({ ...overlayForm, label: text })}
                testID="overlay-label-input"
              />

              <Text style={styles.modalLabel}>Date Range</Text>
              <View style={styles.dateRangeInfo}>
                <View style={styles.dateRangeItem}>
                  <Text style={[
                    styles.dateRangeLabel,
                    rangeSelectionMode === 'start' && styles.dateRangeLabelActive
                  ]}>Start</Text>
                  <TouchableOpacity
                    style={[
                      styles.dateRangeButton,
                      rangeSelectionMode === 'start' && styles.dateRangeButtonActive
                    ]}
                    onPress={() => setRangeSelectionMode('start')}
                    testID="start-date-button"
                  >
                    <Text style={styles.dateRangeButtonText}>
                      {format(new Date(overlayForm.startDate + 'T00:00:00'), 'MMM d, yyyy')}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.dateRangeArrow}>→</Text>
                <View style={styles.dateRangeItem}>
                  <Text style={[
                    styles.dateRangeLabel,
                    rangeSelectionMode === 'end' && styles.dateRangeLabelActive
                  ]}>End</Text>
                  <TouchableOpacity
                    style={[
                      styles.dateRangeButton,
                      rangeSelectionMode === 'end' && styles.dateRangeButtonActive
                    ]}
                    onPress={() => setRangeSelectionMode('end')}
                    testID="end-date-button"
                  >
                    <Text style={styles.dateRangeButtonText}>
                      {format(new Date(overlayForm.endDate + 'T00:00:00'), 'MMM d, yyyy')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.dateRangeHint}>
                {rangeSelectionMode === 'start' ? 'Tap a date to set the start' : 'Tap a date to set the end'}
              </Text>
              <Calendar
                markingType="period"
                markedDates={(() => {
                  const marks: Record<string, { startingDay?: boolean; endingDay?: boolean; color: string; textColor: string }> = {};
                  const start = overlayForm.startDate;
                  const end = overlayForm.endDate;

                  if (start === end) {
                    marks[start] = { startingDay: true, endingDay: true, color: theme.primary, textColor: theme.primaryText };
                  } else {
                    // Start date
                    marks[start] = { startingDay: true, color: theme.primary, textColor: theme.primaryText };
                    // End date
                    marks[end] = { endingDay: true, color: theme.primary, textColor: theme.primaryText };
                    // Days in between
                    const startDate = new Date(start + 'T00:00:00');
                    const endDate = new Date(end + 'T00:00:00');
                    const current = new Date(startDate);
                    current.setDate(current.getDate() + 1);
                    while (current < endDate) {
                      const dateStr = format(current, 'yyyy-MM-dd');
                      marks[dateStr] = { color: theme.primary + '80', textColor: theme.text };
                      current.setDate(current.getDate() + 1);
                    }
                  }
                  return marks;
                })()}
                onDayPress={(day: DateData) => {
                  const selectedDate = day.dateString;
                  if (rangeSelectionMode === 'start') {
                    // Set start date, and if it's after current end, also update end
                    if (selectedDate > overlayForm.endDate) {
                      setOverlayForm({ ...overlayForm, startDate: selectedDate, endDate: selectedDate });
                    } else {
                      setOverlayForm({ ...overlayForm, startDate: selectedDate });
                    }
                    setRangeSelectionMode('end');
                  } else {
                    // Set end date, ensure it's not before start
                    if (selectedDate < overlayForm.startDate) {
                      setOverlayForm({ ...overlayForm, startDate: selectedDate, endDate: overlayForm.startDate });
                    } else {
                      setOverlayForm({ ...overlayForm, endDate: selectedDate });
                    }
                    setRangeSelectionMode('start');
                  }
                }}
                maxDate={format(new Date(), 'yyyy-MM-dd')}
                theme={{
                  backgroundColor: theme.card,
                  calendarBackground: theme.card,
                  textSectionTitleColor: theme.textSecondary,
                  dayTextColor: theme.text,
                  todayTextColor: theme.primary,
                  monthTextColor: theme.text,
                  arrowColor: theme.primary,
                  textDisabledColor: theme.textTertiary,
                }}
                testID="date-range-calendar"
              />

              <Text style={styles.modalLabel}>Notes (optional)</Text>
              <TextInput
                style={styles.modalTextArea}
                placeholder="Additional details..."
                placeholderTextColor={theme.textTertiary}
                value={overlayForm.notes}
                onChangeText={(text) => setOverlayForm({ ...overlayForm, notes: text })}
                multiline
                numberOfLines={4}
                testID="overlay-notes-input"
              />

              <TouchableOpacity
                style={[styles.modalSaveButton, savingOverlay && styles.saveButtonDisabled]}
                onPress={handleSaveOverlay}
                disabled={savingOverlay}
                testID="save-overlay-button"
              >
                <Text style={styles.modalSaveButtonText}>
                  {savingOverlay ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>

      </Modal>
    </View>
  );
}
