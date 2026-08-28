// mobile/src/screens/UserFormScreen.js
// Version finale – sans astérisques sur les champs obligatoires

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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';

import { usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Selector, Card } from '../components';
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';

// =========================================================
// CONSTANTES
// =========================================================

const ROLES = [
  { label: 'Admin', value: 'admin', icon: 'shield-checkmark', color: Colors.danger },
  { label: 'DJ', value: 'dj', icon: 'star', color: Colors.secondary },
  { label: 'Superviseur', value: 'superviseur', icon: 'briefcase', color: Colors.primary },
  { label: 'Technicien', value: 'technicien', icon: 'construct', color: Colors.warning },
];

const ROLE_COLORS = {
  admin: Colors.danger,
  dj: Colors.secondary,
  superviseur: Colors.primary,
  technicien: Colors.warning,
};

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function UserFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user: currentUser } = useAuth();

  const editUser = route.params?.user;
  const isEdit = !!editUser;

  // États du formulaire
  const [nom, setNom] = useState(editUser?.nom || '');
  const [prenom, setPrenom] = useState(editUser?.prenom || '');
  const [email, setEmail] = useState(editUser?.email || '');
  const [telephone, setTelephone] = useState(editUser?.telephone || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(editUser?.role || 'technicien');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({});

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // =========================================================
  // ANIMATIONS
  // =========================================================

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // =========================================================
  // VALIDATION
  // =========================================================

  const validateField = (field, value) => {
    switch (field) {
      case 'nom':
        return !value?.trim() ? 'Le nom est requis' : '';
      case 'prenom':
        return !value?.trim() ? 'Le prénom est requis' : '';
      case 'email':
        if (!value?.trim()) return "L'email est requis";
        if (!/\S+@\S+\.\S+/.test(value)) return 'Email invalide';
        return '';
      case 'telephone':
        if (value && !/^[0-9+\s-]{8,}$/.test(value.replace(/\s/g, ''))) {
          return 'Numéro de téléphone invalide';
        }
        return '';
      case 'password':
        if (!isEdit && !value?.trim()) return 'Le mot de passe est requis';
        if (value && value.length < 4) return 'Minimum 4 caractères';
        return '';
      default:
        return '';
    }
  };

  const validateForm = () => {
    const newErrors = {};

    const nomError = validateField('nom', nom);
    if (nomError) newErrors.nom = nomError;

    const prenomError = validateField('prenom', prenom);
    if (prenomError) newErrors.prenom = prenomError;

    const emailError = validateField('email', email);
    if (emailError) newErrors.email = emailError;

    const passwordError = validateField('password', password);
    if (passwordError) newErrors.password = passwordError;

    const telephoneError = validateField('telephone', telephone);
    if (telephoneError) newErrors.telephone = telephoneError;

    return newErrors;
  };

  const errorsObj = validateForm();
  const isFormValid = Object.keys(errorsObj).length === 0;

  const handleFieldBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));

    let value = '';
    let error = '';

    switch (field) {
      case 'nom':
        value = nom;
        error = validateField('nom', value);
        break;
      case 'prenom':
        value = prenom;
        error = validateField('prenom', value);
        break;
      case 'email':
        value = email;
        error = validateField('email', value);
        break;
      case 'password':
        value = password;
        error = validateField('password', value);
        break;
      case 'telephone':
        value = telephone;
        error = validateField('telephone', value);
        break;
      default:
        break;
    }

    if (error) {
      setErrors(prev => ({ ...prev, [field]: error }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // =========================================================
  // HANDLERS
  // =========================================================

  const handleSave = async () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setTouched({ nom: true, prenom: true, email: true, password: true, telephone: true });
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    setLoading(true);

    try {
      const data = {
        nom: nom.trim(),
        prenom: prenom.trim(),
        email: email.trim().toLowerCase(),
        role,
      };

      if (telephone) data.telephone = telephone.trim();
      if (password) data.mot_de_passe = password;

      if (isEdit) {
        await usersAPI.update(editUser.id, data);
        Alert.alert(
          '✅ Succès',
          "L'utilisateur a été modifié avec succès",
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        await usersAPI.create(data);
        Alert.alert(
          '✅ Succès',
          "L'utilisateur a été créé avec succès",
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      console.error('❌ Erreur sauvegarde:', error);
      Alert.alert(
        '❌ Erreur',
        error.message || 'Une erreur est survenue lors de la sauvegarde'
      );
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
        nom !== editUser.nom ||
        prenom !== editUser.prenom ||
        email !== editUser.email ||
        telephone !== editUser.telephone ||
        role !== editUser.role ||
        password !== ''
      );
    }
    return (
      nom !== '' ||
      prenom !== '' ||
      email !== '' ||
      telephone !== '' ||
      password !== ''
    );
  };

  const getRoleColor = (roleValue) => {
    return ROLE_COLORS[roleValue] || Colors.primary;
  };

  // =========================================================
  // RENDU
  // =========================================================

  const selectedRoleColor = getRoleColor(role);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* HEADER */}
      <GradientHeader style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={handleCancel}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {isEdit ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isEdit ? 'Modifiez les informations' : 'Créez un nouvel utilisateur'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={loading || !isFormValid}
            style={[
              styles.saveBtn,
              { backgroundColor: 'rgba(255,255,255,0.15)' },
              (!isFormValid || loading) && styles.saveBtnDisabled,
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

      {/* INDICATEUR DE RÔLE */}
      <Animated.View
        style={[
          styles.roleIndicator,
          { backgroundColor: selectedRoleColor + '15', borderColor: selectedRoleColor + '30' },
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Ionicons
          name={ROLES.find(r => r.value === role)?.icon || 'person'}
          size={20}
          color={selectedRoleColor}
        />
        <Text style={[styles.roleIndicatorText, { color: selectedRoleColor }]}>
          {ROLES.find(r => r.value === role)?.label || role}
        </Text>
      </Animated.View>

      {/* FORMULAIRE */}
      <Animated.ScrollView
        style={[styles.scroll, { opacity: fadeAnim }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.formCard}>
          {/* Prénom – pas de required */}
          <Input
            label="Prénom"
            value={prenom}
            onChangeText={(text) => {
              setPrenom(text);
              if (touched.prenom) {
                const error = validateField('prenom', text);
                setErrors(prev => ({ ...prev, prenom: error || '' }));
              }
            }}
            onBlur={() => handleFieldBlur('prenom')}
            placeholder="Prénom"
            leftIcon="person-outline"
            error={errors.prenom}
          />

          {/* Nom – pas de required */}
          <Input
            label="Nom"
            value={nom}
            onChangeText={(text) => {
              setNom(text);
              if (touched.nom) {
                const error = validateField('nom', text);
                setErrors(prev => ({ ...prev, nom: error || '' }));
              }
            }}
            onBlur={() => handleFieldBlur('nom')}
            placeholder="Nom"
            leftIcon="person-outline"
            error={errors.nom}
          />

          {/* Email – pas de required */}
          <Input
            label="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (touched.email) {
                const error = validateField('email', text);
                setErrors(prev => ({ ...prev, email: error || '' }));
              }
            }}
            onBlur={() => handleFieldBlur('email')}
            placeholder="Adresse Email"
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail-outline"
            error={errors.email}
          />

          {/* Téléphone */}
          <Input
            label="Téléphone"
            value={telephone}
            onChangeText={(text) => {
              setTelephone(text);
              if (touched.telephone) {
                const error = validateField('telephone', text);
                setErrors(prev => ({ ...prev, telephone: error || '' }));
              }
            }}
            onBlur={() => handleFieldBlur('telephone')}
            placeholder="+257 65 351 523"
            keyboardType="phone-pad"
            leftIcon="call-outline"
            error={errors.telephone}
          />

          {/* Mot de passe – pas de required */}
          <Input
            label={isEdit ? "Nouveau mot de passe (laisser vide pour garder)" : "Mot de passe"}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (touched.password) {
                const error = validateField('password', text);
                setErrors(prev => ({ ...prev, password: error || '' }));
              }
            }}
            onBlur={() => handleFieldBlur('password')}
            placeholder={isEdit ? "Laisser vide pour garder actuel" : "Minimum 4 caractères"}
            secureTextEntry={!showPassword}
            leftIcon="lock-closed-outline"
            rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowPassword(!showPassword)}
            error={errors.password}
          />

          {/* Rôle – pas d'astérisque */}
          <View style={styles.roleSection}>
            <Text style={styles.roleLabel}>Rôle</Text>
            <View style={styles.roleGrid}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[
                    styles.roleOption,
                    role === r.value && {
                      borderColor: r.color,
                      backgroundColor: r.color + '10',
                    },
                  ]}
                  onPress={() => setRole(r.value)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.roleIcon, { backgroundColor: r.color + '20' }]}>
                    <Ionicons name={r.icon} size={22} color={r.color} />
                  </View>
                  <Text style={[
                    styles.roleOptionLabel,
                    role === r.value && { color: r.color, fontWeight: '700' },
                  ]}>
                    {r.label}
                  </Text>
                  {role === r.value && (
                    <View style={[styles.roleCheck, { backgroundColor: r.color }]}>
                      <Ionicons name="checkmark" size={12} color={Colors.textWhite} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Card>

        {/* BOUTONS */}
        <View style={styles.buttonsContainer}>
          <Button
            title={loading ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer'}
            onPress={handleSave}
            loading={loading}
            disabled={!isFormValid}
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

  // HEADER
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

  // ROLE INDICATOR
  roleIndicator: {
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
  roleIndicatorText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },

  // SCROLL
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },

  // FORM
  formCard: {
    padding: 16,
    marginBottom: 12,
  },

  // ROLE SECTION
  roleSection: {
    marginTop: 8,
    marginBottom: 12,
  },
  roleLabel: {
    ...Typography.label,
    marginBottom: 8,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleOption: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    position: 'relative',
  },
  roleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  roleOptionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
    flex: 1,
  },
  roleCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // BUTTONS
  buttonsContainer: {
    marginTop: 8,
  },
  submitBtn: {
    marginBottom: 8,
  },
  footerSpace: {
    height: 20,
  },
});