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
// CACHE DES COLONNES PAR TABLE
// ========================================================

const columnsCache = {};

/**
 * Retourne la liste des colonnes d'une table (avec cache).
 */
function getTableColumns(db, tableName) {
    if (columnsCache[tableName]) return columnsCache[tableName];
    try {
        const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
        columnsCache[tableName] = cols.map(c => c.name);
        return columnsCache[tableName];
    } catch (e) {
        console.warn(`⚠️ Impossible de lire les colonnes de ${tableName}:`, e.message);
        columnsCache[tableName] = [];
        return [];
    }
}

/**
 * Vérifie si une colonne existe dans une table.
 */
function hasColumn(db, tableName, columnName) {
    return getTableColumns(db, tableName).includes(columnName);
}

// ========================================================
// FONCTION UTILITAIRE : Déterminer l'utilisateur concerné
// ========================================================

function resolveUserTarget(db, userId) {
    if (!userId) return { user_id: null, superviseur_id: null, technicien_id: null, role: null };

    const user = db.prepare('SELECT id, role, nom, prenom FROM utilisateurs WHERE id = ?').get(userId);
    if (!user) {
        return { user_id: userId, superviseur_id: null, technicien_id: null, role: null, exists: false };
    }

    const role = (user.role || '').toLowerCase();

    if (role === 'superviseur') {
        const sup = db.prepare('SELECT id FROM superviseurs WHERE utilisateur_id = ?').get(userId);
        return {
            user_id: userId,
            superviseur_id: sup?.id || null,
            technicien_id: null,
            role: 'superviseur',
            exists: true,
        };
    }

    if (role === 'technicien') {
        const tech = db.prepare('SELECT id FROM techniciens WHERE utilisateur_id = ?').get(userId);
        return {
            user_id: userId,
            superviseur_id: null,
            technicien_id: tech?.id || null,
            role: 'technicien',
            exists: true,
        };
    }

    return {
        user_id: userId,
        superviseur_id: null,
        technicien_id: null,
        role: role || 'utilisateur',
        exists: true,
    };
}

// ========================================================
// CONSTRUCTION DYNAMIQUE DU SELECT
// ========================================================
// Retourne { selectFields: string[], joins: string }
// selon les colonnes réellement présentes en base.
// ⚠️ Chaque JOIN est sur une ligne séparée pour éviter
//    les bugs de concaténation ("idLEFT JOIN" etc.)

function buildPermissionQuery(db) {
    const permCols = getTableColumns(db, 'permissions');
    const techCols = getTableColumns(db, 'techniciens');
    const supCols = getTableColumns(db, 'superviseurs');

    const hasUserId = permCols.includes('user_id');
    const hasSuperviseurId = permCols.includes('superviseur_id');
    const hasTechnicienId = permCols.includes('technicien_id');
    const hasValidePar = permCols.includes('valide_par');

    const techHasSpecialite = techCols.includes('specialite');
    const techHasMatricule = techCols.includes('matricule');
    const supHasZone = supCols.includes('zone_responsable');

    const selectFields = ['p.*'];
    const joinLines = [];

    // Superviseur
    if (hasSuperviseurId) {
        if (supHasZone) selectFields.push('s.zone_responsable');
        selectFields.push('u_sup.nom as superviseur_nom');
        selectFields.push('u_sup.prenom as superviseur_prenom');
        selectFields.push('u_sup.email as superviseur_email');
        joinLines.push('LEFT JOIN superviseurs s ON p.superviseur_id = s.id');
        joinLines.push('LEFT JOIN utilisateurs u_sup ON s.utilisateur_id = u_sup.id');
    }

    // Technicien
    if (hasTechnicienId) {
        if (techHasMatricule) selectFields.push('t.matricule as technicien_matricule');
        if (techHasSpecialite) selectFields.push('t.specialite as technicien_specialite');
        selectFields.push('u_tech.nom as technicien_nom');
        selectFields.push('u_tech.prenom as technicien_prenom');
        selectFields.push('u_tech.email as technicien_email');
        joinLines.push('LEFT JOIN techniciens t ON p.technicien_id = t.id');
        joinLines.push('LEFT JOIN utilisateurs u_tech ON t.utilisateur_id = u_tech.id');
    }

    // Utilisateur cible (admin / DJ / autre)
    if (hasUserId) {
        selectFields.push('u_target.nom as user_nom');
        selectFields.push('u_target.prenom as user_prenom');
        selectFields.push('u_target.email as user_email');
        selectFields.push('u_target.role as user_role');
        joinLines.push('LEFT JOIN utilisateurs u_target ON p.user_id = u_target.id');
    }

    // Validateur
    if (hasValidePar) {
        selectFields.push('v.nom as valide_par_nom');
        selectFields.push('v.prenom as valide_par_prenom');
        selectFields.push('v.email as valide_par_email');
        joinLines.push('LEFT JOIN utilisateurs v ON p.valide_par = v.id');
    }

    // ✅ Joins séparés par des retours à la ligne (sécurité anti-bug)
    const joins = joinLines.length > 0 ? '\n            ' + joinLines.join('\n            ') : '';

    return {
        selectFields,
        joins,
        hasUserId,
        hasSuperviseurId,
        hasTechnicienId,
        hasValidePar,
    };
}

// ========================================================
// ROUTES SANS PARAMÈTRE :id
// ========================================================

// GET /permissions/statistiques
router.get('/statistiques', authenticate, isAdminOrDJ, (req, res) => {
    try {
        const db = getDb();
        const safeGet = (query, params = []) => {
            try {
                const result = db.prepare(query).get(...params);
                return result ? (result.count || 0) : 0;
            } catch (e) {
                console.warn('⚠️ Statistique échouée:', e.message);
                return 0;
            }
        };
        const safeAll = (query, params = []) => {
            try {
                return db.prepare(query).all(...params);
            } catch (e) {
                console.warn('⚠️ Statistique échouée:', e.message);
                return [];
            }
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

// GET /permissions/superviseur/:id
router.get('/superviseur/:id', authenticate, isSuperviseur, (req, res) => {
    try {
        const superviseurId = parseInt(req.params.id);
        const db = getDb();
        const { selectFields, joins } = buildPermissionQuery(db);

        const query = `
            SELECT ${selectFields.join(', ')}
            FROM permissions p
            ${joins}
            WHERE p.superviseur_id = ?
            ORDER BY p.created_at DESC
        `;

        const permissions = db.prepare(query).all(superviseurId);

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
        console.error('Stack:', error.stack);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// GET /permissions - LISTE DES PERMISSIONS
// ========================================================
router.get('/', authenticate, hasPermission('voir_permissions'), (req, res) => {
    try {
        const db = getDb();
        const { type, est_valide, superviseur_id, user_id, page = 1, limit = 50 } = req.query;

        const { selectFields, joins, hasUserId, hasSuperviseurId } = buildPermissionQuery(db);

        let conditions = [];
        let params = [];

        if (type) {
            conditions.push('p.type_permission = ?');
            params.push(type);
        }
        if (est_valide !== undefined && est_valide !== '') {
            conditions.push('p.est_valide = ?');
            params.push(parseInt(est_valide));
        }
        if (superviseur_id && hasSuperviseurId) {
            conditions.push('p.superviseur_id = ?');
            params.push(parseInt(superviseur_id));
        }
        if (user_id && hasUserId) {
            conditions.push('p.user_id = ?');
            params.push(parseInt(user_id));
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const query = `
            SELECT ${selectFields.join(', ')}
            FROM permissions p
            ${joins}
            ${whereClause}
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `;

        console.log('📋 [GET /permissions] Query:', query.replace(/\s+/g, ' ').trim());
        console.log('📋 [GET /permissions] Params:', [...params, parseInt(limit), offset]);

        const permissions = db.prepare(query).all(...params, parseInt(limit), offset);

        const total = db.prepare(`SELECT COUNT(*) as count FROM permissions p ${whereClause}`).get(...params);

        return res.json({
            success: true,
            data: permissions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.count,
                pages: Math.ceil(total.count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('❌ Erreur liste permissions:', error);
        console.error('Stack:', error.stack);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur',
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
});

// ========================================================
// GET /permissions/:id - DÉTAILS D'UNE PERMISSION
// ========================================================
router.get('/:id', authenticate, hasPermission('voir_permissions'), (req, res) => {
    try {
        const db = getDb();
        const permissionId = parseInt(req.params.id);

        if (isNaN(permissionId)) {
            return res.status(400).json({ success: false, message: 'ID invalide' });
        }

        const { selectFields, joins } = buildPermissionQuery(db);

        const query = `
            SELECT ${selectFields.join(', ')}
            FROM permissions p
            ${joins}
            WHERE p.id = ?
        `;

        const permission = db.prepare(query).get(permissionId);

        if (!permission) {
            return res.status(404).json({ success: false, message: 'Permission non trouvée' });
        }

        return res.json({ success: true, data: permission });
    } catch (error) {
        console.error('❌ Erreur détail permission:', error);
        console.error('Stack:', error.stack);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur',
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
});

// ========================================================
// POST /permissions - CRÉER UNE PERMISSION
// ========================================================
router.post('/', authenticate, hasPermission('gerer_permissions'), (req, res) => {
    try {
        const { superviseur_id, technicien_id, user_id, type_permission } = req.body;

        // Validation : type_permission obligatoire
        if (!type_permission) {
            return res.status(400).json({ success: false, message: 'type_permission est requis' });
        }
        if (!TYPES_PERMISSION.includes(type_permission)) {
            return res.status(400).json({
                success: false,
                message: `Type de permission invalide. Types acceptés: ${TYPES_PERMISSION.join(', ')}`
            });
        }

        // Il faut au moins un identifiant d'utilisateur
        if (!user_id && !superviseur_id && !technicien_id) {
            return res.status(400).json({
                success: false,
                message: 'Un utilisateur est requis (user_id, superviseur_id ou technicien_id)'
            });
        }

        const db = getDb();
        const hasUserId = hasColumn(db, 'permissions', 'user_id');

        // Résoudre la cible
        let target = {
            user_id: user_id || null,
            superviseur_id: superviseur_id || null,
            technicien_id: technicien_id || null,
            role: null,
        };

        if (user_id) {
            const resolved = resolveUserTarget(db, user_id);
            if (!resolved.exists) {
                return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
            }
            target = { ...resolved };
        } else {
            if (superviseur_id) {
                const sup = db.prepare('SELECT id, utilisateur_id FROM superviseurs WHERE id = ?').get(superviseur_id);
                if (!sup) return res.status(404).json({ success: false, message: 'Superviseur non trouvé' });
                target.user_id = sup.utilisateur_id;
                target.role = 'superviseur';
            }
            if (technicien_id) {
                const tech = db.prepare('SELECT id, utilisateur_id FROM techniciens WHERE id = ?').get(technicien_id);
                if (!tech) return res.status(404).json({ success: false, message: 'Technicien non trouvé' });
                target.user_id = tech.utilisateur_id;
                target.role = 'technicien';
            }
        }

        // Vérifier si une permission similaire en attente existe déjà
        let existante = null;
        try {
            if (hasUserId) {
                existante = db.prepare(`
                    SELECT id FROM permissions
                    WHERE type_permission = ?
                      AND est_valide = 0
                      AND (
                            (user_id IS NOT NULL AND user_id = ?)
                         OR (superviseur_id IS NOT NULL AND superviseur_id = ?)
                         OR (technicien_id IS NOT NULL AND technicien_id = ?)
                      )
                `).get(
                    type_permission,
                    target.user_id || -1,
                    target.superviseur_id || -1,
                    target.technicien_id || -1
                );
            } else {
                existante = db.prepare(`
                    SELECT id FROM permissions
                    WHERE type_permission = ?
                      AND est_valide = 0
                      AND (
                            (superviseur_id IS NOT NULL AND superviseur_id = ?)
                         OR (technicien_id IS NOT NULL AND technicien_id = ?)
                      )
                `).get(
                    type_permission,
                    target.superviseur_id || -1,
                    target.technicien_id || -1
                );
            }
        } catch (checkErr) {
            console.warn('⚠️ Vérification existence échouée:', checkErr.message);
        }

        if (existante) {
            db.prepare('UPDATE permissions SET created_at = CURRENT_TIMESTAMP WHERE id = ?').run(existante.id);
            return res.status(200).json({
                success: true,
                message: 'Permission déjà existante, mise à jour',
                id: existante.id
            });
        }

        // Insertion
        let result;
        if (hasUserId) {
            result = db.prepare(`
                INSERT INTO permissions (superviseur_id, technicien_id, user_id, type_permission, est_valide)
                VALUES (?, ?, ?, ?, 0)
            `).run(
                target.superviseur_id || null,
                target.technicien_id || null,
                target.user_id || null,
                type_permission
            );
        } else {
            result = db.prepare(`
                INSERT INTO permissions (superviseur_id, technicien_id, type_permission, est_valide)
                VALUES (?, ?, ?, 0)
            `).run(
                target.superviseur_id || null,
                target.technicien_id || null,
                type_permission
            );
        }

        const permissionId = result.lastInsertRowid;
        logUserAction(req, 'CREATION_PERMISSION', {
            table: 'permissions',
            recordId: permissionId,
            user_id: target.user_id,
            role: target.role,
            type: type_permission
        });

        return res.status(201).json({
            success: true,
            message: 'Permission créée avec succès',
            id: permissionId
        });
    } catch (error) {
        console.error('❌ Erreur création permission:', error);
        console.error('Stack:', error.stack);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur',
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
});

// ========================================================
// PUT /permissions/:id - MODIFIER UNE PERMISSION
// ========================================================
router.put('/:id', authenticate, hasPermission('gerer_permissions'), (req, res) => {
    try {
        const permissionId = parseInt(req.params.id);
        const { superviseur_id, technicien_id, user_id, type_permission } = req.body;
        const db = getDb();
        const hasUserId = hasColumn(db, 'permissions', 'user_id');

        if (isNaN(permissionId)) {
            return res.status(400).json({ success: false, message: 'ID invalide' });
        }

        const permission = db.prepare('SELECT * FROM permissions WHERE id = ?').get(permissionId);
        if (!permission) return res.status(404).json({ success: false, message: 'Permission non trouvée' });
        if (permission.est_valide) return res.status(400).json({ success: false, message: 'Impossible de modifier une permission déjà validée' });
        if (type_permission && !TYPES_PERMISSION.includes(type_permission)) {
            return res.status(400).json({
                success: false,
                message: `Type de permission invalide. Types acceptés: ${TYPES_PERMISSION.join(', ')}`
            });
        }

        // Résoudre la nouvelle cible si user_id fourni
        let newTarget = null;
        if (user_id) {
            const resolved = resolveUserTarget(db, user_id);
            if (!resolved.exists) {
                return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
            }
            newTarget = resolved;
        }

        let newSupId = newTarget ? newTarget.superviseur_id : (superviseur_id || null);
        let newTechId = newTarget ? newTarget.technicien_id : (technicien_id || null);
        let newUserId = newTarget ? newTarget.user_id : (user_id || null);

        if (newSupId) {
            const sup = db.prepare('SELECT id FROM superviseurs WHERE id = ?').get(newSupId);
            if (!sup) return res.status(404).json({ success: false, message: 'Superviseur non trouvé' });
        }
        if (newTechId) {
            const tech = db.prepare('SELECT id FROM techniciens WHERE id = ?').get(newTechId);
            if (!tech) return res.status(404).json({ success: false, message: 'Technicien non trouvé' });
        }

        if (hasUserId) {
            db.prepare(`
                UPDATE permissions
                SET superviseur_id = COALESCE(?, superviseur_id),
                    technicien_id = COALESCE(?, technicien_id),
                    user_id = COALESCE(?, user_id),
                    type_permission = COALESCE(?, type_permission)
                WHERE id = ?
            `).run(newSupId, newTechId, newUserId, type_permission || null, permissionId);
        } else {
            db.prepare(`
                UPDATE permissions
                SET superviseur_id = COALESCE(?, superviseur_id),
                    technicien_id = COALESCE(?, technicien_id),
                    type_permission = COALESCE(?, type_permission)
                WHERE id = ?
            `).run(newSupId, newTechId, type_permission || null, permissionId);
        }

        logUserAction(req, 'MODIFICATION_PERMISSION', { table: 'permissions', recordId: permissionId });
        return res.json({ success: true, message: 'Permission modifiée' });
    } catch (error) {
        console.error('❌ Erreur modification permission:', error);
        console.error('Stack:', error.stack);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur',
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
});

// ========================================================
// DELETE /permissions/:id
// ========================================================
router.delete('/:id', authenticate, hasPermission('gerer_permissions'), (req, res) => {
    try {
        const permissionId = parseInt(req.params.id);
        const db = getDb();

        if (isNaN(permissionId)) {
            return res.status(400).json({ success: false, message: 'ID invalide' });
        }

        const permission = db.prepare('SELECT * FROM permissions WHERE id = ?').get(permissionId);
        if (!permission) return res.status(404).json({ success: false, message: 'Permission non trouvée' });

        db.prepare('DELETE FROM permissions WHERE id = ?').run(permissionId);
        logUserAction(req, 'SUPPRESSION_PERMISSION', { table: 'permissions', recordId: permissionId });
        return res.json({ success: true, message: 'Permission supprimée' });
    } catch (error) {
        console.error('❌ Erreur suppression permission:', error);
        console.error('Stack:', error.stack);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur',
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
});

// ========================================================
// PATCH /permissions/:id/valider
// ========================================================
router.patch('/:id/valider', authenticate, hasPermission('gerer_permissions'), (req, res) => {
    try {
        const permissionId = parseInt(req.params.id);
        const { valide } = req.body;
        if (valide === undefined) {
            return res.status(400).json({ success: false, message: 'Le champ "valide" est requis (true/false)' });
        }

        const db = getDb();
        const permission = db.prepare('SELECT * FROM permissions WHERE id = ?').get(permissionId);
        if (!permission) return res.status(404).json({ success: false, message: 'Permission non trouvée' });
        if (permission.est_valide) return res.status(400).json({ success: false, message: 'Cette permission est déjà validée' });

        db.prepare(`
            UPDATE permissions
            SET est_valide = ?,
                valide_par = ?,
                date_validation = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(parseInt(valide), req.userId, permissionId);

        // Notifier la personne concernée
        try {
            let targetUserId = null;

            if (permission.user_id) {
                targetUserId = permission.user_id;
            } else if (permission.superviseur_id) {
                const sup = db.prepare('SELECT utilisateur_id FROM superviseurs WHERE id = ?').get(permission.superviseur_id);
                targetUserId = sup?.utilisateur_id;
            } else if (permission.technicien_id) {
                const tech = db.prepare('SELECT utilisateur_id FROM techniciens WHERE id = ?').get(permission.technicien_id);
                targetUserId = tech?.utilisateur_id;
            }

            if (targetUserId) {
                db.prepare(`INSERT INTO notifications (utilisateur_id, type, titre, message, donnees) VALUES (?, 'permission', ?, ?, ?)`)
                    .run(
                        targetUserId,
                        valide ? '✅ Permission validée' : '❌ Permission refusée',
                        `Votre demande de permission "${permission.type_permission}" a été ${valide ? 'validée' : 'refusée'}`,
                        JSON.stringify({ permissionId, type: permission.type_permission, valide })
                    );
            }
        } catch (notifErr) {
            console.warn('⚠️ Erreur envoi notification:', notifErr.message);
        }

        logUserAction(req, valide ? 'VALIDATION_PERMISSION' : 'REJET_PERMISSION', {
            table: 'permissions',
            recordId: permissionId,
            valide
        });

        return res.json({ success: true, message: `Permission ${valide ? 'validée' : 'refusée'} avec succès` });
    } catch (error) {
        console.error('❌ Erreur validation permission:', error);
        console.error('Stack:', error.stack);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur',
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
});

module.exports = router;