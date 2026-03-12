import fs   from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'public', 'data', 'fng.json');
const SECRET    = process.env.UPDATE_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (SECRET && req.headers['authorization'] !== `Bearer ${SECRET}`)
    return res.status(401).json({ error: 'Unauthorized' });

  try {
    const r    = await fetch('https://api.alternative.me/fng/?limit=10&format=json');
    const json = await r.json();
    const raw  = json?.data;
    if (!raw?.length) return res.status(200).json({ message: 'Sem dados', added: 0 });

    let existing = [];
    if (fs.existsSync(DATA_FILE)) existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

    const byDate = new Map();
    for (const row of existing) byDate.set(new Date(row[0]).toISOString().split('T')[0], row);
    for (const d   of raw)      byDate.set(new Date(parseInt(d.timestamp)*1000).toISOString().split('T')[0],
                                           [parseInt(d.timestamp)*1000, parseInt(d.value), d.value_classification]);

    const merged = Array.from(byDate.values()).sort((a, b) => a[0] - b[0]);
    fs.writeFileSync(DATA_FILE, JSON.stringify(merged), 'utf-8');

    return res.status(200).json({ message: 'Atualizado', total: merged.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
