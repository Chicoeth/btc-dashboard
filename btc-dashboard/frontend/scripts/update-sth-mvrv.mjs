/**
 * update-sth-mvrv.mjs — atualização diária do sth-mvrv.json
 *
 * Fonte: CheckOnChain (dados embarcados no HTML do chart Plotly)
 * URL: https://charts.checkonchain.com/btconchain/unrealised/mvrv_momentum_sth/mvrv_momentum_sth_light.html
 *
 * O HTML contém um JSON Plotly com os traces:
 *   - trace 0: "BTC Price" (x: dates, y: prices)
 *   - trace 1: "STH-MVRV Ratio" (x: dates, y: mvrv values)
 *
 * O preço realizado STH é derivado: sth_realized_price = btc_price / sth_mvrv
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

  // Extrair o JSON do Plotly embutido no HTML
  // O padrão é: Plotly.newPlot("...", JSON_DATA, ...)
  // ou os dados podem estar em variáveis como: var data = [...]
  
  // Estratégia 1: procurar por Plotly.newPlot com dados inline
  let plotlyMatch = html.match(/Plotly\.newPlot\s*\(\s*["'][^"']+["']\s*,\s*(\[[\s\S]*?\])\s*,\s*\{/);
  
  if (!plotlyMatch) {
    // Estratégia 2: procurar por var data = [...] ou similar
    plotlyMatch = html.match(/var\s+(?:data|traces)\s*=\s*(\[[\s\S]*?\]);\s*(?:var|Plotly)/);
  }
  
  if (!plotlyMatch) {
    // Estratégia 3: procurar qualquer array grande com "BTC Price" ou "STH-MVRV"
    plotlyMatch = html.match(/(\[\s*\{[^]*?"name"\s*:\s*"BTC Price"[^]*?\}\s*\])/);
  }

  if (!plotlyMatch) {
    // Estratégia 4: extrair entre o primeiro [ depois de newPlot e o matching ]
    const newPlotIdx = html.indexOf('Plotly.newPlot');
    if (newPlotIdx === -1) throw new Error('Não encontrou Plotly.newPlot no HTML');
    
    const afterNewPlot = html.substring(newPlotIdx);
    const firstBracket = afterNewPlot.indexOf('[');
    if (firstBracket === -1) throw new Error('Não encontrou dados Plotly');
    
    // Encontrar o ] correspondente
    let depth = 0;
    let endIdx = -1;
    const searchStr = afterNewPlot.substring(firstBracket);
    for (let i = 0; i < searchStr.length; i++) {
      if (searchStr[i] === '[') depth++;
      else if (searchStr[i] === ']') { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    if (endIdx === -1) throw new Error('Não encontrou fim dos dados Plotly');
    
    const jsonStr = searchStr.substring(0, endIdx + 1);
    plotlyMatch = [null, jsonStr];
  }

  let traces;
  try {
    traces = JSON.parse(plotlyMatch[1]);
  } catch (e) {
    throw new Error(`Falha ao parsear JSON Plotly: ${e.message}`);
  }

  // Encontrar os traces de preço e STH-MVRV
  const priceTrace = traces.find(t => t.name && t.name.includes('BTC Price'));
  const mvrvTrace  = traces.find(t => t.name && t.name.includes('STH-MVRV'));

  if (!priceTrace || !mvrvTrace) {
    const names = traces.map(t => t.name).join(', ');
    throw new Error(`Traces não encontrados. Disponíveis: ${names}`);
  }

  console.log(`Traces encontrados: "${priceTrace.name}" (${priceTrace.x.length} pts), "${mvrvTrace.name}" (${mvrvTrace.x.length} pts)`);

  return { priceTrace, mvrvTrace };
}

function buildRecords(priceTrace, mvrvTrace) {
  // Criar mapa de datas → valores
  const priceMap = new Map();
  for (let i = 0; i < priceTrace.x.length; i++) {
    const date = priceTrace.x[i].substring(0, 10); // 'YYYY-MM-DD'
    priceMap.set(date, priceTrace.y[i]);
  }

  const mvrvMap = new Map();
  for (let i = 0; i < mvrvTrace.x.length; i++) {
    const date = mvrvTrace.x[i].substring(0, 10);
    mvrvMap.set(date, mvrvTrace.y[i]);
  }

  // Merge por data — só onde temos ambos
  const records = [];
  for (const [date, price] of priceMap) {
    const mvrv = mvrvMap.get(date);
    if (mvrv == null || isNaN(price) || isNaN(mvrv) || price <= 0 || mvrv <= 0) continue;

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

  const { priceTrace, mvrvTrace } = await fetchChartData();
  const freshRecords = buildRecords(priceTrace, mvrvTrace);
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
