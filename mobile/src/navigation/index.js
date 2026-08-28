// mobile/src/navigation/index.js
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Colors, Typography } from '../theme';
import { LoadingScreen } from '../components';
import Ionicons from 'react-native-vector-icons/Ionicons';

// =========================================================
// IMPORTS DES ÉCRANS
// =========================================================

import LoginScreen from '../screens/LoginScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import DashboardScreen from '../screens/DashboardScreen';
import UsersScreen from '../screens/UsersScreen';
import UserFormScreen from '../screens/UserFormScreen';
import SuperviseursScreen from '../screens/SuperviseursScreen';
import SuperviseurFormScreen from '../screens/SuperviseurFormScreen';
import SuperviseurDetailScreen from '../screens/SuperviseurDetailScreen';
import TechniciensScreen from '../screens/TechniciensScreen';
import TechnicienFormScreen from '../screens/TechnicienFormScreen';
import MissionsScreen from '../screens/MissionsScreen';
import MissionFormScreen from '../screens/MissionFormScreen';
import MissionDetailScreen from '../screens/MissionDetailScreen';
import RapportsScreen from '../screens/RapportsScreen';
import RapportFormScreen from '../screens/RapportFormScreen';
import RapportDetailScreen from '../screens/RapportDetailScreen';
import IncidentsScreen from '../screens/IncidentsScreen';
import IncidentFormScreen from '../screens/IncidentFormScreen';
import MessagesScreen from '../screens/MessagesScreen';
import GroupeMessageScreen from '../screens/GroupeMessageScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ReseauScreen from '../screens/ReseauScreen';
import StatistiquesScreen from '../screens/StatistiquesScreen';
import PermissionsScreen from '../screens/PermissionsScreen';
import PermissionFormScreen from '../screens/PermissionFormScreen';
import PermissionDetailScreen from '../screens/PermissionDetailScreen';
import SuiviClientsScreen from '../screens/SuiviClientsScreen';
import SuiviClientFormScreen from '../screens/SuiviClientFormScreen';
import HistoriqueScreen from '../screens/HistoriqueScreen';
import ProfilScreen from '../screens/ProfilScreen';

// =========================================================
// CONSTANTES
// =========================================================

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// =========================================================
// COMPOSANT ICÔNE DE TAB
// =========================================================

function TabIcon({ name, focused, color }) {
  const iconMap = {
    'Accueil': focused ? 'home' : 'home-outline',
    'Missions': focused ? 'clipboard' : 'clipboard-outline',
    'Rapports': focused ? 'document-text' : 'document-text-outline',
    'Incidents': focused ? 'alert-circle' : 'alert-circle-outline',
    'Messages': focused ? 'chatbubbles' : 'chatbubbles-outline',
    'Réseau': focused ? 'wifi' : 'wifi-outline',
    'Statistiques': focused ? 'stats-chart' : 'stats-chart-outline',
    'Profil': focused ? 'person' : 'person-outline',
    'Notifications': focused ? 'notifications' : 'notifications-outline',
    'Utilisateurs': focused ? 'people' : 'people-outline',
    'Techniciens': focused ? 'construct' : 'construct-outline',
    'Superviseurs': focused ? 'briefcase' : 'briefcase-outline',
    'Permissions': focused ? 'key' : 'key-outline',
    'Suivi Clients': focused ? 'call' : 'call-outline',
    'Historique': focused ? 'time' : 'time-outline',
  };
  const iconName = iconMap[name] || 'help-circle-outline';
  return <Ionicons name={iconName} size={24} color={color} />;
}

// =========================================================
// HEADER PERSONNALISÉ
// =========================================================

function CustomHeader({ title, navigation, showBack = false, rightComponent }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {showBack && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      <View style={styles.headerRight}>{rightComponent}</View>
    </View>
  );
}

// =========================================================
// STACKS PAR MODULE
// =========================================================

function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DashboardMain" component={DashboardScreen} />
    </Stack.Navigator>
  );
}

function UsersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="UsersList" component={UsersScreen} />
      <Stack.Screen name="UserForm" component={UserFormScreen} />
    </Stack.Navigator>
  );
}

function SuperviseursStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SuperviseursList" component={SuperviseursScreen} />
      <Stack.Screen name="SuperviseurForm" component={SuperviseurFormScreen} />
      <Stack.Screen name="SuperviseurDetail" component={SuperviseurDetailScreen} />
    </Stack.Navigator>
  );
}

function TechniciensStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TechniciensList" component={TechniciensScreen} />
      <Stack.Screen name="TechnicienForm" component={TechnicienFormScreen} />
    </Stack.Navigator>
  );
}

function MissionsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MissionsList" component={MissionsScreen} />
      <Stack.Screen name="MissionForm" component={MissionFormScreen} />
      <Stack.Screen name="MissionDetail" component={MissionDetailScreen} />
    </Stack.Navigator>
  );
}

function RapportsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RapportsList" component={RapportsScreen} />
      <Stack.Screen name="RapportForm" component={RapportFormScreen} />
      <Stack.Screen name="RapportDetail" component={RapportDetailScreen} />
    </Stack.Navigator>
  );
}

function IncidentsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="IncidentsList" component={IncidentsScreen} />
      <Stack.Screen name="IncidentForm" component={IncidentFormScreen} />
    </Stack.Navigator>
  );
}

function MessagesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MessagesList" component={MessagesScreen} />
      <Stack.Screen name="GroupeMessage" component={GroupeMessageScreen} />
    </Stack.Navigator>
  );
}

function PermissionsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PermissionsList" component={PermissionsScreen} />
      <Stack.Screen name="PermissionForm" component={PermissionFormScreen} />
      <Stack.Screen name="PermissionDetail" component={PermissionDetailScreen} />
    </Stack.Navigator>
  );
}

function SuiviClientsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SuiviClientsList" component={SuiviClientsScreen} />
      <Stack.Screen name="SuiviClientForm" component={SuiviClientFormScreen} />
    </Stack.Navigator>
  );
}

// =========================================================
// MAIN TABS PAR RÔLE (avec vérification des permissions)
// =========================================================

function AdminTabs() {
  const { hasPermission } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name={route.name} focused={focused} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Accueil" component={DashboardStack} />
      <Tab.Screen name="Utilisateurs" component={UsersStack} options={{ unmountOnBlur: true }} />
      <Tab.Screen name="Techniciens" component={TechniciensStack} options={{ unmountOnBlur: true }} />
      <Tab.Screen name="Superviseurs" component={SuperviseursStack} options={{ unmountOnBlur: true }} />
      <Tab.Screen name="Rapports" component={RapportsStack} options={{ unmountOnBlur: true }} />
      <Tab.Screen name="Incidents" component={IncidentsStack} options={{ unmountOnBlur: true }} />
      {hasPermission('voir_statistiques') && (
        <Tab.Screen name="Statistiques" component={StatistiquesScreen} />
      )}
      {hasPermission('voir_permissions') && (
        <Tab.Screen name="Permissions" component={PermissionsStack} options={{ unmountOnBlur: true }} />
      )}
      {hasPermission('voir_historique') && (
        <Tab.Screen name="Historique" component={HistoriqueScreen} />
      )}
      <Tab.Screen name="Profil" component={ProfilScreen} />
    </Tab.Navigator>
  );
}

function DJTabs() {
  const { hasPermission } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name={route.name} focused={focused} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Accueil" component={DashboardStack} />
      <Tab.Screen name="Superviseurs" component={SuperviseursStack} options={{ unmountOnBlur: true }} />
      <Tab.Screen name="Rapports" component={RapportsStack} options={{ unmountOnBlur: true }} />
      {hasPermission('voir_statistiques') && (
        <Tab.Screen name="Statistiques" component={StatistiquesScreen} />
      )}
      {hasPermission('voir_permissions') && (
        <Tab.Screen name="Permissions" component={PermissionsStack} options={{ unmountOnBlur: true }} />
      )}
      <Tab.Screen name="Profil" component={ProfilScreen} />
    </Tab.Navigator>
  );
}

function SuperviseurTabs() {
  const { hasPermission } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name={route.name} focused={focused} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Accueil" component={DashboardStack} />
      <Tab.Screen name="Missions" component={MissionsStack} options={{ unmountOnBlur: true }} />
      <Tab.Screen name="Techniciens" component={TechniciensStack} options={{ unmountOnBlur: true }} />
      <Tab.Screen name="Rapports" component={RapportsStack} options={{ unmountOnBlur: true }} />
      <Tab.Screen name="Incidents" component={IncidentsStack} options={{ unmountOnBlur: true }} />
      {hasPermission('voir_suivi_clients') && (
        <Tab.Screen name="Suivi Clients" component={SuiviClientsStack} options={{ unmountOnBlur: true }} />
      )}
      {hasPermission('voir_statistiques') && (
        <Tab.Screen name="Statistiques" component={StatistiquesScreen} />
      )}
      <Tab.Screen name="Profil" component={ProfilScreen} />
    </Tab.Navigator>
  );
}

function TechnicienTabs() {
  const { hasPermission } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name={route.name} focused={focused} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Accueil" component={DashboardStack} />
      <Tab.Screen name="Missions" component={MissionsStack} options={{ unmountOnBlur: true }} />
      <Tab.Screen name="Rapports" component={RapportsStack} options={{ unmountOnBlur: true }} />
      <Tab.Screen name="Incidents" component={IncidentsStack} options={{ unmountOnBlur: true }} />
      {hasPermission('voir_messages') && (
        <Tab.Screen name="Messages" component={MessagesStack} options={{ unmountOnBlur: true }} />
      )}
      {hasPermission('voir_reseau') && (
        <Tab.Screen name="Réseau" component={ReseauScreen} />
      )}
      <Tab.Screen name="Profil" component={ProfilScreen} />
    </Tab.Navigator>
  );
}

// =========================================================
// COMPOSANT PRINCIPAL DE NAVIGATION
// =========================================================

export default function Navigation() {
  const { user, loading, isAdmin, isDJ, isSuperviseur, isTechnicien } = useAuth();
  const [firstLaunch, setFirstLaunch] = useState(true);

  if (loading) {
    return <LoadingScreen message="Chargement de l'application..." />;
  }

  const getTabs = () => {
    if (isAdmin) return AdminTabs;
    if (isDJ) return DJTabs;
    if (isSuperviseur) return SuperviseurTabs;
    if (isTechnicien) return TechnicienTabs;
    return TechnicienTabs;
  };

  const MainTabs = getTabs();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            {firstLaunch ? (
              <Stack.Screen name="Welcome">
                {(props) => (
                  <WelcomeScreen {...props} onFinish={() => setFirstLaunch(false)} />
                )}
              </Stack.Screen>
            ) : null}
            <Stack.Screen name="Login" component={LoginScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Reseau" component={ReseauScreen} />
            <Stack.Screen name="Statistiques" component={StatistiquesScreen} />
            <Stack.Screen name="Profil" component={ProfilScreen} />
            <Stack.Screen name="Users" component={UsersScreen} />
            <Stack.Screen name="UserForm" component={UserFormScreen} />
            <Stack.Screen name="Superviseurs" component={SuperviseursScreen} />
            <Stack.Screen name="SuperviseurForm" component={SuperviseurFormScreen} />
            <Stack.Screen name="Techniciens" component={TechniciensScreen} />
            <Stack.Screen name="TechnicienForm" component={TechnicienFormScreen} />
            <Stack.Screen name="Missions" component={MissionsScreen} />
            <Stack.Screen name="MissionForm" component={MissionFormScreen} />
            <Stack.Screen name="MissionDetail" component={MissionDetailScreen} />
            <Stack.Screen name="Rapports" component={RapportsScreen} />
            <Stack.Screen name="RapportForm" component={RapportFormScreen} />
            <Stack.Screen name="RapportDetail" component={RapportDetailScreen} />
            <Stack.Screen name="Incidents" component={IncidentsScreen} />
            <Stack.Screen name="IncidentForm" component={IncidentFormScreen} />
            <Stack.Screen name="Messages" component={MessagesScreen} />
            <Stack.Screen name="GroupeMessage" component={GroupeMessageScreen} />
            <Stack.Screen name="Permissions" component={PermissionsScreen} />
            <Stack.Screen name="PermissionForm" component={PermissionFormScreen} />
            <Stack.Screen name="PermissionDetail" component={PermissionDetailScreen} />
            <Stack.Screen name="SuiviClients" component={SuiviClientsScreen} />
            <Stack.Screen name="SuiviClientForm" component={SuiviClientFormScreen} />
            <Stack.Screen name="Historique" component={HistoriqueScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// =========================================================
// STYLES
// =========================================================

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 0,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    height: 60,
    paddingBottom: 6,
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBack: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});