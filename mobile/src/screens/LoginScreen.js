import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  StatusBar,
  Image,
  Animated,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { useAuth } from '../context/AuthContext';
import { Button, Input } from '../components';
import { Colors, Spacing, Radius, Typography, CommonStyles } from '../theme';

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function LoginScreen({ navigation }) {
  const { login, loading: authLoading } = useAuth();

  // États
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [rememberMe, setRememberMe] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Animation d'entrée
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-remplir en développement
    if (__DEV__) {
      setEmail('syldie@bbs.bi');
      setPassword('Syldie@2026');
    }
  }, []);

  // =========================================================
  // VALIDATION
  // =========================================================

  const validateForm = () => {
    const newErrors = {};

    // Validation email
    if (!email || !email.trim()) {
      newErrors.email = "L'email est requis";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email invalide';
    }

    // Validation mot de passe
    if (!password || !password.trim()) {
      newErrors.password = 'Le mot de passe est requis';
    } else if (password.length < 6) {
      newErrors.password = 'Le mot de passe doit contenir au moins 6 caractères';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // =========================================================
  // HANDLERS
  // =========================================================

  const handleLogin = async () => {

    setError('');
    setErrors({});

    // Valider le formulaire
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const result = await login(email.trim().toLowerCase(), password);

      if (!result.success) {
        setError(result.error || 'Erreur de connexion');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError('');
    setErrors({});
  };

  // =========================================================
  // RENDU
  // =========================================================

  const isLoading = loading || authLoading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.appName}>BBS SuiviRapport</Text>
          <Text style={styles.tagline}>Gestion des rapports sur terrain</Text>
        </Animated.View>

        {/* FORM */}
        <Animated.View
          style={[
            styles.form,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.formTitle}>Authentification</Text>
          <Text style={styles.formSubtitle}>
            Connectez-vous à votre compte BBS
          </Text>

          {/* Erreur globale */}
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color={Colors.danger} />
              <Text style={styles.errorBannerText}>{error}</Text>
              <TouchableOpacity onPress={clearError} style={styles.errorClose}>
                <Ionicons name="close" size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Email - ✅ Suppression du * */}
          <Input
            label="Adresse email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errors.email) {
                setErrors({ ...errors, email: '' });
              }
              if (error) setError('');
            }}
            placeholder="Adresse Email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon="mail-outline"
            error={errors.email}
          />

          {/* Mot de passe - ✅ Suppression du * */}
          <Input
            label="Mot de passe"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) {
                setErrors({ ...errors, password: '' });
              }
              if (error) setError('');
            }}
            placeholder="Mot de passe"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon="lock-closed-outline"
            rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowPassword(!showPassword)}
            error={errors.password}
          />

          {/* Bouton de connexion */}
          <Button
            title={isLoading ? 'Connexion en cours...' : 'Se connecter'}
            onPress={handleLogin}
            loading={isLoading}
            size="lg"
            fullWidth
            style={styles.loginButton}
          />

          {/* Footer - ✅ Traduit en français */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>BBS v1.0.0 © 2026</Text>
            <Text style={styles.footerSubtext}>
              Gestion des rapports sur terrain
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// =========================================================
// STYLES
// =========================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },

  // HEADER
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },

  logoContainer: {
    width: 90,
    height: 90,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...CommonStyles.shadow,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },

  logoImage: {
    width: 60,
    height: 60,
  },

  appName: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textWhite,
    letterSpacing: 0.5,
  },

  tagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 2,
  },

  // FORM
  form: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    ...CommonStyles.shadow,
    elevation: 8,
  },

  formTitle: {
    ...Typography.h2,
    textAlign: 'center',
    marginBottom: 2,
  },

  formSubtitle: {
    ...Typography.body,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },

  // ERREUR
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger + '12',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.danger + '30',
  },

  errorBannerText: {
    flex: 1,
    ...Typography.body,
    color: Colors.danger,
    marginLeft: Spacing.sm,
    fontSize: 13,
  },

  errorClose: {
    padding: 4,
  },

  // OPTIONS
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },

  rememberMe: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },

  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },

  rememberMeText: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.textSecondary,
  },

  forgotPassword: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
  },

  loginButton: {
    marginBottom: Spacing.md,
  },

  // FOOTER - ✅ Traduit en français
  footer: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },

  footerText: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 11,
  },

  footerSubtext: {
    ...Typography.caption,
    color: Colors.textLight,
    fontSize: 10,
    marginTop: 2,
  },
});