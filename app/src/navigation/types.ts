import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

export type RootStackParamList = {
  MainTabs: undefined;
  EpisodeDetail: { episodeId: string };
  NewEpisode: undefined;
  AddMedication: undefined;
  MedicationDetail: { medicationId: string };
  LogMedication: { medicationId: string; episodeId?: string };
};

export type MainTabsParamList = {
  Dashboard: undefined;
  Episodes: undefined;
  Medications: undefined;
  Analytics: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type MainTabsScreenProps<T extends keyof MainTabsParamList> =
  BottomTabScreenProps<MainTabsParamList, T>;
