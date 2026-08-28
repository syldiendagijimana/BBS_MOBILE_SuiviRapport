
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');
const { authenticate, isAdmin, SECRET } = require('../middleware/auth');

// ========================================================
// CONSTANTES
// ========================================================

const TOKEN_EXPIRATION = '7d';

// ========================================================
// POST /auth/login - CONNEXION
// ========================================================

router.post('/login', (req, res) => {
    try {
        console.log('🔐 Tentative de connexion:', req.body.email);

        const email = String(req.body.email || '').trim();
        const motDePasse = String(req.body.mot_de_passe || '').trim();

        if (!email || !motDePasse) {
            return res.status(400).json({
                success: false,
                message: 'Email et mot de passe requis'
            });
        }

        const db = getDb();

        // Récupération de l'utilisateur
        const user = db.prepare(`
            SELECT
                id,
                nom,
                prenom,
                email,
                telephone,
                mot_de_passe,
                role,
                actif,
                avatar,
                created_at
            FROM utilisateurs
            WHERE email = ?
        `).get(email);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Email ou mot de passe incorrect'
            });
        }

        // Vérification du compte actif
        if (user.actif === 0) {
            return res.status(403).json({
                success: false,
                message: 'Compte désactivé. Contactez l\'administrateur.'
            });
        }

        // Vérification du mot de passe
        const motDePasseValide = bcrypt.compareSync(motDePasse, user.mot_de_passe);
        if (!motDePasseValide) {
            return res.status(401).json({
                success: false,
                message: 'Email ou mot de passe incorrect'
            });
        }

        // Mise à jour de la dernière connexion
        db.prepare(`
            UPDATE utilisateurs
            SET derniere_connexion = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(user.id);

        // Génération du token JWT
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            SECRET,
            { expiresIn: TOKEN_EXPIRATION }
        );

        // Supprimer le mot de passe de la réponse
        const { mot_de_passe: _, ...userSafe } = user;

        // Récupération des données spécifiques au rôle
        let roleData = null;
        if (user.role === 'technicien') {
            roleData = db.prepare(`
                SELECT
                    id,
                    matricule,
                    specialite,
                    zone_intervention,
                    telephone,
                    disponible,
                    en_mission,
                    latitude,
                    longitude,
                    date_embauche
                FROM techniciens
                WHERE utilisateur_id = ?
            `).get(user.id);
        } else if (user.role === 'superviseur') {
            roleData = db.prepare(`
                SELECT
                    id,
                    zone_responsable,
                    niveau_experience,
                    telephone_pro
                FROM superviseurs
                WHERE utilisateur_id = ?
            `).get(user.id);
        }

        // Vérifier si membre du groupe officiel
        const membreGroupe = db.prepare(`
            SELECT id, est_admin
            FROM membres_groupe_officiel
            WHERE utilisateur_id = ?
        `).get(user.id);

        return res.json({
            success: true,
            token,
            user: {
                ...userSafe,
                roleData,
                est_membre_groupe: !!membreGroupe,
                est_admin_groupe: membreGroupe ? membreGroupe.est_admin === 1 : false
            }
        });

    } catch (error) {
        console.error('❌ Erreur de connexion:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// POST /auth/register - INSCRIPTION (Admin uniquement)
// ========================================================

router.post('/register', authenticate, isAdmin, (req, res) => {
    try {
        const {
            nom,
            prenom,
            email,
            mot_de_passe,
            telephone,
            role,
            specialite,
            zone_intervention,
            zone_responsable,
            niveau_experience
        } = req.body;

        // Validation des champs requis
        if (!nom || !prenom || !email || !mot_de_passe || !role) {
            return res.status(400).json({
                success: false,
                message: 'Nom, prénom, email, mot de passe et rôle sont requis'
            });
        }

        // Validation du rôle
        const rolesValides = ['admin', 'dj', 'superviseur', 'technicien'];
        if (!rolesValides.includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Rôle invalide. Rôles acceptés: admin, dj, superviseur, technicien'
            });
        }

        const db = getDb();

        // Vérification de l'unicité de l'email
        const emailExiste = db.prepare('SELECT id FROM utilisateurs WHERE email = ?').get(email);
        if (emailExiste) {
            return res.status(409).json({
                success: false,
                message: 'Cet email est déjà utilisé'
            });
        }

        // Hashage du mot de passe
        const hash = bcrypt.hashSync(mot_de_passe, 10);

        // Insertion de l'utilisateur
        const result = db.prepare(`
            INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, telephone, role, actif)
            VALUES (?, ?, ?, ?, ?, ?, 1)
        `).run(nom, prenom, email, hash, telephone || null, role);

        const userId = result.lastInsertRowid;

        // Création des données spécifiques au rôle
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

        // Ajout automatique au groupe officiel
        const groupeId = db.prepare('SELECT id FROM groupe_officiel LIMIT 1').get();
        if (groupeId) {
            const estAdmin = role === 'admin' ? 1 : 0;
            db.prepare(`
                INSERT INTO membres_groupe_officiel (groupe_officiel_id, utilisateur_id, est_admin)
                VALUES (?, ?, ?)
            `).run(groupeId.id, userId, estAdmin);
        }

        return res.status(201).json({
            success: true,
            message: 'Utilisateur créé avec succès',
            userId: userId
        });

    } catch (error) {
        console.error('❌ Erreur d\'inscription:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /auth/me - PROFIL UTILISATEUR
// ========================================================

router.get('/me', authenticate, (req, res) => {
    try {
        const db = getDb();

        const user = db.prepare(`
            SELECT
                id,
                nom,
                prenom,
                email,
                telephone,
                role,
                actif,
                avatar,
                created_at,
                derniere_connexion
            FROM utilisateurs
            WHERE id = ?
        `).get(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        // Récupération des données spécifiques au rôle
        let roleData = null;
        if (user.role === 'technicien') {
            roleData = db.prepare(`
                SELECT
                    id,
                    matricule,
                    specialite,
                    zone_intervention,
                    telephone,
                    disponible,
                    en_mission,
                    latitude,
                    longitude,
                    date_embauche
                FROM techniciens
                WHERE utilisateur_id = ?
            `).get(user.id);
        } else if (user.role === 'superviseur') {
            roleData = db.prepare(`
                SELECT
                    id,
                    zone_responsable,
                    niveau_experience,
                    telephone_pro
                FROM superviseurs
                WHERE utilisateur_id = ?
            `).get(user.id);
        }

        // Vérifier si membre du groupe officiel
        const membreGroupe = db.prepare(`
            SELECT id, est_admin
            FROM membres_groupe_officiel
            WHERE utilisateur_id = ?
        `).get(user.id);

        return res.json({
            success: true,
            user: {
                ...user,
                roleData,
                est_membre_groupe: !!membreGroupe,
                est_admin_groupe: membreGroupe ? membreGroupe.est_admin === 1 : false
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération du profil:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// POST /auth/logout - DÉCONNEXION
// ========================================================

router.post('/logout', authenticate, (req, res) => {
    return res.json({
        success: true,
        message: 'Déconnexion réussie'
    });
});

// ========================================================
// POST /auth/refresh-token - RAFRAÎCHIR LE TOKEN
// ========================================================

router.post('/refresh-token', authenticate, (req, res) => {
    try {
        const token = jwt.sign(
            {
                id: req.user.id,
                email: req.user.email,
                role: req.user.role
            },
            SECRET,
            { expiresIn: TOKEN_EXPIRATION }
        );

        return res.json({
            success: true,
            token
        });

    } catch (error) {
        console.error('❌ Erreur de rafraîchissement token:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// POST /auth/change-password - CHANGER MOT DE PASSE
// ========================================================

router.post('/change-password', authenticate, (req, res) => {
    try {
        const ancienMotDePasse = String(req.body.ancien_mot_de_passe || '');
        const nouveauMotDePasse = String(req.body.nouveau_mot_de_passe || '');

        if (!ancienMotDePasse || !nouveauMotDePasse) {
            return res.status(400).json({
                success: false,
                message: 'Ancien et nouveau mot de passe requis'
            });
        }

        if (nouveauMotDePasse.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Le nouveau mot de passe doit contenir au moins 6 caractères'
            });
        }

        const db = getDb();

        const user = db.prepare(`
            SELECT id, mot_de_passe FROM utilisateurs WHERE id = ?
        `).get(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        const valide = bcrypt.compareSync(ancienMotDePasse, user.mot_de_passe);
        if (!valide) {
            return res.status(400).json({
                success: false,
                message: 'Ancien mot de passe incorrect'
            });
        }

        const hash = bcrypt.hashSync(nouveauMotDePasse, 10);

        db.prepare(`
            UPDATE utilisateurs
            SET mot_de_passe = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(hash, req.user.id);

        return res.json({
            success: true,
            message: 'Mot de passe modifié avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur de changement de mot de passe:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// POST /auth/forgot-password - MOT DE PASSE OUBLIÉ
// ========================================================

router.post('/forgot-password', (req, res) => {
    try {
        const email = String(req.body.email || '').trim();

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email requis'
            });
        }

        const db = getDb();

        const user = db.prepare('SELECT id, email FROM utilisateurs WHERE email = ? AND actif = 1').get(email);

        if (!user) {
            // Ne pas révéler si l'email existe ou non (sécurité)
            return res.json({
                success: true,
                message: 'Si votre email existe, un lien de réinitialisation vous a été envoyé'
            });
        }

        // Génération d'un token de réinitialisation
        const resetToken = jwt.sign(
            { id: user.id, email: user.email },
            SECRET,
            { expiresIn: '1h' }
        );

        // TODO: Envoyer un email avec le lien de réinitialisation
        // En production, utiliser un service d'email (Nodemailer, SendGrid, etc.)
        console.log(`🔑 Token de réinitialisation pour ${email}: ${resetToken}`);

        return res.json({
            success: true,
            message: 'Si votre email existe, un lien de réinitialisation vous a été envoyé'
        });

    } catch (error) {
        console.error('❌ Erreur de mot de passe oublié:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// POST /auth/reset-password - RÉINITIALISER MOT DE PASSE
// ========================================================

router.post('/reset-password', (req, res) => {
    try {
        const { token, nouveau_mot_de_passe } = req.body;

        if (!token || !nouveau_mot_de_passe) {
            return res.status(400).json({
                success: false,
                message: 'Token et nouveau mot de passe requis'
            });
        }

        if (nouveau_mot_de_passe.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Le nouveau mot de passe doit contenir au moins 6 caractères'
            });
        }

        // Vérification du token
        let decoded;
        try {
            decoded = jwt.verify(token, SECRET);
        } catch (jwtError) {
            return res.status(400).json({
                success: false,
                message: 'Token invalide ou expiré'
            });
        }

        const db = getDb();

        const user = db.prepare('SELECT id FROM utilisateurs WHERE id = ? AND actif = 1').get(decoded.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        const hash = bcrypt.hashSync(nouveau_mot_de_passe, 10);

        db.prepare(`
            UPDATE utilisateurs
            SET mot_de_passe = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(hash, user.id);

        return res.json({
            success: true,
            message: 'Mot de passe réinitialisé avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur de réinitialisation mot de passe:', error);
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