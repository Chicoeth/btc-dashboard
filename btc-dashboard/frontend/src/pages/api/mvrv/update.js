/**
 * Cron job: GET /api/mvrv/update
 * Tenta múltiplas fontes gratuitas para obter PriceUSD + CapRealUSD do BTC
 * Estratégia:
 *   1. Bitbo cache API (pública, sem auth)
 *   2. CoinMetrics com api_key no env (se configurada)
 *   3. Fallback: apenas atualiza preço via Yahoo Finance + mantém realized price anterior
 */
import fs   from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'public', 'data', 'mvrv.json');

// --- Fonte 1: Bitbo ---
async function fetchBitbo(startDate) {
  // Bitbo expõe MVRV como JSON público
  const url = `https://cache.bitbo.io/mvrv/`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`Bitbo ${res.status}`);
  const json = await res.json();
  // Formato esperado: { price: [[ts, val], ...], mvrv: [[ts, val], ...], realized: [[ts, val], ...] }
  // ou similar — adaptar conforme resposta real
  return json;
}

// --- Fonte 2: CoinMetrics com api_key ---
async function fetchCoinMetrics(startDate, apiKey) {
  const url = `https://api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD,CapMrktCurUSD,CapRealUSD&frequency=1d&start_time=${startDate}&page_size=100&api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinMetrics ${res.status}`);
  const json = await res.json();
  const rows = json.data ?? [];
  return rows.map(row => {
    const price   = parseFloat(row.PriceUSD);
    const capMkt  = parseFloat(row.CapMrktCurUSD);
    const capReal = parseFloat(row.CapRealUSD);
    if (!price || !capReal) return null;
    const supply        = capMkt / price;
    const realizedPrice = capReal / supply;
    const mvrv          = capMkt / capReal;
    return [
      new Date(row.time).getTime(),
      Math.round(price * 100) / 100,
      Math.round(realizedPrice * 100) / 100,
      Math.round(mvrv * 1000000) / 1000000,
    ];
  }).filter(Boolean);
}

// --- Fonte 3: Yahoo Finance (só preço, mantém realized do último registro) ---
async function fetchYahooOnly(existing) {
  const lastRec = existing[existing.length - 1];
  if (!lastRec) return [];
  const lastRealized = lastRec[2];

  const end   = Math.floor(Date.now() / 1000);
  const start = Math.floor((lastRec[0] + 86400000) / 1000);
  const url   = `https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?interval=1d&period1=${start}&period2=${end}`;
  const res   = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const json    = await res.json();
  const result  = json.chart?.result?.[0];
  if (!result) return [];
  const ts     = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];

  // Usa realized price do último registro — impreciso mas mantém gráfico funcional
  return ts.map((t, i) => {
    const price = closes[i];
    if (!price) return null;
    // Realized price cresce lentamente — interpolação linear simples como fallback
    const mvrv = price / lastRealized;
    return [
      t * 1000,
      Math.round(price * 100) / 100,
      Math.round(lastRealized * 100) / 100,
      Math.round(mvrv * 1000000) / 1000000,
    ];
  }).filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const errors = [];

  try {
    let existing = [];
    if (fs.existsSync(DATA_FILE)) {
      existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
    const lastTs   = existing.length ? existing[existing.length - 1][0] : 0;
    const lastDate = lastTs
      ? new Date(lastTs + 86400000).toISOString().split('T')[0]
      : '2013-01-01';

    let newRecords = null;

    // Tenta CoinMetrics com api_key do env (se configurada no Vercel)
    const cmKey = process.env.COINMETRICS_API_KEY;
    if (cmKey) {
      try {
        newRecords = await fetchCoinMetrics(lastDate, cmKey);
        if (newRecords.length) console.log(`CoinMetrics: ${newRecords.length} rows`);
      } catch (e) { errors.push(`CoinMetrics: ${e.message}`); }
    }

    // Fallback: Yahoo Finance (só preço, realized price estático)
    if (!newRecords?.length) {
      try {
        newRecords = await fetchYahooOnly(existing);
        console.log(`Yahoo fallback: ${newRecords.length} rows`);
      } catch (e) { errors.push(`Yahoo: ${e.message}`); }
    }

    if (!newRecords?.length) {
      return res.status(200).json({ message: 'No new data or all sources failed', errors });
    }

    const map = new Map(existing.map(r => [r[0], r]));
    for (const r of newRecords) map.set(r[0], r);
    const merged = [...map.values()].sort((a, b) => a[0] - b[0]);
    fs.writeFileSync(DATA_FILE, JSON.stringify(merged));

    return res.status(200).json({
      added: merged.length - existing.length,
      total: merged.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message, errors });
  }
}
