import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Add BigInt serialization support for JSON
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import authRouter from './routes/auth';
import adsRouter from './routes/ads';
import channelsRouter from './routes/channels';
import scheduleRouter from './routes/schedule';
import teamRouter from './routes/team';
import notificationsRouter from './routes/notifications';
import analyticsRouter from './routes/analytics';
import uploadRouter from './routes/upload';
import { errorHandler } from './middleware/errorHandler';
import { startNotificationScheduler } from './services/notificationService';
import { startBot } from './bot';

const app = express();
const PORT = process.env.PORT || 4000;

// ── Security ──────────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Origin: ${req.headers.origin}`);
  next();
});

app.use(helmet());
app.use(cors({
  origin: true, // Reflect the request origin in the Access-Control-Allow-Origin header
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/ads', adsRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/team', teamRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/upload', uploadRouter);

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Turumba server running on port ${PORT}`);
  startNotificationScheduler();
  startBot();
});

export default app;
