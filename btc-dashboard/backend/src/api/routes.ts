/**
 * api/routes.ts
 * REST API endpoints for the frontend to consume.
 * All data is served from the local SQLite database.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// ================================================
// PRICE & MARKET
// ================================================

router.get('/price', (req: Request, res: Response) => {
  const { from, to, limit } = req.query;
  let query = 'SELECT date, open, high, low, close, volume_usd, market_cap FROM price_daily WHERE 1=1';
  const params: any[] = [];

  if (from) { query += ' AND date >= ?'; params.push(from); }
  if (to)   { query += ' AND date <= ?'; params.push(to); }
  query += ' ORDER BY date ASC';
  if (limit) { query += ' LIMIT ?'; params.push(Number(limit)); }

  try {
    const rows = db.prepare(query).all(...params);
    res.json({ data: rows, count: rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================
// ON-CHAIN
// ================================================

router.get('/onchain', (req: Request, res: Response) => {
  const { from, to } = req.query;
  let query = 'SELECT * FROM onchain_daily WHERE 1=1';
  const params: any[] = [];
  if (from) { query += ' AND date >= ?'; params.push(from); }
  if (to)   { query += ' AND date <= ?'; params.push(to); }
  query += ' ORDER BY date ASC';

  try {
    res.json({ data: db.prepare(query).all(...params) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================
// MINING
// ================================================

router.get('/mining', (req: Request, res: Response) => {
  const { from, to } = req.query;
  let query = 'SELECT * FROM mining_daily WHERE 1=1';
  const params: any[] = [];
  if (from) { query += ' AND date >= ?'; params.push(from); }
  if (to)   { query += ' AND date <= ?'; params.push(to); }
  query += ' ORDER BY date ASC';

  try {
    res.json({ data: db.prepare(query).all(...params) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================
// INDICATORS
// ================================================

router.get('/indicators', (req: Request, res: Response) => {
  const { from, to, metrics } = req.query;
  const cols = metrics
    ? (metrics as string).split(',').filter(m => /^[a-z_]+$/.test(m)).join(', ')
    : '*';

  let query = `SELECT date, ${cols} FROM indicators_daily WHERE 1=1`;
  const params: any[] = [];
  if (from) { query += ' AND date >= ?'; params.push(from); }
  if (to)   { query += ' AND date <= ?'; params.push(to); }
  query += ' ORDER BY date ASC';

  try {
    res.json({ data: db.prepare(query).all(...params) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================
// HALVINGS
// ================================================

router.get('/halvings', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM halvings ORDER BY block_height ASC').all();
    res.json({ data: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================
// SYNC STATUS
// ================================================

router.get('/sync-status', (_req: Request, res: Response) => {
  try {
    const latest = db.prepare(`
      SELECT metric, last_date, last_run, status, records_added
      FROM sync_log
      GROUP BY metric
      HAVING MAX(id)
      ORDER BY metric
    `).all();
    res.json({ data: latest });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================
// SUMMARY (for dashboard overview card)
// ================================================

router.get('/summary', (_req: Request, res: Response) => {
  try {
    const latestPrice = db.prepare('SELECT * FROM price_daily ORDER BY date DESC LIMIT 1').get();
    const latestMining = db.prepare('SELECT * FROM mining_daily ORDER BY date DESC LIMIT 1').get();
    const halvings = db.prepare('SELECT * FROM halvings ORDER BY block_height ASC').all();

    res.json({
      data: {
        price: latestPrice,
        mining: latestMining,
        halvings,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
