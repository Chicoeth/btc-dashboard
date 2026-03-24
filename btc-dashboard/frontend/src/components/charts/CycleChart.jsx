/**
 * CycleChart.jsx — Comparador de Ciclos (v2)
 * Correções: média com último valor, legend dinâmica, band de stddev sem stack
 */

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';

const CYCLE_COLORS = [
  '#f7931a', // laranja
  '#3b82f6', // azul
  '#22c55e', // verde
  '#a855f7', // roxo
  '#ec4899', // rosa
  '#14b8a6', // teal
];

const MEAN_COLOR = '#e8e8f0';
const BG_COLOR   = '#0a0a0f'; // cor de fundo do site (para masking do stddev)

const ANCHOR_PRICES = {
  '2011-11-17': 1.99,
  '2013-12-04': 1240,
  '2015-01-14': 166.45,
  '2017-12-17': 19804,
  '2018-12-15': 3124.5,
  '2021-11-10': 68997,
  '2022-11-21': 15473,
  '2025-10-06': 126219,
};

const BULL_CYCLES = [
  { label: 'Ciclo 1', start: '2011-11-17', end: '2013-12-04', startPrice: 1.99,   endPrice: 1240   },
  { label: 'Ciclo 2', start: '2015-01-14', end: '2017-12-17', startPrice: 166.45, endPrice: 19804  },
  { label: 'Ciclo 3', start: '2018-12-15', end: '2021-11-10', startPrice: 3124.5, endPrice: 68997  },
  { label: 'Ciclo 4', start: '2022-11-21', end: '2025-10-06', startPrice: 15473,  endPrice: 126219 },
];

const BEAR_CYCLES = [
  { label: 'Baixa 1',        start: '2013-12-04', end: '2015-01-14', startPrice: 1240,   endPrice: 166.45 },
  { label: 'Baixa 2',        start: '2017-12-17', end: '2018-12-15', startPrice: 19804,  endPrice: 3124.5 },
  { label: 'Baixa 3',        start: '2021-11-10', end: '2022-11-21', startPrice: 68997,  endPrice: 15473  },
  { label: 'Baixa 4 (atual)',start: '2025-10-06', end: null,         startPrice: 126219, endPrice: null   },
];

const HALVING_CYCLES = [
  { label: 'Halving 1',        start: '2012-11-28', end: '2016-07-09' },
  { label: 'Halving 2',        start: '2016-07-09', end: '2020-05-11' },
  { label: 'Halving 3',        start: '2020-05-11', end: '2024-04-19' },
  { label: 'Halving 4 (atual)',start: '2024-04-19', end: null         },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function dateToMs(dateStr) {
  return new Date(dateStr + 'T00:00:00Z').getTime();
}

function msToDateStr(ms) {
  return new Date(ms).toISOString().split('T')[0];
}

function fmtMultiple(v) {
  if (v >= 100) return v.toFixed(0) + 'x';
  if (v >= 10)  return v.toFixed(1) + 'x';
  return v.toFixed(2) + 'x';
}

function buildPriceMap(priceData) {
  const map = new Map();
  for (const [ts, close] of priceData) map.set(msToDateStr(ts), close);
  for (const [date, price] of Object.entries(ANCHOR_PRICES)) map.set(date, price);
  return map;
}

function getPrice(map, dateStr, priceData) {
  if (map.has(dateStr)) return map.get(dateStr);
  const ts = dateToMs(dateStr);
  let best = null, bestDiff = Infinity;
  for (const [t, c] of priceData) {
    const d = Math.abs(t - ts);
    if (d < bestDiff) { bestDiff = d; best = c; }
  }
  return best;
}

function buildCycleSeries(priceData, priceMap, startDate, endDate, startPrice) {
  const startMs = dateToMs(startDate);
  const endMs   = endDate ? dateToMs(endDate) : Date.now();
  const points  = [[0, 1.0]];

  for (const [ts, close] of priceData) {
    if (ts < startMs) continue;
    if (ts > endMs)   break;
    const dayN = Math.round((ts - startMs) / 86400000);
    if (dayN === 0) continue;
    points.push([dayN, close / startPrice]);
  }

  if (endDate) {
    const endPrice = getPrice(priceMap, endDate, priceData);
    if (endPrice) {
      const dayN = Math.round((dateToMs(endDate) - startMs) / 86400000);
      points.push([dayN, endPrice / startPrice]);
    }
  }

  const seen = new Set();
  return points
    .filter(([d]) => { if (seen.has(d)) return false; seen.add(d); return true; })
    .sort((a, b) => a[0] - b[0]);
}

function buildHalvingSeries(priceData, priceMap, startDate, endDate) {
  const startMs    = dateToMs(startDate);
  const endMs      = endDate ? dateToMs(endDate) : Date.now();
  const startPrice = getPrice(priceMap, startDate, priceData);
  if (!startPrice) return [];

  const points = [[0, 1.0]];

  for (const [ts, close] of priceData) {
    if (ts < startMs) continue;
    if (ts > endMs)   break;
    const dayN = Math.round((ts - startMs) / 86400000);
    if (dayN === 0) continue;
    points.push([dayN, close / startPrice]);
  }

  if (endDate) {
    const endPrice = getPrice(priceMap, endDate, priceData);
    if (endPrice) {
      const dayN = Math.round((dateToMs(endDate) - startMs) / 86400000);
      points.push([dayN, endPrice / startPrice]);
    }
  }

  const seen = new Set();
  return points
    .filter(([d]) => { if (seen.has(d)) return false; seen.add(d); return true; })
    .sort((a, b) => a[0] - b[0]);
}

/**
 * Calcula média e +/-1σ dia a dia.
 *
 * FIX 1: quando um ciclo termina antes do maxDay, continuamos usando seu
 * ÚLTIMO valor conhecido — evita o "spike" que ocorria quando o ciclo
 * saía abruptamente do cálculo da média.
 */
function buildMeanStdDev(seriesList) {
  const valid = seriesList.filter(s => s.length > 0);
  if (!valid.length) return { mean: [], upper: [], lower: [] };

  const maxDay = Math.max(...valid.map(s => s[s.length - 1][0]));
  const mean = [], upper = [], lower = [];

  for (let d = 0; d <= maxDay; d++) {
    const vals = valid.map(series => {
      const exact = series.find(p => p[0] === d);
      if (exact) return exact[1];

      let before = null, after = null;
      for (const p of series) {
        if (p[0] <= d) before = p;
        else if (after === null) after = p;
      }

      if (!before && !after) return null;
      if (!before) return after[1];
      // FIX: se o ciclo terminou, mantém o último valor em vez de retornar null
      if (!after) return before[1];

      const t = (d - before[0]) / (after[0] - before[0]);
      return before[1] + t * (after[1] - before[1]);
    }).filter(v => v !== null);

    if (!vals.length) continue;

    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = vals.length > 1
      ? Math.sqrt(vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length)
      : 0;

    mean.push([d, avg]);
    upper.push([d, avg + std]);
    lower.push([d, Math.max(0.001, avg - std)]); // clamp para log scale
  }

  return { mean, upper, lower };
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function CycleChart({ priceData, loading, error }) {
  const chartRef  = useRef(null);
  const chartInst = useRef(null);

  const [mode, setMode]                   = useState('halving');
  const [showMean, setShowMean]           = useState(false);
  const [showStd,  setShowStd]            = useState(false);
  const [echartsReady, setEchartsReady]   = useState(false);
  // FIX 3: rastreia quais séries estão visíveis (para recalcular a média)
  const [legendSelected, setLegendSelected] = useState({});

  useEffect(() => { import('echarts').then(() => setEchartsReady(true)); }, []);

  // Reseta seleção da legenda ao trocar de modo
  useEffect(() => { setLegendSelected({}); }, [mode]);

  const priceMap = useMemo(() => {
    if (!priceData?.length) return new Map();
    return buildPriceMap(priceData);
  }, [priceData]);

  const { cycleDefs, seriesList } = useMemo(() => {
    if (!priceData?.length) return { cycleDefs: [], seriesList: [] };
    if (mode === 'bull') {
      return {
        cycleDefs: BULL_CYCLES,
        seriesList: BULL_CYCLES.map(c => buildCycleSeries(priceData, priceMap, c.start, c.end, c.startPrice)),
      };
    }
    if (mode === 'bear') {
      return {
        cycleDefs: BEAR_CYCLES,
        seriesList: BEAR_CYCLES.map(c => buildCycleSeries(priceData, priceMap, c.start, c.end, c.startPrice)),
      };
    }
    return {
      cycleDefs: HALVING_CYCLES,
      seriesList: HALVING_CYCLES.map(c => buildHalvingSeries(priceData, priceMap, c.start, c.end)),
    };
  }, [priceData, priceMap, mode]);

  // FIX 3: filtra ciclos escondidos na legenda antes de calcular a média
  const { mean, upper, lower } = useMemo(() => {
    if (!showMean || seriesList.length < 2) return { mean: [], upper: [], lower: [] };

    const previousDefs   = cycleDefs.slice(0, -1);
    const previousSeries = seriesList.slice(0, -1);

    const activeSeries = previousSeries.filter((_, i) => {
      const label = previousDefs[i]?.label;
      return !label || legendSelected[label] !== false;
    });

    if (!activeSeries.length) return { mean: [], upper: [], lower: [] };
    return buildMeanStdDev(activeSeries);
  }, [seriesList, cycleDefs, showMean, legendSelected]);

  const buildOption = useCallback(() => {
    if (!priceData?.length || !cycleDefs.length) return null;

    // FIX 5: limita o eixo X ao máximo das séries principais (sem stddev)
    const xMax = Math.max(...seriesList.map(s => s[s.length - 1]?.[0] ?? 0));

    const mainSeries = cycleDefs.map((c, i) => ({
      type: 'line',
      name: c.label,
      data: seriesList[i].map(([d, v]) => [d, v]),
      smooth: false,
      symbol: 'none',
      lineStyle: {
        color: CYCLE_COLORS[i % CYCLE_COLORS.length],
        width: i === cycleDefs.length - 1 ? 2.5 : 1.8,
      },
      emphasis: { disabled: true },
      z: i === cycleDefs.length - 1 ? 5 : 3,
    }));

    const extraSeries = [];

    if (showMean && mean.length) {
      extraSeries.push({
        type: 'line',
        name: 'Média',
        data: mean.map(([d, v]) => [d, v]),
        smooth: false,
        symbol: 'none',
        lineStyle: { color: MEAN_COLOR, width: 2, type: 'dashed' },
        z: 6,
        emphasis: { disabled: true },
      });

      // FIX 5: stddev band sem stack (funciona com escala log)
      // Técnica: upper preenche para baixo com cor transparente,
      // lower preenche para baixo com cor de FUNDO OPACA — apaga a parte de baixo
      // Resultado visual: só a faixa entre lower e upper fica colorida
      if (showStd && upper.length && lower.length) {
        extraSeries.push({
          type: 'line',
          name: '__std_upper__',
          data: upper.map(([d, v]) => [d, v]),
          smooth: false,
          symbol: 'none',
          lineStyle: { color: 'rgba(232,232,240,0.3)', width: 1 },
          areaStyle: { color: 'rgba(232,232,240,0.1)', origin: 'auto' },
          z: 1,
          silent: true,
          emphasis: { disabled: true },
          legendHoverLink: false,
        });
        extraSeries.push({
          type: 'line',
          name: '__std_lower__',
          data: lower.map(([d, v]) => [d, v]),
          smooth: false,
          symbol: 'none',
          lineStyle: { color: 'rgba(232,232,240,0.3)', width: 1 },
          areaStyle: { color: BG_COLOR, origin: 'auto' },
          z: 2,
          silent: true,
          emphasis: { disabled: true },
          legendHoverLink: false,
        });
      }
    }

    return {
      backgroundColor: 'transparent',
      animation: false,
      grid: { top: 24, left: 76, right: 32, bottom: 80 },
      legend: {
        type: 'scroll',
        bottom: 4,
        left: 'center',
        width: '90%',
        itemWidth: 16,
        itemHeight: 2,
        icon: 'rect',
        textStyle: { color: '#9090b0', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 },
        pageButtonItemGap: 5,
        pageTextStyle: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 },
        formatter: name => (name.startsWith('__') ? null : name),
        selectedMode: true,
        // Preserva o estado visual (visível/oculto) após cada re-render
        selected: legendSelected,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          lineStyle: { color: 'rgba(255,255,255,0.15)', width: 1, type: 'dashed' },
          label: { show: false },
        },
        backgroundColor: '#111120',
        borderColor: '#252540',
        borderWidth: 1,
        padding: [10, 14],
        formatter(params) {
          if (!params?.length) return '';
          const day = params[0]?.axisValue;
          const lines = params
            .filter(p => !String(p.seriesName).startsWith('__'))
            .map(p => {
              const v = Array.isArray(p.value) ? p.value[1] : p.value;
              if (v == null || isNaN(v)) return '';
              return `<div style="display:flex;justify-content:space-between;gap:16px;margin:2px 0">
                <span style="color:${p.color};font-family:JetBrains Mono,monospace;font-size:10px">${p.seriesName}</span>
                <span style="color:#e8e8f0;font-family:JetBrains Mono,monospace;font-size:11px;font-weight:600">${fmtMultiple(v)}</span>
              </div>`;
            }).filter(Boolean).join('');
          return `<div style="font-family:JetBrains Mono,monospace;font-size:10px;color:#5a5a80;margin-bottom:6px">Dia ${day}</div>${lines}`;
        },
      },
      xAxis: {
        type: 'value',
        name: 'Dias desde o início do ciclo',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 },
        axisLine: { lineStyle: { color: '#1e1e35' } },
        axisTick: { show: false },
        axisLabel: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
        min: 0,
        // FIX 5: limita ao máximo das séries principais — evita o eixo se expandir por causa do stddev
        max: xMax + Math.round(xMax * 0.03),
      },
      yAxis: {
        type: 'log',
        logBase: 10,
        name: 'Retorno (normalizado em 1x)',
        nameLocation: 'middle',
        nameGap: 60,
        nameTextStyle: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#5a5a80',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          formatter: v => {
            if (v >= 1000) return (v / 1000).toFixed(0) + 'k×';
            if (v >= 10)   return v.toFixed(0) + '×';
            if (v >= 1)    return v.toFixed(1) + '×';
            return v.toFixed(2) + '×';
          },
        },
        splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
        min: value => Math.max(0.001, value.min * 0.8),
      },
      series: [...mainSeries, ...extraSeries],
    };
  }, [cycleDefs, seriesList, showMean, showStd, mean, upper, lower, priceData, legendSelected]);

  // ── Init ──
  useEffect(() => {
    if (!echartsReady || !chartRef.current || !priceData?.length) return;
    const init = async () => {
      const echarts = await import('echarts');
      if (!chartInst.current) {
        const chart = echarts.init(chartRef.current, null, { renderer: 'canvas' });
        chartInst.current = chart;
        new ResizeObserver(() => chart.resize()).observe(chartRef.current);

        // FIX 3: recalcula média ao clicar na legenda
        chart.on('legendselectchanged', params => {
          setLegendSelected({ ...params.selected });
        });
      }
      const option = buildOption();
      if (option) chartInst.current.setOption(option, { notMerge: true });
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [echartsReady, priceData?.length]);

  // ── Update ──
  useEffect(() => {
    const chart = chartInst.current;
    if (!chart || !priceData?.length) return;
    const option = buildOption();
    if (option) chart.setOption(option, { notMerge: true });
  }, [buildOption]);

  const hasData       = priceData?.length > 0;
  const currentCycle  = cycleDefs[cycleDefs.length - 1];

  return (
    <div className="cycle-chart-wrapper">

      {/* Mode selector */}
      <div className="mode-selector">
        <button className={`mode-btn ${mode === 'halving' ? 'active' : ''}`} onClick={() => setMode('halving')}>
          <span className="mode-icon">⬡</span> Performance a partir do Halving
        </button>
        <button className={`mode-btn ${mode === 'bull' ? 'active' : ''}`} onClick={() => setMode('bull')}>
          <span className="mode-icon">↑</span> Ciclos de Alta
        </button>
        <button className={`mode-btn ${mode === 'bear' ? 'active' : ''}`} onClick={() => setMode('bear')}>
          <span className="mode-icon">↓</span> Ciclos de Baixa
        </button>
      </div>

      {/* Header — FIX 4: sem badges de dias/máx */}
      <div className="chart-header">
        <div className="chart-left">
          {currentCycle && (
            <>
              <span className="cycle-label">
                {mode === 'halving' ? 'Halving atual' : mode === 'bull' ? 'Ciclo de alta atual' : 'Ciclo de baixa atual'}
              </span>
              <span className="cycle-name">{currentCycle.label}</span>
            </>
          )}
        </div>
        <div className="chart-controls">
          <label className={`check-box ${showMean ? 'active' : ''}`}>
            <input type="checkbox" checked={showMean} onChange={e => { setShowMean(e.target.checked); if (!e.target.checked) setShowStd(false); }} />
            <span className="check-indicator" />
            Adicionar Média
          </label>
          {showMean && (
            <label className={`check-box ${showStd ? 'active' : ''}`}>
              <input type="checkbox" checked={showStd} onChange={e => setShowStd(e.target.checked)} />
              <span className="check-indicator" />
              ±1 Desvio Padrão
            </label>
          )}
        </div>
      </div>

      {/* Chart — inline style para garantir height */}
      <div style={{ position: 'relative', height: '520px' }}>
        {(loading || error || !hasData) && (
          <div className="chart-state">
            {loading && <><div className="spinner" /><span>Carregando...</span></>}
            {error   && <span style={{ color: '#ef4444' }}>⚠ {error}</span>}
            {!loading && !error && !hasData && <span>Sem dados disponíveis.</span>}
          </div>
        )}
        <div
          ref={chartRef}
          style={{
            width: '100%',
            height: '520px',
            opacity: (loading || error || !hasData) ? 0 : 1,
            transition: 'opacity 0.3s',
          }}
        />
      </div>

      {hasData && (
        <div className="chart-footer">
          <span>Escala logarítmica · normalizado em 1× no início de cada ciclo</span>
          <span>·</span>
          <span>Clique na legenda para mostrar/ocultar ciclos (afeta a média)</span>
          <span>·</span>
          <span>Fonte: Yahoo Finance / CoinMetrics</span>
        </div>
      )}

      <style jsx>{`
        .cycle-chart-wrapper { display: flex; flex-direction: column; }

        .mode-selector { display: flex; gap: 8px; padding: 16px 20px 0; flex-wrap: wrap; }
        .mode-btn {
          display: flex; align-items: center; gap: 7px; padding: 9px 16px;
          font-family: var(--font-mono); font-size: 11px; font-weight: 500;
          letter-spacing: 0.03em; color: var(--text-muted);
          background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle);
          border-radius: 8px; cursor: pointer; transition: all 0.15s;
        }
        .mode-btn:hover { color: var(--text-primary); background: rgba(255,255,255,0.05); border-color: var(--border-default); }
        .mode-btn.active { color: var(--brand-orange); background: rgba(247,147,26,0.08); border-color: rgba(247,147,26,0.3); }
        .mode-icon { font-size: 13px; opacity: 0.8; }

        .chart-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 20px 10px; border-bottom: 1px solid var(--border-subtle);
          flex-wrap: wrap; gap: 10px; margin-top: 12px;
        }
        .chart-left { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
        .cycle-label {
          font-family: var(--font-mono); font-size: 10px; color: var(--text-muted);
          letter-spacing: 0.06em; text-transform: uppercase;
        }
        .cycle-name {
          font-family: var(--font-display); font-size: 18px; font-weight: 700;
          color: var(--text-primary); letter-spacing: -0.01em;
        }

        .chart-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .check-box {
          display: flex; align-items: center; gap: 7px; padding: 6px 12px;
          font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.04em;
          color: var(--text-muted); background: rgba(255,255,255,0.02);
          border: 1px solid var(--border-subtle); border-radius: 6px;
          cursor: pointer; user-select: none; transition: all 0.15s;
        }
        .check-box:hover { color: var(--text-secondary); background: rgba(255,255,255,0.04); }
        .check-box.active { color: var(--text-primary); border-color: rgba(247,147,26,0.3); background: rgba(247,147,26,0.06); }
        .check-box input { display: none; }
        .check-indicator {
          display: inline-block; width: 12px; height: 12px;
          border: 1px solid var(--border-default); border-radius: 3px;
          position: relative; flex-shrink: 0; transition: all 0.15s;
        }
        .check-box.active .check-indicator { background: var(--brand-orange); border-color: var(--brand-orange); }
        .check-box.active .check-indicator::after {
          content: ''; position: absolute; inset: 2px;
          background: url("data:image/svg+xml,%3Csvg viewBox='0 0 10 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 4L4 7L9 1' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;
        }

        .chart-state {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 12px;
          color: var(--text-muted); font-family: var(--font-mono); font-size: 13px; z-index: 10;
        }
        .spinner {
          width: 24px; height: 24px; border: 2px solid var(--border-subtle);
          border-top-color: var(--brand-orange); border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .chart-footer {
          display: flex; align-items: center; gap: 8px; padding: 8px 20px;
          border-top: 1px solid var(--border-subtle); font-family: var(--font-mono);
          font-size: 10px; color: var(--text-muted); flex-wrap: wrap;
        }
      `}</style>
    </div>
  );
}
