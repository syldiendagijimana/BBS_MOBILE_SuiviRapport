const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const {
    authenticate,
    isAdmin,
    isSuperviseur,
    isAdminOrDJ,
    isTechnicien,
    isSuperviseurOrAdmin,
    hasPermission,
} = require('../middleware/auth');

// ========================================================
// GET /statistiques/dashboard - DASHBOARD GÉNÉRAL
// ========================================================

router.get('/dashboard', authenticate, hasPermission('voir_statistiques'), isSuperviseur, (req, res) => {
    try {
        const db = getDb();

        // 1. Statistiques des rapports
        const totalRapports = db.prepare("SELECT COUNT(*) as count FROM rapports").get().count;
        const rapportsMois = db.prepare(`
            SELECT COUNT(*) as count FROM rapports
            WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
        `).get().count;
        const rapportsSemaine = db.prepare(`
            SELECT COUNT(*) as count FROM rapports
            WHERE created_at >= date('now', '-7 days')
        `).get().count;

        // 2. Temps moyen d'intervention
        const tempsRepDB = db.prepare(`
            SELECT AVG(duree_intervention) as avg_minutes
            FROM rapports
            WHERE duree_intervention IS NOT NULL
        `).get();
        const tempsMoyenIntervention = tempsRepDB?.avg_minutes ? Math.round(tempsRepDB.avg_minutes) : 0;

        // 3. Statistiques des incidents
        const incidentsOuverts = db.prepare("SELECT COUNT(*) as count FROM incidents WHERE statut IN ('ouvert','en_cours')").get().count;
        const incidentsResolus = db.prepare("SELECT COUNT(*) as count FROM incidents WHERE statut = 'resolu'").get().count;
        const incidentsCritiques = db.prepare("SELECT COUNT(*) as count FROM incidents WHERE severite = 'critique' AND statut != 'resolu'").get().count;

        // 4. Statistiques des missions
        const missionsEnCours = db.prepare("SELECT COUNT(*) as count FROM missions WHERE statut = 'en_cours'").get().count;
        const missionsPlanifiees = db.prepare("SELECT COUNT(*) as count FROM missions WHERE statut = 'planifiee'").get().count;
        const missionsTerminees = db.prepare("SELECT COUNT(*) as count FROM missions WHERE statut = 'terminee'").get().count;

        // 5. Statistiques des techniciens
        const totalTechniciens = db.prepare("SELECT COUNT(*) as count FROM techniciens").get().count;
        const techDisponibles = db.prepare("SELECT COUNT(*) as count FROM techniciens WHERE disponible = 1").get().count;
        const techEnMission = db.prepare("SELECT COUNT(*) as count FROM techniciens WHERE en_mission = 1").get().count;

        // 6. État du réseau (dernières mesures)
        const congestionZones = db.prepare(`
            SELECT
                e1.zone,
                e1.statut,
                e1.pourcentage_utilisation,
                e1.bande_passante
            FROM etat_reseau e1
            INNER JOIN (
                SELECT zone, MAX(derniere_verification) as max_date
                FROM etat_reseau
                GROUP BY zone
            ) e2 ON e1.zone = e2.zone AND e1.derniere_verification = e2.max_date
            WHERE e1.statut IN ('critique', 'congestion', 'panne')
            ORDER BY e1.pourcentage_utilisation DESC
        `).all();

        // 7. Évolution des rapports par mois (12 derniers mois)
        const rapportsParMois = db.prepare(`
            SELECT
                strftime('%Y-%m', created_at) as mois,
                COUNT(*) as count
            FROM rapports
            WHERE created_at >= date('now', '-12 months')
            GROUP BY mois
            ORDER BY mois DESC
        `).all();

        // 8. Incidents par sévérité
        const incidentsParSeverite = db.prepare(`
            SELECT severite, COUNT(*) as count
            FROM incidents
            GROUP BY severite
        `).all();

        // 9. Missions par priorité
        const missionsParPriorite = db.prepare(`
            SELECT priorite, COUNT(*) as count
            FROM missions
            GROUP BY priorite
        `).all();

        // 10. Top techniciens (plus de rapports)
        const topTechniciens = db.prepare(`
            SELECT
                u.nom,
                u.prenom,
                t.matricule,
                COUNT(r.id) as rapports_count,
                COUNT(DISTINCT m.id) as missions_count
            FROM techniciens t
            LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
            LEFT JOIN rapports r ON t.id = r.technicien_id
            LEFT JOIN missions m ON t.id = m.technicien_id
            GROUP BY t.id
            ORDER BY rapports_count DESC
            LIMIT 5
        `).all();

        // 11. Notifications non lues
        const notifsNonLues = db.prepare(`
            SELECT COUNT(*) as count
            FROM notifications
            WHERE utilisateur_id = ? AND est_lu = 0
        `).get(req.userId);

        // 12. Taux de résolution des incidents
        const totalIncidents = db.prepare("SELECT COUNT(*) as count FROM incidents").get().count;
        const tauxResolution = totalIncidents > 0
            ? ((incidentsResolus / totalIncidents) * 100).toFixed(1)
            : 0;

        // 13. Statistiques des utilisateurs
        const totalUtilisateurs = db.prepare("SELECT COUNT(*) as count FROM utilisateurs WHERE actif = 1").get().count;
        const utilisateursParRole = db.prepare(`
            SELECT role, COUNT(*) as count
            FROM utilisateurs
            WHERE actif = 1
            GROUP BY role
        `).all();

        return res.json({
            success: true,
            data: {
                rapports: {
                    total: totalRapports,
                    mois: rapportsMois,
                    semaine: rapportsSemaine,
                    temps_moyen_intervention: tempsMoyenIntervention + ' min'
                },
                incidents: {
                    ouverts: incidentsOuverts,
                    resolus: incidentsResolus,
                    critiques: incidentsCritiques,
                    taux_resolution: tauxResolution + '%',
                    par_severite: incidentsParSeverite
                },
                missions: {
                    en_cours: missionsEnCours,
                    planifiees: missionsPlanifiees,
                    terminees: missionsTerminees,
                    par_priorite: missionsParPriorite
                },
                techniciens: {
                    total: totalTechniciens,
                    disponibles: techDisponibles,
                    en_mission: techEnMission,
                    top_techniciens: topTechniciens
                },
                reseau: {
                    zones_congestion: congestionZones,
                    total_zones: congestionZones.length
                },
                utilisateurs: {
                    total: totalUtilisateurs,
                    par_role: utilisateursParRole
                },
                notifications_non_lues: notifsNonLues?.count || 0,
                evolution_rapports: rapportsParMois
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération du dashboard:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /statistiques/rapports - STATISTIQUES DES RAPPORTS
// ========================================================

router.get('/rapports', authenticate, hasPermission('voir_statistiques'), isSuperviseur, (req, res) => {
    try {
        const db = getDb();
        const { periode = 'mois' } = req.query;

        let dateCondition = '';
        if (periode === 'semaine') {
            dateCondition = "created_at >= date('now', '-7 days')";
        } else if (periode === 'mois') {
            dateCondition = "created_at >= date('now', '-30 days')";
        } else if (periode === 'trimestre') {
            dateCondition = "created_at >= date('now', '-90 days')";
        } else if (periode === 'annee') {
            dateCondition = "created_at >= date('now', '-365 days')";
        }

        const whereClause = dateCondition ? `WHERE ${dateCondition}` : '';

        const total = db.prepare(`SELECT COUNT(*) as count FROM rapports ${whereClause}`).get().count;

        const parStatut = db.prepare(`
            SELECT statut, COUNT(*) as count
            FROM rapports ${whereClause}
            GROUP BY statut
        `).all();

        const parType = db.prepare(`
            SELECT type_intervention, COUNT(*) as count
            FROM rapports ${whereClause}
            WHERE type_intervention IS NOT NULL
            GROUP BY type_intervention
        `).all();

        const parTechnicien = db.prepare(`
            SELECT
                u.nom,
                u.prenom,
                COUNT(r.id) as count
            FROM rapports r
            LEFT JOIN techniciens t ON r.technicien_id = t.id
            LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
            ${whereClause}
            GROUP BY r.technicien_id
            ORDER BY count DESC
            LIMIT 10
        `).all();

        const parMois = db.prepare(`
            SELECT
                strftime('%Y-%m', created_at) as mois,
                COUNT(*) as count
            FROM rapports
            ${dateCondition ? `WHERE ${dateCondition}` : ''}
            GROUP BY strftime('%Y-%m', created_at)
            ORDER BY mois DESC
        `).all();

        const tempsMoyen = db.prepare(`
            SELECT AVG(duree_intervention) as avg_minutes
            FROM rapports ${whereClause}
            WHERE duree_intervention IS NOT NULL
        `).get();

        return res.json({
            success: true,
            statistiques: {
                total: total,
                par_statut: parStatut,
                par_type_intervention: parType,
                par_technicien: parTechnicien,
                par_mois: parMois,
                temps_moyen_intervention: tempsMoyen?.avg_minutes ? Math.round(tempsMoyen.avg_minutes) + ' min' : 'N/A'
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des statistiques des rapports:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /statistiques/missions - STATISTIQUES DES MISSIONS
// ========================================================

router.get('/missions', authenticate, hasPermission('voir_statistiques'), isSuperviseur, (req, res) => {
    try {
        const db = getDb();

        const total = db.prepare("SELECT COUNT(*) as count FROM missions").get().count;

        const parStatut = db.prepare(`
            SELECT statut, COUNT(*) as count
            FROM missions
            GROUP BY statut
        `).all();

        const parPriorite = db.prepare(`
            SELECT priorite, COUNT(*) as count
            FROM missions
            GROUP BY priorite
        `).all();

        const parType = db.prepare(`
            SELECT type_mission, COUNT(*) as count
            FROM missions
            WHERE type_mission IS NOT NULL
            GROUP BY type_mission
        `).all();

        const parSuperviseur = db.prepare(`
            SELECT
                u.nom,
                u.prenom,
                COUNT(m.id) as count
            FROM missions m
            LEFT JOIN superviseurs s ON m.superviseur_id = s.id
            LEFT JOIN utilisateurs u ON s.utilisateur_id = u.id
            GROUP BY m.superviseur_id
            ORDER BY count DESC
            LIMIT 10
        `).all();

        const parTechnicien = db.prepare(`
            SELECT
                u.nom,
                u.prenom,
                COUNT(m.id) as count,
                SUM(CASE WHEN m.statut = 'terminee' THEN 1 ELSE 0 END) as terminees
            FROM missions m
            LEFT JOIN techniciens t ON m.technicien_id = t.id
            LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
            WHERE m.technicien_id IS NOT NULL
            GROUP BY m.technicien_id
            ORDER BY count DESC
            LIMIT 10
        `).all();

        const tempsMoyen = db.prepare(`
            SELECT
                AVG(julianday(date_fin_reelle) - julianday(date_debut)) as jours
            FROM missions
            WHERE statut = 'terminee' AND date_fin_reelle IS NOT NULL
        `).get();

        return res.json({
            success: true,
            statistiques: {
                total: total,
                par_statut: parStatut,
                par_priorite: parPriorite,
                par_type: parType,
                par_superviseur: parSuperviseur,
                par_technicien: parTechnicien,
                temps_moyen_realisation: tempsMoyen?.jours ? Math.round(tempsMoyen.jours) + ' jours' : 'N/A',
                taux_realisation: total > 0 ? ((parStatut.find(s => s.statut === 'terminee')?.count || 0) / total * 100).toFixed(1) + '%' : '0%'
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des statistiques des missions:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /statistiques/incidents - STATISTIQUES DES INCIDENTS
// ========================================================

router.get('/incidents', authenticate, hasPermission('voir_statistiques'), isSuperviseur, (req, res) => {
    try {
        const db = getDb();

        const total = db.prepare("SELECT COUNT(*) as count FROM incidents").get().count;

        const parStatut = db.prepare(`
            SELECT statut, COUNT(*) as count
            FROM incidents
            GROUP BY statut
        `).all();

        const parSeverite = db.prepare(`
            SELECT severite, COUNT(*) as count
            FROM incidents
            GROUP BY severite
        `).all();

        const parType = db.prepare(`
            SELECT type_incident, COUNT(*) as count
            FROM incidents
            WHERE type_incident IS NOT NULL
            GROUP BY type_incident
        `).all();

        const parTechnicien = db.prepare(`
            SELECT
                u.nom,
                u.prenom,
                COUNT(i.id) as count,
                SUM(CASE WHEN i.statut = 'resolu' THEN 1 ELSE 0 END) as resolus
            FROM incidents i
            LEFT JOIN techniciens t ON i.technicien_id = t.id
            LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
            WHERE i.technicien_id IS NOT NULL
            GROUP BY i.technicien_id
            ORDER BY count DESC
            LIMIT 10
        `).all();

        const tempsMoyen = db.prepare(`
            SELECT
                AVG(julianday(date_resolution) - julianday(date_incident)) as jours
            FROM incidents
            WHERE statut IN ('resolu', 'ferme') AND date_resolution IS NOT NULL
        `).get();

        const totalResolus = parStatut.find(s => s.statut === 'resolu')?.count || 0;

        return res.json({
            success: true,
            statistiques: {
                total: total,
                par_statut: parStatut,
                par_severite: parSeverite,
                par_type: parType,
                par_technicien: parTechnicien,
                temps_moyen_resolution: tempsMoyen?.jours ? Math.round(tempsMoyen.jours) + ' jours' : 'N/A',
                taux_resolution: total > 0 ? ((totalResolus / total) * 100).toFixed(1) + '%' : '0%'
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des statistiques des incidents:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /statistiques/techniciens - STATISTIQUES DES TECHNICIENS
// ========================================================

router.get('/techniciens', authenticate, hasPermission('voir_statistiques'), isSuperviseur, (req, res) => {
    try {
        const db = getDb();

        const total = db.prepare("SELECT COUNT(*) as count FROM techniciens").get().count;
        const disponibles = db.prepare("SELECT COUNT(*) as count FROM techniciens WHERE disponible = 1").get().count;
        const enMission = db.prepare("SELECT COUNT(*) as count FROM techniciens WHERE en_mission = 1").get().count;

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

        const performance = db.prepare(`
            SELECT
                u.nom,
                u.prenom,
                t.matricule,
                COUNT(DISTINCT r.id) as rapports,
                COUNT(DISTINCT m.id) as missions,
                SUM(CASE WHEN m.statut = 'terminee' THEN 1 ELSE 0 END) as missions_terminees,
                ROUND(AVG(r.duree_intervention), 0) as temps_moyen
            FROM techniciens t
            LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
            LEFT JOIN rapports r ON t.id = r.technicien_id
            LEFT JOIN missions m ON t.id = m.technicien_id
            GROUP BY t.id
            ORDER BY rapports DESC
            LIMIT 20
        `).all();

        return res.json({
            success: true,
            statistiques: {
                total: total,
                disponibles: disponibles,
                en_mission: enMission,
                taux_disponibilite: total > 0 ? ((disponibles / total) * 100).toFixed(1) + '%' : '0%',
                par_specialite: parSpecialite,
                par_zone: parZone,
                performance: performance
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des statistiques des techniciens:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /statistiques/reseau - STATISTIQUES DU RÉSEAU
// ========================================================

router.get('/reseau', authenticate, hasPermission('voir_statistiques'), isSuperviseur, (req, res) => {
    try {
        const db = getDb();

        const dernierEtat = db.prepare(`
            SELECT
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
            FROM etat_reseau
            WHERE derniere_verification IN (
                SELECT MAX(derniere_verification)
                FROM etat_reseau
                GROUP BY zone
            )
            ORDER BY zone
        `).all();

        const stats = {
            total_zones: dernierEtat.length,
            zones_critiques: dernierEtat.filter(e => e.statut === 'critique' || e.statut === 'panne').length,
            zones_congestion: dernierEtat.filter(e => e.statut === 'congestion').length,
            zones_operationnelles: dernierEtat.filter(e => e.statut === 'operationnel' || e.statut === 'normal').length,
            utilisation_moyenne: dernierEtat.length > 0
                ? (dernierEtat.reduce((acc, e) => acc + e.pourcentage_utilisation, 0) / dernierEtat.length).toFixed(1)
                : 0,
            uptime_moyen: dernierEtat.length > 0
                ? (dernierEtat.reduce((acc, e) => acc + e.uptime, 0) / dernierEtat.length).toFixed(1)
                : 0,
            bande_passante_moyenne: dernierEtat.length > 0
                ? (dernierEtat.reduce((acc, e) => acc + e.bande_passante, 0) / dernierEtat.length).toFixed(2)
                : 0,
            latence_moyenne: dernierEtat.length > 0
                ? Math.round(dernierEtat.reduce((acc, e) => acc + e.latence, 0) / dernierEtat.length)
                : 0
        };

        const evolution = db.prepare(`
            SELECT
                date(derniere_verification) as date,
                AVG(pourcentage_utilisation) as utilisation_moyenne,
                AVG(uptime) as uptime_moyen,
                COUNT(*) as nombre_mesures
            FROM etat_reseau
            WHERE derniere_verification >= date('now', '-7 days')
            GROUP BY date(derniere_verification)
            ORDER BY date DESC
        `).all();

        return res.json({
            success: true,
            statistiques: stats,
            details: dernierEtat,
            evolution: evolution
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des statistiques du réseau:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /statistiques/performance - PERFORMANCE GLOBALE
// ========================================================

router.get('/performance', authenticate, hasPermission('voir_statistiques'), isAdminOrDJ, (req, res) => {
    try {
        const db = getDb();

        const performance = db.prepare(`
            SELECT
                (SELECT COUNT(*) FROM rapports WHERE created_at >= date('now', '-30 days')) as rapports_30j,
                (SELECT COUNT(*) FROM missions WHERE statut = 'terminee' AND date_fin_reelle >= date('now', '-30 days')) as missions_terminees_30j,
                (SELECT COUNT(*) FROM incidents WHERE statut = 'resolu' AND date_resolution >= date('now', '-30 days')) as incidents_resolus_30j,
                (SELECT AVG(duree_intervention) FROM rapports WHERE duree_intervention IS NOT NULL) as temps_moyen_intervention,
                (SELECT AVG(julianday(date_resolution) - julianday(date_incident)) FROM incidents WHERE statut = 'resolu' AND date_resolution IS NOT NULL) as temps_moyen_resolution,
                (SELECT COUNT(*) FROM utilisateurs WHERE actif = 1) as utilisateurs_actifs,
                (SELECT COUNT(*) FROM techniciens WHERE disponible = 1) as techniciens_disponibles
        `).get();

        const score = calculateGlobalPerformanceScore(performance);

        return res.json({
            success: true,
            periode: '30 jours',
            score_global: score,
            indicateurs: {
                rapports_30j: performance?.rapports_30j || 0,
                missions_terminees_30j: performance?.missions_terminees_30j || 0,
                incidents_resolus_30j: performance?.incidents_resolus_30j || 0,
                temps_moyen_intervention: performance?.temps_moyen_intervention ? Math.round(performance.temps_moyen_intervention) + ' min' : 'N/A',
                temps_moyen_resolution: performance?.temps_moyen_resolution ? Math.round(performance.temps_moyen_resolution) + ' jours' : 'N/A',
                utilisateurs_actifs: performance?.utilisateurs_actifs || 0,
                techniciens_disponibles: performance?.techniciens_disponibles || 0
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération de la performance:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /statistiques/rapport-mensuel - RAPPORT MENSUEL
// ========================================================

router.get('/rapport-mensuel', authenticate, hasPermission('voir_statistiques'), isSuperviseur, (req, res) => {
    try {
        const db = getDb();
        const { mois, annee } = req.query;
        const periode = mois && annee ? `${annee}-${mois.padStart(2, '0')}` : new Date().toISOString().slice(0, 7);

        const rapports = db.prepare(`
            SELECT
                r.*,
                t.matricule,
                u.nom,
                u.prenom
            FROM rapports r
            LEFT JOIN techniciens t ON r.technicien_id = t.id
            LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
            WHERE strftime('%Y-%m', r.created_at) = ?
            ORDER BY r.created_at DESC
        `).all(periode);

        const incidents = db.prepare(`
            SELECT
                i.*,
                u.nom,
                u.prenom
            FROM incidents i
            LEFT JOIN utilisateurs u ON i.technicien_id = u.id
            WHERE strftime('%Y-%m', i.created_at) = ?
            ORDER BY i.created_at DESC
        `).all(periode);

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
            WHERE strftime('%Y-%m', m.created_at) = ?
            ORDER BY m.created_at DESC
        `).all(periode);

        const performanceReseau = db.prepare(`
            SELECT
                zone,
                AVG(pourcentage_utilisation) as utilisation_moyenne,
                MAX(pourcentage_utilisation) as utilisation_max,
                MIN(pourcentage_utilisation) as utilisation_min
            FROM etat_reseau
            WHERE strftime('%Y-%m', derniere_verification) = ?
            GROUP BY zone
        `).all(periode);

        const stats = {
            total_rapports: rapports.length,
            total_incidents: incidents.length,
            total_missions: missions.length,
            rapports_par_technicien: rapports.reduce((acc, r) => {
                const key = `${r.prenom || ''} ${r.nom || ''}`.trim() || 'Inconnu';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {})
        };

        return res.json({
            success: true,
            periode: periode,
            statistiques: stats,
            rapports: rapports,
            incidents: incidents,
            missions: missions,
            performance_reseau: performanceReseau
        });

    } catch (error) {
        console.error('❌ Erreur de récupération du rapport mensuel:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// 🆕 GET /statistiques/technicien/:id - STATS D'UN TECHNICIEN (CORRIGÉ)
// ========================================================

router.get('/technicien/:id', authenticate, (req, res) => {
    try {
        const db = getDb();
        const technicienId = parseInt(req.params.id);

        // Vérifier que le technicien existe
        const technicien = db.prepare(`
            SELECT t.*, u.nom, u.prenom, u.email
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

        // Autoriser si :
        // - l'utilisateur est admin, superviseur ou DJ (ils ont accès à tout)
        // - ou si c'est le technicien lui-même (on vérifie l'ID du technicien associé à l'utilisateur)
        const isAdminOrSuperviseur = ['admin', 'superviseur', 'dj'].includes(req.userRole);
        if (!isAdminOrSuperviseur) {
            const techUser = db.prepare('SELECT id FROM techniciens WHERE utilisateur_id = ?').get(req.userId);
            if (!techUser || techUser.id !== technicienId) {
                return res.status(403).json({
                    success: false,
                    message: 'Accès refusé - Vous ne pouvez consulter que vos propres statistiques'
                });
            }
        }

        // Statistiques des missions
        const missions = db.prepare(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN statut = 'terminee' THEN 1 ELSE 0 END) as terminees,
                SUM(CASE WHEN statut = 'en_cours' THEN 1 ELSE 0 END) as en_cours,
                SUM(CASE WHEN statut = 'planifiee' THEN 1 ELSE 0 END) as planifiees
            FROM missions
            WHERE technicien_id = ?
        `).get(technicienId);

        // Statistiques des rapports
        const rapports = db.prepare(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN statut = 'approuve' THEN 1 ELSE 0 END) as approuves,
                SUM(CASE WHEN statut = 'soumis' THEN 1 ELSE 0 END) as soumis,
                SUM(CASE WHEN statut = 'rejete' THEN 1 ELSE 0 END) as rejetes
            FROM rapports
            WHERE technicien_id = ?
        `).get(technicienId);

        // Statistiques des incidents
        const incidents = db.prepare(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN statut = 'resolu' THEN 1 ELSE 0 END) as resolus,
                SUM(CASE WHEN statut = 'ouvert' THEN 1 ELSE 0 END) as ouverts
            FROM incidents
            WHERE technicien_id = ?
        `).get(technicienId);

        // Dernières missions
        const dernieresMissions = db.prepare(`
            SELECT id, titre, statut, date_debut, date_fin_prevue
            FROM missions
            WHERE technicien_id = ?
            ORDER BY created_at DESC
            LIMIT 5
        `).all(technicienId);

        // Derniers rapports
        const derniersRapports = db.prepare(`
            SELECT id, titre, statut, created_at
            FROM rapports
            WHERE technicien_id = ?
            ORDER BY created_at DESC
            LIMIT 5
        `).all(technicienId);

        return res.json({
            success: true,
            technicien: technicien,
            statistiques: {
                missions: missions,
                rapports: rapports,
                incidents: incidents
            },
            dernieres_missions: dernieresMissions,
            derniers_rapports: derniersRapports
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des statistiques du technicien:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /statistiques/superviseur/:id - STATS D'UN SUPERVISEUR
// ========================================================

router.get('/superviseur/:id', authenticate, hasPermission('voir_statistiques'), isSuperviseur, (req, res) => {
    try {
        const db = getDb();
        const superviseurId = parseInt(req.params.id);

        const superviseur = db.prepare(`
            SELECT s.*, u.nom, u.prenom, u.email
            FROM superviseurs s
            LEFT JOIN utilisateurs u ON s.utilisateur_id = u.id
            WHERE s.id = ?
        `).get(superviseurId);

        if (!superviseur) {
            return res.status(404).json({
                success: false,
                message: 'Superviseur non trouvé'
            });
        }

        const missions = db.prepare(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN statut = 'terminee' THEN 1 ELSE 0 END) as terminees,
                SUM(CASE WHEN statut = 'en_cours' THEN 1 ELSE 0 END) as en_cours
            FROM missions
            WHERE superviseur_id = ?
        `).get(superviseurId);

        const techniciens = db.prepare(`
            SELECT COUNT(*) as count
            FROM techniciens
            WHERE zone_intervention = ?
        `).get(superviseur.zone_responsable);

        const incidents = db.prepare(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN statut = 'resolu' THEN 1 ELSE 0 END) as resolus
            FROM incidents
            WHERE superviseur_id = ?
        `).get(superviseurId);

        return res.json({
            success: true,
            superviseur: superviseur,
            statistiques: {
                missions: missions,
                techniciens_sous_responsabilite: techniciens?.count || 0,
                incidents: incidents,
                taux_resolution_incidents: incidents.total > 0 ? ((incidents.resolus / incidents.total) * 100).toFixed(1) + '%' : '0%',
                taux_realisation_missions: missions.total > 0 ? ((missions.terminees / missions.total) * 100).toFixed(1) + '%' : '0%'
            }
        });

    } catch (error) {
        console.error('❌ Erreur de récupération des statistiques du superviseur:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// GET /statistiques/export - EXPORT CSV
// ========================================================

router.get('/export', authenticate, hasPermission('voir_statistiques'), isAdminOrDJ, (req, res) => {
    try {
        const db = getDb();
        const { type = 'rapports', periode = 'mois' } = req.query;

        let dateCondition = '';
        if (periode === 'semaine') {
            dateCondition = "created_at >= date('now', '-7 days')";
        } else if (periode === 'mois') {
            dateCondition = "created_at >= date('now', '-30 days')";
        } else if (periode === 'trimestre') {
            dateCondition = "created_at >= date('now', '-90 days')";
        } else if (periode === 'annee') {
            dateCondition = "created_at >= date('now', '-365 days')";
        }

        let data = [];
        let headers = [];
        let filename = '';

        if (type === 'rapports') {
            const whereClause = dateCondition ? `WHERE ${dateCondition}` : '';
            data = db.prepare(`
                SELECT
                    r.id,
                    r.titre,
                    r.description,
                    r.statut,
                    r.type_intervention,
                    r.duree_intervention,
                    r.adresse,
                    r.date_intervention,
                    r.created_at,
                    u.nom as technicien_nom,
                    u.prenom as technicien_prenom,
                    t.matricule
                FROM rapports r
                LEFT JOIN techniciens t ON r.technicien_id = t.id
                LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
                ${whereClause}
                ORDER BY r.created_at DESC
            `).all();
            headers = ['ID', 'Titre', 'Description', 'Statut', 'Type', 'Durée (min)', 'Adresse', 'Date Intervention', 'Créé le', 'Technicien', 'Matricule'];
            filename = 'rapports.csv';
        } else if (type === 'missions') {
            const whereClause = dateCondition ? `WHERE ${dateCondition}` : '';
            data = db.prepare(`
                SELECT
                    m.id,
                    m.titre,
                    m.description,
                    m.type_mission,
                    m.priorite,
                    m.statut,
                    m.date_debut,
                    m.date_fin_prevue,
                    m.date_fin_reelle,
                    m.adresse,
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
                ORDER BY m.created_at DESC
            `).all();
            headers = ['ID', 'Titre', 'Description', 'Type', 'Priorité', 'Statut', 'Début', 'Fin Prévue', 'Fin Réelle', 'Adresse', 'Superviseur', 'Technicien'];
            filename = 'missions.csv';
        } else if (type === 'incidents') {
            const whereClause = dateCondition ? `WHERE ${dateCondition}` : '';
            data = db.prepare(`
                SELECT
                    i.id,
                    i.titre,
                    i.description,
                    i.type_incident,
                    i.severite,
                    i.statut,
                    i.zone,
                    i.date_incident,
                    i.date_resolution,
                    u_tech.nom as technicien_nom,
                    u_tech.prenom as technicien_prenom,
                    u_sup.nom as superviseur_nom,
                    u_sup.prenom as superviseur_prenom
                FROM incidents i
                LEFT JOIN techniciens t ON i.technicien_id = t.id
                LEFT JOIN utilisateurs u_tech ON t.utilisateur_id = u_tech.id
                LEFT JOIN superviseurs s ON i.superviseur_id = s.id
                LEFT JOIN utilisateurs u_sup ON s.utilisateur_id = u_sup.id
                ${whereClause}
                ORDER BY i.created_at DESC
            `).all();
            headers = ['ID', 'Titre', 'Description', 'Type', 'Sévérité', 'Statut', 'Zone', 'Date Incident', 'Date Résolution', 'Technicien', 'Superviseur'];
            filename = 'incidents.csv';
        } else {
            return res.status(400).json({
                success: false,
                message: 'Type d\'export invalide. Types acceptés: rapports, missions, incidents'
            });
        }

        let csv = headers.join(',') + '\n';
        data.forEach(row => {
            const values = headers.map(header => {
                const key = Object.keys(row).find(k => {
                    const headerKey = header.toLowerCase().replace(/ /g, '_').replace(/[()]/g, '');
                    return k.toLowerCase() === headerKey || k === header;
                });
                let value = key ? row[key] : '';
                if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                    value = `"${value.replace(/"/g, '""')}"`;
                }
                return value !== null && value !== undefined ? value : '';
            });
            csv += values.join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);

    } catch (error) {
        console.error('❌ Erreur d\'export CSV:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// ========================================================
// FONCTIONS UTILITAIRES
// ========================================================

/**
 * Calcul du score de performance global (0-100)
 */
function calculateGlobalPerformanceScore(data) {
    if (!data) return 0;

    let score = 0;
    let totalPoids = 0;

    if (data.rapports_30j) {
        const rapportScore = Math.min(100, (data.rapports_30j / 50) * 100);
        score += rapportScore * 0.2;
        totalPoids += 0.2;
    }

    if (data.missions_terminees_30j) {
        const missionScore = Math.min(100, (data.missions_terminees_30j / 20) * 100);
        score += missionScore * 0.25;
        totalPoids += 0.25;
    }

    if (data.incidents_resolus_30j) {
        const incidentScore = Math.min(100, (data.incidents_resolus_30j / 10) * 100);
        score += incidentScore * 0.2;
        totalPoids += 0.2;
    }

    if (data.techniciens_disponibles) {
        const techScore = Math.min(100, (data.techniciens_disponibles / 5) * 100);
        score += techScore * 0.15;
        totalPoids += 0.15;
    }

    if (data.temps_moyen_intervention) {
        const tempsScore = Math.max(0, 100 - (data.temps_moyen_intervention / 2));
        score += tempsScore * 0.2;
        totalPoids += 0.2;
    }

    return totalPoids > 0 ? Math.round(score / totalPoids) : 0;
}

// ========================================================
// EXPORT
// ========================================================

module.exports = router;