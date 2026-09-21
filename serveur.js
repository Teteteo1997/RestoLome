require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cle_secrete_defaut';

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Connexion à la base de données SQLite (crée un fichier database.sqlite automatiquement)
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erreur d\'ouverture de la base SQLite :', err.message);
  } else {
    console.log('Connecté à la base de données SQLite avec succès !');
    initialiserTablesEtAdmin();
  }
});

// Initialisation des tables et du compte admin par défaut
function initialiserTablesEtAdmin() {
  db.serialize(() => {
    // Table utilisateurs
    db.run(`
      CREATE TABLE IF NOT EXISTS utilisateurs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom_utilisateur TEXT NOT NULL UNIQUE,
        mot_de_passe TEXT NOT NULL
      )
    `);

    // Table restaurants
    db.run(`
      CREATE TABLE IF NOT EXISTS restaurants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        quartier TEXT NOT NULL,
        cuisine TEXT NOT NULL
      )
    `);

    // Table reservations
    db.run(`
      CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        telephone TEXT NOT NULL,
        restaurant TEXT NOT NULL,
        date_reservation TEXT NOT NULL
      )
    `);

    // Créer un admin par défaut si inexistant
    db.get('SELECT * FROM utilisateurs WHERE nom_utilisateur = ?', ['admin'], async (err, row) => {
      if (!row) {
        const hash = await bcrypt.hash('admin123', 10);
        db.run('INSERT INTO utilisateurs (nom_utilisateur, mot_de_passe) VALUES (?, ?)', ['admin', hash]);
        console.log('Compte administrateur par défaut créé : admin / admin123');
      }
    });

    // Insérer quelques restaurants par défaut si la table est vide
    db.get('SELECT COUNT(*) as count FROM restaurants', (err, row) => {
      if (row && row.count === 0) {
        db.run(`INSERT INTO restaurants (nom, quartier, cuisine) VALUES 
          ('Le Chalet', 'Nyékonakpoè', 'Européenne / Grillades'),
          ('La Pirogue', 'Kodjoviakopé', 'Africaine / Poissons'),
          ('L''Abreuvoir', 'Tokoin', 'Internationale')
        `);
        console.log('Restaurants par défaut insérés.');
      }
    });
  });
}

// Middleware de sécurité JWT
function verifierToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Accès refusé. Token manquant.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalide ou expiré.' });
    }
    req.user = decoded;
    next();
  });
}

// ==========================================
// ROUTES AUTHENTIFICATION
// ==========================================

app.post('/api/auth/login', (req, res) => {
  const { nom_utilisateur, mot_de_passe } = req.body;

  if (!nom_utilisateur || !mot_de_passe) {
    return res.status(400).json({ error: 'Veuillez remplir tous les champs.' });
  }

  db.get('SELECT * FROM utilisateurs WHERE nom_utilisateur = ?', [nom_utilisateur], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
    }

    const match = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
    if (!match) {
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
    }

    const token = jwt.sign(
      { id: user.id, nom_utilisateur: user.nom_utilisateur },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({ message: 'Connexion réussie !', token });
  });
});

// ==========================================
// ROUTES API REST
// ==========================================

// Public : Liste des restaurants
app.get('/api/restaurants', (req, res) => {
  db.all('SELECT * FROM restaurants', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur.' });
    res.json(rows);
  });
});

// Public : Ajouter une réservation
app.post('/api/reservations', (req, res) => {
  const { nom, telephone, restaurant, date_reservation } = req.body;
  if (!nom || !telephone || !restaurant || !date_reservation) {
    return res.status(400).json({ error: 'Tous les champs sont obligatoires.' });
  }

  const query = 'INSERT INTO reservations (nom, telephone, restaurant, date_reservation) VALUES (?, ?, ?, ?)';
  db.run(query, [nom, telephone, restaurant, date_reservation], function(err) {
    if (err) return res.status(500).json({ error: 'Erreur d\'enregistrement.' });
    res.json({ message: 'Réservation enregistrée avec succès !', id: this.lastID });
  });
});

// Sécurisé : Voir toutes les réservations
app.get('/api/reservations', verifierToken, (req, res) => {
  db.all('SELECT * FROM reservations ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur.' });
    res.json(rows);
  });
});

// Sécurisé : Annuler une réservation
app.delete('/api/reservations/:id', verifierToken, (req, res) => {
  const query = 'DELETE FROM reservations WHERE id = ?';
  db.run(query, [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Erreur de suppression.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Réservation introuvable.' });
    res.json({ message: `Réservation #${req.params.id} annulée.` });
  });
});
// Route pour ajouter un nouveau restaurant (Réservée à l'admin)
app.post('/api/restaurants', verifierToken, (req, res) => {
    const { nom, quartier, cuisine } = req.body;

    if (!nom || !quartier || !cuisine) {
        return res.status(400).json({ error: "Tous les champs sont obligatoires." });
    }

    const query = `INSERT INTO restaurants (nom, quartier, cuisine) VALUES (?, ?, ?)`;
    db.run(query, [nom, quartier, cuisine], function(err) {
        if (err) {
            console.error("Erreur lors de l'ajout du restaurant :", err.message);
            return res.status(500).json({ error: "Erreur interne du serveur." });
        }
        res.status(201).json({ 
            message: "Restaurant ajouté avec succès !", 
            id: this.lastID,
            restaurant: { id: this.lastID, nom, quartier, cuisine }
        });
    });
});
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});