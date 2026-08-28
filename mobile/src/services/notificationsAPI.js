import api from './api';

// =========================================================
// NOTIFICATIONS API
// =========================================================

export const notificationsAPI = {
  /**
   * Récupérer la liste des notifications
   * @param {Object} params - Paramètres de filtrage
   * @param {number} params.page - Numéro de page
   * @param {number} params.limit - Nombre d'éléments par page (défaut: 30)
   * @param {string} params.type - Type de notification (rapport, incident, mission, etc.)
   * @param {number} params.est_lu - 0 pour non lues, 1 pour lues
   * @returns {Promise<Object>} Liste des notifications
   */
  list: async (params = {}) => {
    try {
      const { page = 1, limit = 30, type, est_lu } = params;
      const queryParams = new URLSearchParams();

      queryParams.append('page', page.toString());
      queryParams.append('limit', limit.toString());

      if (type) queryParams.append('type', type);
      if (est_lu !== undefined) queryParams.append('est_lu', est_lu.toString());

      return await api.get(`/notifications?${queryParams.toString()}`);
    } catch (error) {
      console.error('❌ Erreur récupération notifications:', error);
      throw error;
    }
  },

  /**
   * Récupérer les détails d'une notification
   * @param {number} id - ID de la notification
   * @returns {Promise<Object>} Détails de la notification
   */
  get: async (id) => {
    try {
      return await api.get(`/notifications/${id}`);
    } catch (error) {
      console.error('❌ Erreur récupération notification:', error);
      throw error;
    }
  },

  /**
   * Récupérer uniquement les notifications non lues
   * @param {Object} params - Paramètres
   * @param {number} params.limit - Nombre d'éléments (défaut: 20)
   * @returns {Promise<Object>} Liste des notifications non lues
   */
  getNonLues: async (params = {}) => {
    try {
      const { limit = 20 } = params;
      return await api.get(`/notifications/non-lues?limit=${limit}`);
    } catch (error) {
      console.error('❌ Erreur récupération notifications non lues:', error);
      throw error;
    }
  },

  /**
   * Récupérer le compteur de notifications non lues
   * @returns {Promise<number>} Nombre de notifications non lues
   */
  getUnreadCount: async () => {
    try {
      const response = await api.get('/notifications/compte-non-lues');
      return response.total || 0;
    } catch (error) {
      console.error('❌ Erreur récupération compteur non lues:', error);
      return 0;
    }
  },

  /**
   * Récupérer le compteur de notifications non lues par type
   * @returns {Promise<Object>} Compteurs par type
   */
  getUnreadCountByType: async () => {
    try {
      const response = await api.get('/notifications/compte-non-lues');
      return response.par_type || [];
    } catch (error) {
      console.error('❌ Erreur récupération compteurs par type:', error);
      return [];
    }
  },

  /**
   * Marquer une notification comme lue
   * @param {number} id - ID de la notification
   * @returns {Promise<Object>} Réponse de succès
   */
  markAsRead: async (id) => {
    try {
      return await api.patch(`/notifications/${id}/lu`);
    } catch (error) {
      console.error('❌ Erreur marquage comme lue:', error);
      throw error;
    }
  },

  /**
   * Marquer toutes les notifications comme lues
   * @returns {Promise<Object>} Réponse de succès avec le nombre
   */
  markAllAsRead: async () => {
    try {
      return await api.patch('/notifications/lire-toutes');
    } catch (error) {
      console.error('❌ Erreur marquage toutes comme lues:', error);
      throw error;
    }
  },

  /**
   * Supprimer une notification
   * @param {number} id - ID de la notification
   * @returns {Promise<Object>} Réponse de succès
   */
  delete: async (id) => {
    try {
      return await api.delete(`/notifications/${id}`);
    } catch (error) {
      console.error('❌ Erreur suppression notification:', error);
      throw error;
    }
  },

  /**
   * Supprimer toutes les notifications lues
   * @returns {Promise<Object>} Réponse de succès avec le nombre
   */
  clearRead: async () => {
    try {
      return await api.delete('/notifications/clear');
    } catch (error) {
      console.error('❌ Erreur suppression notifications lues:', error);
      throw error;
    }
  },

  /**
   * Supprimer plusieurs notifications (Batch delete)
   * @param {number[]} ids - Tableau d'IDs de notifications à supprimer
   * @returns {Promise<Object>} Réponse de succès
   */
  deleteBatch: async (ids) => {
    try {
      return await api.delete('/notifications/batch', { data: { ids } });
    } catch (error) {
      console.error('❌ Erreur suppression batch notifications:', error);
      throw error;
    }
  },

  /**
   * Créer une notification (Admin uniquement)
   * @param {Object} data - Données de la notification
   * @param {number} data.utilisateur_id - ID de l'utilisateur destinataire
   * @param {string} data.type - Type de notification
   * @param {string} data.titre - Titre de la notification
   * @param {string} data.message - Message de la notification
   * @param {Object} data.donnees - Données supplémentaires (JSON)
   * @returns {Promise<Object>} Réponse avec l'ID de la notification
   */
  create: async (data) => {
    try {
      return await api.post('/notifications', data);
    } catch (error) {
      console.error('❌ Erreur création notification:', error);
      throw error;
    }
  },

  /**
   * Récupérer les statistiques des notifications (Admin uniquement)
   * @returns {Promise<Object>} Statistiques des notifications
   */
  statistiques: async () => {
    try {
      return await api.get('/notifications/statistiques');
    } catch (error) {
      // ✅ CORRECTION ICI : Ne pas logger l'erreur si c'est un "Accès réservé à l'administrateur"
      if (error.message?.includes('administrateur') || error.message?.includes('ADMIN_ONLY')) {
        // Ignorer silencieusement l'erreur 403 (Accès interdit)
        return null;
      }
      console.error('❌ Erreur récupération statistiques:', error);
      throw error;
    }
  },

  /**
   * Récupérer les notifications par type
   * @param {string} type - Type de notification
   * @param {Object} params - Paramètres de pagination
   * @returns {Promise<Object>} Liste des notifications du type
   */
  getByType: async (type, params = {}) => {
    try {
      const { page = 1, limit = 20 } = params;
      return await notificationsAPI.list({ ...params, type, page, limit });
    } catch (error) {
      console.error('❌ Erreur récupération notifications par type:', error);
      throw error;
    }
  },

  /**
   * Marquer une notification comme lue et la retourner
   * @param {number} id - ID de la notification
   * @returns {Promise<Object>} Notification mise à jour
   */
  markAsReadAndGet: async (id) => {
    try {
      await notificationsAPI.markAsRead(id);
      return await notificationsAPI.get(id);
    } catch (error) {
      console.error('❌ Erreur marquage et récupération:', error);
      throw error;
    }
  },
};

// =========================================================
// EXPORT POUR COMPATIBILITÉ ANCIENNE VERSION
// =========================================================

export const getNotifications = async (limit = 30) => {
  return await notificationsAPI.list({ limit });
};

export const getUnreadCount = async () => {
  return await notificationsAPI.getUnreadCount();
};
export const markAsRead = async (id) => {
  return await notificationsAPI.markAsRead(id);
};
export const markAllAsRead = async () => {
  return await notificationsAPI.markAllAsRead();
};
export const deleteNotification = async (id) => {
  return await notificationsAPI.delete(id);
};

export default notificationsAPI;