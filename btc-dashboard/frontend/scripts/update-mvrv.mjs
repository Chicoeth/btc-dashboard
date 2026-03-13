/**
 * update-mvrv.mjs
 * Baixa dados novos do CoinMetrics Community e faz merge no mvrv.json
 */
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'public', 'data', 'mvrv.json');
const API_BASE  = 'https://community-api.coinmetrics.io/v4';

let existing = [];
if (fs.existsSync(DATA_FILE)) {
  existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

// Pede apenas a partir do dia seguinte ao último registro
const lastTs   = existing.length ? existing.at(-1)[0] : 0;
const startDate = lastTs
  ? new Date(lastTs + 86400000).toISOString().split('T')[0]
  : '2013-01-01';

console.log(`Buscando MVRV a partir de ${startDate}...`);

const url = `${API_BASE}/timeseries/asset-metrics` +
  `?assets=btc&metrics=PriceUSD,CapMVRVCur&frequency=1d` +
  `&start_time=${startDate}&page_size=1000`;

const response = await fetch(url, { headers: { Accept: 'application/json' } });
if (!response.ok) {
  const text = await response.text();
  throw new Error(`CoinMetrics ${response.status}: ${text.slice(0, 200)}`);
}

const json = await response.json();
const rows = json.data ?? [];

if (!rows.length) {
  console.log('✓ MVRV: sem dados novos');
  process.exit(0);
}

const newRecords = [];
for (const row of rows) {
  const price = parseFloat(row.PriceUSD);
  const mvrv  = parseFloat(row.CapMVRVCur);
  if (!price || !mvrv || isNaN(price) || isNaN(mvrv)) continue;
  newRecords.push([
    new Date(row.time).getTime(),
    Math.round(price * 100) / 100,
    Math.round((price / mvrv) * 100) / 100,
    Math.round(mvrv * 1000000) / 1000000,
  ]);
}

const map = new Map(existing.map(r => [r[0], r]));
for (const r of newRecords) map.set(r[0], r);
const merged = [...map.values()].sort((a, b) => a[0] - b[0]);

fs.writeFileSync(DATA_FILE, JSON.stringify(merged));

const added = merged.length - existing.length;
console.log(`✓ MVRV: ${added} dias novos | total: ${merged.length} | último: ${new Date(merged.at(-1)[0]).toISOString().split('T')[0]}`);
