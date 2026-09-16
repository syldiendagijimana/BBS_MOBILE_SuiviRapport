// mobile/src/screens/MissionDetailScreen.js
// Version avec affichage du rôle de l'utilisateur concerné

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  Animated,
  RefreshControl,
  Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';

import { missionsAPI, rapportsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Card,
  Badge,
  Button,
  LoadingScreen,
  SectionHeader,
} from '../components';
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';

// =========================================================
// CONSTANTES
// =========================================================

const TYPES_MISSION = {
  installation: { label: 'Installation', icon: 'construct-outline', color: Colors.primary },
  maintenance: { label: 'Maintenance', icon: 'settings-outline', color: Colors.info },
  reparation: { label: 'Réparation', icon: 'hammer-outline', color: Colors.warning },
  inspection: { label: 'Inspection', icon: 'search-outline', color: Colors.secondary },
  urgence: { label: 'Urgence', icon: 'alert-circle-outline', color: Colors.danger },
};

const STATUTS = {
  planifiee: { label: 'Planifiée', color: Colors.info },
  en_cours: { label: 'En cours', color: Colors.warning },
  terminee: { label: 'Terminée', color: Colors.success },
  annulee: { label: 'Annulée', color: Colors.danger },
};

const PRIORITES = {
  basse: { label: 'Basse', color: Colors.success },
  moyenne: { label: 'Moyenne', color: Colors.info },
  haute: { label: 'Haute', color: Colors.warning },
  critique: { label: 'Critique', color: Colors.danger },
};

// =========================================================
// CONFIGURATION DES RÔLES
// =========================================================

const ROLES_CONFIG = {
  admin: {
    label: 'Administrateur',
    shortLabel: 'Admin',
    icon: 'shield-checkmark-outline',
    color: Colors.danger,
  },
  dj: {
    label: 'DJ',
    shortLabel: 'DJ',
    icon: 'musical-notes-outline',
    color: Colors.accent,
  },
  superviseur: {
    label: 'Superviseur',
    shortLabel: 'Superviseur',
    icon: 'briefcase-outline',
    color: Colors.primary,
  },
  technicien: {
    label: 'Technicien',
    shortLabel: 'Technicien',
    icon: 'construct-outline',
    color: Colors.secondary,
  },
};

const getRoleConfig = (role) => {
  if (!role) return {
    label: 'Utilisateur',
    shortLabel: 'Utilisateur',
    icon: 'person-outline',
    color: Colors.textMuted,
  };
  const key = role.toLowerCase();
  return ROLES_CONFIG[key] || {
    label: role,
    shortLabel: role,
    icon: 'person-outline',
    color: Colors.textMuted,
  };
};

/**
 * Extrait le nom + rôle + infos de l'utilisateur concerné
 */
const getMissionUser = (mission) => {
  if (!mission) return { fullName: '', role: null, email: null, extra: null, phone: null };

  // Priorité 1 : user_id (nouveau)
  if (mission.user_id && mission.user_nom) {
    return {
      fullName: `${mission.user_prenom || ''} ${mission.user_nom || ''}`.trim(),
      role: mission.user_role || 'utilisateur',
      email: mission.user_email || null,
      extra: null,
      phone: null,
    };
  }

  // Priorité 2 : technicien
  if (mission.technicien_nom) {
    return {
      fullName: `${mission.technicien_prenom || ''} ${mission.technicien_nom || ''}`.trim(),
      role: 'technicien',
      email: mission.technicien_email || null,
      extra: mission.technicien_matricule || null,
      phone: mission.technicien_telephone || null,
    };
  }

  // Priorité 3 : superviseur
  if (mission.superviseur_nom) {
    return {
      fullName: `${mission.superviseur_prenom || ''} ${mission.superviseur_nom || ''}`.trim(),
      role: 'superviseur',
      email: mission.superviseur_email || null,
      extra: null,
      phone: mission.superviseur_telephone || null,
    };
  }

  return { fullName: '', role: null, email: null, extra: null, phone: null };
};

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function MissionDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, isSuperviseur, isAdmin, isTechnicien } = useAuth();
  const missionId = route.params?.id;

  const [mission, setMission] = useState(null);
  const [rapports, setRapports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // =========================================================
  // CHARGEMENT
  // =========================================================

  const loadData = useCallback(async () => {
    try {
      const [missionRes, rapportsRes] = await Promise.all([
        missionsAPI.get(missionId),
        rapportsAPI.getByMission(missionId).catch(() => ({ data: [] })),
      ]);

      const missionData = missionRes?.data || missionRes;
      setMission(missionData);

      const rapportsList = rapportsRes?.data || [];
      setRapports(rapportsList);
    } catch (error) {
      console.error('❌ Erreur chargement mission:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails de la mission');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [missionId, navigation]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (missionId) loadData();
  }, [missionId, loadData]);

  // =========================================================
  // HANDLERS
  // =========================================================

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleStatusChange = async (nouveauStatut) => {
    Alert.alert(
      'Changer le statut',
      `Voulez-vous passer cette mission en "${STATUTS[nouveauStatut]?.label || nouveauStatut}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              await missionsAPI.setStatut(missionId, nouveauStatut);
              loadData();
            } catch (error) {
              Alert.alert('Erreur', error.message);
            }
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    navigation.navigate('MissionForm', { mission });
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer la mission',
      `Êtes-vous sûr de vouloir supprimer "${mission?.titre}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await missionsAPI.delete(missionId);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Erreur', error.message);
            }
          },
        },
      ]
    );
  };

  const handleOpenMap = () => {
    if (mission?.latitude && mission?.longitude) {
      const url = `https://www.google.com/maps/search/?api=1&query=${mission.latitude},${mission.longitude}`;
      Linking.openURL(url);
    }
  };

  const handleViewRapport = (rapportId) => {
    navigation.navigate('RapportDetail', { id: rapportId });
  };

  const handleCreateRapport = () => {
    navigation.navigate('RapportForm', { mission_id: missionId });
  };

  const canManage = isSuperviseur || isAdmin;
  const isTerminee = mission?.statut === 'terminee' || mission?.statut === 'annulee';

  // =========================================================
  // RENDU
  // =========================================================

  if (loading) {
    return <LoadingScreen message="Chargement de la mission..." />;
  }

  if (!mission) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />
        <GradientHeader style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mission introuvable</Text>
            <View style={{ width: 44 }} />
          </View>
        </GradientHeader>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.errorText}>Cette mission n'existe pas ou a été supprimée.</Text>
        </View>
      </View>
    );
  }

  const typeInfo = TYPES_MISSION[mission.type_mission] || { label: mission.type_mission, icon: 'construct-outline', color: Colors.textMuted };
  const statutInfo = STATUTS[mission.statut] || { label: mission.statut, color: Colors.textMuted };
  const prioriteInfo = PRIORITES[mission.priorite] || { label: mission.priorite, color: Colors.textMuted };

  const isRapportPossible = mission.statut === 'en_cours' || mission.statut === 'terminee';

  // 🎯 Utilisateur concerné
  const userInfo = getMissionUser(mission);
  const roleConfig = getRoleConfig(userInfo.role);
  const hasUser = !!userInfo.fullName;
  const initials = userInfo.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* HEADER */}
      <GradientHeader colors={[Colors.primary, Colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{mission.titre}</Text>
          </View>

          {canManage && !isTerminee && (
            <TouchableOpacity onPress={() => setShowActions(!showActions)} style={styles.moreBtn} activeOpacity={0.7}>
              <Ionicons name="ellipsis-vertical" size={24} color={Colors.textWhite} />
            </TouchableOpacity>
          )}
        </View>
      </GradientHeader>

      <Animated.ScrollView
        style={[styles.scroll, { opacity: fadeAnim }]}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* STATUT ET PRIORITÉ */}
        <View style={styles.statusRow}>
          <Badge label={statutInfo.label} color={statutInfo.color} size="lg" style={styles.statusBadge} />
          <Badge label={prioriteInfo.label} color={prioriteInfo.color} size="lg" style={styles.prioriteBadge} />
        </View>

        {/* 🎯 CARTE UTILISATEUR CONCERNÉ */}
        {hasUser && (
          <Card style={[styles.userCard, { borderLeftColor: roleConfig.color, borderLeftWidth: 5 }]}>
            <View style={styles.userCardContent}>
              <View style={[styles.userCardAvatar, { backgroundColor: roleConfig.color + '20' }]}>
                <Text style={[styles.userCardAvatarText, { color: roleConfig.color }]}>
                  {initials}
                </Text>
              </View>
              <View style={styles.userCardInfo}>
                <Text style={styles.userCardName}>{userInfo.fullName}</Text>
                <View style={[styles.userCardRoleBadge, { backgroundColor: roleConfig.color + '20' }]}>
                  <Ionicons name={roleConfig.icon} size={12} color={roleConfig.color} />
                  <Text style={[styles.userCardRoleText, { color: roleConfig.color }]}>
                    {roleConfig.label}
                  </Text>
                </View>
                {userInfo.email && (
                  <Text style={styles.userCardEmail} numberOfLines={1}>{userInfo.email}</Text>
                )}
                {userInfo.extra && (
                  <Text style={styles.userCardExtra}>Matricule: {userInfo.extra}</Text>
                )}
                {userInfo.phone && (
                  <Text style={styles.userCardExtra}>📞 {userInfo.phone}</Text>
                )}
              </View>
            </View>
          </Card>
        )}

        {/* CARTE PRINCIPALE */}
        <Card style={styles.mainCard}>
          <Text style={styles.missionTitle}>{mission.titre}</Text>
          {mission.description ? <Text style={styles.missionDescription}>{mission.description}</Text> : null}

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name={typeInfo.icon} size={20} color={typeInfo.color} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>{typeInfo.label}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="calendar-outline" size={20} color={Colors.textMuted} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Dates</Text>
              <Text style={styles.infoValue}>
                Début: {new Date(mission.date_debut).toLocaleDateString('fr-FR')}
                {mission.date_fin_prevue && ` • Fin prévue: ${new Date(mission.date_fin_prevue).toLocaleDateString('fr-FR')}`}
                {mission.date_fin_reelle && ` • Fin réelle: ${new Date(mission.date_fin_reelle).toLocaleDateString('fr-FR')}`}
              </Text>
            </View>
          </View>

          {mission.adresse ? (
            <TouchableOpacity style={styles.infoRow} onPress={handleOpenMap} activeOpacity={0.7}>
              <View style={styles.infoIcon}>
                <Ionicons name="location-outline" size={20} color={Colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Adresse</Text>
                <Text style={[styles.infoValue, styles.infoValueLink]}>{mission.adresse}</Text>
              </View>
              <Ionicons name="open-outline" size={18} color={Colors.primary} />
            </TouchableOpacity>
          ) : null}

          {mission.latitude && mission.longitude ? (
            <TouchableOpacity style={styles.infoRow} onPress={handleOpenMap} activeOpacity={0.7}>
              <View style={styles.infoIcon}>
                <Ionicons name="navigate-outline" size={20} color={Colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Coordonnées GPS</Text>
                <Text style={[styles.infoValue, styles.infoValueLink]}>{mission.latitude}, {mission.longitude}</Text>
              </View>
              <Ionicons name="open-outline" size={18} color={Colors.primary} />
            </TouchableOpacity>
          ) : null}
        </Card>

        {/* NOTES */}
        {mission.notes ? (
          <>
            <SectionHeader title="Notes" icon="clipboard-outline" />
            <Card style={styles.notesCard}>
              <Text style={styles.notesText}>{mission.notes}</Text>
            </Card>
          </>
        ) : null}

        {/* RAPPORTS ASSOCIÉS */}
        <SectionHeader
          title={`Rapports (${rapports.length})`}
          icon="document-text-outline"
          action={isRapportPossible ? 'Ajouter' : null}
          onAction={handleCreateRapport}
        />

        {rapports.length > 0 ? (
          rapports.map((rapport) => (
            <TouchableOpacity key={rapport.id} onPress={() => handleViewRapport(rapport.id)} activeOpacity={0.7}>
              <Card style={styles.rapportCard}>
                <View style={styles.rapportRow}>
                  <View style={styles.rapportIcon}>
                    <Ionicons name="document-text-outline" size={20} color={Colors.primary} />
                  </View>
                  <View style={styles.rapportInfo}>
                    <Text style={styles.rapportTitle}>{rapport.titre}</Text>
                    <View style={styles.rapportMeta}>
                      <Badge label={rapport.statut} color={getStatutColor(rapport.statut)} size="sm" />
                      <Text style={styles.rapportDate}>{new Date(rapport.created_at).toLocaleDateString('fr-FR')}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </View>
              </Card>
            </TouchableOpacity>
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>Aucun rapport associé à cette mission</Text>
            {isRapportPossible && (
              <Button title="Créer un rapport" variant="primary" size="sm" onPress={handleCreateRapport} style={{ marginTop: Spacing.md }} />
            )}
          </Card>
        )}

        <View style={styles.footerSpace} />
      </Animated.ScrollView>

      {/* MENU ACTIONS */}
      {showActions && canManage && !isTerminee && (
        <View style={styles.actionsMenu}>
          <TouchableOpacity style={styles.actionMenuItem} onPress={() => { setShowActions(false); handleEdit(); }}>
            <Ionicons name="create-outline" size={20} color={Colors.primary} />
            <Text style={styles.actionMenuText}>Modifier</Text>
          </TouchableOpacity>

          <View style={styles.actionMenuDivider} />

          {mission.statut !== 'planifiee' && (
            <TouchableOpacity style={styles.actionMenuItem} onPress={() => { setShowActions(false); handleStatusChange('planifiee'); }}>
              <Ionicons name="calendar-outline" size={20} color={Colors.info} />
              <Text style={[styles.actionMenuText, { color: Colors.info }]}>Planifier</Text>
            </TouchableOpacity>
          )}
          {mission.statut !== 'en_cours' && (
            <TouchableOpacity style={styles.actionMenuItem} onPress={() => { setShowActions(false); handleStatusChange('en_cours'); }}>
              <Ionicons name="play-outline" size={20} color={Colors.warning} />
              <Text style={[styles.actionMenuText, { color: Colors.warning }]}>Démarrer</Text>
            </TouchableOpacity>
          )}
          {mission.statut !== 'terminee' && (
            <TouchableOpacity style={styles.actionMenuItem} onPress={() => { setShowActions(false); handleStatusChange('terminee'); }}>
              <Ionicons name="checkmark-outline" size={20} color={Colors.success} />
              <Text style={[styles.actionMenuText, { color: Colors.success }]}>Terminer</Text>
            </TouchableOpacity>
          )}
          {mission.statut !== 'annulee' && (
            <TouchableOpacity style={styles.actionMenuItem} onPress={() => { setShowActions(false); handleStatusChange('annulee'); }}>
              <Ionicons name="close-outline" size={20} color={Colors.danger} />
              <Text style={[styles.actionMenuText, { color: Colors.danger }]}>Annuler</Text>
            </TouchableOpacity>
          )}

          <View style={styles.actionMenuDivider} />

          <TouchableOpacity style={[styles.actionMenuItem, styles.actionMenuDelete]} onPress={() => { setShowActions(false); handleDelete(); }}>
            <Ionicons name="trash-outline" size={20} color={Colors.danger} />
            <Text style={[styles.actionMenuText, { color: Colors.danger }]}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// =========================================================
// FONCTIONS UTILITAIRES
// =========================================================

const getStatutColor = (statut) => {
  const map = {
    brouillon: Colors.textMuted,
    soumis: Colors.warning,
    approuve: Colors.success,
    rejete: Colors.danger,
  };
  return map[statut] || Colors.textMuted;
};

// =========================================================
// STYLES
// =========================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: 50, paddingBottom: 16, paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    ...Shadows.card, elevation: 8,
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.sm },
  headerTitle: {
    color: Colors.textWhite, fontSize: 17, fontWeight: '700', maxWidth: '80%',
  },
  moreBtn: {
    padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 20 },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  statusBadge: { paddingVertical: 6, paddingHorizontal: 14 },
  prioriteBadge: { paddingVertical: 6, paddingHorizontal: 14 },

  // 🎯 CARTE UTILISATEUR
  userCard: {
    padding: Spacing.md, marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
  },
  userCardContent: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  userCardAvatar: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
  },
  userCardAvatarText: { fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  userCardInfo: { flex: 1 },
  userCardName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  userCardRoleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5,
  },
  userCardRoleText: {
    fontSize: 11, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  userCardEmail: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  userCardExtra: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  mainCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  missionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  missionDescription: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginBottom: 12 },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  infoIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.background,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  infoContent: { flex: 1 },
  infoLabel: {
    fontSize: 11, color: Colors.textMuted, fontWeight: '500',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  infoValue: { fontSize: 14, color: Colors.textPrimary, marginTop: 2 },
  infoValueLink: { color: Colors.primary },
  notesCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  notesText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  rapportCard: { padding: Spacing.md, marginBottom: 8 },
  rapportRow: { flexDirection: 'row', alignItems: 'center' },
  rapportIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  rapportInfo: { flex: 1 },
  rapportTitle: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  rapportMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  rapportDate: { fontSize: 11, color: Colors.textMuted },
  emptyCard: { padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.md },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  footerSpace: { height: 20 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorText: { fontSize: 16, color: Colors.textMuted, textAlign: 'center', marginTop: 16 },
  actionsMenu: {
    position: 'absolute', top: 90, right: 16,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg, padding: 8,
    ...Shadows.card, elevation: 8, zIndex: 999, minWidth: 180,
  },
  actionMenuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: Radius.sm, gap: 10,
  },
  actionMenuText: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  actionMenuDivider: { height: 1, backgroundColor: Colors.divider, marginVertical: 4 },
  actionMenuDelete: { backgroundColor: Colors.danger + '10' },
});