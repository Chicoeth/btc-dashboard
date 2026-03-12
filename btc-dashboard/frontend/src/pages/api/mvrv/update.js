/**
 * GET /api/mvrv/update  — chamado pelo Vercel Cron às 04:00 UTC
 *
 * Fonte: CoinMetrics Community API (gratuita, sem auth)
 * Métricas:
 *   PriceUSD    = preço de mercado do BTC
 *   CapMVRVCur  = MVRV ratio (direto, sem auth)
 * Derivado:
 *   realized_price = PriceUSD / CapMVRVCur
 */
import fs   from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'public', 'data', 'mvrv.json');
const API_BASE  = 'https://community-api.coinmetrics.io/v4';

async function fetchCoinMetrics(startDate) {
  const url = `${API_BASE}/timeseries/asset-metrics` +
    `?assets=btc&metrics=PriceUSD,CapMVRVCur&frequency=1d` +
    `&start_time=${startDate}&page_size=1000`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CoinMetrics ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    // Carrega dados existentes
    let existing = [];
    if (fs.existsSync(DATA_FILE)) {
      existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }

    const lastTs   = existing.length ? existing[existing.length - 1][0] : 0;
    // Pede a partir do dia seguinte ao último registro
    const lastDate = lastTs
      ? new Date(lastTs + 86400000).toISOString().split('T')[0]
      : '2013-01-01';

    const json = await fetchCoinMetrics(lastDate);
    const rows = json.data ?? [];

    if (!rows.length) {
      return res.status(200).json({ message: 'Sem dados novos', total: existing.length });
    }

    const newRecords = [];
    for (const row of rows) {
      const price = parseFloat(row.PriceUSD);
      const mvrv  = parseFloat(row.CapMVRVCur);
      if (!price || !mvrv || isNaN(price) || isNaN(mvrv)) continue;
      const realizedPrice = price / mvrv;
      newRecords.push([
        new Date(row.time).getTime(),
        Math.round(price * 100) / 100,
        Math.round(realizedPrice * 100) / 100,
        Math.round(mvrv * 1000000) / 1000000,
      ]);
    }

    // Merge sem duplicatas
    const map = new Map(existing.map(r => [r[0], r]));
    for (const r of newRecords) map.set(r[0], r);
    const merged = [...map.values()].sort((a, b) => a[0] - b[0]);

    fs.writeFileSync(DATA_FILE, JSON.stringify(merged));
    return res.status(200).json({
      added: merged.length - existing.length,
      total: merged.length,
      last:  new Date(merged[merged.length - 1][0]).toISOString().split('T')[0],
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
