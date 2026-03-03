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
