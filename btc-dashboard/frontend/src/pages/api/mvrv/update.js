/**
 * Cron job: GET /api/mvrv/update
 * Chamado diariamente às 04:00 UTC pelo Vercel Cron
 * Busca dados novos da CoinMetrics e atualiza mvrv.json
 */
import fs   from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'public', 'data', 'mvrv.json');
const API_BASE  = 'https://community-api.coinmetrics.io/v4';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    let existing = [];
    if (fs.existsSync(DATA_FILE)) {
      existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }

    const lastTs   = existing.length ? existing[existing.length - 1][0] : 0;
    const lastDate = lastTs
      ? new Date(lastTs + 86400000).toISOString().split('T')[0]
      : '2013-01-01';

    const url = `${API_BASE}/timeseries/asset-metrics?assets=btc&metrics=PriceUSD,CapMrktCurUSD,CapRealUSD&frequency=1d&start_time=${lastDate}&page_size=100`;
    const apiRes = await fetch(url);
    if (!apiRes.ok) throw new Error(`CoinMetrics ${apiRes.status}`);
    const json = await apiRes.json();
    const rows = json.data ?? [];

    if (!rows.length) return res.status(200).json({ message: 'No new data', count: existing.length });

    const newRecords = [];
    for (const row of rows) {
      const price   = parseFloat(row.PriceUSD);
      const capMkt  = parseFloat(row.CapMrktCurUSD);
      const capReal = parseFloat(row.CapRealUSD);
      if (!price || !capReal || isNaN(price) || isNaN(capReal)) continue;
      const realizedPrice = capReal / (capMkt / price);
      const mvrv          = capMkt / capReal;
      newRecords.push([
        new Date(row.time).getTime(),
        Math.round(price * 100) / 100,
        Math.round(realizedPrice * 100) / 100,
        Math.round(mvrv * 1000000) / 1000000,
      ]);
    }

    const map = new Map(existing.map(r => [r[0], r]));
    for (const r of newRecords) map.set(r[0], r);
    const merged = [...map.values()].sort((a, b) => a[0] - b[0]);

    fs.writeFileSync(DATA_FILE, JSON.stringify(merged));
    return res.status(200).json({ added: merged.length - existing.length, total: merged.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
