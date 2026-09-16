// mobile/src/screens/IncidentsScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';

import { incidentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Card,
  Badge,
  EmptyState,
  LoadingScreen,
  SearchBar,
  Chip,
} from '../components';
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';

const { width } = Dimensions.get('window');

// =========================================================
// CONSTANTES
// =========================================================

const STATUTS_INCIDENT = [
  { label: 'Ouvert', value: 'ouvert', color: Colors.danger },
  { label: 'En cours', value: 'en_cours', color: Colors.warning },
  { label: 'Résolu', value: 'resolu', color: Colors.success },
  { label: 'Fermé', value: 'ferme', color: Colors.textMuted },
];

const SEVERITES = [
  { label: 'Faible', value: 'faible', color: Colors.success },
  { label: 'Moyenne', value: 'moyenne', color: Colors.info },
  { label: 'Élevée', value: 'elevee', color: Colors.warning },
  { label: 'Critique', value: 'critique', color: Colors.danger },
];

const TYPES_INCIDENT = [
  { label: 'Panne réseau', value: 'panne_reseau' },
  { label: 'Panne client', value: 'panne_client' },
  { label: 'Sécurité', value: 'securite' },
  { label: 'Équipement', value: 'equipement' },
  { label: 'Autre', value: 'autre' },
];

// =========================================================
// CONFIGURATION DES RÔLES
// =========================================================

const ROLES_CONFIG = {
  admin: {
    label: 'Administrateur',
    shortLabel: 'Admin',
    icon: 'shield-checkmark-outline',
    color: Colors.danger,
  },
  dj: {
    label: 'DJ',
    shortLabel: 'DJ',
    icon: 'musical-notes-outline',
    color: Colors.accent,
  },
  superviseur: {
    label: 'Superviseur',
    shortLabel: 'Superviseur',
    icon: 'briefcase-outline',
    color: Colors.primary,
  },
  technicien: {
    label: 'Technicien',
    shortLabel: 'Technicien',
    icon: 'construct-outline',
    color: Colors.secondary,
  },
};

const getRoleConfig = (role) => {
  if (!role) {
    return {
      label: 'Utilisateur',
      shortLabel: 'Utilisateur',
      icon: 'person-outline',
      color: Colors.textMuted,
    };
  }
  const key = role.toLowerCase();
  return ROLES_CONFIG[key] || {
    label: role,
    shortLabel: role,
    icon: 'person-outline',
    color: Colors.textMuted,
  };
};

/**
 * Détecte le rôle de l'utilisateur concerné par l'incident
 */
const getIncidentRole = (incident) => {
  if (!incident) return null;
  // 1) Si l'API fournit directement user_role
  if (incident.user_role) return incident.user_role.toLowerCase();
  // 2) Sinon, si user_nom existe → c'est un user_id assigné
  if (incident.user_id && incident.user_nom) {
    // On ne connaît pas le rôle exact, mais on sait qu'il y a un user assigné
    return 'utilisateur';
  }
  // 3) Sinon, si technicien_id → c'est un technicien
  if (incident.technicien_id && incident.technicien_nom) return 'technicien';
  // 4) Sinon, si superviseur → superviseur
  if (incident.superviseur_id && incident.superviseur_nom) return 'superviseur';
  return null;
};

/**
 * Extrait le nom complet de l'utilisateur concerné
 */
const getIncidentUserName = (incident) => {
  if (!incident) return { fullName: '', role: null };

  // Priorité 1 : user_id (nouveau)
  if (incident.user_id && incident.user_nom) {
    return {
      fullName: `${incident.user_prenom || ''} ${incident.user_nom || ''}`.trim(),
      role: incident.user_role || 'utilisateur',
      email: incident.user_email || null,
    };
  }

  // Priorité 2 : technicien
  if (incident.technicien_nom) {
    return {
      fullName: `${incident.technicien_prenom || ''} ${incident.technicien_nom || ''}`.trim(),
      role: 'technicien',
      email: incident.technicien_email || null,
    };
  }

  // Priorité 3 : superviseur
  if (incident.superviseur_nom) {
    return {
      fullName: `${incident.superviseur_prenom || ''} ${incident.superviseur_nom || ''}`.trim(),
      role: 'superviseur',
      email: incident.superviseur_email || null,
    };
  }

  return { fullName: '', role: null };
};

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function IncidentsScreen() {
  const navigation = useNavigation();
  const { user, isTechnicien, isSuperviseur, isAdmin, isDJ } = useAuth();
  const canManage = isSuperviseur || isAdmin || isDJ;

  // États
  const [incidents, setIncidents] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedStatut, setSelectedStatut] = useState(null);
  const [selectedSeverite, setSelectedSeverite] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null); // 🎯 Nouveau filtre
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // =========================================================
  // CHARGEMENT DES DONNÉES
  // =========================================================

  const loadData = useCallback(async () => {
    try {
      const statsPromise = (isSuperviseur || isAdmin || isDJ)
        ? incidentsAPI.statistiques().catch(() => null)
        : Promise.resolve(null);

      const [dataRes, statsRes] = await Promise.all([
        incidentsAPI.list(),
        statsPromise,
      ]);

      setIncidents(dataRes?.data || dataRes || []);
      setFiltered(dataRes?.data || dataRes || []);
      setStats(statsRes?.statistiques || null);
    } catch (error) {
      console.error('❌ Erreur chargement incidents:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isSuperviseur, isAdmin, isDJ]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // =========================================================
  // FILTRES ET RECHERCHE
  // =========================================================

  useEffect(() => {
    let result = incidents;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(i => {
        const userInfo = getIncidentUserName(i);
        const haystack = [
          i.titre,
          i.description,
          i.zone,
          i.technicien_nom,
          i.technicien_prenom,
          i.user_nom,
          i.user_prenom,
          i.superviseur_nom,
          i.superviseur_prenom,
          userInfo.fullName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    if (selectedStatut) result = result.filter(i => i.statut === selectedStatut);
    if (selectedSeverite) result = result.filter(i => i.severite === selectedSeverite);
    if (selectedType) result = result.filter(i => i.type_incident === selectedType);
    if (selectedRole) {
      result = result.filter(i => {
        const role = (i.user_role || '').toLowerCase();
        return role === selectedRole;
      });
    }

    setFiltered(result);
  }, [search, selectedStatut, selectedSeverite, selectedType, selectedRole, incidents]);

  // =========================================================
  // HANDLERS
  // =========================================================

  const handleStatutFilter = (statut) => {
    setSelectedStatut(selectedStatut === statut ? null : statut);
  };

  const handleSeveriteFilter = (severite) => {
    setSelectedSeverite(selectedSeverite === severite ? null : severite);
  };

  const handleTypeFilter = (type) => {
    setSelectedType(selectedType === type ? null : type);
  };

  const handleRoleFilter = (role) => {
    setSelectedRole(selectedRole === role ? null : role);
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedStatut(null);
    setSelectedSeverite(null);
    setSelectedType(null);
    setSelectedRole(null);
  };

  const hasActiveFilters =
    selectedStatut || selectedSeverite || selectedType || selectedRole || search.trim();

  const getSeveriteIcon = (severite) => {
    const map = {
      faible: 'information-circle',
      moyenne: 'alert-circle',
      elevee: 'warning',
      critique: 'alert',
    };
    return map[severite] || 'information-circle';
  };

  // =========================================================
  // RENDU
  // =========================================================

  if (loading) {
    return <LoadingScreen message="Chargement des incidents..." />;
  }

  const roleFilters = [
    { label: 'Admin', value: 'admin', color: Colors.danger },
    { label: 'DJ', value: 'dj', color: Colors.accent },
    { label: 'Superviseur', value: 'superviseur', color: Colors.primary },
    { label: 'Technicien', value: 'technicien', color: Colors.secondary },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* HEADER */}
      <GradientHeader colors={[Colors.primary, Colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Gestion des Incidents</Text>
            <Text style={styles.headerSubtitle}>
              {filtered.length} incident{filtered.length > 1 ? 's' : ''}
              {hasActiveFilters && incidents.length !== filtered.length && (
                ` sur ${incidents.length}`
              )}
            </Text>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('IncidentForm', {})} style={styles.addBtn} activeOpacity={0.7}>
            <Ionicons name="add" size={24} color={Colors.textWhite} />
          </TouchableOpacity>
        </View>
      </GradientHeader>

      {/* STATISTIQUES */}
      {stats && (
        <Animated.View style={[styles.statsBar, { opacity: fadeAnim }]}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.global?.total || 0}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.danger }]}>
              {stats.global?.ouverts || 0}
            </Text>
            <Text style={styles.statLabel}>Ouverts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.warning }]}>
              {stats.global?.en_cours || 0}
            </Text>
            <Text style={styles.statLabel}>En cours</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.success }]}>
              {stats.global?.resolus || 0}
            </Text>
            <Text style={styles.statLabel}>Résolus</Text>
          </View>
        </Animated.View>
      )}

      {/* RECHERCHE ET FILTRES */}
      <Animated.View style={[styles.searchSection, { opacity: fadeAnim }]}>
        <View style={styles.searchRow}>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Rechercher un incident..." style={styles.searchBar} />
          <TouchableOpacity
            onPress={() => setShowFilters(!showFilters)}
            style={[styles.filterToggle, showFilters && styles.filterToggleActive]}
          >
            <Ionicons name={showFilters ? 'close' : 'options-outline'} size={20} color={showFilters ? Colors.primary : Colors.textWhite} />
            {hasActiveFilters && !showFilters && <View style={styles.filterBadge} />}
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={styles.filtersContainer}>
            {/* Statut */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Statut :</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {STATUTS_INCIDENT.map(statut => (
                  <Chip
                    key={statut.value}
                    label={statut.label}
                    selected={selectedStatut === statut.value}
                    onPress={() => handleStatutFilter(statut.value)}
                    color={statut.color}
                    style={styles.filterChip}
                  />
                ))}
              </ScrollView>
            </View>

            {/* Sévérité */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Sévérité :</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {SEVERITES.map(sev => (
                  <Chip
                    key={sev.value}
                    label={sev.label}
                    selected={selectedSeverite === sev.value}
                    onPress={() => handleSeveriteFilter(sev.value)}
                    color={sev.color}
                    style={styles.filterChip}
                  />
                ))}
              </ScrollView>
            </View>

            {/* Type */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Type :</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {TYPES_INCIDENT.map(type => (
                  <Chip
                    key={type.value}
                    label={type.label}
                    selected={selectedType === type.value}
                    onPress={() => handleTypeFilter(type.value)}
                    color={Colors.primary}
                    style={styles.filterChip}
                  />
                ))}
              </ScrollView>
            </View>

            {/* 🎯 Rôle */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Rôle concerné :</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {roleFilters.map(r => (
                  <Chip
                    key={r.value}
                    label={r.label}
                    selected={selectedRole === r.value}
                    onPress={() => handleRoleFilter(r.value)}
                    color={r.color}
                    style={styles.filterChip}
                  />
                ))}
              </ScrollView>
            </View>

            {hasActiveFilters && (
              <TouchableOpacity
                onPress={handleResetFilters}
                style={styles.resetFiltersBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh-outline" size={16} color={Colors.danger} />
                <Text style={styles.resetFiltersText}>Réinitialiser les filtres</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Animated.View>

      {/* LISTE */}
      <Animated.FlatList
        data={filtered}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[Colors.primary]} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            title="Aucun incident trouvé"
            subtitle={hasActiveFilters ? 'Aucun résultat pour ces filtres' : 'Aucun incident signalé'}
            icon="✅"
          />
        }
        renderItem={({ item }) => (
          <Animated.View style={{ opacity: fadeAnim }}>
            <IncidentCard
              incident={item}
              canManage={canManage}
              onPress={() => navigation.navigate('IncidentForm', { incident: item })}
              getSeveriteIcon={getSeveriteIcon}
            />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

// =========================================================
// COMPOSANT CARTE INCIDENT
// =========================================================

function IncidentCard({ incident, canManage, onPress, getSeveriteIcon }) {
  const severiteColor = SEVERITES.find(s => s.value === incident.severite)?.color || Colors.textMuted;
  const statutColor = STATUTS_INCIDENT.find(s => s.value === incident.statut)?.color || Colors.textMuted;
  const typeLabel = TYPES_INCIDENT.find(t => t.value === incident.type_incident)?.label || incident.type_incident;

  // 🎯 Rôle et utilisateur concerné
  const userInfo = getIncidentUserName(incident);
  const roleConfig = getRoleConfig(userInfo.role);
  const hasUser = !!userInfo.fullName;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.incidentCard}>
        <View style={styles.cardHeader}>
          <View style={styles.titleSection}>
            <Text style={styles.incidentTitre} numberOfLines={1}>{incident.titre}</Text>
            <Badge label={STATUTS_INCIDENT.find(s => s.value === incident.statut)?.label} color={statutColor} size="sm" />
          </View>
          <View style={styles.severiteIcon}>
            <Ionicons name={getSeveriteIcon(incident.severite)} size={20} color={severiteColor} />
          </View>
        </View>

        <Text style={styles.incidentDesc} numberOfLines={2}>{incident.description}</Text>

        {/* 🎯 SECTION UTILISATEUR AVEC RÔLE */}
        {hasUser && (
          <View style={styles.userSection}>
            <View style={[styles.userAvatar, { backgroundColor: roleConfig.color + '20' }]}>
              <Ionicons name={roleConfig.icon} size={16} color={roleConfig.color} />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName} numberOfLines={1}>{userInfo.fullName}</Text>
              <View style={[styles.roleBadge, { backgroundColor: roleConfig.color + '15', borderColor: roleConfig.color + '40' }]}>
                <Text style={[styles.roleBadgeText, { color: roleConfig.color }]}>
                  {roleConfig.label}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.incidentMeta}>
          {incident.zone && (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.metaText}>{incident.zone}</Text>
            </View>
          )}
          {incident.type_incident && (
            <View style={styles.metaItem}>
              <Ionicons name="pricetag-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.metaText}>{typeLabel}</Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.metaText}>{new Date(incident.created_at).toLocaleDateString('fr-FR')}</Text>
          </View>
        </View>

        {incident.client_appele === 1 && (
          <View style={styles.clientTag}>
            <Ionicons name="call-outline" size={12} color={Colors.primary} />
            <Text style={styles.clientTagText}>Client appelé</Text>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}

// =========================================================
// STYLES
// =========================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: 50, paddingBottom: 16, paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    ...Shadows.card, elevation: 8,
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: Colors.textWhite, fontSize: 18, fontWeight: '700' },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  addBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  statsBar: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg, marginTop: -12,
    borderRadius: Radius.lg, padding: Spacing.md,
    ...Shadows.card, elevation: 4,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: '70%', backgroundColor: Colors.border, alignSelf: 'center' },
  searchSection: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBar: { flex: 1 },
  filterToggle: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
    ...Shadows.light, position: 'relative',
  },
  filterToggleActive: { backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.primary },
  filterBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.danger,
  },
  filtersContainer: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.divider },
  filterGroup: { marginBottom: Spacing.sm },
  filterLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 4, fontWeight: '500' },
  filterChip: { marginRight: 4 },
  resetFiltersBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, marginTop: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.danger + '10',
    borderWidth: 1, borderColor: Colors.danger + '30',
  },
  resetFiltersText: { fontSize: 13, fontWeight: '600', color: Colors.danger },
  list: { padding: Spacing.lg, paddingTop: Spacing.sm },
  separator: { height: 8 },
  incidentCard: { padding: Spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titleSection: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  incidentTitre: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  severiteIcon: { marginLeft: 8 },
  incidentDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },

  // 🎯 SECTION UTILISATEUR
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: Colors.background,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 6,
  },
  userAvatar: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  userDetails: { flex: 1 },
  userName: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 3,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 9, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.3,
  },

  incidentMeta: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  clientTag: {
    flexDirection: 'row', alignItems: 'center', marginTop: 6,
    backgroundColor: Colors.primary + '10', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.full, alignSelf: 'flex-start', gap: 4,
  },
  clientTagText: { fontSize: 11, color: Colors.primary, fontWeight: '500' },
});