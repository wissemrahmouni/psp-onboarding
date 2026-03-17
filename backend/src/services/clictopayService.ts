/** URLs par défaut des API ClicToPay getStatus.do. */
const DEFAULT_CLICTOPAY_URLS: Record<'TEST' | 'PROD', string> = {
  TEST: 'https://test.clictopay.com/epg/rest/merchant/getStatus.do',
  PROD: 'https://www.clictopay.com/epg/rest/merchant/getStatus.do',
};

export interface ClicToPaySyncConfig {
  url: string;
  username: string;
  password: string;
}

/** Récupère la config ClicToPay depuis la base (priorité) ou les variables d'environnement. */
export async function getClicToPaySyncConfig(environment: 'TEST' | 'PROD'): Promise<ClicToPaySyncConfig | null> {
  const urlKey = environment === 'TEST' ? 'CLICTOPAY_TEST_URL' : 'CLICTOPAY_PROD_URL';
  const usernameKey = environment === 'TEST' ? 'CLICTOPAY_TEST_USERNAME' : 'CLICTOPAY_PROD_USERNAME';
  const passwordKey = environment === 'TEST' ? 'CLICTOPAY_TEST_PASSWORD' : 'CLICTOPAY_PROD_PASSWORD';

  let url = '';
  let username = '';
  let password = '';

  try {
    const { prisma } = await import('./prisma');
    const configs = await prisma.configuration.findMany({
      where: { key: { in: [urlKey, usernameKey, passwordKey] } },
      select: { key: true, value: true },
    });
    const byKey = Object.fromEntries(configs.map((c) => [c.key, c.value?.trim() || '']));
    url = byKey[urlKey] || process.env[urlKey]?.trim() || DEFAULT_CLICTOPAY_URLS[environment];
    username = byKey[usernameKey] || process.env[usernameKey] || '';
    password = byKey[passwordKey] || process.env[passwordKey] || '';
  } catch {
    url = process.env[urlKey]?.trim() || DEFAULT_CLICTOPAY_URLS[environment];
    username = process.env[usernameKey] || '';
    password = process.env[passwordKey] || '';
  }

  if (!username || !password) return null;
  return { url, username, password };
}

const MERCHANT_ID_MIN = 500000;
const MERCHANT_ID_MAX = 539747;

export { MERCHANT_ID_MIN, MERCHANT_ID_MAX };

/**
 * Appel API ClicToPay getStatus.do pour synchroniser.
 * Utilise config si fourni, sinon charge depuis getClicToPaySyncConfig.
 * merchantId peut être un nombre (scan) ou une chaîne (ex. merchant_code).
 */
export async function syncWithClicToPay(
  merchantId: string | number,
  environment: 'TEST' | 'PROD',
  config?: ClicToPaySyncConfig | null
): Promise<Record<string, unknown> | null> {
  const cfg = config ?? (await getClicToPaySyncConfig(environment));
  if (!cfg) return null;
  const params = new URLSearchParams({
    username: cfg.username,
    password: cfg.password,
    merchantId: String(merchantId),
  });

  try {
    const res = await fetch(`${cfg.url}?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json, application/xml, text/plain, */*' },
    });
    const text = await res.text();
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { raw: text, _contentType: res.headers.get('content-type') || 'unknown' } as Record<string, unknown>;
    }
  } catch {
    return null;
  }
}

/** Cherche une clé (insensible à la casse) dans un objet, y compris imbriqué. */
function findKey(obj: unknown, key: string): unknown {
  if (obj == null || typeof obj !== 'object') return undefined;
  const o = obj as Record<string, unknown>;
  const keyLower = key.toLowerCase();
  for (const k of Object.keys(o)) {
    if (k.toLowerCase() === keyLower) return o[k];
  }
  for (const v of Object.values(o)) {
    if (v != null && typeof v === 'object') {
      const found = findKey(v, key);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/**
 * Extrait l'objet "data" contenant processingId/terminalId depuis les structures ClicToPay courantes :
 * - { data: { processingId, terminalId, ... } }
 * - { response: { data: { processingId, terminalId, ... } } }
 */
function resolveDataObject(data: Record<string, unknown>): Record<string, unknown> | null {
  const d = data.data;
  if (d != null && typeof d === 'object' && !Array.isArray(d)) {
    const inner = d as Record<string, unknown>;
    if (inner.processingId != null || inner.terminalId != null || findKey(inner, 'processingId') != null) {
      return inner;
    }
  }
  const resp = data.response;
  if (resp != null && typeof resp === 'object' && !Array.isArray(resp)) {
    const resolved = resolveDataObject(resp as Record<string, unknown>);
    if (resolved) return resolved;
  }
  return null;
}

/** Extrait processingId et terminalId de la réponse API (racine, imbriqué, tableau, insensible à la casse). */
export function extractProcessingIdAndTerminalId(data: Record<string, unknown> | unknown[] | null): { processingId: string | null; terminalId: string | null } {
  if (data == null || typeof data !== 'object') return { processingId: null, terminalId: null };
  let obj: unknown = data;
  if (Array.isArray(data) && data.length > 0) {
    obj = data[0];
  } else {
    const resolved = resolveDataObject(data as Record<string, unknown>);
    if (resolved) {
      obj = resolved;
    } else if (typeof (data as Record<string, unknown>).data === 'string') {
      try {
        obj = JSON.parse((data as Record<string, unknown>).data as string) as Record<string, unknown>;
      } catch {
        /* ignore */
      }
    } else {
      for (const key of ['raw', 'body', 'content', 'result']) {
        const val = (data as Record<string, unknown>)[key];
        if (typeof val === 'string' && (val.trim().startsWith('{') || val.trim().startsWith('['))) {
          try {
            const parsed = JSON.parse(val) as unknown;
            if (parsed && typeof parsed === 'object') {
              obj = parsed;
              break;
            }
          } catch {
            /* ignore */
          }
        }
      }
    }
  }
  const o = obj as Record<string, unknown> | null;
  const p = o?.processingId ?? findKey(obj, 'processingId');
  const t = o?.terminalId ?? findKey(obj, 'terminalId');
  const processingId = p != null && String(p).trim() !== '' ? String(p).trim() : null;
  const terminalId = t != null && String(t).trim() !== '' ? String(t).trim() : null;
  return { processingId: processingId || null, terminalId: terminalId || null };
}

/**
 * Vérifie si les credentials ClicToPay sont configurés pour un environnement (config ou env).
 */
export async function isClicToPaySyncConfigured(environment: 'TEST' | 'PROD'): Promise<boolean> {
  const cfg = await getClicToPaySyncConfig(environment);
  return !!cfg;
}

/**
 * Appel API Clic to Pay pour vérifier les tests d'un marchand.
 * Réponse attendue (exemple) : { transactions_found, success, criteria: { success_status, return_code, ... } }
 */

export interface ClicToPayValidationResult {
  transactions_found: number;
  overall_result: boolean;
  criteria_success_status: boolean;
  criteria_return_code: boolean;
  criteria_auth_number: boolean;
  criteria_reference: boolean;
  criteria_card_type: boolean;
  criteria_scenarios: boolean;
  api_response: Record<string, unknown>;
}

export async function verifyMerchantTests(merchantCode: string): Promise<ClicToPayValidationResult | null> {
  const baseUrl = process.env.CLICTOPAY_API_BASE_URL?.replace(/\/$/, '');
  const apiKey = process.env.CLICTOPAY_API_KEY;
  if (!baseUrl || !apiKey) return null;

  try {
    const url = `${baseUrl}/merchants/${encodeURIComponent(merchantCode)}/validation`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });
    const data = (await res.json()) as Record<string, unknown>;
    const criteria = (data.criteria as Record<string, unknown>) || {};
    return {
      transactions_found: Number(data.transactions_found) || 0,
      overall_result: Boolean(data.success ?? data.overall_result),
      criteria_success_status: Boolean(criteria.success_status),
      criteria_return_code: Boolean(criteria.return_code),
      criteria_auth_number: Boolean(criteria.auth_number),
      criteria_reference: Boolean(criteria.reference),
      criteria_card_type: Boolean(criteria.card_type),
      criteria_scenarios: Boolean(criteria.scenarios),
      api_response: data,
    };
  } catch {
    return null;
  }
}

export function isClicToPayConfigured(): boolean {
  return !!(process.env.CLICTOPAY_API_BASE_URL && process.env.CLICTOPAY_API_KEY);
}
