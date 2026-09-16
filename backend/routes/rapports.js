const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db/database');
const {
    authenticate,
    isTechnicien,
    isSuperviseur,
    isAdminOrDJ,
    isOwner,
    isSuperviseurOrAdmin,
    hasPermission,
    logUserAction
} = require('../middleware/auth');

// ========================================================
// CONFIGURATION MULTER
// ========================================================

const uploadDir = path.join(__dirname, '../uploads/rapports');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `rapport-${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Format de fichier non supporté. Utilisez JPEG, PNG, GIF ou WEBP.'), false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024, files: 10 },
    fileFilter
});

// ========================================================
// CONSTANTES
// ========================================================

const STATUTS_RAPPORT = ['brouillon', 'soumis', 'approuve', 'rejete'];
const TYPES_INTERVENTION = ['preventive', 'corrective', 'urgente'];

// ========================================================
// FONCTIONS UTILITAIRES
// ========================================================

function hasUserIdColumn(db) {
    try {
        const cols = db.prepare("PRAGMA table_info(rapports)").all().map(c => c.name);
        return cols.includes('user_id');
    } catch (e) {
        return false;
    }
}

function resolveUserTarget(db, userId) {
    if (!userId) return { user_id: null, technicien_id: null, role: null, exists: false };

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

    return {
        user_id: userId,
        technicien_id: null,
        role,
        exists: true,
    };
}

// ========================================================
// GET /rapports/recherche
// ========================================================

router.get('/recherche', authenticate, (req, res) => {
    try {
        const { q, limit = 20 } = req.query;
        if (!q || q.length < 2) return res.status(400).json({ success: false, message: 'Recherche trop courte' });
        const db = getDb();
        const hasUser = hasUserIdColumn(db);

        let query = hasUser
            ? `
                SELECT r.id, r.titre, r.description, r.statut, r.date_intervention, r.created_at,
                       u_target.nom as user_nom, u_target.prenom as user_prenom, u_target.role as user_role,
                       m.titre as mission_titre
                FROM rapports r
                LEFT JOIN utilisateurs u_target ON r.user_id = u_target.id
                LEFT JOIN missions m ON r.mission_id = m.id
                WHERE r.titre LIKE ? OR r.description LIKE ? OR r.adresse LIKE ?
            `
            : `
                SELECT r.id, r.titre, r.description, r.statut, r.date_intervention, r.created_at,
                       t.matricule as technicien_matricule, u.nom as technicien_nom, u.prenom as technicien_prenom,
                       m.titre as mission_titre
                FROM rapports r
                LEFT JOIN techniciens t ON r.technicien_id = t.id
                LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
                LEFT JOIN missions m ON r.mission_id = m.id
                WHERE r.titre LIKE ? OR r.description LIKE ? OR r.adresse LIKE ?
            `;

        const params = [`%${q}%`, `%${q}%`, `%${q}%`];

        if (req.userRole === 'technicien') {
            const tech = db.prepare('SELECT id FROM techniciens WHERE utilisateur_id = ?').get(req.userId);
            if (tech) {
                query += ' AND r.technicien_id = ?';
                params.push(tech.id);
            }
        } else if (req.userRole === 'superviseur') {
            const sup = db.prepare('SELECT id, zone_responsable FROM superviseurs WHERE utilisateur_id = ?').get(req.userId);
            if (sup) {
                query += ` AND (r.technicien_id IN (SELECT id FROM techniciens WHERE zone_intervention = ?) OR r.mission_id IN (SELECT id FROM missions WHERE superviseur_id = ?))`;
                params.push(sup.zone_responsable, sup.id);
            }
        }

        query += ' ORDER BY r.created_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const rapports = db.prepare(query).all(...params);
        return res.json({ success: true, data: rapports });
    } catch (error) {
        console.error('❌ Erreur recherche rapports:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// GET /rapports/statistiques
// ========================================================

router.get('/statistiques', authenticate, isSuperviseurOrAdmin, (req, res) => {
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

        const total = safeGet('SELECT COUNT(*) as count FROM rapports');
        const brouillons = safeGet('SELECT COUNT(*) as count FROM rapports WHERE statut = ?', ['brouillon']);
        const soumis = safeGet('SELECT COUNT(*) as count FROM rapports WHERE statut = ?', ['soumis']);
        const approuves = safeGet('SELECT COUNT(*) as count FROM rapports WHERE statut = ?', ['approuve']);
        const rejetes = safeGet('SELECT COUNT(*) as count FROM rapports WHERE statut = ?', ['rejete']);
        const parType = safeAll('SELECT type_intervention, COUNT(*) as count FROM rapports WHERE type_intervention IS NOT NULL GROUP BY type_intervention');
        const parMois = safeAll(`SELECT strftime('%Y-%m', created_at) as mois, COUNT(*) as count FROM rapports WHERE created_at >= date('now', '-12 months') GROUP BY strftime('%Y-%m', created_at) ORDER BY mois DESC`);
        const tempsMoyen = (() => {
            try {
                const r = db.prepare("SELECT AVG(julianday(updated_at) - julianday(created_at)) as jours FROM rapports WHERE statut = 'approuve' AND updated_at IS NOT NULL").get();
                return r && r.jours ? Math.round(r.jours) + ' jours' : 'N/A';
            } catch (e) { return 'N/A'; }
        })();

        const hasUser = hasUserIdColumn(db);
        const topUtilisateurs = hasUser
            ? safeAll(`
                SELECT u.nom, u.prenom, u.role, COUNT(r.id) as rapports_count,
                       SUM(CASE WHEN r.statut = 'approuve' THEN 1 ELSE 0 END) as approuves
                FROM rapports r
                LEFT JOIN utilisateurs u ON r.user_id = u.id
                WHERE r.user_id IS NOT NULL
                GROUP BY r.user_id
                ORDER BY rapports_count DESC LIMIT 10
            `)
            : safeAll(`
                SELECT u.nom, u.prenom, 'technicien' as role, COUNT(r.id) as rapports_count,
                       SUM(CASE WHEN r.statut = 'approuve' THEN 1 ELSE 0 END) as approuves
                FROM rapports r
                LEFT JOIN techniciens t ON r.technicien_id = t.id
                LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
                WHERE r.technicien_id IS NOT NULL
                GROUP BY r.technicien_id
                ORDER BY rapports_count DESC LIMIT 10
            `);

        const photosStats = safeGet(`
            SELECT COUNT(DISTINCT r.id) as rapports_avec_photos, COUNT(p.id) as total_photos,
                   AVG(p_count) as moyenne_photos
            FROM rapports r
            LEFT JOIN (SELECT rapport_id, COUNT(*) as p_count FROM photos_rapport GROUP BY rapport_id) p ON r.id = p.rapport_id
        `);

        return res.json({
            success: true,
            statistiques: {
                global: {
                    total, brouillons, soumis, approuves, rejetes,
                    taux_approbation: total > 0 ? ((approuves / total) * 100).toFixed(1) + '%' : '0%'
                },
                par_type_intervention: parType,
                par_mois: parMois,
                top_utilisateurs: topUtilisateurs,
                temps_moyen_traitement: tempsMoyen,
                photos: {
                    total: photosStats.total_photos || 0,
                    rapports_avec_photos: photosStats.rapports_avec_photos || 0,
                    moyenne_photos_par_rapport: photosStats.moyenne_photos ? Number(photosStats.moyenne_photos).toFixed(1) : '0.0'
                }
            }
        });
    } catch (error) {
        console.error('❌ Erreur statistiques rapports:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// GET /rapports/technicien/:id
// ========================================================

router.get('/technicien/:id', authenticate, (req, res) => {
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

        const rapports = db.prepare(`
            SELECT r.*, m.titre as mission_titre
            FROM rapports r
            LEFT JOIN missions m ON r.mission_id = m.id
            ${whereClause}
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        const total = db.prepare(`SELECT COUNT(*) as count FROM rapports ${whereClause}`).get(...params);
        return res.json({ success: true, data: rapports, pagination: { page: parseInt(page), limit: parseInt(limit), total: total.count, pages: Math.ceil(total.count / parseInt(limit)) } });
    } catch (error) {
        console.error('❌ Erreur rapports technicien:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// GET /rapports/mission/:id
// ========================================================

router.get('/mission/:id', authenticate, (req, res) => {
    try {
        const missionId = parseInt(req.params.id);
        const { page = 1, limit = 20 } = req.query;
        const db = getDb();
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const hasUser = hasUserIdColumn(db);

        const rapports = hasUser
            ? db.prepare(`
                SELECT r.*, u_target.nom as user_nom, u_target.prenom as user_prenom, u_target.role as user_role
                FROM rapports r
                LEFT JOIN utilisateurs u_target ON r.user_id = u_target.id
                WHERE r.mission_id = ?
                ORDER BY r.created_at DESC
                LIMIT ? OFFSET ?
            `).all(missionId, parseInt(limit), offset)
            : db.prepare(`
                SELECT r.*, t.matricule as technicien_matricule, u.nom as technicien_nom, u.prenom as technicien_prenom
                FROM rapports r
                LEFT JOIN techniciens t ON r.technicien_id = t.id
                LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
                WHERE r.mission_id = ?
                ORDER BY r.created_at DESC
                LIMIT ? OFFSET ?
            `).all(missionId, parseInt(limit), offset);

        const total = db.prepare('SELECT COUNT(*) as count FROM rapports WHERE mission_id = ?').get(missionId);
        return res.json({ success: true, data: rapports, pagination: { page: parseInt(page), limit: parseInt(limit), total: total.count, pages: Math.ceil(total.count / parseInt(limit)) } });
    } catch (error) {
        console.error('❌ Erreur rapports mission:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// GET /rapports/statut/:statut
// ========================================================

router.get('/statut/:statut', authenticate, isSuperviseurOrAdmin, (req, res) => {
    try {
        const { statut } = req.params;
        if (!STATUTS_RAPPORT.includes(statut)) return res.status(400).json({ success: false, message: 'Statut invalide' });
        const db = getDb();
        const { page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const hasUser = hasUserIdColumn(db);

        const rapports = hasUser
            ? db.prepare(`
                SELECT r.*, u_target.nom as user_nom, u_target.prenom as user_prenom, u_target.role as user_role, m.titre as mission_titre
                FROM rapports r
                LEFT JOIN utilisateurs u_target ON r.user_id = u_target.id
                LEFT JOIN missions m ON r.mission_id = m.id
                WHERE r.statut = ?
                ORDER BY r.created_at DESC
                LIMIT ? OFFSET ?
            `).all(statut, parseInt(limit), offset)
            : db.prepare(`
                SELECT r.*, t.matricule as technicien_matricule, u.nom as technicien_nom, u.prenom as technicien_prenom, m.titre as mission_titre
                FROM rapports r
                LEFT JOIN techniciens t ON r.technicien_id = t.id
                LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
                LEFT JOIN missions m ON r.mission_id = m.id
                WHERE r.statut = ?
                ORDER BY r.created_at DESC
                LIMIT ? OFFSET ?
            `).all(statut, parseInt(limit), offset);

        const total = db.prepare('SELECT COUNT(*) as count FROM rapports WHERE statut = ?').get(statut);
        return res.json({ success: true, data: rapports, pagination: { page: parseInt(page), limit: parseInt(limit), total: total.count, pages: Math.ceil(total.count / parseInt(limit)) } });
    } catch (error) {
        console.error('❌ Erreur rapports par statut:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// GET /rapports - LISTE
// ========================================================

router.get('/', authenticate, (req, res) => {
    try {
        const db = getDb();
        const { statut, technicien_id, user_id, mission_id, date_debut, date_fin, page = 1, limit = 50 } = req.query;
        const hasUser = hasUserIdColumn(db);

        let conditions = [];
        let params = [];

        if (req.userRole === 'technicien') {
            const tech = db.prepare('SELECT id FROM techniciens WHERE utilisateur_id = ?').get(req.userId);
            if (tech) { conditions.push('r.technicien_id = ?'); params.push(tech.id); }
        } else if (req.userRole === 'superviseur') {
            const sup = db.prepare('SELECT id, zone_responsable FROM superviseurs WHERE utilisateur_id = ?').get(req.userId);
            if (sup) {
                conditions.push('(r.technicien_id IN (SELECT id FROM techniciens WHERE zone_intervention = ?) OR r.mission_id IN (SELECT id FROM missions WHERE superviseur_id = ?))');
                params.push(sup.zone_responsable, sup.id);
            }
        }

        if (statut) { conditions.push('r.statut = ?'); params.push(statut); }
        if (technicien_id && req.userRole !== 'technicien') { conditions.push('r.technicien_id = ?'); params.push(parseInt(technicien_id)); }
        if (user_id && req.userRole !== 'technicien' && hasUser) {
            conditions.push('r.user_id = ?');
            params.push(parseInt(user_id));
        }
        if (mission_id) { conditions.push('r.mission_id = ?'); params.push(parseInt(mission_id)); }
        if (date_debut) { conditions.push('r.date_intervention >= ?'); params.push(date_debut); }
        if (date_fin) { conditions.push('r.date_intervention <= ?'); params.push(date_fin); }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const query = hasUser
            ? `
                SELECT r.*,
                       u_target.nom as user_nom,
                       u_target.prenom as user_prenom,
                       u_target.email as user_email,
                       u_target.role as user_role,
                       u_target.nom as technicien_nom,
                       u_target.prenom as technicien_prenom,
                       u_target.email as technicien_email,
                       m.titre as mission_titre,
                       m.id as mission_id,
                       m.date_debut as mission_date_debut
                FROM rapports r
                LEFT JOIN utilisateurs u_target ON r.user_id = u_target.id
                LEFT JOIN missions m ON r.mission_id = m.id
                ${whereClause}
                ORDER BY r.created_at DESC
                LIMIT ? OFFSET ?
            `
            : `
                SELECT r.*,
                       t.matricule as technicien_matricule,
                       t.specialite as technicien_specialite,
                       u_tech.nom as technicien_nom,
                       u_tech.prenom as technicien_prenom,
                       u_tech.email as technicien_email,
                       u_tech.role as user_role,
                       m.titre as mission_titre,
                       m.id as mission_id,
                       m.date_debut as mission_date_debut
                FROM rapports r
                LEFT JOIN techniciens t ON r.technicien_id = t.id
                LEFT JOIN utilisateurs u_tech ON t.utilisateur_id = u_tech.id
                LEFT JOIN missions m ON r.mission_id = m.id
                ${whereClause}
                ORDER BY r.created_at DESC
                LIMIT ? OFFSET ?
            `;

        const rapports = db.prepare(query).all(...params, parseInt(limit), offset);

        const host = `${req.protocol || 'http'}://${req.get('host') || 'localhost:3000'}`;
        const rapportsWithPhotos = rapports.map(rapport => {
            const photos = db.prepare('SELECT id, nom_fichier, chemin, description, date_prise, created_at FROM photos_rapport WHERE rapport_id = ? ORDER BY created_at DESC').all(rapport.id);
            return {
                ...rapport,
                photos: photos.map(p => ({ ...p, url: `${host}/uploads/rapports/${p.chemin}` })),
                nombre_photos: photos.length
            };
        });

        const total = db.prepare(`SELECT COUNT(*) as count FROM rapports r ${whereClause}`).get(...params);

        return res.json({ success: true, data: rapportsWithPhotos, pagination: { page: parseInt(page), limit: parseInt(limit), total: total.count, pages: Math.ceil(total.count / parseInt(limit)) } });
    } catch (error) {
        console.error('❌ Erreur liste rapports:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// GET /rapports/:id - DÉTAILS
// ========================================================

router.get('/:id', authenticate, (req, res) => {
    try {
        const db = getDb();
        const rapportId = parseInt(req.params.id);
        const hasUser = hasUserIdColumn(db);

        const query = hasUser
            ? `
                SELECT r.*,
                       u_target.nom as user_nom, u_target.prenom as user_prenom,
                       u_target.email as user_email, u_target.role as user_role,
                       u_target.nom as technicien_nom, u_target.prenom as technicien_prenom,
                       u_target.email as technicien_email,
                       m.titre as mission_titre, m.description as mission_description, m.id as mission_id,
                       m.date_debut as mission_date_debut, m.date_fin_prevue as mission_date_fin_prevue, m.statut as mission_statut,
                       s.nom as superviseur_nom, s.prenom as superviseur_prenom
                FROM rapports r
                LEFT JOIN utilisateurs u_target ON r.user_id = u_target.id
                LEFT JOIN missions m ON r.mission_id = m.id
                LEFT JOIN superviseurs sup ON m.superviseur_id = sup.id
                LEFT JOIN utilisateurs s ON sup.utilisateur_id = s.id
                WHERE r.id = ?
            `
            : `
                SELECT r.*,
                       t.matricule as technicien_matricule, t.specialite as technicien_specialite, t.zone_intervention as technicien_zone,
                       u_tech.nom as technicien_nom, u_tech.prenom as technicien_prenom, u_tech.email as technicien_email, u_tech.telephone as technicien_telephone,
                       m.titre as mission_titre, m.description as mission_description, m.id as mission_id,
                       m.date_debut as mission_date_debut, m.date_fin_prevue as mission_date_fin_prevue, m.statut as mission_statut,
                       s.nom as superviseur_nom, s.prenom as superviseur_prenom
                FROM rapports r
                LEFT JOIN techniciens t ON r.technicien_id = t.id
                LEFT JOIN utilisateurs u_tech ON t.utilisateur_id = u_tech.id
                LEFT JOIN missions m ON r.mission_id = m.id
                LEFT JOIN superviseurs sup ON m.superviseur_id = sup.id
                LEFT JOIN utilisateurs s ON sup.utilisateur_id = s.id
                WHERE r.id = ?
            `;

        const rapport = db.prepare(query).get(rapportId);

        if (!rapport) return res.status(404).json({ success: false, message: 'Rapport non trouvé' });

        if (req.userRole === 'technicien') {
            const tech = db.prepare('SELECT id FROM techniciens WHERE utilisateur_id = ?').get(req.userId);
            const isOwner = tech && rapport.technicien_id === tech.id;
            const isUser = rapport.user_id === req.userId;
            if (!isOwner && !isUser) return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        const host = `${req.protocol || 'http'}://${req.get('host') || 'localhost:3000'}`;
        const photos = db.prepare('SELECT id, nom_fichier, chemin, description, date_prise, created_at FROM photos_rapport WHERE rapport_id = ? ORDER BY created_at DESC').all(rapportId);
        const incidents = db.prepare('SELECT id, titre, type_incident, severite, statut, created_at FROM incidents WHERE rapport_id = ? ORDER BY created_at DESC').all(rapportId);
        const historique = db.prepare("SELECT action, details, created_at FROM historique_actions WHERE table_concerned = 'rapports' AND enregistrement_id = ? ORDER BY created_at DESC LIMIT 20").all(rapportId);

        return res.json({
            success: true,
            data: {
                ...rapport,
                photos: photos.map(p => ({ ...p, url: `${host}/uploads/rapports/${p.chemin}` })),
                incidents,
                historique
            }
        });
    } catch (error) {
        console.error('❌ Erreur détail rapport:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// POST /rapports - CRÉER UN RAPPORT
// ========================================================

router.post('/', authenticate, hasPermission('creer_rapport'), upload.array('photos', 10), (req, res) => {
    try {
        const {
            technicien_id,
            user_id,
            mission_id,
            titre,
            description,
            solution,
            type_intervention,
            duree_intervention,
            latitude,
            longitude,
            adresse,
            date_intervention
        } = req.body;

        console.log('📥 [POST /rapports] Body:', { user_id, technicien_id, titre, mission_id });

        if (!titre || !description) {
            return res.status(400).json({ success: false, message: 'Titre et description sont requis' });
        }

        if (type_intervention && !TYPES_INTERVENTION.includes(type_intervention)) {
            return res.status(400).json({ success: false, message: `Type d'intervention invalide` });
        }

        const db = getDb();
        const hasUser = hasUserIdColumn(db);

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
                const user = db.prepare('SELECT id FROM utilisateurs WHERE id = ?').get(parseInt(technicien_id));
                if (user) finalUserId = user.id;
            }
        }

        if (req.userRole === 'technicien') {
            const tech = db.prepare('SELECT id, utilisateur_id FROM techniciens WHERE utilisateur_id = ?').get(req.userId);
            if (tech) {
                finalTechnicienId = tech.id;
                finalUserId = tech.utilisateur_id;
            } else {
                finalUserId = req.userId;
            }
        }

        if (!finalUserId && !finalTechnicienId) {
            return res.status(400).json({ success: false, message: 'Veuillez sélectionner un utilisateur' });
        }

        if (mission_id) {
            const mission = db.prepare('SELECT id FROM missions WHERE id = ?').get(mission_id);
            if (!mission) return res.status(404).json({ success: false, message: 'Mission non trouvée' });
        }

        let result;
        if (hasUser) {
            result = db.prepare(`
                INSERT INTO rapports (user_id, technicien_id, mission_id, titre, description, solution, statut, type_intervention, duree_intervention, latitude, longitude, adresse, date_intervention)
                VALUES (?, ?, ?, ?, ?, ?, 'soumis', ?, ?, ?, ?, ?, ?)
            `).run(
                finalUserId,
                finalTechnicienId,
                mission_id || null,
                titre.trim(),
                description.trim(),
                solution ? solution.trim() : null,
                type_intervention || null,
                duree_intervention ? parseInt(duree_intervention) : null,
                latitude ? parseFloat(latitude) : null,
                longitude ? parseFloat(longitude) : null,
                adresse ? adresse.trim() : null,
                date_intervention || new Date().toISOString().split('T')[0]
            );
        } else {
            const techIdToStore = finalTechnicienId || finalUserId;
            result = db.prepare(`
                INSERT INTO rapports (technicien_id, mission_id, titre, description, solution, statut, type_intervention, duree_intervention, latitude, longitude, adresse, date_intervention)
                VALUES (?, ?, ?, ?, ?, 'soumis', ?, ?, ?, ?, ?, ?)
            `).run(
                techIdToStore,
                mission_id || null,
                titre.trim(),
                description.trim(),
                solution ? solution.trim() : null,
                type_intervention || null,
                duree_intervention ? parseInt(duree_intervention) : null,
                latitude ? parseFloat(latitude) : null,
                longitude ? parseFloat(longitude) : null,
                adresse ? adresse.trim() : null,
                date_intervention || new Date().toISOString().split('T')[0]
            );
        }

        const rapportId = result.lastInsertRowid;

        if (req.files && req.files.length > 0) {
            const insertPhoto = db.prepare('INSERT INTO photos_rapport (rapport_id, nom_fichier, chemin, description) VALUES (?, ?, ?, ?)');
            req.files.forEach((file, index) => {
                const desc = req.body[`photo_description_${index}`] || null;
                insertPhoto.run(rapportId, file.originalname, file.filename, desc);
            });
        }

        const superviseurs = db.prepare('SELECT utilisateur_id FROM superviseurs').all();
        const insertNotif = db.prepare(`INSERT INTO notifications (utilisateur_id, type, titre, message, donnees) VALUES (?, 'rapport', '📄 Nouveau rapport', ?, ?)`);
        superviseurs.forEach(sup => {
            if (sup.utilisateur_id) insertNotif.run(sup.utilisateur_id, `Rapport "${titre}" soumis`, JSON.stringify({ rapportId, titre }));
        });

        logUserAction(req, 'CREATION_RAPPORT', { table: 'rapports', recordId: rapportId, titre, mission_id, user_id: finalUserId });

        console.log('✅ [POST /rapports] Créé id:', rapportId);

        return res.status(201).json({
            success: true,
            message: 'Rapport créé',
            id: rapportId,
            photos_uploaded: req.files ? req.files.length : 0
        });
    } catch (error) {
        console.error('❌ Erreur création rapport:', error);
        console.error('Stack:', error.stack);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur',
            ...(process.env.NODE_ENV !== 'production' && { error: error.message })
        });
    }
});

// ========================================================
// PUT /rapports/:id - MODIFIER
// ========================================================

router.put('/:id', authenticate, hasPermission('modifier_rapport'), upload.array('photos', 10), (req, res) => {
    try {
        const rapportId = parseInt(req.params.id);
        const { titre, description, solution, type_intervention, duree_intervention, latitude, longitude, adresse, date_intervention } = req.body;
        const db = getDb();

        const rapport = db.prepare('SELECT * FROM rapports WHERE id = ?').get(rapportId);
        if (!rapport) return res.status(404).json({ success: false, message: 'Rapport non trouvé' });
        if (rapport.statut === 'approuve' || rapport.statut === 'rejete') {
            return res.status(400).json({ success: false, message: `Impossible de modifier un rapport ${rapport.statut}` });
        }

        // Vérification propriétaire
        if (req.userRole === 'technicien') {
            const tech = db.prepare('SELECT id FROM techniciens WHERE utilisateur_id = ?').get(req.userId);
            const isOwner = tech && rapport.technicien_id === tech.id;
            const isUser = rapport.user_id === req.userId;
            if (!isOwner && !isUser) return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        db.prepare(`
            UPDATE rapports SET titre = COALESCE(?, titre), description = COALESCE(?, description), solution = COALESCE(?, solution),
            type_intervention = COALESCE(?, type_intervention), duree_intervention = COALESCE(?, duree_intervention),
            latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude), adresse = COALESCE(?, adresse),
            date_intervention = COALESCE(?, date_intervention), updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            titre || null, description || null, solution || null, type_intervention || null,
            duree_intervention ? parseInt(duree_intervention) : null,
            latitude ? parseFloat(latitude) : null, longitude ? parseFloat(longitude) : null,
            adresse || null, date_intervention || null, rapportId
        );

        if (req.files && req.files.length > 0) {
            const insertPhoto = db.prepare('INSERT INTO photos_rapport (rapport_id, nom_fichier, chemin, description) VALUES (?, ?, ?, ?)');
            req.files.forEach((file, index) => {
                const desc = req.body[`photo_description_${index}`] || null;
                insertPhoto.run(rapportId, file.originalname, file.filename, desc);
            });
        }

        logUserAction(req, 'MODIFICATION_RAPPORT', { table: 'rapports', recordId: rapportId });
        return res.json({ success: true, message: 'Rapport modifié' });
    } catch (error) {
        console.error('❌ Erreur modification rapport:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// DELETE /rapports/:id
// ========================================================

router.delete('/:id', authenticate, hasPermission('supprimer_rapport'), (req, res) => {
    try {
        const rapportId = parseInt(req.params.id);
        const db = getDb();
        const rapport = db.prepare('SELECT * FROM rapports WHERE id = ?').get(rapportId);
        if (!rapport) return res.status(404).json({ success: false, message: 'Rapport non trouvé' });
        if (rapport.statut === 'approuve') {
            return res.status(400).json({ success: false, message: 'Impossible de supprimer un rapport approuvé' });
        }

        if (req.userRole === 'technicien') {
            const tech = db.prepare('SELECT id FROM techniciens WHERE utilisateur_id = ?').get(req.userId);
            const isOwner = tech && rapport.technicien_id === tech.id;
            const isUser = rapport.user_id === req.userId;
            if (!isOwner && !isUser) return res.status(403).json({ success: false, message: 'Accès refusé' });
        } else if (!['admin', 'dj', 'superviseur'].includes(req.userRole)) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        const photos = db.prepare('SELECT chemin FROM photos_rapport WHERE rapport_id = ?').all(rapportId);
        photos.forEach(p => {
            const filePath = path.join(uploadDir, p.chemin);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });

        db.prepare('DELETE FROM rapports WHERE id = ?').run(rapportId);
        logUserAction(req, 'SUPPRESSION_RAPPORT', { table: 'rapports', recordId: rapportId, titre: rapport.titre });
        return res.json({ success: true, message: 'Rapport supprimé' });
    } catch (error) {
        console.error('❌ Erreur suppression rapport:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// PATCH /rapports/:id/statut
// ========================================================

router.patch('/:id/statut', authenticate, isSuperviseurOrAdmin, (req, res) => {
    try {
        const rapportId = parseInt(req.params.id);
        const { statut } = req.body;
        if (!statut || !STATUTS_RAPPORT.includes(statut)) {
            return res.status(400).json({ success: false, message: 'Statut invalide' });
        }
        const db = getDb();
        const rapport = db.prepare('SELECT * FROM rapports WHERE id = ?').get(rapportId);
        if (!rapport) return res.status(404).json({ success: false, message: 'Rapport non trouvé' });

        db.prepare('UPDATE rapports SET statut = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(statut, rapportId);

        try {
            let targetUserId = rapport.user_id;
            if (!targetUserId && rapport.technicien_id) {
                const tech = db.prepare('SELECT utilisateur_id FROM techniciens WHERE id = ?').get(rapport.technicien_id);
                if (tech) targetUserId = tech.utilisateur_id;
            }
            if (targetUserId) {
                const messages = {
                    'approuve': '✅ Votre rapport a été approuvé',
                    'rejete': '❌ Votre rapport a été rejeté',
                    'soumis': '📤 Votre rapport a été soumis',
                    'brouillon': '📝 Votre rapport est en brouillon'
                };
                db.prepare(`INSERT INTO notifications (utilisateur_id, type, titre, message, donnees) VALUES (?, 'rapport', '📄 Mise à jour rapport', ?, ?)`)
                    .run(targetUserId, `${messages[statut] || 'Statut modifié'}: ${rapport.titre}`, JSON.stringify({ rapportId, statut, titre: rapport.titre }));
            }
        } catch (e) { console.warn('⚠️ Notification échouée:', e.message); }

        logUserAction(req, 'CHANGEMENT_STATUT_RAPPORT', { table: 'rapports', recordId: rapportId, statut });
        return res.json({ success: true, message: `Statut mis à jour : ${statut}` });
    } catch (error) {
        console.error('❌ Erreur changement statut rapport:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// POST /rapports/:id/photos
// ========================================================

router.post('/:id/photos', authenticate, hasPermission('modifier_rapport'), upload.array('photos', 10), (req, res) => {
    try {
        const rapportId = parseInt(req.params.id);
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'Aucune photo' });
        }
        const db = getDb();
        const rapport = db.prepare('SELECT * FROM rapports WHERE id = ?').get(rapportId);
        if (!rapport) return res.status(404).json({ success: false, message: 'Rapport non trouvé' });

        if (req.userRole === 'technicien') {
            const tech = db.prepare('SELECT id FROM techniciens WHERE utilisateur_id = ?').get(req.userId);
            const isOwner = tech && rapport.technicien_id === tech.id;
            const isUser = rapport.user_id === req.userId;
            if (!isOwner && !isUser) return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        const insertPhoto = db.prepare('INSERT INTO photos_rapport (rapport_id, nom_fichier, chemin, description) VALUES (?, ?, ?, ?)');
        req.files.forEach((file, index) => {
            const desc = req.body[`photo_description_${index}`] || null;
            insertPhoto.run(rapportId, file.originalname, file.filename, desc);
        });

        logUserAction(req, 'AJOUT_PHOTOS_RAPPORT', { table: 'rapports', recordId: rapportId, nombre_photos: req.files.length });
        return res.json({ success: true, message: `${req.files.length} photo(s) ajoutée(s)` });
    } catch (error) {
        console.error('❌ Erreur ajout photos:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ========================================================
// DELETE /rapports/:id/photos/:photoId
// ========================================================

router.delete('/:id/photos/:photoId', authenticate, hasPermission('modifier_rapport'), (req, res) => {
    try {
        const rapportId = parseInt(req.params.id);
        const photoId = parseInt(req.params.photoId);
        const db = getDb();
        const rapport = db.prepare('SELECT * FROM rapports WHERE id = ?').get(rapportId);
        if (!rapport) return res.status(404).json({ success: false, message: 'Rapport non trouvé' });

        if (req.userRole === 'technicien') {
            const tech = db.prepare('SELECT id FROM techniciens WHERE utilisateur_id = ?').get(req.userId);
            const isOwner = tech && rapport.technicien_id === tech.id;
            const isUser = rapport.user_id === req.userId;
            if (!isOwner && !isUser) return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        const photo = db.prepare('SELECT * FROM photos_rapport WHERE id = ? AND rapport_id = ?').get(photoId, rapportId);
        if (!photo) return res.status(404).json({ success: false, message: 'Photo non trouvée' });

        const filePath = path.join(uploadDir, photo.chemin);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        db.prepare('DELETE FROM photos_rapport WHERE id = ?').run(photoId);

        return res.json({ success: true, message: 'Photo supprimée' });
    } catch (error) {
        console.error('❌ Erreur suppression photo:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

module.exports = router;