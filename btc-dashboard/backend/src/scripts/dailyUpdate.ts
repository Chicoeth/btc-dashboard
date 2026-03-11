/**
 * scripts/dailyUpdate.ts
 * Runs once per day to fetch only new/missing data and recompute indicators.
 */

import { collectPriceData } from '../collectors/coinGecko';
import { collectOnChainData } from '../collectors/blockchainInfo';
import { collectGlassnodeData } from '../collectors/glassnode';
import { computeAllIndicators } from '../calculators/indicators';
import { logger } from '../utils/logger';

export async function runDailyUpdate(): Promise<void> {
  logger.info('=== Daily Update Started ===');

  // 1. Collect data (each collector handles incremental sync)
  await collectPriceData();
  await collectOnChainData();
  await collectGlassnodeData();

  // 2. Recompute indicators from latest data
  computeAllIndicators();

  logger.info('=== Daily Update Complete ===');
}

// Allow running directly: npx ts-node src/scripts/dailyUpdate.ts
if (require.main === module) {
  runDailyUpdate().catch(console.error);
}
