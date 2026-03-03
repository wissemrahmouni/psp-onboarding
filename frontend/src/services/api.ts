function getAccessToken(): string | null {
  return (window as unknown as { __psp_access_token?: string }).__psp_access_token ?? null;
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
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Réponse serveur invalide (pas du JSON).');
  }
}

export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    const refresh = localStorage.getItem('psp_refresh_token');
    if (refresh) {
      const r = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      const data = await parseJson<{ access_token?: string }>(r).catch(() => ({} as { access_token?: string }));
      if (data.access_token) {
        (window as unknown as { __psp_access_token?: string }).__psp_access_token = data.access_token;
        (headers as Record<string, string>)['Authorization'] = `Bearer ${data.access_token}`;
        const retry = await fetch(url, { ...options, headers });
        if (!retry.ok) {
          const errorData = await parseJson<{ message?: string }>(retry).catch(() => ({} as { message?: string }));
          throw new Error(errorData.message || 'Erreur');
        }
        return parseJson<T>(retry);
      }
    }
    window.dispatchEvent(new CustomEvent('psp-logout'));
    window.location.href = '/login';
    throw new Error('Session expirée');
  }
  if (!res.ok) {
    const err = await parseJson<{ message?: string }>(res).catch(() => ({} as { message?: string }));
    throw new Error(err.message || `Erreur ${res.status}`);
  }
  return parseJson<T>(res);
}
