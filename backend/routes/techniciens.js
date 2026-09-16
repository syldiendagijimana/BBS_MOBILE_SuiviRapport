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
    isSuperviseurOrAdmin,   // ✅ déjà importé
    hasPermission,
    logUserAction
} = require('../middleware/auth');

// ========================================================
// CONSTANTES
// ========================================================

const SPECIALITES_VALIDES = [
    'Fibre optique',
    'ADSL',
    'VDSL',
    'Réseau mobile',
    'Satellite',
    'WiMAX',
    'Câble coaxial',
    'Autre'
];

// ========================================================
// GET /techniciens - LISTE DES TECHNICIENS
// ========================================================

router.get('/', authenticate, hasPermission('voir_techniciens'), isSuperviseur, (req, res) => {
    try {
        const db = getDb();
        const { disponible, zone, search, page = 1, limit = 50 } = req.query;

        let conditions = [];
        let params = [];

        if (disponible !== undefined) {
            conditions.push('t.disponible = ?');
            params.push(parseInt(disponible));
        }

        if (zone) {
            conditions.push('t.zone_intervention LIKE ?');
            params.push(`%${zone}%`);
        }

        if (search) {
            conditions.push('(u.nom LIKE ? OR u.prenom LIKE ? OR u.email LIKE ? OR t.matricule LIKE ?)');
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const techniciens = db.prepare(`
            SELECT
                t.id,
                t.utilisateur_id,
                t.matricule,
                t.specialite,
                t.zone_intervention,
                t.telephone,
                t.disponible,
                t.en_mission,
                t.latitude,
                t.longitude,
                t.date_embauche,
                t.created_at,
                u.id as user_id,
                u.nom,
                u.prenom,
                u.email,
                u.avatar,
                u.actif,
                u.telephone as user_telephone
            FROM techniciens t
            LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
            ${whereClause}
            ORDER BY t.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        const total = db.prepare(`
            SELECT COUNT(*) as count
            FROM techniciens t
            LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
            ${whereClause}
        `).get(...params.slice(0, params.length - 2));

        return res.json({
            success: true,
            data: techniciens,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.count,
                pages: Math.ceil(total.count / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des techniciens:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /techniciens/disponibles - TECHNICIENS DISPONIBLES
// ========================================================

router.get('/disponibles', authenticate, hasPermission('voir_techniciens'), isSuperviseur, (req, res) => {
    try {
        const db = getDb();

        const techniciens = db.prepare(`
            SELECT
                t.id,
                t.matricule,
                t.specialite,
                t.zone_intervention,
                t.telephone,
                t.latitude,
                t.longitude,
                u.id as user_id,
                u.nom,
                u.prenom,
                u.email,
                u.avatar
            FROM techniciens t
            LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
            WHERE t.disponible = 1
                AND t.en_mission = 0
                AND u.actif = 1
            ORDER BY t.created_at DESC
        `).all();

        return res.json({
            success: true,
            count: techniciens.length,
            data: techniciens
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des techniciens disponibles:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /techniciens/recherche - RECHERCHER DES TECHNICIENS
// ========================================================

router.get('/recherche', authenticate, hasPermission('voir_techniciens'), isSuperviseur, (req, res) => {
    try {
        const { q, limit = 20 } = req.query;

        if (!q || q.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Le terme de recherche doit contenir au moins 2 caractères'
            });
        }

        const db = getDb();

        const techniciens = db.prepare(`
            SELECT
                t.id,
                t.matricule,
                t.specialite,
                t.zone_intervention,
                t.disponible,
                t.en_mission,
                u.id as user_id,
                u.nom,
                u.prenom,
                u.email,
                u.avatar
            FROM techniciens t
            LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
            WHERE u.actif = 1
                AND (u.nom LIKE ? OR u.prenom LIKE ? OR u.email LIKE ? OR t.matricule LIKE ?)
            ORDER BY u.nom, u.prenom
            LIMIT ?
        `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, parseInt(limit));

        return res.json({
            success: true,
            count: techniciens.length,
            data: techniciens
        });

    } catch (error) {
        console.error('❌ Erreur de recherche des techniciens:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /techniciens/statistiques - STATISTIQUES
// ========================================================

router.get('/statistiques', authenticate, hasPermission('voir_statistiques'), isSuperviseurOrAdmin, (req, res) => {
    try {
        const db = getDb();

        const total = db.prepare('SELECT COUNT(*) as count FROM techniciens').get();
        const disponibles = db.prepare('SELECT COUNT(*) as count FROM techniciens WHERE disponible = 1').get();
        const enMission = db.prepare('SELECT COUNT(*) as count FROM techniciens WHERE en_mission = 1').get();
        const indisponibles = db.prepare('SELECT COUNT(*) as count FROM techniciens WHERE disponible = 0').get();

        const parSpecialite = db.prepare(`
            SELECT specialite, COUNT(*) as count
            FROM techniciens
            WHERE specialite IS NOT NULL AND specialite != ''
            GROUP BY specialite
            ORDER BY count DESC
        `).all();

        const parZone = db.prepare(`
            SELECT zone_intervention, COUNT(*) as count
            FROM techniciens
            WHERE zone_intervention IS NOT NULL AND zone_intervention != ''
            GROUP BY zone_intervention
            ORDER BY count DESC
        `).all();

        const derniers = db.prepare(`
            SELECT
                t.id,
                t.matricule,
                t.specialite,
                u.nom,
                u.prenom,
                u.email,
                t.created_at
            FROM techniciens t
            LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
            ORDER BY t.created_at DESC
            LIMIT 5
        `).all();

        return res.json({
            success: true,
            statistiques: {
                total: total.count,
                disponibles: disponibles.count,
                en_mission: enMission.count,
                indisponibles: indisponibles.count,
                par_specialite: parSpecialite,
                par_zone: parZone,
                derniers_ajoutes: derniers
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
// GET /techniciens/:id - DÉTAILS D'UN TECHNICIEN
// ========================================================

router.get('/:id', authenticate, hasPermission('voir_techniciens'), isSuperviseur, (req, res) => {
    try {
        const db = getDb();
        const technicienId = parseInt(req.params.id);

        const technicien = db.prepare(`
            SELECT
                t.id,
                t.utilisateur_id,
                t.matricule,
                t.specialite,
                t.zone_intervention,
                t.telephone,
                t.disponible,
                t.en_mission,
                t.latitude,
                t.longitude,
                t.date_embauche,
                t.created_at,
                t.updated_at,
                u.id as user_id,
                u.nom,
                u.prenom,
                u.email,
                u.avatar,
                u.actif,
                u.telephone as user_telephone,
                u.created_at as user_created_at
            FROM techniciens t
            LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
            WHERE t.id = ?
        `).get(technicienId);

        if (!technicien) {
            return res.status(404).json({
                success: false,
                message: 'Technicien non trouvé'
            });
        }

        const stats = {
            missions_total: db.prepare('SELECT COUNT(*) as count FROM missions WHERE technicien_id = ?').get(technicienId).count,
            missions_en_cours: db.prepare('SELECT COUNT(*) as count FROM missions WHERE technicien_id = ? AND statut = "en_cours"').get(technicienId).count,
            missions_terminees: db.prepare('SELECT COUNT(*) as count FROM missions WHERE technicien_id = ? AND statut = "terminee"').get(technicienId).count,
            rapports_total: db.prepare('SELECT COUNT(*) as count FROM rapports WHERE technicien_id = ?').get(technicienId).count,
            incidents_total: db.prepare('SELECT COUNT(*) as count FROM incidents WHERE technicien_id = ?').get(technicienId).count,
            incidents_resolus: db.prepare('SELECT COUNT(*) as count FROM incidents WHERE technicien_id = ? AND statut = "resolu"').get(technicienId).count
        };

        const dernieresMissions = db.prepare(`
            SELECT id, titre, statut, date_debut, date_fin_prevue
            FROM missions
            WHERE technicien_id = ?
            ORDER BY created_at DESC
            LIMIT 5
        `).all(technicienId);

        const derniersRapports = db.prepare(`
            SELECT id, titre, statut, date_intervention, created_at
            FROM rapports
            WHERE technicien_id = ?
            ORDER BY created_at DESC
            LIMIT 5
        `).all(technicienId);

        return res.json({
            success: true,
            data: {
                ...technicien,
                statistiques: stats,
                dernieres_missions: dernieresMissions,
                derniers_rapports: derniersRapports
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération du technicien:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /techniciens/:id/missions - MISSIONS D'UN TECHNICIEN
// ========================================================

router.get('/:id/missions', authenticate, hasPermission('voir_techniciens'), isTechnicien, (req, res) => {
    try {
        const db = getDb();
        const technicienId = parseInt(req.params.id);
        const { statut, page = 1, limit = 20 } = req.query;

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
                s.nom as superviseur_nom,
                s.prenom as superviseur_prenom
            FROM missions m
            LEFT JOIN superviseurs sup ON m.superviseur_id = sup.id
            LEFT JOIN utilisateurs s ON sup.utilisateur_id = s.id
            ${whereClause}
            ORDER BY m.date_debut DESC
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
        console.error('❌ Erreur de récupération des missions:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /techniciens/:id/rapports - RAPPORTS D'UN TECHNICIEN
// ========================================================

router.get('/:id/rapports', authenticate, hasPermission('voir_techniciens'), isTechnicien, (req, res) => {
    try {
        const db = getDb();
        const technicienId = parseInt(req.params.id);
        const { statut, page = 1, limit = 20 } = req.query;

        let conditions = ['technicien_id = ?'];
        let params = [technicienId];

        if (statut) {
            conditions.push('statut = ?');
            params.push(statut);
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const rapports = db.prepare(`
            SELECT
                r.*,
                m.titre as mission_titre,
                m.id as mission_id
            FROM rapports r
            LEFT JOIN missions m ON r.mission_id = m.id
            ${whereClause}
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        const total = db.prepare(`
            SELECT COUNT(*) as count FROM rapports ${whereClause}
        `).get(...params);

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
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /techniciens/:id/incidents - INCIDENTS D'UN TECHNICIEN
// ========================================================

router.get('/:id/incidents', authenticate, hasPermission('voir_techniciens'), isTechnicien, (req, res) => {
    try {
        const db = getDb();
        const technicienId = parseInt(req.params.id);
        const { statut, page = 1, limit = 20 } = req.query;

        let conditions = ['technicien_id = ?'];
        let params = [technicienId];

        if (statut) {
            conditions.push('statut = ?');
            params.push(statut);
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const incidents = db.prepare(`
            SELECT
                i.*,
                s.nom as superviseur_nom,
                s.prenom as superviseur_prenom
            FROM incidents i
            LEFT JOIN superviseurs sup ON i.superviseur_id = sup.id
            LEFT JOIN utilisateurs s ON sup.utilisateur_id = s.id
            ${whereClause}
            ORDER BY i.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        const total = db.prepare(`
            SELECT COUNT(*) as count FROM incidents ${whereClause}
        `).get(...params);

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
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// ✅ POST /techniciens - CRÉER UN TECHNICIEN (Admin, DJ, Superviseur)
// ========================================================

router.post('/', authenticate, isSuperviseurOrAdmin, hasPermission('creer_technicien'), (req, res) => {
    try {
        const {
            nom,
            prenom,
            email,
            mot_de_passe,
            telephone,
            matricule,
            specialite,
            zone_intervention,
            date_embauche
        } = req.body;

        if (!nom || !prenom || !email || !mot_de_passe || !matricule) {
            return res.status(400).json({
                success: false,
                message: 'Nom, prénom, email, mot de passe et matricule sont requis'
            });
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
            return res.status(409).json({
                success: false,
                message: 'Cet email est déjà utilisé'
            });
        }

        const matriculeExiste = db.prepare('SELECT id FROM techniciens WHERE matricule = ?').get(matricule);
        if (matriculeExiste) {
            return res.status(409).json({
                success: false,
                message: 'Ce matricule est déjà utilisé'
            });
        }

        const hash = bcrypt.hashSync(mot_de_passe, 10);

        const userResult = db.prepare(`
            INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, telephone, role, actif)
            VALUES (?, ?, ?, ?, ?, 'technicien', 1)
        `).run(nom, prenom, email, hash, telephone || null);

        const userId = userResult.lastInsertRowid;

        const techResult = db.prepare(`
            INSERT INTO techniciens (
                utilisateur_id,
                matricule,
                specialite,
                zone_intervention,
                telephone,
                disponible,
                date_embauche
            ) VALUES (?, ?, ?, ?, ?, 1, ?)
        `).run(userId, matricule, specialite || null, zone_intervention || null, telephone || null, date_embauche || null);

        const groupeId = db.prepare('SELECT id FROM groupe_officiel LIMIT 1').get();
        if (groupeId) {
            db.prepare(`
                INSERT INTO membres_groupe_officiel (groupe_officiel_id, utilisateur_id, est_admin)
                VALUES (?, ?, 0)
            `).run(groupeId.id, userId);
        }

        logUserAction(req, 'CREATION_TECHNICIEN', {
            table: 'techniciens',
            recordId: techResult.lastInsertRowid,
            matricule: matricule,
            email: email
        });

        return res.status(201).json({
            success: true,
            message: 'Technicien créé avec succès',
            id: techResult.lastInsertRowid,
            utilisateur_id: userId
        });

    } catch (error) {
        console.error('❌ Erreur de création du technicien:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// ✅ PUT /techniciens/:id - MODIFIER UN TECHNICIEN (Admin, DJ, Superviseur)
// ========================================================

router.put('/:id', authenticate, isSuperviseurOrAdmin, hasPermission('modifier_technicien'), (req, res) => {
    try {
        const technicienId = parseInt(req.params.id);
        const {
            nom,
            prenom,
            email,
            telephone,
            mot_de_passe,
            matricule,
            specialite,
            zone_intervention,
            disponible,
            date_embauche
        } = req.body;

        const db = getDb();

        const tech = db.prepare(`
            SELECT t.*, u.id as user_id, u.email as user_email
            FROM techniciens t
            LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
            WHERE t.id = ?
        `).get(technicienId);

        if (!tech) {
            return res.status(404).json({
                success: false,
                message: 'Technicien non trouvé'
            });
        }

        if (matricule && matricule !== tech.matricule) {
            const matriculeExiste = db.prepare('SELECT id FROM techniciens WHERE matricule = ? AND id != ?').get(matricule, technicienId);
            if (matriculeExiste) {
                return res.status(409).json({
                    success: false,
                    message: 'Ce matricule est déjà utilisé'
                });
            }
        }

        if (email && email !== tech.user_email) {
            const emailExiste = db.prepare('SELECT id FROM utilisateurs WHERE email = ? AND id != ?').get(email, tech.user_id);
            if (emailExiste) {
                return res.status(409).json({
                    success: false,
                    message: 'Cet email est déjà utilisé'
                });
            }
        }

        let userQuery = `
            UPDATE utilisateurs
            SET nom = COALESCE(?, nom),
                prenom = COALESCE(?, prenom),
                email = COALESCE(?, email),
                telephone = COALESCE(?, telephone),
                updated_at = CURRENT_TIMESTAMP
        `;
        let userParams = [nom || null, prenom || null, email || null, telephone || null];

        if (mot_de_passe) {
            if (mot_de_passe.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Le mot de passe doit contenir au moins 6 caractères'
                });
            }
            userQuery += ', mot_de_passe = ?';
            userParams.push(bcrypt.hashSync(mot_de_passe, 10));
        }

        userQuery += ' WHERE id = ?';
        userParams.push(tech.user_id);

        db.prepare(userQuery).run(...userParams);

        db.prepare(`
            UPDATE techniciens
            SET matricule = COALESCE(?, matricule),
                specialite = COALESCE(?, specialite),
                zone_intervention = COALESCE(?, zone_intervention),
                telephone = COALESCE(?, telephone),
                disponible = COALESCE(?, disponible),
                date_embauche = COALESCE(?, date_embauche),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            matricule || null,
            specialite || null,
            zone_intervention || null,
            telephone || null,
            disponible !== undefined ? parseInt(disponible) : null,
            date_embauche || null,
            technicienId
        );

        logUserAction(req, 'MODIFICATION_TECHNICIEN', {
            table: 'techniciens',
            recordId: technicienId,
            matricule: matricule || tech.matricule
        });

        return res.json({
            success: true,
            message: 'Technicien modifié avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur de modification du technicien:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// DELETE /techniciens/:id - SUPPRIMER UN TECHNICIEN (Admin seulement)
// ========================================================

router.delete('/:id', authenticate, hasPermission('supprimer_technicien'), isAdmin, (req, res) => {
    try {
        const technicienId = parseInt(req.params.id);
        const db = getDb();

        const tech = db.prepare(`
            SELECT t.*, u.id as user_id
            FROM techniciens t
            LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
            WHERE t.id = ?
        `).get(technicienId);

        if (!tech) {
            return res.status(404).json({
                success: false,
                message: 'Technicien non trouvé'
            });
        }

        db.prepare('DELETE FROM techniciens WHERE id = ?').run(technicienId);

        if (tech.user_id) {
            db.prepare('DELETE FROM utilisateurs WHERE id = ?').run(tech.user_id);
        }

        logUserAction(req, 'SUPPRESSION_TECHNICIEN', {
            table: 'techniciens',
            recordId: technicienId,
            matricule: tech.matricule
        });

        return res.json({
            success: true,
            message: 'Technicien supprimé avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur de suppression du technicien:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// ✅ PATCH /techniciens/:id/disponible - CHANGER DISPONIBILITÉ (Admin, DJ, Superviseur)
// ========================================================

router.patch('/:id/disponible', authenticate, isSuperviseurOrAdmin, hasPermission('modifier_technicien'), (req, res) => {
    try {
        const technicienId = parseInt(req.params.id);
        const { disponible } = req.body;

        if (disponible === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Le champ "disponible" est requis (1 pour disponible, 0 pour indisponible)'
            });
        }

        const db = getDb();

        const tech = db.prepare('SELECT id, matricule FROM techniciens WHERE id = ?').get(technicienId);

        if (!tech) {
            return res.status(404).json({
                success: false,
                message: 'Technicien non trouvé'
            });
        }

        db.prepare(`
            UPDATE techniciens
            SET disponible = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(parseInt(disponible), technicienId);

        logUserAction(req, parseInt(disponible) === 1 ? 'TECHNICIEN_DISPONIBLE' : 'TECHNICIEN_INDISPONIBLE', {
            table: 'techniciens',
            recordId: technicienId,
            matricule: tech.matricule
        });

        return res.json({
            success: true,
            message: `Technicien ${parseInt(disponible) === 1 ? 'disponible' : 'indisponible'}`
        });

    } catch (error) {
        console.error('❌ Erreur de mise à jour de la disponibilité:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// PATCH /techniciens/:id/position - METTRE À JOUR POSITION GPS (Technicien lui-même)
// ========================================================

router.patch('/:id/position', authenticate, hasPermission('modifier_technicien'), isTechnicien, (req, res) => {
    try {
        const technicienId = parseInt(req.params.id);
        const { latitude, longitude } = req.body;

        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Latitude et longitude sont requis'
            });
        }

        const db = getDb();

        const tech = db.prepare(`
            SELECT id, utilisateur_id FROM techniciens WHERE id = ? AND utilisateur_id = ?
        `).get(technicienId, req.userId);

        if (!tech) {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé - Vous n\'êtes pas ce technicien'
            });
        }

        db.prepare(`
            UPDATE techniciens
            SET latitude = ?, longitude = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(parseFloat(latitude), parseFloat(longitude), technicienId);

        return res.json({
            success: true,
            message: 'Position mise à jour avec succès',
            position: { latitude: parseFloat(latitude), longitude: parseFloat(longitude) }
        });

    } catch (error) {
        console.error('❌ Erreur de mise à jour de la position:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /techniciens/:id/permissions - RÉCUPÉRER LES PERMISSIONS D'UN TECHNICIEN
// ========================================================

router.get('/:id/permissions', authenticate, (req, res) => {
    try {
        const technicienId = parseInt(req.params.id);
        const db = getDb();

        const technicien = db.prepare('SELECT id FROM techniciens WHERE id = ?').get(technicienId);
        if (!technicien) {
            return res.status(404).json({
                success: false,
                message: 'Technicien non trouvé'
            });
        }

        const permissions = db.prepare(`
            SELECT type_permission FROM permissions
            WHERE technicien_id = ? AND est_valide = 1
        `).all(technicienId);

        const permissionList = permissions.map(p => p.type_permission);

        return res.json({
            success: true,
            permissions: permissionList
        });
    } catch (error) {
        console.error('❌ Erreur récupération permissions du technicien:', error);
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