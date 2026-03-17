import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../services/prisma';
import {
  parseExcelBuffer,
  rowToAffiliateCreate,
  rowToAffiliateUpdate,
  buildTemplateBuffer,
} from '../services/excelImport';
import { sendParamsEmail, sendCustomEmail, isEmailConfigured } from '../services/emailService';
import {
  verifyMerchantTests,
  isClicToPayConfigured,
  syncWithClicToPay,
  getClicToPaySyncConfig,
  extractProcessingIdAndTerminalId,
} from '../services/clictopayService';
import { AffiliateStatus } from '@prisma/client';

function generateTempPassword(): string {
  return crypto.randomBytes(8).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
}

/** Résout un affilié par id (UUID) ou merchant_code */
async function findAffiliateByIdOrCode(idOrCode: string) {
  const affiliate = await prisma.affiliate.findUnique({ where: { id: idOrCode } });
  if (affiliate) return affiliate;
  return prisma.affiliate.findUnique({ where: { merchant_code: idOrCode } });
}

export async function importExcel(req: Request, res: Response) {
  if (!req.file || !req.user) {
    return res.status(400).json({ message: 'Fichier manquant' });
  }
  const userId = req.user.userId;
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(req.file.path);
  } catch {
    return res.status(500).json({ message: 'Impossible de lire le fichier' });
  }
  const results = parseExcelBuffer(buffer);
  const errors: { row: number; message: string }[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  const batch = await prisma.importBatch.create({
    data: {
      filename: req.file.originalname,
      file_path: req.file.path,
      imported_by: userId,
      total_rows: results.filter((r) => r.data).length,
      success_count: 0,
      error_count: 0,
      status: 'PROCESSING',
    },
  });
  for (const item of results) {
    if (item.error) {
      errors.push({ row: item.row, message: item.error });
      continue;
    }
    if (!item.data) continue;
    const existing = await prisma.affiliate.findUnique({
      where: { merchant_code: item.data.CODE_MARCHAND },
    });
    if (existing) {
      try {
        const updateData = rowToAffiliateUpdate(item.data);
        const effectiveCreatedAt = parseDateCreation(updateData.date_creation) ?? existing.effective_created_at ?? existing.createdAt;
        await prisma.affiliate.update({
          where: { id: existing.id },
          data: { ...updateData, effective_created_at: effectiveCreatedAt },
        });
        updatedCount++;
      } catch (e) {
        errors.push({ row: item.row, message: e instanceof Error ? e.message : 'Erreur mise à jour' });
      }
      continue;
    }
    try {
      const create = rowToAffiliateCreate(item.data, userId);
      const effectiveCreatedAt = parseDateCreation(create.date_creation) ?? new Date();
      const affiliate = await prisma.affiliate.create({
        data: { ...create, import_batch_id: batch.id, effective_created_at: effectiveCreatedAt },
      });
      await prisma.affiliateHistory.create({
        data: {
          affiliate_id: affiliate.id,
          new_status: 'CREATED_MERCHANT_MGT',
          changed_by: userId,
          comment: 'Import Excel',
        },
      });
      createdCount++;
    } catch (e) {
      errors.push({ row: item.row, message: e instanceof Error ? e.message : 'Erreur création' });
    }
  }
  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      success_count: createdCount + updatedCount,
      error_count: errors.length,
      status: 'COMPLETED',
      error_log: errors.length ? errors : undefined,
      completedAt: new Date(),
    },
  });
  try {
    await fs.unlink(req.file.path);
  } catch {}
  return res.json({
    batch_id: batch.id,
    success_count: createdCount + updatedCount,
    created_count: createdCount,
    updated_count: updatedCount,
    error_count: errors.length,
    errors,
  });
}

export async function getTemplate(_req: Request, res: Response) {
  const buffer = buildTemplateBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=modele_AFFILIATION_BO1902.xlsx');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  return res.send(buffer);
}

export async function create(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const body = req.body as Record<string, unknown>;
  const merchant_code = String(body.merchant_code ?? body.CODE_MARCHAND ?? '').trim();
  const company_name = String(body.company_name ?? body.RAISON_SOCIALE ?? '').trim();
  const email = String(body.email ?? body.EMAIL ?? '').trim();
  const technical_email = String(body.technical_email ?? body.EMAIL_TECHNIQUE ?? '').trim();
  if (!merchant_code || !company_name || !email || !technical_email) {
    return res.status(400).json({ message: 'Champs obligatoires: merchant_code, company_name, email, technical_email' });
  }
  const existing = await prisma.affiliate.findUnique({ where: { merchant_code } });
  if (existing) {
    return res.status(400).json({ message: 'Ce code marchand existe déjà' });
  }
  const dateCreation = (body.date_creation as string) || null;
  const effectiveCreatedAt = parseDateCreation(dateCreation) ?? new Date();
  const affiliate = await prisma.affiliate.create({
    data: {
      merchant_code,
      numero_terminal: (body.numero_terminal as string) || null,
      company_name,
      trade_name: (body.trade_name as string) || (body.NOM_COMMERCIAL as string) || null,
      activity: (body.activity as string) || (body.ACTIVITE as string) || null,
      address: (body.address as string) || (body.ADRESSE as string) || null,
      city: (body.city as string) || (body.VILLE as string) || null,
      postal_code: (body.postal_code as string) || (body.CODE_POSTAL as string) || null,
      country: (body.country as string) || (body.PAYS as string) || null,
      phone: (body.phone as string) || (body.TEL as string) || null,
      email,
      technical_email,
      contact_name: (body.contact_name as string) || (body.NOM_CONTACT as string) || null,
      contact_firstname: (body.contact_firstname as string) || (body.PRENOM_CONTACT as string) || null,
      website: (body.website as string) || (body.SITE_WEB as string) || null,
      currency: (body.currency as string) || (body.DEVISE as string) || null,
      mcc_code: (body.mcc_code as string) || (body.MCC as string) || null,
      iban: (body.iban as string) || (body.IBAN as string) || null,
      bic: (body.bic as string) || (body.BIC as string) || null,
      rne: (body.rne as string) || null,
      date_creation: dateCreation,
      date_modification: (body.date_modification as string) || null,
      type_cartes: (body.type_cartes as string) || null,
      status: 'CREATED_MERCHANT_MGT' as AffiliateStatus,
      created_by: req.user.userId,
      effective_created_at: effectiveCreatedAt,
    },
  });
  await prisma.affiliateHistory.create({
    data: {
      affiliate_id: affiliate.id,
      new_status: 'CREATED_MERCHANT_MGT',
      changed_by: req.user.userId,
      comment: 'Création formulaire',
    },
  });
  return res.status(201).json(affiliate);
}

export async function createFromApi(req: Request, res: Response) {
  const body = req.body as Record<string, unknown>;
  const merchant_code = String(body.merchant_code ?? body.CODE_MARCHAND ?? '').trim();
  const company_name = String(body.company_name ?? body.RAISON_SOCIALE ?? '').trim();
  const email = String(body.email ?? body.EMAIL ?? '').trim();
  const technical_email = String(body.technical_email ?? body.EMAIL_TECHNIQUE ?? '').trim();
  if (!merchant_code || !company_name || !email || !technical_email) {
    return res.status(400).json({
      message: 'Champs obligatoires: merchant_code, company_name, email, technical_email',
    });
  }
  const existing = await prisma.affiliate.findUnique({ where: { merchant_code } });
  if (existing) {
    return res.status(400).json({ message: 'Ce code marchand existe déjà' });
  }
  const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } })
    ?? await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    ?? await prisma.user.findFirst({ where: { isActive: true } });
  const createdBy = admin?.id ?? '';
  const dateCreation = (body.date_creation as string) || null;
  const effectiveCreatedAt = parseDateCreation(dateCreation) ?? new Date();
  const affiliate = await prisma.affiliate.create({
    data: {
      merchant_code,
      numero_terminal: (body.numero_terminal as string) || null,
      company_name,
      trade_name: (body.trade_name as string) || (body.NOM_COMMERCIAL as string) || null,
      activity: (body.activity as string) || (body.ACTIVITE as string) || null,
      address: (body.address as string) || (body.ADRESSE as string) || null,
      city: (body.city as string) || (body.VILLE as string) || null,
      postal_code: (body.postal_code as string) || (body.CODE_POSTAL as string) || null,
      country: (body.country as string) || (body.PAYS as string) || null,
      phone: (body.phone as string) || (body.TEL as string) || null,
      email,
      technical_email,
      contact_name: (body.contact_name as string) || (body.NOM_CONTACT as string) || null,
      contact_firstname: (body.contact_firstname as string) || (body.PRENOM_CONTACT as string) || null,
      website: (body.website as string) || (body.SITE_WEB as string) || null,
      currency: (body.currency as string) || (body.DEVISE as string) || null,
      mcc_code: (body.mcc_code as string) || (body.MCC as string) || null,
      iban: (body.iban as string) || (body.IBAN as string) || null,
      bic: (body.bic as string) || (body.BIC as string) || null,
      rne: (body.rne as string) || null,
      date_creation: dateCreation,
      date_modification: (body.date_modification as string) || null,
      type_cartes: (body.type_cartes as string) || null,
      effective_created_at: effectiveCreatedAt,
      status: 'CREATED_MERCHANT_MGT' as AffiliateStatus,
      created_by: createdBy,
    },
  });
  await prisma.affiliateHistory.create({
    data: {
      affiliate_id: affiliate.id,
      new_status: 'CREATED_MERCHANT_MGT',
      changed_by: createdBy,
      comment: 'API externe',
    },
  });

  // Envoi de l'email de bienvenue à email et technical_email, puis enregistrement dans l'historique
  let welcomeEmailSent = false;
  const welcomeRecipients = [...new Set([email, technical_email].filter(Boolean))];
  if (welcomeRecipients.length > 0) {
    const welcomeSubject = `Bienvenue sur la plateforme Clictopay – Prochaines étapes — ${company_name}`;
    const welcomeText = `Madame, Monsieur,

Nous avons le plaisir de vous accueillir sur la plateforme de paiement en ligne Clictopay et vous remercions de la confiance que vous nous accordez.

Votre espace marchand a été créé avec succès. Vous recevrez très prochainement vos paramètres d'accès à l'environnement de test (sandbox), qui vous permettront de démarrer vos intégrations techniques.

──────────────────────────────
🔧 PHASE 1 — INTÉGRATION & TESTS
──────────────────────────────
Une fois vos paramètres de test reçus, vous pourrez :
• Intégrer l'API Clictopay dans votre environnement de recette.
• Simuler des transactions de paiement (succès, échec, annulation).
• Vérifier les notifications de retour (callbacks/IPN).
• Valider le parcours utilisateur de bout en bout.

Notre équipe technique reste disponible pour vous accompagner tout au long de cette phase.

──────────────────────────────
🚀 PHASE 2 — PASSAGE EN PRODUCTION
──────────────────────────────
Pour basculer en environnement de production, les étapes suivantes sont requises :

1. Validation des tests : Confirmation par votre équipe que l'ensemble des scénarios de test ont été réalisés avec succès.
2. Fourniture des documents requis : Selon votre profil marchand, certains documents complémentaires pourront être demandés.
3. Recette finale : Notre équipe procédera à une vérification technique de votre intégration.
4. Activation du compte de production : Une fois la recette validée, vos paramètres de production vous seront communiqués de manière sécurisée.
5. Premier paiement en production : Vous êtes prêt à accepter les paiements réels !

Le délai moyen de passage en production est estimé entre 5 et 10 jours ouvrables à compter de la validation des tests.

Pour toute question, n'hésitez pas à contacter notre équipe support à l'adresse : support@clictopay.com

Nous vous souhaitons une excellente intégration et vous accompagnerons à chaque étape de ce parcours.

Cordialement,

L'équipe Clictopay
www.clictopay.com`;

    const results: string[] = [];
    const isConfigured = await isEmailConfigured();
    if (!isConfigured) {
      console.warn('[API] Email de bienvenue non envoyé : configuration SMTP manquante (Configuration > SMTP ou variables SMTP_* dans .env)');
      results.push(...welcomeRecipients.map((to) => `${to} (échec: SMTP non configuré)`));
    } else {
      for (const to of welcomeRecipients) {
        const emailResult = await sendCustomEmail(to, welcomeSubject, welcomeText);
        results.push(emailResult.success ? `${to} (OK)` : `${to} (échec: ${emailResult.error || 'Erreur inconnue'})`);
        if (emailResult.success) welcomeEmailSent = true;
      }
    }
    const allSuccess = results.every((r) => r.endsWith('(OK)'));
    try {
      await prisma.affiliateHistory.create({
        data: {
          affiliate_id: affiliate.id,
          new_status: 'CREATED_MERCHANT_MGT',
          changed_by: createdBy,
          comment: `Email de bienvenue envoyé à ${welcomeRecipients.join(', ')}: ${results.join(' ; ')}`,
          metadata: { event: 'welcome_email', recipients: welcomeRecipients, results: results, success: allSuccess },
        },
      });
    } catch (histErr) {
      console.error('[API] Erreur enregistrement historique email de bienvenue:', histErr);
    }

    if (welcomeEmailSent) {
      if (!createdBy) {
        console.warn('[API] Impossible de passer à Pris en charge : aucun utilisateur admin trouvé (createdBy vide)');
      } else {
        try {
          await prisma.affiliate.update({
            where: { id: affiliate.id },
            data: { status: 'AFFILIATION_CREATED' as AffiliateStatus },
          });
          await prisma.affiliateHistory.create({
            data: {
              affiliate_id: affiliate.id,
              old_status: 'CREATED_MERCHANT_MGT',
              new_status: 'AFFILIATION_CREATED',
              changed_by: createdBy,
              comment: 'Passage à Pris en charge après envoi email de bienvenue',
            },
          });
          console.log(`[API] Marchand ${merchant_code} passé à Pris en charge après email de bienvenue`);
        } catch (statusErr) {
          console.error('[API] Erreur passage à Pris en charge:', statusErr);
        }
      }
    }
  }

  const finalAffiliate = await prisma.affiliate.findUnique({
    where: { id: affiliate.id },
    select: { status: true },
  });

  return res.status(201).json({
    affiliate_id: affiliate.id,
    merchant_code: affiliate.merchant_code,
    status: finalAffiliate?.status ?? affiliate.status,
    created_at: affiliate.createdAt,
    welcome_email_sent: welcomeEmailSent,
  });
}

export async function getByMerchantCodeApi(req: Request, res: Response) {
  const { merchant_code } = req.params;
  const affiliate = await prisma.affiliate.findUnique({
    where: { merchant_code },
    select: { id: true, merchant_code: true, status: true, company_name: true, createdAt: true },
  });
  if (!affiliate) {
    return res.status(404).json({ message: 'Marchand non trouvé' });
  }
  return res.json(affiliate);
}

const AFFILIATE_LIST_SELECT = {
  id: true,
  merchant_code: true,
  company_name: true,
  trade_name: true,
  city: true,
  country: true,
  status: true,
  date_creation: true,
  createdAt: true,
  bank: { select: { id: true, name: true, code: true } },
};

/** Parse date_creation (ISO ou numéro série Excel) → Date. */
function parseDateCreation(value: string | null | undefined): Date | null {
  if (!value || !String(value).trim()) return null;
  const str = String(value).trim();
  const num = parseFloat(str);
  if (!isNaN(num) && num >= 1 && num < 1000000) {
    const ms = (num - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  return null;
}

/** Date effective pour affichage : date_creation du fichier Excel si valide, sinon createdAt. */
function getEffectiveCreatedAt(dateCreation: string | null, createdAt: Date): Date {
  const parsed = parseDateCreation(dateCreation);
  return parsed ?? createdAt;
}

export async function list(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 25));
  const status = req.query.status as string | undefined;
  const bank_id = req.query.bank_id as string | undefined;
  const search = (req.query.search as string)?.trim();
  const city = (req.query.city as string)?.trim();
  const country = (req.query.country as string)?.trim();
  const date_from = req.query.date_from as string | undefined;
  const date_to = req.query.date_to as string | undefined;
  const sort_by = (req.query.sort_by as string) || 'effective_created_at';
  const sort_order: 'asc' | 'desc' = (req.query.sort_order as string) === 'asc' ? 'asc' : 'desc';
  const where: Record<string, unknown> = {};
  if (req.user.role === 'BANQUE' && req.user.bankId) where.bankId = req.user.bankId;
  if (status) where.status = status;
  if (bank_id) where.bankId = bank_id;
  if (city) where.city = { contains: city, mode: 'insensitive' };
  if (country) where.country = { contains: country, mode: 'insensitive' };
  if (date_from || date_to) {
    where.createdAt = {};
    if (date_from) (where.createdAt as Record<string, Date>).gte = new Date(date_from);
    if (date_to) (where.createdAt as Record<string, Date>).lte = new Date(date_to);
  }
  if (search) {
    where.OR = [
      { merchant_code: { contains: search, mode: 'insensitive' } },
      { company_name: { contains: search, mode: 'insensitive' } },
    ];
  }
  const orderBy = sort_by === 'effective_created_at'
    ? { effective_created_at: sort_order }
    : { [sort_by]: sort_order };
  const [data, total] = await Promise.all([
    prisma.affiliate.findMany({
      where,
      select: AFFILIATE_LIST_SELECT,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.affiliate.count({ where }),
  ]);
  return res.json({
    data,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function purge(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const where: { bankId?: string | null } = {};
  if (req.user.role === 'BANQUE' && req.user.bankId) {
    where.bankId = req.user.bankId;
  }
  try {
    const result = await prisma.affiliate.deleteMany({ where });
    return res.json({ deleted: result.count, message: `${result.count} marchand(s) supprimé(s).` });
  } catch (err) {
    console.error('Purge affiliates error:', err);
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Erreur lors de la suppression des marchands',
    });
  }
}

export async function getById(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const { id } = req.params;
  const affiliate = await findAffiliateByIdOrCode(id);
  if (!affiliate) return res.status(404).json({ message: 'Affilié non trouvé' });
  const full = await prisma.affiliate.findUnique({
    where: { id: affiliate.id },
    include: {
      bank: true,
      createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      histories: {
        orderBy: { createdAt: 'desc' },
        include: { changedBy: { select: { id: true, email: true, firstName: true, lastName: true } } },
      },
      testValidations: {
        orderBy: { createdAt: 'desc' },
        include: { checkedBy: { select: { id: true, email: true, firstName: true, lastName: true } } },
      },
      clictopaySyncs: { orderBy: { synced_at: 'desc' } },
    },
  });
  if (!full) return res.status(404).json({ message: 'Affilié non trouvé' });
  if (req.user.role === 'BANQUE' && req.user.bankId && full.bankId !== req.user.bankId) {
    return res.status(403).json({ message: 'Accès refusé' });
  }
  const { test_password_hash, prod_password_hash, ...safe } = full;
  return res.json(safe);
}

export async function exportAffiliates(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const format = (req.query.format as string) === 'xlsx' ? 'xlsx' : 'csv';
  const where: Record<string, unknown> = {};
  if (req.user.role === 'BANQUE' && req.user.bankId) where.bankId = req.user.bankId;
  const status = req.query.status as string | undefined;
  if (status) where.status = status;
  const data = await prisma.affiliate.findMany({
    where,
    select: AFFILIATE_LIST_SELECT,
    orderBy: { effective_created_at: 'desc' },
  });
  if (format === 'xlsx') {
    const XLSX = await import('xlsx');
    const rows = data.map((a) => ({
      CODE_MARCHAND: a.merchant_code,
      RAISON_SOCIALE: a.company_name,
      NOM_COMMERCIAL: a.trade_name,
      VILLE: a.city,
      PAYS: a.country,
      STATUT: a.status,
      CRÉÉ_LE: getEffectiveCreatedAt(a.date_creation, a.createdAt),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Affiliés');
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=affilies.xlsx');
    return res.send(buffer);
  }
  const header = 'CODE_MARCHAND;RAISON_SOCIALE;NOM_COMMERCIAL;VILLE;PAYS;STATUT;CRÉÉ_LE\n';
  const csv = header + data.map((a) => [a.merchant_code, a.company_name, a.trade_name, a.city, a.country, a.status, getEffectiveCreatedAt(a.date_creation, a.createdAt)].join(';')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=affilies.csv');
  return res.send('\uFEFF' + csv);
}

export async function sendTestParams(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const { id } = req.params;
  const affiliate = await findAffiliateByIdOrCode(id);
  if (!affiliate) return res.status(404).json({ message: 'Affilié non trouvé' });
  if (req.user.role === 'BANQUE' && affiliate.bankId !== req.user.bankId) {
    return res.status(403).json({ message: 'Accès refusé' });
  }
  const login = affiliate.merchant_code;
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const now = new Date();
  await prisma.affiliate.update({
    where: { id: affiliate.id },
    data: {
      test_login: login,
      test_password_hash: passwordHash,
      test_params_sent_at: now,
    },
  });
  const to = affiliate.technical_email || affiliate.email;
  const subject = `[PSP Onboarding] Paramètres de test - ${affiliate.company_name} (${affiliate.merchant_code})`;
  const text = `Bonjour,\n\nVos identifiants pour l'environnement de TEST sont :\n\nLogin : ${login}\nMot de passe : ${tempPassword}\n\nÀ changer à la première connexion.\n\n— Plateforme PSP Onboarding`;
  const sent = await sendParamsEmail(to, subject, text);
  const emailConfigured = await isEmailConfigured();
  return res.json({
    sent,
    message: sent ? 'Paramètres de test envoyés par email.' : (emailConfigured ? 'Échec envoi email.' : 'SMTP non configuré. Enregistrement mis à jour uniquement.'),
    test_params_sent_at: now,
  });
}

export async function sendProdParams(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const { id } = req.params;
  const affiliate = await findAffiliateByIdOrCode(id);
  if (!affiliate) return res.status(404).json({ message: 'Affilié non trouvé' });
  if (req.user.role === 'BANQUE' && affiliate.bankId !== req.user.bankId) {
    return res.status(403).json({ message: 'Accès refusé' });
  }
  const login = affiliate.merchant_code;
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const now = new Date();
  await prisma.affiliate.update({
    where: { id: affiliate.id },
    data: {
      prod_login: login,
      prod_password_hash: passwordHash,
      prod_params_sent_at: now,
    },
  });
  const to = affiliate.technical_email || affiliate.email;
  const subject = `[PSP Onboarding] Paramètres de production - ${affiliate.company_name} (${affiliate.merchant_code})`;
  const text = `Bonjour,\n\nVos identifiants pour l'environnement de PRODUCTION sont :\n\nLogin : ${login}\nMot de passe : ${tempPassword}\n\nÀ changer à la première connexion.\n\n— Plateforme PSP Onboarding`;
  const sent = await sendParamsEmail(to, subject, text);
  const emailConfigured = await isEmailConfigured();
  return res.json({
    sent,
    message: sent ? 'Paramètres de production envoyés par email.' : (emailConfigured ? 'Échec envoi email.' : 'SMTP non configuré. Enregistrement mis à jour uniquement.'),
    prod_params_sent_at: now,
  });
}

export async function sendEmail(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const { id } = req.params;
  const affiliate = await findAffiliateByIdOrCode(id);
  if (!affiliate) return res.status(404).json({ message: 'Affilié non trouvé' });
  if (req.user.role === 'BANQUE' && affiliate.bankId !== req.user.bankId) {
    return res.status(403).json({ message: 'Accès refusé' });
  }
  const { to, subject, text, html, cc, bcc } = req.body as { to?: string; subject?: string; text?: string; html?: string; cc?: string; bcc?: string };
  if (!to?.trim() || !subject?.trim() || !text?.trim()) {
    return res.status(400).json({ message: 'Champs obligatoires : to, subject, text' });
  }
  const files = req.files as Express.Multer.File[] | undefined;
  const attachments = files?.filter((f) => f.buffer).map((f) => ({ filename: f.originalname, content: f.buffer })) ?? [];
  const result = await sendCustomEmail(to.trim(), subject.trim(), text.trim(), {
    html: html?.trim(),
    cc: cc?.trim(),
    bcc: bcc?.trim(),
    attachments: attachments.length ? attachments : undefined,
  });
  if (result.success) {
    return res.json({ success: true, message: 'Email envoyé avec succès' });
  }
  return res.status(500).json({ success: false, message: 'Échec de l\'envoi', error: result.error });
}

export async function verifyTests(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const { id } = req.params;
  const { operator_comment } = req.body as { operator_comment?: string };
  const affiliate = await findAffiliateByIdOrCode(id);
  if (!affiliate) return res.status(404).json({ message: 'Affilié non trouvé' });
  if (req.user.role === 'BANQUE' && affiliate.bankId !== req.user.bankId) {
    return res.status(403).json({ message: 'Accès refusé' });
  }
  const result = await verifyMerchantTests(affiliate.merchant_code);
  const payload = result ?? {
    transactions_found: 0,
    overall_result: false,
    criteria_success_status: false,
    criteria_return_code: false,
    criteria_auth_number: false,
    criteria_reference: false,
    criteria_card_type: false,
    criteria_scenarios: false,
    api_response: { error: isClicToPayConfigured() ? 'API indisponible' : 'API Clic to Pay non configurée' },
  };
  const validation = await prisma.testValidation.create({
    data: {
      affiliate_id: affiliate.id,
      checked_by: req.user.userId,
      api_response: payload.api_response as object,
      transactions_found: payload.transactions_found,
      criteria_success_status: payload.criteria_success_status,
      criteria_return_code: payload.criteria_return_code,
      criteria_auth_number: payload.criteria_auth_number,
      criteria_reference: payload.criteria_reference,
      criteria_card_type: payload.criteria_card_type,
      criteria_scenarios: payload.criteria_scenarios,
      overall_result: payload.overall_result,
      operator_comment: operator_comment ?? null,
    },
  });
  await prisma.affiliate.update({
    where: { id: affiliate.id },
    data: {
      tests_validated_at: new Date(),
      tests_validated_by: req.user.userId,
    },
  });
  return res.json(validation);
}

/** Détecte si la réponse API indique que le marchand a été trouvé. */
function isMerchantFoundInResponse(data: Record<string, unknown> | null): boolean {
  if (!data || typeof data !== 'object') return false;
  const err = data.error ?? data.code ?? data.message ?? data.status;
  if (err && (String(err).toLowerCase().includes('not found') || String(err).toLowerCase().includes('inexistant') || data.status === 'error')) return false;
  return true;
}

/** Calcule le nouveau clictopay_sync_status à partir des syncs existants. */
function computeClicToPaySyncStatus(hasTest: boolean, hasProd: boolean): string | null {
  if (hasTest && hasProd) return 'TEST/PROD';
  if (hasTest) return 'TEST';
  if (hasProd) return 'PROD';
  return null;
}

export async function syncClicToPay(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const { id } = req.params;
  const { environment } = req.body as { environment?: 'TEST' | 'PROD' };
  if (!environment || !['TEST', 'PROD'].includes(environment)) {
    return res.status(400).json({ message: 'environment requis (TEST ou PROD)' });
  }
  const affiliate = await findAffiliateByIdOrCode(id);
  if (!affiliate) return res.status(404).json({ message: 'Affilié non trouvé' });
  if (req.user.role === 'BANQUE' && affiliate.bankId !== req.user.bankId) {
    return res.status(403).json({ message: 'Accès refusé' });
  }
  const config = await getClicToPaySyncConfig(environment);
  if (!config) {
    return res.status(400).json({ message: `Credentials ClicToPay ${environment} non configurés. Configurez-les dans Configuration > ClicToPay.` });
  }
  const merchantId = affiliate.merchant_code;
  const apiResponse = await syncWithClicToPay(merchantId, environment, config);
  const found = isMerchantFoundInResponse(apiResponse);
  const payload = apiResponse ?? { error: 'Aucune réponse de l\'API ClicToPay' };
  await prisma.affiliateClicToPaySync.upsert({
    where: {
      affiliate_id_environment: { affiliate_id: affiliate.id, environment },
    },
    create: {
      affiliate_id: affiliate.id,
      environment,
      api_response: payload as object,
      synced_at: new Date(),
    },
    update: {
      api_response: payload as object,
      synced_at: new Date(),
    },
  });
  const syncs = await prisma.affiliateClicToPaySync.findMany({
    where: { affiliate_id: affiliate.id },
    select: { environment: true, api_response: true },
  });
  const hasTest = syncs.some((s: { environment: string; api_response: unknown }) => s.environment === 'TEST' && isMerchantFoundInResponse(s.api_response as Record<string, unknown>));
  const hasProd = syncs.some((s: { environment: string; api_response: unknown }) => s.environment === 'PROD' && isMerchantFoundInResponse(s.api_response as Record<string, unknown>));
  const newStatus = computeClicToPaySyncStatus(hasTest, hasProd);
  await prisma.affiliate.update({
    where: { id: affiliate.id },
    data: { clictopay_sync_status: newStatus },
  });
  const updated = await prisma.affiliate.findUnique({
    where: { id: affiliate.id },
    include: { clictopaySyncs: { orderBy: { synced_at: 'desc' } } },
  });
  return res.json({
    success: found,
    message: found ? `Synchronisation ${environment} réussie.` : `Marchand non trouvé sur ${environment}.`,
    affiliate: updated ? { ...updated, test_password_hash: undefined, prod_password_hash: undefined } : null,
  });
}

/** Synchronisation par lot : tous les affiliés (ou filtrés) avec ClicToPay TEST ou PROD. */
export async function syncClicToPayBatch(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const { environment } = req.body as { environment?: 'TEST' | 'PROD' };
  if (!environment || !['TEST', 'PROD'].includes(environment)) {
    return res.status(400).json({ message: 'environment requis (TEST ou PROD)' });
  }
  const config = await getClicToPaySyncConfig(environment);
  if (!config) {
    return res.status(400).json({ message: `Credentials ClicToPay ${environment} non configurés. Configurez-les dans Configuration > ClicToPay.` });
  }
  const status = req.query.status as string | undefined;
  const search = (req.query.search as string)?.trim();
  const where: Record<string, unknown> = {};
  if (req.user.role === 'BANQUE' && req.user.bankId) where.bankId = req.user.bankId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { merchant_code: { contains: search, mode: 'insensitive' } },
      { company_name: { contains: search, mode: 'insensitive' } },
    ];
  }
  const affiliates = await prisma.affiliate.findMany({
    where,
    select: { id: true, merchant_code: true },
  });
  let foundCount = 0;
  const errors: { merchant_code: string; message: string }[] = [];
  for (const aff of affiliates) {
    try {
      const apiResponse = await syncWithClicToPay(aff.merchant_code, environment, config);
      const found = isMerchantFoundInResponse(apiResponse);
      if (found) foundCount++;
      const payload = apiResponse ?? { error: 'Aucune réponse' };
      await prisma.affiliateClicToPaySync.upsert({
        where: { affiliate_id_environment: { affiliate_id: aff.id, environment } },
        create: { affiliate_id: aff.id, environment, api_response: payload as object, synced_at: new Date() },
        update: { api_response: payload as object, synced_at: new Date() },
      });
      const syncs = await prisma.affiliateClicToPaySync.findMany({
        where: { affiliate_id: aff.id },
        select: { environment: true, api_response: true },
      });
      const hasTest = syncs.some((s: { environment: string; api_response: unknown }) => s.environment === 'TEST' && isMerchantFoundInResponse(s.api_response as Record<string, unknown>));
      const hasProd = syncs.some((s: { environment: string; api_response: unknown }) => s.environment === 'PROD' && isMerchantFoundInResponse(s.api_response as Record<string, unknown>));
      const newStatus = computeClicToPaySyncStatus(hasTest, hasProd);
      await prisma.affiliate.update({
        where: { id: aff.id },
        data: { clictopay_sync_status: newStatus },
      });
    } catch (e) {
      errors.push({ merchant_code: aff.merchant_code, message: e instanceof Error ? e.message : 'Erreur inconnue' });
    }
  }
  return res.json({
    total: affiliates.length,
    found: foundCount,
    errors: errors.length > 0 ? errors : undefined,
    message: `Synchronisation ${environment} : ${foundCount}/${affiliates.length} marchand(s) trouvé(s).${errors.length ? ` ${errors.length} erreur(s).` : ''}`,
  });
}

/** Progression du scan ClicToPay. */
interface ClicToPayScanProgress {
  status: 'idle' | 'running' | 'completed' | 'error';
  environment?: 'TEST' | 'PROD';
  merchantId_min?: number;
  merchantId_max?: number;
  currentMerchantId: number;
  total: number;
  foundCount: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  logPath?: string;
}
const clictopayScanProgress: Record<'TEST' | 'PROD', ClicToPayScanProgress> = {
  TEST: { status: 'idle', currentMerchantId: 0, total: 0, foundCount: 0 },
  PROD: { status: 'idle', currentMerchantId: 0, total: 0, foundCount: 0 },
};

/**
 * Lance le scan ClicToPay : boucle sur merchantId 500000–539747, appelle l'API,
 * matche processingId→Affiliation et terminalId→Numéro Terminal, met à jour les affiliés.
 */
export async function startClicToPayScan(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const { environment, merchantId_min, merchantId_max } = req.body as {
    environment?: 'TEST' | 'PROD';
    merchantId_min?: number;
    merchantId_max?: number;
  };
  if (!environment || !['TEST', 'PROD'].includes(environment)) {
    return res.status(400).json({ message: 'environment requis (TEST ou PROD)' });
  }
  const min = typeof merchantId_min === 'number' ? Math.floor(merchantId_min) : Number(merchantId_min);
  const max = typeof merchantId_max === 'number' ? Math.floor(merchantId_max) : Number(merchantId_max);
  if (Number.isNaN(min) || Number.isNaN(max)) {
    return res.status(400).json({ message: 'merchantId_min et merchantId_max sont requis et doivent être des nombres.' });
  }
  if (min > max) {
    return res.status(400).json({ message: 'merchantId_min doit être inférieur ou égal à merchantId_max.' });
  }
  const prog = clictopayScanProgress[environment];
  if (prog.status === 'running') {
    return res.status(409).json({ message: `Scan ${environment} déjà en cours.`, progress: prog });
  }
  const config = await getClicToPaySyncConfig(environment);
  if (!config) {
    return res.status(400).json({
      message: `Credentials ClicToPay ${environment} non configurés. Configurez-les dans Configuration > ClicToPay.`,
    });
  }

  prog.status = 'running';
  prog.environment = environment;
  prog.merchantId_min = min;
  prog.merchantId_max = max;
  prog.currentMerchantId = min;
  prog.total = max - min + 1;
  prog.foundCount = 0;
  prog.startedAt = new Date().toISOString();
  prog.completedAt = undefined;
  prog.error = undefined;

  const logBase = process.env.SYNC_LOG_DIR || path.join(process.cwd(), '..', 'logs');
  const logDir = path.join(logBase, 'clictopay-sync');
  const logFilename = `clictopay-sync-${environment}-${Date.now()}.log`;
  const logPath = path.join(logDir, logFilename);
  await fs.mkdir(logDir, { recursive: true });
  console.log('[ClicToPay] Log sync:', logPath);
  await fs.writeFile(
    logPath,
    `# Sync ClicToPay ${environment} - ${new Date().toISOString()}\n` +
      `# Plage: merchantId ${min} - ${max} (${max - min + 1} appels)\n` +
      `# Format: JSON ligne par ligne (merchantId, timestamp, response, result, verification)\n` +
      `# verification: extracted {processingId, terminalId}, conditionMet, condition, match, affiliate/reason\n` +
      `# ---\n`,
    'utf8'
  );
  prog.logPath = logPath;

  res.json({
    message: `Scan ${environment} démarré. Utilisez GET /api/affiliates/sync-clictopay-scan/status?environment=${environment} pour suivre la progression.`,
    progress: { ...prog },
  });

  (async () => {
    const appendLog = async (line: string) => {
      try {
        await fs.appendFile(logPath, line + '\n', 'utf8');
      } catch (e) {
        console.error('[ClicToPay] Erreur écriture log:', e);
      }
    };
    try {
      for (let merchantId = min; merchantId <= max; merchantId++) {
        if (clictopayScanProgress[environment].status !== 'running') break;
        prog.currentMerchantId = merchantId;

        const apiResponse = await syncWithClicToPay(merchantId, environment, config);
        const { processingId, terminalId } = extractProcessingIdAndTerminalId(apiResponse);

        let result: 'match' | 'no_match' | 'empty' | 'error' = 'empty';
        let affiliateId: string | null = null;
        let matchedAffiliate: { merchant_code: string; numero_terminal: string | null; company_name: string } | null = null;

        if (!apiResponse) {
          result = 'error';
        } else if (processingId && terminalId) {
          const affiliate = await prisma.affiliate.findFirst({
            where: {
              merchant_code: processingId,
              numero_terminal: terminalId,
            },
            select: { id: true, merchant_code: true, numero_terminal: true, company_name: true },
          });
          if (affiliate) {
            result = 'match';
            affiliateId = affiliate.id;
            matchedAffiliate = {
              merchant_code: affiliate.merchant_code,
              numero_terminal: affiliate.numero_terminal,
              company_name: affiliate.company_name,
            };
            const payload = apiResponse ?? {};
            await prisma.affiliateClicToPaySync.upsert({
              where: { affiliate_id_environment: { affiliate_id: affiliate.id, environment } },
              create: { affiliate_id: affiliate.id, environment, api_response: payload as object, synced_at: new Date() },
              update: { api_response: payload as object, synced_at: new Date() },
            });
            const syncs = await prisma.affiliateClicToPaySync.findMany({
              where: { affiliate_id: affiliate.id },
              select: { environment: true, api_response: true },
            });
            const hasTest = syncs.some(
              (s) => s.environment === 'TEST' && (s.api_response as Record<string, unknown>)?.processingId != null
            );
            const hasProd = syncs.some(
              (s) => s.environment === 'PROD' && (s.api_response as Record<string, unknown>)?.processingId != null
            );
            const newStatus = computeClicToPaySyncStatus(hasTest, hasProd);
            await prisma.affiliate.update({
              where: { id: affiliate.id },
              data: { clictopay_sync_status: newStatus },
            });
            prog.foundCount++;
          } else {
            result = 'no_match';
          }
        }

        const verification = {
          extracted: { processingId: processingId ?? null, terminalId: terminalId ?? null },
          conditionMet: !!(processingId && terminalId),
          condition: 'Affiliation (merchant_code) == processingId ET Numéro Terminal (numero_terminal) == terminalId',
          match: result === 'match',
          ...(affiliateId && { affiliateId }),
          ...(result === 'match' && matchedAffiliate && {
            affiliate: matchedAffiliate,
          }),
          ...(result === 'no_match' && processingId && terminalId && {
            reason: 'Aucun affilié avec Affiliation=' + processingId + ' ET Numéro Terminal=' + terminalId,
          }),
          ...(result === 'empty' && { reason: 'Réponse sans processingId ou terminalId' }),
          ...(result === 'error' && { reason: 'Pas de réponse API ou erreur' }),
        };
        const logEntry = JSON.stringify({
          merchantId,
          timestamp: new Date().toISOString(),
          response: apiResponse ?? null,
          result,
          verification,
        });
        await appendLog(logEntry);
      }
      prog.status = 'completed';
      prog.completedAt = new Date().toISOString();
      await appendLog(`# ---\n# Scan terminé: ${prog.foundCount} affilié(s) trouvé(s)`);
    } catch (err) {
      prog.status = 'error';
      prog.error = err instanceof Error ? err.message : String(err);
      prog.completedAt = new Date().toISOString();
      console.error('[ClicToPay] Erreur scan:', err);
      try {
        await appendLog(`# ---\n# Erreur: ${prog.error}`);
      } catch {
        /* ignore */
      }
    }
  })();
}

/**
 * Simule une synchronisation pour un merchantId donné : appelle l'API, compare avec les affiliés,
 * retourne le résultat de la comparaison sans modifier les données.
 */
export async function simulateClicToPaySync(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const { merchantId, environment } = req.body as { merchantId?: number | string; environment?: 'TEST' | 'PROD' };
  const mid = Math.floor(Number(merchantId));
  if (Number.isNaN(mid)) {
    return res.status(400).json({ message: 'merchantId requis et doit être un nombre' });
  }
  const env = environment && ['TEST', 'PROD'].includes(environment) ? environment : 'TEST';
  const config = await getClicToPaySyncConfig(env);
  if (!config) {
    return res.status(400).json({
      message: `Credentials ClicToPay ${env} non configurés. Configurez-les dans Configuration > ClicToPay.`,
    });
  }

  const apiResponse = await syncWithClicToPay(mid, env, config);
  const { processingId, terminalId } = extractProcessingIdAndTerminalId(apiResponse);

  let match: { id: string; merchant_code: string; numero_terminal: string | null; company_name: string } | null = null;
  const candidates: { id: string; merchant_code: string; numero_terminal: string | null; company_name: string }[] = [];

  if (processingId && terminalId) {
    const affiliate = await prisma.affiliate.findFirst({
      where: { merchant_code: processingId, numero_terminal: terminalId },
      select: { id: true, merchant_code: true, numero_terminal: true, company_name: true },
    });
    if (affiliate) match = affiliate;
    const byProc = await prisma.affiliate.findMany({
      where: { merchant_code: processingId },
      select: { id: true, merchant_code: true, numero_terminal: true, company_name: true },
    });
    candidates.push(...byProc);
  }

  const comparison = {
    processingId,
    terminalId,
    match: !!match,
    conditionMet: !!(processingId && terminalId),
    expectedAffiliation: processingId,
    expectedNumeroTerminal: terminalId,
  };

  return res.json({
    merchantId: mid,
    environment: env,
    apiResponse: apiResponse ?? null,
    comparison,
    match: match ? { ...match } : null,
    candidatesAffiliatesWithSameProcessingId: candidates.map((c) => ({
      ...c,
      terminalMatch: c.numero_terminal === terminalId,
    })),
  });
}

/** Retourne la progression du scan ClicToPay. */
export async function getClicToPayScanStatus(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const environment = req.query.environment as 'TEST' | 'PROD' | undefined;
  if (environment && ['TEST', 'PROD'].includes(environment)) {
    return res.json({ progress: { ...clictopayScanProgress[environment] } });
  }
  return res.json({ progress: { TEST: clictopayScanProgress.TEST, PROD: clictopayScanProgress.PROD } });
}

const ALLOWED_TRANSITIONS: Record<AffiliateStatus, AffiliateStatus[]> = {
  CREATED_MERCHANT_MGT: ['AFFILIATION_CREATED'],
  AFFILIATION_CREATED: ['TEST_PARAMS_SENT'],
  TEST_PARAMS_SENT: ['TESTS_VALIDATED'],
  TESTS_VALIDATED: ['PROD_PARAMS_SENT'],
  PROD_PARAMS_SENT: ['IN_PRODUCTION'],
  IN_PRODUCTION: [],
};

export async function updateStatus(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const { id } = req.params;
  const { new_status, comment } = req.body as { new_status?: AffiliateStatus; comment?: string };
  if (!new_status) return res.status(400).json({ message: 'new_status requis' });
  const affiliate = await findAffiliateByIdOrCode(id);
  if (!affiliate) return res.status(404).json({ message: 'Affilié non trouvé' });
  if (req.user.role === 'BANQUE' && affiliate.bankId !== req.user.bankId) {
    return res.status(403).json({ message: 'Accès refusé' });
  }
  const allowed = ALLOWED_TRANSITIONS[affiliate.status];
  if (!allowed?.includes(new_status)) {
    return res.status(400).json({ message: `Transition non autorisée: ${affiliate.status} → ${new_status}` });
  }
  const [updated] = await prisma.$transaction([
    prisma.affiliate.update({
      where: { id: affiliate.id },
      data: {
        status: new_status,
        ...(new_status === 'AFFILIATION_CREATED' && { affiliation_date: new Date() }),
      },
    }),
    prisma.affiliateHistory.create({
      data: {
        affiliate_id: affiliate.id,
        old_status: affiliate.status,
        new_status,
        changed_by: req.user.userId,
        comment: comment ?? null,
      },
    }),
  ]);
  const { test_password_hash, prod_password_hash, ...safe } = updated;
  return res.json(safe);
}

export async function deleteAffiliate(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const { id } = req.params;
  const affiliate = await findAffiliateByIdOrCode(id);
  if (!affiliate) return res.status(404).json({ message: 'Affilié non trouvé' });
  if (req.user.role === 'BANQUE' && affiliate.bankId !== req.user.bankId) {
    return res.status(403).json({ message: 'Accès refusé' });
  }
  try {
    await prisma.affiliate.delete({ where: { id: affiliate.id } });
    return res.json({ message: `Affilié ${affiliate.merchant_code} supprimé avec succès.` });
  } catch (err) {
    console.error('Delete affiliate error:', err);
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Erreur lors de la suppression de l\'affilié',
    });
  }
}
