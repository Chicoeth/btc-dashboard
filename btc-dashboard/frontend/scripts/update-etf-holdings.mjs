/**
 * update-etf-holdings.mjs — atualização diária do etf-holdings.json
 *
 * Fonte: bitbo.io/treasuries/us-etfs/ (scraping da tabela HTML)
 * Método: extrai ticker e holdings em BTC de cada ETF da tabela
 *
 * Formato de saída (array de arrays):
 *   [ts_ms, btc_price, total, IBIT, FBTC, BITB, ARKB, BTCO, EZBC, BRRR, HODL, BTCW, GBTC, BTC]
 *
 * Nota: "BTC" aqui é o ticker do Grayscale Bitcoin Mini Trust, não Bitcoin em si.
 *
 * Uso: node scripts/update-etf-holdings.mjs
 */
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE  = path.join(__dirname, '..', 'public', 'data', 'etf-holdings.json');
const SOURCE_URL = 'https://bitbo.io/treasuries/us-etfs/';

/* ── ordem fixa dos tickers no array de saída (índices 3..13) ── */
const ETFS = ['IBIT','FBTC','BITB','ARKB','BTCO','EZBC','BRRR','HODL','BTCW','GBTC','BTC'];

/* ── mapear Symbol:Exchange do Bitbo → nosso ticker ── */
const TICKER_MAP = {
  'IBIT':  'IBIT',
  'FBTC':  'FBTC',
  'BITB':  'BITB',
  'ARKB':  'ARKB',
  'BTCO':  'BTCO',
  'EZBC':  'EZBC',
  'BRRR':  'BRRR',
  'HODL':  'HODL',
  'BTCW':  'BTCW',
  'GBTC':  'GBTC',
  'BTC':   'BTC',   // Grayscale Mini Trust
  'DEFI':  null,    // Hashdex — ignorar (< 135 BTC)
};

/**
 * Buscar preço atual do BTC via Yahoo Finance (mesmo método do update-price.mjs)
 */
async function fetchBtcPrice() {
  const to   = Math.floor(Date.now() / 1000);
  const from = to - 2 * 24 * 60 * 60; // últimos 2 dias
  const url  = `https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?period1=${from}&period2=${to}&interval=1d&events=history`;

  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status}`);

  const json   = await res.json();
  const result = json?.chart?.result?.[0];
  const closes = result?.indicators?.quote?.[0]?.close;
  if (!closes?.length) throw new Error('Sem dados de preço do Yahoo Finance');

  // Pegar o último close disponível
  for (let i = closes.length - 1; i >= 0; i--) {
    if (closes[i] != null) return parseFloat(closes[i].toFixed(2));
  }
  throw new Error('Nenhum preço válido encontrado');
}

/**
 * Scraping do Bitbo: extrair holdings de cada ETF da tabela HTML.
 *
 * A tabela tem linhas com formato:
 *   <td>Entity name</td> ... <td>TICKER:EXCHANGE</td> ... <td>NUMBER # of BTC</td> ...
 *
 * O ticker está em uma célula com formato "IBIT:NASDAQ", "FBTC:CBOE", etc.
 * O holdings está na célula que contém o número de BTC (com vírgulas e decimais).
 */
async function fetchEtfHoldings() {
  console.log('Buscando dados de ETF holdings em bitbo.io...');

  const res = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept':     'text/html,application/xhtml+xml',
    },
  });

  if (!res.ok) throw new Error(`bitbo.io HTTP ${res.status}`);
  const html = await res.text();
  console.log(`HTML recebido: ${(html.length / 1024).toFixed(0)} KB`);

  /*
   * Estratégia: percorrer cada <tr>, extrair todas as <td>,
   * procurar uma célula com formato "TICKER:EXCHANGE" (ex: "IBIT:NASDAQ")
   * e a célula numérica que contém os BTC holdings.
   *
   * No HTML do Bitbo a tabela tem estas colunas:
   *   Entity | Country | Symbol:Exchange | Filings & Changes | # of BTC | Value Today | % of 21m
   *
   * A coluna de holdings (#4, 0-indexed) contém apenas o número, ex: "786,918.6"
   */
  const holdings = {};
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const trContent = trMatch[1];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let tdMatch;

    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
      const text = tdMatch[1].replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
      cells.push(text);
    }

    if (cells.length < 5) continue;

    // Procurar célula com padrão "TICKER:EXCHANGE"
    let ticker = null;
    for (const cell of cells) {
      const tickerMatch = cell.match(/^([A-Z]{2,5}):(?:NASDAQ|NYSE|CBOE)$/);
      if (tickerMatch) {
        const raw = tickerMatch[1];
        ticker = TICKER_MAP[raw] ?? null;
        break;
      }
    }

    if (!ticker) continue;

    // Procurar a célula de holdings — é um número grande com vírgulas e possível decimal
    // Vamos pegar a célula que contém o valor monetário ($ seguido de número) e a anterior a ela
    // Ou mais simples: pegar todas as células numéricas e identificar o holdings por posição

    // Na tabela do Bitbo, a coluna de holdings aparece ANTES da coluna de valor em USD ($)
    // Holdings está na posição relativa após "Filings & Changes"
    // Abordagem: encontrar o primeiro número grande (> 10) que NÃO começa com $
    let btcHoldings = null;
    for (const cell of cells) {
      // Ignorar células com $ (valor em USD)
      if (cell.startsWith('$')) continue;
      // Ignorar células com % 
      if (cell.includes('%')) continue;
      // Tentar parsear como número (remover vírgulas)
      const cleaned = cell.replace(/,/g, '');
      const num = parseFloat(cleaned);
      if (!isNaN(num) && num > 10 && cleaned.match(/^\d+(\.\d+)?$/)) {
        btcHoldings = num;
        break;
      }
    }

    if (btcHoldings != null) {
      holdings[ticker] = btcHoldings;
      console.log(`  ${ticker}: ${btcHoldings.toLocaleString()} BTC`);
    }
  }

  const found = Object.keys(holdings);
  console.log(`Encontrados ${found.length} ETFs: ${found.join(', ')}`);

  if (found.length < 8) {
    throw new Error(`Poucos ETFs encontrados (${found.length}). O HTML pode ter mudado de formato.`);
  }

  return holdings;
}

async function main() {
  /* 1. Carregar dados existentes */
  let existing = [];
  if (fs.existsSync(DATA_FILE)) {
    existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    console.log(`Dados existentes: ${existing.length} registros`);
  }

  /* 2. Buscar holdings atuais */
  let holdingsMap;
  try {
    holdingsMap = await fetchEtfHoldings();
  } catch (e) {
    console.error(`Erro ao buscar holdings: ${e.message}`);
    if (existing.length) {
      console.log('Mantendo dados existentes (fallback).');
      process.exit(0);
    }
    process.exit(1);
  }

  /* 3. Buscar preço BTC */
  let btcPrice;
  try {
    btcPrice = await fetchBtcPrice();
    console.log(`Preço BTC: $${btcPrice.toLocaleString()}`);
  } catch (e) {
    console.error(`Erro ao buscar preço BTC: ${e.message}`);
    // Fallback: usar preço do último registro existente
    if (existing.length) {
      btcPrice = existing.at(-1)[1];
      console.log(`Usando preço do último registro: $${btcPrice.toLocaleString()}`);
    } else {
      process.exit(1);
    }
  }

  /* 4. Montar o registro do dia */
  const today = new Date();
  const ts = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  const total = ETFS.reduce((sum, etf) => sum + (holdingsMap[etf] || 0), 0);

  const row = [ts, btcPrice, parseFloat(total.toFixed(2))];
  for (const etf of ETFS) {
    row.push(holdingsMap[etf] || 0);
  }

  /* 5. Merge — sobrescrever se já existe registro para hoje */
  const dateKey = (ts_ms) => new Date(ts_ms).toISOString().split('T')[0];
  const byDate = new Map(existing.map(r => [dateKey(r[0]), r]));
  byDate.set(dateKey(ts), row);

  const merged = [...byDate.values()].sort((a, b) => a[0] - b[0]);

  const added = merged.length - existing.length;
  fs.writeFileSync(DATA_FILE, JSON.stringify(merged));

  const lastDate = dateKey(merged.at(-1)[0]);
  console.log(`✓ ETF Holdings: ${added >= 0 ? '+' : ''}${added} registros | total: ${merged.length} | último: ${lastDate}`);
  console.log(`  Total BTC em ETFs: ${total.toLocaleString()}`);
}

main().catch(err => { console.error('Erro:', err.message); process.exit(1); });
