const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const {
    authenticate,
    isSuperviseur,
    isSuperviseurOrAdmin,
    hasPermission,   // <-- AJOUT
    logUserAction
} = require('../middleware/auth');

// ========================================================
// CONSTANTES
// ========================================================

const STATUTS_CLIENT = ['en_attente', 'traite', 'resolu', 'ferme'];

// ========================================================
// GET /suivi-clients - LISTE DES APPELS CLIENTS
// ========================================================

router.get('/', authenticate, isSuperviseur, hasPermission('voir_suivi_clients'), (req, res) => {
    try {
        const db = getDb();
        const { statut, superviseur_id, page = 1, limit = 50 } = req.query;

        let conditions = [];
        let params = [];

        if (statut) {
            conditions.push('s.statut = ?');
            params.push(statut);
        }

        if (superviseur_id) {
            conditions.push('s.superviseur_id = ?');
            params.push(parseInt(superviseur_id));
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const appels = db.prepare(`
            SELECT
                s.*,
                sup.id as superviseur_id,
                sup.zone_responsable,
                u.nom as superviseur_nom,
                u.prenom as superviseur_prenom,
                u.email as superviseur_email
            FROM suivi_clients s
            LEFT JOIN superviseurs sup ON s.superviseur_id = sup.id
            LEFT JOIN utilisateurs u ON sup.utilisateur_id = u.id
            ${whereClause}
            ORDER BY s.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        const total = db.prepare(`
            SELECT COUNT(*) as count FROM suivi_clients s ${whereClause}
        `).get(...params.slice(0, params.length - 2));

        return res.json({
            success: true,
            data: appels,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.count,
                pages: Math.ceil(total.count / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des appels clients:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// 🔴 ROUTES SPÉCIFIQUES (STATIQUES)
// ========================================================

// GET /suivi-clients/statut/:statut - APPELS PAR STATUT
router.get('/statut/:statut', authenticate, isSuperviseur, hasPermission('voir_suivi_clients'), (req, res) => {
    try {
        const { statut } = req.params;

        if (!STATUTS_CLIENT.includes(statut)) {
            return res.status(400).json({
                success: false,
                message: `Statut invalide. Statuts acceptés: ${STATUTS_CLIENT.join(', ')}`
            });
        }

        const db = getDb();
        const { page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const appels = db.prepare(`
            SELECT
                s.*,
                u.nom as superviseur_nom,
                u.prenom as superviseur_prenom
            FROM suivi_clients s
            LEFT JOIN superviseurs sup ON s.superviseur_id = sup.id
            LEFT JOIN utilisateurs u ON sup.utilisateur_id = u.id
            WHERE s.statut = ?
            ORDER BY s.created_at DESC
            LIMIT ? OFFSET ?
        `).all(statut, parseInt(limit), offset);

        const total = db.prepare('SELECT COUNT(*) as count FROM suivi_clients WHERE statut = ?').get(statut);

        return res.json({
            success: true,
            data: appels,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.count,
                pages: Math.ceil(total.count / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des appels par statut:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// GET /suivi-clients/statistiques - STATISTIQUES
router.get('/statistiques', authenticate, isSuperviseur, hasPermission('voir_statistiques'), (req, res) => {
    try {
        const db = getDb();

        const total = db.prepare('SELECT COUNT(*) as count FROM suivi_clients').get();
        const enAttente = db.prepare('SELECT COUNT(*) as count FROM suivi_clients WHERE statut = "en_attente"').get();
        const traites = db.prepare('SELECT COUNT(*) as count FROM suivi_clients WHERE statut = "traite"').get();
        const resolus = db.prepare('SELECT COUNT(*) as count FROM suivi_clients WHERE statut = "resolu"').get();
        const fermes = db.prepare('SELECT COUNT(*) as count FROM suivi_clients WHERE statut = "ferme"').get();

        const parSuperviseur = db.prepare(`
            SELECT
                u.nom,
                u.prenom,
                COUNT(s.id) as total,
                SUM(CASE WHEN s.statut = 'resolu' THEN 1 ELSE 0 END) as resolus
            FROM suivi_clients s
            LEFT JOIN superviseurs sup ON s.superviseur_id = sup.id
            LEFT JOIN utilisateurs u ON sup.utilisateur_id = u.id
            GROUP BY s.superviseur_id
            ORDER BY total DESC
            LIMIT 10
        `).all();

        const parMois = db.prepare(`
            SELECT
                strftime('%Y-%m', created_at) as mois,
                COUNT(*) as total,
                SUM(CASE WHEN statut = 'resolu' THEN 1 ELSE 0 END) as resolus
            FROM suivi_clients
            WHERE created_at >= date('now', '-12 months')
            GROUP BY strftime('%Y-%m', created_at)
            ORDER BY mois DESC
        `).all();

        const tempsMoyen = db.prepare(`
            SELECT
                AVG(julianday(date_traitement) - julianday(date_appel)) as jours
            FROM suivi_clients
            WHERE statut IN ('resolu', 'ferme')
            AND date_traitement IS NOT NULL
            AND date_appel IS NOT NULL
        `).get();

        return res.json({
            success: true,
            statistiques: {
                global: {
                    total: total.count,
                    en_attente: enAttente.count,
                    traites: traites.count,
                    resolus: resolus.count,
                    fermes: fermes.count,
                    taux_resolution: total.count > 0 ? ((resolus.count / total.count) * 100).toFixed(1) + '%' : '0%'
                },
                par_superviseur: parSuperviseur,
                par_mois: parMois,
                temps_moyen_resolution: tempsMoyen?.jours ? Math.round(tempsMoyen.jours) + ' jours' : 'N/A'
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des statistiques des appels clients:', error);
        return res.status(200).json({
            success: true,
            statistiques: {
                global: { total: 0, en_attente: 0, traites: 0, resolus: 0, fermes: 0, taux_resolution: '0%' },
                par_superviseur: [],
                par_mois: [],
                temps_moyen_resolution: 'N/A'
            }
        });
    }
});

// ========================================================
// 🟢 ROUTES DYNAMIQUES (AVEC :id)
// ========================================================

// GET /suivi-clients/:id - DÉTAILS D'UN APPEL
router.get('/:id', authenticate, isSuperviseur, hasPermission('voir_suivi_clients'), (req, res) => {
    try {
        const db = getDb();
        const appelId = parseInt(req.params.id);

        const appel = db.prepare(`
            SELECT
                s.*,
                sup.id as superviseur_id,
                sup.zone_responsable,
                u.nom as superviseur_nom,
                u.prenom as superviseur_prenom,
                u.email as superviseur_email,
                u.telephone as superviseur_telephone
            FROM suivi_clients s
            LEFT JOIN superviseurs sup ON s.superviseur_id = sup.id
            LEFT JOIN utilisateurs u ON sup.utilisateur_id = u.id
            WHERE s.id = ?
        `).get(appelId);

        if (!appel) {
            return res.status(404).json({
                success: false,
                message: 'Appel client non trouvé'
            });
        }

        return res.json({
            success: true,
            data: appel
        });

    } catch (error) {
        console.error('❌ Erreur de récupération de l\'appel:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// POST /suivi-clients - CRÉER UN APPEL CLIENT
router.post('/', authenticate, isSuperviseur, hasPermission('creer_suivi_client'), (req, res) => {
    try {
        const {
            client_nom,
            client_telephone,
            motif,
            description,
            notes
        } = req.body;

        if (!client_nom || !client_telephone || !motif) {
            return res.status(400).json({
                success: false,
                message: 'client_nom, client_telephone et motif sont requis'
            });
        }

        const db = getDb();

        const superviseur = db.prepare('SELECT id FROM superviseurs WHERE utilisateur_id = ?').get(req.userId);
        if (!superviseur) {
            return res.status(404).json({
                success: false,
                message: 'Profil superviseur non trouvé'
            });
        }

        const result = db.prepare(`
            INSERT INTO suivi_clients (
                superviseur_id,
                client_nom,
                client_telephone,
                motif,
                description,
                notes,
                statut
            ) VALUES (?, ?, ?, ?, ?, ?, 'en_attente')
        `).run(
            superviseur.id,
            client_nom.trim(),
            client_telephone.trim(),
            motif.trim(),
            description ? description.trim() : null,
            notes ? notes.trim() : null
        );

        const appelId = result.lastInsertRowid;

        logUserAction(req, 'CREATION_APPEL_CLIENT', {
            table: 'suivi_clients',
            recordId: appelId,
            client_nom: client_nom,
            motif: motif
        });

        return res.status(201).json({
            success: true,
            message: 'Appel client enregistré avec succès',
            id: appelId
        });

    } catch (error) {
        console.error('❌ Erreur de création de l\'appel client:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// PUT /suivi-clients/:id - MODIFIER UN APPEL
router.put('/:id', authenticate, isSuperviseurOrAdmin, hasPermission('modifier_suivi_client'), (req, res) => {
    try {
        const appelId = parseInt(req.params.id);
        const {
            client_nom,
            client_telephone,
            motif,
            description,
            notes
        } = req.body;

        const db = getDb();

        const appel = db.prepare('SELECT * FROM suivi_clients WHERE id = ?').get(appelId);
        if (!appel) {
            return res.status(404).json({
                success: false,
                message: 'Appel client non trouvé'
            });
        }

        if (req.userRole !== 'admin') {
            const superviseur = db.prepare('SELECT id FROM superviseurs WHERE utilisateur_id = ?').get(req.userId);
            if (!superviseur || appel.superviseur_id !== superviseur.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Accès refusé - Vous n\'êtes pas le propriétaire de cet appel'
                });
            }
        }

        if (appel.statut === 'ferme') {
            return res.status(400).json({
                success: false,
                message: 'Impossible de modifier un appel fermé'
            });
        }

        db.prepare(`
            UPDATE suivi_clients
            SET client_nom = COALESCE(?, client_nom),
                client_telephone = COALESCE(?, client_telephone),
                motif = COALESCE(?, motif),
                description = COALESCE(?, description),
                notes = COALESCE(?, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            client_nom || null,
            client_telephone || null,
            motif || null,
            description || null,
            notes || null,
            appelId
        );

        logUserAction(req, 'MODIFICATION_APPEL_CLIENT', {
            table: 'suivi_clients',
            recordId: appelId
        });

        return res.json({
            success: true,
            message: 'Appel client modifié avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur de modification de l\'appel client:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// PATCH /suivi-clients/:id/statut - CHANGER LE STATUT
router.patch('/:id/statut', authenticate, isSuperviseurOrAdmin, hasPermission('modifier_suivi_client'), (req, res) => {
    try {
        const appelId = parseInt(req.params.id);
        const { statut } = req.body;

        if (!statut) {
            return res.status(400).json({
                success: false,
                message: 'Statut requis'
            });
        }

        if (!STATUTS_CLIENT.includes(statut)) {
            return res.status(400).json({
                success: false,
                message: `Statut invalide. Statuts acceptés: ${STATUTS_CLIENT.join(', ')}`
            });
        }

        const db = getDb();

        const appel = db.prepare('SELECT * FROM suivi_clients WHERE id = ?').get(appelId);
        if (!appel) {
            return res.status(404).json({
                success: false,
                message: 'Appel client non trouvé'
            });
        }

        if (req.userRole !== 'admin') {
            const superviseur = db.prepare('SELECT id FROM superviseurs WHERE utilisateur_id = ?').get(req.userId);
            if (!superviseur || appel.superviseur_id !== superviseur.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Accès refusé - Vous n\'êtes pas le propriétaire de cet appel'
                });
            }
        }

        const ancienStatut = appel.statut;

        let dateTraitement = appel.date_traitement;
        if (statut === 'traite' || statut === 'resolu') {
            dateTraitement = new Date().toISOString();
        }

        db.prepare(`
            UPDATE suivi_clients
            SET statut = ?,
                date_traitement = COALESCE(?, date_traitement),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(statut, dateTraitement, appelId);

        logUserAction(req, 'CHANGEMENT_STATUT_APPEL_CLIENT', {
            table: 'suivi_clients',
            recordId: appelId,
            ancien_statut: ancienStatut,
            nouveau_statut: statut
        });

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
// EXPORT
// ========================================================

module.exports = router;