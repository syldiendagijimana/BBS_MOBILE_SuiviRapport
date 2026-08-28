const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

// ========================================================
// CONFIGURATION
// ========================================================

const DB_PATH = path.join(__dirname, 'bbs.db');
let db;

// ========================================================
// FONCTION PRINCIPALE - OBTENIR LA BASE DE DONNÉES
// ========================================================

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
    migratePermissions(); // <-- MIGRATION AJOUTÉE
    seedData();
  }
  return db;
}

// ========================================================
// CRÉATION DU SCHÉMA
// ========================================================

function initSchema() {
  console.log('🔧 Création du schéma de la base de données...');

  // ------------------------------------------------------
  // 1. TABLE UTILISATEURS
  // ------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS utilisateurs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      mot_de_passe TEXT NOT NULL,
      telephone TEXT,
      role TEXT NOT NULL CHECK(role IN ('admin', 'dj', 'superviseur', 'technicien')),
      avatar TEXT,
      actif INTEGER DEFAULT 1,
      derniere_connexion DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ------------------------------------------------------
  // 2. TABLE TECHNICIENS
  // ------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS techniciens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      utilisateur_id INTEGER UNIQUE NOT NULL,
      matricule TEXT UNIQUE NOT NULL,
      specialite TEXT,
      zone_intervention TEXT,
      telephone TEXT,
      disponible INTEGER DEFAULT 1,
      en_mission INTEGER DEFAULT 0,
      latitude REAL,
      longitude REAL,
      date_embauche DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
    )
  `);

  // ------------------------------------------------------
  // 3. TABLE SUPERVISEURS
  // ------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS superviseurs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      utilisateur_id INTEGER UNIQUE NOT NULL,
      zone_responsable TEXT,
      niveau_experience INTEGER DEFAULT 1 CHECK(niveau_experience BETWEEN 1 AND 5),
      telephone_pro TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
    )
  `);

  // ------------------------------------------------------
  // 4. TABLE MISSIONS
  // ------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      superviseur_id INTEGER NOT NULL,
      technicien_id INTEGER,
      titre TEXT NOT NULL,
      description TEXT,
      type_mission TEXT CHECK(type_mission IN ('installation', 'maintenance', 'reparation', 'inspection', 'urgence')),
      priorite TEXT CHECK(priorite IN ('basse', 'moyenne', 'haute', 'critique')) DEFAULT 'moyenne',
      statut TEXT CHECK(statut IN ('planifiee', 'en_cours', 'terminee', 'annulee')) DEFAULT 'planifiee',
      date_debut DATETIME,
      date_fin_prevue DATETIME,
      date_fin_reelle DATETIME,
      adresse TEXT,
      latitude REAL,
      longitude REAL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (superviseur_id) REFERENCES superviseurs(id),
      FOREIGN KEY (technicien_id) REFERENCES techniciens(id)
    )
  `);

  // ------------------------------------------------------
  // 5. TABLE RAPPORTS
  // ------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS rapports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      technicien_id INTEGER NOT NULL,
      mission_id INTEGER,
      titre TEXT NOT NULL,
      description TEXT NOT NULL,
      solution TEXT,
      statut TEXT CHECK(statut IN ('brouillon', 'soumis', 'approuve', 'rejete')) DEFAULT 'brouillon',
      type_intervention TEXT CHECK(type_intervention IN ('preventive', 'corrective', 'urgente')),
      duree_intervention INTEGER,
      latitude REAL,
      longitude REAL,
      adresse TEXT,
      date_intervention DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (technicien_id) REFERENCES techniciens(id),
      FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE SET NULL
    )
  `);

  // ------------------------------------------------------
  // 6. TABLE PHOTOS_RAPPORT
  // ------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS photos_rapport (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rapport_id INTEGER NOT NULL,
      nom_fichier TEXT NOT NULL,
      chemin TEXT NOT NULL,
      url TEXT,
      description TEXT,
      date_prise DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rapport_id) REFERENCES rapports(id) ON DELETE CASCADE
    )
  `);

  // ------------------------------------------------------
  // 7. TABLE INCIDENTS
  // ------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      technicien_id INTEGER,
      superviseur_id INTEGER,
      rapport_id INTEGER,
      titre TEXT NOT NULL,
      description TEXT NOT NULL,
      type_incident TEXT CHECK(type_incident IN ('panne_reseau', 'panne_client', 'securite', 'equipement', 'autre')),
      severite TEXT CHECK(severite IN ('faible', 'moyenne', 'elevee', 'critique')) DEFAULT 'moyenne',
      statut TEXT CHECK(statut IN ('ouvert', 'en_cours', 'resolu', 'ferme')) DEFAULT 'ouvert',
      solution_apportee TEXT,
      zone TEXT,
      latitude REAL,
      longitude REAL,
      client_appele INTEGER DEFAULT 0,
      date_incident DATETIME DEFAULT CURRENT_TIMESTAMP,
      date_resolution DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (technicien_id) REFERENCES techniciens(id),
      FOREIGN KEY (superviseur_id) REFERENCES superviseurs(id),
      FOREIGN KEY (rapport_id) REFERENCES rapports(id) ON DELETE SET NULL
    )
  `);

  // ------------------------------------------------------
  // 8. TABLE MESSAGES - GROUPE OFFICIEL
  // ------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expediteur_id INTEGER NOT NULL,
      destinataire_id INTEGER,
      groupe_officiel_id INTEGER DEFAULT 1,
      type_message TEXT CHECK(type_message IN ('texte', 'photo', 'audio', 'video', 'emoji', 'localisation')) DEFAULT 'texte',
      contenu TEXT NOT NULL,
      message_parent_id INTEGER,
      est_modifie INTEGER DEFAULT 0,
      est_supprime INTEGER DEFAULT 0,
      est_lu INTEGER DEFAULT 0,
      lu_le DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (expediteur_id) REFERENCES utilisateurs(id),
      FOREIGN KEY (destinataire_id) REFERENCES utilisateurs(id),
      FOREIGN KEY (message_parent_id) REFERENCES messages(id) ON DELETE SET NULL
    )
  `);

  // ------------------------------------------------------
  // 9. TABLE GROUPE_OFFICIEL
  // ------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS groupe_officiel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom_groupe TEXT NOT NULL,
      description TEXT,
      icone TEXT,
      cree_par INTEGER NOT NULL,
      date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
      est_actif INTEGER DEFAULT 1,
      FOREIGN KEY (cree_par) REFERENCES utilisateurs(id)
    )
  `);

  // ------------------------------------------------------
  // 10. TABLE MEMBRES_GROUPE_OFFICIEL
  // ------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS membres_groupe_officiel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      groupe_officiel_id INTEGER NOT NULL,
      utilisateur_id INTEGER NOT NULL,
      est_admin INTEGER DEFAULT 0,
      a_rejoint_le DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(groupe_officiel_id, utilisateur_id),
      FOREIGN KEY (groupe_officiel_id) REFERENCES groupe_officiel(id) ON DELETE CASCADE,
      FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
    )
  `);

  // ------------------------------------------------------
  // 11. TABLE NOTIFICATIONS
  // ------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      utilisateur_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('rapport', 'incident', 'mission', 'permission', 'message', 'systeme')),
      titre TEXT NOT NULL,
      message TEXT NOT NULL,
      donnees TEXT,
      est_lu INTEGER DEFAULT 0,
      lu_le DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
    )
  `);

  // ------------------------------------------------------
  // 12. TABLE ETAT_RESEAU
  // ------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS etat_reseau (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      zone TEXT NOT NULL,
      site TEXT,
      bande_passante REAL,
      latence INTEGER,
      debit_montant REAL,
      debit_descendant REAL,
      utilisation_mbps REAL NOT NULL,
      capacite_mbps REAL NOT NULL,
      pourcentage_utilisation REAL,
      taux_erreur REAL,
      uptime REAL,
      statut TEXT CHECK(statut IN ('operationnel', 'degrade', 'panne', 'maintenance', 'normal', 'congestion', 'critique')),
      derniere_verification DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ------------------------------------------------------
  // 13. TABLE PERMISSIONS (avec TOUS les types possibles)
  // ------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      superviseur_id INTEGER NOT NULL,
      technicien_id INTEGER,
      type_permission TEXT CHECK(
        type_permission IN (
          'creer_rapport', 'modifier_rapport', 'valider_rapport', 'supprimer_rapport', 'voir_rapports',
          'creer_mission', 'modifier_mission', 'affecter_mission', 'changer_statut_mission', 'supprimer_mission', 'voir_missions',
          'creer_incident', 'modifier_incident', 'resoudre_incident', 'supprimer_incident', 'voir_incidents',
          'creer_utilisateur', 'modifier_utilisateur', 'activer_desactiver_utilisateur', 'supprimer_utilisateur', 'voir_utilisateurs',
          'creer_technicien', 'modifier_technicien', 'supprimer_technicien', 'voir_techniciens',
          'creer_superviseur', 'modifier_superviseur', 'supprimer_superviseur', 'voir_superviseurs',
          'voir_reseau', 'modifier_reseau',
          'voir_statistiques',
          'envoyer_message', 'voir_messages',
          'voir_historique',
          'gerer_permissions', 'voir_permissions'
        )
      ),
      est_valide INTEGER DEFAULT 0,
      valide_par INTEGER,
      date_validation DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (superviseur_id) REFERENCES superviseurs(id),
      FOREIGN KEY (technicien_id) REFERENCES techniciens(id),
      FOREIGN KEY (valide_par) REFERENCES utilisateurs(id)
    )
  `);

  // ------------------------------------------------------
  // 14. TABLE STATISTIQUES
  // ------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS statistiques (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type_stat TEXT NOT NULL,
      valeur INTEGER DEFAULT 0,
      date_calcul DATE DEFAULT CURRENT_DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(type_stat, date_calcul)
    )
  `);

  // ------------------------------------------------------
  // 15. TABLE REACTIONS_MESSAGE
  // ------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS reactions_message (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      utilisateur_id INTEGER NOT NULL,
      reaction TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, utilisateur_id),
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
    )
  `);

  // ------------------------------------------------------
  // 16. TABLE STATUT_MESSAGE
  // ------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS statut_message (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      utilisateur_id INTEGER NOT NULL,
      statut TEXT CHECK(statut IN ('envoye', 'delivre', 'vu')),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, utilisateur_id),
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
    )
  `);

  // ------------------------------------------------------
  // 17. TABLE HISTORIQUE_ACTIONS
  // ------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS historique_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      utilisateur_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      table_concerned TEXT,
      enregistrement_id INTEGER,
      details TEXT,
      adresse_ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
    )
  `);

  // ------------------------------------------------------
  // 18. TABLE PIECES_JOINTES_MESSAGE
  // ------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS pieces_jointes_message (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      type_fichier TEXT CHECK(type_fichier IN ('image', 'video', 'audio', 'document')),
      nom_fichier TEXT NOT NULL,
      chemin TEXT NOT NULL,
      url TEXT,
      mime_type TEXT,
      taille INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    )
  `);

  // ------------------------------------------------------
  // 19. TABLE SUIVI_CLIENTS - Appels clients
  // ------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS suivi_clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      superviseur_id INTEGER NOT NULL,
      client_nom TEXT NOT NULL,
      client_telephone TEXT NOT NULL,
      motif TEXT NOT NULL,
      description TEXT,
      statut TEXT CHECK(statut IN ('en_attente', 'traite', 'resolu', 'ferme')) DEFAULT 'en_attente',
      date_appel DATETIME DEFAULT CURRENT_TIMESTAMP,
      date_traitement DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (superviseur_id) REFERENCES superviseurs(id)
    )
  `);

  // ------------------------------------------------------
  // 20. INDEX POUR PERFORMANCES
  // ------------------------------------------------------
  db.exec(`
    -- Utilisateurs
    CREATE INDEX IF NOT EXISTS idx_utilisateurs_email ON utilisateurs(email);
    CREATE INDEX IF NOT EXISTS idx_utilisateurs_role ON utilisateurs(role);
    CREATE INDEX IF NOT EXISTS idx_utilisateurs_actif ON utilisateurs(actif);

    -- Techniciens
    CREATE INDEX IF NOT EXISTS idx_techniciens_matricule ON techniciens(matricule);
    CREATE INDEX IF NOT EXISTS idx_techniciens_disponible ON techniciens(disponible);
    CREATE INDEX IF NOT EXISTS idx_techniciens_zone ON techniciens(zone_intervention);

    -- Superviseurs
    CREATE INDEX IF NOT EXISTS idx_superviseurs_zone ON superviseurs(zone_responsable);

    -- Missions
    CREATE INDEX IF NOT EXISTS idx_missions_superviseur ON missions(superviseur_id);
    CREATE INDEX IF NOT EXISTS idx_missions_technicien ON missions(technicien_id);
    CREATE INDEX IF NOT EXISTS idx_missions_statut ON missions(statut);
    CREATE INDEX IF NOT EXISTS idx_missions_date_debut ON missions(date_debut);
    CREATE INDEX IF NOT EXISTS idx_missions_priorite ON missions(priorite);

    -- Rapports
    CREATE INDEX IF NOT EXISTS idx_rapports_technicien ON rapports(technicien_id);
    CREATE INDEX IF NOT EXISTS idx_rapports_mission ON rapports(mission_id);
    CREATE INDEX IF NOT EXISTS idx_rapports_statut ON rapports(statut);
    CREATE INDEX IF NOT EXISTS idx_rapports_date ON rapports(date_intervention);

    -- Incidents
    CREATE INDEX IF NOT EXISTS idx_incidents_statut ON incidents(statut);
    CREATE INDEX IF NOT EXISTS idx_incidents_technicien ON incidents(technicien_id);
    CREATE INDEX IF NOT EXISTS idx_incidents_superviseur ON incidents(superviseur_id);
    CREATE INDEX IF NOT EXISTS idx_incidents_severite ON incidents(severite);
    CREATE INDEX IF NOT EXISTS idx_incidents_date ON incidents(date_incident);

    -- Messages (groupe officiel)
    CREATE INDEX IF NOT EXISTS idx_messages_expediteur ON messages(expediteur_id);
    CREATE INDEX IF NOT EXISTS idx_messages_groupe_officiel ON messages(groupe_officiel_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type_message);
    CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(message_parent_id);

    -- Notifications
    CREATE INDEX IF NOT EXISTS idx_notifications_utilisateur ON notifications(utilisateur_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_lu ON notifications(est_lu);
    CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
    CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

    -- État réseau
    CREATE INDEX IF NOT EXISTS idx_etat_reseau_zone ON etat_reseau(zone);
    CREATE INDEX IF NOT EXISTS idx_etat_reseau_statut ON etat_reseau(statut);
    CREATE INDEX IF NOT EXISTS idx_etat_reseau_verification ON etat_reseau(derniere_verification);

    -- Groupe officiel
    CREATE INDEX IF NOT EXISTS idx_membres_groupe_officiel_utilisateur ON membres_groupe_officiel(utilisateur_id);

    -- Historique
    CREATE INDEX IF NOT EXISTS idx_historique_actions_utilisateur ON historique_actions(utilisateur_id);
    CREATE INDEX IF NOT EXISTS idx_historique_actions_created ON historique_actions(created_at);

    -- Suivi clients
    CREATE INDEX IF NOT EXISTS idx_suivi_clients_superviseur ON suivi_clients(superviseur_id);
    CREATE INDEX IF NOT EXISTS idx_suivi_clients_statut ON suivi_clients(statut);
  `);

  console.log('✅ Toutes les tables et index créés avec succès');
}

// ========================================================
// MIGRATION DE LA TABLE PERMISSIONS (ajout de tous les types)
// ========================================================

function migratePermissions() {
  try {
    const db = getDb();
    // Vérifier si la table a déjà la nouvelle contrainte (présence de 'creer_rapport')
    const createSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='permissions'").get();
    if (createSql && createSql.sql.includes('creer_rapport')) {
      console.log('✅ Table permissions déjà à jour.');
      return;
    }

    console.log('🔄 Migration de la table permissions...');
    db.exec('PRAGMA foreign_keys = OFF');

    // 1. Créer une nouvelle table avec la bonne contrainte (nom temporaire)
    db.exec(`
      CREATE TABLE permissions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        superviseur_id INTEGER NOT NULL,
        technicien_id INTEGER,
        type_permission TEXT CHECK(
          type_permission IN (
            'creer_rapport', 'modifier_rapport', 'valider_rapport', 'supprimer_rapport', 'voir_rapports',
            'creer_mission', 'modifier_mission', 'affecter_mission', 'changer_statut_mission', 'supprimer_mission', 'voir_missions',
            'creer_incident', 'modifier_incident', 'resoudre_incident', 'supprimer_incident', 'voir_incidents',
            'creer_utilisateur', 'modifier_utilisateur', 'activer_desactiver_utilisateur', 'supprimer_utilisateur', 'voir_utilisateurs',
            'creer_technicien', 'modifier_technicien', 'supprimer_technicien', 'voir_techniciens',
            'creer_superviseur', 'modifier_superviseur', 'supprimer_superviseur', 'voir_superviseurs',
            'voir_reseau', 'modifier_reseau',
            'voir_statistiques',
            'envoyer_message', 'voir_messages',
            'voir_historique',
            'gerer_permissions', 'voir_permissions'
          )
        ),
        est_valide INTEGER DEFAULT 0,
        valide_par INTEGER,
        date_validation DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (superviseur_id) REFERENCES superviseurs(id),
        FOREIGN KEY (technicien_id) REFERENCES techniciens(id),
        FOREIGN KEY (valide_par) REFERENCES utilisateurs(id)
      )
    `);

    // 2. Copier les données existantes (uniquement celles dont le type est valide)
    db.exec(`
      INSERT INTO permissions_new (
        id, superviseur_id, technicien_id, type_permission,
        est_valide, valide_par, date_validation, created_at
      )
      SELECT id, superviseur_id, technicien_id, type_permission,
             est_valide, valide_par, date_validation, created_at
      FROM permissions
      WHERE type_permission IN (
        'creer_rapport', 'modifier_rapport', 'valider_rapport', 'supprimer_rapport', 'voir_rapports',
        'creer_mission', 'modifier_mission', 'affecter_mission', 'changer_statut_mission', 'supprimer_mission', 'voir_missions',
        'creer_incident', 'modifier_incident', 'resoudre_incident', 'supprimer_incident', 'voir_incidents',
        'creer_utilisateur', 'modifier_utilisateur', 'activer_desactiver_utilisateur', 'supprimer_utilisateur', 'voir_utilisateurs',
        'creer_technicien', 'modifier_technicien', 'supprimer_technicien', 'voir_techniciens',
        'creer_superviseur', 'modifier_superviseur', 'supprimer_superviseur', 'voir_superviseurs',
        'voir_reseau', 'modifier_reseau',
        'voir_statistiques',
        'envoyer_message', 'voir_messages',
        'voir_historique',
        'gerer_permissions', 'voir_permissions'
      )
    `);

    // 3. Supprimer l'ancienne table
    db.exec('DROP TABLE permissions');

    // 4. Renommer la nouvelle table pour qu'elle s'appelle `permissions`
    db.exec('ALTER TABLE permissions_new RENAME TO permissions');

    // 5. Réactiver les contraintes de clés étrangères
    db.exec('PRAGMA foreign_keys = ON');

    console.log('✅ Table permissions migrée avec succès (nom final : permissions)');
  } catch (err) {
    console.error('❌ Erreur lors de la migration :', err.message);
  }
}

// ========================================================
// DONNÉES INITIALES (SEULEMENT L'ADMIN)
// ========================================================

function seedData() {
  console.log('🔄 Insertion des données initiales...');

  // ------------------------------------------------------
  // 1. CRÉATION DU COMPTE ADMIN UNIQUE (le seul utilisateur initial)
  // ------------------------------------------------------
  const adminExists = db.prepare("SELECT id FROM utilisateurs WHERE role = 'admin' LIMIT 1").get();
  if (!adminExists) {
    const hash = bcrypt.hashSync('Syldie@2026', 10);
    db.prepare(`
      INSERT OR IGNORE INTO utilisateurs (nom, prenom, email, mot_de_passe, telephone, role, actif)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('NDAGIJIMANA', 'Syldie', 'syldie@bbs.bi', hash, '+257 65351523', 'admin', 1);
    console.log('✅ Compte Admin créé: syldie@bbs.bi / Syldie@2026');
  }

  // ------------------------------------------------------
  // 2. CRÉATION DU GROUPE OFFICIEL UNIQUE (avec l'admin comme créateur)
  // ------------------------------------------------------
  const groupeOfficielExists = db.prepare("SELECT id FROM groupe_officiel LIMIT 1").get();
  if (!groupeOfficielExists) {
    const admin = db.prepare("SELECT id FROM utilisateurs WHERE role = 'admin'").get();
    if (admin) {
      db.prepare(`
        INSERT INTO groupe_officiel (nom_groupe, description, icone, cree_par)
        VALUES (?, ?, ?, ?)
      `).run(
        '📢 Groupe Officiel BBS',
        'Groupe de discussion officiel - Tous les acteurs peuvent échanger',
        '💬',
        admin.id
      );
      console.log('✅ Groupe Officiel BBS créé');

      // Ajouter l'admin au groupe (les autres utilisateurs seront ajoutés lors de leur inscription)
      const groupeId = db.prepare("SELECT id FROM groupe_officiel LIMIT 1").get().id;
      const adminUser = db.prepare("SELECT id FROM utilisateurs WHERE role = 'admin'").get();
      if (adminUser) {
        db.prepare(`
          INSERT OR IGNORE INTO membres_groupe_officiel (groupe_officiel_id, utilisateur_id, est_admin)
          VALUES (?, ?, ?)
        `).run(groupeId, adminUser.id, 1);
        console.log('✅ Admin ajouté au Groupe Officiel BBS');
      }
    }
  }

  // ------------------------------------------------------
  // 3. MESSAGE DE BIENVENUE (uniquement si aucun message n'existe)
  // ------------------------------------------------------
  const messageExists = db.prepare("SELECT id FROM messages LIMIT 1").get();
  if (!messageExists) {
    const admin = db.prepare("SELECT id FROM utilisateurs WHERE role = 'admin'").get();
    const groupeId = db.prepare("SELECT id FROM groupe_officiel LIMIT 1").get();

    if (admin && groupeId) {
      db.prepare(`
        INSERT INTO messages (expediteur_id, groupe_officiel_id, type_message, contenu)
        VALUES (?, ?, ?, ?)
      `).run(
        admin.id,
        groupeId.id,
        'texte',
        '🎉 Bienvenue sur le Groupe Officiel BBS !\n\n' +
        'Ce groupe permet à tous les acteurs de communiquer :\n' +
        '👤 Administrateur\n' +
        '🎯 DJ\n' +
        '👔 Superviseur\n' +
        '🔧 Technicien\n\n' +
        '📌 Règles :\n' +
        '• Respectez vos collègues\n' +
        '• Partagez les informations importantes\n' +
        '• Utilisez les réactions pour valider\n\n' +
        '💪 Ensemble pour un réseau plus performant !'
      );
      console.log('✅ Message de bienvenue envoyé dans le groupe officiel');
    }
  }

  // ------------------------------------------------------
  // 4. DONNÉES DE TEST - ÉTAT DU RÉSEAU
  // ------------------------------------------------------
  const reseauExists = db.prepare("SELECT id FROM etat_reseau LIMIT 1").get();
  if (!reseauExists) {
    const zones = ['Zone Nord', 'Zone Sud', 'Zone Est', 'Zone Ouest', 'Centre-ville', 'Zone Industrielle', 'Zone Résidentielle'];
    const insertReseau = db.prepare(`
      INSERT INTO etat_reseau (
        zone, site, bande_passante, latence, debit_montant, debit_descendant,
        utilisation_mbps, capacite_mbps, pourcentage_utilisation,
        taux_erreur, uptime, statut
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    zones.forEach(zone => {
      const cap = 1000 + Math.random() * 500;
      const util = Math.random() * cap * 0.9 + 50;
      const pct = (util / cap) * 100;
      let statut = 'normal';
      if (pct > 90) statut = 'critique';
      else if (pct > 75) statut = 'congestion';

      insertReseau.run(
        zone,
        `Site ${zone.split(' ')[1] || 'Principal'}`,
        Number((cap / 1000).toFixed(2)),
        Math.floor(10 + Math.random() * 90),
        Number((util * 0.3).toFixed(2)),
        Number((util * 0.7).toFixed(2)),
        Number(util.toFixed(1)),
        Number(cap),
        Number(pct.toFixed(1)),
        Number((Math.random() * 0.5).toFixed(2)),
        Number((95 + Math.random() * 4.9).toFixed(1)),
        statut
      );
    });
    console.log('✅ Données réseau de test créées');
  }

  // ------------------------------------------------------
  // 5. STATISTIQUES INITIALES
  // ------------------------------------------------------
  const statsExists = db.prepare("SELECT id FROM statistiques LIMIT 1").get();
  if (!statsExists) {
    const typesStat = [
      'total_rapports', 'missions_en_cours', 'missions_terminees',
      'incidents_ouverts', 'incidents_resolus',
      'techniciens_actifs', 'superviseurs', 'utilisateurs'
    ];

    const techCount = db.prepare("SELECT COUNT(*) as count FROM techniciens WHERE disponible = 1").get().count;
    const superCount = db.prepare("SELECT COUNT(*) as count FROM superviseurs").get().count;
    const userCount = db.prepare("SELECT COUNT(*) as count FROM utilisateurs WHERE actif = 1").get().count;

    const valeurs = {
      total_rapports: 0,
      missions_en_cours: 0,
      missions_terminees: 0,
      incidents_ouverts: 0,
      incidents_resolus: 0,
      techniciens_actifs: techCount,
      superviseurs: superCount,
      utilisateurs: userCount
    };

    const insertStat = db.prepare(`
      INSERT INTO statistiques (type_stat, valeur, date_calcul)
      VALUES (?, ?, date('now'))
    `);

    typesStat.forEach(type => {
      insertStat.run(type, valeurs[type] || 0);
    });
    console.log('✅ Statistiques initiales créées');
  }

  console.log('✅ Toutes les données initiales ont été insérées avec succès');
}

// ========================================================
// EXPORT
// ========================================================

module.exports = { getDb };