//mobile/src/components/index.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Modal as RNModal,
  Animated,
  FlatList,
  Dimensions,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  Colors,
  Typography,
  Spacing,
  Radius,
  Shadows,
  getPrioriteColor,
  getStatutColor,
  getSeveriteColor,
  getTypeInterventionColor
} from '../theme';

const { width, height } = Dimensions.get('window');

// =========================================================
// 1. BUTTON - Bouton personnalisé
// =========================================================

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  style,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  rounded = false,
  children,
  ...props
}) {
  const variants = {
    primary: { bg: Colors.primary, text: Colors.textWhite },
    secondary: { bg: Colors.secondary, text: Colors.textWhite },
    success: { bg: Colors.success, text: Colors.textWhite },
    danger: { bg: Colors.danger, text: Colors.textWhite },
    warning: { bg: Colors.warning, text: Colors.textWhite },
    outline: { bg: 'transparent', text: Colors.primary, border: Colors.primary },
    outlineDanger: { bg: 'transparent', text: Colors.danger, border: Colors.danger },
    ghost: { bg: 'transparent', text: Colors.primary, border: 'transparent' },
  };

  const sizes = {
    sm: { paddingH: 14, paddingV: 8, fontSize: 12, height: 36 },
    md: { paddingH: 22, paddingV: 12, fontSize: 14, height: 46 },
    lg: { paddingH: 30, paddingV: 16, fontSize: 16, height: 54 },
  };

  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.md;

  const IconComponent = icon ? (
    <Ionicons
      name={icon}
      size={s.fontSize + 4}
      color={v.text}
      style={{ marginRight: iconPosition === 'left' ? 8 : 0, marginLeft: iconPosition === 'right' ? 8 : 0 }}
    />
  ) : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.btn,
        {
          backgroundColor: v.bg,
          paddingHorizontal: s.paddingH,
          paddingVertical: s.paddingV,
          height: s.height,
          borderColor: v.border || 'transparent',
          borderWidth: v.border ? 1.5 : 0,
          opacity: disabled ? 0.5 : 1,
          borderRadius: rounded ? Radius.full : Radius.md,
          width: fullWidth ? '100%' : 'auto',
        },
        variant === 'primary' && Shadows.button,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          {iconPosition === 'left' && IconComponent}
          <Text style={{
            color: v.text,
            fontSize: s.fontSize,
            fontWeight: '600',
            textAlign: 'center'
          }}>
            {title || children}
          </Text>
          {iconPosition === 'right' && IconComponent}
        </View>
      )}
    </TouchableOpacity>
  );
}

// =========================================================
// 2. INPUT - Champ de saisie moderne
// =========================================================

export function Input({
  label,
  error,
  style,
  containerStyle,
  rightIcon,
  onRightIconPress,
  leftIcon,
  onLeftIconPress,
  secureTextEntry,
  multiline,
  numberOfLines,
  value,
  onChangeText,
  placeholder,
  required,
  ...props
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const togglePassword = () => setShowPassword(!showPassword);

  const isPassword = secureTextEntry;
  const isSecure = isPassword && !showPassword;

  return (
    <View style={[{ marginBottom: Spacing.md }, containerStyle]}>
      {label && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
          <Text style={styles.inputLabel}>{label}</Text>
          {required && <Text style={{ color: Colors.danger, marginLeft: 4 }}>*</Text>}
        </View>
      )}

      <View style={[
        styles.inputContainer,
        isFocused && styles.inputContainerFocused,
        error && styles.inputContainerError,
        multiline && { height: 'auto', minHeight: 100, alignItems: 'flex-start' }
      ]}>
        {leftIcon && (
          <TouchableOpacity
            onPress={onLeftIconPress}
            style={styles.inputLeftIcon}
            disabled={!onLeftIconPress}
          >
            <Ionicons name={leftIcon} size={22} color={isFocused ? Colors.primary : Colors.textMuted} />
          </TouchableOpacity>
        )}

        <TextInput
          {...props}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={isSecure}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines || 4 : 1}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[
            styles.input,
            leftIcon && { paddingLeft: 44 },
            (rightIcon || isPassword) && { paddingRight: 44 },
            multiline && { textAlignVertical: 'top', minHeight: 100 },
            style
          ]}
        />

        {(rightIcon || isPassword) && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={isPassword ? togglePassword : onRightIconPress}
            style={styles.inputRightIcon}
          >
            <Ionicons
              name={isPassword ? (showPassword ? 'eye-off-outline' : 'eye-outline') : rightIcon}
              size={22}
              color={isFocused ? Colors.primary : Colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <Ionicons name="alert-circle-outline" size={14} color={Colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

// =========================================================
// 3. CARD - Carte moderne
// =========================================================

export function Card({
  children,
  style,
  onPress,
  elevated = true,
  padding = Spacing.lg,
  ...props
}) {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.card,
        elevated && Shadows.card,
        { padding },
        style
      ]}
      {...props}
    >
      {children}
    </Container>
  );
}

// =========================================================
// 4. BADGE - Badge
// =========================================================

export function Badge({ label, color, style, size = 'md', icon }) {
  const sizes = {
    sm: { paddingH: 6, paddingV: 2, fontSize: 10 },
    md: { paddingH: 10, paddingV: 4, fontSize: 12 },
    lg: { paddingH: 14, paddingV: 6, fontSize: 14 },
  };

  const s = sizes[size] || sizes.md;

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
// 4b. PRIORITE BADGE
// =========================================================

export function PrioriteBadge({ priorite, size = 'md' }) {
  const color = getPrioriteColor(priorite);
  const labels = {
    basse: 'Basse',
    moyenne: 'Moyenne',
    haute: 'Haute',
    critique: 'Critique'
  };
  const icons = {
    basse: 'arrow-down-outline',
    moyenne: 'remove-outline',
    haute: 'arrow-up-outline',
    critique: 'alert-circle-outline'
  };
  return (
    <Badge
      label={labels[priorite] || priorite}
      color={color}
      size={size}
      icon={icons[priorite] || 'ellipse-outline'}
    />
  );
}

// =========================================================
// 4c. STATUT BADGE
// =========================================================

export function StatutBadge({ statut, size = 'md' }) {
  const color = getStatutColor(statut);
  const labels = {
    ouvert: 'Ouvert',
    en_cours: 'En cours',
    resolu: 'Résolu',
    ferme: 'Fermé',
    normal: 'Normal',
    congestion: 'Congestion',
    critique: 'Critique',
    en_attente: 'En attente',
    terminee: 'Terminée',
    annulee: 'Annulée',
    planifiee: 'Planifiée',
    brouillon: 'Brouillon',
    soumis: 'Soumis',
    approuve: 'Approuvé',
    rejete: 'Rejeté',
  };
  const icons = {
    ouvert: 'alert-circle-outline',
    en_cours: 'sync-outline',
    resolu: 'checkmark-circle-outline',
    ferme: 'lock-closed-outline',
    normal: 'checkmark-done-outline',
    congestion: 'warning-outline',
    critique: 'alert-outline',
    en_attente: 'time-outline',
    terminee: 'checkmark-done-outline',
    annulee: 'close-circle-outline',
    planifiee: 'calendar-outline',
    brouillon: 'create-outline',
    soumis: 'send-outline',
    approuve: 'thumbs-up-outline',
    rejete: 'thumbs-down-outline',
  };
  return (
    <Badge
      label={labels[statut] || statut}
      color={color}
      size={size}
      icon={icons[statut] || 'ellipse-outline'}
    />
  );
}

// =========================================================
// 4d. SEVERITE BADGE
// =========================================================

export function SeveriteBadge({ severite, size = 'md' }) {
  const color = getSeveriteColor(severite);
  const labels = {
    faible: 'Faible',
    moyenne: 'Moyenne',
    elevee: 'Élevée',
    critique: 'Critique'
  };
  const icons = {
    faible: 'information-circle-outline',
    moyenne: 'alert-circle-outline',
    elevee: 'warning-outline',
    critique: 'alert-outline'
  };
  return (
    <Badge
      label={labels[severite] || severite}
      color={color}
      size={size}
      icon={icons[severite] || 'ellipse-outline'}
    />
  );
}

// =========================================================
// 5. STAT CARD - Carte de statistique
// =========================================================

export function StatCard({ label, value, color = Colors.primary, icon, subtitle, onPress }) {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.statCard, { borderLeftColor: color }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        {icon && <Ionicons name={icon} size={28} color={color} />}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </Container>
  );
}

// =========================================================
// 6. SECTION HEADER - En-tête de section
// =========================================================

export function SectionHeader({
  title,
  action,
  onAction,
  icon,
  subtitle,
  actionIcon = 'add-outline'
}) {
  return (
    <View style={styles.sectionHeader}>
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {icon && <Ionicons name={icon} size={20} color={Colors.primary} style={{ marginRight: 8 }} />}
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {action && (
        <TouchableOpacity onPress={onAction} style={styles.sectionActionBtn}>
          <Ionicons name={actionIcon} size={20} color={Colors.primary} />
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// =========================================================
// 7. LOADING SCREEN - Écran de chargement
// =========================================================

export function LoadingScreen({ message = 'Chargement...', fullScreen = true }) {
  const Content = (
    <View style={[styles.loadingScreen, !fullScreen && { flex: 1, padding: Spacing.xxl }]}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );

  if (fullScreen) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
        <StatusBar barStyle="dark-content" />
        {Content}
      </SafeAreaView>
    );
  }

  return Content;
}

// =========================================================
// 8. EMPTY STATE - État vide
// =========================================================

export function EmptyState({
  title,
  subtitle,
  icon = '📭',
  actionText,
  onAction,
  illustration
}) {
  return (
    <View style={styles.emptyState}>
      {illustration ? (
        <View style={styles.emptyIllustration}>{illustration}</View>
      ) : (
        <Text style={styles.emptyIcon}>{icon}</Text>
      )}
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
      {actionText && onAction && (
        <Button
          title={actionText}
          onPress={onAction}
          variant="primary"
          size="sm"
          style={{ marginTop: Spacing.lg }}
        />
      )}
    </View>
  );
}

// =========================================================
// 9. PROGRESS BAR - Barre de progression
// =========================================================

export function ProgressBar({ value, max = 100, color, label, height = 8, animated = true }) {
  const pct = Math.min((value / max) * 100, 100);
  const barColor = color || (pct > 90 ? Colors.danger : pct > 75 ? Colors.warning : Colors.success);

  return (
    <View>
      {label && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={Typography.caption}>{label}</Text>
          <Text style={[Typography.caption, { fontWeight: '600' }]}>{pct.toFixed(0)}%</Text>
        </View>
      )}
      <View style={[styles.progressBg, { height }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${pct}%`, backgroundColor: barColor, height }
          ]}
        />
      </View>
    </View>
  );
}

// =========================================================
// 10. SELECTOR - Sélecteur d'options
// =========================================================

export function Selector({
  label,
  value,
  options,
  onChange,
  style,
  multi = false,
  required
}) {
  const [selectedValues, setSelectedValues] = useState(multi ? (value || []) : value);

  const handleSelect = (optValue) => {
    if (multi) {
      const newValues = selectedValues.includes(optValue)
        ? selectedValues.filter(v => v !== optValue)
        : [...selectedValues, optValue];
      setSelectedValues(newValues);
      onChange(newValues);
    } else {
      setSelectedValues(optValue);
      onChange(optValue);
    }
  };

  const isSelected = (optValue) => {
    return multi ? selectedValues.includes(optValue) : selectedValues === optValue;
  };

  return (
    <View style={[{ marginBottom: Spacing.md }, style]}>
      {label && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={styles.inputLabel}>{label}</Text>
          {required && <Text style={{ color: Colors.danger, marginLeft: 4 }}>*</Text>}
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => handleSelect(opt.value)}
            style={[
              styles.selectorOption,
              isSelected(opt.value) && styles.selectorOptionActive
            ]}
          >
            {opt.icon && <Ionicons name={opt.icon} size={16} color={isSelected(opt.value) ? Colors.textWhite : Colors.textSecondary} style={{ marginRight: 6 }} />}
            <Text style={[
              styles.selectorText,
              isSelected(opt.value) && styles.selectorTextActive
            ]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// =========================================================
// 11. AVATAR - Avatar utilisateur
// =========================================================

export function Avatar({
  name,
  size = 50,
  source,
  online = false,
  onPress,
  style
}) {
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      onPress={onPress}
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
        style
      ]}
    >
      {source ? (
        <Image source={source} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{initials}</Text>
        </View>
      )}
      {online && (
        <View style={[styles.avatarOnline, { width: size * 0.25, height: size * 0.25, borderRadius: size * 0.125, bottom: 2, right: 2 }]} />
      )}
    </Container>
  );
}

// =========================================================
// 12. SEARCH BAR - Barre de recherche
// =========================================================

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Rechercher...',
  onClear,
  style
}) {
  return (
    <View style={[styles.searchBar, style]}>
      <Ionicons name="search-outline" size={20} color={Colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        style={styles.searchInput}
      />
      {value?.length > 0 && (
        <TouchableOpacity onPress={onClear || (() => onChangeText(''))}>
          <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// =========================================================
// 13. MODAL - Modal
// =========================================================

export function Modal({
  visible,
  onClose,
  title,
  children,
  fullScreen = false,
  style
}) {
  return (
    <RNModal
      visible={visible}
      transparent={!fullScreen}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={fullScreen ? styles.modalFullScreen : styles.modalOverlay}>
        <View style={[
          fullScreen ? styles.modalContentFull : styles.modalContent,
          style
        ]}>
          {title && (
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
          )}
          <ScrollView showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </RNModal>
  );
}

// =========================================================
// 14. CHIP - Chip
// =========================================================

export function Chip({ label, onPress, selected = false, icon, color = Colors.primary }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        selected && { backgroundColor: color, borderColor: color }
      ]}
    >
      {icon && <Ionicons name={icon} size={16} color={selected ? Colors.textWhite : color} style={{ marginRight: 4 }} />}
      <Text style={[
        styles.chipText,
        selected && { color: Colors.textWhite }
      ]}>{label}</Text>
    </TouchableOpacity>
  );
}

// =========================================================
// 15. LIST ITEM - Élément de liste
// =========================================================

export function ListItem({
  title,
  subtitle,
  leftIcon,
  rightIcon,
  onPress,
  badge,
  style
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.listItem, style]}
    >
      {leftIcon && (
        <View style={styles.listItemLeft}>
          <Ionicons name={leftIcon} size={24} color={Colors.primary} />
        </View>
      )}
      <View style={styles.listItemContent}>
        <Text style={styles.listItemTitle}>{title}</Text>
        {subtitle && <Text style={styles.listItemSubtitle}>{subtitle}</Text>}
      </View>
      {badge && <View style={styles.listItemBadge}>{badge}</View>}
      {rightIcon && (
        <View style={styles.listItemRight}>
          <Ionicons name={rightIcon} size={20} color={Colors.textMuted} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// =========================================================
// 16. FLOATING BUTTON - Bouton flottant
// =========================================================

export function FloatingButton({ onPress, icon = 'add', color = Colors.primary, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.floatingButton, { backgroundColor: color }, Shadows.button, style]}
      activeOpacity={0.8}
    >
      <Ionicons name={icon} size={28} color={Colors.textWhite} />
    </TouchableOpacity>
  );
}

// =========================================================
// 17. TABS - Onglets
// =========================================================

export function Tabs({ tabs, activeTab, onChange, style }) {
  return (
    <View style={[styles.tabsContainer, style]}>
      {tabs.map((tab, index) => (
        <TouchableOpacity
          key={index}
          onPress={() => onChange(tab.key)}
          style={[
            styles.tab,
            activeTab === tab.key && styles.tabActive
          ]}
        >
          {tab.icon && <Ionicons name={tab.icon} size={20} color={activeTab === tab.key ? Colors.primary : Colors.textMuted} style={{ marginRight: 6 }} />}
          <Text style={[
            styles.tabText,
            activeTab === tab.key && styles.tabTextActive
          ]}>{tab.label}</Text>
          {tab.badge && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{tab.badge}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// =========================================================
// 18. STEPPER - Étape
// =========================================================

export function Stepper({ steps, currentStep, onChange }) {
  return (
    <View style={styles.stepperContainer}>
      {steps.map((step, index) => (
        <View key={index} style={styles.stepperItem}>
          <TouchableOpacity
            onPress={() => onChange(index)}
            style={[
              styles.stepperCircle,
              index === currentStep && styles.stepperCircleActive,
              index < currentStep && styles.stepperCircleCompleted
            ]}
          >
            <Text style={styles.stepperCircleText}>
              {index < currentStep ? '✓' : index + 1}
            </Text>
          </TouchableOpacity>
          <Text style={[
            styles.stepperLabel,
            index === currentStep && styles.stepperLabelActive
          ]}>{step}</Text>
          {index < steps.length - 1 && (
            <View style={[
              styles.stepperLine,
              index < currentStep && styles.stepperLineCompleted
            ]} />
          )}
        </View>
      ))}
    </View>
  );
}

// =========================================================
// 19. TOAST - Notification toast
// =========================================================

export function Toast({
  visible,
  message,
  type = 'info',
  onDismiss,
  duration = 3000
}) {
  useEffect(() => {
    if (visible && onDismiss) {
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const colors = {
    success: Colors.success,
    error: Colors.danger,
    warning: Colors.warning,
    info: Colors.primary,
  };

  const icons = {
    success: 'checkmark-circle',
    error: 'alert-circle',
    warning: 'warning',
    info: 'information-circle',
  };

  if (!visible) return null;

  return (
    <Animated.View style={[styles.toastContainer, { backgroundColor: colors[type] || Colors.primary }]}>
      <Ionicons name={icons[type] || 'information-circle'} size={24} color={Colors.textWhite} />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

// =========================================================
// 20. STYLES
// =========================================================

const styles = StyleSheet.create({
  // Button
  btn: {
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    minHeight: 46,
  },
  inputContainerFocused: {
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputContainerError: {
    borderColor: Colors.danger,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    paddingHorizontal: 0,
  },
  inputLabel: {
    ...Typography.label,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  inputLeftIcon: {
    marginRight: Spacing.sm,
  },
  inputRightIcon: {
    marginLeft: Spacing.sm,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.danger,
    marginLeft: 4,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
  },

  // Badge
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeText: {
    fontWeight: '600',
  },

  // StatCard
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderLeftWidth: 4,
    ...Shadows.card,
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  statSubtitle: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },

  // SectionHeader
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h3,
    fontWeight: '700',
  },
  sectionSubtitle: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sectionAction: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary + '10',
  },

  // Loading
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.textMuted,
    fontSize: 14,
  },

  // EmptyState
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.lg,
  },
  emptyIllustration: {
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.h3,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: 'center',
    color: Colors.textMuted,
  },

  // ProgressBar
  progressBg: {
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: Radius.full,
  },

  // Selector
  selectorOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectorOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  selectorText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  selectorTextActive: {
    color: Colors.textWhite,
  },

  // Avatar
  avatar: {
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  avatarPlaceholder: {
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontWeight: '700',
    color: Colors.primary,
  },
  avatarOnline: {
    position: 'absolute',
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.surface,
  },

  // SearchBar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 14,
    color: Colors.textPrimary,
    padding: 0,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalFullScreen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    maxHeight: '90%',
  },
  modalContentFull: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.h3,
    fontWeight: '600',
  },

  // Chip
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },

  // ListItem
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  listItemLeft: {
    marginRight: Spacing.md,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    ...Typography.body,
    fontWeight: '500',
  },
  listItemSubtitle: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  listItemRight: {
    marginLeft: Spacing.sm,
  },
  listItemBadge: {
    marginRight: Spacing.sm,
  },

  // FloatingButton
  floatingButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.button,
    position: 'absolute',
    bottom: Spacing.xxl,
    right: Spacing.lg,
    zIndex: 999,
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
  },
  tabActive: {
    backgroundColor: Colors.primary + '15',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: Colors.danger,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 4,
  },
  tabBadgeText: {
    color: Colors.textWhite,
    fontSize: 10,
    fontWeight: '600',
  },

  // Stepper
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  stepperItem: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  stepperCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  stepperCircleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepperCircleCompleted: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  stepperCircleText: {
    color: Colors.textWhite,
    fontWeight: '700',
    fontSize: 14,
  },
  stepperLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  stepperLabelActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  stepperLine: {
    position: 'absolute',
    top: 18,
    left: '50%',
    right: '-50%',
    height: 2,
    backgroundColor: Colors.border,
  },
  stepperLineCompleted: {
    backgroundColor: Colors.success,
  },

  // Toast
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: Spacing.md,
    right: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.button,
    zIndex: 9999,
  },
  toastText: {
    color: Colors.textWhite,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: Spacing.sm,
    flex: 1,
  },
});

// Export du composant Image pour Avatar
import { Image } from 'react-native';