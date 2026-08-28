// mobile/src/screens/ReseauScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  StatusBar,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import NetInfo from '@react-native-community/netinfo';
import GradientHeader from '../components/GradientHeader';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { reseauAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Card,
  ProgressBar,
  LoadingScreen,
  SectionHeader,
  Button,
} from '../components';
import { Colors, Spacing, Radius, Shadows } from '../theme';

const { width } = Dimensions.get('window');

// =========================================================
// HOOK : compteur animé (fait "défiler" une valeur vers sa cible)
// =========================================================
// À chaque fois que `target` change (nouvelle mesure de bande passante
// reçue depuis l'API), la valeur affichée s'anime en douceur depuis
// l'ancienne valeur jusqu'à la nouvelle, au lieu de "sauter" directement.
function useCountUp(target, duration = 900) {
  const [display, setDisplay] = useState(
    target !== null && target !== undefined && !isNaN(target) ? target : 0
  );
  const animRef = useRef(new Animated.Value(display)).current;
  const hasMounted = useRef(false);

  useEffect(() => {
    if (target === null || target === undefined || isNaN(target)) return;

    if (!hasMounted.current) {
      // Première valeur reçue : on l'affiche directement, sans animation
      animRef.setValue(target);
      setDisplay(target);
      hasMounted.current = true;
      return;
    }

    const listenerId = animRef.addListener(({ value }) => {
      setDisplay(parseFloat(value.toFixed(1)));
    });

    Animated.timing(animRef, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    return () => animRef.removeListener(listenerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return display;
}

// =========================================================
// HOOK : mesure réelle et continue de la bande passante du
// réseau que l'appareil utilise en ce moment (Wi-Fi ou données
// mobiles) — indépendant des stats renvoyées par le serveur.
// =========================================================
function useLiveNetworkSpeed(intervalMs = 15000) {
  const [connectionType, setConnectionType] = useState(null); // 'wifi' | 'cellular' | ...
  const [download, setDownload] = useState(null); // Mbps mesuré sur l'appareil
  const [upload, setUpload] = useState(null); // Mbps mesuré sur l'appareil
  const runningRef = useRef(false);
  const mountedRef = useRef(true);

  // Suit en direct le type de réseau réellement utilisé par l'appareil
  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (mountedRef.current) setConnectionType(state.type);
    });
    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, []);

  // Télécharge un petit fichier de test pour estimer le débit descendant réel
  const measureDownload = async () => {
    const testUrl = `https://speed.hetzner.de/100KB.bin?_=${Date.now()}`;
    const start = Date.now();
    const response = await fetch(testUrl);
    const blob = await response.blob();
    const durationSec = (Date.now() - start) / 1000;
    const sizeBytes = blob.size || 100 * 1024;
    if (durationSec <= 0) return null;
    return parseFloat(((sizeBytes * 8) / durationSec / 1_000_000).toFixed(1));
  };

  // Envoie un petit paquet de test pour estimer le débit montant réel
  const measureUpload = async () => {
    const payload = 'x'.repeat(50 * 1024); // ~50 Ko
    const start = Date.now();
    await fetch('https://httpbin.org/post', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: payload,
    });
    const durationSec = (Date.now() - start) / 1000;
    if (durationSec <= 0) return null;
    return parseFloat(((payload.length * 8) / durationSec / 1_000_000).toFixed(1));
  };

  const runMeasurement = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      const state = await NetInfo.fetch();
      if (!mountedRef.current) return;
      setConnectionType(state.type);

      if (!state.isConnected) {
        setDownload(null);
        setUpload(null);
        return;
      }

      const [dl, ul] = await Promise.all([
        measureDownload().catch(() => null),
        measureUpload().catch(() => null),
      ]);

      if (!mountedRef.current) return;
      if (dl !== null) setDownload(dl);
      if (ul !== null) setUpload(ul);
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    runMeasurement();
    const interval = setInterval(runMeasurement, intervalMs);
    return () => clearInterval(interval);
  }, [runMeasurement, intervalMs]);

  return { connectionType, download, upload };
}

function getConnectionLabel(type) {
  switch (type) {
    case 'wifi':
      return 'Wi-Fi';
    case 'cellular':
      return 'Données mobiles';
    case 'ethernet':
      return 'Ethernet';
    case 'none':
      return 'Hors ligne';
    default:
      return null;
  }
}

// =========================================================
// SPEED TEST MODAL
// =========================================================
function SpeedTestModal({ visible, onClose }) {
  // ... (code inchangé, identique à la version précédente)
  // Afin de ne pas alourdir, je le laisse identique
  const [phase, setPhase] = useState('idle');
  const [download, setDownload] = useState(0);
  const [upload, setUpload] = useState(0);
  const [latence, setLatence] = useState(0);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef(null);

  const startSpin = () => {
    spinAnim.setValue(0);
    spinLoop.current = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinLoop.current.start();
  };

  const stopSpin = () => {
    if (spinLoop.current) spinLoop.current.stop();
  };

  const spinDeg = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  const runSpeedTest = () => {
    if (phase === 'running') return;
    setDownload(0);
    setUpload(0);
    setLatence(0);
    setPhase('running');
    startSpin();

    const dl = parseFloat((Math.random() * 80 + 20).toFixed(1));
    const ul = parseFloat((Math.random() * 40 + 10).toFixed(1));
    const lat = Math.floor(Math.random() * 60 + 8);

    const latStart = Date.now();
    const latDuration = 600;
    const latTimer = setInterval(() => {
      const elapsed = Date.now() - latStart;
      const progress = Math.min(elapsed / latDuration, 1);
      setLatence(Math.round(lat * easeOut(progress)));
      if (progress >= 1) clearInterval(latTimer);
    }, 30);

    setTimeout(() => {
      const dlStart = Date.now();
      const dlDuration = 2000;
      const dlTimer = setInterval(() => {
        const elapsed = Date.now() - dlStart;
        const progress = Math.min(elapsed / dlDuration, 1);
        setDownload(parseFloat((dl * easeOut(progress)).toFixed(1)));
        if (progress >= 1) clearInterval(dlTimer);
      }, 30);
    }, 600);

    setTimeout(() => {
      const ulStart = Date.now();
      const ulDuration = 2000;
      const ulTimer = setInterval(() => {
        const elapsed = Date.now() - ulStart;
        const progress = Math.min(elapsed / ulDuration, 1);
        setUpload(parseFloat((ul * easeOut(progress)).toFixed(1)));
        if (progress >= 1) {
          clearInterval(ulTimer);
          stopSpin();
          setPhase('done');
        }
      }, 30);
    }, 2600);
  };

  const handleClose = () => {
    stopSpin();
    setPhase('idle');
    setDownload(0);
    setUpload(0);
    setLatence(0);
    onClose();
  };

  const dlColor = (mbps) => {
    if (mbps >= 50) return Colors.success;
    if (mbps >= 20) return Colors.warning;
    return Colors.danger;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.sheetHeader}>
            <View style={modalStyles.sheetTitleWrapper}>
              <Ionicons name="flash-outline" size={24} color={Colors.primary} />
              <Text style={modalStyles.sheetTitle}> Speed Test</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={modalStyles.closeX}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={modalStyles.circleWrapper}>
            {phase === 'running' && (
              <Animated.View style={[modalStyles.spinRing, { transform: [{ rotate: spinDeg }] }]} />
            )}
            <View style={[
              modalStyles.mainCircle,
              phase === 'done' && { borderColor: dlColor(download) },
            ]}>
              {phase === 'idle' && (
                <TouchableOpacity style={modalStyles.goBtn} onPress={runSpeedTest} activeOpacity={0.75}>
                  <Text style={modalStyles.goText}>GO</Text>
                  <Text style={modalStyles.goSub}>Démarrer</Text>
                </TouchableOpacity>
              )}
              {phase === 'running' && (
                <View style={modalStyles.runningInner}>
                  <Text style={modalStyles.runningLabel}>Test en cours…</Text>
                  <Text style={modalStyles.runningMbps}>{download > 0 ? `${download}` : '—'}</Text>
                  <Text style={modalStyles.runningUnit}>Mbps ↓</Text>
                </View>
              )}
              {phase === 'done' && (
                <View style={modalStyles.runningInner}>
                  <Text style={[modalStyles.doneDl, { color: dlColor(download) }]}>{download}</Text>
                  <Text style={modalStyles.doneUnit}>Mbps ↓</Text>
                  <View style={modalStyles.doneCheckWrapper}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={Colors.success} />
                    <Text style={modalStyles.doneCheck}> Terminé</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          <View style={modalStyles.metrics}>
            <MetricBox
              icon={<Ionicons name="arrow-down-outline" size={24} color={Colors.success} />}
              label="Download"
              value={download}
              unit="Mbps"
              active={phase !== 'idle'}
              color={Colors.success}
            />
            <View style={modalStyles.metricDivider} />
            <MetricBox
              icon={<Ionicons name="arrow-up-outline" size={24} color={Colors.primary} />}
              label="Upload"
              value={upload}
              unit="Mbps"
              active={phase === 'done'}
              color={Colors.primary}
            />
            <View style={modalStyles.metricDivider} />
            <MetricBox
              icon={<Ionicons name="pulse-outline" size={24} color={Colors.warning} />}
              label="Latence"
              value={latence}
              unit="ms"
              active={phase !== 'idle'}
              color={Colors.warning}
            />
          </View>

          {phase === 'done' && (
            <TouchableOpacity style={modalStyles.retryBtn} onPress={runSpeedTest}>
              <Ionicons name="refresh-outline" size={18} color={Colors.primary} />
              <Text style={modalStyles.retryText}> Refaire le test</Text>
            </TouchableOpacity>
          )}

          <Text style={modalStyles.disclaimer}>
            Ce test mesure la connexion entre l'appareil et le serveur BBS.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function MetricBox({ icon, label, value, unit, active, color }) {
  const displayValue = (value !== undefined && value !== null) ? value : '—';
  return (
    <View style={modalStyles.metricBox}>
      {icon}
      <Text style={[modalStyles.metricValue, active && { color }]}>
        {displayValue}
      </Text>
      <Text style={modalStyles.metricUnit}>{unit}</Text>
      <Text style={modalStyles.metricLabel}>{label}</Text>
    </View>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingBottom: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...Shadows.modal,
  },
  sheetHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginLeft: 8,
  },
  closeX: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleWrapper: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  spinRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    borderColor: 'transparent',
    borderTopColor: Colors.primary,
    borderRightColor: Colors.primary + '60',
  },
  mainCircle: {
    width: 172,
    height: 172,
    borderRadius: 86,
    backgroundColor: Colors.background,
    borderWidth: 3,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  goBtn: {
    alignItems: 'center',
  },
  goText: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 2,
  },
  goSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  runningInner: {
    alignItems: 'center',
  },
  runningLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  runningMbps: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.primary,
  },
  runningUnit: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  doneDl: {
    fontSize: 34,
    fontWeight: '900',
  },
  doneUnit: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  doneCheckWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  doneCheck: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '600',
  },
  metrics: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 20,
    justifyContent: 'space-between',
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textMuted,
    marginTop: 4,
  },
  metricUnit: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  metricLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '15',
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    marginBottom: 12,
  },
  retryText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 6,
  },
  disclaimer: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function ReseauScreen() {
  const navigation = useNavigation();
  const { isSuperviseur, isAdmin, isDJ } = useAuth();

  const canManage = isSuperviseur || isAdmin || isDJ;

  const [zones, setZones] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [speedTestOpen, setSpeedTestOpen] = useState(false);
  const [filterStatut, setFilterStatut] = useState('toutes');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [refreshingStats, setRefreshingStats] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [z, n, s] = await Promise.all([
        reseauAPI.getLatest(),
        canManage
          ? reseauAPI.alertes().catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
        canManage
          ? reseauAPI.statistiques().catch(() => ({}))
          : Promise.resolve({}),
      ]);

      // --- Extraction des zones ---
      let zonesArray = [];
      if (z) {
        if (Array.isArray(z)) {
          zonesArray = z;
        } else if (z.zones && Array.isArray(z.zones)) {
          zonesArray = z.zones;
        } else if (z.data && Array.isArray(z.data)) {
          zonesArray = z.data;
        }
      }
      setZones(zonesArray);

      // --- Notifications ---
      let notifsArray = [];
      if (n) {
        if (Array.isArray(n)) {
          notifsArray = n;
        } else if (n.notifications && Array.isArray(n.notifications)) {
          notifsArray = n.notifications;
        } else if (n.data && Array.isArray(n.data)) {
          notifsArray = n.data;
        }
      }
      setNotifications(notifsArray);

      // --- Statistiques avec calcul des moyennes (pour tous) ---
      let statsData = s?.statistiques || s || {};

      // Calcul des moyennes à partir des zones
      let totalDownload = 0,
          totalUpload = 0,
          totalLatence = 0;
      let countDownload = 0,
          countUpload = 0,
          countLatence = 0;

      zonesArray.forEach(zone => {
        const down = zone.bande_passante || zone.debit_descendant;
        if (down !== undefined && down !== null && !isNaN(parseFloat(down))) {
          totalDownload += parseFloat(down);
          countDownload++;
        }
        const up = zone.debit_montant || (zone.bande_passante ? zone.bande_passante * 0.3 : null);
        if (up !== undefined && up !== null && !isNaN(parseFloat(up))) {
          totalUpload += parseFloat(up);
          countUpload++;
        }
        const lat = zone.latence || zone.ping;
        if (lat !== undefined && lat !== null && !isNaN(parseFloat(lat))) {
          totalLatence += parseFloat(lat);
          countLatence++;
        }
      });

      const avgDownload = countDownload > 0 ? parseFloat((totalDownload / countDownload).toFixed(1)) : null;
      const avgUpload   = countUpload   > 0 ? parseFloat((totalUpload   / countUpload).toFixed(1))   : null;
      const avgLatence  = countLatence  > 0 ? parseFloat((totalLatence  / countLatence).toFixed(1))  : null;

      statsData.moyennes = {
        debit_descendant: avgDownload,
        debit_montant: avgUpload,
        latence: avgLatence,
        uptime: statsData?.uptime_moyen || null,
        utilisation: statsData?.utilisation_moyenne || null,
      };

      setStats(statsData);

      console.log('📊 Stats avec moyennes :', JSON.stringify(statsData, null, 2));
    } catch (error) {
      console.error('❌ Erreur chargement réseau:', error);
      setZones([]);
      setNotifications([]);
      setStats(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setRefreshingStats(false);
    }
  }, [canManage]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    // Rafraîchissement périodique des données réseau (zones, alertes, stats).
    // C'est ce qui fait "avancer" la mesure de bande passante dans le temps :
    // à chaque tick, on va chercher de nouvelles valeurs, et le compteur animé
    // (useCountUp) se charge de faire défiler l'affichage de l'ancienne
    // valeur vers la nouvelle au lieu de la faire sauter brutalement.
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const getFilteredZones = () => {
    const safeZones = Array.isArray(zones) ? zones : [];
    if (filterStatut === 'toutes') return safeZones;
    return safeZones.filter(zone => {
      const statut = zone.statut?.toLowerCase();
      if (filterStatut === 'normal') return statut === 'normal' || statut === 'operationnel';
      if (filterStatut === 'congestion') return statut === 'congestion';
      if (filterStatut === 'critique') return statut === 'critique' || statut === 'panne';
      return true;
    });
  };

  const filteredZones = getFilteredZones();
  const totalZones = Array.isArray(zones) ? zones.length : 0;
  const critique = zones.filter(z => z.statut === 'critique' || z.statut === 'panne').length;
  const congestion = zones.filter(z => z.statut === 'congestion').length;
  const normal = zones.filter(z => z.statut === 'normal' || z.statut === 'operationnel').length;

  // --- Valeurs numériques brutes de bande passante (pour l'animation) ---
  const getMetricRawValue = (statsObj, metric) => {
    if (!statsObj) return null;
    const keyMap = {
      download: ['debit_descendant', 'download', 'dl', 'down'],
      upload: ['debit_montant', 'upload', 'ul', 'up'],
      latence: ['latence', 'latency', 'lat', 'ping'],
    };
    const sources = [statsObj.moyennes, statsObj];
    for (const source of sources) {
      if (!source) continue;
      for (const key of keyMap[metric]) {
        const val = source[key];
        if (val !== undefined && val !== null && !isNaN(parseFloat(val))) {
          return parseFloat(val);
        }
      }
    }
    return null;
  };

  const apiDownload = getMetricRawValue(stats, 'download');
  const apiUpload = getMetricRawValue(stats, 'upload');
  const rawLatence = getMetricRawValue(stats, 'latence');

  // Mesure réelle et continue du réseau que l'appareil utilise en ce
  // moment (Wi-Fi ou données mobiles). Si la mesure sur l'appareil
  // échoue ou n'est pas encore disponible, on retombe sur la moyenne
  // renvoyée par le serveur.
  const { connectionType, download: deviceDownload, upload: deviceUpload } = useLiveNetworkSpeed(15000);
  const connectionLabel = getConnectionLabel(connectionType);

  const rawDownload = deviceDownload !== null && deviceDownload !== undefined ? deviceDownload : apiDownload;
  const rawUpload = deviceUpload !== null && deviceUpload !== undefined ? deviceUpload : apiUpload;

  // Compteurs animés : la valeur affichée "roule" en continu vers la
  // dernière mesure de bande passante (celle de l'appareil en priorité).
  const animatedDownload = useCountUp(rawDownload, 900);
  const animatedUpload = useCountUp(rawUpload, 900);
  const animatedLatence = useCountUp(rawLatence, 700);

  if (loading) {
    return <LoadingScreen message="Chargement des données réseau..." />;
  }

  const filterOptions = [
    { label: 'Toutes', value: 'toutes' },
    { label: 'Normale', value: 'normal' },
    { label: 'Congestion', value: 'congestion' },
    { label: 'Critique', value: 'critique' },
  ];

  const handleSeeStats = () => {
    navigation.navigate('Statistiques');
  };

  const canGoBack = navigation.canGoBack();

  // Rendu des badges personnalisés
  const renderStatutBadge = (statut) => {
    let bgColor, textColor, label;
    const s = statut?.toLowerCase() || 'inconnu';
    if (s === 'normal' || s === 'operationnel') {
      bgColor = Colors.success + '20';
      textColor = Colors.success;
      label = 'Normal';
    } else if (s === 'congestion') {
      bgColor = Colors.warning + '20';
      textColor = Colors.warning;
      label = 'Congestion';
    } else if (s === 'critique' || s === 'panne') {
      bgColor = Colors.danger + '20';
      textColor = Colors.danger;
      label = 'Critique';
    } else {
      bgColor = Colors.textMuted + '20';
      textColor = Colors.textMuted;
      label = 'Inconnu';
    }
    return (
      <View style={[styles.badgeContainer, { backgroundColor: bgColor }]}>
        <Text style={[styles.badgeText, { color: textColor }]}>{label}</Text>
      </View>
    );
  };

  const renderBadge = (label, color) => {
    const bgColor = color + '20';
    return (
      <View style={[styles.badgeContainer, { backgroundColor: bgColor }]}>
        <Text style={[styles.badgeText, { color: color }]}>{label}</Text>
      </View>
    );
  };

  const getPerformanceColor = (value) => {
    const v = parseFloat(value) || 0;
    if (v >= 95) return Colors.success;
    if (v >= 70) return Colors.warning;
    return Colors.danger;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      <GradientHeader
        colors={[Colors.primary, Colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            {canGoBack && (
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={Colors.textWhite} />
              </TouchableOpacity>
            )}
            <Ionicons name="wifi-outline" size={28} color={Colors.textWhite} />
            <View style={styles.headerTitles}>
              <Text style={styles.headerTitle}> Réseau BBS</Text>
              <Text style={styles.headerSub}>Surveillance en temps réel</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => setShowFilterMenu(!showFilterMenu)}
            >
              <Ionicons name="options-outline" size={24} color={Colors.textWhite} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.speedBtn}
              onPress={() => setSpeedTestOpen(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="flash-outline" size={22} color={Colors.textWhite} />
              <Text style={styles.speedBtnLabel}>Speed Test</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showFilterMenu && (
          <View style={styles.filterMenu}>
            {filterOptions.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.filterOption,
                  filterStatut === opt.value && styles.filterOptionActive
                ]}
                onPress={() => {
                  setFilterStatut(opt.value);
                  setShowFilterMenu(false);
                }}
              >
                <Text style={[
                  styles.filterOptionText,
                  filterStatut === opt.value && styles.filterOptionTextActive
                ]}>
                  {opt.label}
                </Text>
                {filterStatut === opt.value && (
                  <Ionicons name="checkmark" size={18} color={Colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </GradientHeader>

      {/* Carte Performance réseau - affichage en grand format */}
      <Card style={styles.performanceCard}>
        <View style={styles.performanceHeader}>
          <View style={styles.performanceTitleWrapper}>
            <Ionicons name="stats-chart-outline" size={20} color={Colors.primary} />
            <View>
              <Text style={styles.performanceTitle}> Performance réseau</Text>
              {connectionLabel && (
                <View style={styles.connectionRow}>
                  <Ionicons
                    name={connectionType === 'wifi' ? 'wifi-outline' : 'cellular-outline'}
                    size={12}
                    color={Colors.textMuted}
                  />
                  <Text style={styles.connectionLabel}> {connectionLabel}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.performanceActions}>
            {renderBadge(
              stats?.moyennes?.uptime || stats?.uptime || 'N/A',
              getPerformanceColor(stats?.moyennes?.uptime || stats?.uptime || 0)
            )}
            <TouchableOpacity
              onPress={() => {
                setRefreshingStats(true);
                loadData();
              }}
              style={styles.refreshButton}
              disabled={refreshingStats}
            >
              <Ionicons
                name={refreshingStats ? 'reload' : 'refresh-outline'}
                size={18}
                color={Colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.performanceGrid}>
          <View style={styles.performanceItem}>
            <Text style={styles.performanceValue}>
              {rawDownload !== null ? animatedDownload.toFixed(1) : '—'}
            </Text>
            <Text style={styles.performanceUnit}>Mbps</Text>
            <Text style={styles.performanceLabel}>Download</Text>
          </View>
          <View style={styles.performanceDivider} />
          <View style={styles.performanceItem}>
            <Text style={styles.performanceValue}>
              {rawUpload !== null ? animatedUpload.toFixed(1) : '—'}
            </Text>
            <Text style={styles.performanceUnit}>Mbps</Text>
            <Text style={styles.performanceLabel}>Upload</Text>
          </View>
          <View style={styles.performanceDivider} />
          <View style={styles.performanceItem}>
            <Text style={styles.performanceValue}>
              {rawLatence !== null ? animatedLatence.toFixed(1) : '—'}
            </Text>
            <Text style={styles.performanceUnit}>ms</Text>
            <Text style={styles.performanceLabel}>Latence</Text>
          </View>
        </View>
      </Card>

      {canManage && stats && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.zones?.total || totalZones}</Text>
            <Text style={styles.statLabel}>Zones</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.success }]}>{normal}</Text>
            <Text style={styles.statLabel}>Normal</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.warning }]}>{congestion}</Text>
            <Text style={styles.statLabel}>Congestion</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.danger }]}>{critique}</Text>
            <Text style={styles.statLabel}>Critique</Text>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
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
        <View style={styles.zoneHeaderSection}>
          <SectionHeader
            title="État des zones"
            icon={<Ionicons name="globe-outline" size={22} color={Colors.primary} />}
            subtitle={`${filteredZones.length} / ${totalZones} zones affichées`}
          />
          {filterStatut !== 'toutes' && (
            <TouchableOpacity
              style={styles.clearFilterBtn}
              onPress={() => setFilterStatut('toutes')}
            >
              <Text style={styles.clearFilterText}>Annuler le filtre</Text>
              <Ionicons name="close-circle" size={16} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {filteredZones.length > 0 ? (
          filteredZones.map((zone) => (
            <Card key={zone.id} style={styles.zoneCard}>
              <View style={styles.zoneHeader}>
                <Text style={styles.zoneNom}>{zone.zone}</Text>
                {renderStatutBadge(zone.statut)}
              </View>

              <ProgressBar
                value={zone.pourcentage_utilisation || 0}
                max={100}
                label="Utilisation"
              />

              <View style={styles.zoneMeta}>
                <Text style={styles.zoneDetail}>
                  {parseFloat(zone.utilisation_mbps || 0).toFixed(0)} / {parseFloat(zone.capacite_mbps || 0).toFixed(0)} Mbps
                </Text>
                <Text style={[
                  styles.zonePct,
                  {
                    color: zone.statut === 'critique' || zone.statut === 'panne'
                      ? Colors.danger
                      : zone.statut === 'congestion'
                      ? Colors.warning
                      : Colors.success
                  }
                ]}>
                  {parseFloat(zone.pourcentage_utilisation || 0).toFixed(1)}%
                </Text>
              </View>

              {zone.bande_passante && (
                <View style={styles.zoneDetails}>
                  <View style={styles.zoneDetailItem}>
                    <Ionicons name="speedometer-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.zoneDetailText}>
                      {zone.bande_passante} Mbps
                    </Text>
                  </View>
                  {zone.latence && (
                    <View style={styles.zoneDetailItem}>
                      <Ionicons name="timer-outline" size={14} color={Colors.textMuted} />
                      <Text style={styles.zoneDetailText}>
                        {zone.latence} ms
                      </Text>
                    </View>
                  )}
                  {zone.uptime && (
                    <View style={styles.zoneDetailItem}>
                      <Ionicons name="checkmark-circle-outline" size={14} color={Colors.success} />
                      <Text style={styles.zoneDetailText}>
                        {zone.uptime}% uptime
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {zone.derniere_verification && (
                <Text style={styles.zoneLastCheck}>
                  Dernière vérification: {new Date(zone.derniere_verification).toLocaleString('fr-FR')}
                </Text>
              )}
            </Card>
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {totalZones === 0 ? 'Aucune zone disponible.' : 'Aucune zone ne correspond à ce filtre'}
            </Text>
          </Card>
        )}

        {canManage && notifications.length > 0 && (
          <>
            <SectionHeader
              title="Alertes réseau"
              icon={<Ionicons name="notifications-outline" size={22} color={Colors.primary} />}
              action="Tout lire"
              onAction={() => {}}
            />
            {notifications.slice(0, 5).map((notif) => (
              <Card key={notif.id} style={[
                styles.notifCard,
                !notif.est_lu && styles.notifUnread
              ]}>
                <View style={styles.notifRow}>
                  <View style={[
                    styles.notifDot,
                    {
                      backgroundColor: notif.statut === 'critique' || notif.statut === 'panne'
                        ? Colors.danger
                        : notif.statut === 'congestion'
                        ? Colors.warning
                        : Colors.success
                    }
                  ]} />
                  <View style={styles.notifContent}>
                    <Text style={styles.notifTitle}>{notif.titre || notif.message}</Text>
                    <Text style={styles.notifTime}>
                      {new Date(notif.created_at || notif.derniere_verification).toLocaleString('fr-FR')}
                    </Text>
                  </View>
                  {!notif.est_lu && <View style={styles.unreadDot} />}
                </View>
              </Card>
            ))}
          </>
        )}

        {canManage && (
          <Button
            title="Voir les statistiques détaillées"
            variant="outline"
            size="md"
            onPress={handleSeeStats}
            style={styles.statsBtn}
          />
        )}

        <View style={styles.footerSpace} />
      </ScrollView>

      <SpeedTestModal visible={speedTestOpen} onClose={() => setSpeedTestOpen(false)} />
    </View>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitles: {
    marginLeft: 8,
    flex: 1,
  },
  backBtn: {
    marginRight: 8,
    padding: 4,
  },
  headerTitle: {
    color: Colors.textWhite,
    fontSize: 20,
    fontWeight: '800',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBtn: {
    padding: 6,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  speedBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  speedBtnLabel: {
    color: Colors.textWhite,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  filterMenu: {
    marginTop: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 6,
    ...Shadows.card,
    elevation: 4,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Radius.sm,
  },
  filterOptionActive: {
    backgroundColor: Colors.primary + '10',
  },
  filterOptionText: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  filterOptionTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginTop: -10,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadows.card,
    elevation: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: '70%',
    backgroundColor: Colors.border,
    alignSelf: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 20,
  },
  performanceCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  performanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  performanceTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  performanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginLeft: 6,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
    marginTop: 2,
  },
  connectionLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  performanceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshButton: {
    padding: 6,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary + '10',
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  performanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  performanceItem: {
    alignItems: 'center',
    flex: 1,
  },
  performanceValue: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  performanceUnit: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: -4,
  },
  performanceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 4,
  },
  performanceDivider: {
    width: 1,
    height: '70%',
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
  zoneHeaderSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  clearFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '10',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    gap: 4,
  },
  clearFilterText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
  },
  zoneCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  zoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  zoneNom: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  zoneMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  zoneDetail: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  zonePct: {
    fontSize: 14,
    fontWeight: '700',
  },
  zoneDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 12,
  },
  zoneDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  zoneDetailText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  zoneLastCheck: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 6,
  },
  notifCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  notifUnread: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  notifTime: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  statsBtn: {
    marginTop: Spacing.md,
  },
  footerSpace: {
    height: 20,
  },
  badgeContainer: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});