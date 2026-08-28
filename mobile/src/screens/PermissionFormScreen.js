// mobile/src/screens/PermissionFormScreen.js
// Version avec barres de recherche dans toutes les modales de sélection
// Utilise la même liste exhaustive de types de permission que PermissionsScreen

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
  KeyboardAvoidingView,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';

import { permissionsAPI, superviseursAPI, techniciensAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Selector, Card } from '../components';
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';

// =========================================================
// CONSTANTES - LISTE EXHAUSTIVE DES PERMISSIONS
// (identique à celle de PermissionsScreen)
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
// COMPOSANT PRINCIPAL
// =========================================================

export default function PermissionFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, isAdmin, isDJ } = useAuth();

  const editPermission = route.params?.permission;
  const isEdit = !!editPermission;

  // États du formulaire
  const [superviseurId, setSuperviseurId] = useState(editPermission?.superviseur_id || null);
  const [technicienId, setTechnicienId] = useState(editPermission?.technicien_id || null);
  const [typePermission, setTypePermission] = useState(editPermission?.type_permission || '');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [formValid, setFormValid] = useState(false);
  const [superviseurs, setSuperviseurs] = useState([]);
  const [techniciens, setTechniciens] = useState([]);
  const [selectedSuperviseurName, setSelectedSuperviseurName] = useState('');
  const [selectedTechnicienName, setSelectedTechnicienName] = useState('');

  // État de visibilité des modales
  const [showSuperviseurModal, setShowSuperviseurModal] = useState(false);
  const [showTechnicienModal, setShowTechnicienModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);

  // États de recherche
  const [searchType, setSearchType] = useState('');
  const [searchSuperviseur, setSearchSuperviseur] = useState('');
  const [searchTechnicien, setSearchTechnicien] = useState('');

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // =========================================================
  // CHARGEMENT DES DONNÉES
  // =========================================================

  useEffect(() => {
    const loadData = async () => {
      try {
        const [supData, techData] = await Promise.all([
          superviseursAPI.list(),
          techniciensAPI.list(),
        ]);

        const supers = supData?.data || supData || [];
        const techs = techData?.data || techData || [];

        setSuperviseurs(supers);
        setTechniciens(techs);

        if (superviseurId) {
          const sup = supers.find(s => s.id === superviseurId);
          if (sup) setSelectedSuperviseurName(`${sup.prenom} ${sup.nom}`);
        }
        if (technicienId) {
          const tech = techs.find(t => t.id === technicienId);
          if (tech) setSelectedTechnicienName(`${tech.prenom} ${tech.nom}`);
        }
      } catch (error) {
        console.error('❌ Erreur chargement données:', error);
      }
    };
    loadData();
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
    if (!superviseurId) newErrors.superviseurId = 'Le superviseur est requis';
    if (!typePermission) newErrors.typePermission = 'Le type de permission est requis';
    setErrors(newErrors);
    setFormValid(Object.keys(newErrors).length === 0);
  }, [superviseurId, typePermission]);

  const handleFieldBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // =========================================================
  // HANDLERS
  // =========================================================

  const handleSave = async () => {
    if (!formValid) {
      setTouched({ superviseurId: true, typePermission: true });
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }

    setLoading(true);
    try {
      const data = {
        superviseur_id: superviseurId,
        type_permission: typePermission,
      };
      if (technicienId) data.technicien_id = technicienId;

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
      return (
        superviseurId !== editPermission.superviseur_id ||
        technicienId !== editPermission.technicien_id ||
        typePermission !== editPermission.type_permission
      );
    }
    return superviseurId !== null || technicienId !== null || typePermission !== '';
  };

  const handleSelectSuperviseur = (sup) => {
    setSuperviseurId(sup.id);
    setSelectedSuperviseurName(`${sup.prenom} ${sup.nom}`);
    setShowSuperviseurModal(false);
    setSearchSuperviseur('');
    handleFieldBlur('superviseurId');
  };

  const handleSelectTechnicien = (tech) => {
    setTechnicienId(tech.id);
    setSelectedTechnicienName(`${tech.prenom} ${tech.nom}`);
    setShowTechnicienModal(false);
    setSearchTechnicien('');
  };

  const handleSelectType = (type) => {
    setTypePermission(type.value);
    setShowTypeModal(false);
    setSearchType('');
    handleFieldBlur('typePermission');
  };

  const getTypeInfo = (typeValue) => TYPES_PERMISSION.find(t => t.value === typeValue);
  const selectedTypeInfo = getTypeInfo(typePermission);

  // Filtres pour les listes
  const filteredTypes = TYPES_PERMISSION.filter(type =>
    type.label.toLowerCase().includes(searchType.toLowerCase()) ||
    type.description.toLowerCase().includes(searchType.toLowerCase())
  );

  const filteredSuperviseurs = superviseurs.filter(sup =>
    `${sup.prenom} ${sup.nom}`.toLowerCase().includes(searchSuperviseur.toLowerCase()) ||
    (sup.zone_responsable && sup.zone_responsable.toLowerCase().includes(searchSuperviseur.toLowerCase()))
  );

  const filteredTechniciens = techniciens.filter(tech =>
    `${tech.prenom} ${tech.nom}`.toLowerCase().includes(searchTechnicien.toLowerCase()) ||
    (tech.matricule && tech.matricule.toLowerCase().includes(searchTechnicien.toLowerCase())) ||
    (tech.specialite && tech.specialite.toLowerCase().includes(searchTechnicien.toLowerCase()))
  );

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

          {/* Superviseur */}
          <View style={styles.selectorSection}>
            <Text style={styles.selectorLabel}>Superviseur</Text>
            <TouchableOpacity
              style={[styles.selector, errors.superviseurId && styles.selectorError]}
              onPress={() => {
                setSearchSuperviseur('');
                setShowSuperviseurModal(true);
              }}
              activeOpacity={0.7}
            >
              {superviseurId ? (
                <View style={styles.selectorSelected}>
                  <View style={[styles.selectorAvatar, { backgroundColor: Colors.primary + '20' }]}>
                    <Text style={[styles.selectorAvatarText, { color: Colors.primary }]}>
                      {selectedSuperviseurName.split(' ').map(n => n[0]).join('')}
                    </Text>
                  </View>
                  <View style={styles.selectorInfo}>
                    <Text style={styles.selectorName}>{selectedSuperviseurName}</Text>
                    <Text style={styles.selectorDetail}>
                      {superviseurs.find(s => s.id === superviseurId)?.zone_responsable || 'Superviseur'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.selectorPlaceholder}>
                  <Ionicons name="person-outline" size={20} color={Colors.textMuted} />
                  <Text style={styles.selectorPlaceholderText}>Sélectionner un superviseur</Text>
                </View>
              )}
              <Ionicons name="chevron-down" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
            {touched.superviseurId && errors.superviseurId ? (
              <Text style={styles.errorText}>{errors.superviseurId}</Text>
            ) : null}
          </View>

          {/* Technicien (optionnel) */}
          <View style={styles.selectorSection}>
            <Text style={styles.selectorLabel}>Technicien concerné <Text style={styles.optionalLabel}>(optionnel)</Text></Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => {
                setSearchTechnicien('');
                setShowTechnicienModal(true);
              }}
              activeOpacity={0.7}
            >
              {technicienId ? (
                <View style={styles.selectorSelected}>
                  <View style={[styles.selectorAvatar, { backgroundColor: Colors.secondary + '20' }]}>
                    <Text style={[styles.selectorAvatarText, { color: Colors.secondary }]}>
                      {selectedTechnicienName.split(' ').map(n => n[0]).join('')}
                    </Text>
                  </View>
                  <View style={styles.selectorInfo}>
                    <Text style={styles.selectorName}>{selectedTechnicienName}</Text>
                    <Text style={styles.selectorDetail}>
                      {techniciens.find(t => t.id === technicienId)?.matricule || 'Technicien'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.selectorPlaceholder}>
                  <Ionicons name="construct-outline" size={20} color={Colors.textMuted} />
                  <Text style={styles.selectorPlaceholderText}>Sélectionner un technicien (optionnel)</Text>
                </View>
              )}
              <Ionicons name="chevron-down" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Aperçu de la permission */}
          {typePermission && superviseurId && (
            <View style={styles.previewSection}>
              <Text style={styles.previewTitle}>📋 Aperçu de la permission</Text>
              <View style={styles.previewItem}>
                <Ionicons name="person-outline" size={16} color={Colors.textMuted} />
                <Text style={styles.previewText}>Superviseur: {selectedSuperviseurName}</Text>
              </View>
              {technicienId && (
                <View style={styles.previewItem}>
                  <Ionicons name="construct-outline" size={16} color={Colors.textMuted} />
                  <Text style={styles.previewText}>Technicien: {selectedTechnicienName}</Text>
                </View>
              )}
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

            <ScrollView style={styles.modalList}>
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

      {/* MODAL SUPERVISEURS AVEC RECHERCHE */}
      <Modal visible={showSuperviseurModal} transparent animationType="slide" onRequestClose={() => setShowSuperviseurModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionner un superviseur</Text>
              <TouchableOpacity onPress={() => setShowSuperviseurModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchInputWrapper}>
              <Ionicons name="search-outline" size={20} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher un superviseur..."
                value={searchSuperviseur}
                onChangeText={setSearchSuperviseur}
                autoFocus
                placeholderTextColor={Colors.textMuted}
              />
              {searchSuperviseur.length > 0 && (
                <TouchableOpacity onPress={() => setSearchSuperviseur('')}>
                  <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.modalList}>
              {filteredSuperviseurs.length > 0 ? (
                filteredSuperviseurs.map(sup => (
                  <TouchableOpacity
                    key={sup.id}
                    style={[styles.optionItem, superviseurId === sup.id && styles.optionItemSelected]}
                    onPress={() => handleSelectSuperviseur(sup)}
                  >
                    <View style={[styles.optionAvatar, { backgroundColor: Colors.primary + '20' }]}>
                      <Text style={[styles.optionAvatarText, { color: Colors.primary }]}>{sup.prenom?.[0]}{sup.nom?.[0]}</Text>
                    </View>
                    <View style={styles.optionInfo}>
                      <Text style={styles.optionName}>{sup.prenom} {sup.nom}</Text>
                      <Text style={styles.optionDetail}>{sup.zone_responsable || 'Superviseur'} • Niveau {sup.niveau_experience}</Text>
                    </View>
                    {superviseurId === sup.id && <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />}
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyText}>Aucun superviseur trouvé</Text>
                </View>
              )}
            </ScrollView>

            <Button title="Annuler" variant="ghost" onPress={() => setShowSuperviseurModal(false)} fullWidth />
          </View>
        </View>
      </Modal>

      {/* MODAL TECHNICIENS AVEC RECHERCHE */}
      <Modal visible={showTechnicienModal} transparent animationType="slide" onRequestClose={() => setShowTechnicienModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionner un technicien</Text>
              <TouchableOpacity onPress={() => setShowTechnicienModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchInputWrapper}>
              <Ionicons name="search-outline" size={20} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher un technicien..."
                value={searchTechnicien}
                onChangeText={setSearchTechnicien}
                autoFocus
                placeholderTextColor={Colors.textMuted}
              />
              {searchTechnicien.length > 0 && (
                <TouchableOpacity onPress={() => setSearchTechnicien('')}>
                  <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.modalList}>
              <TouchableOpacity
                style={[styles.optionItem, styles.optionItemFirst]}
                onPress={() => { setTechnicienId(null); setSelectedTechnicienName(''); setShowTechnicienModal(false); setSearchTechnicien(''); }}
              >
                <View style={[styles.optionAvatar, { backgroundColor: Colors.textMuted + '20' }]}>
                  <Ionicons name="person-outline" size={20} color={Colors.textMuted} />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionName}>Non spécifié</Text>
                  <Text style={styles.optionDetail}>Aucun technicien concerné</Text>
                </View>
                {!technicienId && <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />}
              </TouchableOpacity>

              {filteredTechniciens.length > 0 ? (
                filteredTechniciens.map(tech => (
                  <TouchableOpacity
                    key={tech.id}
                    style={[styles.optionItem, technicienId === tech.id && styles.optionItemSelected]}
                    onPress={() => handleSelectTechnicien(tech)}
                  >
                    <View style={[styles.optionAvatar, { backgroundColor: Colors.secondary + '20' }]}>
                      <Text style={[styles.optionAvatarText, { color: Colors.secondary }]}>{tech.prenom?.[0]}{tech.nom?.[0]}</Text>
                    </View>
                    <View style={styles.optionInfo}>
                      <Text style={styles.optionName}>{tech.prenom} {tech.nom}</Text>
                      <Text style={styles.optionDetail}>{tech.matricule} • {tech.specialite || 'Généraliste'}</Text>
                    </View>
                    {technicienId === tech.id && <Ionicons name="checkmark-circle" size={24} color={Colors.secondary} />}
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyText}>Aucun technicien trouvé</Text>
                </View>
              )}
            </ScrollView>

            <Button title="Annuler" variant="ghost" onPress={() => setShowTechnicienModal(false)} fullWidth />
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
  optionalLabel: {
    fontWeight: '400',
    color: Colors.textMuted,
    fontSize: 12,
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
  selectorName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  selectorDetail: {
    fontSize: 12,
    color: Colors.textMuted,
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
    maxHeight: '80%',
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
    maxHeight: 400,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginVertical: 12,
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: 12,
  },
  optionItemFirst: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
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
  optionName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  optionDetail: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
});