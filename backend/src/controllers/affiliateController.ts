import { Request, Response } from 'express';
import fs from 'fs/promises';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../services/prisma';
import {
  parseExcelBuffer,
  rowToAffiliateCreate,
  rowToAffiliateUpdate,
  buildTemplateBuffer,
} from '../services/excelImport';
import { sendParamsEmail, isEmailConfigured } from '../services/emailService';
import { verifyMerchantTests, isClicToPayConfigured } from '../services/clictopayService';
import { AffiliateStatus } from '@prisma/client';

function generateTempPassword(): string {
  return crypto.randomBytes(8).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
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
        await prisma.affiliate.update({
          where: { id: existing.id },
          data: updateData,
        });
        updatedCount++;
      } catch (e) {
        errors.push({ row: item.row, message: e instanceof Error ? e.message : 'Erreur mise à jour' });
      }
      continue;
    }
    try {
      const create = rowToAffiliateCreate(item.data, userId);
      const affiliate = await prisma.affiliate.create({
        data: { ...create, import_batch_id: batch.id },
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
      date_creation: (body.date_creation as string) || null,
      date_modification: (body.date_modification as string) || null,
      type_cartes: (body.type_cartes as string) || null,
      status: 'CREATED_MERCHANT_MGT' as AffiliateStatus,
      created_by: req.user.userId,
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
  const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const createdBy = admin?.id ?? '';
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
      date_creation: (body.date_creation as string) || null,
      date_modification: (body.date_modification as string) || null,
      type_cartes: (body.type_cartes as string) || null,
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
  return res.status(201).json({
    affiliate_id: affiliate.id,
    merchant_code: affiliate.merchant_code,
    status: affiliate.status,
    created_at: affiliate.createdAt,
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
  createdAt: true,
  bank: { select: { id: true, name: true, code: true } },
};

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
  const sort_by = (req.query.sort_by as string) || 'createdAt';
  const sort_order = (req.query.sort_order as string) === 'asc' ? 'asc' : 'desc';
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
  const orderBy = { [sort_by]: sort_order };
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
  const affiliate = await prisma.affiliate.findUnique({
    where: { id },
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
    },
  });
  if (!affiliate) return res.status(404).json({ message: 'Affilié non trouvé' });
  if (req.user.role === 'BANQUE' && req.user.bankId && affiliate.bankId !== req.user.bankId) {
    return res.status(403).json({ message: 'Accès refusé' });
  }
  const { test_password_hash, prod_password_hash, ...safe } = affiliate;
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
    orderBy: { createdAt: 'desc' },
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
      CRÉÉ_LE: a.createdAt,
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
  const csv = header + data.map((a) => [a.merchant_code, a.company_name, a.trade_name, a.city, a.country, a.status, a.createdAt].join(';')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=affilies.csv');
  return res.send('\uFEFF' + csv);
}

export async function sendTestParams(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const { id } = req.params;
  const affiliate = await prisma.affiliate.findUnique({ where: { id } });
  if (!affiliate) return res.status(404).json({ message: 'Affilié non trouvé' });
  if (req.user.role === 'BANQUE' && affiliate.bankId !== req.user.bankId) {
    return res.status(403).json({ message: 'Accès refusé' });
  }
  const login = affiliate.merchant_code;
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const now = new Date();
  await prisma.affiliate.update({
    where: { id },
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
  return res.json({
    sent,
    message: sent ? 'Paramètres de test envoyés par email.' : (isEmailConfigured() ? 'Échec envoi email.' : 'SMTP non configuré. Enregistrement mis à jour uniquement.'),
    test_params_sent_at: now,
  });
}

export async function sendProdParams(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const { id } = req.params;
  const affiliate = await prisma.affiliate.findUnique({ where: { id } });
  if (!affiliate) return res.status(404).json({ message: 'Affilié non trouvé' });
  if (req.user.role === 'BANQUE' && affiliate.bankId !== req.user.bankId) {
    return res.status(403).json({ message: 'Accès refusé' });
  }
  const login = affiliate.merchant_code;
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const now = new Date();
  await prisma.affiliate.update({
    where: { id },
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
  return res.json({
    sent,
    message: sent ? 'Paramètres de production envoyés par email.' : (isEmailConfigured() ? 'Échec envoi email.' : 'SMTP non configuré. Enregistrement mis à jour uniquement.'),
    prod_params_sent_at: now,
  });
}

export async function verifyTests(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const { id } = req.params;
  const { operator_comment } = req.body as { operator_comment?: string };
  const affiliate = await prisma.affiliate.findUnique({ where: { id } });
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
      affiliate_id: id,
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
    where: { id },
    data: {
      tests_validated_at: new Date(),
      tests_validated_by: req.user.userId,
    },
  });
  return res.json(validation);
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
  const affiliate = await prisma.affiliate.findUnique({ where: { id } });
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
      where: { id },
      data: {
        status: new_status,
        ...(new_status === 'AFFILIATION_CREATED' && { affiliation_date: new Date() }),
      },
    }),
    prisma.affiliateHistory.create({
      data: {
        affiliate_id: id,
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
