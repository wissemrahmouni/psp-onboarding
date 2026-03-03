import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma';
import { verifyAccessToken } from '../utils/jwt';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token manquant ou invalide' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, bankId: true, isActive: true },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Utilisateur inactif ou introuvable' });
    }
    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      bankId: user.bankId,
    };
    next();
  } catch {
    return res.status(401).json({ message: 'Token expiré ou invalide' });
  }
}
