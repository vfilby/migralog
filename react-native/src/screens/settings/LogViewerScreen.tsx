import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../theme';
import { logger, LogEntry, LogLevel } from '../../utils/logger';

type Props = NativeStackScreenProps<RootStackParamList, 'LogViewerScreen'>;

const LOG_LEVEL_FILTERS: LogLevel[] = [
  LogLevel.DEBUG,
  LogLevel.INFO,
  LogLevel.WARN,
  LogLevel.ERROR,
];

export default function LogViewerScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<LogLevel>(LogLevel.DEBUG);
  const [searchText, setSearchText] = useState('');
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  // Load logs
  const loadLogs = useCallback(() => {
    const allLogs = logger.getLogs();
    setLogs(allLogs);
  }, []);

  // Filter logs based on level and search text
  useEffect(() => {
    let filtered = logs;

    // Filter by level - show selected level and all higher severity levels
    // Log level hierarchy: DEBUG (0) < INFO (1) < WARN (2) < ERROR (3)
    filtered = filtered.filter(log => log.level >= selectedLevel);

    // Filter by search text
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(searchLower) ||
        LogLevel[log.level].toLowerCase().includes(searchLower) ||
        (log.stack && log.stack.toLowerCase().includes(searchLower))
      );
    }

    setFilteredLogs(filtered);
  }, [logs, selectedLevel, searchText]);

  // Initial load
  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Pull to refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadLogs();
    setRefreshing(false);
  }, [loadLogs]);

  // Toggle log expansion
  const toggleLogExpansion = useCallback((logId: string) => {
    setExpandedLogIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  }, []);

  // Clear logs with confirmation
  const handleClearLogs = useCallback(() => {
    Alert.alert(
      'Clear All Logs',
      'Are you sure you want to clear all logs? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            logger.clearLogs();
            loadLogs();
            setExpandedLogIds(new Set());
          },
        },
      ]
    );
  }, [loadLogs]);

  // Export logs
  const handleExportLogs = useCallback(async () => {
    try {
      await logger.shareLogs();
    } catch {
      Alert.alert('Export Failed', 'Failed to export logs. Please try again.');
    }
  }, []);

  // Get color for log level
  const getLogLevelColor = (level: LogLevel): string => {
    switch (level) {
      case LogLevel.DEBUG:
        return theme.textSecondary;
      case LogLevel.INFO:
        return theme.primary;
      case LogLevel.WARN:
        return theme.warning;
      case LogLevel.ERROR:
        return theme.error;
      default:
        return theme.text;
    }
  };

  // Format timestamp
  const formatTimestamp = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
  };

  // Render log item
  const renderLogItem = ({ item }: { item: LogEntry }) => {
    const isExpanded = expandedLogIds.has(item.id);
    const levelColor = getLogLevelColor(item.level);
    const hasDetails = item.context || item.stack;

    return (
      <TouchableOpacity
        style={styles.logItem}
        onPress={() => hasDetails && toggleLogExpansion(item.id)}
        activeOpacity={hasDetails ? 0.7 : 1}
        accessibilityRole="button"
        accessibilityLabel={`Log entry: ${LogLevel[item.level]} - ${item.message}`}
        accessibilityHint={hasDetails ? 'Tap to expand and view details' : undefined}
      >
        {/* Header */}
        <View style={styles.logHeader}>
          <View style={styles.logHeaderLeft}>
            <View style={[styles.logLevelBadge, { backgroundColor: levelColor + '20' }]}>
              <Text style={[styles.logLevelText, { color: levelColor }]}>
                {LogLevel[item.level]}
              </Text>
            </View>
            <Text style={styles.logTimestamp}>{formatTimestamp(item.timestamp)}</Text>
          </View>
          {hasDetails && (
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={theme.textSecondary}
            />
          )}
        </View>

        {/* Message */}
        <Text style={styles.logMessage} numberOfLines={isExpanded ? undefined : 2}>
          {item.message}
        </Text>

        {/* Expanded details */}
        {isExpanded && (
          <View style={styles.logDetails}>
            {item.context && (
              <View style={styles.logDetailSection}>
                <Text style={styles.logDetailTitle}>Context:</Text>
                <View style={styles.logDetailContent}>
                  <Text style={styles.logDetailText}>
                    {JSON.stringify(item.context, null, 2)}
                  </Text>
                </View>
              </View>
            )}
            {item.stack && (
              <View style={styles.logDetailSection}>
                <Text style={styles.logDetailTitle}>Stack Trace:</Text>
                <View style={styles.logDetailContent}>
                  <Text style={styles.logDetailText}>{item.stack}</Text>
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
      <Ionicons name="document-text-outline" size={64} color={theme.textTertiary} />
      <Text style={styles.emptyStateTitle}>No Logs Found</Text>
      <Text style={styles.emptyStateDescription}>
        {searchText || selectedLevel !== LogLevel.DEBUG
          ? 'Try adjusting your filters'
          : 'App logs will appear here as they are generated'}
      </Text>
    </View>
  );

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
            App Logs
          </Text>
          <View style={styles.headerSide}>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={handleExportLogs}
                style={styles.headerActionButton}
                accessibilityRole="button"
                accessibilityLabel="Export logs"
                accessibilityHint="Share logs via native share sheet"
              >
                <Ionicons name="share-outline" size={22} color={theme.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleClearLogs}
                style={styles.headerActionButton}
                accessibilityRole="button"
                accessibilityLabel="Clear all logs"
                accessibilityHint="Delete all stored logs with confirmation"
              >
                <Ionicons name="trash-outline" size={22} color={theme.error} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Log count badge */}
        {logs.length > 0 && (
          <View style={styles.logCountBadge}>
            <Text style={styles.logCountText}>
              {filteredLogs.length} of {logs.length} logs
            </Text>
          </View>
        )}
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search logs..."
          placeholderTextColor={theme.textTertiary}
          value={searchText}
          onChangeText={setSearchText}
          accessibilityLabel="Search logs"
          accessibilityHint="Filter logs by message content"
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

      {/* Level filter strip */}
      <View style={styles.filterContainer}>
        <View style={styles.filterStrip}>
          {LOG_LEVEL_FILTERS.map((level, index) => {
            // A level is "active" if it's >= selected level (inclusive filtering)
            const isActive = level >= selectedLevel;
            const levelName = LogLevel[level];
            // Count logs at this level and all higher severity levels
            const count = logs.filter(log => log.level >= level).length;

            // Determine border radius based on position
            const isFirst = index === 0;
            const isLast = index === LOG_LEVEL_FILTERS.length - 1;

            return (
              <TouchableOpacity
                key={levelName}
                style={[
                  styles.filterButton,
                  isActive && styles.filterButtonActive,
                  isFirst && styles.filterButtonFirst,
                  isLast && styles.filterButtonLast,
                ]}
                onPress={() => setSelectedLevel(level)}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${levelName}`}
                accessibilityState={{ selected: level === selectedLevel }}
                accessibilityHint={`Shows ${levelName} and all higher severity logs`}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    isActive && styles.filterButtonTextActive,
                  ]}
                >
                  {levelName}
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

      {/* Log list */}
      <FlatList
        data={filteredLogs}
        renderItem={renderLogItem}
        keyExtractor={item => item.id}
        contentContainerStyle={[
          styles.listContent,
          filteredLogs.length === 0 && styles.listContentEmpty,
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
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerActionButton: {
      padding: 4,
    },
    logCountBadge: {
      marginTop: 12,
      alignSelf: 'center',
      backgroundColor: theme.background,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    logCountText: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '500',
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
      fontSize: 13,
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
    logItem: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    logHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    logHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    logLevelBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    logLevelText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    logTimestamp: {
      fontSize: 12,
      color: theme.textSecondary,
      fontFamily: 'Menlo, Monaco, Courier New, monospace',
    },
    logMessage: {
      fontSize: 14,
      color: theme.text,
      lineHeight: 20,
    },
    logDetails: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    logDetailSection: {
      marginBottom: 12,
    },
    logDetailTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 6,
    },
    logDetailContent: {
      backgroundColor: theme.background,
      borderRadius: 8,
      padding: 10,
    },
    logDetailText: {
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
  });
