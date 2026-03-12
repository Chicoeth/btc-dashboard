import fs   from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'public', 'data', 'fng.json');
let cache = null;
let cacheAt = 0;
const TTL = 5 * 60 * 1000;

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (cache && Date.now() - cacheAt < TTL) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(cache);
  }
  if (!fs.existsSync(DATA_FILE)) {
    return res.status(404).json({ error: 'fng.json não encontrado. Execute: node scripts/fetch-fng.mjs' });
  }
  cache   = fs.readFileSync(DATA_FILE, 'utf-8');
  cacheAt = Date.now();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).send(cache);
}
