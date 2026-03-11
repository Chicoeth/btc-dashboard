/**
 * scripts/fetch-history.mjs
 *
 * Baixa o histórico completo de preços do BTC usando Yahoo Finance.
 * Sem API key, sem limites de histórico — dados desde 2010.
 *
 * Uso: node scripts/fetch-history.mjs
 *
 * Rode UMA VEZ para gerar o arquivo base.
 * Depois, a API Route /api/price/update cuida das atualizações diárias.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '../public/data/btc-price.json');

const SYMBOL = 'BTC-USD';
const START_TS = 1279324800; // 17 Jul 2010 — primeiros dados do BTC no Yahoo

async function fetchYahoo(symbol, from, to) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${from}&period2=${to}&interval=1d&events=history`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });

  if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status}: ${await res.text()}`);

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('Resposta inesperada do Yahoo Finance');

  const timestamps = result.timestamp;
  const closes = result.indicators?.quote?.[0]?.close;

  if (!timestamps || !closes) throw new Error('Dados ausentes na resposta');

  const data = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] != null) {
      data.push([timestamps[i] * 1000, parseFloat(closes[i].toFixed(2))]);
    }
  }
  return data;
}

async function main() {
  console.log('📥 Baixando histórico completo do BTC via Yahoo Finance...\n');

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

  let existingData = [];
  let startFrom = START_TS;

  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      existingData = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
      if (existingData.length > 0) {
        const lastTs = existingData[existingData.length - 1][0];
        startFrom = Math.floor(lastTs / 1000) - (3 * 24 * 60 * 60);
        console.log(`   Arquivo existente: ${existingData.length} registros.`);
        console.log(`   Buscando a partir de ${new Date(lastTs).toISOString().split('T')[0]}...\n`);
      }
    } catch (e) {
      console.log('   Arquivo existente inválido, começando do zero.\n');
      existingData = [];
    }
  }

  const endTs = Math.floor(Date.now() / 1000);

  console.log(`   Período: ${new Date(startFrom * 1000).toISOString().split('T')[0]} → hoje`);
  console.log('   Buscando dados...\n');

  let newData;
  try {
    newData = await fetchYahoo(SYMBOL, startFrom, endTs);
    console.log(`   ✓ ${newData.length} registros recebidos`);
  } catch (err) {
    console.error(`   ✗ Erro: ${err.message}`);
    process.exit(1);
  }

  const merged = [...existingData, ...newData];
  const seen = new Set();
  const deduped = merged.filter(([ts]) => {
    const dateStr = new Date(ts).toISOString().split('T')[0];
    if (seen.has(dateStr)) return false;
    seen.add(dateStr);
    return true;
  });

  deduped.sort((a, b) => a[0] - b[0]);

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(deduped), 'utf-8');

  const first = new Date(deduped[0][0]).toISOString().split('T')[0];
  const last  = new Date(deduped[deduped.length - 1][0]).toISOString().split('T')[0];

  console.log(`\n✅ Concluído!`);
  console.log(`   ${deduped.length} dias de dados salvos`);
  console.log(`   Período: ${first} → ${last}`);
  console.log(`   Arquivo: public/data/btc-price.json`);
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
