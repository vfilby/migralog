import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../theme';
import {
  getPerformanceStats,
  clearPerformanceStats,
  PerformanceStats,
  PerformanceMetric,
} from '../utils/performance';
import { format } from 'date-fns';

type Props = NativeStackScreenProps<RootStackParamList, 'Performance'>;

export default function PerformanceScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [stats, setStats] = useState<PerformanceStats>(getPerformanceStats());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        setStats(getPerformanceStats());
      }, 1000); // Refresh every second

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const handleRefresh = () => {
    setStats(getPerformanceStats());
  };

  const handleClear = () => {
    Alert.alert(
      'Clear Performance Data',
      'Are you sure you want to clear all performance metrics?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearPerformanceStats();
            setStats(getPerformanceStats());
            Alert.alert('Success', 'Performance data cleared');
          },
        },
      ]
    );
  };

  const handleExport = async () => {
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        stats,
        uptime: Date.now() - stats.appStartTime,
      };

      await Share.share({
        message: JSON.stringify(exportData, null, 2),
        title: 'Performance Data Export',
      });
    } catch {
      Alert.alert('Error', 'Failed to export performance data');
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1) return `${ms.toFixed(2)}ms`;
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getMetricColor = (metric: PerformanceMetric): string => {
    if (metric.isSlow) return '#FF3B30'; // Red
    if (metric.threshold && metric.duration > metric.threshold * 0.7) {
      return '#FF9500'; // Orange (within 70% of threshold)
    }
    return '#34C759'; // Green
  };

  const uptimeMs = Date.now() - stats.appStartTime;
  const uptimeSeconds = Math.floor(uptimeMs / 1000);
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);
  const uptimeDisplay =
    uptimeMinutes > 0
      ? `${uptimeMinutes}m ${uptimeSeconds % 60}s`
      : `${uptimeSeconds}s`;

  return (
    <View style={styles.container} testID="performance-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Performance</Text>
        <TouchableOpacity
          onPress={() => setAutoRefresh(!autoRefresh)}
          testID="auto-refresh-toggle"
        >
          <Ionicons
            name={autoRefresh ? 'pause-circle' : 'play-circle'}
            size={24}
            color={theme.primary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Summary Stats */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Session Summary</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Uptime</Text>
              <Text style={styles.statValue}>{uptimeDisplay}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Operations</Text>
              <Text style={styles.statValue}>{stats.totalOperations}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Avg Duration</Text>
              <Text style={styles.statValue}>
                {formatDuration(stats.averageDuration)}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Slow Ops</Text>
              <Text style={[styles.statValue, styles.slowOpsValue]}>
                {stats.slowOperations}
              </Text>
            </View>
          </View>
        </View>

        {/* Startup Time */}
        {stats.startupTime !== undefined && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>App Startup</Text>
            <View style={styles.startupContainer}>
              <Ionicons
                name="rocket-outline"
                size={32}
                color={
                  stats.startupTime > 2000
                    ? '#FF3B30'
                    : stats.startupTime > 1000
                      ? '#FF9500'
                      : '#34C759'
                }
              />
              <Text style={styles.startupTime}>
                {formatDuration(stats.startupTime)}
              </Text>
              <Text style={styles.startupLabel}>
                {stats.startupTime > 2000
                  ? 'Slow startup'
                  : stats.startupTime > 1000
                    ? 'Moderate startup'
                    : 'Fast startup'}
              </Text>
            </View>
          </View>
        )}

        {/* Recent Operations */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Recent Operations ({stats.metrics.length})
          </Text>
          {stats.metrics.length === 0 ? (
            <Text style={styles.emptyText}>No operations recorded yet</Text>
          ) : (
            stats.metrics.slice(0, 20).map((metric, index) => (
              <View key={`${metric.timestamp}-${index}`} style={styles.metricRow}>
                <View style={styles.metricLeft}>
                  <View
                    style={[
                      styles.metricDot,
                      { backgroundColor: getMetricColor(metric) },
                    ]}
                  />
                  <Text
                    style={styles.metricLabel}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {metric.label}
                  </Text>
                </View>
                <View style={styles.metricRight}>
                  <Text
                    style={[
                      styles.metricDuration,
                      metric.isSlow && styles.slowMetricDuration,
                    ]}
                  >
                    {formatDuration(metric.duration)}
                  </Text>
                  <Text style={styles.metricTime}>
                    {format(new Date(metric.timestamp), 'HH:mm:ss')}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsCard}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleRefresh}
            testID="refresh-button"
          >
            <Ionicons name="refresh" size={20} color={theme.primary} />
            <Text style={styles.actionButtonText}>Refresh</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleExport}
            testID="export-button"
          >
            <Ionicons name="share-outline" size={20} color={theme.primary} />
            <Text style={styles.actionButtonText}>Export</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.dangerButton]}
            onPress={handleClear}
            testID="clear-button"
          >
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            <Text style={[styles.actionButtonText, styles.dangerButtonText]}>
              Clear
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dev Note */}
        <View style={styles.devNote}>
          <Ionicons name="information-circle-outline" size={16} color={theme.textSecondary} />
          <Text style={styles.devNoteText}>
            Performance monitoring is only active in development builds
          </Text>
        </View>
      </ScrollView>
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      paddingTop: 60,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
      flex: 1,
      textAlign: 'center',
    },
    content: {
      flex: 1,
    },
    card: {
      backgroundColor: theme.card,
      margin: 16,
      marginBottom: 0,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -8,
    },
    statItem: {
      width: '50%',
      padding: 8,
      alignItems: 'center',
    },
    statLabel: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 24,
      fontWeight: '600',
      color: theme.text,
    },
    slowOpsValue: {
      color: '#FF3B30',
    },
    startupContainer: {
      alignItems: 'center',
      padding: 16,
    },
    startupTime: {
      fontSize: 32,
      fontWeight: '700',
      color: theme.text,
      marginTop: 8,
    },
    startupLabel: {
      fontSize: 15,
      color: theme.textSecondary,
      marginTop: 4,
    },
    emptyText: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: 'center',
      paddingVertical: 20,
    },
    metricRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    metricLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 12,
    },
    metricDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 8,
    },
    metricLabel: {
      fontSize: 14,
      color: theme.text,
      flex: 1,
    },
    metricRight: {
      alignItems: 'flex-end',
    },
    metricDuration: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
    slowMetricDuration: {
      color: '#FF3B30',
    },
    metricTime: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    actionsCard: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: theme.card,
      margin: 16,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      backgroundColor: theme.backgroundSecondary,
    },
    actionButtonText: {
      fontSize: 15,
      color: theme.primary,
      marginLeft: 6,
      fontWeight: '600',
    },
    dangerButton: {
      backgroundColor: 'transparent',
    },
    dangerButtonText: {
      color: '#FF3B30',
    },
    devNote: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      marginBottom: 32,
    },
    devNoteText: {
      fontSize: 13,
      color: theme.textSecondary,
      marginLeft: 6,
      fontStyle: 'italic',
    },
  });
