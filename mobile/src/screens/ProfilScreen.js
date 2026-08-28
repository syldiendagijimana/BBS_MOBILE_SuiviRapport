//mobile/src/screens/ProfilScreen.js
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
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';
import { useAuth } from '../context/AuthContext';
import { authAPI, statsAPI } from '../services/api';
import { Card, Button, Input, Badge, LoadingScreen } from '../components';
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';

const { width } = Dimensions.get('window');

// =========================================================
// CONSTANTES
// =========================================================

const roleLabels = {
  admin: 'Administrateur',
  dj: 'Directeur Junior',
  superviseur: 'Superviseur',
  technicien: 'Technicien',
};

const roleColors = {
  admin: Colors.danger,
  dj: Colors.secondary,
  superviseur: Colors.primary,
  technicien: Colors.warning,
};

const roleIcons = {
  admin: 'shield-checkmark',
  dj: 'star',
  superviseur: 'briefcase',
  technicien: 'construct',
};

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function ProfilScreen() {
  const navigation = useNavigation();
  const { user, logout, isAdmin, isSuperviseur, isTechnicien, fullName } = useAuth();

  const [showPwdForm, setShowPwdForm] = useState(false);
  const [ancienPwd, setAncienPwd] = useState('');
  const [nouveauPwd, setNouveauPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // =========================================================
  // CHARGEMENT DES STATISTIQUES
  // =========================================================

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      if (isTechnicien) {
        // Récupérer l'ID du technicien
        const techId = user?.roleData?.id;
        if (techId) {
          const data = await statsAPI.technicien(techId);
          setStats(data?.statistiques || data);
        }
      } else if (isSuperviseur) {
        const supId = user?.roleData?.id;
        if (supId) {
          const data = await statsAPI.superviseur(supId);
          setStats(data?.statistiques || data);
        }
      }
    } catch (error) {
      console.error('❌ Erreur chargement stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // =========================================================
  // ANIMATIONS
  // =========================================================

  useEffect(() => {
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
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // =========================================================
  // HANDLERS
  // =========================================================

  const handleChangePwd = async () => {
    if (!ancienPwd || !nouveauPwd || !confirmPwd) {
      Alert.alert('Erreur', 'Tous les champs sont requis');
      return;
    }
    if (nouveauPwd !== confirmPwd) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }
    if (nouveauPwd.length < 6) {
      Alert.alert('Erreur', 'Le nouveau mot de passe doit faire au moins 6 caractères');
      return;
    }

    setLoading(true);
    try {
      await authAPI.changePassword(ancienPwd, nouveauPwd);
      Alert.alert('✅ Succès', 'Mot de passe modifié avec succès');
      setShowPwdForm(false);
      setAncienPwd('');
      setNouveauPwd('');
      setConfirmPwd('');
    } catch (error) {
      Alert.alert('❌ Erreur', error.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnexion', style: 'destructive', onPress: logout },
      ]
    );
  };

  const getInitiales = () => {
    const prenom = user?.prenom || '';
    const nom = user?.nom || '';
    return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase() || '?';
  };

  const getRoleLabel = () => {
    return roleLabels[user?.role] || user?.role || 'Utilisateur';
  };

  const getRoleColor = () => {
    return roleColors[user?.role] || Colors.primary;
  };

  const getRoleIcon = () => {
    return roleIcons[user?.role] || 'person';
  };

  // =========================================================
  // RENDU
  // =========================================================

  const roleColor = getRoleColor();
  const roleLabel = getRoleLabel();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* HEADER */}
      <GradientHeader colors={[Colors.primary, Colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Mon Profil</Text>

          <View style={{ width: 40 }} />
        </View>

        {/* AVATAR */}
        <Animated.View
          style={[
            styles.avatarContainer,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: roleColor + '30' }]}>
            <Text style={[styles.avatarText, { color: roleColor }]}>
              {getInitiales()}
            </Text>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: roleColor }]}>
            <Ionicons name={getRoleIcon()} size={12} color={Colors.textWhite} />
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.userName}>{fullName || 'Utilisateur'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <Badge
            label={roleLabel}
            color={roleColor}
            size="lg"
            style={styles.roleBadgeText}
            icon={getRoleIcon()}
          />
        </Animated.View>
      </GradientHeader>

      {/* CONTENU */}
      <Animated.ScrollView
        style={[styles.scroll, { opacity: fadeAnim }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* STATISTIQUES PERSONNELLES */}
        {stats && !statsLoading && (
          <Card style={styles.statsCard}>
            <View style={styles.statsHeader}>
              <Ionicons name="stats-chart-outline" size={20} color={Colors.primary} />
              <Text style={styles.statsTitle}>Mes statistiques</Text>
            </View>

            {isTechnicien && (
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.missions?.total || 0}</Text>
                  <Text style={styles.statLabel}>Missions</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: Colors.success }]}>
                    {stats.missions?.terminees || 0}
                  </Text>
                  <Text style={styles.statLabel}>Terminées</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: Colors.primary }]}>
                    {stats.rapports?.total || 0}
                  </Text>
                  <Text style={styles.statLabel}>Rapports</Text>
                </View>
              </View>
            )}

            {isSuperviseur && (
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.missions?.total || 0}</Text>
                  <Text style={styles.statLabel}>Missions</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: Colors.success }]}>
                    {stats.missions?.terminees || 0}
                  </Text>
                  <Text style={styles.statLabel}>Terminées</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: Colors.primary }]}>
                    {stats.techniciens_sous_responsabilite || 0}
                  </Text>
                  <Text style={styles.statLabel}>Techniciens</Text>
                </View>
              </View>
            )}
          </Card>
        )}

        {/* INFORMATIONS */}
        <Card style={styles.infoCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-circle-outline" size={22} color={Colors.primary} />
            <Text style={styles.cardTitle}>Informations du compte</Text>
          </View>

          <InfoRow label="Prénom" value={user?.prenom} />
          <InfoRow label="Nom" value={user?.nom} />
          <InfoRow label="Email" value={user?.email} />
          {user?.telephone && <InfoRow label="Téléphone" value={user?.telephone} />}
          <InfoRow label="Rôle" value={roleLabel} />
          <InfoRow label="Statut" value={user?.actif ? '✅ Actif' : '❌ Désactivé'} />
          {user?.created_at && (
            <InfoRow label="Membre depuis" value={new Date(user.created_at).toLocaleDateString('fr-FR')} />
          )}
        </Card>

        {/* ADMINISTRATION */}
        {(isAdmin || isSuperviseur) && (
          <Card style={styles.adminCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="settings-outline" size={22} color={Colors.primary} />
              <Text style={styles.cardTitle}>Administration</Text>
            </View>

            {isAdmin && (
              <MenuItem
                icon="people-outline"
                label="Gestion des utilisateurs"
                onPress={() => navigation.navigate('Users')}
                color={Colors.primary}
              />
            )}
            {isAdmin && (
              <MenuItem
                icon="briefcase-outline"
                label="Gestion des superviseurs"
                onPress={() => navigation.navigate('Superviseurs')}
                color={Colors.secondary}
              />
            )}
            <MenuItem
              icon="construct-outline"
              label="Gestion des techniciens"
              onPress={() => navigation.navigate('Techniciens')}
              color={Colors.warning}
            />
            {isAdmin && (
              <MenuItem
                icon="key-outline"
                label="Gestion des permissions"
                onPress={() => navigation.navigate('Permissions')}
                color={Colors.danger}
              />
            )}
            <MenuItem
              icon="stats-chart-outline"
              label="Statistiques"
              onPress={() => navigation.navigate('Statistiques')}
              color={Colors.info}
            />
          </Card>
        )}

        {/* SÉCURITÉ */}
        <Card style={styles.securityCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="shield-checkmark-outline" size={22} color={Colors.primary} />
            <Text style={styles.cardTitle}>Sécurité</Text>
          </View>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowPwdForm(!showPwdForm)}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.primary} />
              <Text style={styles.menuLabel}>Changer le mot de passe</Text>
            </View>
            <Ionicons
              name={showPwdForm ? 'chevron-up' : 'chevron-forward'}
              size={18}
              color={Colors.textMuted}
            />
          </TouchableOpacity>

          {showPwdForm && (
            <View style={styles.pwdForm}>
              <Input
                label="Ancien mot de passe"
                value={ancienPwd}
                onChangeText={setAncienPwd}
                secureTextEntry
                placeholder="••••••••"
                leftIcon="lock-closed-outline"
              />
              <Input
                label="Nouveau mot de passe"
                value={nouveauPwd}
                onChangeText={setNouveauPwd}
                secureTextEntry
                placeholder="••••••••"
                leftIcon="lock-open-outline"
              />
              <Input
                label="Confirmer le mot de passe"
                value={confirmPwd}
                onChangeText={setConfirmPwd}
                secureTextEntry
                placeholder="••••••••"
                leftIcon="checkmark-done-outline"
              />
              <View style={styles.pwdActions}>
                <Button
                  title={loading ? '...' : 'Confirmer'}
                  onPress={handleChangePwd}
                  loading={loading}
                  variant="primary"
                  size="md"
                  style={{ flex: 1 }}
                />
                <Button
                  title="Annuler"
                  onPress={() => {
                    setShowPwdForm(false);
                    setAncienPwd('');
                    setNouveauPwd('');
                    setConfirmPwd('');
                  }}
                  variant="ghost"
                  size="md"
                  style={{ flex: 1, marginLeft: 8 }}
                />
              </View>
            </View>
          )}
        </Card>

        {/* À PROPOS */}
        <Card style={styles.aboutCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle-outline" size={22} color={Colors.primary} />
            <Text style={styles.cardTitle}>À propos</Text>
          </View>

          <InfoRow label="Application" value="BBS Mobile" />
          <InfoRow label="Version" value="1.0.0" />
          <InfoRow label="Développeur" value="Syldie,Soleil & Bénit Loxn" />
          <InfoRow label="Technologie" value="React Native + Node.js" />
        </Card>

        {/* DÉCONNEXION */}
        <Button
          title="Se déconnecter"
          onPress={confirmLogout}
          variant="danger"
          size="lg"
          fullWidth
          icon="log-out-outline"
          style={styles.logoutBtn}
        />

        <View style={styles.footerSpace} />
      </Animated.ScrollView>
    </View>
  );
}

// =========================================================
// COMPOSANTS INTERNES
// =========================================================

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function MenuItem({ icon, label, onPress, color = Colors.primary }) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuItemLeft}>
        <Ionicons name={icon} size={20} color={color} />
        <Text style={[styles.menuLabel, { color }]}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
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
    paddingBottom: 20,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    ...Shadows.card,
    elevation: 8,
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
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

  // AVATAR
  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
  },
  roleBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },

  userName: {
    color: Colors.textWhite,
    fontSize: 20,
    fontWeight: '800',
  },
  userEmail: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 2,
  },
  roleBadgeText: {
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.4)',
  },

  // SCROLL
  scroll: {
    flex: 1,
    marginTop: -8,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 20,
  },

  // STATS CARD
  statsCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  statsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.divider,
  },

  // CARDS
  infoCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  adminCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  securityCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  aboutCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  // INFO ROW
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textPrimary,
    maxWidth: '60%',
  },

  // MENU ITEM
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },

  // PASSWORD FORM
  pwdForm: {
    paddingTop: Spacing.md,
  },
  pwdActions: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
  },

  // LOGOUT
  logoutBtn: {
    marginTop: Spacing.md,
  },

  footerSpace: {
    height: 20,
  },
});