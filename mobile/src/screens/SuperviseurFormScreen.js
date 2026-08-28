// mobile/src/screens/SuperviseurFormScreen.js
// Version avec SearchableSelector – 3 niveaux d'expérience

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

import { superviseursAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Card } from '../components';
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';

// =========================================================
// CONSTANTES
// =========================================================

// ✅ Trois niveaux d'expérience uniquement
const NIVEAUX_EXPERIENCE = [
  { label: 'Débutant (1)', value: 1, icon: 'star-outline', color: Colors.textMuted },
  { label: 'Intermédiaire (3)', value: 3, icon: 'star', color: Colors.primary },
  { label: 'Expert (5)', value: 5, icon: 'star', color: Colors.danger },
];

const ZONES_RESPONSABLES = [
  { label: 'Zone Nord', value: 'Zone Nord', icon: 'location-outline' },
  { label: 'Zone Sud', value: 'Zone Sud', icon: 'location-outline' },
  { label: 'Zone Est', value: 'Zone Est', icon: 'location-outline' },
  { label: 'Zone Ouest', value: 'Zone Ouest', icon: 'location-outline' },
  { label: 'Centre-ville', value: 'Centre-ville', icon: 'location-outline' },
  { label: 'Zone Industrielle', value: 'Zone Industrielle', icon: 'location-outline' },
  { label: 'Zone Résidentielle', value: 'Zone Résidentielle', icon: 'location-outline' },
];

const NIVEAU_COLORS = {
  1: Colors.textMuted,
  3: Colors.primary,
  5: Colors.danger,
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

  const getLabel = () => {
    const found = options.find(o => o.value === value);
    return found?.label || placeholder || 'Sélectionner...';
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
            {getLabel()}
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
                placeholderTextColor={Colors.textMuted}
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
                </View>
              )}
            />
            <Button title="Annuler" variant="ghost" onPress={() => setModalVisible(false)} fullWidth />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function SuperviseurFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user: currentUser } = useAuth();

  const editSuperviseur = route.params?.superviseur;
  const isEdit = !!editSuperviseur;

  // États du formulaire
  const [nom, setNom] = useState(editSuperviseur?.nom || '');
  const [prenom, setPrenom] = useState(editSuperviseur?.prenom || '');
  const [email, setEmail] = useState(editSuperviseur?.email || '');
  const [telephone, setTelephone] = useState(editSuperviseur?.telephone || '');
  const [telephonePro, setTelephonePro] = useState(editSuperviseur?.telephone_pro || '');
  const [motDePasse, setMotDePasse] = useState('');
  const [zoneResponsable, setZoneResponsable] = useState(editSuperviseur?.zone_responsable || '');
  const [niveauExperience, setNiveauExperience] = useState(editSuperviseur?.niveau_experience || 1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({});
  const [formValid, setFormValid] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // =========================================================
  // ANIMATIONS
  // =========================================================

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
    ]).start();
  }, []);

  // =========================================================
  // VALIDATION
  // =========================================================

  const validateField = useCallback((field, value) => {
    switch (field) {
      case 'nom':
        return !value.trim() ? 'Le nom est requis' : '';
      case 'prenom':
        return !value.trim() ? 'Le prénom est requis' : '';
      case 'email':
        if (!value.trim()) return 'L\'email est requis';
        if (!/\S+@\S+\.\S+/.test(value)) return 'Email invalide';
        return '';
      case 'telephone':
        if (value && !/^[0-9+\s-]{8,}$/.test(value.replace(/\s/g, ''))) return 'Numéro invalide';
        return '';
      case 'telephonePro':
        if (value && !/^[0-9+\s-]{8,}$/.test(value.replace(/\s/g, ''))) return 'Numéro invalide';
        return '';
      case 'motDePasse':
        if (!isEdit && !value.trim()) return 'Le mot de passe est requis';
        if (value && value.length < 4) return 'Minimum 4 caractères';
        return '';
      case 'zoneResponsable':
        return !value.trim() ? 'La zone responsable est requise' : '';
      default:
        return '';
    }
  }, [isEdit]);

  // Validation continue
  useEffect(() => {
    const newErrors = {};
    const fields = [
      { key: 'nom', value: nom },
      { key: 'prenom', value: prenom },
      { key: 'email', value: email },
      { key: 'zoneResponsable', value: zoneResponsable },
    ];
    fields.forEach(f => {
      const error = validateField(f.key, f.value);
      if (error) newErrors[f.key] = error;
    });
    if (telephone) {
      const phoneErr = validateField('telephone', telephone);
      if (phoneErr) newErrors.telephone = phoneErr;
    }
    if (telephonePro) {
      const phoneProErr = validateField('telephonePro', telephonePro);
      if (phoneProErr) newErrors.telephonePro = phoneProErr;
    }
    if (!isEdit || motDePasse) {
      const pwdErr = validateField('motDePasse', motDePasse);
      if (pwdErr) newErrors.motDePasse = pwdErr;
    }
    setErrors(newErrors);
    setFormValid(Object.keys(newErrors).length === 0);
  }, [nom, prenom, email, telephone, telephonePro, motDePasse, zoneResponsable, validateField]);

  const handleFieldBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // =========================================================
  // HANDLERS
  // =========================================================

  const handleSave = async () => {
    if (!formValid) {
      setTouched({ nom: true, prenom: true, email: true, zoneResponsable: true, motDePasse: !isEdit || motDePasse ? true : false });
      return;
    }
    setLoading(true);
    try {
      const data = {
        nom: nom.trim(),
        prenom: prenom.trim(),
        email: email.trim().toLowerCase(),
        zone_responsable: zoneResponsable.trim(),
        niveau_experience: niveauExperience,
      };
      if (telephone) data.telephone = telephone.trim();
      if (telephonePro) data.telephone_pro = telephonePro.trim();
      if (motDePasse) data.mot_de_passe = motDePasse;

      if (isEdit) {
        await superviseursAPI.update(editSuperviseur.id, data);
        Alert.alert('✅ Succès', 'Superviseur modifié', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else {
        await superviseursAPI.create(data);
        Alert.alert('✅ Succès', 'Superviseur créé', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch (error) {
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
      return (
        nom !== (editSuperviseur?.nom || '') ||
        prenom !== (editSuperviseur?.prenom || '') ||
        email !== (editSuperviseur?.email || '') ||
        telephone !== (editSuperviseur?.telephone || '') ||
        telephonePro !== (editSuperviseur?.telephone_pro || '') ||
        zoneResponsable !== (editSuperviseur?.zone_responsable || '') ||
        niveauExperience !== (editSuperviseur?.niveau_experience || 1) ||
        motDePasse !== ''
      );
    }
    return nom !== '' || prenom !== '' || email !== '' || telephone !== '' || telephonePro !== '' || motDePasse !== '' || zoneResponsable !== '';
  };

  const getNiveauColor = (niveau) => NIVEAU_COLORS[niveau] || Colors.primary;
  const getNiveauLabel = (niveau) => NIVEAUX_EXPERIENCE.find(n => n.value === niveau)?.label || `Niveau ${niveau}`;

  // =========================================================
  // RENDU
  // =========================================================

  const niveauColor = getNiveauColor(niveauExperience);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      <GradientHeader colors={[Colors.primary, Colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={handleCancel} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{isEdit ? 'Modifier superviseur' : 'Nouveau superviseur'}</Text>
            <Text style={styles.headerSubtitle}>{isEdit ? 'Modifiez les informations' : 'Créez un nouveau superviseur'}</Text>
          </View>

          <TouchableOpacity onPress={handleSave} disabled={loading || !formValid} style={[styles.saveBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }, (!formValid || loading) && styles.saveBtnDisabled]} activeOpacity={0.7}>
            <Ionicons name={loading ? 'hourglass' : 'checkmark'} size={22} color={Colors.textWhite} />
          </TouchableOpacity>
        </View>
      </GradientHeader>

      <Animated.View style={[styles.niveauIndicator, { backgroundColor: niveauColor + '15', borderColor: niveauColor + '30' }, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Ionicons name={NIVEAUX_EXPERIENCE.find(n => n.value === niveauExperience)?.icon || 'star'} size={20} color={niveauColor} />
        <Text style={[styles.niveauIndicatorText, { color: niveauColor }]}>{getNiveauLabel(niveauExperience)}</Text>
      </Animated.View>

      <Animated.ScrollView style={[styles.scroll, { opacity: fadeAnim }]} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card style={styles.formCard}>
          <Input label="Prénom" value={prenom}
          onChangeText={setPrenom} onBlur={() => handleFieldBlur('prenom')}
          placeholder="prénom"
          leftIcon="person-outline"
          error={touched.prenom ? errors.prenom : ''} />

          <Input label="Nom"
          value={nom} onChangeText={setNom}
          onBlur={() => handleFieldBlur('nom')}
          placeholder="nom" leftIcon="person-outline"
          error={touched.nom ? errors.nom : ''}  />

          <Input label="Email"
          value={email} onChangeText={setEmail}
          onBlur={() => handleFieldBlur('email')}
          placeholder="Adresse Email" keyboardType="email-address"
          autoCapitalize="none" leftIcon="mail-outline"
          error={touched.email ? errors.email : ''}  />

          <Input label="Téléphone personnel"
          value={telephone} onChangeText={setTelephone} onBlur={() =>
          handleFieldBlur('telephone')}
          placeholder="+257 65 351 523"
          keyboardType="phone-pad" leftIcon="call-outline"
          error={touched.telephone ? errors.telephone : ''} />

          <Input label="Téléphone professionnel"
          value={telephonePro}
          onChangeText={setTelephonePro} onBlur={() =>
          handleFieldBlur('telephonePro')}
          placeholder="+257 65 351 524"
          keyboardType="phone-pad" leftIcon="business-outline"
          error={touched.telephonePro ? errors.telephonePro : ''} />

          <Input label={isEdit ? "Nouveau mot de passe" : "Mot de passe"}
          value={motDePasse} onChangeText={setMotDePasse}
          onBlur={() => handleFieldBlur('motDePasse')}
          placeholder={isEdit ? "Laisser vide pour garder" : "Minimum 4 caractères"}
          secureTextEntry={!showPassword} leftIcon="lock-closed-outline"
          rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
          onRightIconPress={() => setShowPassword(!showPassword)}
          error={touched.motDePasse ? errors.motDePasse : ''}/>

          {/* Zone responsable - SearchableSelector */}
          <SearchableSelector
            label="Zone responsable"
            value={zoneResponsable}
            onChange={setZoneResponsable}
            options={ZONES_RESPONSABLES}
            placeholder="Sélectionner une zone"
            error={errors.zoneResponsable}
            touched={touched.zoneResponsable}
            onBlur={() => handleFieldBlur('zoneResponsable')}
            icon="location-outline"
          />

          {/* Niveau d'expérience - SearchableSelector (3 options) */}
          <SearchableSelector
            label="Niveau d'expérience"
            value={niveauExperience}
            onChange={setNiveauExperience}
            options={NIVEAUX_EXPERIENCE}
            placeholder="Sélectionner un niveau"
            error={errors.niveauExperience}
            touched={touched.niveauExperience}
            onBlur={() => handleFieldBlur('niveauExperience')}
            getOptionColor={(val) => NIVEAU_COLORS[val] || Colors.primary}
          />

        </Card>

        <View style={styles.buttonsContainer}>
          <Button title={loading ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer'} onPress={handleSave} loading={loading} disabled={!formValid} size="lg" fullWidth icon={isEdit ? 'refresh-outline' : 'add-outline'} style={styles.submitBtn} />
          <Button title="Annuler" onPress={handleCancel} variant="ghost" size="lg" fullWidth />
        </View>
        <View style={styles.footerSpace} />
      </Animated.ScrollView>
    </KeyboardAvoidingView>
  );
}

// =========================================================
// STYLES (avec ajouts pour SearchableSelector)
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
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.sm },
  headerTitle: { color: Colors.textWhite, fontSize: 17, fontWeight: '700' },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  saveBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  niveauIndicator: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center',
    marginTop: -10, paddingVertical: 6, paddingHorizontal: 16,
    borderRadius: Radius.full, borderWidth: 1,
    ...Shadows.card, elevation: 4, backgroundColor: Colors.surface,
  },
  niveauIndicatorText: { fontSize: 13, fontWeight: '600', marginLeft: 6 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: 20 },
  formCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  errorText: { fontSize: 12, color: Colors.danger, marginTop: 4, marginBottom: 4, marginLeft: 4 },
  buttonsContainer: { marginTop: Spacing.sm },
  submitBtn: { marginBottom: Spacing.sm },
  footerSpace: { height: 20 },

  // Styles pour SearchableSelector
  selectorContainer: {
    marginBottom: Spacing.md,
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
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
  },
  selectorInputError: {
    borderColor: Colors.danger,
  },
  selectorDisabled: {
    opacity: 0.6,
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

  // Styles pour la modale
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    width: '90%',
    maxHeight: '80%',
    padding: Spacing.md,
    ...Shadows.card,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.md,
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
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    marginVertical: Spacing.md,
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
    borderRadius: Radius.sm,
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
});