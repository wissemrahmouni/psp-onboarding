import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../services/prisma';
import { ConfigCategory } from '@prisma/client';
import { testSmtpConnection } from '../services/emailService';

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

interface SmtpConfigBody {
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM_EMAIL?: string;
  SMTP_FROM_NAME?: string;
}

/**
 * Crée ou met à jour les paramètres SMTP.
 * Permet de créer des configurations SMTP si elles n'existent pas encore.
 */
export async function updateSmtpConfig(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const body: SmtpConfigBody = req.body;
  
  const smtpKeys = [
    { key: 'SMTP_HOST', description: 'Adresse du serveur SMTP (ex: smtp.gmail.com)', category: 'SMTP' as ConfigCategory },
    { key: 'SMTP_PORT', description: 'Port SMTP (587 pour TLS, 465 pour SSL, 25 pour non sécurisé)', category: 'SMTP' as ConfigCategory },
    { key: 'SMTP_SECURE', description: 'Utiliser SSL/TLS sécurisé (true/false)', category: 'SMTP' as ConfigCategory },
    { key: 'SMTP_USER', description: 'Nom d\'utilisateur SMTP (email)', category: 'SMTP' as ConfigCategory },
    { key: 'SMTP_PASS', description: 'Mot de passe SMTP (sensible)', category: 'SMTP' as ConfigCategory },
    { key: 'SMTP_FROM_EMAIL', description: 'Adresse email expéditrice par défaut', category: 'SMTP' as ConfigCategory },
    { key: 'SMTP_FROM_NAME', description: 'Nom de l\'expéditeur affiché', category: 'SMTP' as ConfigCategory },
  ];

  const updates = [];
  for (const smtpKey of smtpKeys) {
    const value = body[smtpKey.key as keyof SmtpConfigBody];
    if (value !== undefined) {
      await prisma.configuration.upsert({
        where: { key: smtpKey.key },
        update: {
          value: String(value),
          description: smtpKey.description,
          category: smtpKey.category,
          updatedBy: req.user.userId,
          updatedAt: new Date(),
        },
        create: {
          key: smtpKey.key,
          value: String(value),
          description: smtpKey.description,
          category: smtpKey.category,
          updatedBy: req.user.userId,
          updatedAt: new Date(),
        },
      });
      updates.push(smtpKey.key);
    }
  }

  const configs = await prisma.configuration.findMany({
    where: { category: 'SMTP' },
    orderBy: { key: 'asc' },
    include: { updatedByUser: { select: { firstName: true, lastName: true, email: true } } },
  });

  return res.json({
    message: updates.length > 0 ? `${updates.length} paramètre(s) SMTP mis à jour` : 'Aucune modification',
    configs: configs.map((c) => ({
      key: c.key,
      value: c.value,
      description: c.description,
      category: c.category,
      updatedAt: c.updatedAt,
      updatedBy: c.updatedByUser ? `${c.updatedByUser.firstName} ${c.updatedByUser.lastName}`.trim() || c.updatedByUser.email : null,
    })),
  });
}

/**
 * Teste la connexion SMTP avec les paramètres configurés.
 * Optionnellement envoie un email de test à l'utilisateur connecté.
 */
export async function testSmtp(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  
  const body = req.body as { testEmail?: string };
  const testEmail = body.testEmail || req.user.email;

  const result = await testSmtpConnection(testEmail);
  
  if (result.success) {
    return res.json({
      success: true,
      message: result.message,
    });
  } else {
    return res.status(400).json({
      success: false,
      message: result.message,
      error: result.error,
    });
  }
}
