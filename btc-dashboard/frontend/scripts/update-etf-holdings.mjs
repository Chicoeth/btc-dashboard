/**
 * update-etf-holdings.mjs — atualização diária do etf-holdings.json
 *
 * Fonte: bitbo.io/treasuries/us-etfs/ (scraping da tabela HTML)
 *
 * Formato de saída (array de arrays):
 *   [ts_ms, btc_price, total, avg_cost, mvrv, IBIT, FBTC, BITB, ARKB, BTCO, EZBC, BRRR, HODL, BTCW, GBTC, BTC]
 *   Índices: 0      1        2      3        4     5..15
 *
 * Custo médio e MVRV: calculados incrementalmente a partir do último registro existente.
 *   - Compara holdings de hoje vs ontem → delta = flow
 *   - Se flow > 0 (inflow): custo acumulado += flow × preço de hoje
 *   - Se flow < 0 (outflow): posição reduz, avg cost inalterado
 *
 * Uso: node scripts/update-etf-holdings.mjs
 */
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE  = path.join(__dirname, '..', 'public', 'data', 'etf-holdings.json');
const SOURCE_URL = 'https://bitbo.io/treasuries/us-etfs/';

const ETFS = ['IBIT','FBTC','BITB','ARKB','BTCO','EZBC','BRRR','HODL','BTCW','GBTC','BTC'];

const TICKER_MAP = {
  'IBIT': 'IBIT', 'FBTC': 'FBTC', 'BITB': 'BITB', 'ARKB': 'ARKB',
  'BTCO': 'BTCO', 'EZBC': 'EZBC', 'BRRR': 'BRRR', 'HODL': 'HODL',
  'BTCW': 'BTCW', 'GBTC': 'GBTC', 'BTC':  'BTC',
  'DEFI': null,
};

/* ── Buscar preço BTC via Yahoo Finance ── */
async function fetchBtcPrice() {
  const to   = Math.floor(Date.now() / 1000);
  const from = to - 2 * 24 * 60 * 60;
  const url  = `https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?period1=${from}&period2=${to}&interval=1d&events=history`;
  const res  = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status}`);
  const json   = await res.json();
  const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
  if (!closes?.length) throw new Error('Sem dados de preço');
  for (let i = closes.length - 1; i >= 0; i--) {
    if (closes[i] != null) return parseFloat(closes[i].toFixed(2));
  }
  throw new Error('Nenhum preço válido');
}

/* ── Scraping do Bitbo ── */
async function fetchEtfHoldings() {
  console.log('Buscando dados de ETF holdings em bitbo.io...');
  const res = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept':     'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) throw new Error(`bitbo.io HTTP ${res.status}`);
  const html = await res.text();
  console.log(`HTML recebido: ${(html.length / 1024).toFixed(0)} KB`);

  const holdings = {};
  const trRegex  = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const trContent = trMatch[1];
    const tdRegex   = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells     = [];
    let tdMatch;
    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
      cells.push(tdMatch[1].replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim());
    }
    if (cells.length < 5) continue;

    let ticker = null;
    for (const cell of cells) {
      const m = cell.match(/^([A-Z]{2,5}):(?:NASDAQ|NYSE|CBOE)$/);
      if (m) { ticker = TICKER_MAP[m[1]] ?? null; break; }
    }
    if (!ticker) continue;

    for (const cell of cells) {
      if (cell.startsWith('$') || cell.includes('%')) continue;
      const cleaned = cell.replace(/,/g, '');
      const num     = parseFloat(cleaned);
      if (!isNaN(num) && num > 10 && /^\d+(\.\d+)?$/.test(cleaned)) {
        holdings[ticker] = num;
        console.log(`  ${ticker}: ${num.toLocaleString()} BTC`);
        break;
      }
    }
  }

  if (Object.keys(holdings).length < 8) {
    throw new Error(`Poucos ETFs encontrados (${Object.keys(holdings).length}).`);
  }
  return holdings;
}

async function main() {
  /* 1. Carregar dados existentes */
  let existing = [];
  if (fs.existsSync(DATA_FILE)) {
    existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    console.log(`Dados existentes: ${existing.length} registros`);
  }

  /* 2. Buscar holdings atuais */
  let holdingsMap;
  try {
    holdingsMap = await fetchEtfHoldings();
  } catch (e) {
    console.error(`Erro ao buscar holdings: ${e.message}`);
    if (existing.length) { console.log('Mantendo dados existentes (fallback).'); process.exit(0); }
    process.exit(1);
  }

  /* 3. Buscar preço BTC */
  let btcPrice;
  try {
    btcPrice = await fetchBtcPrice();
    console.log(`Preço BTC: $${btcPrice.toLocaleString()}`);
  } catch (e) {
    console.error(`Erro ao buscar preço: ${e.message}`);
    if (existing.length) {
      btcPrice = existing.at(-1)[1];
      console.log(`Usando preço do último registro: $${btcPrice.toLocaleString()}`);
    } else { process.exit(1); }
  }

  /* 4. Calcular custo médio e MVRV incremental */
  const totalToday = ETFS.reduce((s, t) => s + (holdingsMap[t] || 0), 0);

  let avgCost, mvrv;

  if (existing.length) {
    const prev = existing.at(-1);
    // prev format: [ts, price, total, avgCost, mvrv, ...etfs]
    const prevTotal   = prev[2];
    const prevAvgCost = prev[3];
    const prevCumCost = prevAvgCost * prevTotal;
    const prevCumBtc  = prevTotal;

    const flow = totalToday - prevTotal;
    let cumCost = prevCumCost;
    let cumBtc  = prevCumBtc;

    if (flow > 0) {
      // Inflow: BTC comprado ao preço de hoje
      cumCost += flow * btcPrice;
      cumBtc  += flow;
    } else if (flow < 0) {
      // Outflow: posição reduz, avg cost inalterado
      cumBtc += flow;
      cumCost = Math.max(0, cumBtc) * prevAvgCost;
      if (cumBtc < 0) { cumBtc = 0; cumCost = 0; }
    }

    avgCost = cumBtc > 0 ? cumCost / cumBtc : btcPrice;
    mvrv    = avgCost > 0 ? btcPrice / avgCost : 1;
  } else {
    avgCost = btcPrice;
    mvrv    = 1;
  }

  /* 5. Montar registro */
  const today = new Date();
  const ts    = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  const row = [
    ts,
    btcPrice,
    parseFloat(totalToday.toFixed(2)),
    parseFloat(avgCost.toFixed(2)),
    parseFloat(mvrv.toFixed(4)),
  ];
  for (const etf of ETFS) row.push(holdingsMap[etf] || 0);

  /* 6. Merge */
  const dateKey = (ms) => new Date(ms).toISOString().split('T')[0];
  const byDate  = new Map(existing.map(r => [dateKey(r[0]), r]));
  byDate.set(dateKey(ts), row);

  const merged = [...byDate.values()].sort((a, b) => a[0] - b[0]);
  const added  = merged.length - existing.length;
  fs.writeFileSync(DATA_FILE, JSON.stringify(merged));

  console.log(`✓ ETF Holdings: ${added >= 0 ? '+' : ''}${added} registros | total: ${merged.length} | último: ${dateKey(merged.at(-1)[0])}`);
  console.log(`  Total BTC: ${totalToday.toLocaleString()} | Custo Médio: $${avgCost.toFixed(0)} | MVRV: ${mvrv.toFixed(3)}`);
}

main().catch(err => { console.error('Erro:', err.message); process.exit(1); });
