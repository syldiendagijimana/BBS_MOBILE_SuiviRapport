// =========================================================
// backend/routes/utilisateurs.js
// Gestion des utilisateurs (admin, DJ, superviseur, technicien)
// =========================================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const {
    authenticate,
    isAdmin,
    isAdminOrDJ,
    isSuperviseur,
    hasPermission,
    logUserAction
} = require('../middleware/auth');

// =========================================================
// CONSTANTES
// =========================================================

const ROLES_VALIDES = ['admin', 'dj', 'superviseur', 'technicien'];
const ROLES_CREATEURS_MISSION = ['admin', 'dj', 'superviseur'];

// =========================================================
// HELPERS
// =========================================================

/**
 * Renvoie true si la colonne existe dans une table
 */
function hasColumn(db, table, column) {
    try {
        const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
        return cols.includes(column);
    } catch (e) {
        return false;
    }
}

/**
 * Renvoie true si la table existe
 */
function hasTable(db, table) {
    try {
        const row = db.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
        ).get(table);
        return !!row;
    } catch (e) {
        return false;
    }
}

// =========================================================
// GET /utilisateurs/search — Rechercher des utilisateurs
// =========================================================

router.get(
    '/search',
    authenticate,
    isAdminOrDJ,
    hasPermission('voir_utilisateurs'),
    (req, res) => {
        try {
            const { q, role, actif, limit = 20 } = req.query;
            if (!q || q.length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Le terme de recherche doit contenir au moins 2 caractères'
                });
            }

            const db = getDb();
            let query = `
                SELECT id, nom, prenom, email, telephone, role, actif, avatar, created_at
                FROM utilisateurs
                WHERE (nom LIKE ? OR prenom LIKE ? OR email LIKE ?)
            `;
            const params = [`%${q}%`, `%${q}%`, `%${q}%`];

            if (role) { query += ' AND role = ?'; params.push(role); }
            if (actif !== undefined) { query += ' AND actif = ?'; params.push(parseInt(actif)); }

            query += ' ORDER BY nom, prenom LIMIT ?';
            params.push(parseInt(limit));

            const users = db.prepare(query).all(...params);
            return res.json({ success: true, count: users.length, data: users });
        } catch (error) {
            console.error('❌ Erreur /utilisateurs/search:', error);
            return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
        }
    }
);

// =========================================================
// GET /utilisateurs/statistiques — Statistiques
// =========================================================

router.get(
    '/statistiques',
    authenticate,
    isAdminOrDJ,
    hasPermission('voir_statistiques'),
    (req, res) => {
        try {
            const db = getDb();
            const total = db.prepare('SELECT COUNT(*) as count FROM utilisateurs').get();
            const actifs = db.prepare('SELECT COUNT(*) as count FROM utilisateurs WHERE actif = 1').get();
            const inactifs = db.prepare('SELECT COUNT(*) as count FROM utilisateurs WHERE actif = 0').get();
            const parRole = db.prepare('SELECT role, COUNT(*) as count FROM utilisateurs GROUP BY role').all();
            const parRoleActif = db.prepare('SELECT role, COUNT(*) as count FROM utilisateurs WHERE actif = 1 GROUP BY role').all();
            const derniers = db.prepare(
                'SELECT id, nom, prenom, email, role, created_at FROM utilisateurs ORDER BY created_at DESC LIMIT 5'
            ).all();

            return res.json({
                success: true,
                statistiques: {
                    total: total.count,
                    actifs: actifs.count,
                    inactifs: inactifs.count,
                    par_role: parRole,
                    par_role_actif: parRoleActif,
                    derniers_inscrits: derniers
                }
            });
        } catch (error) {
            console.error('❌ Erreur /utilisateurs/statistiques:', error);
            return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
        }
    }
);

// =========================================================
// GET /utilisateurs/role/:role — Utilisateurs par rôle
// =========================================================

router.get(
    '/role/:role',
    authenticate,
    isAdminOrDJ,
    hasPermission('voir_utilisateurs'),
    (req, res) => {
        try {
            const { role } = req.params;
            if (!ROLES_VALIDES.includes(role)) {
                return res.status(400).json({
                    success: false,
                    message: `Rôle invalide. Rôles acceptés: ${ROLES_VALIDES.join(', ')}`
                });
            }

            const db = getDb();
            const users = db.prepare(`
                SELECT id, nom, prenom, email, telephone, actif, avatar, created_at
                FROM utilisateurs
                WHERE role = ? AND actif = 1
                ORDER BY nom, prenom
            `).all(role);

            return res.json({ success: true, count: users.length, data: users });
        } catch (error) {
            console.error('❌ Erreur /utilisateurs/role/:role:', error);
            return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
        }
    }
);

// =========================================================
// 🆕 GET /utilisateurs/pour-selection
// Route dédiée au sélecteur d'utilisateur dans les formulaires
// Accessible à : admin, dj, superviseur
// ⚠️ DOIT ÊTRE PLACÉE AVANT /:id (sinon Express la confond)
// =========================================================

router.get('/pour-selection', authenticate, (req, res) => {
    try {
        if (!ROLES_CREATEURS_MISSION.includes(req.userRole)) {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé - rôle non autorisé'
            });
        }

        const db = getDb();
        const users = db.prepare(`
            SELECT id, nom, prenom, email, telephone, role, actif
            FROM utilisateurs
            WHERE actif = 1
            ORDER BY role ASC, nom ASC, prenom ASC
        `).all();

        return res.json({ success: true, count: users.length, data: users });
    } catch (error) {
        console.error('❌ Erreur /utilisateurs/pour-selection:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// =========================================================
// GET /utilisateurs — Liste complète (admin/DJ uniquement)
// =========================================================

router.get(
    '/',
    authenticate,
    isAdminOrDJ,
    hasPermission('voir_utilisateurs'),
    (req, res) => {
        try {
            const db = getDb();
            const { page = 1, limit = 50, role, actif, search } = req.query;

            let conditions = [];
            let params = [];

            if (role) { conditions.push('role = ?'); params.push(role); }
            if (actif !== undefined) { conditions.push('actif = ?'); params.push(parseInt(actif)); }
            if (search) {
                conditions.push('(nom LIKE ? OR prenom LIKE ? OR email LIKE ?)');
                const searchTerm = `%${search}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
            const offset = (parseInt(page) - 1) * parseInt(limit);

            const users = db.prepare(`
                SELECT id, nom, prenom, email, telephone, role, actif, avatar, created_at, derniere_connexion
                FROM utilisateurs
                ${whereClause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `).all(...params, parseInt(limit), offset);

            const total = db.prepare(
                `SELECT COUNT(*) as count FROM utilisateurs ${whereClause}`
            ).get(...params);

            const usersWithRoleData = users.map(user => {
                let roleData = null;
                if (user.role === 'technicien') {
                    roleData = db.prepare(`
                        SELECT id, matricule, specialite, zone_intervention, telephone, disponible, en_mission
                        FROM techniciens WHERE utilisateur_id = ?
                    `).get(user.id);
                } else if (user.role === 'superviseur') {
                    roleData = db.prepare(`
                        SELECT id, zone_responsable, niveau_experience, telephone_pro
                        FROM superviseurs WHERE utilisateur_id = ?
                    `).get(user.id);
                }
                return { ...user, roleData };
            });

            return res.json({
                success: true,
                data: usersWithRoleData,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: total.count,
                    pages: Math.ceil(total.count / parseInt(limit))
                }
            });
        } catch (error) {
            console.error('❌ Erreur /utilisateurs:', error);
            return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
        }
    }
);

// =========================================================
// GET /utilisateurs/:id — Détails d'un utilisateur
// =========================================================

router.get(
    '/:id',
    authenticate,
    isAdminOrDJ,
    hasPermission('voir_utilisateurs'),
    (req, res) => {
        try {
            const db = getDb();
            const userId = parseInt(req.params.id);

            const user = db.prepare(`
                SELECT id, nom, prenom, email, telephone, role, actif, avatar, created_at, derniere_connexion, updated_at
                FROM utilisateurs
                WHERE id = ?
            `).get(userId);

            if (!user) {
                return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
            }

            let roleData = null;
            if (user.role === 'technicien') {
                roleData = db.prepare(`
                    SELECT id, matricule, specialite, zone_intervention, telephone, disponible, en_mission, latitude, longitude, date_embauche
                    FROM techniciens WHERE utilisateur_id = ?
                `).get(user.id);
            } else if (user.role === 'superviseur') {
                roleData = db.prepare(`
                    SELECT id, zone_responsable, niveau_experience, telephone_pro
                    FROM superviseurs WHERE utilisateur_id = ?
                `).get(user.id);
            }

            const membreGroupe = db.prepare(
                'SELECT id, est_admin, a_rejoint_le FROM membres_groupe_officiel WHERE utilisateur_id = ?'
            ).get(user.id);
            const actionsCount = db.prepare(
                'SELECT COUNT(*) as count FROM historique_actions WHERE utilisateur_id = ?'
            ).get(user.id);
            const notifsNonLues = db.prepare(
                'SELECT COUNT(*) as count FROM notifications WHERE utilisateur_id = ? AND est_lu = 0'
            ).get(user.id);

            return res.json({
                success: true,
                user: {
                    ...user,
                    roleData,
                    est_membre_groupe: !!membreGroupe,
                    est_admin_groupe: membreGroupe ? membreGroupe.est_admin === 1 : false,
                    a_rejoint_groupe: membreGroupe ? membreGroupe.a_rejoint_le : null,
                    total_actions: actionsCount.count,
                    notifications_non_lues: notifsNonLues.count
                }
            });
        } catch (error) {
            console.error('❌ Erreur /utilisateurs/:id:', error);
            return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
        }
    }
);

// =========================================================
// POST /utilisateurs — Créer un utilisateur
// =========================================================

router.post('/', authenticate, isAdmin, hasPermission('creer_utilisateur'), (req, res) => {
    try {
        const {
            nom, prenom, email, mot_de_passe, telephone, role,
            specialite, zone_intervention, zone_responsable, niveau_experience
        } = req.body;

        if (!nom || !prenom || !email || !mot_de_passe || !role) {
            return res.status(400).json({
                success: false,
                message: 'Nom, prénom, email, mot de passe et rôle sont requis'
            });
        }

        if (!ROLES_VALIDES.includes(role)) {
            return res.status(400).json({
                success: false,
                message: `Rôle invalide. Rôles acceptés: ${ROLES_VALIDES.join(', ')}`
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: 'Email invalide' });
        }

        if (mot_de_passe.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Le mot de passe doit contenir au moins 6 caractères'
            });
        }

        const db = getDb();
        const emailExiste = db.prepare('SELECT id FROM utilisateurs WHERE email = ?').get(email);
        if (emailExiste) {
            return res.status(409).json({ success: false, message: 'Cet email est déjà utilisé' });
        }

        const hash = bcrypt.hashSync(mot_de_passe, 10);
        const result = db.prepare(`
            INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, telephone, role, actif)
            VALUES (?, ?, ?, ?, ?, ?, 1)
        `).run(nom, prenom, email, hash, telephone || null, role);

        const userId = result.lastInsertRowid;

        if (role === 'technicien') {
            const matricule = `TECH-${Date.now().toString().slice(-6)}`;
            db.prepare(`
                INSERT INTO techniciens (utilisateur_id, matricule, specialite, zone_intervention, telephone, disponible)
                VALUES (?, ?, ?, ?, ?, 1)
            `).run(userId, matricule, specialite || null, zone_intervention || null, telephone || null);
        }

        if (role === 'superviseur') {
            db.prepare(`
                INSERT INTO superviseurs (utilisateur_id, zone_responsable, niveau_experience, telephone_pro)
                VALUES (?, ?, ?, ?)
            `).run(userId, zone_responsable || null, niveau_experience || 1, telephone || null);
        }

        const groupeId = db.prepare('SELECT id FROM groupe_officiel LIMIT 1').get();
        if (groupeId) {
            const estAdmin = role === 'admin' ? 1 : 0;
            db.prepare(
                'INSERT INTO membres_groupe_officiel (groupe_officiel_id, utilisateur_id, est_admin) VALUES (?, ?, ?)'
            ).run(groupeId.id, userId, estAdmin);
        }

        logUserAction(req, 'CREATION_UTILISATEUR', { table: 'utilisateurs', recordId: userId, email, role });

        const admins = db.prepare('SELECT id FROM utilisateurs WHERE role = ? AND id != ?').all('admin', req.userId);
        const insertNotif = db.prepare(
            'INSERT INTO notifications (utilisateur_id, type, titre, message, donnees) VALUES (?, ?, ?, ?, ?)'
        );
        admins.forEach(admin => {
            insertNotif.run(
                admin.id,
                'systeme',
                '👤 Nouvel utilisateur',
                `${req.user.prenom} ${req.user.nom} a créé ${prenom} ${nom} (${role})`,
                JSON.stringify({ userId, email, role })
            );
        });

        return res.status(201).json({ success: true, message: 'Utilisateur créé avec succès', userId });
    } catch (error) {
        console.error('❌ Erreur POST /utilisateurs:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// =========================================================
// PUT /utilisateurs/:id — Modifier un utilisateur
// =========================================================

router.put('/:id', authenticate, isAdmin, hasPermission('modifier_utilisateur'), (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { nom, prenom, email, telephone, role, mot_de_passe } = req.body;
        const db = getDb();

        const user = db.prepare('SELECT id, email, role, nom, prenom FROM utilisateurs WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
        }

        if (email && email !== user.email) {
            const emailExiste = db.prepare('SELECT id FROM utilisateurs WHERE email = ? AND id != ?').get(email, userId);
            if (emailExiste) {
                return res.status(409).json({ success: false, message: 'Cet email est déjà utilisé' });
            }
        }

        if (role && !ROLES_VALIDES.includes(role)) {
            return res.status(400).json({
                success: false,
                message: `Rôle invalide. Rôles acceptés: ${ROLES_VALIDES.join(', ')}`
            });
        }

        const updateFields = [];
        const params = [];

        if (nom !== undefined) { updateFields.push('nom = ?'); params.push(nom || null); }
        if (prenom !== undefined) { updateFields.push('prenom = ?'); params.push(prenom || null); }
        if (email !== undefined) { updateFields.push('email = ?'); params.push(email || null); }
        if (telephone !== undefined) { updateFields.push('telephone = ?'); params.push(telephone || null); }
        if (role !== undefined) { updateFields.push('role = ?'); params.push(role || null); }
        if (mot_de_passe) {
            if (mot_de_passe.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Le mot de passe doit contenir au moins 6 caractères'
                });
            }
            updateFields.push('mot_de_passe = ?');
            params.push(bcrypt.hashSync(mot_de_passe, 10));
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ success: false, message: 'Aucune donnée à modifier' });
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        params.push(userId);

        try {
            db.prepare(`UPDATE utilisateurs SET ${updateFields.join(', ')} WHERE id = ?`).run(...params);
        } catch (sqlError) {
            console.error('❌ Erreur SQL:', sqlError.message);
            return res.status(500).json({
                success: false,
                message: 'Erreur lors de la mise à jour: ' + sqlError.message
            });
        }

        if (role && role !== user.role) {
            db.prepare('DELETE FROM techniciens WHERE utilisateur_id = ?').run(userId);
            db.prepare('DELETE FROM superviseurs WHERE utilisateur_id = ?').run(userId);

            if (role === 'technicien') {
                const matricule = `TECH-${Date.now().toString().slice(-6)}`;
                db.prepare(
                    'INSERT INTO techniciens (utilisateur_id, matricule, disponible) VALUES (?, ?, 1)'
                ).run(userId, matricule);
            } else if (role === 'superviseur') {
                db.prepare(
                    'INSERT INTO superviseurs (utilisateur_id, niveau_experience) VALUES (?, 1)'
                ).run(userId);
            }
        }

        logUserAction(req, 'MODIFICATION_UTILISATEUR', {
            table: 'utilisateurs',
            recordId: userId,
            email: email || user.email,
            role: role || user.role
        });

        return res.json({ success: true, message: 'Utilisateur modifié avec succès' });
    } catch (error) {
        console.error('❌ Erreur PUT /utilisateurs/:id:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// =========================================================
// DELETE /utilisateurs/:id — Supprimer un utilisateur
// =========================================================

router.delete('/:id', authenticate, isAdmin, hasPermission('supprimer_utilisateur'), (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const db = getDb();

        const user = db.prepare('SELECT id, email, role FROM utilisateurs WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
        }

        if (userId === req.userId) {
            return res.status(400).json({ success: false, message: 'Impossible de supprimer son propre compte' });
        }

        const tablesToDelete = [
            { table: 'techniciens', column: 'utilisateur_id' },
            { table: 'superviseurs', column: 'utilisateur_id' },
            { table: 'membres_groupe_officiel', column: 'utilisateur_id' },
            { table: 'notifications', column: 'utilisateur_id' },
            { table: 'historique_actions', column: 'utilisateur_id' },
            { table: 'reactions_message', column: 'utilisateur_id' },
            { table: 'statut_message', column: 'utilisateur_id' },
            { table: 'permissions', column: 'valide_par' },
            { table: 'groupe_officiel', column: 'cree_par' }
        ];

        tablesToDelete.forEach(({ table, column }) => {
            try {
                if (!hasTable(db, table)) {
                    console.warn(`⚠️ Table "${table}" non trouvée, suppression ignorée.`);
                    return;
                }
                if (!hasColumn(db, table, column)) {
                    console.warn(`⚠️ Colonne "${column}" non trouvée dans "${table}", suppression ignorée.`);
                    return;
                }
                db.prepare(`DELETE FROM ${table} WHERE ${column} = ?`).run(userId);
            } catch (err) {
                console.warn(`⚠️ Erreur suppression dans ${table}:`, err.message);
            }
        });

        try {
            db.prepare('DELETE FROM messages WHERE expediteur_id = ? OR destinataire_id = ?').run(userId, userId);
        } catch (err) {
            console.warn('⚠️ Erreur suppression messages:', err.message);
        }

        const result = db.prepare('DELETE FROM utilisateurs WHERE id = ?').run(userId);
        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé lors de la suppression' });
        }

        logUserAction(req, 'SUPPRESSION_UTILISATEUR', {
            table: 'utilisateurs',
            recordId: userId,
            email: user.email,
            role: user.role
        });

        return res.json({ success: true, message: 'Utilisateur supprimé avec succès' });
    } catch (error) {
        console.error('❌ Erreur DELETE /utilisateurs/:id:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// =========================================================
// PATCH /utilisateurs/:id/activer — Activer/Désactiver
// =========================================================

router.patch('/:id/activer', authenticate, isAdmin, hasPermission('activer_desactiver_utilisateur'), (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { actif } = req.body;

        if (actif === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Le champ "actif" est requis (1 pour activer, 0 pour désactiver)'
            });
        }

        const db = getDb();
        const user = db.prepare('SELECT id, role FROM utilisateurs WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
        }

        if (userId === req.userId && actif === 0) {
            return res.status(400).json({ success: false, message: 'Impossible de désactiver son propre compte' });
        }

        db.prepare('UPDATE utilisateurs SET actif = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(parseInt(actif), userId);

        logUserAction(req, parseInt(actif) === 1 ? 'ACTIVATION_UTILISATEUR' : 'DESACTIVATION_UTILISATEUR', {
            table: 'utilisateurs',
            recordId: userId,
            actif: parseInt(actif)
        });

        return res.json({
            success: true,
            message: `Compte ${parseInt(actif) === 1 ? 'activé' : 'désactivé'} avec succès`
        });
    } catch (error) {
        console.error('❌ Erreur PATCH /utilisateurs/:id/activer:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// =========================================================
// EXPORT
// =========================================================

module.exports = router;