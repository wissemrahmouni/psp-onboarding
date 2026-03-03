# API d'ajout de marchand

Deux façons d’ajouter un marchand (affilié) : **API v1 (clé API)** pour les systèmes externes, ou **API authentifiée (JWT)** pour les utilisateurs connectés.

---

## 1. API v1 (clé API) — pour l’intégration externe

**URL :** `POST /api/v1/affiliates`  
**Authentification :** en-tête `X-API-Key` avec la clé configurée (Configuration > EXTERNAL_API_KEY).

### Exemple avec cURL

```bash
curl -X POST "https://votre-domaine/api/v1/affiliates" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: VOTRE_CLE_API" \
  -d '{
    "merchant_code": "2490002546",
    "company_name": "Ma Société SARL",
    "email": "contact@exemple.com",
    "technical_email": "tech@exemple.com"
  }'
```

### Exemple avec JavaScript (fetch)

```javascript
const response = await fetch('/api/v1/affiliates', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'VOTRE_CLE_API',
  },
  body: JSON.stringify({
    merchant_code: '2490002546',
    company_name: 'Ma Société SARL',
    email: 'contact@exemple.com',
    technical_email: 'tech@exemple.com',
  }),
});
const data = await response.json();
```

### Corps de la requête (JSON)

| Champ              | Obligatoire | Description                    |
|--------------------|-------------|--------------------------------|
| merchant_code      | Oui         | Code marchand (ex. Affiliation) |
| company_name       | Oui         | Raison sociale                 |
| email              | Oui         | Email contact                  |
| technical_email    | Oui         | Email technique / Webmaster    |
| numero_terminal    | Non         | Numéro terminal                |
| trade_name         | Non         | Nom commercial                 |
| address            | Non         | Adresse                       |
| city               | Non         | Ville                         |
| postal_code        | Non         | Code postal (CDP)             |
| country            | Non         | Pays                          |
| phone              | Non         | Téléphone                     |
| mcc_code           | Non         | Code MCC                      |
| website            | Non         | URL                           |
| currency           | Non         | Devise                        |
| iban               | Non         | RIB                           |
| rne                | Non         | RNE                           |
| date_creation      | Non         | Date création (brut)          |
| date_modification  | Non         | Date modification (brut)      |
| type_cartes        | Non         | Type cartes                   |

Noms alternatifs acceptés (ex. pour alignement Excel) :  
`CODE_MARCHAND`, `RAISON_SOCIALE`, `EMAIL`, `EMAIL_TECHNIQUE`, `ADRESSE`, `TEL`, `CODE_POSTAL`, `DEVISE`, `MCC`, `SITE_WEB`, `IBAN`, etc.

### Réponse succès (201)

```json
{
  "affiliate_id": "uuid-du-marchand",
  "merchant_code": "2490002546",
  "status": "CREATED_MERCHANT_MGT",
  "created_at": "2025-02-28T12:00:00.000Z"
}
```

### Erreurs possibles

- **401** — Clé API manquante ou invalide : vérifier l’en-tête `X-API-Key` et la valeur dans Configuration (EXTERNAL_API_KEY).
- **400** — `Champs obligatoires: merchant_code, company_name, email, technical_email` : au moins un des 4 champs manquant.
- **400** — `Ce code marchand existe déjà` : un marchand avec ce `merchant_code` existe déjà (création refusée).

---

## 2. API authentifiée (JWT) — pour l’application web

**URL :** `POST /api/affiliates`  
**Authentification :** `Authorization: Bearer <access_token>` (obtenu via login).

Réservée aux rôles **ADMIN**, **SUPPORT**, **SUPER_ADMIN**.  
Corps de la requête : identique à l’API v1 (voir tableau ci‑dessus).  
Réponse : même format que l’API v1 en 201, ou objet marchand complet selon l’implémentation.

---

## Configuration de la clé API (v1)

1. Se connecter à l’application (admin).
2. Aller dans **Configuration**.
3. Modifier la clé **EXTERNAL_API_KEY** (ex. générer une valeur longue et secrète).
4. Utiliser cette valeur dans l’en-tête `X-API-Key` pour les appels à `/api/v1/affiliates`.
