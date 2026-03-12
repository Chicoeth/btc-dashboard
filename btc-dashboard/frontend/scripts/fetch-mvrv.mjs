/**
 * fetch-mvrv.mjs
 * 
 * Usa CoinMetrics Community API para atualizar mvrv.json com dados recentes.
 * Endpoint: https://community-api.coinmetrics.io/v4/timeseries/asset-metrics
 * Métricas: PriceUSD (preço BTC), CapRealUSD (capitalização realizada)
 * MVRV = PriceUSD / (CapRealUSD / 19_800_000)  ← supply circulante aprox
 * 
 * Uso: node scripts/fetch-mvrv.mjs
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE  = path.join(__dirname, '..', 'public', 'data', 'mvrv.json');
const API_BASE   = 'https://community-api.coinmetrics.io/v4';

// CoinMetrics retorna CapRealUSD = realized_price * supply
// realized_price = CapRealUSD / PricedSupply
// Mas a API community fornece CapMrktCurUSD e CapRealUSD diretamente
// MVRV = CapMrktCurUSD / CapRealUSD

async function fetchCoinMetrics(startDate) {
  const url = `${API_BASE}/timeseries/asset-metrics?assets=btc&metrics=PriceUSD,CapMrktCurUSD,CapRealUSD&frequency=1d&start_time=${startDate}&page_size=10000`;
  console.log('Fetching:', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinMetrics error: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  // Carrega dados existentes
  let existing = [];
  if (fs.existsSync(DATA_FILE)) {
    existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    console.log(`Loaded ${existing.length} existing records`);
  }

  // Descobre última data
  const lastTs   = existing.length ? existing[existing.length - 1][0] : 0;
  const lastDate = lastTs
    ? new Date(lastTs + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    : '2013-01-01';
  console.log(`Fetching from: ${lastDate}`);

  // Busca dados novos
  const json = await fetchCoinMetrics(lastDate);
  const rows = json.data ?? [];
  console.log(`Received ${rows.length} rows from CoinMetrics`);

  if (!rows.length) {
    console.log('No new data.');
    return;
  }

  // Converte para [[ts_ms, price, realized_price, mvrv], ...]
  const newRecords = [];
  for (const row of rows) {
    const price     = parseFloat(row.PriceUSD);
    const capMkt    = parseFloat(row.CapMrktCurUSD);
    const capReal   = parseFloat(row.CapRealUSD);
    if (!price || !capReal || isNaN(price) || isNaN(capReal)) continue;

    const realizedPrice = capReal / (capMkt / price); // CapReal / Supply = realized price per coin
    const mvrv          = capMkt / capReal;
    const ts            = new Date(row.time).getTime();

    newRecords.push([
      ts,
      Math.round(price * 100) / 100,
      Math.round(realizedPrice * 100) / 100,
      Math.round(mvrv * 1000000) / 1000000,
    ]);
  }

  // Merge — evita duplicatas por timestamp
  const map = new Map(existing.map(r => [r[0], r]));
  for (const r of newRecords) map.set(r[0], r);
  const merged = [...map.values()].sort((a, b) => a[0] - b[0]);

  fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 0));
  console.log(`Saved ${merged.length} total records (${merged.length - existing.length} new)`);
  console.log(`Last record: ${new Date(merged[merged.length-1][0]).toISOString().split('T')[0]}`);
}

main().catch(err => { console.error(err); process.exit(1); });
