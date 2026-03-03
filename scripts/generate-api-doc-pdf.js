/**
 * Génère API_AJOUT_MARCHAND.pdf dans docs/ à partir du HTML.
 * À exécuter depuis la racine du projet : node scripts/generate-api-doc-pdf.js
 * Nécessite : npm install puppeteer
 */
const fs = require('fs');
const path = require('path');

let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  console.error('Installez puppeteer : npm install puppeteer --save-dev');
  process.exit(1);
}

const docsDir = path.join(__dirname, '..', 'docs');
const htmlPath = path.join(docsDir, 'API_AJOUT_MARCHAND.html');
const pdfPath = path.join(docsDir, 'API_AJOUT_MARCHAND.pdf');

if (!fs.existsSync(htmlPath)) {
  console.error('Fichier HTML introuvable :', htmlPath);
  process.exit(1);
}

async function main() {
  const browser = await puppeteer.launch({ headless: 'new' });
  try {
    const page = await browser.newPage();
    const fileUrl = 'file:///' + path.resolve(htmlPath).replace(/\\/g, '/');
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    });
    console.log('PDF créé :', pdfPath);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
