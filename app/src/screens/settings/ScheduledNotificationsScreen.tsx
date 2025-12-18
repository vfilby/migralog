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
import { medicationRepository } from '../../database/medicationRepository';
import { ScheduledNotificationMapping } from '../../types/notifications';
import { formatTimeUntil } from '../../utils/dateFormatting';
import { getShortDateTimeFormatString, getDeviceLocale } from '../../utils/localeUtils';
import { format } from 'date-fns';

type Props = NativeStackScreenProps<RootStackParamList, 'ScheduledNotificationsScreen'>;

type NotificationFilter = 'all' | 'reminder' | 'follow_up' | 'daily_checkin' | 'unmapped';

interface EnrichedNotification {
  osNotification: Notifications.NotificationRequest;
  dbMapping?: ScheduledNotificationMapping;
  medicationName?: string;
}

export default function ScheduledNotificationsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [osNotifications, setOsNotifications] = useState<Notifications.NotificationRequest[]>([]);
  const [dbMappings, setDbMappings] = useState<ScheduledNotificationMapping[]>([]);
  const [dailyCheckinMappings, setDailyCheckinMappings] = useState<ScheduledNotificationMapping[]>([]);
  const [enrichedNotifications, setEnrichedNotifications] = useState<EnrichedNotification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<EnrichedNotification[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<NotificationFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [expandedNotificationIds, setExpandedNotificationIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all data
  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [osNotes, medicationMappings, checkinMappings, activeMedications] = await Promise.all([
        notificationService.getAllScheduledNotifications(),
        scheduledNotificationRepository.getFutureMappings(),
        scheduledNotificationRepository.getFutureDailyCheckinMappings(),
        medicationRepository.getActive(),
      ]);

      setOsNotifications(osNotes);
      setDbMappings(medicationMappings);
      setDailyCheckinMappings(checkinMappings);

      // Create a map of medication IDs to names
      const medicationMap = new Map(activeMedications.map(m => [m.id, m.name]));

      // Enrich OS notifications with DB mappings
      const enriched: EnrichedNotification[] = osNotes.map(osNote => {
        // Find matching DB mapping by notification ID
        const allMappings = [...medicationMappings, ...checkinMappings];
        const mapping = allMappings.find(m => m.notificationId === osNote.identifier);

        // Get medication name if available
        const medicationName = mapping?.medicationId
          ? medicationMap.get(mapping.medicationId) || mapping.medicationName
          : undefined;

        return {
          osNotification: osNote,
          dbMapping: mapping,
          medicationName,
        };
      });

      setEnrichedNotifications(enriched);
    } catch (error) {
      logger.error('[ScheduledNotifications] Error loading data:', error);
      setError('Failed to load notifications. Please try again.');
    }
  }, []);

  // Filter notifications based on filter and search text
  useEffect(() => {
    let filtered = enrichedNotifications;

    // Filter by type
    if (selectedFilter === 'unmapped') {
      filtered = filtered.filter(n => !n.dbMapping);
    } else if (selectedFilter !== 'all') {
      filtered = filtered.filter(n =>
        n.dbMapping?.notificationType === selectedFilter
      );
    }

    // Filter by search text
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(n => {
        const title = n.osNotification.content.title?.toLowerCase() || '';
        const body = n.osNotification.content.body?.toLowerCase() || '';
        const medName = n.medicationName?.toLowerCase() || '';
        const notificationId = n.osNotification.identifier.toLowerCase();

        return (
          title.includes(searchLower) ||
          body.includes(searchLower) ||
          medName.includes(searchLower) ||
          notificationId.includes(searchLower)
        );
      });
    }

    // Sort by trigger time (soonest first)
    filtered.sort((a, b) => {
      const getTriggerTimestamp = (trigger: Notifications.NotificationTrigger | null): number => {
        if (!trigger) return Infinity;
        if ('type' in trigger && trigger.type === 'date' && 'date' in trigger && trigger.date) {
          return new Date(trigger.date).getTime();
        }
        // For calendar/daily triggers, they repeat so put them at the end
        return Infinity;
      };

      const timeA = getTriggerTimestamp(a.osNotification.trigger);
      const timeB = getTriggerTimestamp(b.osNotification.trigger);
      return timeA - timeB;
    });

    setFilteredNotifications(filtered);
  }, [enrichedNotifications, selectedFilter, searchText]);

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

  // Toggle notification expansion
  const toggleNotificationExpansion = useCallback((notificationId: string) => {
    setExpandedNotificationIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId);
      } else {
        newSet.add(notificationId);
      }
      return newSet;
    });
  }, []);

  // Format date/time for display using device locale
  const formatTriggerTime = (trigger: Notifications.NotificationTrigger | null): string => {
    if (!trigger) return 'Unknown trigger';

    if ('type' in trigger) {
      if (trigger.type === 'date') {
        // DateTriggerInput has a date property, not value
        const triggerDate = 'date' in trigger ? trigger.date : null;
        if (triggerDate) {
          const date = new Date(triggerDate);
          const locale = getDeviceLocale();
          const formatStr = getShortDateTimeFormatString();
          const formattedDate = format(date, formatStr, { locale });
          const relativeTime = formatTimeUntil(date);
          return `${formattedDate} (${relativeTime})`;
        }
      }
      if (trigger.type === 'calendar') {
        const parts: string[] = [];
        if ('hour' in trigger && trigger.hour !== undefined && 'minute' in trigger && trigger.minute !== undefined) {
          parts.push(`${trigger.hour.toString().padStart(2, '0')}:${trigger.minute.toString().padStart(2, '0')}`);
        }
        if ('weekday' in trigger && trigger.weekday !== undefined) {
          parts.push(`Weekday ${trigger.weekday}`);
        }
        return parts.join(' ') || 'Calendar trigger';
      }
      if (trigger.type === 'timeInterval' && 'seconds' in trigger) {
        const repeats = 'repeats' in trigger ? trigger.repeats : false;
        return `In ${trigger.seconds} seconds${repeats ? ' (repeating)' : ''}`;
      }
    }

    return 'Unknown trigger';
  };

  // Get notification type badge info
  const getNotificationTypeBadge = (notification: EnrichedNotification): { text: string; color: string } | null => {
    if (!notification.dbMapping) {
      return null;
    }

    const type = notification.dbMapping.notificationType;
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

  // Render notification item
  const renderNotificationItem = ({ item }: { item: EnrichedNotification }) => {
    const isExpanded = expandedNotificationIds.has(item.osNotification.identifier);
    const badge = getNotificationTypeBadge(item);
    const trigger = item.osNotification.trigger;

    return (
      <TouchableOpacity
        style={styles.notificationItem}
        onPress={() => toggleNotificationExpansion(item.osNotification.identifier)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Notification: ${item.osNotification.content.title}`}
        accessibilityHint="Tap to expand and view details"
      >
        {/* Header */}
        <View style={styles.notificationHeader}>
          <View style={styles.notificationHeaderLeft}>
            {badge && (
              <View style={[styles.typeBadge, { backgroundColor: badge.color + '20' }]}>
                <Text style={[styles.typeBadgeText, { color: badge.color }]}>
                  {badge.text}
                </Text>
              </View>
            )}
            {item.medicationName && (
              <Text style={styles.medicationName}>{item.medicationName}</Text>
            )}
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.textSecondary}
          />
        </View>

        {/* Title and Body */}
        <Text style={styles.notificationTitle} numberOfLines={isExpanded ? undefined : 1}>
          {item.osNotification.content.title || 'No title'}
        </Text>
        {item.osNotification.content.body && (
          <Text style={styles.notificationBody} numberOfLines={isExpanded ? undefined : 2}>
            {item.osNotification.content.body}
          </Text>
        )}

        {/* Scheduled Time */}
        <Text style={styles.scheduledTime}>
          {formatTriggerTime(trigger)}
        </Text>

        {/* Expanded details */}
        {isExpanded && (
          <View style={styles.notificationDetails}>
            {/* Notification ID */}
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>Notification ID:</Text>
              <View style={styles.detailContent}>
                <Text style={styles.detailText}>{item.osNotification.identifier}</Text>
              </View>
            </View>

            {/* Trigger Details */}
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>Trigger:</Text>
              <View style={styles.detailContent}>
                <Text style={styles.detailText}>
                  {JSON.stringify(trigger, null, 2)}
                </Text>
              </View>
            </View>

            {/* Notification Settings */}
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>Settings:</Text>
              <View style={styles.detailContent}>
                <Text style={styles.detailText}>
                  {`Category: ${item.osNotification.content.categoryIdentifier || 'none'}\n`}
                  {/* iOS-specific properties - type checking */}
                  {'interruptionLevel' in item.osNotification.content && item.osNotification.content.interruptionLevel &&
                    `Interruption Level: ${item.osNotification.content.interruptionLevel}\n`}
                  {'critical' in item.osNotification.content && item.osNotification.content.critical !== undefined &&
                    `Critical: ${item.osNotification.content.critical}`}
                </Text>
              </View>
            </View>

            {/* Data Payload */}
            {item.osNotification.content.data && Object.keys(item.osNotification.content.data).length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailTitle}>Data Payload:</Text>
                <View style={styles.detailContent}>
                  <Text style={styles.detailText}>
                    {JSON.stringify(item.osNotification.content.data, null, 2)}
                  </Text>
                </View>
              </View>
            )}

            {/* DB Mapping Info */}
            {item.dbMapping && (
              <View style={styles.detailSection}>
                <Text style={styles.detailTitle}>Database Mapping:</Text>
                <View style={styles.detailContent}>
                  <Text style={styles.detailText}>
                    {`Date: ${item.dbMapping.date}\n`}
                    {item.dbMapping.medicationId && `Medication ID: ${item.dbMapping.medicationId}\n`}
                    {item.dbMapping.scheduleId && `Schedule ID: ${item.dbMapping.scheduleId}\n`}
                    {`Type: ${item.dbMapping.notificationType}\n`}
                    {`Grouped: ${item.dbMapping.isGrouped ? 'Yes' : 'No'}\n`}
                    {item.dbMapping.groupKey && `Group Key: ${item.dbMapping.groupKey}\n`}
                    {`Source: ${item.dbMapping.sourceType}`}
                  </Text>
                </View>
              </View>
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
      all: enrichedNotifications.length,
      reminder: 0,
      follow_up: 0,
      daily_checkin: 0,
      unmapped: 0,
    };

    enrichedNotifications.forEach(n => {
      const type = n.dbMapping?.notificationType;
      if (!n.dbMapping) counts.unmapped++;
      else if (type === 'reminder') counts.reminder++;
      else if (type === 'follow_up') counts.follow_up++;
      else if (type === 'daily_checkin') counts.daily_checkin++;
    });

    return counts;
  }, [enrichedNotifications]);

  const FILTERS: NotificationFilter[] = ['all', 'reminder', 'follow_up', 'daily_checkin', 'unmapped'];
  const FILTER_LABELS: Record<NotificationFilter, string> = {
    all: 'All',
    reminder: 'Remind',
    follow_up: 'Follow',
    daily_checkin: 'Check-in',
    unmapped: 'Other',
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
            <Text style={styles.statValue}>{osNotifications.length}</Text>
            <Text style={styles.statLabel}>OS Notifications</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{dbMappings.length}</Text>
            <Text style={styles.statLabel}>DB Mappings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{dailyCheckinMappings.length}</Text>
            <Text style={styles.statLabel}>Daily Check-ins</Text>
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
        data={filteredNotifications}
        renderItem={renderNotificationItem}
        keyExtractor={item => item.osNotification.identifier}
        contentContainerStyle={[
          styles.listContent,
          filteredNotifications.length === 0 && styles.listContentEmpty,
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
