import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ScheduleFrequency, MedicationSchedule } from '../../models/types';
import { useTheme, ThemeColors } from '../../theme';

interface MedicationScheduleManagerProps {
  scheduleFrequency: ScheduleFrequency;
  schedules: Omit<MedicationSchedule, 'id' | 'medicationId'>[];
  onSchedulesChange: (schedules: Omit<MedicationSchedule, 'id' | 'medicationId'>[]) => void;
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    marginTop: 24,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 12,
  },
  scheduleItem: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  scheduleFields: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  timeField: {
    flex: 2,
  },
  dosageField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 6,
  },
  timeButton: {
    backgroundColor: theme.borderLight,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '500',
  },
  timeInput: {
    backgroundColor: theme.borderLight,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.text,
  },
  dosageInput: {
    backgroundColor: theme.borderLight,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.text,
    textAlign: 'center',
  },
  removeButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  removeButtonText: {
    fontSize: 14,
    color: theme.danger,
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.border,
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 15,
    color: theme.primary,
    fontWeight: '600',
  },
  timePickerContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
});

export default function MedicationScheduleManager({
  scheduleFrequency,
  schedules,
  onSchedulesChange,
}: MedicationScheduleManagerProps) {
  const { theme, isDark } = useTheme();
  const styles = createStyles(theme);
  const [editingScheduleIndex, setEditingScheduleIndex] = useState<number | null>(null);
  const [selectedDateScheduleIndex, setSelectedDateScheduleIndex] = useState<number | null>(null);
  // Track text input values separately to allow natural editing (including empty strings)
  const [dosageInputs, setDosageInputs] = useState<{ [key: number]: string }>({});

  const handleAddSchedule = () => {
    const today = new Date();
    const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Get device's current timezone as default
    const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const newSchedule = {
      time: scheduleFrequency === 'daily' ? '09:00' : dateString,
      timezone: deviceTimezone,
      dosage: 1,
      enabled: true,
    };
    onSchedulesChange([...schedules, newSchedule]);
  };

  const handleRemoveSchedule = (index: number) => {
    const updated = schedules.filter((_, i) => i !== index);
    onSchedulesChange(updated);
  };

  const handleTimeChange = (index: number, time: string) => {
    const updated = [...schedules];
    updated[index] = { ...updated[index], time };
    onSchedulesChange(updated);
  };

  const handleDosageChange = (index: number, dosage: string) => {
    // Update local input state to allow natural editing (including empty strings)
    setDosageInputs(prev => ({ ...prev, [index]: dosage }));

    // Only update the actual schedule if the value is valid
    // This allows users to clear the field without validation blocking them
    if (dosage.trim() === '') {
      return; // Don't update schedule yet - wait for onBlur
    }

    const dosageNum = parseFloat(dosage);
    if (isNaN(dosageNum) || dosageNum <= 0) {
      return; // Invalid input - don't update schedule yet
    }

    const updated = [...schedules];
    updated[index] = { ...updated[index], dosage: dosageNum };
    onSchedulesChange(updated);
  };

  const handleDosageBlur = (index: number) => {
    // When user finishes editing, ensure we have a valid value
    const currentInput = dosageInputs[index];
    const dosageNum = parseFloat(currentInput);

    // If empty or invalid, reset to schedule's current value (or 1 as default)
    if (!currentInput || currentInput.trim() === '' || isNaN(dosageNum) || dosageNum <= 0) {
      const updated = [...schedules];
      const defaultValue = updated[index]?.dosage || 1;
      updated[index] = { ...updated[index], dosage: defaultValue };
      onSchedulesChange(updated);

      // Update local state to reflect the valid value
      setDosageInputs(prev => ({ ...prev, [index]: defaultValue.toString() }));
    }
  };

  const handleTimePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setEditingScheduleIndex(null);
    }

    if (selectedDate && editingScheduleIndex !== null) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      handleTimeChange(editingScheduleIndex, `${hours}:${minutes}`);
    }
  };

  const toggleTimePicker = (index: number) => {
    setEditingScheduleIndex(editingScheduleIndex === index ? null : index);
  };

  const handleDatePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setSelectedDateScheduleIndex(null);
    }

    if (selectedDate && selectedDateScheduleIndex !== null) {
      const dateString = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
      handleTimeChange(selectedDateScheduleIndex, dateString);
    }
  };

  const toggleDatePicker = (index: number) => {
    setSelectedDateScheduleIndex(selectedDateScheduleIndex === index ? null : index);
  };

  const getFrequencyLabel = () => {
    switch (scheduleFrequency) {
      case 'daily':
        return 'Daily Schedules';
      case 'monthly':
        return 'Monthly Schedules';
      case 'quarterly':
        return 'Quarterly Schedules';
    }
  };

  const getTimeLabel = () => {
    switch (scheduleFrequency) {
      case 'daily':
        return 'Time';
      case 'monthly':
        return 'Last Date Taken';
      case 'quarterly':
        return 'Last Date Taken';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{getFrequencyLabel()}</Text>
      <Text style={styles.subtitle}>
        {scheduleFrequency === 'daily' && 'Add times when you take this medication each day'}
        {scheduleFrequency === 'monthly' && 'Select the date you last took this medication'}
        {scheduleFrequency === 'quarterly' && 'Select the date you last took this medication'}
      </Text>

      {schedules.map((schedule, index) => (
        <View key={index} style={styles.scheduleItem}>
          <View style={styles.scheduleFields}>
            <View style={styles.timeField}>
              <Text style={styles.fieldLabel}>{getTimeLabel()}</Text>
              {scheduleFrequency === 'daily' ? (
                <>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => toggleTimePicker(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`Time: ${schedule.time}`}
                    accessibilityHint="Double tap to change the medication time"
                  >
                    <Text style={styles.timeButtonText}>{schedule.time}</Text>
                  </TouchableOpacity>
                  {editingScheduleIndex === index && (
                    <View style={styles.timePickerContainer}>
                      <DateTimePicker
                        value={(() => {
                          const [hours, minutes] = schedule.time.split(':');
                          const date = new Date();
                          date.setHours(parseInt(hours, 10));
                          date.setMinutes(parseInt(minutes, 10));
                          return date;
                        })()}
                        mode="time"
                        is24Hour={false}
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleTimePickerChange}
                        themeVariant={isDark ? 'dark' : 'light'}
                      />
                    </View>
                  )}
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => toggleDatePicker(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`Date: ${schedule.time}`}
                    accessibilityHint="Double tap to change the date last taken"
                  >
                    <Text style={styles.timeButtonText}>{schedule.time}</Text>
                  </TouchableOpacity>
                  {selectedDateScheduleIndex === index && (
                    <View style={styles.timePickerContainer}>
                      <DateTimePicker
                        value={(() => {
                          try {
                            return new Date(schedule.time);
                          } catch {
                            return new Date();
                          }
                        })()}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleDatePickerChange}
                        themeVariant={isDark ? 'dark' : 'light'}
                      />
                    </View>
                  )}
                </>
              )}
            </View>

            <View style={styles.dosageField}>
              <Text style={styles.fieldLabel}>Doses</Text>
              <TextInput
                style={styles.dosageInput}
                placeholder="1"
                placeholderTextColor={theme.textTertiary}
                value={dosageInputs[index] !== undefined ? dosageInputs[index] : schedule.dosage.toString()}
                onChangeText={(value) => handleDosageChange(index, value)}
                onBlur={() => handleDosageBlur(index)}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveSchedule(index)}
            accessibilityRole="button"
            accessibilityLabel="Remove schedule"
            accessibilityHint="Double tap to remove this medication schedule"
          >
            <Text style={styles.removeButtonText}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        style={styles.addButton}
        onPress={handleAddSchedule}
        accessibilityRole="button"
        accessibilityLabel="Add schedule"
        accessibilityHint="Double tap to add a new medication schedule"
      >
        <Text style={styles.addButtonText}>+ Add Schedule</Text>
      </TouchableOpacity>
    </View>
  );
}
