// mobile/src/screens/IncidentFormScreen.js
// Version avec pré-remplissage automatique du technicien connecté
// + gestion du cas "profil technicien introuvable"

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
  FlatList,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';

import { incidentsAPI, techniciensAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Card } from '../components';
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';

// =========================================================
// CONSTANTES
// =========================================================

const TYPES_INCIDENT = [
  { label: 'Panne réseau', value: 'panne_reseau', icon: 'wifi-outline' },
  { label: 'Panne client', value: 'panne_client', icon: 'person-outline' },
  { label: 'Sécurité', value: 'securite', icon: 'shield-outline' },
  { label: 'Équipement', value: 'equipement', icon: 'hardware-chip-outline' },
  { label: 'Autre', value: 'autre', icon: 'construct-outline' },
];

const SEVERITES = [
  { label: 'Faible', value: 'faible', icon: 'chevron-down-circle-outline', color: Colors.success },
  { label: 'Moyenne', value: 'moyenne', icon: 'radio-button-off-outline', color: Colors.warning },
  { label: 'Élevée', value: 'elevee', icon: 'chevron-up-circle-outline', color: Colors.danger },
  { label: 'Critique', value: 'critique', icon: 'warning-outline', color: Colors.danger },
];

const STATUTS_INCIDENT = [
  { label: 'Ouvert', value: 'ouvert', icon: 'radio-button-on-outline' },
  { label: 'En cours', value: 'en_cours', icon: 'time-outline' },
  { label: 'Résolu', value: 'resolu', icon: 'checkmark-circle-outline' },
  { label: 'Fermé', value: 'ferme', icon: 'lock-closed-outline' },
];

// =========================================================
// COMPOSANT SÉLECTEUR RECHERCHABLE (avec allowCustom et disabled)
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
  allowCustom = true,
  disabled = false,
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (selected) => {
    onChange(selected);
    setModalVisible(false);
    setSearch('');
    if (onBlur) onBlur();
  };

  const getIconName = () => {
    const found = options.find(o => o.value === value);
    return found?.icon || icon || 'chevron-down';
  };

  const getColor = () => {
    if (getOptionColor) return getOptionColor(value);
    const found = options.find(o => o.value === value);
    return found?.color || Colors.textMuted;
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
        activeOpacity={disabled ? 1 : 0.7}
        disabled={disabled}
      >
        <View style={styles.selectorInputContent}>
          <Ionicons name={getIconName()} size={20} color={value ? getColor() : Colors.textMuted} />
          <Text style={[
            styles.selectorInputText,
            value ? styles.selectorInputTextSelected : styles.selectorInputTextPlaceholder,
          ]}>
            {value ? options.find(o => o.value === value)?.label || value : placeholder || 'Sélectionner...'}
          </Text>
        </View>
        {!disabled && <Ionicons name="chevron-down" size={20} color={Colors.textMuted} />}
      </TouchableOpacity>
      {error && touched && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        animationType="slide"
        transparent
        visible={modalVisible && !disabled}
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
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filteredOptions}
              keyExtractor={(item) => item.value.toString()}
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
                  {allowCustom && !disabled && (
                    <TouchableOpacity
                      style={styles.modalCustomAdd}
                      onPress={() => {
                        if (search.trim()) {
                          handleSelect(search.trim());
                        }
                      }}
                    >
                      <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                      <Text style={styles.modalCustomAddText}>Ajouter "{search}"</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function IncidentFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();

  const isSuperviseur = user?.role === 'superviseur';
  const isAdmin = user?.role === 'admin' || user?.role === 'dj';
  const canDelete = isSuperviseur || isAdmin;
  const isTechnicien = user?.role === 'technicien';

  const editIncident = route.params?.incident;
  const isEdit = !!editIncident;

  // États du formulaire
  const [titre, setTitre] = useState(editIncident?.titre || '');
  const [description, setDescription] = useState(editIncident?.description || '');
  const [typeIncident, setTypeIncident] = useState(editIncident?.type_incident || '');
  const [severite, setSeverite] = useState(editIncident?.severite || 'moyenne');
  const [statut, setStatut] = useState(editIncident?.statut || 'ouvert');
  const [zone, setZone] = useState(editIncident?.zone || '');
  const [solutionApportee, setSolutionApportee] = useState(editIncident?.solution_apportee || '');
  const [technicienId, setTechnicienId] = useState(editIncident?.technicien_id || null);
  const [clientAppele, setClientAppele] = useState(editIncident?.client_appele || 0);
  const [latitude, setLatitude] = useState(editIncident?.latitude ? String(editIncident.latitude) : '');
  const [longitude, setLongitude] = useState(editIncident?.longitude ? String(editIncident.longitude) : '');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [techniciens, setTechniciens] = useState([]);
  const [formValid, setFormValid] = useState(false);
  const [profileMissing, setProfileMissing] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // =========================================================
  // CHARGEMENT DES TECHNICIENS + PRÉ-REMPLISSAGE
  // =========================================================

  useEffect(() => {
    const load = async () => {
      try {
        const res = await techniciensAPI.list();
        let techs = [];
        if (Array.isArray(res)) {
          techs = res;
        } else if (res && Array.isArray(res.data)) {
          techs = res.data;
        } else if (res && res.data && Array.isArray(res.data.data)) {
          techs = res.data.data;
        } else {
          techs = [];
        }
        setTechniciens(techs);

        // ✅ Pré-remplir avec le technicien connecté si l'utilisateur est technicien
        if (user && user.role === 'technicien') {
          const tech = techs.find(t => t.utilisateur_id === user.id);
          if (tech) {
            setTechnicienId(tech.id);
            setProfileMissing(false);
          } else {
            setProfileMissing(true);
            // ❌ Afficher une alerte non bloquante pour informer l'utilisateur
            Alert.alert(
              '⚠️ Profil technicien manquant',
              'Votre compte utilisateur n\'est pas associé à un profil technicien. Veuillez contacter un administrateur pour créer votre profil.',
              [{ text: 'OK', style: 'default' }]
            );
          }
        } else {
          setProfileMissing(false);
        }
      } catch (error) {
        console.error('❌ Erreur chargement techniciens:', error);
        setTechniciens([]);
      }
    };
    load();
  }, [user]);

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

  const validateField = useCallback((field, value) => {
    switch (field) {
      case 'titre': return !value.trim() ? 'Le titre est requis' : '';
      case 'description': return !value.trim() ? 'La description est requise' : '';
      case 'typeIncident': return !value ? "Le type d'incident est requis" : '';
      case 'severite': return !value ? 'La sévérité est requise' : '';
      case 'zone': return !value.trim() ? 'La zone est requise' : '';
      default: return '';
    }
  }, []);

  useEffect(() => {
    const newErrors = {};
    const fields = { titre, description, typeIncident, severite, zone };
    Object.entries(fields).forEach(([key, value]) => {
      const error = validateField(key, value);
      if (error) newErrors[key] = error;
    });
    setErrors(newErrors);
    setFormValid(Object.keys(newErrors).length === 0);
  }, [titre, description, typeIncident, severite, zone, validateField]);

  const handleFieldBlur = useCallback((field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  // =========================================================
  // HANDLERS
  // =========================================================

  const handleSave = async () => {
    if (!formValid) {
      setTouched({ titre: true, description: true, typeIncident: true, severite: true, zone: true });
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }

    // ✅ Vérification que le technicien est bien assigné
    if (!technicienId) {
      Alert.alert('Erreur', 'Veuillez sélectionner un technicien pour cet incident.');
      return;
    }

    // ✅ Vérification du type numérique
    if (isNaN(Number(technicienId))) {
      Alert.alert('Erreur', 'Veuillez sélectionner un technicien valide.');
      return;
    }

    // ✅ Vérification que le technicien existe dans la liste
    const technicienExists = techniciens.some(t => t.id === Number(technicienId));
    if (!technicienExists) {
      Alert.alert('Erreur', 'Le technicien sélectionné n\'existe pas.');
      return;
    }

    setLoading(true);
    try {
      const data = {
        titre: titre.trim(),
        description: description.trim(),
        type_incident: typeIncident,
        severite,
        statut,
        zone: zone.trim(),
        client_appele: clientAppele,
      };
      if (solutionApportee) data.solution_apportee = solutionApportee.trim();
      if (technicienId) data.technicien_id = Number(technicienId);
      if (latitude) data.latitude = parseFloat(latitude);
      if (longitude) data.longitude = parseFloat(longitude);

      console.log('📦 Payload envoyé à /incidents:', JSON.stringify(data, null, 2));

      if (isEdit) {
        await incidentsAPI.update(editIncident.id, data);
        Alert.alert('✅ Succès', 'Incident modifié', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else {
        await incidentsAPI.create(data);
        Alert.alert('✅ Succès', 'Incident signalé', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch (error) {
      console.error('❌ Erreur sauvegarde:', error);
      Alert.alert('❌ Erreur', error.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!canDelete) {
      Alert.alert('Permission refusée', "Vous n'avez pas le droit de supprimer cet incident.");
      return;
    }

    Alert.alert(
      'Confirmer la suppression',
      'Êtes-vous sûr de vouloir supprimer cet incident ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await incidentsAPI.delete(editIncident.id);
              Alert.alert('✅ Succès', 'Incident supprimé', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (error) {
              console.error('❌ Erreur suppression:', error);
              Alert.alert('❌ Erreur', error.message || 'Impossible de supprimer l\'incident');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleCancel = () => {
    if (isFormDirty()) {
      Alert.alert('Annuler', 'Quitter sans sauvegarder ?', [
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
        titre !== (editIncident?.titre || '') ||
        description !== (editIncident?.description || '') ||
        typeIncident !== (editIncident?.type_incident || '') ||
        severite !== (editIncident?.severite || 'moyenne') ||
        statut !== (editIncident?.statut || 'ouvert') ||
        zone !== (editIncident?.zone || '') ||
        solutionApportee !== (editIncident?.solution_apportee || '') ||
        technicienId !== (editIncident?.technicien_id || null) ||
        clientAppele !== (editIncident?.client_appele || 0)
      );
    }
    return titre !== '' || description !== '' || typeIncident !== '' || zone !== '' || solutionApportee !== '' || technicienId !== null;
  };

  const getSeveriteColor = (value) => {
    const found = SEVERITES.find(s => s.value === value);
    return found ? found.color : Colors.textMuted;
  };

  // ✅ Construction des options pour techniciens
  const technicienOptions = (techniciens || [])
    .filter(t => t.disponible === 1)
    .map(t => ({
      label: `${t.prenom} ${t.nom} (${t.matricule})`,
      value: t.id,
      icon: 'person-outline',
      color: Colors.primary,
    }));

  // =========================================================
  // RENDU
  // =========================================================

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      <GradientHeader style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={handleCancel} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{isEdit ? "Modifier l'incident" : 'Signaler un incident'}</Text>
            <Text style={styles.headerSubtitle}>{isEdit ? 'Modifiez les informations' : 'Signalez un nouvel incident'}</Text>
          </View>

          <View style={styles.headerActions}>
            {isEdit && canDelete && (
              <TouchableOpacity
                onPress={handleDelete}
                style={[styles.headerActionBtn, styles.deleteBtn]}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={22} color={Colors.textWhite} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleSave}
              disabled={loading || !formValid || (isTechnicien && !technicienId)}
              style={[styles.headerActionBtn, styles.saveBtn, (!formValid || loading || (isTechnicien && !technicienId)) && styles.saveBtnDisabled]}
              activeOpacity={0.7}
            >
              <Ionicons name={loading ? 'hourglass' : 'checkmark'} size={22} color={Colors.textWhite} />
            </TouchableOpacity>
          </View>
        </View>
      </GradientHeader>

      <Animated.View style={[styles.severiteIndicator, { backgroundColor: getSeveriteColor(severite) + '15', borderColor: getSeveriteColor(severite) + '30' }, { opacity: fadeAnim }]}>
        <Ionicons name={severite === 'critique' || severite === 'elevee' ? 'alert' : 'information-circle'} size={20} color={getSeveriteColor(severite)} />
        <Text style={[styles.severiteIndicatorText, { color: getSeveriteColor(severite) }]}>
          {SEVERITES.find(s => s.value === severite)?.label || severite}
        </Text>
      </Animated.View>

      <Animated.ScrollView style={[styles.scroll, { opacity: fadeAnim }]}
      contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card style={styles.formCard}>
          <Input
            label="Titre de l'incident"
            value={titre}
            onChangeText={setTitre}
            onBlur={() => handleFieldBlur('titre')}
            placeholder="Ex: Coupure fibre Zone Est"
            leftIcon="alert-circle-outline"
            error={touched.titre ? errors.titre : ''}
          />

          <Input
            label="Description"
            value={description}
            onChangeText={setDescription}
            onBlur={() => handleFieldBlur('description')}
            placeholder="Décrivez l'incident en détail..."
            multiline
            numberOfLines={4}
            leftIcon="document-text-outline"
            error={touched.description ? errors.description : ''}
          />

          <SearchableSelector
            label="Type d'incident"
            value={typeIncident}
            onChange={setTypeIncident}
            options={TYPES_INCIDENT}
            placeholder="Sélectionner un type"
            error={errors.typeIncident}
            touched={touched.typeIncident}
            onBlur={() => handleFieldBlur('typeIncident')}
          />

          <SearchableSelector
            label="Sévérité"
            value={severite}
            onChange={setSeverite}
            options={SEVERITES}
            placeholder="Sélectionner une sévérité"
            error={errors.severite}
            touched={touched.severite}
            onBlur={() => handleFieldBlur('severite')}
            getOptionColor={getSeveriteColor}
          />

          {isEdit && (
            <SearchableSelector
              label="Statut"
              value={statut}
              onChange={setStatut}
              options={STATUTS_INCIDENT}
              placeholder="Sélectionner un statut"
              error={errors.statut}
              touched={touched.statut}
              onBlur={() => handleFieldBlur('statut')}
            />
          )}

          <Input
            label="Zone concernée"
            value={zone}
            onChangeText={setZone}
            onBlur={() => handleFieldBlur('zone')}
            placeholder="Ex: Zone Nord"
            leftIcon="location-outline"
            error={touched.zone ? errors.zone : ''}
          />

          {(statut === 'resolu' || statut === 'ferme') && (
            <Input
              label="Solution apportée"
              value={solutionApportee}
              onChangeText={setSolutionApportee}
              placeholder="Décrivez la solution mise en place..."
              multiline
              numberOfLines={3}
              leftIcon="checkmark-done-outline"
            />
          )}

          <SearchableSelector
            label="Technicien assigné"
            value={technicienId}
            onChange={setTechnicienId}
            options={technicienOptions}
            placeholder={profileMissing ? "Profil technicien manquant" : "Sélectionner un technicien"}
            error={errors.technicienId}
            touched={touched.technicienId}
            onBlur={() => handleFieldBlur('technicienId')}
            allowCustom={false}
            disabled={isTechnicien}
          />

          {profileMissing && isTechnicien && (
            <Text style={styles.warningText}>
              ⚠️ Votre compte n'est pas associé à un profil technicien. Contactez l'administrateur.
            </Text>
          )}

          <View style={styles.checkboxSection}>
            <Text style={styles.checkboxLabel}>Client appelé</Text>
            <View style={styles.checkboxRow}>
              <TouchableOpacity style={[styles.checkboxOption, clientAppele === 1 && styles.checkboxOptionActive]}
              onPress={() => setClientAppele(1)}>
                <Ionicons name={clientAppele === 1 ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={clientAppele === 1 ? Colors.success : Colors.textMuted} />
                <Text style={[styles.checkboxOptionText, clientAppele === 1 && { color: Colors.success }]}>Oui</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.checkboxOption, clientAppele === 0 && styles.checkboxOptionActive]} onPress={() => setClientAppele(0)}>
                <Ionicons name={clientAppele === 0 ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={clientAppele === 0 ? Colors.danger : Colors.textMuted} />
                <Text style={[styles.checkboxOptionText, clientAppele === 0 && { color: Colors.danger }]}>Non</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.gpsRow}>
            <Input label="Latitude" value={latitude} onChangeText={setLatitude} placeholder="-3.3822" keyboardType="decimal-pad" containerStyle={styles.gpsInput} />
            <Input label="Longitude" value={longitude} onChangeText={setLongitude} placeholder="29.3644" keyboardType="decimal-pad" containerStyle={styles.gpsInput} />
          </View>
        </Card>

        <View style={styles.buttonsContainer}>
          <Button
            title={loading ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Signaler'}
            onPress={handleSave}
            loading={loading}
            disabled={!formValid || (isTechnicien && !technicienId)}
            size="lg"
            fullWidth
            icon={isEdit ? 'refresh-outline' : 'add-outline'}
            style={styles.submitBtn}
          />
          <Button title="Annuler" onPress={handleCancel} variant="ghost" size="lg" fullWidth />
        </View>
        <View style={styles.footerSpace} />
      </Animated.ScrollView>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  saveBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },

  severiteIndicator: {
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
  severiteIndicatorText: {
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
    marginBottom: 4,
    marginLeft: 4,
  },

  warningText: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 4,
    marginBottom: 8,
    marginLeft: 4,
    fontStyle: 'italic',
  },

  selectorContainer: {
    marginBottom: 12,
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
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
  },
  selectorInputError: {
    borderColor: Colors.danger,
  },
  selectorDisabled: {
    opacity: 0.6,
    backgroundColor: Colors.background,
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

  checkboxSection: {
    marginBottom: 12,
  },
  checkboxLabel: {
    ...Typography.label,
    marginBottom: 6,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  checkboxRow: {
    flexDirection: 'row',
    gap: 16,
  },
  checkboxOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  checkboxOptionActive: {
    backgroundColor: Colors.background,
    borderColor: Colors.primary,
  },
  checkboxOptionText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  gpsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gpsInput: {
    flex: 1,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    padding: 16,
    ...Shadows.card,
    elevation: 8,
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
    borderRadius: 6,
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
  modalCustomAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.primary + '15',
    borderRadius: 10,
  },
  modalCustomAddText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
    marginLeft: 6,
  },
});