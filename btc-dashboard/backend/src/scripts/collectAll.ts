/**
 * scripts/collectAll.ts
 * One-time script to download ALL historical data.
 * Run this once when setting up a new environment.
 * After this, use dailyUpdate.ts for incremental updates.
 *
 * Usage: npx ts-node src/scripts/collectAll.ts
 */

import { initDatabase } from '../db';
import { collectPriceData, collectDominanceData } from '../collectors/coinGecko';
import { collectOnChainData } from '../collectors/blockchainInfo';
import { collectGlassnodeData } from '../collectors/glassnode';
import { computeAllIndicators } from '../calculators/indicators';
import { logger } from '../utils/logger';

async function main() {
  logger.info('=== Full Historical Sync Started ===');
  logger.info('This may take several minutes depending on API rate limits...\n');

  // Initialize DB schema
  initDatabase();

  // Step 1: Price & Market Data (CoinGecko)
  logger.info('Step 1/4: Fetching price history...');
  await collectPriceData();
  await collectDominanceData();

  // Step 2: On-Chain Data (Blockchain.info)
  logger.info('Step 2/4: Fetching on-chain data...');
  await collectOnChainData();

  // Step 3: Advanced metrics (Glassnode, if API key set)
  logger.info('Step 3/4: Fetching Glassnode metrics...');
  await collectGlassnodeData();

  // Step 4: Compute all derived indicators
  logger.info('Step 4/4: Computing indicators...');
  computeAllIndicators();

  logger.info('\n=== Full Historical Sync Complete ===');
  logger.info('Run npm run collect:daily once per day to stay updated.');
  process.exit(0);
}

main().catch((err) => {
  logger.error('Fatal error during sync:', err);
  process.exit(1);
});
