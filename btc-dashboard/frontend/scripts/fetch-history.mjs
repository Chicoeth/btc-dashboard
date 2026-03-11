/**
 * scripts/fetch-history.mjs
 *
 * Baixa o histórico completo de preços do BTC usando Yahoo Finance
 * e mescla com os dados do seed CSV (2012-2014) incluído no projeto.
 *
 * Uso: node scripts/fetch-history.mjs
 * Formato salvo: [[timestamp_ms, close, high], ...]
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '../public/data/btc-price.json');
const SEED_PATH   = path.join(__dirname, '../public/data/btc-price-seed.json');

const SYMBOL   = 'BTC-USD';
const START_TS = 1279324800; // 17 Jul 2010 (Yahoo)

async function fetchYahoo(symbol, from, to) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${from}&period2=${to}&interval=1d&events=history`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });

  if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status}: ${await res.text()}`);

  const json   = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('Resposta inesperada do Yahoo Finance');

  const timestamps = result.timestamp;
  const quote  = result.indicators?.quote?.[0];
  const closes = quote?.close;
  const highs  = quote?.high;

  if (!timestamps || !closes) throw new Error('Dados ausentes na resposta');

  // Formato: [timestamp_ms, close, high]
  const data = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] != null) {
      data.push([
        timestamps[i] * 1000,
        parseFloat(closes[i].toFixed(2)),
        highs?.[i] != null ? parseFloat(highs[i].toFixed(2)) : parseFloat(closes[i].toFixed(2)),
      ]);
    }
  }
  return data;
}

async function main() {
  console.log('📥 Baixando histórico do BTC via Yahoo Finance...\n');

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

  // 1. Começa com o seed CSV (2012-2014) se disponível
  let seedData = [];
  if (fs.existsSync(SEED_PATH)) {
    seedData = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
    console.log(`   ✓ Seed CSV carregado: ${seedData.length} registros (2012–2014)`);
  }

  // 2. Verifica dados já existentes para sync incremental
  let existingData = [];
  let startFrom    = START_TS;

  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      existingData = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
      if (existingData.length > 0) {
        const lastTs = existingData[existingData.length - 1][0];
        startFrom    = Math.floor(lastTs / 1000) - (3 * 24 * 60 * 60);
        console.log(`   ✓ Dados existentes: ${existingData.length} registros`);
        console.log(`   Atualizando a partir de ${new Date(lastTs).toISOString().split('T')[0]}...\n`);
      }
    } catch (e) {
      console.log('   Arquivo existente inválido, recomeçando.\n');
    }
  }

  // 3. Busca Yahoo Finance
  const endTs = Math.floor(Date.now() / 1000);
  console.log(`   Período Yahoo: ${new Date(startFrom * 1000).toISOString().split('T')[0]} → hoje`);

  let yahooData;
  try {
    yahooData = await fetchYahoo(SYMBOL, startFrom, endTs);
    console.log(`   ✓ ${yahooData.length} registros recebidos do Yahoo Finance`);
  } catch (err) {
    console.error(`   ✗ Erro Yahoo Finance: ${err.message}`);
    process.exit(1);
  }

  // 4. Mescla: seed → existentes → yahoo (cada camada sobrescreve a anterior)
  // Yahoo tem prioridade pois possui o campo high real
  const byDate = new Map();
  for (const row of seedData)     byDate.set(new Date(row[0]).toISOString().split('T')[0], row);
  for (const row of existingData) byDate.set(new Date(row[0]).toISOString().split('T')[0], row);
  for (const row of yahooData)    byDate.set(new Date(row[0]).toISOString().split('T')[0], row);

  const merged = Array.from(byDate.values()).sort((a, b) => a[0] - b[0]);

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(merged), 'utf-8');

  const first = new Date(merged[0][0]).toISOString().split('T')[0];
  const last  = new Date(merged[merged.length - 1][0]).toISOString().split('T')[0];

  console.log('\n✅ Concluído!');
  console.log(`   ${merged.length} dias de dados salvos`);
  console.log(`   Período: ${first} → ${last}`);
  console.log('   Arquivo: public/data/btc-price.json');
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
