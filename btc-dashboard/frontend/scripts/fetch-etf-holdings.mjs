/**
 * fetch-etf-holdings.mjs — conversão do arquivo ETF_data.txt para etf-holdings.json
 *
 * Rodar UMA VEZ para gerar o JSON histórico a partir do arquivo fornecido.
 *
 * Formato de entrada (ETF_data.txt): JSON com chave 'csv' contendo CSV com colunas:
 *   date, btc_price_usd, *_daily_flow_btc, *_holdings_btc, total_holdings_btc, total_daily_flow_usd_mln
 *
 * Formato de saída (etf-holdings.json): array de arrays:
 *   [ts_ms, btc_price, total, IBIT, FBTC, BITB, ARKB, BTCO, EZBC, BRRR, HODL, BTCW, GBTC, BTC]
 *
 * Uso: node scripts/fetch-etf-holdings.mjs
 *   (colocar ETF_data.txt na mesma pasta de scripts/ ou ajustar INPUT_FILE)
 */
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const INPUT_FILE  = path.join(__dirname, 'ETF_data.txt');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'data', 'etf-holdings.json');

const ETFS = ['IBIT','FBTC','BITB','ARKB','BTCO','EZBC','BRRR','HODL','BTCW','GBTC','BTC'];

// Ler e parsear o arquivo (é um dict Python com aspas simples)
const raw = fs.readFileSync(INPUT_FILE, 'utf-8');

// Extrair o CSV de dentro do objeto — pegar tudo entre 'csv': '...' e a próxima chave
const csvMatch = raw.match(/'csv':\s*'([\s\S]*?)'\s*,\s*'rows'/);
if (!csvMatch) throw new Error('Não consegui extrair CSV do arquivo');

const csvText = csvMatch[1];
const lines   = csvText.trim().split('\\n');
const header  = lines[0].split(',');

console.log(`Colunas: ${header.length}`);
console.log(`Linhas de dados: ${lines.length - 1}`);

const result = [];

for (let i = 1; i < lines.length; i++) {
  const vals = lines[i].split(',');
  const dateStr = vals[0]; // 'YYYY-MM-DD'

  // Converter para timestamp ms (UTC midnight)
  const [y, m, d] = dateStr.split('-').map(Number);
  const ts = Date.UTC(y, m - 1, d);

  const btcPrice = parseFloat(vals[header.indexOf('btc_price_usd')]);
  const total    = parseFloat(vals[header.indexOf('total_holdings_btc')]);

  const row = [ts, btcPrice, total];
  for (const etf of ETFS) {
    row.push(parseFloat(vals[header.indexOf(`${etf}_holdings_btc`)]));
  }

  result.push(row);
}

// Ordenar por timestamp
result.sort((a, b) => a[0] - b[0]);

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result));

const first = new Date(result[0][0]).toISOString().split('T')[0];
const last  = new Date(result.at(-1)[0]).toISOString().split('T')[0];
console.log(`✓ ETF Holdings: ${result.length} registros | ${first} → ${last}`);
console.log(`  Último total: ${result.at(-1)[2].toLocaleString()} BTC`);
console.log(`  Arquivo: ${OUTPUT_FILE}`);
