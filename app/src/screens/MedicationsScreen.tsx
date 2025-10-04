import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useMedicationStore } from '../store/medicationStore';

export default function MedicationsScreen() {
  const { preventativeMedications, rescueMedications, loadMedications, loading } = useMedicationStore();

  useEffect(() => {
    loadMedications();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Medications</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Preventative Medications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preventative</Text>
          {preventativeMedications.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No preventative medications</Text>
            </View>
          ) : (
            preventativeMedications.map(med => (
              <TouchableOpacity key={med.id} style={styles.medicationCard}>
                <View style={styles.medicationHeader}>
                  <Text style={styles.medicationName}>{med.name}</Text>
                </View>
                <View style={styles.medicationDetails}>
                  <Text style={styles.dosageText}>
                    {med.defaultDosage || 1} × {med.dosageAmount}{med.dosageUnit}
                  </Text>
                  {med.frequency && (
                    <Text style={styles.frequencyText}>{med.frequency}</Text>
                  )}
                </View>
                {med.notes && (
                  <Text style={styles.notes} numberOfLines={2}>{med.notes}</Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Rescue Medications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rescue</Text>
          {rescueMedications.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No rescue medications</Text>
            </View>
          ) : (
            rescueMedications.map(med => (
              <TouchableOpacity key={med.id} style={styles.medicationCard}>
                <View style={styles.medicationHeader}>
                  <Text style={styles.medicationName}>{med.name}</Text>
                </View>
                <View style={styles.medicationDetails}>
                  <Text style={styles.dosageText}>
                    {med.defaultDosage || 1} × {med.dosageAmount}{med.dosageUnit}
                  </Text>
                </View>
                {med.notes && (
                  <Text style={styles.notes} numberOfLines={2}>{med.notes}</Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        <TouchableOpacity style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Add Medication</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#000',
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
    color: '#000',
    marginBottom: 12,
  },
  medicationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  medicationHeader: {
    marginBottom: 8,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  medicationDetails: {
    gap: 4,
  },
  dosageText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  frequencyText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  notes: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#8E8E93',
  },
  addButton: {
    backgroundColor: '#007AFF',
    margin: 16,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
