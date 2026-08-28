// mobile/src/screens/WelcomeScreen.js
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  StatusBar,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen({ navigation, onFinish }) {
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animation d'entrée
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 900,
        useNativeDriver: true,
      }),
    ]).start();

    // Animation de pulsation du logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleGetStarted = () => {
    if (onFinish) onFinish();
    navigation.navigate('Login');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Éléments décoratifs en arrière-plan */}
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />

      <SafeAreaView style={styles.safeArea}>
        {/* Badge version */}
        <View style={styles.versionBadge}>
          <Text style={styles.versionText}>v1.0.0</Text>
        </View>

        {/* Contenu animé */}
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Logo avec pulsation */}
          <Animated.View
            style={[
              styles.logoContainer,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>

          {/* Titres */}
          <Text style={styles.title}>Bienvenue</Text>
          <Text style={styles.subtitle}>Gestion des rapports sur terrain</Text>

          {/* Séparateur élégant */}
          <View style={styles.divider} />

          {/* Description */}
          <Text style={styles.description}>
            Simplifiez vos interventions et suivez vos rapports en temps réel
          </Text>

          {/* Bouton principal */}
          <TouchableOpacity
            style={styles.buttonWrapper}
            onPress={handleGetStarted}
            activeOpacity={0.8}
          >
            <View style={styles.button}>
              <Text style={styles.buttonText}>Commencer</Text>
              <Ionicons
                name="arrow-forward-circle"
                size={24}
                color={Colors.primary}
                style={styles.buttonIcon}
              />
            </View>
          </TouchableOpacity>

          {/* Lien connexion */}
          <TouchableOpacity onPress={handleGetStarted} style={styles.linkContainer}>
            <Text style={styles.linkText}>
              Déjà un compte ? <Text style={styles.linkHighlight}>Se connecter</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLine} />
          <Text style={styles.footerText}>© 2024 - Tous droits réservés</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary, // Fond uni, pas de dégradé
  },
  safeArea: {
    flex: 1,
  },
  // Cercles décoratifs
  decorCircle1: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -120,
    left: -120,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  versionBadge: {
    position: 'absolute',
    top: 60,
    right: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  versionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 40,
  },
  logoContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.card,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  logo: {
    width: 90,
    height: 90,
  },
  title: {
    fontSize: 44,
    fontWeight: '300',
    color: '#ffffff',
    letterSpacing: 2,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  divider: {
    width: 60,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    marginVertical: Spacing.md,
  },
  description: {
    fontSize: 15,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxl,
    paddingHorizontal: 10,
  },
  buttonWrapper: {
    width: '100%',
    maxWidth: 280,
    borderRadius: Radius.md,
    ...Shadows.button,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: Radius.md,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary,
    letterSpacing: 0.5,
    marginRight: 8,
  },
  buttonIcon: {
    marginLeft: 4,
  },
  linkContainer: {
    marginTop: Spacing.lg,
    paddingVertical: 8,
  },
  linkText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '400',
  },
  linkHighlight: {
    color: '#ffffff',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footer: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  footerLine: {
    width: 40,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 8,
  },
  footerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '300',
  },
});