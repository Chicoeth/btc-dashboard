/**
 * calculators/indicators.ts
 * Computes derived indicators from raw data stored in the database.
 * Run after each data collection cycle.
 *
 * Indicators computed:
 *   - MVRV Ratio & Z-Score
 *   - NVT Ratio & NVT Signal
 *   - Puell Multiple
 *   - Realized Price
 *   - Stock-to-Flow ratio
 */

import { db } from '../db';
import { logger } from '../utils/logger';

/**
 * Simple moving average over an array of numbers.
 */
function sma(values: (number | null)[], window: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    const slice = values.slice(i - window + 1, i + 1).filter((v): v is number => v !== null);
    if (slice.length < window) return null;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/**
 * Standard deviation of an array.
 */
function stddev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => (v - mean) ** 2);
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Compute MVRV Ratio = Market Cap / Realized Cap
 * MVRV Z-Score = (Market Cap - Realized Cap) / std(Market Cap)
 */
export function computeMVRV(): void {
  logger.info('[Calc] Computing MVRV...');

  const rows = db.prepare(`
    SELECT p.date, p.market_cap, s.realized_cap_usd
    FROM price_daily p
    LEFT JOIN supply_daily s ON p.date = s.date
    WHERE p.market_cap IS NOT NULL
    ORDER BY p.date ASC
  `).all() as any[];

  if (rows.length === 0) return;

  const marketCaps = rows.map(r => r.market_cap as number);
  const mean = marketCaps.reduce((a, b) => a + b, 0) / marketCaps.length;
  const std = stddev(marketCaps);

  const upsert = db.prepare(`
    INSERT INTO indicators_daily (date, mvrv_ratio, mvrv_zscore)
    VALUES (@date, @mvrv_ratio, @mvrv_zscore)
    ON CONFLICT(date) DO UPDATE SET
      mvrv_ratio = excluded.mvrv_ratio,
      mvrv_zscore = excluded.mvrv_zscore,
      updated_at = datetime('now')
  `);

  const insertAll = db.transaction((items: any[]) => {
    for (const item of items) upsert.run(item);
  });

  const computed = rows.map((row, i) => {
    const mvrv_ratio = row.realized_cap_usd ? row.market_cap / row.realized_cap_usd : null;
    const mvrv_zscore = std > 0 ? (row.market_cap - mean) / std : null;
    return { date: row.date, mvrv_ratio, mvrv_zscore };
  });

  insertAll(computed);
  logger.info(`[Calc] MVRV computed for ${computed.length} days.`);
}

/**
 * Compute NVT Ratio = Market Cap / Daily TX Volume (USD)
 * NVT Signal = Market Cap / 90-day MA of TX Volume
 */
export function computeNVT(): void {
  logger.info('[Calc] Computing NVT...');

  const rows = db.prepare(`
    SELECT p.date, p.market_cap, o.tx_volume_usd
    FROM price_daily p
    LEFT JOIN onchain_daily o ON p.date = o.date
    WHERE p.market_cap IS NOT NULL
    ORDER BY p.date ASC
  `).all() as any[];

  if (rows.length === 0) return;

  const txVolumes = rows.map(r => r.tx_volume_usd as number | null);
  const txVolSma90 = sma(txVolumes, 90);

  const upsert = db.prepare(`
    INSERT INTO indicators_daily (date, nvt_ratio, nvt_signal)
    VALUES (@date, @nvt_ratio, @nvt_signal)
    ON CONFLICT(date) DO UPDATE SET
      nvt_ratio = excluded.nvt_ratio,
      nvt_signal = excluded.nvt_signal,
      updated_at = datetime('now')
  `);

  const insertAll = db.transaction((items: any[]) => {
    for (const item of items) upsert.run(item);
  });

  const computed = rows.map((row, i) => ({
    date: row.date,
    nvt_ratio: row.tx_volume_usd && row.market_cap ? row.market_cap / row.tx_volume_usd : null,
    nvt_signal: txVolSma90[i] && row.market_cap ? row.market_cap / txVolSma90[i]! : null,
  }));

  insertAll(computed);
  logger.info(`[Calc] NVT computed for ${computed.length} days.`);
}

/**
 * Compute Puell Multiple = Daily issuance USD / 365d MA of daily issuance USD
 */
export function computePuellMultiple(): void {
  logger.info('[Calc] Computing Puell Multiple...');

  const rows = db.prepare(`
    SELECT m.date, m.miner_revenue_btc, p.close as price
    FROM mining_daily m
    LEFT JOIN price_daily p ON m.date = p.date
    WHERE m.miner_revenue_btc IS NOT NULL AND p.close IS NOT NULL
    ORDER BY m.date ASC
  `).all() as any[];

  if (rows.length === 0) return;

  const dailyIssuanceUSD = rows.map(r => (r.miner_revenue_btc as number) * (r.price as number));
  const sma365 = sma(dailyIssuanceUSD, 365);

  const upsert = db.prepare(`
    INSERT INTO indicators_daily (date, puell_multiple)
    VALUES (@date, @puell_multiple)
    ON CONFLICT(date) DO UPDATE SET
      puell_multiple = excluded.puell_multiple,
      updated_at = datetime('now')
  `);

  const insertAll = db.transaction((items: any[]) => {
    for (const item of items) upsert.run(item);
  });

  const computed = rows
    .map((row, i) => ({
      date: row.date,
      puell_multiple: sma365[i] ? dailyIssuanceUSD[i] / sma365[i]! : null,
    }))
    .filter(r => r.puell_multiple !== null);

  insertAll(computed);
  logger.info(`[Calc] Puell Multiple computed for ${computed.length} days.`);
}

/**
 * Compute Stock-to-Flow ratio.
 * S2F = Circulating Supply / Annual Production
 * Annual Production = block reward * 6 blocks/hr * 24hr * 365
 */
export function computeStockToFlow(): void {
  logger.info('[Calc] Computing Stock-to-Flow...');

  const rows = db.prepare(`
    SELECT p.date, s.circulating_supply, m.block_reward_btc
    FROM price_daily p
    LEFT JOIN supply_daily s ON p.date = s.date
    LEFT JOIN mining_daily m ON p.date = m.date
    WHERE s.circulating_supply IS NOT NULL AND m.block_reward_btc IS NOT NULL
    ORDER BY p.date ASC
  `).all() as any[];

  if (rows.length === 0) return;

  const upsert = db.prepare(`
    INSERT INTO indicators_daily (date, s2f_ratio)
    VALUES (@date, @s2f_ratio)
    ON CONFLICT(date) DO UPDATE SET
      s2f_ratio = excluded.s2f_ratio,
      updated_at = datetime('now')
  `);

  const insertAll = db.transaction((items: any[]) => {
    for (const item of items) upsert.run(item);
  });

  const computed = rows.map(row => {
    const annualProduction = row.block_reward_btc * 6 * 24 * 365;
    const s2f_ratio = annualProduction > 0 ? row.circulating_supply / annualProduction : null;
    return { date: row.date, s2f_ratio };
  });

  insertAll(computed);
  logger.info(`[Calc] S2F computed for ${computed.length} days.`);
}

/**
 * Run all indicator calculations.
 */
export function computeAllIndicators(): void {
  logger.info('[Calc] Running all indicator calculations...');
  computeMVRV();
  computeNVT();
  computePuellMultiple();
  computeStockToFlow();
  logger.info('[Calc] All indicators computed.');
}
