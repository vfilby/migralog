import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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
  const suggestionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const justSelectedRef = useRef(false);

  const suggestions = value.trim() ? searchMedications(value) : [];
  const hasMatches = suggestions.length > 0;

  // Delay showing suggestions to let iOS keyboard settle
  useEffect(() => {
    if (suggestionTimerRef.current) {
      clearTimeout(suggestionTimerRef.current);
    }

    // Don't show suggestions if we just made a selection
    if (justSelectedRef.current) {
      setShowSuggestions(false);
      return;
    }

    if (value.trim()) {
      suggestionTimerRef.current = setTimeout(() => {
        setShowSuggestions(true);
      }, 300);
    } else {
      setShowSuggestions(false);
    }

    return () => {
      if (suggestionTimerRef.current) {
        clearTimeout(suggestionTimerRef.current);
      }
    };
  }, [value]);

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Don't hide suggestions on blur - let user tap them with on-screen keyboard
  };

  const handleSelectSuggestion = (medication: PresetMedication) => {
    // Mark that we just made a selection to prevent suggestions from re-appearing
    justSelectedRef.current = true;

    // Hide suggestions and dismiss keyboard immediately
    setShowSuggestions(false);
    Keyboard.dismiss();

    // Populate all fields via the preset handler (including name)
    onSelectPreset(medication);
  };

  const handleTextChange = (text: string) => {
    // Reset the selection flag when user starts typing again
    justSelectedRef.current = false;
    onChangeText(text);
    // Suggestion visibility is now managed by useEffect with delay
  };

  const renderSuggestion = ({ item, index }: { item: PresetMedication; index: number }) => {
    const isLast = index === suggestions.length - 1;

    // Use Gesture Handler to bypass React Native's touch system
    const tapGesture = Gesture.Tap().onStart(() => {
      handleSelectSuggestion(item);
    });

    return (
      <GestureDetector gesture={tapGesture}>
        <View
          style={[
            styles.suggestionItem,
            isLast && styles.suggestionItemLast,
          ]}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Select ${item.name}, ${item.dosageAmount} ${item.dosageUnit}`}
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
        </View>
      </GestureDetector>
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
        accessible={true}
        accessibilityLabel="Medication name input"
        accessibilityHint="Type to search for preset medications or enter a custom name"
      />
      {showSuggestions && value.trim().length > 0 && (
        <View
          style={styles.suggestionsContainer}
          pointerEvents="box-none"
        >
          {hasMatches ? (
            <ScrollView
              keyboardShouldPersistTaps="always"
              nestedScrollEnabled={true}
              pointerEvents="auto"
            >
              {suggestions.map((item, index) => (
                <View key={`${item.name}-${index}`}>
                  {renderSuggestion({ item, index })}
                </View>
              ))}
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
