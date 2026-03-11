/**
 * pages/api/price/update.js
 * Atualiza o arquivo de preços com os dados mais recentes do Yahoo Finance.
 * Chamado automaticamente pelo Vercel Cron às 02:00 UTC.
 * Formato: [[timestamp_ms, close, high], ...]
 */

import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'public', 'data', 'btc-price.json');
const SECRET = process.env.UPDATE_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (SECRET) {
    const auth = req.headers['authorization'];
    if (!auth || auth !== `Bearer ${SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const to   = Math.floor(Date.now() / 1000);
    const from = to - (5 * 24 * 60 * 60);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?period1=${from}&period2=${to}&interval=1d&events=history`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) throw new Error(`Yahoo Finance HTTP ${response.status}`);

    const json   = await response.json();
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error('Resposta inesperada do Yahoo Finance');

    const timestamps = result.timestamp;
    const quote  = result.indicators?.quote?.[0];
    const closes = quote?.close;
    const highs  = quote?.high;

    // Formato: [timestamp_ms, close, high]
    const newPrices = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] != null) {
        newPrices.push([
          timestamps[i] * 1000,
          parseFloat(closes[i].toFixed(2)),
          highs?.[i] != null ? parseFloat(highs[i].toFixed(2)) : parseFloat(closes[i].toFixed(2)),
        ]);
      }
    }

    if (newPrices.length === 0) {
      return res.status(200).json({ message: 'Sem dados novos', added: 0 });
    }

    let existing = [];
    if (fs.existsSync(DATA_FILE)) {
      existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }

    // Mescla: novos dados sobrescrevem por data (garantem high atualizado)
    const byDate = new Map();
    for (const row of existing)   byDate.set(new Date(row[0]).toISOString().split('T')[0], row);
    for (const row of newPrices)  byDate.set(new Date(row[0]).toISOString().split('T')[0], row);

    const merged = Array.from(byDate.values()).sort((a, b) => a[0] - b[0]);
    fs.writeFileSync(DATA_FILE, JSON.stringify(merged), 'utf-8');

    const added   = newPrices.filter(([ts]) => {
      const d = new Date(ts).toISOString().split('T')[0];
      return !existing.some(r => new Date(r[0]).toISOString().split('T')[0] === d);
    }).length;

    return res.status(200).json({
      message: 'Atualizado com sucesso',
      added,
      total: merged.length,
      lastDate: new Date(merged[merged.length - 1][0]).toISOString().split('T')[0],
    });

  } catch (err) {
    console.error('[price/update] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
