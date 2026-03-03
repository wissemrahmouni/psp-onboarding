/**
 * Page API Reference — documentation d'ajout de marchand (réservée administrateur).
 */
export function ApiReferencePage() {
  const fields = [
    { champ: 'merchant_code', obligatoire: 'Oui', description: 'Code marchand (ex. Affiliation)' },
    { champ: 'company_name', obligatoire: 'Oui', description: 'Raison sociale' },
    { champ: 'email', obligatoire: 'Oui', description: 'Email contact' },
    { champ: 'technical_email', obligatoire: 'Oui', description: 'Email technique / Webmaster' },
    { champ: 'numero_terminal', obligatoire: 'Non', description: 'Numéro terminal' },
    { champ: 'trade_name', obligatoire: 'Non', description: 'Nom commercial' },
    { champ: 'address', obligatoire: 'Non', description: 'Adresse' },
    { champ: 'city', obligatoire: 'Non', description: 'Ville' },
    { champ: 'postal_code', obligatoire: 'Non', description: 'Code postal (CDP)' },
    { champ: 'country', obligatoire: 'Non', description: 'Pays' },
    { champ: 'phone', obligatoire: 'Non', description: 'Téléphone' },
    { champ: 'mcc_code', obligatoire: 'Non', description: 'Code MCC' },
    { champ: 'website', obligatoire: 'Non', description: 'URL' },
    { champ: 'currency', obligatoire: 'Non', description: 'Devise' },
    { champ: 'iban', obligatoire: 'Non', description: 'RIB' },
    { champ: 'rne', obligatoire: 'Non', description: 'RNE' },
    { champ: 'date_creation', obligatoire: 'Non', description: 'Date création (brut)' },
    { champ: 'date_modification', obligatoire: 'Non', description: 'Date modification (brut)' },
    { champ: 'type_cartes', obligatoire: 'Non', description: 'Type cartes' },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 border-b-2 border-blue-600 pb-2 mb-4">
        API Reference — Ajout de marchand
      </h1>
      <p className="text-slate-600 mb-6">
        Deux façons d'ajouter un marchand (affilié) : <strong>API v1 (clé API)</strong> pour les systèmes externes,
        ou <strong>API authentifiée (JWT)</strong> pour les utilisateurs connectés.
      </p>

      {/* 1. API v1 */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-800 mt-6 mb-3">1. API v1 (clé API) — intégration externe</h2>
        <p className="mb-2">
          <strong>URL :</strong> <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">POST /api/v1/affiliates</code>
        </p>
        <p className="mb-4 text-slate-600">
          <strong>Authentification :</strong> en-tête <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">X-API-Key</code> avec la clé configurée (Configuration &gt; EXTERNAL_API_KEY).
        </p>

        <h3 className="text-base font-semibold text-slate-700 mt-4 mb-2">Exemple avec cURL</h3>
        <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm mb-4">
{`curl -X POST "https://votre-domaine/api/v1/affiliates" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: VOTRE_CLE_API" \\
  -d '{
    "merchant_code": "2490002546",
    "company_name": "Ma Société SARL",
    "email": "contact@exemple.com",
    "technical_email": "tech@exemple.com"
  }'`}
        </pre>

        <h3 className="text-base font-semibold text-slate-700 mt-4 mb-2">Exemple avec JavaScript (fetch)</h3>
        <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm mb-4">
{`const response = await fetch('/api/v1/affiliates', {
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
const data = await response.json();`}
        </pre>

        <h3 className="text-base font-semibold text-slate-700 mt-4 mb-2">Corps de la requête (JSON)</h3>
        <div className="overflow-x-auto border border-slate-200 rounded-lg mb-4">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200">
                <th className="text-left p-3 font-semibold text-slate-700">Champ</th>
                <th className="text-left p-3 font-semibold text-slate-700">Obligatoire</th>
                <th className="text-left p-3 font-semibold text-slate-700">Description</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((row) => (
                <tr key={row.champ} className="border-b border-slate-100">
                  <td className="p-3 font-mono text-slate-800">{row.champ}</td>
                  <td className="p-3 text-slate-600">{row.obligatoire}</td>
                  <td className="p-3 text-slate-600">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-slate-600 text-sm mb-4">
          Noms alternatifs acceptés (ex. pour alignement Excel) :{' '}
          <code className="bg-slate-100 px-1 rounded">CODE_MARCHAND</code>,{' '}
          <code className="bg-slate-100 px-1 rounded">RAISON_SOCIALE</code>,{' '}
          <code className="bg-slate-100 px-1 rounded">EMAIL</code>,{' '}
          <code className="bg-slate-100 px-1 rounded">EMAIL_TECHNIQUE</code>,{' '}
          <code className="bg-slate-100 px-1 rounded">ADRESSE</code>,{' '}
          <code className="bg-slate-100 px-1 rounded">TEL</code>,{' '}
          <code className="bg-slate-100 px-1 rounded">CODE_POSTAL</code>,{' '}
          <code className="bg-slate-100 px-1 rounded">DEVISE</code>,{' '}
          <code className="bg-slate-100 px-1 rounded">MCC</code>,{' '}
          <code className="bg-slate-100 px-1 rounded">SITE_WEB</code>,{' '}
          <code className="bg-slate-100 px-1 rounded">IBAN</code>, etc.
        </p>

        <h3 className="text-base font-semibold text-slate-700 mt-4 mb-2">Réponse succès (201)</h3>
        <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm mb-4">
{`{
  "affiliate_id": "uuid-du-marchand",
  "merchant_code": "2490002546",
  "status": "CREATED_MERCHANT_MGT",
  "created_at": "2025-02-28T12:00:00.000Z"
}`}
        </pre>

        <h3 className="text-base font-semibold text-slate-700 mt-4 mb-2">Erreurs possibles</h3>
        <ul className="list-disc list-inside text-slate-600 space-y-1 mb-4">
          <li><strong>401</strong> — Clé API manquante ou invalide : vérifier l'en-tête <code className="bg-slate-100 px-1 rounded">X-API-Key</code> et la valeur dans Configuration (EXTERNAL_API_KEY).</li>
          <li><strong>400</strong> — Champs obligatoires manquants : <code className="bg-slate-100 px-1 rounded">merchant_code</code>, <code className="bg-slate-100 px-1 rounded">company_name</code>, <code className="bg-slate-100 px-1 rounded">email</code>, <code className="bg-slate-100 px-1 rounded">technical_email</code>.</li>
          <li><strong>400</strong> — Ce code marchand existe déjà : un marchand avec ce <code className="bg-slate-100 px-1 rounded">merchant_code</code> existe déjà (création refusée).</li>
        </ul>
      </section>

      {/* 2. API JWT */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-800 mt-6 mb-3">2. API authentifiée (JWT) — application web</h2>
        <p className="mb-2">
          <strong>URL :</strong> <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">POST /api/affiliates</code>
        </p>
        <p className="mb-2 text-slate-600">
          <strong>Authentification :</strong> <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">Authorization: Bearer &lt;access_token&gt;</code> (obtenu via login).
        </p>
        <p className="text-slate-600">
          Réservée aux rôles <strong>ADMIN</strong>, <strong>SUPPORT</strong>, <strong>SUPER_ADMIN</strong>. Corps de la requête : identique à l'API v1. Réponse : même format en 201.
        </p>
      </section>

      {/* Configuration */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-800 mt-6 mb-3">Configuration de la clé API (v1)</h2>
        <ol className="list-decimal list-inside text-slate-600 space-y-2">
          <li>Se connecter à l'application (admin).</li>
          <li>Aller dans <strong>Configuration</strong>.</li>
          <li>Modifier la clé <strong>EXTERNAL_API_KEY</strong> (ex. générer une valeur longue et secrète).</li>
          <li>Utiliser cette valeur dans l'en-tête <code className="bg-slate-100 px-1 rounded">X-API-Key</code> pour les appels à <code className="bg-slate-100 px-1 rounded">/api/v1/affiliates</code>.</li>
        </ol>
      </section>

      <p className="text-slate-500 text-sm mt-8">Documentation plateforme PSP Onboarding.</p>
    </div>
  );
}
