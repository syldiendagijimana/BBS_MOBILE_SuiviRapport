//Mobile/src/services/messagesAPI.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
//const API_URL = 'http://10.161.59.120:3000/api';
const API_URL = "https://bbs-mobile-suivirapport-backend.onrender.com/api";

// =========================================================
// UTILITAIRES
// =========================================================

const getToken = async () => {
  try {
    return await AsyncStorage.getItem('bbs_token');
  } catch (error) {
    console.error('❌ Erreur récupération token:', error);
    return null;
  }
};

const authHeaders = async (isFormData = false) => {
  const token = await getToken();
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  // Si c'est du FormData, on ne définit PAS le Content-Type
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

const handleResponse = async (response) => {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Erreur serveur');
  }
  return data;
};

// ✅ Normalise l'URI pour Android (ajoute file:// si nécessaire)
const normalizeUri = (uri) => {
  if (!uri) return uri;
  if (Platform.OS === 'android' && !uri.startsWith('file://')) {
    return `file://${uri}`;
  }
  return uri;
};

// =========================================================
// MESSAGES API
// =========================================================

export const messagesAPI = {
  /**
   * Récupérer les messages du groupe officiel
   */
  getGroupe: async (params = {}) => {
    try {
      const headers = await authHeaders();
      const queryString = new URLSearchParams(params).toString();
      const url = `${API_URL}/messages/groupe${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('❌ Erreur récupération messages:', error);
      throw error;
    }
  },

  /**
   * Envoyer un message dans le groupe officiel
   */
  sendGroupe: async (contenu, type_message = 'texte', message_parent_id = null) => {
    try {
      const headers = await authHeaders();

      const response = await fetch(`${API_URL}/messages/groupe`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          contenu,
          type_message,
          message_parent_id,
        }),
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('❌ Erreur envoi message:', error);
      throw error;
    }
  },

  /**
   * Répondre à un message
   */
  repondre: async (messageId, contenu, type_message = 'texte') => {
    try {
      const headers = await authHeaders();

      const response = await fetch(`${API_URL}/messages/${messageId}/repondre`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          contenu,
          type_message,
        }),
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('❌ Erreur réponse au message:', error);
      throw error;
    }
  },

  /**
   * Modifier un message
   */
  update: async (messageId, contenu) => {
    try {
      const headers = await authHeaders();

      const response = await fetch(`${API_URL}/messages/${messageId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ contenu }),
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('❌ Erreur modification message:', error);
      throw error;
    }
  },

  /**
   * Supprimer un message (soft delete)
   */
  delete: async (messageId) => {
    try {
      const headers = await authHeaders();

      const response = await fetch(`${API_URL}/messages/${messageId}`, {
        method: 'DELETE',
        headers,
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('❌ Erreur suppression message:', error);
      throw error;
    }
  },

  // ✅ AJOUT : Supprimer plusieurs messages (Batch delete)
  deleteBatch: async (messageIds) => {
    try {
      const headers = await authHeaders();

      const response = await fetch(`${API_URL}/messages/batch`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ ids: messageIds }),
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('❌ Erreur suppression batch:', error);
      throw error;
    }
  },

  /**
   * Ajouter une réaction à un message
   */
  addReaction: async (messageId, reaction) => {
    try {
      const headers = await authHeaders();

      const response = await fetch(`${API_URL}/messages/${messageId}/reaction`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reaction }),
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('❌ Erreur ajout réaction:', error);
      throw error;
    }
  },

  /**
   * Supprimer une réaction
   */
  removeReaction: async (messageId) => {
    try {
      const headers = await authHeaders();

      const response = await fetch(`${API_URL}/messages/${messageId}/reaction`, {
        method: 'DELETE',
        headers,
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('❌ Erreur suppression réaction:', error);
      throw error;
    }
  },

  /**
   * Envoyer une photo (✅ Corrigé : plus de Content-Type, URI normalisée)
   */
  sendPhoto: async (messageId, photoUri, description = '') => {
    try {
      const token = await getToken();

      const formData = new FormData();
      const filename = photoUri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('photo', {
        uri: normalizeUri(photoUri),
        name: filename,
        type: type,
      });

      if (description) {
        formData.append('description', description);
      }

      const response = await fetch(`${API_URL}/messages/${messageId}/photo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('❌ Erreur envoi photo:', error);
      throw error;
    }
  },

  /**
   * Envoyer un audio (✅ Corrigé : plus de Content-Type, URI normalisée)
   */
  sendAudio: async (messageId, audioUri, duration = 0) => {
    try {
      const token = await getToken();

      const formData = new FormData();
      const filename = audioUri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);

      let type = 'audio/mpeg';
      if (match && match[1] === 'mp4') {
        type = 'audio/mp4';
      } else if (match) {
        type = `audio/${match[1]}`;
      }

      formData.append('audio', {
        uri: normalizeUri(audioUri),
        name: filename,
        type: type,
      });

      if (duration) {
        formData.append('duration', duration.toString());
      }

      const response = await fetch(`${API_URL}/messages/${messageId}/audio`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('❌ Erreur envoi audio:', error);
      throw error;
    }
  },

  /**
   * Envoyer une vidéo (✅ Corrigé : plus de Content-Type, URI normalisée)
   */
  sendVideo: async (messageId, videoUri, description = '') => {
    try {
      const token = await getToken();

      const formData = new FormData();
      const filename = videoUri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `video/${match[1]}` : 'video/mp4';

      formData.append('video', {
        uri: normalizeUri(videoUri),
        name: filename,
        type: type,
      });

      if (description) {
        formData.append('description', description);
      }

      const response = await fetch(`${API_URL}/messages/${messageId}/video`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('❌ Erreur envoi vidéo:', error);
      throw error;
    }
  },

  /**
   * Marquer un message comme lu
   */
  markAsRead: async (messageId) => {
    try {
      const headers = await authHeaders();

      const response = await fetch(`${API_URL}/messages/${messageId}/lu`, {
        method: 'PATCH',
        headers,
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('❌ Erreur marquage comme lu:', error);
      throw error;
    }
  },

  /**
   * Récupérer les messages non lus
   */
  getNonLus: async () => {
    try {
      const headers = await authHeaders();

      const response = await fetch(`${API_URL}/messages/non-lus`, {
        method: 'GET',
        headers,
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('❌ Erreur récupération messages non lus:', error);
      throw error;
    }
  },

  /**
   * Rechercher des messages
   */
  search: async (query, limit = 20) => {
    try {
      const headers = await authHeaders();
      const url = `${API_URL}/messages/recherche?q=${encodeURIComponent(query)}&limit=${limit}`;

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('❌ Erreur recherche messages:', error);
      throw error;
    }
  },

  /**
   * Statistiques des messages
   */
  statistiques: async () => {
    try {
      const headers = await authHeaders();

      const response = await fetch(`${API_URL}/messages/statistiques`, {
        method: 'GET',
        headers,
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('❌ Erreur récupération statistiques:', error);
      throw error;
    }
  },
};

// =========================================================
// EXPORT POUR COMPATIBILITÉ ANCIENNE VERSION
// =========================================================

export const getMessages = messagesAPI.getGroupe;
export const sendMessage = messagesAPI.sendGroupe;

export default messagesAPI;