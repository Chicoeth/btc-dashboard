/**
 * fetch-etf-holdings.mjs — conversão do arquivo ETF_data.txt para etf-holdings.json
 *
 * Rodar UMA VEZ para gerar o JSON histórico a partir do arquivo fornecido.
 *
 * Formato de saída (etf-holdings.json): array de arrays:
 *   [ts_ms, btc_price, total, avg_cost, mvrv, IBIT, FBTC, BITB, ARKB, BTCO, EZBC, BRRR, HODL, BTCW, GBTC, BTC]
 *
 * Custo médio: inflows precificados ao preço do dia, outflows reduzem posição proporcionalmente.
 * GBTC pré-existente (619,173 BTC do trust): entrada ao preço do dia 1.
 *
 * Uso: node scripts/fetch-etf-holdings.mjs
 */
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const INPUT_FILE  = path.join(__dirname, 'ETF_data.txt');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'data', 'etf-holdings.json');

const ETFS = ['IBIT','FBTC','BITB','ARKB','BTCO','EZBC','BRRR','HODL','BTCW','GBTC','BTC'];
const GBTC_PREEXISTING = 619173.0;

const raw = fs.readFileSync(INPUT_FILE, 'utf-8');
const csvMatch = raw.match(/'csv':\s*'([\s\S]*?)'\s*,\s*'rows'/);
if (!csvMatch) throw new Error('Não consegui extrair CSV do arquivo');

const lines  = csvMatch[1].trim().split('\\n');
const header = lines[0].split(',');
const result = [];
let cumCost = 0, cumBtc = 0, seeded = false;

for (let i = 1; i < lines.length; i++) {
  const vals = lines[i].split(',');
  const [y, m, d] = vals[0].split('-').map(Number);
  const ts       = Date.UTC(y, m - 1, d);
  const btcPrice = parseFloat(vals[header.indexOf('btc_price_usd')]);
  const total    = parseFloat(vals[header.indexOf('total_holdings_btc')]);

  if (!seeded) { cumCost += GBTC_PREEXISTING * btcPrice; cumBtc += GBTC_PREEXISTING; seeded = true; }

  let flow = 0;
  for (const etf of ETFS) flow += parseFloat(vals[header.indexOf(`${etf}_daily_flow_btc`)]);

  if (flow > 0) { cumCost += flow * btcPrice; cumBtc += flow; }
  else if (flow < 0 && cumBtc > 0) {
    const avg = cumCost / cumBtc;
    cumBtc += flow; cumCost = Math.max(0, cumBtc) * avg;
    if (cumBtc < 0) { cumBtc = 0; cumCost = 0; }
  }

  const avgCost = cumBtc > 0 ? cumCost / cumBtc : btcPrice;
  const mvrv    = avgCost > 0 ? btcPrice / avgCost : 1;
  const row     = [ts, btcPrice, total, parseFloat(avgCost.toFixed(2)), parseFloat(mvrv.toFixed(4))];
  for (const etf of ETFS) row.push(parseFloat(vals[header.indexOf(`${etf}_holdings_btc`)]));
  result.push(row);
}

result.sort((a, b) => a[0] - b[0]);
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result));
const r = result.at(-1);
console.log(`✓ ETF Holdings: ${result.length} registros | Custo Médio: $${r[3].toLocaleString()} | MVRV: ${r[4]}`);
