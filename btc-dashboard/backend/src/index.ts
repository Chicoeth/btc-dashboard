/**
 * index.ts
 * Backend entry point.
 * Starts the Express server and schedules daily data collection.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { initDatabase } from './db';
import routes from './api/routes';
import { logger } from './utils/logger';
import { runDailyUpdate } from './scripts/dailyUpdate';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
}));
app.use(express.json());

// Routes
app.use('/api', routes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize database on startup
initDatabase();

// Schedule daily update at 2:00 UTC
cron.schedule('0 2 * * *', async () => {
  logger.info('[Cron] Running daily update...');
  try {
    await runDailyUpdate();
    logger.info('[Cron] Daily update complete.');
  } catch (err: any) {
    logger.error('[Cron] Daily update failed:', err.message);
  }
});

app.listen(PORT, () => {
  logger.info(`🚀 Backend running on http://localhost:${PORT}`);
});
