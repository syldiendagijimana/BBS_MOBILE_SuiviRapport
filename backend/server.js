require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// =========================================================
// 1. CORS (IMPORTANT pour mobile)
// =========================================================
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// =========================================================
// 2. BODY PARSER (IMPORTANT LOGIN 400)
// =========================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =========================================================
// 3. UPLOADS
// =========================================================
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Sous-dossiers pour l'organisation
const subDirs = ['rapports', 'messages', 'avatars'];
subDirs.forEach(dir => {
  const dirPath = path.join(uploadsDir, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

app.use('/uploads', express.static(uploadsDir));

// =========================================================
// 4. DATABASE
// =========================================================
const { getDb } = require('./db/database');
getDb();
console.log('✅ Base de données connectée');

// =========================================================
// 5. ROUTES
// =========================================================

app.use('/api/auth', require('./routes/auth'));
app.use('/api/utilisateurs', require('./routes/utilisateurs'));
app.use('/api/users', require('./routes/utilisateurs'));
app.use('/api/techniciens', require('./routes/techniciens'));
app.use('/api/superviseurs', require('./routes/superviseurs'));
app.use('/api/missions', require('./routes/missions'));
app.use('/api/rapports', require('./routes/rapports'));
app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/notifications', require('./routes/notifications').router);
app.use('/api/reseau', require('./routes/reseau'));
app.use('/api/statistiques', require('./routes/statistiques'));
app.use('/api/stats', require('./routes/statistiques'));
app.use('/api/permissions', require('./routes/permissions'));
app.use('/api/suivi-clients', require('./routes/suivi_clients'));
app.use('/api/historique', require('./routes/historique'));

// =========================================================
// 6. HEALTH CHECK
// =========================================================
app.get('/api/health', (req, res) => {
  try {
    const db = getDb();
    res.json({
      status: 'OK',
      service: 'BBS API',
      version: '1.0.0',
      db: db ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      service: 'BBS API',
      db: 'disconnected',
      error: error.message
    });
  }
});

// =========================================================
// 7. ROUTE 404 - NON TROUVÉE
// =========================================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée',
    path: req.originalUrl,
    method: req.method
  });
});

// =========================================================
// 8. ERROR HANDLER
// =========================================================
app.use((err, req, res, next) => {
  console.error("❌ SERVER ERROR:", err.message);
  console.error("📚 STACK:", err.stack);
  console.error("📍 PATH:", req.path);
  console.error("🔧 METHOD:", req.method);

  // Erreur Multer (upload)
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'Fichier trop volumineux. Taille maximum: 10MB'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(413).json({
        success: false,
        error: 'Trop de fichiers. Maximum: 10 fichiers'
      });
    }
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  // Erreur JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Token JWT invalide'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token JWT expiré'
    });
  }

  // Erreur SQLite
  if (err.code && err.code.startsWith('SQLITE_')) {
    console.error("❌ SQLITE ERROR:", err);
    return res.status(500).json({
      success: false,
      error: 'Erreur de base de données'
    });
  }

  // Erreur générique
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'development'
      ? err.message
      : 'Erreur serveur interne'
  });
});

// =========================================================
// 9. START SERVER
// =========================================================
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('🚀 BBS API DÉMARRÉE');
  console.log('========================================');
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌍 Env: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
  console.log('========================================');
  console.log('📋 ROUTES DISPONIBLES:');
  console.log('  🔐 Auth:      /api/auth');
  console.log('  👤 Users:     /api/utilisateurs');
  console.log('  🔧 Tech:      /api/techniciens');
  console.log('  👔 Superv:    /api/superviseurs');
  console.log('  📋 Missions:  /api/missions');
  console.log('  📄 Rapports:  /api/rapports');
  console.log('  ⚠️ Incidents: /api/incidents');
  console.log('  💬 Messages:  /api/messages');
  console.log('  🔔 Notifs:    /api/notifications');
  console.log('  🌐 Réseau:    /api/reseau');
  console.log('  📊 Stats:     /api/statistiques');
  console.log('  🔑 Perms:     /api/permissions');
  console.log('  📞 Clients:   /api/suivi-clients');
  console.log('  📜 Historique:/api/historique');
  console.log('========================================\n');
});

// =========================================================
// 10. GESTION DES ARRÊTS GRACIEUX
// =========================================================
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM reçu, arrêt du serveur...');
  server.close(() => {
    console.log('✅ Serveur arrêté');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT reçu, arrêt du serveur...');
  server.close(() => {
    console.log('✅ Serveur arrêté');
    process.exit(0);
  });
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('❌ Exception non capturée:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesse rejetée non gérée:', reason);
});

// =========================================================
// EXPORT
// =========================================================
module.exports = app;