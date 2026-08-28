// mobile/src/screens/NotificationsScreen.js

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';

import { notificationsAPI } from '../services/notificationsAPI';
import { useAuth } from '../context/AuthContext';
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';

const { width } = Dimensions.get('window');

// =========================================================
// CONSTANTES
// =========================================================

const TYPE_ICONS = {
  rapport: 'document-text-outline',
  incident: 'alert-circle-outline',
  mission: 'briefcase-outline',
  permission: 'key-outline',
  message: 'chatbubbles-outline',
  systeme: 'settings-outline',
};

const TYPE_COLORS = {
  rapport: Colors.primary,
  incident: Colors.danger,
  mission: Colors.secondary,
  permission: Colors.warning,
  message: '#075E54',
  systeme: Colors.info,
};

const TYPE_LABELS = {
  rapport: 'Rapport',
  incident: 'Incident',
  mission: 'Mission',
  permission: 'Permission',
  message: 'Message',
  systeme: 'Système',
};

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const { user, isAdmin } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [stats, setStats] = useState(null);

  // Mode Sélection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Polling
  const pollingRef = useRef(null);

  // =========================================================
  // CHARGEMENT DES DONNÉES
  // =========================================================

  const loadData = useCallback(async (silent = false) => {
    try {
      let statsData = null;

      // Seul l'admin a accès aux statistiques
      if (isAdmin) {
        statsData = await notificationsAPI.statistiques().catch(() => null);
      }

      const [data, count] = await Promise.all([
        notificationsAPI.list({ limit: 100 }),
        notificationsAPI.getUnreadCount(),
      ]);

      setNotifications(data?.data || data || []);
      setUnreadCount(count || 0);
      setStats(statsData?.statistiques || null);
    } catch (error) {
      // Ignorer silencieusement les erreurs 403
      if (!error.message?.includes('administrateur')) {
        console.error('❌ Erreur chargement notifications:', error);
      }
    } finally {
      if (!silent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [isAdmin]);

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

  // 🔄 Mise à jour en temps réel (polling toutes les 15 secondes)
  useEffect(() => {

    pollingRef.current = setInterval(() => {
      // Appel silencieux pour ne pas afficher le loader
      loadData(true);
    }, 15000); // 15 secondes

    // Nettoyer l'intervalle lors du démontage
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [loadData]);

  // Rafraîchissement au focus
  useFocusEffect(
    useCallback(() => {
      loadData(true);
    }, [loadData])
  );

  // =========================================================
  // HANDLERS
  // =========================================================

  const handlePress = async (item) => {
    try {
      if (selectionMode) return;

      if (!item.est_lu) {
        setNotifications(prev =>
          prev.map(n => n.id === item.id ? { ...n, est_lu: 1 } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
        await notificationsAPI.markAsRead(item.id);
      }

      const text = `${item.titre} ${item.message}`.toLowerCase();
      const type = item.type;

      const navigationMap = {
        rapport: 'Rapports',
        incident: 'Incidents',
        mission: 'Missions',
        permission: 'Permissions',
        message: 'Messages',
      };

      if (navigationMap[type]) {
        navigation.navigate(navigationMap[type]);
        return;
      }

      if (text.includes('technicien')) {
        navigation.navigate('Techniciens');
        return;
      }
      if (text.includes('utilisateur') || text.includes('user')) {
        navigation.navigate('Users');
        return;
      }
      if (text.includes('réseau') || text.includes('network')) {
        navigation.navigate('Reseau');
        return;
      }
    } catch (error) {
      console.error('❌ Erreur navigation:', error);
    }
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedIds(new Set());
  };

  const toggleItemSelection = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleDelete = (id) => {
    if (selectionMode) {
      toggleItemSelection(id);
      return;
    }
    Alert.alert(
      'Supprimer la notification',
      'Voulez-vous vraiment supprimer cette notification ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setNotifications(prev => prev.filter(n => n.id !== id));
            if (notifications.find(n => n.id === id)?.est_lu === 0) {
              setUnreadCount(prev => Math.max(0, prev - 1));
            }
            await notificationsAPI.delete(id);
          },
        },
      ]
    );
  };

  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    Alert.alert(
      `Supprimer ${ids.length} notification(s)`,
      `Voulez-vous vraiment supprimer ces notifications ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await notificationsAPI.deleteBatch(ids);
              setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
              setSelectedIds(new Set());
              setSelectionMode(false);
              const count = await notificationsAPI.getUnreadCount();
              setUnreadCount(count || 0);
            } catch (error) {
              console.error('❌ Erreur suppression batch:', error);
              Alert.alert('Erreur', 'Impossible de supprimer les notifications sélectionnées.');
            }
          },
        },
      ]
    );
  };

  const handleMarkAll = async () => {
    Alert.alert(
      'Marquer toutes comme lues',
      'Voulez-vous marquer toutes les notifications comme lues ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setNotifications(prev => prev.map(n => ({ ...n, est_lu: 1 })));
            setUnreadCount(0);
            await notificationsAPI.markAllAsRead();
          },
        },
      ]
    );
  };

  const handleClearRead = async () => {
    Alert.alert(
      'Supprimer les notifications lues',
      'Voulez-vous supprimer toutes les notifications déjà lues ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setNotifications(prev => prev.filter(n => n.est_lu === 0));
            await notificationsAPI.clearRead();
          },
        },
      ]
    );
  };

  const getTypeIcon = (type) => TYPE_ICONS[type] || 'notifications-outline';
  const getTypeColor = (type) => TYPE_COLORS[type] || Colors.textMuted;
  const getTypeLabel = (type) => TYPE_LABELS[type] || type;

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);

    if (diff < 60) return "À l'instant";
    if (diff < 3600) return `${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} j`;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  // =========================================================
  // RENDU
  // =========================================================

  const renderItem = ({ item }) => {
    const icon = getTypeIcon(item.type);
    const color = getTypeColor(item.type);
    const isUnread = item.est_lu === 0;
    const isSelected = selectedIds.has(item.id);

    return (
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <TouchableOpacity
          style={[styles.card, isUnread && styles.unread, isSelected && styles.cardSelected]}
          onPress={() => selectionMode ? toggleItemSelection(item.id) : handlePress(item)}
          onLongPress={() => {
            if (!selectionMode) {
              setSelectionMode(true);
              toggleItemSelection(item.id);
            }
          }}
          activeOpacity={0.7}
        >
          {selectionMode && (
            <TouchableOpacity onPress={() => toggleItemSelection(item.id)} style={styles.checkboxContainer}>
              <Ionicons
                name={isSelected ? 'checkmark-circle' : 'checkmark-circle-outline'}
                size={24}
                color={isSelected ? Colors.primary : Colors.textMuted}
              />
            </TouchableOpacity>
          )}

          <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
            <Ionicons name={icon} size={22} color={color} />
          </View>

          <View style={styles.content}>
            <View style={styles.headerRow}>
              <Text style={styles.title} numberOfLines={1}>
                {item.titre}
              </Text>
              <Text style={styles.time}>{formatDate(item.created_at)}</Text>
            </View>
            <Text style={styles.message} numberOfLines={2}>
              {item.message}
            </Text>
            <View style={styles.footerRow}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{getTypeLabel(item.type)}</Text>
              </View>
              {isUnread && <View style={styles.unreadDot} />}
            </View>
          </View>

          <TouchableOpacity
            onPress={() => handleDelete(item.id)}
            style={styles.deleteBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Chargement des notifications...</Text>
      </View>
    );
  }

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
            <Text style={styles.headerTitle}>
              {selectionMode ? `${selectedIds.size} sélectionnée(s)` : 'Notifications'}
            </Text>
            {!selectionMode && unreadCount > 0 && (
              <Text style={styles.headerSubtitle}>
                {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
              </Text>
            )}
          </View>

          <View style={styles.headerActions}>
            {selectionMode ? (
              <TouchableOpacity onPress={toggleSelectionMode} style={styles.markAllBtn}>
                <Ionicons name="close" size={22} color={Colors.textWhite} />
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  onPress={handleMarkAll}
                  style={styles.markAllBtn}
                  activeOpacity={0.7}
                  disabled={unreadCount === 0}
                >
                  <Text style={[styles.markAllText, unreadCount === 0 && styles.markAllDisabled]}>
                    Tout lire
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={toggleSelectionMode}
                  style={[styles.markAllBtn, { marginLeft: 6 }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkbox-outline" size={22} color={Colors.textWhite} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </GradientHeader>

      {/* STATISTIQUES RAPIDES (Uniquement pour Admin) */}
      {stats && isAdmin && !selectionMode && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.global?.total || 0}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.danger }]}>
              {stats.global?.non_lues || 0}
            </Text>
            <Text style={styles.statLabel}>Non lues</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.success }]}>
              {stats.global?.lues || 0}
            </Text>
            <Text style={styles.statLabel}>Lues</Text>
          </View>
        </View>
      )}

      {/* LISTE DES NOTIFICATIONS */}
      {notifications.length > 0 ? (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
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
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Aucune notification</Text>
          <Text style={styles.emptySubtitle}>
            Vous n'avez pas encore de notifications
          </Text>
        </View>
      )}

      {/* BANDEAU D'ACTION */}
      {selectionMode ? (
        <View style={styles.selectionBar}>
          <TouchableOpacity onPress={toggleSelectionMode} style={styles.selectionCancel}>
            <Ionicons name="close" size={24} color={Colors.danger} />
            <Text style={styles.selectionCancelTxt}>Annuler</Text>
          </TouchableOpacity>
          <Text style={styles.selectionCount}>{selectedIds.size} sélectionnée(s)</Text>
          <TouchableOpacity
            onPress={handleBatchDelete}
            style={[styles.sendBtn, selectedIds.size === 0 && styles.sendBtnOff]}
            disabled={selectedIds.size === 0}
          >
            <Ionicons name="trash-outline" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      ) : (
        notifications.some(n => n.est_lu === 1) && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClearRead}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.danger} />
            <Text style={styles.clearBtnText}>Supprimer les lues</Text>
          </TouchableOpacity>
        )
      )}
    </View>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markAllText: {
    color: Colors.textWhite,
    fontSize: 13,
    fontWeight: '600',
  },
  markAllDisabled: {
    opacity: 0.5,
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
  list: {
    padding: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 80,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.light,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '08',
  },
  unread: {
    backgroundColor: Colors.primary + '08',
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  message: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  typeBadge: {
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  typeBadgeText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  deleteBtn: {
    padding: 4,
    marginLeft: 4,
  },
  checkboxContainer: {
    paddingRight: 10,
    justifyContent: 'center',
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
  },
  selectionCancel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectionCancelTxt: {
    fontSize: 14,
    color: Colors.danger,
    fontWeight: '600',
  },
  selectionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  sendBtnOff: {
    backgroundColor: Colors.textMuted,
    elevation: 0,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxxl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.textMuted,
    fontSize: 14,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.danger + '10',
    paddingVertical: 10,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.danger + '30',
    gap: 8,
  },
  clearBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.danger,
  },
});