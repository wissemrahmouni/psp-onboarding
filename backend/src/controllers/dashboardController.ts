import { Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { AffiliateStatus } from '@prisma/client';

/** Parse date_creation (Excel/API) pour extraire année-mois. Retourne null si invalide. */
function parseCreationDate(dateStr: string | null): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const s = String(dateStr).trim();
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d;
}

export async function getStats(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const where: { bankId?: string | null } = {};
  if (req.user.role === 'BANQUE' && req.user.bankId) {
    where.bankId = req.user.bankId;
  }
  const [affiliates, countByStatusRaw, allForMonthly, blocked, latestAffiliates] = await Promise.all([
    prisma.affiliate.count({ where }),
    prisma.affiliate.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    }),
    prisma.affiliate.findMany({
      where: { ...where, createdAt: { gte: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000) } },
      select: { date_creation: true, createdAt: true },
    }),
    prisma.affiliate.findMany({
      where: {
        ...where,
        updatedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        status: { not: 'IN_PRODUCTION' },
      },
      take: 20,
      select: { id: true, merchant_code: true, company_name: true, status: true, updatedAt: true },
    }),
    prisma.affiliate.findMany({
      where: {
        ...where,
        histories: { none: { old_status: { not: null } } },
      },
      take: 10,
      orderBy: { effective_created_at: 'desc' },
      select: { id: true, merchant_code: true, company_name: true, status: true, date_creation: true, createdAt: true },
    }),
  ]);
  const count_by_status: Record<string, number> = {};
  const statuses: AffiliateStatus[] = [
    'CREATED_MERCHANT_MGT',
    'AFFILIATION_CREATED',
    'TEST_PARAMS_SENT',
    'TESTS_VALIDATED',
    'PROD_PARAMS_SENT',
    'IN_PRODUCTION',
  ];
  statuses.forEach((s) => (count_by_status[s] = 0));
  countByStatusRaw.forEach((r) => (count_by_status[r.status] = r._count.id));
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const new_this_month = await prisma.affiliate.count({
    where: { ...where, createdAt: { gte: startOfMonth } },
  });
  const in_production = count_by_status['IN_PRODUCTION'] ?? 0;
  const monthMap: Record<string, number> = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap[key] = 0;
  }
  allForMonthly.forEach((a) => {
    const effectiveDate = parseCreationDate(a.date_creation) ?? a.createdAt;
    const k = `${effectiveDate.getFullYear()}-${String(effectiveDate.getMonth() + 1).padStart(2, '0')}`;
    if (monthMap[k] !== undefined) monthMap[k]++;
  });
  const monthly_trend = Object.entries(monthMap).sort().map(([month, count]) => ({ month, count }));
  return res.json({
    total_affiliates: affiliates,
    count_by_status,
    new_this_month,
    in_production,
    blocked_affiliates: blocked,
    monthly_trend,
    avg_days_per_step: null,
    latest_affiliates: latestAffiliates,
  });
}
