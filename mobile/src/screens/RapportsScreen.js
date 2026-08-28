// mobile/src/screens/RapportsScreen.js

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

import { rapportsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Card,
  StatutBadge,
  EmptyState,
  LoadingScreen,
  SearchBar,
  Chip,
  Badge,
} from '../components';
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';

const { width } = Dimensions.get('window');

// =========================================================
// CONSTANTES
// =========================================================

const STATUTS_RAPPORT = [
  { label: 'Brouillon', value: 'brouillon', color: Colors.textMuted },
  { label: 'Soumis', value: 'soumis', color: Colors.warning },
  { label: 'Approuvé', value: 'approuve', color: Colors.success },
  { label: 'Rejeté', value: 'rejete', color: Colors.danger },
];

const TYPES_INTERVENTION = [
  { label: 'Préventive', value: 'preventive' },
  { label: 'Corrective', value: 'corrective' },
  { label: 'Urgente', value: 'urgente' },
];

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function RapportsScreen() {
  const navigation = useNavigation();
  const { user, isTechnicien, isSuperviseur, isAdmin } = useAuth();

  // États
  const [rapports, setRapports] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedStatut, setSelectedStatut] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // ✅ Déterminer si l'utilisateur peut voir les statistiques
  const canSeeStats = isAdmin || isSuperviseur;

  // =========================================================
  // CHARGEMENT DES DONNÉES (CORRIGÉ)
  // =========================================================

  const loadData = useCallback(async () => {
    try {
      // 1. Chargement des rapports – avec fallback en cas d'erreur 500
      let rapportsData = [];
      try {
        const res = await rapportsAPI.list();
        rapportsData = res?.data || res || [];
      } catch (listError) {
        // ✅ On capture l'erreur 500 silencieusement et on garde une liste vide
        console.warn('⚠️ Erreur chargement liste rapports:', listError.message);
        rapportsData = [];
      }

      setRapports(rapportsData);
      setFiltered(rapportsData);

      // 2. Statistiques – uniquement si l'utilisateur a les droits
      if (canSeeStats) {
        try {
          const statsRes = await rapportsAPI.statistiques();
          setStats(statsRes?.statistiques || statsRes || null);
        } catch (statsError) {
          // En cas d'erreur 403, on laisse stats à null
          console.warn('⚠️ Statistiques non disponibles:', statsError.message);
          setStats(null);
        }
      } else {
        setStats(null);
      }
    } catch (error) {
      // Erreur générale (peu probable, car on a déjà catché les sous-appels)
      console.error('❌ Erreur chargement rapports:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canSeeStats]);

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
    let result = rapports;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(r =>
        `${r.titre} ${r.description || ''} ${r.adresse || ''} ${r.technicien_nom || ''} ${r.technicien_prenom || ''}`
          .toLowerCase().includes(q)
      );
    }

    if (selectedStatut) {
      result = result.filter(r => r.statut === selectedStatut);
    }

    if (selectedType) {
      result = result.filter(r => r.type_intervention === selectedType);
    }

    setFiltered(result);
  }, [search, selectedStatut, selectedType, rapports]);

  // =========================================================
  // HANDLERS
  // =========================================================

  const handleStatutFilter = (statut) => {
    setSelectedStatut(selectedStatut === statut ? null : statut);
  };

  const handleTypeFilter = (type) => {
    setSelectedType(selectedType === type ? null : type);
  };

  const getStatutColor = (statut) => {
    const found = STATUTS_RAPPORT.find(s => s.value === statut);
    return found ? found.color : Colors.textMuted;
  };

  const getTypeLabel = (type) => {
    const found = TYPES_INTERVENTION.find(t => t.value === type);
    return found ? found.label : type;
  };

  // =========================================================
  // RENDU
  // =========================================================

  if (loading) {
    return <LoadingScreen message="Chargement des rapports..." />;
  }

  const statutOptions = STATUTS_RAPPORT;
  const typeOptions = TYPES_INTERVENTION;

  // En-tête de la liste : message d'orientation
  const ListHeader = () => (
    <View style={styles.hintContainer}>
      <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
      <Text style={styles.hintText}>
        Cliquez sur les rapports pour voir un rapport bien détaillé
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* HEADER */}
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
            <Text style={styles.headerTitle}>Rapports</Text>
            <Text style={styles.headerSubtitle}>
              {filtered.length} rapport{filtered.length > 1 ? 's' : ''}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate('RapportForm', {})}
            style={styles.addBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={24} color={Colors.textWhite} />
          </TouchableOpacity>
        </View>
      </GradientHeader>

      {/* STATISTIQUES RAPIDES – UNIQUEMENT SI AUTORISÉ */}
      {canSeeStats && stats && (
        <Animated.View style={[styles.statsBar, { opacity: fadeAnim }]}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.global?.total || 0}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.warning }]}>
              {stats.global?.soumis || 0}
            </Text>
            <Text style={styles.statLabel}>Soumis</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.success }]}>
              {stats.global?.approuves || 0}
            </Text>
            <Text style={styles.statLabel}>Approuvés</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.danger }]}>
              {stats.global?.rejetes || 0}
            </Text>
            <Text style={styles.statLabel}>Rejetés</Text>
          </View>
        </Animated.View>
      )}

      {/* RECHERCHE ET FILTRES */}
      <Animated.View style={[styles.searchSection, { opacity: fadeAnim }]}>
        <View style={styles.searchRow}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher un rapport..."
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
                    onPress={() => handleStatutFilter(statut.value)}
                    color={statut.color}
                    style={styles.filterChip}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Type d'intervention :</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {typeOptions.map((type) => (
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
          </View>
        )}
      </Animated.View>

      {/* LISTE DES RAPPORTS AVEC EN-TÊTE */}
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
            title="Aucun rapport trouvé"
            subtitle={search ? 'Aucun résultat pour cette recherche' : 'Créez votre premier rapport'}
            icon="📄"
          />
        }
        renderItem={({ item, index }) => (
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            <RapportCard
              rapport={item}
              onPress={() => navigation.navigate('RapportDetail', { id: item.id })}
              getStatutColor={getStatutColor}
              getTypeLabel={getTypeLabel}
            />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

// =========================================================
// COMPOSANT CARTE RAPPORT
// =========================================================

function RapportCard({ rapport, onPress, getStatutColor, getTypeLabel }) {
  const statutColor = getStatutColor(rapport.statut);
  const host = 'http://10.228.93.120:3000';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.rapportCard}>
        <View style={styles.cardHeader}>
          <View style={styles.titleSection}>
            <Text style={styles.rapportTitre} numberOfLines={1}>
              {rapport.titre}
            </Text>
            <Badge
              label={rapport.statut}
              color={statutColor}
              size="sm"
            />
          </View>
        </View>

        <Text style={styles.rapportDesc} numberOfLines={2}>
          {rapport.description}
        </Text>

        <View style={styles.rapportMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.metaText}>
              {rapport.technicien_prenom || ''} {rapport.technicien_nom || ''}
            </Text>
          </View>

          {rapport.type_intervention && (
            <View style={styles.metaItem}>
              <Ionicons name="construct-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.metaText}>
                {getTypeLabel(rapport.type_intervention)}
              </Text>
            </View>
          )}

          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.metaText}>
              {rapport.date_intervention
                ? new Date(rapport.date_intervention).toLocaleDateString('fr-FR')
                : new Date(rapport.created_at).toLocaleDateString('fr-FR')}
            </Text>
          </View>
        </View>

        {rapport.adresse && (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.addressText} numberOfLines={1}>
              {rapport.adresse}
            </Text>
          </View>
        )}

        {rapport.photos && rapport.photos.length > 0 && (
          <View style={styles.photoRow}>
            <Ionicons name="images-outline" size={16} color={Colors.primary} />
            <Text style={styles.photosCount}>
              {rapport.photos.length} photo{rapport.photos.length > 1 ? 's' : ''}
            </Text>
            <View style={styles.photoThumbs}>
              {rapport.photos.slice(0, 3).map((photo, index) => (
                <View key={index} style={styles.photoThumb}>
                  <Ionicons name="image-outline" size={16} color={Colors.primaryLight} />
                </View>
              ))}
              {rapport.photos.length > 3 && (
                <Text style={styles.photoMore}>+{rapport.photos.length - 3}</Text>
              )}
            </View>
          </View>
        )}

        {rapport.duree_intervention && (
          <View style={styles.dureeRow}>
            <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.dureeText}>
              Durée: {rapport.duree_intervention} min
            </Text>
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

  // SEARCH
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

  // FILTERS
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

  // LIST
  list: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  separator: {
    height: 8,
  },

  // RAPPORT CARD
  rapportCard: {
    padding: Spacing.md,
    marginBottom: 0,
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
  rapportTitre: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  rapportDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },

  rapportMeta: {
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

  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  addressText: {
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
  },

  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  photosCount: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  photoThumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
  },
  photoThumb: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoMore: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },

  dureeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  dureeText: {
    fontSize: 12,
    color: Colors.textMuted,
  },

  // 🆕 STYLES POUR LE MESSAGE D'ORIENTATION
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
});