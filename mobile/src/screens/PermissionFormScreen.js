// mobile/src/screens/PermissionFormScreen.js
// Version avec sélection d'un utilisateur unique (admin, DJ, superviseur ou technicien)
// Utilise la même liste exhaustive de types de permission que PermissionsScreen

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';

import { permissionsAPI, fetchAllUsers } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button, Card } from '../components';
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';

// =========================================================
// CONSTANTES - LISTE EXHAUSTIVE DES PERMISSIONS
// =========================================================

const TYPES_PERMISSION = [
  // --- Gestion des rapports ---
  { label: 'Créer un rapport', value: 'creer_rapport', icon: 'document-text-outline', color: Colors.primary, description: 'Permet de créer un nouveau rapport d\'intervention' },
  { label: 'Modifier un rapport', value: 'modifier_rapport', icon: 'create-outline', color: Colors.primary, description: 'Permet de modifier un rapport existant' },
  { label: 'Valider un rapport', value: 'valider_rapport', icon: 'checkmark-circle-outline', color: Colors.success, description: 'Permet de valider ou approuver un rapport soumis' },
  { label: 'Supprimer un rapport', value: 'supprimer_rapport', icon: 'trash-outline', color: Colors.danger, description: 'Permet de supprimer définitivement un rapport' },
  { label: 'Voir tous les rapports', value: 'voir_rapports', icon: 'eye-outline', color: Colors.info, description: 'Accès à la liste complète des rapports (tous les techniciens)' },

  // --- Gestion des missions ---
  { label: 'Créer une mission', value: 'creer_mission', icon: 'briefcase-outline', color: Colors.secondary, description: 'Permet de créer une nouvelle mission' },
  { label: 'Modifier une mission', value: 'modifier_mission', icon: 'create-outline', color: Colors.secondary, description: 'Permet de modifier une mission existante' },
  { label: 'Affecter une mission', value: 'affecter_mission', icon: 'person-add-outline', color: Colors.secondary, description: "Permet d'affecter un technicien à une mission" },
  { label: 'Changer le statut d\'une mission', value: 'changer_statut_mission', icon: 'swap-horizontal-outline', color: Colors.warning, description: 'Permet de changer le statut d\'une mission (planifiée, en cours, terminée, annulée)' },
  { label: 'Supprimer une mission', value: 'supprimer_mission', icon: 'trash-outline', color: Colors.danger, description: 'Permet de supprimer une mission' },
  { label: 'Voir toutes les missions', value: 'voir_missions', icon: 'eye-outline', color: Colors.info, description: 'Accès à la liste complète des missions' },

  // --- Gestion des incidents ---
  { label: 'Créer un incident', value: 'creer_incident', icon: 'alert-circle-outline', color: Colors.danger, description: 'Permet de signaler un nouvel incident' },
  { label: 'Modifier un incident', value: 'modifier_incident', icon: 'create-outline', color: Colors.danger, description: 'Permet de modifier un incident existant' },
  { label: 'Résoudre un incident', value: 'resoudre_incident', icon: 'checkmark-done-circle-outline', color: Colors.success, description: 'Permet de marquer un incident comme résolu' },
  { label: 'Supprimer un incident', value: 'supprimer_incident', icon: 'trash-outline', color: Colors.danger, description: 'Permet de supprimer un incident' },
  { label: 'Voir tous les incidents', value: 'voir_incidents', icon: 'eye-outline', color: Colors.info, description: 'Accès à la liste complète des incidents' },

  // --- Gestion des utilisateurs ---
  { label: 'Créer un utilisateur', value: 'creer_utilisateur', icon: 'person-add-outline', color: Colors.primary, description: 'Permet de créer un nouvel utilisateur' },
  { label: 'Modifier un utilisateur', value: 'modifier_utilisateur', icon: 'create-outline', color: Colors.primary, description: 'Permet de modifier un utilisateur existant' },
  { label: 'Activer/Désactiver un utilisateur', value: 'activer_desactiver_utilisateur', icon: 'lock-open-outline', color: Colors.warning, description: 'Permet d\'activer ou désactiver un compte utilisateur' },
  { label: 'Supprimer un utilisateur', value: 'supprimer_utilisateur', icon: 'trash-outline', color: Colors.danger, description: 'Permet de supprimer un utilisateur' },
  { label: 'Voir tous les utilisateurs', value: 'voir_utilisateurs', icon: 'eye-outline', color: Colors.info, description: 'Accès à la liste complète des utilisateurs' },

  // --- Gestion des techniciens ---
  { label: 'Créer un technicien', value: 'creer_technicien', icon: 'construct-outline', color: Colors.warning, description: 'Permet de créer un nouveau technicien' },
  { label: 'Modifier un technicien', value: 'modifier_technicien', icon: 'create-outline', color: Colors.warning, description: 'Permet de modifier un technicien existant' },
  { label: 'Supprimer un technicien', value: 'supprimer_technicien', icon: 'trash-outline', color: Colors.danger, description: 'Permet de supprimer un technicien' },
  { label: 'Voir tous les techniciens', value: 'voir_techniciens', icon: 'eye-outline', color: Colors.info, description: 'Accès à la liste complète des techniciens' },

  // --- Gestion des superviseurs ---
  { label: 'Créer un superviseur', value: 'creer_superviseur', icon: 'briefcase-outline', color: Colors.primary, description: 'Permet de créer un nouveau superviseur' },
  { label: 'Modifier un superviseur', value: 'modifier_superviseur', icon: 'create-outline', color: Colors.primary, description: 'Permet de modifier un superviseur existant' },
  { label: 'Supprimer un superviseur', value: 'supprimer_superviseur', icon: 'trash-outline', color: Colors.danger, description: 'Permet de supprimer un superviseur' },
  { label: 'Voir tous les superviseurs', value: 'voir_superviseurs', icon: 'eye-outline', color: Colors.info, description: 'Accès à la liste complète des superviseurs' },

  // --- Gestion du réseau ---
  { label: 'Voir l\'état du réseau', value: 'voir_reseau', icon: 'wifi-outline', color: Colors.info, description: 'Accès aux informations de l\'état du réseau' },
  { label: 'Modifier l\'état du réseau', value: 'modifier_reseau', icon: 'create-outline', color: Colors.warning, description: 'Permet de modifier les informations réseau (zones, statut)' },

  // --- Statistiques ---
  { label: 'Voir les statistiques', value: 'voir_statistiques', icon: 'stats-chart-outline', color: Colors.accent, description: 'Accès aux statistiques globales de l\'application' },

  // --- Messages ---
  { label: 'Envoyer un message', value: 'envoyer_message', icon: 'chatbubbles-outline', color: '#075E54', description: 'Permet d\'envoyer des messages dans le groupe officiel' },
  { label: 'Voir les messages', value: 'voir_messages', icon: 'eye-outline', color: Colors.info, description: 'Accès à l\'historique des messages' },

  // --- Historique ---
  { label: 'Voir l\'historique', value: 'voir_historique', icon: 'time-outline', color: Colors.accent, description: 'Accès à l\'historique des actions utilisateurs' },

  // --- Permissions ---
  { label: 'Gérer les permissions', value: 'gerer_permissions', icon: 'key-outline', color: Colors.danger, description: 'Permet de créer, modifier ou supprimer des permissions' },
  { label: 'Voir les permissions', value: 'voir_permissions', icon: 'eye-outline', color: Colors.info, description: 'Accès à la liste des permissions' },
];

// =========================================================
// CONFIGURATION DES RÔLES
// =========================================================

const ROLES_CONFIG = {
  admin: {
    label: 'Administrateur',
    icon: 'shield-checkmark-outline',
    color: Colors.danger,
    bgColor: Colors.danger + '15',
    textColor: Colors.danger,
  },
  dj: {
    label: 'DJ',
    icon: 'musical-notes-outline',
    color: Colors.accent,
    bgColor: Colors.accent + '15',
    textColor: Colors.accent,
  },
  superviseur: {
    label: 'Superviseur',
    icon: 'briefcase-outline',
    color: Colors.primary,
    bgColor: Colors.primary + '15',
    textColor: Colors.primary,
  },
  technicien: {
    label: 'Technicien',
    icon: 'construct-outline',
    color: Colors.secondary,
    bgColor: Colors.secondary + '15',
    textColor: Colors.secondary,
  },
};

const getRoleConfig = (role) => {
  if (!role) {
    return {
      label: 'Utilisateur',
      icon: 'person-outline',
      color: Colors.textMuted,
      bgColor: Colors.textMuted + '15',
      textColor: Colors.textMuted,
    };
  }
  const key = role.toLowerCase();
  return ROLES_CONFIG[key] || {
    label: role,
    icon: 'person-outline',
    color: Colors.textMuted,
    bgColor: Colors.textMuted + '15',
    textColor: Colors.textMuted,
  };
};

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function PermissionFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, isAdmin, isDJ } = useAuth();

  const editPermission = route.params?.permission;
  const isEdit = !!editPermission;

  // =========================================================
  // ÉTATS DU FORMULAIRE
  // =========================================================

  const [selectedUserId, setSelectedUserId] = useState(
    editPermission?.user_id ||
    editPermission?.superviseur_id ||
    editPermission?.technicien_id ||
    null
  );
  const [selectedUserName, setSelectedUserName] = useState('');
  const [selectedUserRole, setSelectedUserRole] = useState('');

  const [typePermission, setTypePermission] = useState(editPermission?.type_permission || '');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [formValid, setFormValid] = useState(false);

  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [showUserModal, setShowUserModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);

  const [searchType, setSearchType] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // =========================================================
  // CHARGEMENT DES DONNÉES
  // =========================================================

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoadingUsers(true);
      try {
        console.log('🔄 [PermissionForm] Chargement des utilisateurs...');

        const users = await fetchAllUsers();

        if (!isMounted) return;

        setAllUsers(users);
        console.log('✅ [PermissionForm] Utilisateurs chargés:', users.length);

        // Si en mode édition, trouver l'utilisateur sélectionné
        if (selectedUserId) {
          const selectedUser = users.find(u => u.id === selectedUserId);
          if (selectedUser) {
            setSelectedUserName(`${selectedUser.prenom} ${selectedUser.nom}`);
            setSelectedUserRole(selectedUser.role || '');
          }
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('❌ [PermissionForm] Erreur chargement:', error);
        setAllUsers([]);
      } finally {
        if (isMounted) setLoadingUsers(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // =========================================================
  // ANIMATIONS
  // =========================================================

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  // =========================================================
  // VALIDATION
  // =========================================================

  useEffect(() => {
    const newErrors = {};
    if (!selectedUserId) newErrors.selectedUserId = 'L\'utilisateur est requis';
    if (!typePermission) newErrors.typePermission = 'Le type de permission est requis';
    setErrors(newErrors);
    setFormValid(Object.keys(newErrors).length === 0);
  }, [selectedUserId, typePermission]);

  const handleFieldBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // =========================================================
  // HANDLERS
  // =========================================================

  const handleSave = async () => {
    if (!formValid) {
      setTouched({ selectedUserId: true, typePermission: true });
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }

    setLoading(true);
    try {
      const data = {
        type_permission: typePermission,
      };

      const roleLower = (selectedUserRole || '').toLowerCase();

      if (roleLower === 'superviseur') {
        data.superviseur_id = selectedUserId;
      } else if (roleLower === 'technicien') {
        data.technicien_id = selectedUserId;
      } else {
        data.user_id = selectedUserId;
      }

      if (isEdit) {
        await permissionsAPI.update(editPermission.id, data);
        Alert.alert('✅ Succès', 'La permission a été modifiée avec succès', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await permissionsAPI.create(data);
        Alert.alert('✅ Succès', 'La permission a été créée avec succès', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      console.error('❌ Erreur sauvegarde:', error);
      Alert.alert('❌ Erreur', error.message || 'Une erreur est survenue lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (isFormDirty()) {
      Alert.alert('Annuler', 'Voulez-vous vraiment quitter sans sauvegarder ?', [
        { text: 'Rester', style: 'cancel' },
        { text: 'Quitter', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  };

  const isFormDirty = () => {
    if (isEdit) {
      const originalUserId =
        editPermission.user_id ||
        editPermission.superviseur_id ||
        editPermission.technicien_id;
      return (
        selectedUserId !== originalUserId ||
        typePermission !== editPermission.type_permission
      );
    }
    return selectedUserId !== null || typePermission !== '';
  };

  const handleSelectUser = (userItem) => {
    setSelectedUserId(userItem.id);
    setSelectedUserName(`${userItem.prenom} ${userItem.nom}`);
    setSelectedUserRole(userItem.role || '');
    setShowUserModal(false);
    setSearchUser('');
    handleFieldBlur('selectedUserId');
  };

  const handleSelectType = (type) => {
    setTypePermission(type.value);
    setShowTypeModal(false);
    setSearchType('');
    handleFieldBlur('typePermission');
  };

  const handleRetryLoadUsers = async () => {
    setLoadingUsers(true);
    try {
      const users = await fetchAllUsers();
      setAllUsers(users);
      console.log('✅ [PermissionForm] Rechargement réussi:', users.length);
    } catch (e) {
      console.error('❌ Erreur rechargement:', e);
      Alert.alert('Erreur', 'Impossible de charger les utilisateurs');
    } finally {
      setLoadingUsers(false);
    }
  };

  const getTypeInfo = (typeValue) => TYPES_PERMISSION.find(t => t.value === typeValue);
  const selectedTypeInfo = getTypeInfo(typePermission);
  const selectedRoleConfig = getRoleConfig(selectedUserRole);

  // Filtres pour les listes
  const filteredTypes = TYPES_PERMISSION.filter(type =>
    type.label.toLowerCase().includes(searchType.toLowerCase()) ||
    type.description.toLowerCase().includes(searchType.toLowerCase())
  );

  const filteredUsers = allUsers.filter(u => {
    const fullName = `${u.prenom || ''} ${u.nom || ''}`.toLowerCase();
    const search = searchUser.toLowerCase();
    const role = (u.role || '').toLowerCase();

    const matchesSearch =
      fullName.includes(search) ||
      role.includes(search) ||
      (u.matricule && u.matricule.toLowerCase().includes(search)) ||
      (u.zone_responsable && u.zone_responsable.toLowerCase().includes(search)) ||
      (u.specialite && u.specialite.toLowerCase().includes(search)) ||
      (u.email && u.email.toLowerCase().includes(search));

    const matchesRole =
      roleFilter === 'all' || role === roleFilter.toLowerCase();

    return matchesSearch && matchesRole;
  });

  const usersByRole = {
    admin: filteredUsers.filter(u => (u.role || '').toLowerCase() === 'admin'),
    dj: filteredUsers.filter(u => (u.role || '').toLowerCase() === 'dj'),
    superviseur: filteredUsers.filter(u => (u.role || '').toLowerCase() === 'superviseur'),
    technicien: filteredUsers.filter(u => (u.role || '').toLowerCase() === 'technicien'),
    autre: filteredUsers.filter(u => {
      const r = (u.role || '').toLowerCase();
      return !['admin', 'dj', 'superviseur', 'technicien'].includes(r);
    }),
  };

  const roleFilters = [
    { key: 'all', label: 'Tous', icon: 'people-outline', count: filteredUsers.length },
    { key: 'admin', label: 'Admins', icon: 'shield-checkmark-outline', count: usersByRole.admin.length },
    { key: 'dj', label: 'DJ', icon: 'musical-notes-outline', count: usersByRole.dj.length },
    { key: 'superviseur', label: 'Superviseurs', icon: 'briefcase-outline', count: usersByRole.superviseur.length },
    { key: 'technicien', label: 'Techniciens', icon: 'construct-outline', count: usersByRole.technicien.length },
  ];

  // =========================================================
  // RENDU SECTION UTILISATEURS
  // =========================================================

  const renderUserSection = (title, icon, color, users) => {
    if (users.length === 0) return null;
    return (
      <View key={title}>
        <View style={styles.sectionHeader}>
          <Ionicons name={icon} size={16} color={color} />
          <Text style={styles.sectionHeaderText}>{title}</Text>
          <View style={[styles.sectionCount, { backgroundColor: color + '20' }]}>
            <Text style={[styles.sectionCountText, { color }]}>{users.length}</Text>
          </View>
        </View>
        {users.map(u => {
          const roleConf = getRoleConfig(u.role);
          return (
            <TouchableOpacity
              key={u.id}
              style={[styles.optionItem, selectedUserId === u.id && styles.optionItemSelected]}
              onPress={() => handleSelectUser(u)}
            >
              <View style={[styles.optionAvatar, { backgroundColor: roleConf.bgColor }]}>
                <Text style={[styles.optionAvatarText, { color: roleConf.textColor }]}>
                  {u.prenom?.[0]}{u.nom?.[0]}
                </Text>
              </View>
              <View style={styles.optionInfo}>
                <View style={styles.optionNameRow}>
                  <Text style={styles.optionName}>{u.prenom} {u.nom}</Text>
                  <View style={[styles.roleBadgeSmall, { backgroundColor: roleConf.bgColor }]}>
                    <Text style={[styles.roleBadgeSmallText, { color: roleConf.textColor }]}>
                      {roleConf.label}
                    </Text>
                  </View>
                </View>
                <Text style={styles.optionDetail} numberOfLines={1}>
                  {u.email || u.matricule || u.zone_responsable || u.specialite || 'Utilisateur'}
                </Text>
              </View>
              {selectedUserId === u.id && (
                <Ionicons name="checkmark-circle" size={24} color={roleConf.color} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // =========================================================
  // RENDU
  // =========================================================

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* HEADER */}
      <GradientHeader style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={handleCancel} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {isEdit ? 'Modifier la permission' : 'Nouvelle permission'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isEdit ? 'Modifiez les informations de la permission' : 'Créez une nouvelle permission'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={loading || !formValid}
            style={[styles.saveBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }, (!formValid || loading) && styles.saveBtnDisabled]}
            activeOpacity={0.7}
          >
            <Ionicons name={loading ? 'hourglass' : 'checkmark'} size={22} color={Colors.textWhite} />
          </TouchableOpacity>
        </View>
      </GradientHeader>

      {/* INDICATEUR TYPE */}
      {typePermission && (
        <Animated.View
          style={[styles.typeIndicator, { backgroundColor: selectedTypeInfo?.color + '15', borderColor: selectedTypeInfo?.color + '30' }, { opacity: fadeAnim }]}
        >
          <Ionicons name={selectedTypeInfo?.icon || 'key-outline'} size={20} color={selectedTypeInfo?.color || Colors.textMuted} />
          <Text style={[styles.typeIndicatorText, { color: selectedTypeInfo?.color || Colors.textMuted }]}>
            {selectedTypeInfo?.label || typePermission}
          </Text>
        </Animated.View>
      )}

      {/* FORMULAIRE */}
      <Animated.ScrollView
        style={[styles.scroll, { opacity: fadeAnim }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.formCard}>
          {/* Type de permission */}
          <View style={styles.typeSection}>
            <Text style={styles.typeLabel}>Type de permission</Text>
            <TouchableOpacity
              style={[styles.typeSelector, errors.typePermission && styles.typeSelectorError]}
              onPress={() => {
                setSearchType('');
                setShowTypeModal(true);
              }}
              activeOpacity={0.7}
            >
              {selectedTypeInfo ? (
                <View style={styles.typeSelected}>
                  <Ionicons name={selectedTypeInfo.icon} size={24} color={selectedTypeInfo.color} />
                  <View style={styles.typeSelectedInfo}>
                    <Text style={[styles.typeSelectedLabel, { color: selectedTypeInfo.color }]}>{selectedTypeInfo.label}</Text>
                    <Text style={styles.typeSelectedDescription}>{selectedTypeInfo.description}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.typePlaceholder}>
                  <Ionicons name="key-outline" size={24} color={Colors.textMuted} />
                  <Text style={styles.typePlaceholderText}>Sélectionner un type de permission</Text>
                </View>
              )}
              <Ionicons name="chevron-down" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
            {touched.typePermission && errors.typePermission ? (
              <Text style={styles.errorText}>{errors.typePermission}</Text>
            ) : null}
          </View>

          {/* Utilisateur */}
          <View style={styles.selectorSection}>
            <Text style={styles.selectorLabel}>Utilisateur concerné</Text>
            <TouchableOpacity
              style={[styles.selector, errors.selectedUserId && styles.selectorError]}
              onPress={() => {
                setSearchUser('');
                setRoleFilter('all');
                setShowUserModal(true);
              }}
              activeOpacity={0.7}
            >
              {selectedUserId ? (
                <View style={styles.selectorSelected}>
                  <View style={[styles.selectorAvatar, { backgroundColor: selectedRoleConfig.bgColor }]}>
                    <Text style={[styles.selectorAvatarText, { color: selectedRoleConfig.textColor }]}>
                      {selectedUserName.split(' ').map(n => n[0]).join('')}
                    </Text>
                  </View>
                  <View style={styles.selectorInfo}>
                    <View style={styles.selectorNameRow}>
                      <Text style={styles.selectorName}>{selectedUserName}</Text>
                      <View style={[styles.roleBadge, { backgroundColor: selectedRoleConfig.bgColor }]}>
                        <Text style={[styles.roleBadgeText, { color: selectedRoleConfig.textColor }]}>
                          {selectedRoleConfig.label}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.selectorDetail} numberOfLines={1}>
                      {allUsers.find(u => u.id === selectedUserId)?.email ||
                       allUsers.find(u => u.id === selectedUserId)?.matricule ||
                       allUsers.find(u => u.id === selectedUserId)?.zone_responsable ||
                       allUsers.find(u => u.id === selectedUserId)?.specialite ||
                       'Utilisateur'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.selectorPlaceholder}>
                  <Ionicons name="person-outline" size={20} color={Colors.textMuted} />
                  <Text style={styles.selectorPlaceholderText}>Sélectionner un utilisateur</Text>
                </View>
              )}
              <Ionicons name="chevron-down" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
            {touched.selectedUserId && errors.selectedUserId ? (
              <Text style={styles.errorText}>{errors.selectedUserId}</Text>
            ) : null}
          </View>

          {/* Aperçu de la permission */}
          {typePermission && selectedUserId && (
            <View style={styles.previewSection}>
              <Text style={styles.previewTitle}>📋 Aperçu de la permission</Text>
              <View style={styles.previewItem}>
                <Ionicons
                  name={selectedRoleConfig.icon}
                  size={16}
                  color={selectedRoleConfig.color}
                />
                <Text style={styles.previewText}>
                  {selectedRoleConfig.label}: {selectedUserName}
                </Text>
              </View>
              <View style={styles.previewItem}>
                <Ionicons name="key-outline" size={16} color={selectedTypeInfo?.color || Colors.textMuted} />
                <Text style={[styles.previewText, { color: selectedTypeInfo?.color || Colors.textMuted }]}>
                  {selectedTypeInfo?.label || typePermission}
                </Text>
              </View>
            </View>
          )}
        </Card>

        {/* BOUTONS */}
        <View style={styles.buttonsContainer}>
          <Button
            title={loading ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer'}
            onPress={handleSave}
            loading={loading}
            disabled={!formValid}
            size="lg"
            fullWidth
            icon={isEdit ? 'refresh-outline' : 'add-outline'}
            style={styles.submitBtn}
          />
          <Button title="Annuler" onPress={handleCancel} variant="ghost" size="lg" fullWidth />
        </View>
        <View style={styles.footerSpace} />
      </Animated.ScrollView>

      {/* MODAL TYPE DE PERMISSION AVEC RECHERCHE */}
      <Modal visible={showTypeModal} transparent animationType="slide" onRequestClose={() => setShowTypeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Type de permission</Text>
              <TouchableOpacity onPress={() => setShowTypeModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchInputWrapper}>
              <Ionicons name="search-outline" size={20} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher une permission..."
                value={searchType}
                onChangeText={setSearchType}
                autoFocus
                placeholderTextColor={Colors.textMuted}
              />
              {searchType.length > 0 && (
                <TouchableOpacity onPress={() => setSearchType('')}>
                  <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {filteredTypes.length > 0 ? (
                filteredTypes.map(type => (
                  <TouchableOpacity
                    key={type.value}
                    style={[styles.typeOption, typePermission === type.value && styles.typeOptionSelected]}
                    onPress={() => handleSelectType(type)}
                  >
                    <View style={[styles.typeOptionIcon, { backgroundColor: type.color + '15' }]}>
                      <Ionicons name={type.icon} size={24} color={type.color} />
                    </View>
                    <View style={styles.typeOptionInfo}>
                      <Text style={styles.typeOptionLabel}>{type.label}</Text>
                      <Text style={styles.typeOptionDescription}>{type.description}</Text>
                    </View>
                    {typePermission === type.value && <Ionicons name="checkmark-circle" size={24} color={type.color} />}
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyText}>Aucune permission trouvée</Text>
                </View>
              )}
            </ScrollView>

            <Button title="Annuler" variant="ghost" onPress={() => setShowTypeModal(false)} fullWidth />
          </View>
        </View>
      </Modal>

      {/* MODAL UTILISATEURS AVEC RECHERCHE ET FILTRES */}
      <Modal visible={showUserModal} transparent animationType="slide" onRequestClose={() => setShowUserModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionner un utilisateur</Text>
              <TouchableOpacity onPress={() => setShowUserModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchInputWrapper}>
              <Ionicons name="search-outline" size={20} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher par nom, email, rôle..."
                value={searchUser}
                onChangeText={setSearchUser}
                autoFocus
                placeholderTextColor={Colors.textMuted}
              />
              {searchUser.length > 0 && (
                <TouchableOpacity onPress={() => setSearchUser('')}>
                  <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Filtres par rôle */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.roleFiltersContainer}
              contentContainerStyle={styles.roleFiltersContent}
            >
              {roleFilters.map(filter => {
                const isActive = roleFilter === filter.key;
                return (
                  <TouchableOpacity
                    key={filter.key}
                    style={[styles.roleFilterChip, isActive && styles.roleFilterChipActive]}
                    onPress={() => setRoleFilter(filter.key)}
                  >
                    <Ionicons
                      name={filter.icon}
                      size={14}
                      color={isActive ? Colors.textWhite : Colors.textSecondary}
                    />
                    <Text style={[styles.roleFilterText, isActive && styles.roleFilterTextActive]}>
                      {filter.label}
                    </Text>
                    {filter.count > 0 && (
                      <View style={[styles.roleFilterCount, isActive && styles.roleFilterCountActive]}>
                        <Text style={[styles.roleFilterCountText, isActive && styles.roleFilterCountTextActive]}>
                          {filter.count}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {loadingUsers ? (
                <View style={styles.modalEmpty}>
                  <Ionicons name="hourglass-outline" size={48} color={Colors.textMuted} />
                  <Text style={styles.modalEmptyText}>Chargement des utilisateurs...</Text>
                </View>
              ) : filteredUsers.length > 0 ? (
                <>
                  {renderUserSection('Administrateurs', 'shield-checkmark-outline', Colors.danger, usersByRole.admin)}
                  {renderUserSection('DJ', 'musical-notes-outline', Colors.accent, usersByRole.dj)}
                  {renderUserSection('Superviseurs', 'briefcase-outline', Colors.primary, usersByRole.superviseur)}
                  {renderUserSection('Techniciens', 'construct-outline', Colors.secondary, usersByRole.technicien)}
                  {renderUserSection('Autres', 'person-outline', Colors.textMuted, usersByRole.autre)}
                </>
              ) : (
                <View style={styles.modalEmpty}>
                  <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
                  <Text style={styles.modalEmptyText}>
                    {allUsers.length === 0
                      ? 'Aucun utilisateur disponible'
                      : 'Aucun utilisateur trouvé'}
                  </Text>
                  {allUsers.length === 0 && (
                    <TouchableOpacity
                      style={styles.retryBtn}
                      onPress={handleRetryLoadUsers}
                    >
                      <Ionicons name="refresh-outline" size={16} color={Colors.textWhite} />
                      <Text style={styles.retryBtnText}>Réessayer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </ScrollView>

            <Button title="Annuler" variant="ghost" onPress={() => setShowUserModal(false)} fullWidth />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
    paddingHorizontal: 16,
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
    paddingHorizontal: 8,
  },
  headerTitle: {
    color: Colors.textWhite,
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  saveBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  typeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: -10,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    ...Shadows.card,
    elevation: 4,
    backgroundColor: Colors.surface,
  },
  typeIndicatorText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  formCard: {
    padding: 16,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 4,
    marginLeft: 4,
  },
  typeSection: {
    marginBottom: 12,
  },
  typeLabel: {
    ...Typography.label,
    marginBottom: 6,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  typeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: Colors.surface,
    minHeight: 60,
  },
  typeSelectorError: {
    borderColor: Colors.danger,
  },
  typeSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  typeSelectedInfo: {
    flex: 1,
  },
  typeSelectedLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  typeSelectedDescription: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  typePlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  typePlaceholderText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  selectorSection: {
    marginBottom: 12,
  },
  selectorLabel: {
    ...Typography.label,
    marginBottom: 6,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: Colors.surface,
    minHeight: 54,
  },
  selectorError: {
    borderColor: Colors.danger,
  },
  selectorSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  selectorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectorAvatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  selectorInfo: {
    flex: 1,
  },
  selectorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  selectorName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  selectorDetail: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  selectorPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  selectorPlaceholderText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  previewSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  previewText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  buttonsContainer: {
    marginTop: 8,
  },
  submitBtn: {
    marginBottom: 8,
  },
  footerSpace: {
    height: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalList: {
    maxHeight: 380,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginTop: 12,
    marginBottom: 8,
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
  modalEmpty: {
    padding: 20,
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  retryBtnText: {
    color: Colors.textWhite,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: Colors.background,
    borderRadius: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  sectionCount: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  sectionCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  roleFiltersContainer: {
    maxHeight: 44,
    marginBottom: 4,
  },
  roleFiltersContent: {
    gap: 8,
    paddingVertical: 4,
    paddingRight: 8,
  },
  roleFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleFilterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  roleFilterText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  roleFilterTextActive: {
    color: Colors.textWhite,
    fontWeight: '600',
  },
  roleFilterCount: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: Colors.border,
    minWidth: 18,
    alignItems: 'center',
  },
  roleFilterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  roleFilterCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  roleFilterCountTextActive: {
    color: Colors.textWhite,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: 12,
  },
  typeOptionSelected: {
    backgroundColor: Colors.primary + '05',
    borderRadius: 6,
  },
  typeOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeOptionInfo: {
    flex: 1,
  },
  typeOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  typeOptionDescription: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: 12,
  },
  optionItemSelected: {
    backgroundColor: Colors.primary + '05',
    borderRadius: 6,
  },
  optionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionAvatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  optionInfo: {
    flex: 1,
  },
  optionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  optionName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  roleBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roleBadgeSmallText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  optionDetail: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
});