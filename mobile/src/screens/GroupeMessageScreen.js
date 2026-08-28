/**
 * ========================================================
 * GROUPE MESSAGE SCREEN - BBS MOBILE
 * ========================================================
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Switch,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';

import { useAuth } from '../context/AuthContext';
import { messagesAPI } from '../services/messagesAPI';
import { usersAPI } from '../services/api';
import { Card, Avatar, Button, LoadingScreen } from '../components';
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function GroupeMessageScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, isAdmin, isSuperviseur } = useAuth();
  const groupeId = route.params?.groupeId || 1;

  const [groupe, setGroupe] = useState(null);
  const [membres, setMembres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [muteNotifications, setMuteNotifications] = useState(false);

  const isGroupeAdmin = isAdmin;

  // =========================================================
  // CHARGEMENT DES DONNÉES
  // =========================================================

  const loadData = useCallback(async () => {
    try {
      const groupeData = {
        id: 1,
        nom_groupe: '📢 Groupe Officiel BBS',
        description: 'Groupe de discussion officiel - Tous les acteurs peuvent échanger',
        icone: '💬',
        cree_par: 'Admin Système',
        date_creation: '2026-01-01',
        membres_count: 0,
      };

      const usersData = await usersAPI.list({ limit: 100 });
      const allUsers = usersData?.data || usersData || [];

      const membresData = allUsers.filter(u => u.actif === 1).map(u => ({
        id: u.id,
        nom: u.nom,
        prenom: u.prenom,
        email: u.email,
        role: u.role,
        avatar: u.avatar,
        actif: u.actif,
      }));

      groupeData.membres_count = membresData.length;

      setGroupe(groupeData);
      setMembres(membresData);
    } catch (error) {
      console.error('❌ Erreur chargement groupe:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // =========================================================
  // HANDLERS
  // =========================================================

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleGoToChat = () => {
    navigation.navigate('Messages');
  };

  const handleViewMember = (memberId) => {
    navigation.navigate('Profil', { userId: memberId });
  };

  const handleInviteMember = () => {
    Alert.alert(
      'Inviter un membre',
      "Cette fonctionnalité permet d'inviter de nouveaux membres à rejoindre le groupe officiel BBS.",
      [{ text: 'OK' }]
    );
  };

  const handleEditGroup = () => {
    Alert.alert(
      'Modifier le groupe',
      'Cette fonctionnalité permet de modifier les informations du groupe (nom, description, icône).',
      [{ text: 'OK' }]
    );
  };

  const handleToggleNotifications = () => {
    setNotificationsEnabled(!notificationsEnabled);
  };

  const handleToggleMute = () => {
    setMuteNotifications(!muteNotifications);
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Quitter le groupe',
      'Êtes-vous sûr de vouloir quitter le groupe officiel BBS ? Vous ne pourrez plus envoyer de messages.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Action indisponible', 'Cette fonctionnalité sera disponible prochainement.');
          },
        },
      ]
    );
  };

  const getRoleLabel = (role) => {
    const map = {
      admin: 'Administrateur',
      dj: 'Directeur Junior',
      superviseur: 'Superviseur',
      technicien: 'Technicien',
    };
    return map[role] || role;
  };

  const getRoleColor = (role) => {
    const map = {
      admin: Colors.danger,
      dj: Colors.secondary,
      superviseur: Colors.primary,
      technicien: Colors.warning,
    };
    return map[role] || Colors.textMuted;
  };

  // =========================================================
  // GROUPEMENT DES MEMBRES PAR RÔLE
  // =========================================================

  const membresParRole = useMemo(() => {
    const grouped = {
      admin: [],
      dj: [],
      superviseur: [],
      technicien: [],
    };

    membres.forEach((m) => {
      if (grouped[m.role]) {
        grouped[m.role].push(m);
      } else {
        grouped['technicien'].push(m);
      }
    });

    return grouped;
  }, [membres]);

  // =========================================================
  // RENDU
  // =========================================================

  if (loading) {
    return <LoadingScreen message="Chargement du groupe..." />;
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
            <Text style={styles.headerTitle}>Informations du groupe</Text>
          </View>

          <TouchableOpacity
            onPress={handleGoToChat}
            style={styles.chatBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubbles" size={22} color={Colors.textWhite} />
          </TouchableOpacity>
        </View>
      </GradientHeader>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* CARTE DU GROUPE */}
        <Card style={styles.groupeCard}>
          <View style={styles.groupeHeader}>
            <View style={styles.groupeIconContainer}>
              <Text style={styles.groupeIcon}>{groupe?.icone || '💬'}</Text>
            </View>
            <View style={styles.groupeInfo}>
              <Text style={styles.groupeNom}>{groupe?.nom_groupe}</Text>
              <Text style={styles.groupeDescription}>{groupe?.description}</Text>
              <View style={styles.groupeMeta}>
                <View style={styles.groupeMetaItem}>
                  <Ionicons name="people-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.groupeMetaText}>{groupe?.membres_count} membres</Text>
                </View>
                <View style={styles.groupeMetaItem}>
                  <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.groupeMetaText}>
                    Créé le{' '}
                    {groupe?.date_creation
                      ? new Date(groupe.date_creation).toLocaleDateString('fr-FR')
                      : '01/01/2026'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {isGroupeAdmin && (
            <TouchableOpacity
              style={styles.editGroupeBtn}
              onPress={handleEditGroup}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={16} color={Colors.primary} />
              <Text style={styles.editGroupeBtnText}>Modifier le groupe</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* LISTE DES MEMBRES PAR RÔLE */}
        <Text style={styles.sectionTitle}>Membres du groupe</Text>

        {Object.entries(membresParRole).map(([role, membresList]) => {
          if (membresList.length === 0) return null;
          const roleColor = getRoleColor(role);
          const roleLabel = getRoleLabel(role);

          return (
            <View key={role} style={styles.roleSection}>
              <View style={styles.roleHeader}>
                <View style={[styles.roleDot, { backgroundColor: roleColor }]} />
                <Text style={styles.roleTitle}>{roleLabel}</Text>
                <Text style={styles.roleCount}>{membresList.length}</Text>
              </View>

              {membresList.map((membre) => (
                <TouchableOpacity
                  key={membre.id}
                  style={styles.membreItem}
                  onPress={() => handleViewMember(membre.id)}
                  activeOpacity={0.7}
                >
                  <Avatar
                    nom={membre.nom}
                    prenom={membre.prenom}
                    role={membre.role}
                    size={40}
                  />
                  <View style={styles.membreInfo}>
                    <Text style={styles.membreNom}>
                      {membre.prenom} {membre.nom}
                    </Text>
                    <Text style={styles.membreEmail}>{membre.email}</Text>
                  </View>
                  {membre.id === user?.id && (
                    <View style={styles.membreBadge}>
                      <Text style={styles.membreBadgeText}>Vous</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          );
        })}

        <Button
          title="👥 Inviter des membres"
          variant="outline"
          size="md"
          onPress={handleInviteMember}
          style={styles.inviteBtn}
        />

        {/* PARAMÈTRES */}
        <Text style={styles.sectionTitle}>Paramètres</Text>

        <Card style={styles.paramCard}>
          <View style={styles.paramItem}>
            <View style={styles.paramLeft}>
              <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
              <Text style={styles.paramLabel}>Notifications</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.surface}
            />
          </View>

          <View style={styles.paramDivider} />

          <View style={styles.paramItem}>
            <View style={styles.paramLeft}>
              <Ionicons name="volume-mute-outline" size={20} color={Colors.warning} />
              <Text style={styles.paramLabel}>Ne pas déranger</Text>
            </View>
            <Switch
              value={muteNotifications}
              onValueChange={handleToggleMute}
              trackColor={{ false: Colors.border, true: Colors.warning }}
              thumbColor={Colors.surface}
            />
          </View>
        </Card>

        <TouchableOpacity
          style={styles.leaveBtn}
          onPress={handleLeaveGroup}
          activeOpacity={0.7}
        >
          <Ionicons name="exit-outline" size={20} color={Colors.danger} />
          <Text style={styles.leaveBtnText}>Quitter le groupe</Text>
        </TouchableOpacity>

        <View style={styles.footerSpace} />
      </ScrollView>
    </View>
  );
}

// =========================================================
// STYLES
// =========================================================

const styles = StyleSheet.create({
  // -------- CONTENEUR PRINCIPAL --------
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // -------- HEADER --------
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
    fontSize: 17,
    fontWeight: '700',
  },
  chatBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // -------- SCROLL --------
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 20,
  },

  // -------- CARTE DU GROUPE --------
  groupeCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  groupeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  groupeIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupeIcon: {
    fontSize: 32,
  },
  groupeInfo: {
    flex: 1,
  },
  groupeNom: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  groupeDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  groupeMeta: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 12,
  },
  groupeMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  groupeMetaText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  editGroupeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary + '10',
    gap: 6,
  },
  editGroupeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },

  // -------- SECTIONS ET MEMBRES --------
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  roleSection: {
    marginBottom: Spacing.md,
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  roleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  roleTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  roleCount: {
    fontSize: 12,
    color: Colors.textMuted,
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  membreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  membreInfo: {
    flex: 1,
    marginLeft: 10,
  },
  membreNom: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  membreEmail: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  membreBadge: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    marginRight: 8,
  },
  membreBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.primary,
  },

  // -------- BOUTON INVITATION --------
  inviteBtn: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },

  // -------- PARAMÈTRES --------
  paramCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  paramItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  paramLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  paramLabel: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  paramDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 6,
  },

  // -------- QUITTER LE GROUPE --------
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.danger + '30',
    gap: 8,
    marginTop: Spacing.sm,
  },
  leaveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.danger,
  },

  // -------- ESPACE BAS --------
  footerSpace: {
    height: 20,
  },
});