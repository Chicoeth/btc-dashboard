/**
 * pages/api/price/index.js
 *
 * Serve os dados de preço para o frontend.
 * Lê o arquivo public/data/btc-price.json e retorna o histórico.
 *
 * GET /api/price
 * GET /api/price?from=2020-01-01&to=2024-12-31
 */

import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'public', 'data', 'btc-price.json');

// Cache em memória para não ler o arquivo a cada request
let cachedData = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function loadData() {
  const now = Date.now();
  if (cachedData && now - cacheTime < CACHE_TTL) return cachedData;

  if (!fs.existsSync(DATA_FILE)) {
    return null;
  }

  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  cachedData = JSON.parse(raw);
  cacheTime = now;
  return cachedData;
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const data = loadData();

  if (!data) {
    return res.status(404).json({
      error: 'Dados não encontrados. Execute: node scripts/fetch-history.mjs',
    });
  }

  const { from, to } = req.query;
  let result = data;

  if (from) {
    const fromTs = new Date(from).getTime();
    result = result.filter(([ts]) => ts >= fromTs);
  }
  if (to) {
    const toTs = new Date(to).getTime();
    result = result.filter(([ts]) => ts <= toTs);
  }

  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).json({
    data: result,
    count: result.length,
    range: result.length > 0 ? {
      first: new Date(result[0][0]).toISOString().split('T')[0],
      last: new Date(result[result.length - 1][0]).toISOString().split('T')[0],
    } : null,
  });
}
