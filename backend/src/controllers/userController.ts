import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../services/prisma';
import { UserRole } from '@prisma/client';

const SALT_ROUNDS = 12;

/** Seul SUPER_ADMIN peut modifier un ADMIN ou SUPER_ADMIN */
function canModifyUser(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === 'SUPER_ADMIN') return true;
  if (actorRole === 'ADMIN' && targetRole !== 'SUPER_ADMIN' && targetRole !== 'ADMIN') return true;
  return false;
}

export async function listBanks(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const banks = await prisma.bank.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, code: true },
  });
  return res.json(banks);
}

export async function list(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const users = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      bankId: true,
      createdAt: true,
      lastLoginAt: true,
      bank: { select: { id: true, name: true, code: true } },
    },
  });
  return res.json(users);
}

export async function getById(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const { id } = req.params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      bankId: true,
      createdAt: true,
      lastLoginAt: true,
      bank: { select: { id: true, name: true, code: true } },
    },
  });
  if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
  if (!canModifyUser(req.user.role, user.role)) {
    return res.status(403).json({ message: 'Droits insuffisants pour cet utilisateur' });
  }
  return res.json(user);
}

export async function create(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const body = req.body as {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    role?: UserRole;
    isActive?: boolean;
    bankId?: string | null;
  };
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '').trim();
  const firstName = String(body.firstName ?? '').trim();
  const lastName = String(body.lastName ?? '').trim();
  const role = body.role as UserRole | undefined;
  const isActive = body.isActive !== false;
  const bankId = body.bankId === '' || body.bankId === undefined ? null : (body.bankId as string);

  if (!email || !password || !firstName || !lastName || !role) {
    return res.status(400).json({
      message: 'Champs requis : email, password, firstName, lastName, role',
    });
  }
  const allowedRoles: UserRole[] = req.user.role === 'SUPER_ADMIN'
    ? ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'BANQUE', 'PAYFAC']
    : ['SUPPORT', 'BANQUE', 'PAYFAC'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ message: 'Rôle non autorisé' });
  }
  if (role !== 'BANQUE') {
    if (bankId) return res.status(400).json({ message: 'bankId réservé au rôle BANQUE' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ message: 'Un utilisateur avec cet email existe déjà' });

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email,
      password: passwordHash,
      firstName,
      lastName,
      role,
      isActive,
      bankId: role === 'BANQUE' ? bankId : null,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      bankId: true,
      createdAt: true,
      bank: { select: { id: true, name: true, code: true } },
    },
  });
  return res.status(201).json(user);
}

export async function update(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const { id } = req.params;
  const body = req.body as {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    role?: UserRole;
    isActive?: boolean;
    bankId?: string | null;
  };

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ message: 'Utilisateur non trouvé' });
  if (!canModifyUser(req.user.role, target.role)) {
    return res.status(403).json({ message: 'Droits insuffisants pour modifier cet utilisateur' });
  }

  const allowedRoles: UserRole[] = req.user.role === 'SUPER_ADMIN'
    ? ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'BANQUE', 'PAYFAC']
    : ['SUPPORT', 'BANQUE', 'PAYFAC'];
  const role = body.role !== undefined ? (body.role as UserRole) : target.role;
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ message: 'Rôle non autorisé' });
  }

  const email = body.email !== undefined ? String(body.email).trim().toLowerCase() : target.email;
  if (email !== target.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: 'Un utilisateur avec cet email existe déjà' });
  }

  const bankId = body.bankId !== undefined
    ? (body.bankId === '' ? null : (body.bankId as string))
    : target.bankId;
  if (role !== 'BANQUE' && bankId) {
    return res.status(400).json({ message: 'bankId réservé au rôle BANQUE' });
  }

  const data: {
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    isActive: boolean;
    bankId: string | null;
    password?: string;
  } = {
    email,
    firstName: body.firstName !== undefined ? String(body.firstName).trim() : target.firstName,
    lastName: body.lastName !== undefined ? String(body.lastName).trim() : target.lastName,
    role,
    isActive: body.isActive !== undefined ? Boolean(body.isActive) : target.isActive,
    bankId: role === 'BANQUE' ? bankId : null,
  };
  if (body.password && String(body.password).trim().length >= 8) {
    data.password = await bcrypt.hash(String(body.password).trim(), SALT_ROUNDS);
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      bankId: true,
      createdAt: true,
      lastLoginAt: true,
      bank: { select: { id: true, name: true, code: true } },
    },
  });
  return res.json(user);
}

export async function remove(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const { id } = req.params;
  if (id === req.user.userId) {
    return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte' });
  }
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ message: 'Utilisateur non trouvé' });
  if (!canModifyUser(req.user.role, target.role)) {
    return res.status(403).json({ message: 'Droits insuffisants pour supprimer cet utilisateur' });
  }
  await prisma.user.delete({ where: { id } });
  return res.status(204).send();
}
