/**
 * This is an example of how the refactored EpisodeDetailScreen would look
 * after extracting components. This reduces the file from 1,641 lines to ~400 lines.
 */

import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { useEpisodeStore } from '../store/episodeStore';
import { Episode } from '../models/types';
import { 
  EpisodeStatusCard, 
  EpisodeInfoCards,
  TimelineEventRenderer
} from '../components/episode';
// Additional components to be created:
// import { EpisodeTimeline } from '../components/episode/EpisodeTimeline';
// import { EpisodeActions } from '../components/episode/EpisodeActions';
// import { EpisodeModals } from '../components/episode/EpisodeModals';
// import { useEpisodeData } from '../hooks/useEpisodeData';
// import { useEpisodeTimeline } from '../hooks/useEpisodeTimeline';

interface Props {
  route: { params: { episodeId: string } };
  navigation: any;
}

export default function EpisodeDetailScreen({ route, navigation }: Props) {
  const { episodeId } = route.params;
  const theme = useTheme();
  const { endEpisode } = useEpisodeStore();

  // Custom hooks for data and timeline (to be implemented)
  // const episodeData = useEpisodeData(episodeId);
  // const timeline = useEpisodeTimeline(episodeData);

  // Simplified state for example
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Load episode data
  useEffect(() => {
    // Simplified - would use custom hook
    loadEpisodeData();
  }, [episodeId]);

  const loadEpisodeData = async () => {
    // Implementation would be in custom hook
    setLoading(false);
  };

  const handleEndEpisode = async () => {
    if (!episode) return;
    await endEpisode(episode.id);
    navigation.goBack();
  };

  const calculateDuration = () => {
    if (!episode) return 0;
    const end = episode.endTime || Date.now();
    return Math.floor((end - episode.startTime) / 1000 / 60);
  };

  if (loading || !episode) {
    // Would use proper loading component
    return <View />;
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Episode Status Card - Basic info and actions */}
        <EpisodeStatusCard
          episode={episode}
          duration={calculateDuration()}
          locationAddress={null} // Would come from data hook
          onOpenMap={() => setShowMapModal(true)}
          onNavigateToLogUpdate={() => navigation.navigate('LogUpdate', { episodeId })}
          onNavigateToLogMedication={() => navigation.navigate('LogMedication', { episodeId })}
        />

        {/* Episode Info Cards - Qualities and Triggers */}
        <EpisodeInfoCards
          qualities={episode.qualities}
          triggers={episode.triggers}
        />

        {/* Timeline Component - Would be implemented 
        <EpisodeTimeline
          timeline={timeline}
          episode={episode}
          onIntensityLongPress={handleIntensityLongPress}
          onNoteLongPress={handleNoteLongPress}
          onMedicationLongPress={handleMedicationLongPress}
          onEpisodeEndLongPress={handleEpisodeEndLongPress}
        />
        */}
      </ScrollView>

      {/* Episode Actions - End episode buttons
      <EpisodeActions
        episode={episode}
        onEndNow={handleEndEpisode}
        onShowCustomTime={() => setShowEndTimePicker(true)}
      />
      */}

      {/* Modals - Map and Time picker
      <EpisodeModals
        showMapModal={showMapModal}
        showEndTimePicker={showEndTimePicker}
        episode={episode}
        locationAddress={locationAddress}
        customEndTime={customEndTime}
        onCloseMapModal={() => setShowMapModal(false)}
        onCloseEndTimePicker={() => setShowEndTimePicker(false)}
        onCustomTimeChange={setCustomEndTime}
        onCustomTimeAction={handleCustomTime}
      />
      */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
});