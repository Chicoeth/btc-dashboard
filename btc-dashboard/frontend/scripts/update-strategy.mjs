/**
 * update-strategy.mjs — atualização diária do strategy.json
 *
 * Fonte: bitbo.io/treasuries/microstrategy/
 * Método: scraping da tabela HTML de compras
 *
 * A tabela tem 5 colunas:
 *   Date | BTC Purchased | Amount | Total Bitcoin | Total Dollars
 *
 * Formato de saída: [ts_ms, btc_holdings, cost_basis_per_btc]
 *   cost_basis_per_btc = Total Dollars / Total Bitcoin
 *
 * Uso: node scripts/update-strategy.mjs
 */
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE  = path.join(__dirname, '..', 'public', 'data', 'strategy.json');
const SOURCE_URL = 'https://bitbo.io/treasuries/microstrategy/';

/**
 * Parseia string numérica com sufixo (ex: "$2.54B", "$330M", "$59.018B")
 * Retorna valor em USD
 */
function parseDollarAmount(str) {
  const cleaned = str.replace(/[$,\s]/g, '');
  const m = cleaned.match(/^([\d.]+)([BMK])?$/i);
  if (!m) return NaN;
  let val = parseFloat(m[1]);
  const suffix = (m[2] || '').toUpperCase();
  if (suffix === 'B') val *= 1e9;
  else if (suffix === 'M') val *= 1e6;
  else if (suffix === 'K') val *= 1e3;
  return val;
}

async function fetchStrategyData() {
  console.log('Buscando dados da Strategy em bitbo.io...');

  const res = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!res.ok) throw new Error(`bitbo.io HTTP ${res.status}`);
  const html = await res.text();
  console.log(`HTML recebido: ${(html.length / 1024).toFixed(0)} KB`);

  // Encontrar a tabela de compras
  // Procurar pela seção que contém "Date", "BTC Purchased", "Total Bitcoin"
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  const rows = [];
  let isDataTable = false;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const trContent = trMatch[1];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let tdMatch;

    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
      const text = tdMatch[1].replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
      cells.push(text);
    }

    // Detectar header da tabela de compras
    if (cells.length >= 5) {
      const joined = cells.join(' ').toLowerCase();
      if (joined.includes('date') && joined.includes('btc purchased') && joined.includes('total bitcoin')) {
        isDataTable = true;
        console.log('Tabela de compras encontrada');
        continue;
      }
    }

    // Coletar linhas de dados (5 colunas, primeira parece data)
    if (isDataTable && cells.length >= 5 && /\d+\/\d+\/\d+/.test(cells[0])) {
      rows.push(cells);
    }
  }

  // Se não encontrou via <td>, tentar via <th> para o header
  if (!rows.length) {
    console.log('Tentando detecção alternativa...');
    const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
    let foundHeader = false;
    
    // Re-scan: pegar TODAS as rows com 5+ cells que parecem dados
    const trRegex2 = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    while ((trMatch = trRegex2.exec(html)) !== null) {
      const trContent = trMatch[1];
      
      // Checar se é header
      if (trContent.includes('BTC Purchased') || trContent.includes('Total Bitcoin')) {
        foundHeader = true;
        continue;
      }
      
      if (!foundHeader) continue;
      
      const tdRegex2 = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [];
      let tdMatch2;
      while ((tdMatch2 = tdRegex2.exec(trContent)) !== null) {
        cells.push(tdMatch2[1].replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim());
      }
      
      if (cells.length >= 5 && /\d+\/\d+\/\d+/.test(cells[0])) {
        rows.push(cells);
      }
    }
  }

  if (!rows.length) {
    throw new Error('Nenhuma linha de compras encontrada na tabela.');
  }

  console.log(`Encontradas ${rows.length} linhas de compras`);

  // Parsear cada linha
  // Formato: Date | BTC Purchased | Amount | Total Bitcoin | Total Dollars
  const records = [];
  for (const cells of rows) {
    try {
      // Coluna 0: Date (formato M/D/YYYY)
      const dateStr = cells[0].trim();
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) continue;
      // Normalizar para meia-noite UTC
      const ts = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

      // Coluna 3: Total Bitcoin (holdings acumulados)
      const holdings = parseInt(cells[3].replace(/[,\s]/g, ''), 10);
      if (isNaN(holdings) || holdings <= 0) continue;

      // Coluna 4: Total Dollars (custo total acumulado)
      const totalDollars = parseDollarAmount(cells[4]);
      if (isNaN(totalDollars) || totalDollars <= 0) continue;

      // cost_basis_per_btc = total_dollars / total_bitcoin
      const costBasis = Math.round(totalDollars / holdings);

      records.push([ts, holdings, costBasis]);
    } catch (e) {
      continue;
    }
  }

  if (!records.length) {
    throw new Error('Nenhum registro válido extraído.');
  }

  // Ordenar por data (mais antigo primeiro)
  records.sort((a, b) => a[0] - b[0]);
  console.log(`${records.length} registros válidos extraídos`);
  console.log(`Primeiro: ${new Date(records[0][0]).toISOString().split('T')[0]} | ${records[0][1]} BTC`);
  console.log(`Último:  ${new Date(records.at(-1)[0]).toISOString().split('T')[0]} | ${records.at(-1)[1]} BTC`);
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

  // Merge por timestamp — dados novos sobrescrevem existentes
  const map = new Map(existing.map(r => [r[0], r]));
  for (const r of newRecords) map.set(r[0], r);
  const merged = [...map.values()].sort((a, b) => a[0] - b[0]);

  const added = merged.length - existing.length;
  fs.writeFileSync(DATA_FILE, JSON.stringify(merged));
  console.log(`✓ Strategy: ${added >= 0 ? '+' : ''}${added} registros | total: ${merged.length} | último: ${new Date(merged.at(-1)[0]).toISOString().split('T')[0]} | ${merged.at(-1)[1]} BTC`);
}

main().catch(err => { console.error('Erro:', err.message); process.exit(1); });