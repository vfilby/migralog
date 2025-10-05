import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useEpisodeStore } from '../store/episodeStore';
import { Episode } from '../models/types';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import EpisodeCard from '../components/EpisodeCard';
import { useTheme, ThemeColors } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    backgroundColor: theme.backgroundSecondary,
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: theme.text,
  },
  listContent: {
    padding: 16,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: theme.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: theme.textTertiary,
    textAlign: 'center',
  },
});

export default function EpisodesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { episodes, loadEpisodes, loading } = useEpisodeStore();
  const styles = createStyles(theme);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadEpisodes();
    });
    return unsubscribe;
  }, [navigation]);

  const renderEpisode = ({ item }: { item: Episode }) => (
    <EpisodeCard
      episode={item}
      onPress={() => navigation.navigate('EpisodeDetail', { episodeId: item.id })}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Episodes</Text>
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Loading...</Text>
      ) : episodes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No episodes recorded yet</Text>
          <Text style={styles.emptySubtext}>
            Start tracking your pain episodes from the Home tab
          </Text>
        </View>
      ) : (
        <FlatList
          data={episodes}
          renderItem={renderEpisode}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}
