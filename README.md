# 🗺️ Plateforme SIG — Béni Mellal-Khénifra

> Plateforme d'aide à la décision territoriale pour la région Béni Mellal-Khénifra (Maroc).  
> Construite avec **React**, **FastAPI**, **PostGIS** et **Docker**.

---

## ✨ Fonctionnalités

- 🗺️ **Carte interactive** avec 9 couches géographiques (Provinces, Communes, Plans d'eau, Cours d'eau, Bâtiments…)
- 🔄 **Fond de carte switchable** : Sombre / Satellite / Clair
- 📊 **Statistiques dynamiques** : les KPIs changent selon la province ou commune cliquée
- 🍩 **Graphiques SVG** : Donut (hommes/femmes), Barres (top communes/provinces), Jauges (urbanisation)
- 🔍 **Recherche de commune** avec zoom automatique sur la carte
- 🐳 **100% Dockerisé** : un seul `docker-compose up` pour tout démarrer

---

## 🚀 Démarrage rapide (Docker)

### Prérequis
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installé et démarré

### 1. Cloner le projet
```bash
git clone https://github.com/atmansalah019-debug/plateforme-sig-bmk.git
cd plateforme-sig-bmk
```

### 2. Lancer tous les services
```bash
docker-compose up -d
```

> ⏳ **La première fois** : ~5-10 minutes (téléchargement des images + compilation React)  
> ⚡ **Les fois suivantes** : ~30 secondes

### 3. Accéder à l'application

| Service | URL | Description |
|---------|-----|-------------|
| 🌐 **Application** | http://localhost | Interface cartographique |
| 📖 **API Swagger** | http://localhost:8000/docs | Documentation interactive de l'API |
| 🗄️ **Base de données** | localhost:5432 | PostgreSQL + PostGIS |

---

## 🛑 Commandes Docker

```bash
# Démarrer
docker-compose up -d

# Voir l'état des conteneurs
docker ps

# Voir les logs en temps réel
docker-compose logs -f

# Arrêter (sans supprimer les données)
docker-compose stop

# Reprendre après un stop
docker-compose start

# Arrêter et supprimer les conteneurs (données conservées)
docker-compose down

# ⚠️ Tout supprimer, y compris la base de données
docker-compose down -v

# Mettre à jour après modification du code
docker-compose up -d --build frontend
```

---

## 💻 Mode développement (frontend)

Si vous souhaitez travailler sur le frontend avec rechargement automatique :

```bash
# 1. Démarrer le backend Docker
docker-compose up -d postgis backend

# 2. Lancer le frontend en mode dev
cd frontend
npm install
npm start
# → http://localhost:3000
```

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│                  sig_network (Docker)                │
│                                                      │
│  ┌─────────────────┐     ┌────────────────────────┐ │
│  │  sig_frontend   │────▶│     sig_backend        │ │
│  │  nginx:80       │     │     FastAPI:8000        │ │
│  │                 │     └──────────┬─────────────┘ │
│  │  React Build    │                │               │
│  │  + Proxy /api/  │     ┌──────────▼─────────────┐ │
│  └─────────────────┘     │     sig_postgis        │ │
│                          │     PostgreSQL:5432     │ │
│                          │     + PostGIS           │ │
│                          └────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

**Flux de données :**
1. Le navigateur accède à `http://localhost` (nginx)
2. Les requêtes `/api/` sont proxiées par nginx vers FastAPI (`:8000`)
3. FastAPI exécute des requêtes SQL spatiales sur PostGIS
4. Les données GeoJSON retournées s'affichent sur la carte Leaflet

---

## 📡 API Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/spatial/geojson/{layer}` | GeoJSON d'une couche spatiale |
| `GET` | `/api/spatial/stats/overview` | Statistiques régionales globales |
| `GET` | `/api/spatial/stats/provinces` | Population par province |
| `GET` | `/api/spatial/stats/top-communes?limit=7` | Top communes par population |
| `GET` | `/api/spatial/search/communes?q=` | Recherche de communes |

**Couches disponibles :**  
`regionbmk` · `bmkprovinces` · `bmkcommunes` · `water` · `waterways` · `landuse` · `places` · `buildings` · `protectedreas`

---

## 🔧 Stack technique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Frontend | React | 18 |
| Carte | Leaflet / React-Leaflet | — |
| Backend | FastAPI + SQLAlchemy async | — |
| Base de données | PostgreSQL + PostGIS | 15 / 3.3 |
| Serveur web | nginx | 1.25 |
| Conteneurisation | Docker + Docker Compose | — |

---

## 📁 Structure du projet

```
Projet/
├── docker-compose.yml       # Orchestration des 3 services
├── README.md
├── .gitignore
│
├── backend/                 # API FastAPI
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py          # Point d'entrée FastAPI + CORS
│       ├── api/endpoints/
│       │   └── spatial.py   # Routes spatiales (GeoJSON, stats, search)
│       └── db/
│           └── session.py   # Connexion async PostGIS
│
└── frontend/                # Interface React
    ├── Dockerfile           # Build multi-stage (Node → nginx)
    ├── nginx.conf           # Proxy /api/ → backend
    ├── package.json
    └── src/
        ├── App.js
        ├── index.css        # Design system complet
        └── components/map/
            └── MapComponent.jsx  # Composant principal
```

---

## ⚙️ Configuration

### Variables d'environnement (docker-compose.yml)

| Variable | Valeur par défaut | Description |
|----------|-------------------|-------------|
| `POSTGRES_USER` | `postgres` | Utilisateur PostgreSQL |
| `POSTGRES_PASSWORD` | `postgres` | Mot de passe PostgreSQL |
| `POSTGRES_DB` | `sig_benimellal` | Nom de la base de données |
| `DATABASE_URL` | (auto) | URL de connexion async |

> 💡 Pour changer les identifiants, modifiez `docker-compose.yml` avant le premier `docker-compose up`.

### Conflit de port PostgreSQL
Si vous avez déjà PostgreSQL installé localement sur le port 5432, changez le mapping dans `docker-compose.yml` :
```yaml
ports:
  - "5433:5432"   # Utiliser 5433 à la place
```

---

## 🙏 Données

- Données administratives : [OpenStreetMap](https://www.openstreetmap.org/) (licence ODbL)
- Données démographiques : Recensement Général de la Population et de l'Habitat (RGPH 2024)
- SIG-MAROC  (https://www.sig-maroc.com/)
- Région : Béni Mellal-Khénifra, Maroc
