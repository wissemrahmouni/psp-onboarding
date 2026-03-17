import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse date_creation/date_modification (ISO ou numéro série Excel) → Date | null.
 * Excel stocke les dates en jours depuis 1899-12-30. 25569 = 1970-01-01.
 */
export function parseDateOrExcelSerial(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;
  const num = parseFloat(str);
  if (!isNaN(num) && num >= 1 && num < 1000000) {
    const ms = (num - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  return null;
}

/** Date affichée : celle du fichier Excel (Date de création) si valide, sinon createdAt. */
export function getDisplayDate(dateCreation: string | null | undefined, createdAt: string): string {
  const parsed = parseDateOrExcelSerial(dateCreation);
  if (parsed) return parsed.toLocaleDateString('fr-FR');
  return new Date(createdAt).toLocaleDateString('fr-FR');
}

/** Formate date_creation/date_modification pour affichage (gère série Excel). */
export function formatDateField(value: string | number | null | undefined): string {
  const parsed = parseDateOrExcelSerial(value);
  if (parsed) return parsed.toLocaleDateString('fr-FR');
  return '—';
}
