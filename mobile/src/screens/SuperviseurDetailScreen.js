// mobile/src/screens/SuperviseurDetailScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';

import { superviseursAPI } from '../services/api';
import { Card, Badge, LoadingScreen, EmptyState } from '../components';
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';

const NIVEAUX = {
  1: { label: 'Débutant', color: Colors.textMuted },
  2: { label: 'Junior', color: Colors.info },
  3: { label: 'Intermédiaire', color: Colors.primary },
  4: { label: 'Senior', color: Colors.warning },
  5: { label: 'Expert', color: Colors.danger },
};

export default function SuperviseurDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params;

  const [superviseur, setSuperviseur] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSuperviseur = useCallback(async () => {
    try {
      setLoading(true);
      const res = await superviseursAPI.detail(id);
      setSuperviseur(res.data || res);
    } catch (error) {
      console.error('Erreur chargement superviseur:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails du superviseur.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSuperviseur();
  }, [loadSuperviseur]);

  useFocusEffect(
    useCallback(() => {
      loadSuperviseur();
    }, [loadSuperviseur])
  );

  if (loading) {
    return <LoadingScreen message="Chargement du superviseur..." />;
  }

  if (!superviseur) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />
        <GradientHeader style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Superviseur introuvable</Text>
            <View style={{ width: 44 }} />
          </View>
        </GradientHeader>
        <EmptyState title="Superviseur introuvable" icon="👔" subtitle="Veuillez réessayer." />
      </View>
    );
  }

  const niveauInfo = NIVEAUX[superviseur.niveau_experience] || { label: 'N/A', color: Colors.textMuted };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      <GradientHeader style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Détail Superviseur</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
      </GradientHeader>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <View style={styles.identityRow}>
            <View style={[styles.avatar, { backgroundColor: niveauInfo.color + '20' }]}>
              <Text style={[styles.avatarText, { color: niveauInfo.color }]}>
                {superviseur.prenom?.[0]}{superviseur.nom?.[0]}
              </Text>
            </View>
            <View style={styles.identityInfo}>
              <Text style={styles.name}>{superviseur.prenom} {superviseur.nom}</Text>
              <Text style={styles.email}>{superviseur.email}</Text>
              <View style={styles.badgeRow}>
                <Badge label={niveauInfo.label} color={niveauInfo.color} size="sm" />
                {superviseur.zone_responsable && (
                  <Badge label={superviseur.zone_responsable} color={Colors.primary} size="sm" icon="location-outline" style={styles.badge} />
                )}
              </View>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="call-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.detailText}>{superviseur.telephone || 'Non renseigné'}</Text>
          </View>
          {superviseur.telephone_pro && (
            <View style={styles.detailRow}>
              <Ionicons name="business-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.detailText}>{superviseur.telephone_pro}</Text>
            </View>
          )}
        </Card>

        {superviseur.statistiques && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Statistiques</Text>
            <View style={styles.statsGrid}>
              <StatItem label="Missions totales" value={superviseur.statistiques.missions?.total || 0} />
              <StatItem label="En cours" value={superviseur.statistiques.missions?.en_cours || 0} color={Colors.warning} />
              <StatItem label="Incidents ouverts" value={superviseur.statistiques.incidents?.ouverts || 0} color={Colors.danger} />
              <StatItem label="Techniciens sous resp." value={superviseur.statistiques.techniciens?.total || 0} color={Colors.primary} />
            </View>
          </Card>
        )}

        {superviseur.dernieres_missions?.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Dernières missions</Text>
            {superviseur.dernieres_missions.map((mission, index) => (
              <View key={index} style={styles.listItem}>
                <Text style={styles.listItemTitle}>{mission.titre}</Text>
                <Badge label={mission.statut} color={mission.statut === 'terminee' ? Colors.success : Colors.warning} size="sm" />
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function StatItem({ label, value, color = Colors.textPrimary }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

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
  },
  headerTitle: {
    color: Colors.textWhite,
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 30,
  },
  card: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
  },
  identityInfo: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  email: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginVertical: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  badge: {
    marginLeft: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    marginBottom: Spacing.md,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  listItemTitle: {
    fontSize: 14,
    color: Colors.textPrimary,
    flex: 1,
  },
});