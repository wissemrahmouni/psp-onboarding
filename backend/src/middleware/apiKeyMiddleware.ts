import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma';

export async function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(401).json({ message: 'Clé API manquante' });
  }
  const config = await prisma.configuration.findUnique({
    where: { key: 'EXTERNAL_API_KEY' },
  });
  if (!config || config.value !== apiKey.trim()) {
    return res.status(401).json({ message: 'Clé API invalide' });
  }
  next();
}
