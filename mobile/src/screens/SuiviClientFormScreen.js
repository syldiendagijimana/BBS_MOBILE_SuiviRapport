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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GradientHeader from '../components/GradientHeader';

import { suiviClientsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Selector, Card } from '../components';
import { Colors, Spacing, Typography, Radius, Shadows } from '../theme';

// =========================================================
// CONSTANTES
// =========================================================

const STATUTS_CLIENT = [
  { label: 'En attente', value: 'en_attente' },
  { label: 'Traité', value: 'traite' },
  { label: 'Résolu', value: 'resolu' },
  { label: 'Fermé', value: 'ferme' },
];

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

export default function SuiviClientFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, isSuperviseur, isAdmin } = useAuth();

  const editAppel = route.params?.appel;
  const isEdit = !!editAppel;

  // États du formulaire
  const [clientNom, setClientNom] = useState(editAppel?.client_nom || '');
  const [clientTelephone, setClientTelephone] = useState(editAppel?.client_telephone || '');
  const [motif, setMotif] = useState(editAppel?.motif || '');
  const [description, setDescription] = useState(editAppel?.description || '');
  const [statut, setStatut] = useState(editAppel?.statut || 'en_attente');
  const [notes, setNotes] = useState(editAppel?.notes || '');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // =========================================================
  // ANIMATIONS
  // =========================================================

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

  // =========================================================
  // VALIDATION (simplifiée)
  // =========================================================

  const validateField = (field, value) => {
    switch (field) {
      case 'clientNom':
        return !value?.trim() ? 'Le nom du client est requis' : '';
      case 'clientTelephone':
        if (!value?.trim()) return 'Le téléphone est requis';
        if (!/^[0-9+\s-]{8,}$/.test(value.replace(/\s/g, ''))) {
          return 'Numéro de téléphone invalide';
        }
        return '';
      case 'motif':
        return !value?.trim() ? 'Le motif est requis' : '';
      default:
        return '';
    }
  };

  // Validation complète du formulaire
  const validateForm = () => {
    const newErrors = {};
    const fields = ['clientNom', 'clientTelephone', 'motif'];

    fields.forEach(field => {
      // Récupérer la valeur directement depuis l'état
      let value;
      if (field === 'clientNom') value = clientNom;
      else if (field === 'clientTelephone') value = clientTelephone;
      else if (field === 'motif') value = motif;
      const error = validateField(field, value);
      if (error) newErrors[field] = error;
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Vérification rapide de la validité (pour le bouton)
  const isFormValid = () => {
    const fields = ['clientNom', 'clientTelephone', 'motif'];
    for (let field of fields) {
      let value;
      if (field === 'clientNom') value = clientNom;
      else if (field === 'clientTelephone') value = clientTelephone;
      else if (field === 'motif') value = motif;
      if (validateField(field, value)) return false;
    }
    return true;
  };

  const handleFieldBlur = (field) => {
    setTouched({ ...touched, [field]: true });
    let value;
    if (field === 'clientNom') value = clientNom;
    else if (field === 'clientTelephone') value = clientTelephone;
    else if (field === 'motif') value = motif;
    const error = validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: error || '' }));
  };

  // =========================================================
  // HANDLERS
  // =========================================================

  const handleSave = async () => {
    if (!validateForm()) {
      const allTouched = { clientNom: true, clientTelephone: true, motif: true };
      setTouched(allTouched);
      return;
    }

    setLoading(true);

    try {
      const data = {
        client_nom: clientNom.trim(),
        client_telephone: clientTelephone.trim(),
        motif: motif.trim(),
        statut: statut,
      };

      if (description) data.description = description.trim();
      if (notes) data.notes = notes.trim();

      if (isEdit) {
        await suiviClientsAPI.update(editAppel.id, data);
        Alert.alert(
          '✅ Succès',
          "L'appel client a été modifié avec succès",
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        await suiviClientsAPI.create(data);
        Alert.alert(
          '✅ Succès',
          "L'appel client a été enregistré avec succès",
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      console.error('❌ Erreur sauvegarde:', error);
      Alert.alert(
        '❌ Erreur',
        error.message || 'Une erreur est survenue lors de la sauvegarde'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (isFormDirty()) {
      Alert.alert(
        'Annuler',
        'Voulez-vous vraiment quitter sans sauvegarder ?',
        [
          { text: 'Rester', style: 'cancel' },
          { text: 'Quitter', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const isFormDirty = () => {
    if (isEdit) {
      return (
        clientNom !== editAppel.client_nom ||
        clientTelephone !== editAppel.client_telephone ||
        motif !== editAppel.motif ||
        description !== editAppel.description ||
        statut !== editAppel.statut ||
        notes !== editAppel.notes
      );
    }
    return (
      clientNom !== '' ||
      clientTelephone !== '' ||
      motif !== '' ||
      description !== '' ||
      notes !== ''
    );
  };

  // =========================================================
  // RENDU
  // =========================================================

  const formValid = isFormValid();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* HEADER */}
      <GradientHeader
        colors={[Colors.primary, Colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={handleCancel}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {isEdit ? "Modifier l'appel" : 'Nouvel appel client'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isEdit ? "Modifiez les informations de l'appel" : 'Enregistrez un nouvel appel client'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={loading || !formValid}
            style={[
              styles.saveBtn,
              { backgroundColor: 'rgba(255,255,255,0.15)' },
              (!formValid || loading) && styles.saveBtnDisabled,
            ]}
            activeOpacity={0.7}
          >
            <Ionicons
              name={loading ? 'hourglass' : 'checkmark'}
              size={22}
              color={Colors.textWhite}
            />
          </TouchableOpacity>
        </View>
      </GradientHeader>

      {/* FORMULAIRE */}
      <Animated.ScrollView
        style={[styles.scroll, { opacity: fadeAnim }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.formCard}>
          {/* Nom du client ✅ SUPPRESSION DE required */}
          <Input
            label="Nom du client"
            value={clientNom}
            onChangeText={(text) => {
              setClientNom(text);
              if (touched.clientNom) {
                const error = validateField('clientNom', text);
                setErrors(prev => ({ ...prev, clientNom: error || '' }));
              }
            }}
            onBlur={() => handleFieldBlur('clientNom')}
            placeholder="Nom du client"
            leftIcon="person-outline"
            error={errors.clientNom}
          />

          {/* Téléphone ✅ SUPPRESSION DE required */}
          <Input
            label="Téléphone"
            value={clientTelephone}
            onChangeText={(text) => {
              setClientTelephone(text);
              if (touched.clientTelephone) {
                const error = validateField('clientTelephone', text);
                setErrors(prev => ({ ...prev, clientTelephone: error || '' }));
              }
            }}
            onBlur={() => handleFieldBlur('clientTelephone')}
            placeholder="Entre le numéro du téléphone"
            keyboardType="phone-pad"
            leftIcon="call-outline"
            error={errors.clientTelephone}
          />

          {/* Motif ✅ SUPPRESSION DE required */}
          <Input
            label="Motif de l'appel"
            value={motif}
            onChangeText={(text) => {
              setMotif(text);
              if (touched.motif) {
                const error = validateField('motif', text);
                setErrors(prev => ({ ...prev, motif: error || '' }));
              }
            }}
            onBlur={() => handleFieldBlur('motif')}
            placeholder="Ex: Panne réseau, demande d'information..."
            leftIcon="chatbubble-outline"
            error={errors.motif}
          />

          {/* Description */}
          <Input
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Détails supplémentaires..."
            multiline
            numberOfLines={3}
            leftIcon="document-text-outline"
          />

          {/* Statut (uniquement en modification) */}
          {isEdit && (
            <Selector
              label="Statut"
              value={statut}
              options={STATUTS_CLIENT}
              onChange={setStatut}
            />
          )}

          {/* Notes */}
          <Input
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes internes..."
            multiline
            numberOfLines={2}
            leftIcon="clipboard-outline"
          />
        </Card>

        {/* BOUTONS */}
        <View style={styles.buttonsContainer}>
          <Button
            title={loading ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Enregistrer'}
            onPress={handleSave}
            loading={loading}
            disabled={!formValid}
            size="lg"
            fullWidth
            icon={isEdit ? 'refresh-outline' : 'add-outline'}
            style={styles.submitBtn}
          />
          <Button
            title="Annuler"
            onPress={handleCancel}
            variant="ghost"
            size="lg"
            fullWidth
          />
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
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // HEADER
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
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
    paddingHorizontal: 8,
  },
  headerTitle: {
    color: Colors.textWhite,
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  saveBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },

  // SCROLL
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },

  // FORM
  formCard: {
    padding: 16,
    marginBottom: 12,
  },

  // BUTTONS
  buttonsContainer: {
    marginTop: 8,
  },
  submitBtn: {
    marginBottom: 8,
  },
  footerSpace: {
    height: 20,
  },
});