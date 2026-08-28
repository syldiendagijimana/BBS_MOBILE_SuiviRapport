//mobile/src/theme/index.js
import { Platform } from 'react-native';

// =========================================================
// 1. COULEURS
// =========================================================

export const Colors = {
  // Couleurs principales
  primary: '#0057B8',
  primaryDark: '#003D82',
  primaryLight: '#4A90D9',
  primaryLightest: '#E8F0FE',

  secondary: '#00A651',
  secondaryDark: '#007A3C',
  secondaryLight: '#4CDB7F',
  secondaryLightest: '#E6F9ED',

  accent: '#FF6B35',
  accentDark: '#E55A2B',
  accentLight: '#FF9A6B',

  // État
  warning: '#F5A623',
  warningDark: '#D4891B',
  warningLight: '#F8D47A',

  danger: '#D0021B',
  dangerDark: '#A00115',
  dangerLight: '#F5A1A8',

  success: '#27AE60',
  successDark: '#1E8449',
  successLight: '#82E0AA',

  info: '#2980B9',
  infoDark: '#1A5276',
  infoLight: '#85C1E9',

  // Fonds
  background: '#F0F4F8',
  backgroundDark: '#E2E8F0',
  backgroundLight: '#F7FAFC',

  surface: '#FFFFFF',
  surfaceAlt: '#F7FAFC',
  surfaceDark: '#EDF2F7',

  // Bordures
  border: '#E2E8F0',
  borderDark: '#CBD5E0',
  borderLight: '#EDF2F7',
  divider: '#EDF2F7',

  // Textes
  textPrimary: '#1A202C',
  textSecondary: '#4A5568',
  textMuted: '#718096',
  textLight: '#A0AEC0',
  textWhite: '#FFFFFF',
  textBlack: '#000000',

  // Statut réseau
  statusNormal: '#27AE60',
  statusCongestion: '#F5A623',
  statusCritique: '#D0021B',
  statusDegrade: '#E67E22',
  statusPanne: '#C0392B',

  // Priorités
  prioriteBasse: '#27AE60',
  prioriteMoyenne: '#2980B9',
  prioriteNormale: '#2980B9',
  prioriteHaute: '#F5A623',
  prioriteCritique: '#D0021B',

  // Sévérité
  severiteFaible: '#27AE60',
  severiteMoyenne: '#F5A623',
  severiteElevee: '#E67E22',
  severiteCritique: '#D0021B',

  // Types d'intervention
  interventionPreventive: '#2980B9',
  interventionCorrective: '#F5A623',
  interventionUrgente: '#D0021B',

  // Gradients
  gradientStart: '#0057B8',
  gradientEnd: '#00A651',
  gradientDanger: '#D0021B',
  gradientWarning: '#F5A623',

  // Transparences
  overlay: 'rgba(0,0,0,0.5)',
  overlayLight: 'rgba(0,0,0,0.2)',
  overlayDark: 'rgba(0,0,0,0.7)',

  // Ombres
  shadowColor: '#000000',
  shadowLight: 'rgba(0,0,0,0.05)',
  shadowMedium: 'rgba(0,0,0,0.1)',
  shadowDark: 'rgba(0,0,0,0.2)',
};

// =========================================================
// 2. TYPOGRAPHIE
// =========================================================

export const Typography = {
  // Titres
  h1: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  h4: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  h5: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  // Corps de texte
  body: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // Captions
  caption: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textMuted,
    lineHeight: 16,
  },
  captionBold: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    lineHeight: 16,
  },

  // Labels
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  labelBold: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },

  // Boutons
  button: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  buttonSmall: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  buttonLarge: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.4,
  },

  // Autres
  overline: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textMuted,
    lineHeight: 20,
  },
};

// =========================================================
// 3. ESPACEMENTS
// =========================================================

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
};

// =========================================================
// 4. RAYONS
// =========================================================

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 28,
  full: 999,
};

// =========================================================
// 5. OMBRES
// =========================================================

export const Shadows = {
  // Ombres pour les cartes
  card: {
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHover: {
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },

  // Ombres pour les boutons
  button: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDanger: {
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonSuccess: {
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },

  // Ombres pour les modals
  modal: {
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },

  // Ombres pour le header
  header: {
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  // Ombres pour les éléments flottants
  floating: {
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },

  // Ombre légère
  light: {
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
};

// =========================================================
// 6. FONCTIONS DE COULEUR
// =========================================================

/**
 * Récupère la couleur correspondant à une priorité
 */
export const getPrioriteColor = (priorite) => {
  const map = {
    basse: Colors.prioriteBasse,
    moyenne: Colors.prioriteMoyenne,
    normale: Colors.prioriteNormale,
    haute: Colors.prioriteHaute,
    critique: Colors.prioriteCritique,
  };
  return map[priorite] || Colors.prioriteNormale;
};

/**
 * Récupère la couleur correspondant à un statut
 */
export const getStatutColor = (statut) => {
  const map = {
    // Statuts réseau
    normal: Colors.statusNormal,
    congestion: Colors.statusCongestion,
    critique: Colors.statusCritique,
    degrade: Colors.statusDegrade,
    panne: Colors.statusPanne,

    // Statuts incidents
    ouvert: Colors.danger,
    en_cours: Colors.warning,
    resolu: Colors.success,
    ferme: Colors.textMuted,

    // Statuts missions
    en_attente: Colors.warning,
    planifiee: Colors.info,
    terminee: Colors.success,
    annulee: Colors.textMuted,

    // Statuts rapports
    brouillon: Colors.textMuted,
    soumis: Colors.warning,
    approuve: Colors.success,
    rejete: Colors.danger,

    // Statuts génériques
    operationnel: Colors.success,
    maintenance: Colors.warning,
    operationnel: Colors.success,
    normal: Colors.success,
  };
  return map[statut] || Colors.textMuted;
};

/**
 * Récupère la couleur correspondant à une sévérité
 */
export const getSeveriteColor = (severite) => {
  const map = {
    faible: Colors.severiteFaible,
    moyenne: Colors.severiteMoyenne,
    elevee: Colors.severiteElevee,
    critique: Colors.severiteCritique,
  };
  return map[severite] || Colors.severiteMoyenne;
};

/**
 * Récupère la couleur correspondant à un type d'intervention
 */
export const getTypeInterventionColor = (type) => {
  const map = {
    preventive: Colors.interventionPreventive,
    corrective: Colors.interventionCorrective,
    urgente: Colors.interventionUrgente,
  };
  return map[type] || Colors.interventionPreventive;
};

/**
 * Récupère la couleur correspondant à un type d'incident
 */
export const getTypeIncidentColor = (type) => {
  const map = {
    panne_reseau: Colors.danger,
    panne_client: Colors.warning,
    securite: Colors.dangerDark,
    equipement: Colors.info,
    autre: Colors.textMuted,
  };
  return map[type] || Colors.textMuted;
};

/**
 * Récupère la couleur correspondant à un rôle
 */
export const getRoleColor = (role) => {
  const map = {
    admin: Colors.danger,
    dj: Colors.secondary,
    superviseur: Colors.primary,
    technicien: Colors.warning,
  };
  return map[role] || Colors.textMuted;
};

/**
 * Récupère le nom affichable d'un rôle
 */
export const getRoleName = (role) => {
  const map = {
    admin: 'Administrateur',
    dj: 'Directeur Junior',
    superviseur: 'Superviseur',
    technicien: 'Technicien',
  };
  return map[role] || role;
};

/**
 * Récupère une couleur avec une opacité
 */
export const getColorWithOpacity = (color, opacity = 0.5) => {
  // Pour les couleurs hexadécimales
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  // Pour les couleurs déjà en rgba
  if (color.startsWith('rgba')) {
    return color.replace(/[\d.]+\)$/, `${opacity})`);
  }
  return color;
};

// =========================================================
// 7. STYLES COMMUNS
// =========================================================

export const CommonStyles = {
  // Conteneurs
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  containerPadding: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },

  // Centrage
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerVertical: {
    justifyContent: 'center',
  },
  centerHorizontal: {
    alignItems: 'center',
  },

  // Ligne
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowSpaceBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Colonne
  column: {
    flexDirection: 'column',
  },
  columnCenter: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Diviseur
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.md,
  },
  dividerHorizontal: {
    width: 1,
    backgroundColor: Colors.divider,
    marginHorizontal: Spacing.md,
  },

  // Carte
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadows.card,
  },

  // Badge
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },

  // Shadow
  shadow: {
    ...Shadows.card,
  },

  // Border
  border: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  // Flex
  flex1: {
    flex: 1,
  },
  flexGrow: {
    flexGrow: 1,
  },

  // Margin
  m: (size) => ({ margin: size }),
  mt: (size) => ({ marginTop: size }),
  mb: (size) => ({ marginBottom: size }),
  ml: (size) => ({ marginLeft: size }),
  mr: (size) => ({ marginRight: size }),
  mx: (size) => ({ marginHorizontal: size }),
  my: (size) => ({ marginVertical: size }),

  // Padding
  p: (size) => ({ padding: size }),
  pt: (size) => ({ paddingTop: size }),
  pb: (size) => ({ paddingBottom: size }),
  pl: (size) => ({ paddingLeft: size }),
  pr: (size) => ({ paddingRight: size }),
  px: (size) => ({ paddingHorizontal: size }),
  py: (size) => ({ paddingVertical: size }),
};

// =========================================================
// 8. EXPORT
// =========================================================

export default {
  Colors,
  Typography,
  Spacing,
  Radius,
  Shadows,
  CommonStyles,
  getPrioriteColor,
  getStatutColor,
  getSeveriteColor,
  getTypeInterventionColor,
  getTypeIncidentColor,
  getRoleColor,
  getRoleName,
  getColorWithOpacity,
};