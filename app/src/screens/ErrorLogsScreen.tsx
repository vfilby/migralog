import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../theme';
import { errorLogger, ErrorLog } from '../services/errorLogger';
import { format } from 'date-fns';

type Props = NativeStackScreenProps<RootStackParamList, 'ErrorLogs'>;

export default function ErrorLogsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const allLogs = await errorLogger.getLogs();
      setLogs(allLogs);
    } catch (error) {
      console.error('Failed to load error logs:', error);
      Alert.alert('Error', 'Failed to load error logs');
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    Alert.alert(
      'Clear All Logs',
      'Are you sure you want to clear all error logs? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await errorLogger.clearLogs();
            setLogs([]);
            Alert.alert('Success', 'All error logs cleared');
          },
        },
      ]
    );
  };

  const toggleExpanded = (logId: string) => {
    setExpandedLogId(expandedLogId === logId ? null : logId);
  };

  const getTypeIcon = (type: ErrorLog['type']) => {
    switch (type) {
      case 'database':
        return 'server-outline';
      case 'network':
        return 'cloud-offline-outline';
      case 'storage':
        return 'save-outline';
      default:
        return 'bug-outline';
    }
  };

  const getTypeColor = (type: ErrorLog['type']) => {
    switch (type) {
      case 'database':
        return '#FF3B30';
      case 'network':
        return '#FF9500';
      case 'storage':
        return '#FFCC00';
      default:
        return theme.error;
    }
  };

  return (
    <View style={styles.container} testID="error-logs-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Error Logs</Text>
        <TouchableOpacity onPress={clearLogs} disabled={logs.length === 0}>
          <Ionicons
            name="trash-outline"
            size={22}
            color={logs.length === 0 ? theme.textTertiary : theme.error}
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : logs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle-outline" size={64} color={theme.success} />
          <Text style={styles.emptyTitle}>No Errors</Text>
          <Text style={styles.emptyDescription}>
            No error logs have been recorded yet
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <View style={styles.logsList}>
            {logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              return (
                <TouchableOpacity
                  key={log.id}
                  style={styles.logCard}
                  onPress={() => toggleExpanded(log.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.logHeader}>
                    <View style={styles.logHeaderLeft}>
                      <Ionicons
                        name={getTypeIcon(log.type)}
                        size={20}
                        color={getTypeColor(log.type)}
                      />
                      <View style={styles.logHeaderText}>
                        <Text style={styles.logType}>{log.type}</Text>
                        <Text style={styles.logTimestamp}>
                          {format(log.timestamp, 'MMM d, h:mm:ss a')}
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={theme.textSecondary}
                    />
                  </View>

                  <Text
                    style={styles.logMessage}
                    numberOfLines={isExpanded ? undefined : 2}
                  >
                    {log.message}
                  </Text>

                  {isExpanded && log.stack && (
                    <View style={styles.stackContainer}>
                      <Text style={styles.stackTitle}>Stack Trace</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                      >
                        <Text style={styles.stackTrace}>{log.stack}</Text>
                      </ScrollView>
                    </View>
                  )}

                  {isExpanded && log.context && (
                    <View style={styles.contextContainer}>
                      <Text style={styles.contextTitle}>Context</Text>
                      <Text style={styles.contextText}>
                        {JSON.stringify(log.context, null, 2)}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    backgroundColor: theme.backgroundSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  content: {
    flex: 1,
  },
  logsList: {
    padding: 16,
    gap: 12,
  },
  logCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  logHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  logHeaderText: {
    flex: 1,
  },
  logType: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  logTimestamp: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  logMessage: {
    fontSize: 15,
    color: theme.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  stackContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
  },
  stackTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stackTrace: {
    fontSize: 12,
    fontFamily: 'Courier',
    color: theme.textSecondary,
    lineHeight: 16,
    backgroundColor: theme.background,
    padding: 8,
    borderRadius: 6,
  },
  contextContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
  },
  contextTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contextText: {
    fontSize: 13,
    fontFamily: 'Courier',
    color: theme.textSecondary,
    lineHeight: 18,
    backgroundColor: theme.background,
    padding: 8,
    borderRadius: 6,
  },
});
