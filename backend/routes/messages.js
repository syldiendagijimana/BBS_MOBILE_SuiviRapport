const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db/database');
const {
    authenticate,
    isTechnicien,
    isOwner,
    hasPermission,   // <-- AJOUT
    logUserAction
} = require('../middleware/auth');

// ========================================================
// CONFIGURATION MULTER (TYPES MIME COMPLETS)
// ========================================================

const uploadDir = path.join(__dirname, '../uploads/messages');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `msg-${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = {
        image: [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'image/jpg', 'image/bmp'
        ],
        audio: [
            'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
            'audio/mp4', 'audio/aac', 'audio/x-m4a'
        ],
        video: [
            'video/mp4', 'video/webm', 'video/ogg',
            'video/quicktime', 'video/x-msvideo'
        ],
        document: [
            'application/pdf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]
    };

    const allTypes = [
        ...allowedTypes.image,
        ...allowedTypes.audio,
        ...allowedTypes.video,
        ...allowedTypes.document
    ];

    if (allTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Format de fichier non supporté'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 20 * 1024 * 1024 // 20MB
    },
    fileFilter: fileFilter
});

// ========================================================
// CONSTANTES
// ========================================================

const TYPES_MESSAGE = ['texte', 'photo', 'audio', 'video', 'emoji', 'localisation'];

// ========================================================
// 🔴 1. ROUTES SPÉCIFIQUES (STATIQUES) - À PLACER EN PREMIER
// ========================================================

// GET /messages/groupe - MESSAGES DU GROUPE OFFICIEL
router.get('/groupe', authenticate, hasPermission('voir_messages'), isTechnicien, (req, res) => {
    try {
        const db = getDb();
        const { limit = 100, before } = req.query;

        let query = `
            SELECT
                m.id,
                m.expediteur_id,
                m.groupe_officiel_id,
                m.type_message,
                m.contenu,
                m.message_parent_id,
                m.est_modifie,
                m.est_supprime,
                m.est_lu,
                m.lu_le,
                m.created_at,
                m.updated_at,
                u.nom,
                u.prenom,
                u.role,
                u.avatar
            FROM messages m
            LEFT JOIN utilisateurs u ON m.expediteur_id = u.id
            WHERE m.groupe_officiel_id = 1 AND m.est_supprime = 0
        `;

        const params = [];

        if (before) {
            query += ' AND m.created_at < ?';
            params.push(before);
        }

        query += ' ORDER BY m.created_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const messages = db.prepare(query).all(...params);

        const host = `${req.protocol}://${req.get('host')}`;

        const messagesWithData = messages.map(msg => {
            const medias = db.prepare(`
                SELECT id, type_fichier, nom_fichier, chemin, url, mime_type, taille, created_at
                FROM pieces_jointes_message
                WHERE message_id = ?
            `).all(msg.id);

            const reactions = db.prepare(`
                SELECT
                    r.*,
                    u.nom,
                    u.prenom,
                    u.avatar
                FROM reactions_message r
                LEFT JOIN utilisateurs u ON r.utilisateur_id = u.id
                WHERE r.message_id = ?
            `).all(msg.id);

            const statut = db.prepare(`
                SELECT statut, updated_at
                FROM statut_message
                WHERE message_id = ? AND utilisateur_id = ?
            `).get(msg.id, req.userId);

            const reactionsGrouped = reactions.reduce((acc, r) => {
                acc[r.reaction] = (acc[r.reaction] || 0) + 1;
                return acc;
            }, {});

            const userReaction = reactions.find(r => r.utilisateur_id === req.userId);

            return {
                ...msg,
                medias: medias.map(m => ({
                    ...m,
                    url: m.url || `${host}/uploads/messages/${m.chemin}`
                })),
                reactions: reactionsGrouped,
                reactions_list: reactions,
                user_reaction: userReaction ? userReaction.reaction : null,
                statut: statut ? statut.statut : 'envoye',
                est_lu_par_moi: statut ? statut.statut === 'vu' : false
            };
        });

        return res.json({
            success: true,
            count: messagesWithData.length,
            data: messagesWithData.reverse()
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des messages:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// POST /messages/groupe - ENVOYER UN MESSAGE
router.post('/groupe', authenticate, hasPermission('envoyer_message'), isTechnicien, (req, res) => {
    try {
        const { contenu, type_message = 'texte', message_parent_id } = req.body;

        if (!contenu || !contenu.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Le contenu du message est requis'
            });
        }

        if (!TYPES_MESSAGE.includes(type_message)) {
            return res.status(400).json({
                success: false,
                message: `Type de message invalide. Types acceptés: ${TYPES_MESSAGE.join(', ')}`
            });
        }

        const db = getDb();

        const membre = db.prepare(`
            SELECT id FROM membres_groupe_officiel
            WHERE utilisateur_id = ? AND groupe_officiel_id = 1
        `).get(req.userId);

        if (!membre) {
            return res.status(403).json({
                success: false,
                message: 'Vous n\'êtes pas membre du groupe officiel'
            });
        }

        if (message_parent_id) {
            const parent = db.prepare('SELECT id FROM messages WHERE id = ? AND est_supprime = 0').get(message_parent_id);
            if (!parent) {
                return res.status(404).json({
                    success: false,
                    message: 'Message parent non trouvé'
                });
            }
        }

        const result = db.prepare(`
            INSERT INTO messages (
                expediteur_id,
                groupe_officiel_id,
                type_message,
                contenu,
                message_parent_id
            ) VALUES (?, 1, ?, ?, ?)
        `).run(req.userId, type_message, contenu.trim(), message_parent_id || null);

        const messageId = result.lastInsertRowid;

        db.prepare(`
            INSERT INTO statut_message (message_id, utilisateur_id, statut)
            VALUES (?, ?, 'envoye')
        `).run(messageId, req.userId);

        const membresGroupe = db.prepare(`
            SELECT utilisateur_id FROM membres_groupe_officiel
            WHERE groupe_officiel_id = 1 AND utilisateur_id != ?
        `).all(req.userId);

        const insertNotif = db.prepare(`
            INSERT INTO notifications (utilisateur_id, type, titre, message, donnees)
            VALUES (?, 'message', '💬 Nouveau message', ?, ?)
        `);

        const user = db.prepare('SELECT nom, prenom FROM utilisateurs WHERE id = ?').get(req.userId);
        const nomComplet = `${user.prenom} ${user.nom}`;

        membresGroupe.forEach(m => {
            insertNotif.run(
                m.utilisateur_id,
                `${nomComplet}: ${contenu.substring(0, 50)}${contenu.length > 50 ? '...' : ''}`,
                JSON.stringify({ messageId, expediteur: req.userId })
            );
        });

        logUserAction(req, 'ENVOI_MESSAGE', {
            table: 'messages',
            recordId: messageId,
            type: type_message
        });

        const msg = db.prepare(`
            SELECT
                m.*,
                u.nom,
                u.prenom,
                u.role,
                u.avatar
            FROM messages m
            LEFT JOIN utilisateurs u ON m.expediteur_id = u.id
            WHERE m.id = ?
        `).get(messageId);

        return res.status(201).json({
            success: true,
            message: 'Message envoyé avec succès',
            data: msg
        });

    } catch (error) {
        console.error('❌ Erreur d\'envoi du message:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// GET /messages/non-lus - MESSAGES NON LUS
router.get('/non-lus', authenticate, hasPermission('voir_messages'), isTechnicien, (req, res) => {
    try {
        const db = getDb();

        const messages = db.prepare(`
            SELECT
                m.id,
                m.expediteur_id,
                m.contenu,
                m.created_at,
                u.nom,
                u.prenom
            FROM messages m
            LEFT JOIN utilisateurs u ON m.expediteur_id = u.id
            WHERE m.groupe_officiel_id = 1
                AND m.est_supprime = 0
                AND m.est_lu = 0
                AND m.expediteur_id != ?
            ORDER BY m.created_at DESC
        `).all(req.userId);

        return res.json({
            success: true,
            count: messages.length,
            data: messages
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des messages non lus:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// GET /messages/recherche - RECHERCHER DES MESSAGES
router.get('/recherche', authenticate, hasPermission('voir_messages'), isTechnicien, (req, res) => {
    try {
        const { q, limit = 20 } = req.query;

        if (!q || q.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Le terme de recherche doit contenir au moins 2 caractères'
            });
        }

        const db = getDb();

        const messages = db.prepare(`
            SELECT
                m.id,
                m.contenu,
                m.type_message,
                m.created_at,
                u.nom,
                u.prenom,
                u.role
            FROM messages m
            LEFT JOIN utilisateurs u ON m.expediteur_id = u.id
            WHERE m.groupe_officiel_id = 1
                AND m.est_supprime = 0
                AND m.contenu LIKE ?
            ORDER BY m.created_at DESC
            LIMIT ?
        `).all(`%${q}%`, parseInt(limit));

        return res.json({
            success: true,
            count: messages.length,
            data: messages
        });

    } catch (error) {
        console.error('❌ Erreur de recherche des messages:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// GET /messages/statistiques - STATISTIQUES
router.get('/statistiques', authenticate, hasPermission('voir_statistiques'), isTechnicien, (req, res) => {
    try {
        const db = getDb();

        const total = db.prepare('SELECT COUNT(*) as count FROM messages WHERE groupe_officiel_id = 1 AND est_supprime = 0').get();
        const parType = db.prepare(`
            SELECT type_message, COUNT(*) as count
            FROM messages
            WHERE groupe_officiel_id = 1 AND est_supprime = 0
            GROUP BY type_message
        `).all();

        const parExpediteur = db.prepare(`
            SELECT
                u.nom,
                u.prenom,
                COUNT(m.id) as count
            FROM messages m
            LEFT JOIN utilisateurs u ON m.expediteur_id = u.id
            WHERE m.groupe_officiel_id = 1 AND m.est_supprime = 0
            GROUP BY m.expediteur_id
            ORDER BY count DESC
            LIMIT 10
        `).all();

        const parMois = db.prepare(`
            SELECT
                strftime('%Y-%m', created_at) as mois,
                COUNT(*) as count
            FROM messages
            WHERE groupe_officiel_id = 1 AND est_supprime = 0
                AND created_at >= date('now', '-12 months')
            GROUP BY strftime('%Y-%m', created_at)
            ORDER BY mois DESC
        `).all();

        const avecMedias = db.prepare(`
            SELECT COUNT(DISTINCT m.id) as count
            FROM messages m
            JOIN pieces_jointes_message p ON m.id = p.message_id
            WHERE m.groupe_officiel_id = 1 AND m.est_supprime = 0
        `).get();

        const reactionsTotal = db.prepare(`
            SELECT COUNT(*) as count
            FROM reactions_message r
            JOIN messages m ON r.message_id = m.id
            WHERE m.groupe_officiel_id = 1 AND m.est_supprime = 0
        `).get();

        return res.json({
            success: true,
            statistiques: {
                total: total.count,
                par_type: parType,
                top_expediteurs: parExpediteur,
                par_mois: parMois,
                avec_medias: avecMedias.count,
                reactions_total: reactionsTotal.count,
                taux_reaction: total.count > 0 ? ((reactionsTotal.count / total.count) * 100).toFixed(1) + '%' : '0%'
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des statistiques:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// ✅ AJOUT ICI : DELETE /messages/batch - SUPPRESSION MULTIPLE
// ========================================================

router.delete('/batch', authenticate, hasPermission('envoyer_message'), isTechnicien, (req, res) => {
    try {
        const db = getDb();
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez fournir un tableau d\'IDs valide'
            });
        }

        // Sécuriser les IDs (s'assurer que ce sont des entiers)
        const cleanIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));

        if (cleanIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Aucun ID valide trouvé'
            });
        }

        // Créer les placeholders SQL (ex: ?, ?, ?)
        const placeholders = cleanIds.map(() => '?').join(', ');

        // Soft delete pour tous les messages sélectionnés appartenant à l'utilisateur
        const query = `
            UPDATE messages
            SET est_supprime = 1,
                contenu = '[Message supprimé]',
                updated_at = CURRENT_TIMESTAMP
            WHERE id IN (${placeholders}) AND expediteur_id = ?
        `;

        // On passe les cleanIds et l'userId à la fin
        const result = db.prepare(query).run(...cleanIds, req.userId);

        // Journalisation
        logUserAction(req, 'SUPPRESSION_BATCH_MESSAGES', {
            table: 'messages',
            count: result.changes,
            ids: cleanIds
        });

        return res.json({
            success: true,
            message: `${result.changes} message(s) supprimé(s) avec succès`,
            nombre: result.changes
        });

    } catch (error) {
        console.error('❌ Erreur suppression batch de messages:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// 🟢 2. ROUTES DYNAMIQUES (AVEC :id) - À METTRE EN DERNIER
// ========================================================

// POST /:id/repondre - RÉPONDRE À UN MESSAGE
router.post('/:id/repondre', authenticate, hasPermission('envoyer_message'), isTechnicien, (req, res) => {
    try {
        const messageParentId = parseInt(req.params.id);
        const { contenu, type_message = 'texte' } = req.body;

        if (!contenu || !contenu.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Le contenu de la réponse est requis'
            });
        }

        const db = getDb();

        const parent = db.prepare('SELECT id, expediteur_id FROM messages WHERE id = ? AND est_supprime = 0').get(messageParentId);
        if (!parent) {
            return res.status(404).json({
                success: false,
                message: 'Message parent non trouvé'
            });
        }

        const membre = db.prepare(`
            SELECT id FROM membres_groupe_officiel
            WHERE utilisateur_id = ? AND groupe_officiel_id = 1
        `).get(req.userId);

        if (!membre) {
            return res.status(403).json({
                success: false,
                message: 'Vous n\'êtes pas membre du groupe officiel'
            });
        }

        const result = db.prepare(`
            INSERT INTO messages (
                expediteur_id,
                groupe_officiel_id,
                type_message,
                contenu,
                message_parent_id
            ) VALUES (?, 1, ?, ?, ?)
        `).run(req.userId, type_message, contenu.trim(), messageParentId);

        const messageId = result.lastInsertRowid;

        if (parent.expediteur_id !== req.userId) {
            const user = db.prepare('SELECT nom, prenom FROM utilisateurs WHERE id = ?').get(req.userId);
            db.prepare(`
                INSERT INTO notifications (utilisateur_id, type, titre, message, donnees)
                VALUES (?, 'message', '💬 Réponse à votre message', ?, ?)
            `).run(
                parent.expediteur_id,
                `${user.prenom} ${user.nom} a répondu à votre message: ${contenu.substring(0, 50)}${contenu.length > 50 ? '...' : ''}`,
                JSON.stringify({ messageId, parentId: messageParentId })
            );
        }

        logUserAction(req, 'REPONSE_MESSAGE', {
            table: 'messages',
            recordId: messageId,
            parentId: messageParentId
        });

        const msg = db.prepare(`
            SELECT
                m.*,
                u.nom,
                u.prenom,
                u.role,
                u.avatar
            FROM messages m
            LEFT JOIN utilisateurs u ON m.expediteur_id = u.id
            WHERE m.id = ?
        `).get(messageId);

        return res.status(201).json({
            success: true,
            message: 'Réponse envoyée avec succès',
            data: msg
        });

    } catch (error) {
        console.error('❌ Erreur de réponse au message:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// PUT /:id - MODIFIER UN MESSAGE (propriétaire uniquement)
router.put('/:id', authenticate, hasPermission('envoyer_message'), isOwner('messages', 'expediteur_id'), (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const { contenu } = req.body;

        if (!contenu || !contenu.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Le nouveau contenu est requis'
            });
        }

        const db = getDb();

        const message = db.prepare('SELECT * FROM messages WHERE id = ? AND est_supprime = 0').get(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message non trouvé'
            });
        }

        if (message.est_supprime) {
            return res.status(400).json({
                success: false,
                message: 'Impossible de modifier un message supprimé'
            });
        }

        db.prepare(`
            UPDATE messages
            SET contenu = ?,
                est_modifie = 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(contenu.trim(), messageId);

        logUserAction(req, 'MODIFICATION_MESSAGE', {
            table: 'messages',
            recordId: messageId
        });

        return res.json({
            success: true,
            message: 'Message modifié avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur de modification du message:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// DELETE /:id - SUPPRIMER UN MESSAGE (propriétaire uniquement)
router.delete('/:id', authenticate, hasPermission('envoyer_message'), isOwner('messages', 'expediteur_id'), (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const db = getDb();

        const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message non trouvé'
            });
        }

        db.prepare(`
            UPDATE messages
            SET est_supprime = 1,
                contenu = '[Message supprimé]',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(messageId);

        logUserAction(req, 'SUPPRESSION_MESSAGE', {
            table: 'messages',
            recordId: messageId
        });

        return res.json({
            success: true,
            message: 'Message supprimé avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur de suppression du message:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// POST /:id/reaction - AJOUTER UNE RÉACTION
router.post('/:id/reaction', authenticate, hasPermission('envoyer_message'), isTechnicien, (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const { reaction } = req.body;

        if (!reaction) {
            return res.status(400).json({
                success: false,
                message: 'La réaction est requise'
            });
        }

        const db = getDb();

        const message = db.prepare('SELECT id FROM messages WHERE id = ? AND est_supprime = 0').get(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message non trouvé'
            });
        }

        db.prepare(`
            INSERT INTO reactions_message (message_id, utilisateur_id, reaction)
            VALUES (?, ?, ?)
            ON CONFLICT(message_id, utilisateur_id)
            DO UPDATE SET reaction = excluded.reaction, created_at = CURRENT_TIMESTAMP
        `).run(messageId, req.userId, reaction);

        return res.json({
            success: true,
            message: 'Réaction ajoutée avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur d\'ajout de réaction:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// DELETE /:id/reaction - SUPPRIMER UNE RÉACTION
router.delete('/:id/reaction', authenticate, hasPermission('envoyer_message'), isTechnicien, (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const db = getDb();

        const reaction = db.prepare(`
            SELECT id FROM reactions_message
            WHERE message_id = ? AND utilisateur_id = ?
        `).get(messageId, req.userId);

        if (!reaction) {
            return res.status(404).json({
                success: false,
                message: 'Réaction non trouvée'
            });
        }

        db.prepare(`
            DELETE FROM reactions_message
            WHERE message_id = ? AND utilisateur_id = ?
        `).run(messageId, req.userId);

        return res.json({
            success: true,
            message: 'Réaction supprimée avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur de suppression de réaction:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// POST /:id/photo - ENVOYER UNE PHOTO
router.post('/:id/photo', authenticate, hasPermission('envoyer_message'), isOwner('messages', 'expediteur_id'), upload.single('photo'), (req, res) => {
    try {
        const messageId = parseInt(req.params.id);

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Fichier photo requis'
            });
        }

        const db = getDb();

        const message = db.prepare('SELECT id FROM messages WHERE id = ? AND est_supprime = 0').get(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message non trouvé'
            });
        }

        db.prepare(`
            UPDATE messages
            SET type_message = 'photo',
                contenu = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(req.file.originalname, messageId);

        db.prepare(`
            INSERT INTO pieces_jointes_message (
                message_id,
                type_fichier,
                nom_fichier,
                chemin,
                mime_type,
                taille
            ) VALUES (?, 'image', ?, ?, ?, ?)
        `).run(
            messageId,
            req.file.originalname,
            req.file.filename,
            req.file.mimetype,
            req.file.size
        );

        const host = `${req.protocol}://${req.get('host')}`;

        return res.json({
            success: true,
            message: 'Photo envoyée avec succès',
            url: `${host}/uploads/messages/${req.file.filename}`
        });

    } catch (error) {
        console.error('❌ Erreur d\'envoi de photo:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// POST /:id/audio - ENVOYER UN AUDIO
router.post('/:id/audio', authenticate, hasPermission('envoyer_message'), isOwner('messages', 'expediteur_id'), upload.single('audio'), (req, res) => {
    try {
        const messageId = parseInt(req.params.id);

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Fichier audio requis'
            });
        }

        const db = getDb();

        const message = db.prepare('SELECT id FROM messages WHERE id = ? AND est_supprime = 0').get(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message non trouvé'
            });
        }

        db.prepare(`
            UPDATE messages
            SET type_message = 'audio',
                contenu = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(req.file.originalname, messageId);

        db.prepare(`
            INSERT INTO pieces_jointes_message (
                message_id,
                type_fichier,
                nom_fichier,
                chemin,
                mime_type,
                taille
            ) VALUES (?, 'audio', ?, ?, ?, ?)
        `).run(
            messageId,
            req.file.originalname,
            req.file.filename,
            req.file.mimetype,
            req.file.size
        );

        const host = `${req.protocol}://${req.get('host')}`;

        return res.json({
            success: true,
            message: 'Audio envoyé avec succès',
            url: `${host}/uploads/messages/${req.file.filename}`
        });

    } catch (error) {
        console.error('❌ Erreur d\'envoi d\'audio:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// POST /:id/video - ENVOYER UNE VIDÉO
router.post('/:id/video', authenticate, hasPermission('envoyer_message'), isOwner('messages', 'expediteur_id'), upload.single('video'), (req, res) => {
    try {
        const messageId = parseInt(req.params.id);

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Fichier vidéo requis'
            });
        }

        const db = getDb();

        const message = db.prepare('SELECT id FROM messages WHERE id = ? AND est_supprime = 0').get(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message non trouvé'
            });
        }

        db.prepare(`
            UPDATE messages
            SET type_message = 'video',
                contenu = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(req.file.originalname, messageId);

        db.prepare(`
            INSERT INTO pieces_jointes_message (
                message_id,
                type_fichier,
                nom_fichier,
                chemin,
                mime_type,
                taille
            ) VALUES (?, 'video', ?, ?, ?, ?)
        `).run(
            messageId,
            req.file.originalname,
            req.file.filename,
            req.file.mimetype,
            req.file.size
        );

        const host = `${req.protocol}://${req.get('host')}`;

        return res.json({
            success: true,
            message: 'Vidéo envoyée avec succès',
            url: `${host}/uploads/messages/${req.file.filename}`
        });

    } catch (error) {
        console.error('❌ Erreur d\'envoi de vidéo:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// PATCH /:id/lu - MARQUER UN MESSAGE COMME LU
router.patch('/:id/lu', authenticate, hasPermission('voir_messages'), isTechnicien, (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const db = getDb();

        const message = db.prepare('SELECT id FROM messages WHERE id = ? AND est_supprime = 0').get(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message non trouvé'
            });
        }

        db.prepare(`
            INSERT INTO statut_message (message_id, utilisateur_id, statut)
            VALUES (?, ?, 'vu')
            ON CONFLICT(message_id, utilisateur_id)
            DO UPDATE SET statut = 'vu', updated_at = CURRENT_TIMESTAMP
        `).run(messageId, req.userId);

        db.prepare(`
            UPDATE messages
            SET est_lu = 1,
                lu_le = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(messageId);

        return res.json({
            success: true,
            message: 'Message marqué comme lu'
        });

    } catch (error) {
        console.error('❌ Erreur de marquage comme lu:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// EXPORT
// ========================================================

module.exports = router;