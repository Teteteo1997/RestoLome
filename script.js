// ==========================================
// 1. PAGE CLIENT (index.html)
// ==========================================

// Bloquer les dates passées dans le champ date_reservation
const inputDate = document.getElementById('date_reservation');
if (inputDate) {
  const maintenant = new Date();
  maintenant.setMinutes(maintenant.getMinutes() - maintenant.getTimezoneOffset());
  inputDate.min = maintenant.toISOString().slice(0, 16);
}

// Charger la liste des restaurants
const conteneurResto = document.getElementById('liste-restaurants');
if (conteneurResto) {
  fetch('/api/restaurants')
    .then(response => response.json())
    .then(data => {
      conteneurResto.innerHTML = '';
      data.forEach(resto => {
        const carte = document.createElement('div');
        carte.style.border = "1px solid #ccc";
        carte.style.padding = "10px";
        carte.style.margin = "10px 0";
        carte.style.borderRadius = "5px";
        carte.innerHTML = `
          <h3>${resto.nom}</h3>
          <p><strong>Quartier :</strong> ${resto.quartier}</p>
          <p><strong>Cuisine :</strong> ${resto.cuisine}</p>
        `;
        conteneurResto.appendChild(carte);
      });
    })
    .catch(err => console.error('Erreur restaurants :', err));
}

// Soumission du formulaire de réservation
const form = document.getElementById('form-reservation');
if (form) {
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const msg = document.getElementById('message-statut');

    const nom = document.getElementById('nom').value.trim();
    const telephone = document.getElementById('telephone').value.trim();
    const restaurant = document.getElementById('restaurant').value;
    const date_reservation = document.getElementById('date_reservation').value;

    // Contrôle numéro de téléphone (8 chiffres)
    const regexTel = /^[0-9]{8}$/;
    if (!regexTel.test(telephone)) {
      msg.style.color = 'red';
      msg.textContent = "Le numéro de téléphone doit comporter exactement 8 chiffres.";
      return;
    }

    // Contrôle date future
    if (new Date(date_reservation) <= new Date()) {
      msg.style.color = 'red';
      msg.textContent = "La date de réservation doit être dans le futur.";
      return;
    }

    const donnees = { nom, telephone, restaurant, date_reservation };

    fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(donnees)
    })
    .then(res => res.json())
    .then(data => {
      if (data.message) {
        msg.style.color = 'green';
        msg.textContent = data.message;
        form.reset();
      } else {
        msg.style.color = 'red';
        msg.textContent = data.error || "Une erreur s'est produite.";
      }
    })
    .catch(err => {
      console.error("Erreur d'envoi :", err);
      msg.style.color = 'red';
      msg.textContent = "Impossible de contacter le serveur.";
    });
  });
}


// ==========================================
// 2. PAGE ADMIN (admin.html)
// ==========================================

// Charger les réservations et générer les boutons Annuler
function chargerReservations() {
  const tbody = document.getElementById('tableau-reservations');
  if (!tbody) return; // Si on n'est pas sur admin.html, on arrête la fonction.

  fetch('/api/reservations')
    .then(res => res.json())
    .then(reservations => {
      tbody.innerHTML = '';

      if (reservations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Aucune réservation pour le moment.</td></tr>';
        return;
      }

      reservations.forEach(res => {
        const tr = document.createElement('tr');
        const dateFormatted = new Date(res.date_reservation).toLocaleString('fr-FR', {
          dateStyle: 'short',
          timeStyle: 'short'
        });

        tr.innerHTML = `
          <td>#${res.id}</td>
          <td><strong>${res.nom}</strong></td>
          <td>${res.telephone}</td>
          <td>${res.restaurant}</td>
          <td>${dateFormatted}</td>
          <td>
            <button class="btn-supprimer" onclick="supprimerReservation(${res.id})">Annuler</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    })
    .catch(err => console.error("Erreur chargement réservations :", err));
}

// Envoyer la requête DELETE de suppression
function supprimerReservation(id) {
  if (confirm(`Voulez-vous vraiment annuler la réservation #${id} ?`)) {
    fetch(`/api/reservations/${id}`, {
      method: 'DELETE'
    })
    .then(res => res.json())
    .then(data => {
      if (data.message) {
        alert(data.message);
        chargerReservations(); // Rechargement automatique du tableau
      } else {
        alert(data.error || "Erreur lors de la suppression.");
      }
    })
    .catch(err => {
      console.error("Erreur suppression :", err);
      alert("Impossible de joindre le serveur.");
    });
  }
}

// Lancer le chargement automatique des données sur admin.html
document.addEventListener('DOMContentLoaded', chargerReservations);