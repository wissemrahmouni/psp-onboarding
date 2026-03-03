/**
 * Génère API_AJOUT_MARCHAND.docx dans docs/
 * À exécuter depuis la racine du projet : node scripts/generate-api-doc.js
 * Nécessite : npm install docx (dans ce dossier ou à la racine)
 */
const fs = require('fs');
const path = require('path');

let docx;
try {
  docx = require('docx');
} catch (e) {
  console.error('Installez le package docx : npm install docx');
  process.exit(1);
}

const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } = docx;

const rows = [
  ['Champ', 'Obligatoire', 'Description'],
  ['merchant_code', 'Oui', 'Code marchand (ex. Affiliation)'],
  ['company_name', 'Oui', 'Raison sociale'],
  ['email', 'Oui', 'Email contact'],
  ['technical_email', 'Oui', 'Email technique / Webmaster'],
  ['numero_terminal', 'Non', 'Numéro terminal'],
  ['trade_name', 'Non', 'Nom commercial'],
  ['address', 'Non', 'Adresse'],
  ['city', 'Non', 'Ville'],
  ['postal_code', 'Non', 'Code postal (CDP)'],
  ['country', 'Non', 'Pays'],
  ['phone', 'Non', 'Téléphone'],
  ['mcc_code', 'Non', 'Code MCC'],
  ['website', 'Non', 'URL'],
  ['currency', 'Non', 'Devise'],
  ['iban', 'Non', 'RIB'],
  ['rne', 'Non', 'RNE'],
  ['date_creation', 'Non', 'Date création (brut)'],
  ['date_modification', 'Non', 'Date modification (brut)'],
  ['type_cartes', 'Non', 'Type cartes'],
];

const table = new Table({
  rows: rows.map((row, i) => new TableRow({
    children: row.map((cell) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: cell })] })],
    })),
  })),
  width: { size: 100, type: WidthType.PERCENTAGE },
});

const doc = new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({ children: [new TextRun({ text: "API d'ajout de marchand", bold: true, size: 32 })] }),
      new Paragraph({ text: "Plateforme Onboarding Marchands PSP", spacing: { after: 200 } }),
      new Paragraph({ text: "Deux façons d'ajouter un marchand (affilié) : API v1 (clé API) pour les systèmes externes, ou API authentifiée (JWT) pour les utilisateurs connectés.", spacing: { after: 400 } }),
      new Paragraph({ children: [new TextRun({ text: "1. API v1 (clé API)", bold: true, size: 28 })] }),
      new Paragraph({ text: "URL : POST /api/v1/affiliates", spacing: { after: 100 } }),
      new Paragraph({ text: "Authentification : en-tête X-API-Key avec la clé configurée (Configuration > EXTERNAL_API_KEY).", spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: "Exemple cURL", bold: true })] }),
      new Paragraph({
        text: 'curl -X POST "https://votre-domaine/api/v1/affiliates" -H "Content-Type: application/json" -H "X-API-Key: VOTRE_CLE_API" -d \'{"merchant_code":"2490002546","company_name":"Ma Société SARL","email":"contact@exemple.com","technical_email":"tech@exemple.com"}\'',
        spacing: { after: 200 },
      }),
      new Paragraph({ children: [new TextRun({ text: "Champs de la requête (JSON)", bold: true })] }),
      table,
      new Paragraph({ text: "Noms alternatifs acceptés : CODE_MARCHAND, RAISON_SOCIALE, EMAIL, EMAIL_TECHNIQUE, ADRESSE, TEL, CODE_POSTAL, DEVISE, MCC, SITE_WEB, IBAN, etc.", spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: "Réponse succès (201)", bold: true })] }),
      new Paragraph({ text: '{"affiliate_id":"uuid","merchant_code":"2490002546","status":"CREATED_MERCHANT_MGT","created_at":"..."}', spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: "Erreurs possibles", bold: true })] }),
      new Paragraph({ text: "401 — Clé API manquante ou invalide. 400 — Champs obligatoires manquants. 400 — Ce code marchand existe déjà.", spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: "2. API authentifiée (JWT)", bold: true, size: 28 })] }),
      new Paragraph({ text: "URL : POST /api/affiliates. Authentification : Authorization: Bearer <access_token>. Réservée aux rôles ADMIN, SUPPORT, SUPER_ADMIN. Corps identique à l'API v1.", spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: "Configuration de la clé API", bold: true })] }),
      new Paragraph({ text: "1. Se connecter (admin). 2. Configuration. 3. Modifier EXTERNAL_API_KEY. 4. Utiliser cette valeur dans l'en-tête X-API-Key.", spacing: { after: 200 } }),
    ],
  }],
});

const outDir = path.join(__dirname, '..', 'docs');
const outPath = path.join(outDir, 'API_AJOUT_MARCHAND.docx');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outPath, buffer);
  console.log('Fichier créé :', outPath);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
