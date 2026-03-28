/**
 * update-sth-mvrv.mjs — atualização diária do sth-mvrv.json
 *
 * Fonte: CheckOnChain (dados embarcados no HTML do chart Plotly)
 * URL: https://charts.checkonchain.com/btconchain/unrealised/mvrv_momentum_sth/mvrv_momentum_sth_light.html
 *
 * O HTML contém um JSON Plotly com os traces. Os valores numéricos (y)
 * estão codificados como base64 Float64 ({ dtype: "f8", bdata: "..." })
 * em vez de arrays JSON normais.
 *
 * Traces relevantes:
 *   - "Price" (x: dates, y: base64 float64 prices)
 *   - "STH-MVRV Ratio" (x: dates, y: base64 float64 mvrv values)
 *
 * Formato de saída: [ts_ms, btc_price_usd, sth_realized_price_usd, sth_mvrv]
 *
 * Uso: node scripts/update-sth-mvrv.mjs
 */
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE  = path.join(__dirname, '..', 'public', 'data', 'sth-mvrv.json');
const CHART_URL  = 'https://charts.checkonchain.com/btconchain/unrealised/mvrv_momentum_sth/mvrv_momentum_sth_light.html';

/**
 * Decode Plotly base64 typed array to regular JS array
 * Plotly stores numeric data as { dtype: "f8", bdata: "base64string" }
 * where "f8" = Float64 (8 bytes per value)
 */
function decodePlotlyArray(obj) {
  if (Array.isArray(obj)) return obj; // already a normal array
  if (!obj || !obj.bdata || !obj.dtype) {
    throw new Error(`Formato inesperado de dados Plotly: ${JSON.stringify(obj).substring(0, 100)}`);
  }

  const buf = Buffer.from(obj.bdata, 'base64');

  if (obj.dtype === 'f8') {
    // Float64 — 8 bytes per value
    const arr = new Float64Array(buf.buffer, buf.byteOffset, buf.length / 8);
    return Array.from(arr);
  } else if (obj.dtype === 'f4') {
    // Float32 — 4 bytes per value
    const arr = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
    return Array.from(arr);
  } else if (obj.dtype === 'i4') {
    // Int32 — 4 bytes per value
    const arr = new Int32Array(buf.buffer, buf.byteOffset, buf.length / 4);
    return Array.from(arr);
  } else {
    throw new Error(`dtype não suportado: ${obj.dtype}`);
  }
}

async function fetchChartData() {
  console.log('Buscando dados do CheckOnChain...');
  const res = await fetch(CHART_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
    },
  });
  if (!res.ok) throw new Error(`CheckOnChain HTTP ${res.status}`);
  const html = await res.text();
  console.log(`HTML recebido: ${(html.length / 1024).toFixed(0)} KB`);

  // Extrair o array de traces do Plotly.newPlot
  const newPlotIdx = html.indexOf('Plotly.newPlot');
  if (newPlotIdx === -1) throw new Error('Não encontrou Plotly.newPlot no HTML');

  const afterNewPlot = html.substring(newPlotIdx);
  const firstBracket = afterNewPlot.indexOf('[');
  if (firstBracket === -1) throw new Error('Não encontrou dados Plotly');

  // Bracket matching com suporte a strings JSON
  const searchStr = afterNewPlot.substring(firstBracket);
  let depth = 0;
  let endIdx = -1;
  let inString = false;
  let prevChar = '';

  for (let i = 0; i < searchStr.length; i++) {
    const ch = searchStr[i];
    if (ch === '"' && prevChar !== '\\') {
      inString = !inString;
    } else if (!inString) {
      if (ch === '[') depth++;
      else if (ch === ']') { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    prevChar = ch;
  }
  if (endIdx === -1) throw new Error('Não encontrou fim dos dados Plotly');

  const jsonStr = searchStr.substring(0, endIdx + 1);
  console.log(`JSON extraído: ${(jsonStr.length / 1024).toFixed(0)} KB`);

  let traces;
  try {
    traces = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Falha ao parsear JSON Plotly: ${e.message}`);
  }

  console.log(`${traces.length} traces encontrados: ${traces.map(t => t.name).join(', ')}`);

  // Encontrar os traces
  const priceTrace = traces.find(t => t.name && (t.name === 'Price' || t.name.includes('BTC Price')));
  const mvrvTrace  = traces.find(t => t.name && t.name.includes('STH-MVRV Ratio'));

  if (!priceTrace || !mvrvTrace) {
    const names = traces.map(t => t.name).join(', ');
    throw new Error(`Traces não encontrados. Disponíveis: ${names}`);
  }

  // Decodificar os valores Y de base64
  const priceY = decodePlotlyArray(priceTrace.y);
  const mvrvY  = decodePlotlyArray(mvrvTrace.y);

  console.log(`Traces decodificados: "${priceTrace.name}" (${priceY.length} pts), "${mvrvTrace.name}" (${mvrvY.length} pts)`);

  return {
    priceX: priceTrace.x, priceY,
    mvrvX:  mvrvTrace.x,  mvrvY,
  };
}

function buildRecords({ priceX, priceY, mvrvX, mvrvY }) {
  // Criar mapa de datas → valores
  const priceMap = new Map();
  for (let i = 0; i < priceX.length; i++) {
    if (priceY[i] == null || isNaN(priceY[i]) || priceY[i] <= 0) continue;
    const date = priceX[i].substring(0, 10); // 'YYYY-MM-DD'
    priceMap.set(date, priceY[i]);
  }

  const mvrvMap = new Map();
  for (let i = 0; i < mvrvX.length; i++) {
    if (mvrvY[i] == null || isNaN(mvrvY[i]) || mvrvY[i] <= 0) continue;
    const date = mvrvX[i].substring(0, 10);
    mvrvMap.set(date, mvrvY[i]);
  }

  console.log(`Datas com preço válido: ${priceMap.size}, com MVRV válido: ${mvrvMap.size}`);

  // Merge por data — só onde temos ambos
  const records = [];
  for (const [date, mvrv] of mvrvMap) {
    const price = priceMap.get(date);
    if (price == null) continue;

    const ts = new Date(date + 'T00:00:00Z').getTime();
    const realizedPrice = Math.round((price / mvrv) * 100) / 100;

    records.push([
      ts,
      Math.round(price * 100) / 100,
      realizedPrice,
      Math.round(mvrv * 1000000) / 1000000,
    ]);
  }

  records.sort((a, b) => a[0] - b[0]);
  return records;
}

async function main() {
  let existing = [];
  if (fs.existsSync(DATA_FILE)) {
    existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    console.log(`Dados existentes: ${existing.length} registros`);
    console.log(`Último registro: ${new Date(existing[existing.length - 1][0]).toISOString().split('T')[0]}`);
  }

  const chartData = await fetchChartData();
  const freshRecords = buildRecords(chartData);
  console.log(`Registros parseados: ${freshRecords.length}`);

  if (!freshRecords.length) {
    console.log('Nenhum dado novo parseado.');
    return;
  }

  // Merge: dados novos sobrescrevem existentes por timestamp
  const map = new Map(existing.map(r => [r[0], r]));
  let newCount = 0;
  for (const r of freshRecords) {
    if (!map.has(r[0])) newCount++;
    map.set(r[0], r);
  }
  const merged = [...map.values()].sort((a, b) => a[0] - b[0]);

  fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 0));
  console.log(`Salvo: ${merged.length} total (${newCount} novos)`);
  console.log(`Último registro: ${new Date(merged[merged.length - 1][0]).toISOString().split('T')[0]}`);
}

main().catch(err => { console.error('Erro:', err.message); process.exit(1); });
