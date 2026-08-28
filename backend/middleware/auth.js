const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');

// ========================================================
// CONSTANTES
// ========================================================

const SECRET = process.env.JWT_SECRET || 'bbs_secret_2024';

const ROLES = {
    ADMIN: 'admin',
    DJ: 'dj',
    SUPERVISEUR: 'superviseur',
    TECHNICIEN: 'technicien'
};

const ROLE_HIERARCHY = {
    admin: 4,
    dj: 3,
    superviseur: 2,
    technicien: 1
};

// ✅ Permissions accordées par défaut à tous les techniciens (sans validation en base)
const DEFAULT_TECHNICIAN_PERMISSIONS = [
    'voir_messages',
    'envoyer_message',
    'voir_rapports',
    'creer_rapport',
    'modifier_rapport',
    'voir_incidents',
    'creer_incident',
    'voir_missions',
    'voir_reseau',
    'voir_notifications',
    'voir_statistiques'
];

// ========================================================
// MIDDLEWARE PRINCIPAL - AUTHENTIFICATION
// ========================================================

function authenticate(req, res, next) {
    try {
        const header = req.headers.authorization;

        if (!header || !header.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Token d\'authentification manquant',
                code: 'TOKEN_MISSING'
            });
        }

        const token = header.split(' ')[1];

        let payload;
        try {
            payload = jwt.verify(token, SECRET);
        } catch (jwtError) {
            if (jwtError.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    error: 'Token JWT expiré. Veuillez vous reconnecter.',
                    code: 'TOKEN_EXPIRED'
                });
            }
            if (jwtError.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    success: false,
                    error: 'Token JWT invalide.',
                    code: 'INVALID_TOKEN'
                });
            }
            throw jwtError;
        }

        console.log("🔐 TOKEN PAYLOAD reçu:", JSON.stringify(payload));

        const email = payload.email || payload.sub;
        const userId = payload.id || payload.userId || payload._id || payload.sub;

        let user = null;
        const db = getDb();

        if (email) {
            user = db.prepare(`
                SELECT id, email, nom, prenom, telephone, role, actif, avatar, created_at, derniere_connexion
                FROM utilisateurs
                WHERE email = ? AND actif = 1
            `).get(email);
        }

        if (!user && userId) {
            user = db.prepare(`
                SELECT id, email, nom, prenom, telephone, role, actif, avatar, created_at, derniere_connexion
                FROM utilisateurs
                WHERE id = ? AND actif = 1
            `).get(userId);
        }

        if (!user) {
            console.error(`❌ Utilisateur non trouvé avec email=${email} ou id=${userId}`);
            return res.status(401).json({
                success: false,
                error: 'Utilisateur introuvable ou désactivé',
                code: 'USER_NOT_FOUND'
            });
        }

        if (email && user.email !== email) {
            console.warn(`⚠️ Incohérence d'email: token=${email}, base=${user.email}`);
            return res.status(401).json({
                success: false,
                error: 'Incohérence des données utilisateur',
                code: 'USER_DATA_MISMATCH'
            });
        }

        req.user = {
            id: user.id,
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            telephone: user.telephone,
            role: user.role,
            avatar: user.avatar,
            actif: user.actif
        };
        req.userId = user.id;
        req.userRole = user.role;
        req.token = token;

        if (user.role === ROLES.TECHNICIEN) {
            const techData = db.prepare(`
                SELECT id, matricule, specialite, zone_intervention, telephone, disponible, en_mission, latitude, longitude, date_embauche
                FROM techniciens
                WHERE utilisateur_id = ?
            `).get(user.id);
            req.user.roleData = techData;
        } else if (user.role === ROLES.SUPERVISEUR) {
            const superData = db.prepare(`
                SELECT id, zone_responsable, niveau_experience, telephone_pro
                FROM superviseurs
                WHERE utilisateur_id = ?
            `).get(user.id);
            req.user.roleData = superData;
        }

        const membreGroupe = db.prepare(`
            SELECT id, est_admin
            FROM membres_groupe_officiel
            WHERE utilisateur_id = ?
        `).get(user.id);

        req.user.est_membre_groupe = !!membreGroupe;
        req.user.est_admin_groupe = membreGroupe ? membreGroupe.est_admin === 1 : false;

        console.log(`✅ Authentifié: ${user.prenom} ${user.nom} (${user.role})`);
        next();

    } catch (error) {
        console.error("❌ AUTH ERROR:", error.message);
        return res.status(401).json({
            success: false,
            error: 'Token invalide',
            code: 'INVALID_TOKEN'
        });
    }
}

// ========================================================
// MIDDLEWARES DE VÉRIFICATION DE RÔLE
// ========================================================

function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Non authentifié',
                code: 'NOT_AUTHENTICATED'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Accès refusé - Rôle insuffisant',
                code: 'INSUFFICIENT_ROLE',
                requiredRoles: roles,
                userRole: req.user.role
            });
        }

        next();
    };
}

function requireMinRole(minRole) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Non authentifié',
                code: 'NOT_AUTHENTICATED'
            });
        }

        const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
        const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

        if (userLevel < requiredLevel) {
            return res.status(403).json({
                success: false,
                error: 'Accès refusé - Niveau de rôle insuffisant',
                code: 'INSUFFICIENT_ROLE_LEVEL',
                requiredRole: minRole,
                userRole: req.user.role
            });
        }

        next();
    };
}

// ========================================================
// MIDDLEWARES SPÉCIFIQUES PAR RÔLE
// ========================================================

function isAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Non authentifié',
            code: 'NOT_AUTHENTICATED'
        });
    }

    if (req.user.role !== ROLES.ADMIN) {
        return res.status(403).json({
            success: false,
            error: 'Accès réservé à l\'administrateur',
            code: 'ADMIN_ONLY'
        });
    }

    next();
}

function isAdminOrDJ(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Non authentifié',
            code: 'NOT_AUTHENTICATED'
        });
    }

    if (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.DJ) {
        return res.status(403).json({
            success: false,
            error: 'Accès réservé à l\'administrateur ou au DJ',
            code: 'ADMIN_DJ_ONLY'
        });
    }

    next();
}

function isSuperviseur(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Non authentifié',
            code: 'NOT_AUTHENTICATED'
        });
    }

    if (![ROLES.ADMIN, ROLES.DJ, ROLES.SUPERVISEUR].includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            error: 'Accès réservé aux superviseurs et supérieurs (Admin, DJ, Superviseur)',
            code: 'SUPERVISEUR_ONLY'
        });
    }

    next();
}

function isTechnicien(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Non authentifié',
            code: 'NOT_AUTHENTICATED'
        });
    }

    if (![ROLES.ADMIN, ROLES.DJ, ROLES.SUPERVISEUR, ROLES.TECHNICIEN].includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            error: 'Accès réservé aux techniciens et supérieurs',
            code: 'TECHNICIEN_ONLY'
        });
    }

    next();
}

function isSuperviseurOrAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Non authentifié',
            code: 'NOT_AUTHENTICATED'
        });
    }

    if (req.user.role !== ROLES.SUPERVISEUR && req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.DJ) {
        return res.status(403).json({
            success: false,
            error: 'Accès réservé aux superviseurs, administrateurs et DJ',
            code: 'SUPERVISEUR_ADMIN_DJ_ONLY'
        });
    }

    next();
}

function isDJOrAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Non authentifié',
            code: 'NOT_AUTHENTICATED'
        });
    }

    if (req.user.role !== ROLES.DJ && req.user.role !== ROLES.ADMIN) {
        return res.status(403).json({
            success: false,
            error: 'Accès réservé au DJ et administrateur',
            code: 'DJ_ADMIN_ONLY'
        });
    }

    next();
}

// ========================================================
// MIDDLEWARES SPÉCIFIQUES
// ========================================================

function isGroupeAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Non authentifié',
            code: 'NOT_AUTHENTICATED'
        });
    }

    if (req.user.role === ROLES.ADMIN) {
        return next();
    }

    try {
        const db = getDb();
        const groupeAdmin = db.prepare(`
            SELECT id, est_admin
            FROM membres_groupe_officiel
            WHERE utilisateur_id = ? AND est_admin = 1
        `).get(req.userId);

        if (!groupeAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Accès refusé - Vous devez être administrateur du groupe',
                code: 'NOT_GROUP_ADMIN'
            });
        }

        next();
    } catch (error) {
        console.error('❌ Erreur de vérification groupe admin:', error);
        return res.status(500).json({
            success: false,
            error: 'Erreur interne du serveur',
            code: 'GROUP_ADMIN_CHECK_ERROR'
        });
    }
}

function isOwner(table, userIdColumn = 'utilisateur_id', idParam = 'id') {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Non authentifié',
                code: 'NOT_AUTHENTICATED'
            });
        }

        if (req.user.role === ROLES.ADMIN) {
            return next();
        }

        const resourceId = req.params[idParam] || req.body[idParam];
        if (!resourceId) {
            return res.status(400).json({
                success: false,
                error: `ID de ressource manquant (paramètre: ${idParam})`,
                code: 'RESOURCE_ID_MISSING'
            });
        }

        try {
            const db = getDb();
            const resource = db.prepare(`
                SELECT ${userIdColumn} FROM ${table} WHERE id = ?
            `).get(resourceId);

            if (!resource) {
                return res.status(404).json({
                    success: false,
                    error: 'Ressource non trouvée',
                    code: 'RESOURCE_NOT_FOUND'
                });
            }

            if (resource[userIdColumn] !== req.userId) {
                return res.status(403).json({
                    success: false,
                    error: 'Accès refusé - Vous n\'êtes pas le propriétaire',
                    code: 'NOT_OWNER'
                });
            }

            next();
        } catch (error) {
            console.error('❌ Erreur de vérification propriétaire:', error);
            return res.status(500).json({
                success: false,
                error: 'Erreur interne du serveur',
                code: 'OWNER_CHECK_ERROR'
            });
        }
    };
}

function isTechnicienDisponible(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Non authentifié',
            code: 'NOT_AUTHENTICATED'
        });
    }

    if (req.user.role !== ROLES.TECHNICIEN) {
        return res.status(403).json({
            success: false,
            error: 'Accès réservé aux techniciens',
            code: 'NOT_TECHNICIEN'
        });
    }

    try {
        const db = getDb();
        const technicien = db.prepare(`
            SELECT disponible, en_mission
            FROM techniciens
            WHERE utilisateur_id = ?
        `).get(req.userId);

        if (!technicien) {
            return res.status(404).json({
                success: false,
                error: 'Profil technicien non trouvé',
                code: 'TECHNICIAN_PROFILE_NOT_FOUND'
            });
        }

        if (!technicien.disponible) {
            return res.status(403).json({
                success: false,
                error: 'Technicien non disponible',
                code: 'TECHNICIAN_NOT_AVAILABLE'
            });
        }

        req.technicienDisponible = true;
        next();
    } catch (error) {
        console.error('❌ Erreur de vérification disponibilité:', error);
        return res.status(500).json({
            success: false,
            error: 'Erreur interne du serveur',
            code: 'AVAILABILITY_CHECK_ERROR'
        });
    }
}

// ========================================================
// 🆕 MIDDLEWARE DE VÉRIFICATION DE PERMISSION (CORRIGÉ)
// ========================================================

function hasPermission(type_permission) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Non authentifié',
                code: 'NOT_AUTHENTICATED'
            });
        }

        // Les admins, DJ et superviseurs ont tous les droits (pas de vérification de permission)
        if (req.user.role === ROLES.ADMIN || req.user.role === ROLES.DJ || req.user.role === ROLES.SUPERVISEUR) {
            return next();
        }

        // L'utilisateur doit être un technicien
        if (req.user.role !== ROLES.TECHNICIEN) {
            return res.status(403).json({
                success: false,
                error: 'Seuls les techniciens sont soumis à des permissions',
                code: 'NOT_TECHNICIAN'
            });
        }

        // ✅ Permissions de base accordées sans vérification en base
        if (DEFAULT_TECHNICIAN_PERMISSIONS.includes(type_permission)) {
            return next();
        }

        try {
            const db = getDb();

            // Récupérer l'ID du technicien associé à l'utilisateur
            const technicien = db.prepare(`
                SELECT id FROM techniciens WHERE utilisateur_id = ?
            `).get(req.userId);

            if (!technicien) {
                return res.status(403).json({
                    success: false,
                    error: 'Compte technicien non trouvé',
                    code: 'TECHNICIAN_ACCOUNT_NOT_FOUND'
                });
            }

            // Vérifier si une permission valide existe pour ce type et ce technicien
            const permission = db.prepare(`
                SELECT id
                FROM permissions
                WHERE technicien_id = ?
                  AND type_permission = ?
                  AND est_valide = 1
            `).get(technicien.id, type_permission);

            if (!permission) {
                return res.status(403).json({
                    success: false,
                    error: `Permission manquante ou non validée pour l'action: ${type_permission}`,
                    code: 'PERMISSION_MISSING',
                    required: type_permission
                });
            }

            req.permissionId = permission.id;
            next();

        } catch (error) {
            console.error('❌ Erreur de vérification de permission:', error);
            return res.status(500).json({
                success: false,
                error: 'Erreur interne du serveur',
                code: 'PERMISSION_CHECK_ERROR'
            });
        }
    };
}

// ========================================================
// FONCTIONS UTILITAIRES
// ========================================================

function logUserAction(req, action, details = {}) {
    try {
        if (!req.user) return;

        const db = getDb();
        const ip = req.ip || req.connection.remoteAddress || 'unknown';

        db.prepare(`
            INSERT INTO historique_actions (
                utilisateur_id,
                action,
                table_concerned,
                enregistrement_id,
                details,
                adresse_ip
            ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            req.userId,
            action,
            details.table || null,
            details.recordId || null,
            JSON.stringify(details),
            ip
        );
    } catch (error) {
        console.error('❌ Erreur de journalisation:', error);
        // Ne pas bloquer la requête en cas d'erreur de journalisation
    }
}

function hasRole(user, roles) {
    if (!user || !user.role) return false;
    if (Array.isArray(roles)) {
        return roles.includes(user.role);
    }
    return user.role === roles;
}

function hasMinRoleLevel(user, minRole) {
    if (!user || !user.role) return false;
    const userLevel = ROLE_HIERARCHY[user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;
    return userLevel >= requiredLevel;
}

function getUserById(userId) {
    try {
        const db = getDb();
        return db.prepare(`
            SELECT id, nom, prenom, email, telephone, role, actif, avatar
            FROM utilisateurs
            WHERE id = ?
        `).get(userId);
    } catch (error) {
        console.error('❌ Erreur de récupération utilisateur:', error);
        return null;
    }
}

// ========================================================
// EXPORT
// ========================================================

module.exports = {
    authenticate,
    authorize,
    requireMinRole,
    isAdmin,
    isAdminOrDJ,
    isSuperviseur,
    isTechnicien,
    isSuperviseurOrAdmin,
    isDJOrAdmin,
    isGroupeAdmin,
    isOwner,
    isTechnicienDisponible,
    hasPermission,
    logUserAction,
    hasRole,
    hasMinRoleLevel,
    getUserById,
    ROLES,
    ROLE_HIERARCHY,
    SECRET
};