/**
 * update-strategy.mjs — atualização diária do strategy.json
 *
 * Fonte: bitcointreasuries.net/public-companies/strategy
 * Método: scraping da tabela HTML (não há API pública)
 *
 * A tabela tem 5 colunas:
 *   Date | Balance | Change | Total Cost Basis | Cost Basis per BTC
 *
 * Formato de saída: [ts_ms, btc_holdings, cost_basis_per_btc]
 *
 * Uso: node scripts/update-strategy.mjs
 */
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE  = path.join(__dirname, '..', 'public', 'data', 'strategy.json');
const SOURCE_URL = 'https://bitcointreasuries.net/public-companies/strategy';

async function fetchStrategyData() {
  console.log('Buscando dados da Strategy em bitcointreasuries.net...');

  const res = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!res.ok) throw new Error(`bitcointreasuries.net HTTP ${res.status}`);
  const html = await res.text();
  console.log(`HTML recebido: ${(html.length / 1024).toFixed(0)} KB`);

  // Extrair linhas da tabela
  // Padrão: cada <tr> tem <td> com Date, Balance, Change, Total Cost Basis, Cost Basis per BTC
  const rows = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const trContent = trMatch[1];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let tdMatch;

    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
      // Remover tags HTML internas e limpar whitespace
      const text = tdMatch[1].replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
      cells.push(text);
    }

    // Precisamos de pelo menos 5 colunas e a primeira deve parecer uma data
    if (cells.length >= 5 && /\d{4}/.test(cells[0])) {
      rows.push(cells);
    }
  }

  if (!rows.length) {
    throw new Error('Nenhuma linha de dados encontrada na tabela. O HTML pode ter mudado de formato.');
  }

  console.log(`Encontradas ${rows.length} linhas na tabela`);

  const records = [];
  for (const cells of rows) {
    try {
      // Coluna 0: Date (vários formatos possíveis)
      const dateStr = cells[0].trim();
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) continue;
      const ts = date.getTime();

      // Coluna 1: Balance (BTC holdings) — remover vírgulas e espaços
      const holdings = parseInt(cells[1].replace(/[,\s]/g, ''), 10);
      if (isNaN(holdings) || holdings <= 0) continue;

      // Coluna 4: Cost Basis per BTC — remover $, vírgulas, espaços
      const costBasisStr = cells[4].replace(/[$,\s]/g, '');
      const costBasis = parseInt(costBasisStr, 10);
      if (isNaN(costBasis) || costBasis <= 0) continue;

      records.push([ts, holdings, costBasis]);
    } catch (e) {
      // Ignorar linhas mal formatadas
      continue;
    }
  }

  if (!records.length) {
    throw new Error('Nenhum registro válido extraído das linhas da tabela.');
  }

  console.log(`${records.length} registros válidos extraídos`);
  return records;
}

async function main() {
  // Carregar dados existentes
  let existing = [];
  if (fs.existsSync(DATA_FILE)) {
    existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    console.log(`Dados existentes: ${existing.length} registros`);
  }

  let newRecords;
  try {
    newRecords = await fetchStrategyData();
  } catch (e) {
    console.error(`Erro ao buscar dados: ${e.message}`);
    if (existing.length) {
      console.log('Mantendo dados existentes (fallback).');
      process.exit(0);
    }
    process.exit(1);
  }

  // Merge por timestamp (date) — dados novos sobrescrevem existentes
  const map = new Map(existing.map(r => [r[0], r]));
  for (const r of newRecords) map.set(r[0], r);
  const merged = [...map.values()].sort((a, b) => a[0] - b[0]);

  const added = merged.length - existing.length;
  fs.writeFileSync(DATA_FILE, JSON.stringify(merged));
  console.log(`✓ Strategy: ${added} registros novos | total: ${merged.length} | último: ${new Date(merged.at(-1)[0]).toISOString().split('T')[0]}`);
}

main().catch(err => { console.error('Erro:', err.message); process.exit(1); });
