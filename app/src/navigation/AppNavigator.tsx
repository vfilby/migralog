import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, MainTabsParamList } from './types';
import { useTheme } from '../theme';
import { navigationRef } from './NavigationService';
import { useOnboardingStore } from '../store/onboardingStore';

// Main screens (stay at root level)
import DashboardScreen from '../screens/DashboardScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import LogUpdateScreen from '../screens/LogUpdateScreen';
import DailyStatusPromptScreen from '../screens/DailyStatusPromptScreen';
import WelcomeScreen from '../screens/WelcomeScreen';

// Episode screens
import EpisodesScreen from '../screens/episode/EpisodesScreen';
import NewEpisodeScreen from '../screens/episode/NewEpisodeScreen';
import EpisodeDetailScreen from '../screens/episode/EpisodeDetailScreen';
import EditIntensityReadingScreen from '../screens/episode/EditIntensityReadingScreen';
import EditEpisodeNoteScreen from '../screens/episode/EditEpisodeNoteScreen';
import EditSymptomLogScreen from '../screens/episode/EditSymptomLogScreen';
import EditPainLocationLogScreen from '../screens/episode/EditPainLocationLogScreen';

// Medication screens
import MedicationsScreen from '../screens/medication/MedicationsScreen';
import AddMedicationScreen from '../screens/medication/AddMedicationScreen';
import EditMedicationScreen from '../screens/medication/EditMedicationScreen';
import MedicationDetailScreen from '../screens/medication/MedicationDetailScreen';
import LogMedicationScreen from '../screens/medication/LogMedicationScreen';
import MedicationLogScreen from '../screens/medication/MedicationLogScreen';
import EditMedicationDoseScreen from '../screens/medication/EditMedicationDoseScreen';
import ArchivedMedicationsScreen from '../screens/medication/ArchivedMedicationsScreen';

// Settings screens
import SettingsScreen from '../screens/settings/SettingsScreen';
import NotificationSettingsScreen from '../screens/settings/NotificationSettingsScreen';
import LocationSettingsScreen from '../screens/settings/LocationSettingsScreen';
import DataSettingsScreen from '../screens/settings/DataSettingsScreen';
import DeveloperToolsScreen from '../screens/settings/DeveloperToolsScreen';
import BackupRecoveryScreen from '../screens/settings/BackupRecoveryScreen';
import ErrorLogsScreen from '../screens/settings/ErrorLogsScreen';
import PerformanceScreen from '../screens/settings/PerformanceScreen';

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
  const { isOnboardingComplete, isLoading } = useOnboardingStore();

  // Don't render navigator until we know onboarding status
  // App.tsx loading screen will show during this time
  if (isLoading) {
    return null;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName={isOnboardingComplete ? 'MainTabs' : 'Welcome'}
      >
        <Stack.Screen
          name="Welcome"
          component={WelcomeScreen}
          options={{ headerShown: false }}
        />
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
          name="NotificationSettingsScreen"
          component={NotificationSettingsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="LocationSettingsScreen"
          component={LocationSettingsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DataSettingsScreen"
          component={DataSettingsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DeveloperToolsScreen"
          component={DeveloperToolsScreen}
          options={{ headerShown: false }}
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
          name="Performance"
          component={PerformanceScreen}
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
