// mobile/src/screens/DashboardScreen.js

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';

import { useAuth } from '../context/AuthContext';
import { statsAPI, reseauAPI, permissionsAPI } from '../services/api';
import { notificationsAPI } from '../services/notificationsAPI';
import {
  Card,
  StatCard,
  SectionHeader,
  LoadingScreen,
} from '../components';
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';

const { width } = Dimensions.get('window');

// =========================================================
// CONFIGURATION DES PERMISSIONS PAR RÔLE
// =========================================================

/**
 * Définit les actions rapides accessibles à chaque rôle.
 * Clé : role (technicien, superviseur, dj, admin)
 * Valeur : tableau d'objets { icon, label, screen, color, params?, requiredPermission? }
 *
 * `requiredPermission` (uniquement pour technicien / superviseur) correspond
 * à une valeur de TYPES_PERMISSION dans PermissionsScreen.js. Si l'utilisateur
 * n'a pas cette permission validée (ou si elle lui a été retirée), l'action
 * disparaît automatiquement de son accueil. Une action sans `requiredPermission`
 * reste toujours visible (ex: Profil).
 *
 * Admin et DJ gèrent eux-mêmes les permissions des autres : leur propre menu
 * reste donc complet par défaut, inchangé.
 */
const ACTIONS_BY_ROLE = {
  technicien: [
    { icon: 'document-text', label: 'Nouveau rapport', screen: 'Rapports', color: Colors.primary, requiredPermission: 'creer_rapport' },
    { icon: 'alert-circle', label: 'Signaler incident', screen: 'Incidents', color: Colors.danger, requiredPermission: 'creer_incident' },
    { icon: 'briefcase', label: 'Mes missions', screen: 'Missions', color: Colors.secondary, requiredPermission: 'voir_missions' },
    { icon: 'wifi', label: 'Réseau', screen: 'Reseau', color: Colors.warning, requiredPermission: 'voir_reseau' },
    { icon: 'chatbubbles', label: 'Messages', screen: 'Messages', color: '#075E54', requiredPermission: 'voir_messages' },
    { icon: 'person-circle', label: 'Profil', screen: 'Profile', color: Colors.info },
  ],
  superviseur: [
    { icon: 'document-text', label: 'Rapports', screen: 'Rapports', color: Colors.primary, requiredPermission: 'voir_rapports' },
    { icon: 'alert-circle', label: 'Incidents', screen: 'Incidents', color: Colors.danger, requiredPermission: 'voir_incidents' },
    { icon: 'briefcase', label: 'Missions', screen: 'Missions', color: Colors.secondary, requiredPermission: 'voir_missions' },
    { icon: 'construct', label: 'Techniciens', screen: 'Techniciens', color: Colors.info, requiredPermission: 'voir_techniciens' },
    { icon: 'call-outline', label: 'Suivi client', screen: 'SuiviClients', color: Colors.primary },
    { icon: 'stats-chart', label: 'Statistiques', screen: 'Statistiques', color: Colors.primaryLight, requiredPermission: 'voir_statistiques' },
    { icon: 'wifi', label: 'Réseau', screen: 'Reseau', color: Colors.warning, requiredPermission: 'voir_reseau' },
    { icon: 'chatbubbles', label: 'Messages', screen: 'Messages', color: '#075E54', requiredPermission: 'voir_messages' },
  ],
  dj: [
    { icon: 'document-text', label: 'Rapports', screen: 'Rapports', color: Colors.primary },
    { icon: 'alert-circle', label: 'Incidents', screen: 'Incidents', color: Colors.danger },
    { icon: 'briefcase', label: 'Missions', screen: 'Missions', color: Colors.secondary },
    { icon: 'construct', label: 'Techniciens', screen: 'Techniciens', color: Colors.info },
    { icon: 'call-outline', label: 'Suivi client', screen: 'SuiviClients', color: Colors.primary },
    { icon: 'stats-chart', label: 'Statistiques', screen: 'Statistiques', color: Colors.primaryLight },
    { icon: 'people', label: 'Superviseurs', screen: 'Superviseurs', color: Colors.secondary },
    { icon: 'key-outline', label: 'Permissions', screen: 'Permissions', color: Colors.accent },
    { icon: 'wifi', label: 'Réseau', screen: 'Reseau', color: Colors.warning },
    { icon: 'chatbubbles', label: 'Messages', screen: 'Messages', color: '#075E54' },
  ],
  admin: [
    { icon: 'document-text', label: 'Rapports', screen: 'Rapports', color: Colors.primary },
    { icon: 'alert-circle', label: 'Incidents', screen: 'Incidents', color: Colors.danger },
    { icon: 'briefcase', label: 'Missions', screen: 'Missions', color: Colors.secondary },
    { icon: 'construct', label: 'Techniciens', screen: 'Techniciens', color: Colors.info },
    { icon: 'call-outline', label: 'Suivi client', screen: 'SuiviClients', color: Colors.primary },
    { icon: 'stats-chart', label: 'Statistiques', screen: 'Statistiques', color: Colors.primaryLight },
    { icon: 'people', label: 'Utilisateurs', screen: 'Users', color: Colors.secondary },
    { icon: 'key-outline', label: 'Permissions', screen: 'Permissions', color: Colors.accent },
    { icon: 'time-outline', label: 'Historique', screen: 'Historique', color: Colors.accent },
    { icon: 'people', label: 'Superviseurs', screen: 'Superviseurs', color: Colors.secondary },
    { icon: 'wifi', label: 'Réseau', screen: 'Reseau', color: Colors.warning },
    { icon: 'chatbubbles', label: 'Messages', screen: 'Messages', color: '#075E54' },
  ],
};

/**
 * Définit les statistiques affichées pour chaque rôle.
 */
const STATS_CONFIG = {
  technicien: ['interventions', 'incidentsOuverts', 'missionsEnCours'],
  superviseur: ['totalRapports', 'incidentsOuverts', 'missionsEnCours', 'techniciensActifs'],
  dj: ['totalRapports', 'incidentsOuverts', 'missionsEnCours', 'techniciensActifs', 'superviseurs'],
  admin: ['totalRapports', 'incidentsOuverts', 'missionsEnCours', 'techniciensActifs', 'superviseurs', 'utilisateursActifs'],
};

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function DashboardScreen() {
  const {
    user,
    isAdmin,
    isSuperviseur,
    isDJ,
    isTechnicien,
    fullName,
    role
  } = useAuth();
  const navigation = useNavigation();

  // États
  const [stats, setStats] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reseauEtat, setReseauEtat] = useState([]);

  // Permissions réellement accordées à l'utilisateur courant (technicien/superviseur).
  // C'est cet ensemble qui pilote l'affichage des actions rapides : si une
  // permission est retirée côté admin/DJ, l'action correspondante disparaît
  // ici dès le prochain rafraîchissement, sans rien changer au reste du Dashboard.
  const [grantedPermissions, setGrantedPermissions] = useState(new Set());

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // Polling ref
  const pollingRef = useRef(null);

  // =========================================================
  // CHARGEMENT DES PERMISSIONS DE L'UTILISATEUR (réaction système)
  // =========================================================

  const loadMyPermissions = useCallback(async () => {
    // Admin et DJ gèrent les permissions eux-mêmes : leur menu reste complet
    // par défaut, inutile d'aller vérifier quoi que ce soit.
    if (isAdmin || isDJ || !user?.id) return;

    try {
      const res = await permissionsAPI.list({ userId: user.id }).catch(() => ({ data: [] }));
      const list = res?.data || res || [];
      const mine = (Array.isArray(list) ? list : []).filter((p) => {
        const concerneMoi =
          p.technicien_id === user.id ||
          p.superviseur_id === user.id ||
          p.user_id === user.id;
        return concerneMoi && p.est_valide === 1;
      });
      setGrantedPermissions(new Set(mine.map((p) => p.type_permission)));
    } catch (error) {
      console.error('❌ Erreur chargement permissions utilisateur:', error);
    }
  }, [isAdmin, isDJ, user]);

  // =========================================================
  // CHARGEMENT DES DONNÉES
  // =========================================================

  const loadData = useCallback(async () => {
    try {
      // 🔐 Appel conditionnel aux statistiques (réservé admin, superviseur, DJ)
      const statsPromise = (isAdmin || isSuperviseur || isDJ)
        ? statsAPI.dashboard().catch(() => ({}))
        : Promise.resolve({});

      const [s, n, count, reseau] = await Promise.all([
        statsPromise,
        notificationsAPI.list({ limit: 3 }).catch(() => ({ data: [] })),
        notificationsAPI.getUnreadCount().catch(() => 0),
        reseauAPI.getLatest().catch(() => ({ data: [] })),
      ]);

      setStats(s.data || s);
      setNotifications(n.data || n || []);
      setUnreadCount(count || 0);

      const reseauData = reseau?.data || reseau || [];
      setReseauEtat(Array.isArray(reseauData) ? reseauData : []);

      // On rafraîchit aussi les permissions de l'utilisateur à chaque
      // chargement du Dashboard (pull-to-refresh, focus, etc.).
      await loadMyPermissions();
    } catch (error) {
      console.error('❌ Erreur chargement dashboard:', error);
      setReseauEtat([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, isSuperviseur, isDJ, loadMyPermissions]);

  // Animation d'entrée
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Chargement initial
  useEffect(() => {
    loadData();

    pollingRef.current = setInterval(() => {
      notificationsAPI.getUnreadCount()
        .then(setUnreadCount)
        .catch(() => {});

      // Réaction système : si un admin/DJ retire une permission pendant que
      // l'utilisateur a son Dashboard ouvert, l'action rapide correspondante
      // disparaît automatiquement au prochain cycle (sans devoir relancer l'app).
      loadMyPermissions();
    }, 30000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [loadData, loadMyPermissions]);

  // Rafraîchissement au focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // =========================================================
  // HANDLERS
  // =========================================================

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleNavigate = (screen, params = {}) => {
    navigation.navigate(screen, params);
  };

  // =========================================================
  // FONCTIONS DE RÔLE
  // =========================================================

  /**
   * Retourne la liste des actions rapides selon le rôle de l'utilisateur,
   * filtrée par ses permissions réellement accordées.
   *
   * - Admin / DJ : menu complet, inchangé (ils gèrent les permissions, pas
   *   l'inverse).
   * - Superviseur / Technicien : chaque action qui déclare une
   *   `requiredPermission` n'apparaît que si cette permission est présente
   *   dans `grantedPermissions`. Une action sans `requiredPermission`
   *   (ex: Profil, Suivi client) reste toujours visible.
   */
  const getActions = () => {
    let list;
    if (isAdmin) list = ACTIONS_BY_ROLE.admin;
    else if (isDJ) list = ACTIONS_BY_ROLE.dj;
    else if (isSuperviseur) list = ACTIONS_BY_ROLE.superviseur;
    else if (isTechnicien) list = ACTIONS_BY_ROLE.technicien;
    else {
      // Fallback : actions de base (tous)
      list = [
        { icon: 'document-text', label: 'Rapports', screen: 'Rapports', color: Colors.primary },
        { icon: 'alert-circle', label: 'Incidents', screen: 'Incidents', color: Colors.danger },
      ];
    }

    // Le Dashboard de l'admin et du DJ reste identique par défaut.
    if (isAdmin || isDJ) return list;

    // Pour superviseur / technicien : on retire du menu toute action dont la
    // permission requise n'est plus accordée.
    return list.filter((action) => {
      if (!action.requiredPermission) return true;
      return grantedPermissions.has(action.requiredPermission);
    });
  };

  /**
   * Retourne les statistiques à afficher en fonction du rôle.
   */
  const getStatsToShow = () => {
    if (isAdmin) return STATS_CONFIG.admin;
    if (isDJ) return STATS_CONFIG.dj;
    if (isSuperviseur) return STATS_CONFIG.superviseur;
    if (isTechnicien) return STATS_CONFIG.technicien;
    return ['interventions', 'incidentsOuverts']; // fallback
  };

  // =========================================================
  // CALCULS
  // =========================================================

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  const getRoleLabel = (role) => {
    const map = {
      admin: 'Administrateur',
      dj: 'DJ',
      superviseur: 'Superviseur',
      technicien: 'Technicien',
    };
    return map[role] || role;
  };

  const getRoleColor = (role) => {
    const map = {
      admin: Colors.danger,
      dj: Colors.secondary,
      superviseur: Colors.primary,
      technicien: Colors.warning,
    };
    return map[role] || Colors.textMuted;
  };

  const getReseauSante = () => {
    const zones = Array.isArray(reseauEtat) ? reseauEtat : [];

    if (zones.length === 0) {
      return { icon: 'wifi-outline', color: Colors.textMuted, label: 'Données non disponibles', count: 0 };
    }

    const zonesCritiques = zones.filter(z => z.statut === 'critique' || z.statut === 'panne');
    const zonesCongestion = zones.filter(z => z.statut === 'congestion');

    if (zonesCritiques.length > 0) {
      return {
        icon: 'alert-circle',
        color: Colors.danger,
        label: `${zonesCritiques.length} zone(s) critique(s)`,
        count: zonesCritiques.length
      };
    }
    if (zonesCongestion.length > 0) {
      return {
        icon: 'warning',
        color: Colors.warning,
        label: `${zonesCongestion.length} zone(s) en congestion`,
        count: zonesCongestion.length
      };
    }
    return {
      icon: 'checkmark-circle',
      color: Colors.success,
      label: 'Réseau opérationnel',
      count: 0
    };
  };

  const reseauInfo = getReseauSante();
  const zonesCount = Array.isArray(reseauEtat) ? reseauEtat.length : 0;

  // Statistiques rapides (préparation pour l'affichage conditionnel)
  const statsData = {
    interventions: stats?.rapports?.total || 0,
    incidentsOuverts: stats?.incidents?.ouverts || 0,
    missionsEnCours: stats?.missions?.en_cours || 0,
    totalRapports: stats?.rapports?.total || 0,
    techniciensActifs: stats?.techniciens?.actifs || 0,
    superviseurs: stats?.superviseurs?.total || 0,
    utilisateursActifs: stats?.utilisateurs?.actifs || 0,
  };

  // =========================================================
  // RENDU
  // =========================================================

  if (loading) {
    return <LoadingScreen message="Chargement du tableau de bord..." />;
  }

  const greeting = getGreeting();
  const roleLabel = getRoleLabel(role);
  const actions = getActions();
  const statsKeys = getStatsToShow();

  // Filtrer les statistiques à afficher selon le rôle
  const filteredStats = statsKeys.map(key => ({
    key,
    label: getStatLabel(key),
    value: statsData[key] || 0,
    icon: getStatIcon(key),
    color: getStatColor(key),
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ===== HEADER ===== */}
      <GradientHeader style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.userName}>{fullName || 'Utilisateur'}</Text>
            <View style={styles.userRoleContainer}>
              <View style={[styles.roleDot, { backgroundColor: getRoleColor(role) }]} />
              <Text style={styles.userRole}>{roleLabel}</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.notifBtn}
              onPress={() => handleNavigate('Notifications')}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={24} color={Colors.textWhite} />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </GradientHeader>

      {/* ===== CONTENU SCROLL ===== */}
      <Animated.ScrollView
        style={[styles.scroll, { opacity: fadeAnim }]}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ===== CARTE RÉSEAU ===== */}
        <TouchableOpacity
          style={[styles.reseauCard, { borderColor: reseauInfo.color + '30' }]}
          onPress={() => handleNavigate('Reseau')}
          activeOpacity={0.8}
        >
          <View style={styles.reseauCardLeft}>
            <View style={[styles.reseauIcon, { backgroundColor: reseauInfo.color + '15' }]}>
              <Ionicons name={reseauInfo.icon} size={28} color={reseauInfo.color} />
            </View>
            <View style={styles.reseauInfo}>
              <Text style={[styles.reseauLabel, { color: reseauInfo.color }]}>
                {reseauInfo.label}
              </Text>
              <Text style={styles.reseauSub}>
                {zonesCount} zone(s) surveillée(s)
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* ===== STATISTIQUES (filtrées par rôle) ===== */}
        <View style={styles.statsGrid}>
          {filteredStats.length > 0 && (
            <View style={styles.statsRow}>
              {filteredStats.slice(0, 2).map((stat, index) => (
                <React.Fragment key={stat.key}>
                  <StatCard
                    label={stat.label}
                    value={stat.value}
                    color={stat.color}
                    icon={stat.icon}
                  />
                  {index === 0 && filteredStats.length > 1 && <View style={{ width: Spacing.sm }} />}
                </React.Fragment>
              ))}
            </View>
          )}
          {filteredStats.length > 2 && (
            <View style={styles.statsRow}>
              {filteredStats.slice(2, 4).map((stat, index) => (
                <React.Fragment key={stat.key}>
                  <StatCard
                    label={stat.label}
                    value={stat.value}
                    color={stat.color}
                    icon={stat.icon}
                  />
                  {index === 0 && filteredStats.length > 3 && <View style={{ width: Spacing.sm }} />}
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        {/* ===== ACTIONS RAPIDES ===== */}
        <SectionHeader
          title="Actions rapides"
          icon="rocket-outline"
          subtitle="Accédez aux fonctionnalités principales"
        />

        <View style={styles.actionsGrid}>
          {actions.map((action, index) => (
            <ActionCard
              key={index}
              icon={action.icon}
              label={action.label}
              onPress={() => handleNavigate(action.screen, action.params || {})}
              color={action.color}
            />
          ))}
        </View>

        {/* ===== NOTIFICATIONS RÉCENTES ===== */}
        {notifications.length > 0 && (
          <View style={styles.notifsSection}>
            <SectionHeader
              title="Notifications récentes"
              action="Voir tout"
              onAction={() => handleNavigate('Notifications')}
              icon="notifications-outline"
            />

            {notifications.slice(0, 3).map((notif, index) => (
              <TouchableOpacity
                key={notif.id || index}
                style={[
                  styles.notifCard,
                  !notif.est_lu && styles.notifUnread,
                ]}
                onPress={() => handleNavigate('Notifications')}
                activeOpacity={0.7}
              >
                <View style={styles.notifIcon}>
                  <Ionicons
                    name={getNotifIcon(notif.type)}
                    size={20}
                    color={getNotifColor(notif.type)}
                  />
                </View>
                <View style={styles.notifContent}>
                  <Text style={styles.notifTitle} numberOfLines={1}>
                    {notif.titre}
                  </Text>
                  <Text style={styles.notifMessage} numberOfLines={2}>
                    {notif.message}
                  </Text>
                  <Text style={styles.notifTime}>
                    {formatTime(notif.created_at)}
                  </Text>
                </View>
                {!notif.est_lu && <View style={styles.notifDot} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.footerSpace} />
      </Animated.ScrollView>
    </View>
  );
}

// =========================================================
// COMPOSANTS INTERNES
// =========================================================

function ActionCard({ icon, label, onPress, color }) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, { borderColor: color + '30' }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.actionIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// =========================================================
// FONCTIONS UTILITAIRES
// =========================================================

// Labels des statistiques
const getStatLabel = (key) => {
  const map = {
    interventions: 'Interventions',
    incidentsOuverts: 'Incidents ouverts',
    missionsEnCours: 'Missions en cours',
    totalRapports: 'Rapports',
    techniciensActifs: 'Techniciens actifs',
    superviseurs: 'Superviseurs',
    utilisateursActifs: 'Utilisateurs actifs',
  };
  return map[key] || key;
};

// Icônes des statistiques
const getStatIcon = (key) => {
  const map = {
    interventions: 'document-text-outline',
    incidentsOuverts: 'alert-circle-outline',
    missionsEnCours: 'briefcase-outline',
    totalRapports: 'document-text-outline',
    techniciensActifs: 'construct-outline',
    superviseurs: 'people-outline',
    utilisateursActifs: 'people-outline',
  };
  return map[key] || 'stats-chart-outline';
};

// Couleurs des statistiques
const getStatColor = (key) => {
  const map = {
    interventions: Colors.primary,
    incidentsOuverts: Colors.danger,
    missionsEnCours: Colors.warning,
    totalRapports: Colors.primary,
    techniciensActifs: Colors.info,
    superviseurs: Colors.secondary,
    utilisateursActifs: Colors.secondary,
  };
  return map[key] || Colors.textMuted;
};

// Notifications
const getNotifIcon = (type) => {
  const map = {
    rapport: 'document-text',
    incident: 'alert-circle',
    mission: 'briefcase',
    permission: 'key',
    message: 'chatbubble',
    systeme: 'settings',
  };
  return map[type] || 'notifications';
};

const getNotifColor = (type) => {
  const map = {
    rapport: Colors.primary,
    incident: Colors.danger,
    mission: Colors.secondary,
    permission: Colors.warning,
    message: '#075E54',
    systeme: Colors.info,
  };
  return map[type] || Colors.textMuted;
};

const formatTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);

  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} j`;
  return d.toLocaleDateString('fr-FR');
};

// =========================================================
// STYLES
// =========================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // HEADER
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    ...Shadows.card,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '400',
  },
  userName: {
    color: Colors.textWhite,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  userRoleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  roleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  userRole: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notifBtn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  notifBadgeText: {
    color: Colors.textWhite,
    fontSize: 10,
    fontWeight: '700',
  },

  // SCROLL
  scroll: {
    flex: 1,
    marginTop: -10,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 20,
  },

  // CARTE RÉSEAU
  reseauCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    ...Shadows.card,
  },
  reseauCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reseauIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  reseauInfo: {
    flex: 1,
  },
  reseauLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  reseauSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // STATISTIQUES
  statsGrid: {
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },

  // ACTIONS
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  actionBtn: {
    width: (width - Spacing.lg * 2 - Spacing.sm * 2) / 3 - 4,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    ...Shadows.light,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },

  // NOTIFICATIONS
  notifsSection: {
    marginTop: Spacing.sm,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.light,
  },
  notifUnread: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  notifMessage: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  notifTime: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginLeft: Spacing.sm,
  },

  footerSpace: {
    height: 20,
  },
});