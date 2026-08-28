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

  useEffect(() => {
    loadPermission();
  }, [id]);

  const loadPermission = async () => {
    try {
      const response = await permissionsAPI.get(id);
      setPermission(response.data);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger la permission');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async (valide) => {
    try {
      await permissionsAPI.valider(id, valide);
      Alert.alert('✅ Succès', `Permission ${valide ? 'validée' : 'refusée'} avec succès.`);
      loadPermission();
    } catch (error) {
      Alert.alert('❌ Erreur', error.message);
    }
  };

  const handleDelete = async () => {
    Alert.alert('Supprimer la permission', 'Êtes-vous sûr de vouloir supprimer cette permission ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await permissionsAPI.delete(id);
            Alert.alert('✅ Succès', 'Permission supprimée.');
            navigation.goBack();
          } catch (error) {
            Alert.alert('❌ Erreur', error.message);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!permission) return null;

  const typeInfo = getTypeInfo(permission.type_permission);
  const estValide = permission.est_valide === 1;
  const statusColor = estValide ? Colors.success : Colors.warning;
  const statusLabel = estValide ? 'Validé' : 'En attente';

  const superviseurNom = `${permission.superviseur_prenom || ''} ${permission.superviseur_nom || ''}`.trim() || 'Non défini';
  const technicienNom = permission.technicien_id
    ? `${permission.technicien_prenom || ''} ${permission.technicien_nom || ''}`.trim() || 'Non défini'
    : null;
  const valideParNom = estValide && permission.valide_par_nom
    ? `${permission.valide_par_prenom || ''} ${permission.valide_par_nom || ''}`.trim() || 'Inconnu'
    : null;
  const dateCreation = permission.created_at
    ? new Date(permission.created_at).toLocaleString('fr-FR')
    : 'Inconnue';
  const dateValidation = permission.date_validation
    ? new Date(permission.date_validation).toLocaleString('fr-FR')
    : null;

  // Vérifier si l'utilisateur peut agir (admin ou DJ) et si la permission est en attente
  const canAct = canManage && !estValide;

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

      <ScrollView contentContainerStyle={styles.content}>
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

          {/* Superviseur */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Superviseur</Text>
            <Text style={styles.value}>{superviseurNom}</Text>
          </View>

          {/* Technicien (optionnel) */}
          {technicienNom !== null && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Technicien concerné</Text>
              <Text style={styles.value}>{technicienNom}</Text>
            </View>
          )}

          {/* Statut */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Statut</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>

          {/* Validateur */}
          {valideParNom !== null && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Validé par</Text>
              <Text style={styles.value}>{valideParNom}</Text>
            </View>
          )}

          {/* Date de création */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Date de création</Text>
            <Text style={styles.value}>{dateCreation}</Text>
          </View>

          {/* Date de validation */}
          {dateValidation !== null && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Date de validation</Text>
              <Text style={styles.value}>{dateValidation}</Text>
            </View>
          )}
        </View>

        {/* Actions (si en attente et admin/DJ) */}
        {canAct && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.validateBtn]}
              onPress={() => handleValidate(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-outline" size={20} color={Colors.textWhite} />
              <Text style={styles.actionText}>Valider</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => handleValidate(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="close-outline" size={20} color={Colors.textWhite} />
              <Text style={styles.actionText}>Refuser</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.deleteBtn]}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        )}

        {/* Si déjà validée ou refusée, afficher un message */}
        {estValide && (
          <View style={styles.infoMessage}>
            <Ionicons name="checkmark-circle-outline" size={24} color={Colors.success} />
            <Text style={styles.infoMessageText}>Cette permission a déjà été validée.</Text>
          </View>
        )}

        {!canManage && !estValide && (
          <View style={styles.infoMessage}>
            <Ionicons name="lock-closed-outline" size={24} color={Colors.textMuted} />
            <Text style={styles.infoMessageText}>Seul un administrateur ou un DJ peut gérer cette permission.</Text>
          </View>
        )}

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backAction}>
          <Text style={styles.backActionText}>Retour</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// =========================================================
// STYLES
// =========================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  content: { padding: Spacing.lg, paddingBottom: 40 },
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
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  typeTextContainer: { flex: 1 },
  typeLabel: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  typeValue: { fontSize: 14, color: Colors.textMuted, marginTop: 2 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  label: { fontSize: 14, color: Colors.textMuted, fontWeight: '500' },
  value: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'center',
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  actionText: { color: Colors.textWhite, fontWeight: '600', fontSize: 14 },
  validateBtn: { backgroundColor: Colors.success },
  rejectBtn: { backgroundColor: Colors.danger },
  deleteBtn: {
    backgroundColor: Colors.danger + '15',
    borderWidth: 1,
    borderColor: Colors.danger + '30',
  },
  infoMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 8,
    marginTop: Spacing.md,
    gap: 8,
  },
  infoMessageText: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  backAction: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  backActionText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 16,
  },
});