# BBS Mobile - Bandwidth Band Services
## Application de gestion des rapports terrain

---

## 📋 Description

BBS Mobile est une application mobile complète développée en **React Native (JavaScript)** avec un backend **Node.js + SQLite**, permettant la gestion des rapports terrain pour un service réseau de bande passante.

---

## 🏗️ Architecture du projet

```
BBS/
├── backend/                    # Serveur Node.js + SQLite
│   ├── db/
│   │   └── database.js         # Initialisation SQLite + schéma
│   ├── middleware/
│   │   └── auth.js             # JWT + contrôle d'accès
│   ├── routes/
│   │   ├── auth.js             # Authentification
│   │   ├── users.js            # Gestion utilisateurs
│   │   ├── techniciens.js      # Gestion techniciens
│   │   ├── rapports.js         # Rapports terrain
│   │   ├── incidents.js        # Incidents
│   │   ├── reseau.js           # Bande passante + notifs
│   │   └── statistiques.js     # Stats & tableaux de bord
│   ├── uploads/                # Photos des rapports
│   ├── .env                    # Variables d'environnement
│   ├── package.json
│   └── server.js               # Point d'entrée serveur
│
└── mobile/                     # Application React Native
    ├── android/                # Projet Android Studio
    │   ├── app/
    │   │   ├── src/main/
    │   │   │   ├── java/com/bbsmobile/
    │   │   │   │   ├── MainActivity.kt
    │   │   │   │   └── MainApplication.kt
    │   │   │   ├── res/
    │   │   │   │   ├── values/  (strings, styles, colors)
    │   │   │   │   └── xml/file_paths.xml
    │   │   │   └── AndroidManifest.xml
    │   │   ├── build.gradle
    │   │   └── proguard-rules.pro
    │   ├── gradle/wrapper/
    │   ├── build.gradle
    │   ├── settings.gradle
    │   └── gradle.properties
    ├── src/
    │   ├── context/
    │   │   └── AuthContext.js  # Authentification globale
    │   ├── navigation/
    │   │   └── index.js        # Navigation (Stack + BottomTabs)
    │   ├── screens/
    │   │   ├── LoginScreen.js
    │   │   ├── DashboardScreen.js
    │   │   ├── UsersScreen.js
    │   │   ├── UserFormScreen.js
    │   │   ├── TechniciensScreen.js
    │   │   ├── TechnicienFormScreen.js
    │   │   ├── TachesScreen.js
    │   │   ├── RapportsScreen.js
    │   │   ├── RapportFormScreen.js
    │   │   ├── RapportDetailScreen.js
    │   │   ├── IncidentsScreen.js
    │   │   ├── IncidentFormScreen.js
    │   │   ├── ReseauScreen.js
    │   │   ├── StatistiquesScreen.js
    │   │   └── ProfilScreen.js
    │   ├── components/
    │   │   └── index.js        # Composants réutilisables
    │   ├── services/
    │   │   └── api.js          # Couche API (Axios)
    │   └── theme/
    │       └── index.js        # Couleurs, typographie, espacement
    ├── App.js                  # ✅ Composant racine
    ├── index.js                # ✅ Point d'entrée React Native
    ├── app.json                # ✅ Config app
    ├── babel.config.js
    ├── metro.config.js
    └── package.json
```

---

## 🚀 Installation & Démarrage

### Prérequis
- Node.js >= 18
- Android Studio (avec SDK Android 34)
- JDK 17
- React Native CLI

### 1. Backend

```bash
cd BBS/backend
npm install
npm start
# Serveur démarre sur http://localhost:3000
# Compte admin créé automatiquement : admin@bbs.com / Admin@123
```

### 2. Mobile (React Native)

```bash
cd BBS/mobile
npm install

# Lancer sur émulateur Android
npx react-native run-android
```

### 3. Ouvrir dans Android Studio

1. Ouvrir **Android Studio**
2. **File → Open** → sélectionner `BBS/mobile/android/`
3. Attendre la synchronisation Gradle
4. Cliquer **Run ▶** (émulateur ou appareil physique)

---

## 🔑 Comptes de test

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| admin@bbs.com | Admin@123 | Administrateur |

*(Créez des superviseurs et techniciens depuis l'interface admin)*

---

## 📱 Modules disponibles

| Module | Description | Rôles |
|--------|-------------|-------|
| **Authentification** | Login/Logout, JWT, gestion session | Tous |
| **Utilisateurs** | CRUD complet, activation/désactivation | Admin |
| **Techniciens** | Profils, zones, disponibilité | Admin, Superviseur |
| **Tâches** | Affectation de missions | Admin, Superviseur |
| **Rapports terrain** | Création avec photos, suivi statut | Tous |
| **Incidents** | Signalement, priorités, résolution | Tous |
| **Réseau** | Surveillance bande passante, alertes | Tous |
| **Statistiques** | KPIs, graphiques, rapport mensuel | Admin, Superviseur |
| **Profil** | Paramètres compte, changement MDP | Tous |

---

## ⚙️ Configuration API

Dans `mobile/src/services/api.js` :

```javascript
// Pour émulateur Android (adresse de la machine hôte)
const BASE_URL = 'http://10.0.2.2:3000/api';

// Pour appareil physique (remplacer par votre IP locale)
// const BASE_URL = 'http://192.168.X.X:3000/api';
```

---

## 📦 Génération APK (Release)

```bash
cd BBS/mobile/android

# Générer le keystore (première fois seulement)
keytool -genkey -v -keystore app/bbs-release.keystore \
  -alias bbs-key -keyalg RSA -keysize 2048 -validity 10000

# Configurer android/gradle.properties avec les mots de passe

# Générer l'APK
./gradlew assembleRelease

# APK disponible dans :
# app/build/outputs/apk/release/app-release.apk
```

---

## 🛠️ Technologies utilisées

| Technologie | Version | Usage |
|------------|---------|-------|
| React Native | 0.73.4 | Frontend mobile |
| Node.js | >= 18 | Backend API |
| SQLite (better-sqlite3) | 9.x | Base de données |
| Express.js | 4.x | Serveur HTTP |
| JWT | 9.x | Authentification |
| React Navigation | 6.x | Navigation mobile |
| Axios | 1.x | Requêtes HTTP |
| Multer | 1.x | Upload photos |
| bcryptjs | 2.x | Hashage mots de passe |
