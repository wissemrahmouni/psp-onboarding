# Vérification Base de Données — PSP Onboarding

## Résultat du diagnostic

| Élément | Statut |
|---------|--------|
| **PostgreSQL** | ✅ Écoute sur le port 5432 |
| **Connexion backend → DB** | ❌ Échec d'authentification |
| **API /api/health** | ✅ OK |
| **API /api/health/db** | ❌ `Base de données injoignable` |

## Erreur Prisma

```
P1000: Authentication failed against database server at `localhost`, 
the provided database credentials for `(not available)` are not valid.
```

## Configuration actuelle

- **DATABASE_URL** : `postgresql://postgres:postgres@localhost:5432/psp_db`
- **Fichier** : `backend/.env` et `.env` à la racine

## Causes possibles

1. **PostgreSQL local** (pas Docker) : les identifiants `postgres/postgres` peuvent être incorrects pour votre installation locale.
2. **Docker non démarré** : Docker Desktop n’est pas en cours d’exécution. Si vous utilisez PostgreSQL via Docker, lancez Docker Desktop puis `docker-compose up -d postgres`.
3. **Base `psp_db` absente** : la base de données peut ne pas exister.

## Solutions

### Option A — Utiliser Docker (recommandé)

1. Démarrer Docker Desktop.
2. Lancer PostgreSQL :
   ```powershell
   cd C:\payment-gateway-sandbox\psp-onboarding
   docker-compose up -d postgres
   ```
3. Appliquer les migrations :
   ```powershell
   cd backend
   npx prisma migrate deploy
   npx prisma db seed
   ```

### Option B — PostgreSQL local (mot de passe incorrect)

Si vous avez installé PostgreSQL manuellement sur Windows, le mot de passe `postgres` n’est peut‑être pas configuré.

**Étape 1 — Définir le mot de passe `postgres` :**

Ouvrez **pgAdmin** ou **psql** et exécutez :

```sql
ALTER USER postgres PASSWORD 'postgres';
```

Ou via PowerShell (si `psql` est dans le PATH) :

```powershell
$env:PGPASSWORD=''; psql -U postgres -h localhost -c "ALTER USER postgres PASSWORD 'postgres';"
```

**Étape 2 — Créer la base si nécessaire :**

```sql
CREATE DATABASE psp_db;
```

**Étape 3 — Adapter `backend/.env` si vos identifiants diffèrent :**

```
DATABASE_URL=postgresql://VOTRE_USER:VOTRE_PASSWORD@localhost:5432/psp_db
```

Si le mot de passe contient des caractères spéciaux, encoder l’URL (ex. `@` → `%40`).

**Étape 4 — Appliquer les migrations :**

```powershell
cd backend
npx prisma migrate deploy
npx prisma db seed
```

### Vérification après correction

```powershell
# Test connexion
curl http://localhost:4000/api/health/db
# Attendu : {"status":"ok","db":"connected"}
```
