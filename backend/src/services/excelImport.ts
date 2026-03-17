import * as XLSX from 'xlsx';
import { AffiliateStatus } from '@prisma/client';

/**
 * Import Excel (.xlsx ou .xls). Structure attendue (libellés du fichier) :
 * Affiliation, Numero Terminal, Raison Sociale, Adresse, Telephone, Email, MCC, URL, RNE, CDP, Devise, RIB,
 * Date Creation, Date Modification, Ajouter Par, Webmaster, Type Cartes
 * Obligatoires : Affiliation (ou CODE_MARCHAND), Raison Sociale, Email. Webmaster optionnel (sinon = Email).
 */
const HEADERS = [
  'CODE_MARCHAND',
  'NUMERO_TERMINAL',
  'RAISON_SOCIALE',
  'NOM_COMMERCIAL',
  'ACTIVITE',
  'ADRESSE',
  'VILLE',
  'CODE_POSTAL',
  'PAYS',
  'TEL',
  'EMAIL',
  'EMAIL_TECHNIQUE',
  'NOM_CONTACT',
  'PRENOM_CONTACT',
  'SITE_WEB',
  'DEVISE',
  'MCC',
  'IBAN',
  'BIC',
  'RNE',
  'DATE_CREATION',
  'DATE_MODIFICATION',
  'TYPE_CARTES',
] as const;

/** Mapping fichier → champs internes. Toutes les variantes possibles (normalisées). */
const HEADER_ALIASES: Record<string, string[]> = {
  CODE_MARCHAND: ['AFFILIATION'],
  NUMERO_TERMINAL: ['NUMERO TERMINAL'],
  RAISON_SOCIALE: ['RAISON SOCIALE'],
  ADRESSE: ['ADRESSE'],
  TEL: ['TELEPHONE'],
  EMAIL: ['EMAIL'],
  EMAIL_TECHNIQUE: ['WEBMASTER', 'EMAIL TECHNIQUE', 'EMAIL'],
  CODE_POSTAL: ['CDP'],
  DEVISE: ['DEVISE'],
  MCC: ['MCC'],
  SITE_WEB: ['URL'],
  IBAN: ['RIB'],
  RNE: ['RNE'],
  DATE_CREATION: ['DATE CREATION'],
  DATE_MODIFICATION: ['DATE MODIFICATION'],
  TYPE_CARTES: ['TYPE CARTES'],
};

/** Champs obligatoires (interne). EMAIL_TECHNIQUE est rempli par Webmaster ou Email si vide. */
const REQUIRED = ['CODE_MARCHAND', 'RAISON_SOCIALE', 'EMAIL'] as const;
const REQUIRED_LABELS: Record<string, string> = {
  CODE_MARCHAND: 'Affiliation',
  RAISON_SOCIALE: 'Raison Sociale',
  EMAIL: 'Email',
};

/**
 * Convertit un numéro de série Excel (ex: 46086.45416666667) ou une chaîne date en ISO.
 * Excel stocke les dates en jours depuis 1899-12-30. 25569 = 1970-01-01.
 */
function normalizeExcelDate(value: string | number | Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString();
  const str = String(value).trim();
  if (!str) return null;
  const num = parseFloat(str);
  if (!isNaN(num) && num >= 1 && num < 1000000) {
    const ms = (num - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString();
  return str;
}

function normalizeHeader(c: unknown): string {
  const s = String(c ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[\uFEFF]/g, ''); // BOM
  return s;
}

/** Trouve la ligne qui contient les en-têtes (celle qui matche le plus de colonnes connues). */
function findHeaderRow(rows: unknown[][]): number {
  const knownNorm = new Set<string>();
  Object.values(HEADER_ALIASES).flat().forEach((a) => knownNorm.add(a));
  ['CODE_MARCHAND', 'AFFILIATION', 'RAISON SOCIALE', 'EMAIL', 'WEBMASTER'].forEach((a) => knownNorm.add(a));

  let bestRow = 0;
  let bestCount = 0;
  const maxScan = Math.min(10, rows.length);
  for (let r = 0; r < maxScan; r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row)) continue;
    let count = 0;
    for (let i = 0; i < row.length; i++) {
      const norm = normalizeHeader(row[i]);
      if (norm && knownNorm.has(norm)) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestRow = r;
    }
  }
  return bestRow;
}

export interface ExcelRow {
  CODE_MARCHAND: string;
  NUMERO_TERMINAL?: string;
  RAISON_SOCIALE: string;
  NOM_COMMERCIAL?: string;
  ACTIVITE?: string;
  ADRESSE?: string;
  VILLE?: string;
  CODE_POSTAL?: string;
  PAYS?: string;
  TEL?: string;
  EMAIL: string;
  EMAIL_TECHNIQUE: string;
  NOM_CONTACT?: string;
  PRENOM_CONTACT?: string;
  SITE_WEB?: string;
  DEVISE?: string;
  MCC?: string;
  IBAN?: string;
  BIC?: string;
  RNE?: string;
  DATE_CREATION?: string;
  DATE_MODIFICATION?: string;
  TYPE_CARTES?: string;
}

export interface RowResult {
  row: number;
  data?: ExcelRow;
  error?: string;
}

export function parseExcelBuffer(buffer: Buffer): RowResult[] {
  const results: RowResult[] = [];
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return results;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
  if (rows.length < 2) return results;

  const headerRowIndex = findHeaderRow(rows);
  const headerRow = rows[headerRowIndex] as unknown[];
  const colIndex: Record<string, number> = {};
  HEADERS.forEach((h) => {
    const accepted = [h, ...(HEADER_ALIASES[h] || [])];
    const i = headerRow.findIndex((c) => accepted.includes(normalizeHeader(c)));
    if (i >= 0) colIndex[h] = i;
  });

  const dataStartRow = headerRowIndex + 1;
  for (let r = dataStartRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row)) continue;
    const obj: Record<string, string> = {};
    HEADERS.forEach((h) => {
      const i = colIndex[h];
      const raw = i !== undefined && row[i] !== undefined && row[i] !== null ? row[i] : '';
      let rawForDate: string | number | Date | null | undefined = '';
      if (typeof raw === 'string' || typeof raw === 'number') rawForDate = raw;
      else if (raw instanceof Date) rawForDate = raw;
      let val: string;
      if (h === 'DATE_CREATION' || h === 'DATE_MODIFICATION') {
        const normalized = normalizeExcelDate(rawForDate);
        val = normalized ?? '';
      } else {
        val = typeof raw === 'number' || typeof raw === 'object' ? String(raw) : String(raw).trim();
      }
      obj[h] = val.trim();
    });
    const data = obj as unknown as ExcelRow;
    const isRowEmpty = !Object.values(obj).some((v) => String(v).trim() !== '');
    if (isRowEmpty) continue;
    if (data.EMAIL && !data.EMAIL_TECHNIQUE) data.EMAIL_TECHNIQUE = data.EMAIL;
    const missing = REQUIRED.filter((k) => !(data[k] && String(data[k]).trim()));
    if (missing.length) {
      const labels = missing.map((k) => REQUIRED_LABELS[k] || k).join(', ');
      results.push({ row: r + 1, error: `Champs obligatoires manquants: ${labels}` });
      continue;
    }
    if (!data.CODE_MARCHAND?.trim() || !data.RAISON_SOCIALE?.trim() || !data.EMAIL?.trim()) {
      results.push({ row: r + 1, error: 'Champs obligatoires vides (Affiliation, Raison Sociale, Email)' });
      continue;
    }
    if (!data.EMAIL_TECHNIQUE?.trim()) data.EMAIL_TECHNIQUE = data.EMAIL;
    results.push({ row: r + 1, data });
  }
  return results;
}

export function rowToAffiliateCreate(data: ExcelRow, createdBy: string) {
  return {
    merchant_code: data.CODE_MARCHAND,
    numero_terminal: data.NUMERO_TERMINAL || null,
    company_name: data.RAISON_SOCIALE,
    trade_name: data.NOM_COMMERCIAL || null,
    activity: data.ACTIVITE || null,
    address: data.ADRESSE || null,
    city: data.VILLE || null,
    postal_code: data.CODE_POSTAL || null,
    country: data.PAYS || null,
    phone: data.TEL || null,
    email: data.EMAIL,
    technical_email: data.EMAIL_TECHNIQUE,
    contact_name: data.NOM_CONTACT || null,
    contact_firstname: data.PRENOM_CONTACT || null,
    website: data.SITE_WEB || null,
    currency: data.DEVISE || null,
    mcc_code: data.MCC || null,
    iban: data.IBAN || null,
    bic: data.BIC || null,
    rne: data.RNE || null,
    date_creation: data.DATE_CREATION || null,
    date_modification: data.DATE_MODIFICATION || null,
    type_cartes: data.TYPE_CARTES || null,
    status: 'CREATED_MERCHANT_MGT' as AffiliateStatus,
    created_by: createdBy,
  };
}

/** Données à appliquer en mise à jour (sans changer status ni created_by). */
export function rowToAffiliateUpdate(data: ExcelRow) {
  return {
    numero_terminal: data.NUMERO_TERMINAL || null,
    company_name: data.RAISON_SOCIALE,
    trade_name: data.NOM_COMMERCIAL || null,
    activity: data.ACTIVITE || null,
    address: data.ADRESSE || null,
    city: data.VILLE || null,
    postal_code: data.CODE_POSTAL || null,
    country: data.PAYS || null,
    phone: data.TEL || null,
    email: data.EMAIL,
    technical_email: data.EMAIL_TECHNIQUE,
    contact_name: data.NOM_CONTACT || null,
    contact_firstname: data.PRENOM_CONTACT || null,
    website: data.SITE_WEB || null,
    currency: data.DEVISE || null,
    mcc_code: data.MCC || null,
    iban: data.IBAN || null,
    bic: data.BIC || null,
    rne: data.RNE || null,
    date_creation: data.DATE_CREATION || null,
    date_modification: data.DATE_MODIFICATION || null,
    type_cartes: data.TYPE_CARTES || null,
  };
}

/**
 * Structure AFFILIATION_BO1902.xls.xlsx (ordre et libellés exacts).
 * Le modèle téléchargeable et l'import attendent cette première ligne.
 */
const FILE_HEADERS = [
  'Affiliation',
  'Numero Terminal',
  'Raison Sociale',
  'Adresse',
  'Telephone',
  'Email',
  'MCC',
  'URL',
  'RNE',
  'CDP',
  'Devise',
  'RIB',
  'Date Creation',
  'Date Modification',
  'Ajouter Par',
  'Webmaster',
  'Type Cartes',
];

export function buildTemplateBuffer(): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([
    FILE_HEADERS,
    [
      'MARCHAND001',
      'TERM001',
      'Société Example SARL',
      '1 rue Example',
      '0100000000',
      'contact@example.com',
      '5411',
      'https://example.com',
      '',
      '75001',
      'EUR',
      'FR7630006000011234567890189',
      '',
      '',
      '',
      'tech@example.com',
      '',
    ],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'AFFILIATION_BO1902');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
