import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useDailyStatusStore } from '../store/dailyStatusStore';
import { DailyStatusLog } from '../models/types';
import { useTheme, ThemeColors } from '../theme';
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
} from 'date-fns';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface MonthlyCalendarViewProps {
  initialDate?: Date;
}

const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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
    dayNumber: {
      fontSize: 14,
      color: theme.text,
    },
    dayNumberFuture: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    statusIndicator: {
      fontSize: 20,
      marginBottom: 2,
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
    legendEmoji: {
      fontSize: 14,
    },
    legendText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    loading: {
      paddingVertical: 40,
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

  useEffect(() => {
    loadMonthData();
  }, [currentMonth]);

  // Reload data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadMonthData();
    });

    return unsubscribe;
  }, [navigation, currentMonth]);

  const loadMonthData = async () => {
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    await loadDailyStatuses(start, end);
  };

  const handlePreviousMonth = () => {
    setCurrentMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, 1));
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

  const renderStatusIndicator = (status?: DailyStatusLog) => {
    if (!status) return null;

    switch (status.status) {
      case 'green':
        return <Text style={styles.statusIndicator}>🟢</Text>;
      case 'yellow':
        return <Text style={styles.statusIndicator}>🟡</Text>;
      case 'red':
        return <Text style={styles.statusIndicator}>🔴</Text>;
      default:
        return null;
    }
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
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const today = startOfDay(new Date());
              const selectedDay = startOfDay(day);
              const isFuture = isAfter(selectedDay, today);

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.dayCell,
                    !isCurrentMonth && styles.dayCellOtherMonth,
                    isFuture && styles.dayCellFuture,
                  ]}
                  onPress={() => handleDayPress(day, dateStr)}
                  disabled={isFuture}
                  testID={`calendar-day-${dateStr}`}
                >
                  {renderStatusIndicator(status)}
                  <Text style={isFuture ? styles.dayNumberFuture : styles.dayNumber}>
                    {format(day, 'd')}
                  </Text>
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
          style={styles.navButton}
          testID="next-month-button"
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
          <Text style={styles.legendEmoji}>🟢</Text>
          <Text style={styles.legendText}>Clear</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={styles.legendEmoji}>🟡</Text>
          <Text style={styles.legendText}>Not Clear</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={styles.legendEmoji}>🔴</Text>
          <Text style={styles.legendText}>Episode</Text>
        </View>
      </View>
    </View>
  );
}
