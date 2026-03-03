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
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(auditMiddleware);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'psp-onboarding-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/affiliates', affiliateRoutes);
app.use('/api/config', configRoutes);
app.use('/api/users', userRoutes);
app.use('/api/v1', apiV1Routes);

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
