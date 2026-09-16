// mobile/src/screens/RapportFormScreen.js
// Version avec sélection d'un UTILISATEUR (admin, DJ, superviseur, technicien)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, StatusBar, Image,
  Platform, PermissionsAndroid, Animated, KeyboardAvoidingView, Modal, TextInput, FlatList,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';
import Geolocation from 'react-native-geolocation-service';

import { rapportsAPI, missionsAPI, fetchAllUsers } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Card } from '../components';
import { Colors, Spacing, Radius, Typography, Shadows } from '../theme';

// =========================================================
// CONSTANTES
// =========================================================

const STATUTS_RAPPORT = [
  { label: 'Brouillon', value: 'brouillon', icon: 'document-text-outline' },
  { label: 'Soumis', value: 'soumis', icon: 'paper-plane-outline' },
  { label: 'Approuvé', value: 'approuve', icon: 'checkmark-circle-outline' },
  { label: 'Rejeté', value: 'rejete', icon: 'close-circle-outline' },
];

const TYPES_INTERVENTION = [
  { label: 'Préventive', value: 'preventive', icon: 'construct-outline', color: Colors.primary },
  { label: 'Corrective', value: 'corrective', icon: 'wrench-outline', color: Colors.warning },
  { label: 'Urgente', value: 'urgente', icon: 'alert-circle-outline', color: Colors.danger },
];

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

// =========================================================
// COMPOSANT SÉLECTEUR RECHERCHABLE
// =========================================================

function SearchableSelector({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  touched,
  onBlur,
  icon,
  getOptionColor,
  disabled,
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (selected) => {
    onChange(selected);
    setModalVisible(false);
    setSearch('');
    if (onBlur) onBlur();
  };

  const getIconName = () => {
    const found = options.find(o => o.value === value);
    return found?.icon || icon || 'chevron-down';
  };

  const getColor = () => {
    if (getOptionColor) return getOptionColor(value);
    const found = options.find(o => o.value === value);
    return found?.color || Colors.textMuted;
  };

  return (
    <View style={styles.selectorContainer}>
      <Text style={styles.selectorLabel}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.selectorInput,
          error && touched && styles.selectorInputError,
          disabled && styles.selectorDisabled,
        ]}
        onPress={() => !disabled && setModalVisible(true)}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <View style={styles.selectorInputContent}>
          <Ionicons name={getIconName()} size={20} color={value ? getColor() : Colors.textMuted} />
          <Text style={[
            styles.selectorInputText,
            value ? styles.selectorInputTextSelected : styles.selectorInputTextPlaceholder,
          ]}>
            {value ? options.find(o => o.value === value)?.label || value : placeholder || 'Sélectionner...'}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={20} color={Colors.textMuted} />
      </TouchableOpacity>
      {error && touched && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionner {label.toLowerCase()}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchInputWrapper}>
              <Ionicons name="search-outline" size={20} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher..."
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filteredOptions}
              keyExtractor={(item) => item.value.toString()}
              contentContainerStyle={styles.modalList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalListItem,
                    value === item.value && styles.modalListItemSelected,
                  ]}
                  onPress={() => handleSelect(item.value)}
                >
                  <View style={styles.modalListItemContent}>
                    {item.icon && (
                      <Ionicons
                        name={item.icon}
                        size={22}
                        color={item.color || Colors.textSecondary}
                      />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[
                        styles.modalListItemText,
                        value === item.value && { color: item.color || Colors.primary, fontWeight: '600' },
                      ]}>
                        {item.label}
                      </Text>
                      {item.subtitle && (
                        <Text style={styles.modalListItemSubtitle}>{item.subtitle}</Text>
                      )}
                    </View>
                  </View>
                  {value === item.value && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyText}>Aucun résultat</Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =========================================================
// PERMISSIONS
// =========================================================

const requestCameraPermission = async () => {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Permission caméra',
        message: "BBS Mobile a besoin d'accéder à votre caméra pour prendre des photos.",
        buttonNeutral: 'Plus tard',
        buttonNegative: 'Refuser',
        buttonPositive: 'Autoriser',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};

const requestStoragePermission = async () => {
  if (Platform.OS !== 'android') return true;
  try {
    const permission = Platform.Version >= 33
      ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
      : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
    const granted = await PermissionsAndroid.request(permission, {
      title: 'Permission galerie',
      message: "BBS Mobile a besoin d'accéder à votre galerie.",
      buttonNeutral: 'Plus tard',
      buttonNegative: 'Refuser',
      buttonPositive: 'Autoriser',
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};

const requestLocationPermission = async () => {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Permission GPS',
        message: "BBS Mobile a besoin d'accéder à votre position GPS.",
        buttonPositive: 'Autoriser',
        buttonNegative: 'Refuser',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function RapportFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, isTechnicien, isSuperviseur } = useAuth();

  const isAdmin = user?.role === 'admin' || user?.role === 'dj';
  const canEdit = isTechnicien || isSuperviseur || isAdmin;
  const canDelete = isSuperviseur || isAdmin;

  const editRapport = route.params?.rapport;
  const missionIdParam = route.params?.mission_id;
  const isEdit = !!editRapport;

  // États
  const [titre, setTitre] = useState(editRapport?.titre || '');
  const [description, setDescription] = useState(editRapport?.description || '');
  const [solution, setSolution] = useState(editRapport?.solution || '');
  const [typeIntervention, setTypeIntervention] = useState(editRapport?.type_intervention || '');
  const [statut, setStatut] = useState(editRapport?.statut || 'brouillon');
  const [dureeIntervention, setDureeIntervention] = useState(
    editRapport?.duree_intervention ? String(editRapport.duree_intervention) : ''
  );
  const [adresse, setAdresse] = useState(editRapport?.adresse || '');
  const [latitude, setLatitude] = useState(editRapport?.latitude ? String(editRapport.latitude) : '');
  const [longitude, setLongitude] = useState(editRapport?.longitude ? String(editRapport.longitude) : '');
  const [dateIntervention, setDateIntervention] = useState(
    editRapport?.date_intervention || new Date().toISOString().split('T')[0]
  );
  const [missionId, setMissionId] = useState(editRapport?.mission_id || missionIdParam || null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [formValid, setFormValid] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  // 🎯 SÉLECTION DE L'UTILISATEUR (au lieu de technicien)
  const [selectedUserId, setSelectedUserId] = useState(
    editRapport?.technicien_id || null
  );
  const [allUsers, setAllUsers] = useState([]);
  const [missions, setMissions] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const geocodeTimeout = useRef(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // =========================================================
  // CHARGEMENT DES LISTES (utilisateurs + missions)
  // =========================================================

  useEffect(() => {
    const load = async () => {
      setLoadingUsers(true);
      try {
        // 🎯 Charger TOUS les utilisateurs (admin, DJ, superviseur, technicien)
        const usersPromise = fetchAllUsers().catch(() => []);
        const missionPromise = missionsAPI.list().catch(() => ({ data: [] }));

        const [usersList, missionRes] = await Promise.all([usersPromise, missionPromise]);

        setAllUsers(usersList || []);
        console.log('✅ Utilisateurs chargés:', usersList?.length);

        const missionList = missionRes?.data || missionRes || [];
        setMissions(missionList);
      } catch (e) {
        console.log('⚠️ Erreur chargement listes:', e);
      } finally {
        setLoadingUsers(false);
      }
    };
    load();
  }, []);

  // =========================================================
  // GÉOCODAGE AUTOMATIQUE
  // =========================================================

  const geocodeAddress = useCallback(async (address) => {
    if (!address || address.trim().length < 3) {
      setLatitude('');
      setLongitude('');
      return;
    }

    setGeocoding(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BBS-Mobile/1.0'
        }
      });
      if (!response.ok) throw new Error('Erreur de géocodage');
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        setLatitude(parseFloat(lat).toFixed(6));
        setLongitude(parseFloat(lon).toFixed(6));
      } else {
        setLatitude('');
        setLongitude('');
      }
    } catch (error) {
      console.warn('⚠️ Échec du géocodage:', error);
    } finally {
      setGeocoding(false);
    }
  }, []);

  useEffect(() => {
    if (geocodeTimeout.current) {
      clearTimeout(geocodeTimeout.current);
    }
    if (isEdit && (editRapport?.latitude || editRapport?.longitude)) {
      return;
    }
    if (latitude || longitude) {
      return;
    }
    geocodeTimeout.current = setTimeout(() => {
      geocodeAddress(adresse);
    }, 800);
    return () => {
      if (geocodeTimeout.current) clearTimeout(geocodeTimeout.current);
    };
  }, [adresse, isEdit, editRapport, latitude, longitude, geocodeAddress]);

  // =========================================================
  // ANIMATIONS ET VALIDATION
  // =========================================================

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    const newErrors = {};
    if (!titre.trim()) newErrors.titre = 'Le titre est requis';
    if (!description.trim()) newErrors.description = 'La description est requise';
    if (!solution.trim()) newErrors.solution = 'La solution est requise';
    if (!typeIntervention) newErrors.typeIntervention = "Le type d'intervention est requis";
    setErrors(newErrors);
    setFormValid(Object.keys(newErrors).length === 0 && (isTechnicien || !!selectedUserId));
  }, [titre, description, solution, typeIntervention, isTechnicien, selectedUserId]);

  const handleFieldBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // =========================================================
  // PHOTOS, GPS
  // =========================================================

  const pickFromGallery = async () => {
    const ok = await requestStoragePermission();
    if (!ok) {
      Alert.alert('Permission refusée', "Autorisez l'accès à la galerie.");
      return;
    }
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 5 - photos.length,
        quality: 0.7,
      });
      if (!result.didCancel && result.assets) {
        setPhotos(prev => [...prev, ...result.assets].slice(0, 5));
      }
    } catch (error) {
      Alert.alert('Erreur', "Impossible d'accéder à la galerie.");
    }
  };

  const pickFromCamera = async () => {
    const okCam = await requestCameraPermission();
    if (!okCam) {
      Alert.alert('Permission refusée', "Autorisez l'accès à la caméra.");
      return;
    }
    try {
      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.7,
        saveToPhotos: true,
      });
      if (!result.didCancel && result.assets) {
        setPhotos(prev => [...prev, ...result.assets].slice(0, 5));
      }
    } catch (error) {
      Alert.alert('Erreur', "Impossible d'ouvrir la caméra.");
    }
  };

  const removePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const getCurrentLocation = async () => {
    const granted = await requestLocationPermission();
    if (!granted) {
      Alert.alert('Permission refusée', "Autorisez l'accès à la localisation.");
      return;
    }

    Geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
            { headers: { 'Accept': 'application/json', 'User-Agent': 'BBS-Mobile/1.0' } }
          );
          if (response.ok) {
            const data = await response.json();
            if (data?.display_name) {
              setAdresse(data.display_name);
              Alert.alert('📍 Localisation trouvée', data.display_name);
              return;
            }
          }
          setAdresse(`${lat}, ${lng}`);
          Alert.alert('📍 Coordonnées GPS', `Lat: ${lat}, Lng: ${lng}`);
        } catch (error) {
          setAdresse(`${lat}, ${lng}`);
          Alert.alert('📍 Coordonnées GPS', `Lat: ${lat}, Lng: ${lng}`);
        }
      },
      (error) => {
        Alert.alert('Erreur GPS', error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 10000,
        forceRequestLocation: true,
        showLocationDialog: true,
      }
    );
  };

  // =========================================================
  // SAUVEGARDE
  // =========================================================

  const handleSave = async () => {
    if (!formValid) {
      setTouched({ titre: true, description: true, solution: true, typeIntervention: true });
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (!isTechnicien && !selectedUserId) {
      Alert.alert('Erreur', 'Veuillez sélectionner un utilisateur.');
      return;
    }
    if (isEdit && !canEdit) {
      Alert.alert('Permission refusée', "Vous n'avez pas le droit de modifier ce rapport.");
      return;
    }

    // Vérification de la mission
    if (missionId) {
      const missionExists = missions.some(m => m.id === missionId);
      if (!missionExists) {
        Alert.alert(
          '⚠️ Mission invalide',
          'La mission sélectionnée n\'existe plus. Veuillez en choisir une autre.'
        );
        return;
      }
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('titre', titre.trim());
      formData.append('description', description.trim());
      formData.append('solution', solution.trim());
      formData.append('type_intervention', typeIntervention);
      formData.append('statut', statut);
      if (dureeIntervention) formData.append('duree_intervention', parseInt(dureeIntervention));
      if (adresse) formData.append('adresse', adresse.trim());
      if (latitude) formData.append('latitude', parseFloat(latitude));
      if (longitude) formData.append('longitude', parseFloat(longitude));
      if (dateIntervention) formData.append('date_intervention', dateIntervention);

      if (missionId && missions.some(m => m.id === missionId)) {
        formData.append('mission_id', missionId);
      }

      // 🎯 Envoyer l'utilisateur sélectionné (le backend résoudra le rôle)
      if (!isTechnicien && selectedUserId) {
        formData.append('user_id', selectedUserId);
      }

      photos.forEach((photo, index) => {
        formData.append('photos', {
          uri: photo.uri,
          type: photo.type || 'image/jpeg',
          name: photo.fileName || `photo_${index}.jpg`,
        });
      });

      console.log('📦 Envoi du rapport - userId:', selectedUserId);

      if (isEdit) {
        await rapportsAPI.update(editRapport.id, formData);
        Alert.alert('✅ Succès', 'Rapport modifié', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else {
        await rapportsAPI.create(formData);
        Alert.alert('✅ Succès', 'Rapport créé', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch (error) {
      console.error('❌ Erreur sauvegarde:', error);
      Alert.alert('❌ Erreur', error.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!canDelete) {
      Alert.alert('Permission refusée', "Vous n'avez pas le droit de supprimer ce rapport.");
      return;
    }
    Alert.alert(
      'Confirmer la suppression',
      'Êtes-vous sûr de vouloir supprimer ce rapport ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await rapportsAPI.delete(editRapport.id);
              Alert.alert('✅ Succès', 'Rapport supprimé', [{ text: 'OK', onPress: () => navigation.goBack() }]);
            } catch (error) {
              console.error('❌ Erreur suppression:', error);
              Alert.alert('❌ Erreur', error.message || 'Impossible de supprimer le rapport');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    if (isFormDirty()) {
      Alert.alert('Annuler', 'Voulez-vous vraiment quitter sans sauvegarder ?', [
        { text: 'Rester', style: 'cancel' },
        { text: 'Quitter', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  };

  const isFormDirty = () => {
    if (isEdit) {
      return (
        titre !== editRapport.titre ||
        description !== editRapport.description ||
        solution !== editRapport.solution ||
        typeIntervention !== editRapport.type_intervention ||
        statut !== editRapport.statut ||
        dureeIntervention !== String(editRapport.duree_intervention || '') ||
        adresse !== editRapport.adresse ||
        dateIntervention !== editRapport.date_intervention ||
        missionId !== editRapport.mission_id ||
        photos.length > 0
      );
    }
    return (
      titre !== '' || description !== '' || solution !== '' ||
      typeIntervention !== '' || adresse !== '' || photos.length > 0
    );
  };

  // =========================================================
  // OPTIONS DES SÉLECTEURS
  // =========================================================

  // 🎯 Options utilisateurs avec badge de rôle
  const userOptions = allUsers.map(u => {
    const roleConf = getRoleConfig(u.role);
    return {
      label: `${u.prenom} ${u.nom}`,
      subtitle: `${roleConf.label}${u.email ? ' • ' + u.email : ''}`,
      value: u.id,
      icon: roleConf.icon,
      color: roleConf.color,
      role: (u.role || '').toLowerCase(),
    };
  });

  const missionOptions = missions.map(m => ({
    label: m.titre,
    value: m.id,
    icon: 'briefcase-outline',
    color: Colors.primary,
  }));

  const getTypeColor = (value) => {
    const found = TYPES_INTERVENTION.find(t => t.value === value);
    return found?.color || Colors.textMuted;
  };

  const getUserColor = (value) => {
    const found = userOptions.find(o => o.value === value);
    return found?.color || Colors.textMuted;
  };

  // =========================================================
  // RENDU
  // =========================================================

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      <GradientHeader style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={handleCancel} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{isEdit ? 'Modifier le rapport' : 'Nouveau rapport'}</Text>
            <View style={styles.headerUserRow}>
              <Ionicons name="person-circle-outline" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={styles.headerUserName}>{user?.prenom} {user?.nom}</Text>
              <View style={styles.headerRoleBadge}>
                <Text style={styles.headerRoleTxt}>
                  {user?.role === 'technicien' ? 'Technicien' :
                   user?.role === 'superviseur' ? 'Superviseur' :
                   user?.role === 'admin' ? 'Admin' : user?.role}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.headerActions}>
            {isEdit && canDelete && (
              <TouchableOpacity onPress={handleDelete} style={[styles.headerActionBtn, styles.deleteBtn]} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={22} color={Colors.textWhite} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleSave}
              disabled={loading || (isEdit && !canEdit)}
              style={[styles.headerActionBtn, styles.saveBtn, (loading || (isEdit && !canEdit)) && styles.saveBtnDisabled]}
              activeOpacity={0.7}
            >
              <Ionicons name={loading ? 'hourglass' : (isEdit && !canEdit) ? 'lock-closed' : 'checkmark'} size={22} color={Colors.textWhite} />
            </TouchableOpacity>
          </View>
        </View>
      </GradientHeader>

      <Animated.ScrollView style={[styles.scroll, { opacity: fadeAnim }]} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card style={styles.formCard}>
          <Input
            label="Titre du rapport"
            value={titre}
            onChangeText={setTitre}
            onBlur={() => handleFieldBlur('titre')}
            placeholder="Ex: Intervention fibre optique"
            leftIcon="document-text-outline"
            error={errors.titre}
            editable={!(isEdit && !canEdit)}
          />

          <SearchableSelector
            label="Mission"
            value={missionId}
            onChange={setMissionId}
            options={missionOptions}
            placeholder="Aucune mission"
            error={errors.missionId}
            touched={touched.missionId}
            onBlur={() => handleFieldBlur('missionId')}
            disabled={isEdit && !canEdit}
          />

          <Input
            label="Description"
            value={description}
            onChangeText={setDescription}
            onBlur={() => handleFieldBlur('description')}
            placeholder="Décrivez l'intervention..."
            multiline
            numberOfLines={4}
            leftIcon="file-tray-full-outline"
            error={errors.description}
            editable={!(isEdit && !canEdit)}
          />

          <Input
            label="Solution apportée"
            value={solution}
            onChangeText={setSolution}
            onBlur={() => handleFieldBlur('solution')}
            placeholder="Décrivez la solution mise en place..."
            multiline
            numberOfLines={3}
            leftIcon="checkmark-done-outline"
            error={errors.solution}
            editable={!(isEdit && !canEdit)}
          />

          <SearchableSelector
            label="Type d'intervention"
            value={typeIntervention}
            onChange={setTypeIntervention}
            options={TYPES_INTERVENTION}
            placeholder="Sélectionner un type"
            error={errors.typeIntervention}
            touched={touched.typeIntervention}
            onBlur={() => handleFieldBlur('typeIntervention')}
            getOptionColor={getTypeColor}
            disabled={isEdit && !canEdit}
          />

          <Input
            label="Durée d'intervention (minutes)"
            value={dureeIntervention}
            onChangeText={setDureeIntervention}
            placeholder="Ex: 45"
            keyboardType="numeric"
            leftIcon="time-outline"
            editable={!(isEdit && !canEdit)}
          />

          <Input
            label="Date d'intervention"
            value={dateIntervention}
            onChangeText={setDateIntervention}
            placeholder="YYYY-MM-DD"
            leftIcon="calendar-outline"
            editable={!(isEdit && !canEdit)}
          />

          {isEdit && (
            <SearchableSelector
              label="Statut"
              value={statut}
              onChange={setStatut}
              options={STATUTS_RAPPORT}
              placeholder="Sélectionner un statut"
              error={errors.statut}
              touched={touched.statut}
              onBlur={() => handleFieldBlur('statut')}
              disabled={!(isEdit && canEdit)}
            />
          )}

          {/* 🎯 SÉLECTION DE L'UTILISATEUR (au lieu du technicien) */}
          {!isTechnicien && (
            <>
              <SearchableSelector
                label="Utilisateur concerné"
                value={selectedUserId}
                onChange={setSelectedUserId}
                options={userOptions}
                placeholder={loadingUsers ? 'Chargement...' : 'Sélectionner un utilisateur'}
                error={errors.selectedUserId}
                touched={touched.selectedUserId}
                onBlur={() => handleFieldBlur('selectedUserId')}
                getOptionColor={getUserColor}
                disabled={(isEdit && !canEdit) || loadingUsers}
              />
              {loadingUsers && (
                <View style={styles.loadingUsersRow}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.loadingUsersText}>Chargement des utilisateurs...</Text>
                </View>
              )}
            </>
          )}

          <View style={styles.locationRow}>
            <Input
              label="Adresse"
              value={adresse}
              onChangeText={setAdresse}
              placeholder="Adresse d'intervention"
              leftIcon="location-outline"
              containerStyle={{ flex: 1, marginBottom: 0 }}
              editable={!(isEdit && !canEdit)}
            />
            <TouchableOpacity style={[styles.gpsBtn, (isEdit && !canEdit) && styles.gpsBtnDisabled]} onPress={getCurrentLocation} disabled={isEdit && !canEdit}>
              <Ionicons name="locate" size={22} color={Colors.textWhite} />
            </TouchableOpacity>
          </View>

          <View style={styles.coordRow}>
            <View style={styles.coordInputWrapper}>
              <Input
                label="Latitude"
                value={latitude}
                onChangeText={setLatitude}
                placeholder="-3.3822"
                keyboardType="decimal-pad"
                containerStyle={styles.coordInput}
                editable={!(isEdit && !canEdit)}
              />
              {geocoding && <ActivityIndicator size="small" color={Colors.primary} style={styles.geocodeIndicator} />}
            </View>
            <View style={styles.coordInputWrapper}>
              <Input
                label="Longitude"
                value={longitude}
                onChangeText={setLongitude}
                placeholder="29.3644"
                keyboardType="decimal-pad"
                containerStyle={styles.coordInput}
                editable={!(isEdit && !canEdit)}
              />
              {geocoding && <ActivityIndicator size="small" color={Colors.primary} style={styles.geocodeIndicator} />}
            </View>
          </View>
        </Card>

        {!isEdit && (
          <Card style={styles.photoCard}>
            <View style={styles.photoTitleContainer}>
              <Ionicons name="camera-outline" size={22} color={Colors.primary} />
              <Text style={styles.photoTitle}>Photos</Text>
            </View>
            <Text style={styles.photoSubtitle}>Ajoutez jusqu'à 5 photos ({photos.length}/5)</Text>
            <View style={styles.photoBtnsRow}>
              <TouchableOpacity style={[styles.photoSourceBtn, styles.cameraBtn]} onPress={pickFromCamera} disabled={photos.length >= 5} activeOpacity={0.7}>
                <Ionicons name="camera-outline" size={24} color={Colors.primary} />
                <Text style={styles.photoSourceLabel}>Caméra</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.photoSourceBtn, styles.galleryBtn]} onPress={pickFromGallery} disabled={photos.length >= 5} activeOpacity={0.7}>
                <Ionicons name="images-outline" size={24} color={Colors.textSecondary} />
                <Text style={styles.photoSourceLabel}>Galerie</Text>
              </TouchableOpacity>
            </View>
            {photos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                {photos.map((photo, index) => (
                  <View key={index} style={styles.photoThumb}>
                    <Image source={{ uri: photo.uri }} style={styles.photoImg} />
                    <TouchableOpacity style={styles.removePhoto} onPress={() => removePhoto(index)}>
                      <Ionicons name="close" size={14} color={Colors.textWhite} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </Card>
        )}

        <View style={styles.buttonsContainer}>
          <Button
            title={loading ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer'}
            onPress={handleSave}
            loading={loading}
            size="lg"
            fullWidth
            icon={isEdit ? 'refresh-outline' : 'add-outline'}
            style={styles.submitBtn}
            disabled={isEdit && !canEdit}
          />
          <Button title="Annuler" onPress={handleCancel} variant="ghost" size="lg" fullWidth />
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
  container: { flex: 1, backgroundColor: Colors.background },

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
    paddingHorizontal: Spacing.sm,
  },
  headerTitle: {
    color: Colors.textWhite,
    fontSize: 17,
    fontWeight: '700',
  },
  headerUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  headerUserName: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '600',
  },
  headerRoleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  headerRoleTxt: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 9,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: { backgroundColor: 'rgba(255,255,255,0.15)' },
  saveBtn: { backgroundColor: 'rgba(255,255,255,0.15)' },
  saveBtnDisabled: { opacity: 0.5 },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 20,
  },

  formCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 4,
    marginBottom: 8,
    marginLeft: 4,
  },

  loadingUsersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: -8,
    marginBottom: Spacing.md,
    paddingLeft: 4,
  },
  loadingUsersText: {
    fontSize: 12,
    color: Colors.textMuted,
  },

  label: {
    ...Typography.label,
    marginBottom: 6,
    color: Colors.textPrimary,
    fontWeight: '500',
  },

  selectorContainer: {
    marginBottom: Spacing.md,
  },
  selectorLabel: {
    ...Typography.label,
    marginBottom: 6,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  selectorInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
  },
  selectorInputError: {
    borderColor: Colors.danger,
  },
  selectorDisabled: {
    opacity: 0.6,
  },
  selectorInputContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectorInputText: {
    fontSize: 14,
    marginLeft: 8,
  },
  selectorInputTextSelected: {
    color: Colors.textPrimary,
  },
  selectorInputTextPlaceholder: {
    color: Colors.textMuted,
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gpsBtn: {
    width: 50,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  gpsBtnDisabled: { opacity: 0.5 },

  coordRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
    alignItems: 'center',
  },
  coordInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  coordInput: {
    flex: 1,
  },
  geocodeIndicator: {
    marginLeft: -30,
    marginTop: 10,
  },

  photoCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  photoTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  photoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginLeft: 8,
  },
  photoSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: 8,
  },
  photoBtnsRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 8,
  },
  photoSourceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1.5,
  },
  cameraBtn: {
    backgroundColor: Colors.primary + '12',
    borderColor: Colors.primary + '60',
  },
  galleryBtn: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  photoSourceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  photoScroll: { marginTop: 8 },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 8,
    position: 'relative',
  },
  photoImg: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.danger,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonsContainer: { marginTop: Spacing.sm },
  submitBtn: { marginBottom: Spacing.sm },
  footerSpace: { height: 20 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    width: '90%',
    maxHeight: '80%',
    padding: Spacing.md,
    ...Shadows.card,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    marginVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  modalList: {
    paddingBottom: 20,
  },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  modalListItemSelected: {
    backgroundColor: Colors.primary + '10',
    borderRadius: Radius.sm,
  },
  modalListItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modalListItemText: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  modalListItemSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  modalEmpty: {
    padding: 20,
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
});