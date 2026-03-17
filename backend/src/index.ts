import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import affiliateRoutes from './routes/affiliateRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import configRoutes from './routes/configRoutes';
import userRoutes from './routes/userRoutes';
import apiV1Routes from './routes/apiV1Routes';
import { auditMiddleware } from './middleware/auditMiddleware';

const app = express();
// Port 4000 par défaut. Si occupé, essaie 4001, 4002...
const PORTS = process.env.PORT ? [Number(process.env.PORT)] : [4000, 4001, 4002];

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:80',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:80',
  process.env.FRONTEND_URL,
].filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      cb(null, true);
    } else {
      cb(null, allowedOrigins[0] || true);
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(auditMiddleware);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'psp-onboarding-api' });
});

app.get('/api/health/db', async (_req, res) => {
  try {
    const { prisma } = await import('./services/prisma');
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    console.error('[Health] DB error:', err);
    res.status(503).json({ status: 'error', db: 'disconnected', message: 'Base de données injoignable' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/affiliates', affiliateRoutes);
app.use('/api/config', configRoutes);
app.use('/api/users', userRoutes);
app.use('/api/v1', apiV1Routes);

// Gestionnaire d'erreurs global (attrape les erreurs non gérées des routes async)
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('[Express] Erreur non gérée:', err);
  res.status(500).json({ message: msg || 'Erreur serveur interne' });
});

function tryListen(ports: number[], idx: number) {
  const port = ports[idx];
  const server = app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' && idx + 1 < ports.length) {
      server.close();
      console.warn(`Port ${port} occupé, essai sur ${ports[idx + 1]}...`);
      tryListen(ports, idx + 1);
    } else {
      throw err;
    }
  });
}
tryListen(PORTS, 0);
