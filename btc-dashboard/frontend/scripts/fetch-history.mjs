/**
 * scripts/fetch-history.mjs
 *
 * Faz o download do histórico completo de preços do BTC desde 2012
 * e salva em public/data/btc-price.json
 *
 * Uso: node scripts/fetch-history.mjs
 *
 * Rode UMA VEZ para gerar o arquivo base.
 * Depois, a API Route /api/price/update cuida das atualizações diárias.
 *
 * Fonte: CoinGecko (gratuita, sem API key)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '../public/data/btc-price.json');

// CoinGecko retorna dados diários quando o range > 90 dias
// Vamos buscar em blocos de ~1 ano para evitar timeouts
const START_TIMESTAMP = 1325376000; // 01/01/2012 UTC
const END_TIMESTAMP = Math.floor(Date.now() / 1000);

const CHUNK_SECONDS = 365 * 24 * 60 * 60; // 1 ano por request

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchChunk(from, to) {
  const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=${from}&to=${to}&precision=2`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' }
  });

  if (res.status === 429) {
    console.log('  Rate limited, waiting 65s...');
    await sleep(65000);
    return fetchChunk(from, to); // retry
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  const data = await res.json();
  return data.prices; // [[timestamp_ms, price], ...]
}

async function main() {
  console.log('📥 Downloading BTC price history from CoinGecko...');
  console.log('   This will take a few minutes (rate limit: ~30 req/min)\n');

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

  // If file exists, find last date and only fetch missing data
  let existingData = [];
  let startFrom = START_TIMESTAMP;

  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      existingData = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
      if (existingData.length > 0) {
        const lastTs = existingData[existingData.length - 1][0];
        startFrom = Math.floor(lastTs / 1000) - (2 * 24 * 60 * 60); // 2 days overlap
        console.log(`   Found existing data (${existingData.length} records). Fetching from ${new Date(lastTs).toISOString().split('T')[0]}...\n`);
      }
    } catch (e) {
      console.log('   Could not parse existing file, starting fresh.');
      existingData = [];
    }
  }

  const allPrices = [];
  let cursor = startFrom;
  let chunkNum = 0;

  while (cursor < END_TIMESTAMP) {
    const chunkEnd = Math.min(cursor + CHUNK_SECONDS, END_TIMESTAMP);
    chunkNum++;

    const fromDate = new Date(cursor * 1000).toISOString().split('T')[0];
    const toDate = new Date(chunkEnd * 1000).toISOString().split('T')[0];
    process.stdout.write(`   Chunk ${chunkNum}: ${fromDate} → ${toDate} ... `);

    try {
      const prices = await fetchChunk(cursor, chunkEnd);
      allPrices.push(...prices);
      console.log(`${prices.length} records`);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
    }

    cursor = chunkEnd + 1;

    // Respect rate limit: ~8 requests/min on free tier to be safe
    if (cursor < END_TIMESTAMP) await sleep(8000);
  }

  // Merge with existing data (avoid duplicates by timestamp)
  const merged = [...existingData, ...allPrices];
  const seen = new Set();
  const deduped = merged.filter(([ts]) => {
    // Normalize to date string to deduplicate same day
    const dateStr = new Date(ts).toISOString().split('T')[0];
    if (seen.has(dateStr)) return false;
    seen.add(dateStr);
    return true;
  });

  // Sort by timestamp ascending
  deduped.sort((a, b) => a[0] - b[0]);

  // Save: [[timestamp_ms, close_price], ...]
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(deduped), 'utf-8');

  console.log(`\n✅ Done! ${deduped.length} daily records saved to:`);
  console.log(`   ${OUTPUT_PATH}`);
  console.log(`\n   Range: ${new Date(deduped[0][0]).toISOString().split('T')[0]} → ${new Date(deduped[deduped.length - 1][0]).toISOString().split('T')[0]}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
