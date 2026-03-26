import fs   from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'public', 'data', 'strategy.json');
let cache   = null;
let cacheAt = 0;
const TTL   = 5 * 60 * 1000;

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (cache && Date.now() - cacheAt < TTL) return res.status(200).json(cache);
  if (!fs.existsSync(DATA_FILE))
    return res.status(404).json({ error: 'strategy.json não encontrado.' });
  try {
    cache   = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    cacheAt = Date.now();
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json(cache);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
