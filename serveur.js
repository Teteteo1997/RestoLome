require('dotenv').config(); // Charge les variables d'environnement du fichier .env
const express = require('express');
const mysql = require('mysql2');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour lire le JSON dans le corps des requêtes (POST, DELETE)
app.use(express.json());

// Servir les fichiers statiques HTML, CSS, JS du dossier courant
app.use(express.static(path.join(__dirname)));

// Connexion à la base de données MySQL avec les variables d'environnement
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error('Erreur de connexion MySQL :', err);
    return;
  }
  console.log(`Connecté avec succès à la base de données MySQL (${process.env.DB_NAME}) !`);
});

// ==========================================
// ROUTES API REST
// ==========================================

// 1. Obtenir la liste des restaurants
app.get('/api/restaurants', (req, res) => {
  const query = 'SELECT * FROM restaurants';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Erreur SQL (GET restaurants) :', err);
      return res.status(500).json({ error: 'Erreur serveur lors de la récupération des restaurants.' });
    }
    res.json(results);
  });
});

// 2. Obtenir la liste de toutes les réservations
app.get('/api/reservations', (req, res) => {
  const query = 'SELECT * FROM reservations ORDER BY id DESC';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Erreur SQL (GET reservations) :', err);
      return res.status(500).json({ error: 'Erreur serveur lors de la récupération des réservations.' });
    }
    res.json(results);
  });
});

// 3. Ajouter une nouvelle réservation
app.post('/api/reservations', (req, res) => {
  const { nom, telephone, restaurant, date_reservation } = req.body;

  if (!nom || !telephone || !restaurant || !date_reservation) {
    return res.status(400).json({ error: 'Tous les champs sont obligatoires.' });
  }

  const query = 'INSERT INTO reservations (nom, telephone, restaurant, date_reservation) VALUES (?, ?, ?, ?)';
  db.query(query, [nom, telephone, restaurant, date_reservation], (err, result) => {
    if (err) {
      console.error('Erreur SQL (POST reservation) :', err);
      return res.status(500).json({ error: 'Erreur lors de l\'enregistrement de la réservation.' });
    }
    res.json({ message: 'Réservation enregistrée avec succès !', id: result.insertId });
  });
});

// 4. Supprimer / Annuler une réservation par son ID
app.delete('/api/reservations/:id', (req, res) => {
  const reservationId = req.params.id;

  const query = 'DELETE FROM reservations WHERE id = ?';
  db.query(query, [reservationId], (err, result) => {
    if (err) {
      console.error('Erreur SQL (DELETE reservation) :', err);
      return res.status(500).json({ error: 'Erreur serveur lors de la suppression.' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Réservation introuvable.' });
    }

    res.json({ message: `La réservation #${reservationId} a été annulée avec succès.` });
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});