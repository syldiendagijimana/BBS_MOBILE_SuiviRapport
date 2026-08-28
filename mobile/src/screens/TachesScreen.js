// src/screens/TachesScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, StatusBar } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { techniciensAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Card, Badge, Button, Input, Selector, EmptyState, LoadingScreen, PrioriteBadge, StatutBadge } from '../components';
import { Colors, Spacing, Typography, Radius } from '../theme';
import Ionicons from 'react-native-vector-icons/Ionicons';

const PRIORITES = [{ label: 'Basse', value: 'basse' }, { label: 'Normale', value: 'normale' }, { label: 'Haute', value: 'haute' }, { label: 'Critique', value: 'critique' }];

export default function TachesScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { technicienId, technicienNom } = route.params || {};
  const { canManageTechniciens } = useAuth();
  const [taches, setTaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [zone, setZone] = useState('');
  const [priorite, setPriorite] = useState('normale');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { const d = await techniciensAPI.missions(technicienId); setTaches(d); }
    catch (e) { Alert.alert('Erreur', e.message); }
    finally { setLoading(false); }
  }, [technicienId]);

  useEffect(() => { load(); }, [load]);

  async function handleAffecter() {
    if (!titre.trim()) { Alert.alert('Erreur', 'Titre requis'); return; }
    setSaving(true);
    try {
      await techniciensAPI.affecterTache(technicienId, { titre, description, zone, priorite });
      setShowModal(false); setTitre(''); setDescription(''); setZone(''); setPriorite('normale');
      load();
    } catch (e) { Alert.alert('Erreur', e.message); }
    finally { setSaving(false); }
  }

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Ionicons
          name="arrow-back-outline"
          size={24}
          color={Colors.textWhite}
        />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Missions</Text>
          <Text style={styles.headerSub}>{technicienNom}</Text>
        </View>
        {canManageTechniciens && (
          <TouchableOpacity onPress={() => setShowModal(true)} style={styles.addBtn}>
          <Ionicons
            name="add-circle-outline"
            size={24}
            color={Colors.textWhite}
          />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={taches}
        keyExtractor={i => i.id.toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title="Aucune mission" subtitle="Aucune tâche affectée à ce technicien" icon="📑" />}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.tacheHeader}>
              <Text style={styles.tacheTitre}>{item.titre}</Text>
              <StatutBadge statut={item.statut} />
            </View>
            {item.description && <Text style={styles.tacheDesc}>{item.description}</Text>}
            <View style={styles.tacheMeta}>
              <PrioriteBadge priorite={item.priorite} />
              {item.zone && <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons
                                name="location-outline"
                                size={14}
                                color={Colors.danger}
                              />
                              <Text style={[styles.tacheZone, { marginLeft: 4 }]}>
                                {item.zone}
                              </Text>
                            </View>
              }
            </View>
          </Card>
        )}
      />

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Nouvelle mission</Text>
            <Input label="Titre" value={titre} onChangeText={setTitre} placeholder="Titre de la tâche" />
            <Input label="Description" value={description} onChangeText={setDescription} placeholder="Détails..." multiline numberOfLines={3} />
            <Input label="Zone" value={zone} onChangeText={setZone} placeholder="Zone Nord" />
            <Selector label="Priorité" value={priorite} options={PRIORITES} onChange={setPriorite} />
            <Button title={saving ? 'Enregistrement...' : 'Affecter'} onPress={handleAffecter} loading={saving} />
            <Button title="Annuler" onPress={() => setShowModal(false)} variant="ghost" style={{ marginTop: 8 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
     flex: 1,
     backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
     color: Colors.textWhite,
     fontSize: 24 },

  headerTitle: {
     color: Colors.textWhite,
     fontSize: 18,
     fontWeight: '700' },

  headerSub: {
       color: 'rgba(255,255,255,0.75)',
       fontSize: 12 },

  addBtn: {
     backgroundColor: 'rgba(255,255,255,0.2)',
     width: 36,
     height: 36,
     borderRadius: 18,
     alignItems: 'center',
     justifyContent: 'center' },
  addIcon: {
     color: Colors.textWhite,
     fontSize: 24,
     lineHeight: 36 },

  list: {
      padding: Spacing.lg },

  tacheHeader: {
       flexDirection: 'row',
       justifyContent: 'space-between',
       alignItems: 'flex-start',
       marginBottom: 6 },

  tacheTitre: {
     ...Typography.h4,
     flex: 1,
     marginRight: 8 },

  tacheDesc: {
     ...Typography.body,
     fontSize: 13,
     marginBottom: 8 },

  tacheMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8 },

  tacheZone: {
     fontSize: 12,
     color: Colors.textMuted },

  modalOverlay: {
     flex: 1,
     backgroundColor: 'rgba(0,0,0,0.5)',
     justifyContent: 'flex-end' },

  modal: {
       backgroundColor: Colors.surface,
       borderTopLeftRadius: 24,
       borderTopRightRadius: 24,
       padding: Spacing.xxl,
       paddingBottom: 40 },

  modalTitle: {
     ...Typography.h2,
     marginBottom: Spacing.xl },
});
