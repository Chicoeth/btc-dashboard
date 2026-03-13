/**
 * update-fng.mjs
 * Baixa os últimos 10 dias do alternative.me e faz merge no fng.json
 */
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'public', 'data', 'fng.json');

console.log('Buscando Fear & Greed Index...');
const response = await fetch('https://api.alternative.me/fng/?limit=10&format=json');
if (!response.ok) throw new Error(`alternative.me HTTP ${response.status}`);

const json = await response.json();
const raw  = json?.data;
if (!raw?.length) throw new Error('Sem dados do Fear & Greed');

let existing = [];
if (fs.existsSync(DATA_FILE)) {
  existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

const byDate = new Map();
for (const row of existing) byDate.set(new Date(row[0]).toISOString().split('T')[0], row);
for (const d   of raw) {
  const ts = parseInt(d.timestamp) * 1000;
  byDate.set(new Date(ts).toISOString().split('T')[0], [ts, parseInt(d.value), d.value_classification]);
}

const merged = Array.from(byDate.values()).sort((a, b) => a[0] - b[0]);
fs.writeFileSync(DATA_FILE, JSON.stringify(merged));

const added = merged.length - existing.length;
console.log(`✓ F&G: ${added} dias novos | total: ${merged.length} | último: ${new Date(merged.at(-1)[0]).toISOString().split('T')[0]}`);
