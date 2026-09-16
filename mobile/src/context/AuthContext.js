/**
 * ========================================================
 * CONTEXTE D'AUTHENTIFICATION - BBS MOBILE
 * ========================================================
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, api } from '../services/api';

// =========================================================
// CONSTANTES
// =========================================================

const STORAGE_KEYS = {
  TOKEN: 'bbs_token',
  USER: 'bbs_user',
  EXPIRY: 'bbs_token_expiry',
};

const ROLES = {
  ADMIN: 'admin',
  DJ: 'dj',
  SUPERVISEUR: 'superviseur',
  TECHNICIEN: 'technicien',
};

const ROLE_HIERARCHY = {
  admin: 4,
  dj: 3,
  superviseur: 2,
  technicien: 1,
};

const ROLE_NAMES = {
  admin: 'Administrateur',
  dj: 'Directeur Junior',
  superviseur: 'Superviseur',
  technicien: 'Technicien',
};

const ROLE_COLORS = {
  admin: '#B91C1C',
  dj: '#059669',
  superviseur: '#1D4ED8',
  technicien: '#7C3AED',
};

// =========================================================
// CONTEXT
// =========================================================

const AuthContext = createContext(null);
export { AuthContext };

// =========================================================
// PROVIDER
// =========================================================

export function AuthProvider({ children }) {
  // États
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(null);
  const [permissions, setPermissions] = useState([]);

  // =========================================================
  // FONCTIONS UTILITAIRES
  // =========================================================

  const getRoleName = useCallback((role) => {
    return ROLE_NAMES[role] || role;
  }, []);

  const getRoleColor = useCallback((role) => {
    return ROLE_COLORS[role] || '#6B7280';
  }, []);

  // =========================================================
  // CHARGEMENT DES PERMISSIONS (DEPUIS LE BACKEND)
  // =========================================================

  const loadPermissionsFromBackend = useCallback(async (userData) => {
    // Les admins et DJ n'ont pas de permissions restreintes
    if (userData.role === ROLES.ADMIN || userData.role === ROLES.DJ) {
      setPermissions([]);
      return;
    }

    // Seuls les techniciens ont des permissions spécifiques
    if (userData.role !== ROLES.TECHNICIEN) {
      setPermissions([]);
      return;
    }

    // Récupérer l'ID du technicien depuis roleData
    const technicienId = userData.roleData?.id;
    if (!technicienId) {
      console.warn('⚠️ Aucun ID technicien trouvé pour charger les permissions');
      setPermissions([]);
      return;
    }

    try {
      const response = await api.get(`/techniciens/${technicienId}/permissions`);
      const perms = response.data?.permissions || [];
      setPermissions(perms);
      console.log(`✅ ${perms.length} permissions chargées pour le technicien`);
    } catch (error) {
      console.error('❌ Erreur de chargement des permissions:', error);
      setPermissions([]);
    }
  }, []);

  // =========================================================
  // RESTAURATION DE SESSION
  // =========================================================

  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const savedToken = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      const savedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);

      if (savedToken && savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          const me = await authAPI.me();

          if (me && me.actif !== 0) {
            setUser(me);
            setToken(savedToken);
            setIsAuthenticated(true);

            // ✅ Charger les permissions depuis le backend
            await loadPermissionsFromBackend(me);

            console.log('✅ Session restaurée pour:', me.email);
          } else {
            await clearSession();
          }
        } catch (error) {
          console.log('❌ Erreur de restauration:', error.message);
          await clearSession();
        }
      }
    } catch (error) {
      console.error('❌ Erreur de restauration de session:', error);
      await clearSession();
    } finally {
      setLoading(false);
    }
  }, [loadPermissionsFromBackend]);

  // =========================================================
  // CLEAR SESSION
  // =========================================================

  const clearSession = useCallback(async () => {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.USER,
      STORAGE_KEYS.EXPIRY,
    ]);
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    setPermissions([]);
  }, []);

  // =========================================================
  // LOGIN
  // =========================================================

  const login = useCallback(async (email, password) => {
    try {
      setLoading(true);
      setError(null);

      const data = await authAPI.login(email, password);

      if (!data || !data.token || !data.user) {
        throw new Error('Données de connexion invalides');
      }

      await AsyncStorage.multiSet([
        [STORAGE_KEYS.TOKEN, data.token],
        [STORAGE_KEYS.USER, JSON.stringify(data.user)],
      ]);

      setUser(data.user);
      setToken(data.token);
      setIsAuthenticated(true);

      // ✅ Charger les permissions depuis le backend
      await loadPermissionsFromBackend(data.user);

      console.log('✅ Connexion réussie pour:', data.user.email);

      return { success: true, user: data.user };

    } catch (error) {
      console.error('❌ Erreur de connexion:', error);
      setError(error.message || 'Erreur de connexion');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [loadPermissionsFromBackend]);

  // =========================================================
  // LOGOUT
  // =========================================================

  const logout = useCallback(async () => {
    try {
      setLoading(true);
      if (token) {
        try {
          await authAPI.logout();
        } catch (e) {
          // Ignorer les erreurs de déconnexion
        }
      }
    } catch (error) {
      console.error('❌ Erreur de déconnexion:', error);
    } finally {
      await clearSession();
      setLoading(false);
    }
  }, [token, clearSession]);

  // =========================================================
  // REFRESH TOKEN
  // =========================================================

  const refreshToken = useCallback(async () => {
    if (!token) return null;
    try {
      const data = await authAPI.refreshToken();
      if (data && data.token) {
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
        setToken(data.token);
        return data.token;
      }
      return null;
    } catch (error) {
      console.error('❌ Erreur de rafraîchissement token:', error);
      return null;
    }
  }, [token]);

  // =========================================================
  // UPDATE USER
  // =========================================================

  const updateUser = useCallback(async (userData) => {
    try {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));

      // ✅ Recharger les permissions si le rôle ou les données du technicien changent
      if (updatedUser.role === ROLES.TECHNICIEN) {
        await loadPermissionsFromBackend(updatedUser);
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Erreur de mise à jour utilisateur:', error);
      return { success: false, error: error.message };
    }
  }, [user, loadPermissionsFromBackend]);

  // =========================================================
  // CHANGE PASSWORD
  // =========================================================

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      await authAPI.changePassword(currentPassword, newPassword);
      return { success: true };
    } catch (error) {
      console.error('❌ Erreur de changement de mot de passe:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // =========================================================
  // ROLE CHECKERS
  // =========================================================

  const hasRole = useCallback((role) => {
    if (!user) return false;
    if (Array.isArray(role)) {
      return role.includes(user.role);
    }
    return user.role === role;
  }, [user]);

  const hasMinRoleLevel = useCallback((minRole) => {
    if (!user) return false;
    const userLevel = ROLE_HIERARCHY[user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;
    return userLevel >= requiredLevel;
  }, [user]);

  // =========================================================
  // HAS PERMISSION (utilise les permissions dynamiques)
  // =========================================================

  const hasPermission = useCallback((permission) => {
    if (!user) return false;
    if (user.role === ROLES.ADMIN) return true;
    if (user.role === ROLES.DJ) return true;
    if (user.role === ROLES.SUPERVISEUR) return true;
    // Pour les techniciens, on vérifie la permission dans la liste chargée
    return permissions.includes(permission);
  }, [user, permissions]);

  // =========================================================
  // COMPUTED PROPERTIES
  // =========================================================

  const computed = useMemo(() => {
    const roleName = user?.role ? getRoleName(user.role) : null;
    const roleColor = user?.role ? getRoleColor(user.role) : null;
    const fullName = user ? `${user.prenom || ''} ${user.nom || ''}`.trim() : null;

    return {
      // Données utilisateur
      user,
      token,
      isAuthenticated,
      loading,
      error,
      permissions,

      // Vérifications de rôle
      isAdmin: user?.role === ROLES.ADMIN,
      isDJ: user?.role === ROLES.DJ,
      isSuperviseur: user?.role === ROLES.SUPERVISEUR,
      isTechnicien: user?.role === ROLES.TECHNICIEN,

      // Permissions spécifiques (pratiques pour l'UI)
      canManageUsers: user?.role === ROLES.ADMIN,
      canManageSuperviseurs: user?.role === ROLES.ADMIN || user?.role === ROLES.DJ,
      canManageTechniciens: user?.role === ROLES.ADMIN || user?.role === ROLES.SUPERVISEUR,
      canManageMissions: user?.role === ROLES.SUPERVISEUR || hasPermission('creer_mission'),
      canManageRapports: user?.role === ROLES.TECHNICIEN || hasPermission('creer_rapport'),
      canManageIncidents: user?.role === ROLES.TECHNICIEN || user?.role === ROLES.SUPERVISEUR,
      canValidateRapports: user?.role === ROLES.SUPERVISEUR || user?.role === ROLES.DJ,
      canViewStatistiques: user?.role !== ROLES.TECHNICIEN || hasPermission('voir_statistiques'),
      canManageSuiviClients: user?.role === ROLES.SUPERVISEUR,
      canViewHistorique: user?.role === ROLES.ADMIN,
      canManagePermissions: user?.role === ROLES.ADMIN || user?.role === ROLES.DJ,
      canSendMessages: hasPermission('envoyer_message'),

      // Informations supplémentaires
      role: user?.role,
      roleName,
      roleColor,
      fullName,

      // Fonctions
      getRoleName,
      getRoleColor,
    };
  }, [user, isAuthenticated, loading, error, token, permissions, getRoleName, getRoleColor, hasPermission]);

  // =========================================================
  // VALUE
  // =========================================================

  const value = {
    ...computed,
    login,
    logout,
    refreshToken,
    updateUser,
    changePassword,
    hasRole,
    hasMinRoleLevel,
    hasPermission,
    clearSession,
    ROLES,
    ROLE_HIERARCHY,
    getRoleName,
    getRoleColor,
    // Exposer la fonction de chargement des permissions pour un éventuel rechargement manuel
    reloadPermissions: () => loadPermissionsFromBackend(user),
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// =========================================================
// HOOKS
// =========================================================

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};

export const useAuthState = () => {
  const { user, isAuthenticated, loading, error } = useAuth();
  return { user, isAuthenticated, loading, error };
};

export const useAuthActions = () => {
  const { login, logout, refreshToken, updateUser, changePassword } = useAuth();
  return { login, logout, refreshToken, updateUser, changePassword };
};

export const useAuthPermissions = () => {
  const { hasPermission, hasRole, hasMinRoleLevel, permissions, role } = useAuth();
  return { hasPermission, hasRole, hasMinRoleLevel, permissions, role };
};

// =========================================================
// EXPORT PAR DÉFAUT
// =========================================================

export default AuthContext;