/**
 * fetch-etf-holdings.mjs — conversão do arquivo ETF_data.txt para etf-holdings.json
 *
 * Rodar UMA VEZ para gerar o JSON histórico.
 *
 * Formato de saída: [ts_ms, btc_price, total, IBIT, FBTC, BITB, ARKB, BTCO, EZBC, BRRR, HODL, BTCW, GBTC, BTC]
 *
 * Uso: node scripts/fetch-etf-holdings.mjs
 *   (colocar ETF_data.txt na pasta scripts/)
 */
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const INPUT_FILE  = path.join(__dirname, 'ETF_data.txt');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'data', 'etf-holdings.json');
const ETFS = ['IBIT','FBTC','BITB','ARKB','BTCO','EZBC','BRRR','HODL','BTCW','GBTC','BTC'];

const raw = fs.readFileSync(INPUT_FILE, 'utf-8');
const csvMatch = raw.match(/'csv':\s*'([\s\S]*?)'\s*,\s*'rows'/);
if (!csvMatch) throw new Error('Não consegui extrair CSV do arquivo');

const lines  = csvMatch[1].trim().split('\\n');
const header = lines[0].split(',');
const result = [];

for (let i = 1; i < lines.length; i++) {
  const vals = lines[i].split(',');
  const [y, m, d] = vals[0].split('-').map(Number);
  const ts       = Date.UTC(y, m - 1, d);
  const btcPrice = parseFloat(vals[header.indexOf('btc_price_usd')]);
  const total    = parseFloat(vals[header.indexOf('total_holdings_btc')]);
  const row      = [ts, btcPrice, total];
  for (const etf of ETFS) row.push(parseFloat(vals[header.indexOf(`${etf}_holdings_btc`)]));
  result.push(row);
}

result.sort((a, b) => a[0] - b[0]);
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result));
console.log(`✓ ETF Holdings: ${result.length} registros | ${new Date(result[0][0]).toISOString().split('T')[0]} → ${new Date(result.at(-1)[0]).toISOString().split('T')[0]}`);
