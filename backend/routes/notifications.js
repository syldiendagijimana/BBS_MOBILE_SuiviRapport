/**
 * ========================================================
 * ROUTES NOTIFICATIONS - BBS (AVEC BATCH CORRIGÉ)
 * ========================================================
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const {
    authenticate,
    isTechnicien,
    isAdmin,
    logUserAction
} = require('../middleware/auth');

const TYPES_NOTIFICATION = ['rapport', 'incident', 'mission', 'permission', 'message', 'systeme'];

// ========================================================
// FONCTIONS UTILITAIRES
// ========================================================

function creerNotification({ utilisateur_id, type, titre, message, donnees = null }) {
    try {
        if (!utilisateur_id || !titre || !message) {
            console.error('❌ Paramètres manquants pour la notification');
            return null;
        }

        const db = getDb();

        const result = db.prepare(`
            INSERT INTO notifications (
                utilisateur_id,
                type,
                titre,
                message,
                donnees,
                est_lu
            ) VALUES (?, ?, ?, ?, ?, 0)
        `).run(utilisateur_id, type || 'systeme', titre, message, donnees ? JSON.stringify(donnees) : null);

        return result.lastInsertRowid;

    } catch (error) {
        console.error('❌ Erreur de création de notification:', error);
        return null;
    }
}

function notifierAdminsEtSuperviseurs({ titre, message, type = 'systeme', excludeUserId = null, donnees = null }) {
    try {
        const db = getDb();

        let query = `
            SELECT id
            FROM utilisateurs
            WHERE role IN ('admin', 'dj', 'superviseur')
              AND actif = 1
        `;
        const params = [];

        if (excludeUserId) {
            query += ' AND id != ?';
            params.push(excludeUserId);
        }

        const utilisateurs = db.prepare(query).all(...params);

        if (!utilisateurs || utilisateurs.length === 0) {
            console.log('⚠️ Aucun admin/superviseur trouvé');
            return;
        }

        const insertNotif = db.prepare(`
            INSERT INTO notifications (
                utilisateur_id,
                type,
                titre,
                message,
                donnees,
                est_lu
            ) VALUES (?, ?, ?, ?, ?, 0)
        `);

        utilisateurs.forEach(u => {
            if (!u?.id) return;
            insertNotif.run(
                u.id,
                type,
                titre,
                message,
                donnees ? JSON.stringify(donnees) : null
            );
        });

        console.log(`✅ ${utilisateurs.length} notifications envoyées`);

    } catch (error) {
        console.error('❌ Erreur de notification:', error);
    }
}

// ========================================================
// 🔴 ROUTES STATIQUES ET SPÉCIFIQUES (SANS PARAMÈTRE :id)
// ========================================================

// GET /notifications - LISTE DES NOTIFICATIONS
router.get('/', authenticate, isTechnicien, (req, res) => {
    try {
        const db = getDb();
        const { type, est_lu, page = 1, limit = 30, utilisateur_id } = req.query;

        let conditions = [];
        let params = [];

        if (req.user.role === 'admin' || req.user.role === 'dj') {
            if (utilisateur_id) {
                conditions.push('utilisateur_id = ?');
                params.push(parseInt(utilisateur_id));
            }
        } else {
            conditions.push('utilisateur_id = ?');
            params.push(req.userId);
        }

        if (type) {
            conditions.push('type = ?');
            params.push(type);
        }

        if (est_lu !== undefined) {
            conditions.push('est_lu = ?');
            params.push(parseInt(est_lu));
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const notifications = db.prepare(`
            SELECT
                id,
                utilisateur_id,
                type,
                titre,
                message,
                donnees,
                est_lu,
                lu_le,
                created_at
            FROM notifications
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        const total = db.prepare(`
            SELECT COUNT(*) as count
            FROM notifications
            ${whereClause}
        `).get(...params);

        const notificationsWithData = notifications.map(n => ({
            ...n,
            donnees: n.donnees ? JSON.parse(n.donnees) : null
        }));

        return res.json({
            success: true,
            data: notificationsWithData,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total?.count || 0,
                pages: Math.ceil((total?.count || 0) / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('❌ Erreur récupération notifications:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// GET /notifications/compte-non-lues - COMPTEUR NON LUES
router.get('/compte-non-lues', authenticate, isTechnicien, (req, res) => {
    try {
        const db = getDb();
        const result = db.prepare(`
            SELECT COUNT(*) AS count
            FROM notifications
            WHERE utilisateur_id = ? AND est_lu = 0
        `).get(req.userId);

        const parType = db.prepare(`
            SELECT type, COUNT(*) as count
            FROM notifications
            WHERE utilisateur_id = ? AND est_lu = 0
            GROUP BY type
        `).all(req.userId);

        return res.json({
            success: true,
            total: result?.count || 0,
            par_type: parType || []
        });

    } catch (error) {
        console.error('❌ Erreur comptage notifications:', error);
        return res.status(200).json({
            success: true,
            total: 0,
            par_type: []
        });
    }
});

// GET /notifications/statistiques - STATISTIQUES GLOBALES (admin)
router.get('/statistiques', authenticate, isAdmin, (req, res) => {
    try {
        const db = getDb();

        const total = db.prepare('SELECT COUNT(*) as count FROM notifications').get();
        const lues = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE est_lu = 1').get();
        const nonLues = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE est_lu = 0').get();

        const parType = db.prepare(`
            SELECT type, COUNT(*) as count
            FROM notifications
            GROUP BY type
        `).all();

        const parUtilisateur = db.prepare(`
            SELECT
                u.nom,
                u.prenom,
                u.email,
                COUNT(n.id) as count,
                SUM(CASE WHEN n.est_lu = 0 THEN 1 ELSE 0 END) as non_lues
            FROM notifications n
            LEFT JOIN utilisateurs u ON n.utilisateur_id = u.id
            GROUP BY n.utilisateur_id
            ORDER BY count DESC
            LIMIT 10
        `).all();

        const dernieres24h = db.prepare(`
            SELECT COUNT(*) as count
            FROM notifications
            WHERE created_at >= datetime('now', '-1 day')
        `).get();

        const tauxLecture = total.count > 0 ? ((lues.count / total.count) * 100).toFixed(1) : 0;

        const parMois = db.prepare(`
            SELECT
                strftime('%Y-%m', created_at) as mois,
                COUNT(*) as count
            FROM notifications
            WHERE created_at >= date('now', '-12 months')
            GROUP BY strftime('%Y-%m', created_at)
            ORDER BY mois DESC
        `).all();

        return res.json({
            success: true,
            statistiques: {
                global: {
                    total: total.count,
                    lues: lues.count,
                    non_lues: nonLues.count,
                    taux_lecture: tauxLecture + '%'
                },
                par_type: parType,
                top_utilisateurs: parUtilisateur,
                dernieres_24h: dernieres24h.count,
                par_mois: parMois
            }
        });

    } catch (error) {
        console.error('❌ Erreur statistiques notifications:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// GET /notifications/non-lues - LISTE NON LUES
router.get('/non-lues', authenticate, isTechnicien, (req, res) => {
    try {
        const db = getDb();
        const { limit = 20 } = req.query;

        const notifications = db.prepare(`
            SELECT
                id,
                type,
                titre,
                message,
                donnees,
                created_at
            FROM notifications
            WHERE utilisateur_id = ? AND est_lu = 0
            ORDER BY created_at DESC
            LIMIT ?
        `).all(req.userId, parseInt(limit));

        const total = db.prepare(`
            SELECT COUNT(*) as count
            FROM notifications
            WHERE utilisateur_id = ? AND est_lu = 0
        `).get(req.userId);

        return res.json({
            success: true,
            count: total.count,
            data: notifications.map(n => ({
                ...n,
                donnees: n.donnees ? JSON.parse(n.donnees) : null
            }))
        });

    } catch (error) {
        console.error('❌ Erreur récupération non lues:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// DELETE /notifications/clear - SUPPRIMER LES LUES
router.delete('/clear', authenticate, isTechnicien, (req, res) => {
    try {
        const db = getDb();
        const result = db.prepare(`
            DELETE FROM notifications
            WHERE utilisateur_id = ? AND est_lu = 1
        `).run(req.userId);

        return res.json({
            success: true,
            message: `${result.changes} notification(s) supprimée(s)`,
            nombre: result.changes
        });

    } catch (error) {
        console.error('❌ Erreur suppression notifications lues:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ✅ ROUTE BATCH - SUPPRIMER PLUSIEURS NOTIFICATIONS
router.delete('/batch', authenticate, isTechnicien, (req, res) => {
    console.log('🔵 ROUTE BATCH ATTEINTE');
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Liste d\'IDs requise'
            });
        }

        const db = getDb();
        const numericIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));

        if (numericIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'IDs invalides'
            });
        }

        const placeholders = numericIds.map(() => '?').join(',');
        let query = `DELETE FROM notifications WHERE id IN (${placeholders})`;
        const params = numericIds;

        if (req.user.role !== 'admin' && req.user.role !== 'dj') {
            query += ` AND utilisateur_id = ?`;
            params.push(req.userId);
        }

        const result = db.prepare(query).run(...params);

        return res.json({
            success: true,
            message: `${result.changes} notification(s) supprimée(s)`,
            nombre: result.changes
        });

    } catch (error) {
        console.error('❌ Erreur suppression batch:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// PATCH /notifications/lire-toutes - TOUT MARQUER LU
router.patch('/lire-toutes', authenticate, isTechnicien, (req, res) => {
    try {
        const db = getDb();
        const result = db.prepare(`
            UPDATE notifications
            SET est_lu = 1, lu_le = CURRENT_TIMESTAMP
            WHERE utilisateur_id = ? AND est_lu = 0
        `).run(req.userId);

        return res.json({
            success: true,
            message: 'Toutes les notifications sont marquées comme lues',
            nombre: result.changes
        });

    } catch (error) {
        console.error('❌ Erreur marquage toutes comme lues:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// POST /notifications - CRÉER UNE NOTIFICATION (admin)
router.post('/', authenticate, isAdmin, (req, res) => {
    try {
        const { utilisateur_id, type, titre, message, donnees } = req.body;

        if (!utilisateur_id || !titre || !message) {
            return res.status(400).json({
                success: false,
                message: 'utilisateur_id, titre et message sont requis'
            });
        }

        if (type && !TYPES_NOTIFICATION.includes(type)) {
            return res.status(400).json({
                success: false,
                message: `Type invalide. Types acceptés: ${TYPES_NOTIFICATION.join(', ')}`
            });
        }

        const db = getDb();

        const user = db.prepare('SELECT id FROM utilisateurs WHERE id = ? AND actif = 1').get(utilisateur_id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        const notificationId = creerNotification({
            utilisateur_id: parseInt(utilisateur_id),
            type: type || 'systeme',
            titre,
            message,
            donnees: donnees || null
        });

        if (!notificationId) {
            return res.status(500).json({
                success: false,
                message: 'Erreur de création de la notification'
            });
        }

        logUserAction(req, 'CREATION_NOTIFICATION', {
            table: 'notifications',
            recordId: notificationId,
            utilisateur_id: utilisateur_id
        });

        return res.status(201).json({
            success: true,
            message: 'Notification créée avec succès',
            id: notificationId
        });

    } catch (error) {
        console.error('❌ Erreur création notification:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// 🟢 ROUTES DYNAMIQUES (AVEC :id) - EN DERNIER
// ========================================================

// GET /notifications/:id
router.get('/:id', authenticate, isTechnicien, (req, res) => {
    try {
        const db = getDb();
        const notificationId = parseInt(req.params.id);

        let query = `
            SELECT
                id,
                utilisateur_id,
                type,
                titre,
                message,
                donnees,
                est_lu,
                lu_le,
                created_at
            FROM notifications
            WHERE id = ?
        `;
        const params = [notificationId];

        if (req.user.role !== 'admin' && req.user.role !== 'dj') {
            query += ' AND utilisateur_id = ?';
            params.push(req.userId);
        }

        const notification = db.prepare(query).get(...params);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification non trouvée'
            });
        }

        if (!notification.est_lu && (notification.utilisateur_id === req.userId || req.user.role === 'admin' || req.user.role === 'dj')) {
            db.prepare(`
                UPDATE notifications
                SET est_lu = 1, lu_le = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(notificationId);
            notification.est_lu = 1;
        }

        return res.json({
            success: true,
            data: {
                ...notification,
                donnees: notification.donnees ? JSON.parse(notification.donnees) : null
            }
        });

    } catch (error) {
        console.error('❌ Erreur récupération notification:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// PATCH /notifications/:id/lu
router.patch('/:id/lu', authenticate, isTechnicien, (req, res) => {
    try {
        const db = getDb();
        const notificationId = parseInt(req.params.id);

        let query = 'SELECT id FROM notifications WHERE id = ?';
        const params = [notificationId];

        if (req.user.role !== 'admin' && req.user.role !== 'dj') {
            query += ' AND utilisateur_id = ?';
            params.push(req.userId);
        }

        const notification = db.prepare(query).get(...params);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification non trouvée'
            });
        }

        db.prepare(`
            UPDATE notifications
            SET est_lu = 1, lu_le = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(notificationId);

        return res.json({
            success: true,
            message: 'Notification marquée comme lue'
        });

    } catch (error) {
        console.error('❌ Erreur marquage comme lue:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// DELETE /notifications/:id
router.delete('/:id', authenticate, isTechnicien, (req, res) => {
    try {
        const db = getDb();
        const notificationId = parseInt(req.params.id);

        let query = 'SELECT id FROM notifications WHERE id = ?';
        const params = [notificationId];

        if (req.user.role !== 'admin' && req.user.role !== 'dj') {
            query += ' AND utilisateur_id = ?';
            params.push(req.userId);
        }

        const notification = db.prepare(query).get(...params);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification non trouvée'
            });
        }

        db.prepare('DELETE FROM notifications WHERE id = ?').run(notificationId);

        return res.json({
            success: true,
            message: 'Notification supprimée avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur suppression notification:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// EXPORT
// ========================================================

module.exports = {
    router,
    creerNotification,
    notifierAdminsEtSuperviseurs
};