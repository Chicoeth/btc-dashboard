/**
 * fetch-mvrv.mjs — atualiza mvrv.json com dados da CoinMetrics Community API
 *
 * Métricas (gratuitas, sem auth):
 *   PriceUSD   = preço de mercado BTC
 *   CapMVRVCur = MVRV ratio direto
 * Derivado:
 *   realized_price = PriceUSD / CapMVRVCur
 *
 * Uso: node scripts/fetch-mvrv.mjs
 */
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE  = path.join(__dirname, '..', 'public', 'data', 'mvrv.json');
const API_BASE   = 'https://community-api.coinmetrics.io/v4';

async function fetchPage(startDate, nextPageToken) {
  let url = `${API_BASE}/timeseries/asset-metrics` +
    `?assets=btc&metrics=PriceUSD,CapMVRVCur&frequency=1d` +
    `&start_time=${startDate}&page_size=10000`;
  if (nextPageToken) url += `&next_page_token=${nextPageToken}`;

  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CoinMetrics ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function main() {
  let existing = [];
  if (fs.existsSync(DATA_FILE)) {
    existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    console.log(`Dados existentes: ${existing.length} registros`);
  }

  const lastTs   = existing.length ? existing[existing.length - 1][0] : 0;
  const lastDate = lastTs
    ? new Date(lastTs + 86400000).toISOString().split('T')[0]
    : '2013-01-01';
  console.log(`Buscando a partir de: ${lastDate}`);

  const allRows = [];
  let nextToken = null;
  let page = 1;

  do {
    console.log(`  Página ${page}...`);
    const json = await fetchPage(lastDate, nextToken);
    const rows = json.data ?? [];
    allRows.push(...rows);
    nextToken = json.next_page_token ?? null;
    page++;
  } while (nextToken);

  console.log(`Recebidos ${allRows.length} registros da API`);

  if (!allRows.length) {
    console.log('Nenhum dado novo.');
    return;
  }

  const newRecords = [];
  for (const row of allRows) {
    const price = parseFloat(row.PriceUSD);
    const mvrv  = parseFloat(row.CapMVRVCur);
    if (!price || !mvrv || isNaN(price) || isNaN(mvrv)) continue;
    newRecords.push([
      new Date(row.time).getTime(),
      Math.round(price * 100) / 100,
      Math.round((price / mvrv) * 100) / 100,  // realized_price
      Math.round(mvrv * 1000000) / 1000000,
    ]);
  }

  const map = new Map(existing.map(r => [r[0], r]));
  for (const r of newRecords) map.set(r[0], r);
  const merged = [...map.values()].sort((a, b) => a[0] - b[0]);

  fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 0));
  console.log(`Salvo: ${merged.length} total (${merged.length - existing.length} novos)`);
  console.log(`Último registro: ${new Date(merged[merged.length-1][0]).toISOString().split('T')[0]}`);
}

main().catch(err => { console.error('Erro:', err.message); process.exit(1); });
