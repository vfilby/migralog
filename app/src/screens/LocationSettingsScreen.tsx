import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../theme';
import { locationService } from '../services/locationService';

type Props = NativeStackScreenProps<RootStackParamList, 'LocationSettingsScreen'>;

export default function LocationSettingsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);

  useEffect(() => {
    loadLocationStatus();
  }, []);

  const loadLocationStatus = async () => {
    try {
      const hasPermission = await locationService.checkPermission();
      setLocationPermission(hasPermission);
    } catch (error) {
      logger.error('Failed to load location permission:', error);
    }
  };

  const handleRequestLocationPermission = async () => {
    try {
      const granted = await locationService.requestPermission();
      setLocationPermission(granted);

      if (granted) {
        Alert.alert('Success', 'Location permission granted. The app will now capture your location when you start a new episode.');
      } else {
        Alert.alert(
          'Permission Denied',
          'Location permission is optional. The app will work without it, but you won\'t see location data in your episode history.'
        );
      }
    } catch (error) {
      logger.error('Failed to request location permission:', error);
      Alert.alert('Error', 'Failed to request location permission');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerSide}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.backButton}>Settings</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            Location
          </Text>
          <View style={styles.headerSide} />
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location Permissions</Text>
          <Text style={styles.sectionDescription}>
            Allow the app to capture your location when starting episodes (optional)
          </Text>

          <View style={styles.diagnosticCard}>
            <View style={styles.diagnosticRow}>
              <View style={styles.diagnosticLeft}>
                <Ionicons
                  name="location-outline"
                  size={20}
                  color={theme.textSecondary}
                />
                <Text style={styles.diagnosticLabel}>Status</Text>
              </View>
              <View style={styles.diagnosticRight}>
                {locationPermission === null ? (
                  <Text style={styles.diagnosticValueSecondary}>Checking...</Text>
                ) : locationPermission ? (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                    <Text style={styles.diagnosticValueSuccess}>Enabled</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="close-circle" size={18} color={theme.error} />
                    <Text style={styles.diagnosticValueError}>Disabled</Text>
                  </>
                )}
              </View>
            </View>
          </View>

          {!locationPermission && (
            <View style={styles.developerActions}>
              <TouchableOpacity
                style={styles.developerButton}
                onPress={handleRequestLocationPermission}
                accessibilityRole="button"
                accessibilityLabel="Enable location"
                accessibilityHint="Requests permission to access your location when starting episodes"
              >
                <Ionicons name="location-outline" size={24} color={theme.primary} />
                <Text style={styles.developerButtonText}>Enable Location</Text>
              </TouchableOpacity>
            </View>
          )}

          {locationPermission && (
            <View style={styles.infoCard}>
              <Ionicons name="information-circle-outline" size={24} color={theme.primary} style={styles.infoIcon} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>Location Data Privacy</Text>
                <Text style={styles.infoText}>
                  Location data is stored locally on your device and is only captured when you start a new episode.
                  This data helps you track patterns in your migraine episodes based on where they occur.
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    backgroundColor: theme.card,
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    minHeight: 80,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerSide: {
    minWidth: 60,
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
    flexShrink: 1,
    flexGrow: 1,
    textAlign: 'center',
  },
  backButton: {
    fontSize: 17,
    color: theme.primary,
    paddingVertical: 4,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 15,
    color: theme.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  diagnosticCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  diagnosticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  diagnosticLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  diagnosticRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  diagnosticLabel: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '500',
  },
  diagnosticValueSecondary: {
    fontSize: 15,
    color: theme.textSecondary,
  },
  diagnosticValueSuccess: {
    fontSize: 15,
    color: theme.success,
    fontWeight: '500',
  },
  diagnosticValueError: {
    fontSize: 15,
    color: theme.error,
    fontWeight: '500',
  },
  developerActions: {
    gap: 12,
  },
  developerButton: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  developerButtonText: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '500',
    flex: 1,
  },
  infoCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: 'row',
    gap: 12,
  },
  infoIcon: {
    marginTop: 2,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
});
