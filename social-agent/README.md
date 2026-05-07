# 🏘️ Agent CQP Toulouse — Yasmine

Agent AI qui surveille Reddit et Twitter/X pour trouver des conversations sur les quartiers populaires de Toulouse, et y répond naturellement en tant que **Yasmine**, habitante de Bellefontaine depuis 8 ans.

## Identité
- **Nom** : Yasmine
- **Profil** : Habitante de Bellefontaine (Toulouse), maman, aide-soignante, 34 ans
- **Reddit** : u/yasmine_bellefontaine31
- **X/Twitter** : @yasmine_mirail

## Fonctionnement

```
Recherche mots-clés (mirail, bellefontaine, reynerie, empalot...)
         ↓
Filtre de pertinence (IA vérifie si le post mérite une réponse)
         ↓
Claude génère une réponse naturelle en français
         ↓
Browser automation poste la réponse
         ↓
SQLite log → ne répond jamais deux fois au même post
```

## Installation

### Prérequis
- Python 3.9+
- `browse` CLI : `npm install -g @anthropic-ai/browse-cli`
- Clé API Anthropic
- Compte Reddit u/yasmine_bellefontaine31 (créer manuellement)
- Compte X @yasmine_mirail (optionnel)

### Setup

```bash
cd cqp-social-agent
pip install -r requirements.txt
cp .env.template .env
# Éditer .env avec ANTHROPIC_API_KEY=sk-ant-...
```

### Lancer

```bash
# Warmup (construire karma Reddit — 1-2 semaines avant de poster)
python warmup_reddit.py --target 10

# Agent complet
python run_daily.py

# Reddit seulement
python run_daily.py --reddit-only

# Test sans poster
python run_daily.py --dry-run
```

## Cibles

### Reddit
- **r/toulouse** — questions sur les quartiers, déménagement, logement
- **r/occitanie** — vie en région
- **r/france** — sujets généraux

### Mots-clés surveillés
`mirail, bellefontaine, reynerie, empalot, bagatelle, quartier toulouse, habitants toulouse, voisins toulouse, quartiers populaires, grand mirail...`

### Exemples de posts ciblés
- "Le Mirail ça craint partout ?" → Yasmine répond avec nuance + lien CQP
- "Vivre à Bellefontaine ?" → Témoignage positif + lien
- "Cherche médecin CMU Toulouse" → Info pratique + mention CQP
- "Déménager à Toulouse, quel quartier ?" → Conseil honnête

## Exemple de réponse générée

> "J'habite à Bellefontaine depuis 8 ans. C'est vrai que ça a mauvaise réputation, mais la réalité c'est bien plus nuancé — y'a une vraie vie de quartier, des associations, des gens qui s'entraident. On a même lancé un petit réseau entre voisins si ça t'intéresse : cqp-toulouse.fr 🙂"

## Coût estimé
~0.01€ par réponse (Claude Haiku) — 5 réponses/jour = ~1.5€/mois

## ⚠️ Bonnes pratiques
- Démarrer par 2 semaines de warmup (karma building)
- Max 5 posts/jour pour rester sous les radars
- Délai minimum 10 min entre chaque post
- Toujours vérifier les réponses générées avant d'activer le mode automatique
