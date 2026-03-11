/**
 * collectors/glassnode.ts
 * Glassnode API collector for advanced on-chain metrics.
 * Requires API key (free tier available at glassnode.com).
 *
 * Metrics available (with free tier):
 *   - SOPR (Spent Output Profit Ratio)
 *   - NUPL (Net Unrealized Profit/Loss)
 *   - Active addresses
 *   - Realized cap
 *   - Exchange flows
 *
 * Set GLASSNODE_API_KEY in your .env file.
 */

import axios from 'axios';
import { db } from '../db';
import { logger } from '../utils/logger';
import { formatDate, sleep } from '../utils/helpers';

const BASE_URL = 'https://api.glassnode.com/v1/metrics';
const API_KEY = process.env.GLASSNODE_API_KEY;

if (!API_KEY) {
  logger.warn('[Glassnode] No API key set. Glassnode metrics will be skipped.');
}

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  params: { a: 'BTC', api_key: API_KEY },
});

async function fetchMetric(endpoint: string, extraParams = {}): Promise<{ t: number; v: number }[]> {
  await sleep(500);
  const resp = await client.get(endpoint, { params: { ...extraParams, i: '24h' } });
  return resp.data;
}

/**
 * Collect Glassnode advanced metrics.
 * Only runs if GLASSNODE_API_KEY is set.
 */
export async function collectGlassnodeData(): Promise<void> {
  if (!API_KEY) {
    logger.info('[Glassnode] Skipping — no API key.');
    return;
  }

  logger.info('[Glassnode] Fetching advanced on-chain metrics...');

  try {
    const [realizedCap, nupl, sopr] = await Promise.all([
      fetchMetric('/market/realized_cap_usd'),
      fetchMetric('/indicators/nupl'),
      fetchMetric('/sopr/sopr'),
    ]);

    const byDate: Record<string, any> = {};

    for (const { t, v } of realizedCap) {
      const date = formatDate(new Date(t * 1000));
      byDate[date] = { ...byDate[date], date, realized_cap_usd: v, realized_price: null };
    }
    for (const { t, v } of nupl) {
      const date = formatDate(new Date(t * 1000));
      byDate[date] = { ...byDate[date], nupl: v };
    }

    // Update supply_daily with realized cap
    const upsertSupply = db.prepare(`
      INSERT OR REPLACE INTO supply_daily (date, realized_cap_usd, source)
      VALUES (@date, @realized_cap_usd, 'glassnode')
      ON CONFLICT(date) DO UPDATE SET
        realized_cap_usd = excluded.realized_cap_usd,
        source = 'glassnode'
    `);

    const insertAll = db.transaction((items: any[]) => {
      for (const row of items) {
        if (row.realized_cap_usd !== undefined) upsertSupply.run(row);
      }
    });

    const rows = Object.values(byDate);
    insertAll(rows);

    logger.info(`[Glassnode] Updated ${rows.length} records.`);
  } catch (err: any) {
    logger.error('[Glassnode] Error:', err.message);
    throw err;
  }
}
