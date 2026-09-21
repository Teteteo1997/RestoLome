require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cle_secrete_defaut';

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Connexion MySQL compatible Cloud et Local
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'restolome_db',
  port: process.env.DB_PORT || 3306
});

db.connect((err) => {
  if (err) {
    console.error('Erreur de connexion MySQL :', err);
    return;
  }
  console.log(`Connecté avec succès à la base MySQL (${process.env.DB_NAME || 'restolome_db'}) !`);
  initialiserTableEtAdmin();
});

// Initialisation de la table et du compte admin par défaut
function initialiserTableEtAdmin() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS utilisateurs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nom_utilisateur VARCHAR(50) NOT NULL UNIQUE,
      mot_de_passe VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  db.query(createTableQuery, (err) => {
    if (err) return;

    db.query('SELECT * FROM utilisateurs WHERE nom_utilisateur = ?', ['admin'], async (err, results) => {
      if (err) return;
      if (results.length === 0) {
        const hash = await bcrypt.hash('admin123', 10);
        db.query(
          'INSERT INTO utilisateurs (nom_utilisateur, mot_de_passe) VALUES (?, ?)',
          ['admin', hash],
          () => console.log('Compte administrateur créé par défaut : admin / admin123')
        );
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

  const query = 'SELECT * FROM utilisateurs WHERE nom_utilisateur = ?';
  db.query(query, [nom_utilisateur], async (err, results) => {
    if (err || results.length === 0) {
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
    }

    const user = results[0];
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
  db.query('SELECT * FROM restaurants', (err, results) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur.' });
    res.json(results);
  });
});

// Public : Ajouter une réservation
app.post('/api/reservations', (req, res) => {
  const { nom, telephone, restaurant, date_reservation } = req.body;
  if (!nom || !telephone || !restaurant || !date_reservation) {
    return res.status(400).json({ error: 'Tous les champs sont obligatoires.' });
  }

  const query = 'INSERT INTO reservations (nom, telephone, restaurant, date_reservation) VALUES (?, ?, ?, ?)';
  db.query(query, [nom, telephone, restaurant, date_reservation], (err, result) => {
    if (err) return res.status(500).json({ error: 'Erreur d\'enregistrement.' });
    res.json({ message: 'Réservation enregistrée avec succès !', id: result.insertId });
  });
});

// Sécurisé : Voir toutes les réservations
app.get('/api/reservations', verifierToken, (req, res) => {
  db.query('SELECT * FROM reservations ORDER BY id DESC', (err, results) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur.' });
    res.json(results);
  });
});

// Sécurisé : Annuler une réservation
app.delete('/api/reservations/:id', verifierToken, (req, res) => {
  const query = 'DELETE FROM reservations WHERE id = ?';
  db.query(query, [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Erreur de suppression.' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Réservation introuvable.' });
    res.json({ message: `Réservation #${req.params.id} annulée.` });
  });
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});