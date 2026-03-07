# Démarrage rapide — PSP Onboarding

## Prérequis

- Node.js 20+
- Docker Desktop (pour PostgreSQL) **ou** PostgreSQL installé localement
- npm

## Option A : Dev local (recommandé)

### 1. Démarrer PostgreSQL

**Avec Docker :**
```powershell
docker-compose up -d postgres
```
PostgreSQL sera accessible sur `localhost:5432` (user: postgres, password: postgres).

**Sans Docker :** PostgreSQL doit tourner sur `localhost:5432` avec une base `psp_db`.

### 2. Configuration initiale

```powershell
npm run dev:setup
```

Ce script :
- Attend que PostgreSQL soit prêt
- Applique les migrations
- Crée l'utilisateur admin

### 3. Lancer l'application

**Terminal 1 — Backend :**
```powershell
cd backend
npm run dev
```
→ Backend sur http://localhost:4000

**Terminal 2 — Frontend :**
```powershell
cd frontend
npm run dev
```
→ Frontend sur http://localhost:3000

### 4. Connexion

- **URL :** http://localhost:3000
- **Email :** admin@psp.local
- **Mot de passe :** Admin123!

---

## Option B : Stack Docker complet

```powershell
docker-compose up -d
```

- **URL :** http://localhost (port 80, via nginx)
- **Identifiants :** admin@psp.local / Admin123!

---

## Dépannage

| Erreur | Solution |
|--------|----------|
| "Backend injoignable" | Vérifier que le backend tourne (`cd backend && npm run dev`). Utilisez l’URL affichée par Vite (ex. http://localhost:3001) |
| "Connexion impossible" | Backend ou base de données inaccessible. **Solution rapide :** `docker-compose up -d` puis http://localhost |
| "Base de données injoignable" | Le backend ne peut pas joindre PostgreSQL. Utilisez **Option B** (stack Docker) |
| "Identifiants incorrects" | Vérifier admin@psp.local / Admin123! ou exécuter `npm run dev:setup` |
| "Authentication failed" (PostgreSQL) | Conflit avec un PostgreSQL local. Utilisez `docker-compose up -d` (stack complète) |
