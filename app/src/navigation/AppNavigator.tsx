import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, MainTabsParamList } from './types';
import { useTheme } from '../theme';
import { navigationRef } from './NavigationService';

// Screens
import DashboardScreen from '../screens/DashboardScreen';
import EpisodesScreen from '../screens/EpisodesScreen';
import MedicationsScreen from '../screens/MedicationsScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import NewEpisodeScreen from '../screens/NewEpisodeScreen';
import EpisodeDetailScreen from '../screens/EpisodeDetailScreen';
import LogUpdateScreen from '../screens/LogUpdateScreen';
import AddMedicationScreen from '../screens/AddMedicationScreen';
import EditMedicationScreen from '../screens/EditMedicationScreen';
import MedicationDetailScreen from '../screens/MedicationDetailScreen';
import LogMedicationScreen from '../screens/LogMedicationScreen';
import MedicationLogScreen from '../screens/MedicationLogScreen';
import EditMedicationDoseScreen from '../screens/EditMedicationDoseScreen';
import EditIntensityReadingScreen from '../screens/EditIntensityReadingScreen';
import EditEpisodeNoteScreen from '../screens/EditEpisodeNoteScreen';
import EditSymptomLogScreen from '../screens/EditSymptomLogScreen';
import EditPainLocationLogScreen from '../screens/EditPainLocationLogScreen';
import ArchivedMedicationsScreen from '../screens/ArchivedMedicationsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import BackupRecoveryScreen from '../screens/BackupRecoveryScreen';
import ErrorLogsScreen from '../screens/ErrorLogsScreen';
import DailyStatusPromptScreen from '../screens/DailyStatusPromptScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabsParamList>();

function MainTabs() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tabBarActive,
        tabBarInactiveTintColor: theme.tabBarInactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 4,
          marginBottom: 2,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
        tabBarStyle: {
          height: 84,
          paddingTop: 8,
          paddingBottom: 8,
          borderTopWidth: 0.5,
          borderTopColor: theme.tabBarBorder,
          backgroundColor: theme.tabBarBackground,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Episodes"
        component={EpisodesScreen}
        options={{
          tabBarLabel: 'Episodes',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'list' : 'list-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Medications"
        component={MedicationsScreen}
        options={{
          tabBarLabel: 'Meds',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'medical' : 'medical-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          tabBarLabel: 'Trends',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'stats-chart' : 'stats-chart-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator>
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="NewEpisode"
          component={NewEpisodeScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="EpisodeDetail"
          component={EpisodeDetailScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="LogUpdate"
          component={LogUpdateScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="AddMedication"
          component={AddMedicationScreen}
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="EditMedication"
          component={EditMedicationScreen}
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="MedicationDetail"
          component={MedicationDetailScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="LogMedication"
          component={LogMedicationScreen}
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="MedicationLog"
          component={MedicationLogScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EditMedicationDose"
          component={EditMedicationDoseScreen}
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="EditIntensityReading"
          component={EditIntensityReadingScreen}
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="EditSymptomLog"
          component={EditSymptomLogScreen}
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="EditPainLocationLog"
          component={EditPainLocationLogScreen}
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="EditEpisodeNote"
          component={EditEpisodeNoteScreen}
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="ArchivedMedications"
          component={ArchivedMedicationsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="BackupRecovery"
          component={BackupRecoveryScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ErrorLogs"
          component={ErrorLogsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DailyStatusPrompt"
          component={DailyStatusPromptScreen}
          options={{ headerShown: false, presentation: 'modal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
