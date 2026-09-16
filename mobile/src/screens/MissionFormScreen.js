// mobile/src/screens/MissionFormScreen.js
// Version avec sélection d'un UTILISATEUR unique (admin, DJ, superviseur, technicien)

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
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';
import DateTimePicker from '@react-native-community/datetimepicker';

import { missionsAPI, fetchAllUsers } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Card } from '../components';
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';

// =========================================================
// CONSTANTES
// =========================================================

const TYPES_MISSION = [
  { label: 'Installation', value: 'installation', icon: 'cube-outline' },
  { label: 'Maintenance', value: 'maintenance', icon: 'construct-outline' },
  { label: 'Réparation', value: 'reparation', icon: 'hammer-outline' },
  { label: 'Inspection', value: 'inspection', icon: 'eye-outline' },
  { label: 'Urgence', value: 'urgence', icon: 'alert-circle-outline' },
];

const PRIORITES = [
  { label: 'Basse', value: 'basse', icon: 'chevron-down-circle-outline', color: Colors.success },
  { label: 'Moyenne', value: 'moyenne', icon: 'radio-button-off-outline', color: Colors.warning },
  { label: 'Haute', value: 'haute', icon: 'chevron-up-circle-outline', color: Colors.danger },
  { label: 'Critique', value: 'critique', icon: 'warning-outline', color: Colors.danger },
];

const STATUTS = [
  { label: 'Planifiée', value: 'planifiee', icon: 'calendar-outline' },
  { label: 'En cours', value: 'en_cours', icon: 'time-outline' },
  { label: 'Terminée', value: 'terminee', icon: 'checkmark-circle-outline' },
  { label: 'Annulée', value: 'annulee', icon: 'close-circle-outline' },
];

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
        activeOpacity={0.7}
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
                    <View style={{ flex: 1 }}>
                      <Text style={[
                        styles.modalListItemText,
                        value === item.value && { color: item.color || Colors.primary, fontWeight: '600' },
                      ]}>
                        {item.label}
                      </Text>
                      {item.subtitle && (
                        <Text style={styles.modalListItemSubtitle}>{item.subtitle}</Text>
                      )}
                    </View>
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
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function MissionFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, isSuperviseur, isAdmin, isDJ } = useAuth();

  const editMission = route.params?.mission;
  const isEdit = !!editMission;

  useEffect(() => {
    if (!isSuperviseur && !isAdmin && !isDJ) {
      Alert.alert('Accès refusé', 'Vous n\'avez pas les droits nécessaires.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    }
  }, [isSuperviseur, isAdmin, isDJ, navigation]);

  const [titre, setTitre] = useState(editMission?.titre || '');
  const [description, setDescription] = useState(editMission?.description || '');
  const [typeMission, setTypeMission] = useState(editMission?.type_mission || '');
  const [priorite, setPriorite] = useState(editMission?.priorite || 'moyenne');
  const [statut, setStatut] = useState(editMission?.statut || 'planifiee');
  const [adresse, setAdresse] = useState(editMission?.adresse || '');
  const [latitude, setLatitude] = useState(editMission?.latitude ? String(editMission.latitude) : '');
  const [longitude, setLongitude] = useState(editMission?.longitude ? String(editMission.longitude) : '');
  const [notes, setNotes] = useState(editMission?.notes || '');
  const [dateDebut, setDateDebut] = useState(editMission?.date_debut ? new Date(editMission.date_debut) : new Date());
  const [dateFinPrevue, setDateFinPrevue] = useState(
    editMission?.date_fin_prevue ? new Date(editMission.date_fin_prevue) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  );
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [formValid, setFormValid] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateMode, setDateMode] = useState('debut');

  // 🎯 SÉLECTION DE L'UTILISATEUR (au lieu de superviseur + technicien)
  const [selectedUserId, setSelectedUserId] = useState(
    editMission?.user_id || editMission?.technicien_id || editMission?.superviseur_id || null
  );
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Références
  const isMounted = useRef(true);
  const timerRef = useRef(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // =========================================================
  // CHARGEMENT DES UTILISATEURS
  // =========================================================

  useEffect(() => {
    const load = async () => {
      setLoadingUsers(true);
      try {
        // 🎯 Charger TOUS les utilisateurs
        const usersList = await fetchAllUsers().catch(() => []);
        setAllUsers(usersList || []);
        console.log('✅ Utilisateurs chargés:', usersList?.length);
      } catch (error) {
        console.error('❌ Erreur chargement utilisateurs:', error);
        setAllUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();

    return () => {
      isMounted.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // =========================================================
  // VALIDATION
  // =========================================================

  const validateField = useCallback((field, value) => {
    switch (field) {
      case 'titre': return !value.trim() ? 'Le titre est requis' : '';
      case 'typeMission': return !value ? 'Le type de mission est requis' : '';
      case 'priorite': return !value ? 'La priorité est requise' : '';
      case 'statut': return isEdit && !value ? 'Le statut est requis' : '';
      case 'adresse': return !value.trim() ? "L'adresse est requise" : '';
      default: return '';
    }
  }, [isEdit]);

  useEffect(() => {
    const newErrors = {};
    ['titre', 'typeMission', 'priorite', 'adresse'].forEach(field => {
      const val = field === 'typeMission' ? typeMission : field === 'priorite' ? priorite : field === 'adresse' ? adresse : titre;
      const error = validateField(field, val);
      if (error) newErrors[field] = error;
    });
    if (isEdit) {
      const statutErr = validateField('statut', statut);
      if (statutErr) newErrors.statut = statutErr;
    }
    if (!dateDebut) newErrors.dateDebut = 'La date de début est requise';
    setErrors(newErrors);
    setFormValid(Object.keys(newErrors).length === 0 && !!selectedUserId);
  }, [titre, typeMission, priorite, adresse, statut, dateDebut, isEdit, selectedUserId, validateField]);

  const handleFieldBlur = useCallback((field) => setTouched(prev => ({ ...prev, [field]: true })), []);

  // =========================================================
  // HANDLERS
  // =========================================================

  const handleSave = async () => {
    if (!formValid) {
      setTouched({
        titre: true,
        typeMission: true,
        priorite: true,
        adresse: true,
        dateDebut: true,
        ...(isEdit && { statut: true }),
      });
      Alert.alert('Erreur', 'Veuillez corriger les erreurs dans le formulaire.');
      return;
    }

    if (!selectedUserId) {
      Alert.alert('Erreur', 'Veuillez sélectionner un utilisateur');
      return;
    }

    setLoading(true);
    try {
      const data = {
        titre: titre.trim(),
        description: description.trim() || null,
        type_mission: typeMission,
        priorite,
        adresse: adresse.trim(),
        date_debut: dateDebut.toISOString(),
        date_fin_prevue: dateFinPrevue.toISOString(),
        notes: notes.trim() || null,
      };
      if (isEdit) data.statut = statut;
      if (latitude) data.latitude = parseFloat(latitude);
      if (longitude) data.longitude = parseFloat(longitude);

      // 🎯 Envoyer user_id
      data.user_id = Number(selectedUserId);

      console.log('📦 Envoi de la mission - userId:', selectedUserId);

      if (isEdit) {
        await missionsAPI.update(editMission.id, data);
        Alert.alert('✅ Succès', 'Mission modifiée', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else {
        await missionsAPI.create(data);
        Alert.alert('✅ Succès', 'Mission créée', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch (error) {
      console.error('❌ Erreur sauvegarde:', error);
      Alert.alert('❌ Erreur', error.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
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
      const originalUserId = editMission?.user_id || editMission?.technicien_id || editMission?.superviseur_id || null;
      return titre !== (editMission?.titre || '') ||
        description !== (editMission?.description || '') ||
        typeMission !== (editMission?.type_mission || '') ||
        priorite !== (editMission?.priorite || 'moyenne') ||
        statut !== (editMission?.statut || 'planifiee') ||
        selectedUserId !== originalUserId ||
        adresse !== (editMission?.adresse || '') ||
        notes !== (editMission?.notes || '') ||
        dateDebut.getTime() !== new Date(editMission.date_debut).getTime() ||
        dateFinPrevue.getTime() !== new Date(editMission.date_fin_prevue || Date.now() + 7 * 24 * 60 * 60 * 1000).getTime();
    }
    return titre !== '' || description !== '' || typeMission !== '' || adresse !== '' || notes !== '' || selectedUserId !== null;
  };

  const openDatePicker = (mode) => {
    setDateMode(mode);
    setShowDatePicker(true);
  };

  const handleDateChange = useCallback((event, selectedDate) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (isMounted.current) setShowDatePicker(false);
    }, 0);

    if (!event) {
      if (selectedDate && isMounted.current) {
        if (dateMode === 'debut') setDateDebut(selectedDate);
        else setDateFinPrevue(selectedDate);
      }
      return;
    }

    if (event.type === 'dismissed') return;

    if (selectedDate && isMounted.current) {
      if (dateMode === 'debut') setDateDebut(selectedDate);
      else setDateFinPrevue(selectedDate);
    }
  }, [dateMode]);

  // 🎯 Options utilisateurs avec badge de rôle
  const userOptions = allUsers.map(u => {
    const roleConf = getRoleConfig(u.role);
    return {
      label: `${u.prenom} ${u.nom}`,
      subtitle: `${roleConf.label}${u.email ? ' • ' + u.email : ''}`,
      value: u.id,
      icon: roleConf.icon,
      color: roleConf.color,
      role: (u.role || '').toLowerCase(),
    };
  });

  const getUserColor = (value) => {
    const found = userOptions.find(o => o.value === value);
    return found?.color || Colors.textMuted;
  };

  const getPrioriteColor = (prio) => {
    const found = PRIORITES.find(p => p.value === prio);
    return found?.color || Colors.textMuted;
  };

  // =========================================================
  // RENDU
  // =========================================================

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      <GradientHeader colors={[Colors.primary, Colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={handleCancel} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{isEdit ? 'Modifier la mission' : 'Nouvelle mission'}</Text>
            <Text style={styles.headerSubtitle}>{isEdit ? 'Modifiez les informations' : 'Créez une nouvelle mission'}</Text>
          </View>
          <TouchableOpacity onPress={handleSave} disabled={loading || !formValid} style={[styles.saveBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }, (!formValid || loading) && styles.saveBtnDisabled]} activeOpacity={0.7}>
            <Ionicons name={loading ? 'hourglass' : 'checkmark'} size={22} color={Colors.textWhite} />
          </TouchableOpacity>
        </View>
      </GradientHeader>

      <Animated.ScrollView style={[styles.scroll, { opacity: fadeAnim }]} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card style={styles.formCard}>
          <Input label="Titre de la mission" value={titre} onChangeText={setTitre} onBlur={() => handleFieldBlur('titre')} placeholder="Installation fibre optique" leftIcon="book-outline" error={touched.titre ? errors.titre : ''} />
          <Input label="Description" value={description} onChangeText={setDescription} placeholder="Détails de la mission..." multiline numberOfLines={4} leftIcon="document-text-outline" />

          <SearchableSelector
            label="Type de mission"
            value={typeMission}
            onChange={setTypeMission}
            options={TYPES_MISSION}
            placeholder="Sélectionner un type"
            error={errors.typeMission}
            touched={touched.typeMission}
            onBlur={() => handleFieldBlur('typeMission')}
          />

          <SearchableSelector
            label="Priorité"
            value={priorite}
            onChange={setPriorite}
            options={PRIORITES}
            placeholder="Sélectionner une priorité"
            error={errors.priorite}
            touched={touched.priorite}
            onBlur={() => handleFieldBlur('priorite')}
            getOptionColor={getPrioriteColor}
          />

          {isEdit && (
            <SearchableSelector
              label="Statut"
              value={statut}
              onChange={setStatut}
              options={STATUTS}
              placeholder="Sélectionner un statut"
              error={errors.statut}
              touched={touched.statut}
              onBlur={() => handleFieldBlur('statut')}
            />
          )}

          {/* 🎯 SÉLECTION DE L'UTILISATEUR (au lieu de superviseur + technicien) */}
          <SearchableSelector
            label="Utilisateur concerné"
            value={selectedUserId}
            onChange={setSelectedUserId}
            options={userOptions}
            placeholder={loadingUsers ? 'Chargement...' : 'Sélectionner un utilisateur'}
            error={errors.selectedUserId}
            touched={touched.selectedUserId}
            onBlur={() => handleFieldBlur('selectedUserId')}
            getOptionColor={getUserColor}
            disabled={loadingUsers}
          />

          {loadingUsers && (
            <View style={styles.loadingUsersRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingUsersText}>Chargement des utilisateurs...</Text>
            </View>
          )}

          <View style={styles.dateRow}>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>Date de début</Text>
              <TouchableOpacity style={styles.datePicker} onPress={() => openDatePicker('debut')}>
                <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                <Text style={styles.datePickerText}>{dateDebut.toLocaleDateString('fr-FR')}</Text>
              </TouchableOpacity>
              {touched.dateDebut && errors.dateDebut ? <Text style={styles.errorText}>{errors.dateDebut}</Text> : null}
            </View>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>Date de fin prévue</Text>
              <TouchableOpacity style={styles.datePicker} onPress={() => openDatePicker('fin')}>
                <Ionicons name="calendar-outline" size={20} color={Colors.textMuted} />
                <Text style={styles.datePickerText}>{dateFinPrevue.toLocaleDateString('fr-FR')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Input label="Adresse" value={adresse} onChangeText={setAdresse} onBlur={() => handleFieldBlur('adresse')} placeholder="123 Rue principale, Bujumbura" leftIcon="location-outline" error={touched.adresse ? errors.adresse : ''} />
          <View style={styles.gpsRow}>
            <Input label="Latitude" value={latitude} onChangeText={setLatitude} placeholder="-3.3822" keyboardType="numeric" containerStyle={styles.gpsInput} />
            <Input label="Longitude" value={longitude} onChangeText={setLongitude} placeholder="29.3644" keyboardType="numeric" containerStyle={styles.gpsInput} />
          </View>
          <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Informations supplémentaires..." multiline numberOfLines={3} leftIcon="clipboard-outline" />
        </Card>

        <View style={styles.buttonsContainer}>
          <Button title={loading ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer'} onPress={handleSave} loading={loading} disabled={!formValid} size="lg" fullWidth icon={isEdit ? 'refresh-outline' : 'add-outline'} style={styles.submitBtn} />
          <Button title="Annuler" onPress={handleCancel} variant="ghost" size="lg" fullWidth />
        </View>
        <View style={styles.footerSpace} />
      </Animated.ScrollView>

      {showDatePicker && (
        <DateTimePicker
          key={`picker-${dateMode}-${Date.now()}`}
          value={dateMode === 'debut' ? dateDebut : dateFinPrevue}
          mode="datetime"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
        />
      )}
    </KeyboardAvoidingView>
  );
}

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
  headerTitle: { color: Colors.textWhite, fontSize: 17, fontWeight: '700' },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  saveBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: 20 },
  formCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  errorText: { fontSize: 12, color: Colors.danger, marginTop: 4, marginBottom: 4, marginLeft: 4 },
  loadingUsersRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: -8, marginBottom: Spacing.md, paddingLeft: 4,
  },
  loadingUsersText: { fontSize: 12, color: Colors.textMuted },
  selectorContainer: { marginBottom: Spacing.md },
  selectorLabel: {
    ...Typography.label,
    marginBottom: 6, color: Colors.textPrimary, fontWeight: '500',
  },
  selectorInput: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 12, backgroundColor: Colors.surface,
  },
  selectorInputError: { borderColor: Colors.danger },
  selectorDisabled: { opacity: 0.6 },
  selectorInputContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  selectorInputText: { fontSize: 14, marginLeft: 8 },
  selectorInputTextSelected: { color: Colors.textPrimary },
  selectorInputTextPlaceholder: { color: Colors.textMuted },
  dateRow: { flexDirection: 'row', gap: 12, marginBottom: Spacing.md },
  dateItem: { flex: 1 },
  dateLabel: {
    ...Typography.label,
    marginBottom: 6, color: Colors.textPrimary, fontWeight: '500',
  },
  datePicker: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    padding: 12, backgroundColor: Colors.surface, gap: 8,
  },
  datePickerText: { fontSize: 14, color: Colors.textPrimary },
  gpsRow: { flexDirection: 'row', gap: 12 },
  gpsInput: { flex: 1 },
  buttonsContainer: { marginTop: Spacing.sm },
  submitBtn: { marginBottom: Spacing.sm },
  footerSpace: { height: 20 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    width: '90%', maxHeight: '80%', padding: Spacing.md,
    ...Shadows.card, elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  searchInputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background, borderRadius: Radius.md,
    paddingHorizontal: 10, marginVertical: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: {
    flex: 1, paddingVertical: 8, paddingHorizontal: 8,
    fontSize: 14, color: Colors.textPrimary,
  },
  modalList: { paddingBottom: 20 },
  modalListItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  modalListItemSelected: { backgroundColor: Colors.primary + '10', borderRadius: Radius.sm },
  modalListItemContent: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  modalListItemText: { fontSize: 15, color: Colors.textPrimary },
  modalListItemSubtitle: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  modalEmpty: { padding: 20, alignItems: 'center' },
  modalEmptyText: { fontSize: 14, color: Colors.textMuted },
});