// mobile/src/screens/SuiviClientsScreen.js
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

import { suiviClientsAPI } from '../services/api';
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

const STATUTS_CLIENT = [
  { label: 'En attente', value: 'en_attente', color: Colors.warning },
  { label: 'Traité', value: 'traite', color: Colors.info },
  { label: 'Résolu', value: 'resolu', color: Colors.success },
  { label: 'Fermé', value: 'ferme', color: Colors.textMuted },
];

const STATUT_COLORS = {
  en_attente: Colors.warning,
  traite: Colors.info,
  resolu: Colors.success,
  ferme: Colors.textMuted,
};

const STATUT_ICONS = {
  en_attente: 'time-outline',
  traite: 'sync-outline',
  resolu: 'checkmark-circle-outline',
  ferme: 'lock-closed-outline',
};

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function SuiviClientsScreen() {
  const navigation = useNavigation();
  const { user, isSuperviseur, isAdmin } = useAuth();
  const canManage = isSuperviseur || isAdmin;

  // États
  const [appels, setAppels] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedStatut, setSelectedStatut] = useState(null);
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

      const statsPromise = canManage
        ? suiviClientsAPI.statistiques().catch(() => null)
        : Promise.resolve(null);

      const [data, statsData] = await Promise.all([
        suiviClientsAPI.list(),
        statsPromise,
      ]);

      setAppels(data?.data || data || []);
      setFiltered(data?.data || data || []);
      setStats(statsData?.statistiques || null);
    } catch (error) {

      if (!error.message?.includes('Accès réservé')) {
        console.error('❌ Erreur chargement appels clients:', error);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canManage]);

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
    let result = appels;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(a =>
        `${a.client_nom} ${a.client_telephone} ${a.motif} ${a.description || ''}`
          .toLowerCase().includes(q)
      );
    }

    if (selectedStatut) {
      result = result.filter(a => a.statut === selectedStatut);
    }

    setFiltered(result);
  }, [search, selectedStatut, appels]);

  // =========================================================
  // HANDLERS
  // =========================================================

  const handleStatusChange = async (appelId, nouveauStatut) => {
    try {
      await suiviClientsAPI.setStatut(appelId, nouveauStatut);
      loadData();
      Alert.alert('✅ Succès', `Statut mis à jour: ${getStatutLabel(nouveauStatut)}`);
    } catch (error) {
      Alert.alert('❌ Erreur', error.message);
    }
  };

  const handleDelete = async (appel) => {
    Alert.alert(
      'Supprimer l\'appel',
      `Êtes-vous sûr de vouloir supprimer l'appel de ${appel.client_nom} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await suiviClientsAPI.delete(appel.id);
              loadData();
            } catch (error) {
              Alert.alert('❌ Erreur', error.message);
            }
          },
        },
      ]
    );
  };

  const handleStatutFilter = (statut) => {
    setSelectedStatut(selectedStatut === statut ? null : statut);
  };

  const getStatutLabel = (statut) => {
    const found = STATUTS_CLIENT.find(s => s.value === statut);
    return found ? found.label : statut;
  };

  const getStatutColor = (statut) => {
    return STATUT_COLORS[statut] || Colors.textMuted;
  };

  const getStatutIcon = (statut) => {
    return STATUT_ICONS[statut] || 'help-circle-outline';
  };

  const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // =========================================================
  // RENDU
  // =========================================================

  if (loading) {
    return <LoadingScreen message="Chargement des appels clients..." />;
  }

  const statutOptions = STATUTS_CLIENT;

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
            <Text style={styles.headerTitle}>Suivi Clients</Text>
            <Text style={styles.headerSubtitle}>
              {filtered.length} appel{filtered.length > 1 ? 's' : ''}
            </Text>
          </View>

          {canManage && (
            <TouchableOpacity
              onPress={() => navigation.navigate('SuiviClientForm', {})}
              style={styles.addBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={24} color={Colors.textWhite} />
            </TouchableOpacity>
          )}
        </View>
      </GradientHeader>

      {/* STATISTIQUES RAPIDES (Affichage uniquement si stats existe) */}
      {stats && (
        <Animated.View style={[styles.statsBar, { opacity: fadeAnim }]}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.global?.total || 0}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.warning }]}>
              {stats.global?.en_attente || 0}
            </Text>
            <Text style={styles.statLabel}>En attente</Text>
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
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher un client..."
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
          </View>
        )}
      </Animated.View>

      {/* LISTE DES APPELS */}
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
        ListEmptyComponent={
          <EmptyState
            title="Aucun appel client"
            subtitle={search ? 'Aucun résultat pour cette recherche' : 'Aucun appel client enregistré'}
            icon="📞"
          />
        }
        renderItem={({ item, index }) => (
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            <AppelCard
              appel={item}
              canManage={canManage}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              getStatutLabel={getStatutLabel}
              getStatutColor={getStatutColor}
              getStatutIcon={getStatutIcon}
              formatDate={formatDate}
            />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

// =========================================================
// COMPOSANT CARTE APPEL
// =========================================================

function AppelCard({
  appel,
  canManage,
  onStatusChange,
  onDelete,
  getStatutLabel,
  getStatutColor,
  getStatutIcon,
  formatDate,
}) {
  const [showActions, setShowActions] = useState(false);
  const statutColor = getStatutColor(appel.statut);
  const statutIcon = getStatutIcon(appel.statut);
  const isFerme = appel.statut === 'ferme';

  return (
    <Card style={styles.appelCard}>
      <View style={styles.cardHeader}>
        <View style={styles.titleSection}>
          <View style={[styles.statusIcon, { backgroundColor: statutColor + '15' }]}>
            <Ionicons name={statutIcon} size={18} color={statutColor} />
          </View>
          <View style={styles.clientInfo}>
            <Text style={styles.clientNom}>{appel.client_nom}</Text>
            <Text style={styles.clientTelephone}>{appel.client_telephone}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Badge
            label={getStatutLabel(appel.statut)}
            color={statutColor}
            size="sm"
          />
          {canManage && !isFerme && (
            <TouchableOpacity
              onPress={() => setShowActions(!showActions)}
              style={styles.moreBtn}
            >
              <Ionicons name="ellipsis-vertical" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Text style={styles.motifText}>{appel.motif}</Text>
      {appel.description && (
        <Text style={styles.descriptionText} numberOfLines={2}>
          {appel.description}
        </Text>
      )}

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.metaText}>
            {formatDate(appel.date_appel)}
          </Text>
        </View>
        {appel.date_traitement && (
          <View style={styles.metaItem}>
            <Ionicons name="checkmark-outline" size={14} color={Colors.success} />
            <Text style={[styles.metaText, { color: Colors.success }]}>
              Traité le {formatDate(appel.date_traitement)}
            </Text>
          </View>
        )}
        {appel.superviseur_nom && (
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.metaText}>
              {appel.superviseur_prenom} {appel.superviseur_nom}
            </Text>
          </View>
        )}
      </View>

      {appel.notes && (
        <View style={styles.notesRow}>
          <Ionicons name="clipboard-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.notesText}>{appel.notes}</Text>
        </View>
      )}

      {showActions && canManage && !isFerme && (
        <View style={styles.actionsRow}>
          {appel.statut !== 'en_attente' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.warning + '15' }]}
              onPress={() => {
                setShowActions(false);
                onStatusChange(appel.id, 'en_attente');
              }}
            >
              <Ionicons name="time-outline" size={14} color={Colors.warning} />
              <Text style={[styles.actionText, { color: Colors.warning }]}>En attente</Text>
            </TouchableOpacity>
          )}
          {appel.statut !== 'traite' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.info + '15' }]}
              onPress={() => {
                setShowActions(false);
                onStatusChange(appel.id, 'traite');
              }}
            >
              <Ionicons name="sync-outline" size={14} color={Colors.info} />
              <Text style={[styles.actionText, { color: Colors.info }]}>Traiter</Text>
            </TouchableOpacity>
          )}
          {appel.statut !== 'resolu' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.success + '15' }]}
              onPress={() => {
                setShowActions(false);
                onStatusChange(appel.id, 'resolu');
              }}
            >
              <Ionicons name="checkmark-outline" size={14} color={Colors.success} />
              <Text style={[styles.actionText, { color: Colors.success }]}>Résoudre</Text>
            </TouchableOpacity>
          )}
          {appel.statut !== 'ferme' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.danger + '15' }]}
              onPress={() => {
                setShowActions(false);
                onStatusChange(appel.id, 'ferme');
              }}
            >
              <Ionicons name="lock-closed-outline" size={14} color={Colors.danger} />
              <Text style={[styles.actionText, { color: Colors.danger }]}>Fermer</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: Colors.danger + '15' }]}
            onPress={() => {
              setShowActions(false);
              onDelete(appel);
            }}
          >
            <Ionicons name="trash-outline" size={14} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
}

// =========================================================
// STYLES (Identiques à votre code)
// =========================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
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
  headerCenter: { flex: 1, alignItems: 'center' },
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
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
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
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBar: { flex: 1 },
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
  filterGroup: { marginBottom: Spacing.sm },
  filterLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
    fontWeight: '500',
  },
  filterChip: { marginRight: 4 },
  list: { padding: Spacing.lg, paddingTop: Spacing.sm },
  separator: { height: 8 },
  appelCard: { padding: Spacing.md, marginBottom: 0 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleSection: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientInfo: { flex: 1 },
  clientNom: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  clientTelephone: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  moreBtn: { padding: 4 },
  motifText: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary, marginTop: 6 },
  descriptionText: { fontSize: 13, color: Colors.textMuted, marginTop: 2, lineHeight: 18 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: Colors.textMuted },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
  },
  notesText: { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    paddingTop: 10,
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
  actionText: { fontSize: 11, fontWeight: '500' },
});