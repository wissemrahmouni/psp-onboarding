# Tester l’API d’ajout d’un nouveau marchand

Deux façons d’ajouter un marchand via l’API :

- **1. API JWT** (application web) : `POST /api/affiliates` — authentification par token (login).
- **2. API externe** : `POST /api/v1/affiliates` — authentification par clé API (`X-API-Key`).

Base URL par défaut : **http://localhost:4000** (ou la valeur de `PORT` du backend).

---

## 1. Obtenir un token (pour l’API JWT)

```bash
curl -X POST http://localhost:4000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@psp.local\",\"password\":\"VOTRE_MOT_DE_PASSE\"}"
```

Réponse attendue (exemple) :
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "...",
  "user": { "id": "...", "email": "...", "role": "SUPER_ADMIN", ... }
}
```

Copiez la valeur de **`access_token`** pour l’étape suivante.

---

## 2. Ajouter un marchand avec l’API JWT

**Endpoint :** `POST /api/affiliates`  
**En-tête :** `Authorization: Bearer <access_token>`

### Exemple curl (Windows PowerShell / cmd)

```bash
curl -X POST http://localhost:4000/api/affiliates ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer VOTRE_ACCESS_TOKEN_ICI" ^
  -d "{\"merchant_code\":\"MARCHAND-TEST-001\",\"company_name\":\"Société Test SARL\",\"email\":\"contact@test.com\",\"technical_email\":\"tech@test.com\"}"
```

### Champs obligatoires

| Champ             | Description        |
|-------------------|--------------------|
| `merchant_code`   | Code marchand (ex. MARCHAND-TEST-001) |
| `company_name`    | Raison sociale     |
| `email`           | Email contact      |
| `technical_email` | Email technique    |

### Champs optionnels (exemples)

- `numero_terminal`, `trade_name`, `activity`, `address`, `city`, `postal_code`, `country`, `phone`
- `website`, `currency`, `mcc_code`, `iban`, `bic`, `rne`
- `contact_name`, `contact_firstname`, `date_creation`, `date_modification`, `type_cartes`

Réponse attendue : **201** avec l’objet affilié créé (id, merchant_code, status, etc.).

---

## 3. Ajouter un marchand avec l’API v1 (clé API)

**Endpoint :** `POST /api/v1/affiliates`  
**En-tête :** `X-API-Key: VOTRE_CLE_API`

La clé API est celle configurée dans l’application (Configuration → **EXTERNAL_API_KEY**). Vous pouvez en générer une depuis la page Configuration.

### Exemple curl (Windows)

```bash
curl -X POST http://localhost:4000/api/v1/affiliates ^
  -H "Content-Type: application/json" ^
  -H "X-API-Key: VOTRE_CLE_EXTERNAL_API_KEY" ^
  -d "{\"merchant_code\":\"MARCHAND-V1-002\",\"company_name\":\"Société API v1\",\"email\":\"contact@api.com\",\"technical_email\":\"tech@api.com\"}"
```

Corps identique à l’API JWT. Réponse **201** avec `affiliate_id`, `merchant_code`, `status`, `created_at`.

---

## 4. Tester depuis l’interface web

1. Démarrer le backend et le frontend.
2. Se connecter (ex. admin@psp.local).
3. Aller dans **Affiliés** → **Nouveau marchand**.
4. Remplir les champs obligatoires (code marchand, raison sociale, email, email technique) et enregistrer.

C’est le même endpoint que l’API JWT (`POST /api/affiliates`) appelé par l’application avec le token de la session.

---

## 5. Vérifications rapides

- **Backend démarré :** `curl http://localhost:4000/api/health` → `{"status":"ok",...}`
- **401 sur /api/affiliates :** token manquant ou expiré → refaire un login.
- **401 sur /api/v1/affiliates :** clé `X-API-Key` manquante ou différente de `EXTERNAL_API_KEY`.
- **400 "Ce code marchand existe déjà" :** utiliser un autre `merchant_code`.
