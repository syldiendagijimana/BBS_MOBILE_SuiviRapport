// mobile/src/screens/UsersScreen.js
// Version avec messages de activation/désactivation cohérents

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
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';

import { usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Card, Badge, EmptyState, LoadingScreen, SearchBar, Chip } from '../components';
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';

const { width } = Dimensions.get('window');

// =========================================================
// CONSTANTES
// =========================================================

const roleColors = {
  admin: Colors.danger,
  dj: Colors.secondary,
  superviseur: Colors.primary,
  technicien: Colors.warning,
};

const roleLabels = {
  admin: 'Admin',
  dj: 'DJ',
  superviseur: 'Superviseur',
  technicien: 'Technicien',
};

const roleIcons = {
  admin: 'shield-checkmark',
  dj: 'star',
  superviseur: 'briefcase',
  technicien: 'construct',
};

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function UsersScreen() {
  const navigation = useNavigation();
  const { isAdmin, user: currentUser } = useAuth();

  // États
  const [users, setUsers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [togglingId, setTogglingId] = useState(null); // ← spinner individuel

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // =========================================================
  // CHARGEMENT DES DONNÉES
  // =========================================================

  const loadData = useCallback(async () => {
    try {
      const [usersRes, statsRes] = await Promise.all([
        usersAPI.list(),
        usersAPI.statistiques().catch(() => null),
      ]);

      const usersArray = usersRes?.data || [];
      setUsers(usersArray);
      setFiltered(usersArray);

      setStats(statsRes?.statistiques || null);
    } catch (error) {
      console.error('❌ Erreur chargement utilisateurs:', error);
      Alert.alert('Erreur', 'Impossible de charger les utilisateurs');
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
    let result = [...users];

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(u =>
        `${u.nom} ${u.prenom} ${u.email}`.toLowerCase().includes(q)
      );
    }

    if (selectedRole) {
      result = result.filter(u => u.role === selectedRole);
    }

    setFiltered(result);
  }, [search, selectedRole, users]);

  // =========================================================
  // HANDLERS
  // =========================================================

  const handleToggle = async (user) => {
    if (togglingId) return; // déjà un toggle en cours

    const action = user.actif ? 'désactiver' : 'activer';
    const newStatus = !user.actif; // booléen
    const numericStatus = newStatus ? 1 : 0;

    Alert.alert(
      'Confirmation',
      `Voulez-vous ${action} le compte de ${user.prenom} ${user.nom} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          style: user.actif ? 'destructive' : 'default',
          onPress: async () => {
            setTogglingId(user.id);
            try {
              // Le service 'toggle' envoie un PATCH sur /utilisateurs/:id/activer avec { actif: numericStatus }
              await usersAPI.toggle(user.id, numericStatus);
              await loadData();
              Alert.alert('Succès', `Le compte a été ${action} avec succès.`);
            } catch (error) {
              console.error('❌ Erreur toggle utilisateur:', error);
              Alert.alert('Erreur', error.message || 'Impossible de modifier le statut.');
            } finally {
              setTogglingId(null);
            }
          },
        },
      ]
    );
  };

  const handleDelete = async (user) => {
    if (user.id === currentUser?.id) {
      Alert.alert('Action impossible', 'Vous ne pouvez pas supprimer votre propre compte');
      return;
    }

    Alert.alert(
      'Supprimer le compte',
      `Êtes-vous sûr de vouloir supprimer le compte de ${user.prenom} ${user.nom} ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await usersAPI.delete(user.id);
              await loadData();
            } catch (error) {
              Alert.alert('Erreur', error.message);
            }
          },
        },
      ]
    );
  };

  // =========================================================
  // RENDU
  // =========================================================

  if (loading) {
    return <LoadingScreen message="Chargement des utilisateurs..." />;
  }

  const roleFilterOptions = [
    { key: 'admin', label: 'Admin', color: Colors.danger },
    { key: 'dj', label: 'DJ', color: Colors.secondary },
    { key: 'superviseur', label: 'Superviseur', color: Colors.primary },
    { key: 'technicien', label: 'Technicien', color: Colors.warning },
  ];

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
            <Text style={styles.headerTitle}>Utilisateurs</Text>
            <Text style={styles.headerSubtitle}>
              {filtered.length} utilisateur{filtered.length > 1 ? 's' : ''}
            </Text>
          </View>

          {isAdmin ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('UserForm', {})}
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

      {stats && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total || 0}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.success }]}>
              {stats.actifs || 0}
            </Text>
            <Text style={styles.statLabel}>Actifs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.danger }]}>
              {stats.inactifs || 0}
            </Text>
            <Text style={styles.statLabel}>Inactifs</Text>
          </View>
        </View>
      )}

      <View style={styles.searchSection}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un utilisateur..."
        />

        <View style={styles.filterContainer}>
          <Text style={styles.filterLabel}>Filtrer par rôle :</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {roleFilterOptions.map((role) => (
              <Chip
                key={role.key}
                label={role.label}
                selected={selectedRole === role.key}
                onPress={() => setSelectedRole(selectedRole === role.key ? null : role.key)}
                color={role.color}
                style={styles.filterChip}
              />
            ))}
          </ScrollView>
        </View>
      </View>

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
            title="Aucun utilisateur trouvé"
            subtitle={search ? 'Aucun résultat pour cette recherche' : 'Aucun utilisateur enregistré'}
            icon="👤"
          />
        }
        renderItem={({ item, index }) => (
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            <UserCard
              user={item}
              isAdmin={isAdmin}
              currentUserId={currentUser?.id}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onEdit={() => navigation.navigate('UserForm', { user: item })}
              isToggling={togglingId === item.id}
            />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

// =========================================================
// COMPOSANT CARTE UTILISATEUR
// =========================================================

function UserCard({ user, isAdmin, currentUserId, onToggle, onDelete, onEdit, isToggling }) {
  const color = roleColors[user.role] || Colors.textMuted;
  const isCurrentUser = user.id === currentUserId;

  return (
    <Card style={[styles.userCard, !user.actif && styles.inactiveCard]}>
      <View style={styles.cardHeader}>
        <View style={styles.userRow}>
          <View style={[styles.avatar, { backgroundColor: color + '20' }]}>
            <Text style={[styles.avatarText, { color }]}>
              {user.prenom?.[0]}{user.nom?.[0]}
            </Text>
          </View>

          <View style={styles.userInfo}>
            <View style={styles.userNameRow}>
              <Text style={styles.userName}>
                {user.prenom} {user.nom}
              </Text>
              {isCurrentUser && (
                <Badge label="Vous" color={Colors.primary} size="sm" style={styles.youBadge} />
              )}
            </View>
            <Text style={styles.userEmail}>{user.email}</Text>
            <View style={styles.userMeta}>
              <Badge
                label={roleLabels[user.role] || user.role}
                color={color}
                size="sm"
                icon={roleIcons[user.role] || 'person'}
              />
              <Badge
                label={user.actif ? 'Actif' : 'Désactivé'}
                color={user.actif ? Colors.success : Colors.textMuted}
                size="sm"
                style={styles.statusBadge}
              />
              {user.telephone && (
                <Badge
                  label={user.telephone}
                  color={Colors.textMuted}
                  size="sm"
                  style={styles.phoneBadge}
                />
              )}
            </View>
          </View>
        </View>
      </View>

      {isAdmin && (
        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={onEdit}
            style={[styles.actionBtn, { backgroundColor: Colors.primary + '15' }]}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={16} color={Colors.primary} />
            <Text style={[styles.actionText, { color: Colors.primary }]}>Modifier</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onToggle(user)}
            style={[
              styles.actionBtn,
              {
                backgroundColor: user.actif ? Colors.warning + '15' : Colors.success + '15',
              },
            ]}
            activeOpacity={0.7}
            disabled={isToggling}
          >
            {isToggling ? (
              <ActivityIndicator size="small" color={user.actif ? Colors.warning : Colors.success} />
            ) : (
              <>
                <Ionicons
                  name={user.actif ? 'lock-closed-outline' : 'lock-open-outline'}
                  size={16}
                  color={user.actif ? Colors.warning : Colors.success}
                />
                <Text
                  style={[
                    styles.actionText,
                    { color: user.actif ? Colors.warning : Colors.success },
                  ]}
                >
                  {user.actif ? 'Désactiver' : 'Activer'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {!isCurrentUser && (
            <TouchableOpacity
              onPress={() => onDelete(user)}
              style={[styles.actionBtn, { backgroundColor: Colors.danger + '15' }]}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color={Colors.danger} />
            </TouchableOpacity>
          )}
        </View>
      )}
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
  userCard: {
    padding: Spacing.md,
    marginBottom: 0,
  },
  inactiveCard: {
    opacity: 0.6,
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
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  youBadge: {
    marginLeft: 4,
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
  statusBadge: {
    marginLeft: 4,
  },
  phoneBadge: {
    marginLeft: 4,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: Radius.md,
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
});