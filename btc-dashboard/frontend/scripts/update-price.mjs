/**
 * update-price.mjs
 * Baixa os últimos 5 dias do Yahoo Finance e faz merge no btc-price.json
 * Roda localmente via GitHub Actions — escreve direto no arquivo do repo
 */
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'public', 'data', 'btc-price.json');

const to   = Math.floor(Date.now() / 1000);
const from = to - (7 * 24 * 60 * 60); // últimos 7 dias para garantir

const url = `https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?period1=${from}&period2=${to}&interval=1d&events=history`;

console.log('Buscando preços do Yahoo Finance...');
const response = await fetch(url, {
  headers: { 'User-Agent': 'Mozilla/5.0' },
});

if (!response.ok) throw new Error(`Yahoo Finance HTTP ${response.status}`);

const json   = await response.json();
const result = json?.chart?.result?.[0];
if (!result) throw new Error('Resposta inesperada do Yahoo Finance');

const timestamps = result.timestamp;
const quote      = result.indicators?.quote?.[0];
const closes     = quote?.close;
const highs      = quote?.high;

const newRows = [];
for (let i = 0; i < timestamps.length; i++) {
  if (closes[i] != null) {
    newRows.push([
      timestamps[i] * 1000,
      parseFloat(closes[i].toFixed(2)),
      highs?.[i] != null ? parseFloat(highs[i].toFixed(2)) : parseFloat(closes[i].toFixed(2)),
    ]);
  }
}

let existing = [];
if (fs.existsSync(DATA_FILE)) {
  existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

const byDate = new Map();
for (const row of existing) byDate.set(new Date(row[0]).toISOString().split('T')[0], row);
for (const row of newRows)  byDate.set(new Date(row[0]).toISOString().split('T')[0], row);

const merged = Array.from(byDate.values()).sort((a, b) => a[0] - b[0]);
fs.writeFileSync(DATA_FILE, JSON.stringify(merged));

const added = merged.length - existing.length;
console.log(`✓ Preço: ${added} dias novos | total: ${merged.length} | último: ${new Date(merged.at(-1)[0]).toISOString().split('T')[0]}`);
