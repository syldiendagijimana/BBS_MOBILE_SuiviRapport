// mobile/src/screens/MissionsScreen.js
// Version améliorée : affichage propre + rôle utilisateur visible

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  StatusBar,
  Animated,
  Dimensions,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';

import { missionsAPI, fetchAllUsers } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Card,
  Badge,
  EmptyState,
  LoadingScreen,
  SearchBar,
  Chip,
  Button,
} from '../components';
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';

const { width } = Dimensions.get('window');

// =========================================================
// CONSTANTES
// =========================================================

const TYPES_MISSION = [
  { label: 'Installation', value: 'installation', icon: 'construct-outline' },
  { label: 'Maintenance', value: 'maintenance', icon: 'settings-outline' },
  { label: 'Réparation', value: 'reparation', icon: 'hammer-outline' },
  { label: 'Inspection', value: 'inspection', icon: 'search-outline' },
  { label: 'Urgence', value: 'urgence', icon: 'alert-circle-outline' },
];

const STATUTS = [
  { label: 'Planifiée', value: 'planifiee', color: Colors.info, icon: 'calendar-outline' },
  { label: 'En cours', value: 'en_cours', color: Colors.warning, icon: 'time-outline' },
  { label: 'Terminée', value: 'terminee', color: Colors.success, icon: 'checkmark-circle-outline' },
  { label: 'Annulée', value: 'annulee', color: Colors.danger, icon: 'close-circle-outline' },
];

const PRIORITES = [
  { label: 'Basse', value: 'basse', color: Colors.success, icon: 'chevron-down-circle-outline' },
  { label: 'Moyenne', value: 'moyenne', color: Colors.info, icon: 'radio-button-off-outline' },
  { label: 'Haute', value: 'haute', color: Colors.warning, icon: 'chevron-up-circle-outline' },
  { label: 'Critique', value: 'critique', color: Colors.danger, icon: 'warning-outline' },
];

// =========================================================
// CONFIGURATION DES RÔLES
// =========================================================

const ROLES_CONFIG = {
  admin: { label: 'Administrateur', shortLabel: 'Admin', icon: 'shield-checkmark-outline', color: Colors.danger },
  dj: { label: 'DJ', shortLabel: 'DJ', icon: 'musical-notes-outline', color: Colors.accent },
  superviseur: { label: 'Superviseur', shortLabel: 'Superviseur', icon: 'briefcase-outline', color: Colors.primary },
  technicien: { label: 'Technicien', shortLabel: 'Technicien', icon: 'construct-outline', color: Colors.secondary },
};

const getRoleConfig = (role) => {
  if (!role) return {
    label: 'Utilisateur',
    shortLabel: 'Utilisateur',
    icon: 'person-outline',
    color: Colors.textMuted,
  };
  const key = role.toLowerCase();
  return ROLES_CONFIG[key] || {
    label: role,
    shortLabel: role,
    icon: 'person-outline',
    color: Colors.textMuted,
  };
};

/**
 * Extrait le nom + rôle de l'utilisateur concerné par la mission
 */
const getMissionUser = (mission) => {
  if (!mission) return { fullName: '', role: null, email: null };

  // Priorité 1 : user_id (nouveau)
  if (mission.user_id && mission.user_nom) {
    return {
      fullName: `${mission.user_prenom || ''} ${mission.user_nom || ''}`.trim(),
      role: mission.user_role || 'utilisateur',
      email: mission.user_email || null,
    };
  }

  // Priorité 2 : technicien
  if (mission.technicien_nom) {
    return {
      fullName: `${mission.technicien_prenom || ''} ${mission.technicien_nom || ''}`.trim(),
      role: 'technicien',
      email: mission.technicien_email || null,
    };
  }

  // Priorité 3 : superviseur
  if (mission.superviseur_nom) {
    return {
      fullName: `${mission.superviseur_prenom || ''} ${mission.superviseur_nom || ''}`.trim(),
      role: 'superviseur',
      email: mission.superviseur_email || null,
    };
  }

  return { fullName: '', role: null, email: null };
};

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function MissionsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, isSuperviseur, isAdmin, isTechnicien, isDJ } = useAuth();

  const canManage = isSuperviseur || isAdmin || isDJ;
  const technicienIdParam = route.params?.technicien_id;

  const [missions, setMissions] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedStatut, setSelectedStatut] = useState(null);
  const [selectedPriorite, setSelectedPriorite] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showAffecterModal, setShowAffecterModal] = useState(false);
  const [selectedMission, setSelectedMission] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // =========================================================
  // CHARGEMENT DES DONNÉES
  // =========================================================

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      let missionsData;
      if (technicienIdParam) {
        const res = await missionsAPI.getByTechnicien(technicienIdParam);
        missionsData = res?.data || res || [];
      } else {
        const res = await missionsAPI.list();
        missionsData = res?.data || res || [];
      }

      setMissions(missionsData);
      setFiltered(missionsData);

      let statsRes = null;
      if (isAdmin || isSuperviseur) {
        statsRes = await missionsAPI.statistiques().catch(() => ({}));
      }
      setStats(statsRes?.statistiques || null);

      if (canManage) {
        setLoadingUsers(true);
        const usersList = await fetchAllUsers().catch(() => []);
        setAllUsers(usersList || []);
        setLoadingUsers(false);
      }

    } catch (error) {
      console.error('❌ Erreur chargement missions:', error);
      Alert.alert('Erreur', 'Impossible de charger les missions. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [technicienIdParam, isAdmin, isSuperviseur, canManage]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // =========================================================
  // FILTRES
  // =========================================================

  useEffect(() => {
    let result = missions;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(m => {
        const userInfo = getMissionUser(m);
        const haystack = [
          m.titre, m.description, m.adresse,
          m.technicien_nom, m.technicien_prenom,
          m.user_nom, m.user_prenom,
          m.superviseur_nom, m.superviseur_prenom,
          userInfo.fullName,
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      });
    }

    if (selectedStatut) result = result.filter(m => m.statut === selectedStatut);
    if (selectedPriorite) result = result.filter(m => m.priorite === selectedPriorite);
    if (selectedType) result = result.filter(m => m.type_mission === selectedType);
    if (selectedRole) {
      result = result.filter(m => {
        const role = (m.user_role || '').toLowerCase();
        return role === selectedRole;
      });
    }

    setFiltered(result);
  }, [search, selectedStatut, selectedPriorite, selectedType, selectedRole, missions]);

  // =========================================================
  // HANDLERS
  // =========================================================

  const handleStatusChange = async (mission, nouveauStatut) => {
    try {
      await missionsAPI.setStatut(mission.id, nouveauStatut);
      loadData();
      Alert.alert('✅ Succès', `Mission ${STATUTS.find(s => s.value === nouveauStatut)?.label}`);
    } catch (error) {
      Alert.alert('❌ Erreur', error.message);
    }
  };

  const handleAffecter = async (missionId, userId) => {
    try {
      await missionsAPI.affecter(missionId, userId);
      loadData();
      setShowAffecterModal(false);
      Alert.alert('✅ Succès', 'Utilisateur affecté avec succès');
    } catch (error) {
      Alert.alert('❌ Erreur', error.message);
    }
  };

  const handleDelete = async (mission) => {
    if (!canManage) {
      Alert.alert('Permission refusée', 'Vous n\'avez pas le droit de supprimer cette mission.');
      return;
    }

    Alert.alert(
      'Supprimer la mission',
      `Êtes-vous sûr de vouloir supprimer "${mission.titre}" ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await missionsAPI.delete(mission.id);
              loadData();
              Alert.alert('✅ Succès', 'Mission supprimée avec succès.');
            } catch (error) {
              Alert.alert('❌ Erreur', error.message || 'Impossible de supprimer la mission.');
            }
          },
        },
      ]
    );
  };

  const handleFilter = (type, value) => {
    if (type === 'statut') setSelectedStatut(selectedStatut === value ? null : value);
    else if (type === 'priorite') setSelectedPriorite(selectedPriorite === value ? null : value);
    else if (type === 'type') setSelectedType(selectedType === value ? null : value);
    else if (type === 'role') setSelectedRole(selectedRole === value ? null : value);
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedStatut(null);
    setSelectedPriorite(null);
    setSelectedType(null);
    setSelectedRole(null);
  };

  const hasActiveFilters =
    selectedStatut || selectedPriorite || selectedType || selectedRole || search.trim();

  // =========================================================
  // RENDU
  // =========================================================

  if (loading) {
    return <LoadingScreen message="Chargement des missions..." />;
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

      <GradientHeader
        colors={[Colors.primary, Colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Missions</Text>
            <Text style={styles.headerSubtitle}>
              {filtered.length} mission{filtered.length > 1 ? 's' : ''}
              {hasActiveFilters && missions.length !== filtered.length && ` sur ${missions.length}`}
            </Text>
          </View>

          {canManage && (
            <TouchableOpacity onPress={() => navigation.navigate('MissionForm', {})} style={styles.addBtn} activeOpacity={0.7}>
              <Ionicons name="add" size={24} color={Colors.textWhite} />
            </TouchableOpacity>
          )}
        </View>
      </GradientHeader>

      {/* STATISTIQUES */}
      {stats && (isAdmin || isSuperviseur) && (
        <Animated.View style={[styles.statsBar, { opacity: fadeAnim }]}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total || 0}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.warning }]}>{stats.en_cours || 0}</Text>
            <Text style={styles.statLabel}>En cours</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.success }]}>{stats.terminees || 0}</Text>
            <Text style={styles.statLabel}>Terminées</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.info }]}>{stats.planifiees || 0}</Text>
            <Text style={styles.statLabel}>Planifiées</Text>
          </View>
        </Animated.View>
      )}

      {/* RECHERCHE */}
      <Animated.View style={[styles.searchSection, { opacity: fadeAnim }]}>
        <View style={styles.searchRow}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher une mission..."
            style={styles.searchBar}
          />
          <TouchableOpacity
            onPress={() => setShowFilters(!showFilters)}
            style={[styles.filterToggle, showFilters && styles.filterToggleActive]}
          >
            <Ionicons
              name={showFilters ? 'close' : 'options-outline'}
              size={20}
              color={showFilters ? Colors.primary : Colors.textWhite}
            />
            {hasActiveFilters && !showFilters && <View style={styles.filterBadge} />}
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={styles.filtersContainer}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Statut</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
                {STATUTS.map((statut) => (
                  <Chip
                    key={statut.value}
                    label={statut.label}
                    selected={selectedStatut === statut.value}
                    onPress={() => handleFilter('statut', statut.value)}
                    color={statut.color}
                    style={styles.filterChip}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Priorité</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
                {PRIORITES.map((priorite) => (
                  <Chip
                    key={priorite.value}
                    label={priorite.label}
                    selected={selectedPriorite === priorite.value}
                    onPress={() => handleFilter('priorite', priorite.value)}
                    color={priorite.color}
                    style={styles.filterChip}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
                {TYPES_MISSION.map((type) => (
                  <Chip
                    key={type.value}
                    label={type.label}
                    selected={selectedType === type.value}
                    onPress={() => handleFilter('type', type.value)}
                    color={Colors.primary}
                    style={styles.filterChip}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Rôle concerné</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
                {roleFilters.map(r => (
                  <Chip
                    key={r.value}
                    label={r.label}
                    selected={selectedRole === r.value}
                    onPress={() => handleFilter('role', r.value)}
                    color={r.color}
                    style={styles.filterChip}
                  />
                ))}
              </ScrollView>
            </View>

            {hasActiveFilters && (
              <TouchableOpacity onPress={handleResetFilters} style={styles.resetFiltersBtn} activeOpacity={0.7}>
                <Ionicons name="refresh-outline" size={16} color={Colors.danger} />
                <Text style={styles.resetFiltersText}>Réinitialiser les filtres</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Animated.View>

      <Animated.FlatList
        data={filtered}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Aucune mission trouvée"
            subtitle={hasActiveFilters ? 'Aucun résultat pour ces filtres' : 'Aucune mission enregistrée'}
            icon="📋"
          />
        }
        renderItem={({ item }) => (
          <Animated.View style={{ opacity: fadeAnim }}>
            <MissionCard
              mission={item}
              canManage={canManage}
              isTechnicien={isTechnicien}
              onStatusChange={handleStatusChange}
              onAffecter={() => {
                setSelectedMission(item);
                setShowAffecterModal(true);
              }}
              onDelete={handleDelete}
              onPress={() => navigation.navigate('MissionDetail', { id: item.id })}
            />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* MODAL AFFECTER */}
      {canManage && (
        <Modal
          visible={showAffecterModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAffecterModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Affecter un utilisateur</Text>
                <TouchableOpacity onPress={() => setShowAffecterModal(false)}>
                  <Ionicons name="close" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                Mission: {selectedMission?.titre}
              </Text>

              {loadingUsers ? (
                <View style={styles.modalEmpty}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={[styles.modalEmptyText, { marginTop: 8 }]}>
                    Chargement des utilisateurs...
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                  {allUsers.map((u) => {
                    const roleConf = getRoleConfig(u.role);
                    return (
                      <TouchableOpacity
                        key={u.id}
                        style={styles.userItem}
                        onPress={() => handleAffecter(selectedMission?.id, u.id)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.userAvatar, { backgroundColor: roleConf.color + '20' }]}>
                          <Ionicons name={roleConf.icon} size={18} color={roleConf.color} />
                        </View>
                        <View style={styles.userInfo}>
                          <Text style={styles.userName}>{u.prenom} {u.nom}</Text>
                          <View style={[styles.userRoleBadge, { backgroundColor: roleConf.color + '15' }]}>
                            <Text style={[styles.userRoleText, { color: roleConf.color }]}>
                              {roleConf.label}
                            </Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              <Button
                title="Annuler"
                variant="ghost"
                onPress={() => setShowAffecterModal(false)}
                fullWidth
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// =========================================================
// COMPOSANT CARTE MISSION — AFFICHAGE AMÉLIORÉ
// =========================================================

function MissionCard({
  mission,
  canManage,
  isTechnicien,
  onStatusChange,
  onAffecter,
  onDelete,
  onPress,
}) {
  const [showActions, setShowActions] = useState(false);

  const statutInfo = STATUTS.find(s => s.value === mission.statut) || { label: mission.statut, color: Colors.textMuted, icon: 'help-outline' };
  const prioriteInfo = PRIORITES.find(p => p.value === mission.priorite) || { label: mission.priorite, color: Colors.textMuted };
  const typeInfo = TYPES_MISSION.find(t => t.value === mission.type_mission) || { label: mission.type_mission, icon: 'construct-outline' };

  const isTerminee = mission.statut === 'terminee' || mission.statut === 'annulee';

  const userInfo = getMissionUser(mission);
  const roleConfig = getRoleConfig(userInfo.role);
  const hasUser = !!userInfo.fullName;
  const initials = userInfo.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={[styles.missionCard, isTerminee && styles.termineeCard]}>

        {/* LIGNE DE COULEUR EN HAUT SELON STATUT */}
        <View style={[styles.cardTopBar, { backgroundColor: statutInfo.color }]} />

        {/* EN-TÊTE : Titre + Badge statut */}
        <View style={styles.cardHeader}>
          <View style={styles.titleSection}>
            <Text style={styles.missionTitle} numberOfLines={2}>{mission.titre}</Text>
          </View>

          <View style={styles.cardHeaderRight}>
            <View style={[styles.statutPill, { backgroundColor: statutInfo.color + '15', borderColor: statutInfo.color + '40' }]}>
              <Ionicons name={statutInfo.icon} size={11} color={statutInfo.color} />
              <Text style={[styles.statutPillText, { color: statutInfo.color }]}>
                {statutInfo.label}
              </Text>
            </View>

            {canManage && !isTerminee && (
              <TouchableOpacity onPress={() => setShowActions(!showActions)} style={styles.moreBtn}>
                <Ionicons name="ellipsis-vertical" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* DESCRIPTION */}
        {mission.description && (
          <Text style={styles.missionDescription} numberOfLines={2}>
            {mission.description}
          </Text>
        )}

        {/* LIGNE INFO : Type + Priorité (compacte et lisible) */}
        <View style={styles.infoPillsRow}>
          <View style={styles.infoPill}>
            <Ionicons name={typeInfo.icon} size={13} color={Colors.textSecondary} />
            <Text style={styles.infoPillText}>{typeInfo.label}</Text>
          </View>
          <View style={[styles.infoPill, { backgroundColor: prioriteInfo.color + '12' }]}>
            <Ionicons name="flag-outline" size={13} color={prioriteInfo.color} />
            <Text style={[styles.infoPillText, { color: prioriteInfo.color, fontWeight: '600' }]}>
              {prioriteInfo.label}
            </Text>
          </View>
        </View>

        {/* 🎯 SECTION UTILISATEUR (bien distincte) */}
        {hasUser && (
          <View style={styles.userSection}>
            <View style={[styles.userAvatarSmall, { backgroundColor: roleConfig.color + '20' }]}>
              <Text style={[styles.userAvatarText, { color: roleConfig.color }]}>{initials}</Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userNameSmall} numberOfLines={1}>{userInfo.fullName}</Text>
              <View style={[styles.roleBadge, { backgroundColor: roleConfig.color + '15', borderColor: roleConfig.color + '40' }]}>
                <Ionicons name={roleConfig.icon} size={10} color={roleConfig.color} />
                <Text style={[styles.roleBadgeText, { color: roleConfig.color }]}>
                  {roleConfig.shortLabel}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* DATES + ADRESSE */}
        <View style={styles.metaFooter}>
          {mission.date_debut && (
            <View style={styles.metaFooterItem}>
              <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.metaFooterText}>
                {new Date(mission.date_debut).toLocaleDateString('fr-FR')}
                {mission.date_fin_prevue && ` → ${new Date(mission.date_fin_prevue).toLocaleDateString('fr-FR')}`}
              </Text>
            </View>
          )}
          {mission.adresse && (
            <View style={styles.metaFooterItem}>
              <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.metaFooterText} numberOfLines={1}>{mission.adresse}</Text>
            </View>
          )}
        </View>

        {/* ACTIONS RAPIDES */}
        {showActions && canManage && !isTerminee && (
          <View style={styles.actionsRow}>
            {mission.statut !== 'planifiee' && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.info + '15' }]} onPress={() => onStatusChange(mission, 'planifiee')}>
                <Ionicons name="calendar-outline" size={15} color={Colors.info} />
                <Text style={[styles.actionText, { color: Colors.info }]}>Planifier</Text>
              </TouchableOpacity>
            )}
            {mission.statut !== 'en_cours' && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.warning + '15' }]} onPress={() => onStatusChange(mission, 'en_cours')}>
                <Ionicons name="play-outline" size={15} color={Colors.warning} />
                <Text style={[styles.actionText, { color: Colors.warning }]}>Démarrer</Text>
              </TouchableOpacity>
            )}
            {mission.statut !== 'terminee' && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.success + '15' }]} onPress={() => onStatusChange(mission, 'terminee')}>
                <Ionicons name="checkmark-outline" size={15} color={Colors.success} />
                <Text style={[styles.actionText, { color: Colors.success }]}>Terminer</Text>
              </TouchableOpacity>
            )}
            {mission.statut !== 'annulee' && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.danger + '15' }]} onPress={() => onStatusChange(mission, 'annulee')}>
                <Ionicons name="close-outline" size={15} color={Colors.danger} />
                <Text style={[styles.actionText, { color: Colors.danger }]}>Annuler</Text>
              </TouchableOpacity>
            )}
            {!mission.technicien_id && !mission.user_id && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.primary + '15' }]} onPress={onAffecter}>
                <Ionicons name="person-add-outline" size={15} color={Colors.primary} />
                <Text style={[styles.actionText, { color: Colors.primary }]}>Affecter</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* SUPPRIMER */}
        {canManage && !isTerminee && (
          <View style={styles.deleteRow}>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(mission)}>
              <Ionicons name="trash-outline" size={13} color={Colors.danger} />
              <Text style={styles.deleteBtnText}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}

// =========================================================
// STYLES AMÉLIORÉS
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: Colors.textWhite, fontSize: 18, fontWeight: '700' },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  addBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
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
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    ...Shadows.light, position: 'relative',
  },
  filterToggleActive: { backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.primary },
  filterBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.danger,
  },
  filtersContainer: {
    marginTop: Spacing.md, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.divider,
  },
  filterGroup: { marginBottom: Spacing.md },
  filterLabel: {
    fontSize: 12, color: Colors.textMuted,
    marginBottom: 6, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.3,
  },
  filterChipsRow: { gap: 6, paddingRight: 8 },
  filterChip: { marginRight: 0 },
  resetFiltersBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, marginTop: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.danger + '10',
    borderWidth: 1, borderColor: Colors.danger + '30',
  },
  resetFiltersText: { fontSize: 13, fontWeight: '600', color: Colors.danger },

  list: { padding: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: 20 },
  separator: { height: 10 },

  // =========================================================
  // CARTE MISSION
  // =========================================================
  missionCard: {
    padding: 0,
    marginBottom: 0,
    overflow: 'hidden',
    borderRadius: Radius.lg,
  },
  termineeCard: { opacity: 0.75 },

  cardTopBar: { height: 4, width: '100%' },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: 10,
  },
  titleSection: { flex: 1 },
  missionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 21,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statutPillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  moreBtn: {
    padding: 4,
    borderRadius: 6,
  },

  missionDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    paddingHorizontal: Spacing.md,
    marginTop: 6,
  },

  // Ligne type + priorité
  infoPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: Spacing.md,
    marginTop: 10,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.background,
  },
  infoPillText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
  },

  // 🎯 Section utilisateur
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: Spacing.md,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: Colors.background,
    borderRadius: 10,
  },
  userAvatarSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  userDetails: { flex: 1 },
  userNameSmall: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    marginTop: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Footer meta
  metaFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: Spacing.md,
    paddingTop: 10,
    paddingBottom: Spacing.md,
  },
  metaFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  metaFooterText: {
    fontSize: 11,
    color: Colors.textMuted,
    flexShrink: 1,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.sm,
    gap: 4,
  },
  actionText: { fontSize: 11, fontWeight: '600' },

  deleteRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    gap: 4,
    backgroundColor: Colors.danger + '10',
  },
  deleteBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.danger,
  },

  // MODAL
  modalOverlay: {

      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg, maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  modalTitle: {
        fontSize: 18,
        fontWeight: '700', color: Colors.textPrimary },
  modalSubtitle: {
    fontSize: 14, color: Colors.textSecondary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  modalList: { maxHeight: 400 },
  modalEmpty: { padding: 20, alignItems: 'center' },
  modalEmptyText: { fontSize: 14, color: Colors.textMuted },

  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: 12,
  },
  userAvatar: {
    width: 40, height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 14,
  fontWeight: '500', color: Colors.textPrimary },
  userRoleBadge: {
    alignSelf: 'flex-start',
    marginTop: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  userRoleText: { fontSize: 10, fontWeight: '700' },
});