import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../theme';
import * as Notifications from 'expo-notifications';
import { notificationService } from '../../services/notifications/notificationService';
import { logger } from '../../utils/logger';
import { scheduledNotificationRepository } from '../../database/scheduledNotificationRepository';
import { ScheduledNotificationMapping } from '../../types/notifications';
import { formatTimeUntil } from '../../utils/dateFormatting';
import { getShortDateTimeFormatString, getDeviceLocale } from '../../utils/localeUtils';
import { format } from 'date-fns';

type Props = NativeStackScreenProps<RootStackParamList, 'ScheduledNotificationsScreen'>;

type NotificationFilter = 'all' | 'reminder' | 'follow_up' | 'daily_checkin';

interface EnrichedMapping {
  dbMapping: ScheduledNotificationMapping;
  osNotification?: Notifications.NotificationRequest;
  hasOsNotification: boolean;
}

export default function ScheduledNotificationsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [osNotificationCount, setOsNotificationCount] = useState<number>(0);
  const [dbMappingCount, setDbMappingCount] = useState<number>(0);
  const [missingOsCount, setMissingOsCount] = useState<number>(0);
  const [enrichedMappings, setEnrichedMappings] = useState<EnrichedMapping[]>([]);
  const [filteredMappings, setFilteredMappings] = useState<EnrichedMapping[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<NotificationFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [expandedMappingIds, setExpandedMappingIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all data - database mappings are the source of truth
  const loadData = useCallback(async () => {
    setError(null);
    try {
      // Use getFutureMedicationMappings (not getFutureMappings) to avoid duplicates
      // getFutureMappings returns ALL mappings including daily check-ins
      const [osNotes, medicationMappings, checkinMappings] = await Promise.all([
        notificationService.getAllScheduledNotifications(),
        scheduledNotificationRepository.getFutureMedicationMappings(),
        scheduledNotificationRepository.getFutureDailyCheckinMappings(),
      ]);

      // Create a map of OS notification IDs for quick lookup
      const osNotificationMap = new Map(osNotes.map(n => [n.identifier, n]));

      // Combine all DB mappings
      const allMappings = [...medicationMappings, ...checkinMappings];

      // Enrich DB mappings with OS notification status
      const enriched: EnrichedMapping[] = allMappings.map(mapping => {
        const osNotification = osNotificationMap.get(mapping.notificationId);
        return {
          dbMapping: mapping,
          osNotification,
          hasOsNotification: !!osNotification,
        };
      });

      // Count missing OS notifications
      const missingCount = enriched.filter(e => !e.hasOsNotification).length;

      setOsNotificationCount(osNotes.length);
      setDbMappingCount(allMappings.length);
      setMissingOsCount(missingCount);
      setEnrichedMappings(enriched);
    } catch (err) {
      logger.error('[ScheduledNotifications] Error loading data:', err);
      setError('Failed to load notifications. Please try again.');
    }
  }, []);

  // Filter and sort mappings based on filter and search text
  useEffect(() => {
    let filtered = enrichedMappings;

    // Filter by type
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(m =>
        m.dbMapping.notificationType === selectedFilter
      );
    }

    // Filter by search text
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(m => {
        const title = m.dbMapping.notificationTitle?.toLowerCase() || '';
        const body = m.dbMapping.notificationBody?.toLowerCase() || '';
        const medName = m.dbMapping.medicationName?.toLowerCase() || '';
        const notificationId = m.dbMapping.notificationId.toLowerCase();
        const date = m.dbMapping.date.toLowerCase();

        return (
          title.includes(searchLower) ||
          body.includes(searchLower) ||
          medName.includes(searchLower) ||
          notificationId.includes(searchLower) ||
          date.includes(searchLower)
        );
      });
    }

    // Sort by scheduledTriggerTime from database (soonest first)
    // Missing OS notifications sort to the top (they're problems to address)
    filtered.sort((a, b) => {
      // Missing OS notifications come first (they're issues)
      if (!a.hasOsNotification && b.hasOsNotification) return -1;
      if (a.hasOsNotification && !b.hasOsNotification) return 1;

      // Then sort by scheduled trigger time
      const timeA = a.dbMapping.scheduledTriggerTime
        ? new Date(a.dbMapping.scheduledTriggerTime).getTime()
        : Infinity;
      const timeB = b.dbMapping.scheduledTriggerTime
        ? new Date(b.dbMapping.scheduledTriggerTime).getTime()
        : Infinity;
      return timeA - timeB;
    });

    setFilteredMappings(filtered);
  }, [enrichedMappings, selectedFilter, searchText]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Toggle mapping expansion
  const toggleMappingExpansion = useCallback((mappingId: string) => {
    setExpandedMappingIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(mappingId)) {
        newSet.delete(mappingId);
      } else {
        newSet.add(mappingId);
      }
      return newSet;
    });
  }, []);

  // Format scheduled time from database mapping
  const formatScheduledTime = (mapping: ScheduledNotificationMapping): string => {
    if (mapping.scheduledTriggerTime) {
      const date = new Date(mapping.scheduledTriggerTime);
      const locale = getDeviceLocale();
      const formatStr = getShortDateTimeFormatString();
      const formattedDate = format(date, formatStr, { locale });
      const relativeTime = formatTimeUntil(date);
      return `${formattedDate} (${relativeTime})`;
    }

    // Fallback to date + groupKey if no scheduledTriggerTime
    if (mapping.groupKey) {
      return `${mapping.date} at ${mapping.groupKey}`;
    }

    return `${mapping.date} (time unknown)`;
  };

  // Get notification type badge info
  const getNotificationTypeBadge = (mapping: ScheduledNotificationMapping): { text: string; color: string } => {
    const type = mapping.notificationType;
    switch (type) {
      case 'reminder':
        return { text: 'Reminder', color: theme.primary };
      case 'follow_up':
        return { text: 'Follow-up', color: theme.warning };
      case 'daily_checkin':
        return { text: 'Daily Check-in', color: theme.success };
      default:
        return { text: type, color: theme.textSecondary };
    }
  };

  // Render mapping item (database-centric view)
  const renderMappingItem = ({ item }: { item: EnrichedMapping }) => {
    const { dbMapping, osNotification, hasOsNotification } = item;
    const isExpanded = expandedMappingIds.has(dbMapping.id);
    const badge = getNotificationTypeBadge(dbMapping);

    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !hasOsNotification && styles.notificationItemWarning,
        ]}
        onPress={() => toggleMappingExpansion(dbMapping.id)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Notification: ${dbMapping.notificationTitle || dbMapping.medicationName || 'Unknown'}`}
        accessibilityHint="Tap to expand and view details"
      >
        {/* Warning banner for missing OS notification */}
        {!hasOsNotification && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={14} color={theme.error} />
            <Text style={styles.warningText}>Missing from OS - will not fire!</Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.notificationHeader}>
          <View style={styles.notificationHeaderLeft}>
            <View style={[styles.typeBadge, { backgroundColor: badge.color + '20' }]}>
              <Text style={[styles.typeBadgeText, { color: badge.color }]}>
                {badge.text}
              </Text>
            </View>
            {dbMapping.medicationName && (
              <Text style={styles.medicationName}>{dbMapping.medicationName}</Text>
            )}
          </View>
          <View style={styles.notificationHeaderRight}>
            {hasOsNotification && (
              <Ionicons name="checkmark-circle" size={16} color={theme.success} />
            )}
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={theme.textSecondary}
            />
          </View>
        </View>

        {/* Title and Body */}
        <Text style={styles.notificationTitle} numberOfLines={isExpanded ? undefined : 1}>
          {dbMapping.notificationTitle || 'No title'}
        </Text>
        {dbMapping.notificationBody && (
          <Text style={styles.notificationBody} numberOfLines={isExpanded ? undefined : 2}>
            {dbMapping.notificationBody}
          </Text>
        )}

        {/* Scheduled Time */}
        <Text style={styles.scheduledTime}>
          {formatScheduledTime(dbMapping)}
        </Text>

        {/* Expanded details */}
        {isExpanded && (
          <View style={styles.notificationDetails}>
            {/* OS Notification Status */}
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>OS Notification Status:</Text>
              <View style={[
                styles.detailContent,
                !hasOsNotification && styles.detailContentWarning,
              ]}>
                <Text style={[
                  styles.detailText,
                  !hasOsNotification && { color: theme.error },
                ]}>
                  {hasOsNotification
                    ? `✓ Scheduled in OS (ID: ${dbMapping.notificationId})`
                    : `✗ NOT FOUND in OS scheduler!\nExpected ID: ${dbMapping.notificationId}\n\nThis notification will NOT fire. Use "Recreate All Schedules" to fix.`
                  }
                </Text>
              </View>
            </View>

            {/* Database Mapping Info */}
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>Database Mapping:</Text>
              <View style={styles.detailContent}>
                <Text style={styles.detailText}>
                  {`Mapping ID: ${dbMapping.id}\n`}
                  {`Date: ${dbMapping.date}\n`}
                  {dbMapping.scheduledTriggerTime && `Trigger Time: ${new Date(dbMapping.scheduledTriggerTime).toISOString()}\n`}
                  {dbMapping.medicationId && `Medication ID: ${dbMapping.medicationId}\n`}
                  {dbMapping.scheduleId && `Schedule ID: ${dbMapping.scheduleId}\n`}
                  {`Type: ${dbMapping.notificationType}\n`}
                  {`Grouped: ${dbMapping.isGrouped ? 'Yes' : 'No'}\n`}
                  {dbMapping.groupKey && `Group Key: ${dbMapping.groupKey}\n`}
                  {`Source: ${dbMapping.sourceType}\n`}
                  {dbMapping.categoryIdentifier && `Category: ${dbMapping.categoryIdentifier}`}
                </Text>
              </View>
            </View>

            {/* OS Notification Details (if exists) */}
            {osNotification && (
              <>
                <View style={styles.detailSection}>
                  <Text style={styles.detailTitle}>OS Trigger:</Text>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailText}>
                      {JSON.stringify(osNotification.trigger, null, 2)}
                    </Text>
                  </View>
                </View>

                {osNotification.content.data && Object.keys(osNotification.content.data).length > 0 && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailTitle}>Data Payload:</Text>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailText}>
                        {JSON.stringify(osNotification.content.data, null, 2)}
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="notifications-outline" size={64} color={theme.textTertiary} />
      <Text style={styles.emptyStateTitle}>No Scheduled Notifications</Text>
      <Text style={styles.emptyStateDescription}>
        {searchText || selectedFilter !== 'all'
          ? 'Try adjusting your filters'
          : 'Scheduled notifications will appear here'}
      </Text>
    </View>
  );

  // Calculate filter counts with memoization
  const filterCounts = useMemo(() => {
    const counts: Record<NotificationFilter, number> = {
      all: enrichedMappings.length,
      reminder: 0,
      follow_up: 0,
      daily_checkin: 0,
    };

    enrichedMappings.forEach(m => {
      const type = m.dbMapping.notificationType;
      if (type === 'reminder') counts.reminder++;
      else if (type === 'follow_up') counts.follow_up++;
      else if (type === 'daily_checkin') counts.daily_checkin++;
    });

    return counts;
  }, [enrichedMappings]);

  const FILTERS: NotificationFilter[] = ['all', 'reminder', 'follow_up', 'daily_checkin'];
  const FILTER_LABELS: Record<NotificationFilter, string> = {
    all: 'All',
    reminder: 'Remind',
    follow_up: 'Follow',
    daily_checkin: 'Check-in',
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
              <Text style={styles.backButton}>Back</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            Scheduled Notifications
          </Text>
          <View style={styles.headerSide}>
            <TouchableOpacity
              onPress={loadData}
              style={styles.headerActionButton}
              accessibilityRole="button"
              accessibilityLabel="Refresh notifications"
            >
              <Ionicons name="refresh-outline" size={22} color={theme.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{dbMappingCount}</Text>
            <Text style={styles.statLabel}>DB Mappings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{osNotificationCount}</Text>
            <Text style={styles.statLabel}>OS Scheduled</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[
              styles.statValue,
              missingOsCount > 0 && { color: theme.error },
            ]}>
              {missingOsCount}
            </Text>
            <Text style={[
              styles.statLabel,
              missingOsCount > 0 && { color: theme.error },
            ]}>
              Missing
            </Text>
          </View>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title, medication, or ID..."
          placeholderTextColor={theme.textTertiary}
          value={searchText}
          onChangeText={setSearchText}
          accessibilityLabel="Search notifications"
          accessibilityHint="Filter notifications by title, medication name, or notification ID"
        />
        {searchText.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchText('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter strip */}
      <View style={styles.filterContainer}>
        <View style={styles.filterStrip}>
          {FILTERS.map((filter, index) => {
            const isActive = filter === selectedFilter;
            const count = filterCounts[filter];
            const isFirst = index === 0;
            const isLast = index === FILTERS.length - 1;

            return (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterButton,
                  isActive && styles.filterButtonActive,
                  isFirst && styles.filterButtonFirst,
                  isLast && styles.filterButtonLast,
                ]}
                onPress={() => setSelectedFilter(filter)}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${FILTER_LABELS[filter]}${count > 0 ? `, ${count} notifications` : ''}`}
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    isActive && styles.filterButtonTextActive,
                  ]}
                >
                  {FILTER_LABELS[filter]}
                </Text>
                {count > 0 && (
                  <View
                    style={[
                      styles.filterButtonBadge,
                      isActive && styles.filterButtonBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterButtonBadgeText,
                        isActive && styles.filterButtonBadgeTextActive,
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={20} color={theme.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={() => setError(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss error"
          >
            <Ionicons name="close" size={20} color={theme.error} />
          </TouchableOpacity>
        </View>
      )}

      {/* Notification list */}
      <FlatList
        data={filteredMappings}
        renderItem={renderMappingItem}
        keyExtractor={item => item.dbMapping.id}
        contentContainerStyle={[
          styles.listContent,
          filteredMappings.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
      />
    </View>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      backgroundColor: theme.card,
      paddingHorizontal: 16,
      paddingTop: 60,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
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
    headerActionButton: {
      padding: 4,
    },
    statsContainer: {
      flexDirection: 'row',
      marginTop: 16,
      backgroundColor: theme.background,
      borderRadius: 10,
      padding: 12,
      alignItems: 'center',
      justifyContent: 'space-around',
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
    },
    statLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 2,
      textAlign: 'center',
    },
    statDivider: {
      width: 1,
      height: 30,
      backgroundColor: theme.border,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      marginHorizontal: 16,
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      gap: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: theme.text,
      paddingVertical: 4,
    },
    filterContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    filterStrip: {
      flexDirection: 'row',
      borderRadius: 10,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
    },
    filterButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
      paddingVertical: 10,
      backgroundColor: theme.card,
      borderRightWidth: 1,
      borderRightColor: theme.border,
      gap: 6,
    },
    filterButtonFirst: {
      borderTopLeftRadius: 9,
      borderBottomLeftRadius: 9,
    },
    filterButtonLast: {
      borderRightWidth: 0,
      borderTopRightRadius: 9,
      borderBottomRightRadius: 9,
    },
    filterButtonActive: {
      backgroundColor: theme.primary,
      borderRightColor: theme.primary,
    },
    filterButtonText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    filterButtonTextActive: {
      color: theme.primaryText,
    },
    filterButtonBadge: {
      backgroundColor: theme.background,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
      minWidth: 20,
      alignItems: 'center',
    },
    filterButtonBadgeActive: {
      backgroundColor: theme.primaryText + '30',
    },
    filterButtonBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    filterButtonBadgeTextActive: {
      color: theme.primaryText,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 40,
    },
    listContentEmpty: {
      flexGrow: 1,
    },
    notificationItem: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    notificationItemWarning: {
      borderColor: theme.error,
      borderWidth: 2,
      backgroundColor: theme.error + '08',
    },
    warningBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.error + '20',
      marginBottom: 8,
      marginHorizontal: -4,
      marginTop: -4,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 6,
      gap: 6,
    },
    warningText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.error,
    },
    notificationHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    notificationHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    notificationHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    typeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    typeBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    medicationName: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
      flex: 1,
    },
    notificationTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      lineHeight: 20,
      marginBottom: 4,
    },
    notificationBody: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 18,
      marginBottom: 8,
    },
    scheduledTime: {
      fontSize: 13,
      color: theme.primary,
      fontWeight: '500',
    },
    notificationDetails: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    detailSection: {
      marginBottom: 12,
    },
    detailTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 6,
    },
    detailContent: {
      backgroundColor: theme.background,
      borderRadius: 8,
      padding: 10,
    },
    detailContentWarning: {
      backgroundColor: theme.error + '15',
      borderWidth: 1,
      borderColor: theme.error + '40',
    },
    detailText: {
      fontSize: 12,
      color: theme.text,
      fontFamily: 'Menlo, Monaco, Courier New, monospace',
      lineHeight: 18,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyStateTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyStateDescription: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 40,
      lineHeight: 20,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.error + '15',
      marginHorizontal: 16,
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.error + '40',
      gap: 8,
    },
    errorText: {
      flex: 1,
      fontSize: 14,
      color: theme.error,
      lineHeight: 18,
    },
  });
