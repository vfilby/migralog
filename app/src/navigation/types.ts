import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

export type RootStackParamList = {
  MainTabs: undefined;
  EpisodeDetail: { episodeId: string };
  NewEpisode: { episodeId?: string };
  LogUpdate: { episodeId: string };
  AddMedication: undefined;
  EditMedication: { medicationId: string };
  MedicationDetail: { medicationId: string };
  LogMedication: { medicationId?: string; episodeId?: string };
  MedicationLog: undefined;
  EditMedicationDose: { doseId: string };
  ArchivedMedications: undefined;
  Settings: undefined;
  BackupRecovery: undefined;
  ErrorLogs: undefined;
  DailyStatusPrompt: { date?: string };
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
