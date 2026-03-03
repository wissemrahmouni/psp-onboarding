export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'BANQUE' | 'PAYFAC';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  bankId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  bank?: { id: string; name: string; code: string };
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
