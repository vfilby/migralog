import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, DateData } from 'react-native-calendars';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useDailyStatusStore } from '../../store/dailyStatusStore';
import { useOverlayStore } from '../../store/overlayStore';
import { DailyStatusLog, CalendarOverlay, DayStatus } from '../../models/types';
import { logger } from '../../utils/logger';
import { useTheme, ThemeColors } from '../../theme';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameMonth,
  addMonths,
  subMonths,
  isAfter,
  startOfDay,
  isToday,
  isBefore,
} from 'date-fns';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface MonthlyCalendarViewProps {
  initialDate?: Date;
}

const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type OverlayPosition = 'active' | 'none';

// Inline components for rendering indicators
interface StatusIndicatorProps {
  status?: DayStatus;
  styles: ReturnType<typeof createStyles>;
}

const StatusIndicator = ({ status, styles }: StatusIndicatorProps) => {
  // Always render placeholder for consistent alignment
  if (!status) {
    return <View style={styles.statusCirclePlaceholder} />;
  }

  const colorStyle =
    status === 'green' ? styles.statusCircleGreen :
    status === 'yellow' ? styles.statusCircleYellow :
    styles.statusCircleRed;

  return <View style={[styles.statusCircle, colorStyle]} />;
};

interface OverlayLineIndicatorProps {
  position: OverlayPosition;
  styles: ReturnType<typeof createStyles>;
}

const OverlayLineIndicator = ({ position, styles }: OverlayLineIndicatorProps) => {
  // Always render a placeholder for alignment, transparent when no overlay
  if (position === 'none') {
    return <View style={styles.overlayLinePlaceholder} />;
  }

  return <View style={styles.overlayLine} />;
};

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    monthTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.text,
    },
    navButton: {
      padding: 8,
    },
    navButtonDisabled: {
      opacity: 0.3,
    },
    weekdayRow: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    weekdayCell: {
      flex: 1,
      alignItems: 'center',
    },
    weekdayText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    calendarGrid: {
      gap: 4,
    },
    calendarRow: {
      flexDirection: 'row',
      gap: 4,
    },
    dayCell: {
      flex: 1,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: theme.background,
    },
    dayCellEmpty: {
      backgroundColor: 'transparent',
    },
    dayCellOtherMonth: {
      opacity: 0.3,
    },
    dayCellFuture: {
      backgroundColor: theme.backgroundSecondary,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    dayCellToday: {
      borderWidth: 2,
      borderColor: theme.primary,
    },
    dayNumber: {
      fontSize: 14,
      color: theme.text,
    },
    dayNumberFuture: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    dayNumberToday: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.primary,
    },
    statusCircle: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginTop: 6,
      marginBottom: 2,
    },
    statusCirclePlaceholder: {
      width: 12,
      height: 12,
      marginTop: 6,
      marginBottom: 2,
      backgroundColor: 'transparent',
    },
    statusCircleGreen: {
      backgroundColor: '#4CAF50',
    },
    statusCircleYellow: {
      backgroundColor: '#FFC107',
    },
    statusCircleRed: {
      backgroundColor: '#F44336',
    },
    overlayLine: {
      width: '100%',
      height: 4,
      backgroundColor: '#9E9E9E', // Neutral grey
      marginTop: 'auto',
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
    },
    overlayLinePlaceholder: {
      width: '100%',
      height: 4,
      backgroundColor: 'transparent',
      marginTop: 'auto',
    },
    legend: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      gap: 16,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    legendCircle: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    loading: {
      paddingVertical: 40,
    },
    addOverlayButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      marginTop: 16,
      gap: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    addOverlayButtonText: {
      fontSize: 14,
      color: theme.text,
      fontWeight: '500',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.background,
    },
    modalContent: {
      flex: 1,
      paddingTop: 60,
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
    modalSaveButtonDisabled: {
      backgroundColor: theme.textTertiary,
    },
    modalSaveButtonText: {
      color: theme.primaryText,
      fontSize: 17,
      fontWeight: '600',
    },
  });

export default function MonthlyCalendarView({
  initialDate = new Date(),
}: MonthlyCalendarViewProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const navigation = useNavigation<NavigationProp>();

  const [currentMonth, setCurrentMonth] = useState(initialDate);
  const { dailyStatuses, loadDailyStatuses, loading } = useDailyStatusStore();
  const { overlays, loadOverlaysForDateRange, createOverlay } = useOverlayStore();

  // Overlay modal state
  const [showOverlayModal, setShowOverlayModal] = useState(false);
  const [savingOverlay, setSavingOverlay] = useState(false);
  const [overlayForm, setOverlayForm] = useState({
    label: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    excludeFromStats: false,
  });
  const [rangeSelectionMode, setRangeSelectionMode] = useState<'start' | 'end'>('start');

  useEffect(() => {
    loadMonthData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth]);

  // Reload data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadMonthData();
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, currentMonth]);

  const loadMonthData = async () => {
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    await Promise.all([
      loadDailyStatuses(start, end),
      loadOverlaysForDateRange(start, end),
    ]);
  };

  const handlePreviousMonth = () => {
    setCurrentMonth((prev) => subMonths(prev, 1));
  };

  // Check if we can navigate to the next month (can't go beyond current month)
  const canNavigateForward = (): boolean => {
    const today = new Date();
    const currentMonthStart = startOfMonth(currentMonth);
    const todayMonthStart = startOfMonth(today);
    return isBefore(currentMonthStart, todayMonthStart);
  };

  const handleNextMonth = () => {
    if (canNavigateForward()) {
      setCurrentMonth((prev) => addMonths(prev, 1));
    }
  };

  const handleDayPress = (date: Date, dateStr: string) => {
    // Only allow editing today or past dates
    const today = startOfDay(new Date());
    const selectedDay = startOfDay(date);

    if (isAfter(selectedDay, today)) {
      // Future date - do nothing
      return;
    }

    // Navigate to DailyStatusPrompt with the selected date
    navigation.navigate('DailyStatusPrompt', { date: dateStr });
  };

  const getStatusForDate = (dateStr: string): DailyStatusLog | undefined => {
    return dailyStatuses.find((log) => log.date === dateStr);
  };

  // Overlay handlers
  const handleAddOverlay = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setOverlayForm({
      label: '',
      startDate: today,
      endDate: today,
      notes: '',
      excludeFromStats: false,
    });
    setRangeSelectionMode('start');
    setShowOverlayModal(true);
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

    setSavingOverlay(true);
    try {
      await createOverlay(overlayForm);
      await loadMonthData(); // Reload to show new overlay
      setShowOverlayModal(false);
    } catch (error) {
      logger.error('[MonthlyCalendarView] Failed to save overlay:', error);
      Alert.alert('Error', 'Failed to save overlay. Please try again.');
    } finally {
      setSavingOverlay(false);
    }
  };

  const getOverlaysForDate = (dateStr: string): CalendarOverlay[] => {
    return overlays.filter(overlay =>
      dateStr >= overlay.startDate && dateStr <= overlay.endDate
    );
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Get the day of week for the first day (0 = Sunday, 6 = Saturday)
    const firstDayOfWeek = getDay(monthStart);

    // Create array with empty slots for days before month starts
    const calendarDays: (Date | null)[] = [
      ...Array(firstDayOfWeek).fill(null),
      ...daysInMonth,
    ];

    // Pad the end to ensure we always have complete weeks (multiples of 7)
    const totalCells = Math.ceil(calendarDays.length / 7) * 7;
    while (calendarDays.length < totalCells) {
      calendarDays.push(null);
    }

    // Group days into weeks
    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeks.push(calendarDays.slice(i, i + 7));
    }

    return (
      <View style={styles.calendarGrid}>
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.calendarRow}>
            {week.map((day, dayIndex) => {
              if (!day) {
                return (
                  <View
                    key={`empty-${weekIndex}-${dayIndex}`}
                    style={[styles.dayCell, styles.dayCellEmpty]}
                  />
                );
              }

              const dateStr = format(day, 'yyyy-MM-dd');
              const status = getStatusForDate(dateStr);
              const dayOverlays = getOverlaysForDate(dateStr);
              const hasOverlays = dayOverlays.length > 0;

              // Determine overlay position ('none' if no overlays for consistent alignment)
              const overlayPosition: OverlayPosition = hasOverlays ? 'active' : 'none';

              const isCurrentMonth = isSameMonth(day, currentMonth);
              const today = startOfDay(new Date());
              const selectedDay = startOfDay(day);
              const isFuture = isAfter(selectedDay, today);
              const isTodayDate = isToday(day);

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.dayCell,
                    !isCurrentMonth && styles.dayCellOtherMonth,
                    isFuture && styles.dayCellFuture,
                    isTodayDate && styles.dayCellToday,
                  ]}
                  onPress={() => handleDayPress(day, dateStr)}
                  disabled={isFuture}
                  testID={`calendar-day-${dateStr}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${format(day, 'MMMM d, yyyy')}${status ? `, Status: ${status.status}` : ', No status recorded'}${hasOverlays ? `, ${dayOverlays.length} overlay${dayOverlays.length > 1 ? 's' : ''}` : ''}`}
                  accessibilityHint={isFuture ? 'Future date, cannot be edited' : 'Double tap to view or edit daily status'}
                  accessibilityState={{ disabled: isFuture }}
                >
                  {/* Status circle */}
                  <StatusIndicator status={status?.status} styles={styles} />

                  {/* Day number */}
                  <Text style={isTodayDate ? styles.dayNumberToday : (isFuture ? styles.dayNumberFuture : styles.dayNumber)}>
                    {format(day, 'd')}
                  </Text>

                  {/* Overlay line at bottom (transparent placeholder when no overlay for alignment) */}
                  <OverlayLineIndicator position={overlayPosition} styles={styles} />
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with month navigation */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handlePreviousMonth}
          style={styles.navButton}
          testID="previous-month-button"
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          accessibilityHint="Double tap to view the previous month"
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={theme.primary}
          />
        </TouchableOpacity>

        <Text style={styles.monthTitle}>
          {format(currentMonth, 'MMMM yyyy')}
        </Text>

        <TouchableOpacity
          onPress={handleNextMonth}
          style={[styles.navButton, !canNavigateForward() && styles.navButtonDisabled]}
          testID="next-month-button"
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityHint={canNavigateForward() ? "Double tap to view the next month" : "Cannot navigate beyond current month"}
          disabled={!canNavigateForward()}
          accessibilityState={{ disabled: !canNavigateForward() }}
        >
          <Ionicons
            name="chevron-forward"
            size={24}
            color={theme.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Weekday headers */}
      <View style={styles.weekdayRow}>
        {DAYS_OF_WEEK.map((day, index) => (
          <View key={index} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        renderCalendar()
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendCircle, { backgroundColor: '#4CAF50' }]} />
          <Text style={styles.legendText}>Clear</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendCircle, { backgroundColor: '#FFC107' }]} />
          <Text style={styles.legendText}>Not Clear</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendCircle, { backgroundColor: '#F44336' }]} />
          <Text style={styles.legendText}>Episode</Text>
        </View>
      </View>

      {/* Add Overlay Button */}
      <TouchableOpacity
        style={styles.addOverlayButton}
        onPress={handleAddOverlay}
        testID="add-overlay-button"
      >
        <Ionicons name="add-circle-outline" size={20} color={theme.text} />
        <Text style={styles.addOverlayButtonText}>Add Overlay</Text>
      </TouchableOpacity>

      {/* Add Overlay Modal */}
      <Modal
        visible={showOverlayModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowOverlayModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowOverlayModal(false)}>
                <Text style={styles.modalCloseButton}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Overlay</Text>
              <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.modalScrollView}>
              <Text style={styles.modalLabel}>Label</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g., Sick with cold, Vacation, Stressful week"
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
                    marks[start] = { startingDay: true, color: theme.primary, textColor: theme.primaryText };
                    marks[end] = { endingDay: true, color: theme.primary, textColor: theme.primaryText };
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
                    if (selectedDate > overlayForm.endDate) {
                      setOverlayForm({ ...overlayForm, startDate: selectedDate, endDate: selectedDate });
                    } else {
                      setOverlayForm({ ...overlayForm, startDate: selectedDate });
                    }
                    setRangeSelectionMode('end');
                  } else {
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
                style={[styles.modalSaveButton, savingOverlay && styles.modalSaveButtonDisabled]}
                onPress={handleSaveOverlay}
                disabled={savingOverlay}
                testID="save-overlay-button"
              >
                <Text style={styles.modalSaveButtonText}>
                  {savingOverlay ? 'Saving...' : 'Create Overlay'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
