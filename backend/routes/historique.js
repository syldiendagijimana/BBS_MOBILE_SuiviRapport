const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const {
    authenticate,
    isAdmin,
    logUserAction
} = require('../middleware/auth');

// ========================================================
// GET /historique/actions - LISTE DES ACTIONS
// ========================================================

router.get('/actions', authenticate, isAdmin, (req, res) => {
    try {
        const db = getDb();
        const {
            utilisateur_id,
            table_concerned,
            action,
            date_debut,
            date_fin,
            page = 1,
            limit = 50
        } = req.query;

        let conditions = [];
        let params = [];

        if (utilisateur_id) {
            conditions.push('h.utilisateur_id = ?');
            params.push(parseInt(utilisateur_id));
        }

        if (table_concerned) {
            conditions.push('h.table_concerned = ?');
            params.push(table_concerned);
        }

        if (action) {
            conditions.push('h.action LIKE ?');
            params.push(`%${action}%`);
        }

        if (date_debut) {
            conditions.push('h.created_at >= ?');
            params.push(date_debut);
        }

        if (date_fin) {
            conditions.push('h.created_at <= ?');
            params.push(date_fin);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const actions = db.prepare(`
            SELECT
                h.*,
                u.nom,
                u.prenom,
                u.email,
                u.role
            FROM historique_actions h
            LEFT JOIN utilisateurs u ON h.utilisateur_id = u.id
            ${whereClause}
            ORDER BY h.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        const total = db.prepare(`
            SELECT COUNT(*) as count FROM historique_actions h ${whereClause}
        `).get(...params.slice(0, params.length - 2));

        return res.json({
            success: true,
            data: actions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.count,
                pages: Math.ceil(total.count / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des actions:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /historique/utilisateur/:id - ACTIONS D'UN UTILISATEUR
// ========================================================

router.get('/utilisateur/:id', authenticate, isAdmin, (req, res) => {
    try {
        const db = getDb();
        const utilisateurId = parseInt(req.params.id);
        const { page = 1, limit = 50 } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const actions = db.prepare(`
            SELECT
                h.*,
                u.nom,
                u.prenom,
                u.email,
                u.role
            FROM historique_actions h
            LEFT JOIN utilisateurs u ON h.utilisateur_id = u.id
            WHERE h.utilisateur_id = ?
            ORDER BY h.created_at DESC
            LIMIT ? OFFSET ?
        `).all(utilisateurId, parseInt(limit), offset);

        const total = db.prepare(`
            SELECT COUNT(*) as count
            FROM historique_actions
            WHERE utilisateur_id = ?
        `).get(utilisateurId);

        const stats = db.prepare(`
            SELECT
                COUNT(*) as total,
                table_concerned,
                COUNT(*) as count
            FROM historique_actions
            WHERE utilisateur_id = ?
            GROUP BY table_concerned
            ORDER BY count DESC
        `).all(utilisateurId);

        return res.json({
            success: true,
            utilisateur: {
                id: utilisateurId
            },
            statistiques: {
                total: total.count,
                par_table: stats
            },
            data: actions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.count,
                pages: Math.ceil(total.count / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des actions de l\'utilisateur:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /historique/table/:table - ACTIONS PAR TABLE
// ========================================================

router.get('/table/:table', authenticate, isAdmin, (req, res) => {
    try {
        const db = getDb();
        const { table } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const actions = db.prepare(`
            SELECT
                h.*,
                u.nom,
                u.prenom,
                u.email,
                u.role
            FROM historique_actions h
            LEFT JOIN utilisateurs u ON h.utilisateur_id = u.id
            WHERE h.table_concerned = ?
            ORDER BY h.created_at DESC
            LIMIT ? OFFSET ?
        `).all(table, parseInt(limit), offset);

        const total = db.prepare(`
            SELECT COUNT(*) as count
            FROM historique_actions
            WHERE table_concerned = ?
        `).get(table);

        return res.json({
            success: true,
            table: table,
            data: actions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.count,
                pages: Math.ceil(total.count / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des actions par table:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /historique/statistiques - STATISTIQUES
// ========================================================

router.get('/statistiques', authenticate, isAdmin, (req, res) => {
    try {
        const db = getDb();

        const total = db.prepare('SELECT COUNT(*) as count FROM historique_actions').get();

        const parTable = db.prepare(`
            SELECT table_concerned, COUNT(*) as count
            FROM historique_actions
            WHERE table_concerned IS NOT NULL
            GROUP BY table_concerned
            ORDER BY count DESC
        `).all();

        const parUtilisateur = db.prepare(`
            SELECT
                u.nom,
                u.prenom,
                u.email,
                COUNT(h.id) as count
            FROM historique_actions h
            LEFT JOIN utilisateurs u ON h.utilisateur_id = u.id
            GROUP BY h.utilisateur_id
            ORDER BY count DESC
            LIMIT 10
        `).all();

        const parMois = db.prepare(`
            SELECT
                strftime('%Y-%m', created_at) as mois,
                COUNT(*) as count
            FROM historique_actions
            WHERE created_at >= date('now', '-12 months')
            GROUP BY strftime('%Y-%m', created_at)
            ORDER BY mois DESC
        `).all();

        const topActions = db.prepare(`
            SELECT
                action,
                COUNT(*) as count
            FROM historique_actions
            GROUP BY action
            ORDER BY count DESC
            LIMIT 10
        `).all();

        return res.json({
            success: true,
            statistiques: {
                total: total.count,
                par_table: parTable,
                par_utilisateur: parUtilisateur,
                par_mois: parMois,
                top_actions: topActions
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des statistiques de l\'historique:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// ✅ AJOUT 1 : DELETE /historique/delete-all - VIDER L'HISTORIQUE COMPLÈTEMENT
// ========================================================

router.delete('/delete-all', authenticate, isAdmin, (req, res) => {
    try {
        const db = getDb();

        // On supprime toutes les lignes
        const result = db.prepare('DELETE FROM historique_actions').run();

        return res.json({
            success: true,
            message: `${result.changes} action(s) supprimée(s)`,
            nombre: result.changes
        });

    } catch (error) {
        console.error('❌ Erreur lors de la suppression totale de l\'historique:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// ✅ AJOUT 2 : DELETE /historique/batch - SUPPRESSION PAR LOT (TABLEAU D'IDS)
// ========================================================

router.delete('/batch', authenticate, isAdmin, (req, res) => {
    try {
        const db = getDb();
        const { ids } = req.body;

        // Vérification de la validité des données
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez fournir un tableau d\'IDs valide'
            });
        }

        // Sécurité : s'assurer que tous les éléments sont des entiers
        const cleanIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));

        if (cleanIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Aucun ID valide fourni'
            });
        }

        // Création dynamique des placeholders pour SQLite (ex: "?, ?, ?")
        const placeholders = cleanIds.map(() => '?').join(', ');

        const query = `DELETE FROM historique_actions WHERE id IN (${placeholders})`;
        const result = db.prepare(query).run(...cleanIds);

        return res.json({
            success: true,
            message: `${result.changes} action(s) supprimée(s)`,
            nombre: result.changes
        });

    } catch (error) {
        console.error('❌ Erreur lors de la suppression par lots de l\'historique:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// DELETE /historique/clear - VIDER L'HISTORIQUE AVEC DATE (Existant)
// ========================================================

router.delete('/clear', authenticate, isAdmin, (req, res) => {
    try {
        const db = getDb();
        const { date = null } = req.query;

        let query = 'DELETE FROM historique_actions';
        let params = [];

        if (date) {
            query += ' WHERE created_at < ?';
            params.push(date);
        }

        const result = db.prepare(query).run(...params);

        return res.json({
            success: true,
            message: `${result.changes} action(s) supprimée(s)`,
            nombre: result.changes
        });

    } catch (error) {
        console.error('❌ Erreur de vidage de l\'historique:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /historique/:id - DÉTAILS D'UNE ACTION (À METTRE TOUT EN BAS)
// ========================================================

router.get('/:id', authenticate, isAdmin, (req, res) => {
    try {
        const db = getDb();
        const actionId = parseInt(req.params.id);

        const action = db.prepare(`
            SELECT
                h.*,
                u.nom,
                u.prenom,
                u.email,
                u.role
            FROM historique_actions h
            LEFT JOIN utilisateurs u ON h.utilisateur_id = u.id
            WHERE h.id = ?
        `).get(actionId);

        if (!action) {
            return res.status(404).json({
                success: false,
                message: 'Action non trouvée'
            });
        }

        return res.json({
            success: true,
            data: action
        });

    } catch (error) {
        console.error('❌ Erreur de récupération de l\'action:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// DELETE /historique/:id - SUPPRIMER UNE ACTION UNIQUE (À METTRE TOUT EN BAS)
// ========================================================

router.delete('/:id', authenticate, isAdmin, (req, res) => {
    try {
        const actionId = parseInt(req.params.id);
        const db = getDb();

        const action = db.prepare('SELECT * FROM historique_actions WHERE id = ?').get(actionId);
        if (!action) {
            return res.status(404).json({
                success: false,
                message: 'Action non trouvée'
            });
        }

        db.prepare('DELETE FROM historique_actions WHERE id = ?').run(actionId);

        return res.json({
            success: true,
            message: 'Action supprimée avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur de suppression de l\'action:', error);
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