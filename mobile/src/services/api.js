// mobile/src/services/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =========================================================
// CONFIGURATION
// =========================================================

const API_URL = "http://10.40.223.120:3000/api";
const TIMEOUT = 30000;

// =========================================================
// CRÉATION DE L'INSTANCE AXIOS
// =========================================================

const api = axios.create({
  baseURL: API_URL,
  timeout: TIMEOUT,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

// =========================================================
// INTERCEPTEUR DE REQUÊTE
// =========================================================

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('bbs_token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Pour les requêtes FormData, laisser axios gérer le Content-Type
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    } else {
      config.headers['Content-Type'] = 'application/json';
    }

    if (__DEV__) {
      console.log('➡️ [API] Requête:', {
        url: config.url,
        method: config.method,
        data: config.data instanceof FormData ? 'FormData' : config.data,
      });
    }

    return config;
  },
  (error) => {
    console.error('❌ [API] Erreur requête:', error);
    return Promise.reject(error);
  }
);

// =========================================================
// INTERCEPTEUR DE RÉPONSE
// =========================================================

api.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log('⬅️ [API] Réponse:', {
        url: response.config.url,
        status: response.status,
      });
    }
    return response.data;
  },
  async (error) => {
    const url = error.config?.url || '';
    const isForbidden = error.response?.status === 403;
    const isRestrictedEndpoint =
      url.includes('/missions/statistiques') ||
      url.includes('/techniciens') ||
      url.includes('/superviseurs') ||
      url.includes('/techniciens/statistiques') ||
      url.includes('/superviseurs/statistiques');

    if (isForbidden && isRestrictedEndpoint) {
      if (__DEV__) {
        console.log(`⏭️ [API] 403 ignoré pour ${url}`);
      }
      return Promise.resolve({ data: null, success: false });
    }

    console.error('❌ [API] Erreur:', {
      status: error.response?.status,
      url: url,
      message: error.message,
      data: error.response?.data,
    });

    if (error.response?.status === 401) {
      const token = await AsyncStorage.getItem('bbs_token');
      if (token) {
        await AsyncStorage.multiRemove(['bbs_token', 'bbs_user', 'bbs_token_expiry']);
      }
    }

    const errorMessage =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'Erreur réseau';

    return Promise.reject(new Error(errorMessage));
  }
);

// =========================================================
// FONCTIONS UTILITAIRES
// =========================================================

const getAuthToken = async () => {
  return await AsyncStorage.getItem('bbs_token');
};

// =========================================================
// AUTH API
// =========================================================

export const authAPI = {
  login: (email, password) => {
    return api.post('/auth/login', {
      email: email?.toString().trim(),
      mot_de_passe: password?.toString().trim(),
    });
  },

  me: () => api.get('/auth/me'),

  logout: () => api.post('/auth/logout'),

  changePassword: (ancienMotDePasse, nouveauMotDePasse) => {
    return api.post('/auth/change-password', {
      ancien_mot_de_passe: ancienMotDePasse,
      nouveau_mot_de_passe: nouveauMotDePasse,
    });
  },

  refreshToken: () => api.post('/auth/refresh-token'),

  forgotPassword: (email) => {
    return api.post('/auth/forgot-password', { email });
  },

  resetPassword: (token, nouveauMotDePasse) => {
    return api.post('/auth/reset-password', {
      token,
      nouveau_mot_de_passe: nouveauMotDePasse,
    });
  },

  register: (data) => api.post('/auth/register', data),
};

// =========================================================
// UTILISATEURS API
// =========================================================

export const usersAPI = {
  list: (params) => api.get('/utilisateurs', { params }),
  get: (id) => api.get(`/utilisateurs/${id}`),
  create: (data) => api.post('/utilisateurs', data),
  update: (id, data) => api.put(`/utilisateurs/${id}`, data),
  toggle: (id, actif) => api.patch(`/utilisateurs/${id}/activer`, { actif }),
  delete: (id) => api.delete(`/utilisateurs/${id}`),
  getByRole: (role) => api.get(`/utilisateurs/role/${role}`),
  search: (query) => api.get('/utilisateurs/search', { params: query }),
  statistiques: () => api.get('/utilisateurs/statistiques'),
};

// =========================================================
// SUPERVISEURS API
// =========================================================

export const superviseursAPI = {
  list: (params) => api.get('/superviseurs', { params }),
  get: (id) => api.get(`/superviseurs/${id}`),
  detail: (id) => api.get(`/superviseurs/${id}`),
  missions: (id, params) => api.get(`/superviseurs/${id}/missions`, { params }),
  incidents: (id, params) => api.get(`/superviseurs/${id}/incidents`, { params }),
  rapports: (id, params) => api.get(`/superviseurs/${id}/rapports`, { params }),
  create: (data) => api.post('/superviseurs', data),
  update: (id, data) => api.put(`/superviseurs/${id}`, data),
  delete: (id) => api.delete(`/superviseurs/${id}`),
  getByZone: (zone) => api.get(`/superviseurs/zone/${zone}`),
  search: (query) => api.get('/superviseurs/recherche', { params: query }),
  statistiques: () => api.get('/superviseurs/statistiques'),
};

// =========================================================
// TECHNICIENS API
// =========================================================

export const techniciensAPI = {
  list: (params) => api.get('/techniciens', { params }),
  disponibles: () => api.get('/techniciens/disponibles'),
  get: (id) => api.get(`/techniciens/${id}`),
  missions: (id, params) => api.get(`/techniciens/${id}/missions`, { params }),
  rapports: (id, params) => api.get(`/techniciens/${id}/rapports`, { params }),
  incidents: (id, params) => api.get(`/techniciens/${id}/incidents`, { params }),
  create: (data) => api.post('/techniciens', data),
  update: (id, data) => api.put(`/techniciens/${id}`, data),
  delete: (id) => api.delete(`/techniciens/${id}`),
  setDisponible: (id, disponible) => api.patch(`/techniciens/${id}/disponible`, { disponible }),
  updatePosition: (id, latitude, longitude) => api.patch(`/techniciens/${id}/position`, { latitude, longitude }),
  search: (query) => api.get('/techniciens/recherche', { params: query }),
  statistiques: () => api.get('/techniciens/statistiques'),
};

// =========================================================
// MISSIONS API
// =========================================================

export const missionsAPI = {
  list: (params) => api.get('/missions', { params }),
  get: (id) => api.get(`/missions/${id}`),
  create: (data) => api.post('/missions', data),
  update: (id, data) => api.put(`/missions/${id}`, data),
  delete: (id) => api.delete(`/missions/${id}`),
  affecter: (id, technicien_id) => api.patch(`/missions/${id}/affecter`, { technicien_id }),
  setStatut: (id, statut) => api.patch(`/missions/${id}/statut`, { statut }),
  terminer: (id, notes) => api.patch(`/missions/${id}/terminer`, { notes }),
  getByTechnicien: (id, params) => api.get(`/missions/technicien/${id}`, { params }),
  getBySuperviseur: (id, params) => api.get(`/missions/superviseur/${id}`, { params }),
  getByStatut: (statut, params) => api.get(`/missions/statut/${statut}`, { params }),
  planification: (params) => api.get('/missions/planification', { params }),
  search: (query) => api.get('/missions/recherche', { params: query }),
  statistiques: () => api.get('/missions/statistiques'),
};

// =========================================================
// RAPPORTS API
// =========================================================

export const rapportsAPI = {
  list: (params) => api.get('/rapports', { params }),
  get: (id) => api.get(`/rapports/${id}`),
  create: (formData) => {
    return api.post('/rapports', formData);
  },
  update: (id, formData) => {
    return api.put(`/rapports/${id}`, formData);
  },
  delete: (id) => api.delete(`/rapports/${id}`),
  setStatut: (id, statut) => api.patch(`/rapports/${id}/statut`, { statut }),
  addPhotos: (id, formData) => {
    return api.post(`/rapports/${id}/photos`, formData);
  },
  deletePhoto: (rapportId, photoId) => api.delete(`/rapports/${rapportId}/photos/${photoId}`),
  getByTechnicien: (id, params) => api.get(`/rapports/technicien/${id}`, { params }),
  getByMission: (id, params) => api.get(`/rapports/mission/${id}`, { params }),
  getByStatut: (statut, params) => api.get(`/rapports/statut/${statut}`, { params }),
  search: (query) => api.get('/rapports/recherche', { params: query }),
  statistiques: () => api.get('/rapports/statistiques'),
};

// =========================================================
// INCIDENTS API
// =========================================================

export const incidentsAPI = {
  list: (params) => api.get('/incidents', { params }),
  get: (id) => api.get(`/incidents/${id}`),
  create: (data) => api.post('/incidents', data),
  update: (id, data) => api.put(`/incidents/${id}`, data),
  delete: (id) => api.delete(`/incidents/${id}`),
  setStatut: (id, statut) => api.patch(`/incidents/${id}/statut`, { statut }),
  resoudre: (id, solution_apportee) => api.patch(`/incidents/${id}/resoudre`, { solution_apportee }),
  assigner: (id, technicien_id) => api.patch(`/incidents/${id}/assigner`, { technicien_id }),
  getByTechnicien: (id, params) => api.get(`/incidents/technicien/${id}`, { params }),
  getBySuperviseur: (id, params) => api.get(`/incidents/superviseur/${id}`, { params }),
  getByStatut: (statut, params) => api.get(`/incidents/statut/${statut}`, { params }),
  getBySeverite: (severite, params) => api.get(`/incidents/severite/${severite}`, { params }),
  search: (query) => api.get('/incidents/recherche', { params: query }),
  statistiques: () => api.get('/incidents/statistiques'),
};

// =========================================================
// MESSAGES API
// =========================================================

export const messagesAPI = {
  getGroupe: (params) => api.get('/messages/groupe', { params }),
  sendGroupe: (data) => api.post('/messages/groupe', data),
  repondre: (id, data) => api.post(`/messages/${id}/repondre`, data),
  update: (id, data) => api.put(`/messages/${id}`, data),
  delete: (id) => api.delete(`/messages/${id}`),
  deleteBatch: (ids) => api.delete('/messages/batch', { data: { ids } }),
  addReaction: (id, reaction) => api.post(`/messages/${id}/reaction`, { reaction }),
  removeReaction: (id) => api.delete(`/messages/${id}/reaction`),
  sendPhoto: (id, formData) => {
    return api.post(`/messages/${id}/photo`, formData);
  },
  sendAudio: (id, formData) => {
    return api.post(`/messages/${id}/audio`, formData);
  },
  sendVideo: (id, formData) => {
    return api.post(`/messages/${id}/video`, formData);
  },
  markAsRead: (id) => api.patch(`/messages/${id}/lu`),
  getNonLus: () => api.get('/messages/non-lus'),
  search: (query) => api.get('/messages/recherche', { params: query }),
  statistiques: () => api.get('/messages/statistiques'),
};

// =========================================================
// NOTIFICATIONS API
// =========================================================

export const notificationsAPI = {
  list: (params) => api.get('/notifications', { params }),
  get: (id) => api.get(`/notifications/${id}`),
  getNonLues: (params) => api.get('/notifications/non-lues', { params }),
  getUnreadCount: () => api.get('/notifications/compte-non-lues'),
  markAsRead: (id) => api.patch(`/notifications/${id}/lu`),
  markAllAsRead: () => api.patch('/notifications/lire-toutes'),
  delete: (id) => api.delete(`/notifications/${id}`),
  deleteBatch: (ids) => api.delete('/notifications/batch', { data: { ids } }),
  clearRead: () => api.delete('/notifications/clear'),
  create: (data) => api.post('/notifications', data),
  statistiques: async () => {
    try {
      return await api.get('/notifications/statistiques');
    } catch (error) {
      if (
        error.message?.includes('Erreur interne du serveur') ||
        error.message?.includes('Accès réservé') ||
        error.message?.includes('Notification non trouvée')
      ) {
        return null;
      }
      console.error('❌ Erreur récupération statistiques notifications:', error);
      throw error;
    }
  },
};

// =========================================================
// RESEAU API
// =========================================================

export const reseauAPI = {
  getEtat: (params) => api.get('/reseau/etat', { params }),
  getEtatByZone: (zone, params) => api.get(`/reseau/etat/${zone}`, { params }),
  getLatest: () => api.get('/reseau/etat/latest'),
  enregistrer: (data) => api.post('/reseau/etat', data),
  update: (id, data) => api.put(`/reseau/etat/${id}`, data),
  statistiques: () => api.get('/reseau/statistiques'),
  alertes: (params) => api.get('/reseau/alertes', { params }),
  zones: () => api.get('/reseau/zones'),
  historique: (zone, params) => api.get(`/reseau/historique/${zone}`, { params }),
  performance: () => api.get('/reseau/performance'),
};

// =========================================================
// STATISTIQUES API
// =========================================================

export const statsAPI = {
  dashboard: () => api.get('/statistiques/dashboard'),
  rapports: (params) => api.get('/statistiques/rapports', { params }),
  missions: () => api.get('/statistiques/missions'),
  incidents: () => api.get('/statistiques/incidents'),
  techniciens: () => api.get('/statistiques/techniciens'),
  reseau: () => api.get('/statistiques/reseau'),
  performance: () => api.get('/statistiques/performance'),
  rapportMensuel: (params) => api.get('/statistiques/rapport-mensuel', { params }),
  technicien: (id) => api.get(`/statistiques/technicien/${id}`),
  superviseur: (id) => api.get(`/statistiques/superviseur/${id}`),
  export: (params) => api.get('/statistiques/export', { params, responseType: 'blob' }),
};

// =========================================================
// PERMISSIONS API
// =========================================================

export const permissionsAPI = {
  list: (params) => api.get('/permissions', { params }),
  get: (id) => api.get(`/permissions/${id}`),
  create: (data) => api.post('/permissions', data),
  update: (id, data) => api.put(`/permissions/${id}`, data),
  delete: (id) => api.delete(`/permissions/${id}`),
  valider: (id, valide) => api.patch(`/permissions/${id}/valider`, { valide }),
  getBySuperviseur: (id) => api.get(`/permissions/superviseur/${id}`),
  statistiques: () => api.get('/permissions/statistiques'),
};

// =========================================================
// SUIVI CLIENTS API
// =========================================================

export const suiviClientsAPI = {
  list: (params) => api.get('/suivi-clients', { params }),
  get: (id) => api.get(`/suivi-clients/${id}`),
  create: (data) => api.post('/suivi-clients', data),
  update: (id, data) => api.put(`/suivi-clients/${id}`, data),
  setStatut: (id, statut) => api.patch(`/suivi-clients/${id}/statut`, { statut }),
  getByStatut: (statut, params) => api.get(`/suivi-clients/statut/${statut}`, { params }),
  deleteBatch: (ids) => api.delete('/suivi-clients/batch', { data: { ids } }),
  statistiques: async () => {
    try {
      return await api.get('/suivi-clients/statistiques');
    } catch (error) {
      if (
        error.message?.includes('Erreur interne du serveur') ||
        error.message?.includes('Accès réservé') ||
        error.message?.includes('Appel client non trouvé')
      ) {
        return null;
      }
      console.error('❌ Erreur récupération statistiques suivi-clients:', error);
      throw error;
    }
  },
};

// =========================================================
// HISTORIQUE API
// =========================================================

export const historiqueAPI = {
  actions: (params) => api.get('/historique/actions', { params }),
  getByUtilisateur: (id, params) => api.get(`/historique/utilisateur/${id}`, { params }),
  getByTable: (table, params) => api.get(`/historique/table/${table}`, { params }),
  get: (id) => api.get(`/historique/${id}`),
  statistiques: () => api.get('/historique/statistiques'),
  delete: (id) => api.delete(`/historique/${id}`),
  clear: (params) => api.delete('/historique/clear', { params }),
  deleteAllHistory: () => api.delete('/historique/delete-all'),
  deleteBatch: (ids) => api.delete('/historique/batch', { data: { ids } }),
};

// =========================================================
// EXPORT DE L'INSTANCE AXIOS (pour les appels génériques)
// =========================================================

// ✅ CORRECTION : export nommé de `api` pour que AuthContext.js puisse l'importer
export { api };

// Export par défaut (compatible avec l'ancien code)
export default api;