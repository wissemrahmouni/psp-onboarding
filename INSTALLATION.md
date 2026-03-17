# Guide d'installation — PSP Onboarding / Clictopay

Ce guide décrit comment installer l'application sur un nouveau PC.

---

## Prérequis

| Logiciel | Version | Obligatoire |
|----------|---------|-------------|
| **Node.js** | 20+ | Oui |
| **npm** | 9+ | Oui |
| **Git** | — | Oui (pour cloner) |
| **Docker Desktop** | — | Recommandé (PostgreSQL) |
| **PostgreSQL** | 15 | Si pas de Docker |

---

## Option A : Installation avec Docker (recommandé)

### 1. Installer Docker Desktop

- Télécharger : https://www.docker.com/products/docker-desktop/
- Installer et démarrer Docker Desktop

### 2. Cloner le projet

```powershell
git clone https://github.com/wissemrahmouni/psp-onboarding.git
cd psp-onboarding
```

### 3. Configurer les variables d'environnement

```powershell
copy .env.example .env
notepad .env
```

Renseigner au minimum :
- `DATABASE_URL` : `postgresql://postgres:postgres@postgres:5432/psp_db` (pour Docker)
- `JWT_SECRET` et `JWT_REFRESH_SECRET` : chaînes de 32+ caractères
- `ENCRYPTION_KEY` : 32 octets
- `SMTP_*` : pour l'envoi d'emails (optionnel au démarrage)

### 4. Certificat SSL (obligatoire pour HTTPS)

```powershell
mkdir nginx\ssl
```

Puis exécuter (avec OpenSSL installé, ex. via Git pour Windows) :

```powershell
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem -subj "/C=TN/ST=Tunis/O=PSP/CN=localhost"
```

### 5. Lancer l'application

```powershell
docker-compose up -d --build
```

### 6. Migrations et seed (première fois)

```powershell
docker exec psp-backend npx prisma migrate deploy
docker exec psp-backend npx prisma db seed
```

### 7. Accès

- **Application :** https://localhost (accepter le certificat auto-signé)
- **Identifiants :** admin@psp.local / Admin123!

---

## Option B : Installation sans Docker (dev local)

### 1. Installer Node.js 20+

- Télécharger : https://nodejs.org/

### 2. Installer PostgreSQL

**Option A — Docker (PostgreSQL uniquement) :**

```powershell
cd psp-onboarding
docker-compose up -d postgres
```

Puis dans `.env` : `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/psp_db`

**Option B — PostgreSQL local :**

- Installer PostgreSQL 15
- Créer : `CREATE DATABASE psp_db;`
- Configurer l'utilisateur (ex. `ALTER USER postgres PASSWORD 'postgres';`)
- Dans `.env` : `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/psp_db`

### 3. Cloner et configurer

```powershell
git clone https://github.com/wissemrahmouni/psp-onboarding.git
cd psp-onboarding
copy .env.example .env
```

Éditer `.env` et renseigner `DATABASE_URL`.

### 4. Configuration initiale

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-setup.ps1
```

Ce script :

- Démarre PostgreSQL (si Docker)
- Applique les migrations
- Crée l'utilisateur admin

### 5. Installer les dépendances et lancer

**Terminal 1 — Backend :**

```powershell
cd backend
npm install
npm run dev
```

**Terminal 2 — Frontend :**

```powershell
cd frontend
npm install
npm run dev
```

### 6. Accès

- **Application :** http://localhost:3000 ou http://localhost:3001 (selon le port affiché)
- **Identifiants :** admin@psp.local / Admin123!

---

## Configuration SMTP (pour les emails)

Pour envoyer des emails (bienvenue, paramètres, etc.) :

1. **Via l'interface :** Configuration > SMTP
2. **Via .env :**

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASS=mot-de-passe-application
SMTP_FROM_EMAIL=votre-email@gmail.com
SMTP_FROM_NAME=Clictopay
```

> Gmail : utiliser un mot de passe d'application (Compte Google > Sécurité > Mots de passe des applications).

---

## Clé API externe

Pour l'API v1 d'ajout de marchands :

1. Configuration > Générer une clé API externe
2. Ou définir `EXTERNAL_API_KEY` dans la base (table Configuration)

---

## Dépannage

| Problème | Solution |
|----------|----------|
| `Authentication failed` (PostgreSQL) | Vérifier `DATABASE_URL` et mot de passe. Voir `VERIFICATION_DB.md`. |
| Erreur P1000 | Exécuter `ALTER USER postgres PASSWORD 'postgres';` dans PostgreSQL. |
| Port 4000/3000 occupé | Le backend essaie 4001, 4002… Le frontend essaie 3001. |
| Emails non envoyés | Configurer SMTP (Configuration > SMTP ou variables d'environnement). |
| Backend injoignable | Vérifier que le backend tourne et que l'URL utilisée est correcte (3000 ou 3001). |

---

## Récapitulatif rapide

```powershell
# Avec Docker
git clone https://github.com/wissemrahmouni/psp-onboarding.git
cd psp-onboarding
copy .env.example .env
# Éditer .env
# Créer nginx/ssl/ (certificat)
docker-compose up -d --build
docker exec psp-backend npx prisma migrate deploy
docker exec psp-backend npx prisma db seed
# Ouvrir https://localhost

# Sans Docker (dev)
git clone https://github.com/wissemrahmouni/psp-onboarding.git
cd psp-onboarding
copy .env.example .env
.\scripts\dev-setup.ps1
cd backend && npm install && npm run dev   # Terminal 1
cd frontend && npm install && npm run dev   # Terminal 2
# Ouvrir http://localhost:3000
```
