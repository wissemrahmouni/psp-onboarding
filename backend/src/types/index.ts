import { UserRole } from '@prisma/client';

export type { UserRole };

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  bankId: string | null;
  type: 'access' | 'refresh';
}

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
  bankId: string | null;
}
