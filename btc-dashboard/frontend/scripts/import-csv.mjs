/**
 * scripts/import-csv.mjs
 *
 * Importa dados históricos de um arquivo CSV e mescla com o btc-price.json existente.
 * Útil para adicionar dados pré-2014 que o Yahoo Finance não cobre.
 *
 * Uso: node scripts/import-csv.mjs caminho/para/arquivo.csv
 *
 * Formatos de CSV aceitos (detectados automaticamente):
 *   - Date, Open, High, Low, Close, Volume      (padrão Yahoo/CoinMarketCap)
 *   - date, open, high, low, close, volume       (minúsculas)
 *   - Date, Close                                (mínimo necessário)
 *   - Unix Timestamp, Date, Symbol, Open, High, Low, Close, Volume (Kraken)
 *   - Timestamp, Open, High, Low, Close          (genérico)
 *
 * O script detecta automaticamente as colunas relevantes.
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '../public/data/btc-price.json');

function parseDate(str) {
  if (!str) return null;
  // Tenta timestamp unix numérico
  if (/^\d{10}$/.test(str.trim())) return parseInt(str.trim()) * 1000;
  if (/^\d{13}$/.test(str.trim())) return parseInt(str.trim());
  // Tenta formatos de data
  const d = new Date(str.trim());
  return isNaN(d.getTime()) ? null : d.getTime();
}

function findCol(headers, ...candidates) {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseCsv(content) {
  const lines = content.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV vazio ou sem dados suficientes');

  // Detecta separador (vírgula ou ponto-e-vírgula)
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.replace(/"/g, '').trim());

  console.log(`   Colunas detectadas: ${headers.join(', ')}`);

  // Encontra colunas relevantes
  const dateCol  = findCol(headers, 'date', 'timestamp', 'unix timestamp', 'time');
  const closeCol = findCol(headers, 'close', 'close*', 'price', 'last');
  const highCol  = findCol(headers, 'high');

  if (dateCol === -1) throw new Error('Coluna de data não encontrada. Esperado: Date, Timestamp ou similar.');
  if (closeCol === -1) throw new Error('Coluna de preço não encontrada. Esperado: Close, Price ou similar.');

  console.log(`   Usando: data[${dateCol}]="${headers[dateCol]}", close[${closeCol}]="${headers[closeCol]}"${highCol !== -1 ? `, high[${highCol}]="${headers[highCol]}"` : ' (sem coluna high)'}`);

  const rows = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.replace(/"/g, '').trim());
    if (cols.length <= Math.max(dateCol, closeCol)) { skipped++; continue; }

    const ts    = parseDate(cols[dateCol]);
    const close = parseFloat(cols[closeCol].replace(/,/g, ''));
    const high  = highCol !== -1 ? parseFloat(cols[highCol].replace(/,/g, '')) : null;

    if (!ts || isNaN(close) || close <= 0) { skipped++; continue; }

    rows.push([
      ts,
      parseFloat(close.toFixed(2)),
      high && !isNaN(high) && high > 0 ? parseFloat(high.toFixed(2)) : parseFloat(close.toFixed(2)),
    ]);
  }

  if (skipped > 0) console.log(`   ${skipped} linhas ignoradas (inválidas ou sem dados).`);
  return rows;
}

async function main() {
  const csvPath = process.argv[2];

  if (!csvPath) {
    console.error('Uso: node scripts/import-csv.mjs caminho/para/arquivo.csv');
    process.exit(1);
  }

  const fullPath = path.resolve(csvPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`Arquivo não encontrado: ${fullPath}`);
    process.exit(1);
  }

  console.log(`\n📂 Importando CSV: ${path.basename(fullPath)}\n`);

  const content = fs.readFileSync(fullPath, 'utf-8');
  let csvData;
  try {
    csvData = parseCsv(content);
  } catch (err) {
    console.error(`   ✗ Erro ao ler CSV: ${err.message}`);
    process.exit(1);
  }

  console.log(`   ✓ ${csvData.length} registros lidos do CSV`);

  if (csvData.length === 0) {
    console.error('   Nenhum dado válido encontrado no CSV.');
    process.exit(1);
  }

  // Carrega dados existentes
  let existing = [];
  if (fs.existsSync(OUTPUT_PATH)) {
    existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
    console.log(`   ✓ ${existing.length} registros existentes no banco`);
  }

  // Mescla: dados existentes têm prioridade para datas que já existem
  // (o Yahoo Finance tem dados mais precisos para o período que ele cobre)
  const byDate = new Map();
  for (const row of csvData)  byDate.set(new Date(row[0]).toISOString().split('T')[0], row);
  for (const row of existing) byDate.set(new Date(row[0]).toISOString().split('T')[0], row); // existentes sobrescrevem

  const merged = Array.from(byDate.values()).sort((a, b) => a[0] - b[0]);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(merged), 'utf-8');

  const first = new Date(merged[0][0]).toISOString().split('T')[0];
  const last  = new Date(merged[merged.length - 1][0]).toISOString().split('T')[0];
  const added = merged.length - existing.length;

  console.log(`\n✅ Concluído!`);
  console.log(`   Total: ${merged.length} dias de dados`);
  console.log(`   Adicionados: ${added} novos registros`);
  console.log(`   Período: ${first} → ${last}`);
  console.log(`   Arquivo: public/data/btc-price.json\n`);
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
