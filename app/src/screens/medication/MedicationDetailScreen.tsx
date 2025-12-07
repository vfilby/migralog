import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { toastService } from '../../services/toastService';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActionSheetIOS,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { Medication, MedicationDose, MedicationSchedule } from '../../models/types';
import { medicationRepository, medicationDoseRepository, medicationScheduleRepository } from '../../database/medicationRepository';
import { format } from 'date-fns';
import { useTheme } from '../../theme';
import { useMedicationStore } from '../../store/medicationStore';
import { useEpisodeStore } from '../../store/episodeStore';
import { formatDosageWithUnit, formatMedicationDoseDisplay } from '../../utils/medicationFormatting';
import { useMedicationStatusStyles } from '../../utils/medicationStyling';
import { getLast7DaysTimeline as calculateLast7DaysTimeline } from '../../utils/medicationTimeline';
import { getCategoryName } from '../../utils/presetMedications';
import NotificationSettings from '../../components/shared/NotificationSettings';
import { isLargeTextModeEnabled } from '../../utils/textScaling';
import { Ionicons } from '@expo/vector-icons';
import { formatTime, formatDateTime } from '../../utils/dateFormatting';

type Props = NativeStackScreenProps<RootStackParamList, 'MedicationDetail'>;

export default function MedicationDetailScreen({ route, navigation }: Props) {
  const { medicationId } = route.params;
  const { theme } = useTheme();
  const { getStatusStyle } = useMedicationStatusStyles();
  const { logDose, deleteDose, archiveMedication } = useMedicationStore();
  const { currentEpisode } = useEpisodeStore();
  const [medication, setMedication] = useState<Medication | null>(null);
  const [schedules, setSchedules] = useState<MedicationSchedule[]>([]);
  const [doses, setDoses] = useState<MedicationDose[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingDose, setEditingDose] = useState<MedicationDose | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editTimestamp, setEditTimestamp] = useState<number>(Date.now());
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [notificationSettingsExpanded, setNotificationSettingsExpanded] = useState(false);

  useEffect(() => {
    loadMedicationData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicationId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadMedicationData();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  const loadMedicationData = async () => {
    try {
      const med = await medicationRepository.getById(medicationId);
      if (!med) {
        Alert.alert('Error', 'Medication not found');
        navigation.goBack();
        return;
      }

      setMedication(med);

      // Load schedules for all medication types (schedules are optional for any type)
      const scheds = await medicationScheduleRepository.getByMedicationId(medicationId);
      setSchedules(scheds);

      // Load last 30 days of doses
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const allDoses = await medicationDoseRepository.getByMedicationId(medicationId);
      const recentDoses = allDoses.filter(d => d.timestamp >= thirtyDaysAgo);
      setDoses(recentDoses);
    } catch (error) {
      logger.error('Failed to load medication data:', error);
      Alert.alert('Error', 'Failed to load medication details');
    } finally {
      setLoading(false);
    }
  };

  const handleLogDoseNow = async () => {
    if (!medication) return;

    try {
      const timestamp = Date.now();
      await logDose({
        medicationId: medication.id,
        timestamp,
        quantity: medication.defaultQuantity || 1,
        dosageAmount: medication.dosageAmount,
        dosageUnit: medication.dosageUnit,
        episodeId: currentEpisode?.id,
        updatedAt: timestamp,
      });
      // Toast notification shown by store
      await loadMedicationData(); // Reload to show in recent activity
    } catch (error) {
      logger.error('Failed to log medication:', error);
      // Error toast shown by store
    }
  };

  const handleDoseAction = (dose: MedicationDose) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Edit', 'Delete'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleEditDose(dose);
          } else if (buttonIndex === 2) {
            handleDeleteDose(dose);
          }
        }
      );
    } else {
      // Android fallback - show Alert with options
      Alert.alert(
        'Dose Actions',
        `${formatDateTime(dose.timestamp)}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Edit', onPress: () => handleEditDose(dose) },
          { text: 'Delete', style: 'destructive', onPress: () => handleDeleteDose(dose) },
        ]
      );
    }
  };

  const handleEditDose = (dose: MedicationDose) => {
    setEditingDose(dose);
    setEditAmount(dose.quantity.toString());
    setEditNotes(dose.notes || '');
    setEditTimestamp(dose.timestamp);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingDose || !medication) return;

    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid dose amount');
      return;
    }

    try {
      await medicationDoseRepository.update(editingDose.id, {
        quantity: amount,
        notes: editNotes.trim() || undefined,
        timestamp: editTimestamp,
      });
      // Success is evident from UI update (TODO: Use store.updateDose() instead)
      setEditModalVisible(false);
      await loadMedicationData(); // Reload to update the list
    } catch (error) {
      logger.error('Failed to update dose:', error);
      toastService.error('Failed to update dose');
    }
  };

  const handleCancelEdit = () => {
    setEditModalVisible(false);
    setEditingDose(null);
    setEditAmount('');
    setEditNotes('');
    setShowDateTimePicker(false);
  };

  const handleDeleteDose = (dose: MedicationDose) => {
    Alert.alert(
      'Delete Dose',
      `Are you sure you want to delete this dose from ${formatDateTime(dose.timestamp)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDose(dose.id); // Use store method which shows toast
              await loadMedicationData(); // Reload to update the list
            } catch (error) {
              logger.error('Failed to delete dose:', error);
              // Error toast shown by store
            }
          },
        },
      ]
    );
  };

  const handleArchive = () => {
    if (!medication) return;

    Alert.alert(
      'Archive Medication',
      `Are you sure you want to archive ${medication.name}? It will be hidden from your active medications but you can restore it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveMedication(medicationId);
              navigation.goBack();
            } catch (error) {
              logger.error('Failed to archive medication:', error);
              toastService.error('Failed to archive medication');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            accessibilityHint="Return to previous screen"
          >
            <Text style={[styles.backButton, { color: theme.primary }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!medication) {
    return null;
  }

  const last7Days = medication.scheduleFrequency === 'daily'
    ? calculateLast7DaysTimeline(doses)
    : [];

  const largeTextMode = isLargeTextModeEnabled();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]} testID="medication-detail-screen">
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Return to previous screen"
        >
          <Text style={[styles.backButton, { color: theme.primary }]}>← Back</Text>
        </TouchableOpacity>
        {!largeTextMode && <Text style={[styles.headerTitle, { color: theme.text }]}>Medication Details</Text>}
        <TouchableOpacity
          onPress={() => navigation.navigate('EditMedication', { medicationId })}
          accessibilityRole="button"
          accessibilityLabel="Edit medication"
          accessibilityHint="Opens the edit medication screen"
        >
          <Text style={[styles.editButton, { color: theme.primary }]}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} testID="medication-detail-scrollview">
        {/* Medication Info */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={styles.medicationHeader}>
            <View style={styles.medicationTitleContainer}>
              <Text style={[styles.medicationName, { color: theme.text }]}>{medication.name}</Text>
              <View style={styles.badgeContainer}>
                <View style={[styles.typeBadge, {
                  backgroundColor: medication.type === 'preventative'
                    ? theme.success + '20'
                    : medication.type === 'rescue'
                    ? theme.primary + '20'
                    : theme.textSecondary + '20'
                }]}>
                  <Text style={[styles.typeBadgeText, {
                    color: medication.type === 'preventative'
                      ? theme.success
                      : medication.type === 'rescue'
                      ? theme.primary
                      : theme.textSecondary
                  }]}>
                    {medication.type === 'preventative' ? 'Preventative' : medication.type === 'rescue' ? 'Rescue' : 'Other'}
                  </Text>
                </View>
                {medication.category && (
                  <View style={[styles.typeBadge, {
                    backgroundColor: theme.textSecondary + '20'
                  }]}>
                    <Text style={[styles.typeBadgeText, {
                      color: theme.textSecondary
                    }]}>
                      {getCategoryName(medication.category)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            {medication.photoUri && (
              <Image
                source={{ uri: medication.photoUri }}
                style={styles.medicationThumbnail}
                resizeMode="cover"
                accessibilityLabel={`Photo of ${medication.name}`}
              />
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Dosage:</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>
              {formatDosageWithUnit(medication.dosageAmount, medication.dosageUnit)}
            </Text>
          </View>

          {medication.defaultQuantity && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Default Doses:</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{medication.defaultQuantity}</Text>
            </View>
          )}

          {medication.scheduleFrequency && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Frequency:</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{medication.scheduleFrequency}</Text>
            </View>
          )}

          {medication.notes && (
            <View style={styles.notesContainer}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Notes:</Text>
              <Text style={[styles.notesText, { color: theme.text }]}>{medication.notes}</Text>
            </View>
          )}

          {/* Quick Log Action */}
          <View style={styles.logDoseSection}>
            <TouchableOpacity
              style={[styles.logDoseButton, { backgroundColor: theme.primary }]}
              onPress={handleLogDoseNow}
              accessibilityRole="button"
              accessibilityLabel="Log dose now"
              accessibilityHint={`Logs a dose of ${medication.name} with current time`}
            >
              <Text style={[styles.logDoseButtonText, { color: theme.primaryText }]}>Log Dose Now</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Schedules (any type can have schedules) */}
        {schedules.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Schedule</Text>
            {schedules.map((schedule, index) => (
              <View key={schedule.id}>
                <View style={styles.scheduleItemRow}>
                  <View style={styles.scheduleLeft}>
                    <Text style={[styles.scheduleTime, { color: theme.text }]}>{schedule.time}</Text>
                    <Text style={[styles.scheduleDosage, { color: theme.textSecondary }]}>
                      {schedule.dosage} dose{schedule.dosage > 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                {index < schedules.length - 1 && (
                  <View style={[styles.separator, { backgroundColor: theme.border }]} />
                )}
              </View>
            ))}
          </View>
        )}

        {/* 7-Day Timeline (Preventative Daily only) */}
        {last7Days.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Last 7 Days</Text>
            <View style={styles.timeline}>
              {last7Days.map((day, index) => (
                <View key={index} style={styles.timelineDay}>
                  <Text style={[styles.dayLabel, { color: theme.textSecondary }]}>{format(day.date, 'EEE')}</Text>
                  <View style={[
                    styles.dayIndicator,
                    day.taken ? { backgroundColor: theme.success } : day.skipped ? { backgroundColor: theme.danger } : { backgroundColor: theme.border }
                  ]} />
                  <Text style={[styles.dayDate, { color: theme.textSecondary }]}>{format(day.date, 'd')}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Notification Settings - For any medication with schedules */}
        {schedules.length > 0 && (
          <View style={[styles.notificationSection, { backgroundColor: theme.card }]}>
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={() => setNotificationSettingsExpanded(!notificationSettingsExpanded)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Notification overrides"
              accessibilityHint={notificationSettingsExpanded ? "Collapse notification settings" : "Expand notification settings"}
              accessibilityState={{ expanded: notificationSettingsExpanded }}
            >
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Notification Overrides</Text>
              <Ionicons
                name={notificationSettingsExpanded ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
            {notificationSettingsExpanded && (
              <View style={styles.settingsContainer}>
                <NotificationSettings medicationId={medicationId} showTitle={false} />
              </View>
            )}
          </View>
        )}

        {/* 30-Day Log */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Activity (30 days)</Text>
          {doses.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No doses logged in the last 30 days</Text>
          ) : (
            <>
              <View style={styles.logSummary}>
                <Text style={[styles.logSummaryText, { color: theme.textSecondary }]}>
                  {doses.length} dose{doses.length !== 1 ? 's' : ''} logged
                </Text>
              </View>
              {doses.slice(0, 10).map((dose, index) => (
                <View key={dose.id}>
                  <TouchableOpacity
                    style={styles.logItem}
                    onLongPress={() => handleDoseAction(dose)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Dose logged on ${format(new Date(dose.timestamp), 'MMM d, yyyy')} at ${formatTime(dose.timestamp)}`}
                    accessibilityHint="Long press to edit or delete this dose"
                  >
                    <View style={styles.logItemLeft}>
                      <Text style={[styles.logDate, { color: theme.text }]}>
                        {format(new Date(dose.timestamp), 'MMM d, yyyy')}
                      </Text>
                      <Text style={[styles.logTime, { color: theme.textSecondary }]}>
                        {formatTime(dose.timestamp)}
                      </Text>
                    </View>
                    <View style={styles.logItemRight}>
                      <Text style={[styles.logAmount, getStatusStyle(dose.status)]}>
                        {formatMedicationDoseDisplay(dose, medication)}
                      </Text>
                      {dose.notes && (
                        <Text style={[styles.logNotes, { color: theme.textSecondary }]} numberOfLines={1}>{dose.notes}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  {index < doses.slice(0, 10).length - 1 && (
                    <View style={[styles.separator, { backgroundColor: theme.border }]} />
                  )}
                </View>
              ))}
              {doses.length > 10 && (
                <TouchableOpacity
                  style={styles.viewAllButton}
                  onPress={() => navigation.navigate('MedicationLog', { medicationId })}
                  accessibilityRole="button"
                  accessibilityLabel={`View all ${doses.length} doses`}
                  accessibilityHint="Opens the full medication log screen"
                >
                  <Text style={[styles.viewAllText, { color: theme.primary }]}>
                    View All ({doses.length})
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Archive Section */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <TouchableOpacity
            style={styles.archiveButton}
            onPress={handleArchive}
            testID="archive-medication-button"
            accessibilityRole="button"
            accessibilityLabel="Archive medication"
            accessibilityHint={`Archives ${medication.name} and hides it from active medications`}
          >
            <Ionicons name="archive-outline" size={20} color={theme.danger} />
            <Text style={[styles.archiveButtonText, { color: theme.danger }]}>
              Archive Medication
            </Text>
          </TouchableOpacity>
          <Text style={[styles.archiveHint, { color: theme.textTertiary }]}>
            Archived medications can be restored later
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Dose Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCancelEdit}
      >
        <KeyboardAvoidingView
          style={[styles.modalContainer, { backgroundColor: theme.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalHeader, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <TouchableOpacity
              onPress={handleCancelEdit}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              accessibilityHint="Discard changes and close edit modal"
            >
              <Text style={[styles.modalCancelButton, { color: theme.primary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Dose</Text>
            <TouchableOpacity
              onPress={handleSaveEdit}
              accessibilityRole="button"
              accessibilityLabel="Save"
              accessibilityHint="Saves the edited dose and closes modal"
            >
              <Text style={[styles.modalSaveButton, { color: theme.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={[styles.modalSection, { backgroundColor: theme.card }]}>
              <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Medication</Text>
              <Text style={[styles.modalValue, { color: theme.text }]}>{medication?.name}</Text>
            </View>

            <View style={[styles.modalSection, { backgroundColor: theme.card }]}>
              <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Date & Time</Text>
              <TouchableOpacity
                style={[styles.dateTimeButton, {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                }]}
                onPress={() => setShowDateTimePicker(true)}
                accessibilityRole="button"
                accessibilityLabel={`Change time, currently ${editTimestamp && formatDateTime(editTimestamp)}`}
                accessibilityHint="Opens date and time picker"
              >
                <Text style={[styles.modalValue, { color: theme.text }]}>
                  {editTimestamp && formatDateTime(editTimestamp)}
                </Text>
              </TouchableOpacity>
              {showDateTimePicker && (
                <DateTimePicker
                  value={editTimestamp && editTimestamp > 0 ? new Date(editTimestamp) : new Date()}
                  mode="datetime"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDateTime) => {
                    if (Platform.OS === 'android') {
                      setShowDateTimePicker(false);
                    }
                    if (selectedDateTime) {
                      setEditTimestamp(selectedDateTime.getTime());
                    }
                  }}
                />
              )}
            </View>

            <View style={[styles.modalSection, { backgroundColor: theme.card }]}>
              <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Number of Doses</Text>
              <TextInput
                testID="dose-amount-input"
                accessibilityLabel="Dose amount input"
                style={[styles.modalInput, {
                  backgroundColor: theme.background,
                  color: theme.text,
                  borderColor: theme.border,
                }]}
                value={editAmount}
                onChangeText={setEditAmount}
                keyboardType="decimal-pad"
                placeholder="Enter amount"
                placeholderTextColor={theme.textTertiary}
              />
            </View>

            <View style={[styles.modalSection, { backgroundColor: theme.card }]}>
              <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Notes (Optional)</Text>
              <TextInput
                style={[styles.modalTextArea, {
                  backgroundColor: theme.background,
                  color: theme.text,
                  borderColor: theme.border,
                }]}
                value={editNotes}
                onChangeText={setEditNotes}
                multiline
                numberOfLines={4}
                placeholder="Add notes about this dose"
                placeholderTextColor={theme.textTertiary}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    gap: 8,
  },
  backButton: {
    fontSize: 17,
    fontWeight: '400',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  editButton: {
    fontSize: 17,
    fontWeight: '400',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  settingsContainer: {
    paddingVertical: 4,
  },
  notificationSection: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderRadius: 12,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 0,
  },
  medicationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  medicationTitleContainer: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
  },
  medicationThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  medicationName: {
    fontSize: 28,
    fontWeight: '700',
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  typeBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 17,
  },
  infoValue: {
    fontSize: 17,
    fontWeight: '500',
  },
  notesContainer: {
    marginTop: 12,
  },
  notesText: {
    fontSize: 15,
    marginTop: 4,
    lineHeight: 20,
  },
  logDoseSection: {
    marginTop: 20,
  },
  logDoseButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  logDoseButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  scheduleItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleLeft: {
    flex: 1,
  },
  separator: {
    height: 1,
    marginVertical: 12,
  },
  scheduleTime: {
    fontSize: 17,
    fontWeight: '500',
  },
  scheduleDosage: {
    fontSize: 15,
    marginTop: 2,
  },
  scheduleToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 15,
  },
  timeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineDay: {
    alignItems: 'center',
    gap: 8,
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  dayIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  dayDate: {
    fontSize: 13,
  },
  logSummary: {
    paddingVertical: 12,
    marginBottom: 8,
  },
  logSummaryText: {
    fontSize: 15,
    fontWeight: '500',
  },
  logItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logItemLeft: {
    flex: 1,
  },
  logDate: {
    fontSize: 17,
    fontWeight: '500',
  },
  logTime: {
    fontSize: 15,
    marginTop: 2,
  },
  logItemRight: {
    alignItems: 'flex-end',
  },
  logAmount: {
    fontSize: 17,
    fontWeight: '500',
  },
  logNotes: {
    fontSize: 13,
    marginTop: 2,
    maxWidth: 150,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 24,
  },
  viewAllButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 17,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  modalCancelButton: {
    fontSize: 17,
    fontWeight: '400',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalSaveButton: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
  },
  modalSection: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalValue: {
    fontSize: 17,
    fontWeight: '400',
  },
  dateTimeButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalInput: {
    fontSize: 17,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalTextArea: {
    fontSize: 17,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 100,
  },
  archiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  archiveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  archiveHint: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
});
