// mobile/src/screens/RapportDetailScreen.js
// Version avec affichage du rôle de l'utilisateur concerné

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  Image,
  Modal,
  Animated,
  Dimensions,
  Share,
  Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';
import ImageViewing from 'react-native-image-viewing';

import { rapportsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Card,
  StatutBadge,
  Button,
  LoadingScreen,
  Badge,
} from '../components';
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';

const { width, height } = Dimensions.get('window');

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

/**
 * Détecte le rôle de l'utilisateur concerné par le rapport
 */
const getRapportRole = (rapport) => {
  if (!rapport) return null;
  if (rapport.user_role) return rapport.user_role.toLowerCase();
  if (rapport.user_id && rapport.user_nom) return 'utilisateur';
  if (rapport.technicien_id && rapport.technicien_nom) return 'technicien';
  return null;
};

/**
 * Extrait les infos utilisateur
 */
const getRapportUser = (rapport) => {
  if (!rapport) return { prenom: '', nom: '', role: null, email: null, extra: null };

  // Priorité 1 : user_id (nouveau)
  if (rapport.user_id && rapport.user_nom) {
    return {
      role: rapport.user_role || 'utilisateur',
      prenom: rapport.user_prenom || '',
      nom: rapport.user_nom || '',
      email: rapport.user_email || null,
      extra: null,
    };
  }

  // Priorité 2 : technicien
  if (rapport.technicien_nom) {
    return {
      role: 'technicien',
      prenom: rapport.technicien_prenom || '',
      nom: rapport.technicien_nom || '',
      email: rapport.technicien_email || null,
      extra: rapport.technicien_matricule || null,
    };
  }

  return { prenom: '', nom: '', role: null, email: null, extra: null };
};

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function RapportDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, isAdmin, isSuperviseur, isTechnicien } = useAuth();
  const rapportId = route.params?.id;

  const [rapport, setRapport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [photoVisible, setPhotoVisible] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [showActions, setShowActions] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // =========================================================
  // CHARGEMENT
  // =========================================================

  useEffect(() => {
    loadRapport();
  }, [rapportId]);

  useEffect(() => {
    if (!loading && rapport) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }
  }, [loading, rapport]);

  const loadRapport = async () => {
    try {
      const data = await rapportsAPI.get(rapportId);
      setRapport(data?.data || data);
    } catch (error) {
      console.error('❌ Erreur chargement rapport:', error);
      Alert.alert('Erreur', 'Impossible de charger le rapport');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // HANDLERS
  // =========================================================

  const handleDelete = () => {
    Alert.alert(
      'Supprimer le rapport',
      `Êtes-vous sûr de vouloir supprimer "${rapport?.titre}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await rapportsAPI.delete(rapport.id);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Erreur', error.message);
            }
          },
        },
      ]
    );
  };

  const handleStatusChange = async (nouveauStatut) => {
    Alert.alert(
      'Changer le statut',
      `Voulez-vous passer ce rapport en "${nouveauStatut}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              await rapportsAPI.setStatut(rapport.id, nouveauStatut);
              loadRapport();
            } catch (error) {
              Alert.alert('Erreur', error.message);
            }
          },
        },
      ]
    );
  };

  const handleShare = async () => {
    try {
      const userInfo = getRapportUser(rapport);
      const fullName = `${userInfo.prenom} ${userInfo.nom}`.trim();
      const roleLabel = getRoleConfig(userInfo.role).label;

      await Share.share({
        title: `Rapport: ${rapport.titre}`,
        message: `
Rapport BBS

Titre: ${rapport.titre}
Statut: ${rapport.statut}
Type: ${rapport.type_intervention || 'Non spécifié'}
Date: ${new Date(rapport.created_at).toLocaleDateString('fr-FR')}

${fullName ? `Concerne: ${fullName} (${roleLabel})` : ''}

Description:
${rapport.description}

Solution:
${rapport.solution || 'Non renseignée'}

${rapport.adresse ? `Adresse: ${rapport.adresse}` : ''}
        `.trim(),
      });
    } catch (error) {
      console.error('❌ Erreur partage:', error);
    }
  };

  const handleOpenMap = () => {
    if (rapport?.latitude && rapport?.longitude) {
      const url = `https://www.google.com/maps/search/?api=1&query=${rapport.latitude},${rapport.longitude}`;
      Linking.openURL(url);
    } else if (rapport?.adresse) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rapport.adresse)}`;
      Linking.openURL(url);
    }
  };

  const canManage = isAdmin || isSuperviseur;
  const isEditable = rapport?.statut !== 'approuve' && rapport?.statut !== 'rejete';

  // =========================================================
  // RENDU
  // =========================================================

  if (loading) {
    return <LoadingScreen message="Chargement du rapport..." />;
  }

  if (!rapport) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Rapport non trouvé</Text>
      </View>
    );
  }

  const photos = rapport.photos || [];
  const userInfo = getRapportUser(rapport);
  const fullName = `${userInfo.prenom} ${userInfo.nom}`.trim();
  const roleConfig = getRoleConfig(userInfo.role);
  const hasUser = !!fullName;
  const initials = fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* HEADER */}
      <GradientHeader
        colors={[Colors.primary, Colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{rapport.titre}</Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity onPress={handleShare} style={styles.shareBtn} activeOpacity={0.7}>
              <Ionicons name="share-outline" size={22} color={Colors.textWhite} />
            </TouchableOpacity>

            {canManage && isEditable && (
              <TouchableOpacity onPress={() => setShowActions(!showActions)} style={styles.moreBtn} activeOpacity={0.7}>
                <Ionicons name="ellipsis-vertical" size={22} color={Colors.textWhite} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </GradientHeader>

      <Animated.ScrollView
        style={[styles.scroll, { opacity: fadeAnim }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* STATUT */}
        <View style={styles.statusRow}>
          <StatutBadge statut={rapport.statut} size="lg" />
          {rapport.type_intervention && (
            <Badge
              label={getTypeLabel(rapport.type_intervention)}
              color={getTypeColor(rapport.type_intervention)}
              size="lg"
              style={styles.typeBadge}
            />
          )}
        </View>

        {/* 🎯 CARTE UTILISATEUR CONCERNÉ */}
        {hasUser && (
          <Card style={[styles.userCard, { borderLeftColor: roleConfig.color, borderLeftWidth: 5 }]}>
            <View style={styles.userCardContent}>
              <View style={[styles.userCardAvatar, { backgroundColor: roleConfig.color + '20' }]}>
                <Text style={[styles.userCardAvatarText, { color: roleConfig.color }]}>
                  {initials}
                </Text>
              </View>
              <View style={styles.userCardInfo}>
                <Text style={styles.userCardName}>{fullName}</Text>
                <View style={[styles.userCardRoleBadge, { backgroundColor: roleConfig.color + '20' }]}>
                  <Ionicons name={roleConfig.icon} size={12} color={roleConfig.color} />
                  <Text style={[styles.userCardRoleText, { color: roleConfig.color }]}>
                    {roleConfig.label}
                  </Text>
                </View>
                {userInfo.email && (
                  <Text style={styles.userCardEmail} numberOfLines={1}>{userInfo.email}</Text>
                )}
                {userInfo.extra && (
                  <Text style={styles.userCardExtra}>Matricule: {userInfo.extra}</Text>
                )}
              </View>
            </View>
          </Card>
        )}

        {/* CARTE PRINCIPALE */}
        <Card style={styles.mainCard}>
          <Text style={styles.rapportTitle}>{rapport.titre}</Text>

          {rapport.description && (
            <>
              <View style={styles.sectionHeader}>
                <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
                <Text style={styles.sectionLabel}>Description</Text>
              </View>
              <Text style={styles.descriptionText}>{rapport.description}</Text>
            </>
          )}

          {rapport.solution && (
            <>
              <View style={styles.divider} />
              <View style={styles.sectionHeader}>
                <Ionicons name="checkmark-done-circle-outline" size={18} color={Colors.success} />
                <Text style={styles.sectionLabel}>Solution apportée</Text>
              </View>
              <Text style={styles.solutionText}>{rapport.solution}</Text>
            </>
          )}
        </Card>

        {/* INFORMATIONS */}
        <Card style={styles.infoCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
            <Text style={styles.sectionLabel}>Informations</Text>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Utilisateur</Text>
              <Text style={styles.infoValue}>{fullName || '—'}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Rôle</Text>
              <View style={[styles.roleTag, { backgroundColor: roleConfig.color + '20' }]}>
                <Ionicons name={roleConfig.icon} size={11} color={roleConfig.color} />
                <Text style={[styles.roleTagText, { color: roleConfig.color }]}>
                  {roleConfig.shortLabel}
                </Text>
              </View>
            </View>

            {rapport.technicien_matricule && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Matricule</Text>
                <Text style={styles.infoValue}>{rapport.technicien_matricule}</Text>
              </View>
            )}

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Date d'intervention</Text>
              <Text style={styles.infoValue}>
                {rapport.date_intervention
                  ? new Date(rapport.date_intervention).toLocaleDateString('fr-FR')
                  : new Date(rapport.created_at).toLocaleDateString('fr-FR')}
              </Text>
            </View>

            {rapport.duree_intervention && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Durée</Text>
                <Text style={styles.infoValue}>{rapport.duree_intervention} minutes</Text>
              </View>
            )}

            {rapport.mission_titre && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Mission</Text>
                <Text style={styles.infoValue}>{rapport.mission_titre}</Text>
              </View>
            )}
          </View>
        </Card>

        {/* LOCALISATION */}
        {(rapport.adresse || (rapport.latitude && rapport.longitude)) && (
          <TouchableOpacity onPress={handleOpenMap} activeOpacity={0.7}>
            <Card style={styles.locationCard}>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={20} color={Colors.primary} />
                <View style={styles.locationContent}>
                  <Text style={styles.locationLabel}>Localisation</Text>
                  {rapport.adresse && (
                    <Text style={styles.locationText}>{rapport.adresse}</Text>
                  )}
                  {rapport.latitude && rapport.longitude && (
                    <Text style={styles.locationCoords}>
                      {rapport.latitude}, {rapport.longitude}
                    </Text>
                  )}
                </View>
                <Ionicons name="open-outline" size={18} color={Colors.primary} />
              </View>
            </Card>
          </TouchableOpacity>
        )}

        {/* PHOTOS */}
        {photos.length > 0 && (
          <Card style={styles.photosCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="camera-outline" size={18} color={Colors.primary} />
              <Text style={styles.sectionLabel}>Photos ({photos.length})</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
              {photos.map((photo, index) => {
                const uri = photo?.url || photo?.uri || photo?.path;
                if (!uri) return null;

                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => {
                      setImageIndex(index);
                      setPhotoVisible(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                    {index === 0 && photos.length > 1 && (
                      <View style={styles.photoCountBadge}>
                        <Text style={styles.photoCountText}>+{photos.length - 1}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Card>
        )}

        {/* MÉTADONNÉES */}
        <Card style={styles.metaCard}>
          <Text style={styles.metaText}>
            Créé le {new Date(rapport.created_at).toLocaleString('fr-FR')}
          </Text>
          {rapport.updated_at && rapport.updated_at !== rapport.created_at && (
            <Text style={styles.metaText}>
              Modifié le {new Date(rapport.updated_at).toLocaleString('fr-FR')}
            </Text>
          )}
        </Card>

        {/* ACTIONS */}
        {canManage && isEditable && (
          <View style={styles.actionsRow}>
            <Button
              title="Modifier"
              onPress={() => navigation.navigate('RapportForm', { rapport })}
              variant="outline"
              size="md"
              icon="create-outline"
              style={styles.actionBtn}
            />
            <View style={{ width: 8 }} />
            <Button
              title="Supprimer"
              onPress={handleDelete}
              variant="danger"
              size="md"
              icon="trash-outline"
              style={styles.actionBtn}
            />
          </View>
        )}

        {canManage && (
          <View style={styles.statusActions}>
            <Text style={styles.statusActionsLabel}>Changer le statut :</Text>
            <View style={styles.statusActionsRow}>
              {rapport.statut !== 'brouillon' && (
                <TouchableOpacity
                  style={[styles.statusActionBtn, { backgroundColor: Colors.textMuted + '15' }]}
                  onPress={() => handleStatusChange('brouillon')}
                >
                  <Text style={[styles.statusActionText, { color: Colors.textMuted }]}>Brouillon</Text>
                </TouchableOpacity>
              )}
              {rapport.statut !== 'soumis' && (
                <TouchableOpacity
                  style={[styles.statusActionBtn, { backgroundColor: Colors.warning + '15' }]}
                  onPress={() => handleStatusChange('soumis')}
                >
                  <Text style={[styles.statusActionText, { color: Colors.warning }]}>Soumettre</Text>
                </TouchableOpacity>
              )}
              {rapport.statut !== 'approuve' && (
                <TouchableOpacity
                  style={[styles.statusActionBtn, { backgroundColor: Colors.success + '15' }]}
                  onPress={() => handleStatusChange('approuve')}
                >
                  <Text style={[styles.statusActionText, { color: Colors.success }]}>Approuver</Text>
                </TouchableOpacity>
              )}
              {rapport.statut !== 'rejete' && (
                <TouchableOpacity
                  style={[styles.statusActionBtn, { backgroundColor: Colors.danger + '15' }]}
                  onPress={() => handleStatusChange('rejete')}
                >
                  <Text style={[styles.statusActionText, { color: Colors.danger }]}>Rejeter</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <View style={styles.footerSpace} />
      </Animated.ScrollView>

      {/* MENU ACTIONS */}
      {showActions && canManage && isEditable && (
        <View style={styles.actionsMenu}>
          <TouchableOpacity
            style={styles.actionMenuItem}
            onPress={() => {
              setShowActions(false);
              navigation.navigate('RapportForm', { rapport });
            }}
          >
            <Ionicons name="create-outline" size={20} color={Colors.primary} />
            <Text style={styles.actionMenuText}>Modifier</Text>
          </TouchableOpacity>

          <View style={styles.actionMenuDivider} />

          <TouchableOpacity
            style={[styles.actionMenuItem, styles.actionMenuDelete]}
            onPress={() => {
              setShowActions(false);
              handleDelete();
            }}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.danger} />
            <Text style={[styles.actionMenuText, { color: Colors.danger }]}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* VIEWER PHOTOS */}
      {photoVisible && photos.length > 0 && (
        <ImageViewing
          images={photos.map(p => ({ uri: p?.url || p?.uri || p?.path })).filter(p => p.uri)}
          imageIndex={imageIndex}
          visible={photoVisible}
          onRequestClose={() => setPhotoVisible(false)}
          swipeToCloseEnabled
          doubleTapToZoomEnabled
        />
      )}
    </View>
  );
}

// =========================================================
// FONCTIONS UTILITAIRES
// =========================================================

const getTypeLabel = (type) => {
  const map = {
    preventive: 'Préventive',
    corrective: 'Corrective',
    urgente: 'Urgente',
  };
  return map[type] || type;
};

const getTypeColor = (type) => {
  const map = {
    preventive: Colors.info,
    corrective: Colors.warning,
    urgente: Colors.danger,
  };
  return map[type] || Colors.textMuted;
};

// =========================================================
// STYLES
// =========================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // HEADER
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
  headerTitle: { color: Colors.textWhite, fontSize: 17, fontWeight: '700', maxWidth: '80%' },
  headerRight: { flexDirection: 'row', gap: 8 },
  shareBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  moreBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },

  // SCROLL
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 20 },

  // STATUS ROW
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  typeBadge: { paddingVertical: 4, paddingHorizontal: 12 },

  // 🎯 CARTE UTILISATEUR
  userCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  userCardAvatar: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
  },
  userCardAvatarText: {
    fontSize: 20, fontWeight: '800', letterSpacing: 0.5,
  },
  userCardInfo: { flex: 1 },
  userCardName: {
    fontSize: 16, fontWeight: '700',
    color: Colors.textPrimary, marginBottom: 4,
  },
  userCardRoleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 5,
  },
  userCardRoleText: {
    fontSize: 11, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  userCardEmail: {
    fontSize: 11, color: Colors.textMuted,
    marginTop: 4,
  },
  userCardExtra: {
    fontSize: 11, color: Colors.textMuted,
    marginTop: 2,
  },

  // CARDS
  mainCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  infoCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  locationCard: { padding: Spacing.md, marginBottom: Spacing.md },
  photosCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  metaCard: { padding: Spacing.md, marginBottom: Spacing.md, alignItems: 'center' },

  rapportTitle: {
    fontSize: 18, fontWeight: '700',
    color: Colors.textPrimary, marginBottom: 12,
  },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: Colors.textSecondary,
  },

  descriptionText: {
    fontSize: 14, color: Colors.textSecondary, lineHeight: 22,
  },
  solutionText: {
    fontSize: 14, color: Colors.success, lineHeight: 22,
  },

  divider: {
    height: 1, backgroundColor: Colors.divider, marginVertical: 12,
  },

  // INFO GRID
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoItem: { width: '48%' },
  infoLabel: {
    fontSize: 11, color: Colors.textMuted, fontWeight: '500',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14, color: Colors.textPrimary, marginTop: 2, fontWeight: '500',
  },

  // 🎯 ROLE TAG
  roleTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 4,
  },
  roleTagText: {
    fontSize: 10, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.3,
  },

  // LOCATION
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  locationContent: { flex: 1 },
  locationLabel: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },
  locationText: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  locationCoords: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  // PHOTOS
  photosScroll: { flexDirection: 'row' },
  photoThumb: {
    width: 100, height: 100, borderRadius: Radius.md, marginRight: 8,
    backgroundColor: Colors.border,
  },
  photoCountBadge: {
    position: 'absolute', bottom: 8, right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2,
  },
  photoCountText: { color: Colors.textWhite, fontSize: 11, fontWeight: '600' },

  // META
  metaText: { fontSize: 11, color: Colors.textMuted, textAlign: 'center' },

  // ACTIONS
  actionsRow: { flexDirection: 'row', marginTop: Spacing.md },
  actionBtn: { flex: 1 },

  // STATUS ACTIONS
  statusActions: {
    marginTop: Spacing.md, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.divider,
  },
  statusActionsLabel: {
    fontSize: 12, color: Colors.textMuted, marginBottom: 8, fontWeight: '500',
  },
  statusActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusActionBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: 'transparent',
  },
  statusActionText: { fontSize: 12, fontWeight: '500' },

  // ACTIONS MENU
  actionsMenu: {
    position: 'absolute', top: 100, right: 16,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg, padding: 8,
    ...Shadows.card, elevation: 8, zIndex: 999, minWidth: 180,
  },
  actionMenuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: Radius.sm, gap: 10,
  },
  actionMenuText: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  actionMenuDivider: { height: 1, backgroundColor: Colors.divider, marginVertical: 4 },
  actionMenuDelete: { backgroundColor: Colors.danger + '10' },

  // FOOTER
  footerSpace: { height: 20 },

  // ERROR
  errorText: {
    fontSize: 16, color: Colors.textMuted, textAlign: 'center', marginTop: 40,
  },
});