// mobile/src/screens/MissionsScreen.js
// Version avec bouton supprimer compact + permissions

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
} from 'react-native';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';

import { missionsAPI, techniciensAPI } from '../services/api';
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
  { label: 'Planifiée', value: 'planifiee', color: Colors.info },
  { label: 'En cours', value: 'en_cours', color: Colors.warning },
  { label: 'Terminée', value: 'terminee', color: Colors.success },
  { label: 'Annulée', value: 'annulee', color: Colors.danger },
];

const PRIORITES = [
  { label: 'Basse', value: 'basse', color: Colors.success },
  { label: 'Moyenne', value: 'moyenne', color: Colors.info },
  { label: 'Haute', value: 'haute', color: Colors.warning },
  { label: 'Critique', value: 'critique', color: Colors.danger },
];

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function MissionsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, isSuperviseur, isAdmin, isTechnicien, isDJ } = useAuth();

  const canManage = isSuperviseur || isAdmin || isDJ; // 🔐 Gestion des missions (création, modification, suppression)
  const technicienIdParam = route.params?.technicien_id;

  const [missions, setMissions] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedStatut, setSelectedStatut] = useState(null);
  const [selectedPriorite, setSelectedPriorite] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showAffecterModal, setShowAffecterModal] = useState(false);
  const [selectedMission, setSelectedMission] = useState(null);
  const [techniciens, setTechniciens] = useState([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // =========================================================
  // CHARGEMENT DES DONNÉES (CORRIGÉ)
  // =========================================================

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      let missionsData;

      // 1. Chargement des missions (toujours autorisé)
      if (technicienIdParam) {
        const res = await missionsAPI.getByTechnicien(technicienIdParam);
        missionsData = res?.data || res || [];
      } else {
        const res = await missionsAPI.list();
        missionsData = res?.data || res || [];
      }

      setMissions(missionsData);
      setFiltered(missionsData);

      // 2. Statistiques des missions : uniquement admin ou superviseur
      let statsRes = null;
      if (isAdmin || isSuperviseur) {
        statsRes = await missionsAPI.statistiques().catch(() => ({}));
      }
      setStats(statsRes?.statistiques || null);

      // 3. Liste des techniciens : uniquement admin, superviseur ou DJ
      let techsRes = [];
      if (canManage) {
        techsRes = await techniciensAPI.list().catch(() => ({ data: [] }));
      }
      setTechniciens(techsRes?.data || []);

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

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // =========================================================
  // FILTRES
  // =========================================================

  useEffect(() => {
    let result = missions;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(m =>
        `${m.titre} ${m.description || ''} ${m.adresse || ''}`
          .toLowerCase().includes(q)
      );
    }

    if (selectedStatut) {
      result = result.filter(m => m.statut === selectedStatut);
    }

    if (selectedPriorite) {
      result = result.filter(m => m.priorite === selectedPriorite);
    }

    if (selectedType) {
      result = result.filter(m => m.type_mission === selectedType);
    }

    setFiltered(result);
  }, [search, selectedStatut, selectedPriorite, selectedType, missions]);

  // =========================================================
  // HANDLERS
  // =========================================================

  const handleStatusChange = async (mission, nouveauStatut) => {
    try {
      await missionsAPI.setStatut(mission.id, nouveauStatut);
      loadData();
      Alert.alert('✅ Succès', `Mission ${getStatutLabel(nouveauStatut)}`);
    } catch (error) {
      Alert.alert('❌ Erreur', error.message);
    }
  };

  const handleAffecter = async (missionId, technicienId) => {
    try {
      await missionsAPI.affecter(missionId, technicienId);
      loadData();
      setShowAffecterModal(false);
      Alert.alert('✅ Succès', 'Technicien affecté avec succès');
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
    if (type === 'statut') {
      setSelectedStatut(selectedStatut === value ? null : value);
    } else if (type === 'priorite') {
      setSelectedPriorite(selectedPriorite === value ? null : value);
    } else if (type === 'type') {
      setSelectedType(selectedType === value ? null : value);
    }
  };

  const getStatutLabel = (statut) => {
    const found = STATUTS.find(s => s.value === statut);
    return found ? found.label : statut;
  };

  const getPrioriteLabel = (priorite) => {
    const found = PRIORITES.find(p => p.value === priorite);
    return found ? found.label : priorite;
  };

  const getTypeLabel = (type) => {
    const found = TYPES_MISSION.find(t => t.value === type);
    return found ? found.label : type;
  };

  const getTypeIcon = (type) => {
    const found = TYPES_MISSION.find(t => t.value === type);
    return found ? found.icon : 'construct-outline';
  };

  const getTechnicienName = (mission) => {
    if (mission.technicien_nom) {
      return `${mission.technicien_prenom || ''} ${mission.technicien_nom}`.trim();
    }
    return 'Non assigné';
  };

  // =========================================================
  // RENDU
  // =========================================================

  if (loading) {
    return <LoadingScreen message="Chargement des missions..." />;
  }

  const statutOptions = STATUTS;
  const prioriteOptions = PRIORITES;
  const typeOptions = TYPES_MISSION;

  const ListHeader = () => (
    <View style={styles.hintContainer}>
      <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
      <Text style={styles.hintText}>
        Cliquez sur une mission pour voir tous les détails
      </Text>
    </View>
  );

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
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Missions</Text>
            <Text style={styles.headerSubtitle}>
              {filtered.length} mission{filtered.length > 1 ? 's' : ''}
            </Text>
          </View>

          {canManage && (
            <TouchableOpacity
              onPress={() => navigation.navigate('MissionForm', {})}
              style={styles.addBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={24} color={Colors.textWhite} />
            </TouchableOpacity>
          )}
        </View>
      </GradientHeader>

      {/* Afficher les statistiques uniquement si elles existent et si l'utilisateur a les droits */}
      {stats && (isAdmin || isSuperviseur) && (
        <Animated.View style={[styles.statsBar, { opacity: fadeAnim }]}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total || 0}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.warning }]}>
              {stats.en_cours || 0}
            </Text>
            <Text style={styles.statLabel}>En cours</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.success }]}>
              {stats.terminees || 0}
            </Text>
            <Text style={styles.statLabel}>Terminées</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.info }]}>
              {stats.planifiees || 0}
            </Text>
            <Text style={styles.statLabel}>Planifiées</Text>
          </View>
        </Animated.View>
      )}

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
            style={[
              styles.filterToggle,
              showFilters && styles.filterToggleActive,
            ]}
          >
            <Ionicons
              name={showFilters ? 'close' : 'options-outline'}
              size={20}
              color={showFilters ? Colors.primary : Colors.textWhite}
            />
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={styles.filtersContainer}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Statut :</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {statutOptions.map((statut) => (
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
              <Text style={styles.filterLabel}>Priorité :</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {prioriteOptions.map((priorite) => (
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
              <Text style={styles.filterLabel}>Type :</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {typeOptions.map((type) => (
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
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={<ListHeader />}
        ListEmptyComponent={
          <EmptyState
            title="Aucune mission trouvée"
            subtitle={search ? 'Aucun résultat pour cette recherche' : 'Aucune mission enregistrée'}
            icon="📋"
          />
        }
        renderItem={({ item, index }) => (
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
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
              getTechnicienName={getTechnicienName}
            />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Modal d'affectation : visible uniquement pour canManage */}
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
                <Text style={styles.modalTitle}>Affecter un technicien</Text>
                <TouchableOpacity onPress={() => setShowAffecterModal(false)}>
                  <Ionicons name="close" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                Mission: {selectedMission?.titre}
              </Text>

              <ScrollView style={styles.modalList}>
                {techniciens.filter(t => t.disponible === 1).map((tech) => (
                  <TouchableOpacity
                    key={tech.id}
                    style={styles.techItem}
                    onPress={() => handleAffecter(selectedMission?.id, tech.id)}
                  >
                    <View style={styles.techAvatar}>
                      <Text style={styles.techAvatarText}>
                        {tech.prenom?.[0]}{tech.nom?.[0]}
                      </Text>
                    </View>
                    <View style={styles.techInfo}>
                      <Text style={styles.techName}>
                        {tech.prenom} {tech.nom}
                      </Text>
                      <Text style={styles.techDetail}>
                        {tech.matricule} • {tech.specialite || 'Généraliste'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </ScrollView>

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
// COMPOSANT CARTE MISSION
// =========================================================

function MissionCard({
  mission,
  canManage,
  isTechnicien,
  onStatusChange,
  onAffecter,
  onDelete,
  onPress,
  getTechnicienName
}) {
  const [showActions, setShowActions] = useState(false);

  const statutColor = STATUTS.find(s => s.value === mission.statut)?.color || Colors.textMuted;
  const prioriteColor = PRIORITES.find(p => p.value === mission.priorite)?.color || Colors.textMuted;
  const typeIcon = TYPES_MISSION.find(t => t.value === mission.type_mission)?.icon || 'construct-outline';

  const isTerminee = mission.statut === 'terminee' || mission.statut === 'annulee';
  const canDelete = canManage; // Suppression toujours disponible

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={[styles.missionCard, isTerminee && styles.termineeCard]}>
        <View style={styles.cardHeader}>
          <View style={styles.titleSection}>
            <Text style={styles.missionTitle}>{mission.titre}</Text>
            <Badge
              label={getStatutLabel(mission.statut)}
              color={statutColor}
              size="sm"
            />
          </View>

          {canManage && !isTerminee && (
            <TouchableOpacity
              onPress={() => setShowActions(!showActions)}
              style={styles.moreBtn}
            >
              <Ionicons name="ellipsis-vertical" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {mission.description && (
          <Text style={styles.missionDescription} numberOfLines={2}>
            {mission.description}
          </Text>
        )}

        <View style={styles.missionMeta}>
          <View style={styles.metaItem}>
            <Ionicons name={typeIcon} size={14} color={Colors.textMuted} />
            <Text style={styles.metaText}>{getTypeLabel(mission.type_mission)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="flag-outline" size={14} color={prioriteColor} />
            <Text style={[styles.metaText, { color: prioriteColor }]}>
              {getPrioriteLabel(mission.priorite)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.metaText}>{getTechnicienName(mission)}</Text>
          </View>
        </View>

        {mission.date_debut && (
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.dateText}>
              Début: {new Date(mission.date_debut).toLocaleDateString('fr-FR')}
              {mission.date_fin_prevue && ` • Fin: ${new Date(mission.date_fin_prevue).toLocaleDateString('fr-FR')}`}
            </Text>
          </View>
        )}

        {mission.adresse && (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.addressText}>{mission.adresse}</Text>
          </View>
        )}

        {showActions && canManage && !isTerminee && (
          <View style={styles.actionsRow}>
            {mission.statut !== 'planifiee' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Colors.info + '15' }]}
                onPress={() => onStatusChange(mission, 'planifiee')}
              >
                <Ionicons name="calendar-outline" size={16} color={Colors.info} />
                <Text style={[styles.actionText, { color: Colors.info }]}>Planifier</Text>
              </TouchableOpacity>
            )}
            {mission.statut !== 'en_cours' && !isTerminee && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Colors.warning + '15' }]}
                onPress={() => onStatusChange(mission, 'en_cours')}
              >
                <Ionicons name="play-outline" size={16} color={Colors.warning} />
                <Text style={[styles.actionText, { color: Colors.warning }]}>Démarrer</Text>
              </TouchableOpacity>
            )}
            {mission.statut !== 'terminee' && !isTerminee && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Colors.success + '15' }]}
                onPress={() => onStatusChange(mission, 'terminee')}
              >
                <Ionicons name="checkmark-outline" size={16} color={Colors.success} />
                <Text style={[styles.actionText, { color: Colors.success }]}>Terminer</Text>
              </TouchableOpacity>
            )}
            {mission.statut !== 'annulee' && !isTerminee && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Colors.danger + '15' }]}
                onPress={() => onStatusChange(mission, 'annulee')}
              >
                <Ionicons name="close-outline" size={16} color={Colors.danger} />
                <Text style={[styles.actionText, { color: Colors.danger }]}>Annuler</Text>
              </TouchableOpacity>
            )}
            {!mission.technicien_id && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Colors.primary + '15' }]}
                onPress={onAffecter}
              >
                <Ionicons name="person-add-outline" size={16} color={Colors.primary} />
                <Text style={[styles.actionText, { color: Colors.primary }]}>Affecter</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Bouton SUPPRIMER COMPACT */}
        {canDelete && (
          <View style={styles.deleteRow}>
            <TouchableOpacity
              style={[styles.deleteBtn, { backgroundColor: Colors.danger + '15' }]}
              onPress={() => onDelete(mission)}
            >
              <Ionicons name="trash-outline" size={14} color={Colors.danger} />
              <Text style={[styles.deleteBtnText, { color: Colors.danger }]}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}

// =========================================================
// FONCTIONS UTILITAIRES
// =========================================================

const getStatutLabel = (statut) => {
  const found = STATUTS.find(s => s.value === statut);
  return found ? found.label : statut;
};

const getPrioriteLabel = (priorite) => {
  const found = PRIORITES.find(p => p.value === priorite);
  return found ? found.label : priorite;
};

const getTypeLabel = (type) => {
  const found = TYPES_MISSION.find(t => t.value === type);
  return found ? found.label : type;
};

// =========================================================
// STYLES (inchangés)
// =========================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...Shadows.card,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: Colors.textWhite,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  statsBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginTop: -12,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadows.card,
    elevation: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: '70%',
    backgroundColor: Colors.border,
    alignSelf: 'center',
  },

  searchSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBar: {
    flex: 1,
  },
  filterToggle: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.light,
  },
  filterToggleActive: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },

  filtersContainer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  filterGroup: {
    marginBottom: Spacing.sm,
  },
  filterLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
    fontWeight: '500',
  },
  filterChip: {
    marginRight: 4,
  },

  list: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  separator: {
    height: 8,
  },

  missionCard: {
    padding: Spacing.md,
    marginBottom: 0,
  },
  termineeCard: {
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  missionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  moreBtn: {
    padding: 4,
  },

  missionDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },

  missionMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    color: Colors.textMuted,
  },

  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  addressText: {
    fontSize: 12,
    color: Colors.textMuted,
  },

  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    gap: 4,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '500',
  },

  deleteRow: {
    marginTop: 4,
    alignItems: 'flex-end',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    gap: 4,
  },
  deleteBtnText: {
    fontSize: 10,
    fontWeight: '500',
  },

  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '08',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
    marginBottom: 8,
  },
  hintText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginLeft: 6,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    maxHeight: '80%',
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
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  modalList: {
    maxHeight: 400,
  },
  techItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  techAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  techAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  techInfo: {
    flex: 1,
  },
  techName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  techDetail: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});