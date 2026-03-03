import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../services/prisma';
import { ConfigCategory } from '@prisma/client';

const EXTERNAL_API_KEY_NAME = 'EXTERNAL_API_KEY';

/** Génère une clé API sécurisée (64 caractères hex). */
function generateSecureApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function list(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const category = req.query.category as ConfigCategory | undefined;
  const where = category ? { category } : {};
  const configs = await prisma.configuration.findMany({
    where,
    orderBy: [{ category: 'asc' }, { key: 'asc' }],
    include: { updatedByUser: { select: { firstName: true, lastName: true, email: true } } },
  });
  return res.json(configs.map((c) => ({
    key: c.key,
    value: c.value,
    description: c.description,
    category: c.category,
    updatedAt: c.updatedAt,
    updatedBy: c.updatedByUser ? `${c.updatedByUser.firstName} ${c.updatedByUser.lastName}`.trim() || c.updatedByUser.email : null,
  })));
}

interface ConfigUpdateBody {
  key?: string;
  value?: string;
  updates?: Array<{ key: string; value: string }>;
}

export async function update(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const body: ConfigUpdateBody = req.body;
  const updates = body.updates;
  if (Array.isArray(updates) && updates.length > 0) {
    for (const u of updates) {
      if (u.key) {
        await prisma.configuration.updateMany({
          where: { key: u.key },
          data: { value: u.value ?? '', updatedBy: req.user.userId, updatedAt: new Date() },
        });
      }
    }
    const configs = await prisma.configuration.findMany({ orderBy: { key: 'asc' } });
    return res.json(configs.map((c) => ({ key: c.key, value: c.value, description: c.description, category: c.category, updatedAt: c.updatedAt })));
  }
  const key = body.key;
  const value = body.value;
  if (!key) return res.status(400).json({ message: 'key requis' });
  const config = await prisma.configuration.updateMany({
    where: { key },
    data: { value: value ?? '', updatedBy: req.user.userId, updatedAt: new Date() },
  });
  if (config.count === 0) return res.status(404).json({ message: 'Clé non trouvée' });
  const updated = await prisma.configuration.findUnique({
    where: { key },
    include: { updatedByUser: { select: { firstName: true, lastName: true, email: true } } },
  });
  if (!updated) return res.status(404).json({ message: 'Clé non trouvée' });
  return res.json({
    key: updated.key,
    value: updated.value,
    description: updated.description,
    category: updated.category,
    updatedAt: updated.updatedAt,
    updatedBy: updated.updatedByUser ? `${updated.updatedByUser.firstName} ${updated.updatedByUser.lastName}`.trim() || updated.updatedByUser.email : null,
  });
}

/**
 * Génère une nouvelle clé EXTERNAL_API_KEY (cryptographiquement sûre), l'enregistre en base
 * et la retourne une seule fois dans la réponse. Réservé aux admins.
 */
export async function generateExternalApiKey(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const newKey = generateSecureApiKey();
  await prisma.configuration.upsert({
    where: { key: EXTERNAL_API_KEY_NAME },
    update: { value: newKey, updatedBy: req.user.userId, updatedAt: new Date() },
    create: {
      key: EXTERNAL_API_KEY_NAME,
      value: newKey,
      description: "Clé secrète pour l'API v1 d'ajout de marchand (X-API-Key). À définir et à garder confidentielle.",
      category: 'API',
      updatedBy: req.user.userId,
      updatedAt: new Date(),
    },
  });
  return res.json({ value: newKey, message: 'Clé générée et enregistrée. Copiez-la maintenant, elle ne sera plus affichée en clair.' });
}
