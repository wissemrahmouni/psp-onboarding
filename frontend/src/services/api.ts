function getAccessToken(): string | null {
  return (window as unknown as { __psp_access_token?: string }).__psp_access_token ?? null;
}

/**
 * URL du backend pour l'envoi d'email (contourne le proxy si body POST mal transmis).
 * - VITE_API_URL : URL explicite du backend (ex: http://localhost:4000 ou 4001)
 * - Sinon : '' = URLs relatives via le proxy (même origine que la page)
 */
export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_URL || '';
}

/** Parse la réponse en JSON de manière sûre (évite "Unexpected end of JSON input" sur réponses vides). */
export async function safeParseJson<T>(res: Response, fallback?: T): Promise<T> {
  const text = await res.text();
  if (!text.trim()) return (fallback ?? {}) as T;
  if (text.trimStart().startsWith('<')) {
    throw new Error('Backend injoignable. Le serveur a renvoyé du HTML (backend arrêté ou proxy incorrect). Vérifiez que le backend tourne sur le port 4000.');
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Réponse serveur invalide (pas du JSON).');
  }
}

/** Parse la réponse en JSON ou lance une erreur claire si le serveur a renvoyé du HTML (ex. backend injoignable). */
async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (text.trimStart().startsWith('<')) {
      throw new Error(
        'Le serveur a renvoyé une page HTML au lieu de JSON. Vérifiez que le backend est démarré (docker compose up -d backend) et que nginx/frontend pointent vers la bonne URL.'
      );
    }
    throw new Error(text || `Erreur ${res.status}`);
  }
  if (!text.trim()) {
    throw new Error('Réponse serveur vide. Vérifiez que le backend est démarré et accessible.');
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Réponse serveur invalide (pas du JSON).');
  }
}

/** Fetch avec gestion 401 (refresh token + retry). Retourne la Response brute pour .json()/.blob(). */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  const headers: HeadersInit = { ...options.headers };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  // Ne pas forcer Content-Type si body est FormData (boundary auto)
  if (options.body && !(options.body instanceof FormData)) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  let res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    // FormData ne peut pas être réutilisé (stream consommé) : pas de retry, redirection directe
    if (options.body instanceof FormData) {
      window.dispatchEvent(new CustomEvent('psp-logout'));
      window.location.href = '/login';
      throw new Error('Session expirée');
    }
    const refresh = localStorage.getItem('psp_refresh_token');
    if (refresh) {
      const r = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      const data = await safeParseJson<{ access_token?: string }>(r, {});
      if (data.access_token) {
        (window as unknown as { __psp_access_token?: string }).__psp_access_token = data.access_token;
        (headers as Record<string, string>)['Authorization'] = `Bearer ${data.access_token}`;
        res = await fetch(url, { ...options, headers });
      }
    }
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('psp-logout'));
      window.location.href = '/login';
      throw new Error('Session expirée');
    }
  }
  return res;
}

export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const token = getAccessToken();
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetchWithAuth(url, { ...options, headers });
  if (!res.ok) {
    const err = await parseJson<{ message?: string }>(res).catch(() => ({} as { message?: string }));
    throw new Error(err.message || `Erreur ${res.status}`);
  }
  return parseJson<T>(res);
}
