/**
 * pages/api/price/update.js
 *
 * Atualiza o arquivo de preços com o dado mais recente da CoinGecko.
 * Deve ser chamado uma vez por dia (via cron job externo, ou Vercel Cron).
 *
 * POST /api/price/update
 * Header: Authorization: Bearer <UPDATE_SECRET>
 *
 * Configure a variável de ambiente UPDATE_SECRET no Vercel para proteger o endpoint.
 * Configure um cron job para chamar este endpoint diariamente (ex: cron-job.org — gratuito).
 */

import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'public', 'data', 'btc-price.json');
const SECRET = process.env.UPDATE_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Proteção simples com secret
  if (SECRET) {
    const auth = req.headers['authorization'];
    if (!auth || auth !== `Bearer ${SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    // Busca os últimos 5 dias do Yahoo Finance para garantir que temos o mais recente
    const to = Math.floor(Date.now() / 1000);
    const from = to - (5 * 24 * 60 * 60);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?period1=${from}&period2=${to}&interval=1d&events=history`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance HTTP ${response.status}`);
    }

    const json = await response.json();
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error('Resposta inesperada do Yahoo Finance');

    const timestamps = result.timestamp;
    const closes = result.indicators?.quote?.[0]?.close;

    const newPrices = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] != null) {
        newPrices.push([timestamps[i] * 1000, parseFloat(closes[i].toFixed(2))]);
      }
    }

    if (!newPrices || newPrices.length === 0) {
      return res.status(200).json({ message: 'No new data from CoinGecko', added: 0 });
    }

    // Load existing data
    let existing = [];
    if (fs.existsSync(DATA_FILE)) {
      existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }

    // Get last known date to avoid duplicates
    const existingDates = new Set(
      existing.map(([ts]) => new Date(ts).toISOString().split('T')[0])
    );

    // Only add truly new dates
    const toAdd = newPrices.filter(([ts]) => {
      const dateStr = new Date(ts).toISOString().split('T')[0];
      return !existingDates.has(dateStr);
    });

    if (toAdd.length === 0) {
      return res.status(200).json({ message: 'Already up to date', added: 0 });
    }

    const merged = [...existing, ...toAdd];
    merged.sort((a, b) => a[0] - b[0]);

    fs.writeFileSync(DATA_FILE, JSON.stringify(merged), 'utf-8');

    const lastDate = new Date(merged[merged.length - 1][0]).toISOString().split('T')[0];
    return res.status(200).json({
      message: 'Updated successfully',
      added: toAdd.length,
      total: merged.length,
      lastDate,
    });

  } catch (err) {
    console.error('[price/update] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
