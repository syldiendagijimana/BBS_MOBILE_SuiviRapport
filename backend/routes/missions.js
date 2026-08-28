const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const {
    authenticate,
    isSuperviseur,
    isTechnicien,
    isSuperviseurOrAdmin,
    hasPermission,
    logUserAction
} = require('../middleware/auth');

// ========================================================
// CONSTANTES
// ========================================================

const TYPES_MISSION = ['installation', 'maintenance', 'reparation', 'inspection', 'urgence'];
const PRIORITES = ['basse', 'moyenne', 'haute', 'critique'];
const STATUTS = ['planifiee', 'en_cours', 'terminee', 'annulee'];

// ========================================================
// ROUTES SANS PARAMÈTRE :id (DOIVENT ÊTRE AVANT /:id)
// ========================================================

// GET /missions/recherche - RECHERCHER DES MISSIONS (admin, DJ, superviseur)
router.get('/recherche', authenticate, isSuperviseurOrAdmin, (req, res) => {
    try {
        const { q, limit = 20 } = req.query;
        if (!q || q.length < 2) return res.status(400).json({ success: false, message: 'Le terme de recherche doit contenir au moins 2 caractères' });

        const db = getDb();

        const missions = db.prepare(`
            SELECT
                m.id,
                m.titre,
                m.description,
                m.statut,
                m.priorite,
                m.date_debut,
                m.date_fin_prevue,
                u_sup.nom as superviseur_nom,
                u_sup.prenom as superviseur_prenom,
                u_tech.nom as technicien_nom,
                u_tech.prenom as technicien_prenom
            FROM missions m
            LEFT JOIN superviseurs s ON m.superviseur_id = s.id
            LEFT JOIN utilisateurs u_sup ON s.utilisateur_id = u_sup.id
            LEFT JOIN techniciens t ON m.technicien_id = t.id
            LEFT JOIN utilisateurs u_tech ON t.utilisateur_id = u_tech.id
            WHERE m.titre LIKE ? OR m.description LIKE ? OR m.adresse LIKE ?
            ORDER BY m.priorite DESC, m.created_at DESC
            LIMIT ?
        `).all(`%${q}%`, `%${q}%`, `%${q}%`, parseInt(limit));

        return res.json({
            success: true,
            count: missions.length,
            data: missions
        });

    } catch (error) {
        console.error('❌ Erreur de recherche des missions:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// GET /missions/statistiques - STATISTIQUES (réservé aux superviseurs/admins/DJ)
router.get('/statistiques', authenticate, hasPermission('voir_statistiques'), isSuperviseurOrAdmin, (req, res) => {
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

        const total = safeGet('SELECT COUNT(*) as count FROM missions');
        const planifiees = safeGet('SELECT COUNT(*) as count FROM missions WHERE statut = ?', ['planifiee']);
        const enCours = safeGet('SELECT COUNT(*) as count FROM missions WHERE statut = ?', ['en_cours']);
        const terminees = safeGet('SELECT COUNT(*) as count FROM missions WHERE statut = ?', ['terminee']);
        const annulees = safeGet('SELECT COUNT(*) as count FROM missions WHERE statut = ?', ['annulee']);

        const parPriorite = safeAll('SELECT priorite, COUNT(*) as count FROM missions GROUP BY priorite');
        const parType = safeAll('SELECT type_mission, COUNT(*) as count FROM missions WHERE type_mission IS NOT NULL GROUP BY type_mission');
        const parMois = safeAll(`SELECT strftime('%Y-%m', created_at) as mois, COUNT(*) as count FROM missions WHERE created_at >= date('now', '-12 months') GROUP BY strftime('%Y-%m', created_at) ORDER BY mois DESC`);

        const tempsMoyen = (() => {
            try {
                const r = db.prepare("SELECT AVG(julianday(date_fin_reelle) - julianday(date_debut)) as jours FROM missions WHERE statut = 'terminee' AND date_fin_reelle IS NOT NULL").get();
                return r && r.jours ? Math.round(r.jours) + ' jours' : 'N/A';
            } catch (e) {
                return 'N/A';
            }
        })();

        const topTechniciens = safeAll(`
            SELECT
                u.nom,
                u.prenom,
                COUNT(m.id) as missions_count,
                SUM(CASE WHEN m.statut = 'terminee' THEN 1 ELSE 0 END) as terminees
            FROM missions m
            LEFT JOIN techniciens t ON m.technicien_id = t.id
            LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
            WHERE m.technicien_id IS NOT NULL
            GROUP BY m.technicien_id
            ORDER BY missions_count DESC
            LIMIT 10
        `);

        return res.json({
            success: true,
            statistiques: {
                global: {
                    total,
                    planifiees,
                    en_cours: enCours,
                    terminees,
                    annulees,
                    taux_realisation: total > 0 ? ((terminees / total) * 100).toFixed(1) + '%' : '0%'
                },
                par_priorite: parPriorite,
                par_type: parType,
                par_mois: parMois,
                temps_moyen_realisation: tempsMoyen,
                top_techniciens: topTechniciens
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

// GET /missions/planification - MISSIONS PLANIFIÉES (superviseur/admin/DJ)
router.get('/planification', authenticate, isSuperviseurOrAdmin, (req, res) => {
    try {
        const db = getDb();
        const { date_debut, date_fin } = req.query;

        let conditions = ["statut IN ('planifiee', 'en_cours')"];
        let params = [];

        if (date_debut) {
            conditions.push('date_debut >= ?');
            params.push(date_debut);
        }

        if (date_fin) {
            conditions.push('date_fin_prevue <= ?');
            params.push(date_fin);
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;

        const missions = db.prepare(`
            SELECT
                m.*,
                u_sup.nom as superviseur_nom,
                u_sup.prenom as superviseur_prenom,
                u_tech.nom as technicien_nom,
                u_tech.prenom as technicien_prenom
            FROM missions m
            LEFT JOIN superviseurs s ON m.superviseur_id = s.id
            LEFT JOIN utilisateurs u_sup ON s.utilisateur_id = u_sup.id
            LEFT JOIN techniciens t ON m.technicien_id = t.id
            LEFT JOIN utilisateurs u_tech ON t.utilisateur_id = u_tech.id
            ${whereClause}
            ORDER BY m.priorite DESC, m.date_debut ASC
        `).all(...params);

        const stats = {
            total: missions.length,
            par_priorite: {
                critique: missions.filter(m => m.priorite === 'critique').length,
                haute: missions.filter(m => m.priorite === 'haute').length,
                moyenne: missions.filter(m => m.priorite === 'moyenne').length,
                basse: missions.filter(m => m.priorite === 'basse').length
            },
            par_technicien: {}
        };

        missions.forEach(m => {
            if (m.technicien_nom) {
                const key = `${m.technicien_prenom} ${m.technicien_nom}`;
                stats.par_technicien[key] = (stats.par_technicien[key] || 0) + 1;
            }
        });

        return res.json({
            success: true,
            statistiques: stats,
            data: missions
        });

    } catch (error) {
        console.error('❌ Erreur de récupération de la planification:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// GET /missions/statut/:statut - MISSIONS PAR STATUT (superviseur/admin/DJ)
router.get('/statut/:statut', authenticate, isSuperviseurOrAdmin, (req, res) => {
    try {
        const { statut } = req.params;

        if (!STATUTS.includes(statut)) {
            return res.status(400).json({
                success: false,
                message: `Statut invalide. Statuts acceptés: ${STATUTS.join(', ')}`
            });
        }

        const db = getDb();
        const { page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const missions = db.prepare(`
            SELECT
                m.*,
                u_sup.nom as superviseur_nom,
                u_sup.prenom as superviseur_prenom,
                u_tech.nom as technicien_nom,
                u_tech.prenom as technicien_prenom
            FROM missions m
            LEFT JOIN superviseurs s ON m.superviseur_id = s.id
            LEFT JOIN utilisateurs u_sup ON s.utilisateur_id = u_sup.id
            LEFT JOIN techniciens t ON m.technicien_id = t.id
            LEFT JOIN utilisateurs u_tech ON t.utilisateur_id = u_tech.id
            WHERE m.statut = ?
            ORDER BY m.priorite DESC, m.date_debut ASC
            LIMIT ? OFFSET ?
        `).all(statut, parseInt(limit), offset);

        const total = db.prepare('SELECT COUNT(*) as count FROM missions WHERE statut = ?').get(statut);

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
        console.error('❌ Erreur de récupération des missions par statut:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// GET /missions/technicien/:id - MISSIONS D'UN TECHNICIEN (technicien ou superviseur)
router.get('/technicien/:id', authenticate, (req, res) => {
    try {
        const technicienId = parseInt(req.params.id);
        const { statut, page = 1, limit = 20 } = req.query;

        const db = getDb();
        const technicien = db.prepare('SELECT id, utilisateur_id FROM techniciens WHERE id = ?').get(technicienId);
        if (!technicien) {
            return res.status(404).json({
                success: false,
                message: 'Technicien non trouvé'
            });
        }

        if (req.userRole === 'technicien' && technicien.utilisateur_id !== req.userId) {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé - Vous ne pouvez voir que vos propres missions'
            });
        }

        let conditions = ['technicien_id = ?'];
        let params = [technicienId];

        if (statut) {
            conditions.push('statut = ?');
            params.push(statut);
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const missions = db.prepare(`
            SELECT
                m.*,
                s.zone_responsable,
                u_sup.nom as superviseur_nom,
                u_sup.prenom as superviseur_prenom
            FROM missions m
            LEFT JOIN superviseurs s ON m.superviseur_id = s.id
            LEFT JOIN utilisateurs u_sup ON s.utilisateur_id = u_sup.id
            ${whereClause}
            ORDER BY m.priorite DESC, m.date_debut ASC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        const total = db.prepare(`
            SELECT COUNT(*) as count FROM missions ${whereClause}
        `).get(...params);

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
        console.error('❌ Erreur de récupération des missions du technicien:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// GET /missions/superviseur/:id - MISSIONS D'UN SUPERVISEUR (superviseur/admin/DJ)
router.get('/superviseur/:id', authenticate, isSuperviseurOrAdmin, (req, res) => {
    try {
        const superviseurId = parseInt(req.params.id);
        const { statut, page = 1, limit = 20 } = req.query;

        const db = getDb();

        const superviseur = db.prepare('SELECT id, utilisateur_id FROM superviseurs WHERE id = ?').get(superviseurId);
        if (!superviseur) {
            return res.status(404).json({
                success: false,
                message: 'Superviseur non trouvé'
            });
        }

        if (req.userRole !== 'admin' && superviseur.utilisateur_id !== req.userId) {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé'
            });
        }

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
                u_tech.nom as technicien_nom,
                u_tech.prenom as technicien_prenom
            FROM missions m
            LEFT JOIN techniciens t ON m.technicien_id = t.id
            LEFT JOIN utilisateurs u_tech ON t.utilisateur_id = u_tech.id
            ${whereClause}
            ORDER BY m.priorite DESC, m.date_debut ASC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        const total = db.prepare(`
            SELECT COUNT(*) as count FROM missions ${whereClause}
        `).get(...params);

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
        console.error('❌ Erreur de récupération des missions du superviseur:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /missions - LISTE DES MISSIONS (accessible à tous les rôles)
// ========================================================
router.get('/', authenticate, (req, res) => {
    try {
        const db = getDb();
        const {
            statut,
            priorite,
            technicien_id,
            superviseur_id,
            date_debut,
            date_fin,
            page = 1,
            limit = 50
        } = req.query;

        let conditions = [];
        let params = [];

        if (statut) {
            conditions.push('m.statut = ?');
            params.push(statut);
        }

        if (priorite) {
            conditions.push('m.priorite = ?');
            params.push(priorite);
        }

        if (technicien_id) {
            conditions.push('m.technicien_id = ?');
            params.push(parseInt(technicien_id));
        }

        if (superviseur_id) {
            conditions.push('m.superviseur_id = ?');
            params.push(parseInt(superviseur_id));
        }

        if (date_debut) {
            conditions.push('m.date_debut >= ?');
            params.push(date_debut);
        }

        if (date_fin) {
            conditions.push('m.date_fin_prevue <= ?');
            params.push(date_fin);
        }

        // Filtrage automatique selon le rôle
        if (req.userRole === 'technicien') {
            const tech = db.prepare('SELECT id FROM techniciens WHERE utilisateur_id = ?').get(req.userId);
            if (tech) {
                conditions.push('m.technicien_id = ?');
                params.push(tech.id);
            }
        } else if (req.userRole === 'superviseur') {
            const sup = db.prepare('SELECT id FROM superviseurs WHERE utilisateur_id = ?').get(req.userId);
            if (sup) {
                conditions.push('m.superviseur_id = ?');
                params.push(sup.id);
            }
        }
        // admin et DJ voient tout → pas de filtre supplémentaire

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const missions = db.prepare(`
            SELECT
                m.*,
                s.id as superviseur_id,
                s.zone_responsable,
                u_sup.nom as superviseur_nom,
                u_sup.prenom as superviseur_prenom,
                t.id as technicien_id,
                t.matricule as technicien_matricule,
                t.specialite as technicien_specialite,
                u_tech.nom as technicien_nom,
                u_tech.prenom as technicien_prenom,
                u_tech.telephone as technicien_telephone
            FROM missions m
            LEFT JOIN superviseurs s ON m.superviseur_id = s.id
            LEFT JOIN utilisateurs u_sup ON s.utilisateur_id = u_sup.id
            LEFT JOIN techniciens t ON m.technicien_id = t.id
            LEFT JOIN utilisateurs u_tech ON t.utilisateur_id = u_tech.id
            ${whereClause}
            ORDER BY m.priorite DESC, m.date_debut ASC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        const total = db.prepare(`
            SELECT COUNT(*) as count
            FROM missions m
            ${whereClause}
        `).get(...params);

        return res.json({
            success: true,
            data: missions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total?.count || 0,
                pages: Math.ceil((total?.count || 0) / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des missions:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /missions/:id - DÉTAILS D'UNE MISSION
// ========================================================
router.get('/:id', authenticate, (req, res) => {
    try {
        const db = getDb();
        const missionId = parseInt(req.params.id);

        const mission = db.prepare(`
            SELECT
                m.*,
                s.id as superviseur_id,
                s.zone_responsable,
                u_sup.nom as superviseur_nom,
                u_sup.prenom as superviseur_prenom,
                u_sup.email as superviseur_email,
                u_sup.telephone as superviseur_telephone,
                t.id as technicien_id,
                t.matricule as technicien_matricule,
                t.specialite as technicien_specialite,
                t.zone_intervention as technicien_zone,
                t.disponible as technicien_disponible,
                u_tech.nom as technicien_nom,
                u_tech.prenom as technicien_prenom,
                u_tech.email as technicien_email,
                u_tech.telephone as technicien_telephone
            FROM missions m
            LEFT JOIN superviseurs s ON m.superviseur_id = s.id
            LEFT JOIN utilisateurs u_sup ON s.utilisateur_id = u_sup.id
            LEFT JOIN techniciens t ON m.technicien_id = t.id
            LEFT JOIN utilisateurs u_tech ON t.utilisateur_id = u_tech.id
            WHERE m.id = ?
        `).get(missionId);

        if (!mission) {
            return res.status(404).json({
                success: false,
                message: 'Mission non trouvée'
            });
        }

        // Vérification d'accès
        if (req.userRole === 'technicien') {
            const tech = db.prepare('SELECT id FROM techniciens WHERE utilisateur_id = ?').get(req.userId);
            if (tech && mission.technicien_id !== tech.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Accès refusé - Vous n\'êtes pas le technicien assigné'
                });
            }
        } else if (req.userRole === 'superviseur') {
            const sup = db.prepare('SELECT id FROM superviseurs WHERE utilisateur_id = ?').get(req.userId);
            if (sup && mission.superviseur_id !== sup.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Accès refusé - Vous n\'êtes pas le superviseur de cette mission'
                });
            }
        }
        // admin/DJ passent

        const rapports = db.prepare(`
            SELECT id, titre, statut, date_intervention, created_at
            FROM rapports
            WHERE mission_id = ?
            ORDER BY created_at DESC
        `).all(missionId);

        const incidents = db.prepare(`
            SELECT id, titre, severite, statut, created_at
            FROM incidents
            WHERE rapport_id IN (SELECT id FROM rapports WHERE mission_id = ?)
            ORDER BY created_at DESC
            LIMIT 10
        `).all(missionId);

        const historique = db.prepare(`
            SELECT action, details, created_at
            FROM historique_actions
            WHERE table_concerned = 'missions' AND enregistrement_id = ?
            ORDER BY created_at DESC
            LIMIT 20
        `).all(missionId);

        return res.json({
            success: true,
            data: {
                ...mission,
                rapports: rapports,
                incidents: incidents,
                historique: historique
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération de la mission:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// POST /missions - CRÉER UNE MISSION (superviseur/admin/DJ)
// ========================================================

router.post('/', authenticate, hasPermission('creer_mission'), (req, res) => {
    try {
        if (!['superviseur', 'admin', 'dj'].includes(req.userRole)) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        const {
            technicien_id,
            titre,
            description,
            type_mission,
            priorite,
            date_debut,
            date_fin_prevue,
            adresse,
            latitude,
            longitude,
            notes,
            superviseur_id
        } = req.body;

        if (!titre || !date_debut) {
            return res.status(400).json({
                success: false,
                message: 'Titre et date de début sont requis'
            });
        }

        if (type_mission && !TYPES_MISSION.includes(type_mission)) {
            return res.status(400).json({
                success: false,
                message: `Type de mission invalide. Types acceptés: ${TYPES_MISSION.join(', ')}`
            });
        }

        if (priorite && !PRIORITES.includes(priorite)) {
            return res.status(400).json({
                success: false,
                message: `Priorité invalide. Priorités acceptées: ${PRIORITES.join(', ')}`
            });
        }

        const db = getDb();

        let superviseurId;
        if (req.userRole === 'superviseur') {
            const superviseur = db.prepare('SELECT id FROM superviseurs WHERE utilisateur_id = ?').get(req.userId);
            if (!superviseur) {
                return res.status(404).json({ success: false, message: 'Profil superviseur non trouvé' });
            }
            superviseurId = superviseur.id;
        } else {
            if (!superviseur_id) {
                return res.status(400).json({ success: false, message: 'Veuillez sélectionner un superviseur' });
            }
            const sup = db.prepare('SELECT id FROM superviseurs WHERE id = ?').get(superviseur_id);
            if (!sup) {
                return res.status(404).json({ success: false, message: 'Superviseur non trouvé' });
            }
            superviseurId = sup.id;
        }

        if (technicien_id) {
            const technicien = db.prepare(`
                SELECT t.id, t.disponible, u.nom, u.prenom
                FROM techniciens t
                LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
                WHERE t.id = ?
            `).get(technicien_id);

            if (!technicien) {
                return res.status(404).json({
                    success: false,
                    message: 'Technicien non trouvé'
                });
            }

            if (!technicien.disponible) {
                return res.status(400).json({
                    success: false,
                    message: `Le technicien ${technicien.prenom} ${technicien.nom} n'est pas disponible`
                });
            }
        }

        const result = db.prepare(`
            INSERT INTO missions (
                superviseur_id,
                technicien_id,
                titre,
                description,
                type_mission,
                priorite,
                statut,
                date_debut,
                date_fin_prevue,
                adresse,
                latitude,
                longitude,
                notes
            ) VALUES (?, ?, ?, ?, ?, ?, 'planifiee', ?, ?, ?, ?, ?, ?)
        `).run(
            superviseurId,
            technicien_id || null,
            titre,
            description || null,
            type_mission || null,
            priorite || 'moyenne',
            date_debut,
            date_fin_prevue || null,
            adresse || null,
            latitude || null,
            longitude || null,
            notes || null
        );

        const missionId = result.lastInsertRowid;

        if (technicien_id) {
            db.prepare('UPDATE techniciens SET en_mission = 1 WHERE id = ?').run(technicien_id);

            const techUser = db.prepare('SELECT utilisateur_id FROM techniciens WHERE id = ?').get(technicien_id);
            if (techUser) {
                db.prepare(`
                    INSERT INTO notifications (utilisateur_id, type, titre, message, donnees)
                    VALUES (?, 'mission', '📋 Nouvelle mission', ?, ?)
                `).run(
                    techUser.utilisateur_id,
                    `Vous avez reçu une nouvelle mission: ${titre}`,
                    JSON.stringify({ missionId, titre })
                );
            }
        }

        logUserAction(req, 'CREATION_MISSION', {
            table: 'missions',
            recordId: missionId,
            titre: titre,
            technicien_id: technicien_id || null,
            superviseur_id: superviseurId
        });

        return res.status(201).json({
            success: true,
            message: 'Mission créée avec succès',
            id: missionId
        });

    } catch (error) {
        console.error('❌ Erreur de création de la mission:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// PUT /missions/:id - MODIFIER UNE MISSION (admin, DJ, superviseur)
// ========================================================

router.put('/:id', authenticate, hasPermission('modifier_mission'), isSuperviseurOrAdmin, (req, res) => {
    try {
        const missionId = parseInt(req.params.id);
        const {
            technicien_id,
            titre,
            description,
            type_mission,
            priorite,
            date_debut,
            date_fin_prevue,
            adresse,
            latitude,
            longitude,
            notes
        } = req.body;

        const db = getDb();

        const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(missionId);
        if (!mission) {
            return res.status(404).json({
                success: false,
                message: 'Mission non trouvée'
            });
        }

        if (req.userRole !== 'admin' && req.userRole !== 'dj') {
            const superviseur = db.prepare('SELECT id FROM superviseurs WHERE utilisateur_id = ?').get(req.userId);
            if (!superviseur || mission.superviseur_id !== superviseur.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Accès refusé – Vous n\'êtes pas le superviseur de cette mission'
                });
            }
        }

        if (mission.statut === 'terminee' || mission.statut === 'annulee') {
            return res.status(400).json({
                success: false,
                message: `Impossible de modifier une mission ${mission.statut}`
            });
        }

        if (technicien_id !== undefined && technicien_id !== mission.technicien_id) {
            if (technicien_id === null) {
                if (mission.technicien_id) {
                    db.prepare('UPDATE techniciens SET en_mission = 0 WHERE id = ?').run(mission.technicien_id);
                }
            } else {
                const technicien = db.prepare(`
                    SELECT t.id, t.disponible, u.nom, u.prenom
                    FROM techniciens t
                    LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
                    WHERE t.id = ?
                `).get(technicien_id);

                if (!technicien) {
                    return res.status(404).json({
                        success: false,
                        message: 'Technicien non trouvé'
                    });
                }
                if (!technicien.disponible) {
                    return res.status(400).json({
                        success: false,
                        message: `Le technicien ${technicien.prenom} ${technicien.nom} n'est pas disponible`
                    });
                }

                if (mission.technicien_id) {
                    db.prepare('UPDATE techniciens SET en_mission = 0 WHERE id = ?').run(mission.technicien_id);
                }
                db.prepare('UPDATE techniciens SET en_mission = 1 WHERE id = ?').run(technicien_id);
            }
        }

        const updateFields = [];
        const params = [];

        if (technicien_id !== undefined) {
            updateFields.push('technicien_id = ?');
            params.push(technicien_id === null ? null : technicien_id);
        }
        if (titre !== undefined) {
            updateFields.push('titre = ?');
            params.push(titre || null);
        }
        if (description !== undefined) {
            updateFields.push('description = ?');
            params.push(description || null);
        }
        if (type_mission !== undefined) {
            updateFields.push('type_mission = ?');
            params.push(type_mission || null);
        }
        if (priorite !== undefined) {
            updateFields.push('priorite = ?');
            params.push(priorite || null);
        }
        if (date_debut !== undefined) {
            updateFields.push('date_debut = ?');
            params.push(date_debut || null);
        }
        if (date_fin_prevue !== undefined) {
            updateFields.push('date_fin_prevue = ?');
            params.push(date_fin_prevue || null);
        }
        if (adresse !== undefined) {
            updateFields.push('adresse = ?');
            params.push(adresse || null);
        }
        if (latitude !== undefined) {
            updateFields.push('latitude = ?');
            params.push(latitude || null);
        }
        if (longitude !== undefined) {
            updateFields.push('longitude = ?');
            params.push(longitude || null);
        }
        if (notes !== undefined) {
            updateFields.push('notes = ?');
            params.push(notes || null);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Aucune donnée à mettre à jour'
            });
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        params.push(missionId);

        const sql = `UPDATE missions SET ${updateFields.join(', ')} WHERE id = ?`;
        db.prepare(sql).run(...params);

        logUserAction(req, 'MODIFICATION_MISSION', {
            table: 'missions',
            recordId: missionId,
            titre: titre || mission.titre
        });

        return res.json({
            success: true,
            message: 'Mission modifiée avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur de modification de la mission:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// DELETE /missions/:id - SUPPRIMER UNE MISSION
// ========================================================

router.delete('/:id', authenticate, hasPermission('supprimer_mission'), isSuperviseurOrAdmin, (req, res) => {
    try {
        const missionId = parseInt(req.params.id);
        const db = getDb();

        const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(missionId);
        if (!mission) {
            return res.status(404).json({
                success: false,
                message: 'Mission non trouvée'
            });
        }

        if (mission.statut === 'en_cours') {
            return res.status(400).json({
                success: false,
                message: 'Impossible de supprimer une mission en cours'
            });
        }

        if (mission.technicien_id) {
            db.prepare('UPDATE techniciens SET en_mission = 0 WHERE id = ?').run(mission.technicien_id);
        }

        db.prepare('DELETE FROM missions WHERE id = ?').run(missionId);

        logUserAction(req, 'SUPPRESSION_MISSION', {
            table: 'missions',
            recordId: missionId,
            titre: mission.titre
        });

        return res.json({
            success: true,
            message: 'Mission supprimée avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur de suppression de la mission:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// PATCH /missions/:id/affecter - AFFECTER UN TECHNICIEN
// ========================================================

router.patch('/:id/affecter', authenticate, hasPermission('affecter_mission'), isSuperviseur, (req, res) => {
    try {
        const missionId = parseInt(req.params.id);
        const { technicien_id } = req.body;

        if (!technicien_id) {
            return res.status(400).json({
                success: false,
                message: 'ID du technicien requis'
            });
        }

        const db = getDb();

        const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(missionId);
        if (!mission) {
            return res.status(404).json({
                success: false,
                message: 'Mission non trouvée'
            });
        }

        const superviseur = db.prepare('SELECT id FROM superviseurs WHERE utilisateur_id = ?').get(req.userId);
        if (mission.superviseur_id !== superviseur.id) {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé - Vous n\'êtes pas le superviseur de cette mission'
            });
        }

        const technicien = db.prepare(`
            SELECT t.id, t.disponible, u.nom, u.prenom
            FROM techniciens t
            LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
            WHERE t.id = ?
        `).get(technicien_id);

        if (!technicien) {
            return res.status(404).json({
                success: false,
                message: 'Technicien non trouvé'
            });
        }

        if (!technicien.disponible) {
            return res.status(400).json({
                success: false,
                message: `Le technicien ${technicien.prenom} ${technicien.nom} n'est pas disponible`
            });
        }

        if (mission.technicien_id) {
            db.prepare('UPDATE techniciens SET en_mission = 0 WHERE id = ?').run(mission.technicien_id);
        }

        db.prepare('UPDATE techniciens SET en_mission = 1 WHERE id = ?').run(technicien_id);

        db.prepare(`
            UPDATE missions
            SET technicien_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(technicien_id, missionId);

        const techUser = db.prepare('SELECT utilisateur_id FROM techniciens WHERE id = ?').get(technicien_id);
        if (techUser) {
            db.prepare(`
                INSERT INTO notifications (utilisateur_id, type, titre, message, donnees)
                VALUES (?, 'mission', '📋 Mission assignée', ?, ?)
            `).run(
                techUser.utilisateur_id,
                `Vous avez été assigné à la mission: ${mission.titre}`,
                JSON.stringify({ missionId, titre: mission.titre })
            );
        }

        logUserAction(req, 'AFFECTATION_MISSION', {
            table: 'missions',
            recordId: missionId,
            technicien_id: technicien_id,
            titre: mission.titre
        });

        return res.json({
            success: true,
            message: 'Technicien affecté avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur d\'affectation:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// PATCH /missions/:id/statut - CHANGER LE STATUT
// ========================================================

router.patch('/:id/statut', authenticate, hasPermission('changer_statut_mission'), isSuperviseur, (req, res) => {
    try {
        const missionId = parseInt(req.params.id);
        const { statut } = req.body;

        if (!statut) {
            return res.status(400).json({
                success: false,
                message: 'Statut requis'
            });
        }

        if (!STATUTS.includes(statut)) {
            return res.status(400).json({
                success: false,
                message: `Statut invalide. Statuts acceptés: ${STATUTS.join(', ')}`
            });
        }

        const db = getDb();

        const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(missionId);
        if (!mission) {
            return res.status(404).json({
                success: false,
                message: 'Mission non trouvée'
            });
        }

        if (req.userRole !== 'admin') {
            const superviseur = db.prepare('SELECT id FROM superviseurs WHERE utilisateur_id = ?').get(req.userId);
            if (mission.superviseur_id !== superviseur.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Accès refusé - Vous n\'êtes pas le superviseur de cette mission'
                });
            }
        }

        const ancienStatut = mission.statut;

        if (statut === 'terminee' && mission.technicien_id) {
            db.prepare('UPDATE techniciens SET en_mission = 0 WHERE id = ?').run(mission.technicien_id);
            db.prepare('UPDATE missions SET date_fin_reelle = CURRENT_TIMESTAMP WHERE id = ?').run(missionId);
        }

        if (statut === 'annulee' && mission.technicien_id) {
            db.prepare('UPDATE techniciens SET en_mission = 0 WHERE id = ?').run(mission.technicien_id);
        }

        db.prepare(`
            UPDATE missions
            SET statut = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(statut, missionId);

        logUserAction(req, 'CHANGEMENT_STATUT_MISSION', {
            table: 'missions',
            recordId: missionId,
            ancien_statut: ancienStatut,
            nouveau_statut: statut,
            titre: mission.titre
        });

        if (mission.technicien_id) {
            const techUser = db.prepare('SELECT utilisateur_id FROM techniciens WHERE id = ?').get(mission.technicien_id);
            if (techUser) {
                const messages = {
                    'planifiee': 'La mission a été planifiée',
                    'en_cours': 'La mission est maintenant en cours',
                    'terminee': 'La mission est terminée ✅',
                    'annulee': 'La mission a été annulée ❌'
                };
                db.prepare(`
                    INSERT INTO notifications (utilisateur_id, type, titre, message, donnees)
                    VALUES (?, 'mission', '📋 Mise à jour mission', ?, ?)
                `).run(
                    techUser.utilisateur_id,
                    `${messages[statut] || 'Le statut de la mission a changé'}: ${mission.titre}`,
                    JSON.stringify({ missionId, statut, titre: mission.titre })
                );
            }
        }

        return res.json({
            success: true,
            message: `Statut mis à jour: ${statut}`
        });

    } catch (error) {
        console.error('❌ Erreur de changement de statut:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// PATCH /missions/:id/terminer - TERMINER UNE MISSION
// ========================================================

router.patch('/:id/terminer', authenticate, hasPermission('changer_statut_mission'), isTechnicien, (req, res) => {
    try {
        const missionId = parseInt(req.params.id);
        const { notes } = req.body;

        const db = getDb();

        const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(missionId);
        if (!mission) {
            return res.status(404).json({
                success: false,
                message: 'Mission non trouvée'
            });
        }

        const technicien = db.prepare('SELECT id FROM techniciens WHERE utilisateur_id = ?').get(req.userId);
        if (!technicien || mission.technicien_id !== technicien.id) {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé - Vous n\'êtes pas le technicien assigné'
            });
        }

        if (mission.statut === 'terminee' || mission.statut === 'annulee') {
            return res.status(400).json({
                success: false,
                message: `La mission est déjà ${mission.statut}`
            });
        }

        db.prepare(`
            UPDATE missions
            SET statut = 'terminee',
                date_fin_reelle = CURRENT_TIMESTAMP,
                notes = COALESCE(?, notes || notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(notes || null, missionId);

        db.prepare('UPDATE techniciens SET en_mission = 0 WHERE id = ?').run(technicien.id);

        const superviseur = db.prepare('SELECT utilisateur_id FROM superviseurs WHERE id = ?').get(mission.superviseur_id);
        if (superviseur) {
            db.prepare(`
                INSERT INTO notifications (utilisateur_id, type, titre, message, donnees)
                VALUES (?, 'mission', '✅ Mission terminée', ?, ?)
            `).run(
                superviseur.utilisateur_id,
                `La mission "${mission.titre}" a été terminée par le technicien`,
                JSON.stringify({ missionId, titre: mission.titre })
            );
        }

        logUserAction(req, 'TERMINER_MISSION', {
            table: 'missions',
            recordId: missionId,
            titre: mission.titre
        });

        return res.json({
            success: true,
            message: 'Mission terminée avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur de fin de mission:', error);
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