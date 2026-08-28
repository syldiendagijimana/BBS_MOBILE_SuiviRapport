import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Image,
  Alert,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  ScrollView,
  Dimensions,
  Clipboard,
  PermissionsAndroid,
  FlatList, // ✅ On revient à une FlatList classique
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import EmojiSelector from 'react-native-emoji-selector';
import RNFS from 'react-native-fs';

import { useAuth } from '../context/AuthContext';
import { messagesAPI } from '../services/messagesAPI';
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';

const { width: SW } = Dimensions.get('window');

// =========================================================
// CONSTANTES
// =========================================================

const WA = {
  headerBg: '#075E54',
  headerDark: '#054C44',
  bubbleMoi: '#DCF8C6',
  bubbleAutre: '#FFFFFF',
  fond: '#ECE5DD',
  inputBg: '#FFFFFF',
  sendBtn: '#128C7E',
  online: '#4CAF50',
  textMain: '#111827',
  textSub: '#6B7280',
  textMuted: '#9CA3AF',
  heure: '#8696A0',
  cocheLu: '#34B7F1',
  cocheGris: '#8696A0',
  danger: '#EF4444',
  replyBg: 'rgba(0,0,0,0.06)',
};

const ROLE_COULEURS = {
  admin: '#B91C1C',
  dj: '#059669',
  superviseur: '#1D4ED8',
  technicien: '#7C3AED',
};

const EMOJIS_REACTION = ['❤️', '😂', '😮', '👍', '🔥', '😢'];

// =========================================================
// HELPERS
// =========================================================

function roleColor(role) {
  return ROLE_COULEURS[(role || '').toLowerCase()] || '#555';
}

function nomComplet(nom, prenom) {
  return [prenom, nom].filter(Boolean).join(' ') || 'Inconnu';
}

function initiales(nom, prenom) {
  const p = (prenom || '')[0] || '';
  const n = (nom || '')[0] || '';
  return (p + n).toUpperCase() || '?';
}

function hhmm(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function labelDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const hier = new Date(now);
  hier.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "AUJOURD'HUI";
  if (d.toDateString() === hier.toDateString()) return 'HIER';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// =========================================================
// PERMISSIONS ANDROID
// =========================================================

async function permGalerie() {
  if (Platform.OS !== 'android') return true;
  const p = Platform.Version >= 33
    ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
    : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
  const r = await PermissionsAndroid.request(p, {
    title: 'Accès galerie',
    message: 'Autoriser l\'accès aux photos ?',
    buttonPositive: 'Autoriser',
    buttonNegative: 'Refuser',
  });
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

async function permCamera() {
  if (Platform.OS !== 'android') return true;
  const r = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.CAMERA,
    {
      title: 'Caméra',
      message: 'Autoriser la caméra ?',
      buttonPositive: 'Autoriser',
      buttonNegative: 'Refuser',
    }
  );
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

async function permMicrophone() {
  if (Platform.OS !== 'android') return true;
  const r = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microphone',
      message: 'Autoriser l\'enregistrement audio ?',
      buttonPositive: 'Autoriser',
      buttonNegative: 'Refuser',
    }
  );
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

// =========================================================
// COMPOSANTS
// =========================================================

const Avatar = React.memo(function Avatar({ nom, prenom, role, size = 38 }) {
  const c = roleColor(role);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: c }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>
        {initiales(nom, prenom)}
      </Text>
    </View>
  );
});

function Coches({ status }) {
  if (status === 'seen') return <Text style={{ color: WA.cocheLu, fontSize: 13 }}>✓✓</Text>;
  if (status === 'delivered') return <Text style={{ color: WA.cocheGris, fontSize: 13 }}>✓✓</Text>;
  return <Text style={{ color: WA.cocheGris, fontSize: 13 }}>✓</Text>;
}

const DateSep = React.memo(function DateSep({ label }) {
  return (
    <View style={styles.dateSepWrap}>
      <View style={styles.dateSepBulle}>
        <Text style={styles.dateSepTxt}>{label}</Text>
      </View>
    </View>
  );
});

const BulleReply = React.memo(function BulleReply({ msg, estMoi }) {
  if (!msg) return null;
  const auteur = nomComplet(msg.nom, msg.prenom);
  const c = roleColor(msg.role);
  return (
    <View style={[styles.replyBox, { borderLeftColor: c }]}>
      <Text style={[styles.replyAuteur, { color: c }]}>{auteur}</Text>
      <Text style={styles.replyTxt} numberOfLines={1}>
        {msg.type_message !== 'texte' ? `📎 ${msg.type_message}` : (msg.contenu || '')}
      </Text>
    </View>
  );
});

const MediaInline = React.memo(function MediaInline({ media, onPress }) {
  if (!media || media.length === 0) return null;
  return (
    <View style={styles.mediaGrid}>
      {media.map((m, i) => {
        const uri = m.url || m.chemin;
        if (!uri) return null;
        if (m.type_fichier === 'image') {
          return (
            <TouchableOpacity key={i} onPress={() => onPress(uri)}>
              <Image source={{ uri }} style={styles.mediaImg} resizeMode="cover" />
            </TouchableOpacity>
          );
        }
        if (m.type_fichier === 'video') {
          return (
            <TouchableOpacity key={i} style={styles.mediaVideo} onPress={() => onPress(uri)}>
              <Text style={styles.mediaVideoIcon}>▶</Text>
            </TouchableOpacity>
          );
        }
        return null;
      })}
    </View>
  );
});

const Reactions = React.memo(function Reactions({ reactions }) {
  if (!reactions || typeof reactions !== 'object' || reactions.length === 0) return null;
  const counts = {};
  reactions.forEach(r => {
    if (r && r.reaction) {
      counts[r.reaction] = (counts[r.reaction] || 0) + 1;
    }
  });
  if (Object.keys(counts).length === 0) return null;
  return (
    <View style={styles.reactionsRow}>
      {Object.entries(counts).map(([emoji, n]) => (
        <View key={emoji} style={styles.reactionChip}>
          <Text style={styles.reactionEmoji}>{emoji}</Text>
          {n > 1 && <Text style={styles.reactionCount}>{String(n)}</Text>}
        </View>
      ))}
    </View>
  );
});

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function MessagesScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const monId = user?.id ? String(user.id) : null;

  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState('');
  const [loading, setLoading] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [replyMsg, setReplyMsg] = useState(null);
  const [editMsg, setEditMsg] = useState(null);
  const [menuMsg, setMenuMsg] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [imgUri, setImgUri] = useState(null);
  const [imgVisible, setImgVisible] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [rechercheOn, setRechercheOn] = useState(false);
  const [membresVis, setMembresVis] = useState(false);
  const [recording, setRecording] = useState(false);

  // Mode Sélection & Emoji
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);

  const flatRef = useRef(null);
  const pollingRef = useRef(null);
  const mounted = useRef(true);
  const audioRecorderPlayer = useRef(new AudioRecorderPlayer()).current;

  // =========================================================
  // CHARGEMENT DES MESSAGES
  // =========================================================

  const charger = useCallback(async (silencieux = false) => {
    try {
      const data = await messagesAPI.getGroupe({ limit: 200 });
      if (!mounted.current) return;
      setMessages(Array.isArray(data?.data) ? data.data : []);
    } catch (error) {
      if (!silencieux) console.error('[MessagesScreen] charger:', error.message);
    } finally {
      if (!silencieux && mounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    charger(false).then(() => {
      setTimeout(() => flatRef.current?.scrollToEnd?.({ animated: false }), 100);
    });

    pollingRef.current = setInterval(() => charger(true), 5000);

    return () => {
      mounted.current = false;
      clearInterval(pollingRef.current);
    };
  }, [charger]);

  // =========================================================
  // ENVOI DE MESSAGE TEXTE
  // =========================================================

  const handleEnvoyer = useCallback(async () => {
    const t = texte.trim();
    if (!t || envoi) return;

    if (editMsg) {
      setTexte('');
      setEditMsg(null);
      try {
        await messagesAPI.update(editMsg.id, t);
        await charger(true);
      } catch (e) {
        Alert.alert('Erreur', 'Impossible de modifier le message.');
      }
      return;
    }

    setTexte('');
    setReplyMsg(null);
    setEnvoi(true);

    const opt = {
      id: `opt_${Date.now()}`,
      expediteur_id: monId,
      contenu: t,
      type_message: 'texte',
      est_lu: 0,
      est_modifie: 0,
      est_supprime: 0,
      created_at: new Date().toISOString(),
      nom: user?.nom || '',
      prenom: user?.prenom || '',
      role: user?.role || 'technicien',
      medias: [],
      reactions: [],
      _opt: true,
    };
    setMessages(prev => [...prev, opt]);
    setTimeout(() => flatRef.current?.scrollToEnd?.({ animated: true }), 60);

    try {
      const nouveau = await messagesAPI.sendGroupe(t, 'texte', replyMsg?.id || null);
      if (mounted.current) {
        setMessages(prev => prev.map(m => m.id === opt.id ? nouveau.data : m));
      }
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== opt.id));
      setTexte(t);
      Alert.alert('Erreur', 'Impossible d\'envoyer le message.');
    } finally {
      if (mounted.current) setEnvoi(false);
    }
  }, [texte, envoi, editMsg, replyMsg, monId, user, charger]);

  // =========================================================
  // ENVOI DE MÉDIA & AUDIO
  // =========================================================

  const envoyerMedia = useCallback(async (asset, type = 'image') => {
    const typeMessage = type === 'image' ? 'photo' : type;
    try {
      const msg = await messagesAPI.sendGroupe('📎 Fichier joint', typeMessage);
      if (msg?.data?.id) {
        if (typeMessage === 'photo') {
          await messagesAPI.sendPhoto(msg.data.id, asset.uri);
        } else if (typeMessage === 'video') {
          await messagesAPI.sendVideo(msg.data.id, asset.uri);
        }
        await charger(true);
      }
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d\'envoyer le fichier.');
    }
  }, [charger]);

  const ouvrirGalerie = useCallback(async () => {
    const ok = await permGalerie();
    if (!ok) { Alert.alert('Permission refusée'); return; }
    const r = await launchImageLibrary({ mediaType: 'mixed', quality: 0.8, selectionLimit: 1 });
    if (!r.didCancel && r.assets?.[0]) {
      const a = r.assets[0];
      const type = a.type?.startsWith('video') ? 'video' : 'image';
      envoyerMedia(a, type);
    }
  }, [envoyerMedia]);

  const ouvrirCamera = useCallback(async () => {
    const ok = await permCamera();
    if (!ok) { Alert.alert('Permission refusée'); return; }
    const r = await launchCamera({ mediaType: 'photo', quality: 0.8, saveToPhotos: true });
    if (!r.didCancel && r.assets?.[0]) envoyerMedia(r.assets[0], 'image');
  }, [envoyerMedia]);

  const startRecording = useCallback(async () => {
    const ok = await permMicrophone();
    if (!ok) {
      Alert.alert('Permission refusée', 'Impossible d\'enregistrer sans permission microphone.');
      return;
    }
    try {
      const path = Platform.select({
        ios: `${RNFS.DocumentDirectoryPath}/audio_${Date.now()}.m4a`,
        android: `${RNFS.CacheDirectoryPath}/audio_${Date.now()}.mp4`,
      });
      const uri = await audioRecorderPlayer.startRecorder(path);
      audioRecorderPlayer.addRecordBackListener(() => {});
      setRecording(true);
    } catch (e) {
      console.log('startRecording error', e);
      Alert.alert('Erreur', 'Impossible de démarrer l\'enregistrement.');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    try {
      const result = await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
      setRecording(false);
      if (!result) {
        Alert.alert('Erreur', 'Aucun fichier audio enregistré.');
        return;
      }
      const msg = await messagesAPI.sendGroupe('🎤 Audio', 'audio');
      if (msg?.data?.id) {
        await messagesAPI.sendAudio(msg.data.id, result);
        await charger(true);
      }
    } catch (e) {
      console.log('stopRecording error', e);
      Alert.alert('Erreur', 'Échec de l\'envoi audio. Vérifiez votre connexion.');
    }
  }, [charger]);

  // =========================================================
  // GESTION DE LA SÉLECTION MULTIPLE
  // =========================================================

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedIds(new Set());
    setMenuVisible(false);
  };

  const toggleItemSelection = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    Alert.alert(
      `Supprimer ${ids.length} message(s)`,
      `Voulez-vous vraiment supprimer ces messages ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await messagesAPI.deleteBatch(ids);
              setMessages(prev => prev.filter(m => !ids.includes(m.id)));
              setSelectedIds(new Set());
              setSelectionMode(false);
            } catch (e) {
              Alert.alert('Erreur', 'Impossible de supprimer les messages sélectionnés.');
            }
          }
        }
      ]
    );
  };

  // =========================================================
  // ACTIONS SUR LES MESSAGES (Menu contextuel)
  // =========================================================

  const handleReact = useCallback(async (id, emoji) => {
    try {
      await messagesAPI.addReaction(id, emoji);
      charger(true);
    } catch (e) { console.error(e); }
    setMenuVisible(false);
  }, [charger]);

  const handleDelete = useCallback(async (id) => {
    Alert.alert('Supprimer', 'Supprimer ce message ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await messagesAPI.delete(id);
            setMessages(prev => prev.filter(m => String(m.id) !== String(id)));
          } catch (e) {
            Alert.alert('Erreur', 'Impossible de supprimer.');
          }
          setMenuVisible(false);
        },
      },
    ]);
  }, []);

  const handleCopy = useCallback((msg) => {
    if (msg.contenu) {
      Clipboard.setString(msg.contenu);
      Alert.alert('Copié', 'Message copié dans le presse-papiers.');
    }
    setMenuVisible(false);
  }, []);

  const handleEdit = useCallback((msg) => {
    setEditMsg(msg);
    setTexte(msg.contenu || '');
    setMenuVisible(false);
  }, []);

  const handleReply = useCallback((msg) => {
    setReplyMsg(msg);
    setMenuVisible(false);
  }, []);

  const handleSelectMode = useCallback((msg) => {
    setSelectionMode(true);
    setSelectedIds(new Set([msg.id]));
    setMenuVisible(false);
  }, []);

  const handleLongPress = useCallback((msg) => {
    if (selectionMode) {
      toggleItemSelection(msg.id);
    } else {
      setMenuMsg(msg);
      setMenuVisible(true);
    }
  }, [selectionMode]);

  // =========================================================
  // CONSTRUCTION DE LA LISTE
  // =========================================================

  const listeItems = useMemo(() => {
    const msgsFiltres = recherche.trim()
      ? messages.filter(m =>
          m.contenu?.toLowerCase().includes(recherche.toLowerCase()) ||
          nomComplet(m.nom, m.prenom).toLowerCase().includes(recherche.toLowerCase()))
      : messages;

    const items = [];
    let datePrev = null;
    msgsFiltres.forEach(msg => {
      const d = msg.created_at ? new Date(msg.created_at).toDateString() : '';
      if (d && d !== datePrev) {
        items.push({ type: 'date', key: `date_${d}_${msg.id}`, label: labelDate(msg.created_at) });
        datePrev = d;
      }
      items.push({ type: 'msg', key: `msg_${msg.id}`, msg });
    });
    return items;
  }, [messages, recherche]);

  const msgMap = useMemo(() => {
    const m = {};
    messages.forEach(msg => { m[String(msg.id)] = msg; });
    return m;
  }, [messages]);

  // =========================================================
  // RENDU DES ITEMS (FlatList sans bouton swipe)
  // =========================================================

  const renderItem = useCallback(({ item, index }) => {
    if (item.type === 'date') return <DateSep label={item.label} />;

    const msg = item.msg;
    const estMoi = String(msg.expediteur_id) === monId;
    const isSelected = selectedIds.has(msg.id);

    let prevMsg = null;
    for (let i = index - 1; i >= 0; i--) {
      if (listeItems[i]?.type === 'msg') { prevMsg = listeItems[i].msg; break; }
    }
    const afficherEntete = !prevMsg || prevMsg.expediteur_id !== msg.expediteur_id;

    const reactions = Array.isArray(msg.reactions) ? msg.reactions : [];

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => selectionMode && toggleItemSelection(msg.id)}
        onLongPress={() => handleLongPress(msg)}
        delayLongPress={300}
      >
        <View style={[styles.ligneMsg, estMoi ? styles.ligneMsgD : styles.ligneMsgG]}>
          {!estMoi && (
            <View style={styles.avatarCol}>
              {afficherEntete
                ? <Avatar nom={msg.nom} prenom={msg.prenom} role={msg.role} size={32} />
                : <View style={{ width: 32 }} />}
            </View>
          )}

          <View style={[styles.bulleContenu, estMoi ? styles.bulleContenuD : styles.bulleContenuG]}>
            {selectionMode && (
              <TouchableOpacity onPress={() => toggleItemSelection(msg.id)} style={styles.checkboxContainer}>
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={24}
                  color={isSelected ? Colors.primary : Colors.textMuted}
                />
              </TouchableOpacity>
            )}

            {!estMoi && afficherEntete && (
              <Text style={[styles.bulleNom, { color: roleColor(msg.role) }]}>
                {nomComplet(msg.nom, msg.prenom)}
              </Text>
            )}

            <BulleReply msg={msg.message_parent_id ? msgMap[String(msg.message_parent_id)] : null} estMoi={estMoi} />

            <View style={[styles.bulle, estMoi ? styles.bulleMoi : styles.bulleAutre, isSelected && styles.bulleSelected]}>
              {msg.medias && msg.medias.length > 0 && (
                <MediaInline media={msg.medias} onPress={(uri) => { setImgUri(uri); setImgVisible(true); }} />
              )}

              {msg.contenu && (
                <Text style={styles.bulleTxt}>
                  {String(msg.contenu)}
                  {msg.est_modifie === 1 && (
                    <Text style={styles.modifieTxt}>{' (modifié)'}</Text>
                  )}
                </Text>
              )}

              <View style={styles.bullePied}>
                <Text style={styles.bulleHeure}>{hhmm(msg.created_at)}</Text>
                {estMoi && <Coches status={msg.est_lu === 1 ? 'seen' : 'sent'} />}
              </View>
            </View>

            <Reactions reactions={reactions} />
          </View>

          {estMoi && (
            <View style={styles.avatarCol}>
              {afficherEntete
                ? <Avatar nom={msg.nom} prenom={msg.prenom} role={msg.role} size={32} />
                : <View style={{ width: 32 }} />}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [monId, listeItems, msgMap, selectionMode, selectedIds, handleDelete]);

  // =========================================================
  // MEMBRES
  // =========================================================

  const membres = useMemo(() => {
    const seen = new Set();
    const liste = [];
    messages.forEach(m => {
      if (!seen.has(m.expediteur_id)) {
        seen.add(m.expediteur_id);
        liste.push({ id: m.expediteur_id, nom: m.nom, prenom: m.prenom, role: m.role });
      }
    });
    return liste;
  }, [messages]);

  // =========================================================
  // RENDU PRINCIPAL
  // =========================================================

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={WA.headerDark} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerInfo} onPress={() => setMembresVis(!membresVis)}>
          <View style={styles.headerAvatar}>
            <Ionicons name="people" size={24} color="#FFF" />
          </View>
          <View>
            <Text style={styles.headerTitre}>BBS Groupe Officiel</Text>
            <Text style={styles.headerSub}>
              {selectionMode ? `${selectedIds.size} sélectionné(s)` : `${String(membres.length)} membre${membres.length > 1 ? 's' : ''}`}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setRechercheOn(true)}>
            <Ionicons name="search" size={22} color="#FFF" />
          </TouchableOpacity>
          {!selectionMode && (
            <TouchableOpacity style={styles.headerBtn} onPress={() => charger(false)}>
              <Ionicons name="refresh" size={22} color="#FFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.headerBtn, selectionMode && styles.headerBtnActive]}
            onPress={toggleSelectionMode}
          >
            <Ionicons name={selectionMode ? "checkmark-done-outline" : "checkbox-outline"} size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {rechercheOn && (
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            value={recherche}
            onChangeText={setRecherche}
            placeholder="Rechercher dans la conversation…"
            placeholderTextColor={WA.textMuted}
            autoFocus
            returnKeyType="search"
          />
          <TouchableOpacity onPress={() => { setRechercheOn(false); setRecherche(''); }} style={styles.searchClose}>
            <Ionicons name="close" size={26} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {membresVis && (
        <View style={styles.membresPanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ padding: 10 }}>
            {membres.map(m => (
              <View key={String(m.id)} style={styles.membreItem}>
                <Avatar nom={m.nom} prenom={m.prenom} role={m.role} size={34} />
                <Text style={styles.membreNom} numberOfLines={1}>
                  {(m.prenom || '').split(' ')[0] || m.nom}
                </Text>
                <View style={[styles.membreRoleDot, { backgroundColor: roleColor(m.role) }]} />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={WA.sendBtn} size="large" />
            <Text style={styles.loadingTxt}>Chargement…</Text>
          </View>
        ) : (
          <FlatList
            ref={flatRef} // ✅ FlatList normale
            data={listeItems}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            contentContainerStyle={styles.liste}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatRef.current?.scrollToEnd?.({ animated: false })}
            removeClippedSubviews
            maxToRenderPerBatch={20}
            windowSize={15}
            initialNumToRender={30}
            ListEmptyComponent={() => (
              <View style={styles.emptyWrap}>
                <Ionicons name="chatbubbles-outline" size={60} color={WA.textMuted} />
                <Text style={styles.emptyTxt}>Aucun message</Text>
                <Text style={styles.emptySub}>Soyez le premier à écrire !</Text>
              </View>
            )}
          />
        )}

        {replyMsg && !selectionMode && (
          <View style={styles.replyBar}>
            <View style={styles.replyBarContent}>
              <Text style={styles.replyBarNom}>{nomComplet(replyMsg.nom, replyMsg.prenom)}</Text>
              <Text style={styles.replyBarTxt} numberOfLines={1}>
                {replyMsg.type_message !== 'texte' ? `📎 ${replyMsg.type_message}` : (replyMsg.contenu || '')}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyMsg(null)} style={styles.replyBarClose}>
              <Ionicons name="close" size={20} color={WA.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* BANDEAU DE SÉLECTION */}
        {selectionMode ? (
          <View style={styles.selectionBar}>
            <TouchableOpacity onPress={toggleSelectionMode} style={styles.selectionCancel}>
              <Ionicons name="close" size={24} color={WA.danger} />
              <Text style={styles.selectionCancelTxt}>Annuler</Text>
            </TouchableOpacity>
            <Text style={styles.selectionCount}>{selectedIds.size} sélectionné(s)</Text>
            <TouchableOpacity
              onPress={handleBatchDelete}
              style={[styles.sendBtn, selectedIds.size === 0 && styles.sendBtnOff]}
              disabled={selectedIds.size === 0}
            >
              <Ionicons name="trash-outline" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.saisieWrap}>
            <TouchableOpacity style={styles.saisieBtn} onPress={ouvrirCamera}>
              <Ionicons name="camera" size={24} color="#54656F" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.saisieBtn} onPress={recording ? stopRecording : startRecording}>
              <Ionicons name={recording ? "stop-circle" : "mic"} size={24} color={recording ? "red" : "#54656F"} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.saisieBtn} onPress={ouvrirGalerie}>
              <Ionicons name="attach" size={24} color="#54656F" />
            </TouchableOpacity>

            <View style={styles.inputWrap}>
              {editMsg && (
                <View style={styles.editBanner}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="create-outline" size={18} color={WA.sendBtn} />
                    <Text style={styles.editBannerTxt}>Modifier le message</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setEditMsg(null); setTexte(''); }}>
                    <Ionicons name="close" size={20} color={WA.danger} />
                  </TouchableOpacity>
                </View>
              )}
              <TextInput
                style={styles.input}
                value={texte}
                onChangeText={setTexte}
                placeholder="Message…"
                placeholderTextColor={WA.textMuted}
                multiline
                maxLength={2000}
                editable={!envoi}
              />
            </View>

            {/* BOUTON EMOJI */}
            <TouchableOpacity style={styles.emojiBtn} onPress={() => setEmojiPickerVisible(true)}>
              <Ionicons name="happy-outline" size={26} color="#54656F" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sendBtn, (!texte.trim() || envoi) && styles.sendBtnOff]}
              onPress={handleEnvoyer}
              disabled={!texte.trim() || envoi}
            >
              {envoi ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Ionicons name="send" size={22} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* MENU CONTEXTUEL WHATSAPP */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuCard}>
            <View style={styles.menuReactions}>
              {EMOJIS_REACTION.map(e => (
                <TouchableOpacity key={e} style={styles.menuReactionBtn} onPress={() => handleReact(menuMsg?.id, e)}>
                  <Text style={styles.menuReactionEmoji}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.menuSep} />

            <TouchableOpacity style={styles.menuItem} onPress={() => handleReply(menuMsg)}>
              <Ionicons name="return-up-back-outline" size={22} color={WA.textMain} style={{ width: 28 }} />
              <Text style={styles.menuItemTxt}>Répondre</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => handleCopy(menuMsg)}>
              <Ionicons name="copy-outline" size={22} color={WA.textMain} style={{ width: 28 }} />
              <Text style={styles.menuItemTxt}>Copier</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => handleSelectMode(menuMsg)}>
              <Ionicons name="checkbox-outline" size={22} color={WA.textMain} style={{ width: 28 }} />
              <Text style={styles.menuItemTxt}>Sélectionner</Text>
            </TouchableOpacity>

            {String(menuMsg?.expediteur_id) === monId && (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleEdit(menuMsg)}>
                  <Ionicons name="create-outline" size={22} color={WA.textMain} style={{ width: 28 }} />
                  <Text style={styles.menuItemTxt}>Modifier</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: '#F3F4F6' }]} onPress={() => handleDelete(menuMsg?.id)}>
                  <Ionicons name="trash-outline" size={22} color={WA.danger} style={{ width: 28 }} />
                  <Text style={[styles.menuItemTxt, { color: WA.danger }]}>Supprimer</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL IMAGE */}
      <Modal visible={imgVisible} transparent animationType="fade" onRequestClose={() => setImgVisible(false)}>
        <TouchableOpacity style={styles.imgModalBg} activeOpacity={1} onPress={() => setImgVisible(false)}>
          {imgUri && <Image source={{ uri: imgUri }} style={styles.imgModalFull} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>

      {/* MODAL EMOJI PICKER */}
      <Modal visible={emojiPickerVisible} transparent animationType="slide" onRequestClose={() => setEmojiPickerVisible(false)}>
        <View style={styles.emojiModal}>
          <View style={styles.emojiHeader}>
            <Text style={styles.emojiHeaderTxt}>Choisir un emoji</Text>
            <TouchableOpacity onPress={() => setEmojiPickerVisible(false)}>
              <Ionicons name="close" size={26} color={WA.textMain} />
            </TouchableOpacity>
          </View>
          <EmojiSelector
            onEmojiSelected={(emoji) => {
              setTexte(prev => prev + emoji);
              setEmojiPickerVisible(false);
            }}
            columns={8}
            showSearchBar={true}
            showTabs={true}
          />
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// =========================================================
// STYLES
// =========================================================

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WA.fond },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WA.headerBg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 4 : 4,
    paddingBottom: 10,
    paddingHorizontal: 8,
    gap: 6,
  },
  backBtn: { padding: 6 },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitre: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn: { padding: 8 },
  headerBtnActive: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8 },
  membresPanel: {
    backgroundColor: WA.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  membreItem: { alignItems: 'center', marginRight: 14, gap: 3 },
  membreNom: { color: '#FFF', fontSize: 10, maxWidth: 50, textAlign: 'center' },
  membreRoleDot: { width: 6, height: 6, borderRadius: 3 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WA.headerBg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 4 : 4,
    paddingBottom: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: WA.textMain,
  },
  searchClose: { padding: 6 },
  dateSepWrap: { alignItems: 'center', marginVertical: 10 },
  dateSepBulle: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  dateSepTxt: { fontSize: 11, fontWeight: '700', color: WA.textSub },
  liste: { paddingVertical: 8, paddingBottom: 4, flexGrow: 1 },
  ligneMsg: { flexDirection: 'row', marginVertical: 2, paddingHorizontal: 6 },
  ligneMsgG: { justifyContent: 'flex-start' },
  ligneMsgD: { justifyContent: 'flex-end' },
  avatarCol: { justifyContent: 'flex-end', marginHorizontal: 4, marginBottom: 2 },
  bulleContenu: { maxWidth: SW * 0.74 },
  bulleContenuG: { alignItems: 'flex-start' },
  bulleContenuD: { alignItems: 'flex-end' },
  bulleNom: { fontSize: 12, fontWeight: '800', marginBottom: 2, marginLeft: 4 },
  bulle: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  bulleMoi: { backgroundColor: WA.bubbleMoi, borderTopRightRadius: 2 },
  bulleAutre: { backgroundColor: WA.bubbleAutre, borderTopLeftRadius: 2 },
  bulleSelected: { borderWidth: 2, borderColor: Colors.primary },
  bulleTxt: { fontSize: 14, color: WA.textMain, lineHeight: 20 },
  modifieTxt: { fontSize: 11, color: WA.textMuted, fontStyle: 'italic' },
  bullePied: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2, gap: 3 },
  bulleHeure: { fontSize: 10, color: WA.heure },
  replyBox: {
    borderLeftWidth: 3,
    borderRadius: 6,
    backgroundColor: WA.replyBg,
    paddingLeft: 8,
    paddingVertical: 4,
    marginBottom: 5,
  },
  replyAuteur: { fontSize: 11, fontWeight: '800', marginBottom: 1 },
  replyTxt: { fontSize: 12, color: WA.textSub },
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 3, marginLeft: 4 },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
    gap: 2,
  },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 11, color: WA.textSub, fontWeight: '700' },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  mediaImg: { width: SW * 0.55, height: SW * 0.55, borderRadius: 8 },
  mediaVideo: {
    width: SW * 0.55,
    height: SW * 0.55,
    borderRadius: 8,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaVideoIcon: { color: '#FFF', fontSize: 40 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontWeight: '800' },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  replyBarContent: { flex: 1, borderLeftWidth: 3, borderLeftColor: WA.sendBtn, paddingLeft: 8 },
  replyBarNom: { fontSize: 12, fontWeight: '700', color: WA.sendBtn },
  replyBarTxt: { fontSize: 12, color: WA.textSub },
  replyBarClose: { padding: 4 },
  saisieWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 4,
  },
  saisieBtn: { padding: 7, justifyContent: 'center' },
  inputWrap: { flex: 1 },
  editBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: WA.sendBtn + '18',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
  },
  editBannerTxt: { fontSize: 12, color: WA.sendBtn, fontWeight: '700' },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 7,
    fontSize: 14,
    color: WA.textMain,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 1,
  },
  emojiBtn: { padding: 8, justifyContent: 'center' },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: WA.sendBtn,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  sendBtnOff: { backgroundColor: WA.textMuted, elevation: 0 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTxt: { color: WA.textSub, fontSize: 14 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyTxt: { fontSize: 16, fontWeight: '700', color: WA.textSub },
  emptySub: { fontSize: 13, color: WA.textMuted },
  imgModalBg: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  imgModalFull: { width: SW, height: SW * 1.2 },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  selectionCancel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectionCancelTxt: { fontSize: 14, color: WA.danger, fontWeight: '600' },
  selectionCount: { fontSize: 14, fontWeight: '600', color: WA.textMain },
  checkboxContainer: { padding: 4, marginBottom: 4, alignSelf: 'flex-start' },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'flex-end' },
  menuCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    width: SW * 0.95,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 15,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  menuReactions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: '#F9F9F9',
  },
  menuReactionBtn: { padding: 6 },
  menuReactionEmoji: { fontSize: 32 },
  menuSep: { height: 1, backgroundColor: '#F0F0F0' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 14,
  },
  menuItemTxt: { fontSize: 16, color: WA.textMain, fontWeight: '500' },
  emojiModal: { flex: 1, backgroundColor: '#FFF', marginTop: Platform.OS === 'ios' ? 40 : 0 },
  emojiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  emojiHeaderTxt: { fontSize: 18, fontWeight: '700', color: WA.textMain }
});