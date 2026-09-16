const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const {
    authenticate,
    isAdmin,
    isAdminOrDJ,
    isSuperviseur,
    isTechnicien,
    hasPermission,
    logUserAction
} = require('../middleware/auth');

// ========================================================
// CONSTANTES
// ========================================================

const NIVEAUX_EXPERIENCE = [1, 2, 3, 4, 5];

// ========================================================
// ROUTES SANS PARAMÈTRE :id (DOIVENT ÊTRE AVANT /:id)
// ========================================================

// GET /superviseurs/recherche - RECHERCHER
router.get('/recherche', authenticate, isAdminOrDJ, hasPermission('voir_superviseurs'), (req, res) => {
    try {
        const { q, limit = 20 } = req.query;

        if (!q || q.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Le terme de recherche doit contenir au moins 2 caractères'
            });
        }

        const db = getDb();

        const superviseurs = db.prepare(`
            SELECT
                s.id,
                s.zone_responsable,
                s.niveau_experience,
                u.id as user_id,
                u.nom,
                u.prenom,
                u.email,
                u.telephone,
                u.avatar
            FROM superviseurs s
            LEFT JOIN utilisateurs u ON s.utilisateur_id = u.id
            WHERE u.actif = 1
                AND (u.nom LIKE ? OR u.prenom LIKE ? OR u.email LIKE ? OR s.zone_responsable LIKE ?)
            ORDER BY u.nom, u.prenom
            LIMIT ?
        `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, parseInt(limit));

        return res.json({
            success: true,
            count: superviseurs.length,
            data: superviseurs
        });

    } catch (error) {
        console.error('❌ Erreur de recherche des superviseurs:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// GET /superviseurs/statistiques - STATISTIQUES
router.get('/statistiques', authenticate, isAdminOrDJ, hasPermission('voir_statistiques'), (req, res) => {
    try {
        const db = getDb();

        const total = db.prepare('SELECT COUNT(*) as count FROM superviseurs').get();

        const parNiveau = db.prepare(`
            SELECT niveau_experience, COUNT(*) as count
            FROM superviseurs
            GROUP BY niveau_experience
            ORDER BY niveau_experience
        `).all();

        const parZone = db.prepare(`
            SELECT zone_responsable, COUNT(*) as count
            FROM superviseurs
            WHERE zone_responsable IS NOT NULL AND zone_responsable != ''
            GROUP BY zone_responsable
            ORDER BY count DESC
        `).all();

        const derniers = db.prepare(`
            SELECT
                s.id,
                s.zone_responsable,
                s.niveau_experience,
                u.nom,
                u.prenom,
                u.email,
                s.created_at
            FROM superviseurs s
            LEFT JOIN utilisateurs u ON s.utilisateur_id = u.id
            ORDER BY s.created_at DESC
            LIMIT 5
        `).all();

        const techCount = db.prepare('SELECT COUNT(*) as count FROM techniciens WHERE disponible = 1').get();

        return res.json({
            success: true,
            statistiques: {
                total: total.count,
                par_niveau_experience: parNiveau,
                par_zone: parZone,
                derniers_ajoutes: derniers,
                ratio_superviseurs_techniciens: {
                    superviseurs: total.count,
                    techniciens_disponibles: techCount.count,
                    ratio: total.count > 0 ? (techCount.count / total.count).toFixed(2) : 0
                }
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

// GET /superviseurs/zone/:zone - PAR ZONE
router.get('/zone/:zone', authenticate, isAdminOrDJ, hasPermission('voir_superviseurs'), (req, res) => {
    try {
        const { zone } = req.params;
        const db = getDb();

        const superviseurs = db.prepare(`
            SELECT
                s.id,
                s.utilisateur_id,
                s.zone_responsable,
                s.niveau_experience,
                s.telephone_pro,
                u.nom,
                u.prenom,
                u.email,
                u.telephone,
                u.avatar
            FROM superviseurs s
            LEFT JOIN utilisateurs u ON s.utilisateur_id = u.id
            WHERE s.zone_responsable LIKE ? AND u.actif = 1
            ORDER BY u.nom, u.prenom
        `).all(`%${zone}%`);

        return res.json({
            success: true,
            count: superviseurs.length,
            data: superviseurs
        });

    } catch (error) {
        console.error('❌ Erreur de récupération par zone:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// GET /superviseurs - LISTE DES SUPERVISEURS
router.get('/', authenticate, isAdminOrDJ, hasPermission('voir_superviseurs'), (req, res) => {
    try {
        const db = getDb();
        const { zone, search, page = 1, limit = 50 } = req.query;

        let conditions = [];
        let params = [];

        if (zone) {
            conditions.push('s.zone_responsable LIKE ?');
            params.push(`%${zone}%`);
        }

        if (search) {
            conditions.push('(u.nom LIKE ? OR u.prenom LIKE ? OR u.email LIKE ?)');
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const superviseurs = db.prepare(`
            SELECT
                s.id, s.utilisateur_id, s.zone_responsable, s.niveau_experience, s.telephone_pro,
                s.created_at, s.updated_at,
                u.id as user_id, u.nom, u.prenom, u.email, u.telephone, u.avatar, u.actif, u.created_at as user_created_at
            FROM superviseurs s
            LEFT JOIN utilisateurs u ON s.utilisateur_id = u.id
            ${whereClause}
            ORDER BY s.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        const countParams = params.length > 0 ? params.slice(0, -2) : [];
        const total = db.prepare(`
            SELECT COUNT(*) as count
            FROM superviseurs s
            LEFT JOIN utilisateurs u ON s.utilisateur_id = u.id
            ${whereClause}
        `).get(...countParams);

        const superviseursWithStats = superviseurs.map(sup => {
            const stats = {
                missions_total: db.prepare('SELECT COUNT(*) as count FROM missions WHERE superviseur_id = ?').get(sup.id)?.count || 0,
                missions_en_cours: db.prepare('SELECT COUNT(*) as count FROM missions WHERE superviseur_id = ? AND statut = ?').get(sup.id, 'en_cours')?.count || 0,
                incidents_total: db.prepare('SELECT COUNT(*) as count FROM incidents WHERE superviseur_id = ?').get(sup.id)?.count || 0,
                incidents_ouverts: db.prepare('SELECT COUNT(*) as count FROM incidents WHERE superviseur_id = ? AND statut = ?').get(sup.id, 'ouvert')?.count || 0,
                techniciens_sous_responsabilite: sup.zone_responsable
                    ? (db.prepare('SELECT COUNT(*) as count FROM techniciens WHERE zone_intervention = ?').get(sup.zone_responsable)?.count || 0)
                    : 0
            };
            return { ...sup, statistiques: stats };
        });

        return res.json({
            success: true,
            data: superviseursWithStats,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.count,
                pages: Math.ceil(total.count / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des superviseurs:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// ROUTES AVEC PARAMÈTRE :id
// ========================================================

// GET /superviseurs/:id - DÉTAILS D'UN SUPERVISEUR
router.get('/:id', authenticate, isAdminOrDJ, hasPermission('voir_superviseurs'), (req, res) => {
    try {
        const db = getDb();
        const superviseurId = parseInt(req.params.id);

        const superviseur = db.prepare(`
            SELECT
                s.id, s.utilisateur_id, s.zone_responsable, s.niveau_experience, s.telephone_pro,
                s.created_at, s.updated_at,
                u.id as user_id, u.nom, u.prenom, u.email, u.telephone, u.avatar, u.actif, u.created_at as user_created_at,
                u.derniere_connexion
            FROM superviseurs s
            LEFT JOIN utilisateurs u ON s.utilisateur_id = u.id
            WHERE s.id = ?
        `).get(superviseurId);

        if (!superviseur) {
            return res.status(404).json({ success: false, message: 'Superviseur non trouvé' });
        }

        const stats = {
            missions: {
                total: db.prepare('SELECT COUNT(*) as count FROM missions WHERE superviseur_id = ?').get(superviseurId)?.count || 0,
                planifiees: db.prepare('SELECT COUNT(*) as count FROM missions WHERE superviseur_id = ? AND statut = ?').get(superviseurId, 'planifiee')?.count || 0,
                en_cours: db.prepare('SELECT COUNT(*) as count FROM missions WHERE superviseur_id = ? AND statut = ?').get(superviseurId, 'en_cours')?.count || 0,
                terminees: db.prepare('SELECT COUNT(*) as count FROM missions WHERE superviseur_id = ? AND statut = ?').get(superviseurId, 'terminee')?.count || 0,
                annulees: db.prepare('SELECT COUNT(*) as count FROM missions WHERE superviseur_id = ? AND statut = ?').get(superviseurId, 'annulee')?.count || 0
            },
            incidents: {
                total: db.prepare('SELECT COUNT(*) as count FROM incidents WHERE superviseur_id = ?').get(superviseurId)?.count || 0,
                ouverts: db.prepare('SELECT COUNT(*) as count FROM incidents WHERE superviseur_id = ? AND statut = ?').get(superviseurId, 'ouvert')?.count || 0,
                en_cours: db.prepare('SELECT COUNT(*) as count FROM incidents WHERE superviseur_id = ? AND statut = ?').get(superviseurId, 'en_cours')?.count || 0,
                resolus: db.prepare('SELECT COUNT(*) as count FROM incidents WHERE superviseur_id = ? AND statut = ?').get(superviseurId, 'resolu')?.count || 0,
                fermes: db.prepare('SELECT COUNT(*) as count FROM incidents WHERE superviseur_id = ? AND statut = ?').get(superviseurId, 'ferme')?.count || 0
            },
            rapports: {
                total: db.prepare('SELECT COUNT(*) as count FROM rapports r JOIN missions m ON r.mission_id = m.id WHERE m.superviseur_id = ?').get(superviseurId)?.count || 0,
                soumis: db.prepare('SELECT COUNT(*) as count FROM rapports r JOIN missions m ON r.mission_id = m.id WHERE m.superviseur_id = ? AND r.statut = ?').get(superviseurId, 'soumis')?.count || 0,
                approuves: db.prepare('SELECT COUNT(*) as count FROM rapports r JOIN missions m ON r.mission_id = m.id WHERE m.superviseur_id = ? AND r.statut = ?').get(superviseurId, 'approuve')?.count || 0,
                rejetes: db.prepare('SELECT COUNT(*) as count FROM rapports r JOIN missions m ON r.mission_id = m.id WHERE m.superviseur_id = ? AND r.statut = ?').get(superviseurId, 'rejete')?.count || 0
            },
            techniciens: {
                total: superviseur.zone_responsable ? db.prepare('SELECT COUNT(*) as count FROM techniciens WHERE zone_intervention = ?').get(superviseur.zone_responsable)?.count || 0 : 0,
                disponibles: superviseur.zone_responsable ? db.prepare('SELECT COUNT(*) as count FROM techniciens WHERE zone_intervention = ? AND disponible = 1').get(superviseur.zone_responsable)?.count || 0 : 0,
                en_mission: superviseur.zone_responsable ? db.prepare('SELECT COUNT(*) as count FROM techniciens WHERE zone_intervention = ? AND en_mission = 1').get(superviseur.zone_responsable)?.count || 0 : 0
            }
        };

        const dernieresMissions = db.prepare(`
            SELECT id, titre, statut, date_debut, created_at
            FROM missions
            WHERE superviseur_id = ?
            ORDER BY created_at DESC
            LIMIT 5
        `).all(superviseurId);

        const derniersIncidents = db.prepare(`
            SELECT id, titre, severite, statut, created_at
            FROM incidents
            WHERE superviseur_id = ?
            ORDER BY created_at DESC
            LIMIT 5
        `).all(superviseurId);

        const topTechniciens = db.prepare(`
            SELECT
                t.id, t.matricule, u.nom, u.prenom, COUNT(m.id) as missions_count
            FROM techniciens t
            LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
            LEFT JOIN missions m ON t.id = m.technicien_id
            WHERE m.superviseur_id = ?
            GROUP BY t.id
            ORDER BY missions_count DESC
            LIMIT 5
        `).all(superviseurId);

        return res.json({
            success: true,
            data: {
                ...superviseur,
                statistiques: stats,
                dernieres_missions: dernieresMissions,
                derniers_incidents: derniersIncidents,
                top_techniciens: topTechniciens
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération du superviseur:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// GET /superviseurs/:id/missions - MISSIONS D'UN SUPERVISEUR
router.get('/:id/missions', authenticate, isSuperviseur, hasPermission('voir_superviseurs'), (req, res) => {
    try {
        const db = getDb();
        const superviseurId = parseInt(req.params.id);
        const { statut, page = 1, limit = 20 } = req.query;

        let conditions = ['superviseur_id = ?'];
        let params = [superviseurId];

        if (statut) {
            conditions.push('statut = ?');
            params.push(statut);
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const missions = db.prepare(`
            SELECT
                m.*,
                t.matricule as technicien_matricule,
                u.nom as technicien_nom,
                u.prenom as technicien_prenom
            FROM missions m
            LEFT JOIN techniciens t ON m.technicien_id = t.id
            LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
            ${whereClause}
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        const total = db.prepare(`SELECT COUNT(*) as count FROM missions ${whereClause}`).get(...params);

        return res.json({
            success: true,
            data: missions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.count,
                pages: Math.ceil(total.count / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des missions:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// GET /superviseurs/:id/incidents - INCIDENTS D'UN SUPERVISEUR
router.get('/:id/incidents', authenticate, isSuperviseur, hasPermission('voir_superviseurs'), (req, res) => {
    try {
        const db = getDb();
        const superviseurId = parseInt(req.params.id);
        const { statut, severite, page = 1, limit = 20 } = req.query;

        let conditions = ['superviseur_id = ?'];
        let params = [superviseurId];

        if (statut) {
            conditions.push('statut = ?');
            params.push(statut);
        }
        if (severite) {
            conditions.push('severite = ?');
            params.push(severite);
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const incidents = db.prepare(`
            SELECT
                i.*,
                t.matricule as technicien_matricule,
                u.nom as technicien_nom,
                u.prenom as technicien_prenom
            FROM incidents i
            LEFT JOIN techniciens t ON i.technicien_id = t.id
            LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
            ${whereClause}
            ORDER BY i.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        const total = db.prepare(`SELECT COUNT(*) as count FROM incidents ${whereClause}`).get(...params);

        return res.json({
            success: true,
            data: incidents,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.count,
                pages: Math.ceil(total.count / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des incidents:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// GET /superviseurs/:id/rapports - RAPPORTS SUPERVISÉS
router.get('/:id/rapports', authenticate, isSuperviseur, hasPermission('voir_superviseurs'), (req, res) => {
    try {
        const db = getDb();
        const superviseurId = parseInt(req.params.id);
        const { statut, page = 1, limit = 20 } = req.query;

        let conditions = ['m.superviseur_id = ?'];
        let params = [superviseurId];

        if (statut) {
            conditions.push('r.statut = ?');
            params.push(statut);
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const rapports = db.prepare(`
            SELECT
                r.*,
                m.titre as mission_titre,
                t.matricule as technicien_matricule,
                u.nom as technicien_nom,
                u.prenom as technicien_prenom
            FROM rapports r
            JOIN missions m ON r.mission_id = m.id
            LEFT JOIN techniciens t ON r.technicien_id = t.id
            LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
            ${whereClause}
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        const total = db.prepare(`SELECT COUNT(*) as count FROM rapports r JOIN missions m ON r.mission_id = m.id ${whereClause}`).get(...params);

        return res.json({
            success: true,
            data: rapports,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.count,
                pages: Math.ceil(total.count / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des rapports:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// ✅ CORRECTION : Remplacer isAdmin par isAdminOrDJ
// ========================================================

// POST /superviseurs - CRÉER UN SUPERVISEUR
router.post('/', authenticate, isAdminOrDJ, hasPermission('creer_superviseur'), (req, res) => {
    try {
        const { nom, prenom, email, mot_de_passe, telephone, zone_responsable, niveau_experience, telephone_pro } = req.body;

        if (!nom || !prenom || !email || !mot_de_passe) {
            return res.status(400).json({ success: false, message: 'Nom, prénom, email et mot de passe sont requis' });
        }
        if (mot_de_passe.length < 6) {
            return res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 6 caractères' });
        }

        const db = getDb();
        const emailExiste = db.prepare('SELECT id FROM utilisateurs WHERE email = ?').get(email);
        if (emailExiste) return res.status(409).json({ success: false, message: 'Cet email est déjà utilisé' });

        const hash = bcrypt.hashSync(mot_de_passe, 10);
        const userResult = db.prepare(`INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, telephone, role, actif) VALUES (?, ?, ?, ?, ?, 'superviseur', 1)`)
            .run(nom, prenom, email, hash, telephone || null);
        const userId = userResult.lastInsertRowid;

        const niveau = niveau_experience || 1;
        if (niveau < 1 || niveau > 5) return res.status(400).json({ success: false, message: 'Niveau invalide' });

        const supResult = db.prepare(`INSERT INTO superviseurs (utilisateur_id, zone_responsable, niveau_experience, telephone_pro) VALUES (?, ?, ?, ?)`)
            .run(userId, zone_responsable || null, niveau, telephone_pro || null);

        const groupeId = db.prepare('SELECT id FROM groupe_officiel LIMIT 1').get();
        if (groupeId) db.prepare('INSERT INTO membres_groupe_officiel (groupe_officiel_id, utilisateur_id, est_admin) VALUES (?, ?, 0)').run(groupeId.id, userId);

        logUserAction(req, 'CREATION_SUPERVISEUR', { table: 'superviseurs', recordId: supResult.lastInsertRowid, email });

        return res.status(201).json({ success: true, message: 'Superviseur créé avec succès', id: supResult.lastInsertRowid, utilisateur_id: userId });
    } catch (error) {
        console.error('❌ Erreur création superviseur:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// PUT /superviseurs/:id - MODIFIER UN SUPERVISEUR
router.put('/:id', authenticate, isAdminOrDJ, hasPermission('modifier_superviseur'), (req, res) => {
    try {
        const superviseurId = parseInt(req.params.id);
        const { nom, prenom, email, telephone, mot_de_passe, zone_responsable, niveau_experience, telephone_pro } = req.body;
        const db = getDb();

        const sup = db.prepare('SELECT s.*, u.id as user_id, u.email as user_email FROM superviseurs s LEFT JOIN utilisateurs u ON s.utilisateur_id = u.id WHERE s.id = ?').get(superviseurId);
        if (!sup) return res.status(404).json({ success: false, message: 'Superviseur non trouvé' });

        if (email && email !== sup.user_email) {
            if (db.prepare('SELECT id FROM utilisateurs WHERE email = ? AND id != ?').get(email, sup.user_id)) {
                return res.status(409).json({ success: false, message: 'Email déjà utilisé' });
            }
        }
        if (niveau_experience !== undefined && (niveau_experience < 1 || niveau_experience > 5)) {
            return res.status(400).json({ success: false, message: 'Niveau invalide' });
        }

        let userQuery = `UPDATE utilisateurs SET nom = COALESCE(?, nom), prenom = COALESCE(?, prenom), email = COALESCE(?, email), telephone = COALESCE(?, telephone), updated_at = CURRENT_TIMESTAMP`;
        let userParams = [nom || null, prenom || null, email || null, telephone || null];
        if (mot_de_passe) {
            if (mot_de_passe.length < 6) return res.status(400).json({ success: false, message: 'Mot de passe trop court' });
            userQuery += ', mot_de_passe = ?';
            userParams.push(bcrypt.hashSync(mot_de_passe, 10));
        }
        userQuery += ' WHERE id = ?';
        userParams.push(sup.user_id);
        db.prepare(userQuery).run(...userParams);

        db.prepare(`UPDATE superviseurs SET zone_responsable = COALESCE(?, zone_responsable), niveau_experience = COALESCE(?, niveau_experience), telephone_pro = COALESCE(?, telephone_pro), updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(zone_responsable || null, niveau_experience || null, telephone_pro || null, superviseurId);

        logUserAction(req, 'MODIFICATION_SUPERVISEUR', { table: 'superviseurs', recordId: superviseurId });
        return res.json({ success: true, message: 'Superviseur modifié avec succès' });
    } catch (error) {
        console.error('❌ Erreur modification superviseur:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// DELETE /superviseurs/:id - SUPPRIMER UN SUPERVISEUR
router.delete('/:id', authenticate, isAdminOrDJ, hasPermission('supprimer_superviseur'), (req, res) => {
    try {
        const superviseurId = parseInt(req.params.id);
        const db = getDb();
        const sup = db.prepare('SELECT s.*, u.id as user_id FROM superviseurs s LEFT JOIN utilisateurs u ON s.utilisateur_id = u.id WHERE s.id = ?').get(superviseurId);
        if (!sup) return res.status(404).json({ success: false, message: 'Superviseur non trouvé' });

        const missionsEnCours = db.prepare(`SELECT COUNT(*) as count FROM missions WHERE superviseur_id = ? AND statut IN ('planifiee', 'en_cours')`).get(superviseurId);
        if (missionsEnCours.count > 0) return res.status(400).json({ success: false, message: `Impossible de supprimer, ${missionsEnCours.count} mission(s) en cours` });

        db.prepare('DELETE FROM superviseurs WHERE id = ?').run(superviseurId);
        if (sup.user_id) db.prepare('DELETE FROM utilisateurs WHERE id = ?').run(sup.user_id);

        logUserAction(req, 'SUPPRESSION_SUPERVISEUR', { table: 'superviseurs', recordId: superviseurId });
        return res.json({ success: true, message: 'Superviseur supprimé avec succès' });
    } catch (error) {
        console.error('❌ Erreur suppression superviseur:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

module.exports = router;