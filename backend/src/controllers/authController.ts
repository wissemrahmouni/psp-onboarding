import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../services/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email et mot de passe requis' });
  }
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) {
    return res.status(401).json({ message: 'Identifiants incorrects' });
  }
  if (!user.isActive) {
    return res.status(401).json({ message: 'Compte désactivé' });
  }
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ message: 'Identifiants incorrects' });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'LOGIN',
      resource: 'auth',
      ip_address: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket?.remoteAddress,
      user_agent: req.headers['user-agent'] || null,
    },
  });
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    bankId: user.bankId,
  };
  const access_token = signAccessToken(payload);
  const refresh_token = signRefreshToken(payload);
  const { password: _, ...userWithoutPassword } = user;
  return res.json({
    access_token,
    refresh_token,
    user: userWithoutPassword,
  });
}

export async function refresh(req: Request, res: Response) {
  const { refresh_token: token } = req.body;
  if (!token) {
    return res.status(400).json({ message: 'refresh_token requis' });
  }
  try {
    const payload = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, bankId: true, isActive: true },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Utilisateur inactif ou introuvable' });
    }
    const access_token = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      bankId: user.bankId,
    });
    return res.json({ access_token });
  } catch {
    return res.status(401).json({ message: 'Refresh token expiré ou invalide' });
  }
}

export async function logout(req: Request, res: Response) {
  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'LOGOUT',
        resource: 'auth',
        ip_address: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket?.remoteAddress,
        user_agent: req.headers['user-agent'] || null,
      },
    });
  }
  return res.json({ message: 'Déconnexion réussie' });
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      bankId: true,
      isActive: true,
      lastLoginAt: true,
      bank: { select: { id: true, name: true, code: true } },
    },
  });
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable' });
  }
  return res.json(user);
}
