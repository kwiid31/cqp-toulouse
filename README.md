# CQP Toulouse — Documentation complète du projet

## Vue d'ensemble

**CQP Toulouse** (Quartiers Populaires Toulouse) est un réseau social de quartier pour les habitants des quartiers populaires de Toulouse. Le site est hébergé sur GitHub Pages à l'adresse **cqp-toulouse.fr**.

**Stack technique :**
- Frontend : HTML/CSS/JS vanilla (GitHub Pages)
- Backend : Supabase (PostgreSQL + Auth + Storage)
- IA : Groq API (llama-3.3-70b-versatile) via Edge Function Supabase
- Images : Cloudinary (cloud: dbpe9xree, preset: cqp_toulouse)
- Service Worker : sw.js (PWA installable)

**Quartiers couverts :**
Bellefontaine, Reynerie, Mirail, Papus, Empalot, Bagatelle, Faourette, Izards, Arènes, Bourbaki, Croix d'Aurade, Grand Mirail

---

## Architecture des pages

### 1. index.html — Feed principal
**URL :** cqp-toulouse.fr ou cqp-toulouse.fr/index.html
**Rôle :** Page d'accueil, fil d'actualité principal

**Sections :**
- **Stories** (barre horizontale en haut) — stories des quartiers avec photos
- **Barre "Parle !"** — bouton pour créer un post rapide
- **Feed mixte** — mélange de posts, actus, annonces et événements (géré par feed4.js)
- **Encarts "À voir"** — annonces et événements mis en avant dans le feed

**Navigation bar (bottom) :**
- 🏠 Accueil (index.html) — actif sur cette page
- 🔍 Explorer (explorer.html)
- 🔔 Notifications (notifs.html)
- 👤 Profil (profil.html)
- **+ Publier** (bouton rouge central)

**Boutons :**
- `Publier` — ouvre le modal de création de post
- `Annuler` — ferme les modals
- `Répondre` — répond à un commentaire
- `Supprimer` — supprime un post (admin ou propriétaire)
- `Envoyer la story` — publie une story quartier

**Fonctionnalités du feed (feed4.js) :**
- Charge posts + actus + annonces + événements en parallèle
- Mélange intelligent avec pondération par type
- Scroll circulaire infini
- Likes en temps réel (localStorage + Supabase)
- Commentaires avec réponses imbriquées
- Carrousel multi-médias (photos + vidéos)
- Partage natif (API Web Share)

---

### 2. profil.html — Profil utilisateur & Inscription
**URL :** cqp-toulouse.fr/profil.html
**Rôle :** Connexion, inscription, consultation et édition du profil

**Vues :**
- **Vue connexion** — saisie du code à 6 chiffres
- **Vue inscription** — formulaire (prénom, quartier, email optionnel)
- **Vue profil** — affichage du profil connecté

**Boutons :**
- `Accéder à mon profil` — connexion avec code
- `Créer mon profil` — inscription nouveau membre
- `Modifier` — éditer prénom, quartier, bio
- `Se déconnecter` — localStorage.clear()

**Données profil :**
- Prénom, quartier, bio, photo de profil
- Compteurs : posts publiés, likes reçus, commentaires
- Code d'accès à 6 chiffres (généré automatiquement à l'inscription)

**localStorage keys utilisées :**
- `cqp_code` — code de connexion
- `cqp_prenom` — prénom
- `cqp_quartier` — quartier
- `cqp_photo` — URL photo profil
- `cqp_sid` — session ID
- `cqp_admin` — booléen admin
- `cqp_likes` — tableau des IDs likés

---

### 3. annonces.html — Petites annonces
**URL :** cqp-toulouse.fr/annonces.html
**Rôle :** Dépôt et consultation des petites annonces du quartier

**Catégories :**
- Vente
- Service
- Emploi
- Logement
- Don
- Autre

**Boutons :**
- `+ Déposer` — ouvre le formulaire de dépôt d'annonce
- `Déposer l'annonce` — soumet le formulaire
- `Annuler` — ferme le formulaire

**Champs annonce :**
- Titre (obligatoire)
- Catégorie (obligatoire)
- Description
- Prix (optionnel)
- Quartier
- Contact (optionnel)
- Photo (optionnel)

**Table Supabase :** `annonces`
**Colonnes :** id, titre, description, categorie, quartier, profil_code, prenom, price, contact, image_url, visible, created_at

---

### 4. evenements.html — Agenda / Événements
**URL :** cqp-toulouse.fr/evenements.html
**Rôle :** Agenda des événements du quartier

**Fonctionnalités :**
- Liste des événements à venir par quartier
- Inscription à un événement
- Proposition d'un nouvel événement

**Boutons :**
- `+ Proposer` — ouvre le formulaire de création d'événement
- `Proposer l'événement` — soumet le formulaire
- `S'inscrire` / `✅ Inscrit` — inscription à l'événement
- `Confirmer mon inscription` — confirmation
- `Lire +` — voir les détails de l'événement
- `Annuler` — ferme les modals

**Champs événement :**
- Titre (obligatoire)
- Date de début (obligatoire)
- Date de fin (optionnel)
- Lieu (obligatoire)
- Description
- Quartier
- Image (optionnel)

**Table Supabase :** `evenements`
**Colonnes :** id, titre, description, lieu, date_debut, date_fin, quartier, profil_code, prenom, image_url, visible, created_at

**⚠️ IMPORTANT :** Les événements NE vont PAS dans le feed posts — ils ont leur propre section dans evenements.html et apparaissent dans les encarts "À venir" du feed principal.

---

### 5. actus.html — Actualités
**URL :** cqp-toulouse.fr/actus.html
**Rôle :** Actualités locales des quartiers

**Filtres :**
- Tout, Quartier, Social, Politique, Culture, Sport

**Boutons :**
- `Lire l'article →` — ouvre l'article complet

**Table Supabase :** `actus`
**Colonnes :** id, titre, contenu, source, categorie, quartier, image_url, visible, created_at

---

### 6. explorer.html — Explorateur
**URL :** cqp-toulouse.fr/explorer.html
**Rôle :** Vue synthétique de tout le contenu du site

**Sections :**
- Filtres : Tout, Annonces, Événements, Actus, Groupes
- Résumé des annonces récentes
- Résumé des événements à venir
- Résumé des actus
- Liens vers les groupes

**Boutons :**
- `Voir tout (N)` — redirige vers la section complète
- Filtres de navigation horizontaux

---

### 7. groupes.html — Groupes de voisins
**URL :** cqp-toulouse.fr/groupes.html
**Rôle :** Groupes thématiques ou de quartier

**Boutons :**
- `+ Créer` — créer un nouveau groupe
- `Créer le groupe` — soumet le formulaire
- `Annuler` — ferme le modal

**Table Supabase :** `groupes`

---

### 8. notifs.html — Notifications
**URL :** cqp-toulouse.fr/notifs.html
**Rôle :** Centre de notifications (likes, commentaires, mentions)

---

### 9. ia.html — Leila, l'IA assistante
**URL :** cqp-toulouse.fr/ia.html
**Rôle :** Assistant IA pour aider les habitants à publier du contenu

**Fonctionnalités :**
- Conversation naturelle en français
- Vision photos (llama-4-scout-17b)
- Publication de posts, annonces et événements via JSON
- Texte modifiable avant publication
- Mémoire de conversation (hist[])
- Détection du profil connecté (localStorage)

**Flow publication via Leila :**
1. Utilisateur décrit ce qu'il veut publier
2. Leila pose des questions si nécessaire
3. Leila génère un JSON de publication
4. Preview éditable apparaît avec image si jointe
5. Utilisateur modifie le texte si besoin
6. Clic "Publier" → upload Cloudinary + insert Supabase

**JSONs générés par Leila :**
```json
Post:      {"action":"publier","type":"post","contenu":"...","quartier":"..."}
Annonce:   {"action":"publier","type":"annonce","titre":"...","categorie":"...","description":"...","quartier":"..."}
Événement: {"action":"publier","type":"evenement","titre":"...","lieu":"...","date":"...","description":"..."}
```

---

## Base de données Supabase

**Projet :** rlrazcitmwxfaxlnnfau

### Tables principales

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| `profils` | Utilisateurs | code, prenom, quartier, photo_url, bio |
| `posts` | Posts du feed | contenu, prenom, quartier, profil_code, image_url, media_urls, visible |
| `annonces` | Petites annonces | titre, description, categorie, quartier, profil_code, image_url |
| `evenements` | Agenda | titre, lieu, date_debut, description, quartier, profil_code, image_url |
| `actus` | Actualités | titre, contenu, source, categorie, quartier |
| `commentaires` | Commentaires | item_type, item_id, prenom, message, profil_code, parent_id |
| `likes` | Likes | item_type, item_id, profil_code, session_id |
| `groupes` | Groupes | nom, description, quartier |

### Edge Functions (Supabase)
- `groq-proxy` — proxy vers Groq API (llama-3.3-70b-versatile)
- `tavily-proxy` — proxy vers Tavily (recherche web)
- `gemini-proxy` — proxy vers Google Gemini (inutilisé)

---

## Fichiers JS partagés

| Fichier | Rôle |
|---------|------|
| `js/api.js` | Toutes les requêtes Supabase (CRUD) |
| `js/auth.js` | Authentification localStorage |
| `js/feed4.js` | Moteur du feed mixte |
| `js/utils.js` | Utilitaires partagés |

---

## PWA & Service Worker

- `manifest.json` — métadonnées PWA (nom, icône, couleurs)
- `sw.js` — Service Worker (cache offline)
- Installable sur iOS et Android comme app native

---

## Règles importantes pour Leila

1. **Posts** → table `posts` → apparaissent dans le feed principal
2. **Annonces** → table `annonces` → apparaissent dans annonces.html ET en encarts dans le feed
3. **Événements** → table `evenements` → apparaissent dans evenements.html ET en encarts dans le feed
4. **NE PAS** publier un événement ou une annonce comme un post dans `posts`
5. L'utilisateur peut publier dans n'importe quel quartier, pas seulement le sien
6. Le code de connexion est dans localStorage (`cqp_code`) — 6 chiffres
7. `profil_code` dans Supabase = `cqp_code` dans localStorage
