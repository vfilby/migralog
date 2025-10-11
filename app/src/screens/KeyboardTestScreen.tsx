import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Keyboard,
} from 'react-native';

export default function KeyboardTestScreen() {
  const [text, setText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const shouldScrollOnKeyboard = useRef(false);

  useEffect(() => {
    // Listen for keyboard show event
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        if (shouldScrollOnKeyboard.current) {
          // Scroll to end when keyboard is fully shown
          scrollViewRef.current?.scrollToEnd({ animated: true });
          shouldScrollOnKeyboard.current = false;
        }
      }
    );

    return () => {
      keyboardDidShowListener.remove();
    };
  }, []);

  const handleTextInputFocus = () => {
    // Set flag to scroll when keyboard appears
    shouldScrollOnKeyboard.current = true;
  };

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Keyboard Test</Text>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Long content to force scrolling */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Section 1</Text>
          <View style={styles.box} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Section 2</Text>
          <View style={styles.box} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Section 3</Text>
          <View style={styles.box} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Section 4</Text>
          <View style={styles.box} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Section 5</Text>
          <View style={styles.box} />
        </View>

        {/* Text input at the bottom */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (in scrollable content)</Text>
          <TextInput
            style={styles.textInput}
            multiline
            numberOfLines={4}
            placeholder="Type here..."
            value={text}
            onChangeText={setText}
            onFocus={handleTextInputFocus}
            returnKeyType="done"
            blurOnSubmit={true}
          />
        </View>

        {/* Small spacer */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Fixed Footer - wrapped in KeyboardAvoidingView */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.footer}>
          <TouchableOpacity style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Save Button (Fixed Footer)</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    backgroundColor: '#1c1c1e',
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
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
    color: '#999',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  box: {
    height: 150,
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
  },
  textInput: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  footer: {
    backgroundColor: '#1c1c1e',
    padding: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
