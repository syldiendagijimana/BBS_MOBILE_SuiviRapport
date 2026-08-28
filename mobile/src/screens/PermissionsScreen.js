// mobile/src/screens/PermissionsScreen.js
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
  TextInput,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';

import { permissionsAPI } from '../services/api';
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
// LISTE EXHAUSTIVE DES TYPES DE PERMISSION
// =========================================================
//
// ⚠️ Ces valeurs (`value`) sont utilisées telles quelles par DashboardScreen.js
// pour décider quelles actions rapides afficher sur l'accueil de chaque
// technicien/superviseur (voir `requiredPermission` dans ACTIONS_BY_ROLE du
// Dashboard). Si tu renommes une valeur ici, pense à mettre à jour le mapping
// correspondant côté Dashboard, sinon l'action correspondante disparaîtra
// du menu de tout le monde.

const TYPES_PERMISSION = [
  { label: 'Créer un rapport', value: 'creer_rapport', icon: 'document-text-outline', color: Colors.primary },
  { label: 'Modifier un rapport', value: 'modifier_rapport', icon: 'create-outline', color: Colors.primary },
  { label: 'Valider un rapport', value: 'valider_rapport', icon: 'checkmark-circle-outline', color: Colors.success },
  { label: 'Supprimer un rapport', value: 'supprimer_rapport', icon: 'trash-outline', color: Colors.danger },
  { label: 'Voir tous les rapports', value: 'voir_rapports', icon: 'eye-outline', color: Colors.info },
  { label: 'Créer une mission', value: 'creer_mission', icon: 'briefcase-outline', color: Colors.secondary },
  { label: 'Modifier une mission', value: 'modifier_mission', icon: 'create-outline', color: Colors.secondary },
  { label: 'Affecter une mission', value: 'affecter_mission', icon: 'person-add-outline', color: Colors.secondary },
  { label: 'Changer le statut d\'une mission', value: 'changer_statut_mission', icon: 'swap-horizontal-outline', color: Colors.warning },
  { label: 'Supprimer une mission', value: 'supprimer_mission', icon: 'trash-outline', color: Colors.danger },
  { label: 'Voir toutes les missions', value: 'voir_missions', icon: 'eye-outline', color: Colors.info },
  { label: 'Créer un incident', value: 'creer_incident', icon: 'alert-circle-outline', color: Colors.danger },
  { label: 'Modifier un incident', value: 'modifier_incident', icon: 'create-outline', color: Colors.danger },
  { label: 'Résoudre un incident', value: 'resoudre_incident', icon: 'checkmark-done-circle-outline', color: Colors.success },
  { label: 'Supprimer un incident', value: 'supprimer_incident', icon: 'trash-outline', color: Colors.danger },
  { label: 'Voir tous les incidents', value: 'voir_incidents', icon: 'eye-outline', color: Colors.info },
  { label: 'Créer un utilisateur', value: 'creer_utilisateur', icon: 'person-add-outline', color: Colors.primary },
  { label: 'Modifier un utilisateur', value: 'modifier_utilisateur', icon: 'create-outline', color: Colors.primary },
  { label: 'Activer/Désactiver un utilisateur', value: 'activer_desactiver_utilisateur', icon: 'lock-open-outline', color: Colors.warning },
  { label: 'Supprimer un utilisateur', value: 'supprimer_utilisateur', icon: 'trash-outline', color: Colors.danger },
  { label: 'Voir tous les utilisateurs', value: 'voir_utilisateurs', icon: 'eye-outline', color: Colors.info },
  { label: 'Créer un technicien', value: 'creer_technicien', icon: 'construct-outline', color: Colors.warning },
  { label: 'Modifier un technicien', value: 'modifier_technicien', icon: 'create-outline', color: Colors.warning },
  { label: 'Supprimer un technicien', value: 'supprimer_technicien', icon: 'trash-outline', color: Colors.danger },
  { label: 'Voir tous les techniciens', value: 'voir_techniciens', icon: 'eye-outline', color: Colors.info },
  { label: 'Créer un superviseur', value: 'creer_superviseur', icon: 'briefcase-outline', color: Colors.primary },
  { label: 'Modifier un superviseur', value: 'modifier_superviseur', icon: 'create-outline', color: Colors.primary },
  { label: 'Supprimer un superviseur', value: 'supprimer_superviseur', icon: 'trash-outline', color: Colors.danger },
  { label: 'Voir tous les superviseurs', value: 'voir_superviseurs', icon: 'eye-outline', color: Colors.info },
  { label: 'Voir l\'état du réseau', value: 'voir_reseau', icon: 'wifi-outline', color: Colors.info },
  { label: 'Modifier l\'état du réseau', value: 'modifier_reseau', icon: 'create-outline', color: Colors.warning },
  { label: 'Voir les statistiques', value: 'voir_statistiques', icon: 'stats-chart-outline', color: Colors.accent },
  { label: 'Envoyer un message', value: 'envoyer_message', icon: 'chatbubbles-outline', color: '#075E54' },
  { label: 'Voir les messages', value: 'voir_messages', icon: 'eye-outline', color: Colors.info },
  { label: 'Voir l\'historique', value: 'voir_historique', icon: 'time-outline', color: Colors.accent },
  { label: 'Gérer les permissions', value: 'gerer_permissions', icon: 'key-outline', color: Colors.danger },
  { label: 'Voir les permissions', value: 'voir_permissions', icon: 'eye-outline', color: Colors.info },
];

// =========================================================
// COMPOSANT SÉLECTEUR RECHERCHABLE
// =========================================================

function SearchableSelector({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  touched,
  onBlur,
  icon,
  getOptionColor,
  disabled,
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState('');

  // Option "Tous" en tête de liste
  const optionsWithAll = [{ label: 'Tous les types', value: null, icon: 'apps-outline', color: Colors.textMuted }, ...options];

  const filteredOptions = optionsWithAll.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (selected) => {
    onChange(selected);
    setModalVisible(false);
    setSearch('');
    if (onBlur) onBlur();
  };

  const getIconName = () => {
    if (value === null) return 'apps-outline';
    const found = options.find(o => o.value === value);
    return found?.icon || icon || 'chevron-down';
  };

  const getColor = () => {
    if (value === null) return Colors.textMuted;
    if (getOptionColor) return getOptionColor(value);
    const found = options.find(o => o.value === value);
    return found?.color || Colors.textMuted;
  };

  const getLabel = () => {
    if (value === null) return 'Tous les types';
    const found = options.find(o => o.value === value);
    return found?.label || placeholder || 'Sélectionner...';
  };

  return (
    <View style={styles.selectorContainer}>
      <Text style={styles.selectorLabel}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.selectorInput,
          error && touched && styles.selectorInputError,
          disabled && styles.selectorDisabled,
        ]}
        onPress={() => !disabled && setModalVisible(true)}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <View style={styles.selectorInputContent}>
          <Ionicons name={getIconName()} size={20} color={value !== undefined && value !== null ? getColor() : Colors.textMuted} />
          <Text style={[
            styles.selectorInputText,
            value !== undefined && value !== null ? styles.selectorInputTextSelected : styles.selectorInputTextPlaceholder,
          ]}>
            {getLabel()}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={20} color={Colors.textMuted} />
      </TouchableOpacity>
      {error && touched && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionner {label.toLowerCase()}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchInputWrapper}>
              <Ionicons name="search-outline" size={20} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher..."
                value={search}
                onChangeText={setSearch}
                autoFocus
                placeholderTextColor={Colors.textMuted}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filteredOptions}
              keyExtractor={(item) => item.value?.toString() || 'all'}
              contentContainerStyle={styles.modalList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalListItem,
                    value === item.value && styles.modalListItemSelected,
                  ]}
                  onPress={() => handleSelect(item.value)}
                >
                  <View style={styles.modalListItemContent}>
                    {item.icon && (
                      <Ionicons
                        name={item.icon}
                        size={22}
                        color={item.color || Colors.textSecondary}
                      />
                    )}
                    <Text style={[
                      styles.modalListItemText,
                      value === item.value && { color: item.color || Colors.primary, fontWeight: '600' },
                    ]}>
                      {item.label}
                    </Text>
                  </View>
                  {value === item.value && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyText}>Aucun résultat</Text>
                </View>
              )}
            />
            <Button title="Annuler" variant="ghost" onPress={() => setModalVisible(false)} fullWidth />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function PermissionsScreen() {
  const navigation = useNavigation();
  const { user, isAdmin, isDJ } = useAuth();
  const canManage = isAdmin || isDJ;

  const [permissions, setPermissions] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // =========================================================
  // CHARGEMENT DES DONNÉES
  // =========================================================

  const loadData = useCallback(async () => {
    try {
      const [data, statsData] = await Promise.all([
        permissionsAPI.list(),
        permissionsAPI.statistiques().catch(() => ({})),
      ]);
      setPermissions(data?.data || data || []);
      setFiltered(data?.data || data || []);
      setStats(statsData?.statistiques || null);
    } catch (error) {
      console.error('❌ Erreur chargement permissions:', error);
      Alert.alert('Erreur', 'Impossible de charger les permissions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
    let result = permissions;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(p =>
        `${p.superviseur_nom || ''} ${p.superviseur_prenom || ''} ${p.technicien_nom || ''} ${p.type_permission || ''}`
          .toLowerCase().includes(q)
      );
    }

    if (selectedType !== null && selectedType !== undefined) {
      result = result.filter(p => p.type_permission === selectedType);
    }

    if (selectedStatus !== null) {
      result = result.filter(p => p.est_valide === selectedStatus);
    }

    setFiltered(result);
  }, [search, selectedType, selectedStatus, permissions]);

  // =========================================================
  // HANDLERS
  // =========================================================

  // ℹ️ Réaction système : valider/refuser/supprimer une permission ici met à
  // jour son statut côté serveur (`est_valide`). Le Dashboard de la personne
  // concernée (technicien ou superviseur) relit ses propres permissions à
  // chaque focus et toutes les 30s ; dès que ce statut change, l'action
  // rapide correspondante apparaît ou disparaît automatiquement de son
  // accueil — sans rien avoir à faire de plus ici.
  const handleValidate = async (permissionId, valide) => {
    Alert.alert(
      valide ? 'Valider la permission' : 'Refuser la permission',
      valide
        ? 'Êtes-vous sûr de vouloir valider cette permission ?'
        : 'Êtes-vous sûr de vouloir refuser cette permission ? L\'action correspondante disparaîtra de l\'accueil de la personne concernée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: valide ? 'Valider' : 'Refuser',
          onPress: async () => {
            try {
              await permissionsAPI.valider(permissionId, valide);
              loadData();
              Alert.alert('✅ Succès', `Permission ${valide ? 'validée' : 'refusée'} avec succès`);
            } catch (error) {
              Alert.alert('❌ Erreur', error.message);
            }
          },
        },
      ]
    );
  };

  const handleDelete = async (permission) => {
    Alert.alert(
      'Supprimer la permission',
      'Êtes-vous sûr de vouloir supprimer cette permission ? Cette action est irréversible et retirera l\'accès correspondant de l\'accueil de la personne concernée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await permissionsAPI.delete(permission.id);
              loadData();
            } catch (error) {
              Alert.alert('❌ Erreur', error.message);
            }
          },
        },
      ]
    );
  };

  const handleTypeChange = (typeValue) => {
    setSelectedType(typeValue);
  };

  const handleStatusFilter = (status) => {
    setSelectedStatus(selectedStatus === status ? null : status);
  };

  const getTypeInfo = (typeValue) => {
    if (typeValue === null) return { label: 'Tous les types', icon: 'apps-outline', color: Colors.textMuted };
    return TYPES_PERMISSION.find(t => t.value === typeValue) || {
      label: typeValue || 'Inconnu',
      icon: 'key-outline',
      color: Colors.textMuted,
    };
  };

  const getStatusLabel = (estValide) => {
    return estValide === 1 ? 'Validé' : estValide === 0 ? 'En attente' : 'Refusé';
  };

  const getStatusColor = (estValide) => {
    return estValide === 1 ? Colors.success : estValide === 0 ? Colors.warning : Colors.danger;
  };

  // =========================================================
  // RENDU
  // =========================================================

  if (loading) {
    return <LoadingScreen message="Chargement des permissions..." />;
  }

  const statusOptions = [
    { label: 'En attente', value: 0, color: Colors.warning },
    { label: 'Validé', value: 1, color: Colors.success },
  ];

  const statsGlobal = stats?.global || {};

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

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
            <Text style={styles.headerTitle}>Permissions</Text>
            <Text style={styles.headerSubtitle}>
              {filtered.length} permission{filtered.length > 1 ? 's' : ''}
            </Text>
          </View>

          {canManage && (
            <TouchableOpacity
              onPress={() => navigation.navigate('PermissionForm', {})}
              style={styles.addBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={24} color={Colors.textWhite} />
            </TouchableOpacity>
          )}
        </View>
      </GradientHeader>

      {stats && (
        <Animated.View style={[styles.statsBar, { opacity: fadeAnim }]}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{statsGlobal.total || 0}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.warning }]}>
              {statsGlobal.en_attente || 0}
            </Text>
            <Text style={styles.statLabel}>En attente</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.success }]}>
              {statsGlobal.validees || 0}
            </Text>
            <Text style={styles.statLabel}>Validées</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.danger }]}>
              {statsGlobal.refusees || 0}
            </Text>
            <Text style={styles.statLabel}>Refusées</Text>
          </View>
        </Animated.View>
      )}

      <Animated.View style={[styles.searchSection, { opacity: fadeAnim }]}>
        <View style={styles.searchRow}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher par nom, technicien, type..."
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

            <SearchableSelector
              label="Type de permission"
              value={selectedType}
              onChange={handleTypeChange}
              options={TYPES_PERMISSION}
              placeholder="Tous les types"
              icon="key-outline"
              getOptionColor={(value) => {
                const found = TYPES_PERMISSION.find(t => t.value === value);
                return found?.color || Colors.textMuted;
              }}
            />

            {/* Filtre par statut (chips) */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Statut :</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {statusOptions.map((status) => (
                  <Chip
                    key={status.value}
                    label={status.label}
                    selected={selectedStatus === status.value}
                    onPress={() => handleStatusFilter(status.value)}
                    color={status.color}
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
        ListEmptyComponent={
          <EmptyState
            title="Aucune permission trouvée"
            subtitle={search ? 'Aucun résultat pour cette recherche' : 'Aucune permission enregistrée'}
            icon="🔑"
          />
        }
        renderItem={({ item, index }) => (
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            <PermissionCard
              permission={item}
              canManage={canManage}
              onValidate={handleValidate}
              onDelete={handleDelete}
              getTypeInfo={getTypeInfo}
              getStatusLabel={getStatusLabel}
              getStatusColor={getStatusColor}
              onPress={() => navigation.navigate('PermissionDetail', { id: item.id })}
            />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

// =========================================================
// COMPOSANT CARTE PERMISSION
// =========================================================

function PermissionCard({
  permission,
  canManage,
  onValidate,
  onDelete,
  getTypeInfo,
  getStatusLabel,
  getStatusColor,
  onPress,
}) {
  const typeInfo = getTypeInfo(permission.type_permission);
  const typeColor = typeInfo.color;
  const typeIcon = typeInfo.icon;
  const statusColor = getStatusColor(permission.est_valide);
  const statusLabel = getStatusLabel(permission.est_valide);
  const isEnAttente = permission.est_valide === 0;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.permissionCard}>
        <View style={styles.cardHeader}>
          <View style={styles.titleSection}>
            <View style={[styles.typeIcon, { backgroundColor: typeColor + '15' }]}>
              <Ionicons name={typeIcon} size={20} color={typeColor} />
            </View>
            <View style={styles.typeInfo}>
              <Text style={styles.permissionType}>{typeInfo.label}</Text>
              <Text style={styles.permissionSubtype}>
                {permission.superviseur_nom && (
                  <Text>Superviseur: {permission.superviseur_prenom} {permission.superviseur_nom}</Text>
                )}
                {permission.technicien_nom && (
                  <Text> • Technicien: {permission.technicien_prenom} {permission.technicien_nom}</Text>
                )}
              </Text>
            </View>
          </View>

          <Badge
            label={statusLabel}
            color={statusColor}
            size="sm"
          />
        </View>

        {permission.valide_par_nom && (
          <View style={styles.validationInfo}>
            <Ionicons name="checkmark-circle-outline" size={14} color={Colors.success} />
            <Text style={styles.validationText}>
              Validé par {permission.valide_par_prenom} {permission.valide_par_nom}
              {permission.date_validation && ` le ${new Date(permission.date_validation).toLocaleDateString('fr-FR')}`}
            </Text>
          </View>
        )}

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.metaText}>
              {new Date(permission.created_at).toLocaleDateString('fr-FR')}
            </Text>
          </View>
          {permission.technicien_nom && (
            <View style={styles.metaItem}>
              <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.metaText}>Technicien concerné</Text>
            </View>
          )}
        </View>

        {isEnAttente && canManage && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.validateBtn]}
              onPress={() => onValidate(permission.id, true)}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-outline" size={16} color={Colors.textWhite} />
              <Text style={styles.actionBtnText}>Valider</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => onValidate(permission.id, false)}
              activeOpacity={0.7}
            >
              <Ionicons name="close-outline" size={16} color={Colors.textWhite} />
              <Text style={styles.actionBtnText}>Refuser</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.deleteBtn]}
              onPress={() => onDelete(permission)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color={Colors.danger} />
            </TouchableOpacity>
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

  // PERMISSION CARD
  permissionCard: {
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
    gap: 10,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeInfo: {
    flex: 1,
  },
  permissionType: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  permissionSubtype: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  validationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: Colors.success + '10',
    borderRadius: Radius.sm,
  },
  validationText: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '500',
  },

  metaRow: {
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
    color: Colors.textMuted,
  },

  // ACTIONS
  actionsRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textWhite,
  },
  validateBtn: {
    backgroundColor: Colors.success,
    flex: 1,
  },
  rejectBtn: {
    backgroundColor: Colors.danger,
    flex: 1,
  },
  deleteBtn: {
    backgroundColor: Colors.danger + '15',
    borderWidth: 1,
    borderColor: Colors.danger + '30',
    paddingHorizontal: 12,
  },

  // Styles pour SearchableSelector
  selectorContainer: {
    marginBottom: Spacing.md,
  },
  selectorLabel: {
    ...Typography.label,
    marginBottom: 6,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  selectorInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
  },
  selectorInputError: {
    borderColor: Colors.danger,
  },
  selectorDisabled: {
    opacity: 0.6,
  },
  selectorInputContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectorInputText: {
    fontSize: 14,
    marginLeft: 8,
  },
  selectorInputTextSelected: {
    color: Colors.textPrimary,
  },
  selectorInputTextPlaceholder: {
    color: Colors.textMuted,
  },
  errorText: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 4,
    marginLeft: 4,
  },

  // Styles pour la modale
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    width: '90%',
    maxHeight: '80%',
    padding: Spacing.md,
    ...Shadows.card,
    elevation: 8,
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
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    marginVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  modalList: {
    paddingBottom: 20,
  },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  modalListItemSelected: {
    backgroundColor: Colors.primary + '10',
    borderRadius: Radius.sm,
  },
  modalListItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalListItemText: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  modalEmpty: {
    padding: 20,
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
});