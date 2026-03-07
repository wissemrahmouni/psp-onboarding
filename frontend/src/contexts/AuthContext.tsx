import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User } from '../types/auth';
import { safeParseJson } from '../services/api';

const REFRESH_TOKEN_KEY = 'psp_refresh_token';

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  setTokens: (access: string, refresh: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (window as unknown as { __psp_access_token?: string }).__psp_access_token = accessToken ?? undefined;
  }, [accessToken]);

  const setTokens = useCallback((access: string, refresh: string) => {
    setAccessToken(access);
    try {
      localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    } catch {}
  }, []);

  const fetchMe = useCallback(async (token: string) => {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await safeParseJson(res, null);
      if (data) setUser(data);
    } else {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }, []);

  useEffect(() => {
    const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refresh) {
      setIsLoading(false);
      return;
    }
    fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
      .then((r) => safeParseJson<{ access_token?: string }>(r, {}))
      .then((data) => {
        if (data.access_token) {
          setAccessToken(data.access_token);
          fetchMe(data.access_token);
        }
      })
      .catch(() => {
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      })
      .finally(() => setIsLoading(false));
  }, [fetchMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      let res: Response;
      try {
        res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed')) {
          throw new Error('Backend injoignable. Vérifiez que le backend est démarré (npm run dev dans backend/) et que le proxy pointe vers localhost:4000.');
        }
        throw err;
      }
      const data = await safeParseJson<{ access_token?: string; refresh_token?: string; user?: User; message?: string }>(res, {});
      if (!res.ok) {
        throw new Error(data.message || 'Connexion impossible');
      }
      setAccessToken(data.access_token);
      try {
        localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
      } catch {}
      setUser(data.user);
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    (window as unknown as { __psp_access_token?: string }).__psp_access_token = undefined;
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    }).catch(() => {});
  }, [accessToken]);

  useEffect(() => {
    const onLogout = () => {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      (window as unknown as { __psp_access_token?: string }).__psp_access_token = undefined;
    };
    window.addEventListener('psp-logout', onLogout);
    return () => window.removeEventListener('psp-logout', onLogout);
  }, []);

  const hasRole = useCallback(
    (role: string) => (user?.role ? user.role === role : false),
    [user]
  );

  const hasAnyRole = useCallback(
    (roles: string[]) => (user?.role ? roles.includes(user.role) : false),
    [user]
  );

  const value: AuthContextValue = {
    user,
    accessToken,
    isAuthenticated: !!user && !!accessToken,
    isLoading,
    login,
    logout,
    hasRole,
    hasAnyRole,
    setTokens,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
