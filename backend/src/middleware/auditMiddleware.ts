import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../services/prisma';

export async function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  const method = req.method;
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    return next();
  }
  const originalJson = res.json.bind(res);
  (res as { json: (body?: unknown) => Response }).json = function (body: unknown) {
    const status = res.statusCode;
    if (status >= 200 && status < 300) {
      prisma.auditLog
        .create({
          data: {
            userId: req.user?.userId ?? null,
            action: `${method} ${req.path}`,
            resource: req.path.split('/').filter(Boolean)[1] || 'unknown',
            resource_id: req.params.id ?? null,
            ip_address: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket?.remoteAddress || null,
            user_agent: req.headers['user-agent'] || null,
            payload: method !== 'GET' && req.body && Object.keys(req.body).length ? (req.body as Prisma.InputJsonValue) : undefined,
          },
        })
        .catch(() => {});
    }
    return originalJson(body);
  };
  next();
}
