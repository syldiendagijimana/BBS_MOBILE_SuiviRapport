// mobile/src/screens/TechniciensScreen.js

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
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';

import { techniciensAPI } from '../services/api';
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
// CONSTANTES - SPÉCIALITÉS BBS
// =========================================================

const SPECIALITES = [
  { label: 'Fibre optique', icon: 'barcode-outline', color: Colors.primary },
  { label: 'Routeur', icon: 'router-outline', color: Colors.secondary },
  { label: 'Switch', icon: 'git-network-outline', color: Colors.info },
  { label: 'Réseau mobile', icon: 'phone-portrait-outline', color: Colors.warning },
  { label: 'Antenne satellite', icon: 'satellite-outline', color: Colors.danger },
  { label: 'WiMAX', icon: 'wifi-outline', color: Colors.accent },
  { label: 'Câble coaxial', icon: 'extension-puzzle-outline', color: Colors.success },
  { label: 'Serveur', icon: 'server-outline', color: '#6C3483' },
  { label: 'Pare-feu', icon: 'shield-outline', color: '#2C3E50' },
  { label: 'Modem', icon: 'swap-horizontal-outline', color: '#E67E22' },
  { label: 'Amplificateur', icon: 'stats-chart-outline', color: '#1ABC9C' },
  { label: 'Autre', icon: 'construct-outline', color: Colors.textMuted },
];

const getSpecialiteColor = (specialite) => {
  const found = SPECIALITES.find(s => s.label === specialite);
  return found ? found.color : Colors.textMuted;
};

const getSpecialiteIcon = (specialite) => {
  const found = SPECIALITES.find(s => s.label === specialite);
  return found ? found.icon : 'construct-outline';
};

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function TechniciensScreen() {
  const navigation = useNavigation();
  const { canManageTechniciens, isSuperviseur, isAdmin } = useAuth();
  const canManage = canManageTechniciens || isSuperviseur || isAdmin;

  // États
  const [techniciens, setTechniciens] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedSpecialite, setSelectedSpecialite] = useState(null);
  const [selectedDisponible, setSelectedDisponible] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // =========================================================
  // CHARGEMENT DES DONNÉES (CORRIGÉ)
  // =========================================================

  const loadData = useCallback(async () => {
    try {
      // 🔐 Vérification des droits : admin, DJ ou superviseur
      if (!canManage) {
        // Utilisateur non autorisé → on vide les listes et on arrête
        setTechniciens([]);
        setFiltered([]);
        setStats(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Appels API uniquement si autorisé
      const [data, statsData] = await Promise.all([
        techniciensAPI.list(),
        techniciensAPI.statistiques().catch(() => ({})),
      ]);

      // ✅ Log pour déboguer la structure des données
      console.log('📦 Données techniciens reçues:', JSON.stringify(data, null, 2));

      const techniciensList = data?.data || data || [];
      setTechniciens(techniciensList);
      setFiltered(techniciensList);
      setStats(statsData?.statistiques || null);
    } catch (error) {
      console.error('❌ Erreur chargement techniciens:', error);
      Alert.alert('Erreur', 'Impossible de charger les techniciens');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canManage]); // ⬅️ Ajout de canManage comme dépendance

  // Animation d'entrée
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Chargement initial
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Rafraîchissement au focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // =========================================================
  // FILTRES ET RECHERCHE
  // =========================================================

  useEffect(() => {
    let result = techniciens;

    // Filtre par recherche
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(t =>
        `${t.nom} ${t.prenom} ${t.email} ${t.matricule} ${t.specialite || ''} ${t.zone_intervention || ''}`
          .toLowerCase().includes(q)
      );
    }

    // Filtre par spécialité
    if (selectedSpecialite) {
      result = result.filter(t => t.specialite === selectedSpecialite);
    }

    // Filtre par disponibilité
    if (selectedDisponible !== null) {
      result = result.filter(t => t.disponible === selectedDisponible);
    }

    setFiltered(result);
  }, [search, selectedSpecialite, selectedDisponible, techniciens]);

  // =========================================================
  // HANDLERS
  // =========================================================

  // ✅ Correction : vérification de l'ID du technicien
  const handleToggleDisponible = async (technicien) => {
    // Récupération de l'ID avec fallback
    const technicienId = technicien?.id || technicien?.technicien_id || technicien?.utilisateur_id;

    if (!technicienId) {
      console.error('❌ ID du technicien manquant:', technicien);
      Alert.alert('Erreur', 'ID du technicien manquant. Impossible de modifier la disponibilité.');
      return;
    }

    try {
      const newDisponible = technicien.disponible === 1 ? 0 : 1;
      await techniciensAPI.setDisponible(technicienId, newDisponible);
      loadData();
    } catch (error) {
      console.error('❌ Erreur toggle disponibilité:', error);
      Alert.alert('Erreur', error.message || 'Impossible de modifier la disponibilité');
    }
  };

  const handleSpecialiteFilter = (specialite) => {
    setSelectedSpecialite(selectedSpecialite === specialite ? null : specialite);
  };

  const handleDisponibleFilter = (disponible) => {
    setSelectedDisponible(selectedDisponible === disponible ? null : disponible);
  };

  // =========================================================
  // RENDU
  // =========================================================

  if (loading) {
    return <LoadingScreen message="Chargement des techniciens..." />;
  }

  const disponibleOptions = [
    { key: 1, label: 'Disponible', color: Colors.success },
    { key: 0, label: 'Occupé', color: Colors.danger },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* HEADER */}
      <GradientHeader style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Techniciens</Text>
            <Text style={styles.headerSubtitle}>
              {filtered.length} technicien{filtered.length > 1 ? 's' : ''}
            </Text>
          </View>

          {canManage ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('TechnicienForm', {})}
              style={styles.addBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={24} color={Colors.textWhite} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>
      </GradientHeader>

      {/* STATISTIQUES RAPIDES */}
      {stats && (
        <Animated.View style={[styles.statsBar, { opacity: fadeAnim }]}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total || 0}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.success }]}>
              {stats.disponibles || 0}
            </Text>
            <Text style={styles.statLabel}>Disponibles</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.warning }]}>
              {stats.en_mission || 0}
            </Text>
            <Text style={styles.statLabel}>En mission</Text>
          </View>
        </Animated.View>
      )}

      {/* RECHERCHE ET FILTRES */}
      <Animated.View style={[styles.searchSection, { opacity: fadeAnim }]}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un technicien..."
        />

        <View style={styles.filterContainer}>
          <Text style={styles.filterLabel}>Filtrer par spécialité :</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {SPECIALITES.map((spec) => (
              <Chip
                key={spec.label}
                label={spec.label}
                selected={selectedSpecialite === spec.label}
                onPress={() => handleSpecialiteFilter(spec.label)}
                color={spec.color}
                style={styles.filterChip}
                icon={spec.icon}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.filterContainer}>
          <Text style={styles.filterLabel}>Filtrer par disponibilité :</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {disponibleOptions.map((opt) => (
              <Chip
                key={opt.key}
                label={opt.label}
                selected={selectedDisponible === opt.key}
                onPress={() => handleDisponibleFilter(opt.key)}
                color={opt.color}
                style={styles.filterChip}
              />
            ))}
          </ScrollView>
        </View>
      </Animated.View>

      {/* LISTE DES TECHNICIENS */}
      <Animated.FlatList
        data={filtered}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
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
        ListEmptyComponent={
          !canManage ? (
            <EmptyState
              title="Accès restreint"
              subtitle="Vous n'avez pas les droits pour consulter la liste des techniciens."
              icon="🔒"
            />
          ) : (
            <EmptyState
              title="Aucun technicien trouvé"
              subtitle={search ? 'Aucun résultat pour cette recherche' : 'Aucun technicien enregistré'}
              icon="🔧"
            />
          )
        }
        renderItem={({ item, index }) => (
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            <TechnicienCard
              technicien={item}
              canManage={canManage}
              onToggleDisponible={handleToggleDisponible}
              onEdit={() => navigation.navigate('TechnicienForm', { technicien: item })}
              onViewMissions={() => navigation.navigate('Missions', { technicien_id: item.id })}
            />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

// =========================================================
// COMPOSANT CARTE TECHNICIEN
// =========================================================

function TechnicienCard({
  technicien,
  canManage,
  onToggleDisponible,
  onEdit,
  onViewMissions
}) {
  const isDisponible = technicien.disponible === 1;
  const specialiteColor = getSpecialiteColor(technicien.specialite);
  const specialiteIcon = getSpecialiteIcon(technicien.specialite);

  return (
    <Card style={[styles.technicienCard, !isDisponible && styles.indisponibleCard]}>
      <View style={styles.cardHeader}>
        <View style={styles.userRow}>
          <View style={[
            styles.avatar,
            { backgroundColor: isDisponible ? Colors.success + '20' : Colors.danger + '20' }
          ]}>
            <Ionicons
              name={isDisponible ? 'checkmark-circle' : 'time-outline'}
              size={24}
              color={isDisponible ? Colors.success : Colors.danger}
            />
          </View>

          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {technicien.prenom} {technicien.nom}
            </Text>
            <Text style={styles.userEmail}>{technicien.email}</Text>
            <View style={styles.userMeta}>
              <Badge
                label={technicien.matricule}
                color={Colors.primary}
                size="sm"
                icon="id-card-outline"
              />
              {technicien.specialite && (
                <Badge
                  label={technicien.specialite}
                  color={specialiteColor}
                  size="sm"
                  icon={specialiteIcon}
                  style={styles.specialiteBadge}
                />
              )}
            </View>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={() => onToggleDisponible(technicien)}
            style={[
              styles.actionBtn,
              {
                backgroundColor: isDisponible ? Colors.success + '15' : Colors.danger + '15',
                borderColor: isDisponible ? Colors.success + '30' : Colors.danger + '30',
              }
            ]}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isDisponible ? 'checkmark-circle-outline' : 'close-circle-outline'}
              size={16}
              color={isDisponible ? Colors.success : Colors.danger}
            />
          </TouchableOpacity>

          {canManage && (
            <TouchableOpacity
              onPress={onEdit}
              style={[styles.actionBtn, styles.editBtn]}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={16} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* DÉTAILS SUPPLÉMENTAIRES */}
      <View style={styles.detailsRow}>
        {technicien.zone_intervention && (
          <View style={styles.detailItem}>
            <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.detailText}>{technicien.zone_intervention}</Text>
          </View>
        )}
        {technicien.telephone && (
          <View style={styles.detailItem}>
            <Ionicons name="call-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.detailText}>{technicien.telephone}</Text>
          </View>
        )}
        {technicien.en_mission === 1 && (
          <Badge
            label="En mission"
            color={Colors.warning}
            size="sm"
            icon="briefcase-outline"
            style={styles.missionBadge}
          />
        )}
      </View>

      {/* BOUTON MISSIONS */}
      <TouchableOpacity
        onPress={onViewMissions}
        style={styles.missionsBtn}
        activeOpacity={0.7}
      >
        <Ionicons name="list-outline" size={16} color={Colors.primary} />
        <Text style={styles.missionsBtnText}>Voir les missions</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
      </TouchableOpacity>
    </Card>
  );
}

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

  // STATS BAR
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
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: '80%',
    backgroundColor: Colors.border,
    alignSelf: 'center',
  },

  // SEARCH
  searchSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  filterContainer: {
    marginTop: Spacing.sm,
  },
  filterLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 6,
    fontWeight: '500',
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    marginRight: 6,
  },

  // LIST
  list: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  separator: {
    height: 8,
  },

  // TECHNICIEN CARD
  technicienCard: {
    padding: Spacing.md,
    marginBottom: 0,
  },
  indisponibleCard: {
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  userEmail: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  userMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  specialiteBadge: {
    marginLeft: 4,
  },

  // ACTIONS
  cardActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  editBtn: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary + '30',
  },

  // DETAILS
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  missionBadge: {
    marginLeft: 4,
  },

  // MISSIONS BUTTON
  missionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  missionsBtnText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.primary,
    marginLeft: 6,
  },
});