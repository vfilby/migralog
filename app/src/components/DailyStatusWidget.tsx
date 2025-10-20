import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme, ThemeColors } from '../theme';
import { useDailyStatusStore } from '../store/dailyStatusStore';
import { format, subDays } from 'date-fns';
import { useNavigation } from '@react-navigation/native';

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 16,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    title: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.text,
    },
    subtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 16,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
    },
    button: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      gap: 8,
    },
    greenButton: {
      backgroundColor: theme.primary,
    },
    yellowButton: {
      backgroundColor: '#F59E0B',
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    emoji: {
      fontSize: 20,
    },
    loggedContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    loggedText: {
      fontSize: 15,
      color: theme.text,
    },
    undoButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: theme.backgroundSecondary,
    },
    undoButtonText: {
      fontSize: 14,
      color: theme.primary,
      fontWeight: '500',
    },
  });

interface DailyStatusWidgetProps {
  onStatusLogged?: () => void;
}

export default function DailyStatusWidget({ onStatusLogged }: DailyStatusWidgetProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const navigation = useNavigation();
  const { logDayStatus, getDayStatus, deleteDayStatus } = useDailyStatusStore();

  const [loading, setLoading] = useState(false);
  const [yesterdayStatus, setYesterdayStatus] = useState<{ status: 'green' | 'yellow'; loggedAt: number } | null>(null);
  const [shouldShow, setShouldShow] = useState(false);

  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  useEffect(() => {
    checkStatus();

    // Re-check status when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      checkStatus();
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  const checkStatus = async () => {
    const status = await getDayStatus(yesterday);

    if (!status) {
      // No status logged yet - show the prompt
      setShouldShow(true);
      setYesterdayStatus(null);
    } else {
      // Status was logged
      const loggedAt = status.updatedAt || status.createdAt;
      const minutesSinceLogged = (Date.now() - loggedAt) / 60000;

      // Show if logged within last 15 minutes (allows undo)
      if (minutesSinceLogged <= 15) {
        setShouldShow(true);
        setYesterdayStatus({
          status: status.status as 'green' | 'yellow',
          loggedAt,
        });
      } else {
        // Status already logged and past 15-minute undo window - hide widget
        setShouldShow(false);
      }
    }
  };

  const handleLogStatus = async (status: 'green' | 'yellow') => {
    setLoading(true);
    try {
      await logDayStatus(yesterday, status, undefined, undefined, false);
      setYesterdayStatus({ status, loggedAt: Date.now() });
      onStatusLogged?.();
    } catch (error) {
      logger.error('Failed to log status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async () => {
    setLoading(true);
    try {
      const status = await getDayStatus(yesterday);
      if (status) {
        // Use the store's deleteDayStatus action to maintain data consistency
        await deleteDayStatus(status.id);
        setYesterdayStatus(null);
        onStatusLogged?.();
      }
    } catch (error) {
      logger.error('Failed to undo status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!shouldShow) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={theme.primary} />
      </View>
    );
  }

  if (yesterdayStatus) {
    const statusLabel = yesterdayStatus.status === 'green' ? 'Clear day' : 'Not clear';
    const statusEmoji = yesterdayStatus.status === 'green' ? '🟢' : '🟡';

    return (
      <View style={styles.container} testID="daily-status-widget-logged">
        <View style={styles.loggedContainer}>
          <Text style={styles.loggedText}>
            <Text style={styles.emoji}>{statusEmoji}</Text> Yesterday logged as {statusLabel}
          </Text>
          <TouchableOpacity style={styles.undoButton} onPress={handleUndo} testID="undo-status-button">
            <Text style={styles.undoButtonText}>Undo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="daily-status-widget">
      <View style={styles.header}>
        <Text style={styles.title}>How was yesterday?</Text>
      </View>
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.greenButton]}
          onPress={() => handleLogStatus('green')}
          testID="widget-green-button"
        >
          <Text style={styles.emoji}>🟢</Text>
          <Text style={styles.buttonText}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.yellowButton]}
          onPress={() => handleLogStatus('yellow')}
          testID="widget-yellow-button"
        >
          <Text style={styles.emoji}>🟡</Text>
          <Text style={styles.buttonText}>Not Clear</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
