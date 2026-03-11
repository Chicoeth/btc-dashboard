/**
 * collectors/blockchainInfo.ts
 * Fetches on-chain data from Blockchain.com API.
 * No API key required.
 *
 * Data fetched:
 *   - Transaction count
 *   - Hashrate
 *   - Difficulty
 *   - Active addresses
 *   - Mining revenue
 */

import axios from 'axios';
import { db } from '../db';
import { logger } from '../utils/logger';
import { formatDate, sleep } from '../utils/helpers';

const BASE_URL = 'https://api.blockchain.info/charts';

const CHARTS = {
  'n-transactions':          'tx_count',
  'hash-rate':               'hashrate_th',       // TH/s
  'difficulty':              'difficulty',
  'n-unique-addresses':      'active_addresses',
  'miners-revenue':          'miner_revenue_usd',
  'transaction-fees-usd':    'fees_usd',
  'avg-block-size':          'avg_block_size_bytes',
  'utxo-count':              'utxo_count',
  'mempool-count':           'mempool_tx_count',
} as const;

async function fetchChart(chartName: string, timespan = 'all'): Promise<{ x: number; y: number }[]> {
  await sleep(800);
  const resp = await axios.get(`${BASE_URL}/${chartName}`, {
    params: { timespan, format: 'json', sampled: false },
    timeout: 30000,
  });
  return resp.data.values;
}

/**
 * Syncs on-chain data from Blockchain.com.
 * Checks last stored date and only fetches missing data.
 */
export async function collectOnChainData(): Promise<void> {
  const row = db.prepare('SELECT MAX(date) as last_date FROM onchain_daily').get() as any;
  const lastDate = row?.last_date;
  const timespan = lastDate ? '30days' : 'all';

  logger.info(`[Blockchain.info] Fetching on-chain data (timespan: ${timespan})...`);

  try {
    // Fetch each chart
    const [txCounts, hashrates, difficulties, activeAddrs, minerRevs] = await Promise.all([
      fetchChart('n-transactions', timespan),
      fetchChart('hash-rate', timespan),
      fetchChart('difficulty', timespan),
      fetchChart('n-unique-addresses', timespan),
      fetchChart('miners-revenue', timespan),
    ]);

    // Index by date string for joining
    const byDate: Record<string, any> = {};

    for (const { x, y } of txCounts) {
      const date = formatDate(new Date(x * 1000));
      byDate[date] = { ...byDate[date], date, tx_count: y };
    }
    for (const { x, y } of hashrates) {
      const date = formatDate(new Date(x * 1000));
      // Convert TH/s to EH/s
      byDate[date] = { ...byDate[date], hashrate_eh: y / 1e6 };
    }
    for (const { x, y } of difficulties) {
      const date = formatDate(new Date(x * 1000));
      byDate[date] = { ...byDate[date], difficulty: y };
    }
    for (const { x, y } of activeAddrs) {
      const date = formatDate(new Date(x * 1000));
      byDate[date] = { ...byDate[date], active_addresses: y };
    }
    for (const { x, y } of minerRevs) {
      const date = formatDate(new Date(x * 1000));
      byDate[date] = { ...byDate[date], miner_revenue_usd: y };
    }

    const rows = Object.values(byDate).filter((r: any) => r.date && (!lastDate || r.date > lastDate));

    if (rows.length === 0) {
      logger.info('[Blockchain.info] No new on-chain data.');
      return;
    }

    // Insert into onchain_daily
    const insertOnchain = db.prepare(`
      INSERT OR REPLACE INTO onchain_daily
        (date, tx_count, active_addresses, source)
      VALUES (@date, @tx_count, @active_addresses, 'blockchain.info')
    `);

    // Insert into mining_daily
    const insertMining = db.prepare(`
      INSERT OR REPLACE INTO mining_daily
        (date, hashrate_eh, difficulty, miner_revenue_usd, source)
      VALUES (@date, @hashrate_eh, @difficulty, @miner_revenue_usd, 'blockchain.info')
    `);

    const insertAll = db.transaction((items: any[]) => {
      for (const row of items) {
        if (row.tx_count !== undefined) insertOnchain.run(row);
        if (row.hashrate_eh !== undefined) insertMining.run(row);
      }
    });

    insertAll(rows);

    db.prepare(`INSERT INTO sync_log (metric, last_date, status, records_added) VALUES ('onchain_daily', ?, 'success', ?)`)
      .run(rows[rows.length - 1]?.date, rows.length);

    logger.info(`[Blockchain.info] Inserted ${rows.length} on-chain records.`);
  } catch (err: any) {
    logger.error('[Blockchain.info] Error:', err.message);
    db.prepare(`INSERT INTO sync_log (metric, status, message) VALUES ('onchain_daily', 'error', ?)`).run(err.message);
    throw err;
  }
}
