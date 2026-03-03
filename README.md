# Plateforme Onboarding Marchands PSP

Application fullstack de gestion de l'onboarding des marchands (PSP), déploiement on-premise Linux via Docker.

**Stack :** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui (frontend) • Node.js 20 + Express + TypeScript + Prisma (backend) • PostgreSQL 15 • Nginx (reverse proxy + SSL).

---

## Déploiement on-premise

### 1. Cloner et configurer

```bash
git clone <url-du-repo> psp-onboarding
cd psp-onboarding
cp .env.example .env
```

Éditer `.env` et renseigner toutes les variables (base de données, JWT, SMTP, API Clic to Pay, etc.).

### 2. Certificat SSL auto-signé (HTTPS)

**Obligatoire** : sans certificats dans `nginx/ssl/`, Nginx ne démarre pas. Générer un certificat dans `nginx/ssl/` :

**Sur Linux / serveur on-premise :**
```bash
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem \
  -subj "/C=TN/ST=Tunis/O=PSP/CN=psp-onboarding.local"
```

Adapter `C`, `ST`, `L`, `O`, `CN` selon votre organisation. Sous Windows, installer OpenSSL (ex. via Git pour Windows) puis exécuter la même commande depuis la racine du projet.

### 3. Lancer l’environnement

```bash
docker-compose up -d --build
```

### 4. Migrations et seed (première fois)

```bash
docker exec psp-backend npx prisma migrate deploy
docker exec psp-backend npx prisma db seed
```

### 5. Accès

- **Application :** https://localhost (acceptez le certificat auto-signé dans le navigateur)
- **PgAdmin (dev) :** http://localhost:5050 (si présent dans le `docker-compose`)

### 6. Health check

L’API expose un endpoint de santé pour les sondes de monitoring ou load balancers :

```bash
curl -s https://localhost/api/health
# {"status":"ok","service":"psp-onboarding-api"}
```

### 7. Script de déploiement (prod)

Pour un déploiement en production avec `docker-compose.prod.yml` :

```bash
./scripts/deploy.sh
```

Le script exécute : `git pull`, build des images, `up -d`, puis `prisma migrate deploy`.

---

## Structure du projet

```
psp-onboarding/
├── backend/          # API Node.js + Express + Prisma
│   ├── prisma/
│   ├── src/
│   │   ├── controllers
│   │   ├── routes
│   │   ├── middleware
│   │   ├── services
│   │   ├── utils
│   │   └── types
│   ├── Dockerfile
│   └── .env.example
├── frontend/         # React 18 + Vite + Tailwind + shadcn/ui
│   ├── src/
│   │   ├── components
│   │   ├── pages
│   │   ├── hooks
│   │   ├── services
│   │   ├── types
│   │   └── contexts
│   ├── Dockerfile
│   └── Dockerfile.prod
├── nginx/            # Reverse proxy (HTTP → HTTPS, /api → backend, / → frontend)
│   ├── nginx.conf
│   ├── nginx.prod.conf
│   └── ssl/
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
└── README.md
```

---

## Développement local (sans Docker)

- **Backend :** `cd backend && npm install && npm run dev` (Prisma : `npx prisma migrate dev` puis `npx prisma db seed`).
- **Frontend :** `cd frontend && npm install && npm run dev`.
- **Base :** lancer PostgreSQL 15 localement ou via `docker-compose up -d postgres` et adapter `DATABASE_URL` dans `.env`.

---

## Compte par défaut (seed)

- **Email :** admin@psp.local  
- **Mot de passe :** Admin123!

*(À changer en production.)*
