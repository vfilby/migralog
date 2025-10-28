import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { useTheme, ThemeColors } from '../theme';
import { PresetMedication, searchMedications, getCategoryName } from '../utils/presetMedications';

interface MedicationAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectPreset: (medication: PresetMedication) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      position: 'relative',
    },
    input: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
    },
    inputFocused: {
      borderColor: theme.primary,
    },
    suggestionsContainer: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      backgroundColor: theme.card,
      borderRadius: 12,
      marginTop: 4,
      maxHeight: 300,
      borderWidth: 1,
      borderColor: theme.border,
      zIndex: 1000,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3, // Android shadow
    },
    suggestionItem: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    suggestionItemLast: {
      borderBottomWidth: 0,
    },
    suggestionName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 2,
    },
    suggestionGeneric: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 4,
    },
    suggestionDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    suggestionDosage: {
      fontSize: 13,
      color: theme.textTertiary,
    },
    suggestionCategory: {
      fontSize: 12,
      color: theme.primary,
      fontWeight: '500',
      textTransform: 'uppercase',
    },
    emptyState: {
      padding: 16,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
    },
  });

export default function MedicationAutocomplete({
  value,
  onChangeText,
  onSelectPreset,
  placeholder = 'Medication name',
  autoFocus = false,
}: MedicationAutocompleteProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const suggestions = value.trim() ? searchMedications(value) : [];
  const hasMatches = suggestions.length > 0;

  const handleFocus = () => {
    setIsFocused(true);
    setShowSuggestions(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Delay hiding suggestions to allow tap to register
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const handleSelectSuggestion = (medication: PresetMedication) => {
    onChangeText(medication.name);
    onSelectPreset(medication);
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  const handleTextChange = (text: string) => {
    onChangeText(text);
    if (text.trim()) {
      setShowSuggestions(true);
    }
  };

  const renderSuggestion = ({ item, index }: { item: PresetMedication; index: number }) => {
    const isLast = index === suggestions.length - 1;

    return (
      <TouchableOpacity
        style={[styles.suggestionItem, isLast && styles.suggestionItemLast]}
        onPress={() => handleSelectSuggestion(item)}
        activeOpacity={0.7}
      >
        <Text style={styles.suggestionName}>{item.name}</Text>
        {item.genericName && (
          <Text style={styles.suggestionGeneric}>{item.genericName}</Text>
        )}
        <View style={styles.suggestionDetails}>
          <Text style={styles.suggestionDosage}>
            {item.dosageAmount} {item.dosageUnit}
          </Text>
          <Text style={styles.suggestionCategory}>{getCategoryName(item.category)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        style={[styles.input, isFocused && styles.inputFocused]}
        placeholder={placeholder}
        placeholderTextColor={theme.textTertiary}
        value={value}
        onChangeText={handleTextChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoFocus={autoFocus}
        autoCapitalize="words"
        autoCorrect={false}
        testID="medication-name-input"
      />
      {showSuggestions && value.trim().length > 0 && (
        <View style={styles.suggestionsContainer}>
          {hasMatches ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={false}
            >
              {suggestions.map((item, index) => renderSuggestion({ item, index }))}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                No preset medications found. {'\n'}
                Type a custom name to continue.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
