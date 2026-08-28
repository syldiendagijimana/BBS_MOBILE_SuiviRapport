const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const {
    authenticate,
    isAdmin,
    isAdminOrDJ,
    isSuperviseur,
    hasPermission,
    logUserAction
} = require('../middleware/auth');

// ========================================================
// CONSTANTES - LISTE EXHAUSTIVE DES PERMISSIONS
// ========================================================

const TYPES_PERMISSION = [

    'creer_rapport', 'modifier_rapport', 'valider_rapport', 'supprimer_rapport', 'voir_rapports',

    'creer_mission', 'modifier_mission', 'affecter_mission', 'changer_statut_mission', 'supprimer_mission', 'voir_missions',

    'creer_incident', 'modifier_incident', 'resoudre_incident', 'supprimer_incident', 'voir_incidents',

    'creer_utilisateur', 'modifier_utilisateur', 'activer_desactiver_utilisateur', 'supprimer_utilisateur', 'voir_utilisateurs',

    'creer_technicien', 'modifier_technicien', 'supprimer_technicien', 'voir_techniciens',

    'creer_superviseur', 'modifier_superviseur', 'supprimer_superviseur', 'voir_superviseurs',

    'voir_reseau', 'modifier_reseau',

    'voir_statistiques',

    'envoyer_message', 'voir_messages',

    'voir_historique',

    'gerer_permissions', 'voir_permissions',

    'voir_suivi_clients', 'creer_suivi_client', 'modifier_suivi_client'
];

// ========================================================
// ROUTES SANS PARAMÈTRE :id (doivent être avant /:id)
// ========================================================

// GET /permissions/statistiques
router.get('/statistiques', authenticate, isAdminOrDJ, (req, res) => {
    try {
        const db = getDb();
        const safeGet = (query, params = []) => {
            try { const result = db.prepare(query).get(...params); return result ? (result.count || 0) : 0; }
            catch (e) { console.warn('⚠️ Statistique échouée:', e.message); return 0; }
        };
        const safeAll = (query, params = []) => {
            try { return db.prepare(query).all(...params); }
            catch (e) { console.warn('⚠️ Statistique échouée:', e.message); return []; }
        };

        const total = safeGet('SELECT COUNT(*) as count FROM permissions');
        const enAttente = safeGet('SELECT COUNT(*) as count FROM permissions WHERE est_valide = 0');
        const validees = safeGet('SELECT COUNT(*) as count FROM permissions WHERE est_valide = 1');

        const parType = safeAll(`
            SELECT type_permission,
                   COUNT(*) as total,
                   SUM(CASE WHEN est_valide = 1 THEN 1 ELSE 0 END) as validees
            FROM permissions GROUP BY type_permission
        `);

        const parSuperviseur = safeAll(`
            SELECT u.nom, u.prenom, COUNT(p.id) as total,
                   SUM(CASE WHEN p.est_valide = 1 THEN 1 ELSE 0 END) as validees
            FROM permissions p
            LEFT JOIN superviseurs s ON p.superviseur_id = s.id
            LEFT JOIN utilisateurs u ON s.utilisateur_id = u.id
            GROUP BY p.superviseur_id ORDER BY total DESC LIMIT 10
        `);

        const parMois = safeAll(`
            SELECT strftime('%Y-%m', created_at) as mois, COUNT(*) as total,
                   SUM(CASE WHEN est_valide = 1 THEN 1 ELSE 0 END) as validees
            FROM permissions WHERE created_at >= date('now', '-12 months')
            GROUP BY strftime('%Y-%m', created_at) ORDER BY mois DESC
        `);

        return res.json({
            success: true,
            statistiques: {
                global: {
                    total,
                    en_attente: enAttente,
                    validees,
                    taux_validation: total > 0 ? ((validees / total) * 100).toFixed(1) + '%' : '0%'
                },
                par_type: parType,
                par_superviseur: parSuperviseur,
                par_mois: parMois
            }
        });
    } catch (error) {
        console.error('❌ Erreur statistiques permissions:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// GET /permissions/superviseur/:id - PERMISSIONS D'UN SUPERVISEUR
router.get('/superviseur/:id', authenticate, isSuperviseur, (req, res) => {
    try {
        const superviseurId = parseInt(req.params.id);
        const db = getDb();

        const permissions = db.prepare(`
            SELECT p.*, t.matricule as technicien_matricule,
                   u_tech.nom as technicien_nom, u_tech.prenom as technicien_prenom,
                   v.nom as valide_par_nom, v.prenom as valide_par_prenom
            FROM permissions p
            LEFT JOIN techniciens t ON p.technicien_id = t.id
            LEFT JOIN utilisateurs u_tech ON t.utilisateur_id = u_tech.id
            LEFT JOIN utilisateurs v ON p.valide_par = v.id
            WHERE p.superviseur_id = ?
            ORDER BY p.created_at DESC
        `).all(superviseurId);

        // Statistiques dynamiques par type
        const statsParType = {};
        permissions.forEach(p => {
            const type = p.type_permission;
            statsParType[type] = statsParType[type] || { total: 0, en_attente: 0, validees: 0 };
            statsParType[type].total++;
            if (p.est_valide) statsParType[type].validees++;
            else statsParType[type].en_attente++;
        });

        const stats = {
            total: permissions.length,
            en_attente: permissions.filter(p => !p.est_valide).length,
            validees: permissions.filter(p => p.est_valide).length,
            par_type: statsParType
        };

        return res.json({ success: true, statistiques: stats, data: permissions });
    } catch (error) {
        console.error('❌ Erreur permissions superviseur:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// GET /permissions - LISTE DES PERMISSIONS (avec permission)
// ========================================================
router.get('/', authenticate, hasPermission('voir_permissions'), (req, res) => {
    try {
        const db = getDb();
        const { type, est_valide, superviseur_id, page = 1, limit = 50 } = req.query;

        let conditions = [];
        let params = [];

        if (type) { conditions.push('p.type_permission = ?'); params.push(type); }
        if (est_valide !== undefined) { conditions.push('p.est_valide = ?'); params.push(parseInt(est_valide)); }
        if (superviseur_id) { conditions.push('p.superviseur_id = ?'); params.push(parseInt(superviseur_id)); }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const permissions = db.prepare(`
            SELECT p.*, s.id as superviseur_id, s.zone_responsable,
                   u_sup.nom as superviseur_nom, u_sup.prenom as superviseur_prenom, u_sup.email as superviseur_email,
                   t.id as technicien_id, t.matricule as technicien_matricule,
                   u_tech.nom as technicien_nom, u_tech.prenom as technicien_prenom,
                   v.nom as valide_par_nom, v.prenom as valide_par_prenom
            FROM permissions p
            LEFT JOIN superviseurs s ON p.superviseur_id = s.id
            LEFT JOIN utilisateurs u_sup ON s.utilisateur_id = u_sup.id
            LEFT JOIN techniciens t ON p.technicien_id = t.id
            LEFT JOIN utilisateurs u_tech ON t.utilisateur_id = u_tech.id
            LEFT JOIN utilisateurs v ON p.valide_par = v.id
            ${whereClause}
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        const total = db.prepare(`SELECT COUNT(*) as count FROM permissions p ${whereClause}`).get(...params);

        return res.json({
            success: true,
            data: permissions,
            pagination: { page: parseInt(page), limit: parseInt(limit), total: total.count, pages: Math.ceil(total.count / parseInt(limit)) }
        });
    } catch (error) {
        console.error('❌ Erreur liste permissions:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// GET /permissions/:id - DÉTAILS D'UNE PERMISSION
// ========================================================
router.get('/:id', authenticate, hasPermission('voir_permissions'), (req, res) => {
    try {
        const db = getDb();
        const permissionId = parseInt(req.params.id);

        const permission = db.prepare(`
            SELECT p.*, s.id as superviseur_id, s.zone_responsable,
                   u_sup.nom as superviseur_nom, u_sup.prenom as superviseur_prenom, u_sup.email as superviseur_email,
                   t.id as technicien_id, t.matricule as technicien_matricule,
                   u_tech.nom as technicien_nom, u_tech.prenom as technicien_prenom,
                   v.nom as valide_par_nom, v.prenom as valide_par_prenom, v.email as valide_par_email
            FROM permissions p
            LEFT JOIN superviseurs s ON p.superviseur_id = s.id
            LEFT JOIN utilisateurs u_sup ON s.utilisateur_id = u_sup.id
            LEFT JOIN techniciens t ON p.technicien_id = t.id
            LEFT JOIN utilisateurs u_tech ON t.utilisateur_id = u_tech.id
            LEFT JOIN utilisateurs v ON p.valide_par = v.id
            WHERE p.id = ?
        `).get(permissionId);

        if (!permission) return res.status(404).json({ success: false, message: 'Permission non trouvée' });

        return res.json({ success: true, data: permission });
    } catch (error) {
        console.error('❌ Erreur détail permission:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// POST /permissions - CRÉER UNE PERMISSION (avec permission)
// ========================================================
router.post('/', authenticate, hasPermission('gerer_permissions'), (req, res) => {
    try {
        const { superviseur_id, technicien_id, type_permission } = req.body;

        if (!superviseur_id || !type_permission) {
            return res.status(400).json({ success: false, message: 'superviseur_id et type_permission sont requis' });
        }
        if (!TYPES_PERMISSION.includes(type_permission)) {
            return res.status(400).json({ success: false, message: `Type de permission invalide. Types acceptés: ${TYPES_PERMISSION.join(', ')}` });
        }

        const db = getDb();

        // Vérifier que le superviseur existe
        const superviseur = db.prepare('SELECT id FROM superviseurs WHERE id = ?').get(superviseur_id);
        if (!superviseur) return res.status(404).json({ success: false, message: 'Superviseur non trouvé' });

        // Vérifier que le technicien existe si fourni
        if (technicien_id) {
            const technicien = db.prepare('SELECT id FROM techniciens WHERE id = ?').get(technicien_id);
            if (!technicien) return res.status(404).json({ success: false, message: 'Technicien non trouvé' });
        }

        // Vérifier si une permission similaire existe déjà
        const existante = db.prepare(`
            SELECT id FROM permissions
            WHERE superviseur_id = ? AND type_permission = ?
              AND (technicien_id = ? OR (technicien_id IS NULL AND ? IS NULL))
              AND est_valide = 0
        `).get(superviseur_id, type_permission, technicien_id || null, technicien_id || null);

        if (existante) {
            // Mettre à jour la date de création (pour la remonter en haut)
            db.prepare('UPDATE permissions SET created_at = CURRENT_TIMESTAMP WHERE id = ?').run(existante.id);
            return res.status(200).json({
                success: true,
                message: 'Permission déjà existante, mise à jour',
                id: existante.id
            });
        }

        const result = db.prepare(`INSERT INTO permissions (superviseur_id, technicien_id, type_permission, est_valide) VALUES (?, ?, ?, 0)`)
            .run(superviseur_id, technicien_id || null, type_permission);

        const permissionId = result.lastInsertRowid;
        logUserAction(req, 'CREATION_PERMISSION', { table: 'permissions', recordId: permissionId, superviseur_id, type: type_permission });

        return res.status(201).json({ success: true, message: 'Permission créée avec succès', id: permissionId });
    } catch (error) {
        console.error('❌ Erreur création permission:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// PUT /permissions/:id - MODIFIER UNE PERMISSION (avec permission)
// ========================================================
router.put('/:id', authenticate, hasPermission('gerer_permissions'), (req, res) => {
    try {
        const permissionId = parseInt(req.params.id);
        const { superviseur_id, technicien_id, type_permission } = req.body;
        const db = getDb();

        const permission = db.prepare('SELECT * FROM permissions WHERE id = ?').get(permissionId);
        if (!permission) return res.status(404).json({ success: false, message: 'Permission non trouvée' });
        if (permission.est_valide) return res.status(400).json({ success: false, message: 'Impossible de modifier une permission déjà validée' });
        if (type_permission && !TYPES_PERMISSION.includes(type_permission)) {
            return res.status(400).json({ success: false, message: `Type de permission invalide. Types acceptés: ${TYPES_PERMISSION.join(', ')}` });
        }

        if (superviseur_id) {
            const sup = db.prepare('SELECT id FROM superviseurs WHERE id = ?').get(superviseur_id);
            if (!sup) return res.status(404).json({ success: false, message: 'Superviseur non trouvé' });
        }
        if (technicien_id) {
            const tech = db.prepare('SELECT id FROM techniciens WHERE id = ?').get(technicien_id);
            if (!tech) return res.status(404).json({ success: false, message: 'Technicien non trouvé' });
        }

        // Mise à jour sans updated_at
        db.prepare(`
            UPDATE permissions
            SET superviseur_id = COALESCE(?, superviseur_id),
                technicien_id = COALESCE(?, technicien_id),
                type_permission = COALESCE(?, type_permission)
            WHERE id = ?
        `).run(superviseur_id || null, technicien_id || null, type_permission || null, permissionId);

        logUserAction(req, 'MODIFICATION_PERMISSION', { table: 'permissions', recordId: permissionId });
        return res.json({ success: true, message: 'Permission modifiée' });
    } catch (error) {
        console.error('❌ Erreur modification permission:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// DELETE /permissions/:id (avec permission)
router.delete('/:id', authenticate, hasPermission('gerer_permissions'), (req, res) => {
    try {
        const permissionId = parseInt(req.params.id);
        const db = getDb();
        const permission = db.prepare('SELECT * FROM permissions WHERE id = ?').get(permissionId);
        if (!permission) return res.status(404).json({ success: false, message: 'Permission non trouvée' });

        db.prepare('DELETE FROM permissions WHERE id = ?').run(permissionId);
        logUserAction(req, 'SUPPRESSION_PERMISSION', { table: 'permissions', recordId: permissionId });
        return res.json({ success: true, message: 'Permission supprimée' });
    } catch (error) {
        console.error('❌ Erreur suppression permission:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// PATCH /permissions/:id/valider (avec permission)
router.patch('/:id/valider', authenticate, hasPermission('gerer_permissions'), (req, res) => {
    try {
        const permissionId = parseInt(req.params.id);
        const { valide } = req.body;
        if (valide === undefined) return res.status(400).json({ success: false, message: 'Le champ "valide" est requis (true/false)' });

        const db = getDb();
        const permission = db.prepare('SELECT * FROM permissions WHERE id = ?').get(permissionId);
        if (!permission) return res.status(404).json({ success: false, message: 'Permission non trouvée' });
        if (permission.est_valide) return res.status(400).json({ success: false, message: 'Cette permission est déjà validée' });

        // Mise à jour sans updated_at
        db.prepare(`
            UPDATE permissions
            SET est_valide = ?,
                valide_par = ?,
                date_validation = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(parseInt(valide), req.userId, permissionId);

        // Notification au superviseur
        if (permission.superviseur_id) {
            const sup = db.prepare('SELECT utilisateur_id FROM superviseurs WHERE id = ?').get(permission.superviseur_id);
            if (sup) {
                db.prepare(`INSERT INTO notifications (utilisateur_id, type, titre, message, donnees) VALUES (?, 'permission', ?, ?, ?)`)
                    .run(sup.utilisateur_id, valide ? '✅ Permission validée' : '❌ Permission refusée',
                        `Votre demande de permission "${permission.type_permission}" a été ${valide ? 'validée' : 'refusée'}`,
                        JSON.stringify({ permissionId, type: permission.type_permission, valide }));
            }
        }

        logUserAction(req, valide ? 'VALIDATION_PERMISSION' : 'REJET_PERMISSION', { table: 'permissions', recordId: permissionId, valide });
        return res.json({ success: true, message: `Permission ${valide ? 'validée' : 'refusée'} avec succès` });
    } catch (error) {
        console.error('❌ Erreur validation permission:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

module.exports = router;