// mobile/src/screens/SuperviseursScreen.js
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
import { superviseursAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Card,
  Badge,
  Button,
  EmptyState,
  LoadingScreen,
  SearchBar,
  Chip,
  StatCard,
} from '../components';
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';

const { width } = Dimensions.get('window');

// =========================================================
// CONSTANTES – TROIS NIVEAUX : 1, 2, 3
// =========================================================

const NIVEAUX = {
  1: { label: 'Débutant', color: Colors.textMuted },
  2: { label: 'Intermédiaire', color: Colors.primary },
  3: { label: 'Expert', color: Colors.danger },
};

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function SuperviseursScreen() {
  const navigation = useNavigation();
  const { isAdmin, isDJ } = useAuth();
  const canManage = isAdmin || isDJ;

  // États
  const [superviseurs, setSuperviseurs] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedNiveau, setSelectedNiveau] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // =========================================================
  // CHARGEMENT DES DONNÉES
  // =========================================================

  const loadData = useCallback(async () => {
    try {
      const [data, statsData] = await Promise.all([
        superviseursAPI.list(),
        superviseursAPI.statistiques().catch(() => ({})),
      ]);
      setSuperviseurs(data?.data || data || []);
      setFiltered(data?.data || data || []);
      setStats(statsData?.statistiques || null);
    } catch (error) {
      console.error('❌ Erreur chargement superviseurs:', error);
      Alert.alert('Erreur', 'Impossible de charger les superviseurs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
    let result = superviseurs;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(s =>
        `${s.nom} ${s.prenom} ${s.email} ${s.zone_responsable || ''}`
          .toLowerCase().includes(q)
      );
    }

    if (selectedNiveau) {
      result = result.filter(s => s.niveau_experience === selectedNiveau);
    }

    setFiltered(result);
  }, [search, selectedNiveau, superviseurs]);

  // =========================================================
  // HANDLERS
  // =========================================================

  const handleDelete = async (superviseur) => {
    Alert.alert(
      'Supprimer le superviseur',
      `Êtes-vous sûr de vouloir supprimer ${superviseur.prenom} ${superviseur.nom} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await superviseursAPI.delete(superviseur.id);
              loadData();
            } catch (error) {
              Alert.alert('Erreur', error.message);
            }
          },
        },
      ]
    );
  };

  const handleNiveauFilter = (niveau) => {
    setSelectedNiveau(selectedNiveau === niveau ? null : niveau);
  };

  const getNiveauInfo = (niveau) => {
    return NIVEAUX[niveau] || { label: 'N/A', color: Colors.textMuted };
  };

  // =========================================================
  // RENDU
  // =========================================================

  if (loading) {
    return <LoadingScreen message="Chargement des superviseurs..." />;
  }

  const niveauOptions = [
    { key: 1, label: 'Débutant', color: Colors.textMuted },
    { key: 2, label: 'Intermédiaire', color: Colors.primary },
    { key: 3, label: 'Expert', color: Colors.danger },
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
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Superviseurs</Text>
            <Text style={styles.headerSubtitle}>
              {filtered.length} superviseur{filtered.length > 1 ? 's' : ''}
            </Text>
          </View>

          {canManage ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('SuperviseurForm', {})}
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
            <Text style={[styles.statValue, { color: Colors.primary }]}>
              {stats.par_niveau_experience?.[2]?.count || 0}
            </Text>
            <Text style={styles.statLabel}>Niveau 2</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.warning }]}>
              {stats.par_zone?.length || 0}
            </Text>
            <Text style={styles.statLabel}>Zones</Text>
          </View>
        </Animated.View>
      )}

      {/* RECHERCHE ET FILTRES */}
      <Animated.View style={[styles.searchSection, { opacity: fadeAnim }]}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un superviseur..."
        />

        <View style={styles.filterContainer}>
          <Text style={styles.filterLabel}>Filtrer par niveau :</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {niveauOptions.map((niveau) => (
              <Chip
                key={niveau.key}
                label={niveau.label}
                selected={selectedNiveau === niveau.key}
                onPress={() => handleNiveauFilter(niveau.key)}
                color={niveau.color}
                style={styles.filterChip}
              />
            ))}
          </ScrollView>
        </View>
      </Animated.View>

      {/* LISTE DES SUPERVISEURS */}
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
            title="Aucun superviseur trouvé"
            subtitle={search ? 'Aucun résultat pour cette recherche' : 'Aucun superviseur enregistré'}
            icon="👔"
          />
        }
        renderItem={({ item, index }) => (
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            <SuperviseurCard
              superviseur={item}
              canManage={canManage}
              onDelete={handleDelete}
              onEdit={() => navigation.navigate('SuperviseurForm', { superviseur: item })}
              onPress={() => navigation.navigate('SuperviseurDetail', { id: item.id })}
            />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

// =========================================================
// COMPOSANT CARTE SUPERVISEUR
// =========================================================

function SuperviseurCard({ superviseur, canManage, onDelete, onEdit, onPress }) {
  const niveauInfo = NIVEAUX[superviseur.niveau_experience] || { label: 'N/A', color: Colors.textMuted };
  const color = niveauInfo.color;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.superviseurCard}>
        <View style={styles.cardHeader}>
          <View style={styles.userRow}>
            <View style={[styles.avatar, { backgroundColor: color + '20' }]}>
              <Text style={[styles.avatarText, { color }]}>
                {superviseur.prenom?.[0]}{superviseur.nom?.[0]}
              </Text>
            </View>

            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {superviseur.prenom} {superviseur.nom}
              </Text>
              <Text style={styles.userEmail}>{superviseur.email}</Text>
              <View style={styles.userMeta}>
                <Badge
                  label={niveauInfo.label === 'N/A' ? `Niveau ${superviseur.niveau_experience}` : niveauInfo.label}
                  color={color}
                  size="sm"
                />
                {superviseur.zone_responsable && (
                  <Badge
                    label={superviseur.zone_responsable}
                    color={Colors.primary}
                    size="sm"
                    icon="location-outline"
                    style={styles.zoneBadge}
                  />
                )}
              </View>
            </View>
          </View>

          <View style={styles.cardActions}>
            {canManage && (
              <>
                <TouchableOpacity
                  onPress={onEdit}
                  style={[styles.actionBtn, styles.editBtn]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={16} color={Colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => onDelete(superviseur)}
                  style={[styles.actionBtn, styles.deleteBtn]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* STATISTIQUES RAPIDES */}
        <View style={styles.statsRow}>
          <View style={styles.statMini}>
            <Ionicons name="briefcase-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.statMiniText}>
              {superviseur.statistiques?.missions_total || 0} missions
            </Text>
          </View>
          <View style={styles.statDividerMini} />
          <View style={styles.statMini}>
            <Ionicons name="alert-circle-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.statMiniText}>
              {superviseur.statistiques?.incidents_total || 0} incidents
            </Text>
          </View>
          <View style={styles.statDividerMini} />
          <View style={styles.statMini}>
            <Ionicons name="people-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.statMiniText}>
              {superviseur.statistiques?.techniciens_sous_responsabilite || 0} techniciens
            </Text>
          </View>
        </View>
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

  list: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  separator: {
    height: 8,
  },

  superviseurCard: {
    padding: Spacing.md,
    marginBottom: 0,
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
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
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
  zoneBadge: {
    marginLeft: 4,
  },

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
  deleteBtn: {
    backgroundColor: Colors.danger + '10',
    borderColor: Colors.danger + '30',
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  statMini: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statMiniText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  statDividerMini: {
    width: 1,
    height: 16,
    backgroundColor: Colors.border,
    marginHorizontal: 8,
  },
});