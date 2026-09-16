// mobile/src/screens/PermissionDetailScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';
import { permissionsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Colors, Spacing, Shadows } from '../theme';

// =========================================================
// LISTE EXHAUSTIVE DES TYPES DE PERMISSION
// =========================================================

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

const getTypeInfo = (value) =>
  TYPES_PERMISSION.find((t) => t.value === value) || {
    label: value || 'Inconnu',
    icon: 'key-outline',
    color: Colors.textMuted,
  };

// =========================================================
// CONFIGURATION DES RÔLES
// =========================================================

const ROLES_CONFIG = {
  admin: {
    label: 'Administrateur',
    icon: 'shield-checkmark-outline',
    color: Colors.danger,
  },
  dj: {
    label: 'DJ',
    icon: 'musical-notes-outline',
    color: Colors.accent,
  },
  superviseur: {
    label: 'Superviseur',
    icon: 'briefcase-outline',
    color: Colors.primary,
  },
  technicien: {
    label: 'Technicien',
    icon: 'construct-outline',
    color: Colors.secondary,
  },
};

const getRoleConfig = (role) => {
  if (!role) {
    return {
      label: 'Utilisateur',
      icon: 'person-outline',
      color: Colors.textMuted,
    };
  }
  const key = role.toLowerCase();
  return ROLES_CONFIG[key] || {
    label: role,
    icon: 'person-outline',
    color: Colors.textMuted,
  };
};

/**
 * Détecte le rôle d'une permission à partir des champs renvoyés par l'API
 */
const getPermissionRole = (permission) => {
  if (!permission) return null;
  if (permission.role) return permission.role.toLowerCase();
  if (permission.user_role) return permission.user_role.toLowerCase();
  if (permission.superviseur_id || permission.superviseur_nom) return 'superviseur';
  if (permission.technicien_id || permission.technicien_nom) return 'technicien';
  return null;
};

/**
 * Extrait le nom complet de la personne concernée, peu importe son rôle
 */
const getPermissionUser = (permission) => {
  if (!permission) return { prenom: '', nom: '', role: null };

  const role = getPermissionRole(permission);

  if (role === 'superviseur') {
    return {
      role: 'superviseur',
      prenom: permission.superviseur_prenom || '',
      nom: permission.superviseur_nom || '',
      email: permission.superviseur_email || null,
      zone: permission.superviseur_zone_responsable || null,
    };
  }
  if (role === 'technicien') {
    return {
      role: 'technicien',
      prenom: permission.technicien_prenom || '',
      nom: permission.technicien_nom || '',
      email: permission.technicien_email || null,
      matricule: permission.technicien_matricule || null,
      specialite: permission.technicien_specialite || null,
    };
  }

  // Admin / DJ ou générique
  return {
    role: role || 'utilisateur',
    prenom: permission.user_prenom || permission.prenom || '',
    nom: permission.user_nom || permission.nom || '',
    email: permission.user_email || permission.email || null,
  };
};

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function PermissionDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params;
  const { user, isAdmin, isDJ } = useAuth();
  const canManage = isAdmin || isDJ;

  const [permission, setPermission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadPermission();
  }, [id]);

  const loadPermission = async () => {
    try {
      const response = await permissionsAPI.get(id);
      setPermission(response?.data || response);
    } catch (error) {
      console.error('❌ Erreur chargement permission:', error);
      Alert.alert('Erreur', 'Impossible de charger la permission');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async (valide) => {
    Alert.alert(
      valide ? 'Valider la permission' : 'Refuser la permission',
      valide
        ? 'Êtes-vous sûr de vouloir valider cette permission ?'
        : 'Êtes-vous sûr de vouloir refuser cette permission ? L\'action correspondante disparaîtra de l\'accueil de la personne concernée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: valide ? 'Valider' : 'Refuser',
          style: valide ? 'default' : 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await permissionsAPI.valider(id, valide);
              Alert.alert('✅ Succès', `Permission ${valide ? 'validée' : 'refusée'} avec succès.`);
              loadPermission();
            } catch (error) {
              Alert.alert('❌ Erreur', error.message || 'Une erreur est survenue');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = async () => {
    Alert.alert(
      'Supprimer la permission',
      'Êtes-vous sûr de vouloir supprimer cette permission ? Cette action est irréversible et retirera l\'accès correspondant de l\'accueil de la personne concernée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await permissionsAPI.delete(id);
              Alert.alert('✅ Succès', 'Permission supprimée.');
              navigation.goBack();
            } catch (error) {
              Alert.alert('❌ Erreur', error.message || 'Une erreur est survenue');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // =========================================================
  // RENDU CONDITIONNEL
  // =========================================================

  if (loading) {
    return (
      <View style={styles.centered}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.centered}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.loadingText}>Permission introuvable</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backAction}>
          <Text style={styles.backActionText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // =========================================================
  // DONNÉES CALCULÉES
  // =========================================================

  const typeInfo = getTypeInfo(permission.type_permission);
  const estValide = permission.est_valide === 1;
  const estRefuse = permission.est_valide === -1 || permission.est_valide === 2;
  const estEnAttente = !estValide && !estRefuse;

  const statusColor = estValide
    ? Colors.success
    : estRefuse
    ? Colors.danger
    : Colors.warning;

  const statusLabel = estValide
    ? 'Validé'
    : estRefuse
    ? 'Refusé'
    : 'En attente';

  const statusIcon = estValide
    ? 'checkmark-circle'
    : estRefuse
    ? 'close-circle'
    : 'time-outline';

  // Rôle et utilisateur concerné
  const role = getPermissionRole(permission);
  const roleConfig = getRoleConfig(role);
  const userInfo = getPermissionUser(permission);
  const userFullName = `${userInfo.prenom} ${userInfo.nom}`.trim() || 'Non défini';

  const valideParNom = permission.valide_par_nom
    ? `${permission.valide_par_prenom || ''} ${permission.valide_par_nom || ''}`.trim() || 'Inconnu'
    : null;

  const dateCreation = permission.created_at
    ? new Date(permission.created_at).toLocaleString('fr-FR')
    : 'Inconnue';

  const dateValidation = permission.date_validation
    ? new Date(permission.date_validation).toLocaleString('fr-FR')
    : null;

  // Vérifier si l'utilisateur peut agir
  const canAct = canManage && estEnAttente;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      <GradientHeader style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Détail de la permission</Text>
          <View style={{ width: 40 }} />
        </View>
      </GradientHeader>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Indicateur de statut en haut */}
        <View style={[styles.statusBanner, { backgroundColor: statusColor + '15', borderColor: statusColor + '40' }]}>
          <Ionicons name={statusIcon} size={28} color={statusColor} />
          <View style={styles.statusBannerText}>
            <Text style={[styles.statusBannerLabel, { color: statusColor }]}>
              {statusLabel}
            </Text>
            <Text style={styles.statusBannerSubtitle}>
              {estValide
                ? 'Cette permission est active'
                : estRefuse
                ? 'Cette permission a été refusée'
                : 'En attente de validation'}
            </Text>
          </View>
        </View>

        {/* Carte principale */}
        <View style={styles.card}>
          {/* Type */}
          <View style={styles.typeRow}>
            <View style={[styles.iconContainer, { backgroundColor: typeInfo.color + '20' }]}>
              <Ionicons name={typeInfo.icon} size={32} color={typeInfo.color} />
            </View>
            <View style={styles.typeTextContainer}>
              <Text style={styles.typeLabel}>{typeInfo.label}</Text>
              <Text style={styles.typeValue}>{permission.type_permission || 'Non défini'}</Text>
            </View>
          </View>

          {/* Section : Utilisateur concerné */}
          <View style={styles.sectionHeader}>
            <Ionicons name="person-circle-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.sectionTitle}>Utilisateur concerné</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Nom complet</Text>
            <Text style={styles.value}>{userFullName}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Rôle</Text>
            <View style={styles.roleInfoValue}>
              <View style={[styles.roleTag, { backgroundColor: roleConfig.color + '20' }]}>
                <Ionicons name={roleConfig.icon} size={12} color={roleConfig.color} />
                <Text style={[styles.roleTagText, { color: roleConfig.color }]}>
                  {roleConfig.label}
                </Text>
              </View>
            </View>
          </View>

          {userInfo.email && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value} numberOfLines={1}>{userInfo.email}</Text>
            </View>
          )}

          {userInfo.zone && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Zone responsable</Text>
              <Text style={styles.value}>{userInfo.zone}</Text>
            </View>
          )}

          {userInfo.matricule && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Matricule</Text>
              <Text style={styles.value}>{userInfo.matricule}</Text>
            </View>
          )}

          {userInfo.specialite && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Spécialité</Text>
              <Text style={styles.value}>{userInfo.specialite}</Text>
            </View>
          )}

          {/* Section : Validation */}
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.sectionTitle}>Validation</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Statut</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>

          {valideParNom !== null && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Validé par</Text>
              <Text style={styles.value}>{valideParNom}</Text>
            </View>
          )}

          {dateValidation !== null && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Date de validation</Text>
              <Text style={styles.value}>{dateValidation}</Text>
            </View>
          )}

          {/* Section : Dates */}
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.sectionTitle}>Dates</Text>
          </View>

          <View style={[styles.infoRow, styles.infoRowLast]}>
            <Text style={styles.label}>Date de création</Text>
            <Text style={styles.value}>{dateCreation}</Text>
          </View>
        </View>

        {/* Actions (si en attente et admin/DJ) */}
        {canAct && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.validateBtn, actionLoading && styles.actionBtnDisabled]}
              onPress={() => handleValidate(true)}
              activeOpacity={0.7}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color={Colors.textWhite} />
              ) : (
                <>
                  <Ionicons name="checkmark-outline" size={20} color={Colors.textWhite} />
                  <Text style={styles.actionText}>Valider</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn, actionLoading && styles.actionBtnDisabled]}
              onPress={() => handleValidate(false)}
              activeOpacity={0.7}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color={Colors.textWhite} />
              ) : (
                <>
                  <Ionicons name="close-outline" size={20} color={Colors.textWhite} />
                  <Text style={styles.actionText}>Refuser</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.deleteBtn, actionLoading && styles.actionBtnDisabled]}
              onPress={handleDelete}
              activeOpacity={0.7}
              disabled={actionLoading}
            >
              <Ionicons name="trash-outline" size={20} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        )}

        {/* Message si déjà validée */}
        {estValide && (
          <View style={styles.infoMessage}>
            <Ionicons name="checkmark-circle-outline" size={24} color={Colors.success} />
            <Text style={styles.infoMessageText}>
              Cette permission a déjà été validée.
            </Text>
          </View>
        )}

        {/* Message si refusée */}
        {estRefuse && (
          <View style={[styles.infoMessage, { backgroundColor: Colors.danger + '10' }]}>
            <Ionicons name="close-circle-outline" size={24} color={Colors.danger} />
            <Text style={[styles.infoMessageText, { color: Colors.danger }]}>
              Cette permission a été refusée.
            </Text>
          </View>
        )}

        {/* Message si pas les droits */}
        {!canManage && estEnAttente && (
          <View style={styles.infoMessage}>
            <Ionicons name="lock-closed-outline" size={24} color={Colors.textMuted} />
            <Text style={styles.infoMessageText}>
              Seul un administrateur ou un DJ peut gérer cette permission.
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backAction}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back-outline" size={18} color={Colors.primary} />
          <Text style={styles.backActionText}>Retour à la liste</Text>
        </TouchableOpacity>
      </ScrollView>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 8,
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
  headerTitle: {
    color: Colors.textWhite,
    fontSize: 18,
    fontWeight: '700',
  },

  // CONTENT
  content: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },

  // STATUS BANNER
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  statusBannerText: {
    flex: 1,
  },
  statusBannerLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusBannerSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // CARD
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.card,
    elevation: 4,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  typeTextContainer: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  typeValue: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
    fontStyle: 'italic',
  },

  // SECTION HEADER
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.md,
    marginBottom: 4,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // INFO ROWS
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: 12,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  label: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
    flexShrink: 0,
  },
  value: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
  },

  // ROLE TAG
  roleInfoValue: {
    flex: 1,
    alignItems: 'flex-end',
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleTagText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // STATUS BADGE
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // ACTIONS
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 6,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionText: {
    color: Colors.textWhite,
    fontWeight: '600',
    fontSize: 14,
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
    paddingHorizontal: 16,
  },

  // INFO MESSAGE
  infoMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 14,
    borderRadius: 10,
    marginTop: Spacing.md,
    gap: 10,
  },
  infoMessageText: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },

  // BACK ACTION
  backAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginTop: 16,
  },
  backActionText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 15,
  },
});