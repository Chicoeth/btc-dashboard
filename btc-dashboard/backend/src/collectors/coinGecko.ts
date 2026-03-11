/**
 * collectors/coinGecko.ts
 * Fetches BTC price and market data from CoinGecko API.
 * Free tier: no API key needed for basic endpoints.
 *
 * Data fetched:
 *   - Daily OHLCV price history (full history)
 *   - Market cap history
 *   - BTC dominance
 */

import axios from 'axios';
import { db } from '../db';
import { logger } from '../utils/logger';
import { formatDate, sleep } from '../utils/helpers';

const BASE_URL = 'https://api.coingecko.com/api/v3';
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || '';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: COINGECKO_API_KEY ? { 'x-cg-demo-api-key': COINGECKO_API_KEY } : {},
});

/**
 * Returns the most recent date we have price data for.
 */
function getLastPriceDate(): string | null {
  const row = db.prepare('SELECT MAX(date) as last_date FROM price_daily').get() as any;
  return row?.last_date || null;
}

/**
 * Fetch full market chart from CoinGecko.
 * If we already have data, only fetch from last known date.
 */
export async function collectPriceData(): Promise<void> {
  const lastDate = getLastPriceDate();
  logger.info(`[CoinGecko] Last price date: ${lastDate || 'none (full sync)'}`);

  try {
    // Full historical data — CoinGecko returns daily OHLCV
    // For free tier: max 365 days. Pro: full history.
    // We use 'max' for first sync, then daily incremental.
    const days = lastDate ? '2' : 'max';

    const response = await client.get('/coins/bitcoin/market_chart', {
      params: {
        vs_currency: 'usd',
        days,
        interval: 'daily',
        precision: 'full',
      },
    });

    const { prices, market_caps, total_volumes } = response.data;

    // prices: [[timestamp, price], ...]
    const insert = db.prepare(`
      INSERT OR REPLACE INTO price_daily
        (date, close, market_cap, volume_usd, source)
      VALUES
        (@date, @close, @market_cap, @volume_usd, 'coingecko')
    `);

    const insertMany = db.transaction((rows: any[]) => {
      for (const row of rows) insert.run(row);
    });

    const rows = prices.map(([ts, price]: [number, number], i: number) => ({
      date: formatDate(new Date(ts)),
      close: price,
      market_cap: market_caps[i]?.[1] ?? null,
      volume_usd: total_volumes[i]?.[1] ?? null,
    }));

    insertMany(rows);

    // Log sync
    db.prepare(`
      INSERT INTO sync_log (metric, last_date, status, records_added)
      VALUES ('price_daily', ?, 'success', ?)
    `).run(rows[rows.length - 1]?.date, rows.length);

    logger.info(`[CoinGecko] Inserted ${rows.length} price records.`);
  } catch (err: any) {
    logger.error('[CoinGecko] Error fetching price data:', err.message);
    db.prepare(`INSERT INTO sync_log (metric, status, message) VALUES ('price_daily', 'error', ?)`).run(err.message);
    throw err;
  }
}

/**
 * Fetch global BTC dominance history.
 */
export async function collectDominanceData(): Promise<void> {
  logger.info('[CoinGecko] Fetching BTC dominance...');
  try {
    await sleep(1200); // respect rate limits

    // CoinGecko /global/market_cap_chart — returns dominance as part of data
    // For now, we compute dominance = btc_market_cap / total_market_cap from price data
    // This is a placeholder for when you add a Pro API key

    logger.info('[CoinGecko] Dominance collection placeholder (requires Pro API or alternative source).');
  } catch (err: any) {
    logger.error('[CoinGecko] Error fetching dominance:', err.message);
    throw err;
  }
}
