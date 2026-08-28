//mobile/src/screens/HistoriqueScreen.js
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
  ScrollView,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';
import { useNavigation } from '@react-navigation/native';

import { historiqueAPI } from '../services/api';
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

// =========================================================
// CONSTANTES
// =========================================================

const TABLE_LABELS = {
  utilisateurs: 'Utilisateurs',
  techniciens: 'Techniciens',
  superviseurs: 'Superviseurs',
  missions: 'Missions',
  rapports: 'Rapports',
  incidents: 'Incidents',
  messages: 'Messages',
  permissions: 'Permissions',
  notifications: 'Notifications',
  suivi_clients: 'Suivi clients',
  etat_reseau: 'Réseau',
};

const TABLE_COLORS = {
  utilisateurs: Colors.primary,
  techniciens: Colors.warning,
  superviseurs: Colors.secondary,
  missions: Colors.info,
  rapports: Colors.primary,
  incidents: Colors.danger,
  messages: '#075E54',
  permissions: Colors.accent,
  notifications: Colors.textMuted,
  suivi_clients: Colors.success,
  etat_reseau: Colors.primaryLight,
};

const ACTION_ICONS = {
  CREATION: 'add-circle-outline',
  CREATION_UTILISATEUR: 'person-add-outline',
  CREATION_TECHNICIEN: 'construct-outline',
  CREATION_SUPERVISEUR: 'briefcase-outline',
  CREATION_MISSION: 'calendar-outline',
  CREATION_RAPPORT: 'document-text-outline',
  CREATION_INCIDENT: 'alert-circle-outline',
  MODIFICATION: 'create-outline',
  MODIFICATION_UTILISATEUR: 'person-outline',
  MODIFICATION_TECHNICIEN: 'construct-outline',
  MODIFICATION_MISSION: 'calendar-outline',
  SUPPRESSION: 'trash-outline',
  SUPPRESSION_UTILISATEUR: 'person-remove-outline',
  ACTIVATION: 'checkmark-circle-outline',
  DESACTIVATION: 'close-circle-outline',
  VALIDATION: 'checkmark-done-outline',
  REJET: 'close-outline',
  LOGIN: 'log-in-outline',
  LOGOUT: 'log-out-outline',
};

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function HistoriqueScreen() {
  const navigation = useNavigation();
  const { user, isAdmin } = useAuth();

  // États
  const [actions, setActions] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedTable, setSelectedTable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // ✅ NOUVEAUX ÉTATS POUR LE MODE SÉLECTION
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // =========================================================
  // UTILITAIRES
  // =========================================================

  const parseActionDetails = (details) => {
    if (!details) return '';
    try {
      const parsed = JSON.parse(details);
      const table = parsed.table || 'élément';
      const id = parsed.recordId ? `#${parsed.recordId}` : '';
      if (parsed.actif === false || parsed.actif === null) {
        return `Désactivation du ${table} ${id}`;
      }
      if (parsed.actif === true) {
        return `Activation du ${table} ${id}`;
      }
      return `Action sur ${table} ${id}`;
    } catch (error) {
      return details;
    }
  };

  const formatIp = (ip) => {
    if (!ip) return '';
    if (ip.startsWith('::ffff:')) {
      return ip.substring(7);
    }
    return ip;
  };

  // =========================================================
  // CHARGEMENT DES DONNÉES
  // =========================================================

  const loadData = useCallback(async (reset = true) => {
    try {
      const params = { page: reset ? 1 : page, limit: 30 };
      if (selectedTable) params.table_concerned = selectedTable;
      if (search) params.action = search;

      const [data, statsData] = await Promise.all([
        historiqueAPI.actions(params),
        historiqueAPI.statistiques().catch(() => ({})),
      ]);

      const newActions = data?.data || data || [];

      const uniqueNewActions = newActions.filter((action, index, self) =>
        index === self.findIndex((t) => (
          t.action === action.action &&
          t.table_concerned === action.table_concerned &&
          t.adresse_ip === action.adresse_ip &&
          t.created_at === action.created_at
        ))
      );

      if (reset) {
        setActions(uniqueNewActions);
        setFiltered(uniqueNewActions);
        setPage(1);
      } else {
        const merged = [...actions, ...uniqueNewActions];
        const finalMerged = merged.filter((action, index, self) =>
          index === self.findIndex((t) => (
            t.action === action.action &&
            t.table_concerned === action.table_concerned &&
            t.adresse_ip === action.adresse_ip &&
            t.created_at === action.created_at
          ))
        );
        setActions(finalMerged);
        setFiltered(finalMerged);
      }
      setHasMore(newActions.length === 30);
      setStats(statsData?.statistiques || null);
    } catch (error) {
      console.error('❌ Erreur chargement historique:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, selectedTable, search, actions]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let result = actions;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(a =>
        `${a.action} ${a.nom} ${a.prenom} ${a.table_concerned || ''}`
          .toLowerCase().includes(q)
      );
    }
    if (selectedTable) {
      result = result.filter(a => a.table_concerned === selectedTable);
    }
    setFiltered(result);

    // Si on est en mode sélection, on vide la sélection lors du filtrage
    if (selectionMode) {
      setSelectedIds(new Set());
    }
  }, [search, selectedTable, actions, selectionMode]);

  // =========================================================
  // GESTIONNAIRES DE SÉLECTION (NOUVEAU)
  // =========================================================

  const handleToggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedIds(new Set()); // Vider la sélection en entrant/sortant du mode
  };

  const handleToggleItemSelection = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set()); // Tout décocher
    } else {
      setSelectedIds(new Set(filtered.map(item => item.id))); // Tout cocher
    }
  };

  // =========================================================
  // GESTIONNAIRES DE SUPPRESSION
  // =========================================================

  // Suppression groupée (Batch)
  const handleBatchDelete = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    Alert.alert(
      `Supprimer ${ids.length} élément(s)`,
      `Êtes-vous sûr de vouloir supprimer ${ids.length} action(s) de l'historique ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await historiqueAPI.deleteBatch(ids); // Appel à l'API batch

              // Mise à jour locale
              const newActions = actions.filter(a => !ids.includes(a.id));
              setActions(newActions);
              setFiltered(newActions);
              setSelectedIds(new Set());
              setSelectionMode(false);

              // Rafraîchir les stats
              const statsData = await historiqueAPI.statistiques().catch(() => ({}));
              setStats(statsData?.statistiques || null);

              Alert.alert('Succès', 'Action(s) supprimée(s) avec succès.');
            } catch (error) {
              console.error('Erreur suppression batch:', error);
              Alert.alert('Erreur', 'Impossible de supprimer les actions sélectionnées.');
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  // Suppression totale (Vider tout)
  const handleDeleteAll = () => {
    Alert.alert(
      'Vider l\'historique',
      'Êtes-vous sûr de vouloir supprimer TOUT l\'historique des actions ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await historiqueAPI.deleteAllHistory();
              setActions([]);
              setFiltered([]);
              setStats(null);
              Alert.alert('Succès', 'L\'historique a été complètement vidé.');
            } catch (error) {
              console.error('Erreur suppression historique:', error);
              Alert.alert('Erreur', 'Impossible de supprimer l\'historique.');
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  // =========================================================
  // HANDLERS
  // =========================================================

  const handleLoadMore = () => {
    if (!hasMore || loading) return;
    setPage(prev => prev + 1);
    loadData(false);
  };

  const handleTableFilter = (table) => {
    setSelectedTable(selectedTable === table ? null : table);
  };

  const getTableLabel = (table) => TABLE_LABELS[table] || table || 'Système';
  const getTableColor = (table) => TABLE_COLORS[table] || Colors.textMuted;
  const getActionIcon = (action) => {
    const found = Object.keys(ACTION_ICONS).find(key =>
      action?.toUpperCase().includes(key) || action?.includes(key)
    );
    return found ? ACTION_ICONS[found] : 'ellipse-outline';
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // =========================================================
  // RENDU
  // =========================================================

  if (loading) return <LoadingScreen message="Chargement de l'historique..." />;

  const tableOptions = Object.entries(TABLE_LABELS).map(([key, label]) => ({
    key, label, color: TABLE_COLORS[key] || Colors.textMuted,
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      <GradientHeader colors={[Colors.primary, Colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          {/* Bouton Retour */}
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
          </TouchableOpacity>

          {/* Titre */}
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {selectionMode ? 'Sélection' : 'Historique'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {selectionMode
                ? `${selectedIds.size} sélectionnée${selectedIds.size > 1 ? 's' : ''} sur ${filtered.length}`
                : `${filtered.length} action${filtered.length > 1 ? 's' : ''}`
              }
            </Text>
          </View>

          {/* Actions (Droite) */}
          <View style={styles.headerRightActions}>
            {isAdmin ? (
              selectionMode ? (
                // === MODE SÉLECTION ACTIF ===
                <>
                  <TouchableOpacity onPress={handleToggleSelectionMode} style={styles.headerBtn}>
                    <Ionicons name="close" size={22} color={Colors.textWhite} />
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleSelectAll} style={[styles.headerBtn, { width: 'auto', paddingHorizontal: 10 }]}>
                    <Text style={{ color: Colors.textWhite, fontSize: 11, fontWeight: '600' }}>
                      {selectedIds.size === filtered.length ? 'Tout décocher' : 'Tout cocher'}
                    </Text>
                  </TouchableOpacity>

                  {selectedIds.size > 0 && (
                    <TouchableOpacity
                      onPress={handleBatchDelete}
                      style={[styles.headerBtn, styles.deleteBtn]}
                      disabled={deleting}
                    >
                      <Ionicons name={deleting ? 'reload-outline' : 'trash-outline'} size={20} color={Colors.textWhite} />
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                // === MODE NORMAL ===
                <>
                  {/* Bouton Vider l'historique (Admin uniquement) */}
                  <TouchableOpacity
                    onPress={handleDeleteAll}
                    style={[styles.headerBtn, styles.deleteBtn]}
                    disabled={deleting}
                  >
                    <Ionicons name={deleting ? 'reload-outline' : 'trash-outline'} size={20} color={Colors.textWhite} />
                  </TouchableOpacity>

                  {/* Bouton Mode Sélection */}
                  <TouchableOpacity onPress={handleToggleSelectionMode} style={styles.headerBtn}>
                    <Ionicons name="checkmark-circle-outline" size={22} color={Colors.textWhite} />
                  </TouchableOpacity>

                  {/* Bouton Filtre */}
                  <TouchableOpacity
                    onPress={() => setShowFilters(!showFilters)}
                    style={[styles.headerBtn, showFilters && styles.filterBtnActive]}
                  >
                    <Ionicons name={showFilters ? 'close' : 'options-outline'} size={22} color={Colors.textWhite} />
                  </TouchableOpacity>
                </>
              )
            ) : (
              // === UTILISATEUR NON ADMIN ===
              <TouchableOpacity
                onPress={() => setShowFilters(!showFilters)}
                style={[styles.headerBtn, showFilters && styles.filterBtnActive]}
              >
                <Ionicons name={showFilters ? 'close' : 'options-outline'} size={22} color={Colors.textWhite} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </GradientHeader>

      {stats && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total || 0}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.primary }]}>
              {stats.par_table?.length || 0}
            </Text>
            <Text style={styles.statLabel}>Tables</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.warning }]}>
              {stats.top_actions?.[0]?.count || 0}
            </Text>
            <Text style={styles.statLabel}>Action top</Text>
          </View>
        </View>
      )}

      <View style={styles.searchSection}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Rechercher une action..." />
        {showFilters && (
          <View style={styles.filtersContainer}>
            <Text style={styles.filterLabel}>Filtrer par table :</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {tableOptions.map((table) => (
                <Chip
                  key={table.key} label={table.label}
                  selected={selectedTable === table.key}
                  onPress={() => handleTableFilter(table.key)}
                  color={table.color} style={styles.filterChip}
                />
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      <Animated.FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)} // Utilisation de l'ID pour une sélection fiable
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(true); }}
            colors={[Colors.primary]} tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Aucune action trouvée"
            subtitle={search ? 'Aucun résultat pour cette recherche' : 'Aucune action enregistrée'}
            icon="📜"
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        renderItem={({ item }) => (
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <ActionCard
              action={item}
              getTableLabel={getTableLabel}
              getTableColor={getTableColor}
              getActionIcon={getActionIcon}
              formatDate={formatDate}
              parseActionDetails={parseActionDetails}
              formatIp={formatIp}
              isSelectionMode={selectionMode}
              isSelected={selectedIds.has(item.id)}
              onToggleSelect={() => handleToggleItemSelection(item.id)}
            />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

// =========================================================
// COMPOSANT CARTE ACTION (MISE À JOUR SÉLECTION)
// =========================================================

function ActionCard({
  action,
  getTableLabel,
  getTableColor,
  getActionIcon,
  formatDate,
  parseActionDetails,
  formatIp,
  isSelectionMode,
  isSelected,
  onToggleSelect
}) {
  const tableColor = getTableColor(action.table_concerned);
  const tableLabel = getTableLabel(action.table_concerned);
  const icon = getActionIcon(action.action);
  const getActionColor = (actionName) => {
    const lower = actionName?.toLowerCase() || '';
    if (lower.includes('suppression') || lower.includes('delete')) return Colors.danger;
    if (lower.includes('creation') || lower.includes('create') || lower.includes('ajout')) return Colors.success;
    if (lower.includes('modification') || lower.includes('update') || lower.includes('edit')) return Colors.warning;
    if (lower.includes('activation')) return Colors.success;
    if (lower.includes('desactivation')) return Colors.danger;
    if (lower.includes('validation')) return Colors.success;
    if (lower.includes('login')) return Colors.primary;
    if (lower.includes('logout')) return Colors.textMuted;
    return Colors.info;
  };
  const actionColor = getActionColor(action.action);
  const formattedDetails = parseActionDetails(action.details);
  const cleanedIp = formatIp(action.adresse_ip);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={isSelectionMode ? onToggleSelect : undefined}
      disabled={!isSelectionMode}
    >
      <Card style={[styles.actionCard, isSelected && styles.actionCardSelected]}>
        <View style={styles.actionHeader}>
          {/* Case à cocher en mode sélection */}
          {isSelectionMode && (
            <TouchableOpacity onPress={onToggleSelect} style={styles.checkboxContainer}>
              <Ionicons
                name={isSelected ? 'checkmark-circle' : 'checkmark-circle-outline'}
                size={24}
                color={isSelected ? Colors.primary : Colors.textMuted}
              />
            </TouchableOpacity>
          )}

          <View style={[styles.actionIcon, { backgroundColor: actionColor + '15' }]}>
            <Ionicons name={icon} size={22} color={actionColor} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionName} numberOfLines={1}>{action.action}</Text>
            <Text style={styles.actionUser}>{action.prenom} {action.nom}</Text>
          </View>
          <Badge label={tableLabel} color={tableColor} size="sm" />
        </View>
        {formattedDetails && (
          <View style={styles.detailsContainer}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} style={styles.detailsIcon} />
            <Text style={styles.actionDetails} numberOfLines={2}>{formattedDetails}</Text>
          </View>
        )}
        <View style={styles.actionFooter}>
          <View style={styles.actionMeta}>
            <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.actionDate}>{formatDate(action.created_at)}</Text>
          </View>
          {cleanedIp && (
            <View style={styles.actionMeta}>
              <Ionicons name="globe-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.actionIp}>{cleanedIp}</Text>
            </View>
          )}
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

  headerRightActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },

  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  deleteBtn: {
    backgroundColor: 'rgba(255, 77, 79, 0.3)',
  },

  statsBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginTop: -10,
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
  filtersContainer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
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
    height: 10,
  },

  actionCard: {
    padding: Spacing.md,
    marginBottom: 0,
    borderRadius: Radius.md,
  },
  actionCardSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '08',
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  // NOUVEAU : Conteneur Checkbox
  checkboxContainer: {
    padding: 2,
    marginRight: -4,
  },

  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionInfo: {
    flex: 1,
  },
  actionName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  actionUser: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  detailsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    marginLeft: 54, // Ajusté car la checkbox ajoute de la largeur
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  detailsIcon: {
    marginRight: 6,
    marginTop: 2,
  },
  actionDetails: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  actionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginLeft: 54,
  },
  actionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  actionIp: {
    fontSize: 11,
    color: Colors.textMuted,
  },
});