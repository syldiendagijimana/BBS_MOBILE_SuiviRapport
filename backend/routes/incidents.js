const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const {
    authenticate,
    isTechnicien,
    isSuperviseur,
    isAdmin,
    isAdminOrDJ,
    isSuperviseurOrAdmin,
    hasPermission,
    logUserAction
} = require('../middleware/auth');

// ========================================================
// CONSTANTES
// ========================================================

const TYPES_INCIDENT = ['panne_reseau', 'panne_client', 'securite', 'equipement', 'autre'];
const SEVERITES = ['faible', 'moyenne', 'elevee', 'critique'];
const STATUTS_INCIDENT = ['ouvert', 'en_cours', 'resolu', 'ferme'];

// ========================================================
// 🔧 FONCTION UTILITAIRE : Résoudre user_id → technicien_id
// ========================================================
// Accepte un user_id (peu importe le rôle) et retourne :
//   { user_id, technicien_id, role }

function resolveUserTarget(db, userId) {
    if (!userId) return { user_id: null, technicien_id: null, role: null };

    const user = db.prepare('SELECT id, role, nom, prenom FROM utilisateurs WHERE id = ?').get(userId);
    if (!user) return { user_id: userId, technicien_id: null, role: null, exists: false };

    const role = (user.role || '').toLowerCase();

    if (role === 'technicien') {
        const tech = db.prepare('SELECT id FROM techniciens WHERE utilisateur_id = ?').get(userId);
        return {
            user_id: userId,
            technicien_id: tech?.id || null,
            role: 'technicien',
            exists: true,
        };
    }

    // admin, dj, superviseur → pas de technicien_id
    return {
        user_id: userId,
        technicien_id: null,
        role,
        exists: true,
    };
}

// ========================================================
// ROUTES SANS PARAMÈTRE :id (DOIVENT ÊTRE AVANT /:id)
// ========================================================

// GET /incidents/recherche
router.get('/recherche', authenticate, hasPermission('voir_incidents'), (req, res) => {
    try {
        const { q, limit = 20 } = req.query;
        if (!q || q.length < 2) return res.status(400).json({ success: false, message: 'Recherche trop courte' });
        const db = getDb();
        let query = `
            SELECT i.id, i.titre, i.description, i.severite, i.statut, i.zone, i.created_at,
                   u_target.nom as user_nom, u_target.prenom as user_prenom, u_target.role as user_role,
                   t.matricule as technicien_matricule
            FROM incidents i
            LEFT JOIN utilisateurs u_target ON i.user_id = u_target.id
            LEFT JOIN techniciens t ON i.technicien_id = t.id
            WHERE i.titre LIKE ? OR i.description LIKE ? OR i.zone LIKE ?
        `;
        const params = [`%${q}%`, `%${q}%`, `%${q}%`];

        if (req.userRole === 'technicien') {
            const tech = db.prepare('SELECT id FROM techniciens WHERE utilisateur_id = ?').get(req.userId);
            if (tech) {
                query += ' AND i.technicien_id = ?';
                params.push(tech.id);
            }
        } else if (req.userRole === 'superviseur') {
            const sup = db.prepare('SELECT id FROM superviseurs WHERE utilisateur_id = ?').get(req.userId);
            if (sup) {
                query += ' AND i.superviseur_id = ?';
                params.push(sup.id);
            }
        }

        query += ' ORDER BY i.severite DESC, i.created_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const incidents = db.prepare(query).all(...params);
        return res.json({ success: true, data: incidents });
    } catch (error) {
        console.error('❌ Erreur recherche incidents:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// GET /incidents/statistiques
router.get('/statistiques', authenticate, hasPermission('voir_statistiques'), (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Non authentifié', code: 'NOT_AUTHENTICATED' });
    }
    if (['superviseur', 'admin', 'dj'].includes(req.user.role)) {
        return next();
    }
    return res.status(403).json({
        success: false,
        error: 'Accès réservé aux superviseurs, administrateurs et DJ',
        code: 'SUPERVISEUR_ADMIN_DJ_ONLY'
    });
}, (req, res) => {
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

        const total = safeGet('SELECT COUNT(*) as count FROM incidents');
        const ouverts = safeGet('SELECT COUNT(*) as count FROM incidents WHERE statut = ?', ['ouvert']);
        const enCours = safeGet('SELECT COUNT(*) as count FROM incidents WHERE statut = ?', ['en_cours']);
        const resolus = safeGet('SELECT COUNT(*) as count FROM incidents WHERE statut = ?', ['resolu']);
        const fermes = safeGet('SELECT COUNT(*) as count FROM incidents WHERE statut = ?', ['ferme']);

        const parSeverite = safeAll('SELECT severite, COUNT(*) as count FROM incidents GROUP BY severite');
        const parType = safeAll('SELECT type_incident, COUNT(*) as count FROM incidents WHERE type_incident IS NOT NULL GROUP BY type_incident');
        const parMois = safeAll(`SELECT strftime('%Y-%m', created_at) as mois, COUNT(*) as count FROM incidents WHERE created_at >= date('now', '-12 months') GROUP BY strftime('%Y-%m', created_at) ORDER BY mois DESC`);
        const tempsMoyen = (() => {
            try {
                const r = db.prepare("SELECT AVG(julianday(date_resolution) - julianday(date_incident)) as jours FROM incidents WHERE statut IN ('resolu', 'ferme') AND date_resolution IS NOT NULL").get();
                return r && r.jours ? Math.round(r.jours) + ' jours' : 'N/A';
            } catch (e) { return 'N/A'; }
        })();
        const topTechniciens = safeAll(`
            SELECT u.nom, u.prenom, COUNT(i.id) as incidents_count,
                   SUM(CASE WHEN i.statut = 'resolu' THEN 1 ELSE 0 END) as resolus
            FROM incidents i
            LEFT JOIN techniciens t ON i.technicien_id = t.id
            LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
            WHERE i.technicien_id IS NOT NULL
            GROUP BY i.technicien_id
            ORDER BY incidents_count DESC LIMIT 10
        `);

        return res.json({
            success: true,
            statistiques: {
                global: {
                    total,
                    ouverts,
                    en_cours: enCours,
                    resolus,
                    fermes,
                    taux_resolution: total > 0 ? ((resolus / total) * 100).toFixed(1) + '%' : '0%'
                },
                par_severite: parSeverite,
                par_type: parType,
                par_mois: parMois,
                temps_moyen_resolution: tempsMoyen,
                top_techniciens: topTechniciens
            }
        });
    } catch (error) {
        console.error('❌ Erreur statistiques incidents:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// GET /incidents/statut/:statut
router.get('/statut/:statut', authenticate, hasPermission('voir_incidents'), (req, res) => {
    try {
        const { statut } = req.params;
        if (!STATUTS_INCIDENT.includes(statut)) return res.status(400).json({ success: false, message: 'Statut invalide' });
        const db = getDb();
        const { page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const incidents = db.prepare(`
            SELECT i.*,
                   u_target.nom as user_nom, u_target.prenom as user_prenom, u_target.role as user_role,
                   t.matricule as technicien_matricule,
                   u_sup.nom as superviseur_nom, u_sup.prenom as superviseur_prenom
            FROM incidents i
            LEFT JOIN utilisateurs u_target ON i.user_id = u_target.id
            LEFT JOIN techniciens t ON i.technicien_id = t.id
            LEFT JOIN superviseurs s ON i.superviseur_id = s.id
            LEFT JOIN utilisateurs u_sup ON s.utilisateur_id = u_sup.id
            WHERE i.statut = ?
            ORDER BY i.severite DESC, i.created_at DESC
            LIMIT ? OFFSET ?
        `).all(statut, parseInt(limit), offset);

        const total = db.prepare('SELECT COUNT(*) as count FROM incidents WHERE statut = ?').get(statut);
        return res.json({ success: true, data: incidents, pagination: { page: parseInt(page), limit: parseInt(limit), total: total.count, pages: Math.ceil(total.count / parseInt(limit)) } });
    } catch (error) {
        console.error('❌ Erreur incidents par statut:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// GET /incidents/severite/:severite
router.get('/severite/:severite', authenticate, hasPermission('voir_incidents'), (req, res) => {
    try {
        const { severite } = req.params;
        if (!SEVERITES.includes(severite)) return res.status(400).json({ success: false, message: 'Sévérité invalide' });
        const db = getDb();
        const { page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const incidents = db.prepare(`
            SELECT i.*,
                   u_target.nom as user_nom, u_target.prenom as user_prenom, u_target.role as user_role,
                   t.matricule as technicien_matricule
            FROM incidents i
            LEFT JOIN utilisateurs u_target ON i.user_id = u_target.id
            LEFT JOIN techniciens t ON i.technicien_id = t.id
            WHERE i.severite = ?
            ORDER BY i.created_at DESC
            LIMIT ? OFFSET ?
        `).all(severite, parseInt(limit), offset);

        const total = db.prepare('SELECT COUNT(*) as count FROM incidents WHERE severite = ?').get(severite);
        return res.json({ success: true, data: incidents, pagination: { page: parseInt(page), limit: parseInt(limit), total: total.count, pages: Math.ceil(total.count / parseInt(limit)) } });
    } catch (error) {
        console.error('❌ Erreur incidents par sévérité:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// GET /incidents/technicien/:id
router.get('/technicien/:id', authenticate, hasPermission('voir_incidents'), (req, res) => {
    try {
        const technicienId = parseInt(req.params.id);
        const { statut, page = 1, limit = 20 } = req.query;
        const db = getDb();

        const technicien = db.prepare('SELECT id, utilisateur_id FROM techniciens WHERE id = ?').get(technicienId);
        if (!technicien) return res.status(404).json({ success: false, message: 'Technicien non trouvé' });

        if (req.userRole === 'technicien' && technicien.utilisateur_id !== req.userId) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        let conditions = ['technicien_id = ?'];
        let params = [technicienId];
        if (statut) { conditions.push('statut = ?'); params.push(statut); }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const incidents = db.prepare(`
            SELECT i.*, u_sup.nom as superviseur_nom, u_sup.prenom as superviseur_prenom
            FROM incidents i
            LEFT JOIN superviseurs s ON i.superviseur_id = s.id
            LEFT JOIN utilisateurs u_sup ON s.utilisateur_id = u_sup.id
            ${whereClause}
            ORDER BY i.severite DESC, i.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        const total = db.prepare(`SELECT COUNT(*) as count FROM incidents ${whereClause}`).get(...params);
        return res.json({ success: true, data: incidents, pagination: { page: parseInt(page), limit: parseInt(limit), total: total.count, pages: Math.ceil(total.count / parseInt(limit)) } });
    } catch (error) {
        console.error('❌ Erreur incidents technicien:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// GET /incidents/superviseur/:id
router.get('/superviseur/:id', authenticate, hasPermission('voir_incidents'), (req, res) => {
    try {
        const superviseurId = parseInt(req.params.id);
        const { statut, page = 1, limit = 20 } = req.query;
        const db = getDb();

        const superviseur = db.prepare('SELECT id, utilisateur_id FROM superviseurs WHERE id = ?').get(superviseurId);
        if (!superviseur) return res.status(404).json({ success: false, message: 'Superviseur non trouvé' });

        if (req.userRole === 'superviseur' && superviseur.utilisateur_id !== req.userId) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        let conditions = ['superviseur_id = ?'];
        let params = [superviseurId];
        if (statut) { conditions.push('statut = ?'); params.push(statut); }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const incidents = db.prepare(`
            SELECT i.*,
                   u_target.nom as user_nom, u_target.prenom as user_prenom, u_target.role as user_role,
                   t.matricule as technicien_matricule
            FROM incidents i
            LEFT JOIN utilisateurs u_target ON i.user_id = u_target.id
            LEFT JOIN techniciens t ON i.technicien_id = t.id
            ${whereClause}
            ORDER BY i.severite DESC, i.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        const total = db.prepare(`SELECT COUNT(*) as count FROM incidents ${whereClause}`).get(...params);
        return res.json({ success: true, data: incidents, pagination: { page: parseInt(page), limit: parseInt(limit), total: total.count, pages: Math.ceil(total.count / parseInt(limit)) } });
    } catch (error) {
        console.error('❌ Erreur incidents superviseur:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// GET /incidents - LISTE
router.get('/', authenticate, hasPermission('voir_incidents'), (req, res) => {
    try {
        const db = getDb();
        const { statut, severite, type_incident, technicien_id, user_id, superviseur_id, zone, date_debut, date_fin, page = 1, limit = 50 } = req.query;

        let conditions = [];
        let params = [];

        if (req.userRole === 'technicien') {
            const tech = db.prepare('SELECT id FROM techniciens WHERE utilisateur_id = ?').get(req.userId);
            if (tech) { conditions.push('i.technicien_id = ?'); params.push(tech.id); }
        } else if (req.userRole === 'superviseur') {
            const sup = db.prepare('SELECT id FROM superviseurs WHERE utilisateur_id = ?').get(req.userId);
            if (sup) { conditions.push('i.superviseur_id = ?'); params.push(sup.id); }
        }

        if (statut) { conditions.push('i.statut = ?'); params.push(statut); }
        if (severite) { conditions.push('i.severite = ?'); params.push(severite); }
        if (type_incident) { conditions.push('i.type_incident = ?'); params.push(type_incident); }
        if (technicien_id && req.userRole !== 'technicien') { conditions.push('i.technicien_id = ?'); params.push(parseInt(technicien_id)); }
        // 🎯 FILTRE user_id
        if (user_id && req.userRole !== 'technicien') { conditions.push('i.user_id = ?'); params.push(parseInt(user_id)); }
        if (superviseur_id) { conditions.push('i.superviseur_id = ?'); params.push(parseInt(superviseur_id)); }
        if (zone) { conditions.push('i.zone LIKE ?'); params.push(`%${zone}%`); }
        if (date_debut) { conditions.push('i.date_incident >= ?'); params.push(date_debut); }
        if (date_fin) { conditions.push('i.date_incident <= ?'); params.push(date_fin); }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const incidents = db.prepare(`
            SELECT
                i.*,
                u_target.nom as user_nom,
                u_target.prenom as user_prenom,
                u_target.email as user_email,
                u_target.role as user_role,
                t.id as technicien_id,
                t.matricule as technicien_matricule,
                t.specialite as technicien_specialite,
                u_tech.nom as technicien_nom,
                u_tech.prenom as technicien_prenom,
                s.id as superviseur_id,
                s.zone_responsable as superviseur_zone,
                u_sup.nom as superviseur_nom,
                u_sup.prenom as superviseur_prenom,
                r.titre as rapport_titre,
                r.id as rapport_id
            FROM incidents i
            LEFT JOIN utilisateurs u_target ON i.user_id = u_target.id
            LEFT JOIN techniciens t ON i.technicien_id = t.id
            LEFT JOIN utilisateurs u_tech ON t.utilisateur_id = u_tech.id
            LEFT JOIN superviseurs s ON i.superviseur_id = s.id
            LEFT JOIN utilisateurs u_sup ON s.utilisateur_id = u_sup.id
            LEFT JOIN rapports r ON i.rapport_id = r.id
            ${whereClause}
            ORDER BY i.severite DESC, i.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        const total = db.prepare(`SELECT COUNT(*) as count FROM incidents i ${whereClause}`).get(...params);

        return res.json({
            success: true,
            data: incidents,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total?.count || 0,
                pages: Math.ceil((total?.count || 0) / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('❌ Erreur liste incidents:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// GET /incidents/:id - DÉTAILS
router.get('/:id', authenticate, hasPermission('voir_incidents'), (req, res) => {
    try {
        const db = getDb();
        const incidentId = parseInt(req.params.id);

        const incident = db.prepare(`
            SELECT i.*,
                   u_target.nom as user_nom, u_target.prenom as user_prenom, u_target.email as user_email, u_target.role as user_role,
                   t.id as technicien_id, t.matricule as technicien_matricule, t.specialite as technicien_specialite, t.zone_intervention as technicien_zone,
                   u_tech.nom as technicien_nom, u_tech.prenom as technicien_prenom, u_tech.email as technicien_email, u_tech.telephone as technicien_telephone,
                   s.id as superviseur_id, s.zone_responsable as superviseur_zone,
                   u_sup.nom as superviseur_nom, u_sup.prenom as superviseur_prenom, u_sup.email as superviseur_email,
                   r.titre as rapport_titre, r.id as rapport_id, r.description as rapport_description
            FROM incidents i
            LEFT JOIN utilisateurs u_target ON i.user_id = u_target.id
            LEFT JOIN techniciens t ON i.technicien_id = t.id
            LEFT JOIN utilisateurs u_tech ON t.utilisateur_id = u_tech.id
            LEFT JOIN superviseurs s ON i.superviseur_id = s.id
            LEFT JOIN utilisateurs u_sup ON s.utilisateur_id = u_sup.id
            LEFT JOIN rapports r ON i.rapport_id = r.id
            WHERE i.id = ?
        `).get(incidentId);

        if (!incident) return res.status(404).json({ success: false, message: 'Incident non trouvé' });

        if (req.userRole === 'technicien') {
            const tech = db.prepare('SELECT id FROM techniciens WHERE utilisateur_id = ?').get(req.userId);
            if (tech && incident.technicien_id !== tech.id && incident.user_id !== req.userId) {
                return res.status(403).json({ success: false, message: 'Accès refusé' });
            }
        } else if (req.userRole === 'superviseur') {
            const sup = db.prepare('SELECT id FROM superviseurs WHERE utilisateur_id = ?').get(req.userId);
            if (sup && incident.superviseur_id !== sup.id) return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        const historique = db.prepare("SELECT action, details, created_at FROM historique_actions WHERE table_concerned = 'incidents' AND enregistrement_id = ? ORDER BY created_at DESC LIMIT 20").all(incidentId);

        return res.json({ success: true, data: { ...incident, historique } });
    } catch (error) {
        console.error('❌ Erreur détail incident:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// POST /incidents - CRÉER UN INCIDENT
// 🎯 Accepte user_id OU technicien_id
// ========================================================
router.post('/', authenticate, hasPermission('creer_incident'), (req, res) => {
    try {
        const {
            technicien_id,
            user_id,           // 🎯 NOUVEAU
            rapport_id,
            titre,
            description,
            type_incident,
            severite,
            zone,
            latitude,
            longitude,
            client_appele,
            solution_apportee
        } = req.body;

        if (!titre || !description) {
            return res.status(400).json({ success: false, message: 'Titre et description sont requis' });
        }

        if (type_incident && !TYPES_INCIDENT.includes(type_incident)) {
            return res.status(400).json({ success: false, message: `Type d'incident invalide` });
        }
        if (severite && !SEVERITES.includes(severite)) {
            return res.status(400).json({ success: false, message: 'Sévérité invalide' });
        }

        const db = getDb();

        // 🎯 Déterminer l'utilisateur cible
        let finalUserId = null;
        let finalTechnicienId = null;

        if (user_id) {
            const resolved = resolveUserTarget(db, parseInt(user_id));
            if (!resolved.exists) {
                return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
            }
            finalUserId = resolved.user_id;
            finalTechnicienId = resolved.technicien_id;
        } else if (technicien_id) {
            const tech = db.prepare('SELECT id, utilisateur_id FROM techniciens WHERE id = ?').get(parseInt(technicien_id));
            if (tech) {
                finalTechnicienId = tech.id;
                finalUserId = tech.utilisateur_id;
            } else {
                // Rétrocompatibilité : technicien_id peut être un user_id
                const user = db.prepare('SELECT id, role FROM utilisateurs WHERE id = ?').get(parseInt(technicien_id));
                if (user) {
                    finalUserId = user.id;
                    if (user.role === 'technicien') {
                        const t = db.prepare('SELECT id FROM techniciens WHERE utilisateur_id = ?').get(user.id);
                        if (t) finalTechnicienId = t.id;
                    }
                }
            }
        }

        // Si c'est un technicien connecté, forcer son ID
        if (req.userRole === 'technicien') {
            const tech = db.prepare('SELECT id, utilisateur_id FROM techniciens WHERE utilisateur_id = ?').get(req.userId);
            if (tech) {
                finalTechnicienId = tech.id;
                finalUserId = tech.utilisateur_id;
            } else {
                finalUserId = req.userId;
            }
        }

        // Récupérer le superviseur connecté
        let superviseurId = null;
        if (req.userRole === 'superviseur') {
            const sup = db.prepare('SELECT id FROM superviseurs WHERE utilisateur_id = ?').get(req.userId);
            if (sup) superviseurId = sup.id;
        }

        // Insertion (avec user_id si disponible)
        const permCols = db.prepare("PRAGMA table_info(incidents)").all().map(c => c.name);
        const hasUserId = permCols.includes('user_id');

        let result;
        if (hasUserId) {
            result = db.prepare(`
                INSERT INTO incidents (
                    user_id, technicien_id, rapport_id, superviseur_id,
                    titre, description, type_incident, severite, statut,
                    zone, latitude, longitude, client_appele, solution_apportee
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ouvert', ?, ?, ?, ?, ?)
            `).run(
                finalUserId,
                finalTechnicienId,
                rapport_id || null,
                superviseurId,
                titre.trim(),
                description.trim(),
                type_incident || 'autre',
                severite || 'moyenne',
                zone || null,
                latitude ? parseFloat(latitude) : null,
                longitude ? parseFloat(longitude) : null,
                client_appele ? parseInt(client_appele) : 0,
                solution_apportee || null
            );
        } else {
            // Fallback sans user_id
            result = db.prepare(`
                INSERT INTO incidents (
                    technicien_id, rapport_id, superviseur_id,
                    titre, description, type_incident, severite, statut,
                    zone, latitude, longitude, client_appele, solution_apportee
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ouvert', ?, ?, ?, ?, ?)
            `).run(
                finalTechnicienId,
                rapport_id || null,
                superviseurId,
                titre.trim(),
                description.trim(),
                type_incident || 'autre',
                severite || 'moyenne',
                zone || null,
                latitude ? parseFloat(latitude) : null,
                longitude ? parseFloat(longitude) : null,
                client_appele ? parseInt(client_appele) : 0,
                solution_apportee || null
            );
        }

        const incidentId = result.lastInsertRowid;

        // Notifications
        const messages = {
            'critique': '🚨 Incident CRITIQUE signalé',
            'elevee': '⚠️ Incident HAUTE priorité signalé',
            'moyenne': '📢 Incident signalé',
            'faible': 'ℹ️ Incident signalé'
        };
        const insertNotif = db.prepare(`INSERT INTO notifications (utilisateur_id, type, titre, message, donnees) VALUES (?, 'incident', ?, ?, ?)`);

        const superviseurs = db.prepare('SELECT utilisateur_id FROM superviseurs').all();
        superviseurs.forEach(sup => {
            if (sup.utilisateur_id) insertNotif.run(sup.utilisateur_id, messages[severite] || '📢 Incident signalé', `Incident "${titre}" signalé`, JSON.stringify({ incidentId, titre, severite }));
        });

        if (severite === 'critique' || severite === 'elevee') {
            const admins = db.prepare('SELECT id FROM utilisateurs WHERE role = "admin"').all();
            admins.forEach(a => insertNotif.run(a.id, `🚨 Incident ${severite.toUpperCase()}`, `Incident "${titre}" nécessite votre attention`, JSON.stringify({ incidentId, titre, severite })));
        }

        logUserAction(req, 'CREATION_INCIDENT', { table: 'incidents', recordId: incidentId, titre, severite, user_id: finalUserId });
        return res.status(201).json({ success: true, message: 'Incident créé', id: incidentId });
    } catch (error) {
        console.error('❌ Erreur création incident:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// PUT /incidents/:id - MODIFIER UN INCIDENT
// ========================================================
router.put('/:id', authenticate, async (req, res, next) => {
    try {
        const incidentId = parseInt(req.params.id);
        const db = getDb();

        const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId);
        if (!incident) {
            return res.status(404).json({ success: false, message: 'Incident non trouvé' });
        }

        const userRole = req.user.role;
        const isTechnicienRole = userRole === 'technicien';
        const isSuperviseurRole = userRole === 'superviseur';
        const isAdminRole = userRole === 'admin' || userRole === 'dj';

        if (isTechnicienRole) {
            const tech = db.prepare('SELECT id FROM techniciens WHERE utilisateur_id = ?').get(req.userId);
            if (tech && incident.technicien_id !== tech.id && incident.user_id !== req.userId) {
                return res.status(403).json({ success: false, message: 'Accès refusé' });
            }
            return next();
        }

        if (isAdminRole) {
            return next();
        }

        if (isSuperviseurRole) {
            const hasPerm = db.prepare(`
                SELECT id FROM permissions
                WHERE superviseur_id = (SELECT id FROM superviseurs WHERE utilisateur_id = ?)
                AND type_permission = 'modifier_incident'
                AND est_valide = 1
            `).get(req.userId);
            if (!hasPerm) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission manquante pour modifier un incident',
                    code: 'PERMISSION_MISSING'
                });
            }
            return next();
        }

        return res.status(403).json({ success: false, message: 'Accès refusé' });
    } catch (error) {
        console.error('❌ Erreur vérification modification incident:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
}, (req, res) => {
    try {
        const incidentId = parseInt(req.params.id);
        const { titre, description, type_incident, severite, zone, latitude, longitude, client_appele, solution_apportee } = req.body;
        const db = getDb();

        const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId);
        if (!incident) return res.status(404).json({ success: false, message: 'Incident non trouvé' });
        if (incident.statut === 'ferme') return res.status(400).json({ success: false, message: 'Impossible de modifier un incident fermé' });

        db.prepare(`
            UPDATE incidents SET titre = COALESCE(?, titre), description = COALESCE(?, description),
            type_incident = COALESCE(?, type_incident), severite = COALESCE(?, severite),
            zone = COALESCE(?, zone), latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude),
            client_appele = COALESCE(?, client_appele), solution_apportee = COALESCE(?, solution_apportee),
            updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(
            titre || null, description || null, type_incident || null, severite || null, zone || null,
            latitude ? parseFloat(latitude) : null, longitude ? parseFloat(longitude) : null,
            client_appele !== undefined ? parseInt(client_appele) : null, solution_apportee || null, incidentId
        );
        logUserAction(req, 'MODIFICATION_INCIDENT', { table: 'incidents', recordId: incidentId, titre: titre || incident.titre });
        return res.json({ success: true, message: 'Incident modifié' });
    } catch (error) {
        console.error('❌ Erreur modification incident:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// DELETE /incidents/:id
// ========================================================
router.delete('/:id', authenticate, hasPermission('supprimer_incident'), isSuperviseurOrAdmin, (req, res) => {
    try {
        const incidentId = parseInt(req.params.id);
        const db = getDb();
        const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId);
        if (!incident) return res.status(404).json({ success: false, message: 'Incident non trouvé' });
        db.prepare('DELETE FROM incidents WHERE id = ?').run(incidentId);
        logUserAction(req, 'SUPPRESSION_INCIDENT', { table: 'incidents', recordId: incidentId, titre: incident.titre });
        return res.json({ success: true, message: 'Incident supprimé' });
    } catch (error) {
        console.error('❌ Erreur suppression incident:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// PATCH /incidents/:id/statut
// ========================================================
router.patch('/:id/statut', authenticate, hasPermission('modifier_incident'), isSuperviseurOrAdmin, (req, res) => {
    try {
        const incidentId = parseInt(req.params.id);
        const { statut } = req.body;
        if (!statut || !STATUTS_INCIDENT.includes(statut)) return res.status(400).json({ success: false, message: 'Statut invalide' });
        const db = getDb();
        const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId);
        if (!incident) return res.status(404).json({ success: false, message: 'Incident non trouvé' });

        let dateResolution = incident.date_resolution;
        if (statut === 'resolu' || statut === 'ferme') dateResolution = new Date().toISOString();

        db.prepare('UPDATE incidents SET statut = ?, date_resolution = COALESCE(?, date_resolution), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(statut, dateResolution, incidentId);

        // 🎯 Notifier l'utilisateur concerné (user_id en priorité)
        try {
            let targetUserId = incident.user_id;
            if (!targetUserId && incident.technicien_id) {
                const techUser = db.prepare('SELECT utilisateur_id FROM techniciens WHERE id = ?').get(incident.technicien_id);
                if (techUser) targetUserId = techUser.utilisateur_id;
            }
            if (targetUserId) {
                const messages = {
                    'en_cours': "🔄 L'incident est en cours de traitement",
                    'resolu': "✅ L'incident a été résolu",
                    'ferme': "🔒 L'incident a été fermé",
                    'ouvert': "📢 L'incident a été réouvert"
                };
                db.prepare(`INSERT INTO notifications (utilisateur_id, type, titre, message, donnees) VALUES (?, 'incident', ?, ?, ?)`)
                    .run(targetUserId, `Mise à jour incident`, `${messages[statut] || 'Statut modifié'}: ${incident.titre}`, JSON.stringify({ incidentId, statut, titre: incident.titre }));
            }
        } catch (e) { console.warn('⚠️ Notification échouée:', e.message); }

        logUserAction(req, 'CHANGEMENT_STATUT_INCIDENT', { table: 'incidents', recordId: incidentId, ancien_statut: incident.statut, nouveau_statut: statut, titre: incident.titre });
        return res.json({ success: true, message: `Statut mis à jour : ${statut}` });
    } catch (error) {
        console.error('❌ Erreur changement statut:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// PATCH /incidents/:id/resoudre
// ========================================================
router.patch('/:id/resoudre', authenticate, hasPermission('resoudre_incident'), isSuperviseurOrAdmin, (req, res) => {
    try {
        const incidentId = parseInt(req.params.id);
        const { solution_apportee } = req.body;
        const db = getDb();
        const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId);
        if (!incident) return res.status(404).json({ success: false, message: 'Incident non trouvé' });
        if (incident.statut === 'resolu' || incident.statut === 'ferme') return res.status(400).json({ success: false, message: `L'incident est déjà ${incident.statut}` });

        db.prepare(`UPDATE incidents SET statut = 'resolu', date_resolution = CURRENT_TIMESTAMP, solution_apportee = COALESCE(?, solution_apportee), updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(solution_apportee || null, incidentId);

        // Notifier
        try {
            let targetUserId = incident.user_id;
            if (!targetUserId && incident.technicien_id) {
                const techUser = db.prepare('SELECT utilisateur_id FROM techniciens WHERE id = ?').get(incident.technicien_id);
                if (techUser) targetUserId = techUser.utilisateur_id;
            }
            if (targetUserId) {
                db.prepare(`INSERT INTO notifications (utilisateur_id, type, titre, message, donnees) VALUES (?, 'incident', '✅ Incident résolu', ?, ?)`)
                    .run(targetUserId, `L'incident "${incident.titre}" a été résolu`, JSON.stringify({ incidentId, titre: incident.titre }));
            }
        } catch (e) { console.warn('⚠️ Notification échouée:', e.message); }

        logUserAction(req, 'RESOLUTION_INCIDENT', { table: 'incidents', recordId: incidentId, titre: incident.titre });
        return res.json({ success: true, message: 'Incident résolu' });
    } catch (error) {
        console.error('❌ Erreur résolution incident:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// PATCH /incidents/:id/assigner
// ========================================================
router.patch('/:id/assigner', authenticate, hasPermission('modifier_incident'), isSuperviseurOrAdmin, (req, res) => {
    try {
        const incidentId = parseInt(req.params.id);
        const { technicien_id, user_id } = req.body;
        if (!technicien_id && !user_id) return res.status(400).json({ success: false, message: 'ID du technicien ou utilisateur requis' });
        const db = getDb();
        const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId);
        if (!incident) return res.status(404).json({ success: false, message: 'Incident non trouvé' });

        let finalTechId = technicien_id;
        let finalUserId = user_id;

        if (user_id && !technicien_id) {
            const resolved = resolveUserTarget(db, parseInt(user_id));
            finalTechId = resolved.technicien_id;
            finalUserId = resolved.user_id;
        } else if (technicien_id) {
            const tech = db.prepare('SELECT id, utilisateur_id FROM techniciens WHERE id = ?').get(technicien_id);
            if (tech) {
                finalUserId = tech.utilisateur_id;
            }
        }

        if (finalTechId) {
            const tech = db.prepare('SELECT id FROM techniciens WHERE id = ?').get(finalTechId);
            if (!tech) return res.status(404).json({ success: false, message: 'Technicien non trouvé' });
        }

        const supId = req.userRole === 'superviseur'
            ? db.prepare('SELECT id FROM superviseurs WHERE utilisateur_id = ?').get(req.userId)?.id
            : null;

        // Update dynamique selon colonnes disponibles
        const cols = db.prepare("PRAGMA table_info(incidents)").all().map(c => c.name);
        const hasUserId = cols.includes('user_id');

        if (hasUserId) {
            db.prepare('UPDATE incidents SET technicien_id = ?, user_id = COALESCE(?, user_id), superviseur_id = COALESCE(?, superviseur_id), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(finalTechId || null, finalUserId || null, supId, incidentId);
        } else {
            db.prepare('UPDATE incidents SET technicien_id = ?, superviseur_id = COALESCE(?, superviseur_id), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(finalTechId || null, supId, incidentId);
        }

        // Notifier
        try {
            if (finalUserId) {
                db.prepare(`INSERT INTO notifications (utilisateur_id, type, titre, message, donnees) VALUES (?, 'incident', '📋 Incident assigné', ?, ?)`)
                    .run(finalUserId, `Vous avez été assigné à l'incident: ${incident.titre}`, JSON.stringify({ incidentId, titre: incident.titre }));
            }
        } catch (e) { console.warn('⚠️ Notification échouée:', e.message); }

        logUserAction(req, 'ASSIGNATION_INCIDENT', { table: 'incidents', recordId: incidentId, technicien_id: finalTechId, user_id: finalUserId, titre: incident.titre });
        return res.json({ success: true, message: 'Utilisateur assigné' });
    } catch (error) {
        console.error('❌ Erreur assignation:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

module.exports = router;