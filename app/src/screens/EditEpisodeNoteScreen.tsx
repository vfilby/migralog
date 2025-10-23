import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { episodeNoteRepository } from '../database/episodeRepository';
import { EpisodeNote } from '../models/types';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useTheme, ThemeColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EditEpisodeNote'>;

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
    width: 60,
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
  noteInput: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.text,
    textAlignVertical: 'top',
    minHeight: 200,
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

export default function EditEpisodeNoteScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { noteId } = route.params;

  const [note, setNote] = useState<EpisodeNote | null>(null);
  const [timestamp, setTimestamp] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadNote = useCallback(async () => {
    try {
      setLoading(true);
      const loadedNote = await episodeNoteRepository.getById(noteId);

      if (!loadedNote) {
        Alert.alert('Error', 'Note not found');
        navigation.goBack();
        return;
      }

      setNote(loadedNote);
      setTimestamp(new Date(loadedNote.timestamp));
      setNoteText(loadedNote.note);
    } catch (error) {
      logger.error('Failed to load note:', error);
      Alert.alert('Error', 'Failed to load note');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [noteId, navigation]);

  useEffect(() => {
    loadNote();
  }, [loadNote]);

  const handleSave = async () => {
    if (!note || !timestamp) return;

    if (!noteText.trim()) {
      Alert.alert('Error', 'Please enter note text');
      return;
    }

    setSaving(true);
    try {
      await episodeNoteRepository.update(note.id, {
        timestamp: timestamp.getTime(),
        note: noteText.trim(),
      });

      navigation.goBack();
    } catch (error) {
      logger.error('Failed to update note:', error);
      Alert.alert('Error', 'Failed to update note');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!note) return;

    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await episodeNoteRepository.delete(note.id);
              navigation.goBack();
            } catch (error) {
              logger.error('Failed to delete note:', error);
              Alert.alert('Error', 'Failed to delete note');
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
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Note</Text>
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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Note</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Time</Text>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowDatePicker(true)}
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

        {/* Note Text */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Note</Text>
          <TextInput
            style={styles.noteInput}
            multiline
            numberOfLines={10}
            placeholder="Enter your note..."
            placeholderTextColor={theme.textTertiary}
            value={noteText}
            onChangeText={setNoteText}
            autoFocus
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Save and Delete Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          disabled={saving}
        >
          <Text style={styles.deleteButtonText}>Delete Note</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
