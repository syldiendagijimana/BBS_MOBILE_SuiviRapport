const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const {
    authenticate,
    isSuperviseur,
    isAdmin,
    isTechnicien,
    isSuperviseurOrAdmin,
    hasPermission,
    logUserAction
} = require('../middleware/auth');

// ========================================================
// CONSTANTES
// ========================================================

const STATUTS_RESEAU = ['operationnel', 'degrade', 'panne', 'maintenance', 'normal', 'congestion', 'critique'];

// ========================================================
// GET /reseau/etat - ÉTAT DU RÉSEAU (TOUTES ZONES)
// ========================================================

router.get('/etat', authenticate, hasPermission('voir_reseau'), isTechnicien, (req, res) => {
    try {
        const db = getDb();
        const { statut, zone, limit = 100 } = req.query;

        let conditions = [];
        let params = [];

        if (statut) {
            conditions.push('statut = ?');
            params.push(statut);
        }

        if (zone) {
            conditions.push('zone LIKE ?');
            params.push(`%${zone}%`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const etat = db.prepare(`
            SELECT
                id,
                zone,
                site,
                bande_passante,
                latence,
                debit_montant,
                debit_descendant,
                utilisation_mbps,
                capacite_mbps,
                pourcentage_utilisation,
                taux_erreur,
                uptime,
                statut,
                derniere_verification,
                created_at,
                updated_at
            FROM etat_reseau
            ${whereClause}
            ORDER BY zone, derniere_verification DESC
            LIMIT ?
        `).all(...params, parseInt(limit));

        const stats = {
            total_zones: etat.length,
            zones_critiques: etat.filter(e => e.statut === 'critique' || e.statut === 'panne').length,
            zones_congestion: etat.filter(e => e.statut === 'congestion').length,
            zones_normales: etat.filter(e => e.statut === 'normal' || e.statut === 'operationnel').length,
            utilisation_moyenne: etat.length > 0 ? (etat.reduce((acc, e) => acc + (e.pourcentage_utilisation || 0), 0) / etat.length).toFixed(1) : 0,
            uptime_moyen: etat.length > 0 ? (etat.reduce((acc, e) => acc + (e.uptime || 0), 0) / etat.length).toFixed(1) : 0
        };

        return res.json({
            success: true,
            statistiques: stats,
            data: etat
        });

    } catch (error) {
        console.error('❌ Erreur de récupération de l\'état du réseau:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// ⚠️ IMPORTANT : mettre /etat/latest AVANT /etat/:zone
// ========================================================

// GET /reseau/etat/latest - DERNIER ÉTAT PAR ZONE (accessible à tous les techniciens)
router.get('/etat/latest', authenticate, isTechnicien, (req, res) => {
    try {
        const db = getDb();

        const rows = db.prepare(`
            SELECT
                id,
                zone,
                site,
                bande_passante,
                latence,
                debit_montant,
                debit_descendant,
                utilisation_mbps,
                capacite_mbps,
                pourcentage_utilisation,
                taux_erreur,
                uptime,
                statut,
                derniere_verification,
                created_at,
                updated_at
            FROM etat_reseau
            ORDER BY zone, derniere_verification DESC
        `).all();

        if (!rows || rows.length === 0) {
            return res.json({
                success: true,
                statistiques: {
                    total_zones: 0,
                    zones_critiques: 0,
                    zones_congestion: 0,
                    zones_operationnelles: 0,
                    utilisation_moyenne: 0,
                    uptime_moyen: 0
                },
                data: []
            });
        }

        const zoneMap = new Map();
        rows.forEach(row => {
            if (!zoneMap.has(row.zone)) {
                zoneMap.set(row.zone, row);
            }
        });

        const result = Array.from(zoneMap.values());

        const stats = {
            total_zones: result.length,
            zones_critiques: result.filter(e => e.statut === 'critique' || e.statut === 'panne').length,
            zones_congestion: result.filter(e => e.statut === 'congestion').length,
            zones_operationnelles: result.filter(e => e.statut === 'operationnel' || e.statut === 'normal').length,
            utilisation_moyenne: result.length > 0
                ? (result.reduce((acc, e) => acc + (e.pourcentage_utilisation || 0), 0) / result.length).toFixed(1)
                : 0,
            uptime_moyen: result.length > 0
                ? (result.reduce((acc, e) => acc + (e.uptime || 0), 0) / result.length).toFixed(1)
                : 0
        };

        return res.json({
            success: true,
            statistiques: stats,
            data: result
        });

    } catch (error) {
        console.error('❌ Erreur récupération état réseau:', error);
        return res.json({
            success: true,
            statistiques: {
                total_zones: 0,
                zones_critiques: 0,
                zones_congestion: 0,
                zones_operationnelles: 0,
                utilisation_moyenne: 0,
                uptime_moyen: 0
            },
            data: []
        });
    }
});

// GET /reseau/etat/:zone - ÉTAT PAR ZONE (avec permission)
router.get('/etat/:zone', authenticate, hasPermission('voir_reseau'), isTechnicien, (req, res) => {
    try {
        const db = getDb();
        const { zone } = req.params;
        const { limit = 10 } = req.query;

        const etat = db.prepare(`
            SELECT
                id,
                zone,
                site,
                bande_passante,
                latence,
                debit_montant,
                debit_descendant,
                utilisation_mbps,
                capacite_mbps,
                pourcentage_utilisation,
                taux_erreur,
                uptime,
                statut,
                derniere_verification,
                created_at
            FROM etat_reseau
            WHERE zone = ?
            ORDER BY derniere_verification DESC
            LIMIT ?
        `).all(zone, parseInt(limit));

        if (etat.length === 0) {
            return res.json({
                success: true,
                message: 'Aucune donnée pour cette zone',
                dernier: null,
                historique: [],
                historique_complet: []
            });
        }

        const dernier = etat[0];

        const historique = db.prepare(`
            SELECT
                date(derniere_verification) as date,
                AVG(pourcentage_utilisation) as utilisation_moyenne,
                MAX(pourcentage_utilisation) as utilisation_max,
                MIN(pourcentage_utilisation) as utilisation_min
            FROM etat_reseau
            WHERE zone = ? AND derniere_verification >= date('now', '-7 days')
            GROUP BY date(derniere_verification)
            ORDER BY date DESC
        `).all(zone);

        return res.json({
            success: true,
            dernier: dernier,
            historique: historique,
            historique_complet: etat
        });

    } catch (error) {
        console.error('❌ Erreur de récupération de l\'état de la zone:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// POST /reseau/etat - AJOUTER UN ÉTAT RÉSEAU
// ========================================================

router.post('/etat', authenticate, hasPermission('modifier_reseau'), isSuperviseurOrAdmin, (req, res) => {
    try {
        const {
            zone,
            site,
            bande_passante,
            latence,
            debit_montant,
            debit_descendant,
            utilisation_mbps,
            capacite_mbps,
            taux_erreur,
            uptime,
            statut
        } = req.body;

        if (!zone || utilisation_mbps === undefined || !capacite_mbps) {
            return res.status(400).json({
                success: false,
                message: 'Zone, utilisation_mbps et capacite_mbps sont requis'
            });
        }

        const db = getDb();

        const pourcentageUtilisation = (utilisation_mbps / capacite_mbps) * 100;

        let statutFinal = statut || 'normal';
        if (!statut) {
            if (pourcentageUtilisation > 90) statutFinal = 'critique';
            else if (pourcentageUtilisation > 75) statutFinal = 'congestion';
            else statutFinal = 'normal';
        }

        if (!STATUTS_RESEAU.includes(statutFinal)) {
            return res.status(400).json({
                success: false,
                message: `Statut invalide. Statuts acceptés: ${STATUTS_RESEAU.join(', ')}`
            });
        }

        const result = db.prepare(`
            INSERT INTO etat_reseau (
                zone,
                site,
                bande_passante,
                latence,
                debit_montant,
                debit_descendant,
                utilisation_mbps,
                capacite_mbps,
                pourcentage_utilisation,
                taux_erreur,
                uptime,
                statut,
                derniere_verification
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
            zone,
            site || null,
            bande_passante || null,
            latence || null,
            debit_montant || null,
            debit_descendant || null,
            utilisation_mbps,
            capacite_mbps,
            pourcentageUtilisation.toFixed(2),
            taux_erreur || 0,
            uptime || 100,
            statutFinal
        );

        const etatId = result.lastInsertRowid;

        if (statutFinal === 'critique' || statutFinal === 'panne') {
            const admins = db.prepare(`
                SELECT id FROM utilisateurs
                WHERE role IN ('admin', 'dj', 'superviseur') AND actif = 1
            `).all();

            const insertNotif = db.prepare(`
                INSERT INTO notifications (utilisateur_id, type, titre, message, donnees)
                VALUES (?, 'systeme', ?, ?, ?)
            `);

            const emoji = statutFinal === 'panne' ? '🚨' : '⚠️';
            const message = statutFinal === 'panne'
                ? `Panne réseau détectée dans la zone ${zone}`
                : `Congestion critique dans la zone ${zone}: ${pourcentageUtilisation.toFixed(1)}% utilisé`;

            admins.forEach(admin => {
                insertNotif.run(
                    admin.id,
                    `${emoji} Alerte Réseau - ${zone}`,
                    message,
                    JSON.stringify({ zone, utilisation: pourcentageUtilisation.toFixed(1), statut: statutFinal })
                );
            });
        }

        logUserAction(req, 'AJOUT_ETAT_RESEAU', {
            table: 'etat_reseau',
            recordId: etatId,
            zone: zone,
            statut: statutFinal,
            utilisation: pourcentageUtilisation.toFixed(1)
        });

        updateStatistiquesReseau(db);

        return res.status(201).json({
            success: true,
            message: 'État réseau enregistré avec succès',
            id: etatId,
            statut: statutFinal,
            pourcentage_utilisation: pourcentageUtilisation.toFixed(1) + '%'
        });

    } catch (error) {
        console.error('❌ Erreur d\'enregistrement de l\'état réseau:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// PUT /reseau/etat/:id - MODIFIER UN ÉTAT RÉSEAU
// ========================================================

router.put('/etat/:id', authenticate, hasPermission('modifier_reseau'), isAdmin, (req, res) => {
    try {
        const etatId = parseInt(req.params.id);
        const {
            zone,
            site,
            bande_passante,
            latence,
            debit_montant,
            debit_descendant,
            utilisation_mbps,
            capacite_mbps,
            taux_erreur,
            uptime,
            statut
        } = req.body;

        const db = getDb();

        const etat = db.prepare('SELECT * FROM etat_reseau WHERE id = ?').get(etatId);
        if (!etat) {
            return res.status(404).json({
                success: false,
                message: 'État réseau non trouvé'
            });
        }

        if (statut && !STATUTS_RESEAU.includes(statut)) {
            return res.status(400).json({
                success: false,
                message: `Statut invalide. Statuts acceptés: ${STATUTS_RESEAU.join(', ')}`
            });
        }

        let pourcentageUtilisation = etat.pourcentage_utilisation;
        if (utilisation_mbps !== undefined && capacite_mbps) {
            pourcentageUtilisation = (utilisation_mbps / capacite_mbps) * 100;
        }

        db.prepare(`
            UPDATE etat_reseau
            SET zone = COALESCE(?, zone),
                site = COALESCE(?, site),
                bande_passante = COALESCE(?, bande_passante),
                latence = COALESCE(?, latence),
                debit_montant = COALESCE(?, debit_montant),
                debit_descendant = COALESCE(?, debit_descendant),
                utilisation_mbps = COALESCE(?, utilisation_mbps),
                capacite_mbps = COALESCE(?, capacite_mbps),
                pourcentage_utilisation = COALESCE(?, pourcentage_utilisation),
                taux_erreur = COALESCE(?, taux_erreur),
                uptime = COALESCE(?, uptime),
                statut = COALESCE(?, statut),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            zone || null,
            site || null,
            bande_passante || null,
            latence || null,
            debit_montant || null,
            debit_descendant || null,
            utilisation_mbps || null,
            capacite_mbps || null,
            pourcentageUtilisation || null,
            taux_erreur || null,
            uptime || null,
            statut || null,
            etatId
        );

        logUserAction(req, 'MODIFICATION_ETAT_RESEAU', {
            table: 'etat_reseau',
            recordId: etatId,
            zone: zone || etat.zone
        });

        return res.json({
            success: true,
            message: 'État réseau modifié avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur de modification de l\'état réseau:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /reseau/statistiques - STATISTIQUES RÉSEAU
// ========================================================

router.get('/statistiques', authenticate, hasPermission('voir_statistiques'), isSuperviseur, (req, res) => {
    try {
        const db = getDb();

        const totalMesures = db.prepare('SELECT COUNT(*) as count FROM etat_reseau').get();

        const zonesData = db.prepare(`
            SELECT
                zone,
                statut,
                pourcentage_utilisation,
                uptime,
                derniere_verification
            FROM etat_reseau
            ORDER BY zone, derniere_verification DESC
        `).all();

        const zoneMap = new Map();
        zonesData.forEach(row => {
            if (!zoneMap.has(row.zone)) {
                zoneMap.set(row.zone, row);
            }
        });

        const dernierEtat = Array.from(zoneMap.values());

        const stats = {
            zones_total: dernierEtat.length,
            zones_critiques: dernierEtat.filter(e => e.statut === 'critique' || e.statut === 'panne').length,
            zones_congestion: dernierEtat.filter(e => e.statut === 'congestion').length,
            zones_operationnelles: dernierEtat.filter(e => e.statut === 'operationnel' || e.statut === 'normal').length,
            utilisation_moyenne: dernierEtat.length > 0
                ? (dernierEtat.reduce((acc, e) => acc + (e.pourcentage_utilisation || 0), 0) / dernierEtat.length).toFixed(1)
                : 0,
            uptime_moyen: dernierEtat.length > 0
                ? (dernierEtat.reduce((acc, e) => acc + (e.uptime || 0), 0) / dernierEtat.length).toFixed(1)
                : 0,
            taux_operationnel: dernierEtat.length > 0
                ? ((dernierEtat.filter(e => e.statut === 'operationnel' || e.statut === 'normal').length / dernierEtat.length) * 100).toFixed(1) + '%'
                : '0%'
        };

        return res.json({
            success: true,
            total_mesures: totalMesures.count,
            statistiques: stats,
            data: dernierEtat
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des statistiques réseau:', error);
        return res.json({
            success: true,
            total_mesures: 0,
            statistiques: {
                zones_total: 0,
                zones_critiques: 0,
                zones_congestion: 0,
                zones_operationnelles: 0,
                utilisation_moyenne: 0,
                uptime_moyen: 0,
                taux_operationnel: '0%'
            },
            data: []
        });
    }
});

// ========================================================
// GET /reseau/alertes - ALERTES RÉSEAU
// ========================================================

router.get('/alertes', authenticate, hasPermission('voir_reseau'), isSuperviseur, (req, res) => {
    try {
        const db = getDb();
        const { statut = 'critique', limit = 50 } = req.query;

        const alertes = db.prepare(`
            SELECT
                id,
                zone,
                site,
                statut,
                pourcentage_utilisation,
                utilisation_mbps,
                capacite_mbps,
                derniere_verification,
                created_at
            FROM etat_reseau
            WHERE statut IN ('critique', 'panne', 'congestion')
            ORDER BY derniere_verification DESC
            LIMIT ?
        `).all(parseInt(limit));

        const stats = {
            total: alertes.length,
            critiques: alertes.filter(a => a.statut === 'critique' || a.statut === 'panne').length,
            congestion: alertes.filter(a => a.statut === 'congestion').length,
            zones_impactees: [...new Set(alertes.map(a => a.zone))].length
        };

        return res.json({
            success: true,
            statistiques: stats,
            data: alertes
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des alertes réseau:', error);
        return res.json({
            success: true,
            statistiques: {
                total: 0,
                critiques: 0,
                congestion: 0,
                zones_impactees: 0
            },
            data: []
        });
    }
});

// ========================================================
// GET /reseau/zones - LISTE DES ZONES
// ========================================================

router.get('/zones', authenticate, hasPermission('voir_reseau'), isTechnicien, (req, res) => {
    try {
        const db = getDb();

        const zones = db.prepare(`
            SELECT
                zone,
                COUNT(*) as nombre_mesures,
                MAX(derniere_verification) as derniere_mesure,
                MIN(pourcentage_utilisation) as utilisation_min,
                MAX(pourcentage_utilisation) as utilisation_max,
                AVG(pourcentage_utilisation) as utilisation_moyenne,
                statut
            FROM etat_reseau
            GROUP BY zone
            ORDER BY zone
        `).all();

        return res.json({
            success: true,
            count: zones.length,
            data: zones
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des zones:', error);
        return res.json({
            success: true,
            count: 0,
            data: []
        });
    }
});

// ========================================================
// GET /reseau/historique/:zone - HISTORIQUE D'UNE ZONE
// ========================================================

router.get('/historique/:zone', authenticate, hasPermission('voir_reseau'), isSuperviseur, (req, res) => {
    try {
        const db = getDb();
        const { zone } = req.params;
        const { jours = 30, limit = 100 } = req.query;

        const data = db.prepare(`
            SELECT
                id,
                zone,
                site,
                bande_passante,
                latence,
                debit_montant,
                debit_descendant,
                utilisation_mbps,
                capacite_mbps,
                pourcentage_utilisation,
                taux_erreur,
                uptime,
                statut,
                derniere_verification,
                created_at
            FROM etat_reseau
            WHERE zone = ? AND derniere_verification >= date('now', ? || ' days')
            ORDER BY derniere_verification DESC
            LIMIT ?
        `).all(zone, `-${parseInt(jours)}`, parseInt(limit));

        if (data.length === 0) {
            return res.json({
                success: true,
                message: 'Aucune donnée pour cette zone',
                statistiques: null,
                data: []
            });
        }

        const stats = {
            zone: zone,
            periode: `${jours} jours`,
            nombre_mesures: data.length,
            utilisation_min: Math.min(...data.map(d => d.pourcentage_utilisation)),
            utilisation_max: Math.max(...data.map(d => d.pourcentage_utilisation)),
            utilisation_moyenne: data.reduce((acc, d) => acc + d.pourcentage_utilisation, 0) / data.length,
            statut_actuel: data[0].statut
        };

        return res.json({
            success: true,
            statistiques: stats,
            data: data
        });

    } catch (error) {
        console.error('❌ Erreur de récupération de l\'historique:', error);
        return res.json({
            success: true,
            statistiques: null,
            data: []
        });
    }
});

// ========================================================
// GET /reseau/performance - PERFORMANCE GLOBALE
// ========================================================

router.get('/performance', authenticate, hasPermission('voir_reseau'), isSuperviseur, (req, res) => {
    try {
        const db = getDb();

        const performance24h = db.prepare(`
            SELECT
                AVG(pourcentage_utilisation) as utilisation_moyenne,
                AVG(uptime) as uptime_moyen,
                AVG(latence) as latence_moyenne,
                AVG(taux_erreur) as taux_erreur_moyen,
                COUNT(*) as nombre_mesures
            FROM etat_reseau
            WHERE derniere_verification >= datetime('now', '-24 hours')
        `).get();

        const performanceParZone = db.prepare(`
            SELECT
                zone,
                AVG(pourcentage_utilisation) as utilisation_moyenne,
                AVG(uptime) as uptime_moyen,
                MAX(pourcentage_utilisation) as utilisation_max,
                MIN(pourcentage_utilisation) as utilisation_min,
                COUNT(*) as nombre_mesures
            FROM etat_reseau
            WHERE derniere_verification >= datetime('now', '-24 hours')
            GROUP BY zone
            ORDER BY utilisation_moyenne DESC
        `).all();

        const indicateurs = {
            taux_disponibilite: performance24h?.uptime_moyen || 0,
            utilisation_moyenne: performance24h?.utilisation_moyenne || 0,
            latence_moyenne: performance24h?.latence_moyenne || 0,
            taux_erreur: performance24h?.taux_erreur_moyen || 0,
            score_global: calculatePerformanceScore(performance24h)
        };

        return res.json({
            success: true,
            periode: '24 heures',
            indicateurs: indicateurs,
            par_zone: performanceParZone || [],
            nombre_mesures: performance24h?.nombre_mesures || 0
        });

    } catch (error) {
        console.error('❌ Erreur de récupération de la performance:', error);
        return res.json({
            success: true,
            periode: '24 heures',
            indicateurs: {
                taux_disponibilite: 0,
                utilisation_moyenne: 0,
                latence_moyenne: 0,
                taux_erreur: 0,
                score_global: 0
            },
            par_zone: [],
            nombre_mesures: 0
        });
    }
});

// ========================================================
// FONCTIONS UTILITAIRES
// ========================================================

function calculatePerformanceScore(data) {
    if (!data) return 0;

    let score = 0;

    const uptimeScore = (data.uptime_moyen || 0) * 0.4;
    score += uptimeScore;

    const utilisation = data.utilisation_moyenne || 100;
    const utilisationScore = Math.max(0, (100 - utilisation) * 0.3);
    score += utilisationScore;

    const latence = data.latence_moyenne || 100;
    const latenceScore = Math.max(0, (100 - (latence / 10)) * 0.2);
    score += latenceScore;

    const erreur = data.taux_erreur_moyen || 0;
    const erreurScore = Math.max(0, (100 - erreur * 100) * 0.1);
    score += erreurScore;

    return Math.min(100, Math.round(score));
}

function updateStatistiquesReseau(db) {
    try {
        const stats = db.prepare(`
            SELECT
                COUNT(DISTINCT zone) as zones_total,
                SUM(CASE WHEN statut IN ('critique', 'panne') THEN 1 ELSE 0 END) as zones_critiques,
                AVG(pourcentage_utilisation) as utilisation_moyenne
            FROM (
                SELECT zone, statut, pourcentage_utilisation,
                       ROW_NUMBER() OVER (PARTITION BY zone ORDER BY derniere_verification DESC) as rn
                FROM etat_reseau
            ) WHERE rn = 1
        `).get();

        const insertStat = db.prepare(`
            INSERT OR REPLACE INTO statistiques (type_stat, valeur, date_calcul, updated_at)
            VALUES (?, ?, date('now'), CURRENT_TIMESTAMP)
        `);

        insertStat.run('zones_reseau_total', stats?.zones_total || 0);
        insertStat.run('zones_reseau_critiques', stats?.zones_critiques || 0);
        insertStat.run('utilisation_reseau_moyenne', Math.round(stats?.utilisation_moyenne || 0));

    } catch (error) {
        console.error('❌ Erreur de mise à jour des statistiques réseau:', error);
    }
}

module.exports = router;