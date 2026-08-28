//mobile/src/screens/StatistiquesScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  StatusBar,
  Dimensions,
  Animated,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';

import { statsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Card,
  StatCard,
  LoadingScreen,
  SectionHeader,
  PrioriteBadge,
  ProgressBar,
} from '../components';
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';

const { width } = Dimensions.get('window');

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function StatistiquesScreen() {
  const { isAdmin, isSuperviseur, isTechnicien } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // =========================================================
  // CHARGEMENT DES DONNÉES
  // =========================================================

  const loadData = useCallback(async () => {
    try {
      const data = await statsAPI.dashboard();
      setStats(data?.data || data);
    } catch (error) {
      console.error('❌ Erreur chargement statistiques:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Animation d'entrée
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
    ]).start();
  }, []);

  // Chargement initial
  useEffect(() => {
    loadData();
  }, [loadData]);

  // =========================================================
  // RENDU
  // =========================================================

  if (loading) {
    return <LoadingScreen message="Chargement des statistiques..." />;
  }

  // Extraire les données avec valeurs par défaut
  const rapports = stats?.rapports || {};
  const incidents = stats?.incidents || {};
  const missions = stats?.missions || {};
  const techniciens = stats?.techniciens || {};
  const utilisateurs = stats?.utilisateurs || {};
  const reseau = stats?.reseau || {};
  const evolutionRapports = stats?.evolution_rapports || [];

  const maxInterv = evolutionRapports.length
    ? Math.max(...evolutionRapports.map(m => m.count), 1)
    : 1;

  const totalTechniciens = techniciens?.total || 0;
  const techDisponibles = techniciens?.disponibles || 0;
  const tauxDisponibilite = totalTechniciens > 0
    ? Math.round((techDisponibles / totalTechniciens) * 100)
    : 0;

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
          <View style={styles.headerLeft}>
            <Ionicons name="stats-chart" size={24} color={Colors.textWhite} />
            <Text style={styles.headerTitle}>Statistiques</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            Tableau de bord analytique
          </Text>
        </View>
      </GradientHeader>

      {/* CONTENU */}
      <Animated.ScrollView
        style={[styles.scroll, { opacity: fadeAnim }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {/* SECTION: INDICATEURS CLÉS */}
        <SectionHeader
          title="Indicateurs clés"
          icon="speedometer-outline"
        />

        <View style={styles.kpiRow}>
          <StatCard
            label="Total interventions"
            value={rapports?.total || 0}
            color={Colors.primary}
            icon="document-text-outline"
          />
          <View style={{ width: Spacing.sm }} />
          <StatCard
            label="Ce mois"
            value={rapports?.mois || 0}
            color={Colors.secondary}
            icon="calendar-outline"
          />
        </View>

        <View style={styles.kpiRow}>
          <StatCard
            label="Incidents ouverts"
            value={incidents?.ouverts || 0}
            color={Colors.danger}
            icon="alert-circle-outline"
          />
          <View style={{ width: Spacing.sm }} />
          <StatCard
            label="Incidents résolus"
            value={incidents?.resolus || 0}
            color={Colors.success}
            icon="checkmark-circle-outline"
          />
        </View>

        <View style={styles.kpiRow}>
          <StatCard
            label="Missions en cours"
            value={missions?.en_cours || 0}
            color={Colors.warning}
            icon="briefcase-outline"
          />
          <View style={{ width: Spacing.sm }} />
          <StatCard
            label="Taux résolution"
            value={`${incidents?.taux_resolution || '0%'}`}
            color={Colors.info}
            icon="trending-up-outline"
          />
        </View>

        {/* SECTION: TEMPS MOYEN */}
        <Card style={styles.tempsCard}>
          <View style={styles.tempsHeader}>
            <Ionicons name="time-outline" size={28} color={Colors.primary} />
            <Text style={styles.tempsTitle}>Temps moyen de réparation</Text>
          </View>
          <Text style={styles.tempsValue}>
            {rapports?.temps_moyen_intervention || '0'}
            <Text style={styles.tempsUnit}> min</Text>
          </Text>
          <View style={styles.tempsStatus}>
            <View style={[
              styles.tempsDot,
              { backgroundColor: (rapports?.temps_moyen_intervention || 0) < 60
                ? Colors.success
                : (rapports?.temps_moyen_intervention || 0) < 120
                ? Colors.warning
                : Colors.danger }
            ]} />
            <Text style={styles.tempsStatusText}>
              {(rapports?.temps_moyen_intervention || 0) < 60
                ? '✅ Bon niveau de performance'
                : (rapports?.temps_moyen_intervention || 0) < 120
                ? '⚠️ Délai à améliorer'
                : '🔴 Délai trop élevé'}
            </Text>
          </View>
        </Card>

        {/* SECTION: ÉQUIPE TECHNIQUE */}
        <Card style={styles.techCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="people-outline" size={22} color={Colors.primary} />
            <Text style={styles.cardTitle}>Équipe technique</Text>
          </View>

          <View style={styles.techRow}>
            <View style={styles.techStat}>
              <Text style={[styles.techValue, { color: Colors.primary }]}>
                {totalTechniciens}
              </Text>
              <Text style={styles.techLabel}>Total</Text>
            </View>
            <View style={styles.techDivider} />
            <View style={styles.techStat}>
              <Text style={[styles.techValue, { color: Colors.success }]}>
                {techDisponibles}
              </Text>
              <Text style={styles.techLabel}>Disponibles</Text>
            </View>
            <View style={styles.techDivider} />
            <View style={styles.techStat}>
              <Text style={[styles.techValue, { color: Colors.warning }]}>
                {totalTechniciens - techDisponibles}
              </Text>
              <Text style={styles.techLabel}>Occupés</Text>
            </View>
          </View>

          <ProgressBar
            value={tauxDisponibilite}
            max={100}
            label="Taux de disponibilité"
          />
        </Card>

        {/* SECTION: ÉVOLUTION DES RAPPORTS */}
        {evolutionRapports.length > 0 && (
          <Card style={styles.chartCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="calendar-outline" size={22} color={Colors.primary} />
              <Text style={styles.cardTitle}>Évolution des rapports</Text>
            </View>

            <View style={styles.barChart}>
              {evolutionRapports.slice(0, 6).reverse().map((item, index) => (
                <View key={index} style={styles.barItem}>
                  <Text style={styles.barCount}>{item.count}</Text>
                  <View style={styles.barWrapper}>
                    <View style={[
                      styles.bar,
                      {
                        height: Math.max((item.count / maxInterv) * 80, 4),
                        backgroundColor: index === 0 ? Colors.primary : Colors.primaryLight,
                      }
                    ]} />
                  </View>
                  <Text style={styles.barLabel}>{item.mois?.slice(5)}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* SECTION: INCIDENTS PAR PRIORITÉ */}
        {incidents?.par_severite?.length > 0 && (
          <Card style={styles.prioriteCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="warning-outline" size={22} color={Colors.warning} />
              <Text style={styles.cardTitle}>Incidents par sévérité</Text>
            </View>

            {incidents.par_severite.map((item, index) => (
              <View key={index} style={styles.prioriteRow}>
                <Badge
                  label={item.severite}
                  color={getSeveriteColor(item.severite)}
                  size="sm"
                  style={styles.prioriteBadge}
                />
                <View style={styles.prioriteBar}>
                  <View style={[
                    styles.prioriteBarFill,
                    {
                      width: `${(item.count / Math.max(...incidents.par_severite.map(p => p.count))) * 100}%`,
                      backgroundColor: getSeveriteColor(item.severite),
                    }
                  ]} />
                </View>
                <Text style={styles.prioriteCount}>{item.count}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* SECTION: MISSIONS PAR STATUT */}
        {missions?.par_statut?.length > 0 && (
          <Card style={styles.missionsCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="briefcase-outline" size={22} color={Colors.secondary} />
              <Text style={styles.cardTitle}>Missions par statut</Text>
            </View>

            {missions.par_statut.map((item, index) => (
              <View key={index} style={styles.missionRow}>
                <Badge
                  label={item.statut}
                  color={getStatutColor(item.statut)}
                  size="sm"
                  style={styles.missionBadge}
                />
                <View style={styles.missionBar}>
                  <View style={[
                    styles.missionBarFill,
                    {
                      width: `${(item.count / Math.max(...missions.par_statut.map(p => p.count))) * 100}%`,
                      backgroundColor: getStatutColor(item.statut),
                    }
                  ]} />
                </View>
                <Text style={styles.missionCount}>{item.count}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* SECTION: ZONES EN CONGESTION */}
        {reseau?.zones_congestion > 0 && (
          <Card style={styles.congestionCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="alert-circle-outline" size={22} color={Colors.danger} />
              <Text style={styles.cardTitle}>Zones en congestion</Text>
            </View>
            <View style={styles.congestionStats}>
              <View style={styles.congestionItem}>
                <Text style={[styles.congestionValue, { color: Colors.danger }]}>
                  {reseau.zones_congestion}
                </Text>
                <Text style={styles.congestionLabel}>En congestion</Text>
              </View>
              <View style={styles.congestionDivider} />
              <View style={styles.congestionItem}>
                <Text style={[styles.congestionValue, { color: Colors.success }]}>
                  {reseau.zones_operationnelles || 0}
                </Text>
                <Text style={styles.congestionLabel}>Opérationnelles</Text>
              </View>
              <View style={styles.congestionDivider} />
              <View style={styles.congestionItem}>
                <Text style={[styles.congestionValue, { color: Colors.warning }]}>
                  {reseau.zones_critiques || 0}
                </Text>
                <Text style={styles.congestionLabel}>Critiques</Text>
              </View>
            </View>
            <ProgressBar
              value={((reseau.zones_operationnelles || 0) / (reseau.total_zones || 1)) * 100}
              max={100}
              label="Taux de disponibilité du réseau"
            />
          </Card>
        )}

        <View style={styles.footerSpace} />
      </Animated.ScrollView>
    </View>
  );
}

// =========================================================
// COMPOSANT BADGE INTERNE
// =========================================================

function Badge({ label, color, size = 'sm', style, icon }) {
  const sizeStyles = {
    sm: { paddingH: 8, paddingV: 3, fontSize: 10 },
    md: { paddingH: 12, paddingV: 5, fontSize: 12 },
    lg: { paddingH: 16, paddingV: 7, fontSize: 14 },
  };
  const s = sizeStyles[size] || sizeStyles.sm;

  return (
    <View style={[
      styles.badge,
      {
        backgroundColor: color + '15',
        borderColor: color,
        paddingHorizontal: s.paddingH,
        paddingVertical: s.paddingV,
      },
      style
    ]}>
      {icon && <Ionicons name={icon} size={s.fontSize + 2} color={color} style={{ marginRight: 4 }} />}
      <Text style={[styles.badgeText, { color, fontSize: s.fontSize }]}>{label}</Text>
    </View>
  );
}

// =========================================================
// FONCTIONS UTILITAIRES
// =========================================================

const getSeveriteColor = (severite) => {
  const map = {
    faible: Colors.success,
    moyenne: Colors.warning,
    elevee: Colors.danger,
    critique: Colors.danger,
  };
  return map[severite] || Colors.textMuted;
};

const getStatutColor = (statut) => {
  const map = {
    planifiee: Colors.info,
    en_cours: Colors.warning,
    terminee: Colors.success,
    annulee: Colors.textMuted,
  };
  return map[statut] || Colors.textMuted;
};

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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: Colors.textWhite,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },

  // SCROLL
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 20,
  },

  // KPI
  kpiRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },

  // TEMPS CARD
  tempsCard: {
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  tempsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  tempsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  tempsValue: {
    fontSize: 48,
    fontWeight: '900',
    color: Colors.primary,
  },
  tempsUnit: {
    fontSize: 18,
    fontWeight: '400',
    color: Colors.textMuted,
  },
  tempsStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  tempsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tempsStatusText: {
    fontSize: 12,
    color: Colors.textMuted,
  },

  // TECH CARD
  techCard: {
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
  techRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.md,
  },
  techStat: {
    alignItems: 'center',
  },
  techValue: {
    fontSize: 30,
    fontWeight: '900',
  },
  techLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  techDivider: {
    width: 1,
    backgroundColor: Colors.divider,
  },

  // CHART CARD
  chartCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 110,
    marginTop: 8,
  },
  barItem: {
    alignItems: 'center',
    flex: 1,
  },
  barCount: {
    fontSize: 10,
    color: Colors.textMuted,
    marginBottom: 3,
  },
  barWrapper: {
    width: 28,
    justifyContent: 'flex-end',
    height: 80,
  },
  bar: {
    width: 28,
    borderRadius: 6,
  },
  barLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 4,
  },

  // PRIORITE CARD
  prioriteCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  prioriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  prioriteBadge: {
    minWidth: 70,
  },
  prioriteBar: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  prioriteBarFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  prioriteCount: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    minWidth: 24,
    textAlign: 'right',
  },

  // MISSIONS CARD
  missionsCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  missionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  missionBadge: {
    minWidth: 70,
  },
  missionBar: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  missionBarFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  missionCount: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    minWidth: 24,
    textAlign: 'right',
  },

  // CONGESTION CARD
  congestionCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  congestionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.md,
  },
  congestionItem: {
    alignItems: 'center',
  },
  congestionValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  congestionLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  congestionDivider: {
    width: 1,
    backgroundColor: Colors.divider,
  },

  // BADGE
  badge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeText: {
    fontWeight: '600',
  },

  footerSpace: {
    height: 20,
  },
});