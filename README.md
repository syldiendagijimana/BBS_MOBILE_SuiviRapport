# BBS_SuiviRapport

## Application mobile de gestion des rapports sur terrain — Burundi Backbone System

---

## 📋 Description

**BBS_SuiviRapport** est une application mobile développée dans le cadre de la gestion des rapports sur terrain pour le **Burundi Backbone System (BBS)**.

L'application permet aux différents utilisateurs de gérer les missions, les rapports d'intervention, les incidents, les utilisateurs, les techniciens, les superviseurs, les notifications, les messages, le suivi des clients, l'état du réseau et les statistiques.

L'application est développée avec :

* **React Native** pour l'application mobile ;
* **Node.js + Express.js** pour le backend ;
* **SQLite avec better-sqlite3** pour la base de données ;
* **JWT** pour l'authentification et la sécurisation des accès.

---

# 🏗️ Architecture du projet

Le projet adopte une **architecture client-serveur à deux parties principales** :

1. **Frontend mobile** : application React Native ;
2. **Backend** : API REST développée avec Node.js et Express.js.

La base de données SQLite est utilisée par le backend pour enregistrer et gérer les données de l'application.

```text
BBS_SuiviRapport/
│
├── .idea/
│
├── backend/                         ← BACKEND
│   │
│   ├── db/                          ← BASE DE DONNÉES
│   │   ├── bbs.db
│   │   ├── bbs.db-shm
│   │   ├── bbs.db-wal
│   │   ├── bbs_backup.db
│   │   └── database.js
│   │
│   ├── middleware/                  ← SÉCURITÉ / AUTHENTIFICATION
│   │   └── auth.js
│   │
│   ├── routes/                      ← API REST
│   │   ├── auth.js
│   │   ├── historique.js
│   │   ├── incidents.js
│   │   ├── messages.js
│   │   ├── missions.js
│   │   ├── notifications.js
│   │   ├── permissions.js
│   │   ├── rapports.js
│   │   ├── reseau.js
│   │   ├── statistiques.js
│   │   ├── suivi_clients.js
│   │   ├── superviseurs.js
│   │   ├── techniciens.js
│   │   └── utilisateurs.js
│   │
│   ├── uploads/                     ← FICHIERS / PHOTOS
│   │
│   ├── .env                         ← CONFIGURATION
│   ├── package.json
│   ├── package-lock.json
│   └── server.js                    ← SERVEUR EXPRESS
│
│
├── mobile/                          ← FRONTEND MOBILE
│   │
│   ├── android/                     ← PROJET ANDROID
│   │
│   ├── assets/                      ← RESSOURCES
│   │
│   ├── src/
│   │   │
│   │   ├── components/              ← COMPOSANTS RÉUTILISABLES
│   │   │   ├── GradientHeader.js
│   │   │   └── index.js
│   │   │
│   │   ├── context/                 ← ÉTAT GLOBAL
│   │   │   └── AuthContext.js
│   │   │
│   │   ├── navigation/              ← NAVIGATION
│   │   │   └── index.js
│   │   │
│   │   ├── screens/                 ← INTERFACES
│   │   │   ├── DashboardScreen.js
│   │   │   ├── GroupeMessageScreen.js
│   │   │   ├── HistoriqueScreen.js
│   │   │   ├── IncidentFormScreen.js
│   │   │   ├── IncidentsScreen.js
│   │   │   ├── LoginScreen.js
│   │   │   ├── MessagesScreen.js
│   │   │   ├── MissionDetailScreen.js
│   │   │   ├── MissionFormScreen.js
│   │   │   ├── MissionsScreen.js
│   │   │   ├── NotificationsScreen.js
│   │   │   ├── PermissionDetailScreen.js
│   │   │   ├── PermissionFormScreen.js
│   │   │   ├── PermissionsScreen.js
│   │   │   ├── ProfilScreen.js
│   │   │   ├── RapportDetailScreen.js
│   │   │   ├── RapportFormScreen.js
│   │   │   ├── RapportsScreen.js
│   │   │   ├── ReseauScreen.js
│   │   │   ├── StatistiquesScreen.js
│   │   │   ├── SuiviClientFormScreen.js
│   │   │   ├── SuiviClientsScreen.js
│   │   │   ├── SuperviseurDetailScreen.js
│   │   │   ├── SuperviseurFormScreen.js
│   │   │   ├── SuperviseursScreen.js
│   │   │   ├── TachesScreen.js
│   │   │   ├── TechnicienFormScreen.js
│   │   │   ├── TechniciensScreen.js
│   │   │   ├── UserFormScreen.js
│   │   │   ├── UsersScreen.js
│   │   │   └── WelcomeScreen.js
│   │   │
│   │   ├── services/                ← COMMUNICATION AVEC L'API
│   │   │   ├── api.js
│   │   │   ├── messagesAPI.js
│   │   │   └── notificationsAPI.js
│   │   │
│   │   └── theme/                   ← STYLE GLOBAL
│   │       └── index.js
│   │
│   ├── App.js
│   ├── index.js
│   ├── app.json
│   ├── babel.config.js
│   ├── metro.config.js
│   ├── package.json
│   └── package-lock.json
│
├── README.md
└── package-lock.json
```

---

# 📂 Description des principaux dossiers

## Backend

Le dossier `backend/` contient toute la partie serveur de l'application.

### `backend/db/`

Ce dossier contient la base de données SQLite et le fichier permettant de l'initialiser et de la gérer.

* `bbs.db` : base de données principale ;
* `bbs.db-shm` : fichier temporaire utilisé par SQLite en mode WAL ;
* `bbs.db-wal` : journal des transactions SQLite ;
* `bbs_backup.db` : sauvegarde de la base ;
* `database.js` : connexion, initialisation et gestion du schéma de la base de données.

### `backend/middleware/`

Ce dossier contient les mécanismes intermédiaires utilisés par le serveur.

`auth.js` assure notamment :

* la vérification du token JWT ;
* l'authentification des utilisateurs ;
* le contrôle des accès selon les rôles et permissions.

### `backend/routes/`

Ce dossier contient les différentes routes de l'API REST.

| Fichier            | Fonction                      |
| ------------------ | ----------------------------- |
| `auth.js`          | Authentification et connexion |
| `utilisateurs.js`  | Gestion des utilisateurs      |
| `superviseurs.js`  | Gestion des superviseurs      |
| `techniciens.js`   | Gestion des techniciens       |
| `missions.js`      | Gestion des missions          |
| `rapports.js`      | Gestion des rapports terrain  |
| `incidents.js`     | Gestion des incidents         |
| `messages.js`      | Gestion des messages          |
| `notifications.js` | Gestion des notifications     |
| `permissions.js`   | Gestion des permissions       |
| `reseau.js`        | Gestion et suivi du réseau    |
| `statistiques.js`  | Statistiques et indicateurs   |
| `historique.js`    | Historique des opérations     |
| `suivi_clients.js` | Suivi des clients             |

### `backend/uploads/`

Ce dossier permet de stocker les fichiers envoyés par l'application mobile, notamment les photos associées aux rapports et interventions.

### `backend/server.js`

`server.js` constitue le **point d'entrée du backend**.

Il assure notamment :

* le démarrage du serveur Express ;
* la configuration du serveur ;
* l'activation de CORS ;
* l'enregistrement des routes API ;
* la gestion des fichiers ;
* la connexion avec les différents modules du backend.

---

# 📱 Frontend mobile

Le dossier `mobile/` contient l'application mobile développée avec React Native.

## `mobile/src/screens/`

Ce dossier contient les différentes interfaces de l'application.

Les écrans couvrent notamment :

* authentification ;
* tableau de bord ;
* utilisateurs ;
* superviseurs ;
* techniciens ;
* missions ;
* rapports terrain ;
* incidents ;
* permissions ;
* messages ;
* notifications ;
* réseau ;
* statistiques ;
* suivi des clients ;
* historique ;
* profil ;
* tâches.

## `mobile/src/components/`

Contient les composants graphiques réutilisables dans plusieurs écrans.

Exemple :

```text
GradientHeader.js
```

## `mobile/src/context/`

Contient la gestion de l'état global de l'application.

```text
AuthContext.js
```

Ce contexte permet notamment de gérer :

* l'utilisateur connecté ;
* le token d'authentification ;
* l'état de connexion ;
* les informations liées à la session.

## `mobile/src/navigation/`

Contient la configuration de la navigation entre les différentes interfaces de l'application.

```text
index.js
```

## `mobile/src/services/`

Cette partie assure la communication entre l'application mobile et le backend.

```text
api.js
messagesAPI.js
notificationsAPI.js
```

Les services permettent d'envoyer des requêtes HTTP à l'API REST et de récupérer les données du serveur.

## `mobile/src/theme/`

Contient les paramètres graphiques communs de l'application :

* couleurs ;
* styles ;
* tailles ;
* typographie ;
* espacements.

---

# 🔄 Fonctionnement général

Le fonctionnement de l'application peut être représenté ainsi :

```text
┌───────────────────────────────┐
│          UTILISATEUR          │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│       APPLICATION MOBILE      │
│          React Native         │
│                               │
│  Screens / Components         │
│  Navigation / Context         │
│  Services API                 │
└───────────────┬───────────────┘
                │
                │ HTTP / JSON
                ▼
┌───────────────────────────────┐
│           BACKEND             │
│       Node.js + Express       │
│                               │
│  Middleware d'authentification│
│  Routes API REST              │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│          DATABASE             │
│            SQLite             │
│                               │
│           bbs.db              │
└───────────────────────────────┘
```

Pour les photos et fichiers :

```text
Application mobile
        │
        │ Upload
        ▼
Backend Express
        │
        ▼
backend/uploads/
```

---

# 🚀 Installation et démarrage

## Prérequis

Avant d'installer le projet, il est nécessaire d'avoir :

* Node.js ;
* npm ;
* JDK 17 ;
* Android Studio ;
* Android SDK ;
* React Native CLI ;
* un émulateur Android ou un appareil Android physique.

---

# 1. Installation du Backend

Ouvrir un terminal en tant que Administrateur dans le dossier du projet :
```bash
cd BBS_SuiviRapport/backend
```

Installer les dépendances :

```bash
npm install
```

Démarrer le serveur :

```bash
node server.js
```

Le serveur démarre normalement sur :

```text
http://localhost:3000
```

L'API est accessible sous :

```text
http://localhost:3000/api
```

---

# 2. Installation de l'application mobile

Ouvrir un autre terminal :

```bash
cd BBS_SuiviRapport/mobile
```

Installer les dépendances :

```bash
npm install
```

Puis lancer l'application Android :

```bash
& "C:\Program Files\nodejs\npx.cmd" react-native run-android
```

---

# 3. Exécution avec Android Studio

Il est également possible d'utiliser Android Studio.

1. Ouvrir **Android Studio**.
2. Sélectionner **File → Open**.
3. Ouvrir :

```text
BBS_SuiviRapport/mobile/android/
```

4. Attendre la synchronisation de Gradle.
5. Démarrer un émulateur Android ou connecter un téléphone.
6. Cliquer sur **Run ▶**.

---

# 🌐 Configuration de l'API

La communication avec le backend est configurée dans :

```text
mobile/src/services/api.js
```

Pour un émulateur Android, l'adresse du PC hôte peut être :

```javascript
const BASE_URL = 'http://10.0.2.2:3000/api';
```

Pour un téléphone Android connecté au même réseau Wi-Fi que le PC, utiliser l'adresse IP locale du PC :

```javascript
const BASE_URL = 'http://192.168.X.X:3000/api';
```

L'adresse IP doit être remplacée par l'adresse réelle de l'ordinateur exécutant le backend.

---

# 🔐 Authentification et sécurité

L'application utilise une authentification basée sur **JWT (JSON Web Token)**.

Le fonctionnement général est :

```text
Utilisateur
     │
     ▼
LoginScreen
     │
     ▼
API /auth
     │
     ▼
Vérification des identifiants
     │
     ▼
Token JWT
     │
     ▼
AuthContext
     │
     ▼
Accès aux fonctionnalités autorisées
```

Le fichier principal associé à cette fonctionnalité est :

```text
backend/middleware/auth.js
```

et côté mobile :

```text
mobile/src/context/AuthContext.js
```

---

# 📱 Modules de l'application

| Module               | Description                                  |
| -------------------- | -------------------------------------------- |
| **Authentification** | Connexion, déconnexion et gestion de session |
| **Utilisateurs**     | Gestion des comptes utilisateurs             |
| **Superviseurs**     | Gestion des superviseurs                     |
| **Techniciens**      | Gestion des techniciens                      |
| **Missions**         | Création et gestion des missions             |
| **Rapports terrain** | Création et consultation des rapports        |
| **Incidents**        | Déclaration et suivi des incidents           |
| **Messages**         | Communication entre utilisateurs             |
| **Notifications**    | Notifications et alertes                     |
| **Permissions**      | Gestion des permissions                      |
| **Réseau**           | Suivi de l'état du réseau                    |
| **Statistiques**     | Consultation des indicateurs et statistiques |
| **Historique**       | Consultation des opérations effectuées       |
| **Suivi clients**    | Gestion du suivi des clients                 |
| **Profil**           | Consultation et gestion du profil            |

---

# 🛠️ Technologies utilisées

| Technologie          | Utilisation                            |
| -------------------- | -------------------------------------- |
| **React Native**     | Développement de l'application mobile  |
| **JavaScript**       | Langage principal du frontend          |
| **Node.js**          | Environnement d'exécution du backend   |
| **Express.js**       | Développement de l'API REST            |
| **SQLite**           | Base de données                        |
| **better-sqlite3**   | Communication avec SQLite              |
| **JWT**              | Authentification et sécurisation       |
| **React Navigation** | Navigation dans l'application mobile   |
| **Axios**            | Communication HTTP avec l'API          |
| **Multer**           | Gestion des fichiers et photos         |
| **bcryptjs**         | Hachage des mots de passe              |
| **Android Studio**   | Environnement de développement Android |
| **Gradle**           | Construction de l'application Android  |

---

# 📦 Génération de l'APK

Pour générer une version Android destinée à la distribution :

```bash
cd BBS_SuiviRapport/mobile/android
```

Puis :

```bash
./gradlew assembleRelease
```

Sous Windows PowerShell, utiliser :

```powershell
.\gradlew assembleRelease
```

L'APK généré se trouve généralement dans :

```text
mobile/android/app/build/outputs/apk/release/
```

---

# 📌 Résumé de l'architecture

Le projet **BBS_SuiviRapport** conserve une architecture simple et claire :

```text
BBS_SuiviRapport
│
├── BACKEND
│   ├── Node.js
│   ├── Express.js
│   ├── API REST
│   ├── Authentification JWT
│   ├── SQLite
│   └── Upload des fichiers
│
└── MOBILE
    ├── React Native
    ├── Screens
    ├── Components
    ├── Context
    ├── Navigation
    ├── Services API
    └── Theme
```

Cette organisation permet de séparer clairement **l'interface mobile**, **les services de communication**, **la logique serveur**, **la sécurité** et **la gestion des données**, tout en conservant la structure actuelle du projet.
