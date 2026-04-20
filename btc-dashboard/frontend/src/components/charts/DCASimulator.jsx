import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTheme } from '../ThemeContext';
import { patchOption } from '../chartThemeHelper';

/* ============================================================
   Simulador de DCA
   - Lê dados via APIs existentes (/api/price, /api/mvrv, /api/sth-mvrv, /api/fng)
   - Múltiplo de Mayer calculado no frontend (SMA200 sobre price)
   - Operador da condição: fixo "abaixo de"
   - Fallback de preço em dia sem fechamento: próximo dia útil disponível
   ============================================================ */

// Definição dos indicadores condicionais disponíveis
const INDICATORS = {
  none: {
    label: 'Nenhum (DCA tradicional)',
    key: 'none',
  },
  mvrv: {
    label: 'MVRV',
    key: 'mvrv',
    endpoint: '/api/mvrv',
    defaultThreshold: 1.5,
    step: 0.1,
    min: 0,
    max: 5,
    unit: '',
    helper: 'Compra quando MVRV < threshold. Histórico: mínimos de ciclo ~0.5–0.8, topos ~3.5–5.',
  },
  sthMvrv: {
    label: 'STH MVRV',
    key: 'sthMvrv',
    endpoint: '/api/sth-mvrv',
    defaultThreshold: 1.0,
    step: 0.05,
    min: 0.5,
    max: 2,
    unit: '',
    helper: 'Compra quando STH MVRV < threshold. Valores <1 indicam holders de curto prazo em prejuízo.',
  },
  mayer: {
    label: 'Múltiplo de Mayer',
    key: 'mayer',
    endpoint: null, // calculado do /api/price
    defaultThreshold: 1.0,
    step: 0.05,
    min: 0.3,
    max: 3,
    unit: '',
    helper: 'Compra quando preço / SMA200 < threshold. Valores <1 = preço abaixo da média móvel de 200 dias.',
  },
  fng: {
    label: 'Índice Medo & Ganância',
    key: 'fng',
    endpoint: '/api/fng',
    defaultThreshold: 30,
    step: 1,
    min: 0,
    max: 100,
    unit: '',
    helper: 'Compra quando F&G < threshold. Valores 0–25 = Medo Extremo, 25–45 = Medo.',
  },
};

// ---------- Helpers de data ----------
function isValidDateStr(s) {
  // Valida formato 'YYYY-MM-DD' onde YYYY >= 1900 e a data é real
  if (typeof s !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (y < 1900 || y > 2100) return false;
  if (mo < 1 || mo > 12) return false;
  if (d < 1 || d > 31) return false;
  const t = Date.UTC(y, mo - 1, d);
  if (!isFinite(t)) return false;
  const dt = new Date(t);
  return dt.getUTCFullYear() === y && (dt.getUTCMonth() + 1) === mo && dt.getUTCDate() === d;
}

function toDateStr(ts) {
  // timestamp ms → 'YYYY-MM-DD' em UTC
  return new Date(ts).toISOString().split('T')[0];
}

function toTsMs(dateStr) {
  // 'YYYY-MM-DD' → timestamp ms em UTC (meia-noite UTC)
  return new Date(dateStr + 'T00:00:00Z').getTime();
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function addMonths(dateStr, months) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().split('T')[0];
}

function dayOfWeek(dateStr) {
  // 0 = domingo, 1 = segunda, ...
  return new Date(dateStr + 'T00:00:00Z').getUTCDay();
}

function fmtDateBR(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function fmtUSD(v) {
  if (v == null || !isFinite(v)) return '—';
  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function fmtUSDShort(v) {
  if (v == null || !isFinite(v)) return '—';
  if (Math.abs(v) >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  if (Math.abs(v) >= 1e3) return '$' + (v / 1e3).toFixed(2) + 'K';
  return '$' + v.toFixed(2);
}

function fmtBTC(v) {
  if (v == null || !isFinite(v)) return '—';
  return v.toLocaleString('en-US', { maximumFractionDigits: 8, minimumFractionDigits: 2 }) + ' BTC';
}

function fmtPct(v) {
  if (v == null || !isFinite(v)) return '—';
  const sign = v >= 0 ? '+' : '';
  return sign + v.toFixed(2) + '%';
}

// ---------- Calculos (SMA200 para Mayer) ----------
function computeSMA200(priceData) {
  // priceData: array [ts_ms, close, high]
  // retorna Map<dateStr, sma200>
  const map = new Map();
  if (!priceData || priceData.length < 200) return map;
  let sum = 0;
  for (let i = 0; i < priceData.length; i++) {
    sum += priceData[i][1];
    if (i >= 200) sum -= priceData[i - 200][1];
    if (i >= 199) {
      const sma = sum / 200;
      map.set(toDateStr(priceData[i][0]), sma);
    }
  }
  return map;
}

// ---------- Componente principal ----------
export default function DCASimulator() {
  const { isDark } = useTheme();

  // Estados do formulário
  const [frequency, setFrequency] = useState('weekly'); // daily | weekly | monthly
  const [amount, setAmount] = useState('100');
  const [startDate, setStartDate] = useState('2020-01-01');
  const [endDate, setEndDate] = useState('');
  const [useEndDate, setUseEndDate] = useState(false);
  const [indicator, setIndicator] = useState('none');
  const [threshold, setThreshold] = useState(INDICATORS.mvrv.defaultThreshold);

  // Estados de dados
  const [priceData, setPriceData] = useState(null);
  const [indicatorData, setIndicatorData] = useState(null); // Map<dateStr, value>
  const [loading, setLoading] = useState(true);
  const [loadingIndicator, setLoadingIndicator] = useState(false);
  const [error, setError] = useState(null);
  const [echartsReady, setEchartsReady] = useState(false);

  // Carrega echarts dinamicamente (evita SSR issues no Next.js)
  useEffect(() => { import('echarts').then(() => setEchartsReady(true)); }, []);

  // Aviso de ajuste de data
  const [dateAdjusted, setDateAdjusted] = useState(null);

  // Carrega preço ao montar
  useEffect(() => {
    setLoading(true);
    fetch('/api/price')
      .then((r) => r.json())
      .then((resp) => {
        const arr = resp?.data ?? resp ?? [];
        setPriceData(arr);
        setLoading(false);
      })
      .catch((e) => {
        setError('Erro ao carregar dados de preço: ' + e.message);
        setLoading(false);
      });
  }, []);

  // Carrega dados do indicador quando muda
  useEffect(() => {
    if (indicator === 'none') {
      setIndicatorData(null);
      setDateAdjusted(null);
      return;
    }
    const ind = INDICATORS[indicator];

    // Mayer é calculado do priceData
    if (indicator === 'mayer') {
      if (!priceData) return;
      const sma = computeSMA200(priceData);
      const map = new Map();
      priceData.forEach(([ts, close]) => {
        const ds = toDateStr(ts);
        const smaVal = sma.get(ds);
        if (smaVal && smaVal > 0) {
          map.set(ds, close / smaVal);
        }
      });
      setIndicatorData(map);
      return;
    }

    // Demais indicadores: fetch da API
    setLoadingIndicator(true);
    fetch(ind.endpoint)
      .then((r) => r.json())
      .then((resp) => {
        const arr = resp?.data ?? resp ?? [];
        const map = new Map();
        arr.forEach((row) => {
          const ds = toDateStr(row[0]);
          let val;
          if (indicator === 'mvrv') val = row[3]; // [ts, btc_price, realized_price, mvrv]
          else if (indicator === 'sthMvrv') val = row[3]; // [ts, btc_price, sth_realized, sth_mvrv]
          else if (indicator === 'fng') val = row[1]; // [ts, value, classification]
          if (val != null && isFinite(val)) map.set(ds, val);
        });
        setIndicatorData(map);
        setLoadingIndicator(false);
      })
      .catch((e) => {
        setError('Erro ao carregar indicador: ' + e.message);
        setLoadingIndicator(false);
      });
  }, [indicator, priceData]);

  // Reseta threshold quando muda indicador
  useEffect(() => {
    if (indicator !== 'none') {
      setThreshold(INDICATORS[indicator].defaultThreshold);
    }
  }, [indicator]);

  // Ajuste automático de data quando indicador não tem dados na data inicial
  useEffect(() => {
    if (indicator === 'none' || !indicatorData || indicatorData.size === 0) {
      setDateAdjusted(null);
      return;
    }
    // Primeira data do indicador
    const firstDate = [...indicatorData.keys()].sort()[0];
    if (startDate < firstDate) {
      setDateAdjusted({
        from: startDate,
        to: firstDate,
        indicator: INDICATORS[indicator].label,
      });
      setStartDate(firstDate);
    } else {
      setDateAdjusted(null);
    }
  }, [indicator, indicatorData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preço como Map<dateStr, close>
  const priceMap = useMemo(() => {
    if (!priceData) return null;
    const m = new Map();
    priceData.forEach(([ts, close]) => m.set(toDateStr(ts), close));
    return m;
  }, [priceData]);

  // Array ordenado de datas com preço (para fallback)
  const priceDates = useMemo(() => {
    if (!priceData) return [];
    return priceData.map(([ts]) => toDateStr(ts)).sort();
  }, [priceData]);

  // Datas min/max disponíveis
  const dataBounds = useMemo(() => {
    if (!priceDates || priceDates.length === 0) return { min: '2012-01-01', max: toDateStr(Date.now()) };
    return { min: priceDates[0], max: priceDates[priceDates.length - 1] };
  }, [priceDates]);

  // Gera as datas de aporte de acordo com a frequência
  const aporteDates = useMemo(() => {
    if (!priceMap) return [];
    // Valida datas antes de processar — input HTML pode mandar strings inválidas temporariamente
    if (!isValidDateStr(startDate)) return [];
    const start = startDate;
    const end = useEndDate && endDate
      ? (isValidDateStr(endDate) ? endDate : dataBounds.max)
      : dataBounds.max;
    if (start > end) return [];

    const dates = [];
    if (frequency === 'daily') {
      let cur = start;
      while (cur <= end) {
        dates.push(cur);
        cur = addDays(cur, 1);
      }
    } else if (frequency === 'weekly') {
      // Todas as segundas-feiras entre start e end
      let cur = start;
      // Avançar até primeira segunda >= start
      while (cur <= end && dayOfWeek(cur) !== 1) cur = addDays(cur, 1);
      while (cur <= end) {
        dates.push(cur);
        cur = addDays(cur, 7);
      }
    } else if (frequency === 'monthly') {
      // Dia 1 de cada mês entre start e end
      const [sy, sm] = start.split('-').map(Number);
      let cur = `${sy}-${String(sm).padStart(2, '0')}-01`;
      // Se dia 1 do mês de start for anterior a start, pular para próximo mês
      if (cur < start) cur = addMonths(cur, 1);
      while (cur <= end) {
        dates.push(cur);
        cur = addMonths(cur, 1);
      }
    }
    return dates;
  }, [frequency, startDate, endDate, useEndDate, dataBounds.max, priceMap]);

  // Busca preço com fallback (próximo dia útil disponível)
  const getPriceWithFallback = useCallback(
    (dateStr) => {
      if (!priceMap || !priceDates || priceDates.length === 0) return null;
      if (priceMap.has(dateStr)) return { price: priceMap.get(dateStr), date: dateStr };
      // Buscar próximo dia disponível (busca binária)
      let lo = 0;
      let hi = priceDates.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (priceDates[mid] < dateStr) lo = mid + 1;
        else hi = mid;
      }
      const next = priceDates[lo];
      if (next && next >= dateStr) return { price: priceMap.get(next), date: next };
      return null;
    },
    [priceMap, priceDates]
  );

  // Executa a simulação
  const simulation = useMemo(() => {
    if (!priceMap || aporteDates.length === 0) return null;
    const amountNum = parseFloat(amount);
    if (!isFinite(amountNum) || amountNum <= 0) return null;

    const trades = []; // { date, price, usd, btc }
    const useIndicator = indicator !== 'none' && indicatorData;

    for (const d of aporteDates) {
      const pr = getPriceWithFallback(d);
      if (!pr) continue;
      const actualDate = pr.date;

      // Se usa indicador, checar condição
      if (useIndicator) {
        const indVal = indicatorData.get(actualDate);
        if (indVal == null) continue; // Sem dado → não aporta
        if (indVal >= threshold) continue; // Condição não cumprida
      }

      const btc = amountNum / pr.price;
      trades.push({
        date: actualDate,
        price: pr.price,
        usd: amountNum,
        btc,
      });
    }

    if (trades.length === 0) {
      return { trades: [], numTrades: 0, totalUSD: 0, totalBTC: 0, avgPrice: 0, currentValue: 0, profit: 0, profitPct: 0, timeline: [], totalScheduled: aporteDates.length };
    }

    // Ordena trades por data (fallback pode ter gerado datas fora de ordem)
    trades.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    // Agrupa trades do mesmo dia (fallback pode ter jogado 2+ aportes no mesmo dia útil)
    const tradesByDate = new Map();
    for (const t of trades) {
      const existing = tradesByDate.get(t.date);
      if (existing) {
        existing.usd += t.usd;
        existing.btc += t.btc;
        // price permanece o mesmo (mesmo dia)
      } else {
        tradesByDate.set(t.date, { ...t });
      }
    }

    const totalUSD = trades.reduce((a, t) => a + t.usd, 0);
    const totalBTC = trades.reduce((a, t) => a + t.btc, 0);
    const avgPrice = totalUSD / totalBTC;

    // Preço atual = último preço disponível
    const currentPrice = priceData[priceData.length - 1][1];
    const currentValue = totalBTC * currentPrice;
    const profit = currentValue - totalUSD;
    const profitPct = (profit / totalUSD) * 100;

    /* Timeline: iteramos por TODOS os dias com preço a partir do primeiro aporte,
       acumulando BTC/USD quando há aporte no dia e recalculando o valor do
       patrimônio com o preço daquele dia. Isso dá a curva real de evolução
       (não só pontos nos dias de aporte). */
    const firstTradeDate = trades[0].date;
    const timeline = [];
    let accUSD = 0;
    let accBTC = 0;

    // Busca índice da primeira data de preço >= firstTradeDate (binary search)
    let startIdx = 0;
    {
      let lo = 0, hi = priceDates.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (priceDates[mid] < firstTradeDate) lo = mid + 1;
        else hi = mid;
      }
      startIdx = lo;
    }

    // Para não gerar centenas de milhares de pontos, faz downsampling:
    // se o range > 730 dias, pula dias para ter ~500 pontos finais
    const totalDays = priceDates.length - startIdx;
    const step = Math.max(1, Math.floor(totalDays / 500));

    for (let i = startIdx; i < priceDates.length; i++) {
      const ds = priceDates[i];
      // Se houve aporte neste dia, acumula
      const trade = tradesByDate.get(ds);
      if (trade) {
        accUSD += trade.usd;
        accBTC += trade.btc;
      }
      // Sempre inclui dias de aporte; intermediários apenas a cada `step` dias
      const isTradeDay = !!trade;
      const isSampled = (i - startIdx) % step === 0;
      const isLast = i === priceDates.length - 1;
      if (!isTradeDay && !isSampled && !isLast) continue;

      const price = priceMap.get(ds);
      timeline.push({
        date: ds,
        totalUSD: accUSD,
        totalBTC: accBTC,
        value: accBTC * price,
        isPurchase: isTradeDay,
        purchaseUSD: trade ? trade.usd : 0,
        purchaseBTC: trade ? trade.btc : 0,
        priceAtPurchase: trade ? trade.price : null,
      });
    }

    return {
      trades,
      numTrades: trades.length,
      totalUSD,
      totalBTC,
      avgPrice,
      currentPrice,
      currentValue,
      profit,
      profitPct,
      timeline,
      totalScheduled: aporteDates.length,
    };
  }, [priceMap, priceData, priceDates, aporteDates, amount, indicator, indicatorData, threshold, getPriceWithFallback, dataBounds.max]);

  // Chart ref e instância
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // Init + update do chart (padrão MVRVChart: dynamic import + init lazy)
  useEffect(() => {
    if (!echartsReady || !chartRef.current) return;

    let cleanup = null;

    const run = async () => {
      const echarts = await import('echarts');
      let chart = chartInstanceRef.current;
      if (!chart) {
        chart = echarts.init(chartRef.current, null, { renderer: 'canvas' });
        chartInstanceRef.current = chart;
        const ro = new ResizeObserver(() => chart.resize());
        ro.observe(chartRef.current);
        cleanup = () => {
          ro.disconnect();
        };
      }

      if (!simulation || !simulation.timeline || simulation.timeline.length === 0) {
        chart.clear();
        return;
      }

      // Garante que o chart tem as dimensões corretas do container (DOM pode ter mudado)
      chart.resize();

      const dates = simulation.timeline.map((p) => p.date);
      const investedSeries = simulation.timeline.map((p) => +p.totalUSD.toFixed(2));
      const valueSeries = simulation.timeline.map((p) => +p.value.toFixed(2));
      // Série de aportes: array com value para dias de aporte, null para os demais
      // Usa null em vez de filtrar para manter o mesmo eixo X (category) sincronizado
      const purchaseSeries = simulation.timeline.map((p) =>
        p.isPurchase ? +p.value.toFixed(2) : null
      );
      // Tamanho da bolinha: menor quando há muitos aportes pra não poluir
      const numPurchases = simulation.numTrades;
      const purchaseSize =
        numPurchases > 500 ? 4 :
        numPurchases > 100 ? 5 :
        numPurchases > 30  ? 6 : 7;

      const option = {
        backgroundColor: 'transparent',
        animation: false,
        grid: { left: 72, right: 48, top: 36, bottom: 48 },
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#0a0a0f',
          borderColor: '#1e1e35',
          borderWidth: 1,
          textStyle: { color: '#e8e8f0', fontSize: 12, fontFamily: 'DM Sans' },
          axisPointer: { type: 'line', lineStyle: { color: '#3a3a5e', type: 'dashed' } },
          formatter: (params) => {
            if (!params || params.length === 0) return '';
            const date = params[0].axisValueLabel;
            const [y, m, d] = date.split('-');
            const dateBR = `${d}/${m}/${y}`;
            const idx = params[0].dataIndex;
            const point = simulation.timeline[idx];
            const invested = params.find((p) => p.seriesName === 'Aportado')?.value ?? 0;
            const value = params.find((p) => p.seriesName === 'Valor Atual')?.value ?? 0;
            const pnl = value - invested;
            const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
            const pnlColor = pnl >= 0 ? '#00c44f' : '#e8000a';
            const purchaseInfo = (point && point.isPurchase) ? `
              <div style="display:flex;justify-content:space-between;gap:18px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #1e1e35;">
                <span style="color:#00c44f;">🟢 Aporte:</span>
                <span style="color:#00c44f;font-weight:600;">+${fmtUSD(point.purchaseUSD)} @ ${fmtUSD(point.priceAtPurchase)}</span>
              </div>` : '';
            return `
              <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#8080a8;margin-bottom:6px;">${dateBR}</div>
              ${purchaseInfo}
              <div style="display:flex;justify-content:space-between;gap:18px;margin-bottom:3px;">
                <span style="color:#9090b0;">Aportado:</span>
                <span style="color:#e8e8f0;font-weight:500;">${fmtUSD(invested)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:18px;margin-bottom:3px;">
                <span style="color:#9090b0;">Valor atual:</span>
                <span style="color:#f7931a;font-weight:500;">${fmtUSD(value)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:18px;margin-top:6px;padding-top:6px;border-top:1px solid #1e1e35;">
                <span style="color:#9090b0;">P&L:</span>
                <span style="color:${pnlColor};font-weight:600;">${fmtUSD(pnl)} (${fmtPct(pnlPct)})</span>
              </div>
            `;
          },
        },
        legend: {
          data: ['Aportado', 'Valor Atual', 'Aportes'],
          top: 6,
          right: 16,
          textStyle: { color: '#9090b0', fontSize: 11, fontFamily: 'JetBrains Mono' },
          itemWidth: 18,
          itemHeight: 8,
          itemGap: 18,
        },
        xAxis: {
          type: 'category',
          data: dates,
          axisLine: { lineStyle: { color: '#3a3a5e' } },
          axisLabel: {
            color: '#8080a8',
            fontSize: 10,
            fontFamily: 'JetBrains Mono',
            formatter: (val) => {
              const [y, m] = val.split('-');
              return `${m}/${y.slice(2)}`;
            },
          },
          axisTick: { show: false },
        },
        yAxis: {
          type: 'value',
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#8080a8',
            fontSize: 10,
            fontFamily: 'JetBrains Mono',
            formatter: (v) => fmtUSDShort(v),
          },
          splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
        },
        series: [
          {
            name: 'Aportado',
            type: 'line',
            data: investedSeries,
            smooth: false,
            step: 'end',
            symbol: 'none',
            lineStyle: { color: '#7878c0', width: 1.5, type: 'dashed' },
            z: 3,
          },
          {
            name: 'Valor Atual',
            type: 'line',
            data: valueSeries,
            smooth: true,
            symbol: 'none',
            lineStyle: { color: '#f7931a', width: 2 },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(247,147,26,0.25)' },
                { offset: 1, color: 'rgba(247,147,26,0.02)' },
              ]),
            },
            z: 5,
          },
          {
            name: 'Aportes',
            type: 'scatter',
            data: purchaseSeries,
            symbolSize: purchaseSize,
            itemStyle: {
              color: 'rgba(0,196,79,0.85)',
              borderColor: '#00c44f',
              borderWidth: 1,
            },
            emphasis: {
              scale: 1.6,
              itemStyle: {
                color: '#00c44f',
                borderColor: '#00ff5a',
                borderWidth: 1.5,
                shadowBlur: 8,
                shadowColor: 'rgba(0,196,79,0.6)',
              },
            },
            z: 7,
          },
        ],
      };

      chart.setOption(patchOption(option, isDark), { notMerge: true });
    };

    run();

    return () => {
      if (cleanup) cleanup();
    };
  }, [echartsReady, simulation, isDark]);

  // Dispose do chart no unmount
  useEffect(() => {
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  // ---------- Render ----------
  const currentInd = indicator !== 'none' ? INDICATORS[indicator] : null;
  const sim = simulation;

  return (
    <div className="dca-root">
      {/* Formulário */}
      <div className="dca-form">
        <div className="form-grid">
          {/* Frequência */}
          <div className="field">
            <label className="field-label">Frequência</label>
            <div className="freq-group">
              {[
                { v: 'daily', l: 'Diário' },
                { v: 'weekly', l: 'Semanal' },
                { v: 'monthly', l: 'Mensal' },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  className={`freq-btn ${frequency === o.v ? 'active' : ''}`}
                  onClick={() => setFrequency(o.v)}
                >
                  {o.l}
                </button>
              ))}
            </div>
            <div className="field-helper">
              {frequency === 'daily' && 'Aporte todos os dias'}
              {frequency === 'weekly' && 'Aporte toda segunda-feira'}
              {frequency === 'monthly' && 'Aporte no dia 1º de cada mês'}
            </div>
          </div>

          {/* Valor */}
          <div className="field">
            <label className="field-label">Valor por aporte (USD)</label>
            <div className="input-prefix">
              <span className="prefix">$</span>
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-input"
              />
            </div>
            <div className="field-helper">Ex: $100 · $500 · $1.000</div>
          </div>

          {/* Data inicial */}
          <div className="field">
            <label className="field-label">Data inicial</label>
            <input
              type="date"
              value={startDate}
              min={dataBounds.min}
              max={dataBounds.max}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-input"
            />
            <div className="field-helper">
              Dados disponíveis desde {fmtDateBR(dataBounds.min)}
            </div>
          </div>

          {/* Data final */}
          <div className="field">
            <label className="field-label">
              Data final
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={useEndDate}
                  onChange={(e) => setUseEndDate(e.target.checked)}
                />
                <span>definir data final</span>
              </label>
            </label>
            <input
              type="date"
              value={useEndDate ? endDate : ''}
              min={startDate}
              max={dataBounds.max}
              disabled={!useEndDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-input"
              placeholder="Até hoje"
            />
            <div className="field-helper">
              {useEndDate ? 'Aportes até a data selecionada' : `Aportes até hoje (${fmtDateBR(dataBounds.max)})`}
            </div>
          </div>
        </div>

        {/* Indicador Condicional */}
        <div className="indicator-section">
          <div className="field">
            <label className="field-label">Indicador condicional (opcional)</label>
            <select
              value={indicator}
              onChange={(e) => setIndicator(e.target.value)}
              className="text-input"
            >
              {Object.values(INDICATORS).map((i) => (
                <option key={i.key} value={i.key}>{i.label}</option>
              ))}
            </select>
            <div className="field-helper">
              {indicator === 'none'
                ? 'DCA tradicional — aporta em toda data programada'
                : currentInd?.helper}
            </div>
          </div>

          {indicator !== 'none' && (
            <div className="field">
              <label className="field-label">
                Aporta quando {currentInd.label} for <strong className="below-tag">abaixo de</strong>
              </label>
              <div className="threshold-group">
                <input
                  type="range"
                  min={currentInd.min}
                  max={currentInd.max}
                  step={currentInd.step}
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="range-input"
                />
                <input
                  type="number"
                  min={currentInd.min}
                  max={currentInd.max}
                  step={currentInd.step}
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)}
                  className="threshold-number"
                />
              </div>
            </div>
          )}
        </div>

        {/* Aviso de ajuste de data */}
        {dateAdjusted && (
          <div className="adjust-warn">
            <span className="warn-icon">⚠</span>
            <span>
              Data inicial ajustada de <strong>{fmtDateBR(dateAdjusted.from)}</strong> para <strong>{fmtDateBR(dateAdjusted.to)}</strong> —
              o indicador {dateAdjusted.indicator} só tem dados a partir dessa data.
            </span>
          </div>
        )}
      </div>

      {/* Resultado — container sempre montado para preservar o chartRef */}
      {loading ? (
        <div className="status-box">Carregando dados...</div>
      ) : error ? (
        <div className="status-box error">{error}</div>
      ) : (
        <>
          {/* Cards de resultado (ou placeholders) */}
          <div className="result-grid">
            <div className="result-card">
              <div className="result-label">Aportes realizados</div>
              <div className="result-value">
                {sim && sim.numTrades > 0 ? sim.numTrades.toLocaleString('pt-BR') : '—'}
              </div>
              <div className="result-sub">
                {sim && sim.numTrades > 0
                  ? (indicator !== 'none' && sim.totalScheduled > sim.numTrades
                      ? `de ${sim.totalScheduled.toLocaleString('pt-BR')} programados (${((sim.numTrades / sim.totalScheduled) * 100).toFixed(0)}%)`
                      : 'todos executados')
                  : '\u00A0'}
              </div>
            </div>

            <div className="result-card">
              <div className="result-label">Total aportado</div>
              <div className="result-value">
                {sim && sim.numTrades > 0 ? fmtUSDShort(sim.totalUSD) : '—'}
              </div>
              <div className="result-sub">
                {sim && sim.numTrades > 0 ? fmtBTC(sim.totalBTC) : '\u00A0'}
              </div>
            </div>

            <div className="result-card">
              <div className="result-label">Preço médio de compra</div>
              <div className="result-value">
                {sim && sim.numTrades > 0 ? fmtUSD(sim.avgPrice) : '—'}
              </div>
              <div className="result-sub">
                {sim && sim.numTrades > 0 ? `vs. atual ${fmtUSDShort(sim.currentPrice)}` : '\u00A0'}
              </div>
            </div>

            <div className={`result-card highlight ${sim && sim.profit >= 0 ? 'pos' : sim && sim.profit < 0 ? 'neg' : ''}`}>
              <div className="result-label">Lucro / Prejuízo</div>
              <div className="result-value">
                {sim && sim.numTrades > 0 ? fmtPct(sim.profitPct) : '—'}
              </div>
              <div className="result-sub">
                {sim && sim.numTrades > 0 ? fmtUSD(sim.profit) : '\u00A0'}
              </div>
            </div>
          </div>

          {/* Gráfico — container SEMPRE montado para preservar a instância do ECharts */}
          <div className="chart-wrap">
            <div className="chart-header">
              <div className="chart-title">Evolução do patrimônio</div>
              <div className="chart-sub">
                Valor atual em <span className="orange">laranja</span> · Aportado em <span className="muted">tracejado</span> · Aportes em <span className="green">●</span>
              </div>
            </div>
            <div className="chart-canvas-wrap">
              <div ref={chartRef} style={{ width: '100%', height: '380px' }} />
              {/* Overlays em cima do chart quando em loading ou sem dados */}
              {loadingIndicator && (
                <div className="chart-overlay">Carregando indicador...</div>
              )}
              {!loadingIndicator && (!sim || sim.numTrades === 0) && (
                <div className="chart-overlay">
                  {!sim
                    ? 'Ajuste os parâmetros para simular.'
                    : `Nenhum aporte realizado com esses parâmetros.${indicator !== 'none' ? ' A condição do indicador não foi cumprida em nenhuma data programada.' : ''}`}
                </div>
              )}
            </div>
            <div className="chart-footer">
              <span>{sim && sim.numTrades > 0 ? `${sim.numTrades} aportes` : '—'}</span>
              <span>·</span>
              <span>
                {sim && sim.numTrades > 0
                  ? `${fmtDateBR(sim.trades[0].date)} → ${fmtDateBR(sim.trades[sim.trades.length - 1].date)}`
                  : '—'}
              </span>
              <span>·</span>
              <span>Fonte: Yahoo Finance / CSV histórico</span>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .dca-root {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .dca-form {
          padding: 20px;
          border-bottom: 1px solid var(--border-subtle);
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }

        .indicator-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px dashed var(--border-subtle);
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field-label {
          font-family: var(--font-mono);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          font-weight: 500;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .below-tag {
          color: var(--brand-orange);
          font-family: var(--font-mono);
          text-transform: lowercase;
        }

        .checkbox-inline {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          color: var(--text-muted);
          text-transform: none;
          letter-spacing: 0;
          font-weight: 400;
          cursor: pointer;
        }
        .checkbox-inline input {
          accent-color: var(--brand-orange);
          cursor: pointer;
        }

        .field-helper {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
          line-height: 1.5;
        }

        .freq-group {
          display: flex;
          gap: 0;
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          overflow: hidden;
        }
        .freq-btn {
          flex: 1;
          padding: 8px 10px;
          background: transparent;
          border: none;
          border-right: 1px solid var(--border-subtle);
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 11px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .freq-btn:last-child { border-right: none; }
        .freq-btn:hover { color: var(--text-primary); background: var(--bg-hover); }
        .freq-btn.active {
          background: rgba(247,147,26,0.12);
          color: var(--brand-orange);
          font-weight: 600;
        }

        .text-input {
          padding: 8px 12px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          color: var(--text-primary);
          font-family: var(--font-body);
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s ease;
          width: 100%;
          box-sizing: border-box;
        }
        .text-input:focus {
          border-color: var(--brand-orange);
        }
        .text-input:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .input-prefix {
          position: relative;
        }
        .input-prefix .prefix {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 13px;
          pointer-events: none;
        }
        .input-prefix .text-input {
          padding-left: 24px;
        }

        .threshold-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .range-input {
          flex: 1;
          accent-color: var(--brand-orange);
          cursor: pointer;
        }
        .threshold-number {
          width: 80px;
          padding: 6px 8px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          color: var(--brand-orange);
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 600;
          text-align: center;
          outline: none;
        }
        .threshold-number:focus { border-color: var(--brand-orange); }

        .adjust-warn {
          margin-top: 16px;
          padding: 10px 14px;
          background: rgba(247,147,26,0.08);
          border: 1px solid rgba(247,147,26,0.25);
          border-radius: 6px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        .warn-icon {
          color: var(--brand-orange);
          font-size: 14px;
          flex-shrink: 0;
        }
        .adjust-warn strong {
          color: var(--text-primary);
          font-family: var(--font-mono);
        }

        .status-box {
          margin: 20px;
          padding: 24px;
          text-align: center;
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 12px;
          background: var(--bg-secondary);
          border: 1px dashed var(--border-subtle);
          border-radius: 8px;
        }
        .status-box.error { color: #e8000a; }

        .result-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          padding: 0 20px;
        }
        .result-card {
          padding: 16px 18px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .result-card.highlight {
          background: linear-gradient(135deg, rgba(247,147,26,0.04) 0%, var(--bg-secondary) 100%);
        }
        .result-label {
          font-family: var(--font-mono);
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          font-weight: 500;
        }
        .result-value {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.01em;
          line-height: 1.2;
        }
        .result-card.highlight.pos .result-value { color: #00c44f; }
        .result-card.highlight.neg .result-value { color: #e8000a; }
        .result-sub {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .chart-wrap {
          margin: 0;
          border-top: 1px solid var(--border-subtle);
        }
        .chart-canvas-wrap {
          position: relative;
        }
        .chart-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 24px;
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-muted);
          background: var(--bg-card);
          pointer-events: none;
          line-height: 1.5;
          max-width: 600px;
          margin: 0 auto;
        }
        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 20px 6px;
          flex-wrap: wrap;
          gap: 8px;
        }
        .chart-title {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .chart-sub {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
        }
        .chart-sub .orange { color: var(--brand-orange); font-weight: 600; }
        .chart-sub .muted { color: var(--text-secondary); }
        .chart-sub .green { color: #00c44f; font-weight: 700; font-size: 13px; }

        .chart-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          padding: 8px 20px;
          font-family: var(--font-mono);
          font-size: 9px;
          color: var(--text-muted);
          flex-wrap: wrap;
        }

        @media (max-width: 900px) {
          .form-grid { grid-template-columns: 1fr 1fr; }
          .indicator-section { grid-template-columns: 1fr; }
          .result-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 520px) {
          .form-grid { grid-template-columns: 1fr; }
          .result-grid { grid-template-columns: 1fr; padding: 0 12px; }
          .dca-form { padding: 14px; }
          .result-value { font-size: 18px; }
        }
      `}</style>
    </div>
  );
}
