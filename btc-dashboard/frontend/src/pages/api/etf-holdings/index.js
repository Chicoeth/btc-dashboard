import fs   from 'fs';
import path from 'path';

export default function handler(req, res) {
  const filePath = path.join(process.cwd(), 'public', 'data', 'etf-holdings.json');
  try {
    const raw  = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).json(data);
  } catch (err) {
    console.error('Erro ao ler etf-holdings.json:', err.message);
    res.status(500).json({ error: 'Dados não disponíveis' });
  }
}
