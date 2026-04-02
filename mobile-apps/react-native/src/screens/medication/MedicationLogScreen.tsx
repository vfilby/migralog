import React, { useEffect, useState } from 'react';
import { logger } from '../../utils/logger';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useMedicationStore } from '../../store/medicationStore';
import { MedicationDose, Medication } from '../../models/types';
import { formatDoseWithSnapshot, formatDosageWithUnit } from '../../utils/medicationFormatting';
import { formatRelativeDate } from '../../utils/dateFormatting';
import { useTheme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'MedicationLog'>;

type MedicationDoseWithDetails = MedicationDose & {
  medication?: Medication;
};

const PAGE_SIZE = 20;

export default function MedicationLogScreen({ route, navigation }: Props) {
  const { medicationId } = route.params || {};
  const { theme } = useTheme();
  const { medications, getMedicationById, getDosesByMedicationId, doses: allStoreDoses } = useMedicationStore();
  
  const [doses, setDoses] = useState<MedicationDoseWithDetails[]>([]);
  const [filteredMedicationId, setFilteredMedicationId] = useState<string | null>(medicationId || null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadInitialData();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredMedicationId]);

  const loadInitialData = async () => {
    setLoading(true);
    setCurrentPage(1);
    setHasMore(true);
    try {
      // Load first page of doses
      await loadDoses(1, true);
    } catch (error) {
      logger.error('Failed to load medication log:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDoses = async (page: number, reset: boolean = false) => {
    try {
      let dosesToUse: MedicationDose[];
      
      if (filteredMedicationId) {
        // Load doses for specific medication using store method
        dosesToUse = await getDosesByMedicationId(filteredMedicationId, 1000); // Load all doses
      } else {
        // Use doses from store state if available, or load from repository
        // Note: The store keeps recent doses (90 days), but this screen may need all doses
        // For now, we'll load from the specific medication if filtered, otherwise use store state
        dosesToUse = allStoreDoses;
      }

      // Sort by timestamp descending (most recent first)
      dosesToUse.sort((a, b) => b.timestamp - a.timestamp);

      // Paginate
      const startIndex = (page - 1) * PAGE_SIZE;
      const endIndex = startIndex + PAGE_SIZE;
      const paginatedDoses = dosesToUse.slice(startIndex, endIndex);
      
      // Check if there are more pages
      setHasMore(endIndex < dosesToUse.length);

      // Load medication details for each dose using store method
      const dosesWithDetails = paginatedDoses.map((dose) => {
        const medication = getMedicationById(dose.medicationId);
        return { ...dose, medication: medication || undefined };
      });

      if (reset) {
        setDoses(dosesWithDetails);
      } else {
        setDoses(prev => [...prev, ...dosesWithDetails]);
      }
    } catch (error) {
      logger.error('Failed to load doses:', error);
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    const nextPage = currentPage + 1;
    await loadDoses(nextPage, false);
    setCurrentPage(nextPage);
    setLoadingMore(false);
  };

  const handleFilterChange = (medId: string | null) => {
    setFilteredMedicationId(medId);
  };

  const renderFilterButton = ({ item }: { item: Medication | { id: string; name: string } }) => {
    const isActive = item.id === filteredMedicationId || (item.id === 'all' && !filteredMedicationId);
    return (
      <TouchableOpacity
        style={[
          styles.filterButton,
          { 
            backgroundColor: isActive ? theme.primary : theme.card,
            borderColor: isActive ? theme.primary : theme.border,
          }
        ]}
        onPress={() => handleFilterChange(item.id === 'all' ? null : item.id)}
        accessibilityRole="button"
        accessibilityLabel={`Filter by ${item.name}`}
        accessibilityState={{ selected: isActive }}
      >
        <Text style={[
          styles.filterButtonText,
          { color: isActive ? theme.primaryText : theme.text }
        ]}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderDoseItem = ({ item }: { item: MedicationDoseWithDetails }) => (
    <TouchableOpacity
      style={[styles.doseItem, { backgroundColor: theme.card, borderBottomColor: theme.border }]}
      onPress={() => navigation.navigate('EditMedicationDose', { doseId: item.id })}
      accessibilityRole="button"
      accessibilityLabel={`${item.medication?.name || 'Unknown medication'} dose from ${formatRelativeDate(item.timestamp)}`}
    >
      <View style={styles.doseLeft}>
        <Text style={[styles.medicationName, { color: theme.text }]}>
          {item.medication?.name || 'Unknown Medication'}
        </Text>
        <Text style={[styles.doseTime, { color: theme.textSecondary }]}>
          {formatRelativeDate(item.timestamp)}
        </Text>
      </View>
      <View style={styles.doseRight}>
        <Text style={[styles.doseAmount, { color: theme.text }]}>
          {item.medication
            ? formatDoseWithSnapshot(item, item.medication)
            : `${item.quantity} doses`}
        </Text>
        {item.medication && (
          <Text style={[styles.totalAmount, { color: theme.textSecondary }]}>
            {formatDosageWithUnit(
              item.quantity * (item.dosageAmount ?? item.medication.dosageAmount),
              item.dosageUnit ?? item.medication.dosageUnit
            )}
          </Text>
        )}
        {item.notes && (
          <Text style={[styles.doseNotes, { color: theme.textTertiary }]} numberOfLines={1}>
            {item.notes}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.primary} />
      </View>
    );
  };

  const filterOptions = [
    { id: 'all', name: 'All Medications' },
    ...medications.filter(m => m.active)
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]} testID="medication-log-screen">
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={[styles.backButton, { color: theme.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Medication Log</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Filter Pills */}
      <View style={[styles.filterContainer, { backgroundColor: theme.background }]}>
        <FlatList
          horizontal
          data={filterOptions}
          renderItem={renderFilterButton}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
        />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : doses.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="medical-outline" size={64} color={theme.textTertiary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {filteredMedicationId ? 'No doses logged for this medication' : 'No medications logged yet'}
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.textTertiary }]}>
            {filteredMedicationId ? 'Try selecting a different medication' : 'Log your first dose from the Dashboard or Episodes'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={doses}
          renderItem={renderDoseItem}
          keyExtractor={(item) => item.id}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.listContent}
        />
      )}
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  backButton: {
    fontSize: 17,
    fontWeight: '400',
    minWidth: 60,
  },
  filterContainer: {
    paddingVertical: 12,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 20,
  },
  doseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  doseLeft: {
    flex: 1,
  },
  medicationName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  doseTime: {
    fontSize: 14,
  },
  doseRight: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  doseAmount: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  totalAmount: {
    fontSize: 13,
  },
  doseNotes: {
    fontSize: 12,
    marginTop: 2,
    maxWidth: 120,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
