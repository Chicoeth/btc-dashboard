/**
 * scripts/fetch-fng.mjs
 * Baixa o histórico completo do Fear & Greed Index via alternative.me API.
 * Uso: node scripts/fetch-fng.mjs
 * Formato salvo: [[timestamp_ms, value, value_classification], ...]
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '../public/data/fng.json');

async function main() {
  console.log('📥 Baixando Fear & Greed Index (histórico completo)...\n');

  const url = 'https://api.alternative.me/fng/?limit=0&format=json&date_format=us';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const raw  = json?.data;
  if (!raw || raw.length === 0) throw new Error('Sem dados na resposta');

  console.log(`   ✓ ${raw.length} registros recebidos`);

  // Formato: [timestamp_ms, value, classification]
  const data = raw
    .map(d => [parseInt(d.timestamp) * 1000, parseInt(d.value), d.value_classification])
    .sort((a, b) => a[0] - b[0]);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data), 'utf-8');

  const first = new Date(data[0][0]).toISOString().split('T')[0];
  const last  = new Date(data[data.length - 1][0]).toISOString().split('T')[0];

  console.log('\n✅ Concluído!');
  console.log(`   ${data.length} dias salvos`);
  console.log(`   Período: ${first} → ${last}`);
  console.log('   Arquivo: public/data/fng.json');
}

main().catch(err => { console.error('Erro:', err.message); process.exit(1); });
