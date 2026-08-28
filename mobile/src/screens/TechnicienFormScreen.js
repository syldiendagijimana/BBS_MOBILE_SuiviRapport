// mobile/src/screens/TechnicienFormScreen.js
// Version avec sélecteurs personnalisés (recherche + saisie libre)

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

import { techniciensAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Card } from '../components';
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';

// =========================================================
// CONSTANTES - SPÉCIALITÉS BBS
// =========================================================

const SPECIALITES = [
  { label: 'Fibre optique', value: 'Fibre optique', icon: 'barcode-outline', color: Colors.primary },
  { label: 'Routeur', value: 'Routeur', icon: 'router-outline', color: Colors.secondary },
  { label: 'Switch', value: 'Switch', icon: 'git-network-outline', color: Colors.info },
  { label: 'Réseau mobile', value: 'Réseau mobile', icon: 'phone-portrait-outline', color: Colors.warning },
  { label: 'Antenne satellite', value: 'Antenne satellite', icon: 'satellite-outline', color: Colors.danger },
  { label: 'WiMAX', value: 'WiMAX', icon: 'wifi-outline', color: Colors.accent },
  { label: 'Câble coaxial', value: 'Câble coaxial', icon: 'extension-puzzle-outline', color: Colors.success },
  { label: 'Serveur', value: 'Serveur', icon: 'server-outline', color: '#6C3483' },
  { label: 'Pare-feu', value: 'Pare-feu', icon: 'shield-outline', color: '#2C3E50' },
  { label: 'Modem', value: 'Modem', icon: 'swap-horizontal-outline', color: '#E67E22' },
  { label: 'Amplificateur', value: 'Amplificateur', icon: 'stats-chart-outline', color: '#1ABC9C' },
  { label: 'Autre', value: 'Autre', icon: 'construct-outline', color: Colors.textMuted },
];

const ZONES = [
  { label: 'Zone Nord', value: 'Zone Nord' },
  { label: 'Zone Sud', value: 'Zone Sud' },
  { label: 'Zone Est', value: 'Zone Est' },
  { label: 'Zone Ouest', value: 'Zone Ouest' },
  { label: 'Centre-ville', value: 'Centre-ville' },
  { label: 'Zone Industrielle', value: 'Zone Industrielle' },
  { label: 'Zone Résidentielle', value: 'Zone Résidentielle' },
];

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

  const handleInputChange = (text) => {
    onChange(text);
    // Si le texte est vide, on ferme pas
  };

  const handleFocus = () => {
    setModalVisible(true);
  };

  const getIconName = () => {
    const found = options.find(o => o.value === value);
    return found?.icon || icon || 'construct-outline';
  };

  const getColor = () => {
    if (getOptionColor) return getOptionColor(value);
    const found = options.find(o => o.value === value);
    return found?.color || Colors.textMuted;
  };

  return (
    <View style={styles.selectorContainer}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.selectorInput,
          error && touched && styles.selectorInputError,
        ]}
        onPress={handleFocus}
        activeOpacity={0.7}
      >
        <View style={styles.selectorInputContent}>
          <Ionicons name={getIconName()} size={20} color={value ? getColor() : Colors.textMuted} />
          <Text style={[
            styles.selectorInputText,
            value ? styles.selectorInputTextSelected : styles.selectorInputTextPlaceholder,
          ]}>
            {value || placeholder}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={20} color={Colors.textMuted} />
      </TouchableOpacity>
      {error && touched && <Text style={styles.errorText}>{error}</Text>}

      {/* MODAL DE SÉLECTION */}
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
              keyExtractor={(item) => item.value}
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

export default function TechnicienFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user: currentUser } = useAuth();

  const editTechnicien = route.params?.technicien;
  const isEdit = !!editTechnicien;

  // États du formulaire
  const [nom, setNom] = useState(editTechnicien?.nom || '');
  const [prenom, setPrenom] = useState(editTechnicien?.prenom || '');
  const [email, setEmail] = useState(editTechnicien?.email || '');
  const [telephone, setTelephone] = useState(editTechnicien?.telephone || '');
  const [matricule, setMatricule] = useState(editTechnicien?.matricule || '');
  const [specialite, setSpecialite] = useState(editTechnicien?.specialite || '');
  const [zoneIntervention, setZoneIntervention] = useState(editTechnicien?.zone_intervention || '');
  const [motDePasse, setMotDePasse] = useState('');
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
  // GÉNÉRATION AUTO DU MATRICULE
  // =========================================================

  useEffect(() => {
    if (!isEdit && !matricule) {
      const prefix = 'TECH';
      const year = new Date().getFullYear();
      const random = Math.floor(1000 + Math.random() * 9000);
      setMatricule(`${prefix}-${year}-${random}`);
    }
  }, []);

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
        if (value && !/^[0-9+\s-]{8,}$/.test(value.replace(/\s/g, ''))) {
          return 'Numéro de téléphone invalide';
        }
        return '';
      case 'matricule':
        return !value.trim() ? 'Le matricule est requis' : '';
      case 'specialite':
        return !value.trim() ? 'La spécialité est requise' : '';
      case 'zoneIntervention':
        return !value.trim() ? 'La zone d\'intervention est requise' : '';
      case 'motDePasse':
        if (!isEdit && !value.trim()) return 'Le mot de passe est requis';
        if (value && value.length < 4) return 'Minimum 4 caractères';
        return '';
      default:
        return '';
    }
  }, [isEdit]);

  useEffect(() => {
    const newErrors = {};

    const fields = [
      { key: 'nom', value: nom },
      { key: 'prenom', value: prenom },
      { key: 'email', value: email },
      { key: 'matricule', value: matricule },
      { key: 'specialite', value: specialite },
      { key: 'zoneIntervention', value: zoneIntervention },
    ];

    fields.forEach(field => {
      const error = validateField(field.key, field.value);
      if (error) newErrors[field.key] = error;
    });

    if (telephone) {
      const phoneError = validateField('telephone', telephone);
      if (phoneError) newErrors.telephone = phoneError;
    }

    if (!isEdit || motDePasse) {
      const pwdError = validateField('motDePasse', motDePasse);
      if (pwdError) newErrors.motDePasse = pwdError;
    }

    setErrors(newErrors);
    setFormValid(Object.keys(newErrors).length === 0);
  }, [nom, prenom, email, telephone, matricule, specialite, zoneIntervention, motDePasse, validateField]);

  const handleFieldBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // =========================================================
  // HANDLERS
  // =========================================================

  const handleSave = async () => {
    if (!formValid) {
      setTouched({
        nom: true,
        prenom: true,
        email: true,
        matricule: true,
        specialite: true,
        zoneIntervention: true,
        motDePasse: !isEdit || motDePasse ? true : false,
      });
      Alert.alert('Erreur', 'Veuillez corriger les erreurs dans le formulaire.');
      return;
    }

    setLoading(true);

    try {
      const data = {
        nom: nom.trim(),
        prenom: prenom.trim(),
        email: email.trim().toLowerCase(),
        matricule: matricule.trim(),
        specialite: specialite.trim(),
        zone_intervention: zoneIntervention.trim(),
      };

      if (telephone) data.telephone = telephone.trim();
      if (motDePasse) data.mot_de_passe = motDePasse;

      if (isEdit) {
        await techniciensAPI.update(editTechnicien.id, data);
        Alert.alert('✅ Succès', 'Le technicien a été modifié avec succès', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await techniciensAPI.create(data);
        Alert.alert('✅ Succès', 'Le technicien a été créé avec succès', [
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
      Alert.alert(
        'Annuler',
        'Voulez-vous vraiment quitter sans sauvegarder ?',
        [
          { text: 'Rester', style: 'cancel' },
          { text: 'Quitter', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const isFormDirty = () => {
    if (isEdit) {
      return (
        nom !== (editTechnicien?.nom || '') ||
        prenom !== (editTechnicien?.prenom || '') ||
        email !== (editTechnicien?.email || '') ||
        telephone !== (editTechnicien?.telephone || '') ||
        matricule !== (editTechnicien?.matricule || '') ||
        specialite !== (editTechnicien?.specialite || '') ||
        zoneIntervention !== (editTechnicien?.zone_intervention || '') ||
        motDePasse !== ''
      );
    }
    return (
      nom !== '' ||
      prenom !== '' ||
      email !== '' ||
      telephone !== '' ||
      matricule !== '' ||
      specialite !== '' ||
      zoneIntervention !== '' ||
      motDePasse !== ''
    );
  };

  const getSpecialiteColor = (spec) => {
    const found = SPECIALITES.find(s => s.value === spec);
    return found ? found.color : Colors.textMuted;
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
              {isEdit ? 'Modifier technicien' : 'Nouveau technicien'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isEdit ? 'Modifiez les informations du technicien' : 'Créez un nouveau technicien'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={loading || !formValid}
            style={[
              styles.saveBtn,
              { backgroundColor: 'rgba(255,255,255,0.15)' },
              (!formValid || loading) && styles.saveBtnDisabled,
            ]}
            activeOpacity={0.7}
          >
            <Ionicons
              name={loading ? 'hourglass' : 'checkmark'}
              size={22}
              color={Colors.textWhite}
            />
          </TouchableOpacity>
        </View>
      </GradientHeader>

      {/* INDICATEUR SPÉCIALITÉ */}
      {specialite && (
        <Animated.View
          style={[
            styles.specialiteIndicator,
            {
              backgroundColor: getSpecialiteColor(specialite) + '15',
              borderColor: getSpecialiteColor(specialite) + '30'
            },
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Ionicons
            name={SPECIALITES.find(s => s.value === specialite)?.icon || 'construct-outline'}
            size={20}
            color={getSpecialiteColor(specialite)}
          />
          <Text style={[styles.specialiteIndicatorText, { color: getSpecialiteColor(specialite) }]}>
            {specialite}
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
          {/* Matricule */}
          <Input
            label="Matricule"
            value={matricule}
            onChangeText={(text) => {
              setMatricule(text);
              if (touched.matricule) {
                setErrors({ ...errors, matricule: validateField('matricule', text) || undefined });
              }
            }}
            onBlur={() => handleFieldBlur('matricule')}
            placeholder="TECH-2024-0001"
            leftIcon="id-card-outline"
            error={touched.matricule ? errors.matricule : ''}
          />
          {!isEdit && (
            <Text style={styles.autoGeneratedText}>🔄 Matricule auto-généré</Text>
          )}

          {/* Prénom */}
          <Input
            label="Prénom"
            value={prenom}
            onChangeText={(text) => {
              setPrenom(text);
              if (touched.prenom) {
                setErrors({ ...errors, prenom: validateField('prenom', text) || undefined });
              }
            }}
            onBlur={() => handleFieldBlur('prenom')}
            placeholder="Prénom"
            leftIcon="person-outline"
            error={touched.prenom ? errors.prenom : ''}
          />

          {/* Nom */}
          <Input
            label="Nom"
            value={nom}
            onChangeText={(text) => {
              setNom(text);
              if (touched.nom) {
                setErrors({ ...errors, nom: validateField('nom', text) || undefined });
              }
            }}
            onBlur={() => handleFieldBlur('nom')}
            placeholder="Nom"
            leftIcon="person-outline"
            error={touched.nom ? errors.nom : ''}
          />

          {/* Email */}
          <Input
            label="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (touched.email) {
                setErrors({ ...errors, email: validateField('email', text) || undefined });
              }
            }}
            onBlur={() => handleFieldBlur('email')}
            placeholder="Adresse Email"
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail-outline"
            error={touched.email ? errors.email : ''}
          />

          {/* Téléphone */}
          <Input
            label="Téléphone"
            value={telephone}
            onChangeText={(text) => {
              setTelephone(text);
              if (touched.telephone) {
                setErrors({ ...errors, telephone: validateField('telephone', text) || undefined });
              }
            }}
            onBlur={() => handleFieldBlur('telephone')}
            placeholder="+257 65 351 523"
            keyboardType="phone-pad"
            leftIcon="call-outline"
            error={touched.telephone ? errors.telephone : ''}
          />

          {/* Mot de passe */}
          <Input
            label={isEdit ? "Nouveau mot de passe (laisser vide pour garder)" : "Mot de passe"}
            value={motDePasse}
            onChangeText={(text) => {
              setMotDePasse(text);
              if (touched.motDePasse) {
                setErrors({ ...errors, motDePasse: validateField('motDePasse', text) || undefined });
              }
            }}
            onBlur={() => handleFieldBlur('motDePasse')}
            placeholder={isEdit ? "Laisser vide pour garder actuel" : "Minimum 4 caractères"}
            secureTextEntry={!showPassword}
            leftIcon="lock-closed-outline"
            rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowPassword(!showPassword)}
            error={touched.motDePasse ? errors.motDePasse : ''}
          />

          {/* Spécialité - Sélecteur personnalisé */}
          <SearchableSelector
            label="Spécialité"
            value={specialite}
            onChange={(val) => {
              setSpecialite(val);
              if (touched.specialite) {
                setErrors({ ...errors, specialite: validateField('specialite', val) || undefined });
              }
            }}
            options={SPECIALITES}
            placeholder="Choisir ou taper une spécialité"
            icon="construct-outline"
            error={errors.specialite}
            touched={touched.specialite}
            onBlur={() => handleFieldBlur('specialite')}
            getOptionColor={getSpecialiteColor}
          />

          {/* Zone d'intervention - Sélecteur personnalisé */}
          <SearchableSelector
            label="Zone d'intervention"
            value={zoneIntervention}
            onChange={(val) => {
              setZoneIntervention(val);
              if (touched.zoneIntervention) {
                setErrors({ ...errors, zoneIntervention: validateField('zoneIntervention', val) || undefined });
              }
            }}
            options={ZONES}
            placeholder="Choisir ou taper une zone"
            icon="location-outline"
            error={errors.zoneIntervention}
            touched={touched.zoneIntervention}
            onBlur={() => handleFieldBlur('zoneIntervention')}
          />
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
          <Button
            title="Annuler"
            onPress={handleCancel}
            variant="ghost"
            size="lg"
            fullWidth
          />
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
    paddingHorizontal: Spacing.sm,
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

  specialiteIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: -10,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: Radius.full,
    borderWidth: 1,
    ...Shadows.card,
    elevation: 4,
    backgroundColor: Colors.surface,
  },
  specialiteIndicatorText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 20,
  },

  formCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },

  autoGeneratedText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: -8,
    marginBottom: 8,
    marginLeft: 4,
  },

  errorText: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 4,
    marginBottom: 4,
    marginLeft: 4,
  },

  // Styles pour le sélecteur personnalisé
  selectorContainer: {
    marginBottom: Spacing.md,
  },
  label: {
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

  // MODAL
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
  modalCustomAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.primary + '15',
    borderRadius: Radius.md,
  },
  modalCustomAddText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
    marginLeft: 6,
  },

  buttonsContainer: {
    marginTop: Spacing.sm,
  },
  submitBtn: {
    marginBottom: Spacing.sm,
  },
  footerSpace: {
    height: 20,
  },
});